import { ATTORNEY_AUTHORITY_PROMPT, isAttorneySelectionTopic } from "./attorney-authority";
import { LEGAL_DIRECTORY_LABEL_RULE } from "./geo-directory-labels";
import { AMPLIFY_FAQ_PROMPT } from "@/lib/faq-standard";

type BlogPromptInput = {
  firmName?: string;
  website: string;
  contactUrl?: string;
  practiceAreaUrl?: string;
  practiceAreaUrls?: Record<string, string>;
  practiceArea?: string;
  topic: string;
  primaryKeyword?: string;
  jurisdiction?: string;
  relatedQuestions?: string[];
  notes?: string;
};

export function buildBlogPrompt(input: BlogPromptInput) {
  const primaryKeyword = input.primaryKeyword?.trim() || "Not supplied; determine the natural primary query from the topic.";
  const jurisdiction = input.jurisdiction?.trim() || "Infer the relevant jurisdiction only from the firm's verified website and the topic. Do not guess.";
  const notes = input.notes?.trim() || "No additional editorial notes.";
  const verifiedInternalPages = Object.entries(input.practiceAreaUrls || {})
    .slice(0, 30)
    .map(([label, url]) => `- ${label}: ${url}`)
    .join("\n") || "Research and verify relevant internal pages on the official client website.";

  const authorityRequired = isAttorneySelectionTopic(input.topic, input.primaryKeyword);
  return `You are the senior legal editor for AMPLIFY. Create a publication-ready law-firm blog article.

CLIENT WEBSITE
${input.website}

VERIFIED CLIENT PROFILE
- Firm name: ${input.firmName?.trim() || "Verify from the official website."}
- Contact page: ${input.contactUrl?.trim() || "Find and verify the correct contact page on the official website."}
- Relevant practice-area page: ${input.practiceAreaUrl?.trim() || "Find and verify the closest relevant practice-area page on the official website."}

VERIFIED INTERNAL PAGES
${verifiedInternalPages}

CLIENT PRACTICE AREA
${input.practiceArea?.trim() || "Infer only from the client's verified website and article topic."}

ARTICLE TOPIC
${input.topic}

PRIMARY SEARCH QUERY
${primaryKeyword}

JURISDICTION OR AUDIENCE
${jurisdiction}

RELATED READER QUESTIONS
${input.relatedQuestions?.length
  ? input.relatedQuestions.map((question) => `- ${question}`).join("\n")
  : "No related questions supplied. Research the reader's natural follow-up questions."}

EDITORIAL NOTES
${notes}

${authorityRequired ? ATTORNEY_AUTHORITY_PROMPT : ""}

RESEARCH FIRST

1. Research the client's official website before writing. Use it as the starting source for the firm's name, lawyers, offices, phone number, practice areas, results, awards, credentials, consultation policies, fees, and other firm claims. Verify recognitions, memberships, publication bylines, reviews and teaching with the original awarding body, association, publisher, review platform or event provider where available.
2. Research the legal topic with current primary and authoritative sources. Prefer statutes, court rules, government agencies, official reports, and original research. Use high-quality secondary sources only for context.
3. Check the publication or effective date of time-sensitive information. Explain the applicable jurisdiction and date when they matter.
4. Never invent a firm fact, legal rule, statistic, quote, case result, review, credential, deadline, or source.
5. Do not copy the structure or language of competing law-firm articles.

EDITORIAL STANDARD

Write for one prospective client who wants a clear answer, not for another lawyer or an SEO crawler. The article must be accurate, useful, calm, and specific. Use plain English, short paragraphs, smooth transitions, and a warm, confident voice. Explain legal terms only when the reader needs them.

The opening should answer the reader's core question quickly. Organize the rest around the natural follow-up questions a real reader would ask. Use supplied reader questions only when they genuinely belong in the article; do not turn the piece into a repetitive FAQ list. Use examples only when they clarify the rule, and label hypotheticals as examples. Distinguish general information from advice about an individual case.

Avoid generic introductions, fear-based language, keyword stuffing, marketing cliches, fake urgency, repetitive conclusions, excessive headings, choppy one-sentence paragraphs, and phrases such as "in today's complex legal landscape," "it is important to note," or "navigate the complexities."

SHORTEN, SIMPLIFY, AND HUMANIZE

- Research deeply, but publish selectively. Source depth is not a reason to include every legal rule, exception, procedural detail, or caveat.
- Include only the law a prospective client needs to understand the answer, protect their position, or decide what to do next. Translate the controlling rule into plain English. Do not recite statutes, multi-part legal tests, competing doctrines, or layers of exceptions unless they materially change the practical answer.
- Never let a section read like a legal memorandum, case brief, treatise, or motion. Citations should support useful statements, not drive the prose.
- Prefer direct sentences with one main idea. Split sentences carrying several clauses or qualifications. Remove throat-clearing, repeated caveats, and phrases that soften a point without improving accuracy.
- State a necessary qualification once, clearly and briefly. Do not repeat variations of "it depends," "may," "could," or "generally" throughout the article.
- Keep any insurance-rules, filing-deadlines, or time-limits section exceptionally lean. Include no more than the three deadlines or notice rules most likely to affect the reader's next step. Give each rule no more than two plain-English sentences, including its essential limitation, and do not expand into procedural history or a catalog of exceptions.
- For a New York e-bike or bicycle-crash article, when supported and relevant, the deadline section should ordinarily be limited to: the conditional 30-day no-fault notice point when a motor vehicle is involved, the two-year wrongful-death limitations period, and the 90-day notice-of-claim issue for many claims involving a government entity. Verify every rule and its applicability from current authoritative sources before using it, then explain it simply.
- Keep responsible-party lists to the three or four categories that help the reader most. Combine overlapping parties instead of producing an exhaustive liability inventory. For an e-bike or bicycle-crash article, the useful groupings are ordinarily: driver and vehicle owner; employer; defective bike or component manufacturer/seller; and government or roadway entity. Include only categories that fit the verified topic.
- If a jurisdiction, borough, city, or audience is supplied, strengthen that local angle in several natural places. Explain how the location affects the reader's situation, evidence, institutions, process, or next steps. For a Brooklyn audience, write specifically about Brooklyn where supported instead of repeatedly falling back to generic New York language. Do not add superficial local facts or force the location into every heading.
- Make the final third more human and client-focused. Shift from doctrine to what the reader may be experiencing, what they can do now, what contacting the firm is like, and how verified firm services relate to this problem.
- Give the ending personality and confidence. Use a direct, conversational invitation rather than a timid or generic conclusion. Tell the reader why this firm is worth calling and what the firm can help them understand or do, while staying within verified facts and never promising a result.
- Before returning the article, perform an invisible compression edit. Cut roughly 15 to 20 percent of any first-draft verbosity, especially from the second half, while preserving the strongest research, local detail, practical guidance, and every required firm-authority category and source.

SEO AND STRUCTURE

- Write exactly one compelling H1 that accurately describes the article. Do not use another H1 anywhere in the body; all main sections must be H2s and their subsections must be H3s.
- Make the SEO Title distinct when useful, compelling but accurate, and no longer than about 60 characters. Write a specific Meta Description of about 145 to 160 characters that explains what the reader will learn without clickbait.
- Aim for 1,200 to 1,750 words for the main article body, excluding the FAQ section and its source lines, unless the topic clearly requires a modest exception. Favor a strong shorter article over exhaustive coverage.
- Use descriptive H2s and H3s only where they improve scanning.
- Use the primary query naturally in the title, introduction, and at least one heading when editorially appropriate.
- ${LEGAL_DIRECTORY_LABEL_RULE}
- Include useful internal links to relevant pages on the client's official website. Use the verified internal-page list above when the corresponding subject appears naturally. Link the first useful occurrence of a relevant phrase, use descriptive anchor text, and do not link the same destination repeatedly. Link only to URLs you verified.
- Include direct links to authoritative external sources at the point where they support a claim.
- The publishing workflow will insert the same three branded calls to action used on the client's GEO pages: one before the first main H2, one at a natural H2 boundary near the midpoint, and one after the article. Structure the article with complete sections so each CTA can be inserted between content blocks. Never split a paragraph, list, table, quote, or other content block.
- Do not write CTA placeholders, image instructions, repeated phone-number pitches, or generic promotional filler in the Markdown. The publishing workflow supplies the branded CTA cards.
- For ordinary informational blogs only, near the bottom include a firm-specific H2 followed by one or two focused paragraphs about why a person dealing with this exact issue should contact this law firm. Explain the relevant, practical ways the firm may help, using only facts and service details verified on the client's official website. End with a confident, natural invitation to contact the firm, link to a verified contact or relevant practice-area page when useful, and do not promise an outcome.
- Make the page-specific FAQ section the final substantive section before Sources and follow the Global AMPLIFY FAQ Standard below. Prioritize supplied reader questions that fit the article. Every FAQ must add a distinct practical answer that is not already clear from the opening or body; do not create several FAQs from the same dataset or repeat a statistic, rule, or explanation merely to fill the section.
- Keep every FAQ visible in the article. The publishing workflow will generate FAQPage schema only from the visible question-and-answer content, never from hidden or invented text.
- Add a concise source list after the article containing only sources actually used.

LEGAL AND ETHICAL SAFEGUARDS

- Do not give individualized legal advice.
- Do not state that a deadline, damages rule, or legal standard applies everywhere.
- Do not guarantee results or imply that past results predict future outcomes.
- Do not make a claim about the firm without direct support from its official website or the original credential, review, publication or event source.
- If a fact cannot be verified, do not invent it. For mandatory authority categories, disclose the unavailable evidence rather than silently omitting the category.

OUTPUT FORMAT

${AMPLIFY_FAQ_PROMPT}

Return clean Markdown only, in this exact order:

SEO Title: [maximum about 60 characters]

Meta Description: [about 145 to 160 characters]

# [Article title]

[Article body with linked sources]

## [Why Contact the verified law firm about this issue?]

${authorityRequired ? "[Substantial researched authority section with all eight categories supported or explicitly disclosed as unavailable, direct citations, accurate attribution, and practical relevance. Use H3 subsections. Preserve this section during shortening.]" : "[One or two topic-specific paragraphs grounded in verified firm facts, ending with a natural invitation to contact the firm.]"}

## [A concise, page-specific FAQ heading that includes “FAQs”]

### [Useful reader question ending in a question mark?]

[Two concise explanatory paragraphs followed by that answer's Sources:/Fuentes: line]

[Repeat for exactly 10 total questions, with no duplicated answer from the article body]

## Sources

- [Descriptive source name](direct URL)

Do not add notes to the editor, research logs, citation IDs, raw URLs outside Markdown links, or commentary before or after the article.`;
}
