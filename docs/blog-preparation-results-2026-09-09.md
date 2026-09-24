# Approved blog preparation — September 9, 2026

Three drafts passed preparation and rendered checks. Two remain blocked on image verification. No post was published or scheduled during this work.

| Client / article | Original WordPress ID | Assigned calendar slot (America/New_York) | Result |
| --- | --- | --- | --- |
| Epstein — government injury claims | 17713 | September 8, 9:00 AM (past) | Ready for final approval |
| Epstein — PIP / health insurance | 17714 | September 15, 9:00 AM | Image blocked |
| Fulginiti — insurance settlement / truck lawyer | 7620 | September 2, 9:00 AM (past) | Image blocked |
| Drazen — Uber / Lyft passenger coverage | 1303 | September 16, 9:00 AM | Ready for final approval |
| Angiuli — denied parenting time | 3204 | September 29, 9:00 AM | Ready for final approval |

## Corrections completed

- Restored the Epstein records to the original approved Google Docs, verified against the intake source markers: government `1cxCITfDTSekO2ECxdaNMjiByZEKtsJ9_cj_pameH5BY`; PIP `1Fa0QjWVRUAg6CA5iinM9IakjfqWJY8OUTV-N0sd2mZw`. The originals were not edited. Wrong document associations are normalized during queue reads and tracker reconciliation.
- Backed up and moved the two superseded preparation copies, WordPress 17764 and 17767, to Trash. Original post IDs and calendar record IDs are retained.
- Added verified Epstein practice links, including the actual `/car-accidents/` parent page.
- Prepared original WordPress copies with three firm-specific inline CTAs, clean slugs, relevant categories, SEO, and ten sourced FAQs. Epstein categories are Personal Injury / Auto Accidents; Fulginiti is Truck Accidents; Drazen is Ride Share Accidents; Angiuli is Family law.
- Fixed escaped ampersands in schema citation URLs. Preserved stable FAQ anchors inside Angiuli headings because the theme replaces heading IDs for its table of contents.
- Confirmed Drazen already has a saved Yoast title and description; its old bridge warning did not mean those fields were empty.
- Added the CDC medical source to Drazen's delayed-symptoms FAQ and corrected the misspelled Maison court-source URL in the Epstein government article.
- Saved descriptive featured-image and CTA image alt text for the three verified drafts.
- Approval queue now distinguishes verified preparation from actual image blockers. Tracker reconciliation preserves those decisions.

## Evidence and safeguards

Approved source exports and full prior WordPress records were backed up in existing server storage before replacement. Additional backups precede duplicate cleanup, final verification, and media metadata changes. Readable original Google Doc exports are in `.artifacts/blog-prep-20260909/`.

Rendered checks for government claims, PIP, Drazen, and Angiuli found exactly three CTAs, exactly one FAQPage node, ten questions, working FAQ/question/answer anchors, and matching visible answers and citation URLs. PIP still fails the separate image check. Categories, clean slugs, SEO title/description, featured media, and draft status were read back from WordPress. Government, Drazen, and Angiuli images were visually reviewed.

Public authority checks included NJ statutory source pages (59:8-9, 59:9-2, 39:6A-4, 39:6A-12, 39:6A-8, 2A:15-5.1), Treasury filing guidance, the 2026 NJ auto insurance guide and PIP coordination regulation, Florida insurance statutes and current Uber/Lyft certificates, NY statutes and court decisions, and PA/federal trucking authorities. The downloaded Uber certificate confirms UM/UIM is excluded during both waiting and accepted-trip periods, with policy dates March 1, 2026–March 1, 2027.

Checks passed: TypeScript, 41 FAQ tests, 6 directory tests, 7 queue/status tests, and 2 focused original-document/theme-anchor tests. Production builds passed.

## Remaining image blockers

Human visual review rejected the PIP image's Toyota emblem and Fulginiti's truck emblem/traffic arrangement. Each replacement run exhausted three automated safety-review attempts without an accepted image. Neither draft was marked preparation-complete, and both now carry a visible image error and rejected-image flags. The original saved drafts remain drafts; the failed image attempts did not replace their content.

No further generation was attempted after those three-attempt failures. A verified, topic-appropriate, unbranded replacement is required before either item can receive final publication approval.

## Next authorized stage

The user must give final publication approval for the three ready drafts. On that approval, the overdue government article should publish using the current date; Drazen and Angiuli retain their assigned future slots. The two existing scheduled posts (RDCY September 14 and Fulginiti device recall September 16, both 9:00 AM Eastern) were unchanged. A new, unrelated Mahwah enhancement appeared in the waiting queue during this work and was left untouched.

## Completion update — September 10, 2026

All seven entries are reconciled in Aron's Approved tab: five `DRAFT · READY FOR FINAL APPROVAL`, two `SCHEDULED ON WORDPRESS`. No new blog was published or scheduled during this preparation pass.

- Epstein PIP original post 17714: replaced the rejected image with `epstein-pip-reviewed.jpg` (attachment 17775), updated all three CTA images and alt text, synchronized the theme hero and BlogPosting image metadata, and verified the draft save and rendered images. September 15 at 9 AM Eastern retained.
- Fulginiti settlement original post 7620: replaced the rejected image with `fulginiti-settlement-reviewed-1.jpg`, updated the three existing black-and-white CTA cards without changing their design or phone number, synchronized the theme hero and image metadata, and verified the draft save. September 2 slot retained as overdue; publish with current date only after final owner approval.
- Approved article body and FAQs retained. Replacement actions back up the original post and queue record in Redis and verify unchanged slug and text outside image tags. Schema backups and preparation verification records are also saved.
- Fixed FAQ validator whitespace normalization: adjacent block elements and newline-separated blocks represent the same rendered text. Regression test first failed, then passed; all 42 FAQ tests and six directory tests passed in the production build.
- Fulginiti's existing `Fulginiti Schema ID Cleanup` snippet forced FAQ IDs to `#faqpage` and stripped draft query IDs. Added an exception only for AMPLIFY schema on this batch's posts 7620 and 7621. Verified exactly ten original function definitions, with the scoped exception as the only code change, and saved the snippet active. Original logic backup: `generated/blog-images-reviewed/backups/fulginiti-schema-id-cleanup-before.php` (formatting normalized; original editor text was also preserved during editing).
- Fulginiti 7620 rendered verification: exactly one FAQPage, ten visible questions with matching answer text, citations and question/answer anchors; FAQPage ID and URL both `https://www.fulginiti-law.com/?p=7620#faq`; BlogPosting ID `https://www.fulginiti-law.com/?p=7620#article`.
- Fulginiti scheduled device-recall post 7621 also verified with one FAQPage, ten questions and matching `?p=7621#faq` page identity after the scoped snippet correction. Its September 16, 9 AM Eastern schedule is unchanged.
- Existing ready drafts rechecked: Epstein government 17713, Drazen 1303, Angiuli 3204 remain drafts with SEO title/description, relevant categories and three CTAs. Their ready-for-final-approval statuses remain verified.
- RDCY birth injury remains scheduled September 14, 9 AM Eastern. Fulginiti device recall remains scheduled September 16, 9 AM Eastern.

The image-only maintenance screen is `/maintenance/blog-image-repair`. Do not use a full Google Doc refresh to replace these images; the older approved Docs do not include every later preparation correction.

### September 10: consistent theme previews
- Added shared WordPress preview routing for GEO, AOP, Sub-AOP, enhancements, and blogs. Saved drafts open the real WordPress theme preview from the dashboard and Aron review; editing remains a separate link.
- Added final publish action for prepared GEO/AOP/Sub-AOP drafts using the existing final-approval endpoint; enhancement updates and blog scheduling retain their respective flows.
- Verified TypeScript and preview URL routing across all five workflows, published content, and missing drafts. Deployment runs the existing FAQ and directory test suites.
- Added a standing ban on images showing people lying on the ground, plus generation and image-review prompt safeguards.
- Production deployment `dpl_CthwbBnFKH5MsF5B65fgJ4r9NjWd` verified in Aron review: five draft preview links and two scheduled preview links open the rendered WordPress URLs.
- Epstein government post 17713: replaced rejected victim image with `epstein-government-reviewed.jpg` across featured image, resolved theme hero, all three CTA images, descriptive alt, and BlogPosting image schema. Saved original remains draft, preparation verified, assigned September 8 slot preserved. Browser confirmed all three new images loaded and FAQ schema still has ten questions. No publication performed.

### September 10: editorial calendar reconciliation
- Live audit found an approved Fulginiti draft missing its preview and still labeled With reviewer, plus two older unresolved topic slots excluded from the decision count.
- Calendar now merges shared review records and archived records with the tracker, resolves editorial slots by contentRecordId as well as editorialSlotId, and surfaces approval fetch errors rather than silently treating failures as an empty tracker.
- All unresolved topic choices remain visible. Verified prepared drafts show Ready for final approval; past scheduled times still reported as future by WordPress receive an explicit check-WordPress label. Calendar dates and publication state were not changed by this repair.

### September 10: visual calendar views
- Added Month (default), Week, and Day views with Today and previous/next navigation, clickable dates, Eastern-time placement, and per-entry client/topic/status/preview links.
- Retained the complete List view. Calendar is read-only: switching dates/views does not change any editorial slot or WordPress status.
- Month/week grids scroll horizontally on narrow screens; Day view fits mobile width. Empty dates, current date, adjacent-month dates, and multiple same-day entries are represented.

### September 10: final approval from calendar
- Ready-for-final-approval entries now link to `/final-review/[record id]` from both the list badge/action and visual calendar.
- Dedicated review screen provides the WordPress preview, external preview fallback, assigned Eastern publishing date, explicit page/image review confirmation, and publish/schedule/update action using the existing go-live endpoint.
- Before approval, rechecks shared draft readiness, identity, Aron's approval, and unchanged assigned calendar slot. After confirmed WordPress success, reconciles editorial and review-queue status. No approval or publication performed while implementing this feature.
- Live browser verification caught third-party WordPress login loss in embedded iframes (404). Final review now opens the authentic WordPress preview in a separate tab while retaining the approval screen. Verified overdue Fulginiti gets Approve & publish and September 15 Epstein PIP gets Approve & schedule, both disabled until user review confirmation.
- Aron's ready-draft primary action now reads Review & approve and opens the same final review screen; its secondary final-approval link also goes directly there.

### September 10: Fulginiti final publication retry
- User explicitly authorized retry after the initial FAQ identity failure. Draft FAQ identifiers still used `?p=7620#faq` while publication assigns a clean permalink.
- Added a shared schema permalink rebasing helper and applied it before strict live checks; it preserves FAQ wording, citations, fragment anchors, organization URLs, and other unrelated fields. TypeScript and regression assertions passed.
- First authorized retry rolled back because the uncached live-schema snapshot was unavailable. Added a unique verifier query parameter to bypass previously cached draft/404 responses; strict live verification and rollback remain enabled.
- Completed authorized Fulginiti publication through its native WordPress editor after backing up and rebasing the exact draft schema via the Application-Password bridge. WordPress confirmed Published; AMPLIFY's authenticated status refresh now recognizes publish and the clean public URL.
- Browser verified canonical/index-follow, exactly one FAQPage, ten visible questions with matching public IDs/URLs/answer anchors, all ten answer texts and citation lists matching, and three loaded approved CTA images.
- Public URL: https://www.fulginiti-law.com/is-it-better-to-settle-with-insurance-or-hire-a-pennsylvania-truck-accident-lawyer/
- Remaining integration issue: Cloudflare blocks server-side public HTML verification (HTTP 403 / Just a moment) although Application-Password REST operations succeed. Do not describe the automated publishing flow as fully repaired; it still needs an authenticated/approved verification route to avoid browser fallback.

### September 10: stale scheduled warning fix
- Removed archive exclusion from the authenticated status checker. Archived entries with nonterminal WordPress status still require refresh; deleted and terminal published/trashed entries remain excluded.
- Confirmed WordPress status now also reconciles the matching editorial slot status without changing its assigned publication date. Requests remain batched by client and post type using saved Application Passwords.
- Added an authorized diagnostic view for Fulginiti post 7493 to compare the prior shared status with an authenticated, fresh REST response.
