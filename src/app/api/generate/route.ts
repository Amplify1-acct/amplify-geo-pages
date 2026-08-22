import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";
import { buildEnhancePagePrompt } from "@/lib/enhance-prompt";
import { buildPagePrompt } from "@/lib/master-prompt";
import { getGoogleAccessToken } from "@/lib/google";
import { formatLocation } from "@/lib/location";

export const maxDuration = 300;

type GenerateInput = {
  workflow?: "create" | "enhance";
  website?: string;
  practiceArea?: string;
  city?: string;
  state?: string;
  pageUrl?: string;
  notes?: string;
};

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

type DriveApproval = {
  approvalId?: string;
  createTime?: string;
  status?: string;
};

async function startAronApproval(
  accessToken: string,
  fileId: string,
  workflow: "create" | "enhance",
) {
  const headers = { Authorization: `Bearer ${accessToken}` };
  const capabilityResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=capabilities(canStartApproval)&supportsAllDrives=true`,
    { headers, cache: "no-store" },
  );

  if (!capabilityResponse.ok) return { enabled: false };
  const capabilityData = (await capabilityResponse.json()) as {
    capabilities?: { canStartApproval?: boolean };
  };

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

  if (!capabilityData.capabilities?.canStartApproval) return { enabled: false };

  const startResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}/approvals:start`,
    {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        reviewerEmails: ["aron@amplifylaw.ai"],
        lockFile: false,
        message:
          workflow === "enhance"
            ? "Please review and edit this enhanced page, then approve it when it is ready for Will and Abigail."
            : "Please edit this geo page, then approve it when it is ready for Will and Abigail.",
        fileContentChangeBehavior: "RESET_APPROVAL",
      }),
    },
  );
  if (!startResponse.ok) return { enabled: false };

  const approval = (await startResponse.json()) as DriveApproval;
  return {
    enabled: true,
    id: approval.approvalId,
    status: approval.status || "IN_PROGRESS",
  };
}

async function createGoogleDoc(
  accessToken: string,
  name: string,
  markdown: string,
  responseId: string,
  workflow: "create" | "enhance",
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
      const approval = await startAronApproval(accessToken, file.id, workflow);
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
          appProperties: { amplifyResponseId: responseId },
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
    `https://www.googleapis.com/drive/v3/files/${file.id}/permissions?sendNotificationEmail=true&emailMessage=${encodeURIComponent(
      workflow === "enhance"
        ? "An enhanced AMPLIFY page is ready for your review."
        : "A new AMPLIFY geo page is ready for your review.",
    )}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "user",
        role: "writer",
        emailAddress: "aron@amplifylaw.ai",
      }),
    },
  );

  if (!shareResponse.ok) {
    const error = (await shareResponse.json()) as { error?: { message?: string } };
    throw new Error(
      error.error?.message || "The draft was created but could not be shared with Aron.",
    );
  }

  const approval = await startAronApproval(accessToken, file.id, workflow);

  return {
    id: file.id,
    name: file.name || name,
    url: file.webViewLink || `https://docs.google.com/document/d/${file.id}/edit`,
    approval,
  };
}

export async function POST(request: NextRequest) {
  try {
    const input = (await request.json()) as GenerateInput;
    const workflow = input.workflow === "enhance" ? "enhance" : "create";
    const website = input.website?.trim() || "";
    const practiceArea = input.practiceArea?.trim() || "";
    const city = input.city?.trim() || "";
    const state = input.state?.trim() || "";
    const pageUrl = input.pageUrl?.trim() || "";

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

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI is not configured yet. Add OPENAI_API_KEY in Vercel." },
        { status: 503 },
      );
    }

    await getGoogleAccessToken();
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const name =
      workflow === "enhance"
        ? enhancementDocumentName(pageUrl)
        : documentName({ practiceArea, city, state });
    const prompt =
      workflow === "enhance"
        ? buildEnhancePagePrompt({ pageUrl, notes: input.notes })
        : buildPagePrompt({
            website,
            practiceArea,
            city,
            state,
            notes: input.notes,
          });
    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5.6",
      reasoning: { effort: "high" },
      tools: [{ type: "web_search", search_context_size: "high" }],
      background: true,
      metadata: {
        document_name: name.slice(0, 500),
        workflow,
      },
      input: prompt,
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

export async function GET(request: NextRequest) {
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

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.responses.retrieve(jobId);

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

    const markdown = cleanMarkdown(response.output_text || "");
    if (!markdown) throw new Error("The draft came back empty. Please try again.");

    const accessToken = await getGoogleAccessToken();
    const workflow = response.metadata?.workflow === "enhance" ? "enhance" : "create";
    const metadataName = response.metadata?.document_name;
    const fallbackName =
      typeof metadataName === "string" && metadataName.trim()
        ? metadataName
        : "AMPLIFY Geo Page Draft";
    const name =
      workflow === "enhance"
        ? markdownDocumentName(markdown, fallbackName)
        : fallbackName;
    const doc = await createGoogleDoc(accessToken, name, markdown, response.id, workflow);

    return NextResponse.json({
      status: "completed",
      doc,
      workflow,
      sharedWith: "aron@amplifylaw.ai",
      wordCount: markdown.split(/\s+/).filter(Boolean).length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Something went wrong.";
    const status = /not connected|reconnect|expired/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
