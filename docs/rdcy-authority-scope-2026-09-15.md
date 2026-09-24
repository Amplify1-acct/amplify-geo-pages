# RDCY Sean Domnick authority scope

The user reconfirmed on September 15, 2026 that the Sarasota FL and St. Petersburg FL attorney-selection blogs must focus on Sean Domnick. Their prior writing jobs failed because the reviewer demanded additional Gale and Kruegel profiles despite that direction.

A server-owned scope policy now matches only the exact two assigned titles on pbglaw.com, including known draft/revision suffixes. Generation, automatic correction, and the independent reviewer use the same policy. The review cache includes the scope. All eight evidence categories, source checks, attribution rules, and publication approval remain required. Other articles and clients retain their existing scope. Article text cannot opt itself into the exception.

Verification: ten focused authority tests pass, including scope boundaries, actual reviewer prompt propagation, and rejection of unsupported review scores even within the Sean scope. Full build/deployment status is recorded in the task's research-and-retry-status.md.

Source corrections for the next writing pass are preserved in output/rdcy-authority-2026-09-15/sean-only-direction.txt at the workspace root. They include both AAJ 2026 awards, the direct Hill URL with retrieval limitation, and the historical ClearlyRated predecessor-firm profile. These research notes are not completed article validation.

## Per-order lawyer selection

The new-blog form now has an optional “Lawyer to feature” field. The order stores `authorityAttorney` in the tracker and review queue; generation stores it in response metadata. Writing, FAQ repairs, authority repairs, source audits, WordPress draft checks, and the final saved-draft audit use the selection. Retries and writing revisions preserve it. Changing clients clears the form value. Blank values preserve firm-wide coverage, with the original two-job compatibility rule retained for the running Sean jobs.

The field accepts a name up to 120 characters. Prompts require verification of the named lawyer's firm relationship and relevant practice experience, and prohibit transferring colleagues' credentials. Selecting a lawyer never establishes their qualifications or waives evidence checks. Existing approved records retain their stored selection during tracker synchronization.

Validation: TypeScript passed; eleven authority regression tests passed, including explicit selection, legacy fallback, evidence rejection and cache separation when the selected lawyer changes.

Deployment dpl_2EFLSUSrGDDTdvxSXJ3vovMqmg6A passed all production prebuild checks and the production build, reached READY, and was aliased to amplify-geo-pages.vercel.app. No existing article jobs were restarted during the field rollout.
