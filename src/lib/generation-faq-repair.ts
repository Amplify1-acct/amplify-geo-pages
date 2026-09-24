export const FAQ_REPAIR_LIMIT = 2;

export function faqRepairPrompt(errors: string[]) {
  return `The draft failed AMPLIFY's FAQ checks. Correct the draft and return the entire corrected Markdown article, preserving its firm, topic, jurisdiction, and substantive structure. This is a correction pass before review, not an approved-content edit.
Preserve the complete firm-specific authority section, all verified credentials, results, reviews, publications, teaching, associations, certification disclosures and their citations. Do not shorten it to a generic contact paragraph while repairing FAQs.
Failures: ${errors.join(" ")}
Repeated links within each FAQ source list are automatically removed before validation. If an answer has too few sources, find another distinct, relevant supporting source; repeating the same URL with a new label, fragment, or tracking parameter does not supply another source. A relevant source may be reused across different FAQ answers.
Verify the actual supporting sources using web search. Each of exactly ten FAQ answers must end with two to four distinct descriptive direct HTTPS source links, including at least one government, official court, academic, or peer-reviewed source. Use the firm's website only for that firm's facts. For consultation questions, explain relevant professional-conduct or patient-records rules and cite their direct official source alongside the firm contact page. Do not append irrelevant sources merely to pass validation. For medical evidence, prefer the direct PubMed/PMC journal article or an official health agency. For state law, use official legislative/court/government pages, never Justia or a law firm. Keep two concise explanatory paragraphs per answer, a direct opening response, and source support for the actual claims. Remove duplicate links and verify that each URL opens the named source. Preserve exactly one topic/jurisdiction-specific FAQs H2 and ten distinct H3 questions ending in question marks. Do not include JSON-LD or a discussion of these corrections.`;
}

export function nextFaqRepairAttempt(metadata: Record<string, string> | null | undefined) {
  const attempt = Number(metadata?.faq_repair_attempt || 0);
  return Number.isInteger(attempt) && attempt >= 0 && attempt < FAQ_REPAIR_LIMIT ? attempt + 1 : null;
}
