import sanitizeHtml from "sanitize-html";

export const AMPLIFY_FAQ_STANDARD_VERSION = "v1";
export const AMPLIFY_FAQ_COUNT = 10;

export const AMPLIFY_FAQ_PROMPT = String.raw`
GLOBAL AMPLIFY FAQ STANDARD — REQUIRED

- Make the visible FAQ section the final substantive section before Sources. Use a concise, page-specific H2 that includes "FAQs" in English or "Preguntas frecuentes" in Spanish, such as "New York E-Bike Accident FAQs: Medical Care, Insurance, and Claims." Do not use a generic heading when the topic and jurisdiction can be stated naturally.
- Add one short introductory paragraph below the FAQ H2 explaining that the answers are general information and that facts, jurisdiction, and available evidence can change the analysis.
- Include exactly 10 distinct H3 questions. Every question must end in a question mark and sound like something a prospective client would naturally ask a search engine or LLM. Select questions from verified search demand, supplied reader questions, official consumer FAQs, the existing page when applicable, and meaningful topic gaps. Never claim that people ask a question unless that demand was actually observed.
- Cover the decisions and uncertainties that matter for this exact topic and jurisdiction. Useful categories can include eligibility, responsibility, immediate steps, evidence, insurance or benefits, deadlines, partial fault, damages, delayed symptoms or medical records, and what contacting the firm involves—but include only categories that genuinely fit.
- Start every answer with a direct, self-contained answer. Follow with a second short paragraph that explains the practical consequence, next step, important limitation, or evidence issue. Normally use exactly two concise explanatory paragraphs and approximately 90 to 170 words before the source line.
- End every answer with its own visible source line in this format: "Sources: [descriptive source title](direct URL); [descriptive source title](direct URL)." Use "Fuentes:" on a Spanish page. Include two to four sources actually used for that answer.
- Use current primary law for legal rules: statutes, regulations, official courts, court rules, and government agencies. Use official health sources and peer-reviewed medical journals for medical or safety claims when relevant. Do not cite competing law firms, content farms, AI summaries, search-result pages, or a general home page when a direct source exists.
- Verify each source URL, title, jurisdiction, publication or effective date, and the specific proposition it supports. Explain important study limits. Never turn an association into causation or a medical source into a diagnosis.
- Keep every answer page-specific, jurisdiction-specific where the law differs, and materially different from the other nine answers. Do not copy body text into the FAQ or repeat the same rule under several questions.
- Do not give individualized legal or medical advice, guarantee an outcome, invent a universal settlement value, fabricate a reviewer or source, or treat an administrative finding as conclusive civil liability.
- Keep all FAQ text and source links server-rendered and visible. Do not write hidden FAQ text or raw JSON-LD. The publishing workflow creates one FAQPage graph from these exact visible questions, answers, and citations.
- Write the FAQ heading, questions, answers, and source labels in the page's language. Preserve official source titles accurately when translating their descriptions.
`;

export type AmplifyFaqEntry = {
  question: string;
  questionId: string;
  answerId: string;
  questionIdPresent: boolean;
  answerIdPresent: boolean;
  answerHtml: string;
  answerText: string;
  explanatoryParagraphs: string[];
  sourceUrls: string[];
  sourceLabels: string[];
  sourceLabel: "Sources" | "Fuentes" | "";
  sourceLineIsLast: boolean;
  hasUnexpectedAnswerContent: boolean;
};

export type AmplifyFaqSection = {
  heading: string;
  inLanguage: "en-US" | "es-US";
  introText: string;
  introParagraphCount: number;
  entries: AmplifyFaqEntry[];
};

export type AmplifyFaqValidation = {
  passed: boolean;
  count: number;
  errors: string[];
};

const ENGLISH_FAQ_HEADING = /\b(?:frequently asked questions|faqs?)\b/i;
const SPANISH_FAQ_HEADING = /\bpreguntas frecuentes\b/i;
const SOURCE_LABEL = /^(?:sources?|fuentes)\s*:/i;
const ENGLISH_SOURCE_LABEL = /^sources\s*:/i;
const SPANISH_SOURCE_LABEL = /^fuentes\s*:/i;
const GENERIC_SOURCE_LABEL = /^(?:source|official source|link|here|click here|read more|website|fuente|fuente oficial|enlace|aqui|aquí|sitio web)$/i;
const PROHIBITED_SOURCE_HOSTS = [
  "chatgpt.com",
  "claude.ai",
  "gemini.google.com",
  "perplexity.ai",
  "copilot.microsoft.com",
];

function textOnly(value: string) {
  // Block boundaries render as whitespace even when serialized without newlines.
  return sanitizeHtml(value.replace(/<\/(?:p|div|li|h[1-6]|ul|ol|blockquote)>|<br\s*\/?>/gi, "$& "), { allowedTags: [], allowedAttributes: {} })
    .replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (_entity, code: string) => {
      const normalized = code.toLowerCase();
      if (normalized.startsWith("#x")) return String.fromCodePoint(Number.parseInt(normalized.slice(2), 16));
      if (normalized.startsWith("#")) return String.fromCodePoint(Number.parseInt(normalized.slice(1), 10));
      return ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " } as Record<string, string>)[normalized] || _entity;
    })
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizedHeading(value: string) {
  return textOnly(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[¿?¡!:.]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isFaqHeading(value: string) {
  const heading = normalizedHeading(value);
  return ENGLISH_FAQ_HEADING.test(heading) || SPANISH_FAQ_HEADING.test(heading);
}

function isSpanishFaqHeading(value: string) {
  return SPANISH_FAQ_HEADING.test(normalizedHeading(value));
}

function isGenericFaqHeading(value: string) {
  return /^(?:faq|faqs|frequently asked questions|preguntas frecuentes)$/i.test(normalizedHeading(value));
}

function stableId(value: string, fallback: string) {
  const id = textOnly(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return id || fallback;
}

function attributeValue(attributes: string, name: string) {
  const match = attributes.match(new RegExp(`(?:^|\\s)${name}\\s*=(['"])(.*?)\\1`, "i"));
  return match?.[2]?.trim() || "";
}

function withAttribute(attributes: string, name: string, value: string) {
  const pattern = new RegExp(`(^|\\s)${name}\\s*=(['"])(.*?)\\2`, "i");
  if (pattern.test(attributes)) {
    return attributes.replace(pattern, (_match, prefix: string) => `${prefix}${name}="${value}"`);
  }
  return `${attributes} ${name}="${value}"`;
}

function withClass(attributes: string, className: string) {
  const current = attributeValue(attributes, "class");
  const classes = new Set(`${current} ${className}`.split(/\s+/).filter(Boolean));
  return withAttribute(attributes, "class", [...classes].join(" "));
}

function canonicalUrl(value: string) {
  try {
    const url = new URL(value.replace(/&amp;/gi, "&").replace(/&#0*38;/g, "&").replace(/&#x0*26;/gi, "&"));
    if (url.protocol !== "https:") return "";
    return url.toString();
  } catch {
    return "";
  }
}

function comparablePageUrl(value: string) {
  const canonical = canonicalUrl(value);
  if (!canonical) return "";
  const url = new URL(canonical);
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

export function isLikelyAuthoritativeFaqSource(value: string) {
  const canonical = canonicalUrl(value);
  if (!canonical) return false;
  const hostname = new URL(canonical).hostname.toLowerCase().replace(/^www\./, "");
  if (
    hostname.endsWith(".gov")
    || hostname.endsWith(".mil")
    || hostname.endsWith(".edu")
    || hostname.endsWith(".ac.uk")
    || /(?:^|\.)state\.[a-z]{2}\.us$/.test(hostname)
    || hostname === "gov.uk"
    || hostname.endsWith(".gov.uk")
    || hostname.endsWith(".gov.au")
    || hostname === "canada.ca"
    || hostname.endsWith(".canada.ca")
    || hostname === "gc.ca"
    || hostname.endsWith(".gc.ca")
  ) return true;
  return [
    // Pennsylvania's official Unified Judicial System uses .us, not .gov.
    "pacourts.us",
    "doi.org",
    "pubmed.ncbi.nlm.nih.gov",
    "ncbi.nlm.nih.gov",
    "jamanetwork.com",
    "nejm.org",
    "bmj.com",
    "thelancet.com",
    "nature.com",
    "sciencedirect.com",
    "springer.com",
    "wiley.com",
  ].some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

function isProhibitedFaqSource(value: string, clientWebsite?: string) {
  const canonical = canonicalUrl(value);
  if (!canonical) return false;
  const url = new URL(canonical);
  url.hash = "";
  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  const clientUrl = clientWebsite ? canonicalUrl(clientWebsite) : "";
  const clientHost = clientUrl ? new URL(clientUrl).hostname.toLowerCase().replace(/^www\./, "") : "";
  if (PROHIBITED_SOURCE_HOSTS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))) return true;
  if (
    !isLikelyAuthoritativeFaqSource(canonical)
    && hostname !== clientHost
    && hostname.split(".").some((label) => /(?:law|legal|attorney|lawyer)/i.test(label))
  ) return true;
  if (
    (hostname === "google.com" || hostname.endsWith(".google.com")) && url.pathname.startsWith("/search")
    || (hostname === "bing.com" || hostname.endsWith(".bing.com")) && url.pathname.startsWith("/search")
    || (hostname === "search.yahoo.com" || hostname.endsWith(".search.yahoo.com"))
    || (hostname === "duckduckgo.com" || hostname.endsWith(".duckduckgo.com")) && Boolean(url.searchParams.get("q"))
  ) return true;
  return false;
}

function comparableSourceUrl(value: string) {
  const canonical = canonicalUrl(value);
  if (!canonical) return "";
  const url = new URL(canonical);
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (/^(?:utm_|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key);
  }
  return url.toString().replace(/\/$/, "");
}

// Only normalize generated, not yet approved copy. Leave prose and malformed
// source blocks untouched so validation can report them instead of losing text.
export function deduplicateGeneratedFaqSources(markdown: string) {
  const headings = [...markdown.matchAll(/^##\s+(.+?)\s*$/gm)];
  let result = markdown;
  for (let index = headings.length - 1; index >= 0; index--) {
    if (!isFaqHeading(headings[index][1])) continue;
    const start = (headings[index].index || 0) + headings[index][0].length;
    const end = headings[index + 1]?.index ?? markdown.length;
    const section = markdown.slice(start, end).replace(/^.*$/gm, (line) => {
      const prefix = line.match(/^\s*(?:\*\*)?(?:Sources|Fuentes):(?:\*\*)?\s*/i);
      if (!prefix) return line;
      const body = line.slice(prefix[0].length);
      const pattern = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/gi;
      const links = [...body.matchAll(pattern)];
      if (!links.length || body.replace(pattern, "").replace(/[\s;,|·.]/g, "")) return line;
      const seen = new Set<string>();
      const unique = links.filter((link) => {
        const key = comparableSourceUrl(link[2]);
        if (!key) return true;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      return unique.length === links.length ? line : prefix[0] + unique.map((link) => link[0]).join("; ");
    });
    result = result.slice(0, start) + section + result.slice(end);
  }
  return result;
}

function sourceErrors(sourceLinks: Array<{ label: string; url: string }>, answerLabel: string, clientWebsite?: string) {
  const errors: string[] = [];
  const sourceUrls = sourceLinks.map((source) => source.url);
  const unique = new Set(sourceUrls.map(comparableSourceUrl));
  if (sourceUrls.length < 2 || sourceUrls.length > 4) {
    errors.push(`${answerLabel} must cite two to four direct sources in its own Sources/Fuentes line.`);
  }
  if (unique.size !== sourceUrls.length) errors.push(`${answerLabel} repeats a source URL.`);
  if (sourceUrls.some((url) => !canonicalUrl(url))) errors.push(`${answerLabel} contains a source URL that is invalid or not HTTPS.`);
  if (sourceUrls.some((url) => isProhibitedFaqSource(url, clientWebsite))) errors.push(`${answerLabel} cites a prohibited source (a competing legal website, search engine, or AI-answer service) instead of an allowed direct source.`);
  if (sourceUrls.some((url) => {
    const canonical = canonicalUrl(url);
    return canonical ? new URL(canonical).pathname === "/" : false;
  })) errors.push(`${answerLabel} cites an undifferentiated home page instead of a direct source.`);
  if (sourceLinks.some((source) => source.label.trim().length < 6 || GENERIC_SOURCE_LABEL.test(source.label.trim()))) {
    errors.push(`${answerLabel} must use descriptive source titles.`);
  }
  if (!sourceUrls.some(isLikelyAuthoritativeFaqSource)) {
    errors.push(`${answerLabel} needs at least one recognizable government, court, academic, or peer-reviewed source.`);
  }
  return errors;
}

function markdownPlainText(value: string) {
  return value
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`>#-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function validateAmplifyFaqMarkdown(markdown: string, clientWebsite?: string): AmplifyFaqValidation {
  const h2s = [...markdown.matchAll(/^##\s+(.+?)\s*$/gm)];
  const faqHeadingIndexes = h2s
    .map((heading, index) => isFaqHeading(heading[1]) ? index : -1)
    .filter((index) => index >= 0);
  const faqHeadingIndex = faqHeadingIndexes[0] ?? -1;
  if (faqHeadingIndex < 0) {
    return { passed: false, count: 0, errors: ["The draft is missing its Frequently Asked Questions/Preguntas frecuentes H2."] };
  }
  const faqHeading = h2s[faqHeadingIndex];
  const spanish = isSpanishFaqHeading(faqHeading[1]);
  const start = (faqHeading.index || 0) + faqHeading[0].length;
  const end = h2s[faqHeadingIndex + 1]?.index ?? markdown.length;
  const section = markdown.slice(start, end);
  const questions = [...section.matchAll(/^###\s+(.+?)\s*$/gm)];
  const errors: string[] = [];
  if (faqHeadingIndexes.length !== 1) {
    errors.push(`The page must contain exactly one localized FAQ H2; found ${faqHeadingIndexes.length}.`);
  }
  const nextHeading = h2s[faqHeadingIndex + 1]?.[1] || "";
  const expectedAppendixHeading = spanish ? /^fuentes$/i : /^sources$/i;
  if (nextHeading && !expectedAppendixHeading.test(normalizedHeading(nextHeading))) {
    errors.push(`The FAQ must be the final substantive section before the ${spanish ? "Fuentes" : "Sources"} appendix.`);
  }
  if (isGenericFaqHeading(faqHeading[1])) {
    errors.push("The FAQ H2 must describe this page’s topic or jurisdiction, not use a generic FAQ label alone.");
  }
  const introBlocks = section.slice(0, questions[0]?.index ?? section.length)
    .trim()
    .split(/\n\s*\n/)
    .map((block) => markdownPlainText(block))
    .filter(Boolean);
  if (introBlocks.length !== 1 || introBlocks[0].length < 60) {
    errors.push("The FAQ H2 must be followed by one short general-information introduction before the first question.");
  }
  if (questions.length !== AMPLIFY_FAQ_COUNT) {
    errors.push(`The FAQ section must contain exactly ${AMPLIFY_FAQ_COUNT} H3 questions; found ${questions.length}.`);
  }
  const seen = new Set<string>();
  questions.forEach((question, index) => {
    const name = markdownPlainText(question[1]);
    const label = `FAQ ${index + 1} (“${name || "untitled"}”)`;
    const normalized = normalizedHeading(name).toLowerCase();
    if (!name.endsWith("?")) errors.push(`${label} must end in a question mark.`);
    if (seen.has(normalized)) errors.push(`${label} duplicates another FAQ question.`);
    seen.add(normalized);
    const answerStart = (question.index || 0) + question[0].length;
    const answerEnd = questions[index + 1]?.index ?? section.length;
    const blocks = section.slice(answerStart, answerEnd).trim().split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);
    const sourceIndex = blocks.findIndex((block) => SOURCE_LABEL.test(markdownPlainText(block)));
    const explanatoryBlocks = sourceIndex >= 0 ? blocks.slice(0, sourceIndex) : blocks;
    const answerText = markdownPlainText(explanatoryBlocks.join(" "));
    if (explanatoryBlocks.length !== 2) errors.push(`${label} needs exactly two short explanatory paragraphs before its source line.`);
    if (answerText.length < 180) errors.push(`${label} is too short to provide a useful direct answer and practical explanation.`);
    if (sourceIndex < 0) {
      errors.push(`${label} is missing its own visible Sources:/Fuentes: line.`);
      return;
    }
    if (sourceIndex !== blocks.length - 1) errors.push(`${label} must end with its Sources:/Fuentes: line.`);
    const visibleSourceLine = markdownPlainText(blocks[sourceIndex]);
    const expectedSourceLabel = spanish ? SPANISH_SOURCE_LABEL : ENGLISH_SOURCE_LABEL;
    if (!expectedSourceLabel.test(visibleSourceLine)) {
      errors.push(`${label} must use the ${spanish ? "Fuentes:" : "Sources:"} label for the page language.`);
    }
    const sourceLinks = [...blocks[sourceIndex].matchAll(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/gi)]
      .map((match) => ({ label: markdownPlainText(match[1]), url: match[2] }));
    errors.push(...sourceErrors(sourceLinks, label, clientWebsite));
  });
  return { passed: errors.length === 0, count: questions.length, errors };
}

function faqSectionBounds(content: string) {
  const headings = [...content.matchAll(/<h2\b([^>]*)>([\s\S]*?)<\/h2>/gi)];
  const faqIndex = headings.findIndex((heading) => isFaqHeading(heading[2]));
  if (faqIndex < 0) return null;
  const heading = headings[faqIndex];
  const headingStart = heading.index || 0;
  const sectionStart = headingStart + heading[0].length;
  const nextHeading = headings[faqIndex + 1]?.index ?? content.length;
  // A following CTA is a separate section, including its eyebrow before its H2.
  const followingCta = /<section\b[^>]*\bclass=(['"])[^'"]*\bamplify-geo-cta\b[^'"]*\1/i.exec(content.slice(sectionStart));
  const sectionEnd = Math.min(nextHeading, followingCta ? sectionStart + followingCta.index : content.length);
  return { heading, headingStart, sectionStart, sectionEnd };
}

// Preserve the approved article byte-for-byte outside its existing FAQ section.
export function replacePreparationFaq(content: string, replacement: string) {
  const bounds = faqSectionBounds(content);
  const headings = [...content.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)]
    .filter(heading => isFaqHeading(heading[1]));
  if (!bounds || headings.length !== 1) throw new Error("FAQ preparation requires one identifiable existing FAQ section.");
  return content.slice(0, bounds.headingStart) + replacement + content.slice(bounds.sectionEnd);
}

export function extractAmplifyFaqSection(content: string): AmplifyFaqSection | null {
  const bounds = faqSectionBounds(content);
  if (!bounds) return null;
  const section = content.slice(bounds.sectionStart, bounds.sectionEnd);
  const questions = [...section.matchAll(/<h3\b([^>]*)>([\s\S]*?)<\/h3>/gi)];
  const heading = textOnly(bounds.heading[2]);
  const inLanguage = isSpanishFaqHeading(heading) ? "es-US" : "en-US";
  const introHtml = section.slice(0, questions[0]?.index ?? section.length).replace(/<!--[\s\S]*?-->/g, "");
  const introParagraphs = [...introHtml.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((paragraph) => textOnly(paragraph[1]))
    .filter(Boolean);
  const usedIds = new Set<string>();
  const entries = questions.map((question, index) => {
    const name = textOnly(question[2]);
    let idBase = stableId(name, `question-${index + 1}`);
    if (usedIds.has(idBase)) idBase = `${idBase}-${index + 1}`;
    usedIds.add(idBase);
    const nestedAnchor = question[2].match(/<span\b([^>]*data-amplify-faq-anchor[^>]*)>/i);
    const nestedId = nestedAnchor ? attributeValue(nestedAnchor[1], "id") : "";
    const questionId = nestedId || attributeValue(question[1], "id") || `faq-${idBase}`;
    const answerStart = (question.index || 0) + question[0].length;
    const answerEnd = questions[index + 1]?.index ?? section.length;
    const rawAnswer = section.slice(answerStart, answerEnd).replace(/<!--[\s\S]*?-->/g, "");
    const answerHtml = sanitizeHtml(rawAnswer, {
      allowedTags: ["p", "br", "strong", "b", "em", "i", "u", "ul", "ol", "li", "a"],
      allowedAttributes: { a: ["href", "title"], p: ["id", "class"] },
      allowedSchemes: ["http", "https"],
    }).trim();
    const paragraphs = [...answerHtml.matchAll(/<p\b([^>]*)>([\s\S]*?)<\/p>/gi)];
    const sourceParagraphIndex = paragraphs.findIndex((paragraph) => SOURCE_LABEL.test(textOnly(paragraph[2])));
    const explanatoryParagraphs = (sourceParagraphIndex >= 0 ? paragraphs.slice(0, sourceParagraphIndex) : paragraphs)
      .map((paragraph) => textOnly(paragraph[2]))
      .filter(Boolean);
    const sourceHtml = sourceParagraphIndex >= 0 ? paragraphs[sourceParagraphIndex][2] : "";
    const sourceLinks = [...sourceHtml.matchAll(/<a\b[^>]*\bhref=(['"])(https?:\/\/.*?)\1[^>]*>([\s\S]*?)<\/a>/gi)]
      .map((match) => ({ label: textOnly(match[3]), url: canonicalUrl(match[2]) }))
      .filter((source) => Boolean(source.url));
    const firstParagraphId = paragraphs[0] ? attributeValue(paragraphs[0][1], "id") : "";
    const sourceParagraph = sourceParagraphIndex >= 0 ? paragraphs[sourceParagraphIndex] : undefined;
    const trailingHtml = sourceParagraph?.index === undefined
      ? answerHtml
      : answerHtml.slice(sourceParagraph.index + sourceParagraph[0].length);
    const paragraphOnlyRemainder = answerHtml.replace(/<p\b[^>]*>[\s\S]*?<\/p>/gi, "");
    const visibleSourceLabel = sourceParagraph ? textOnly(sourceParagraph[2]) : "";
    const sourceLabel: AmplifyFaqEntry["sourceLabel"] = ENGLISH_SOURCE_LABEL.test(visibleSourceLabel)
      ? "Sources"
      : SPANISH_SOURCE_LABEL.test(visibleSourceLabel)
        ? "Fuentes"
        : "";
    return {
      question: name,
      questionId,
      answerId: firstParagraphId || `answer-${idBase}`,
      questionIdPresent: Boolean(nestedId || attributeValue(question[1], "id")),
      answerIdPresent: Boolean(firstParagraphId),
      answerHtml,
      answerText: textOnly(answerHtml),
      explanatoryParagraphs,
      sourceUrls: sourceLinks.map((source) => source.url),
      sourceLabels: sourceLinks.map((source) => source.label),
      sourceLabel,
      sourceLineIsLast: sourceParagraphIndex === paragraphs.length - 1 && textOnly(trailingHtml) === "",
      hasUnexpectedAnswerContent: textOnly(paragraphOnlyRemainder) !== "",
    };
  });
  return {
    heading,
    inLanguage,
    introText: introParagraphs.join(" "),
    introParagraphCount: introParagraphs.length,
    entries,
  };
}

export function validateAmplifyFaqHtml(content: string, clientWebsite?: string): AmplifyFaqValidation {
  const section = extractAmplifyFaqSection(content);
  if (!section) {
    return { passed: false, count: 0, errors: ["The content is missing its Frequently Asked Questions/Preguntas frecuentes H2."] };
  }
  const errors: string[] = [];
  const faqHeadingCount = [...content.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)]
    .filter((heading) => isFaqHeading(heading[1])).length;
  if (faqHeadingCount !== 1) errors.push(`The page must contain exactly one localized FAQ H2; found ${faqHeadingCount}.`);
  if (isGenericFaqHeading(section.heading)) {
    errors.push("The FAQ H2 must describe this page’s topic or jurisdiction, not use a generic FAQ label alone.");
  }
  if (section.introParagraphCount !== 1 || section.introText.length < 60) {
    errors.push("The FAQ H2 must be followed by one short general-information introduction before the first question.");
  }
  if (section.entries.length !== AMPLIFY_FAQ_COUNT) {
    errors.push(`The FAQ section must contain exactly ${AMPLIFY_FAQ_COUNT} H3 questions; found ${section.entries.length}.`);
  }
  const seen = new Set<string>();
  section.entries.forEach((entry, index) => {
    const label = `FAQ ${index + 1} (“${entry.question || "untitled"}”)`;
    const normalized = normalizedHeading(entry.question).toLowerCase();
    if (!entry.question.endsWith("?")) errors.push(`${label} must end in a question mark.`);
    if (seen.has(normalized)) errors.push(`${label} duplicates another FAQ question.`);
    seen.add(normalized);
    if (entry.explanatoryParagraphs.length !== 2) errors.push(`${label} needs exactly two short explanatory paragraphs before its source line.`);
    if (entry.explanatoryParagraphs.join(" ").length < 180) {
      errors.push(`${label} is too short to provide a useful direct answer and practical explanation.`);
    }
    const expectedSourceLabel = section.inLanguage === "es-US" ? "Fuentes" : "Sources";
    if (entry.sourceLabel !== expectedSourceLabel) {
      errors.push(`${label} must use the ${expectedSourceLabel}: label for the page language.`);
    }
    if (!entry.sourceLineIsLast) errors.push(`${label} must end with its Sources:/Fuentes: line.`);
    if (entry.hasUnexpectedAnswerContent) errors.push(`${label} may contain only two explanatory paragraphs followed by its source paragraph.`);
    errors.push(...sourceErrors(entry.sourceUrls.map((url, sourceIndex) => ({
      label: entry.sourceLabels[sourceIndex] || "",
      url,
    })), label, clientWebsite));
  });
  return { passed: errors.length === 0, count: section.entries.length, errors };
}

export function assertAmplifyFaqHtml(content: string, clientWebsite?: string) {
  const validation = validateAmplifyFaqHtml(content, clientWebsite);
  if (!validation.passed) {
    throw new Error(`AMPLIFY FAQ Standard ${AMPLIFY_FAQ_STANDARD_VERSION} failed: ${validation.errors.slice(0, 4).join(" ")}`);
  }
  return validation;
}

export function addAmplifyFaqAnchors(content: string) {
  const bounds = faqSectionBounds(content);
  if (!bounds) return content;
  const section = content.slice(bounds.sectionStart, bounds.sectionEnd);
  const questions = [...section.matchAll(/<h3\b([^>]*)>([\s\S]*?)<\/h3>/gi)];
  const usedIds = new Set<string>();
  let rebuilt = section.slice(0, questions[0]?.index ?? section.length);
  questions.forEach((question, index) => {
    const name = textOnly(question[2]);
    let idBase = stableId(name, `question-${index + 1}`);
    if (usedIds.has(idBase)) idBase = `${idBase}-${index + 1}`;
    usedIds.add(idBase);
    const questionId = `faq-${idBase}`;
    const answerId = `answer-${idBase}`;
    const answerStart = (question.index || 0) + question[0].length;
    const answerEnd = questions[index + 1]?.index ?? section.length;
    const questionHtml = `<h3${withAttribute(question[1], "id", questionId)}>${question[2]}</h3>`;
    let answerHtml = section.slice(answerStart, answerEnd);
    answerHtml = answerHtml.replace(/<p\b([^>]*)>/i, (_opening, attributes: string) =>
      `<p${withAttribute(attributes, "id", answerId)}>`);
    answerHtml = answerHtml.replace(/<p\b([^>]*)>([\s\S]*?)<\/p>/gi, (paragraph, attributes: string, inner: string) =>
      SOURCE_LABEL.test(textOnly(inner)) ? `<p${withClass(attributes, "faq-sources")}>${inner}</p>` : paragraph);
    rebuilt += `${questionHtml}${answerHtml}`;
  });
  const faqHeading = bounds.heading[0].replace(/<h2\b([^>]*)>/i, (_opening, attributes: string) =>
    `<h2${withAttribute(attributes, "id", "faq")}>`);
  return `${content.slice(0, bounds.headingStart)}${faqHeading}${rebuilt}${content.slice(bounds.sectionEnd)}`;
}

function fragmentUrl(pageUrl: string, fragment: string) {
  try {
    const url = new URL(pageUrl);
    url.hash = fragment;
    return url.toString();
  } catch {
    return `${pageUrl.split("#")[0]}#${fragment}`;
  }
}

export function buildAmplifyFaqSchemaNode(content: string, pageUrl: string) {
  const section = extractAmplifyFaqSection(content);
  if (!section?.entries.length) return null;
  return {
    "@type": "FAQPage",
    "@id": fragmentUrl(pageUrl, "faq"),
    url: fragmentUrl(pageUrl, "faq"),
    inLanguage: section.inLanguage,
    mainEntity: section.entries.map((entry) => ({
      "@type": "Question",
      "@id": fragmentUrl(pageUrl, entry.questionId),
      url: fragmentUrl(pageUrl, entry.questionId),
      name: entry.question,
      acceptedAnswer: {
        "@type": "Answer",
        "@id": fragmentUrl(pageUrl, entry.answerId),
        url: fragmentUrl(pageUrl, entry.answerId),
        text: entry.answerHtml,
        citation: entry.sourceUrls,
      },
    })),
  };
}

function faqNodesFromValue(value: unknown): Array<Record<string, unknown>> {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(faqNodesFromValue);
  const record = value as Record<string, unknown>;
  const types = Array.isArray(record["@type"]) ? record["@type"] : [record["@type"]];
  const own = types.includes("FAQPage") ? [record] : [];
  const graph = Array.isArray(record["@graph"]) ? faqNodesFromValue(record["@graph"]) : [];
  return [...own, ...graph];
}

function schemaValuesFromDocument(documentHtml: string) {
  return [...documentHtml.matchAll(/<script\b[^>]*type=(['"])application\/ld\+json\1[^>]*>([\s\S]*?)<\/script>/gi)]
    .flatMap((script) => {
      try {
        return [JSON.parse(script[2]) as unknown];
      } catch {
        return [];
      }
    });
}

function schemaNodesOfType(value: unknown, type: string): Array<Record<string, unknown>> {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap((entry) => schemaNodesOfType(entry, type));
  const record = value as Record<string, unknown>;
  const types = Array.isArray(record["@type"]) ? record["@type"] : [record["@type"]];
  const own = types.includes(type) ? [record] : [];
  const graph = Array.isArray(record["@graph"]) ? schemaNodesOfType(record["@graph"], type) : [];
  return [...own, ...graph];
}

function hasSchemaType(value: unknown, type: string) {
  const types = Array.isArray(value) ? value : [value];
  return types.includes(type);
}

function sameCanonicalUrl(actual: unknown, expected: string) {
  const actualUrl = canonicalUrl(String(actual || ""));
  const expectedUrl = canonicalUrl(expected);
  return Boolean(actualUrl && expectedUrl && actualUrl === expectedUrl);
}

function canonicalLinksFromDocument(documentHtml: string) {
  return [...documentHtml.matchAll(/<link\b[^>]*>/gi)]
    .filter((tag) => attributeValue(tag[0], "rel").split(/\s+/).some((value) => value.toLowerCase() === "canonical"))
    .map((tag) => attributeValue(tag[0], "href"))
    .filter(Boolean);
}

export function faqSchemaNodesFromDocument(documentHtml: string) {
  return schemaValuesFromDocument(documentHtml).flatMap(faqNodesFromValue);
}

export function validateAmplifyLiveFaq(documentHtml: string, expectedPageUrl?: string): AmplifyFaqValidation {
  const visible = extractAmplifyFaqSection(documentHtml);
  const structural = validateAmplifyFaqHtml(documentHtml, expectedPageUrl);
  const errors = [...structural.errors];
  const canonicalLinks = canonicalLinksFromDocument(documentHtml);
  const pageUrl = expectedPageUrl || canonicalLinks[0] || "";
  const schemaNodes = faqSchemaNodesFromDocument(documentHtml);
  if (schemaNodes.length !== 1) errors.push(`The live page must expose exactly one FAQPage schema node; found ${schemaNodes.length}.`);
  const qaPageNodes = schemaValuesFromDocument(documentHtml).flatMap((value) => schemaNodesOfType(value, "QAPage"));
  if (qaPageNodes.length) errors.push(`The live page must not expose competing QAPage schema; found ${qaPageNodes.length}.`);
  const schemaNode = schemaNodes[0];
  if (schemaNode && visible) {
    const faqHeadingHtml = faqSectionBounds(documentHtml)?.heading[0] || "";
    const headingIds = [...faqHeadingHtml.matchAll(/\bid=["']([^"']+)["']/gi)].map(match => match[1]);
    if (!headingIds.some(id => sameCanonicalUrl(schemaNode["@id"], fragmentUrl(pageUrl, id)))) errors.push("The FAQPage @id does not match the visible FAQ anchor.");
    if (!sameCanonicalUrl(schemaNode.url, fragmentUrl(pageUrl, "faq"))) errors.push("The FAQPage url does not match the visible FAQ anchor.");
    if (schemaNode.inLanguage !== visible.inLanguage) errors.push("The FAQPage language does not match the visible FAQ language.");
  }
  const schemaEntries = Array.isArray(schemaNodes[0]?.mainEntity)
    ? schemaNodes[0].mainEntity as Array<Record<string, unknown>>
    : [];
  if (schemaEntries.length !== AMPLIFY_FAQ_COUNT) {
    errors.push(`The live FAQPage schema must contain exactly ${AMPLIFY_FAQ_COUNT} questions; found ${schemaEntries.length}.`);
  }
  if (visible && schemaEntries.length === visible.entries.length) {
    const faqBounds = faqSectionBounds(documentHtml);
    if (attributeValue(faqBounds?.heading[1] || "", "id") !== "faq" && !/<span\b[^>]*id=["']faq["'][^>]*data-amplify-faq-anchor/i.test(faqBounds?.heading[2] || "")) {
      errors.push("The visible FAQ heading is missing its stable #faq anchor.");
    }
    visible.entries.forEach((entry, index) => {
      const schemaEntry = schemaEntries[index] || {};
      const acceptedAnswer = schemaEntry.acceptedAnswer && typeof schemaEntry.acceptedAnswer === "object"
        ? schemaEntry.acceptedAnswer as Record<string, unknown>
        : {};
      if (!entry.questionIdPresent || !entry.answerIdPresent) {
        errors.push(`FAQ ${index + 1} is missing its stable visible question or answer anchor.`);
      }
      if (!hasSchemaType(schemaEntry["@type"], "Question")) errors.push(`FAQ ${index + 1} schema item is not a Question.`);
      if (!hasSchemaType(acceptedAnswer["@type"], "Answer")) errors.push(`FAQ ${index + 1} schema acceptedAnswer is not an Answer.`);
      if (!sameCanonicalUrl(schemaEntry["@id"], fragmentUrl(pageUrl, entry.questionId))) {
        errors.push(`FAQ ${index + 1} Question @id does not match its visible anchor.`);
      }
      if (!sameCanonicalUrl(schemaEntry.url, fragmentUrl(pageUrl, entry.questionId))) {
        errors.push(`FAQ ${index + 1} Question url does not match its visible anchor.`);
      }
      if (!sameCanonicalUrl(acceptedAnswer["@id"], fragmentUrl(pageUrl, entry.answerId))) {
        errors.push(`FAQ ${index + 1} Answer @id does not match its visible anchor.`);
      }
      if (!sameCanonicalUrl(acceptedAnswer.url, fragmentUrl(pageUrl, entry.answerId))) {
        errors.push(`FAQ ${index + 1} Answer url does not match its visible anchor.`);
      }
      if (textOnly(String(schemaEntry.name || "")) !== entry.question) {
        errors.push(`FAQ ${index + 1} schema question does not match the visible question.`);
      }
      if (textOnly(String(acceptedAnswer.text || "")) !== entry.answerText) {
        errors.push(`FAQ ${index + 1} schema answer does not match the visible answer.`);
      }
      const citations = Array.isArray(acceptedAnswer.citation)
        ? acceptedAnswer.citation.map(String).map(canonicalUrl).filter(Boolean)
        : [];
      if (JSON.stringify(citations) !== JSON.stringify(entry.sourceUrls)) {
        errors.push(`FAQ ${index + 1} schema citations do not match the visible source links.`);
      }
    });
  }
  if (expectedPageUrl) {
    if (canonicalLinks.length !== 1 || comparablePageUrl(canonicalLinks[0]) !== comparablePageUrl(expectedPageUrl)) {
      errors.push("The live canonical URL does not match the published page URL.");
    }
    const robotsTags = [...documentHtml.matchAll(/<meta\b[^>]*>/gi)]
      .filter((tag) => /^(?:robots|googlebot|bingbot)$/i.test(attributeValue(tag[0], "name")));
    const noindex = robotsTags.some((tag) => /(?:^|[\s,])noindex(?:$|[\s,])/i.test(attributeValue(tag[0], "content")));
    if (noindex) errors.push("The live page is marked noindex.");
  }
  return { passed: errors.length === 0, count: visible?.entries.length || 0, errors };
}
