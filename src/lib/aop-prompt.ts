import { LEGAL_DIRECTORY_LABEL_RULE } from "./geo-directory-labels";
import { AMPLIFY_FAQ_PROMPT } from "@/lib/faq-standard";

type AopPromptInput = {
  firmName: string;
  website: string;
  contactUrl?: string;
  practiceArea: string;
  primaryKeyword?: string;
  jurisdiction?: string;
  relatedPracticeAreaUrls?: Record<string, string>;
  notes?: string;
};

export function buildAopPrompt(input: AopPromptInput) {
  const jurisdiction = input.jurisdiction?.trim()
    || "Use only the jurisdictions and service areas verified on the firm's official website.";
  const keyword = input.primaryKeyword?.trim()
    || `Determine the most natural service-intent query for ${input.practiceArea}.`;
  const relatedPages = Object.entries(input.relatedPracticeAreaUrls || {})
    .slice(0, 20)
    .map(([label, url]) => `- ${label}: ${url}`)
    .join("\n") || "No related page list was supplied. Verify useful internal links on the official website.";

  return `You are the senior legal content strategist for AMPLIFY. Create a publication-ready Area of Practice (AOP) landing page for a law firm.

VERIFIED CLIENT
- Firm name: ${input.firmName}
- Official website: ${input.website}
- Contact page: ${input.contactUrl || "Find and verify the correct contact page on the official website."}

PRACTICE AREA
${input.practiceArea}

PRIMARY SERVICE QUERY
${keyword}

JURISDICTION OR AUDIENCE
${jurisdiction}

RELATED CLIENT PAGES
${relatedPages}

EDITORIAL NOTES
${input.notes?.trim() || "No additional notes."}

RESEARCH FIRST

1. Research the client's official website before writing. It is the only authoritative source for the firm's lawyers, offices, phone number, services, case results, awards, credentials, fees, consultation policies, and other firm claims.
2. Confirm that this practice area fits the firm's verified services. Never imply that the firm handles a matter its website does not support.
3. Research the law using current primary and authoritative sources for the supplied jurisdiction. Prefer statutes, court rules, government agencies, official guidance, and original research.
4. Verify every deadline, legal standard, statistic, and firm-specific statement. Omit facts that cannot be verified.
5. Review the firm's related practice-area pages so this page adds distinct value instead of duplicating their wording or structure.
6. Treat these research instructions as private editorial process. Never expose phrases such as "verified services," "the firm's verified services include," "our research found," "based on the client website," or other language that sounds like an internal research report.

PAGE PURPOSE

This is a service landing page for a prospective client, not a blog post, legal memo, glossary, or location page. The goal is less encyclopedia and more ${input.firmName}: a clear practical point of view, useful guidance, and a distinct explanation of how this firm helps with this problem.

Before drafting, identify one practical organizing idea that goes beyond the obvious surface issue. Build the opening around it and thread it through the page without repeating the same sentence. For a motor-vehicle AOP, a strong model is: fault is only the beginning; insurance, evidence, injuries, and available coverage can all shape the case. For another AOP, derive an equally useful central idea from that matter instead of copying the motor-vehicle formulation.

WRITING STANDARD

- Write in plain English for a worried layperson. Use direct sentences, short paragraphs, useful headings, and a calm, confident voice.
- Lead with the practical answer and the page's central idea. Avoid long history lessons, dense doctrine, exhaustive party lists, and repeated caveats.
- Bring ${input.firmName} into the opening or first main section, then use two or three additional natural, fact-supported references throughout the page. Do not postpone nearly all firm differentiation until the conclusion, and do not repeat generic promotional claims.
- Keep legal analysis lean. Explain only rules that help the reader recognize a claim, protect evidence, understand a deadline, or decide what to do next.
- Translate fault, insurance, causation, and damages into conversational language. Do not write like a legal memorandum or research summary. For a motor-vehicle AOP, a useful insurance organizing idea is: "The insurance that pays your medical bills may not be the same insurance that ultimately compensates you for the crash." Explain the practical consequence rather than cataloging policies and statutes.
- Use the jurisdiction naturally where it changes the process or advice. Do not turn this into a GEO page or repeat the place name mechanically.
- Be human and client-focused throughout, especially in the final third. Explain what contacting the firm is like and how its actual services relate to this problem.
- Do not promise an outcome or use fear, hype, keyword stuffing, invented urgency, or generic claims such as "best" or "top-rated."
- Aim for approximately 1,050 to 1,500 words for the main body, excluding the FAQ section and its source lines. Favor a distinctive, confident service page over exhaustive coverage.

REQUIRED STRUCTURE

- Exactly one H1 that clearly names the practice area and, only when natural, the jurisdiction.
- A concise opening of two or three short paragraphs built around the central organizing idea. Mention ${input.firmName} naturally within the first 150 words.
- Scannable H2 sections covering the most useful topics for this matter. Select only sections that genuinely fit, such as:
  - how the firm may help;
  - situations or claim types covered;
  - responsibility and evidence;
  - losses or remedies that may be available;
  - important next steps and the few deadlines that matter most;
  - why contact this firm.
- When the AOP contains individual accident, claim, injury, or service types that have their own live client pages, make each type a doorway to its page. Link the descriptive label, then use one or two sentences to explain what makes that type practically different. Examples for a motor-vehicle page include truck evidence and company records, motorcycle perception and bias, rideshare coverage layers, and uninsured/underinsured-motorist issues. Include only types and distinctions supported by the client's live pages and the verified law; do not create a generic list.
- Keep category lists focused. Four to six strong examples are usually enough.
- Keep any deadlines section centered on no more than two numbers a reader truly needs. State each in one or two plain-English sentences, with only the essential qualification. For a New Jersey personal-injury matter, when current law and the exact claim support it, this will often mean the general two-year filing period and the potentially 90-day notice requirement for a claim involving a public entity. Verify both before using them, and never carry those numbers into another jurisdiction automatically.
- Include a firm-specific H2 near the end explaining why someone with this issue should contact ${input.firmName}. The heading itself must sound specific to the firm, service, and jurisdiction. Never use template headings such as "Why Contact ${input.firmName} About This Matter?" or "Why Choose Our Firm?" For a Bedell & Stripto motor-vehicle page, a strong model is "Experience With Serious New Jersey Motor Vehicle Cases." Derive an equally specific heading for other firms and AOPs from verified experience; do not reuse this example mechanically.
- Use the strongest verified differentiator in this section and, when natural, earlier in the page. Relevant examples can include prior insurance-company work, courtroom experience, a focused professional background, or a service approach—but only when the firm's official site supports the fact.
- Include the complete FAQ section required by the Global AMPLIFY FAQ Standard below. For a New Jersey motor-vehicle AOP, useful questions may include passenger claims, aggravated preexisting injuries, recorded statements, and who pays medical bills after a crash when current law supports them. Treat these as candidates within the full topic-specific set, not a reusable template.
- Finish with a concise H2 titled "Sources" containing only authoritative sources actually used.

SEO, LINKS, AND CONVERSION

- Provide a compelling SEO Title of about 50 to 60 characters and a specific Meta Description of about 145 to 160 characters.
- Use the primary service query naturally in the H1, opening, and one useful heading when appropriate.
- Link to the verified contact page and the closest relevant practice-area pages on the client's site. Never invent a URL.
- ${LEGAL_DIRECTORY_LABEL_RULE}
- Use descriptive internal anchor text. When a related service page exists, link its first natural mention and do not repeatedly link the same destination.
- Link authoritative external sources at the claim they support.
- The publishing workflow inserts three branded CTA cards between complete WordPress blocks and creates a topic-relevant banner image with alt text. Do not write CTA placeholders or image instructions.
- Structure complete paragraphs, lists, headings, tables, and quotes. Never place a heading or section inside a paragraph, and never design content that requires a CTA to interrupt a block.

SCHEMA READINESS

- Visible FAQs must use an H2 followed by H3 questions ending in question marks so the publishing workflow can create matching FAQPage schema.
- Keep the service description and provider identity clear enough for LegalService schema.
- Do not include raw JSON-LD; the publishing workflow creates schema from the verified page content.

FINAL EDIT BEFORE OUTPUT

- Cut roughly 15 to 20 percent from any first-draft length, concentrating on fault, insurance, legal standards, and the second half.
- Replace research-style phrasing, qualifications, and abstract nouns with direct, conversational sentences.
- Confirm that ${input.firmName} appears early and naturally throughout, not only in a closing sales section.
- Confirm that each linked service type explains a distinct practical issue instead of merely naming another practice area.
- Confirm that all ten FAQs answer distinct, high-intent client questions and satisfy the Global AMPLIFY FAQ Standard. Remove repetition inside each answer, but do not delete a genuinely common question merely because the body mentions the same broader subject.
- Ask whether this page could be published by a different law firm after changing only the name. If yes, make it more distinctly ${input.firmName} using verified facts and approach.

OUTPUT FORMAT

${AMPLIFY_FAQ_PROMPT}

Return clean Markdown only, in this exact order:

SEO Title: [about 50 to 60 characters]

Meta Description: [about 145 to 160 characters]

# [One clear practice-area H1]

[Complete AOP page body]

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
