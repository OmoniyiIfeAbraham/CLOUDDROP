# CloudDrop frontend

React, TypeScript, and Vite application for CloudDrop's authenticated file workspace.

## Run locally

Use Node.js 24 (recommended; `.nvmrc`) or Node.js 22.12 or newer in the 22.x line. The system Node.js 18 is not supported by this dependency set. With nvm installed, run `nvm use` from `frontend/` before the commands below.

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
```

Playwright also needs the host's Chromium system libraries. The browser suite runs against the demo Vite server and checks desktop and mobile flows. The production build is emitted to `frontend/dist/`.

To check authentication against a running local backend on port 5000, use a backend database intended for testing, then run:

```bash
VITE_USE_MOCK_API=false VITE_API_BASE_URL=/api/v1 npm run test:e2e -- e2e/live-auth.spec.ts
```

This opt-in test creates a unique account for each browser project and checks registration, session restoration, logout, login, and expired-token handling. It is skipped in the default demo-mode suite. A deployed backend still needs a separate environment check.

To check the file library's empty-list and search responses through that backend, run:

```bash
VITE_USE_MOCK_API=false VITE_API_BASE_URL=/api/v1 npm run test:e2e -- e2e/live-files.spec.ts
```

The file-library test also creates unique test users. Populated file lists and category filtering need backend test data; the current backend does not offer server-side category filtering or pagination.

## API integration

The live frontend targets the routes mounted on `main` and listed in `docs/API.md`, all under `/api/v1`: `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `GET /files` (filename search adds a non-empty `search` query parameter), `POST /files` (upload), `GET /files/:id`, `GET /files/:id/download`, `POST /files/:id/share`, and `DELETE /files/:id`. Uploads use one multipart request per file with `file` and `category` fields. Downloads and sharing request a fresh presigned URL per action. Share links use the backend's default lifetime (currently 24 hours); the dialog shows the `expiresIn` value the backend returns.

The backend serves `GET /categories`, but its values match the category enum the frontend already uses, so the frontend does not call it yet. `GET /dashboard/stats` returns 501 Not Implemented, so dashboard totals are derived from the loaded file list, not presented as server statistics. There is no server-side category filter or pagination; library category filtering and ten-row paging are client-side. Confirm these choices with the backend owner before release.

## Production handoff

Build with `VITE_USE_MOCK_API=false` and `VITE_API_BASE_URL=/api/v1`. Serve `dist/` as static files, fall back to `index.html` for application routes, and proxy `/api/v1` on the same origin to Express. If a separate frontend origin is chosen, configure backend CORS explicitly and test authentication, upload, and presigned URL behavior. Confirm proxy upload limits and timeouts for the backend's 2 GB file limit; a frontend size check does not make the server or proxy capable of handling that size.

Live backend and deployment-environment smoke tests remain necessary. A passing demo-mode browser suite does not verify S3, PostgreSQL, reverse-proxy behavior, or backend response compatibility.
