import { assertAttorneyAuthority, AuthorityReviewPending } from "@/lib/attorney-authority-review";
import { queuePublicationLinks } from "@/lib/post-publication-worker";
import { usesNewEnhancementImage } from "@/lib/cta";
import { rebaseSchemaPermalink, addFulginitiFaqAnchor } from "@/lib/schema-permalink";
import { NextRequest, NextResponse } from "next/server";
import { blogPublicationPlan } from "@/lib/blog-publication";
import { getAronReviewItem, saveFinalPublication } from "@/lib/aron-review-queue";
import { getClientProfileAsync } from "@/lib/client-store";
import { getGoogleAccessToken, getGoogleEmail } from "@/lib/google";
import { getWordPressConfigAsync, wordPressAuthorization } from "@/lib/wordpress";
import { syncPublishedGeoDirectory } from "@/lib/geo-directory";
import { BILLY_GEO_CHILD_PARENT_IDS } from "@/lib/billy-geo-child-campaign";
import { syncPublishedBillyGeoChildDirectory } from "@/lib/billy-geo-child-directory";
import { insertCtaBlocks } from "@/lib/cta";
import { normalizeEnhancementLocation } from "@/lib/enhancement-location";
import type { ClientProfile } from "@/lib/clients";
import {
  AMPLIFY_FAQ_STANDARD_VERSION,
  assertAmplifyFaqHtml,
  buildAmplifyFaqSchemaNode,
  validateAmplifyLiveFaq,
} from "@/lib/faq-standard";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type WordPressPage = {
  id?: number;
  link?: string;
  slug?: string;
  status?: string;
  modified_gmt?: string;
  date_gmt?: string;
  author?: number;
  parent?: number;
  featured_media?: number;
  template?: string;
  title?: { raw?: string; rendered?: string };
  excerpt?: { raw?: string; rendered?: string };
  content?: { raw?: string; rendered?: string };
  message?: string;
};

function allowedPublisher(email: string | null) {
  if (!email) return false;
  return (process.env.WORDPRESS_ALLOWED_GOOGLE_EMAILS || "accounts@amplifylaw.ai")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}

function cloudflareChallengeMessage(response: Response) {
  let host = "the connected website";
  try {
    host = new URL(response.url).hostname;
  } catch {
    // Keep the generic label when the response URL is unavailable.
  }
  return `Cloudflare is blocking AMPLIFY from ${host}’s WordPress REST API. Check the site's narrowly scoped /wp-json/ skip rule, then try again.`;
}

async function wordPressJson<T>(response: Response, action: string): Promise<T> {
  const text = await response.text();
  const challenged = response.headers.get("cf-mitigated") === "challenge"
    || /<title>\s*Just a moment\.\.\.\s*<\/title>/i.test(text);
  if (challenged) throw new Error(cloudflareChallengeMessage(response));
  if (!text.trim()) throw new Error(`WordPress returned an empty response while ${action}.`);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`WordPress returned an unexpected response while ${action}.`);
  }
}

async function backUpWordPressPage(
  accessToken: string,
  page: WordPressPage,
  sourcePageUrl: string,
  docId: string,
) {
  const timestamp = new Date().toISOString();
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify({
    name: `wordpress-page-${page.id}-${timestamp.replace(/[:.]/g, "-")}.json`,
    parents: ["appDataFolder"],
    appProperties: {
      amplifyWordPressBackup: "true",
      wordpressPageId: String(page.id),
      repairKind: "enhancement-go-live",
    },
  })], { type: "application/json" }));
  form.append("file", new Blob([JSON.stringify({
    backedUpAt: timestamp,
    sourcePageUrl,
    googleDocId: docId,
    wordpressPage: page,
  }, null, 2)], { type: "application/json" }), "backup.json");

  const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });
  const data = await response.json().catch(() => ({})) as { id?: string; error?: { message?: string } };
  if (!response.ok || !data.id) {
    throw new Error(data.error?.message || "The original WordPress page could not be backed up.");
  }
  return data.id;
}

function cleanEnhancementContent(content: string) {
  return content
    .replace(/<!--\s*amplify-geo-update-of:\d+\s*-->\s*/gi, "")
    .replace(/<!--\s*amplify-geo-source:[A-Za-z0-9_-]+\s*-->\s*/gi, "")
    .trim();
}

function decodedText(value: string) {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(?:p|div|h[1-6]|li)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

function truncateAtWord(value: string, maximum: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maximum) return normalized;
  return normalized.slice(0, maximum + 1).replace(/\s+\S*$/, "").trim();
}

function firstUsefulParagraph(content: string) {
  return [...content.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => decodedText(match[1]))
    .find((value) => value.length >= 60) || "";
}

function htmlAttribute(tag: string, name: string) {
  return tag.match(new RegExp(`(?:^|\\s)${name}\\s*=(['"])(.*?)\\1`, "i"))?.[2]?.trim() || "";
}

type PublicMetaSnapshot = {
  seoTitle: string;
  metaDescription: string;
  schema: Record<string, unknown> | null;
  readError?: string;
};

async function publicMetaSnapshot(pageUrl: string, source: WordPressPage, userAgent = "AMPLIFY-Enhancement-Backup/1.0"): Promise<PublicMetaSnapshot> {
  const fallbackTitle = decodedText(source.title?.raw || source.title?.rendered || "");
  const fallbackDescription = decodedText(source.excerpt?.raw || source.excerpt?.rendered || "")
    || firstUsefulParagraph(source.content?.raw || source.content?.rendered || "");
  try {
    const response = await fetch(pageUrl, {
      headers: { Accept: "text/html,application/xhtml+xml", "User-Agent": userAgent },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) return { seoTitle: fallbackTitle, metaDescription: fallbackDescription, schema: null, readError: `Live verification returned HTTP ${response.status}${response.headers.get("cf-mitigated") === "challenge" ? " (Cloudflare challenge)" : ""}.` };
    const documentHtml = await response.text();
    const title = decodedText(documentHtml.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "") || fallbackTitle;
    const description = [...documentHtml.matchAll(/<meta\b[^>]*>/gi)]
      .find((tag) => htmlAttribute(tag[0], "name").toLowerCase() === "description");
    const schemaScript = [...documentHtml.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
      .find((script) => htmlAttribute(script[0], "class").split(/\s+/).includes("amplify-geo-schema"));
    let schema: Record<string, unknown> | null = null;
    if (schemaScript) {
      try {
        const parsed = JSON.parse(schemaScript[1]) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) schema = parsed as Record<string, unknown>;
      } catch {
        schema = null;
      }
    }
    return {
      seoTitle: title,
      metaDescription: htmlAttribute(description?.[0] || "", "content") || fallbackDescription,
      schema,
    };
  } catch {
    return { seoTitle: fallbackTitle, metaDescription: fallbackDescription, schema: null };
  }
}

async function approvedSeoMetadata(
  accessToken: string,
  docId: string,
  draft: WordPressPage,
  client: ClientProfile,
) {
  let seoTitle = "";
  let metaDescription = "";
  try {
    const exportResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(docId)}/export?mimeType=${encodeURIComponent("text/html")}`,
      { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" },
    );
    if (exportResponse.ok) {
      const lines = decodedText(await exportResponse.text()).split("\n").map((line) => line.trim()).filter(Boolean);
      seoTitle = lines.find((line) => /^SEO Title\s*:/i.test(line))?.replace(/^SEO Title\s*:\s*/i, "") || "";
      metaDescription = lines.find((line) => /^Meta Description\s*:/i.test(line))?.replace(/^Meta Description\s*:\s*/i, "") || "";
    }
  } catch {
    // The review copy still contains safe WordPress fallbacks below.
  }
  const pageTitle = draft.title?.raw || draft.title?.rendered || client.name;
  const fallbackDescription = draft.excerpt?.raw
    || decodedText(draft.excerpt?.rendered || "")
    || firstUsefulParagraph(draft.content?.raw || "")
    || `${client.name} explains the legal issues, available options, and next steps that may apply.`;
  return {
    seoTitle: truncateAtWord(seoTitle || `${pageTitle} | ${client.name}`, 70),
    metaDescription: truncateAtWord(metaDescription || fallbackDescription, 160),
  };
}

function enhancementSchema(options: {
  content: string;
  pageUrl: string;
  client: ClientProfile;
  location: string;
  practiceArea: string;
}) {
  const { content, pageUrl, client, location, practiceArea } = options;
  const legalService: Record<string, unknown> = {
    "@type": "LegalService",
    "@id": `${pageUrl}#legal-service`,
    name: `${client.name} — ${practiceArea}${location ? ` in ${location}` : ""}`,
    url: pageUrl,
    serviceType: practiceArea,
    provider: { "@type": "LegalService", name: client.name, url: client.website },
  };
  if (client.phoneDisplay) legalService.telephone = client.phoneDisplay;
  if (location) legalService.areaServed = { "@type": "City", name: location };
  const graph: Array<Record<string, unknown>> = [legalService];
  const faq = buildAmplifyFaqSchemaNode(content, pageUrl);
  if (faq) graph.push(faq);
  return { "@context": "https://schema.org", "@graph": graph };
}

function fallbackOriginalSchema(source: WordPressPage, pageUrl: string, client: ClientProfile) {
  const pageName = decodedText(source.title?.raw || source.title?.rendered || "") || client.name;
  return {
    "@context": "https://schema.org",
    "@graph": [{
      "@type": "LegalService",
      "@id": `${pageUrl}#legal-service`,
      name: `${client.name} — ${pageName}`,
      url: pageUrl,
      provider: { "@type": "LegalService", name: client.name, url: client.website },
      ...(client.phoneDisplay ? { telephone: client.phoneDisplay } : {}),
    }],
  };
}

async function restoreEnhancementSource(options: {
  siteUrl: string;
  authorization: string;
  source: WordPressPage;
  client: ClientProfile;
  snapshot: PublicMetaSnapshot;
}) {
  const { siteUrl, authorization, source, client, snapshot } = options;
  if (!source.id) return false;
  try {
    const restoreResponse = await fetch(`${siteUrl}/wp-json/wp/v2/pages/${source.id}`, {
      method: "POST",
      headers: { Authorization: authorization, "Content-Type": "application/json" },
      body: JSON.stringify({
        title: source.title?.raw || source.title?.rendered || "",
        content: source.content?.raw || source.content?.rendered || "",
        excerpt: source.excerpt?.raw || source.excerpt?.rendered || "",
        featured_media: source.featured_media || 0,
        author: source.author,
        parent: source.parent || 0,
        template: source.template || "",
        status: source.status || "publish",
      }),
      cache: "no-store",
    });
    const restored = await wordPressJson<WordPressPage>(restoreResponse, "restoring the original page after failed verification");
    if (!restoreResponse.ok || restored.id !== source.id || restored.status !== (source.status || "publish")) return false;
    const pageUrl = restored.link || source.link || siteUrl;
    const metaResponse = await fetch(`${siteUrl}/wp-json/amplify-geo/v1/page-meta`, {
      method: "POST",
      headers: { Authorization: authorization, "Content-Type": "application/json" },
      body: JSON.stringify({
        page_id: source.id,
        seo_title: snapshot.seoTitle || decodedText(source.title?.raw || source.title?.rendered || "") || client.name,
        meta_description: snapshot.metaDescription
          || firstUsefulParagraph(source.content?.raw || source.content?.rendered || "")
          || `${client.name} provides information about this legal topic.`,
        client_id: client.id,
        hero_image_id: client.id === "billy-cooper-law" ? source.featured_media || 0 : 0,
        schema: snapshot.schema || fallbackOriginalSchema(source, pageUrl, client),
      }),
      cache: "no-store",
    });
    const metaRestored = await wordPressJson<{ saved?: boolean }>(metaResponse, "restoring the original page metadata");
    return metaResponse.ok && metaRestored.saved === true;
  } catch {
    return false;
  }
}

function hasCurrentFaqStandard(content: string) {
  return content.includes(`amplify-faq-standard:${AMPLIFY_FAQ_STANDARD_VERSION}`);
}

async function verifyPublishedFaq(pageUrl: string) {
  let validationMessage = "The live page could not be checked.";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const verifyUrl = new URL(pageUrl);
      verifyUrl.searchParams.set("amplify_faq_verify", `${Date.now()}-${attempt}`);
      const response = await fetch(verifyUrl, {
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent": "AMPLIFY-FAQ-Verifier/1.0",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) {
        validationMessage = `The live page returned HTTP ${response.status}.`;
        continue;
      }
      const xRobotsTag = response.headers.get("x-robots-tag") || "";
      if (/(?:^|[\s,;])noindex(?:$|[\s,;])/i.test(xRobotsTag)) {
        validationMessage = "The live response is marked noindex in X-Robots-Tag.";
        continue;
      }
      const validation = validateAmplifyLiveFaq(await response.text(), pageUrl);
      if (validation.passed) return;
      validationMessage = validation.errors.slice(0, 4).join(" ");
    } catch (error) {
      validationMessage = error instanceof Error
        ? `The live verification request failed: ${error.message}`
        : "The live verification request failed.";
    }
  }
  throw new Error(validationMessage);
}

async function verifyPublishedFaqOrReturnToDraft(options: {
  clientId: string;
  pageUrl: string;
  pageId: number;
  contentEndpoint: "pages" | "posts";
  siteUrl: string;
  authorization: string;
}) {
  const { pageUrl, pageId, contentEndpoint, siteUrl, authorization } = options;
  let validationMessage = "The live page could not be checked.";
  try {
    // Draft schema may still use ?p=ID after WordPress assigns the public slug.
    // Rebase its identity URLs before running the strict visible/schema checks.
    const schemaReadUrl = new URL(pageUrl);
    schemaReadUrl.searchParams.set("amplify_faq_verify", `schema-${Date.now()}`);
    const snapshot = await publicMetaSnapshot(schemaReadUrl.toString(), {}, "AMPLIFY-FAQ-Verifier/1.0");
    if (snapshot.readError) throw new Error(snapshot.readError);
    const rebased = snapshot.schema ? rebaseSchemaPermalink(snapshot.schema, pageUrl) : null;
    if (rebased && JSON.stringify(rebased) !== JSON.stringify(snapshot.schema)) {
      const bridge = await fetch(`${siteUrl}/wp-json/amplify-geo/v1/page-meta`, {
        method: "POST", headers: { Authorization: authorization, "Content-Type": "application/json" },
        body: JSON.stringify({ page_id: pageId, client_id: options.clientId, seo_title: snapshot.seoTitle, meta_description: snapshot.metaDescription, schema: rebased }),
      });
      if (!bridge.ok) throw new Error("WordPress could not save schema with the public permalink.");
    }
    await verifyPublishedFaq(pageUrl);
    return;
  } catch (error) {
    validationMessage = error instanceof Error ? error.message : validationMessage;
  }

  let rolledBack = false;
  try {
    const rollback = await fetch(`${siteUrl}/wp-json/wp/v2/${contentEndpoint}/${pageId}`, {
      method: "POST",
      headers: { Authorization: authorization, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "draft" }),
      cache: "no-store",
    });
    const restored = await wordPressJson<WordPressPage>(rollback, "returning the unverified page to draft");
    rolledBack = rollback.ok && restored.status === "draft" && restored.id === pageId;
  } catch {
    rolledBack = false;
  }
  if (!rolledBack) {
    throw new Error(`Live FAQ verification failed and WordPress could not return the page to draft: ${validationMessage}`);
  }
  throw new Error(`Live FAQ verification failed, so AMPLIFY returned the page to draft: ${validationMessage}`);
}

async function publishEnhancement(options: {
  accessToken: string;
  siteUrl: string;
  authorization: string;
  draft: WordPressPage;
  docId: string;
  appOrigin: string;
  client: ClientProfile;
}) {
  const { accessToken, siteUrl, authorization, docId, appOrigin, client } = options;
  let draft = options.draft;
  const rawContent = draft.content?.raw || "";
  const sourceId = Number(rawContent.match(/amplify-geo-update-of:(\d+)/i)?.[1]);
  const isTemporaryEnhancement = /(?:^|-)amplify-draft(?:-|$)/i.test(draft.slug || "");
  if (!Number.isInteger(sourceId) || sourceId <= 0 || sourceId === draft.id || !isTemporaryEnhancement) {
    throw new Error("This is not a verified AMPLIFY enhancement draft. The original page was not changed.");
  }
  if (draft.status === "trash") {
    const restoreResponse = await fetch(`${siteUrl}/wp-json/wp/v2/pages/${draft.id}`, {
      method: "POST",
      headers: { Authorization: authorization, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "draft" }),
      cache: "no-store",
    });
    const restored = await wordPressJson<WordPressPage>(restoreResponse, "restoring the temporary review copy");
    if (!restoreResponse.ok || restored.status !== "draft" || !restored.id) {
      throw new Error(restored.message || "The temporary enhancement copy is in the WordPress trash and could not be restored.");
    }
    draft = { ...draft, ...restored };
  }
  if (!["draft", "pending", "publish"].includes(draft.status || "")) {
    throw new Error(`This enhancement copy is currently “${draft.status}” and cannot be applied.`);
  }

  const sourceResponse = await fetch(
    `${siteUrl}/wp-json/wp/v2/pages/${sourceId}?context=edit&_fields=id,link,slug,status,date_gmt,modified_gmt,author,parent,featured_media,template,title,excerpt,content`,
    { headers: { Authorization: authorization }, cache: "no-store" },
  );
  const source = await wordPressJson<WordPressPage>(sourceResponse, "opening the original page");
  if (!sourceResponse.ok || !source.id) {
    throw new Error(source.message || "The original WordPress page could not be opened.");
  }

  const normalizedLocation = normalizeEnhancementLocation({
    pageTitle: draft.title?.raw || draft.title?.rendered || source.title?.raw || source.title?.rendered || "",
    content: rawContent,
    sourceContent: `${source.title?.raw || source.title?.rendered || ""}\n${source.content?.raw || source.content?.rendered || ""}`,
    pageUrl: source.link || siteUrl,
    client,
  });

  const approvedFeaturedMediaId = draft.featured_media || (usesNewEnhancementImage(client) ? 0 : source.featured_media) || 0;
  if (!approvedFeaturedMediaId) throw new Error("The approved enhancement draft needs its verified featured image before publication.");
  let ctaImageUrl = "";
  if (approvedFeaturedMediaId) {
    const mediaResponse = await fetch(
      `${siteUrl}/wp-json/wp/v2/media/${approvedFeaturedMediaId}?context=edit&_fields=id,source_url,alt_text`,
      { headers: { Authorization: authorization }, cache: "no-store" },
    );
    const media = await wordPressJson<{ id?: number; source_url?: string; message?: string }>(
      mediaResponse,
      "opening the page-relevant CTA image",
    );
    if (mediaResponse.ok && media.id && media.source_url) ctaImageUrl = media.source_url;
  }

  const contentWithCtas = insertCtaBlocks(normalizedLocation.content, {
    origin: appOrigin,
    client,
    location: normalizedLocation.location,
    practiceArea: normalizedLocation.practiceArea,
    imageUrl: ctaImageUrl,
    forceRefresh: true,
  });
  if (client.id !== "billy-cooper-law" && (!ctaImageUrl || !contentWithCtas.includes("amplify-geo-cta:"))) {
    throw new Error(`The ${client.name} CTA needs a page-relevant WordPress image. Refresh the review draft before applying it to the original page.`);
  }
  const finalContent = cleanEnhancementContent(contentWithCtas);
  if (finalContent.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().length < 100) {
    throw new Error("The approved enhancement draft does not contain enough usable content.");
  }
  assertAmplifyFaqHtml(finalContent, client.website);
  const approvedSeo = await approvedSeoMetadata(accessToken, docId, draft, client);
  const seoLocation = normalizeEnhancementLocation({
    pageTitle: normalizedLocation.pageTitle,
    seoTitle: approvedSeo.seoTitle,
    content: normalizedLocation.content,
    sourceContent: source.content?.raw || source.content?.rendered || "",
    pageUrl: source.link || siteUrl,
    client,
  });
  const seo = { ...approvedSeo, seoTitle: seoLocation.seoTitle };
  const bridgeResponse = await fetch(`${siteUrl}/wp-json/amplify-geo/v1/status`, {
    headers: { Authorization: authorization },
    cache: "no-store",
  });
  const bridge = await wordPressJson<{ ready?: boolean; message?: string }>(
    bridgeResponse,
    "checking the AMPLIFY WordPress bridge",
  );
  if (!bridgeResponse.ok || bridge.ready !== true) {
    throw new Error(bridge.message || "Update the AMPLIFY WordPress bridge before replacing the existing page. Nothing was changed.");
  }
  const originalMeta = await publicMetaSnapshot(source.link || siteUrl, source);
  const backupId = await backUpWordPressPage(accessToken, source, source.link || siteUrl, docId);
  let updated: WordPressPage;
  let updatedPageUrl = source.link || siteUrl;
  try {
    const updateResponse = await fetch(`${siteUrl}/wp-json/wp/v2/pages/${source.id}`, {
      method: "POST",
      headers: { Authorization: authorization, "Content-Type": "application/json" },
      body: JSON.stringify({
        title: normalizedLocation.pageTitle,
        content: finalContent,
        excerpt: seo.metaDescription,
        featured_media: approvedFeaturedMediaId,
        status: "publish",
      }),
      cache: "no-store",
    });
    updated = await wordPressJson<WordPressPage>(updateResponse, "updating the original page");
    if (!updateResponse.ok || updated.status !== "publish" || !updated.id) {
      throw new Error(updated.message || "WordPress did not update the original page.");
    }

    updatedPageUrl = updated.link || source.link || siteUrl;
    const schema = enhancementSchema({
      content: finalContent,
      pageUrl: updatedPageUrl,
      client,
      location: normalizedLocation.location,
      practiceArea: normalizedLocation.practiceArea,
    });
    const metaResponse = await fetch(`${siteUrl}/wp-json/amplify-geo/v1/page-meta`, {
      method: "POST",
      headers: { Authorization: authorization, "Content-Type": "application/json" },
      body: JSON.stringify({
        page_id: updated.id,
        seo_title: seo.seoTitle,
        meta_description: seo.metaDescription,
        client_id: client.id,
        hero_image_id: client.id === "billy-cooper-law" ? approvedFeaturedMediaId : 0,
        schema,
      }),
      cache: "no-store",
    });
    const metaSaved = await wordPressJson<{ saved?: boolean; message?: string }>(
      metaResponse,
      "saving the approved page SEO",
    );
    if (!metaResponse.ok || metaSaved.saved !== true) {
      throw new Error(metaSaved.message || "WordPress updated the page content, but could not confirm its SEO title, metadata, and schema.");
    }
    await verifyPublishedFaq(updatedPageUrl);
  } catch (error) {
    const restored = await restoreEnhancementSource({
      siteUrl,
      authorization,
      source,
      client,
      snapshot: originalMeta,
    });
    const failure = error instanceof Error ? error.message : "The enhanced page could not be verified.";
    throw new Error(restored
      ? `The enhancement failed its final FAQ checks, so AMPLIFY restored the original page: ${failure}`
      : `The enhancement failed its final FAQ checks and AMPLIFY could not automatically restore the original page. Use backup ${backupId}: ${failure}`);
  }

  let cleanupWarning: string | undefined;
  const trashResponse = await fetch(`${siteUrl}/wp-json/wp/v2/pages/${draft.id}`, {
    method: "DELETE",
    headers: { Authorization: authorization },
    cache: "no-store",
  });
  if (!trashResponse.ok) {
    const unpublishResponse = await fetch(`${siteUrl}/wp-json/wp/v2/pages/${draft.id}`, {
      method: "POST",
      headers: { Authorization: authorization, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "draft" }),
      cache: "no-store",
    });
    if (!unpublishResponse.ok) {
      cleanupWarning = "The original URL was updated, but WordPress could not remove the temporary review copy.";
    }
  }

  return {
    pageId: updated.id,
    pageUrl: updatedPageUrl,
    editUrl: `${siteUrl}/wp-admin/post.php?post=${updated.id}&action=edit`,
    status: updated.status,
    backupId,
    replacedDraftId: draft.id,
    cleanupWarning,
  };
}

export async function POST(request: NextRequest) {
  try {
    const input = await request.json() as {
      clientId?: string;
      recordId?: string;
      pageId?: number;
      docId?: string;
      ownerApproved?: boolean;
      verifyOnly?: boolean;
      workflow?: "create" | "enhance" | "blog" | "aop" | "subaop";
      publishAt?: string;
    };
    const pageId = Number(input.pageId);
    const docId = input.docId?.trim() || "";
    const accessToken = await getGoogleAccessToken();
    const email = await getGoogleEmail(accessToken);
    if (!allowedPublisher(email)) return NextResponse.json({ error: "This Google account is not allowed to publish pages." }, { status: 403 });
    const review = input.recordId ? await getAronReviewItem(input.recordId) : null;
    if (input.recordId && (!review?.aronDone || review.wordpressPageId !== pageId || review.docUrl.match(/\/document\/d\/([A-Za-z0-9_-]+)/)?.[1] !== docId)) {
      return NextResponse.json({ error: "The final review no longer matches the approved document and WordPress draft." }, {status:409});
    }
    const client = await getClientProfileAsync(input.clientId || review?.clientId, review?.website, accessToken);
    if (!client?.wordpress || !Number.isInteger(pageId) || pageId <= 0 || !/^[A-Za-z0-9_-]{10,200}$/.test(docId) || (input.ownerApproved !== true && input.verifyOnly !== true)) {
      return NextResponse.json({ error: "Your final approval, the client, WordPress draft, or Google Doc is missing." }, { status: 400 });
    }

    const config = await getWordPressConfigAsync(client.id, undefined, accessToken);
    const authorization = wordPressAuthorization(config);
    const isBlog = input.workflow === "blog";
    const isAop = input.workflow === "aop";
    const isSubAop = input.workflow === "subaop";
    const isEnhancement = input.workflow === "enhance";
    const contentEndpoint = isBlog ? "posts" : "pages";
    const lookup = await fetch(`${config.siteUrl}/wp-json/wp/v2/${contentEndpoint}/${pageId}?context=edit&_fields=id,link,slug,status,date_gmt,modified_gmt,author,parent,featured_media,template,title,excerpt,content`, {
      headers: { Authorization: authorization }, cache: "no-store",
    });
    const page = await wordPressJson<WordPressPage>(lookup, "opening the approved WordPress draft");
    if (!lookup.ok || !page.id) throw new Error(page.message || "The WordPress draft could not be opened.");
    const sourceType = isBlog ? "blog" : isAop ? "aop" : isSubAop ? "subaop" : "geo";
    const rawPageContent = page.content?.raw || "";
    if (!rawPageContent.includes(`amplify-${sourceType}-source:${docId}`)) {
      return NextResponse.json({ error: "This WordPress draft is not linked to the approved Google Doc. Nothing was published." }, { status: 409 });
    }
    const currentFaqStandard = hasCurrentFaqStandard(rawPageContent);
    if (!currentFaqStandard) {
      return NextResponse.json({
        error: "This review draft predates the current AMPLIFY FAQ standard. Rebuild its WordPress draft before publishing.",
      }, { status: 422 });
    }
    assertAmplifyFaqHtml(rawPageContent, config.siteUrl);
    if (isBlog) await assertAttorneyAuthority({title:page.title?.raw || page.title?.rendered || "", html:rawPageContent, firmName:client.name, website:config.siteUrl, authorityAttorney:review?.authorityAttorney});
    // A review-page preflight must never reach publication, scheduling or queue mutations.
    if (input.verifyOnly === true) return NextResponse.json({ok:true, authorityVerified:true, status:page.status});

    if (isEnhancement) {
      const result = await publishEnhancement({
        accessToken,
        siteUrl: config.siteUrl,
        authorization,
        draft: page,
        docId,
        appOrigin: request.nextUrl.origin,
        client,
      });
      await saveFinalPublication(docId, client.id, result, input.recordId);
      const linking = await queuePublicationLinks(config, {pageId: result.pageId!, workflow: input.workflow, practiceAreaUrls: client.practiceAreaUrls, reset: true});
      return NextResponse.json({
        ok: true,
        ...result,
        linking,
        publishedAt: new Date().toISOString(),
      });
    }

    const requestedPublishAt = input.publishAt?.trim() || "";
    const publishDate = requestedPublishAt ? new Date(requestedPublishAt) : null;
    if (requestedPublishAt && (!publishDate || Number.isNaN(publishDate.getTime()))) {
      return NextResponse.json({ error: "The selected publishing date is invalid." }, { status: 400 });
    }
    const blogPlan = isBlog ? blogPublicationPlan(requestedPublishAt) : null;
    const scheduleForLater = blogPlan?.status === "future";
    const nextStatus = scheduleForLater ? "future" : "publish";
    const savedPublishTime = page.date_gmt ? Date.parse(`${page.date_gmt.replace(/Z$/, "")}Z`) : NaN;
    const alreadyScheduled = scheduleForLater && page.status === "future"
      && Math.abs(savedPublishTime - publishDate!.getTime()) < 1000;
    const alreadyPublished = page.status === "publish" && nextStatus === "publish";
    if (alreadyScheduled || alreadyPublished) {
      if (alreadyPublished && page.link) {
        await verifyPublishedFaqOrReturnToDraft({
        clientId: client.id,          pageUrl: page.link,
          pageId,
          contentEndpoint,
          siteUrl: config.siteUrl,
          authorization,
        });
      }
      await saveFinalPublication(docId, client.id, {pageId:page.id,pageUrl:page.link,status:page.status || nextStatus}, input.recordId);
      return NextResponse.json({
        ok: true,
        alreadyFinalized: true,
        linking: await queuePublicationLinks(config, {pageId, workflow: input.workflow, practiceAreaUrls: client.practiceAreaUrls, status: page.status, publishAt: requestedPublishAt}),
        pageId: page.id,
        pageUrl: page.link,
        status: page.status,
        publishedAt: alreadyPublished ? new Date().toISOString() : undefined,
        scheduledAt: alreadyScheduled ? publishDate?.toISOString() : undefined,
      });
    }
    if (page.status !== "draft" && page.status !== "pending") {
      return NextResponse.json({ error: `This page is currently “${page.status}”, not a review draft.` }, { status: 409 });
    }
    // Enhancement copies must only be applied through publishEnhancement above.
    if (/amplify-geo-update-of:\d+/i.test(rawPageContent)) {
      throw new Error("This is an enhancement review copy. Use Approve & update existing page; it cannot be published as a new page.");
    }
    const publishBody: Record<string, unknown> = { status: nextStatus };
    const publicSlug = (page.slug || "").replace(/-amplify-draft-.+$/i, "");
    if (publicSlug !== page.slug) {
      if (!publicSlug) throw new Error("The draft has no valid permanent URL.");
      const collisionsResponse = await fetch(`${config.siteUrl}/wp-json/wp/v2/${contentEndpoint}?slug=${encodeURIComponent(publicSlug)}&status=publish,future,draft,pending,private&per_page=100&_fields=id,parent`, {
        headers: { Authorization: authorization }, cache: "no-store",
      });
      const collisions = await wordPressJson<WordPressPage[]>(collisionsResponse, "checking the permanent page URL");
      if (!collisionsResponse.ok || !Array.isArray(collisions)) throw new Error("The permanent URL could not be checked. Nothing was published.");
      if (collisions.some(candidate => candidate.id !== pageId && (isBlog || (candidate.parent || 0) === (page.parent || 0)))) {
        throw new Error("Another page already uses this permanent URL. Prepare an enhancement of that page instead of publishing a duplicate.");
      }
      publishBody.slug = publicSlug;
    }
    const anchoredPublishContent = addFulginitiFaqAnchor(page.content?.raw || "", config.siteUrl);
    if (anchoredPublishContent !== page.content?.raw) publishBody.content = anchoredPublishContent;
    if (blogPlan) publishBody.date_gmt = blogPlan.dateGmt;
    const publish = await fetch(`${config.siteUrl}/wp-json/wp/v2/${contentEndpoint}/${pageId}`, {
      method: "POST",
      headers: { Authorization: authorization, "Content-Type": "application/json" },
      body: JSON.stringify(publishBody),
    });
    const published = await wordPressJson<WordPressPage>(publish, "publishing the approved draft");
    if (!publish.ok || published.status !== nextStatus) {
      throw new Error(published.message || (scheduleForLater
        ? "WordPress did not schedule the approved blog."
        : `WordPress kept the page in “${published.status || "unknown"}” status instead of publishing it. Check the site’s publishing restrictions.`));
    }
    if (scheduleForLater && (!published.date_gmt
      || Math.abs(Date.parse(`${published.date_gmt.replace(/Z$/, "")}Z`) - publishDate!.getTime()) >= 1000
      || !Number.isFinite(Date.parse(`${published.date_gmt.replace(/Z$/, "")}Z`)))) {
      throw new Error("WordPress did not confirm the assigned publishing date. Check the post’s saved schedule before retrying.");
    }
    if (!scheduleForLater && published.link) {
      await verifyPublishedFaqOrReturnToDraft({
        clientId: client.id,        pageUrl: published.link,
        pageId,
        contentEndpoint,
        siteUrl: config.siteUrl,
        authorization,
      });
    }
    const directoryPagesLinked = client.id === "billy-cooper-law" && !isBlog && !isAop && !isSubAop
      ? await syncPublishedGeoDirectory(config.siteUrl, authorization, pageId)
      : 0;
    const childServiceLinks = client.id === "billy-cooper-law"
      && !isBlog
      && !isAop
      && !isSubAop
      && Number(published.parent) > 0
      && BILLY_GEO_CHILD_PARENT_IDS.has(Number(published.parent))
      ? await syncPublishedBillyGeoChildDirectory(config.siteUrl, authorization, Number(published.parent))
      : 0;
    await saveFinalPublication(docId, client.id, {pageId:published.id || pageId,pageUrl:published.link,status:published.status || nextStatus}, input.recordId);
    return NextResponse.json({
      ok: true,
      pageId: published.id,
      pageUrl: published.link,
      status: published.status,
      directoryPagesLinked,
      childServiceLinks,
      linking: await queuePublicationLinks(config, {pageId: published.id || pageId, workflow: input.workflow, practiceAreaUrls: client.practiceAreaUrls, status: published.status, publishAt: requestedPublishAt, reset: true}),
      publishedAt: scheduleForLater ? undefined : new Date().toISOString(),
      scheduledAt: scheduleForLater ? publishDate?.toISOString() : undefined,
    });
  } catch (error) {
    if(error instanceof AuthorityReviewPending)return NextResponse.json({error:"Verifying the saved draft’s authority sources. This page will update when verification finishes. Nothing has been published.",authorityPending:true},{status:429});
    const message = error instanceof Error ? error.message : "The WordPress draft could not be published.";
    console.error("[wordpress/go-live]", message);
    const status = /not connected|reconnect|expired|authorized/i.test(message)
      ? 401
      : /AMPLIFY FAQ standard|FAQ checks|FAQ verification/i.test(message)
        ? 422
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
