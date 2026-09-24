import { userActionRoute } from "../../../../lib/ai-control.mjs";
import { aiFetch } from "../../../../lib/ai-control.mjs";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { responsiveBillySpanishVideo } from "@/lib/billy-geo-audit";
import { getClientProfile } from "@/lib/clients";
import { ctaContact, insertCtaBlocks } from "@/lib/cta";
import { directLink } from "@/lib/direct-link";
import { getGoogleAccessToken, getGoogleEmail } from "@/lib/google";
import { getWordPressConfig, wordPressAuthorization } from "@/lib/wordpress";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SPANISH_ROOT_ID = 5529;
const SPANISH_TEMPLATE = "templates/template-default-espanol.php";
const SPANISH_VIDEO_REFERENCE_ID = 7279;
const SPANISH_VIDEO_URL = "https://www.billycooperlaw.com/wp-content/uploads/2026/06/spanish_cooper_firm-overview-aop_260609-v1_v2-1440p.mp4";

type MirrorKey = "new-york-county" | "manhattan" | "upper-west-side" | "upper-east-side" | "washington-heights" | "harlem" | "midtown-manhattan";

type MirrorSpec = {
  key: MirrorKey;
  englishId: number;
  mediaId: number;
  title: string;
  seoTitle: string;
  slug: string;
  label: string;
  location: string;
  hub: boolean;
};

const MIRRORS: MirrorSpec[] = [
  {
    key: "new-york-county",
    englishId: 7591,
    mediaId: 7590,
    title: "Abogado de lesiones personales en el condado de Nueva York, NY",
    seoTitle: "Abogado de lesiones personales en Nueva York | Billy Cooper Law",
    slug: "condado-de-nueva-york",
    label: "Condado de Nueva York",
    location: "Condado de Nueva York, NY",
    hub: true,
  },
  {
    key: "manhattan",
    englishId: 7582,
    mediaId: 7581,
    title: "Abogado de lesiones personales en Manhattan, NY",
    seoTitle: "Abogado de lesiones personales en Manhattan | Billy Cooper Law",
    slug: "manhattan",
    label: "Manhattan",
    location: "Manhattan, NY",
    hub: false,
  },
  {
    key: "upper-west-side",
    englishId: 7585,
    mediaId: 7584,
    title: "Abogado de lesiones personales en Upper West Side, NY",
    seoTitle: "Abogado de lesiones personales en Upper West Side | Billy Cooper Law",
    slug: "upper-west-side",
    label: "Upper West Side",
    location: "Upper West Side, NY",
    hub: false,
  },
  {
    key: "upper-east-side",
    englishId: 7588,
    mediaId: 7587,
    title: "Abogado de lesiones personales en Upper East Side, NY",
    seoTitle: "Abogado de lesiones personales en Upper East Side | Billy Cooper Law",
    slug: "upper-east-side",
    label: "Upper East Side",
    location: "Upper East Side, NY",
    hub: false,
  },
  {
    key: "washington-heights",
    englishId: 7594,
    mediaId: 7593,
    title: "Abogado de lesiones personales en Washington Heights, NY",
    seoTitle: "Abogado de lesiones personales en Washington Heights | Billy Cooper Law",
    slug: "washington-heights",
    label: "Washington Heights",
    location: "Washington Heights, NY",
    hub: false,
  },
  {
    key: "harlem",
    englishId: 7597,
    mediaId: 7596,
    title: "Abogado de lesiones personales en Harlem, NY",
    seoTitle: "Abogado de lesiones personales en Harlem | Billy Cooper Law",
    slug: "harlem",
    label: "Harlem",
    location: "Harlem, NY",
    hub: false,
  },
  {
    key: "midtown-manhattan",
    englishId: 7600,
    mediaId: 7599,
    title: "Abogado de lesiones personales en Midtown Manhattan, NY",
    seoTitle: "Abogado de lesiones personales en Midtown | Billy Cooper Law",
    slug: "midtown-manhattan",
    label: "Midtown Manhattan",
    location: "Midtown Manhattan, NY",
    hub: false,
  },
];

type WordPressPage = {
  id: number;
  link?: string;
  slug?: string;
  status?: string;
  parent?: number;
  author?: number;
  featured_media?: number;
  template?: string;
  title?: { raw?: string; rendered?: string };
  excerpt?: { raw?: string; rendered?: string };
  content?: { raw?: string; rendered?: string };
};

function allowedPublisher(email: string | null) {
  if (!email) return false;
  return (process.env.WORDPRESS_ALLOWED_GOOGLE_EMAILS || "accounts@amplifylaw.ai")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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
    throw new Error("This Google account is not allowed to create Spanish WordPress pages.");
  }
  const client = getClientProfile("billy-cooper-law");
  if (!client?.wordpress) throw new Error("Billy Cooper Law is not connected to WordPress.");
  const config = getWordPressConfig(client.id);
  return { accessToken, client, config, authorization: wordPressAuthorization(config) };
}

async function pageById(siteUrl: string, authorization: string, id: number) {
  const response = await fetch(`${siteUrl}/wp-json/wp/v2/pages/${id}?context=edit`, {
    headers: { Authorization: authorization },
    cache: "no-store",
  });
  const page = await response.json().catch(() => ({})) as WordPressPage & { message?: string };
  if (!response.ok || !page.id) throw new Error(page.message || `WordPress page ${id} could not be loaded.`);
  return page;
}

async function pageBySlug(siteUrl: string, authorization: string, slug: string) {
  const params = new URLSearchParams({
    context: "edit",
    status: "publish,draft,pending,private,future",
    slug,
    per_page: "10",
    _fields: "id,link,slug,status,parent,author,featured_media,template,title,excerpt,content",
  });
  const response = await fetch(`${siteUrl}/wp-json/wp/v2/pages?${params}`, {
    headers: { Authorization: authorization },
    cache: "no-store",
  });
  const pages = await response.json().catch(() => []) as WordPressPage[] | { message?: string };
  if (!response.ok || !Array.isArray(pages)) {
    throw new Error(Array.isArray(pages) ? "WordPress could not search Spanish pages." : pages.message || "WordPress could not search Spanish pages.");
  }
  return pages[0];
}

function stripManagedSections(content: string) {
  return content
    .replace(/\s*<!-- amplify-geo-cta:(?:opening|middle|closing) -->[\s\S]*?<!-- \/wp:(?:image|html) -->\s*/gi, "\n")
    .replace(/\s*<section\b[^>]*class=(['"])[^'"]*\bamplify-geo-cta\b[^'"]*\1[^>]*>[\s\S]*?<\/section>\s*/gi, "\n")
    .replace(/\s*<style\b[^>]*>[\s\S]*?\.amplify-geo-cta[\s\S]*?<\/style>\s*/gi, "\n")
    .replace(/\s*<!-- amplify-geo-directory:v2 -->[\s\S]*?<!-- \/wp:list -->\s*/gi, "\n")
    .replace(/\s*(?:<!-- wp:heading\b[^>]*-->\s*)?<h2\b[^>]*>\s*(?:(?:Manhattan\s+)?Communities We Serve|Comunidades(?: de Manhattan)? (?:que servimos|a las que prestamos servicios))\s*<\/h2>\s*(?:<!-- \/wp:heading -->\s*)?(?:<!-- wp:list\b[^>]*-->\s*)?<ul\b[^>]*>[\s\S]*?<\/ul>\s*(?:<!-- \/wp:list -->\s*)?/gi, "\n")
    .replace(/\s*(?:<!-- wp:paragraph\b[^>]*-->\s*)?<p\b[^>]*>\s*<strong>\s*(?:Other (?:cities|communities)|Otras (?:ciudades|comunidades))[\s\S]*?<\/strong>\s*<\/p>\s*(?:<!-- \/wp:paragraph -->\s*)?(?:<!-- wp:list\b[^>]*-->\s*)?<ul\b[^>]*>[\s\S]*?<\/ul>\s*(?:<!-- \/wp:list -->\s*)?/gi, "\n")
    .replace(/\s*<div\b[^>]*class=(['"])[^'"]*\bwp-video\b[^'"]*\1[^>]*>[\s\S]*?<\/div>\s*/gi, "\n")
    .replace(/\s*<details\b[^>]*class=(['"])[^'"]*\bvideo-transcript\b[^'"]*\1[^>]*>[\s\S]*?<\/details>\s*/gi, "\n")
    .replace(/\s*\[video\b[^\]]*\][\s\S]*?\[\/video\]\s*/gi, "\n")
    .trim();
}

function cleanRedirectLinks(content: string) {
  return content.replace(/href=(['"])([^'"]+)\1/gi, (_match, quote: string, href: string) => {
    const resolved = directLink(href) || href;
    return `href=${quote}${escapeHtml(resolved)}${quote}`;
  });
}

function tokenizeMarkup(content: string) {
  const pieces: string[] = [];
  const tokenized = content.replace(/<!--[\s\S]*?-->|<[^>]+>|\[[^\]\n]+\]/g, (piece) => {
    const token = `__AMPLIFY_HTML_${String(pieces.length).padStart(5, "0")}__`;
    pieces.push(piece);
    return token;
  });
  return { tokenized, pieces };
}

function restoreMarkup(translated: string, pieces: string[]) {
  const observed = [...translated.matchAll(/__AMPLIFY_HTML_(\d{5})__/g)].map((match) => Number(match[1]));
  if (observed.length !== pieces.length || observed.some((value, index) => value !== index)) {
    throw new Error("The Spanish translation changed the WordPress block structure, so the page was not created.");
  }
  let restored = translated;
  pieces.forEach((piece, index) => {
    restored = restored.replace(`__AMPLIFY_HTML_${String(index).padStart(5, "0")}__`, piece);
  });
  return restored.trim();
}

async function translateToSpanish(content: string, spec: MirrorSpec) {
  if (!process.env.OPENAI_API_KEY) throw new Error("OpenAI translation is not configured in Vercel.");
  const openai = new OpenAI({ fetch: aiFetch, maxRetries: 0,  apiKey: process.env.OPENAI_API_KEY });
  const { tokenized, pieces } = tokenizeMarkup(content);
  const response = await openai.responses.create({
    model: process.env.OPENAI_TRANSLATION_MODEL || process.env.OPENAI_MODEL || "gpt-5.6",
    max_output_tokens: 24000,
    input: [{
      role: "user",
      content: [{
        type: "input_text",
        text: `Translate the visible English content below into polished, natural US Spanish for a New York personal-injury law firm's GEO page about ${spec.location}. Preserve every __AMPLIFY_HTML_00000__-style placeholder byte-for-byte, exactly once, in the same order. Do not translate, delete, move, duplicate, or reformat placeholders. Do not add, remove, summarize, soften, or invent any facts, legal claims, addresses, statutes, case names, numbers, citations, or source information. Keep proper place names such as Manhattan, Upper West Side, Upper East Side, Washington Heights, Harlem, and Midtown Manhattan in their standard local form. Translate headings, paragraphs, list text, and link text. Use formal usted language where the source addresses the reader. Return only the complete tokenized Spanish content, with no code fence or commentary.\n\n${tokenized}`,
      }],
    }],
  });
  const translated = response.output_text?.trim();
  if (!translated) throw new Error(`OpenAI did not return the Spanish translation for ${spec.label}.`);
  return restoreMarkup(translated, pieces);
}

function forceH1(content: string, title: string) {
  if (/<h1\b[^>]*>[\s\S]*?<\/h1>/i.test(content)) {
    return content.replace(/<h1\b([^>]*)>[\s\S]*?<\/h1>/i, `<h1$1>${escapeHtml(title)}</h1>`);
  }
  return `<h1>${escapeHtml(title)}</h1>\n${content}`;
}

async function spanishVideoBlock(siteUrl: string, authorization: string) {
  const reference = await pageById(siteUrl, authorization, SPANISH_VIDEO_REFERENCE_ID);
  const rendered = reference.content?.rendered || reference.content?.raw || "";
  const match = rendered.match(/<div\b[^>]*class=(['"])[^'"]*\bwp-video\b[^'"]*\1[^>]*>[\s\S]*?<\/div>\s*<details\b[^>]*class=(['"])[^'"]*\bvideo-transcript\b[^'"]*\2[^>]*>[\s\S]*?<\/details>/i);
  if (!match?.[0] || !match[0].includes(SPANISH_VIDEO_URL)) {
    throw new Error("The approved Billy Cooper Spanish firm video block could not be loaded.");
  }
  return `<!-- amplify-geo-spanish-video:v1 -->\n${match[0].replace(/id=(['"])video-[^'"]+\1/i, 'id="video-amplify-spanish-1"')}`;
}

function insertVideoAfterH1(content: string, video: string) {
  const withoutVideo = stripSpanishVideo(content);
  const blockH1 = withoutVideo.match(/<!-- wp:heading\b[^>]*-->\s*<h1\b[^>]*>[\s\S]*?<\/h1>\s*<!-- \/wp:heading -->/i);
  const classicH1 = withoutVideo.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/i);
  const match = blockH1 || classicH1;
  if (!match || match.index === undefined) return `${video}\n${withoutVideo}`;
  const position = match.index + match[0].length;
  return `${withoutVideo.slice(0, position)}\n\n${video}\n\n${withoutVideo.slice(position)}`;
}

function stripSpanishVideo(content: string) {
  return content
    .replace(/\s*<!-- amplify-geo-spanish-video:v1 -->\s*<div\b[^>]*class=(['"])[^'"]*\bwp-video\b[^'"]*\1[^>]*>[\s\S]*?<\/div>\s*<details\b[^>]*class=(['"])[^'"]*\bvideo-transcript\b[^'"]*\2[^>]*>[\s\S]*?<\/details>\s*/gi, "\n")
    .replace(/\s*<div\b[^>]*class=(['"])[^'"]*\bwp-video\b[^'"]*\1[^>]*>[\s\S]*?<\/div>\s*<details\b[^>]*class=(['"])[^'"]*\bvideo-transcript\b[^'"]*\2[^>]*>[\s\S]*?<\/details>\s*/gi, "\n");
}

function finalUrl(siteUrl: string, spec: MirrorSpec) {
  return spec.hub
    ? `${siteUrl}/es/${spec.slug}/`
    : `${siteUrl}/es/${MIRRORS[0].slug}/${spec.slug}/`;
}

function directoryBlock(siteUrl: string, current: MirrorSpec) {
  const items = MIRRORS.map((spec) => {
    const body = spec.key === current.key
      ? escapeHtml(spec.label)
      : `<a href="${escapeHtml(finalUrl(siteUrl, spec))}">${escapeHtml(spec.label)}</a>`;
    return `  <li>${body}</li>`;
  }).join("\n");
  return `<!-- amplify-geo-directory:v2 -->
<!-- wp:heading -->
<h2>Comunidades que servimos</h2>
<!-- /wp:heading -->
<!-- wp:list -->
<ul>
${items}
</ul>
<!-- /wp:list -->`;
}

function insertDirectory(content: string, siteUrl: string, spec: MirrorSpec) {
  const withoutDirectory = content
    .replace(/\s*<!-- amplify-geo-directory:v2 -->[\s\S]*?<!-- \/wp:list -->\s*/gi, "\n")
    .replace(/\s*<h2\b[^>]*>\s*Comunidades que servimos\s*<\/h2>\s*<ul\b[^>]*>[\s\S]*?<\/ul>\s*/gi, "\n");
  const blockSource = withoutDirectory.match(/<!-- wp:heading\b[^>]*-->\s*<h2\b[^>]*>\s*Fuentes\s*<\/h2>/i);
  const classicSource = withoutDirectory.match(/<h2\b[^>]*>\s*Fuentes\s*<\/h2>/i);
  const source = blockSource || classicSource;
  const position = source?.index ?? withoutDirectory.length;
  return `${withoutDirectory.slice(0, position)}\n${directoryBlock(siteUrl, spec)}\n${withoutDirectory.slice(position)}`;
}

function replaceEnglishGeoLinks(content: string, siteUrl: string, englishPages: Map<number, WordPressPage>) {
  let replaced = content;
  for (const spec of MIRRORS) {
    const source = englishPages.get(spec.englishId)?.link;
    if (!source) continue;
    replaced = replaced.replaceAll(source, finalUrl(siteUrl, spec));
    replaced = replaced.replaceAll(source.replace(/\/$/, ""), finalUrl(siteUrl, spec).replace(/\/$/, ""));
  }
  return cleanRedirectLinks(replaced);
}

async function backUpPage(accessToken: string, page: WordPressPage) {
  const timestamp = new Date().toISOString();
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify({
    name: `billy-spanish-mirror-${page.id}-${timestamp.replace(/[:.]/g, "-")}.json`,
    parents: ["appDataFolder"],
    appProperties: {
      amplifyWordPressBackup: "true",
      wordpressPageId: String(page.id),
      repairKind: "billy-spanish-mirror",
    },
  })], { type: "application/json" }));
  form.append("file", new Blob([JSON.stringify({ backedUpAt: timestamp, page }, null, 2)], { type: "application/json" }), "backup.json");
  const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });
  const data = await response.json().catch(() => ({})) as { id?: string; error?: { message?: string } };
  if (!response.ok || !data.id) throw new Error(data.error?.message || `Page ${page.id} could not be backed up before publishing.`);
  return data.id;
}

function metaDescription(page: WordPressPage, spec: MirrorSpec, content: string) {
  const excerpt = plainText(page.excerpt?.raw || page.excerpt?.rendered || "");
  const firstParagraph = [...content.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => plainText(match[1]))
    .find((value) => value.length >= 80 && !/BILLY COOPER LAW/i.test(value));
  const fallback = `Billy Cooper Law ofrece consultas gratuitas sobre lesiones personales para personas en ${spec.location}.`;
  const source = excerpt || firstParagraph || fallback;
  return source.length <= 155 ? source : `${source.slice(0, 152).replace(/\s+\S*$/, "")}…`;
}

async function saveMeta(
  siteUrl: string,
  authorization: string,
  page: WordPressPage,
  spec: MirrorSpec,
  content: string,
) {
  const client = getClientProfile("billy-cooper-law")!;
  const contact = ctaContact(client, spec.location);
  const pageUrl = finalUrl(siteUrl, spec);
  const response = await fetch(`${siteUrl}/wp-json/amplify-geo/v1/page-meta`, {
    method: "POST",
    headers: { Authorization: authorization, "Content-Type": "application/json" },
    body: JSON.stringify({
      page_id: page.id,
      seo_title: spec.seoTitle,
      meta_description: metaDescription(page, spec, content),
      client_id: client.id,
      hero_image_id: spec.mediaId,
      schema: {
        "@context": "https://schema.org",
        "@graph": [{
          "@type": "LegalService",
          "@id": `${pageUrl}#legal-service`,
          name: "Billy Cooper Law",
          url: pageUrl,
          telephone: contact.display,
          areaServed: spec.label,
          inLanguage: "es-US",
        }],
      },
    }),
    cache: "no-store",
  });
  const saved = await response.json().catch(() => ({})) as { message?: string; heroImageId?: number; heroResolvedId?: number };
  if (!response.ok) throw new Error(saved.message || `La metadata de ${spec.label} no pudo guardarse.`);
  if (saved.heroImageId !== spec.mediaId || saved.heroResolvedId !== spec.mediaId) {
    throw new Error(`WordPress no confirmó el banner local de ${spec.label}.`);
  }
}

async function statusReport(siteUrl: string, authorization: string) {
  const rows = await Promise.all(MIRRORS.map(async (spec) => {
    const page = await pageBySlug(siteUrl, authorization, spec.slug);
    const content = page?.content?.raw || page?.content?.rendered || "";
    const title = plainText(page?.title?.raw || page?.title?.rendered || "");
    const readyDraft = Boolean(
      page?.id
      && title === spec.title
      && plainText(content).length >= 2_000
      && content.includes(SPANISH_VIDEO_URL)
      && !content.includes("Personal Injury Lawyer | City NY"),
    );
    return {
      key: spec.key,
      englishId: spec.englishId,
      title: spec.title,
      label: spec.label,
      slug: spec.slug,
      id: page?.id || 0,
      status: page?.status || "missing",
      link: page?.link || "",
      readyDraft,
      complete: Boolean(
        page?.status === "publish"
        && readyDraft
        && page.featured_media === spec.mediaId
        && page.template === SPANISH_TEMPLATE
        && content.includes(SPANISH_VIDEO_URL)
        && (content.match(/class=(['"])[^'"]*\bamplify-geo-cta\b[^'"]*\1/gi) || []).length === 3
        && content.includes("<!-- amplify-geo-directory:v2 -->")
        && MIRRORS.every((candidate) => plainText(content).includes(candidate.label)),
      ),
    };
  }));
  return {
    total: rows.length,
    complete: rows.filter((row) => row.complete).length,
    missing: rows.filter((row) => row.status === "missing").length,
    drafts: rows.filter((row) => row.status === "draft").length,
    draftsReady: rows.filter((row) => row.status === "draft" && row.readyDraft).length,
    needPreparation: rows.filter((row) => !row.complete && !row.readyDraft).length,
    rows,
  };
}

async function createMirror(key: MirrorKey) {
  const spec = MIRRORS.find((candidate) => candidate.key === key);
  if (!spec) throw new Error("That Spanish mirror is not in the approved New York County set.");
  const { config, authorization } = await authorizedContext();
  const existing = await pageBySlug(config.siteUrl, authorization, spec.slug);
  const existingContent = existing?.content?.raw || existing?.content?.rendered || "";
  const existingTitle = plainText(existing?.title?.raw || existing?.title?.rendered || "");
  if (existing
    && existingTitle === spec.title
    && plainText(existingContent).length >= 2_000
    && existingContent.includes(SPANISH_VIDEO_URL)
    && !existingContent.includes("Personal Injury Lawyer | City NY")) {
    return { created: false, refreshed: false, page: existing };
  }
  const hub = spec.hub ? undefined : await pageBySlug(config.siteUrl, authorization, MIRRORS[0].slug);
  if (!spec.hub && !hub?.id) throw new Error("Create the Spanish New York County hub before its neighborhood pages.");
  const english = await pageById(config.siteUrl, authorization, spec.englishId);
  const source = cleanRedirectLinks(stripManagedSections(english.content?.raw || english.content?.rendered || ""));
  if (plainText(source).length < 500) throw new Error(`English source page ${spec.englishId} did not contain enough content to mirror.`);
  const translated = forceH1(await translateToSpanish(source, spec), spec.title);
  const video = await spanishVideoBlock(config.siteUrl, authorization);
  const content = responsiveBillySpanishVideo(insertVideoAfterH1(translated, video));
  const create = await fetch(`${config.siteUrl}/wp-json/wp/v2/pages${existing?.id ? `/${existing.id}` : ""}`, {
    method: "POST",
    headers: { Authorization: authorization, "Content-Type": "application/json" },
    body: JSON.stringify({
      title: spec.title,
      slug: spec.slug,
      content,
      status: "draft",
      parent: spec.hub ? SPANISH_ROOT_ID : hub!.id,
      featured_media: spec.mediaId,
      template: SPANISH_TEMPLATE,
      author: english.author,
    }),
    cache: "no-store",
  });
  const page = await create.json().catch(() => ({})) as WordPressPage & { message?: string };
  if (!create.ok || !page.id) throw new Error(page.message || `WordPress could not create ${spec.label} in Spanish.`);
  await saveMeta(config.siteUrl, authorization, page, spec, content);
  return { created: !existing, refreshed: Boolean(existing), page };
}

async function finalizeMirrors() {
  const { accessToken, client, config, authorization } = await authorizedContext();
  const entries = await Promise.all(MIRRORS.map(async (spec) => ({ spec, page: await pageBySlug(config.siteUrl, authorization, spec.slug) })));
  const missing = entries.filter((entry) => !entry.page?.id);
  if (missing.length) throw new Error(`Create the remaining Spanish drafts first: ${missing.map((entry) => entry.spec.label).join(", ")}.`);
  const hubId = entries.find((entry) => entry.spec.hub)!.page!.id;
  const englishPages = new Map<number, WordPressPage>();
  for (const spec of MIRRORS) englishPages.set(spec.englishId, await pageById(config.siteUrl, authorization, spec.englishId));
  const video = await spanishVideoBlock(config.siteUrl, authorization);
  const published: Array<{ id: number; url: string; backupId: string }> = [];
  for (const { spec, page } of entries) {
    const current = page!;
    let content = stripManagedSections(current.content?.raw || current.content?.rendered || "");
    content = forceH1(content, spec.title);
    content = responsiveBillySpanishVideo(insertVideoAfterH1(content, video));
    content = replaceEnglishGeoLinks(content, config.siteUrl, englishPages);
    content = insertDirectory(content, config.siteUrl, spec);
    content = insertCtaBlocks(content, {
      origin: process.env.NEXT_PUBLIC_APP_URL || "https://amplify-geo-pages.vercel.app",
      client,
      location: spec.location,
      practiceArea: "Lesiones personales",
      locale: "es",
    });
    const backupId = await backUpPage(accessToken, current);
    const save = await fetch(`${config.siteUrl}/wp-json/wp/v2/pages/${current.id}`, {
      method: "POST",
      headers: { Authorization: authorization, "Content-Type": "application/json" },
      body: JSON.stringify({
        title: spec.title,
        slug: spec.slug,
        content,
        status: "publish",
        parent: spec.hub ? SPANISH_ROOT_ID : hubId,
        featured_media: spec.mediaId,
        template: SPANISH_TEMPLATE,
      }),
      cache: "no-store",
    });
    const saved = await save.json().catch(() => ({})) as WordPressPage & { message?: string };
    if (!save.ok || !saved.id) throw new Error(saved.message || `WordPress could not publish ${spec.label} in Spanish.`);
    await saveMeta(config.siteUrl, authorization, saved, spec, content);
    published.push({ id: saved.id, url: finalUrl(config.siteUrl, spec), backupId });
  }
  const report = await statusReport(config.siteUrl, authorization);
  if (report.complete !== MIRRORS.length) {
    throw new Error(`The Spanish pages were saved, but only ${report.complete} of ${MIRRORS.length} passed verification.`);
  }
  return { published, report };
}

export async function GET() {
  try {
    const { config, authorization } = await authorizedContext();
    return NextResponse.json(await statusReport(config.siteUrl, authorization));
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Spanish mirror inventory could not be loaded.";
    const status = /allowed|connected|authorized|expired|token/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

async function handlePOST(request: NextRequest) {
  if (request.method === "POST") {
    return NextResponse.json({
      error: "This completed one-time Spanish mirror publisher is now read-only. Create any future page through the standard AMPLIFY workflow.",
    }, { status: 410 });
  }
  try {
    const input = await request.json() as { action?: "create" | "finalize"; key?: MirrorKey };
    if (input.action === "create" && input.key) {
      const result = await createMirror(input.key);
      return NextResponse.json({ ok: true, ...result });
    }
    if (input.action === "finalize") {
      const result = await finalizeMirrors();
      return NextResponse.json({ ok: true, ...result });
    }
    return NextResponse.json({ error: "Choose a Spanish mirror action." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Spanish mirror action could not be completed.";
    const status = /allowed|connected|authorized|expired|token/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export const POST = userActionRoute("Translate selected pages", handlePOST);
