# Post-publication links

The September 13, 2026 instruction applies to every client: after publishing, reconcile internal links only in body bulleted lists. Do not insert links in prose or theme areas.

`go-live` queues work for new pages, enhancements, already-finalized retries, AOPs, Sub-AOPs and scheduled blogs. The upload cron drains the durable link queue. Scheduled jobs inspect WordPress and wait for actual public status. Jobs use the client's existing encrypted connection. A queue entry is not verified completion.

The planner uses explicit body community rosters, actual WordPress parent relationships, title location/practice identities and configured main practice URLs. Ambiguous destinations, unsupported identities/languages or missing rosters remain `needs_attention`, so an operator must resolve them under the standing rule. Never guess an unrelated link to achieve a green status.

The worker backs up editable WordPress content before writes, checks for intervening edits, preserves page identity and publication status, and verifies navigation lists in both WordPress's rendered content and anonymous public HTML. A stale public cache remains pending even when the API save succeeds. Clearing that cache and rerunning verification is required. Publication is not rolled back solely because a link or cache check needs attention.

`/post-publication` provides authenticated batch reconciliation and progress for existing live pages. Retries retain originals in the backup records. Existing pages changed for reciprocal links receive their own pending indexing records.

Individual Search Console Request indexing submissions are a separate operator step. The worker records pending URLs, never invents acceptance or treats a sitemap submission as the individual request. Record accepted requests or a specific quota/access blocker in the audit log.

Regression tests: `node --experimental-strip-types --test scripts/post-publication-links.test.mjs scripts/legal-directory-labels.test.mjs`.
