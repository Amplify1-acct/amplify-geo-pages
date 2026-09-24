# Aron queue status repair — September 9, 2026

The review queue now reads draft, pending, private, scheduled, published, and trash statuses from WordPress. Checking status does not rebuild a WordPress draft. Scheduled posts show the saved WordPress date in America/New_York. Intake-copy markers distinguish confirmed preparation requirements from unverified final checks. Failed checks display an error instead of silently hiding the failure.

Live verification of the seven active approved blogs:
- Epstein government claims, post 17713: draft, intake marker present.
- Epstein PIP coordination, post 17714: draft, intake marker present.
- Drazen Uber/Lyft insurance, post 1303: draft, no intake marker; readiness not certified by a status read.
- RDCY birth malpractice, post 19271: scheduled September 14, 2026, 9 AM Eastern.
- Angiuli parenting time, post 3204: draft, no intake marker; readiness not certified by a status read.
- Fulginiti settlement, post 7620: draft, intake marker present.
- Fulginiti medical-device recall, post 7621: scheduled September 16, 2026, 9 AM Eastern.

The first deployment's reconciliation incorrectly reopened 53 historical archives. The correction excludes archived entries from refresh, preserves archive membership when saving statuses, and restores those exact documents through aron-archive-restoration.ts. The restoration timestamp records the repair, not their original archive date. No WordPress content, status, or publication date was changed by this work.

Validation: TypeScript, targeted ESLint, 14 queue/status regression tests, 40 FAQ checks, 6 directory checks, and successful Vercel production build.
