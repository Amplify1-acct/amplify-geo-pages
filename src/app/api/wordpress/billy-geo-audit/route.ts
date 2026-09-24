import { NextRequest, NextResponse } from "next/server";
import {
  BILLY_GEO_PAGES,
  BILLY_QUEENS_MEDIA_SLUG,
  auditBillyGeoPage,
  canonicalGroupPages,
  repairBillyGeoContent,
  type AuditWordPressPage,
  type BillyGeoPageSpec,
} from "@/lib/billy-geo-audit";
import { getClientProfile } from "@/lib/clients";
import { ctaContact } from "@/lib/cta";
import { getGoogleAccessToken, getGoogleEmail } from "@/lib/google";
import { getWordPressConfig, wordPressAuthorization } from "@/lib/wordpress";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const QUEENS_ASSET_PATH = "/geo-heroes/queens-county-ny-v2.jpg";

type WordPressMedia = {
  id: number;
  slug?: string;
  source_url?: string;
};

function allowedPublisher(email: string | null) {
  if (!email) return false;
  return (process.env.WORDPRESS_ALLOWED_GOOGLE_EMAILS || "accounts@amplifylaw.ai")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}

function plainText(value = "") {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function authorizedContext() {
  const accessToken = await getGoogleAccessToken();
  const email = await getGoogleEmail(accessToken);
  if (!allowedPublisher(email)) {
    throw new Error("This Google account is not allowed to audit or repair WordPress pages.");
  }
  const client = getClientProfile("billy-cooper-law");
  if (!client?.wordpress) throw new Error("Billy Cooper Law is not connected to WordPress.");
  const config = getWordPressConfig(client.id);
  return {
    accessToken,
    client,
    config,
    authorization: wordPressAuthorization(config),
  };
}

async function wordPressPages(siteUrl: string, authorization: string, ids: number[]) {
  const params = new URLSearchParams({
    context: "edit",
    status: "publish,draft,pending,private,future",
    per_page: "100",
    include: ids.join(","),
    _fields: "id,link,status,featured_media,title,excerpt,content",
  });
  const response = await fetch(`${siteUrl}/wp-json/wp/v2/pages?${params}`, {
    headers: { Authorization: authorization },
    cache: "no-store",
  });
  const data = await response.json().catch(() => []) as AuditWordPressPage[] | { message?: string };
  if (!response.ok || !Array.isArray(data)) {
    throw new Error(Array.isArray(data) ? "WordPress could not return the GEO pages." : data.message || "WordPress could not return the GEO pages.");
  }
  return data;
}

async function existingQueensMedia(siteUrl: string, authorization: string) {
  const params = new URLSearchParams({
    context: "edit",
    slug: BILLY_QUEENS_MEDIA_SLUG,
    per_page: "10",
    _fields: "id,slug,source_url",
  });
  const response = await fetch(`${siteUrl}/wp-json/wp/v2/media?${params}`, {
    headers: { Authorization: authorization },
    cache: "no-store",
  });
  const data = await response.json().catch(() => []) as WordPressMedia[];
  return response.ok && Array.isArray(data) ? data[0]?.id || 0 : 0;
}

async function ensureQueensMedia(
  siteUrl: string,
  authorization: string,
  appOrigin: string,
) {
  const existing = await existingQueensMedia(siteUrl, authorization);
  if (existing) return existing;
  const asset = await fetch(new URL(QUEENS_ASSET_PATH, appOrigin), { cache: "no-store" });
  if (!asset.ok) throw new Error("The new Queens County banner asset could not be opened.");
  const upload = await fetch(`${siteUrl}/wp-json/wp/v2/media`, {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": "image/jpeg",
      "Content-Disposition": 'attachment; filename="queens-county-ny-v2.jpg"',
    },
    body: await asset.arrayBuffer(),
    cache: "no-store",
  });
  const media = await upload.json().catch(() => ({})) as WordPressMedia & { message?: string };
  if (!upload.ok || !media.id) throw new Error(media.message || "WordPress could not upload the Queens County banner.");
  const describe = await fetch(`${siteUrl}/wp-json/wp/v2/media/${media.id}`, {
    method: "POST",
    headers: { Authorization: authorization, "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Queens County New York waterfront banner",
      alt_text: "Long Island City waterfront and Queensboro Bridge in Queens County, New York",
      caption: "",
      description: "Location-specific GEO page banner for Queens County, New York.",
    }),
    cache: "no-store",
  });
  if (!describe.ok) throw new Error("The Queens County banner uploaded, but its media details could not be saved.");
  return media.id;
}

async function backUpPage(
  accessToken: string,
  page: AuditWordPressPage,
) {
  const timestamp = new Date().toISOString();
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify({
    name: `billy-geo-page-${page.id}-${timestamp.replace(/[:.]/g, "-")}.json`,
    parents: ["appDataFolder"],
    appProperties: {
      amplifyWordPressBackup: "true",
      wordpressPageId: String(page.id),
      repairKind: "billy-geo-audit",
    },
  })], { type: "application/json" }));
  form.append("file", new Blob([JSON.stringify({ backedUpAt: timestamp, page }, null, 2)], { type: "application/json" }), "backup.json");
  const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });
  const data = await response.json().catch(() => ({})) as { id?: string; error?: { message?: string } };
  if (!response.ok || !data.id) throw new Error(data.error?.message || `Page ${page.id} could not be backed up before repair.`);
  return data.id;
}

function pageMeta(page: AuditWordPressPage, spec: BillyGeoPageSpec, content: string) {
  const title = plainText(page.title?.raw || page.title?.rendered || `${spec.label} Personal Injury Lawyer`);
  const excerpt = plainText(page.excerpt?.raw || page.excerpt?.rendered || content);
  const metaDescription = (excerpt || (spec.locale === "es"
    ? `Billy Cooper Law ofrece orientación sobre lesiones personales para personas en ${spec.location}.`
    : `Billy Cooper Law provides personal injury guidance for people in ${spec.location}.`)).slice(0, 155);
  const contact = ctaContact(getClientProfile("billy-cooper-law")!, spec.location);
  const pageUrl = page.link || "https://www.billycooperlaw.com/";
  return {
    seoTitle: `${title} | Billy Cooper Law`.slice(0, 70),
    metaDescription,
    schema: {
      "@context": "https://schema.org",
      "@graph": [{
        "@type": "LegalService",
        "@id": `${pageUrl}#legal-service`,
        name: "Billy Cooper Law",
        url: pageUrl,
        telephone: contact.display,
        areaServed: spec.label,
      }],
    },
  };
}

async function auditReport(
  siteUrl: string,
  authorization: string,
) {
  const pages = await wordPressPages(siteUrl, authorization, BILLY_GEO_PAGES.map((page) => page.id));
  const byId = new Map(pages.map((page) => [page.id, page]));
  const queensMediaId = await existingQueensMedia(siteUrl, authorization);
  const rows = BILLY_GEO_PAGES.map((spec) => auditBillyGeoPage(
    byId.get(spec.id),
    spec,
    spec.mediaId || queensMediaId,
  ));
  return {
    generatedAt: new Date().toISOString(),
    total: rows.length,
    complete: rows.filter((row) => row.complete).length,
    incomplete: rows.filter((row) => !row.complete).length,
    repairableIncomplete: rows.filter((row) => !row.complete && row.repairable).length,
    rows,
  };
}

export async function GET() {
  try {
    const { config, authorization } = await authorizedContext();
    return NextResponse.json(await auditReport(config.siteUrl, authorization));
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Billy Cooper GEO audit could not be completed.";
    const status = /allowed|connected|authorized|expired|token/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const input = await request.json() as { pageId?: number };
    const pageId = Number(input.pageId);
    const spec = BILLY_GEO_PAGES.find((page) => page.id === pageId);
    if (!spec || spec.repairable === false) {
      return NextResponse.json({ error: "This page is not in the repairable Billy Cooper GEO inventory." }, { status: 400 });
    }
    const { accessToken, client, config, authorization } = await authorizedContext();
    const groupSpecs = canonicalGroupPages(spec);
    const ids = [...new Set([...groupSpecs.map((page) => page.id), pageId])];
    const pages = await wordPressPages(config.siteUrl, authorization, ids);
    const linkedPages = new Map(pages.map((page) => [page.id, page]));
    const current = linkedPages.get(pageId);
    if (!current || current.status !== "publish") throw new Error(`Published GEO page ${pageId} was not found.`);
    const mediaId = spec.mediaId || await ensureQueensMedia(config.siteUrl, authorization, request.nextUrl.origin);
    const content = repairBillyGeoContent(current, spec, linkedPages, request.nextUrl.origin, client);
    const backupId = await backUpPage(accessToken, current);
    const save = await fetch(`${config.siteUrl}/wp-json/wp/v2/pages/${pageId}`, {
      method: "POST",
      headers: { Authorization: authorization, "Content-Type": "application/json" },
      body: JSON.stringify({ content, featured_media: mediaId, status: "publish" }),
      cache: "no-store",
    });
    const saved = await save.json().catch(() => ({})) as AuditWordPressPage & { message?: string };
    if (!save.ok || !saved.id) throw new Error(saved.message || `WordPress could not repair GEO page ${pageId}.`);
    const meta = pageMeta(saved, spec, content);
    const metaSave = await fetch(`${config.siteUrl}/wp-json/amplify-geo/v1/page-meta`, {
      method: "POST",
      headers: { Authorization: authorization, "Content-Type": "application/json" },
      body: JSON.stringify({
        page_id: pageId,
        seo_title: meta.seoTitle,
        meta_description: meta.metaDescription,
        client_id: client.id,
        hero_image_id: mediaId,
        schema: meta.schema,
      }),
      cache: "no-store",
    });
    const metaSaved = await metaSave.json().catch(() => ({})) as { message?: string; heroImageId?: number; heroResolvedId?: number };
    if (!metaSave.ok) throw new Error(metaSaved.message || `The hero image could not be confirmed on GEO page ${pageId}.`);
    if (metaSaved.heroImageId !== mediaId || metaSaved.heroResolvedId !== mediaId) {
      throw new Error(`WordPress did not resolve the expected banner on GEO page ${pageId}.`);
    }
    const verifiedPages = await wordPressPages(config.siteUrl, authorization, [pageId]);
    const audit = auditBillyGeoPage(verifiedPages[0], spec, mediaId);
    if (!audit.complete) throw new Error(`GEO page ${pageId} saved but did not pass the post-repair audit.`);
    return NextResponse.json({ ok: true, pageId, backupId, audit, heroResolvedId: metaSaved.heroResolvedId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Billy Cooper GEO page could not be repaired.";
    const status = /allowed|connected|authorized|expired|token/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

