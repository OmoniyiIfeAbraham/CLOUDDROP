# Short sharing links: frontend integration handoff

Prepared October 13, 2026 for Eunice (backend) and Samuel (routing/deployment). The user confirmed agreement to short CloudDrop links. This handoff preserves the current response interface; the exact implementation and deployment remain backend owner work.

The frontend already consumes `POST /api/v1/files/:id/share` with `{ "ttlHours": 1 | 24 | 168 }`. Return the existing success envelope with `data.file`, `data.shareUrl`, `data.expiresIn` and the absolute ISO `data.expiresAt`. `shareUrl` should be an HTTPS CloudDrop link such as `https://clouddrop-c8.duckdns.org/s/Ab7kP2xQ`. The UI displays, copies and opens that URL unchanged; it does not need the separate raw token field. Absolute expiry now drives the displayed expiration date and expiry timer, with `expiresIn` retained for compatibility.

The public `/s/:token` resolver must validate the stored token, expiry and file availability without requiring the recipient to log in. It should issue a fresh short-lived S3 URL for each valid opening, enforcing the selected lifetime on the CloudDrop token rather than promising the lifetime of one role-signed S3 URL. S3 stays private. Expired/deleted/invalid links need clear responses and must not redirect to an object. Validate TTLs and handle failed signing/database operations consistently.

The current public proxy forwards `/api/v1/` to Express and every other application path to the frontend. Samuel and Eunice must ensure `/s/` reaches the public backend resolver before the SPA fallback. The frontend's existing protected fallback would otherwise send anonymous recipients to login. If the agreed design instead requires a frontend recipient page, provide its resolver endpoint and response/error contract before adding that page.

## Acceptance

- The current creation endpoint returns a short HTTPS CloudDrop link, correct selected lifetime and absolute expiry for 1 hour, 24 hours and 7 days.
- The UI displays/copies the exact returned URL and date on narrow and desktop layouts.
- An anonymous browser can open a valid short link and retrieve the original bytes; no app JWT is forwarded to S3.
- Token expiry is enforced even when new S3 URLs are issued. Cover expired, unknown and deleted-file tokens with backend controlled-clock tests plus deployed routing checks.
- Confirm genuine long-duration behavior. Immediate retrieval and TTL metadata alone do not prove a link lasts for 24 hours or 7 days.

`npm run test:live` includes the real creation/short-link resolution gate. Frontend unit/transport tests cover the short URL and absolute expiry contract; their controlled responses are not a claim that the backend resolver is deployed.
