# CloudDrop

## Secure Cloud-Based File Storage and Sharing Using AWS

CloudDrop is a **file storage and sharing web application** developed by **TechCrush Cloud Computing Cohort 8, Group 3**. It gives users a private workspace to upload, organize, preview, download, delete and temporarily share files through AWS infrastructure.

**Live application:** [https://clouddrop-c8.duckdns.org](https://clouddrop-c8.duckdns.org)

**GitHub repository:** [OmoniyiIfeAbraham/CLOUDDROP](https://github.com/OmoniyiIfeAbraham/CLOUDDROP)

### Contents

- [Problem statement](#problem-statement)
- [Project objectives](#project-objectives)
- [Features](#features)
- [System architecture](#system-architecture)
- [Technology stack](#technology-stack)
- [Project structure](#project-structure)
- [Run locally](#run-locally)
- [Environment variable reference](#environment-variable-reference)
- [API overview](#api-overview)
- [Testing and production builds](#testing-and-production-builds)
- [Docker and AWS deployment](#docker-and-aws-deployment)
- [CICD workflow](#cicd-workflow)
- [Security and current limitations](#security-and-current-limitations)
- [Troubleshooting](#troubleshooting)
- [Team members](#team-members)
- [Application screenshot](#application-screenshot)
- [Further documentation](#further-documentation)

## Problem statement

Local file storage can become unavailable when a device is lost, damaged or fails. Moving files between devices and sharing them with others can also be inconvenient, especially when access should last only for a limited time.

CloudDrop addresses these problems with a browser-accessible workspace, private object storage, authenticated file management and share links with expiration times.

## Project objectives

1. **Build a working cloud application:** deliver a usable file management interface connected to a backend API.
2. **Provide private file storage:** store file objects in Amazon S3 and their ownership and metadata in PostgreSQL.
3. **Control access:** authenticate users and restrict private file operations to the file owner.
4. **Support temporary sharing:** let owners create links that recipients can use without an account until the link expires.
5. **Make deployment repeatable:** package services with Docker and automate validation, image publishing and deployment through GitHub Actions.
6. **Demonstrate team collaboration:** integrate frontend, backend, database and cloud infrastructure contributions through a shared GitHub repository.

## Features

- Registration with email verification, login, session restoration and password recovery.
- Authenticated account deletion with cleanup of the user's stored objects and database records.
- File uploads with progress, cancellation and a **25 MiB per-file limit** (shown as 25 MB in the UI).
- File listing, filename search, category filtering and pagination.
- Dashboard totals for stored files, storage usage and categories.
- Browser previews for **PDF, JPEG, PNG, GIF and WebP**. PDF preview requires the browser's built-in PDF viewer.
- Downloads through temporary S3 URLs, with attachment headers and the original filename.
- File deletion from S3 and PostgreSQL.
- CloudDrop share links at `/s/:token` with **1-hour, 1-day or 7-day expiry**; the default is 1 day.
- Responsive layouts for desktop and mobile browsers.

The backend can sign inline URLs for additional text, audio and video MIME types, but the current frontend preview gate enables only the PDF and image formats listed above. Upload support and preview support are separate: an accepted upload format is not necessarily previewable.

## System architecture

![CloudDrop AWS system architecture](docs/architecture/clouddrop-aws-slide-v4.png)

The diagram represents the repository's application and deployment configuration. Effective AWS permissions, security groups, deployed image versions and certificate renewal must be verified in the running environment.

### Request and storage flow

1. A browser loads CloudDrop over HTTPS through the DuckDNS domain.
2. Edge Nginx on EC2 terminates TLS. It sends application-page requests to the frontend container and `/api/v1/`, `/s/` and `/health` requests to the Express backend.
3. The frontend container serves the Vite production build through its own Nginx server. React runs in the user's browser.
4. The backend checks authentication and file ownership, accesses PostgreSQL through Prisma and performs S3 upload/delete operations.
5. **Amazon RDS PostgreSQL stores users, file metadata and share records. Amazon S3 stores the actual file bytes.**
6. For downloads and previews, the backend returns a presigned S3 URL. The browser retrieves the object directly from S3 using HTTPS.
7. For public sharing, the backend resolves the token, checks its database expiry and redirects the recipient to a short-lived S3 URL.

Presigned URLs are generated locally by the backend using AWS credentials; URL generation is not a separate network request to S3. Resend sends verification and password-reset emails. GitHub Actions, GHCR and AWS Systems Manager handle deployment operations separately from normal application traffic.

## Technology stack

| Layer | Technologies | Purpose |
| --- | --- | --- |
| Frontend | React, Vite, TypeScript, React Router, TanStack Query | Browser interface, routing and API state |
| Backend | Node.js, Express, TypeScript | Authentication, authorization and file APIs |
| Database | PostgreSQL, Prisma, `pg` adapter | Users, file metadata and share expiry |
| Cloud compute | Amazon EC2 | Hosts the Docker application runtime |
| Managed database | Amazon RDS for PostgreSQL | Production relational database target |
| Object storage | Amazon S3 | Private file objects and signed retrieval |
| Runtime and networking | Docker, Docker Compose, Nginx, HTTPS | Packaging, proxy routing and TLS termination |
| CI/CD | GitHub Actions, GitHub Container Registry, AWS Systems Manager | Validation, image publishing and EC2 releases |
| Email | Resend | Verification codes and password-reset messages |

## Project structure

```text
CLOUDDROP/
â”œâ”€â”€ frontend/                   # React application, browser tests and static-server image
â”‚   â”œâ”€â”€ src/                    # Pages, components, auth, file and upload features
â”‚   â”œâ”€â”€ e2e/                    # Playwright scenarios
â”‚   â””â”€â”€ docs/                   # Frontend flows, QA evidence and integration notes
â”œâ”€â”€ backend/                    # Express API and backend tests
â”‚   â”œâ”€â”€ src/                    # Routes, controllers, middleware, services and utilities
â”‚   â”œâ”€â”€ prisma/                 # PostgreSQL schema and SQL migrations
â”‚   â”œâ”€â”€ prisma7.config.ts       # Explicit Prisma CLI configuration
â”‚   â””â”€â”€ certs/                  # RDS certificate authority bundle used in production
â”œâ”€â”€ nginx/                      # Edge reverse-proxy configuration
â”œâ”€â”€ scripts/                    # Deployment, verification and rollback scripts
â”œâ”€â”€ .github/workflows/          # Backend CI, frontend CI and deployment workflows
â”œâ”€â”€ docs/                       # Project, infrastructure and deployment documentation
â”œâ”€â”€ docker-compose.yml          # Earlier backend/proxy stack, not the local quick start
â””â”€â”€ docker-compose.prod.yml     # Production backend, frontend and edge Nginx stack
```

## Run locally

Choose **Option A** to explore the interface without cloud dependencies. Choose **Option B** to run the real API and persistent storage. Run commands from the specified directories; there is no root `npm` application or root install command.

### Prerequisites

- Git.
- **Node.js 24.15 or newer within the 24.x release line**, with npm, recommended for both packages. The frontend also supports Node.js 22.22.2 or newer within the 22.x line.
- For Option B: a reachable PostgreSQL database. The optional Docker command below uses PostgreSQL 15, matching the backend CI database.
- For actual file upload/download/delete: an S3 bucket and AWS credentials with the necessary object permissions.
- Docker and Docker Compose if using the database container or building application images. Native Node development does not require the production Nginx/HTTPS stack.

### 1. Clone the repository

```bash
git clone https://github.com/OmoniyiIfeAbraham/CLOUDDROP.git
cd CLOUDDROP
```

If you already have the checkout, open a terminal in its root directory.

### Option A: frontend demo only

```bash
cd frontend
npm ci
npm run dev
```

Open the URL printed by Vite, normally [http://localhost:5173](http://localhost:5173). The committed `frontend/.env.development` sets `VITE_USE_MOCK_API=true`.

Use `demo@clouddrop.app` with any password of at least eight characters to explore the sample workspace. Demo registration uses the verification code shown by the demo interface. This mode does not contact PostgreSQL, S3 or Resend, and file state resets on a page reload. If you previously created a local environment override, set `VITE_USE_MOCK_API=true` there before restarting Vite.

### Option B: frontend and real backend

#### 2. Start PostgreSQL

Use an existing development database, or run this optional command from the repository root with Docker running:

```bash
docker run --name clouddrop-postgres -e POSTGRES_USER=clouddrop -e POSTGRES_PASSWORD=clouddrop_dev -e POSTGRES_DB=clouddrop -p 127.0.0.1:5432:5432 -v clouddrop-postgres-data:/var/lib/postgresql/data -d postgres:15
```

The password above is an example for a disposable local database, not a production credential. Wait until PostgreSQL is ready before applying migrations:

```bash
docker exec clouddrop-postgres pg_isready -U clouddrop -d clouddrop
```

On later runs, start the existing database container with `docker start clouddrop-postgres` rather than creating another container with the same name. The named volume retains database data.

#### 3. Install and configure the backend

From the repository root:

```bash
cd backend
npm ci
```

Create `backend/.env` by copying `backend/.env.example` in your editor, then replace its contents with your development settings. **Set `NODE_ENV=development`**: the template uses production mode, which expects a certificate path supplied by the backend Docker image.

```dotenv
NODE_ENV=development
PORT=5000
DATABASE_URL="postgresql://clouddrop:clouddrop_dev@127.0.0.1:5432/clouddrop"
JWT_SECRET="replace-with-a-long-random-local-secret"
AWS_REGION="eu-west-1"
S3_BUCKET_NAME="your-development-bucket"
FRONTEND_URL="http://localhost:5173"
PUBLIC_APP_URL="http://localhost:5000"
RESEND_API_KEY=""
EMAIL_FROM=""
```

Generate a random value for `JWT_SECRET` and paste it into your local `.env`:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Use your own development bucket. Configure credentials for the AWS SDK's default credential chain, such as a local AWS profile or shell environment credentials (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` and `AWS_SESSION_TOKEN` when applicable). The application does not provide a local disk substitute for S3.

Without Resend credentials, **development mode prints verification codes and password-reset links in the backend terminal**. To test real email delivery, set both `RESEND_API_KEY` and `EMAIL_FROM` for a sender authorized by your Resend account. Production requires email configuration and does not use the terminal fallback.

#### 4. Generate Prisma Client and apply migrations

From `backend/`, after configuring the database:

```bash
npx prisma generate --config ./prisma7.config.ts
npx prisma migrate deploy --config ./prisma7.config.ts
npm run dev
```

The `--config` flag explicitly selects this repository's custom-named Prisma configuration file. Apply migrations to your development database, not an unrelated or production database.

The API starts on [http://localhost:5000](http://localhost:5000). Check [http://localhost:5000/health](http://localhost:5000/health) for:

```json
{
  "success": true,
  "message": "CloudDrop API is running"
}
```

This endpoint checks process liveness; it does not prove database, S3 or email connectivity.

#### 5. Connect the frontend to the API

Open a **second terminal** in the repository root:

```bash
cd frontend
npm ci
```

Create `frontend/.env.development.local` with:

```dotenv
VITE_USE_MOCK_API=false
VITE_API_BASE_URL=/api/v1
```

Then start the frontend:

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173), or the address Vite prints. Vite proxies `/api` and `/health` to `http://localhost:5000`. Restart Vite whenever you change its environment files. If either server uses a different port, update the settings described below.

#### 6. Try the application

1. Register with your name, email and a password of at least eight characters.
2. Verify your email using the received six-digit code, or the code printed in the development backend terminal when email is not configured.
3. Upload a small supported file, then inspect the dashboard and file library. These operations require a configured bucket and valid AWS access.
4. Preview a supported PDF/image, download it and create a temporary share link.
5. Delete your test file when finished.

**Local sharing requires attention to the public URL.** The example `PUBLIC_APP_URL` points directly to the local backend so `/s/:token` reaches its resolver. However, the frontend deliberately accepts only HTTPS file/share links. To test the complete sharing UI, use an HTTPS development entry point that routes `/s/` to this backend, and set `PUBLIC_APP_URL` to that origin. For plain HTTP API testing, inspect the share response and open its local `/s/:token` URL directly. Vite's current development proxy does not forward `/s/`; pointing `PUBLIC_APP_URL` at the Vite origin alone will not fix that route. Do not use the production origin to resolve tokens created in a separate local database.

## Environment variable reference

### Backend

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | Use `development` locally. Production enables RDS certificate validation and requires email delivery configuration. |
| `PORT` | API port, normally `5000`. |
| `DATABASE_URL` | PostgreSQL connection string used by Prisma and its PostgreSQL adapter. |
| `JWT_SECRET` | Server-side secret for signing and validating authentication tokens. |
| `AWS_REGION` | S3 region. The code defaults to `eu-west-1`. |
| `S3_BUCKET_NAME` | Bucket holding file objects. Set explicitly for your environment; do not rely on the project's fallback bucket name. |
| `FRONTEND_URL` | Frontend origin used to build password-reset links. Use `http://localhost:5173` locally and the public HTTPS origin in production. |
| `PUBLIC_APP_URL` | Public origin used for `/s/:token` share links. It must route to the backend resolver. Defaults to the live CloudDrop HTTPS origin. |
| `RESEND_API_KEY` | Server-side Resend API key for transactional email. |
| `EMAIL_FROM` | Sender accepted by your Resend account. |

The examples do not define AWS access keys. The SDK resolves credentials through its default provider chain; on EC2, the intended setup is an instance role. Keep local `.env` files, credentials and tokens out of Git. `CLOUDDROP_E2E_MAILBOX_DIR` is reserved for isolated tests and must remain unset in normal development/production.

### Frontend

| Variable | Purpose |
| --- | --- |
| `VITE_API_BASE_URL` | Browser API base, normally `/api/v1`. |
| `VITE_USE_MOCK_API` | `true` for the in-browser demo; `false` for the real backend. |
| `CLOUDDROP_API_PROXY_TARGET` | Optional Vite development proxy target, such as `http://localhost:5001` when the backend uses another port. |

Frontend `VITE_*` values are public and are compiled into the browser build. Never place secrets in them. Production image builds explicitly select the real API; development overrides do not change an already-built image.

## API overview

Paths below reflect the routers mounted in `backend/src/server.ts`. Authenticated requests use `Authorization: Bearer <JWT>`.

| Method | Path | Purpose / access |
| --- | --- | --- |
| `GET` | `/health` | Public API liveness |
| `POST` | `/api/v1/auth/register` | Register an unverified user |
| `POST` | `/api/v1/auth/verify-email` | Verify a six-digit code and receive a session |
| `POST` | `/api/v1/auth/resend-verification` | Request a replacement code |
| `POST` | `/api/v1/auth/login` | Sign in after email verification |
| `GET` | `/api/v1/auth/me` | Current authenticated user |
| `DELETE` | `/api/v1/auth/me` | Delete the authenticated account and its stored files |
| `POST` | `/api/v1/auth/forgot-password` | Request password recovery |
| `POST` | `/api/v1/auth/reset-password` | Consume a valid reset token |
| `POST` | `/api/v1/files` | Owner upload, multipart `file` and `category` fields |
| `GET` | `/api/v1/files` | User's files; `search`, `category`, `page`, `limit` query parameters |
| `GET` | `/api/v1/files/:id` | Owner's file metadata |
| `GET` | `/api/v1/files/:id/view` | Owner's temporary inline preview URL |
| `GET` | `/api/v1/files/:id/download` | Owner's temporary download URL |
| `POST` | `/api/v1/files/:id/share` | Owner creates a link; optional `ttlHours` is `1`, `24` or `168` |
| `DELETE` | `/api/v1/files/:id` | Owner deletes a file |
| `GET` | `/api/v1/categories` | Public category catalog |
| `GET` | `/api/v1/dashboard/stats` | Authenticated user's dashboard totals |
| `GET` | `/s/:token` | Public share resolution and redirect to S3 |

The singular `backend/src/routes/file.routes.ts` is not mounted. Older references to `/files/upload`, `/files/search` or `GET /files/:id/share` do not describe the current API. Use `POST /files`, `GET /files?search=...` and `POST /files/:id/share` instead.

## Testing and production builds

### Frontend checks

From `frontend/`:

```bash
npm run typecheck
npm run typecheck:e2e
npm run lint
npm test
npm run build
```

Browser suites require Playwright browsers; download/recovery fixtures also require OpenSSL on the command path:

```bash
npx playwright install chromium webkit
npm run test:e2e
npm run test:downloads
npm run test:recovery
```

On Linux, install Playwright's required browser system libraries if prompted. Live integration tests have additional isolated-environment requirements; see the [frontend guide](frontend/README.md) before running `npm run test:live`.

### Backend checks

Use a dedicated test database and disposable test bucket when applicable. Configure its `DATABASE_URL`, apply migrations using the explicit Prisma config, and keep test data separate from production. From `backend/`:

```bash
npm test -- --run
npm run build
```

For an isolated share-policy unit check:

```bash
npm test -- --run tests/share-policy.test.ts
```

Tests cover authentication, ownership, validation, file API behavior, signed downloads and sharing policy. Some API tests use mocks and do not establish live AWS connectivity.

### Build output

- `npm run build` inside `frontend/` writes the static app to `frontend/dist/`. Serve it with SPA fallback and an API reverse proxy for a real deployment.
- `npm run build` inside `backend/` writes compiled JavaScript to `backend/dist/`; `npm start` runs it from `backend/`.
- Vite's API proxy belongs to the development server. A standalone static server or `vite preview` does not automatically reproduce the production reverse proxy.

## Docker and AWS deployment

Both applications have Dockerfiles. To build images from the repository root:

```bash
docker build -t clouddrop-backend:local ./backend
docker build -t clouddrop-frontend:local --build-arg VITE_API_BASE_URL=/api/v1 --build-arg VITE_USE_MOCK_API=false ./frontend
```

The frontend image serves static files through Nginx. The backend image runs Node.js and includes the RDS CA bundle. These commands build images only; they do not provision AWS resources or configure a database.

### Production prerequisites

The configured EC2 deployment expects:

- Docker and Compose, an existing checkout at `/opt/clouddrop`, and the external Docker network `clouddrop_default`.
- A **root deployment `.env`** for Compose containing backend settings and `BACKEND_IMAGE` / `FRONTEND_IMAGE` values. This is separate from `backend/.env` used in native development.
- A reachable PostgreSQL database, applied migrations, an S3 bucket and working AWS credentials/permissions.
- Resend credentials and correct production `FRONTEND_URL` / `PUBLIC_APP_URL` origins.
- DNS pointing to the intended host, Let's Encrypt certificates available under `/etc/letsencrypt`, and the ACME webroot mounted by Compose.
- Access to pull the selected GHCR images, plus an SSM-ready instance, deployment IAM permissions, and the Linux `flock` utility when using Actions.

On the prepared Linux EC2 host, the operator scripts are:

```bash
./scripts/deploy.sh
./scripts/verify-deployment.sh
```

Directly running `deploy.sh` defaults to deploying both images. Automatic releases call `deploy-release.sh` from a runtime bundle checked out at the image commit: it preserves the other running image, synchronizes the production Compose file, Nginx configuration and operational scripts, and deploys only the changed component. The host `.env` and certificates are preserved. Releases use a host `flock` lock and record successful run numbers separately for frontend/backend so an older completion cannot undo a newer release of that component. Production database migrations remain a separate release-preparation step. Verification checks both image references, container health and the public HTTPS `/health` endpoint; database/S3/email readiness still needs separate testing.

The root `docker-compose.yml` is an earlier backend/proxy setup. It does not provide a complete frontend development stack, while the shared Nginx configuration now expects HTTPS and a frontend upstream. Use the native local setup above for development rather than assuming `docker compose up` is a complete quick start.

See the [deployment guide](docs/DEPLOYMENT.md) and [AWS infrastructure notes](docs/aws-infrastructure.md) for additional operational context. Some older prose describes HTTP-only hosting; the active production Compose and `nginx/default.conf` configure HTTPS.

## CICD workflow

```text
Push or merge to main
    ├── frontend/** change → frontend checks → build/publish frontend SHA image
    │                                             ↓
    │                                     deploy frontend to EC2
    └── backend/** change  → backend checks  → build/publish backend SHA image
                                                  ↓
                                          deploy backend to EC2
```

- **Frontend and backend deploy independently.** Each successful main-branch build triggers its own deployment without waiting for the other component's CI.
- Changes to shared `scripts/**`, `nginx/**`, production Compose or the deployment workflow trigger both build workflows. Documentation-only changes do not trigger production releases.
- A failed validation/build does not deploy that component. The deployment workflow accepts only successful push builds from this repository's `main` branch.
- The component uses its exact commit-SHA image. The other component keeps its currently deployed image instead of being replaced by `latest`.
- GitHub uses OIDC to assume the deployment role, then AWS Systems Manager runs the release on EC2. Docker changes are serialized on the host with `flock`, without discarding one component's queued release when the other finishes.
- The release includes non-secret runtime files from the image commit, so an old EC2 checkout does not leave deployment scripts or Nginx configuration behind. Secrets and certificates stay on EC2.
- Manual `workflow_dispatch` on `main` can deploy an explicit backend/frontend image pair, including the initial bootstrap when there is no counterpart container yet.
- `scripts/rollback.sh` supports manual rollback of an explicit backend/frontend image pair and checks public HTTPS. It is not automatic rollback.
- See [backend CI](.github/workflows/ci.yml), [frontend CI](.github/workflows/frontend.yml) and [deployment](.github/workflows/deploy.yml). The tests in `scripts/tests/deployment.test.mjs` exercise releases with mocked commands; actual AWS permissions and deployment success still need live verification.
- A local commit does not start Actions. After the pipeline changes are pushed or merged into `main`, later frontend/backend pushes follow this flow. Allow time for validation, image publishing and deployment, then reload the page.

## Security and current limitations

- Passwords use bcrypt; private API operations validate bearer JWTs and file ownership.
- Verification codes and password-reset tokens are stored as hashes with expiry. Login requires a verified email.
- The browser keeps the JWT in `sessionStorage`. Logout clears browser state; there is no refresh-token or server-side JWT revocation system.
- File bytes are separate from database metadata. The design expects private S3 objects, with temporary signed URLs for retrieval.
- Owner download/preview URLs last 10 minutes. Public share resolution issues an S3 URL lasting at most 5 minutes and no longer than the remaining share lifetime.
- Sharing tokens grant access to anyone holding the link. Expiry blocks future retrieval; it does not remove copies already downloaded.
- Uploads use backend memory, with MIME allowlisting and signature checks for PDFs and the four supported image formats. No antivirus integration is implemented.
- S3 operations and database writes are not one atomic transaction. Upload metadata failures trigger best-effort object cleanup; deletion failures can require operational follow-up.
- Production Compose publishes backend port 5000 as well as proxy ports 80/443. Restrict direct backend exposure through the actual host/network configuration.
- Public share requests have an in-memory rate limiter. Per-client behavior behind Nginx requires care because Express does not currently configure `trust proxy`.
- Logs are available through the application and Docker. Centralized monitoring, alerting, version history and horizontal scaling remain future work.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| The UI runs but no real files appear in S3 | Set `VITE_USE_MOCK_API=false` in `frontend/.env.development.local` and restart Vite. Demo mode is enabled by default. |
| Missing database URL or JWT secret | Create `backend/.env`, fill both values, and start the API from `backend/`. |
| Prisma cannot find the configuration or datasource URL | Use `--config ./prisma7.config.ts` from `backend/`; confirm `.env` is present. |
| Prisma Client import errors or missing database tables | Run `prisma generate` and `prisma migrate deploy` with the explicit config before starting the API. |
| Local backend reports a missing RDS certificate | Set `NODE_ENV=development` for the local database. Production expects the CA path installed in the Docker image. |
| Database connection refused | Start PostgreSQL, wait for `pg_isready`, and verify host, port and database credentials in your local URL. |
| Registration needs a verification code but no email arrived | In development without Resend, read the backend terminal. With Resend configured, check the sender and API settings. |
| Password-reset link opens the wrong application | Set `FRONTEND_URL` to your frontend origin. |
| Share links point to the production app during local testing | Set `PUBLIC_APP_URL` for your environment and observe the HTTPS/local `/s/` routing requirements above. |
| Upload fails with AWS credentials or access errors | Verify the selected region, development bucket and credential chain, including temporary-session expiry and required S3 permissions. |
| Upload fails with HTTP 413 | Check the proxy body limit. Production Nginx permits 26 MiB requests to accommodate a 25 MiB file plus multipart overhead. |
| A file downloads but cannot preview | Check the frontend preview allowlist and, for PDFs, the browser's native viewer. |
| Tests fail before reaching assertions | Check Node version, Prisma generation, test database configuration and Playwright/OpenSSL prerequisites for browser suites. |
| Health is green but files/email fail | `/health` is process liveness only. Check the backend logs and each external dependency separately. |

## Team members

**TechCrush Cloud Computing Cohort 8, Group 3**

| Name | Student ID | Role |
| --- | --- | --- |
| Samuel Ayodele Olukayode | CLC/2026/TC-8/0151 | Collaborator |
| Adewuyi Eunice Aduramigba | CLC/2026/TC-8/0187 | Collaborator |
| Oladayo Temitope Lawal | CLC/2026/TC-8/0181 | Collaborator |
| Jeremiah Bioseh | CLC/2026/TC-8/0179 | Collaborator |
| Kizito Nnamdi Ugwu | CLC/2026/TC-8/0234 | Collaborator |
| Ife Abraham Omoniyi | CLC/2026/TC-8/0008 | Team Lead |

## Application screenshot

![CloudDrop dashboard showing file totals, storage usage and recent files](frontend/docs/qa-evidence/source-dashboard.png)

Actual project QA capture: the source frontend connected to the deployed backend. It is not a new capture of the currently deployed dashboard. See the [QA report](frontend/docs/final-qa-report.md) for capture context and historical findings.

## Further documentation

- [Frontend behavior and application flows](frontend/docs/frontend-flows.md)
- [Frontend setup and browser testing](frontend/README.md)
- [API documentation](docs/API.md) (check mounted routes above where older examples differ)
- [AWS infrastructure notes](docs/aws-infrastructure.md)
- [Deployment guide](docs/DEPLOYMENT.md)
- [Team DevOps workflow](docs/DEVOPS-WORKFLOW.md)
- [Email verification setup](frontend/docs/live-email-verification.md)
- [Password recovery integration](frontend/docs/password-recovery-handoff.md)
- [QA findings and evidence](frontend/docs/final-qa-report.md)

To test the deployed application, visit **[CloudDrop](https://clouddrop-c8.duckdns.org)** and create an account with an email address you can verify.
