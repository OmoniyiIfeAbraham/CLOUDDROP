# Combined frontend integration and UI/accessibility QA

Date: October 13, 2026. Scope: OTM/Michael and Jerry's frontend/mobile/accessibility assignments. Baseline: latest `main` at `af2cd7743cacc8c5ab872094f8941f3d2c648384`; PR #40 is merged. Local `main` was fast-forwarded to that release. Fixes are isolated on `fix/frontend-final-qa`.

## Release status

**The frontend fixes are ready for review. Production acceptance is still blocked.** The current site serves `index-DRwGMJj2.js` / `index-B5jMUyKt.css`, with editable upload categories, no separate View action and the older download behavior. Actual production download responses lack attachment/filename and binary-content overrides. A compatible frontend/backend release and passing live full flow remain required before submission signoff.

Testing used disposable accounts and the actual deployed API at `https://clouddrop-c8.duckdns.org`, with no fabricated API responses. Linux desktop/mobile Chromium and WebKit were exercised. A second environment ran the latest local frontend against that same real backend through a development proxy; it is explicitly separate from the deployed UI. The selected source screenshots and live checks precede the final expiry-formatting/PDF capability refinements, which have separate regression coverage.

## Recorded runs

| Environment / run | Scenario results | What the results establish |
| --- | --- | --- |
| Existing deployed live-auth/files/full-flow suite, desktop/mobile Chromium | 4 passed, 2 failed | Registration/login/logout/restoration/invalid-token handling and empty library/search pass. Full flows stop at the deployed editable-category mismatch. |
| Expanded deployed matrix, desktop/mobile Chromium and WebKit | 8 passed, 17 failed, 3 intentionally skipped | All four browsers pass authentication/empty-list flows. Scenario failures include stale release UI and old completion labels; downstream checks are detailed separately. |
| Deployed upload/download follow-up, all four browsers | 4 recovery scenarios passed, 4 workflows failed | Corrected upload-completion observation reaches the later real integration steps. The workflows retain strict release, filename and download expectations. |
| Latest local frontend with actual production API, all four browsers | 16 passed, 9 failed, 3 intentionally skipped | 87 detailed checks pass; 11 fail on backend Unicode names/download headers/short links. Full-flow acceptance remains red. |

Scenario counts are not counts of individual assertions. [The CSV](final-qa-checks.csv) contains **200** detailed expected/actual/pass/fail rows from the three expanded runs. The short-link backend contract runs once to avoid redundant share records; the other three browser copies intentionally skip that one case.

## Verified behavior

Across the four browser configurations, real registration, login, logout, session restoration, invalid-session redirection, empty library and no-result search work. Twelve actual uploads per populated workflow produce the expected dashboard: 12 files, 203 bytes, 11 Documents and 1 Image; the UI shows two categories used. Server pagination returns 10/2 rows; category filtering, search, details, anonymous share-content retrieval and deletion pass. Uploaded file bytes match the shared content. The removed file returns 404 through the API; a deleted object's prior S3 share URL also returns 404.

Browser offline failure, online retry and outgoing-request cancellation pass against the real API setup. Progress and cancellation screenshots are saved. The cancellation case deliberately stalls/aborts the outgoing request before it reaches the backend; it proves client behavior, not S3/database rollback for an upload already processing on the server.

The latest source passes automated axe checks, keyboard navigation, mobile navigation focus, Share/Delete/Download dialog focus, and layouts at 320, 390, 768 and 1440 pixels. Reduced-motion settings and unsupported-file feedback remain usable. These automated checks do not replace physical-device, native zoom or human screen-reader testing.

## Confirmed findings and owners

| Finding | Expected / actual | Status and owner |
| --- | --- | --- |
| Deployed frontend behind merged UI | Read-only categories, View and automatic saving / editable dropdowns, missing View and inline navigation | Verified release mismatch. Samuel deploys the reviewed frontend and verifies the release. |
| Unicode upload filename | `Résumé notes (final).txt` / stored as `RÃ©sumÃ© notes (final).txt` | Reproduced through actual browser multipart uploads in all four configurations and an independent API upload. Eunice reviews UTF-8 filename decoding before metadata/storage-key creation. |
| Production download headers | Signed attachment/original name and `application/octet-stream` / plain inline URL and `text/plain`, no disposition header | Verified. Main already contains an attachment implementation, but production does not exhibit it; Samuel verifies deployment. Eunice adds inline/attachment query support and retains canonical filenames. |
| Short links | HTTPS CloudDrop `/s/token` URL / direct S3 URLs for 1/24/168-hour requests | Verified not available in production. Eunice implements the agreed resolver; Samuel routes `/s/` to it before the SPA fallback. |
| Generic dialog focus | Return to the invoking control after close, including disabled/unfocused activation and removal / relies on native restoration | Explicit invoking-control/fallback focus implemented. Natural Linux Escape behavior passes; additional controlled missing-native-focus regression is strict. Windows/Safari device confirmation remains open. |
| Sharing expiration rendering | Use absolute server deadline and truthful remaining duration / server `expiresAt` discarded and a new receipt-time deadline calculated | Frontend preserves absolute expiry, refuses already-expired responses, and formats short remaining lifetimes correctly. HTTPS short links are preserved and consumed through the existing response interface. |
| PDF View capability | Avoid PDF navigation if no inline viewer is available / iframe navigation attempted regardless of support | Controlled unsupported-viewer case reproduced; capability guard added. [MDN documents the inline-viewer capability](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/pdfViewerEnabled) and download fallback. |
| Supported Node runtime | Dependency-compatible version / frontend claimed Node 22.12+/24.0+ | Engines/docs corrected to Node 22.22.2+ or 24.15+ within those major versions. |

The audit's Windows WebKit `Résumé` → `Resume` suggested-filename fallback is **not reproduced on Linux**. The strict Unicode filename/bytes assertion remains in the HTTPS fixture suite; it was not weakened to accept ASCII. [Playwright documents browser-derived suggested filenames](https://playwright.dev/docs/api/class-download#download-suggested-filename). Repeat the original Windows environment or target macOS/iPhone Safari after canonical upload names and S3 headers are corrected. Do not conflate this platform finding with the separately confirmed production upload corruption.

## Frontend validation

Typecheck, lint and production build are required gates for this branch. The existing full unit run passed 112/113 with one unchanged metadata query timing out under heavy concurrent host load; the affected file and audit regressions then passed (34 tests). Expiry refinements also passed (21 tests). The final PDF/expiry/file-action regression run passed 23 tests; the original formatter duration coverage is retained with added boundary cases. Final unit total is 116, to be rechecked in CI.

The download/preview suite passed all 18 earlier cases with strict Unicode/byte/focus checks. All three added PDF capability cases pass across its browser projects (21 download/preview cases in total). The expiry regression now uses the browser clock instead of a half-second wall-clock race; fixture startup has a 60-second case limit and 10-second assertion limit. The default UI run passed 17 cases with three 30-second host timeouts and 14 opt-in live cases skipped; all affected scenarios passed in a focused four-case rerun with a local 120-second case limit. CI retains the default UI timeout. Final CI results will be recorded in the PR and private runbook.

## Evidence

Raw private reports/screenshots are retained outside the repository under `frontend-evidence-2026-10-13/final-qa/`. Selected synthetic-account screenshots are included here. Explicit share screenshots mask URLs; production traces are disabled. Test upload cleanup completed with zero files remaining in the disposable accounts. Account rows remain because the API has no account-deletion route. Backend fault consistency and the independent two-user/security audit remain with their assigned owners.

| Screenshot | Environment |
| --- | --- |
| [Corrupted Unicode name](qa-evidence/production-unicode-file.png) | Deployed frontend/API |
| [Mobile library](qa-evidence/production-files-mobile.png) | Deployed mobile WebKit |
| [Cancelled upload](qa-evidence/production-upload-cancelled.png) | Deployed mobile WebKit; outgoing request aborted before the server |
| [Automatic categories](qa-evidence/source-upload-categories.png) | Latest local frontend / actual backend |
| [320px file actions](qa-evidence/source-files-mobile.png) | Latest local frontend / actual backend; mobile WebKit |
| [Dashboard](qa-evidence/source-dashboard.png) | Latest local frontend / actual backend |
| [Share dialog, URL masked](qa-evidence/source-share-masked.png) | Latest local frontend / actual backend |
| [Missing-file feedback](qa-evidence/source-file-missing.png) | Latest local frontend / actual backend |

## Remaining acceptance

1. Review/merge the frontend QA PR after its checks pass.
2. Eunice corrects canonical Unicode upload names, honors inline/attachment disposition and supplies the short-link contract. See [download handoff](backend-download-handoff.md), [category enforcement](backend-category-handoff.md) and [short-link handoff](backend-short-links-handoff.md).
3. Samuel deploys a compatible immutable frontend/backend pair, applies required migrations and confirms public `/s/` routing. Then repeat `E2E_BASE_URL=https://clouddrop-c8.duckdns.org npm run test:live` until every required live scenario passes.
4. Verify actual 24-hour/7-day token behavior with backend controlled-clock tests and deployed resolution. Immediate retrieval and TTL metadata do not establish full lifetime. The group's 1-hour elapsed-expiry test is reported by the group, not independently repeated here.
5. Complete physical Safari/mobile, 200% native zoom and NVDA/VoiceOver review using [the manual checklist](accessibility-review.md). Native PDF/media rendering also needs target-device acceptance.
6. Kizman independently verifies isolation/JWT/security/failure consistency; Samuel verifies infrastructure and automatic deployment/rollback. Those items are not certified by this frontend QA report.

Frontend fixes are ready for review after the final checks. Allow approximately 30–60 minutes for another full automated live matrix once backend fixes and the compatible release are deployed; device/screen-reader completion depends on access to those devices.
