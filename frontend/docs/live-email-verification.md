# Live E2E email verification

The registration contract is now `POST /api/v1/auth/register` → 201 with `data.user` and **no token**. The UI stays on **Verify your email**. The tests read the account's generated code through a private test transport, submit the verification form to `POST /api/v1/auth/verify-email`, and use the returned session token only after its 200 response. Authentication coverage also checks that unverified login returns 403 and unauthenticated file access returns 401.

`123456` belongs only to the frontend mock service. Live tests never use a fixed code, change a database verification flag, scrape application logs, or add a public code-retrieval endpoint.

## Isolated delivery

Set the same **non-VITE** `CLOUDDROP_E2E_MAILBOX_DIR` in the backend process and Playwright runner. This must be an absolute directory readable only by the current test user (0700), outside the repository and web root. The backend accepts it only with `NODE_ENV=test`, writes 0600 messages for unique `qa-…@example.test` recipients and bypasses Resend and development code logging. An atomic replacement gives a resend its new code without exposing partial JSON. Normal email delivery is unchanged when the variable is absent; production/development startup refuses a configured test mailbox.

Start the backend through `npm run start:e2e`, which binds only to `127.0.0.1` and writes a private, per-run instance marker. Its health response carries that instance identifier. Before registration, the helper requires the private marker and a matching health response through the UI origin. A production server started normally has neither this wrapper nor this header, so a mistaken target fails **before account creation or email delivery**. The header contains no verification code or session token and is not an authentication bypass.

Messages are correlated to the exact generated email and registration time. The reader rejects missing/stale/malformed messages, wrong recipients, symlinks and unsafe permissions. It removes each message after the verification attempt. The backend and runner need access as the same user to this temporary directory; remote test deployments require a secure shared mount and a tunnel to the loopback test backend. Do not publish or upload the mailbox or backend environment files.

## Local auth and file-library run

Use Node 24.15+ for the backend, a disposable PostgreSQL database and two terminals. These commands do not configure or migrate a shared/production database. Replace the example database URL with an **isolated local test database**, never the application database.

In the repository root:

```bash
export CLOUDDROP_E2E_MAILBOX_DIR="$(mktemp -d /tmp/clouddrop-e2e-mailbox.XXXXXX)"
chmod 700 "$CLOUDDROP_E2E_MAILBOX_DIR"
```

Keep that exact path for both terminals. In `backend/`:

```bash
npm ci
export NODE_ENV=test
export DATABASE_URL=postgresql://clouddrop_test:clouddrop_test_only@127.0.0.1:25432/clouddrop_email_e2e
export JWT_SECRET=isolated-e2e-secret-not-for-production
export PORT=25000
npx prisma generate --config prisma7.config.ts
npx prisma migrate deploy --config prisma7.config.ts
npm run start:e2e
```

In another terminal, export the **same mailbox path**, then in `frontend/`:

```bash
npm ci
npx playwright install chromium webkit
E2E_BASE_URL=http://127.0.0.1:25000 CLOUDDROP_LOCAL_FRONTEND=true \
  npm run test:live -- e2e/live-auth.spec.ts e2e/live-files.spec.ts
```

The live configuration starts the latest frontend on port 4177 with mocks disabled and proxies API/health requests to the isolated backend. HTTP is allowed only for loopback targets; other targets require HTTPS. The four desktop/mobile Chromium/WebKit projects exercise real registration, verification, login/logout, restoration and empty-library/search API calls. These cases do not need S3 or email-provider credentials.

## Full storage / QA run

Once the isolated backend also has a dedicated test bucket/credentials and routing, the same setup supports:

```bash
E2E_BASE_URL=https://<isolated-test-ui> npm run test:live
```

The UI origin must forward `/health` and `/api/v1/` to the E2E backend wrapper. `/s/` must reach the public share resolver. Configure `PUBLIC_APP_URL` for that test origin; never let short links default to production. The UI requires HTTPS preview/download/share links. A storage emulator needs trusted local TLS and isolated credentials as well as migrations; running auth/library tests alone does **not** certify S3, sharing or deletion.

## Skips, evidence and cleanup

The existing conditions are retained: ordinary live auth/files require `VITE_USE_MOCK_API=false`, the full flow keeps its existing real-backend/S3 opt-in, the expanded QA suite still requires `CLOUDDROP_LIVE_QA=true`, and the share contract still runs only once. `npm run test:live` remains the explicit opt-in runner. Default CI remains in demo mode; its live skips are expected, not live acceptance evidence.

Live specs disable traces, video and automatic failure screenshots even when invoked through the default Playwright configuration. Explicit QA screenshots mask verification codes, passwords and share links. Code-entry failures use a generic message rather than browser call logs that can include the entered value. `CLOUDDROP_QA_OUTPUT` and `CLOUDDROP_QA_REPORT` can keep sanitized evidence outside the repository. No mailbox files belong in uploaded CI artifacts.

After the run, stop the E2E backend and remove the temporary mailbox. Use a fresh directory for each run; an existing instance marker prevents accidental reuse. The tests clean their uploaded files; account rows belong to the disposable database and are removed when that database is discarded. This change does not apply migrations to shared infrastructure or enable production E2E registration.

## Validation on October 14, 2026

The auth/library run above passed all eight cases across the four browser projects against the actual Express backend and a disposable local PostgreSQL 16 database with all three migrations applied. All eight accounts were verified; no message files or development code logs remained. No Resend delivery, production API calls or shared-database migrations were used. The backend regression suite passed 99 tests. The full S3/share/delete matrix was not run in this environment and retains its opt-in requirements.
