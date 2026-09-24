// Public research seeds from the user's approved September 13 article.
// These are retrieval starting points, never a substitute for current verification.
export function hiringBlogResearchReference(website: string, attorney: string, title: string) {
  let host: string;
  try { host = new URL(website).hostname.toLowerCase().replace(/^www\./, ""); }
  catch { return ""; }
  const sean = /\bSean\s+(?:C\.?\s+)?Domnick\b/i.test(attorney);
  const nursingDefault = !attorney.trim() && /nursing\s+home/i.test(title);
  if (host !== "pbglaw.com" || (!sean && !nursingDefault)) return "";
  return `APPROVED RDCY RESEARCH STARTING POINTS (verified September 15, 2026; recheck current claims): Feature Sean C. Domnick for this assignment and adapt his record to the actual ordered practice area. Reuse this bibliography and verify updates rather than rebuilding the source list from an empty search. Do not reuse another article's legal analysis or city-specific claims.
Official biography: https://www.pbglaw.com/attorneys/sean-domnick/
Original AAJ presidency and Trial publication index: https://www.justice.org/about-us/leadership/aaj-president-sean-domnick
The approved article includes Sean's complete 2023–2024 Trial presidential-column series. Google Scholar's Articles search https://scholar.google.com/scholar?q=%22S+C+Domnick%22 showed citation records for A Collective Effort (2023), Demanding a Higher Bar (2023), and Treating Workers Fairly (2024). When claiming Scholar indexing, include that direct Scholar citation in the article. Confirm original publisher authorship; these are legal/professional columns, not medical studies. Direct publisher examples: https://www.justice.org/resources/publications/trial-magazine/2023-dec-a-collective and https://www.justice.org/resources/publications/trial-magazine/2024-jan-treating-workers
Nursing-home records article, visibly bylined Sean: https://www.pbglaw.com/blog/what-a-florida-nursing-home-has-to-write-down-and-what-the-record-can-and-cannot-show/
Nursing-home practice guides: https://www.pbglaw.com/florida-nursing-home-abuse-lawyer/ ; use the issue-specific linked guides when relevant.
Jury-selection writing: https://www.pbglaw.com/wp-content/uploads/2024/03/Time-Limits-on-Jury-Selection.pdf
Teaching provider: https://www.myfja.org/events/2022dirtytricks/ ; biography includes PEOPIL Nursing Home Claims (2020).
Awards: https://www.justice.org/membership/awards ; https://www.myfja.org/award-recipients/ ; https://www.bestlawyers.com/lawyers/sean-c-domnick/43101 ; https://www.lawdragon.com/guides/2026-02-13-the-2026-lawdragon-500-leading-plaintiff-consumer-lawyers
Professional profile: https://profiles.superlawyers.com/florida/palm-beach-gardens/lawyer/sean-c-domnick/c215a5a6-8b99-4c31-b2a1-42f45704ff9a.html
Case evidence: https://flcourts-media.flcourts.gov/content/download/425459/opinion/sc17-85.pdf ; https://www.pbglaw.com/attorney-honors/sean-domnick-awarded-jon-krupnick-award-by-florida-justice-association/
Review context: https://www.avvo.com/attorneys/33418-fl-sean-domnick-1278709.html?pa=111 ; https://www.martindale.com/attorney/mr-sean-christopher-domnick-850912/ ; https://www.pbglaw.com/client-reviews/page/3/
Civil trial certification: https://www.floridabar.org/about/cert/cert-ct-mbrs/?pageNumber=5&pageSize=50
Verify certification identity, exact recognition names and years, current roles, review dates and case outcomes from original sources. Preserve source limitations without turning the article into an audit log.`;
}
