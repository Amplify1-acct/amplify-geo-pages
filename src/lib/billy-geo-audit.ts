import type { ClientProfile } from "@/lib/clients";
import { BILLY_CTA_VERSION, insertCtaBlocks, type CtaLocale } from "@/lib/cta";
import { directLink } from "@/lib/direct-link";

export const BILLY_SPANISH_VIDEO_STYLE_VERSION = "billy-spanish-video-responsive-v1";

export type BillyGeoGroup = "new-york" | "westchester" | "bronx" | "rockland" | "queens" | "brooklyn";

export type BillyGeoPageSpec = {
  id: number;
  group: BillyGeoGroup;
  label: string;
  location: string;
  locale: CtaLocale;
  mediaId: number;
  canonical?: boolean;
  repairable?: boolean;
};

const englishMedia = {
  westchester: 7268,
  yonkers: 7062,
  greenburgh: 7064,
  "new-rochelle": 7066,
  "mount-vernon": 7068,
  bronx: 7050,
  "co-op-city": 7060,
  kingsbridge: 7058,
  soundview: 7056,
  riverdale: 7054,
  fordham: 7052,
  rockland: 7038,
  ramapo: 7048,
  clarkstown: 7046,
  haverstraw: 7044,
  "new-city": 7042,
  "spring-valley": 7040,
  "murray-hill": 7207,
  jamaica: 7212,
  ridgewood: 7215,
  "flushing-willets": 7239,
  corona: 7221,
  "south-ozone-park": 7224,
  "forest-hills": 7227,
  "jackson-heights": 7230,
  elmhurst: 7233,
  "queens-village": 7236,
  brooklyn: 7025,
  "bedford-stuyvesant": 7011,
  bushwick: 7036,
  "crown-heights": 7009,
  flatbush: 7034,
  williamsburg: 7032,
  "borough-park": 7030,
  bensonhurst: 7078,
  "sunset-park": 7022,
  "bay-ridge": 7070,
  "east-new-york": 7072,
} as const;

const newYorkPages: BillyGeoPageSpec[] = [
  { id: 7591, group: "new-york", label: "New York County", location: "New York County, NY", locale: "en", mediaId: 7590 },
  { id: 7582, group: "new-york", label: "Manhattan", location: "Manhattan, NY", locale: "en", mediaId: 7581 },
  { id: 7585, group: "new-york", label: "Upper West Side", location: "Upper West Side, NY", locale: "en", mediaId: 7584 },
  { id: 7588, group: "new-york", label: "Upper East Side", location: "Upper East Side, NY", locale: "en", mediaId: 7587 },
  { id: 7594, group: "new-york", label: "Washington Heights", location: "Washington Heights, NY", locale: "en", mediaId: 7593 },
  { id: 7597, group: "new-york", label: "Harlem", location: "Harlem, NY", locale: "en", mediaId: 7596 },
  { id: 7600, group: "new-york", label: "Midtown", location: "Midtown Manhattan, NY", locale: "en", mediaId: 7599 },
];

const westchesterEn: BillyGeoPageSpec[] = [
  { id: 6627, group: "westchester", label: "Westchester County", location: "Westchester County, NY", locale: "en", mediaId: englishMedia.westchester },
  { id: 6649, group: "westchester", label: "Yonkers", location: "Yonkers, NY", locale: "en", mediaId: englishMedia.yonkers },
  { id: 6837, group: "westchester", label: "Greenburgh", location: "Greenburgh, NY", locale: "en", mediaId: englishMedia.greenburgh },
  { id: 6654, group: "westchester", label: "New Rochelle", location: "New Rochelle, NY", locale: "en", mediaId: englishMedia["new-rochelle"] },
  { id: 6657, group: "westchester", label: "Mount Vernon", location: "Mount Vernon, NY", locale: "en", mediaId: englishMedia["mount-vernon"] },
];

const bronxEn: BillyGeoPageSpec[] = [
  { id: 6629, group: "bronx", label: "Bronx County", location: "Bronx County, NY", locale: "en", mediaId: englishMedia.bronx },
  { id: 6700, group: "bronx", label: "Co-op City", location: "Co-op City, NY", locale: "en", mediaId: englishMedia["co-op-city"] },
  { id: 6703, group: "bronx", label: "Kingsbridge", location: "Kingsbridge, NY", locale: "en", mediaId: englishMedia.kingsbridge },
  { id: 6706, group: "bronx", label: "Soundview", location: "Soundview, NY", locale: "en", mediaId: englishMedia.soundview },
  { id: 6709, group: "bronx", label: "Riverdale", location: "Riverdale, NY", locale: "en", mediaId: englishMedia.riverdale },
  { id: 6712, group: "bronx", label: "Fordham", location: "Fordham, NY", locale: "en", mediaId: englishMedia.fordham },
];

const rocklandEn: BillyGeoPageSpec[] = [
  { id: 6631, group: "rockland", label: "Rockland County", location: "Rockland County, NY", locale: "en", mediaId: englishMedia.rockland },
  { id: 6728, group: "rockland", label: "Ramapo", location: "Ramapo, NY", locale: "en", mediaId: englishMedia.ramapo },
  { id: 6730, group: "rockland", label: "Clarkstown", location: "Clarkstown, NY", locale: "en", mediaId: englishMedia.clarkstown },
  { id: 6732, group: "rockland", label: "Haverstraw", location: "Haverstraw, NY", locale: "en", mediaId: englishMedia.haverstraw },
  { id: 6734, group: "rockland", label: "New City", location: "New City, NY", locale: "en", mediaId: englishMedia["new-city"] },
  { id: 6736, group: "rockland", label: "Spring Valley", location: "Spring Valley, NY", locale: "en", mediaId: englishMedia["spring-valley"] },
];

const queensEn: BillyGeoPageSpec[] = [
  { id: 7171, group: "queens", label: "Queens County", location: "Queens County, NY", locale: "en", mediaId: 0 },
  { id: 7177, group: "queens", label: "Murray Hill–Broadway Flushing", location: "Murray Hill–Broadway Flushing, NY", locale: "en", mediaId: englishMedia["murray-hill"] },
  { id: 7178, group: "queens", label: "Jamaica", location: "Jamaica, NY", locale: "en", mediaId: englishMedia.jamaica },
  { id: 7179, group: "queens", label: "Ridgewood", location: "Ridgewood, NY", locale: "en", mediaId: englishMedia.ridgewood },
  { id: 7180, group: "queens", label: "Flushing–Willets Point", location: "Flushing–Willets Point, NY", locale: "en", mediaId: englishMedia["flushing-willets"] },
  { id: 7181, group: "queens", label: "Corona", location: "Corona, NY", locale: "en", mediaId: englishMedia.corona },
  { id: 7182, group: "queens", label: "South Ozone Park", location: "South Ozone Park, NY", locale: "en", mediaId: englishMedia["south-ozone-park"] },
  { id: 7183, group: "queens", label: "Forest Hills", location: "Forest Hills, NY", locale: "en", mediaId: englishMedia["forest-hills"] },
  { id: 7184, group: "queens", label: "Jackson Heights", location: "Jackson Heights, NY", locale: "en", mediaId: englishMedia["jackson-heights"] },
  { id: 7185, group: "queens", label: "Elmhurst", location: "Elmhurst, NY", locale: "en", mediaId: englishMedia.elmhurst },
  { id: 7175, group: "queens", label: "Queens Village", location: "Queens Village, NY", locale: "en", mediaId: englishMedia["queens-village"] },
];

const brooklynEn: BillyGeoPageSpec[] = [
  { id: 6640, group: "brooklyn", label: "Kings County (Brooklyn)", location: "Kings County (Brooklyn), NY", locale: "en", mediaId: englishMedia.brooklyn },
  { id: 6788, group: "brooklyn", label: "Bedford-Stuyvesant", location: "Bedford-Stuyvesant, NY", locale: "en", mediaId: englishMedia["bedford-stuyvesant"] },
  { id: 6790, group: "brooklyn", label: "Bushwick", location: "Bushwick, NY", locale: "en", mediaId: englishMedia.bushwick },
  { id: 6792, group: "brooklyn", label: "Crown Heights", location: "Crown Heights, NY", locale: "en", mediaId: englishMedia["crown-heights"] },
  { id: 6794, group: "brooklyn", label: "Flatbush", location: "Flatbush, NY", locale: "en", mediaId: englishMedia.flatbush },
  { id: 6796, group: "brooklyn", label: "Williamsburg", location: "Williamsburg, NY", locale: "en", mediaId: englishMedia.williamsburg },
  { id: 6798, group: "brooklyn", label: "Borough Park", location: "Borough Park, NY", locale: "en", mediaId: englishMedia["borough-park"] },
  { id: 6800, group: "brooklyn", label: "Bensonhurst", location: "Bensonhurst, NY", locale: "en", mediaId: englishMedia.bensonhurst },
  { id: 6802, group: "brooklyn", label: "Sunset Park", location: "Sunset Park, NY", locale: "en", mediaId: englishMedia["sunset-park"] },
  { id: 6804, group: "brooklyn", label: "Bay Ridge", location: "Bay Ridge, NY", locale: "en", mediaId: englishMedia["bay-ridge"] },
  { id: 6806, group: "brooklyn", label: "East New York", location: "East New York, NY", locale: "en", mediaId: englishMedia["east-new-york"] },
  { id: 6977, group: "brooklyn", label: "Bushwick (legacy URL)", location: "Bushwick, NY", locale: "en", mediaId: englishMedia.bushwick, canonical: false },
];

function spanish(spec: BillyGeoPageSpec, id: number, location?: string, label?: string): BillyGeoPageSpec {
  return { ...spec, id, locale: "es", location: location || spec.location, label: label || spec.label };
}

const newYorkEs = [
  spanish(newYorkPages[0], 7984, "Condado de Nueva York, NY", "Condado de Nueva York"),
  spanish(newYorkPages[1], 7988),
  spanish(newYorkPages[2], 6770),
  spanish(newYorkPages[3], 6768),
  spanish(newYorkPages[4], 6774),
  spanish(newYorkPages[5], 6772),
  spanish(newYorkPages[6], 7986, "Midtown Manhattan, NY", "Midtown Manhattan"),
];

const westchesterEs = [
  spanish(westchesterEn[0], 7265, "Condado de Westchester, NY", "Condado de Westchester"),
  spanish(westchesterEn[1], 7283),
  spanish(westchesterEn[2], 7285),
  spanish(westchesterEn[3], 7287),
  spanish(westchesterEn[4], 7290),
];
const bronxEs = [
  spanish(bronxEn[0], 7274, "El Bronx, NY", "Condado del Bronx"),
  spanish(bronxEn[1], 7292),
  spanish(bronxEn[2], 7294),
  spanish(bronxEn[3], 7296),
  spanish(bronxEn[4], 7298),
  spanish(bronxEn[5], 7300),
];
const rocklandEs = [
  spanish(rocklandEn[0], 7277, "Condado de Rockland, NY", "Condado de Rockland"),
  spanish(rocklandEn[1], 7302),
  spanish(rocklandEn[2], 7304),
  spanish(rocklandEn[3], 7306),
  spanish(rocklandEn[4], 7308),
  spanish(rocklandEn[5], 7310),
];
const queensEs = [
  spanish(queensEn[0], 7279, "Condado de Queens, NY", "Condado de Queens"),
  spanish(queensEn[1], 7312),
  spanish(queensEn[2], 7314),
  spanish(queensEn[3], 7316),
  spanish(queensEn[4], 7318),
  spanish(queensEn[5], 7320),
  spanish(queensEn[6], 7322),
  spanish(queensEn[7], 7324),
  spanish(queensEn[8], 7326),
  spanish(queensEn[9], 7328),
  spanish(queensEn[10], 7330),
];
const brooklynEs = [
  spanish(brooklynEn[0], 7281, "Condado de Kings (Brooklyn), NY", "Condado de Kings (Brooklyn)"),
  spanish(brooklynEn[1], 7332),
  spanish(brooklynEn[2], 7334),
  spanish(brooklynEn[3], 7336),
  spanish(brooklynEn[4], 7338),
  spanish(brooklynEn[5], 7340),
  spanish(brooklynEn[6], 7342),
  spanish(brooklynEn[7], 7344),
  spanish(brooklynEn[8], 7346),
  spanish(brooklynEn[9], 7348),
  spanish(brooklynEn[10], 7350),
];

export const BILLY_GEO_PAGES: BillyGeoPageSpec[] = [
  ...newYorkPages,
  ...westchesterEn,
  ...bronxEn,
  ...rocklandEn,
  ...queensEn,
  ...brooklynEn,
  ...newYorkEs,
  ...westchesterEs,
  ...bronxEs,
  ...rocklandEs,
  ...queensEs,
  ...brooklynEs,
];

export const BILLY_QUEENS_MEDIA_SLUG = "queens-county-ny-v2";

export type AuditWordPressPage = {
  id: number;
  link?: string;
  status?: string;
  featured_media?: number;
  title?: { raw?: string; rendered?: string };
  excerpt?: { raw?: string; rendered?: string };
  content?: { raw?: string; rendered?: string };
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function plainText(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function count(value: string, pattern: RegExp) {
  return [...value.matchAll(pattern)].length;
}

export function canonicalGroupPages(spec: BillyGeoPageSpec) {
  return BILLY_GEO_PAGES.filter((page) => page.group === spec.group
    && page.locale === spec.locale
    && page.canonical !== false);
}

function stripManagedCtas(content: string) {
  return content
    .replace(/\s*<!-- amplify-geo-cta:(?:opening|middle|closing) -->[\s\S]*?<!-- \/wp:(?:image|html) -->\s*/gi, "\n")
    .replace(/\s*<section\b[^>]*class=(['"])[^'"]*\bbcl-inline-cta\b[^'"]*\1[^>]*>[\s\S]*?<\/section>\s*/gi, "\n")
    .replace(/\s*<style\b[^>]*>[\s\S]*?\.bcl-inline-cta[\s\S]*?<\/style>\s*/gi, "\n");
}

function cleanRedirectLinks(content: string) {
  return content.replace(/href=(['"])([^'"]+)\1/gi, (_match, quote: string, href: string) => {
    const resolved = directLink(href) || href;
    return `href=${quote}${escapeHtml(resolved)}${quote}`;
  });
}

export function responsiveBillySpanishVideo(content: string) {
  if (!content.includes("spanish_cooper_firm-overview-aop_260609-v1_v2-1440p.mp4")) return content;
  let normalized = content.replace(
    /\s*<!-- amplify-geo-spanish-video-style:v1 -->\s*<style\b[^>]*>[\s\S]*?<\/style>\s*/gi,
    "\n",
  );
  normalized = normalized.replace(
    /<div\b([^>]*\bclass=(['"])([^'"]*\bwp-video\b[^'"]*)\2[^>]*)>/i,
    (_match, attributes: string, quote: string, classes: string) => {
      const withClass = attributes.replace(
        /\bclass=(['"])[^'"]*\1/i,
        `class=${quote}${classes.includes("amplify-geo-video-responsive") ? classes : `${classes} amplify-geo-video-responsive`}${quote}`,
      );
      const withoutStyle = withClass.replace(/\s+style=(['"])[\s\S]*?\1/i, "");
      return `<div${withoutStyle} style="width:100%;max-width:100%;height:auto;aspect-ratio:16/9;overflow:hidden;border-radius:18px;background:#082536">`;
    },
  );
  normalized = normalized.replace(
    /<video\b([^>]*)>/i,
    (_match, attributes: string) => {
      const withoutStyle = attributes.replace(/\s+style=(['"])[\s\S]*?\1/i, "");
      return `<video${withoutStyle} style="display:block;width:100%;max-width:100%;height:100%;aspect-ratio:16/9;object-fit:cover">`;
    },
  );
  const style = `<!-- amplify-geo-spanish-video-style:v1 -->
<style data-amplify-video-style="${BILLY_SPANISH_VIDEO_STYLE_VERSION}">
.wp-video,.amplify-geo-video-responsive.wp-video{box-sizing:border-box!important;width:100%!important;max-width:100%!important;height:auto!important;aspect-ratio:16/9!important;overflow:hidden!important;border-radius:18px;background:#082536}
.wp-video>video,.wp-video .wp-video-shortcode,.wp-video-shortcode{display:block!important;width:100%!important;max-width:100%!important;height:100%!important;aspect-ratio:16/9!important;object-fit:cover!important}
</style>`;
  const positions = [
    normalized.search(/<div\b[^>]*\bclass=(['"])[^'"]*\bwp-video\b[^'"]*\1[^>]*>/i),
    normalized.search(/\[video\b/i),
    normalized.search(/<video\b/i),
  ].filter((position) => position >= 0);
  const videoPosition = positions.length ? Math.min(...positions) : -1;
  if (videoPosition < 0) return normalized;
  return `${normalized.slice(0, videoPosition)}${style}\n${normalized.slice(videoPosition)}`;
}

function directoryHtml(
  spec: BillyGeoPageSpec,
  linkedPages: Map<number, AuditWordPressPage>,
) {
  const heading = spec.locale === "es" ? "Comunidades que servimos" : "Communities We Serve";
  const pages = canonicalGroupPages(spec);
  const items = pages.map((page) => {
    const target = linkedPages.get(page.id);
    const body = page.id === spec.id || !target?.link
      ? escapeHtml(page.label)
      : `<a href="${escapeHtml(target.link)}">${escapeHtml(page.label)}</a>`;
    return `<li>${body}</li>`;
  }).join("\n");
  return `<!-- amplify-geo-directory:v2 -->
<!-- wp:heading -->
<h2>${heading}</h2>
<!-- /wp:heading -->
<!-- wp:list -->
<ul>
${items}
</ul>
<!-- /wp:list -->`;
}

function insertDirectory(
  content: string,
  spec: BillyGeoPageSpec,
  linkedPages: Map<number, AuditWordPressPage>,
) {
  const withoutManaged = content.replace(/\s*<!-- amplify-geo-directory:v2 -->[\s\S]*?<!-- \/wp:list -->\s*/gi, "\n");
  const blockSource = spec.locale === "es" ? /<!-- wp:heading\b[^>]*-->\s*<h2\b[^>]*>\s*Fuentes\s*<\/h2>/i : /<!-- wp:heading\b[^>]*-->\s*<h2\b[^>]*>\s*Sources\s*<\/h2>/i;
  const classicSource = spec.locale === "es" ? /<h2\b[^>]*>\s*Fuentes\s*<\/h2>/i : /<h2\b[^>]*>\s*Sources\s*<\/h2>/i;
  const source = withoutManaged.match(blockSource) || withoutManaged.match(classicSource);
  const position = source?.index ?? withoutManaged.length;
  const directory = directoryHtml(spec, linkedPages);
  return `${withoutManaged.slice(0, position)}\n${directory}\n${withoutManaged.slice(position)}`;
}

export function repairBillyGeoContent(
  page: AuditWordPressPage,
  spec: BillyGeoPageSpec,
  linkedPages: Map<number, AuditWordPressPage>,
  appOrigin: string,
  client: ClientProfile,
) {
  const raw = page.content?.raw || page.content?.rendered || "";
  const cleaned = spec.locale === "es"
    ? responsiveBillySpanishVideo(cleanRedirectLinks(stripManagedCtas(raw)))
    : cleanRedirectLinks(stripManagedCtas(raw));
  const withDirectory = insertDirectory(cleaned, spec, linkedPages);
  return insertCtaBlocks(withDirectory, {
    origin: appOrigin,
    client,
    location: spec.location,
    practiceArea: spec.locale === "es" ? "Lesiones personales" : "Personal Injury",
    locale: spec.locale,
  });
}

export function auditBillyGeoPage(
  page: AuditWordPressPage | undefined,
  spec: BillyGeoPageSpec,
  expectedMediaId: number,
) {
  const content = page?.content?.raw || page?.content?.rendered || "";
  const groupPages = canonicalGroupPages(spec);
  const managedDirectory = content.match(/<!-- amplify-geo-directory:v2 -->[\s\S]*?<!-- \/wp:list -->/i)?.[0];
  const directorySection = managedDirectory
    || content.match(/(?:(?:Manhattan\s+)?Communities We Serve|Comunidades que servimos)[\s\S]*?(?=<h2\b|$)/i)?.[0]
    || "";
  const directoryText = plainText(directorySection);
  const directoryLabelsPresent = groupPages.filter((candidate) => directoryText.includes(candidate.label)).length;
  const directoryLinkCount = count(directorySection, /<a\b[^>]*\bhref=(['"])[^'"]+\1/gi);
  const directoryLinksExpected = groupPages.length - (groupPages.some((candidate) => candidate.id === spec.id) ? 1 : 0);
  const ctaElements = [...content.matchAll(/<(?:figure|section)\b[^>]*\bamplify-geo-cta\b[^>]*>/gi)].map((match) => match[0]);
  const ctaCount = ctaElements.length;
  const ctaVersionCount = ctaElements.filter((element) => element.includes(BILLY_CTA_VERSION)).length;
  const ctaMarginCount = ctaElements.filter((element) => /margin\s*:\s*32px\s+0(?:\s+32px\s+0)?\s*;?/i.test(element)
    || (/margin-top\s*:\s*32px/i.test(element) && /margin-bottom\s*:\s*32px/i.test(element))).length;
  const legacyCtaCount = count(content, /\bbcl-inline-cta\b/g);
  const redirectWrapperCount = count(content, /https?:\/\/(?:www\.)?google\.com\/url\?/gi);
  const hasSpanishVideo = content.includes("spanish_cooper_firm-overview-aop_260609-v1_v2-1440p.mp4");
  const hasAnyVideo = /\.mp4(?:\?|["'])/i.test(content);
  const localeVideoOk = spec.locale === "es" ? hasSpanishVideo : !hasSpanishVideo || !hasAnyVideo;
  const videoResponsiveOk = spec.locale !== "es" || content.includes(BILLY_SPANISH_VIDEO_STYLE_VERSION);
  const ctaOk = ctaCount === 3 && ctaVersionCount === 3 && ctaMarginCount === 3 && legacyCtaCount === 0;
  const bannerOk = Boolean(page && expectedMediaId > 0 && page.featured_media === expectedMediaId);
  const directoryOk = directoryLabelsPresent === groupPages.length
    && directoryLinkCount === directoryLinksExpected;
  const directLinksOk = redirectWrapperCount === 0;
  const published = page?.status === "publish";
  return {
    id: spec.id,
    group: spec.group,
    locale: spec.locale,
    label: spec.label,
    location: spec.location,
    pageUrl: page?.link || "",
    contentLength: content.length,
    published,
    repairable: spec.repairable !== false,
    expectedMediaId,
    featuredMediaId: page?.featured_media || 0,
    ctaCount,
    ctaOk,
    bannerOk,
    directoryLabelsPresent,
    directoryLabelsExpected: groupPages.length,
    directoryLinkCount,
    directoryLinksExpected,
    directoryOk,
    directLinksOk,
    redirectWrapperCount,
    localeVideoOk,
    videoResponsiveOk,
    complete: published && ctaOk && bannerOk && directoryOk && directLinksOk && localeVideoOk && videoResponsiveOk,
  };
}
