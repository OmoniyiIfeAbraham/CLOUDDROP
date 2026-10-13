# CloudDrop frontend

React, TypeScript, and Vite application for CloudDrop's authenticated file workspace.

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
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npx playwright install webkit
npm run test:downloads
```

Playwright also needs the host's Chromium system libraries. The browser suite runs against the demo Vite server and checks desktop and mobile flows. The production build is emitted to `frontend/dist/`.

To check authentication against a running local backend on port 5000, use a backend database intended for testing, then run:

```bash
VITE_USE_MOCK_API=false VITE_API_BASE_URL=/api/v1 npm run test:e2e -- e2e/live-auth.spec.ts
```

This opt-in test creates a unique account for each browser project and checks registration, session restoration, logout, login, and invalid-token/session handling. It is skipped in the default demo-mode suite. A deployed backend still needs a separate environment check.

To check the file library's empty-list and search responses through that backend, run:

```bash
VITE_USE_MOCK_API=false VITE_API_BASE_URL=/api/v1 npm run test:e2e -- e2e/live-files.spec.ts
```

To check the whole flow against a backend with working S3 (register, sign in, upload, list and search, download, share with a 1-hour link, delete), run:

```bash
VITE_USE_MOCK_API=false VITE_API_BASE_URL=/api/v1 npm run test:e2e -- e2e/live-flow.spec.ts
```

Each step saves a screenshot under `test-results/`. The test also fetches the download and share links to confirm they return the uploaded content, and checks that the share link stops working after deletion. To run it against a deployed site instead of a local dev server, set `E2E_BASE_URL`:

```bash
E2E_BASE_URL=https://<deployed-host> VITE_USE_MOCK_API=false npm run test:e2e -- e2e/live-flow.spec.ts
```

The file-library and full-flow tests also create unique test users. The full-flow test removes its uploaded file in a final cleanup step even if a later assertion fails; test accounts remain in the database. The current backend supports server-side category filtering, filename search, pagination, and dashboard statistics.

The download fixture suite starts the app in HTTP API mode and a separate local HTTPS file server, then tests desktop Chromium, mobile Chromium, and mobile WebKit without a backend database or S3. It checks saved bytes/Unicode filenames, inline-link rejection, separate previewing, cancellation, retry, expiry, narrow layout, and explicit dialog focus restoration. It requires `openssl` to generate disposable test certificates; certificate checking is relaxed only in this local fixture configuration.


## Final live QA

Run the deployed application with actual authentication, PostgreSQL and S3:

```bash
E2E_BASE_URL=https://clouddrop-c8.duckdns.org npm run test:live
```

The opt-in runner uses desktop/mobile Chromium and WebKit, one worker, unique QA accounts, real uploads and final cleanup. It writes screenshots, expected/actual checks and JSON results to ignored `test-results-live/`. No API responses are mocked. The recovery case briefly disables browser networking; the client-cancellation case stalls/aborts an outgoing request before it reaches the backend. These checks do not prove server-side rollback. Share-link fields are masked in explicit screenshots and tracing is disabled; inspect other failure artifacts before sharing them. Test accounts remain because the API has no account deletion route.

To check the local frontend source against the same real deployed backend while awaiting a frontend deployment:

```bash
E2E_BASE_URL=https://clouddrop-c8.duckdns.org CLOUDDROP_LOCAL_FRONTEND=true npm run test:live
```

This starts a local UI with mocks disabled and proxies actual API requests to the HTTPS deployment. It does not change production or establish which UI is deployed. Keep its results separate from the deployed-site run. `CLOUDDROP_QA_OUTPUT` and `CLOUDDROP_QA_REPORT` can direct evidence to a private folder outside the repository. Actual 24-hour/7-day expiration, physical-device Safari and a human screen-reader review remain separate acceptance checks.

## View and download behavior

View and Download are separate actions on the dashboard, library and file details page. View opens a preview dialog for supported images, video, audio, plain text and PDFs when the browser reports inline PDF support; unsupported formats show an explanation. Download starts saving automatically after receiving a fresh signed attachment/binary link. A Save file link remains available if the browser blocks the automatic action. Preparation can be cancelled, errors retried, and expired links renewed.

The frontend requests `disposition=inline` for viewing and `disposition=attachment` for downloading on the existing download endpoint. It never edits a signed URL, forwards bearer tokens to storage, or treats an inline preview as a successful download. The merged backend signs attachment/binary download headers, but still ignores the disposition query and therefore needs inline delivery support for View. The deployed backend revision must also be verified separately. See [the backend download handoff](docs/backend-download-handoff.md) and [the final QA report](docs/final-qa-report.md) for the source/deployment distinction.

The remaining human screen-reader check is described in [the accessibility review](docs/accessibility-review.md).

## API integration

The live frontend targets the routes mounted on `main` and listed in `docs/API.md`, all under `/api/v1`: `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `GET /files` (with `page` and `limit`, plus `search` and `category` when set), `POST /files` (upload), `GET /files/:id`, `GET /files/:id/download`, `POST /files/:id/share`, and `DELETE /files/:id`. Uploads use one multipart request per file with `file` and `category` fields. Each file's category is assigned automatically from its MIME type using the same rules as `backend/src/lib/category.ts`. The queue shows a read-only category label, and the upload transport derives the category directly from the file; callers cannot supply an override. Server-side enforcement is tracked in [the category handoff](docs/backend-category-handoff.md). Uploads continue while the user moves between pages and can be cancelled. Downloads request a fresh signed URL per action; sharing displays the HTTPS URL returned by the backend, including the agreed CloudDrop short-link format. The user chooses a share lifetime of 1 hour, 1 day, or 7 days, sent as `ttlHours`; the dialog uses the backend's absolute `expiresAt` when supplied, with `expiresIn` as a compatibility fallback. See [the short-link handoff](docs/backend-short-links-handoff.md).

The file library asks the backend for one page of 10 files at a time, with the search term and category applied on the server, and shows the backend's total count. The dashboard reads its totals from `GET /dashboard/stats` and its recent files from `GET /files?page=1&limit=5`. The backend also serves `GET /categories`, but its values match the category enum the frontend already uses, so the frontend deliberately retains a fixed six-category catalog rather than fetching it for these controls.

## Production handoff

Build with `VITE_USE_MOCK_API=false` and `VITE_API_BASE_URL=/api/v1`. Serve `dist/` as static files, fall back to `index.html` for application routes, and proxy `/api/v1` on the same origin to Express. If a separate frontend origin is chosen, configure backend CORS explicitly and test authentication, upload, and presigned URL behavior. Uploads are limited to 25 MB per file, matching the backend. The reverse proxy must accept request bodies a little larger than that to allow for multipart overhead (for example, Nginx `client_max_body_size 30m;`); Nginx's default of 1 MB rejects most uploads with 413.

Live backend and deployment-environment smoke tests remain necessary. A passing demo-mode browser suite does not verify S3, PostgreSQL, reverse-proxy behavior, or backend response compatibility.
