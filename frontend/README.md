# CloudDrop frontend

React, TypeScript, and Vite application for CloudDrop's authenticated file workspace.

For how the app works, see [How the CloudDrop frontend works](docs/frontend-flows.md). It covers the pages, sessions, sign-up and password reset, upload, View, Download, Share and Delete, and the API call behind each step.

## Run locally

Use Node.js 24.15 or newer in the 24.x line (recommended; `.nvmrc`) or Node.js 22.22.2 or newer in the 22.x line. These minimums satisfy the installed dependency engines. The system Node.js 18 is not supported by this dependency set. With nvm installed, run `nvm use` from `frontend/` before the commands below.

```bash
cd frontend
npm ci
npm run dev
```

Open the URL printed by Vite. Development defaults to an in-browser demo (`.env.development`), so the app is usable without the backend. Sign in with any valid email and a password of at least eight characters. `demo@clouddrop.app` starts with sample files; other demo accounts start empty. Each account's file changes stay separate in the running page, and refresh resets them. The demo is not an authentication or storage service.

To use the backend, create a local, untracked `frontend/.env.development.local` containing:

```dotenv
VITE_USE_MOCK_API=false
VITE_API_BASE_URL=/api/v1
```

Run the backend on port 5000. Vite proxies `/api` and `/health` there. The browser sends `Authorization: Bearer <token>` for protected API requests. The token is kept in `sessionStorage` as an interim arrangement, not a production security recommendation. Login, registration, and restored sessions call the backend in live mode.

## Verify

```bash
npm run typecheck
npm run typecheck:e2e
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npx playwright install webkit
npm run test:downloads
npm run test:recovery
```

Playwright also needs the host's Chromium system libraries. The browser suite runs against the demo Vite server and checks desktop and mobile flows. The production build is emitted to `frontend/dist/`.

Live registration now completes email verification before receiving a session token. See [live email verification setup](docs/live-email-verification.md) for the isolated backend, disposable database and private code-delivery transport. The mock code `123456` is never used by live tests. Existing demo/live skip conditions remain unchanged.

Password recovery is available through the sign-in page, `/forgot-password` and `/reset-password?token=…`. See [the password recovery handoff](docs/password-recovery-handoff.md) for the API contract, origin-only backend `FRONTEND_URL`, isolated reset-email tests and coordinated rollout checklist.

Registration email failures and unverified sign-ins can resume email verification and request a replacement code. See [verification recovery](docs/auth-verification-recovery.md) for the reported error sequence, isolated reproduction and email-delivery handoff.

The download fixture suite starts the app in HTTP API mode and a separate local HTTPS file server, then tests desktop Chromium, mobile Chromium, and mobile WebKit without a backend database or S3. It checks saved bytes/Unicode filenames, inline-link rejection, separate previewing, cancellation, retry, expiry, narrow layout, and explicit dialog focus restoration. It requires `openssl` to generate disposable test certificates; certificate checking is relaxed only in this local fixture configuration.


## Final live QA

After configuring the isolated E2E backend and private mailbox, run the four-browser auth and library checks without S3:

```bash
E2E_BASE_URL=http://127.0.0.1:25000 CLOUDDROP_LOCAL_FRONTEND=true \
  npm run test:live -- e2e/live-auth.spec.ts e2e/live-files.spec.ts
```

Run the full matrix only after isolated S3/HTTPS and public-share routing are ready:

```bash
E2E_BASE_URL=https://<isolated-test-ui> npm run test:live
```

The opt-in runner uses desktop/mobile Chromium and WebKit, one worker, unique QA accounts and final upload cleanup. No API responses are mocked. A private instance marker and matching backend health header are required before any registration; normal production servers are refused. Traces, video and automatic screenshots are disabled for live specs; explicit captures mask codes, passwords and share links. `CLOUDDROP_QA_OUTPUT` and `CLOUDDROP_QA_REPORT` can keep evidence outside the repository. Never include the mailbox in artifacts. Accounts remain in the disposable test database until it is discarded. Actual long-duration sharing, physical-device Safari and human screen-reader review remain separate acceptance checks.

## View and download behavior

View and Download are separate actions on the dashboard, library and file details page. View previews PDF, JPEG, PNG, GIF and WebP files, using a signed link from `GET /files/:id/view`. These are the types the backend signs for inline viewing, and a PDF also needs the browser's built-in PDF viewer. Other formats show an explanation and offer Download without contacting the backend. Download starts saving automatically after receiving a fresh signed attachment link from `GET /files/:id/download`. A Save file link remains available if the browser blocks the automatic action. Preparation can be cancelled, errors retried, and expired links renewed.

The frontend never edits a signed URL, forwards bearer tokens to storage, or treats an inline link as a successful download. See [the backend download handoff](docs/backend-download-handoff.md) and [the final QA report](docs/final-qa-report.md) for the history of the download contract.

The remaining human screen-reader check is described in [the accessibility review](docs/accessibility-review.md).

## API integration

The live frontend uses the routes mounted on `main`, all under `/api/v1`. The full list, with what each one is used for, is in [How the CloudDrop frontend works](docs/frontend-flows.md#api-endpoints-used-by-the-frontend). Uploads use one multipart request per file with `file` and `category` fields. Each file's category is assigned automatically from its MIME type using the same rules as `backend/src/lib/category.ts`. The queue shows a read-only category label, and the upload transport derives the category directly from the file; callers cannot supply an override. Server-side enforcement is tracked in [the category handoff](docs/backend-category-handoff.md). Uploads continue while the user moves between pages and can be cancelled. Downloads request a fresh signed URL per action; sharing displays the HTTPS URL returned by the backend, including the agreed CloudDrop short-link format. The user chooses a share lifetime of 1 hour, 1 day, or 7 days, sent as `ttlHours`; the dialog uses the backend's absolute `expiresAt` when supplied, with `expiresIn` as a compatibility fallback. See [the short-link handoff](docs/backend-short-links-handoff.md).

The file library asks the backend for one page of 10 files at a time, with the search term and category applied on the server, and shows the backend's total count. The dashboard reads its totals from `GET /dashboard/stats` and its recent files from `GET /files?page=1&limit=5`. The backend also serves `GET /categories`, but its values match the category enum the frontend already uses, so the frontend deliberately retains a fixed six-category catalog rather than fetching it for these controls.

## Production handoff

Build with `VITE_USE_MOCK_API=false` and `VITE_API_BASE_URL=/api/v1`. Serve `dist/` as static files, fall back to `index.html` for application routes, and proxy `/api/v1` on the same origin to Express. If a separate frontend origin is chosen, configure backend CORS explicitly and test authentication, upload, and presigned URL behavior. Uploads are limited to 25 MB per file, matching the backend. The reverse proxy must accept request bodies a little larger than that to allow for multipart overhead (for example, Nginx `client_max_body_size 30m;`); Nginx's default of 1 MB rejects most uploads with 413.

Live backend and deployment-environment smoke tests remain necessary. A passing demo-mode browser suite does not verify S3, PostgreSQL, reverse-proxy behavior, or backend response compatibility.
