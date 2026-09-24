import sanitizeHtml from "sanitize-html";

export const AUTHORITY_STANDARD_VERSION = "2026-09-15-approved-hiring-article";
export const AUTHORITY_CATEGORIES = ["experience", "awards", "associations", "results", "reviews", "publications", "teaching", "certifications"] as const;

// The ordering user supplies a name, never an audit instruction.
export function normalizeAuthorityAttorney(value: unknown) {
  if (value === undefined || value === null || value === "" || (typeof value === "string" && !value.trim())) return "";
  if (typeof value !== "string" || value.trim().length > 120 || !/^[\p{L}\p{M} .,’'()\-]+$/u.test(value.trim())) {
    throw new Error("Enter a lawyer's name (up to 120 characters), not editorial instructions.");
  }
  return value.trim();
}

export function approvedAuthorityScope(website: string, title: string, selectedAttorney?: string) {
  const attorney = normalizeAuthorityAttorney(selectedAttorney);
  if (attorney) return `APPROVED EDITORIAL SCOPE: The user selected ${JSON.stringify(attorney)} as the lawyer to feature for this article's practice area. Verify this person's identity, relationship to the client firm and relevant practice experience using official sources; do not invent a match. Center the dedicated client-named authority section on that lawyer. Research all eight evidence categories for the selected lawyer and relevant firm-level evidence. Do not require separate profiles or credentials for other lawyers. Accurately source any colleague or co-counsel mentioned; never transfer another lawyer's credentials, results or reviews to the selected lawyer. Label historical firm reviews and firm-hosted testimonials accurately. Do not claim a complete firm-wide record. All source-verification and evidence requirements remain in force. Preserve this focus in revisions and preparation.`;

  // Compatibility for the two in-flight jobs approved before the order field existed.
  let hostname: string;
  try { hostname = new URL(website).hostname.toLowerCase().replace(/^www\./, ""); }
  catch { return ""; }
  if (hostname !== "pbglaw.com" || !/^The Best Nursing Home Abuse Lawyer in (?:Sarasota|St\. Petersburg) FL for Your Case: What to Look for Before You Hire(?: — (?:Blog Article|Revision \d+))*$/i.test(title.trim())) return "";
  return "APPROVED EDITORIAL SCOPE: Center the dedicated RDCY authority section on Sean C. Domnick. Research and verify all eight categories for Sean, plus accurately labeled firm-level evidence relevant to hiring him. Do not require separate Gale or Kruegel profiles, awards, publications, teaching, associations or certifications merely because they practice at RDCY. Keep any colleague or co-counsel actually mentioned accurately attributed and sourced. Do not transfer their credentials or reviews to Sean. Retain relevant firm-hosted testimonials and historical predecessor-firm review signals with their limitations; these are not Sean-specific reviews. Do not claim a complete firm-wide record. This scope changes whose record is researched, never the evidence standard or source-verification requirements.";
}

export function isAttorneySelectionTopic(...signals: (string | undefined)[]) {
  const text = signals.filter(Boolean).join(" ");
  if (/\b(?:best[- ]of|why\s+(?:(?:should|would)\s+(?:you|I|someone)\s+)?(?:hire|choose|trust|work\s+with)|por\s+qu[eé]\s+(?:contratar|elegir))\b/i.test(text)) return true;
  if (/\b(?:mejor(?:es)?|elegir|contratar|comparar)\b/i.test(text) && /\b(?:abogad[oa]s?|bufetes?)\b/i.test(text)) return true;
  return /\b(best(?:[- ]of)?|top[- ]rated|top\s+(?:\d+\s+)?|leading|hire|hiring|choos(?:e|ing)|select(?:ing|ion)|recommend(?:ed|ation)?|compare|comparison|which|who|find|right|worth\s+considering)\b/i.test(text)
    && /\b(lawyers?|attorneys?|law|legal\s+(?:counsel|representation))\b/i.test(text);
}

export const ATTORNEY_AUTHORITY_PROMPT = `MANDATORY ATTORNEY-SELECTION AUTHORITY STANDARD ${AUTHORITY_STANDARD_VERSION}
APPROVED EDITORIAL FORM: Follow the approach approved September 15, 2026 from "The Best Medical Malpractice Lawyer in Palm Beach County for Your Case: What to Look for Before You Hire" (Google Doc 1RS_e5LsAPfEYKWxq7EPWyTHdE0U9gkLiPRZ4FBaHeac). Write a coherent, reader-facing hiring article. Center the lawyer selected for the practice area; adapt the evidence and local discussion to the actual topic. Organize the firm section around relevant experience, what recognition covers, handling difficult cases, professional responsibilities, service/mentoring, published writing and teaching, review context, and consultation fit. Link concrete evidence to practical hiring benefits. Group related honors and publications naturally. Keep necessary qualifications close to their claims, but do not turn the article into an audit log or repeat the same disclaimer after every credential. This reference is an editorial model, not proof of another client's facts.
For every best-of, best lawyer, top lawyer, why hire, who should I hire, choose/compare counsel, or similar attorney-selection article, include a substantial dedicated H2 naming the actual client and explaining why a reader should consider that firm for this exact issue and location. A generic contact section, CTA, awards checklist for choosing other lawyers, or two-paragraph firm summary does not satisfy this requirement.
Research ALL eight categories: relevant experience; accolades/awards; professional associations and leadership; verdicts/settlements/results; client reviews and review signals; authored articles/publications and separately identified media mentions; teaching/speaking; certifications. Include every verified relevant distinction, with specific names, dates/years where available, attribution to the correct person/firm, direct source links and explanation of its practical relevance. Organize naturally with H3s. Research the official firm biography, results, reviews, news and community pages AND original awarding bodies, associations, publishers, review platforms and CLE providers. The original publisher's byline controls authorship; a quoted expert or press-release subject is not the author. Distinguish peer ratings from client ratings and firm testimonials from independently verified platform reviews. Never convert historical membership into current leadership or awards into certifications.
For any category genuinely unavailable after research, briefly disclose what could not be verified and link the relevant sources reviewed; do not fabricate evidence or silently omit the category. Verify review platform, rating/count and date before using numbers. Flag conflicting result figures; never guess or describe a settlement as a verdict. Do not imply unsupported superiority, guaranteed results, or that past results predict this case.
For publications, research the selected lawyer's original publisher bibliography and Google Scholar where available. Verify authorship against the original publisher. Scholar citation records are bibliographic evidence, not proof of peer review or medical expertise. Include relevant professional columns and explain their role in evaluating the lawyer's advocacy.
The section must explain how the evidence bears on the reader's actual hiring decision. Preserve it during revisions, compression and WordPress preparation. The ordinary one/two-paragraph firm-section instruction and main-body word target do not cap this section. A complete section will usually need at least 350 words; length alone never proves completeness. Unavailable categories are disclosures, not invented credentials. Return the complete article with this section before the FAQs.`;

export function authoritySection(html: string, firmName: string) {
  const clean = sanitizeHtml(html, {allowedTags: ["h2","h3","p","ul","ol","li","a","strong","em"], allowedAttributes:{a:["href"]}});
  const firmWords = firmName.toLowerCase().replace(/[^a-z0-9 ]/g," ").split(/\s+/).filter(w => w.length > 2 && !["the","law","firm","and","llp","pllc"].includes(w));
  const candidates: {html:string;nameMatches:number;citations:number;words:number}[] = [];
  for (const match of clean.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>([\s\S]*?)(?=<h2\b|$)/gi)) {
    const heading = sanitizeHtml(match[1],{allowedTags:[],allowedAttributes:{}}).toLowerCase();
    const headingWords = new Set(heading.replace(/[^a-z0-9 ]/g," ").split(/\s+/));
    const nameMatches = firmWords.filter(w=>headingWords.has(w)).length;
    if (!/faq|preguntas|sources|fuentes/.test(heading) && nameMatches) {
      candidates.push({html:match[0],nameMatches,
        citations:new Set([...match[0].matchAll(/href="(https?:[^\"]+)"/g)].map(m=>m[1])).size,
        words:sanitizeHtml(match[0],{allowedTags:[],allowedAttributes:{}}).split(/\s+/).filter(Boolean).length});
    }
  }
  // A surname in an earlier consultation checklist is not the dedicated firm
  // section. Prefer the full client identity, then the substantive cited section.
  // This only selects the section; structure and independent evidence gates follow.
  candidates.sort((a,b)=>b.nameMatches-a.nameMatches || b.citations-a.citations || b.words-a.words);
  return candidates[0]?.html || "";
}

export function authorityStructureErrors(html: string, firmName: string) {
  const section = authoritySection(html, firmName);
  if (!section) return ["Missing a dedicated authority H2 naming the client."];
  const text = sanitizeHtml(section,{allowedTags:[],allowedAttributes:{}});
  const errors: string[] = [];
  if (text.split(/\s+/).filter(Boolean).length < 350) errors.push("The firm authority section is too brief to substantiate the requested hiring criteria.");
  if (new Set([...section.matchAll(/href="(https?:[^\"]+)"/g)].map(m=>m[1])).size < 3) errors.push("The authority section needs direct citations to the evidence discussed.");
  return errors;
}

export type AuthorityAudit = { passed: boolean; issues: string[]; categories: {category:string;status:string;reason:string;sourceUrls:string[]}[] };
export function authorityAuditErrors(audit: AuthorityAudit) {
  const issues = [...(Array.isArray(audit.issues) ? audit.issues : ["Invalid authority review response."])];
  for (const category of AUTHORITY_CATEGORIES) {
    const entries = audit.categories?.filter(c=>c.category===category) || [];
    const row = entries[0];
    if (entries.length!==1 || !["supported","unavailable_disclosed"].includes(row?.status) || !row?.reason?.trim() || !row.sourceUrls?.length || row.sourceUrls.some(url=>!/^https?:\/\//.test(url))) issues.push(`Authority research incomplete: ${category}.`);
  }
  if (audit.passed !== true && !issues.length) issues.push("Authority evidence review did not pass.");
  return issues;
}
