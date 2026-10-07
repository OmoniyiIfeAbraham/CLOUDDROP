# CloudDrop frontend

React, TypeScript, and Vite application for CloudDrop's authenticated file workspace.

## Run locally

Use Node.js 24 (recommended; `.nvmrc`) or Node.js 22.12 or newer in the 22.x line. The system Node.js 18 is not supported by this dependency set. With nvm installed, run `nvm use` from `frontend/` before the commands below.

```bash
cd frontend
npm ci
npm run dev
```

Open the URL printed by Vite. Development defaults to an in-browser demo (`.env.development`), so the app is usable without the backend. Sign in with any valid email and a password of at least eight characters. Demo data and uploads are local to the running page; refresh resets file changes. The demo is not an authentication or storage service.

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

## API integration

The live frontend targets these provisional routes on the backend feature branch: `/auth/register`, `/auth/login`, `/auth/me`, `/files`, `/files/search`, `/files/:id`, `/files/upload`, `/files/:id/download`, `/files/:id/share`, and `/files/:id` DELETE, all under `/api/v1`. Uploads use one multipart request per file with `file` and `category` fields. Downloads and sharing request a fresh presigned URL per action.

The backend currently has no category-list, dashboard-statistics, server-side category filter, or pagination endpoint. Category options are the known backend enum; library category filtering and ten-row paging are client-side. Dashboard totals are derived from the loaded file list, not presented as server statistics. The implemented share route is **GET**, despite an earlier team contract listing POST. Confirm these choices with the backend owner before release.

## Production handoff

Build with `VITE_USE_MOCK_API=false` and `VITE_API_BASE_URL=/api/v1`. Serve `dist/` as static files, fall back to `index.html` for application routes, and proxy `/api/v1` on the same origin to Express. If a separate frontend origin is chosen, configure backend CORS explicitly and test authentication, upload, and presigned URL behavior. Confirm proxy upload limits and timeouts for the backend's 2 GB file limit; a frontend size check does not make the server or proxy capable of handling that size.

Live backend and deployment-environment smoke tests remain necessary. A passing demo-mode browser suite does not verify S3, PostgreSQL, reverse-proxy behavior, or backend response compatibility.
