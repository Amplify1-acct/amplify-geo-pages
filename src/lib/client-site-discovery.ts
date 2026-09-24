import { verifiedPracticeAreaUrls } from "@/lib/practice-area-directory";

type DiscoveredClientIdentity = {
  name?: string;
  phoneDisplay?: string;
  phoneHref?: string;
  contactUrl?: string;
  jurisdictions?: string[];
  practiceAreas?: string[];
  practiceAreaUrls?: Record<string, string>;
  brand?: {
    primary: string;
    secondary: string;
    accent: string;
    surface: string;
    logoUrl?: string;
  };
  cta?: {
    consultationText: string;
    linkLabel: string;
  };
};

const FETCH_LIMIT = 600_000;
const STARTER_BRAND = {
  primary: "#151515",
  secondary: "#353535",
  accent: "#d2b052",
  surface: "#f7f7f7",
};

function publicHttpsUrl(value: string, base?: string) {
  try {
    const url = new URL(value, base);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:") return "";
    if (host === "localhost" || host.endsWith(".local") || host === "0.0.0.0" || host === "127.0.0.1" || host === "::1") return "";
    if (/^(?:10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(host)) return "";
    return url.toString();
  } catch {
    return "";
  }
}

async function fetchText(url: string) {
  const safeUrl = publicHttpsUrl(url);
  if (!safeUrl) throw new Error("Only public HTTPS law-firm websites can be inspected.");
  const response = await fetch(safeUrl, {
    headers: {
      Accept: "text/html,application/xhtml+xml,text/css,application/xml;q=0.9,*/*;q=0.8",
      "User-Agent": "AMPLIFY-Client-Setup/1.0 (+https://amplifylaw.ai)",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`The public website returned HTTP ${response.status}.`);
  return (await response.text()).slice(0, FETCH_LIMIT);
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function attributes(tag: string) {
  return Object.fromEntries([...tag.matchAll(/([:\w-]+)\s*=\s*(["'])([\s\S]*?)\2/g)]
    .map((match) => [match[1].toLowerCase(), decodeHtml(match[3])]));
}

function firstMeta(html: string, names: string[]) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const attrs = attributes(tag);
    const key = (attrs.property || attrs.name || "").toLowerCase();
    if (names.includes(key) && attrs.content) return attrs.content;
  }
  return "";
}

function schemaObjects(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap(schemaObjects);
  if (!value || typeof value !== "object") return [];
  const object = value as Record<string, unknown>;
  return [object, ...Object.values(object).flatMap(schemaObjects)];
}

function organizationSchemas(html: string) {
  const objects: Record<string, unknown>[] = [];
  for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      objects.push(...schemaObjects(JSON.parse(match[1])));
    } catch {
      // Ignore malformed third-party schema and continue with visible markup.
    }
  }
  return objects.filter((object) => {
    const types = Array.isArray(object["@type"]) ? object["@type"] : [object["@type"]];
    return types.some((type) => /^(?:organization|legalservice|attorney|localbusiness)$/i.test(String(type || "")));
  });
}

function schemaLogo(value: unknown) {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  const object = value as Record<string, unknown>;
  return String(object.url || object.contentUrl || "");
}

function normalizedPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (national.length !== 10) return null;
  return {
    display: `(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`,
    href: `+1${national}`,
  };
}

function normalizeHex(value: string) {
  const hex = value.toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(hex)) return hex;
  if (/^#[0-9a-f]{3}$/.test(hex)) return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  return "";
}

function colorMetrics(hex: string) {
  const red = Number.parseInt(hex.slice(1, 3), 16) / 255;
  const green = Number.parseInt(hex.slice(3, 5), 16) / 255;
  const blue = Number.parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  return { luminance: 0.2126 * red + 0.7152 * green + 0.0722 * blue, chroma: max - min };
}

function discoveredBrand(css: string, logoUrl?: string) {
  const counts = new Map<string, number>();
  for (const match of css.matchAll(/#[0-9a-f]{3}(?:[0-9a-f]{3})?\b/gi)) {
    const color = normalizeHex(match[0]);
    if (color) counts.set(color, (counts.get(color) || 0) + 1);
  }
  const candidates = [...counts].map(([color, count]) => ({ color, count, ...colorMetrics(color) }));
  const primary = candidates
    .filter((item) => item.luminance <= 0.22)
    .sort((a, b) => b.count - a.count || a.luminance - b.luminance)[0]?.color || STARTER_BRAND.primary;
  const secondary = candidates
    .filter((item) => item.color !== primary && item.luminance <= 0.34)
    .sort((a, b) => b.count - a.count || a.luminance - b.luminance)[0]?.color || STARTER_BRAND.secondary;
  const customButtonColors = [...css.matchAll(/\.button[^{}]*\{[^{}]*background(?:-color)?\s*:\s*(#[0-9a-f]{3,6})/gi)]
    .map((match) => normalizeHex(match[1]))
    .filter(Boolean);
  const accent = customButtonColors.at(-1)
    || candidates
      .filter((item) => item.chroma >= 0.18 && item.luminance >= 0.18 && item.luminance <= 0.86)
      .sort((a, b) => b.count - a.count || b.chroma - a.chroma)[0]?.color
    || STARTER_BRAND.accent;
  const surface = candidates
    .filter((item) => item.luminance >= 0.86 && item.chroma <= 0.12)
    .sort((a, b) => b.count - a.count || b.luminance - a.luminance)[0]?.color || STARTER_BRAND.surface;
  return { primary, secondary, accent, surface, logoUrl };
}

function uniqueStrings(values: string[]) {
  return values.map((value) => decodeHtml(value)).filter((value, index, items) =>
    Boolean(value) && items.findIndex((item) => item.toLowerCase() === value.toLowerCase()) === index,
  );
}

type SiteLink = { label: string; url: string };

function visibleText(value: string) {
  return decodeHtml(value
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " "))
    .replace(/\s*[|–—]\s*(?:Rafferty|Domnick|Cunningham|Yaffa|Law Firm).*/i, "")
    .trim();
}

function siteLinks(html: string, base: string) {
  const baseHost = new URL(base).hostname.replace(/^www\./, "").toLowerCase();
  const links: SiteLink[] = [];
  for (const match of html.matchAll(/(<a\b[^>]*>)([\s\S]*?)<\/a>/gi)) {
    const label = visibleText(match[2]);
    const url = publicHttpsUrl(attributes(match[1]).href || "", base);
    if (!label || !url || label.length > 120 || label.split(/\s+/).length > 18) continue;
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    if (host !== baseHost) continue;
    links.push({ label, url: url.replace(/#.*$/, "") });
  }
  return links;
}

function mainMarkup(html: string) {
  return html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1]
    || html.match(/<[^>]+role=["']main["'][^>]*>([\s\S]*?)<\/[^>]+>/i)?.[1]
    || html;
}

const PRACTICE_HUB = /practice[\s_-]*(?:areas?|groups?)|areas?[\s_-]*of[\s_-]*practice|legal[\s_-]*services?/i;
const PRACTICE_TERM = /(?:accident|abuse|bad faith|birth|brain|burn|catastrophic|civil|commercial|compensation|death|defect|diagnos|electrocution|employment|error|injur|insurance|liability|litigation|malpractice|mass tort|medical|medication|neglig|paralysis|premises|product|sexual|spinal|truck|workplace|wrongful)/i;
const IGNORED_LABEL = /^(?:about(?: us)?|all practice areas?|attorneys?|back to menu|blog|case results?|client stories|co-counsel|contact(?: us)?|email us|español|faq(?: library)?|free (?:case review|consultation)|home|locations?|news|our firm|practice areas?|press releases|resources?|results|schedule|search|see all|social media|testimonials?|video library)$/i;
const IGNORED_PATH = /\/(?:about|attorneys?|blog|contact|locations?|news|press-releases?|resources?|results|team|testimonials?|videos?)(?:\/|$)/i;

function acceptablePracticeLink(link: SiteLink, hubPage = false) {
  const path = new URL(link.url).pathname;
  if (IGNORED_LABEL.test(link.label) || IGNORED_PATH.test(path)) return false;
  if (/\.(?:jpg|jpeg|png|gif|svg|webp|pdf)$/i.test(path)) return false;
  return hubPage || PRACTICE_TERM.test(`${link.label} ${path.replace(/[/-]+/g, " ")}`);
}

async function discoverPracticeAreaUrls(siteUrl: string, html: string) {
  const result = new Map<string, string>();
  const add = (link: SiteLink) => {
    if (![...result.keys()].some((label) => label.toLowerCase() === link.label.toLowerCase())) {
      result.set(link.label, link.url);
    }
  };

  for (const [label, url] of Object.entries(verifiedPracticeAreaUrls(siteUrl))) add({ label, url });

  const homeLinks = siteLinks(html, siteUrl);
  homeLinks.filter((link) => acceptablePracticeLink(link)).forEach(add);
  const hubLinks = homeLinks
    .filter((link) => PRACTICE_HUB.test(`${link.label} ${new URL(link.url).pathname}`))
    .filter((link, index, links) => links.findIndex((candidate) => candidate.url === link.url) === index)
    .slice(0, 3);

  const hubPages = await Promise.all(hubLinks.map(async (hub) => {
    try {
      return { html: await fetchText(hub.url), url: hub.url };
    } catch {
      return null;
    }
  }));
  for (const page of hubPages) {
    if (!page) continue;
    siteLinks(mainMarkup(page.html), page.url)
      .filter((link) => link.url !== page.url && acceptablePracticeLink(link, true))
      .forEach(add);
  }

  return Object.fromEntries([...result.entries()].slice(0, 200));
}

export async function discoverClientIdentity(website: string): Promise<DiscoveredClientIdentity> {
  const siteUrl = publicHttpsUrl(website);
  if (!siteUrl) throw new Error("Enter a public HTTPS law-firm website first.");
  const verifiedAreas = verifiedPracticeAreaUrls(siteUrl);
  let html = "";
  try {
    html = await fetchText(siteUrl);
  } catch (error) {
    if (!Object.keys(verifiedAreas).length) throw error;
  }
  const schemas = organizationSchemas(html);
  const schema = schemas[0];
  const siteName = firstMeta(html, ["og:site_name", "application-name"]);
  const name = decodeHtml(String(schema?.legalName || schema?.name || siteName || ""));
  const schemaPhone = String(schema?.telephone || "");
  const telPhone = [...html.matchAll(/href=["']tel:([^"']+)/gi)][0]?.[1] || "";
  const visiblePhone = html.match(/(?:\+?1[\s.-]*)?\(?\d{3}\)?[\s.-]+\d{3}[\s.-]+\d{4}/)?.[0] || "";
  const phone = normalizedPhone(schemaPhone || telPhone || visiblePhone);
  const schemaLogoUrl = schemaLogo(schema?.logo || schema?.image);
  const markupLogoTag = (html.match(/<img\b[^>]*class=["'][^"']*(?:custom-logo|site-logo)[^"']*["'][^>]*>/i) || [""])[0];
  const logoUrl = publicHttpsUrl(schemaLogoUrl || attributes(markupLogoTag).src || "", siteUrl);
  const contactTag = (html.match(/<a\b[^>]*href=["'][^"']*["'][^>]*>[^<]*(?:contact|case evaluation|consultation)[^<]*<\/a>/i) || [""])[0];
  const contactUrl = publicHttpsUrl(attributes(contactTag).href || "", siteUrl);
  const jurisdictions = uniqueStrings(schemas.flatMap((item) => {
    const areas = Array.isArray(item.areaServed) ? item.areaServed : item.areaServed ? [item.areaServed] : [];
    return areas.map((area) => typeof area === "string" ? area : String((area as Record<string, unknown>)?.name || ""));
  })).slice(0, 20);
  const practiceAreaUrls = await discoverPracticeAreaUrls(siteUrl, html);

  const linkedCssUrls = (html.match(/<link\b[^>]*>/gi) || [])
    .map(attributes)
    .filter((attrs) => /stylesheet/i.test(attrs.rel || "") && attrs.href)
    .map((attrs) => publicHttpsUrl(attrs.href, siteUrl))
    .filter((url, index, urls) => Boolean(url) && new URL(url).hostname === new URL(siteUrl).hostname && urls.indexOf(url) === index)
  const themeCssUrls = linkedCssUrls.filter((url) => /\/themes?\//i.test(url));
  const cssUrls = (themeCssUrls.length ? themeCssUrls : linkedCssUrls.filter((url) => !/\/plugins?\//i.test(url))).slice(-4);
  const inlineStyles = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)]
    .map((match) => match[1])
    .filter((style) => !/gform|gravity.form|wp-block-library/i.test(style));
  const cssParts: string[] = [];
  for (const cssUrl of cssUrls) {
    try {
      cssParts.push(await fetchText(cssUrl));
    } catch {
      // Brand discovery is best-effort; identity facts remain useful without CSS.
    }
  }
  if (!cssParts.length) cssParts.push(...inlineStyles.slice(0, 6));
  const brand = discoveredBrand(cssParts.join("\n"), logoUrl || undefined);
  const firmName = name || new URL(siteUrl).hostname.replace(/^www\./, "");

  return {
    name: firmName,
    phoneDisplay: phone?.display,
    phoneHref: phone?.href,
    contactUrl: contactUrl || undefined,
    jurisdictions,
    practiceAreas: Object.keys(practiceAreaUrls),
    practiceAreaUrls,
    brand,
    cta: {
      consultationText: `Tell ${firmName} what happened and get clear guidance about your next step.`,
      linkLabel: contactUrl ? "Contact the firm" : "Learn more",
    },
  };
}
