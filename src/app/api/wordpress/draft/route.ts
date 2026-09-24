import { userActionRoute } from "../../../../lib/ai-control.mjs";
import { aiFetch } from "../../../../lib/ai-control.mjs";
import { assertAttorneyAuthority, AuthorityReviewPending } from "@/lib/attorney-authority-review";
import { relevantFeaturedImage } from "@/lib/content-featured-image";
import { preparePageTitle } from "@/lib/wordpress-theme-title";
import { addFulginitiFaqAnchor } from "@/lib/schema-permalink";
import { finishBlogSourceLinks, protectThemeFaqAnchors } from "@/lib/blog-final-preparation";
import { LEGACY_TRUCKING_DOC, repairLegacyTruckingFaq } from "@/lib/legacy-trucking-faq";
import { mergeGoogleDocLinkRuns } from "@/lib/google-doc-links";
import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import OpenAI from "openai";
import { prepareLegacyFaq, PreparationPending } from "@/lib/preparation-faq-repair";
import sanitizeHtml from "sanitize-html";
import sharp from "sharp";
import { getClientProfileAsync } from "@/lib/client-store";
import { getGoogleAccessToken, getGoogleEmail } from "@/lib/google";
import { getWordPressConfigAsync, wordPressAuthorization } from "@/lib/wordpress";
import { formatLocation, stateAbbreviation } from "@/lib/location";
import { ctaContact, enhancementCtaContext, insertCtaBlocks, usesNewEnhancementImage } from "@/lib/cta";
import { aopCtaLocation } from "@/lib/aop-cta-location";
import { drazenHeroAuthorPanel } from "@/lib/drazen-hero";
import { normalizeEnhancementLocation } from "@/lib/enhancement-location";
import { directLink } from "@/lib/direct-link";
import { linkDraftToPublishedGeoPages } from "@/lib/geo-directory";
import { normalizeFulginitiGeoDirectoryAnchors, normalizeLegalLocationDirectoryLabels } from "@/lib/geo-directory-labels";
import { getContentImageReview, type ContentImageReview } from "@/lib/image-review-store";
import { getAronReviewItem, isAronReviewer } from "@/lib/aron-review-queue";
import { BILLY_GEO_CHILD_PARENTS } from "@/lib/billy-geo-child-campaign";
import { uploadLease, uploadRedis } from "@/lib/wordpress-upload-store";
import { sourceMarker as documentSourceMarker, sameApprovedDocument } from "@/lib/wordpress-upload-policy";
import {
  AMPLIFY_FAQ_STANDARD_VERSION,
  addAmplifyFaqAnchors,
  assertAmplifyFaqHtml,
  validateAmplifyFaqHtml,
  buildAmplifyFaqSchemaNode,
} from "@/lib/faq-standard";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type DraftInput = {
  intakeRecordId?: string;
  clientId?: string;
  docId?: string;
  website?: string;
  workflow?: "create" | "enhance" | "blog" | "aop" | "subaop";
  pageUrl?: string;
  aronApproved?: boolean;
  practiceArea?: string;
  city?: string;
  state?: string;
  primaryKeyword?: string;
  jurisdiction?: string;
  parentPracticeArea?: string;
  blogPracticeArea?: string;
  authorityAttorney?: string;
  parentId?: number;
  refreshImage?: boolean;
  approvedImageReviewId?: string;
};

type WordPressPage = {
  id: number;
  link?: string;
  slug?: string;
  status?: string;
  author?: number;
  featured_media?: number;
  template?: string;
  parent?: number;
  title?: { raw?: string; rendered?: string };
  content?: { raw?: string; rendered?: string };
};

type WordPressMedia = {
  id?: number;
  slug?: string;
  source_url?: string;
  alt_text?: string;
  media_details?: { width?: number; height?: number };
  requiresHumanReview?: boolean;
  message?: string;
};

async function wordPressMediaById(
  siteUrl: string,
  authorization: string,
  mediaId?: number,
) {
  if (!mediaId) return undefined;
  const response = await fetch(
    `${siteUrl}/wp-json/wp/v2/media/${mediaId}?context=edit&_fields=id,slug,source_url,alt_text,media_details`,
    { headers: { Authorization: authorization }, cache: "no-store" },
  );
  const media = await wordPressJson<WordPressMedia>(response, "opening the page's relevant image");
  if (!response.ok || !media.id || !media.source_url) return undefined;
  return media;
}

function cloudflareChallengeMessage(response: Response) {
  let host = "the connected website";
  try {
    host = new URL(response.url).hostname;
  } catch {
    // Keep the generic label when the response URL is unavailable.
  }
  return `Cloudflare is blocking AMPLIFY from ${host}’s WordPress REST API. Check Cloudflare Security Events for the matching request. If Bot Fight Mode caused it, disable that mode or upgrade to Super Bot Fight Mode; otherwise add a narrowly scoped skip rule for AMPLIFY’s /wp-json/ requests, then try again.`;
}

async function wordPressJson<T>(response: Response, action: string): Promise<T> {
  const text = await response.text();
  const challenged = response.headers.get("cf-mitigated") === "challenge"
    || /<title>\s*Just a moment\.\.\.\s*<\/title>/i.test(text);
  if (challenged) throw new Error(cloudflareChallengeMessage(response));
  if (!text.trim()) {
    throw new Error(`WordPress returned an empty response while ${action}.`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`WordPress returned an unexpected response while ${action}.`);
  }
}

function allowedPublisher(email: string | null) {
  if (!email) return false;
  const allowed = (process.env.WORDPRESS_ALLOWED_GOOGLE_EMAILS || "accounts@amplifylaw.ai")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase()) || isAronReviewer(email);
}

async function billyGeoParentId(
  siteUrl: string,
  authorization: string,
  city: string,
  practiceArea: string,
) {
  const normalizedCity = city.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const configuredLocation = BILLY_GEO_CHILD_PARENTS.find((item) =>
    item.location.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() === normalizedCity,
  );
  const endpoint = configuredLocation
    ? `${siteUrl}/wp-json/wp/v2/pages/${configuredLocation.pageId}?context=edit&_fields=id,parent,slug,status,title,link`
    : `${siteUrl}/wp-json/wp/v2/pages?slug=${encodeURIComponent(slugify(city))}&status=publish&context=edit&per_page=10&_fields=id,parent,slug,status,title,link`;
  const response = await fetch(endpoint, {
    headers: { Authorization: authorization },
    cache: "no-store",
  });
  const result = await wordPressJson<WordPressPage | WordPressPage[] & { message?: string }>(
    response,
    `resolving the ${city} WordPress parent page`,
  );
  if (!response.ok) {
    const message = !Array.isArray(result) && "message" in result
      ? String((result as WordPressPage & { message?: string }).message || "")
      : "";
    throw new Error(message || `WordPress could not resolve the ${city} parent page.`);
  }
  const locationPage = Array.isArray(result) ? result[0] : result;
  if (!locationPage?.id || locationPage.status !== "publish") {
    throw new Error(`A published ${city} Personal Injury parent page was not found. Nothing was created.`);
  }
  const broadPersonalInjury = practiceArea
    .toLowerCase()
    .replace(/\b(?:lawyers?|attorneys?)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim() === "personal injury";
  if (broadPersonalInjury) {
    // A verified county landing page is itself the root of its campaign.
    // It must not be required to have another county as a parent.
    if (!locationPage.parent && /\bcounty\b/.test(normalizedCity)
      && /\bcounty\b/i.test(plainText(locationPage.title?.raw || locationPage.title?.rendered || ""))) {
      return undefined;
    }
    if (!locationPage.parent) {
      throw new Error(`The published ${city} page is not assigned to a county parent. Nothing was created.`);
    }
    return locationPage.parent;
  }
  return locationPage.id;
}

async function approvedContentImageMedia(
  siteUrl: string,
  authorization: string,
  review: ContentImageReview,
) {
  const mediaSlug = slugify(`amplify-approved-image-${review.id}`);
  const lookup = await fetch(
    `${siteUrl}/wp-json/wp/v2/media?slug=${encodeURIComponent(mediaSlug)}&context=edit&per_page=1&_fields=id,slug,source_url,alt_text,media_details`,
    { headers: { Authorization: authorization }, cache: "no-store" },
  );
  const existing = await lookup.json().catch(() => []) as WordPressMedia[];
  if (lookup.ok && existing[0]?.id) return existing[0];

  const bytes = Buffer.from(review.imageBase64, "base64");
  if (bytes.byteLength < 10_000) throw new Error("The approved image is incomplete. Generate and approve another image.");
  const upload = await fetch(`${siteUrl}/wp-json/wp/v2/media`, {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": review.mimeType,
      "Content-Disposition": `attachment; filename="${review.fileName}"`,
    },
    body: bytes,
    cache: "no-store",
  });
  const uploaded = await upload.json().catch(() => ({})) as WordPressMedia;
  if (!upload.ok || !uploaded.id) {
    throw new Error(uploaded.message || "WordPress could not upload the approved featured image.");
  }
  const metadata = await fetch(`${siteUrl}/wp-json/wp/v2/media/${uploaded.id}`, {
    method: "POST",
    headers: { Authorization: authorization, "Content-Type": "application/json" },
    body: JSON.stringify({
      slug: mediaSlug,
      title: review.title,
      alt_text: review.altText,
      caption: "",
      description: review.altText,
    }),
    cache: "no-store",
  });
  if (!metadata.ok) throw new Error("WordPress uploaded the approved image but could not save its alt text.");
  const saved = await metadata.json().catch(() => ({})) as WordPressMedia;
  return { ...uploaded, ...saved, id: uploaded.id };
}

function plainText(value: string) {
  return sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);
}

function cleanGoogleDocHtml(exportedHtml: string) {
  const body = exportedHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] || exportedHtml;
  return mergeGoogleDocLinkRuns(sanitizeHtml(body, {
    allowedTags: [
      "h1", "h2", "h3", "h4", "h5", "h6", "p", "br", "strong", "b", "em", "i",
      "u", "s", "sup", "sub", "ul", "ol", "li", "blockquote", "a", "hr", "table",
      "thead", "tbody", "tfoot", "tr", "th", "td",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      ol: ["start"],
      th: ["colspan", "rowspan", "scope"],
      td: ["colspan", "rowspan"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    transformTags: {
      a: (_tagName, attribs) => {
        const href = directLink(attribs.href);
        return {
          tagName: "a",
          attribs: {
            ...attribs,
            ...(href ? { href } : {}),
            ...(href?.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {}),
          },
        };
      },
    },
  }).trim());
}

function extractPage(html: string) {
  let content = html;
  let seoTitle = "";
  let metaDescription = "";
  const blocks = [...content.matchAll(/<(p|h[1-6])\b[^>]*>[\s\S]*?<\/\1>/gi)];
  for (const block of blocks) {
    const text = plainText(block[0]);
    const seo = text.match(/^SEO Title\s*:\s*(.+)$/i);
    const meta = text.match(/^Meta Description\s*:\s*(.+)$/i);
    if (seo) {
      seoTitle = seo[1].trim();
      content = content.replace(block[0], "");
    }
    if (meta) {
      metaDescription = meta[1].trim();
      content = content.replace(block[0], "");
    }
  }
  const h1 = content.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  const pageTitle = h1 ? plainText(h1[1]) : seoTitle;
  if (h1) content = content.replace(h1[0], "");
  return { content: content.trim(), pageTitle, seoTitle, metaDescription };
}

function metaDescriptionFrom(content: string, fallback: string) {
  const paragraphs = [...content.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => plainText(match[1]))
    .filter((value) => value.length >= 60 && !/^sources?$/i.test(value));
  const source = paragraphs.slice(0, 2).join(" ") || fallback;
  if (source.length <= 158) return source;
  return `${source.slice(0, 155).replace(/\s+\S*$/, "")}…`;
}

function truncateAtWord(value: string, maximum: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maximum) return normalized;
  const shortened = normalized.slice(0, maximum + 1).replace(/\s+\S*$/, "").trim();
  return shortened || normalized.slice(0, maximum).trim();
}

function addClass(attribs: string, className: string) {
  const match = attribs.match(/\bclass=(['"])(.*?)\1/i);
  if (match) {
    const classes = new Set(`${match[2]} ${className}`.split(/\s+/).filter(Boolean));
    return attribs.replace(match[0], `class="${[...classes].join(" ")}"`);
  }
  return `${attribs} class="${className}"`;
}

function toWordPressBlocks(html: string) {
  let content = html.trim();
  const preserved: string[] = [];
  const preserve = (block: string) => `AMPLIFYGEOPRESERVED${preserved.push(block) - 1}END`;
  content = content.replace(/<!-- wp:image\b[\s\S]*?<!-- \/wp:image -->/gi, preserve);
  content = content.replace(/<ul\b([^>]*)>([\s\S]*?)<\/ul>/gi, (_m, attrs, inner) =>
    preserve(`<!-- wp:list -->\n<ul${addClass(attrs, "wp-block-list")}>${inner}</ul>\n<!-- /wp:list -->`));
  content = content.replace(/<ol\b([^>]*)>([\s\S]*?)<\/ol>/gi, (_m, attrs, inner) =>
    preserve(`<!-- wp:list {"ordered":true} -->\n<ol${addClass(attrs, "wp-block-list")}>${inner}</ol>\n<!-- /wp:list -->`));
  content = content.replace(/<blockquote\b([^>]*)>([\s\S]*?)<\/blockquote>/gi, (_m, attrs, inner) =>
    preserve(`<!-- wp:quote -->\n<blockquote${addClass(attrs, "wp-block-quote")}>${inner}</blockquote>\n<!-- /wp:quote -->`));
  content = content.replace(/<h1\b([^>]*)>([\s\S]*?)<\/h1>/gi, (_m, attrs, inner) =>
    `<!-- wp:heading {"level":1} -->\n<h1${addClass(attrs, "wp-block-heading page-content__title")}>${inner}</h1>\n<!-- /wp:heading -->`);
  content = content.replace(/<h([2-6])\b([^>]*)>([\s\S]*?)<\/h\1>/gi, (_m, level, attrs, inner) => {
    const blockAttrs = level === "2" ? "" : ` {"level":${level}}`;
    return `<!-- wp:heading${blockAttrs} -->\n<h${level}${addClass(attrs, "wp-block-heading")}>${inner}</h${level}>\n<!-- /wp:heading -->`;
  });
  content = content.replace(/<p\b([^>]*)>([\s\S]*?)<\/p>/gi, (_m, attrs, inner) =>
    `<!-- wp:paragraph -->\n<p${addClass(attrs, "wp-block-paragraph")}>${inner}</p>\n<!-- /wp:paragraph -->`);
  content = content.replace(/<hr\s*\/?>/gi, '<!-- wp:separator -->\n<hr class="wp-block-separator has-alpha-channel-opacity"/>\n<!-- /wp:separator -->');
  for (let index = preserved.length - 1; index >= 0; index -= 1) {
    content = content.replaceAll(`AMPLIFYGEOPRESERVED${index}END`, preserved[index]);
  }
  return content;
}

async function publishedPracticePage(
  siteUrl: string,
  authorization: string,
  practiceArea: string,
) {
  const base = slugify(practiceArea);
  const candidates = new Set<string>([
    base,
    base.endsWith("s") ? base : `${base}s`,
    base.replace(/-accident$/, "-accidents"),
  ].filter(Boolean));
  if (/\b(car|auto|automobile|motor vehicle)\b/i.test(practiceArea) && /accident/i.test(practiceArea)) {
    candidates.add("auto-accidents");
  }
  const params = new URLSearchParams({
    status: "publish",
    context: "edit",
    per_page: "20",
    _fields: "id,slug,status,author,featured_media,template",
  });
  for (const slug of candidates) params.append("slug[]", slug);
  const response = await fetch(`${siteUrl}/wp-json/wp/v2/pages?${params}`, {
    headers: { Authorization: authorization },
    cache: "no-store",
  });
  if (!response.ok) return undefined;
  const pages = await response.json() as WordPressPage[];
  return pages.find((page) => page.status === "publish" && Boolean(page.featured_media));
}

async function publishedAopParent(siteUrl: string, authorization: string) {
  const params = new URLSearchParams({
    status: "publish",
    context: "edit",
    per_page: "20",
    _fields: "id,slug,status,author,featured_media,template",
  });
  for (const slug of ["practice-areas", "areas-of-practice", "practice-area", "our-practice-areas"]) {
    params.append("slug[]", slug);
  }
  const response = await fetch(`${siteUrl}/wp-json/wp/v2/pages?${params}`, {
    headers: { Authorization: authorization },
    cache: "no-store",
  });
  if (!response.ok) return undefined;
  const pages = await response.json() as WordPressPage[];
  return pages.find((page) => page.status === "publish");
}

async function publishedSubAopParent(
  siteUrl: string,
  authorization: string,
  parentPracticeArea: string,
  configuredUrl?: string,
) {
  const suppliedParentUrl=/^https?:\/\//i.test(parentPracticeArea)?new URL(parentPracticeArea):undefined;
  if(suppliedParentUrl && suppliedParentUrl.hostname.replace(/^www\./, "").toLowerCase()!==new URL(siteUrl).hostname.replace(/^www\./, "").toLowerCase())throw new Error("The parent AOP URL belongs to a different WordPress site. Nothing was created.");
  const candidateSlugs = new Set<string>(suppliedParentUrl?[]:[slugify(parentPracticeArea)].filter(Boolean));
  if(suppliedParentUrl)configuredUrl=suppliedParentUrl.toString();
  if (configuredUrl) {
    try {
      const url = new URL(configuredUrl, siteUrl);
      const configuredHost = new URL(siteUrl).hostname.replace(/^www\./, "").toLowerCase();
      if (url.hostname.replace(/^www\./, "").toLowerCase() === configuredHost) {
        const configuredSlug = decodeURIComponent(url.pathname).split("/").filter(Boolean).at(-1);
        if (configuredSlug) candidateSlugs.add(slugify(configuredSlug));
      }
    } catch {
      // Fall back to the verified parent label.
    }
  }

  const slugParams = new URLSearchParams({
    status: "publish",
    context: "edit",
    per_page: "20",
    _fields: "id,link,slug,status,author,featured_media,template,title",
  });
  for (const slug of candidateSlugs) slugParams.append("slug[]", slug);
  const slugResponse = await fetch(`${siteUrl}/wp-json/wp/v2/pages?${slugParams}`, {
    headers: { Authorization: authorization },
    cache: "no-store",
  });
  if (slugResponse.ok) {
    const pages = await slugResponse.json() as WordPressPage[];
    const match = pages.find((page) => page.status === "publish" && (!suppliedParentUrl || (page.link && new URL(page.link).pathname.replace(/\/$/,"")===suppliedParentUrl.pathname.replace(/\/$/,""))));
    if (match) return match;
  }
  if(suppliedParentUrl)return undefined;

  const searchParams = new URLSearchParams({
    status: "publish",
    context: "edit",
    per_page: "50",
    search: parentPracticeArea,
    _fields: "id,link,slug,status,author,featured_media,template,title",
  });
  const searchResponse = await fetch(`${siteUrl}/wp-json/wp/v2/pages?${searchParams}`, {
    headers: { Authorization: authorization },
    cache: "no-store",
  });
  if (!searchResponse.ok) return undefined;
  const normalizedParent = parentPracticeArea.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const pages = await searchResponse.json() as WordPressPage[];
  return pages.find((page) => {
    const title = plainText(page.title?.raw || page.title?.rendered || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
    return page.status === "publish" && (candidateSlugs.has(page.slug || "") || title === normalizedParent);
  });
}

function billyLocationVisualBrief(location: string) {
  const normalized = plainText(location).toLowerCase();
  if (/\bmidtown(?: manhattan)?\b/.test(normalized)) {
    return "Dense Midtown Manhattan commercial street canyon: closely spaced high-rise office and hotel towers, a broad trafficked avenue, glass, steel, and stone facades, and very little low-rise residential frontage. Do not make a park, brownstone row, waterfront, or open residential boulevard the dominant scene.";
  }
  if (/\bharlem\b/.test(normalized)) {
    return "Harlem residential and mixed-use streetscape: historic brownstone rowhouses, masonry apartment buildings, neighborhood storefront rhythm, mature street trees, and an unmistakably urban Manhattan block. No gateway, arch, neighborhood-name sign, or invented monument.";
  }
  if (/\bbushwick\b/.test(normalized)) {
    return "Bushwick, Brooklyn streetscape: attached red- and tan-brick residential buildings, restrained former light-industrial facades, black metal fire escapes, modest stoops, mature street trees, flat terrain, and realistic mixed residential and warehouse texture. Avoid a brownstone-only Park Slope look, Manhattan towers, suburban lawns, murals with words, and any place-name signage.";
  }
  if (/\bclarkstown\b/.test(normalized)) {
    return "Clarkstown in Rockland County suburban streetscape: gentle rolling terrain, mature deciduous trees, landscaped verges, low-rise colonial and mid-century homes set back from the road, local stone retaining walls, and dense woodland in the distance. Avoid dense New York City blocks, dramatic mountains, rural farm scenery, mansions, and any town-name gateway or sign.";
  }
  if (/\bwashington heights\b/.test(normalized)) {
    return "Washington Heights uptown streetscape: a noticeably hilly street, five- to eight-story brick apartment buildings, limestone walkups, mature trees, and dense residential Manhattan character. Avoid Midtown-style office towers and generic downtown avenues.";
  }
  if (/\bupper west side\b/.test(normalized)) {
    return "Upper West Side residential streetscape: prewar apartment blocks, brownstone side streets, mature trees, and broad orderly avenues with dense Manhattan scale. Avoid a Midtown office-tower canyon or a generic downtown skyline.";
  }
  if (/\bupper east side\b/.test(normalized)) {
    return "Upper East Side residential streetscape: limestone and brownstone townhouses, prewar apartment buildings, mature street trees, and orderly Manhattan avenues. Avoid a Midtown office-tower canyon, waterfront, or generic skyline.";
  }
  if (/\b(?:manhattan|new york county)\b/.test(normalized)) {
    return "Representative Manhattan streetscape with dense masonry and glass buildings, active avenues, compact blocks, and unmistakably urban New York scale. Use everyday built form rather than a named landmark or skyline postcard.";
  }
  return `Representative everyday built form for ${plainText(location)}. Use locally characteristic street width, density, architecture, terrain, vegetation, and public realm rather than a generic New York skyline or a place-name sign.`;
}

async function billyFeaturedImage(
  siteUrl: string,
  authorization: string,
  location: string,
  practiceArea: string,
) {
  const safeLocation = plainText(location).slice(0, 90) || "New York";
  const safePracticeArea = plainText(practiceArea).slice(0, 100) || "Personal Injury";
  const mediaSlug = slugify(`${safeLocation} location featured v7`);
  const mediaLookup = await fetch(
    `${siteUrl}/wp-json/wp/v2/media?slug=${encodeURIComponent(mediaSlug)}&context=edit&per_page=10&_fields=id,slug,source_url,alt_text,media_details`,
    { headers: { Authorization: authorization }, cache: "no-store" },
  );
  const existingMedia = await mediaLookup.json().catch(() => []) as WordPressMedia[] | { message?: string };
  if (mediaLookup.ok && Array.isArray(existingMedia) && existingMedia[0]?.id) {
    return existingMedia[0];
  }

  const visualBrief = billyLocationVisualBrief(safeLocation);
  const imagePrompt = `Use case: photorealistic-natural. Asset type: wide website location banner for a Billy Cooper Law GEO page in ${safeLocation}. The associated page concerns ${safePracticeArea}, but the featured image must represent the location only and must never visualize an accident, injury, property hazard, lawyer, courthouse, or other legal concept. Scene and local character: ${visualBrief} Primary request: create a clean, realistic editorial street-level location photograph whose architecture, street width, density, terrain, vegetation, and public realm match that brief. Favor representative everyday neighborhood character over named landmarks. Composition: wide, crop-safe 3:2 hero with the local streetscape near the center, natural camera perspective, and no dominant foreground person. Keep vehicles entirely out of frame unless the scene would otherwise be implausible; if a vehicle appears, show only an unbranded side profile with every license plate fully hidden. Lighting and mood: natural warm daylight, calm and credible, real architectural texture, no over-polished concept-art look. Constraints: never invent or label a landmark; do not depict a gateway, ceremonial arch, place-name monument, fabricated public-art installation, or structure whose identity depends on generated words; do not substitute a different New York neighborhood or a generic skyline. Avoid: accident, damaged vehicle, injury, fall, hazard, attorney, courthouse, emergency response, readable or pseudo-visible text of any kind, letters, digits, serial marks, signs, license-plate characters, logos, company markings, vehicle decals, phone number, CTA, graphic overlay, border, watermark, copyright mark, asset ID, gavel, scales of justice, or obvious image-generation artifacts.`;
  const retryDirectives = [
    "Use a natural location-only street-level view without signage, legal-topic imagery, text-bearing surfaces, or visible license plates.",
    "Safety retry: choose an ordinary, locally plausible block with common architecture and keep every vehicle, person, sign, word, number, logo, monument, gateway, and arch out of frame.",
    "Final safety retry: use a different camera angle and a simple location-only streetscape; prioritize architectural plausibility, blank surfaces, and a clean frame with no vehicles, text, markings, or named or symbolic landmarks.",
  ];
  let imageBytes: ArrayBuffer | null = null;

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI image generation is not configured. The draft was not created with an unrelated fallback image.");
  }
  const openai = new OpenAI({ fetch: aiFetch, maxRetries: 0,  apiKey: process.env.OPENAI_API_KEY });
  for (const retryDirective of retryDirectives) {
    const generated = await openai.images.generate({
      model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1",
      prompt: `${imagePrompt} ${retryDirective}`,
      size: "1536x1024",
      quality: "high",
    });
    const generatedImage = generated.data?.[0] as { b64_json?: string; url?: string } | undefined;
    let candidateBytes: ArrayBuffer;
    if (generatedImage?.b64_json) {
      const bytes = Buffer.from(generatedImage.b64_json, "base64");
      candidateBytes = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    } else if (generatedImage?.url) {
      const imageResponse = await fetch(generatedImage.url, { cache: "no-store" });
      if (!imageResponse.ok) throw new Error("The Billy Cooper local AI banner could not be downloaded.");
      candidateBytes = await imageResponse.arrayBuffer();
    } else {
      throw new Error("OpenAI did not return a Billy Cooper local AI banner.");
    }
    if (candidateBytes.byteLength < 10_000) throw new Error("The Billy Cooper local AI banner was incomplete.");

    const safetyReview = await openai.responses.create({
      model: process.env.OPENAI_IMAGE_VALIDATION_MODEL || "gpt-4.1",
      max_output_tokens: 80,
      input: [{
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Review this proposed GEO-page banner for ${safeLocation}. The intended local visual brief is: ${visualBrief} The desired result is a location-only ordinary anonymous streetscape, so the exact block does not need to be visually provable and the absence of a landmark is not a reason to reject it. Reply with exactly PASS only if the image is photorealistic, substantially matches the local visual brief, depicts no accident, injury, fall, hazard, lawyer, courthouse, or emergency response, and contains no fabricated gateway, ceremonial arch, place-name monument, invented landmark, readable or pseudo-visible text, letters, digits, serial marks, signage, license-plate characters, branding, logos, company markings, vehicle decals, headline, CTA, watermark, copyright mark, asset ID, attorney, or obvious image-generation artifact. Reply with exactly REJECT if it depicts a materially different neighborhood type, any prohibited element, or an obvious image-generation artifact.`,
          },
          {
            type: "input_image",
            detail: "high",
            image_url: `data:image/png;base64,${Buffer.from(candidateBytes).toString("base64")}`,
          },
        ],
      }],
    });
    if (safetyReview.output_text.trim().toUpperCase() === "PASS") {
      imageBytes = candidateBytes;
      break;
    }
  }
  if (!imageBytes) {
    throw new Error(`OpenAI did not return a safety-approved ${safeLocation} banner after three attempts. The WordPress draft was not created with an unverified image.`);
  }

  const jpegBytes = await sharp(Buffer.from(imageBytes))
    .rotate()
    .jpeg({ quality: 90, chromaSubsampling: "4:4:4" })
    .toBuffer();
  const filename = `${mediaSlug}.jpg`;
  const upload = await fetch(`${siteUrl}/wp-json/wp/v2/media`, {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": "image/jpeg",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
    body: jpegBytes,
    cache: "no-store",
  });
  const uploaded = await upload.json().catch(() => ({})) as WordPressMedia;
  if (!upload.ok || !uploaded.id) {
    throw new Error(uploaded.message || "WordPress could not upload the Billy Cooper featured image.");
  }

  const altText = `${location} streetscape with locally characteristic architecture and neighborhood scenery`;
  const metadata = await fetch(`${siteUrl}/wp-json/wp/v2/media/${uploaded.id}`, {
    method: "POST",
    headers: { Authorization: authorization, "Content-Type": "application/json" },
    body: JSON.stringify({
      slug: mediaSlug,
      title: `${location} location featured image | Billy Cooper Law`,
      alt_text: altText,
      caption: "",
      description: altText,
    }),
    cache: "no-store",
  });
  if (!metadata.ok) throw new Error("WordPress uploaded the featured image but could not save its metadata.");
  const savedMedia = await metadata.json().catch(() => ({})) as WordPressMedia;
  return { ...uploaded, ...savedMedia, id: uploaded.id, requiresHumanReview: false };
}


function linkPhone(content: string, phoneHref: string) {
  const digits = phoneHref.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  if (digits.length !== 10) return content;
  const [area, exchange, line] = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6)];
  const anchors: string[] = [];
  let linked = content.replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, (anchor) =>
    `AMPLIFYGEOANCHOR${anchors.push(anchor) - 1}END`);
  const pattern = new RegExp(`(?:\\+?1[\\s.\\-–—]*)?\\(?${area}\\)?[\\s.\\-–—]*${exchange}[\\s.\\-–—]*${line}`, "g");
  linked = linked.replace(pattern, (phone) => `<a href="tel:${escapeHtml(phoneHref)}">${phone}</a>`);
  for (let index = anchors.length - 1; index >= 0; index -= 1) {
    linked = linked.replaceAll(`AMPLIFYGEOANCHOR${index}END`, anchors[index]);
  }
  return linked;
}

function internalKeywordPattern(label: string) {
  const words = plainText(label).split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  const variants: Record<string, string> = {
    accidents: "Accidents?",
    injuries: "(?:Injury|Injuries)",
    lawyers: "Lawyers?",
    claims: "Claims?",
    cases: "Cases?",
  };
  const pattern = words
    .map((word, index) => {
      if (index === words.length - 1 && variants[word.toLowerCase()]) {
        return variants[word.toLowerCase()];
      }
      return word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("\\s+");
  return new RegExp(`(^|[^A-Za-z0-9])(${pattern})(?=$|[^A-Za-z0-9])`, "i");
}

function linkVerifiedInternalKeywords(
  content: string,
  practiceAreaUrls: Record<string, string>,
  siteUrl: string,
) {
  let siteHost = "";
  try {
    siteHost = new URL(siteUrl).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return content;
  }
  const normalizeUrl = (value: string) => {
    try {
      const url = new URL(value);
      return `${url.origin}${url.pathname.replace(/\/$/, "")}`.toLowerCase();
    } catch {
      return value.toLowerCase().replace(/\/$/, "");
    }
  };
  const candidates = Object.entries(practiceAreaUrls)
    .map(([label, url]) => {
      try {
        const parsed = new URL(url);
        const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
        const pattern = internalKeywordPattern(label);
        return host === siteHost && pattern ? { label, url: parsed.toString(), pattern } : null;
      } catch {
        return null;
      }
    })
    .filter((candidate): candidate is { label: string; url: string; pattern: RegExp } => Boolean(candidate))
    .sort((left, right) => right.label.length - left.label.length);
  if (!candidates.length) return content;

  const linkedDestinations = new Set(
    [...content.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi)]
      .map((match) => normalizeUrl(directLink(match[1]) || match[1])),
  );
  let added = 0;
  return content.replace(/<(p|li)\b([^>]*)>([\s\S]*?)<\/\1>/gi, (block, tag, attributes, inner) => {
    if (added >= 6) return block;
    const anchors: string[] = [];
    const protectedInner = String(inner).replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, (anchor) =>
      `AMPLIFYINTERNALANCHOR${anchors.push(anchor) - 1}END`);
    const pieces = protectedInner.split(/(<[^>]+>)/g);
    for (let pieceIndex = 0; pieceIndex < pieces.length && added < 6; pieceIndex += 1) {
      if (pieces[pieceIndex].startsWith("<")) continue;
      for (const candidate of candidates) {
        const normalizedDestination = normalizeUrl(candidate.url);
        if (linkedDestinations.has(normalizedDestination)) continue;
        if (!candidate.pattern.test(pieces[pieceIndex])) continue;
        candidate.pattern.lastIndex = 0;
        pieces[pieceIndex] = pieces[pieceIndex].replace(
          candidate.pattern,
          (_match: string, prefix: string, keyword: string) =>
            `${prefix}<a href="${escapeHtml(candidate.url)}">${keyword}</a>`,
        );
        linkedDestinations.add(normalizedDestination);
        added += 1;
        break;
      }
    }
    let linkedInner = pieces.join("");
    for (let index = anchors.length - 1; index >= 0; index -= 1) {
      linkedInner = linkedInner.replaceAll(`AMPLIFYINTERNALANCHOR${index}END`, anchors[index]);
    }
    return `<${tag}${attributes}>${linkedInner}</${tag}>`;
  });
}

function canonicalPracticeArea(value: string) {
  return plainText(value)
    .toLowerCase()
    .replace(/\bmed\s+mal\b/g, "medical malpractice")
    .replace(/\bmotor\s+vehicle\b/g, "car")
    .replace(/\btruck(?:ing)?\b/g, "truck")
    .replace(/\battorneys?\b|\blawyers?\b|\blaw\s+firm\b|\blegal\b|\bservices?\b|\bpractice\s+areas?\b/g, " ")
    .replace(/\baccidents\b/g, "accident")
    .replace(/\binjuries\b/g, "injury")
    .replace(/\bclaims\b/g, "claim")
    .replace(/\bcases\b/g, "case")
    .replace(/\berrors\b/g, "error")
    .replace(/\bdevices\b/g, "device")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function blogAopFallbackLabels(practiceArea: string) {
  const canonical = canonicalPracticeArea(practiceArea);
  const labels = [practiceArea];
  if (
    canonical === "medical malpractice"
    || /\b(?:birth injury|diagnostic error|failure to diagnose|hospital negligence|medical negligence|medication error|misdiagnosis|physician negligence|surgical error)\b/.test(canonical)
  ) {
    labels.push("Medical Malpractice");
  }
  if (/\b(?:alimony|child custody|child support|divorce|family law|marital|matrimonial)\b/.test(canonical)) {
    labels.push("Family Law");
  }
  return labels.filter((label, index, values) =>
    values.findIndex((candidate) => canonicalPracticeArea(candidate) === canonicalPracticeArea(label)) === index,
  );
}

function relevantAopTarget(
  practiceArea: string,
  targets: Record<string, string>,
  siteUrl: string,
) {
  const desired = canonicalPracticeArea(practiceArea);
  if (!desired) return undefined;
  let siteHost = "";
  try {
    siteHost = new URL(siteUrl).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return undefined;
  }
  const desiredWords = desired.split(" ").filter(Boolean);
  return Object.entries(targets)
    .map(([label, url]) => {
      try {
        const parsed = new URL(url);
        if (parsed.hostname.replace(/^www\./, "").toLowerCase() !== siteHost) return null;
        const canonical = canonicalPracticeArea(label);
        const candidateWords = canonical.split(" ").filter(Boolean);
        const containsAllDesired = desiredWords.every((word) => candidateWords.includes(word));
        if (!canonical || (!containsAllDesired && canonical !== desired)) return null;
        const extraWords = Math.max(0, candidateWords.length - desiredWords.length);
        const score = canonical === desired ? 100 : 70 - extraWords;
        return { label, url: parsed.toString(), score, extraWords };
      } catch {
        return null;
      }
    })
    .filter((candidate): candidate is { label: string; url: string; score: number; extraWords: number } => Boolean(candidate))
    .sort((left, right) => right.score - left.score || left.extraWords - right.extraWords || left.label.length - right.label.length)[0];
}

function ensureAopLink(
  content: string,
  practiceArea: string,
  target: { label: string; url: string },
) {
  const normalizeUrl = (value: string) => {
    try {
      const url = new URL(value);
      return `${url.origin}${url.pathname.replace(/\/$/, "")}`.toLowerCase();
    } catch {
      return value.toLowerCase().replace(/\/$/, "");
    }
  };
  const destination = normalizeUrl(target.url);
  const alreadyLinked = [...content.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi)]
    .some((match) => normalizeUrl(directLink(match[1]) || match[1]) === destination);
  if (alreadyLinked) return content;
  const related = `<p class="amplify-related-practice"><strong>Related practice area:</strong> <a href="${escapeHtml(target.url)}">${escapeHtml(practiceArea)}</a></p>`;
  const firstSection = content.search(/<h2\b/i);
  return firstSection >= 0
    ? `${content.slice(0, firstSection)}${related}\n${content.slice(firstSection)}`
    : `${content}\n${related}`;
}

async function publishedInternalPageUrls(
  siteUrl: string,
  authorization: string,
  excludedSlug?: string,
) {
  const targets: Record<string, string> = {};
  const ignoredTitles = /^(home|blog|news|contact|contact us|about|about us|resources|attorneys|lawyers|our team|faq|privacy policy|terms|sitemap|search)$/i;
  for (let page = 1; page <= 5; page += 1) {
    const params = new URLSearchParams({
      status: "publish",
      per_page: "100",
      page: String(page),
      orderby: "id",
      order: "asc",
      _fields: "id,link,title",
    });
    const response = await fetch(`${siteUrl}/wp-json/wp/v2/pages?${params}`, {
      headers: { Authorization: authorization },
      cache: "no-store",
    });
    if (!response.ok) break;
    const pages = await response.json() as WordPressPage[];
    for (const publishedPage of pages) {
      const label = plainText(publishedPage.title?.rendered || publishedPage.title?.raw || "")
        .replace(/\s+/g, " ")
        .trim();
      const wordCount = label.split(/\s+/).filter(Boolean).length;
      let pageSlug = "";
      try {
        pageSlug = decodeURIComponent(new URL(publishedPage.link || "").pathname).split("/").filter(Boolean).at(-1) || "";
      } catch {
        // Ignore malformed links below.
      }
      if (excludedSlug && slugify(pageSlug) === excludedSlug) continue;
      if (!publishedPage.link || ignoredTitles.test(label) || wordCount < 1 || wordCount > 10) continue;
      targets[label] = publishedPage.link;
    }
    const totalPages = Number(response.headers.get("x-wp-totalpages") || "1");
    if (page >= totalPages || pages.length < 100) break;
  }
  return targets;
}

async function searchPublishedAopTarget(
  siteUrl: string,
  authorization: string,
  practiceArea: string,
  excludedSlug?: string,
) {
  for (const label of blogAopFallbackLabels(practiceArea)) {
    const params = new URLSearchParams({
      status: "publish",
      search: label,
      per_page: "50",
      orderby: "relevance",
      _fields: "id,link,slug,title",
    });
    const response = await fetch(`${siteUrl}/wp-json/wp/v2/pages?${params}`, {
      headers: { Authorization: authorization },
      cache: "no-store",
    });
    if (!response.ok) continue;
    const pages = await response.json() as WordPressPage[];
    const targets: Record<string, string> = {};
    for (const page of pages) {
      if (!page.link) continue;
      const pageSlug = page.slug || "";
      if (excludedSlug && slugify(pageSlug) === excludedSlug) continue;
      const title = plainText(page.title?.rendered || page.title?.raw || "").replace(/\s+/g, " ").trim();
      if (title) targets[title] = page.link;
      targets[pageSlug.replace(/[-_]+/g, " ")] = page.link;
    }
    const match = relevantAopTarget(label, targets, siteUrl);
    if (match) return match;
  }
  return undefined;
}

function faqSchemaNode(content: string, pageUrl: string) {
  return buildAmplifyFaqSchemaNode(content, pageUrl);
}

function geoSchema(content: string, pageUrl: string, siteUrl: string, location: string, practiceArea: string, phone: string, clientName: string) {
  const legalService: Record<string, unknown> = {
    "@type": "LegalService",
    "@id": `${pageUrl}#legal-service`,
    name: `${location} ${practiceArea}`.trim(),
    url: pageUrl,
    serviceType: practiceArea,
    provider: { "@type": "LegalService", name: clientName, url: siteUrl },
  };
  if (phone) legalService.telephone = phone;
  if (location) legalService.areaServed = { "@type": "City", name: location };
  const graph: Array<Record<string, unknown>> = [legalService];
  const faq = faqSchemaNode(content, pageUrl);
  if (faq) graph.push(faq);
  return { "@context": "https://schema.org", "@graph": graph };
}

function aopSchema(
  content: string,
  pageUrl: string,
  siteUrl: string,
  title: string,
  description: string,
  jurisdiction: string,
  practiceArea: string,
  phone: string,
  clientName: string,
  featuredImage?: WordPressMedia,
  parentPage?: { name: string; url: string },
) {
  const legalService: Record<string, unknown> = {
    "@type": "LegalService",
    "@id": `${pageUrl}#legal-service`,
    name: `${clientName} — ${practiceArea}`,
    url: pageUrl,
    description,
    serviceType: practiceArea,
    provider: { "@type": "LegalService", name: clientName, url: siteUrl },
  };
  if (phone) legalService.telephone = phone;
  if (jurisdiction) legalService.areaServed = { "@type": "AdministrativeArea", name: jurisdiction };
  if (parentPage?.url) {
    legalService.isRelatedTo = {
      "@type": "Service",
      name: parentPage.name,
      url: parentPage.url,
    };
  }
  if (featuredImage?.source_url) {
    legalService.image = {
      "@type": "ImageObject",
      url: featuredImage.source_url,
      caption: featuredImage.alt_text || title,
    };
  }
  const graph: Array<Record<string, unknown>> = [legalService];
  const faq = faqSchemaNode(content, pageUrl);
  if (faq) graph.push(faq);
  return { "@context": "https://schema.org", "@graph": graph };
}

function blogSchema(
  content: string,
  pageUrl: string,
  siteUrl: string,
  title: string,
  description: string,
  practiceArea: string,
  clientName: string,
  featuredImage?: WordPressMedia,
) {
  const article: Record<string, unknown> = {
    "@type": "BlogPosting",
    "@id": `${pageUrl}#article`,
    headline: title,
    description,
    url: pageUrl,
    mainEntityOfPage: { "@type": "WebPage", "@id": pageUrl },
    author: { "@type": "Organization", name: clientName, url: siteUrl },
    publisher: { "@type": "LegalService", name: clientName, url: siteUrl },
    about: practiceArea,
    articleSection: practiceArea,
    isPartOf: { "@type": "WebSite", "@id": `${siteUrl}#website`, url: siteUrl, name: clientName },
    inLanguage: "en-US",
  };
  if (featuredImage?.source_url) {
    article.image = {
      "@type": "ImageObject",
      url: featuredImage.source_url,
      caption: featuredImage.alt_text || title,
    };
  }
  const graph: Array<Record<string, unknown>> = [article];
  const faq = faqSchemaNode(content, pageUrl);
  if (faq) graph.push(faq);
  return { "@context": "https://schema.org", "@graph": graph };
}

function inlineSchemaBlock(value: Record<string, unknown>) {
  const json = JSON.stringify(value).replace(/<\//g, "<\\/");
  return `<!-- wp:html -->\n<script type="application/ld+json" class="amplify-blog-schema">${json}</script>\n<!-- /wp:html -->`;
}

type BridgeStatus = {
  ready: boolean;
  version?: string;
  supportedPostTypes?: string[];
};

const REQUIRED_BILLY_BRIDGE_VERSION = "1.9.6";

function versionAtLeast(current: string | undefined, required: string) {
  if (!current) return false;
  const currentParts = current.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const requiredParts = required.split(".").map((part) => Number.parseInt(part, 10) || 0);
  for (let index = 0; index < Math.max(currentParts.length, requiredParts.length); index += 1) {
    const difference = (currentParts[index] || 0) - (requiredParts[index] || 0);
    if (difference) return difference > 0;
  }
  return true;
}

async function bridgeStatus(siteUrl: string, authorization: string): Promise<BridgeStatus> {
  const response = await fetch(`${siteUrl}/wp-json/amplify-geo/v1/status`, {
    headers: { Authorization: authorization },
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({})) as BridgeStatus;
  return {
    ready: response.ok && data.ready === true,
    version: data.version,
    supportedPostTypes: Array.isArray(data.supportedPostTypes) ? data.supportedPostTypes : undefined,
  };
}

async function exportApprovedDoc(accessToken: string, docId: string, manualApprovalConfirmed = false) {
  const metadataResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(docId)}?fields=id,mimeType,trashed,appProperties&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" },
  );
  const metadata = await metadataResponse.json() as {
    mimeType?: string;
    trashed?: boolean;
    appProperties?: Record<string, string>;
    error?: { message?: string };
  };
  if (!metadataResponse.ok) {
    if ([403,404].includes(metadataResponse.status)) throw new Error("Google Doc access is required. The connected Google account or AMPLIFY’s per-file permission cannot open this approved Doc. Reconnect for existing Docs or connect the owner account, then retry.");
    throw new Error(metadata.error?.message || "The approved Google Doc could not be opened.");
  }
  if (metadata.trashed || metadata.mimeType !== "application/vnd.google-apps.document" || !metadata.appProperties?.amplifyResponseId) {
    throw new Error("Only a Google Doc created by this app can be sent to WordPress.");
  }
  const approvalsResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(docId)}/approvals?pageSize=100`,
    { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" },
  );
  if (!approvalsResponse.ok && !manualApprovalConfirmed) {
    throw new Error("Google approval could not be verified. Aron must approve the Doc first.");
  }
  if (approvalsResponse.ok) {
    const approvals = await approvalsResponse.json() as { items?: Array<{ status?: string; createTime?: string }> };
    const latest = [...(approvals.items || [])].sort((a, b) => (b.createTime || "").localeCompare(a.createTime || ""))[0];
    if (latest?.status !== "APPROVED" && !manualApprovalConfirmed) {
      throw new Error("Aron has not approved this Google Doc yet.");
    }
  }

  const exportResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(docId)}/export?mimeType=${encodeURIComponent("text/html")}`,
    { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" },
  );
  if (!exportResponse.ok) throw new Error("The approved Google Doc could not be prepared for WordPress.");
  const content = cleanGoogleDocHtml(await exportResponse.text());
  if (plainText(content).length < 500) throw new Error("The approved Google Doc does not contain enough usable content.");
  return {
    content,
    faqStandard: metadata.appProperties?.amplifyFaqStandard || null,
  };
}

function keepCityDirectoryUnlinked(content: string) {
  const sectionPattern = /(<h2\b[^>]*>[\s\S]*?(?:(?:cities|towns|areas|communities)\s+(?:we\s+)?serve|(?:lawyers?|attorneys?)\s+serving)[\s\S]*?<\/h2>)([\s\S]*?)(?=<h2\b|$)/i;
  const section = content.match(sectionPattern);
  if (!section) return content;
  const list = section[2].match(/<ul\b[^>]*>[\s\S]*?<\/ul>/i);
  if (!list) return content;

  const items = [...list[0].matchAll(/<li\b([^>]*)>([\s\S]*?)<\/li>/gi)];
  const rebuilt = items.map((item) => {
    const label = plainText(item[2]);
    if (!label) return item[0];
    return `<li${item[1]}>${escapeHtml(label)}</li>`;
  });
  let safeList = list[0];
  for (let index = items.length - 1; index >= 0; index -= 1) {
    safeList = `${safeList.slice(0, items[index].index)}${rebuilt[index]}${safeList.slice((items[index].index || 0) + items[index][0].length)}`;
  }
  const safeSectionBody = section[2].replace(list[0], safeList);
  const spacedHeading = section[1].replace(/^<h2\b([^>]*)>/i, (opening, attributes: string) => {
    if (/\bstyle\s*=\s*(["'])/i.test(opening)) {
      return opening.replace(/\bstyle\s*=\s*(["'])(.*?)\1/i, (_style, quote: string, value: string) =>
        `style=${quote}${value.replace(/;?\s*$/, ";")}margin-top:40px${quote}`,
      );
    }
    return `<h2${attributes} style="margin-top:40px">`;
  });
  return content.replace(section[0], `${spacedHeading}${safeSectionBody}`);
}

async function handlePOST(request: NextRequest) {
  let release: (()=>Promise<void>) | null = null;
  try {
    const input = await request.json() as DraftInput;
    const accessToken = await getGoogleAccessToken();
    const googleEmail = await getGoogleEmail(accessToken);
    if (!allowedPublisher(googleEmail)) return NextResponse.json({ error: "This Google account is not allowed to create WordPress drafts." }, { status: 403 });
    const client = await getClientProfileAsync(input.clientId, input.website, accessToken);
    if (!client) {
      let websiteLabel = "this website";
      try {
        websiteLabel = new URL(input.website || "").hostname.replace(/^www\./, "") || websiteLabel;
      } catch {
        // Keep the generic label for an invalid or missing website.
      }
      return NextResponse.json({
        error: `No WordPress client is configured for ${websiteLabel}. Add that client’s WordPress connection first.`,
      }, { status: 400 });
    }
    if (!client.wordpress) return NextResponse.json({ error: "This client is not fully connected to WordPress." }, { status: 400 });
    const docId = input.docId?.trim() || "";
    const isEnhancement = input.workflow === "enhance";
    const isBlog = input.workflow === "blog";
    const isAop = input.workflow === "aop";
    const isSubAop = input.workflow === "subaop";
    const practiceArea = input.practiceArea?.trim() || "";
    const blogPracticeArea = isBlog && docId === LEGACY_TRUCKING_DOC ? "Truck Accidents" : input.blogPracticeArea?.trim() || "";
    let parentPracticeArea = input.parentPracticeArea?.trim() || "";
    const city = input.city?.trim() || "";
    const state = stateAbbreviation(input.state || "");
    let parentId = Number.isInteger(input.parentId) && Number(input.parentId) > 0
      ? Number(input.parentId)
      : undefined;
    if (!/^[A-Za-z0-9_-]{10,200}$/.test(docId)) {
      return NextResponse.json({ error: "The approved Google Doc is missing." }, { status: 400 });
    }
    if (!isEnhancement && !isBlog && !isAop && !isSubAop && (!practiceArea || !city || !state)) {
      return NextResponse.json({ error: "The practice area, city, or state is missing." }, { status: 400 });
    }
    if (isBlog && !practiceArea) {
      return NextResponse.json({ error: "The blog topic is missing." }, { status: 400 });
    }
    if (isAop && !practiceArea) {
      return NextResponse.json({ error: "The Area of Practice name is missing." }, { status: 400 });
    }
    if (isSubAop && (!parentPracticeArea || !practiceArea)) {
      return NextResponse.json({ error: "The parent Area of Practice or Sub-AOP name is missing." }, { status: 400 });
    }
    if (isSubAop && parentPracticeArea.toLowerCase() === practiceArea.toLowerCase()) {
      return NextResponse.json({ error: "The Sub-AOP must be narrower than—and named differently from—the parent AOP." }, { status: 400 });
    }

    const config = await getWordPressConfigAsync(client.id, undefined, accessToken);
    const authorization = wordPressAuthorization(config);
    release = await uploadLease(`site:${new URL(config.siteUrl).hostname.toLowerCase()}`);
    if(!release)return NextResponse.json({error:"A WordPress upload is already running for this site. It will be retried shortly."},{status:429});
    // Reconcile by source Doc before requesting Google access. This also finds
    // a previous successful upload whose slug was subsequently edited in WP.
    const sourceLookup=await fetch(`${config.siteUrl}/wp-json/wp/v2/${isBlog?"posts":"pages"}?context=edit&status=publish,draft,pending,private,future&search=${encodeURIComponent(docId)}&per_page=100&_fields=id,link,slug,status,content`,{headers:{Authorization:authorization},cache:"no-store"});
    const sourceCandidates=await wordPressJson<WordPressPage[] & {message?:string}>(sourceLookup,"reconciling the approved Google Doc");
    if(!sourceLookup.ok)throw new Error(sourceCandidates.message||"WordPress could not check for a previous upload.");
    const matchingSources=sourceCandidates.filter(p=>(p.content?.raw||p.content?.rendered||"").includes(documentSourceMarker(docId,input.workflow)));
    if(matchingSources.length>1)return NextResponse.json({error:"Multiple WordPress pages reference this approved Doc. Review the duplicates before retrying."},{status:409});
    const priorSource=matchingSources[0];
    if(priorSource && priorSource.status!=="draft") {
      if(priorSource.status!=="publish")return NextResponse.json({error:"This Doc already has a non-draft WordPress page. Nothing was changed."},{status:409});
      return NextResponse.json({ok:true,pageId:priorSource.id,pageUrl:priorSource.link,editUrl:`${config.siteUrl}/wp-admin/post.php?post=${priorSource.id}&action=edit`,status:"publish",reconciled:true});
    }
    const isBillyGeo = !isEnhancement && !isBlog && !isAop && !isSubAop && client.id === "billy-cooper-law";
    if (isBillyGeo && !parentId) {
      parentId = await billyGeoParentId(config.siteUrl, authorization, city, practiceArea);
    }
    // Approval intake saves the reviewed copy first. Formatting, imagery and
    // publication checks run when the saved draft is prepared for publication.
    if (input.intakeRecordId) {
      const approved = await getAronReviewItem(input.intakeRecordId);
      if (!approved || !sameApprovedDocument(approved, docId)
        || approved.website !== input.website || approved.clientId !== input.clientId
        || approved.workflow !== input.workflow) {
        return NextResponse.json({ error: "The saved approval does not match this upload." }, { status: 409 });
      }
      if (priorSource) {
        return NextResponse.json({ ok: true, pageId: priorSource.id, pageUrl: priorSource.link,
          editUrl: `${config.siteUrl}/wp-admin/post.php?post=${priorSource.id}&action=edit`,
          status: priorSource.status, preparationRequired: true, reconciled: true });
      }
      const approvedDoc = await exportApprovedDoc(accessToken, docId, true);
      const extracted = extractPage(approvedDoc.content);
      if (!extracted.pageTitle || plainText(extracted.content).length < 500) {
        throw new Error("The approved Doc is missing its page title or main content.");
      }
      let original: WordPressPage | undefined;
      if (isEnhancement) {
        const sourceUrl = new URL(approved.pageUrl || approved.website);
        if (sourceUrl.hostname.replace(/^www\./, "") !== new URL(config.siteUrl).hostname.replace(/^www\./, "")) {
          throw new Error("The enhancement source belongs to another WordPress site.");
        }
        const sourceSlug = decodeURIComponent(sourceUrl.pathname).split("/").filter(Boolean).at(-1);
        const response = await fetch(`${config.siteUrl}/wp-json/wp/v2/pages?context=edit&slug=${encodeURIComponent(sourceSlug || "")}&status=publish&per_page=100`, { headers: { Authorization: authorization }, cache: "no-store" });
        const pages = await wordPressJson<WordPressPage[]>(response, "opening the original enhancement page");
        if (!response.ok || !Array.isArray(pages)) throw new Error("The original enhancement page could not be opened.");
        original = pages.find(page => page.link && new URL(page.link).pathname.replace(/\/$/, "") === sourceUrl.pathname.replace(/\/$/, ""));
        if (!original?.id) throw new Error("The original enhancement page could not be resolved.");
        if (!usesNewEnhancementImage(client) && !original.featured_media) throw new Error("The original page needs a featured image before its enhancement draft can be saved.");
      }
      const faq = validateAmplifyFaqHtml(extracted.content, config.siteUrl);
      const warnings = ["Approved content saved. Prepare the draft’s layout, images, internal links and schema before publication.",
        ...(!faq.passed ? [`FAQ corrections required before publication: ${faq.errors.join(" ")}`] : [])];
      const endpoint = isBlog ? "posts" : "pages";
      const normalizedIntake = normalizeLegalLocationDirectoryLabels(extracted.content).content;
      const intakeContent = client.id === "billy-cooper-law" && !isEnhancement && !isBlog
        ? await linkDraftToPublishedGeoPages(config.siteUrl, authorization, normalizedIntake,
            slugify(extracted.pageTitle), extracted.pageTitle)
        : normalizedIntake;
      const content = `<!-- ${documentSourceMarker(docId, input.workflow)} -->\n<!-- amplify-approval-intake:v1 -->${original ? `\n<!-- amplify-geo-update-of:${original.id} -->` : ""}\n${toWordPressBlocks(intakeContent)}`;
      const payload = {
        title: extracted.pageTitle, content, status: "draft", excerpt: extracted.metaDescription,
        slug: slugify(`${original?.slug || extracted.pageTitle} amplify draft ${docId.slice(0, 12)}`),
        ...(parentId || original?.parent ? { parent: parentId || original?.parent } : {}),
        ...(original?.featured_media ? { featured_media: original.featured_media } : {}),
        ...(original?.template ? { template: original.template } : {}),
      };
      const response = await fetch(`${config.siteUrl}/wp-json/wp/v2/${endpoint}`, {
        method: "POST", headers: { Authorization: authorization, "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const saved = await wordPressJson<WordPressPage & { message?: string }>(response, "saving Aron’s approved draft");
      if (!response.ok || !saved.id || saved.status !== "draft") throw new Error(saved.message || "WordPress did not confirm a draft.");
      const verify = await fetch(`${config.siteUrl}/wp-json/wp/v2/${endpoint}/${saved.id}?context=edit`, { headers: { Authorization: authorization }, cache: "no-store" });
      const verified = await wordPressJson<WordPressPage>(verify, "verifying Aron’s approved draft");
      if (!verify.ok || verified.status !== "draft" || !(verified.content?.raw || "").includes(documentSourceMarker(docId, input.workflow))
        || plainText(verified.content?.raw || "") !== plainText(content)
        || (payload.parent && verified.parent !== payload.parent)
        || (original?.featured_media && verified.featured_media !== original.featured_media)) {
        throw new Error("WordPress saved a draft, but its content or required page attributes could not be verified. Retry to reconcile this Doc without creating a duplicate.");
      }
      return NextResponse.json({ ok: true, pageId: saved.id, pageUrl: saved.link,
        editUrl: `${config.siteUrl}/wp-admin/post.php?post=${saved.id}&action=edit`, status: "draft",
        featuredMediaId: original?.featured_media, preparationRequired: true, warnings });
    }
    const requiredBridge = isBillyGeo || isBlog ? await bridgeStatus(config.siteUrl, authorization) : undefined;
    if (isBlog && (!requiredBridge?.ready || !requiredBridge.supportedPostTypes?.includes("post"))) {
      return NextResponse.json({error:`${client.name} needs the AMPLIFY Content Bridge activated with blog support before preparation. The approved copy is saved; nothing was published.`},{status:422});
    }
    if (isBillyGeo && requiredBridge && (
      !requiredBridge.ready
      || !versionAtLeast(requiredBridge.version, REQUIRED_BILLY_BRIDGE_VERSION)
    )) {
      throw new Error(`Billy Cooper GEO drafts require AMPLIFY Content Bridge ${REQUIRED_BILLY_BRIDGE_VERSION} or newer so the featured image and ACF hero can be verified. WordPress is currently running ${requiredBridge.version || "an unknown version"}.`);
    }
    const approvedImageReviewId = input.approvedImageReviewId?.trim() || "";
    const approvedImageReview = approvedImageReviewId
      ? await getContentImageReview(approvedImageReviewId)
      : null;
    if (approvedImageReview && (
      approvedImageReview.clientId !== client.id
      || approvedImageReview.docId !== docId
    )) {
      return NextResponse.json({
        error: "The approved image does not belong to this client and Google Doc. Generate another image from this content item.",
      }, { status: 409 });
    }
    const configuredParentUrl = isSubAop
      ? Object.entries(client.practiceAreaUrls).find(([label]) =>
          label.toLowerCase() === parentPracticeArea.toLowerCase(),
        )?.[1]
      : undefined;
    const subAopParent = isSubAop
      ? await publishedSubAopParent(
          config.siteUrl,
          authorization,
          parentPracticeArea,
          configuredParentUrl,
        )
      : undefined;
    if (isSubAop && !subAopParent?.id) {
      return NextResponse.json({
        error: `The published parent AOP page “${parentPracticeArea}” was not found in WordPress. Nothing was created.`,
      }, { status: 409 });
    }
    if(isSubAop && /^https?:\/\//i.test(parentPracticeArea) && subAopParent?.title)parentPracticeArea=plainText(subAopParent.title.raw||subAopParent.title.rendered||parentPracticeArea);
    const approvedDoc = await exportApprovedDoc(accessToken, docId, input.aronApproved === true);
    const exported = approvedDoc.content;
    let extracted = extractPage(exported);
    if (isBlog) extracted = { ...extracted, content: repairLegacyTruckingFaq(extracted.content, docId) };
    if (!extracted.pageTitle || plainText(extracted.content).length < 500) throw new Error("The approved Doc is missing its page title or main content.");
    if (isEnhancement) extracted = { ...extracted, content: await prepareLegacyFaq(extracted.content, extracted.pageTitle, input.pageUrl || input.website || config.siteUrl, docId) };
    assertAmplifyFaqHtml(extracted.content, config.siteUrl);

    const location = isEnhancement || isBlog || isAop || isSubAop ? "" : formatLocation(city, state);
    const effectivePracticeArea = practiceArea || extracted.pageTitle;
    let sourcePage: WordPressPage | undefined;
    let slug = isBlog
      ? slugify(extracted.pageTitle)
      : isAop
        ? slugify(extracted.pageTitle)
        : isSubAop
          ? slugify(extracted.pageTitle)
        : slugify(`${location} ${effectivePracticeArea}`);

    if (isEnhancement) {
      let sourceUrl: URL;
      try {
        sourceUrl = new URL(input.pageUrl || input.website || "");
      } catch {
        throw new Error("The existing WordPress page URL is missing or invalid.");
      }
      const sourceHost = sourceUrl.hostname.replace(/^www\./, "").toLowerCase();
      const configuredHost = new URL(config.siteUrl).hostname.replace(/^www\./, "").toLowerCase();
      if (sourceHost !== configuredHost) {
        throw new Error(`The existing page belongs to ${sourceHost}, but WordPress is connected to ${configuredHost}.`);
      }
      const sourceSlug = decodeURIComponent(sourceUrl.pathname).split("/").filter(Boolean).at(-1) || "";
      if (!sourceSlug) throw new Error("The existing WordPress page URL does not contain a page slug.");
      const sourceLookup = await fetch(`${config.siteUrl}/wp-json/wp/v2/pages?slug=${encodeURIComponent(sourceSlug)}&status=publish,draft,pending,private,future&context=edit&per_page=10&_fields=id,link,slug,status,author,content,featured_media,template,title`, {
        headers: { Authorization: authorization }, cache: "no-store",
      });
      const sourcePages = await wordPressJson<WordPressPage[] & { message?: string }>(
        sourceLookup,
        "opening the existing page",
      );
      if (!sourceLookup.ok) throw new Error(sourcePages.message || "WordPress could not open the existing page.");
      sourcePage = sourcePages.find((page) => page.status === "publish") || sourcePages[0];
      if (!sourcePage) throw new Error("The existing page was not found in the connected WordPress site.");
      const normalizedLocation = normalizeEnhancementLocation({
        pageTitle: extracted.pageTitle,
        seoTitle: extracted.seoTitle,
        content: extracted.content,
        sourceContent: `${sourcePage.title?.raw || sourcePage.title?.rendered || ""}\n${sourcePage.content?.raw || sourcePage.content?.rendered || ""}`,
        pageUrl: input.pageUrl || input.website || sourcePage.link || config.siteUrl,
        client,
      });
      extracted = {
        ...extracted,
        pageTitle: normalizedLocation.pageTitle,
        seoTitle: normalizedLocation.seoTitle,
        content: normalizedLocation.content,
      };
      slug = slugify(`${sourceSlug} amplify draft ${docId.slice(0, 8)}`);
    }

    const contentEndpoint = isBlog ? "posts" : "pages";
    const lookup = await fetch(`${config.siteUrl}/wp-json/wp/v2/${contentEndpoint}?slug=${encodeURIComponent(slug)}&status=publish,draft,pending,private,future&context=edit&per_page=10&_fields=id,link,slug,status,content`, {
      headers: { Authorization: authorization }, cache: "no-store",
    });
    const existing = await wordPressJson<WordPressPage[] & { message?: string }>(
      lookup,
      "checking for an existing draft",
    );
    if (!lookup.ok) throw new Error(existing.message || "WordPress could not check for an existing page.");
    if(existing.length>1)return NextResponse.json({error:`Several WordPress pages use the slug “${slug}”. Review the duplicates before uploading.`},{status:409});
    if(priorSource && existing[0] && existing[0].id!==priorSource.id)return NextResponse.json({error:"The source Doc and target slug match different WordPress pages. Nothing was changed."},{status:409});
    const existingPage = priorSource || existing[0];
    if (priorSource?.slug && !(isBlog && priorSource.status === "draft" && priorSource.slug.includes("-amplify-draft-"))) slug = priorSource.slug;
    const expectedSourceMarker = `amplify-${isBlog ? "blog" : isAop ? "aop" : isSubAop ? "subaop" : "geo"}-source:${docId}`;
    if (existingPage && !(existingPage.content?.raw || "").includes(expectedSourceMarker)) {
      return NextResponse.json({ error: `A WordPress page already uses the slug “${slug}”. Nothing was overwritten.` }, { status: 409 });
    }
    if(existingPage && existingPage.status!=="draft") {
      if(existingPage.status!=="publish")return NextResponse.json({error:"An existing non-draft page matches this Doc. Nothing was changed."},{status:409});
      return NextResponse.json({ok:true,pageId:existingPage.id,pageUrl:existingPage.link,editUrl:`${config.siteUrl}/wp-admin/post.php?post=${existingPage.id}&action=edit`,status:"publish",reconciled:true});
    }

    const directoryBaseContent = isEnhancement || isBlog || isAop || isSubAop
      ? extracted.content
      : keepCityDirectoryUnlinked(extracted.content);
    const serviceAreaSafeContent = !isEnhancement && !isBlog && !isAop && !isSubAop && client.id === "billy-cooper-law"
      ? await linkDraftToPublishedGeoPages(
          config.siteUrl,
          authorization,
          directoryBaseContent,
          slug,
          extracted.pageTitle,
        )
      : directoryBaseContent;
    const autoLinkServicePages = isBlog || isAop || isSubAop;
    const publishedLinkTargets = autoLinkServicePages
      ? await publishedInternalPageUrls(config.siteUrl, authorization, slug)
      : {};
    const linkedServiceContent = autoLinkServicePages
      ? linkVerifiedInternalKeywords(
          serviceAreaSafeContent,
          { ...publishedLinkTargets, ...client.practiceAreaUrls },
          config.siteUrl,
        )
      : serviceAreaSafeContent;
    const selectedBlogPracticeArea = blogPracticeArea || (isBlog ? practiceArea : "");
    let relatedAop = isBlog && selectedBlogPracticeArea
      ? blogAopFallbackLabels(selectedBlogPracticeArea)
          .map((label) => relevantAopTarget(label, client.practiceAreaUrls, config.siteUrl)
            || relevantAopTarget(label, publishedLinkTargets, config.siteUrl))
          .find(Boolean)
      : undefined;
    if (isBlog && selectedBlogPracticeArea && !relatedAop) {
      relatedAop = await searchPublishedAopTarget(
        config.siteUrl,
        authorization,
        selectedBlogPracticeArea,
        slug,
      );
    }
    if (isBlog && selectedBlogPracticeArea && !relatedAop) {
      throw new Error(`A published parent practice-area page matching “${selectedBlogPracticeArea}” was not found in WordPress. Add its general AOP URL to the client profile, then try again.`);
    }
    const internallyLinkedContent = isBlog && selectedBlogPracticeArea && relatedAop
      ? ensureAopLink(linkedServiceContent, selectedBlogPracticeArea, relatedAop)
      : linkedServiceContent;
    const directoryNormalizedContent = client.id === "fulginiti-law" && !isEnhancement && !isBlog && !isAop && !isSubAop
      ? normalizeFulginitiGeoDirectoryAnchors(internallyLinkedContent).content
      : internallyLinkedContent;
    const linkedContentWithoutFaqAnchors = client.phoneHref
      ? linkPhone(normalizeLegalLocationDirectoryLabels(directoryNormalizedContent).content, client.phoneHref)
      : normalizeLegalLocationDirectoryLabels(directoryNormalizedContent).content;
    const anchoredContent = addFulginitiFaqAnchor(addAmplifyFaqAnchors(isBlog ? finishBlogSourceLinks(linkedContentWithoutFaqAnchors, docId) : linkedContentWithoutFaqAnchors), config.siteUrl);
    const linkedContent = isBlog && new URL(config.siteUrl).hostname.replace(/^www\./, "") === "aglawnyc.com" ? protectThemeFaqAnchors(anchoredContent) : anchoredContent;
    const sourceMarker = sourcePage ? `\n<!-- amplify-geo-update-of:${sourcePage.id} -->` : "";
    const pageBody = isEnhancement || isBlog
      ? linkedContent
      : preparePageTitle(linkedContent, escapeHtml(extracted.pageTitle), config.siteUrl);
    const authorPanel = !isEnhancement && !isBlog && client.id === "drazen-mancini"
      ? `\n${drazenHeroAuthorPanel(extracted.pageTitle)}`
      : "";
    const wordpressBlocks = toWordPressBlocks(pageBody);
    const enhancementCta = isEnhancement
      ? enhancementCtaContext(extracted.pageTitle, input.pageUrl || input.website || "", client)
      : undefined;
    const defaultCtaLocation = enhancementCta?.location || (isBlog || isAop || isSubAop
      ? input.jurisdiction?.trim()
        || client.blogDefaults.defaultJurisdiction
        || client.jurisdictions[0]
        || (client.id === "billy-cooper-law" ? "New York State" : "your area")
      : location || "New York");
    const ctaLocation = isAop || isSubAop
      ? aopCtaLocation(extracted.pageTitle,effectivePracticeArea,defaultCtaLocation,client)
      : defaultCtaLocation;
    // Fail before generating media or writing any WordPress draft.
    ctaContact(client,ctaLocation);
    const ctaPracticeArea = enhancementCta?.practiceArea || (isBlog || isAop || isSubAop
      ? blogPracticeArea || effectivePracticeArea
      : effectivePracticeArea);
    const publicAppOrigin = process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : request.nextUrl.origin;
    const imageSourceId = input.refreshImage === true
      ? `${docId}-${Date.now()}`
      : ["1bEINcJV--5pS9DqyURc1PoO4KYNYxHpCAnzsob_jiy4","1Fa0QjWVRUAg6CA5iinM9IakjfqWJY8OUTV-N0sd2mZw"].includes(docId) ? `${docId}-side-profile-v5` : docId;
    const approvedReviewMedia = approvedImageReview
      ? await approvedContentImageMedia(config.siteUrl, authorization, approvedImageReview)
      : undefined;
    const generatedFeaturedMedia = !isEnhancement && !isBlog && !isAop && !isSubAop && client.id === "billy-cooper-law"
      ? await billyFeaturedImage(
          config.siteUrl,
          authorization,
          ctaLocation,
          effectivePracticeArea,
        )
      : undefined;
    let generatedGeoMedia: WordPressMedia | undefined;
    if (!isEnhancement && !isBlog && !isAop && !isSubAop && client.id !== "billy-cooper-law") {
      generatedGeoMedia = approvedReviewMedia || await relevantFeaturedImage(
        config.siteUrl,
        authorization,
        {
          pageTitle: extracted.pageTitle,
          clientName: client.name,
          sourceId: imageSourceId,
          practiceArea: effectivePracticeArea,
          primaryKeyword: input.primaryKeyword,
          jurisdiction: ctaLocation,
          articleContent: linkedContent,
          contentType: "geo",
        },
      );
    }
    let enhancementCtaMedia: WordPressMedia | undefined;
    if (isEnhancement) {
      enhancementCtaMedia = usesNewEnhancementImage(client) ? approvedReviewMedia || await relevantFeaturedImage(config.siteUrl, authorization, {
        pageTitle: extracted.pageTitle, clientName: client.name,
        sourceId: `${imageSourceId}-fresh-enhancement-v1`, practiceArea: ctaPracticeArea,
        primaryKeyword: input.primaryKeyword, jurisdiction: ctaLocation,
        articleContent: linkedContent, contentType: "enhance",
      }) : await wordPressMediaById(config.siteUrl, authorization, sourcePage?.featured_media);
      if (!enhancementCtaMedia?.id || !enhancementCtaMedia.source_url) {
        throw new Error("The enhancement requires a verified image under this client’s image policy.");
      }
    }
    let generatedBlogMedia: WordPressMedia | undefined;
    if (isBlog) {
      generatedBlogMedia = approvedReviewMedia || await relevantFeaturedImage(
        config.siteUrl,
        authorization,
        {
          pageTitle: extracted.pageTitle,
          clientName: client.name,
          sourceId: imageSourceId,
          practiceArea: blogPracticeArea || effectivePracticeArea,
          primaryKeyword: input.primaryKeyword,
          jurisdiction: ctaLocation,
          articleContent: linkedContent,
          contentType: "blog",
        },
      );
      if (!generatedBlogMedia?.id) {
        throw new Error("The WordPress blog draft requires a generated featured image.");
      }
    }
    let generatedAopMedia: WordPressMedia | undefined;
    if (isAop || isSubAop) {
      generatedAopMedia = approvedReviewMedia || await relevantFeaturedImage(
        config.siteUrl,
        authorization,
        {
          pageTitle: extracted.pageTitle,
          clientName: client.name,
          sourceId: imageSourceId,
          practiceArea: effectivePracticeArea,
          primaryKeyword: input.primaryKeyword,
          jurisdiction: ctaLocation,
          articleContent: linkedContent,
          contentType: isSubAop ? "subaop" : "aop",
        },
      );
      if (!generatedAopMedia?.id) {
        throw new Error(`The WordPress ${isSubAop ? "Sub-AOP" : "Area of Practice"} draft requires a generated banner image.`);
      }
    }
    const ctaMedia = enhancementCtaMedia
      || generatedBlogMedia
      || generatedAopMedia
      || generatedGeoMedia
      || generatedFeaturedMedia;
    const imageReviewRequired = Boolean(
      enhancementCtaMedia?.requiresHumanReview
      || generatedBlogMedia?.requiresHumanReview
      || generatedAopMedia?.requiresHumanReview
      || generatedGeoMedia?.requiresHumanReview
      || generatedFeaturedMedia?.requiresHumanReview,
    );
    if (client.id !== "billy-cooper-law" && !ctaMedia?.source_url) {
      throw new Error(`The ${client.name} CTA requires a page-relevant WordPress image. The draft was not created with a generic fallback.`);
    }
    const ctaBlocks = insertCtaBlocks(wordpressBlocks, {
      origin: publicAppOrigin,
      client,
      location: ctaLocation,
      practiceArea: ctaPracticeArea,
      imageUrl: ctaMedia?.source_url,
      articleTopic: extracted.pageTitle,
      forceRefresh: isEnhancement,
    });
    const pageBlocks = ctaBlocks;
    const sourceType = isBlog ? "blog" : isAop ? "aop" : isSubAop ? "subaop" : "geo";
    const faqStandardMarker = `\n<!-- amplify-faq-standard:${AMPLIFY_FAQ_STANDARD_VERSION} -->`;
    const content = `<!-- amplify-${sourceType}-source:${docId} -->${faqStandardMarker}${sourceMarker}${authorPanel}\n${pageBlocks}`;
    // Audit the formatted WordPress version so publication can reuse its evidence check.
    if (isBlog) await assertAttorneyAuthority({title:extracted.pageTitle, html:content, firmName:client.name, website:config.siteUrl, authorityAttorney:input.authorityAttorney});
    const seoTitle = truncateAtWord(
      extracted.seoTitle || `${extracted.pageTitle} | ${client.name}`,
      isBlog || isAop || isSubAop ? 60 : 70,
    );
    const metaFallback = isEnhancement
      ? `Proposed page update for ${client.name}.`
      : isBlog
        ? `${client.name} explains ${effectivePracticeArea.toLowerCase()} and the legal issues readers should understand.`
      : isAop
        ? `Learn how ${client.name} helps with ${effectivePracticeArea.toLowerCase()} matters and what steps may protect a claim.`
      : isSubAop
        ? `Learn how ${client.name} helps with ${effectivePracticeArea.toLowerCase()} matters within ${parentPracticeArea.toLowerCase()} and what steps may protect a claim.`
      : `${client.name} provides ${effectivePracticeArea.toLowerCase()} guidance for people in ${location}.`;
    const metaDescription = truncateAtWord(
      extracted.metaDescription || metaDescriptionFrom(linkedContent, metaFallback),
      160,
    );
    const payload: Record<string, unknown> = {
      title: extracted.pageTitle,
      slug,
      status: "draft",
      content,
      excerpt: metaDescription,
    };
    if (!isEnhancement && !isBlog && !isAop && !isSubAop && parentId) payload.parent = parentId;
    const practicePage = isEnhancement || isBlog || isAop || isSubAop
      ? undefined
      : await publishedPracticePage(config.siteUrl, authorization, effectivePracticeArea);
    const aopParent = isAop
      ? await publishedAopParent(config.siteUrl, authorization)
      : undefined;
    if (isAop && aopParent?.id) payload.parent = aopParent.id;
    if (isSubAop && subAopParent?.id) payload.parent = subAopParent.id;
    const pageAuthorId = isBlog
      ? client.blogDefaults.authorId
      : sourcePage?.author || subAopParent?.author || aopParent?.author || practicePage?.author || undefined;
    if (pageAuthorId) payload.author = pageAuthorId;
    if (isBlog) {
      const categoryResponse = await fetch(`${config.siteUrl}/wp-json/wp/v2/categories?per_page=100`, {headers:{Authorization:authorization},cache:"no-store"});
      const categories = await wordPressJson<{id:number;name:string;slug:string}[]>(categoryResponse,"checking blog categories");
      if(!categoryResponse.ok || !Array.isArray(categories)) throw new Error("Could not verify blog categories.");
      const normalizeCategory=(name:string)=>name.toLowerCase().replace(/lawyers?|attorneys?/g,"").replace(/[^a-z0-9]/g,"").replace(/s$/,"");
      const categoryLabel=selectedBlogPracticeArea||effectivePracticeArea;
      let category=categories.find(c=>normalizeCategory(c.name)===normalizeCategory(categoryLabel) && c.slug!=="uncategorized")
        || categories.find(c=>c.id===client.blogDefaults.categoryId && c.slug!=="uncategorized");
      if(!category) {
        const createCategory=await fetch(`${config.siteUrl}/wp-json/wp/v2/categories`,{method:"POST",headers:{Authorization:authorization,"Content-Type":"application/json"},body:JSON.stringify({name:categoryLabel})});
        const created=await wordPressJson<{id:number;name:string;slug:string;message?:string}>(createCategory,"creating the blog practice category");
        if(!createCategory.ok || !created.id)throw new Error(created.message||"A relevant blog category could not be saved.");
        category=created;
      }
      payload.categories=[category.id];
    }
    const featuredMediaId = generatedBlogMedia?.id
      || generatedAopMedia?.id
      || generatedGeoMedia?.id
      || generatedFeaturedMedia?.id
      || enhancementCtaMedia?.id
      || sourcePage?.featured_media
      || practicePage?.featured_media
      || undefined;
    if (featuredMediaId) payload.featured_media = featuredMediaId;
    const pageTemplate = sourcePage?.template || subAopParent?.template || aopParent?.template || practicePage?.template || config.pageTemplate;
    if (pageTemplate) payload.template = pageTemplate;
    // Preserve the approved export and the complete previous WordPress record
    // before replacing a prepared draft. A failed backup blocks the write.
    if (isBlog) {
      let previousWordPress: unknown = null;
      if (existingPage) {
        const previousResponse = await fetch(`${config.siteUrl}/wp-json/wp/v2/${contentEndpoint}/${existingPage.id}?context=edit`, {
          headers: { Authorization: authorization }, cache: "no-store",
        });
        previousWordPress = await wordPressJson(previousResponse, "backing up the existing blog draft");
        if (!previousResponse.ok) throw new Error("The existing blog draft could not be backed up. Nothing was overwritten.");
      }
      const backupId = `amplify:blog-preparation-backup:v1:${client.id}:${docId}:${Date.now()}`;
      await uploadRedis().set(backupId, JSON.stringify({
        createdAt: new Date().toISOString(), clientId: client.id, docId,
        siteUrl: config.siteUrl, approvedExport: exported, previousWordPress,
      }));
    }
    const save = await fetch(existingPage ? `${config.siteUrl}/wp-json/wp/v2/${contentEndpoint}/${existingPage.id}` : `${config.siteUrl}/wp-json/wp/v2/${contentEndpoint}`, {
      method: "POST",
      headers: { Authorization: authorization, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const saved = await wordPressJson<WordPressPage & { message?: string }>(
      save,
      existingPage ? "refreshing the formatted draft" : "creating the formatted draft",
    );
    if (!save.ok || !saved.id) throw new Error(saved.message || "WordPress could not create the formatted draft.");
    if (parentId && saved.parent !== parentId) {
      throw new Error(`WordPress saved the draft, but did not confirm its required parent page ${parentId}.`);
    }
    if (featuredMediaId && saved.featured_media !== featuredMediaId) {
      throw new Error("WordPress saved the draft, but did not confirm its featured image attachment.");
    }

    const pageUrl = saved.link || new URL(`${slug}/`, `${config.siteUrl}/`).toString();
    const bridge = requiredBridge || await bridgeStatus(config.siteUrl, authorization);
    const bridgeSupportsContent = bridge.ready && (
      !isBlog || bridge.supportedPostTypes?.includes("post") === true
    );
    const pageSchema = isBlog
      ? blogSchema(
          linkedContent,
          pageUrl,
          config.siteUrl,
          extracted.pageTitle,
          metaDescription,
          ctaPracticeArea,
          client.name,
          generatedBlogMedia,
        )
      : isAop
        ? aopSchema(
            linkedContent,
            pageUrl,
            config.siteUrl,
            extracted.pageTitle,
            metaDescription,
            ctaLocation,
            effectivePracticeArea,
            client.phoneDisplay,
            client.name,
            generatedAopMedia,
          )
      : isSubAop
        ? aopSchema(
            linkedContent,
            pageUrl,
            config.siteUrl,
            extracted.pageTitle,
            metaDescription,
            ctaLocation,
            effectivePracticeArea,
            client.phoneDisplay,
            client.name,
            generatedAopMedia,
            subAopParent?.link
              ? { name: parentPracticeArea, url: subAopParent.link }
              : undefined,
          )
      : geoSchema(
          linkedContent,
          pageUrl,
          config.siteUrl,
          location,
          effectivePracticeArea,
          client.phoneDisplay,
          client.name,
        );
    let seoWarning: string | undefined;
    if (bridgeSupportsContent) {
      const metaSave = await fetch(`${config.siteUrl}/wp-json/amplify-geo/v1/page-meta`, {
        method: "POST",
        headers: { Authorization: authorization, "Content-Type": "application/json" },
        body: JSON.stringify({
          page_id: saved.id,
          seo_title: seoTitle,
          meta_description: metaDescription,
          client_id: client.id,
          hero_image_id: (client.id === "billy-cooper-law" ? enhancementCtaMedia?.id : undefined) || generatedFeaturedMedia?.id || generatedAopMedia?.id || 0,
          schema: pageSchema,
        }),
      });
      const metaSaved = await wordPressJson<{ message?: string; heroImageId?: number; heroResolvedId?: number }>(
        metaSave,
        "saving the draft’s SEO metadata",
      );
      if (!metaSave.ok) throw new Error(metaSaved.message || "WordPress saved the draft, but its SEO metadata could not be added.");
      const expectedHeroImageId = (client.id === "billy-cooper-law" ? enhancementCtaMedia?.id : undefined) || generatedFeaturedMedia?.id || generatedAopMedia?.id;
      if (expectedHeroImageId && metaSaved.heroImageId !== expectedHeroImageId) {
        throw new Error("WordPress saved the draft, but the theme hero image was not confirmed.");
      }
      if (generatedFeaturedMedia?.id && metaSaved.heroResolvedId !== generatedFeaturedMedia.id) {
        throw new Error("WordPress saved the draft, but ACF could not resolve the theme hero image.");
      }
    } else if (!isEnhancement) {
      const schemaContent = `${content}\n${inlineSchemaBlock(pageSchema)}`;
      const schemaSave = await fetch(`${config.siteUrl}/wp-json/wp/v2/${contentEndpoint}/${saved.id}`, {
        method: "POST",
        headers: { Authorization: authorization, "Content-Type": "application/json" },
        body: JSON.stringify({ content: schemaContent, excerpt: metaDescription }),
        cache: "no-store",
      });
      if (!schemaSave.ok) {
        const schemaError = await wordPressJson<{ message?: string }>(
          schemaSave,
          "adding schema to the draft",
        );
        throw new Error(schemaError.message || `WordPress saved the ${isBlog ? "post" : "page"} draft, but its schema could not be added.`);
      }
      seoWarning = `The ${isBlog ? "post" : "page"} includes schema plus a WordPress excerpt. Update the AMPLIFY bridge on this site to save the custom SEO title and meta description directly in Yoast.`;
    }
    if (isBlog) {
      const finalResponse = await fetch(`${config.siteUrl}/wp-json/wp/v2/posts/${saved.id}?context=edit`, {
        headers: { Authorization: authorization }, cache: "no-store",
      });
      const finalDraft = await wordPressJson<WordPressPage>(finalResponse, "verifying the saved blog authority section");
      if (!finalResponse.ok || !finalDraft.content?.raw) throw new Error("The saved blog could not be verified for final approval.");
      await assertAttorneyAuthority({title:finalDraft.title?.raw || finalDraft.title?.rendered || "", html:finalDraft.content.raw, firmName:client.name, website:config.siteUrl, authorityAttorney:input.authorityAttorney});
    }
    const previewUrl = new URL(config.siteUrl);
    previewUrl.searchParams.set(isBlog ? "p" : "page_id", String(saved.id));
    previewUrl.searchParams.set("preview", "true");

    const warnings = [
      seoWarning,
      imageReviewRequired
        ? "The automated image review was uncertain, so the draft was created with the best complete candidate. Review and approve the featured image before publishing."
        : undefined,
    ].filter((warning): warning is string => Boolean(warning));

    return NextResponse.json({
      ok: true,
      updated: Boolean(existingPage),
      pageId: saved.id,
      pageUrl,
      editUrl: `${config.siteUrl}/wp-admin/post.php?post=${saved.id}&action=edit`,
      previewUrl: previewUrl.toString(),
      status: saved.status || "draft",
      featuredMediaId,
      featuredImageUrl: generatedBlogMedia?.source_url
        || generatedAopMedia?.source_url
        || generatedGeoMedia?.source_url
        || generatedFeaturedMedia?.source_url
        || enhancementCtaMedia?.source_url,
      seoTitle,
      metaDescription,
      contentType: isBlog ? "post" : "page",
      imageReviewRequired,
      preparationRequired: warnings.length > 0,
      warnings,
      warning: warnings.length ? warnings.join(" ") : undefined,
    });
  } catch (error) {
    if (error instanceof PreparationPending || error instanceof AuthorityReviewPending) return NextResponse.json({ error: error.message, preparationPending: true }, { status: 429 });
    const message = error instanceof Error ? error.message : "The WordPress draft could not be created.";
    console.error("[wordpress/draft]", message);
    const status = /not connected|reconnect|expired|authorized/i.test(message)
      ? 401
      : /AMPLIFY FAQ standard/i.test(message)
        ? 422
        : 500;
    return NextResponse.json({ error: message }, { status });
  } finally {
    if(release)await release();
  }
}

export const POST = userActionRoute("Prepare WordPress draft", handlePOST);
