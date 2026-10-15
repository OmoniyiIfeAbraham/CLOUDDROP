# Password recovery frontend

The login page links to `/forgot-password`. A valid email is posted to `POST /api/v1/auth/forgot-password` as `{ email }`. The UI always displays the same conditional confirmation after success, without asserting that an account exists or delivery succeeded. Both password endpoints return a success envelope with a `message` and no `data`; the frontend explicitly accepts that contract.

`/reset-password?token=…` reads exactly one nonempty token. It requires a new password of at least eight characters and a matching confirmation, then posts only `{ token, newPassword }` to `POST /api/v1/auth/reset-password`. Missing tokens offer a new-link request; `INVALID_OR_EXPIRED_RESET_TOKEN` shows a fresh-link action for invalid, expired and already-used links. Other errors leave the form available for retry. Submission buttons and inputs are disabled while pending. Successful reset removes the consumed token from the current history entry, unmounts the password inputs and clears the current browser's session before offering sign-in.

Recovery routes are public even when a browser already has a session or session restoration fails. They share the login/registration layout. Field errors have stable labels and descriptions, invalid submissions focus the first field, and confirmation/error screens focus their headings. A `no-referrer` document policy prevents the reset query string from being sent as a referrer. Tokens and passwords are never put in local/session storage or rendered as text.

## Configuration and rollout coordination

As implemented in the merged backend commit `8704ee7`, `FRONTEND_URL` is the **origin only**, not the full reset page. The backend appends `/reset-password?token=…`. For the existing CloudDrop deployment address, coordinate this backend setting with Eunice and Samuel:

```dotenv
FRONTEND_URL=https://clouddrop-c8.duckdns.org
```

The resulting frontend page is `https://clouddrop-c8.duckdns.org/reset-password?token=…`. Do not configure `FRONTEND_URL` with `/reset-password` already appended. Keep this setting in the backend environment, not a `VITE_` variable. The deployment must serve the frontend application for direct `/forgot-password` and `/reset-password` requests, proxy `/api/v1/` to the backend, build with `VITE_USE_MOCK_API=false`, and have the existing password-reset migration and production email credentials applied by their owners. This frontend work does not apply shared migrations, configure shared environments or deploy anything.

Before shared-environment testing, agree the release and settings with Eunice. After deployment, use a coordinated test account to verify real email arrival, the correct HTTPS link, reset, login with the new password, rejection of the old password, used-link rejection and expiry. Check registration → email verification → login separately. A passing isolated test does not confirm production Resend configuration or email deliverability.

## Isolated tests

`npm run test:recovery` runs HTTP fixture tests against the real frontend transport in desktop/mobile Chromium and WebKit. It covers generic confirmation, validation, API payloads, accessible feedback, missing/expired/used links, pending states, error retry and a failed session restore. Automated accessibility and horizontal-overflow checks cover the recovery forms and result states. Screenshots contain only empty fixture forms, never real reset links or passwords. These cases use no backend database or email provider.

For real backend tests, follow [the private mailbox setup](live-email-verification.md), use a disposable PostgreSQL database with all migrations, and set this additional **backend** variable when starting the local E2E server:

```dotenv
FRONTEND_URL=http://127.0.0.1:4177
```

The existing `NODE_ENV=test` private transport also captures password-reset messages as recipient-specific `*.reset.json` files (0600). It has the same disposable-recipient, private-directory and non-production restrictions as verification codes. Verification and reset messages have separate paths. Neither Resend nor development token logging is used. The live reader checks request freshness, recipient and the exact frontend origin/path before opening a link. Traces, videos and automatic screenshots remain disabled; failures omit links, tokens and request payloads. Remove the mailbox and disposable database after testing.

```bash
E2E_BASE_URL=http://127.0.0.1:25000 CLOUDDROP_LOCAL_FRONTEND=true \
  npm run test:live -- e2e/live-auth.spec.ts e2e/live-files.spec.ts e2e/live-password-recovery.spec.ts
```

This checks real registration/verification, restoration, empty library, recovery request, same response for unknown email, reset through the privately delivered link, changed-password login and used-link rejection. Existing live/S3 opt-in conditions remain in place. No S3 credentials are needed for these three specs.

Demo mode sends no email and changes no real password. Its confirmation offers a sample reset link, valid for one use within 30 minutes in the running page. Refresh resets the demo service; real links require live mode.

## Validation on October 15, 2026

Based on `main` at `6c84afe` (including backend password-reset PR #47):

| Check | Result |
| --- | --- |
| Frontend unit tests | 146 passed |
| Backend regression tests | 107 passed |
| Recovery UI fixtures | 20 passed across desktop/mobile Chromium and WebKit |
| Real backend auth, library and recovery | 12 passed across the same four browser projects |
| Standard demo UI regression | 20 passed; 16 expected live-only skips |
| Frontend build, app/E2E types, lint and backend build | Passed |
| Empty recovery-form screenshots | Eight saved locally |

The live run used a dedicated PostgreSQL 16 container with all four migrations, thirteen disposable accounts (all verified, including a separate expiry-check account), and the private test mailbox. No reset/verification messages remained after the checks. A separate actual-backend check verified a 30-minute token lifetime and hashed token storage, then moved only the disposable account's expiry into the past: reset returned `400 INVALID_OR_EXPIRED_RESET_TOKEN`, the password hash stayed unchanged and the original password still signed in. This simulates expiry without waiting 30 minutes. Production Resend delivery, deployment routing and physical-device testing remain rollout checks.

Two unchanged frontend tests timed out during an initial run alongside browser tests. A standalone rerun passed all 146 tests with the original timeouts. No shared database, production email delivery or shared deployment was used.
