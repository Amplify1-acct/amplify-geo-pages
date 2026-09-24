import { withAIContinuation } from "@/lib/ai-control.mjs";
import { userActionRoute } from "../../../lib/ai-control.mjs";
import { aiFetch } from "../../../lib/ai-control.mjs";
import { hiringBlogResearchReference } from "@/lib/hiring-blog-reference";
import { assertAttorneyAuthority, AuthorityReviewPending } from "@/lib/attorney-authority-review";
import { ATTORNEY_AUTHORITY_PROMPT, approvedAuthorityScope, normalizeAuthorityAttorney } from "@/lib/attorney-authority";
import { getEditorialSlot } from '@/lib/editorial-store';
import { faqRepairPrompt, nextFaqRepairAttempt } from "@/lib/generation-faq-repair";
import { uploadRedis, uploadLease } from "@/lib/wordpress-upload-store";
import { NextRequest, NextResponse } from "next/server";
import { rememberCreatedDocConnection } from "@/lib/google-doc-upload-connection";
import OpenAI from "openai";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";
import { buildEnhancePagePrompt } from "@/lib/enhance-prompt";
import { buildBlogPrompt } from "@/lib/blog-prompt";
import { buildAopPrompt } from "@/lib/aop-prompt";
import { buildSubAopPrompt } from "@/lib/sub-aop-prompt";
import { buildPagePrompt } from "@/lib/master-prompt";
import { getGoogleAccessToken, getGoogleEmail } from "@/lib/google";
import { isAronReviewer } from "@/lib/aron-review-queue";
import { formatLocation } from "@/lib/location";
import { getClientProfileAsync } from "@/lib/client-store";
import {
  AMPLIFY_FAQ_STANDARD_VERSION,
  deduplicateGeneratedFaqSources,
  validateAmplifyFaqMarkdown,
} from "@/lib/faq-standard";

export const maxDuration = 300;

type GenerateInput = {
  editorialSlotId?: string;
  clientId?: string;
  workflow?: "create" | "enhance" | "blog" | "aop" | "subaop";
  website?: string;
  practiceArea?: string;
  city?: string;
  state?: string;
  pageUrl?: string;
  topic?: string;
  primaryKeyword?: string;
  jurisdiction?: string;
  parentPracticeArea?: string;
  relatedQuestions?: string[];
  notes?: string;
  authorityAttorney?: string;
  revisionDocId?: string;
  revisionFeedback?: string;
  revisionNumber?: number;
};

type Workflow = "create" | "enhance" | "blog" | "aop" | "subaop";

function validHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function documentName(input: Required<Pick<GenerateInput, "practiceArea" | "city" | "state">>) {
  return `${formatLocation(input.city, input.state)} — ${input.practiceArea} Geo Page`;
}

function enhancementDocumentName(pageUrl: string) {
  const url = new URL(pageUrl);
  const page = decodeURIComponent(url.pathname)
    .split("/")
    .filter(Boolean)
    .at(-1)
    ?.replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
  return `${page || url.hostname.replace(/^www\./, "")} — Enhanced Page`;
}

function blogDocumentName(topic: string) {
  return `${topic.trim()} — Blog Article`.slice(0, 240);
}

function aopDocumentName(practiceArea: string) {
  return `${practiceArea.trim()} — Area of Practice Page`.slice(0, 240);
}

function subAopDocumentName(practiceArea: string, parentPracticeArea: string) {
  return `${practiceArea.trim()} — ${parentPracticeArea.trim()} Sub-AOP Page`.slice(0, 240);
}

function markdownDocumentName(markdown: string, fallback: string) {
  const heading = markdown.match(/^#\s+(.+?)\s*$/m)?.[1]
    ?.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`]/g, "")
    .trim();
  return heading ? `${heading} — Enhanced Page`.slice(0, 240) : fallback;
}

function cleanMarkdown(value: string) {
  return value
    .replace(/^```(?:markdown)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

async function readAmplifyGoogleDoc(
  accessToken: string,
  docId: string,
) {
  if (!/^[A-Za-z0-9_-]{10,200}$/.test(docId)) {
    throw new Error("The Google Doc selected for revision is not valid.");
  }

  const headers = { Authorization: `Bearer ${accessToken}` };
  const metadataResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(docId)}?fields=id,mimeType,appProperties&supportsAllDrives=true`,
    { headers, cache: "no-store" },
  );
  const metadata = await metadataResponse.json() as {
    mimeType?: string;
    appProperties?: Record<string, string>;
    error?: { message?: string };
  };
  if (!metadataResponse.ok) {
    throw new Error(metadata.error?.message || "The Google Doc selected for revision could not be opened.");
  }
  if (
    metadata.mimeType !== "application/vnd.google-apps.document" ||
    !metadata.appProperties?.amplifyResponseId
  ) {
    throw new Error("Only a Google Doc created by AMPLIFY can be revised through this workflow.");
  }

  const exportResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(docId)}/export?mimeType=${encodeURIComponent("text/plain")}`,
    { headers, cache: "no-store" },
  );
  if (!exportResponse.ok) {
    throw new Error("The current Google Doc could not be prepared for revision.");
  }
  const draft = (await exportResponse.text()).replace(/\u0000/g, "").trim();
  if (draft.length < 300) {
    throw new Error("The current Google Doc does not contain enough usable content to revise.");
  }
  return draft.slice(0, 120_000);
}

function revisionPrompt(
  basePrompt: string,
  currentDraft: string,
  feedback: string,
) {
  return `${basePrompt}

# REVIEWER-DIRECTED REVISION

Revise the complete existing draft below using the review feedback. Return the entire replacement document in Markdown, not a list of edits, explanation, or response to the reviewer.

Requirements:
- Treat the review feedback as the requested editorial direction, while still following every factual, legal, client-brand, SEO, structure, linking, and safety requirement in the main prompt.
- Preserve strong, accurate material that the feedback does not ask you to change.
- Make every requested change throughout the document, including headings, body copy, FAQs, metadata, schema instructions, CTA language, and internal-link recommendations when relevant.
- Re-research any factual point affected by the feedback. Never invent a firm fact, result, credential, location, phone number, deadline, or legal rule.
- Do not mention the feedback, the revision process, AI, or the prior draft in the finished document.

<reviewer_feedback>
${feedback}
</reviewer_feedback>

<current_draft>
${currentDraft}
</current_draft>`;
}

type DriveApproval = {
  approvalId?: string;
  createTime?: string;
  status?: string;
};

async function startAronApproval(
  accessToken: string,
  fileId: string,
) {
  const headers = { Authorization: `Bearer ${accessToken}` };
  const capabilityResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=capabilities(canStartApproval)&supportsAllDrives=true`,
    { headers, cache: "no-store" },
  );

  if (!capabilityResponse.ok) return { enabled: false };


  const approvalsResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}/approvals?pageSize=100`,
    { headers, cache: "no-store" },
  );
  if (approvalsResponse.ok) {
    const approvalsData = (await approvalsResponse.json()) as { items?: DriveApproval[] };
    const existing = [...(approvalsData.items || [])].sort((a, b) =>
      (b.createTime || "").localeCompare(a.createTime || ""),
    )[0];
    if (existing?.approvalId) {
      return {
        enabled: true,
        id: existing.approvalId,
        status: existing.status || "IN_PROGRESS",
      };
    }
  }

  // Review stays in AMPLIFY. Starting a native Drive approval can notify the
  // reviewer, so only recognize existing requests; never create new ones.
  return { enabled: false };

}

async function createGoogleDoc(
  accessToken: string,
  name: string,
  markdown: string,
  responseId: string,
  workflow: Workflow,
  reviewerEmail: string,
  clientId: string,
) {
  const searchParams = new URLSearchParams({
    q: `appProperties has { key='amplifyResponseId' and value='${responseId}' } and trashed = false`,
    spaces: "drive",
    fields: "files(id,name,webViewLink)",
    pageSize: "1",
  });
  const existingResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files?${searchParams}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    },
  );
  if (existingResponse.ok) {
    const existing = (await existingResponse.json()) as {
      files?: Array<{ id: string; name?: string; webViewLink?: string }>;
    };
    const file = existing.files?.[0];
    if (file) {
      const approval = await startAronApproval(accessToken, file.id);
      return {
        id: file.id,
        name: file.name || name,
        url: file.webViewLink || `https://docs.google.com/document/d/${file.id}/edit`,
        approval,
      };
    }
  }

  const rendered = await marked.parse(markdown, { gfm: true, breaks: false });
  const body = sanitizeHtml(rendered, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["h1", "h2"]),
    allowedAttributes: { a: ["href", "title"] },
    allowedSchemes: ["http", "https", "mailto"],
  });

  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:Arial,sans-serif;color:#182a2a;line-height:1.55;margin:56px;max-width:780px}
    h1{font-size:30px;line-height:1.15;margin:30px 0 16px}h2{font-size:22px;line-height:1.25;margin:28px 0 10px}
    h3{font-size:18px;margin:24px 0 8px}p{margin:0 0 13px}li{margin:4px 0}a{color:#315e52}
  </style></head><body>${body}</body></html>`;

  const form = new FormData();
  form.append(
    "metadata",
    new Blob(
      [
        JSON.stringify({
          name,
          mimeType: "application/vnd.google-apps.document",
          appProperties: {
            amplifyResponseId: responseId,
            amplifyClientId: clientId,
            amplifyWorkflow: workflow,
            amplifyFaqStandard: AMPLIFY_FAQ_STANDARD_VERSION,
          },
        }),
      ],
      { type: "application/json" },
    ),
  );
  form.append("file", new Blob([html], { type: "text/html" }), "draft.html");

  const uploadResponse = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    },
  );

  const file = (await uploadResponse.json()) as {
    id?: string;
    name?: string;
    webViewLink?: string;
    error?: { message?: string };
  };

  if (!uploadResponse.ok || !file.id) {
    throw new Error(file.error?.message || "The Google Doc could not be created.");
  }

  const shareResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${file.id}/permissions?sendNotificationEmail=false`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "user",
        role: "writer",
        emailAddress: reviewerEmail,
      }),
    },
  );

  if (!shareResponse.ok) {
    const error = (await shareResponse.json()) as { error?: { message?: string } };
    throw new Error(
      error.error?.message || "The draft was created but could not be shared with Aron.",
    );
  }

  const approval = await startAronApproval(accessToken, file.id);

  return {
    id: file.id,
    name: file.name || name,
    url: file.webViewLink || `https://docs.google.com/document/d/${file.id}/edit`,
    approval,
  };
}

async function handlePOST(request: NextRequest) {
  try {
    const input = (await request.json()) as GenerateInput;
    const workflow: Workflow = input.workflow === "enhance"
      ? "enhance"
      : input.workflow === "blog"
        ? "blog"
        : input.workflow === "aop"
          ? "aop"
          : input.workflow === "subaop"
            ? "subaop"
        : "create";
    const website = input.website?.trim() || "";
    const practiceArea = input.practiceArea?.trim() || "";
    const city = input.city?.trim() || "";
    const state = input.state?.trim() || "";
    const pageUrl = input.pageUrl?.trim() || "";
    const topic = input.topic?.trim() || "";
    const authorityAttorney = normalizeAuthorityAttorney(input.authorityAttorney);
    const parentPracticeArea = input.parentPracticeArea?.trim() || "";
    const revisionDocId = input.revisionDocId?.trim() || "";
    const revisionFeedback = input.revisionFeedback?.replace(/\s+/g, " ").trim() || "";
    const revisionNumber = Math.min(99, Math.max(1, Math.round(Number(input.revisionNumber) || 1)));
    const accessToken = await getGoogleAccessToken();
    const client = await getClientProfileAsync(
      input.clientId,
      workflow === "enhance" ? pageUrl : website,
      accessToken,
    );

    if (!client) {
      return NextResponse.json(
        { error: "Choose a configured client before starting the page." },
        { status: 400 },
      );
    }

    if (workflow === "blog" && input.editorialSlotId) {
      const slot=await getEditorialSlot(input.editorialSlotId);
      if(!slot || slot.clientId!==client.id || new URL(slot.website).hostname.replace(/^www\./,'')!==new URL(client.website).hostname.replace(/^www\./,'') || slot.selectedTopic!==topic) {
        return NextResponse.json({error:"The blog brief does not match its calendar client and selected topic. Reopen it from the calendar."},{status:409});
      }
    }

    if (workflow === "enhance" && !validHttpUrl(pageUrl)) {
      return NextResponse.json(
        { error: "Add the full URL of the live page you want to enhance." },
        { status: 400 },
      );
    }

    if (workflow === "create" && (!validHttpUrl(website) || !practiceArea || !city || !state)) {
      return NextResponse.json(
        { error: "Add a valid website, practice area, city, and state." },
        { status: 400 },
      );
    }

    if (workflow === "blog" && (!validHttpUrl(website) || !topic)) {
      return NextResponse.json(
        { error: "Add a valid client website and blog topic." },
        { status: 400 },
      );
    }

    if (workflow === "aop" && (!validHttpUrl(website) || !practiceArea)) {
      return NextResponse.json(
        { error: "Add a valid client website and practice area." },
        { status: 400 },
      );
    }

    if (workflow === "subaop" && (!validHttpUrl(website) || !parentPracticeArea || !practiceArea)) {
      return NextResponse.json(
        { error: "Add a valid client website, parent Area of Practice, and Sub-AOP name." },
        { status: 400 },
      );
    }
    if (workflow === "subaop" && parentPracticeArea.toLowerCase() === practiceArea.toLowerCase()) {
      return NextResponse.json(
        { error: "The Sub-AOP must be narrower than—and named differently from—the parent AOP." },
        { status: 400 },
      );
    }

    if ((revisionDocId && !revisionFeedback) || (!revisionDocId && revisionFeedback)) {
      return NextResponse.json(
        { error: "Add Aron’s feedback and select the current Google Doc before starting a revision." },
        { status: 400 },
      );
    }
    if (revisionFeedback.length > 10_000) {
      return NextResponse.json(
        { error: "Keep the revision feedback under 10,000 characters." },
        { status: 400 },
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI is not configured yet. Add OPENAI_API_KEY in Vercel." },
        { status: 503 },
      );
    }

    const openai = new OpenAI({ fetch: aiFetch, maxRetries: 0,  apiKey: process.env.OPENAI_API_KEY });
    const name = workflow === "enhance"
      ? enhancementDocumentName(pageUrl)
      : workflow === "blog"
        ? blogDocumentName(topic)
        : workflow === "aop"
          ? aopDocumentName(practiceArea)
          : workflow === "subaop"
            ? subAopDocumentName(practiceArea, parentPracticeArea)
        : documentName({ practiceArea, city, state });
    const basePrompt = workflow === "enhance"
      ? buildEnhancePagePrompt({ pageUrl, notes: input.notes })
      : workflow === "blog"
        ? buildBlogPrompt({
            firmName: client.name,
            website,
            contactUrl: client.contactUrl,
            practiceAreaUrl: Object.entries(client.practiceAreaUrls).find(([label]) =>
              label.toLowerCase() === practiceArea.toLowerCase(),
            )?.[1],
            practiceAreaUrls: client.practiceAreaUrls,
            practiceArea,
            topic,
            primaryKeyword: input.primaryKeyword,
            jurisdiction: input.jurisdiction?.trim()
              || client.blogDefaults.defaultJurisdiction
              || client.jurisdictions[0],
            relatedQuestions: Array.isArray(input.relatedQuestions)
              ? input.relatedQuestions.filter((question): question is string => typeof question === "string").slice(0, 12)
              : undefined,
            notes: input.notes,
          })
        : workflow === "aop"
          ? buildAopPrompt({
              firmName: client.name,
              website,
              contactUrl: client.contactUrl,
              practiceArea,
              primaryKeyword: input.primaryKeyword,
              jurisdiction: input.jurisdiction?.trim()
                || client.blogDefaults.defaultJurisdiction
                || client.jurisdictions[0],
              relatedPracticeAreaUrls: client.practiceAreaUrls,
              notes: input.notes,
            })
          : workflow === "subaop"
            ? buildSubAopPrompt({
                firmName: client.name,
                website,
                contactUrl: client.contactUrl,
                parentPracticeArea,
                parentPracticeAreaUrl: Object.entries(client.practiceAreaUrls).find(([label]) =>
                  label.toLowerCase() === parentPracticeArea.toLowerCase(),
                )?.[1],
                subPracticeArea: practiceArea,
                primaryKeyword: input.primaryKeyword,
                jurisdiction: input.jurisdiction?.trim()
                  || client.blogDefaults.defaultJurisdiction
                  || client.jurisdictions[0],
                relatedPracticeAreaUrls: client.practiceAreaUrls,
                notes: input.notes,
              })
        : buildPagePrompt({
            website,
            practiceArea,
            city,
            state,
            notes: input.notes,
          });
    const prompt = revisionDocId
      ? revisionPrompt(
          basePrompt,
          await readAmplifyGoogleDoc(accessToken, revisionDocId),
          revisionFeedback,
        )
      : basePrompt;
    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5.6",
      reasoning: { effort: "high" },
      tools: [{ type: "web_search", search_context_size: "high" }],
      background: true,
      metadata: {
        document_name: `${name}${revisionDocId ? ` — Revision ${revisionNumber}` : ""}`.slice(0, 500),
        workflow,
        client_id: client.id,
        authority_attorney: workflow === "blog" ? authorityAttorney : "",
        authority_topic: workflow === "blog" ? `${topic} ${input.primaryKeyword || ""}`.slice(0,500) : "",
        editorial_slot_id: input.editorialSlotId || "",
        revision_number: String(revisionNumber),
      },
      input: `${prompt}\n${workflow === "blog" ? [approvedAuthorityScope(client.website, topic, authorityAttorney), hiringBlogResearchReference(client.website, authorityAttorney, topic)].join("\n") : ""}`,
    });

    return NextResponse.json({
      jobId: response.id,
      status: response.status,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Something went wrong.";
    const status = /not connected|reconnect|expired/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

async function handleGET(request: NextRequest) {
  try {
    const jobId = request.nextUrl.searchParams.get("jobId") || "";
    if (!/^[A-Za-z0-9_-]{10,200}$/.test(jobId)) {
      return NextResponse.json({ error: "That research job is not valid." }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI is not configured yet. Add OPENAI_API_KEY in Vercel." },
        { status: 503 },
      );
    }

    const openai = new OpenAI({ fetch: aiFetch, maxRetries: 0,  apiKey: process.env.OPENAI_API_KEY });
    const repairStore = uploadRedis();
    const repairKey = `amplify:generation-faq-repair:v1:${jobId}`;
    const repairedJobId = await repairStore.get<string>(repairKey);
    const response = await openai.responses.retrieve(repairedJobId || jobId);

    if (response.status === "queued" || response.status === "in_progress") {
      return NextResponse.json({ status: response.status });
    }

    if (response.status !== "completed") {
      const details = response as typeof response & {
        error?: { message?: string };
        incomplete_details?: { reason?: string };
      };
      return NextResponse.json(
        {
          status: "error",
          error:
            details.error?.message ||
            details.incomplete_details?.reason ||
            "The research job stopped before the draft was finished. Please try again.",
        },
        { status: 422 },
      );
    }

    const accessToken = await getGoogleAccessToken();
    const client = await getClientProfileAsync(response.metadata?.client_id, undefined, accessToken);
    if (!client) throw new Error("The client profile for this draft is no longer configured.");
    // Editor corrections are pinned to an exact provider response. The original
    // response remains intact, and corrected text passes the same FAQ/source gates.
    const edit = await repairStore.get<{responseId:string;clientId:string;markdown:string}>(`amplify:generation-edit:v1:${response.id}`);
    const edited = edit?.responseId === response.id && edit.clientId === client.id && typeof edit.markdown === "string";
    const markdown = deduplicateGeneratedFaqSources(cleanMarkdown(edited ? edit.markdown : response.output_text || ""));
    if (!markdown) throw new Error("The draft came back empty. Please try again.");
    // Recover failed writing for an authorized editor without creating a Doc,
    // starting another repair, or bypassing any approval/publication checks.
    if (request.nextUrl.searchParams.get("inspect") === "1") {
      if (!isAronReviewer(await getGoogleEmail(accessToken))) {
        return NextResponse.json({ error: "An approved AMPLIFY editor is required." }, { status: 403 });
      }
      return NextResponse.json({ status: "completed", responseId: response.id, markdown,
        metadata: response.metadata, edited }, { headers: { "Cache-Control": "private, no-store" } });
    }
    const faqValidation = validateAmplifyFaqMarkdown(markdown, client.website);
    if (!faqValidation.passed) {
      const attempt = edited ? null : nextFaqRepairAttempt(response.metadata);
      if (attempt !== null) {
        const release = await uploadLease(`faq-repair:${jobId}`);
        if (!release) return NextResponse.json({ status: "in_progress" });
        try {
          const currentRepair = await repairStore.get<string>(repairKey);
          if (currentRepair && currentRepair !== response.id) {
            return NextResponse.json({ status: "in_progress" });
          }
          const repaired = await openai.responses.create({
            model: response.model,
            previous_response_id: response.id,
            reasoning: { effort: "high" },
            tools: [{ type: "web_search", search_context_size: "high" }],
            background: true,
            metadata: { ...response.metadata, client_id: client.id, faq_repair_attempt: String(attempt) },
            input: `${faqRepairPrompt(faqValidation.errors)}\n${approvedAuthorityScope(client.website,response.metadata?.document_name || "",response.metadata?.authority_attorney)}\n${hiringBlogResearchReference(client.website,response.metadata?.authority_attorney || "",response.metadata?.document_name || "")}`,
          });
          await repairStore.set(repairKey, repaired.id, { ex: 7 * 24 * 60 * 60 });
          return NextResponse.json({ status: "in_progress", correctingSources: true });
        } finally { await release(); }
      }
      throw new Error(
        `AMPLIFY FAQ Standard ${AMPLIFY_FAQ_STANDARD_VERSION} failed before Google Doc creation: ${faqValidation.errors.slice(0, 4).join(" ")}`,
      );
    }

    const workflow: Workflow = response.metadata?.workflow === "enhance"
      ? "enhance"
      : response.metadata?.workflow === "blog"
        ? "blog"
        : response.metadata?.workflow === "aop"
          ? "aop"
          : response.metadata?.workflow === "subaop"
            ? "subaop"
        : "create";
    const metadataName = response.metadata?.document_name;
    const fallbackName =
      typeof metadataName === "string" && metadataName.trim()
        ? metadataName
        : "AMPLIFY Geo Page Draft";
    const draftName = workflow === "enhance"
      ? markdownDocumentName(markdown, fallbackName)
      : workflow === "blog"
        ? markdownDocumentName(markdown, fallbackName).replace(/ — Enhanced Page$/, " — Blog Article")
        : workflow === "aop"
          ? markdownDocumentName(markdown, fallbackName).replace(/ — Enhanced Page$/, " — Area of Practice Page")
          : workflow === "subaop"
            ? markdownDocumentName(markdown, fallbackName).replace(/ — Enhanced Page$/, " — Sub-AOP Page")
        : fallbackName;
    const revisionNumber = Math.min(99, Math.max(1, Math.round(Number(response.metadata?.revision_number) || 1)));
    const name = revisionNumber > 1
      ? `${draftName.replace(/ — Revision \d+$/i, "")} — Revision ${revisionNumber}`.slice(0, 240)
      : draftName;
    if (workflow === "blog") {
      try {
        await assertAttorneyAuthority({title: draftName, topic:response.metadata?.authority_topic, authorityAttorney:response.metadata?.authority_attorney, html:await marked.parse(markdown), firmName:client.name, website:client.website});
      } catch (error) {
        if(error instanceof AuthorityReviewPending)return NextResponse.json({status:"in_progress",checkingAuthority:true});
        if (!(error instanceof Error) || !error.message.startsWith("AMPLIFY Attorney Authority Standard failed:")) throw error;
        const attempt=Number(response.metadata?.authority_repair_attempt || "0");
        if (!edited && Number.isInteger(attempt) && attempt>=0 && attempt<2) {
          const release=await uploadLease(`faq-repair:${jobId}`);
          if(!release)return NextResponse.json({status:"in_progress"});
          try {
            const current=await repairStore.get<string>(repairKey);
            if(current && current!==response.id)return NextResponse.json({status:"in_progress"});
            const repaired=await openai.responses.create({model:response.model,previous_response_id:response.id,reasoning:{effort:"high"},tools:[{type:"web_search",search_context_size:"high"}],background:true,
              metadata:{...response.metadata,authority_repair_attempt:String(attempt+1)},
              input:`${ATTORNEY_AUTHORITY_PROMPT}\n${approvedAuthorityScope(client.website,draftName,response.metadata?.authority_attorney)}\n${hiringBlogResearchReference(client.website,response.metadata?.authority_attorney || "",draftName)}\nCorrect these failed checks: ${error.message}\nResearch missing evidence within the approved editorial scope. Return the entire corrected Markdown article, preserving its title, legal copy, all ten FAQs and their citations. Do not silently shorten the authority section.`});
            await repairStore.set(repairKey,repaired.id,{ex:7*24*60*60});
            return NextResponse.json({status:"in_progress",correctingAuthority:true});
          } finally {await release();}
        }
        throw error;
      }
    }
    const doc = await createGoogleDoc(
      accessToken,
      name,
      markdown,
      response.id,
      workflow,
      client.reviewerEmail,
      client.id,
    );
    await rememberCreatedDocConnection(doc.id,accessToken);

    return NextResponse.json({
      status: "completed",
      doc,
      workflow,
      clientId: client.id,
      sharedWith: client.reviewerEmail,
      wordCount: markdown.split(/\s+/).filter(Boolean).length,
      revisionNumber,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Something went wrong.";
    const status = /not connected|reconnect|expired/i.test(message)
      ? 401
      : /AMPLIFY (?:FAQ|Attorney Authority) Standard/i.test(message)
        ? 422
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export const POST = userActionRoute("Generate or revise content", handlePOST);

export async function GET(request: NextRequest) {
  await getGoogleAccessToken();
  return withAIContinuation(request.nextUrl.searchParams.get("jobId") || "", () => handleGET(request));
}
