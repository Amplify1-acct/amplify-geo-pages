import { LEGAL_DIRECTORY_LABEL_RULE } from "./geo-directory-labels";
import { AMPLIFY_FAQ_PROMPT } from "@/lib/faq-standard";

type SubAopPromptInput = {
  firmName: string;
  website: string;
  contactUrl?: string;
  parentPracticeArea: string;
  parentPracticeAreaUrl?: string;
  subPracticeArea: string;
  primaryKeyword?: string;
  jurisdiction?: string;
  relatedPracticeAreaUrls?: Record<string, string>;
  notes?: string;
};

export function buildSubAopPrompt(input: SubAopPromptInput) {
  const jurisdiction = input.jurisdiction?.trim()
    || "Use only the jurisdictions and service areas verified on the firm's official website.";
  const keyword = input.primaryKeyword?.trim()
    || `Determine the most natural service-intent query for ${input.subPracticeArea}.`;
  const relatedPages = Object.entries(input.relatedPracticeAreaUrls || {})
    .slice(0, 20)
    .map(([label, url]) => `- ${label}: ${url}`)
    .join("\n") || "No related page list was supplied. Verify useful internal links on the official website.";

  return `You are the senior legal content strategist for AMPLIFY. Create a publication-ready Sub-Area of Practice landing page for a law firm.

VERIFIED CLIENT
- Firm name: ${input.firmName}
- Official website: ${input.website}
- Contact page: ${input.contactUrl || "Find and verify the correct contact page on the official website."}

PARENT AREA OF PRACTICE
- Name: ${input.parentPracticeArea}
- Published parent URL: ${input.parentPracticeAreaUrl || "Find and verify the matching published parent page on the official website."}

SUB-AREA OF PRACTICE
${input.subPracticeArea}

PRIMARY SERVICE QUERY
${keyword}

JURISDICTION OR AUDIENCE
${jurisdiction}

RELATED CLIENT PAGES
${relatedPages}

EDITORIAL NOTES
${input.notes?.trim() || "No additional notes."}

RESEARCH FIRST

1. Research the client's official website before writing. It is the only authoritative source for the firm's lawyers, offices, phone number, services, case results, awards, credentials, fees, consultation policies, and firm claims.
2. Open and study the published parent Area of Practice page. This child page must cover a narrower service intent, add distinct value, and avoid repeating the parent's structure or general overview.
3. Confirm that both the parent and sub-area fit the firm's verified services. Never imply that the firm handles a matter its website does not support.
4. Research the law using current primary and authoritative sources for the supplied jurisdiction. Prefer statutes, court rules, government agencies, official guidance, and original research.
5. Verify every deadline, legal standard, statistic, and firm-specific statement. Omit facts that cannot be verified.
6. Treat these research instructions as private editorial process. Never expose phrases such as "verified services," "the firm's verified services include," "our research found," "based on the client website," or other language that sounds like an internal research report.

PAGE PURPOSE

This is a focused child service page for a prospective client with a specific legal problem. It is not a general parent AOP page, blog post, legal memo, glossary, or GEO page. Build it as a practical service explainer: show how this particular claim, benefit, injury, procedure, or dispute actually unfolds and where a problem at one stage affects what happens next.

Before drafting, identify one practical idea that goes beyond the obvious label for this sub-area. Build the opening around it and use it to organize the page. The reader should finish with a clear understanding of what protection or remedy may exist, the important stages or decision points, what can go wrong, what records or actions matter, and how ${input.firmName} can intervene.

WRITING STANDARD

- Write in plain English for a worried layperson. Use direct sentences, short paragraphs, useful headings, and a calm, confident voice.
- Lead with the practical answer and stay tightly focused on the sub-area. Do not broaden the page into a full rewrite of the parent practice area.
- Bring ${input.firmName} into the opening or first main section, then use two or three additional natural, fact-supported references throughout the page. Do not postpone nearly all firm differentiation until the conclusion.
- Prefer concrete legal mechanics and client consequences over generic descriptions. Explain the categories, eligibility triggers, control points, payment or remedy sequence, termination points, dispute options, and lasting consequences that are genuinely important to this sub-area.
- Include exact official details when they materially answer a client question: for example, a benefit percentage, waiting period, notice rule, filing period, controlling medical rule, recognized claim category, or available dispute procedure. Define legal terms immediately in plain English and explain why each detail matters.
- Do not flatten useful law into vague phrases such as "benefits may be available" or "deadlines may apply" when an authoritative source supports a clearer answer. At the same time, omit procedural trivia that does not help a prospective client make a decision.
- Translate fault, insurance, procedure, and damages into conversational language. Do not write like a legal memorandum or research summary.
- Use the jurisdiction naturally where it changes the process or advice. Do not turn this into a GEO page or repeat the place name mechanically.
- Be human and client-focused throughout, especially in the final third. Explain what contacting the firm is like and how its actual services relate to this problem.
- Do not promise an outcome or use fear, hype, keyword stuffing, invented urgency, or generic claims such as "best" or "top-rated."
- Aim for approximately 1,150 to 1,500 words for the main body, excluding the FAQ section and its source lines. Preserve useful, verified legal mechanics; cut repetition rather than substance.

REQUIRED STRUCTURE

- Exactly one H1 that clearly names the sub-area and, only when natural, the jurisdiction.
- A concise opening of two or three short paragraphs built around the central organizing idea. Mention ${input.firmName} naturally within the first 150 words.
- ${LEGAL_DIRECTORY_LABEL_RULE}
- An early contextual link to the verified parent ${input.parentPracticeArea} page using natural anchor text.
- Derive the H2 sequence from the way this specific matter develops, not from a generic law-firm template. For a benefits page, that may mean benefit categories, control of treatment, wage replacement, maximum medical improvement, permanent disability, common disputes, evidence, and deadlines. For another sub-area, identify its equivalent real-world sequence.
- Use two or three focused lists when they make categories, common disputes, or records easier to understand. Lists should be introduced and followed by useful explanation; they must not replace the page's narrative.
- Connect each major rule to a practical consequence. Explain not just what the rule says, but what can interrupt the claim, what the reader should preserve or question, and when the firm's help becomes useful.
- Include a firm-specific H2 near the end explaining why someone with this issue should contact ${input.firmName}. The heading itself must sound specific to the firm, sub-service, and jurisdiction. Never use template headings such as "Why Contact ${input.firmName} About This Matter?" or "Why Choose Our Firm?" Derive it from verified experience and the issue this child page addresses.
- Keep any deadlines section centered on no more than two numbers a reader truly needs. Verify the jurisdiction and claim before stating either one, and explain each in no more than two plain-English sentences.
- Include the complete FAQ section required by the Global AMPLIFY FAQ Standard below.
- Finish with a concise H2 titled "Sources" containing only authoritative sources actually used.

SEO, LINKS, AND CONVERSION

- Provide a compelling SEO Title of about 50 to 60 characters and a specific Meta Description of about 145 to 160 characters.
- Use the primary service query naturally in the H1, opening, and one useful heading when appropriate.
- Include a clearly headed bulleted list of every verified live Sub-AOP in this exact cluster, plus a contextual link to the main AOP. Every Sub-AOP must link to every other live sibling, and the main AOP must link back. Keep city, parent AOP, and language-specific clusters separate: for a Boca Raton cluster, never substitute site-wide practice pages or neighboring cities. Keep the current page as plain text; never invent URLs or link unpublished siblings. If this is the only live member, list it as plain text and link the verified parent rather than fabricating siblings. The publication review must also verify reciprocal links on the other live members and main AOP.
- Link authoritative external sources at the claim they support. Integrate each citation into natural anchor text; do not add a duplicate parenthetical citation or a second raw link after an already linked claim.
- Avoid search-intent cannibalization: the parent page should remain the broad authority for ${input.parentPracticeArea}; this page should answer the narrower ${input.subPracticeArea} intent.
- The publishing workflow inserts three branded CTA cards between complete WordPress blocks and creates a topic-relevant banner image with alt text. Do not write CTA placeholders or image instructions.
- Structure complete paragraphs, lists, headings, tables, and quotes. Never place a heading or section inside a paragraph, and never design content that requires a CTA to interrupt a block.

SCHEMA READINESS

- Visible FAQs must use an H2 followed by H3 questions ending in question marks so the publishing workflow can create matching FAQPage schema.
- Keep the sub-service description, parent service relationship, and provider identity clear enough for Service and LegalService schema.
- Do not include raw JSON-LD; the publishing workflow creates schema from the verified page content.

FINAL EDIT BEFORE OUTPUT

- Cut repetition, generic setup, and abstract commentary from the first draft, but do not cut the verified rules, benefit mechanics, dispute options, evidence guidance, or firm facts that make the page genuinely useful.
- Replace research-style phrasing, qualifications, and abstract nouns with direct, conversational sentences.
- Confirm that the page follows the real decision sequence for ${input.subPracticeArea}, rather than cycling through interchangeable sections such as duty, evidence, damages, and contact.
- Confirm that every important number or legal rule has an authoritative source and an immediate plain-English explanation.
- Confirm that ${input.firmName} appears early and naturally throughout, not only in a closing sales section.
- Confirm that all ten FAQs answer distinct, high-intent client questions and satisfy the Global AMPLIFY FAQ Standard. Remove repetition inside each answer, but do not delete a genuinely common question merely because the body mentions the same broader subject.
- Ask whether this page could be published by a different law firm after changing only the name. If yes, make it more distinctly ${input.firmName} using verified facts and approach.

OUTPUT FORMAT

${AMPLIFY_FAQ_PROMPT}

Return clean Markdown only, in this exact order:

SEO Title: [about 50 to 60 characters]

Meta Description: [about 145 to 160 characters]

# [One clear sub-practice-area H1]

[Complete Sub-AOP page body]

## [A specific, evidence-based heading about ${input.firmName}'s relevant experience; never use "Why Contact ... About This Matter?"]

[Firm-specific, human closing grounded in verified website facts]

## [A concise, page-specific FAQ heading that includes “FAQs”]

### [Question?]

[Two concise explanatory paragraphs followed by that answer's Sources:/Fuentes: line]

[Repeat for exactly 10 total questions]

## Sources

- [Descriptive source](direct URL)

Do not add editor notes, research logs, placeholders, citation IDs, raw URLs outside Markdown links, or commentary before or after the page.`;
}
