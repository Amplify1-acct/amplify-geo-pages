function decodedAttribute(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&quot;|&#0*34;/gi, '"');
}

export const LEGAL_DIRECTORY_LABEL_RULE = `In bulleted location directories, use only the city, neighborhood or county as the visible label (for example Soundview, never Soundview E-Bike Accident Lawyer). Put the practice or accident type and county in the heading. Every destination in that directory must be the same practice or accident type in that county and language; never substitute a general personal-injury city page or another practice. Keep the complete county campaign roster, and leave the current city and unpublished topic pages as plain text. Retain a short language qualifier when needed. For a list of different practices within one location, use only the practice names and put the location in the heading. Preserve verified destination URLs, include every live sibling Sub-AOP and the main AOP, and never link to unpublished drafts. Do not repeat location or practice wording in every bullet.`;

// Limit cleanup to geographic directories, never prose, sources or lists of
// different practices for a single city. Preserve the original URLs and markup.
export function normalizeLegalLocationDirectoryLabels(content: string) {
  let changed = 0;
  const plain = (html: string) => html.replace(/<!--[^]*?-->/g, "").replace(/<[^>]+>/g, "").replace(/&nbsp;|&#160;/gi, " ").replace(/\s+/g, " ").trim();
  const location = (label: string) => {
    const match = label.match(/^(.+?)\s+(?:personal injury|slip(?:\s+and\s+|\s*&(?:amp;)?\s*)fall|e[- ]?bike(?:\s+accidents?)?|bicycle(?:\s+accidents?)?|car(?:\s+accidents?)?|truck(?:\s+accidents?)?|motorcycle(?:\s+accidents?)?|uber(?:\s+(?:and|&(?:amp;)?)\s+lyft)?(?:\s+accidents?)?|lyft(?:\s+accidents?)?|delivery(?:\s+accidents?)?|pedestrian(?:\s+accidents?)?)(?:\s+(?:accidents?|injury))?(?:\s+(?:lawyers?|attorneys?|claims?))?\s*(\((?:en español|in Spanish|English|español)\))?$/i);
    if (!match) return "";
    const name = match[1].replace(/,?\s+(?:NY|NJ|PA|CT|New York|New Jersey|Pennsylvania|Connecticut)$/i, "").trim();
    if (name.split(/\s+/).length > 6 || !name.split(/\s+/).every(word => /^(?:[A-ZÀ-ÖØ-Þ][\wÀ-ÿ'’&;#-]*|of|the|de|la)$/.test(word))) return "";
    return name + (match[2] ? ` ${match[2]}` : "");
  };
  const normalized = content.replace(/<ul\b[^>]*>[\s\S]*?<\/ul>/gi, (list, offset: number) => {
    const headings = [...content.slice(0, offset).matchAll(/<h[2-6]\b[^>]*>([\s\S]*?)<\/h[2-6]>/gi)];
    const heading = plain(headings.at(-1)?.[1] || "");
    if (/sources|references|types of|practice areas|tipos de/i.test(heading)) return list;
    const labels = [...list.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map(m => plain(m[1]));
    const places = labels.map(location);
    const isDirectory = /(?:cities|communities|neighborhoods|locations|areas|municipalities)\s+(?:we\s+)?(?:serve|serving|covered)|serving\s+.+(?:county|NY|NJ|PA)|(?:accident|injury|slip and fall)\s+(?:help|lawyers?)\s+in\s/i.test(heading);
    const multipleLocations = places.length > 1 && places.every(Boolean) && new Set(places).size === places.length;
    if (!isDirectory && !multipleLocations) return list;
    return list.replace(/(<li\b[^>]*>)([\s\S]*?)(<\/li>)/gi, (item: string, open: string, inner: string, close: string) => {
      const current = plain(inner), label = location(current);
      if (!label || /<(?:ul|ol|p)\b/i.test(inner)) return item;
      // Simple text or a single linked label, optionally wrapped in emphasis.
      if ((inner.match(/<a\b/gi) || []).length > 1) return item;
      const textParts = inner.split(/(<[^>]+>|<!--[^]*?-->)/g);
      const nonempty = textParts.map((s: string, i: number) => !s.startsWith("<") && s.trim() ? i : -1).filter((i: number) => i >= 0);
      if (nonempty.length !== 1) return item;
      textParts[nonempty[0]] = label;
      changed++;
      return open + textParts.join("") + close;
    });
  });
  return { content: normalized, changed };
}

function locationFromTruckGeoUrl(value: string) {
  try {
    const url = new URL(decodedAttribute(value), "https://example.com");
    const slug = decodeURIComponent(url.pathname).split("/").filter(Boolean).at(-1) || "";
    const location = slug.match(/^(.+?)-truck-accident-lawyers?$/i)?.[1] || "";
    if (!location) return "";
    return location
      .split("-")
      .filter(Boolean)
      .map((part, index) => index > 0 && ["of", "the"].includes(part.toLowerCase())
        ? part.toLowerCase()
        : `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
      .join(" ");
  } catch {
    return "";
  }
}

function locationFromPersonalInjuryGeoUrl(value: string) {
  try {
    const url = new URL(decodedAttribute(value), "https://example.com");
    const slug = decodeURIComponent(url.pathname).split("/").filter(Boolean).at(-1) || "";
    const location = slug.match(/^(.+?)-personal-injury-lawyers?$/i)?.[1] || "";
    if (!location) return "";
    return location
      .split("-")
      .filter(Boolean)
      .map((part, index) => index > 0 && ["of", "the"].includes(part.toLowerCase())
        ? part.toLowerCase()
        : `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
      .join(" ");
  } catch {
    return "";
  }
}

const truckGeoAnchorPattern = /<a\b([^>]*\bhref\s*=\s*(["'])(.*?)\2[^>]*)>([\s\S]*?)<\/a>/gi;
const personalInjuryGeoAnchorPattern = /<a\b([^>]*\bhref\s*=\s*(["'])(.*?)\2[^>]*)>([\s\S]*?)<\/a>/gi;

function normalizedTruckAnchor(anchor: string, attributes: string, href: string) {
  const label = locationFromTruckGeoUrl(href);
  if (!label) return null;
  const currentLabel = anchor.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return { label, currentLabel, html: `<a${attributes}>${label}</a>` };
}

const listPattern = /<ul\b[^>]*>[\s\S]*?<\/ul>/gi;

function followsTruckDirectoryIntroduction(content: string, listStart: number) {
  const preceding = content
    .slice(Math.max(0, listStart - 800), listStart)
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return /Other\s+areas\s+where\s+we\s+handle\s+Truck\s+Accidents?\s*:?\s*$/i.test(preceding);
}

function followsPersonalInjuryDirectoryIntroduction(content: string, listStart: number) {
  const preceding = content
    .slice(Math.max(0, listStart - 800), listStart)
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return /Other\s+areas\s+where\s+we\s+handle\s+Personal\s+Injury\s*:?\s*$/i.test(preceding)
    || /Cities\s+We\s+Serve\s*:?\s*$/i.test(preceding);
}

export function normalizeTruckGeoDirectoryAnchors(content: string) {
  let changed = 0;
  const normalized = content.replace(listPattern, (list, offset: number, source: string) => {
    if (!followsTruckDirectoryIntroduction(source, offset)) return list;
    return list.replace(truckGeoAnchorPattern,
      (anchor, attributes: string, _quote: string, href: string) => {
        const normalizedAnchor = normalizedTruckAnchor(anchor, attributes, href);
        if (!normalizedAnchor || normalizedAnchor.currentLabel === normalizedAnchor.label) return anchor;
        changed += 1;
        return normalizedAnchor.html;
      });
  });
  return { content: normalized, changed };
}

export function normalizePersonalInjuryGeoDirectoryAnchors(content: string) {
  let changed = 0;
  const normalized = content.replace(listPattern, (list, offset: number, source: string) => {
    if (!followsPersonalInjuryDirectoryIntroduction(source, offset)) return list;
    return list.replace(personalInjuryGeoAnchorPattern,
      (anchor, attributes: string, _quote: string, href: string) => {
        const label = locationFromPersonalInjuryGeoUrl(href);
        if (!label) return anchor;
        const currentLabel = anchor.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        if (currentLabel === label) return anchor;
        changed += 1;
        return `<a${attributes}>${label}</a>`;
      });
  });
  return { content: normalized, changed };
}

export function normalizeFulginitiGeoDirectoryAnchors(content: string) {
  const truck = normalizeTruckGeoDirectoryAnchors(content);
  const personalInjury = normalizePersonalInjuryGeoDirectoryAnchors(truck.content);
  return { content: personalInjury.content, changed: truck.changed + personalInjury.changed };
}

export function normalizeAllTruckGeoLinkAnchors(content: string) {
  let changed = 0;
  const normalized = content.replace(truckGeoAnchorPattern,
    (anchor, attributes: string, _quote: string, href: string) => {
      const normalizedAnchor = normalizedTruckAnchor(anchor, attributes, href);
      if (!normalizedAnchor || normalizedAnchor.currentLabel === normalizedAnchor.label) return anchor;
      changed += 1;
      return normalizedAnchor.html;
    });
  return { content: normalized, changed };
}

export function allTruckGeoLinkAnchorLabels(content: string) {
  const labels: string[] = [];
  for (const anchor of content.matchAll(truckGeoAnchorPattern)) {
    const normalizedAnchor = normalizedTruckAnchor(anchor[0], anchor[1], anchor[3]);
    if (normalizedAnchor) labels.push(normalizedAnchor.currentLabel);
  }
  return labels;
}

export function truckGeoDirectoryAnchorLabels(content: string) {
  const labels: string[] = [];
  for (const list of content.matchAll(listPattern)) {
    if (list.index === undefined || !followsTruckDirectoryIntroduction(content, list.index)) continue;
    for (const anchor of list[0].matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)) {
      labels.push(anchor[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    }
  }
  return labels;
}

export function personalInjuryGeoDirectoryAnchorLabels(content: string) {
  const labels: string[] = [];
  for (const list of content.matchAll(listPattern)) {
    if (list.index === undefined || !followsPersonalInjuryDirectoryIntroduction(content, list.index)) continue;
    for (const anchor of list[0].matchAll(personalInjuryGeoAnchorPattern)) {
      if (!locationFromPersonalInjuryGeoUrl(anchor[3])) continue;
      labels.push(anchor[4].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    }
  }
  return labels;
}
