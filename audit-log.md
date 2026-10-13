# CloudDrop — Main-Branch Audit and Completion Roadmap

**Audit date:** 13 October 2026  
**Repository:** `OmoniyiIfeAbraham/CLOUDDROP`  
**Audited main commit:** `47863bd1c550744cd7db7224e2e7a13fa0481f8d`  
**Remote freshness:** `git fetch origin` succeeded; local `main`, `origin/main`, and HEAD matched.  
**Working tree:** Clean before and after the audit.

**Verdict:** CloudDrop has a substantial application implementation, working public HTTPS entry point, CI configuration, and an SSM deployment mechanism. It has **not yet been demonstrated through this audit to be functionally complete, securely configured in AWS, reproducibly deployed, or capstone-ready**.

No project files were changed. No commits, pushes, merges, deployments, infrastructure changes, or production-data operations were performed. Dependency installation, generated files, builds, browser downloads, and tests were confined to temporary audit storage.

---

## A. Executive Summary

| Question | Finding |
|---|---|
| Is the application functionally complete? | **Not established.** Required core APIs and screens exist, but the real PostgreSQL/S3-backed application journey remains unverified. |
| Is the frontend complete? | **Broadly implemented, with remaining gaps.** Authentication, dashboard, upload, library, details, search, pagination, sharing, and deletion are implemented. Two WebKit download/accessibility checks failed. Category statistics are only partially presented. |
| Is the backend complete? | **Core functionality exists, but security, validation, error handling, sharing lifetime accuracy, and failure consistency need completion.** |
| Is frontend/backend integration complete? | **The principal route and response contracts align in code.** Actual integrated execution was not verified. The frontend does not use the categories endpoint. |
| Is production deployment complete? | **A public application shell, health endpoint, and categories endpoint respond.** Latest-main deployment, actual image versions, database operations, S3 operations, and reproducible host setup remain unverified. |
| Is CI/CD complete? | **No.** CI and publishing are configured. Deployment is manually dispatched, independently selects two image tags, and lacks a successful-CI release gate, production migration stage, and automatic rollback. |
| Is HTTPS complete? | **Basic public HTTPS and HTTP redirection work.** Renewal, certificate monitoring, and the wider security configuration remain unverified. |
| Is the project ready for demonstration? | **Not yet accepted as ready.** Real integration evidence, release verification, security fixes, documentation, and presentation deliverables remain outstanding. |
| Single biggest blocker | **There is no verified, repeatable release of a compatible frontend/backend image pair that passes the real database/S3 user journey.** |

### What was verified today

- Latest remote main was accessed and audited.
- Backend Prisma generation, schema validation, and TypeScript build passed.
- Frontend typecheck, lint, and build passed.
- The final frontend unit run passed **99 tests across 17 files**.
- Chromium desktop/mobile browser testing passed **18 tests**, with **6 live-backend tests skipped**.
- Download browser fixtures passed **10 tests** and failed **2 WebKit tests**.
- Backend testing executed **63 tests: 55 passed and 8 failed** because the disposable database was unavailable.
- Both Compose files passed structural configuration checks.
- All three deployment scripts passed shell syntax checks.
- Public HTTPS returned HTTP 200; HTTP redirected to HTTPS.
- Public `/health` and `/api/v1/categories` returned their expected responses.

### What remains unverified

- Actual registration, login, metadata persistence, and file operations against RDS/S3.
- Two real users’ isolation across every file operation.
- Deployed backend source revision and frontend/backend image digests.
- AWS instance profile, bucket privacy, security groups, RDS isolation, and IAM/OIDC trust policies.
- Successful GitHub Actions runs and published images.
- Production migrations, operational rollback, certificate renewal, and monitoring.

### Changes since the preceding audited commit

Main advanced from `2b526cd` through two relevant PR merges:

- **PR #38:** Frontend download preparation, cancellation, retry, expiry, accessibility, and browser fixtures.
- **PR #39:** Signed downloads now request attachment delivery with the original filename.

These changes are merged functionality. The old recommendation to implement attachment headers is now **obsolete for main**; deployment and real-storage verification are the remaining download handoff.

---

## B. Repository Inventory

### Git state and history

| Item | Result |
|---|---|
| Current branch | `main` |
| HEAD | `47863bd1c550744cd7db7224e2e7a13fa0481f8d` |
| Local main | Same SHA |
| Fetched origin/main | Same SHA |
| Main divergence | `0` commits ahead, `0` behind |
| Working tree | Clean |
| Tracked files | 391 |
| Branch switching | None |
| Relevant latest merges | PR #39 backend download filenames; PR #38 frontend downloads/accessibility; PR #36 Nginx upload/cache handling; PR #35 file-error messaging |

No `AGENTS.md` was found in the repository file search.

### Major structure

```text
.github/workflows/
  ci.yml
  frontend.yml
  deploy.yml
  PULL_REQUEST_TEMPLATE.md

backend/
  src/
    config/
    controllers/
    generated/prisma/
    lib/
    middleware/
    routes/
    services/
    types/
    utils/
    server.ts
  prisma/
    schema.prisma
    migrations/
      20261004072824_init/
      20261008152837_add_share/
  tests/                       13 test files
  scripts/live-flow.mjs
  docs/API-SECURITY.md
  certs/eu-west-1-bundle.pem
  Dockerfile
  prisma7.config.ts
  package.json
  package-lock.json
  pnpm-lock.yaml

frontend/
  src/
    app/
    components/
    features/auth/
    features/files/
    features/upload/
    lib/
    pages/
    styles.css
  e2e/
    accessibility.spec.ts
    downloads.spec.ts
    live-auth.spec.ts
    live-files.spec.ts
    live-flow.spec.ts
    smoke.spec.ts
  docs/
    accessibility-review.md
    backend-download-handoff.md
  Dockerfile
  nginx.conf
  playwright.config.ts
  playwright.downloads.config.ts
  package.json
  package-lock.json

docs/
  API.md
  ARCHITECTURE.md
  DEPLOYMENT.md
  DEVOPS-WORKFLOW.md
  REQUIREMENTS.md
  aws-infrastructure.md
  architecture/README.md
  screenshots/README.md

nginx/
  default.conf
  nginx.conf
  README.md

scripts/
  deploy.sh
  verify-deployment.sh
  rollback.sh

docker-compose.yml
docker-compose.prod.yml
README.md
.gitignore
.gitignire
```

The repeated Prisma skill/reference directories under `backend/.agents`, `.claude`, and `.windsurf` are tooling documentation, not application implementation.

### Actual technology stack

| Area | Verified repository implementation |
|---|---|
| Frontend | React 19, TypeScript, Vite 8 |
| Routing | React Router |
| Server state | TanStack React Query |
| Local state | React state and context providers |
| Forms | React Hook Form and Zod |
| Styling | Custom CSS; **Tailwind dependency/configuration was not found** |
| Backend | Node.js, Express 5, TypeScript |
| Database access | Prisma 7, PostgreSQL driver adapter, `pg` |
| Authentication | `bcryptjs`, `jsonwebtoken` |
| Upload handling | Multer memory storage |
| Object storage | AWS S3 SDK and request presigner |
| Deployment | Docker, Compose, Nginx, GHCR |
| AWS deployment authentication | GitHub Actions OIDC configuration |
| Remote execution | AWS SSM Run Command |
| Tests | Vitest, Supertest, Testing Library, Playwright, axe |

Tailwind’s absence is a stack difference to document. It is not evidence that the existing UI needs a styling rewrite.

### Unmerged branch separation

Accessible refs with commits not ancestral to main included:

| Branch | Unmerged commits | Interpretation |
|---|---:|---|
| `origin/feature/aws-s3-setup` | 1 | Infrastructure documentation commit; not live AWS proof. |
| `origin/feature/devops-cicd` | 6 | Older deployment/routing history and configuration differences. Do not merge wholesale. |
| `origin/feature/frontend-routing-fix` | 5 | Older routing/deployment history. Main already has routing and deployment code. |
| `origin/fix/deploy-via-ssm` | 3 | Older deployment/auth-route history; equivalent capabilities already exist on main. |
| `origin/fix/production-auth-routes` | 1 | Older auth-route commit; main mounts authentication routes. |
| `origin/feature/frontend-file-integration` | 1 | Earlier frontend integration foundation; main has a more complete implementation. |
| `origin/test/frontend-live-flow` | 1 | Documentation correction, not new verified functionality. |
| `origin/test/oidc-diagnostic` | 1 | Diagnostic workflow changes; not part of main. |

“Unmerged commits” describes ancestry, not necessarily unique missing functionality. Some changes were integrated through other commits.

Unauthenticated GitHub Actions/PR API requests returned HTTP 404. Open PR state, CI outcomes, approvals, branch protections, and registry contents could not be verified.

### Evidence references

The following references support the matrices and findings below. Line references are for the audited commit.

| Ref | Evidence |
|---|---|
| E01 | [Server and mounted routes](/C:/Users/DELL/Documents/clouddrop/backend/src/server.ts:19): CORS, logging, parser, health, route mounts. |
| E02 | [Authentication controller](/C:/Users/DELL/Documents/clouddrop/backend/src/controllers/auth.controller.ts:4) and [authentication service](/C:/Users/DELL/Documents/clouddrop/backend/src/services/auth.service.ts:31). |
| E03 | [JWT verification](/C:/Users/DELL/Documents/clouddrop/backend/src/middleware/auth.middleware.ts:58) and [password/JWT utilities](/C:/Users/DELL/Documents/clouddrop/backend/src/utils/auth.utils.ts:4). |
| E04 | [Mounted file router](/C:/Users/DELL/Documents/clouddrop/backend/src/routes/files.routes.ts:17) and [active file controller](/C:/Users/DELL/Documents/clouddrop/backend/src/controllers/files.controller.ts:57). |
| E05 | [Owner-scoped file queries and deletion](/C:/Users/DELL/Documents/clouddrop/backend/src/services/file.service.ts:77); pagination/search at line 125. |
| E06 | [Multer limit](/C:/Users/DELL/Documents/clouddrop/backend/src/middleware/upload.middleware.ts:3), [active upload validator](/C:/Users/DELL/Documents/clouddrop/backend/src/utils/file-upload.validation.ts:28), [unused stronger validator](/C:/Users/DELL/Documents/clouddrop/backend/src/lib/file-validation.ts:45), [error middleware](/C:/Users/DELL/Documents/clouddrop/backend/src/middleware/error.middleware.ts:31). |
| E07 | [S3 client configuration](/C:/Users/DELL/Documents/clouddrop/backend/src/config/s3.ts:3), [upload service](/C:/Users/DELL/Documents/clouddrop/backend/src/services/s3.service.ts:9), [download presigner](/C:/Users/DELL/Documents/clouddrop/backend/src/services/s3-download.service.ts:6). |
| E08 | [Share policy](/C:/Users/DELL/Documents/clouddrop/backend/src/lib/share-policy.ts:3), [share creation](/C:/Users/DELL/Documents/clouddrop/backend/src/controllers/files.controller.ts:335), [share presigner](/C:/Users/DELL/Documents/clouddrop/backend/src/services/s3-share.service.ts:5). |
| E09 | [Prisma schema](/C:/Users/DELL/Documents/clouddrop/backend/prisma/schema.prisma:19), [initial migration](/C:/Users/DELL/Documents/clouddrop/backend/prisma/migrations/20261004072824_init/migration.sql:5), [share migration](/C:/Users/DELL/Documents/clouddrop/backend/prisma/migrations/20261008152837_add_share/migration.sql:2). |
| E10 | [Dashboard statistics](/C:/Users/DELL/Documents/clouddrop/backend/src/services/dashboard.service.ts:32) and [public categories](/C:/Users/DELL/Documents/clouddrop/backend/src/controllers/categories.controller.ts:5). |
| E11 | [Protected frontend routes](/C:/Users/DELL/Documents/clouddrop/frontend/src/app/App.tsx:17), [session management](/C:/Users/DELL/Documents/clouddrop/frontend/src/features/auth/AuthProvider.tsx:19), [token storage](/C:/Users/DELL/Documents/clouddrop/frontend/src/lib/runtime.ts:4). |
| E12 | [Authentication forms](/C:/Users/DELL/Documents/clouddrop/frontend/src/pages/AuthPage.tsx:12) and [real/mock authentication services](/C:/Users/DELL/Documents/clouddrop/frontend/src/features/auth/auth-service.ts:32). |
| E13 | [HTTP file adapter](/C:/Users/DELL/Documents/clouddrop/frontend/src/features/files/api/files-http-repository.ts:29), [response contracts](/C:/Users/DELL/Documents/clouddrop/frontend/src/features/files/api/file-contracts.ts:6), [mock selection](/C:/Users/DELL/Documents/clouddrop/frontend/src/features/files/api/FilesProvider.tsx:13). |
| E14 | [HTTP upload transport](/C:/Users/DELL/Documents/clouddrop/frontend/src/features/upload/upload-service.ts:80) and [upload queue](/C:/Users/DELL/Documents/clouddrop/frontend/src/features/upload/UploadQueueProvider.tsx:78). |
| E15 | [Dashboard](/C:/Users/DELL/Documents/clouddrop/frontend/src/pages/DashboardPage.tsx:18), [file library](/C:/Users/DELL/Documents/clouddrop/frontend/src/pages/FilesPage.tsx:27), [file details](/C:/Users/DELL/Documents/clouddrop/frontend/src/pages/FileDetailsPage.tsx:16). |
| E16 | [Download/share/delete actions](/C:/Users/DELL/Documents/clouddrop/frontend/src/features/files/hooks/useFileActions.tsx:70), [dialog](/C:/Users/DELL/Documents/clouddrop/frontend/src/components/ui/Dialog.tsx:17), [download link classification](/C:/Users/DELL/Documents/clouddrop/frontend/src/features/files/lib/file-links.ts:9). |
| E17 | [Backend image](/C:/Users/DELL/Documents/clouddrop/backend/Dockerfile:1) and [frontend image](/C:/Users/DELL/Documents/clouddrop/frontend/Dockerfile:1). |
| E18 | [Production Compose](/C:/Users/DELL/Documents/clouddrop/docker-compose.prod.yml:1) and [root Compose](/C:/Users/DELL/Documents/clouddrop/docker-compose.yml:1). |
| E19 | [Public reverse proxy](/C:/Users/DELL/Documents/clouddrop/nginx/default.conf:1) and [frontend static routing/cache](/C:/Users/DELL/Documents/clouddrop/frontend/nginx.conf:12). |
| E20 | [Deployment](/C:/Users/DELL/Documents/clouddrop/scripts/deploy.sh:13), [verification](/C:/Users/DELL/Documents/clouddrop/scripts/verify-deployment.sh:73), [rollback](/C:/Users/DELL/Documents/clouddrop/scripts/rollback.sh:20). |
| E21 | [Backend CI](/C:/Users/DELL/Documents/clouddrop/.github/workflows/ci.yml:3), [frontend CI](/C:/Users/DELL/Documents/clouddrop/.github/workflows/frontend.yml:3), [SSM deployment workflow](/C:/Users/DELL/Documents/clouddrop/.github/workflows/deploy.yml:3). |
| E22 | [AWS infrastructure claims](/C:/Users/DELL/Documents/clouddrop/docs/aws-infrastructure.md:8) and [deployment documentation](/C:/Users/DELL/Documents/clouddrop/docs/DEPLOYMENT.md:33). |
| E23 | [Access-control tests](/C:/Users/DELL/Documents/clouddrop/backend/tests/access-control.test.ts:63), [file API tests](/C:/Users/DELL/Documents/clouddrop/backend/tests/files-api.test.ts:17), [download unit tests](/C:/Users/DELL/Documents/clouddrop/backend/tests/s3-download.test.ts:24). |
| E24 | [Browser download tests](/C:/Users/DELL/Documents/clouddrop/frontend/e2e/downloads.spec.ts:92), [real-flow browser test](/C:/Users/DELL/Documents/clouddrop/frontend/e2e/live-flow.spec.ts:13), [local fixture configuration](/C:/Users/DELL/Documents/clouddrop/frontend/playwright.downloads.config.ts:5). |
| E25 | [Root README](/C:/Users/DELL/Documents/clouddrop/README.md:5), [requirements tracker](/C:/Users/DELL/Documents/clouddrop/docs/REQUIREMENTS.md:3), [architecture document](/C:/Users/DELL/Documents/clouddrop/docs/ARCHITECTURE.md:47). |
| E26 | [Live-flow logging](/C:/Users/DELL/Documents/clouddrop/backend/scripts/live-flow.mjs:8) and [security evidence table](/C:/Users/DELL/Documents/clouddrop/backend/docs/API-SECURITY.md:59). |
| E27 | [Frontend setup/handoff documentation](/C:/Users/DELL/Documents/clouddrop/frontend/README.md:7) and [manual accessibility checklist](/C:/Users/DELL/Documents/clouddrop/frontend/docs/accessibility-review.md:3). |
| E28 | [Backend dependencies](/C:/Users/DELL/Documents/clouddrop/backend/package.json:16) and `backend/package-lock.json`; current npm advisory scan described in J. |

---

## C. Requirements Compliance Matrix

**Status interpretation:** “VERIFIED COMPLETE” applies to the stated scope—for example, a tested local UI behavior or public liveness endpoint. It does not automatically establish production completeness.

### Application and frontend requirements

| ID | Requirement | Status | Evidence | Gap | Priority | Owner |
|---|---|---|---|---|---|---|
| A01 | Registration | PARTIAL | E02, E12 | Real persistence unverified; backend input validation missing. | P1 | Eunice |
| A02 | Login | IMPLEMENTED — NOT VERIFIED | E02, E12 | Real password/database authentication not exercised. | P0 | Kizito |
| A03 | JWT authentication | VERIFIED COMPLETE | E03; unauthorized tests and signed-expiry probe | Verification/signing work locally; production secret and claim policy still require review. | P1 | Eunice |
| A04 | Protected sessions/routes | PARTIAL | E03, E11; Chromium tests | Frontend protection verified in demo; real session flow and lifecycle policy outstanding. | P1 | Michael |
| A05 | Client logout | VERIFIED COMPLETE | E11; unit/browser tests | Clears token/cache/client state; does not revoke issued JWTs. | P2 | Michael |
| A06 | Upload | IMPLEMENTED — NOT VERIFIED | E04, E07, E14 | Real S3 upload and metadata persistence unverified. | P0 | Kizito |
| A07 | Download | PARTIAL | E07, E16, E23, E24 | Attachment implementation exists; real S3 unverified; WebKit filename fixture failed. | P1 | Michael |
| A08 | File listing/details | IMPLEMENTED — NOT VERIFIED | E04, E05, E13, E15 | Populated real-user records not exercised. | P0 | Kizito |
| A09 | Deletion | PARTIAL | E05, E16 | Real deletion unverified; S3-first deletion can leave stale metadata. | P1 | Eunice |
| A10 | File size validation | VERIFIED COMPLETE | E06, E14; oversized API test | Effective application limit is 25 MiB; boundary through real proxy remains unverified. | P1 | Kizito |
| A11 | File type validation | PARTIAL | E06 | Active validator trusts MIME declaration; stronger filename/empty-file checks are unused. | P1 | Eunice |
| A12 | File categorization | IMPLEMENTED — NOT VERIFIED | E04, E09, E14 | User category selection is wired; real persistence not verified. | P0 | Kizito |
| A13 | Six-category catalog | VERIFIED COMPLETE | E10; local tests and public GET | Frontend uses matching static enum instead of endpoint. | P2 | Michael |
| A14 | Search/filtering | IMPLEMENTED — NOT VERIFIED | E05, E13, E15 | Tests do not prove populated real-user matching/isolation. | P1 | Kizito |
| A15 | Pagination | IMPLEMENTED — NOT VERIFIED | E05, E15 | UI paging tested; database-backed multi-page results not tested. | P1 | Kizito |
| A16 | Temporary sharing | PARTIAL | E08, E16 | Effective lifetime can be shorter than UI promise; real expiry unverified. | P1 | Eunice |
| A17 | Metadata tracking | IMPLEMENTED — NOT VERIFIED | E09 | Schema/migrations exist; deployed schema and live consistency unknown. | P0 | Samuel |
| A18 | User ownership/access control | PARTIAL | E05, E23 | Owner-scoped queries exist; tests use missing IDs rather than another user’s existing file. | P1 | Kizito |
| A19 | Dashboard statistics | PARTIAL | E10, E15 | Real totals unverified; share metric counts rows; UI lacks category breakdown. | P1 | Eunice |
| F01 | Authentication screens/validation feedback | VERIFIED COMPLETE | E12; unit and Chromium tests | Backend validation must match frontend policy. | P1 | Eunice |
| F02 | Dashboard loading/error/empty states | VERIFIED COMPLETE | E15; unit tests | Verified with controlled data, not live backend. | P0 | Kizito |
| F03 | Upload queue/progress/retry/cancel | VERIFIED COMPLETE | E14; unit and demo-browser tests | Actual proxy/S3 cancellation and retry behavior unverified. | P1 | Kizito |
| F04 | File actions, share copy, delete confirmation | VERIFIED COMPLETE | E16; unit/Chromium tests | Real storage behavior remains separate. | P0 | Kizito |
| F05 | Responsive design/mobile navigation | VERIFIED COMPLETE | E15, E16; Chromium 320px checks | Physical-device and broader browser review outstanding. | P2 | Jerry |
| F06 | Accessibility across target browsers | PARTIAL | E24, E27 | Chromium axe/keyboard checks passed; WebKit focus-return failed; human review pending. | P1 | Jerry |
| F07 | Real frontend/backend integration | IMPLEMENTED — NOT VERIFIED | E12–E16 | Real-backend browser tests skipped. | P0 | Michael |

### Cloud, deployment, and DevOps requirements

| ID | Requirement | Status | Evidence | Gap | Priority | Owner |
|---|---|---|---|---|---|---|
| C01 | EC2 hosting | EXTERNAL VERIFICATION REQUIRED | E21, E22; public site | Resource identity and deployed revisions not independently verified. | P0 | Samuel |
| C02 | Elastic IP association | EXTERNAL VERIFICATION REQUIRED | User-supplied IP; E22 | Documentation lists a different public IP. | P0 | Samuel |
| C03 | Private S3 storage | EXTERNAL VERIFICATION REQUIRED | E07, E22 | Bucket policy, public-access blocks, encryption, ownership unknown. | P1 | Samuel |
| C04 | RDS PostgreSQL | EXTERNAL VERIFICATION REQUIRED | E09, E22 | Endpoint, schema, TLS, backups, and private networking unverified. | P0 | Samuel |
| C05 | No hardcoded AWS credentials in active code | VERIFIED COMPLETE | E07; tracked-file scan | Actual production provider source remains unknown. | P1 | Samuel |
| C06 | EC2 instance-role S3 access | EXTERNAL VERIFICATION REQUIRED | E07, E22 | Default provider permits role use but does not prove it is used. | P1 | Samuel |
| C07 | IAM least privilege | EXTERNAL VERIFICATION REQUIRED | E22 | Policy/trust documents not available as verified evidence. | P1 | Samuel |
| C08 | VPC/security groups/network isolation | EXTERNAL VERIFICATION REQUIRED | E22 | Console/CLI inspection required. | P1 | Samuel |
| C09 | OIDC authentication | IMPLEMENTED — NOT VERIFIED | E21 | Trust audience/subject/repository/main restrictions unknown. | P1 | Samuel |
| C10 | SSM deployment access | EXTERNAL VERIFICATION REQUIRED | E21 | Managed-instance status, agent, permissions, and network access unknown. | P0 | Samuel |
| C11 | Nginx reverse proxy | PARTIAL | E19; public endpoints | Basic public routing works; actual host config and full file flow unverified. | P0 | Samuel |
| C12 | Public HTTPS/HTTP redirect | VERIFIED COMPLETE | E19; public curl results | Renewal, monitoring, and TLS hardening remain separate requirements. | P1 | Samuel |
| C13 | Health endpoint | VERIFIED COMPLETE | E01; local/public checks | Liveness only; does not verify RDS or S3 readiness. | P2 | Eunice |
| D01 | Organized repository/feature branches/merges | VERIFIED COMPLETE | Git inventory/history | Review enforcement and branch protection require GitHub access. | P1 | Ife |
| D02 | Automated dependency installation | IMPLEMENTED — NOT VERIFIED | E21; local `npm ci` passed | GitHub execution not available for inspection. | P1 | Samuel |
| D03 | Automated backend tests | PARTIAL | E21, E23 | Local DB-dependent cases failed; coverage gaps remain. | P1 | Kizito |
| D04 | Frontend quality checks | PARTIAL | E21, E24 | Unit/build/lint passed; two WebKit assertions failed. | P1 | Michael |
| D05 | Application build | VERIFIED COMPLETE | E17, E21; actual local builds | Container image build remains unverified. | P0 | Samuel |
| D06 | Docker image build | IMPLEMENTED — NOT VERIFIED | E17, E21 | Docker engine unavailable locally. | P0 | Samuel |
| D07 | GHCR publishing | IMPLEMENTED — NOT VERIFIED | E21 | Registry/runs inaccessible; feature backend can publish `latest`. | P0 | Samuel |
| D08 | Automated deployment after approved main CI | MISSING | E21 | Deploy workflow is `workflow_dispatch` only. | P1 | Samuel |
| D09 | SSM deployment automation | PARTIAL | E20, E21 | Host prerequisites, release gate, config sync, migrations, concurrency missing. | P0 | Samuel |
| D10 | Deployment verification | PARTIAL | E20 | “Public health” check bypasses Nginx/TLS; versions are printed, not matched. | P0 | Samuel |
| D11 | Container health checks | IMPLEMENTED — NOT VERIFIED | E17, E18 | Syntax valid; checks not executed inside images during audit. | P0 | Samuel |
| D12 | Application/container logs | PARTIAL | E01, E20 | Basic logging exists; retention, redaction, monitoring, alerting unverified. | P1 | Samuel |
| D13 | Rollback | BROKEN | E19, E20; Git script mode | HTTP redirect mismatch, non-executable script, backend-only restore, no proxy refresh. | P1 | Samuel |
| D14 | Secret/environment handling | PARTIAL | E17, E18, E22 | Examples/ignores exist; host secrets and former-member access unknown. | P1 | Samuel |
| D15 | Root Compose development setup | BROKEN | E18, E19 | Missing frontend and certificate mounts while using production proxy config. | P2 | Samuel |
| D16 | Production migration process | MISSING | E20, E21 | `migrate deploy` exists in CI, not in release scripts/workflow. | P0 | Samuel |
| D17 | Dependency security triage | PARTIAL | E28; actual npm audit | Four high-severity backend package entries require review. | P1 | Eunice |

### Deliverables

| ID | Requirement | Status | Evidence | Gap | Priority | Owner |
|---|---|---|---|---|---|---|
| R01 | Working live URL | PARTIAL | Public HTTPS checks; E19 | App shell/liveness verified; complete user flow unverified. | P0 | Kizito |
| R02 | Architecture diagram | PARTIAL | E25 | Text flow exists; detailed current architecture diagram absent. | P1 | Ife |
| R03 | Comprehensive root README | MISSING | E25 | Mostly empty headings. | P1 | Ife |
| R04 | Setup/run/environment documentation | PARTIAL | E22, E27 | Backend/local Docker steps incomplete; Node minimum inaccurate. | P1 | Eunice |
| R05 | Deployment documentation | PARTIAL | E22 | HTTPS/frontend/migrations/current host details incomplete or stale. | P1 | Samuel |
| R06 | Troubleshooting guide | MISSING | E25 | Root heading empty; no consolidated operational guide. | P1 | Samuel |
| R07 | CI/CD/security/API documentation | PARTIAL | E21, E22, E26 | Route examples, validation/error tables, safeguards, and evidence incomplete. | P1 | Eunice |
| R08 | Implementation/testing evidence | PARTIAL | E23, E24, E26 | Tests exist and audit artifacts were generated; real integration evidence tables empty. | P1 | Kizito |
| R09 | Presentation slides | MISSING | Tracked-file inventory | No slide deck found. | P1 | Ife |
| R10 | Rehearsed live demonstration | IMPLEMENTED — NOT VERIFIED | E24, E26 | Scripts exist; no verified rehearsal evidence. | P1 | Ife |
| R11 | Team names/contributions | PARTIAL | E25; Git history | Tracker is stale; approved contribution mapping absent. | P1 | Ife |

---

## D. Frontend Findings

### Implementation and integration

The frontend is an actual application implementation, not merely a collection of static screens.

It contains:

- Login and registration forms with validation and server-error feedback.
- Protected/public route groups.
- Session restoration through `/auth/me`.
- Logout and account-change cache clearing.
- Dashboard totals and recent files.
- Multipart upload with progress, per-file categories, cancellation, retry, and feedback.
- Search, category filtering, server-side pagination, and file details.
- Download, sharing, link copying, and delete confirmation.
- Loading, empty, retryable error, and success states.
- Mobile navigation, focus management, native dialogs, and reduced-motion CSS.

The real adapters call the active backend routes. The tests verify substantial transport and UI behavior, but controlled responses are not proof of real RDS/S3 integration.

### Real versus mock behavior

| Area | Real implementation | Default local behavior |
|---|---|---|
| Authentication | HTTP register/login/me service | Mock authentication when development env is used |
| File library | HTTP list/details/search/filter/page requests | In-memory mock repository |
| Upload | XHR multipart POST with Bearer token | Simulated repository upload |
| Download/share | Fresh URL requested from backend | Mock URLs are placeholders |
| Dashboard | Reads `/dashboard/stats` | Mock statistics |

`frontend/.env.development` sets `VITE_USE_MOCK_API=true`. In that mode, a valid-looking login does not prove credentials were checked by the backend.

Production Docker build arguments explicitly set:

```text
VITE_USE_MOCK_API=false
VITE_API_BASE_URL=/api/v1
```

The UI identifies demo mode. This is a useful development capability; demonstration evidence must identify whether it came from demo or real mode.

### Authentication

Frontend validation now associates error text with fields and handles required registration names through the form resolver. Local tests verified invalid-field focus and feedback.

The token is stored in `sessionStorage`. It is cleared on logout and relevant unauthorized responses. Cache and upload-queue handling deliberately separate accounts.

Remaining work:

- Exercise registration, login, restoration, expired JWT, and logout through the actual backend.
- Align server validation with frontend rules.
- Establish the session lifetime/revocation policy.
- Address JavaScript-accessible-token risk through a documented security decision and appropriate application hardening.

A cookie-based redesign is not automatically required to finish this capstone.

### Dashboard

`DashboardPage.tsx` makes two real-mode requests:

- `/dashboard/stats`
- `/files?page=1&limit=5`

It shows total files, storage used, categories used, and recent files, with separate error/retry handling.

The backend returns counts for all six categories, but the UI reduces them to **number of categories used**. A per-category statistics display remains missing if the required dashboard includes category breakdowns.

### Upload

The upload queue is implemented and tested, including:

- MIME/type and size feedback.
- Suggested category with user override.
- Sequential multipart requests.
- Progress indicators.
- Retryable versus permanent failure handling.
- Cancellation.
- Mixed outcomes.
- Continued uploads while navigating.
- Queue clearing on account change.

The progress indicator reflects transfer progress; completion waits for the API response. Actual server/S3 cancellation and consistency still require testing.

### Downloads and accessibility: new findings

The merged frontend prepares a URL in a dialog before the user explicitly saves or opens the file. It handles cancellation, retries, stale responses, and displayed expiry.

The local browser fixture results were:

| Browser scope | Result |
|---|---|
| Desktop Chromium download fixtures | 4 passed |
| Mobile Chromium download fixtures | 4 passed |
| Mobile WebKit download fixtures | 2 passed, 2 failed |

Failures:

1. **Unicode filename**
   - Expected: `Résumé notes (final).txt`
   - Received: `Resume notes (final).txt`
   - Assertion: `frontend/e2e/downloads.spec.ts:102`.
   - The fixture response supplies both an ASCII fallback and extended filename.
   - This establishes a filename mismatch in the tested Windows WebKit environment. It does not establish real S3/Safari behavior.

2. **Focus restoration**
   - After closing the preview dialog with Escape, the download button was inactive instead of focused.
   - Assertion: `frontend/e2e/downloads.spec.ts:133`.
   - `Dialog.tsx` relies on native dialog behavior without explicitly tracking the invoking control.

Jerry should own generic dialog focus restoration. Michael should own download behavior investigation and browser acceptance. Eunice should participate only if real response headers need adjustment.

### Categories integration

The UI uses a static six-category enum that matches the backend.

However, `files-http-repository.ts:68` rejects `getCategories()` with `FEATURE_UNAVAILABLE`, despite the backend endpoint existing.

This does not break the current selector. It is an adapter/documentation inconsistency. Either implement the endpoint adapter or explicitly retain and document the fixed catalog.

### UI/UX verification limits

Chromium tests verified automated accessibility, keyboard navigation, dialog behavior, and 320px layouts. They do not replace:

- Human screen-reader testing.
- Physical iPhone/Safari testing.
- Real-backend error and upload flows.
- Complete production usability verification.

---

## E. Backend Findings

### Active API contract

All requested endpoint methods and paths exist on main.

| Endpoint | Auth/authorization | Validation and errors | Existing coverage | Frontend use |
|---|---|---|---|---|
| `POST /api/v1/auth/register` | Public | No backend request schema; existing-email check; unique-race error not explicitly mapped | Mocked service error case | Correct HTTP route |
| `POST /api/v1/auth/login` | Public | No backend request schema; uniform invalid-credential error | Mocked service error case | Correct HTTP route |
| `GET /api/v1/auth/me` | JWT; uses token’s user ID | User lookup; missing account becomes 404 | Mocked missing-user case | Session restoration |
| `POST /api/v1/files` | JWT and presence gate | Multipart file, 25 MiB limit, MIME allowlist, category schema; category errors incorrectly become 500 | Missing-file/oversized cases; validator units | XHR multipart |
| `GET /api/v1/files` | JWT; query scoped to user | Page/limit/category validation; search trimming | Empty-user cases; DB-dependent cases not verified locally | Search/filter/page |
| `GET /api/v1/files/:id` | JWT; owner-scoped lookup | Only nonempty ID check; missing/not-owned returns 404 | Missing-ID case presented as cross-user test | Details |
| `GET /api/v1/files/:id/download` | JWT; owner-scoped lookup | 600-second presign; attachment/filename headers | Presigner mocked unit tests; missing-ID API case | Download dialog |
| `DELETE /api/v1/files/:id` | JWT; owner-scoped lookup | S3 deletion followed by metadata deletion | Missing-ID API case | Confirmed delete |
| `POST /api/v1/files/:id/share` | JWT; owner-scoped lookup | TTL calculation, database row, direct presigned URL; weak type handling | Share policy units; missing-ID API case | Share dialog |
| `GET /api/v1/categories` | Public static catalog | Six enum values; standard envelope | Local tests and public GET passed | Not called |
| `GET /api/v1/dashboard/stats` | JWT; user-scoped aggregations | Counts/sum/grouping; share-count semantics questionable | Shape case depends on DB | Dashboard |
| `GET /health` | Public | Static liveness response | Local test and public GET passed | Operational use |

The mounted router is **`files.routes.ts`**, not the legacy **`file.routes.ts`**.

Consequently, legacy examples such as:

```text
POST /api/v1/files/upload
GET  /api/v1/files/search
GET  /api/v1/files/:id/share
```

are not the active contract. The backend README incorrectly documents them.

### Response envelopes

Most endpoints follow the requested envelope.

Differences:

- `/health` returns `success` and `message`, without `data`.
- Successful deletion also omits `data`.
- The frontend intentionally accepts the empty-data deletion response.
- File list responses contain `data.files` and `data.pagination`.
- Dashboard returns `totalStorage`; the frontend maps it to `totalStorageBytes`.
- Share responses include `token` and `expiresAt`; the frontend parser discards those and uses `expiresIn`.
- Nginx error pages can be HTML rather than the application JSON envelope; the frontend has normalization for relevant failures.

These differences should be documented. They do not all require code changes.

### Confirmed validation/error defects

Isolated probes stopped before storage/database operations:

| Probe | Actual result | Required correction |
|---|---|---|
| Upload with supported MIME and invalid category | HTTP 500 `INTERNAL_SERVER_ERROR` | Map category/Zod validation to HTTP 400. |
| Malformed JSON sent to login | HTTP 500 `INTERNAL_SERVER_ERROR` | Preserve parser’s client-error status and return a safe error envelope. |
| Unsupported executable MIME | HTTP 400 `UNSUPPORTED_FILE_TYPE` | Correct for this case; MIME spoofing remains unaddressed. |
| Genuinely signed expired JWT | HTTP 401 `UNAUTHORIZED` | Correct locally. |

Root cause for the first two cases: `error.middleware.ts` handles `ApiError` and Multer errors, then converts remaining exceptions to generic HTTP 500.

### Authentication and passwords

Implemented:

- Bcrypt hashing with cost 12.
- Password comparison.
- JWT signing with seven-day expiry.
- JWT signature/expiry verification.
- User ID propagation.
- Owner-scoped file queries.

Missing or partial:

- Backend email/name/password validation.
- Email normalization policy.
- Password byte-length bounds.
- Duplicate-registration race handling.
- Login/registration rate limiting.
- Explicit claim/type/algorithm policy.
- Session revocation or a documented stateless-session policy.

A local utility probe confirmed bcrypt accepted two different passwords with the same first 72 ASCII bytes. This is a password-boundary problem because the application does not enforce a compatible upper bound.

The practical fix is input validation consistent with the chosen hashing algorithm, including UTF-8 byte length—not necessarily replacing working authentication.

### Ownership

The active services include `userId` in retrieval/deletion queries. List and dashboard operations are also scoped to the caller.

This is appropriate implementation evidence.

It is not adequate acceptance evidence because the current “cross-user” tests:

- Generate different user IDs.
- Request a fixed missing file ID.
- Do not create an existing file owned by another user.

A test could pass even if an ownership predicate were accidentally removed, because the requested file does not exist.

### Prisma and PostgreSQL

The schema contains:

- Unique user email.
- Password hash and names.
- File owner, S3 key, original name, MIME, size, category, and timestamps.
- Share token, expiry, and file relationship.
- Foreign keys and cascade behavior.
- User/category/date indexes.
- Share token and expiry indexes.

Actual file contents are not stored in PostgreSQL.

Both migrations are present and consistent with the principal schema. Prisma generation and validation passed.

Remaining issues:

1. **Production migrations are absent from deployment.**
   - CI runs `prisma migrate deploy` against its test database.
   - Deploy scripts do not migrate production.

2. **Multiple Prisma clients/pools.**
   - Authentication, file service, dashboard service, and share controller create separate clients.
   - No centralized connection lifecycle is implemented.

3. **Consistency across S3/database.**
   - Upload compensates for metadata failure, but cleanup failure is silently discarded.
   - Deletion removes S3 content before removing metadata.
   - Failed database deletion can leave a record whose object is gone.
   - Cascading database deletion alone cannot clean S3 objects.

4. **Email duplicates.**
   - Exact database uniqueness exists.
   - Case normalization and concurrent-registration error mapping need attention.

5. **Search/pagination.**
   - Search uses case-insensitive substring matching.
   - No dedicated substring-search index exists.
   - Ordering uses `createdAt` without an ID tie-breaker.
   - Offset pagination is reasonable for a capstone-sized dataset; prove it with populated fixtures before optimizing.

6. **TLS/environment differences.**
   - Production adapters load the bundled RDS CA and enforce verification.
   - Nonproduction adapters do not use that production CA configuration.
   - The example defaults to `NODE_ENV=production`, which is misleading for local execution.

### S3 integration

Implemented:

- PutObject upload.
- User/file-scoped randomized object keys.
- MIME metadata on objects.
- Presigned downloads.
- Direct temporary share URLs.
- DeleteObject.
- Upload cleanup attempt after metadata failure.
- AWS default credential-provider configuration.

The client does not contain explicit access keys. This supports instance-role use but does not prove actual production credentials originate from the EC2 instance profile.

The bucket name has a fallback. Production startup validates only `DATABASE_URL` and `JWT_SECRET`; it does not fail clearly for an absent/mistyped storage configuration.

### Upload size: 25 MiB, not 2 GB

| Layer | Current configuration |
|---|---|
| Frontend | `25 * 1024 * 1024` bytes |
| Multer | Same |
| Active backend validator | Same |
| Public Nginx API location | `client_max_body_size 26m` |
| Backend catch text | Stale comparison against “2 GB limit” |

The effective application limit is **25 MiB**.

The Nginx limit allows room for multipart overhead, but a full boundary upload through the deployed proxy was not performed.

Multer buffers files in memory, and the S3 service sends the buffer. Simply raising the limit to 2 GB would introduce substantial memory and timeout risks.

If 2 GB is mandatory, the team needs a separately scoped streaming/direct multipart upload design. An exact 2 GiB size also exceeds the current signed integer capacity for `File.size`; that schema/API decision must be addressed.

### Sharing lifetime and metadata

The UI offers 1 hour, 1 day, and 7 days. The backend accepts a numeric TTL up to 168 hours, creates a `Share` row, then returns a directly signed S3 URL.

Problems:

- Wrong-type TTL values silently become the default.
- Fractional values below one hour are accepted despite the error message saying 1–168 hours.
- A signing failure can leave a share row without a usable link.
- Stored token expiry is not used by a mounted share-resolution endpoint.
- The UI reconstructs expiry from response receipt time instead of using the server timestamp.
- Temporary signing credentials can expire before the requested URL lifetime.

AWS documents that a presigned URL expires when its underlying credentials expire, even if a later expiry was requested; EC2 role credentials typically last about six hours. Therefore, **24-hour/7-day promises are not reliable when signing directly with shorter-lived role credentials**. Actual production credential lifetime remains unverified. [AWS presigned URL documentation](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html)

The team should either return a truthful effective lifetime or use a stored-token link that issues fresh short-lived storage URLs while enforcing the intended share expiry.

Do not introduce long-lived access keys just to extend link lifetime.

### Dashboard correctness

`sharedFiles` counts all share rows belonging to the user’s files:

- Multiple shares for one file increase the count.
- Expired rows count.
- Rows left after failed signing count.

It is therefore a **share-record count**, not necessarily a count of currently shared files. Define the metric and implement/test that definition.

---

## F. AWS Infrastructure Findings

Repository documentation contains infrastructure descriptions, not independently verified AWS configuration.

| Requirement | Repository evidence | Current audit classification | Required verification |
|---|---|---|---|
| EC2 Ubuntu host | Instance ID/OS described; SSM workflow targets instance | EXTERNAL VERIFICATION REQUIRED | Instance identity, OS, running state, actual application directory. |
| Elastic IP | User supplies `63.34.106.190`; docs list `18.203.69.190` | EXTERNAL VERIFICATION REQUIRED | EIP allocation/association and DNS target. |
| S3 bucket | Bucket name and operations in code/docs | Configured in code; privacy unverified | Public-access blocks, policy, ownership, encryption, versioning decision. |
| RDS | PostgreSQL schema, adapter, CA, documented endpoint | Configured in code; live DB unverified | Private endpoint, security groups, applied migrations, TLS, backup settings. |
| Instance profile | Default AWS provider; documented role name | EXTERNAL VERIFICATION REQUIRED | Attached role, actual credential source, S3/SSM policy scope. |
| GitHub OIDC | Credential action and role secret | IMPLEMENTED — NOT VERIFIED | Provider audience, trust subject, repository/main/environment restrictions. |
| SSM role | Send-command/get-invocation workflow | EXTERNAL VERIFICATION REQUIRED | Intended role identity and allowed instance/document resources. |
| VPC/network | IDs and security claims in documentation | EXTERNAL VERIFICATION REQUIRED | Routes/subnets/security-group ingress/egress and RDS isolation. |
| HTTPS | Config and working public endpoint | Basic boundary verified | Certificate ownership, expiry, renewal timer, reload, monitoring. |
| Monitoring | Basic logs/health code | PARTIAL | Host/container metrics, alarms, retention, operational access. |
| Secret management | Host `.env` approach documented | PARTIAL | Permissions, ownership, provisioning, access history, rotation needs. |

No AWS CLI was available. No AWS Console or authenticated AWS API configuration was inspected.

### Specific infrastructure checks Samuel must perform

- Resolve the documented/public IP discrepancy.
- Confirm the workflow’s instance ID is the EIP-associated application host.
- Confirm containers can use the instance profile rather than static credentials.
- Check container-to-instance-metadata compatibility and applicable metadata settings.
- Restrict S3 operations to the required bucket/object resources.
- Confirm the bucket is not publicly readable.
- Confirm RDS is private and accepts PostgreSQL traffic only from the intended application security group.
- Inspect OIDC trust for the intended repository and approved deployment ref/environment.
- Inspect SSM permissions for the intended instance and run-command document.
- Verify SSM managed-instance connectivity and agent operation.
- Confirm host GHCR authentication if packages are private.
- Verify certificate renewal and reload without running renewal changes during this audit.
- Record redacted configuration evidence with resource IDs and review date.

The timeout from public port 5000 does not prove the security group is correctly restricted.

---

## G. Docker, Nginx and Deployment Findings

### Backend image

The Dockerfile:

- Uses Node 24 Alpine.
- Installs locked npm dependencies.
- Copies the RDS CA.
- Generates Prisma Client.
- Builds TypeScript.
- Starts `dist/server.js`.

Prisma generation and compilation passed outside Docker.

Remaining verification:

- Build the actual image.
- Execute it with staging configuration.
- Verify CA loading and database TLS inside the image.
- Execute the configured health command inside it.
- Check runtime credential-provider behavior.

Quality/security gaps:

- No explicit non-root user.
- Single-stage image retains build/dev tooling.
- No Dockerfile health check; Compose supplies one.
- Runtime image scanning has not been verified.

### Frontend image

A multistage build produces static assets and serves them with Nginx. The image explicitly disables mock mode and includes a health check.

Actual image build/runtime behavior remains unverified locally because the Docker engine was unavailable.

### Production Compose

Production Compose includes backend, frontend, and public Nginx. It uses a shared external network and waits for backend/frontend health.

Problems and prerequisites:

- Backend port 5000 is published on all host interfaces.
- `.env`, external network, certificate paths, host scripts/configuration, and images must already exist.
- The database URL does not inherently prove RDS is used.
- No PostgreSQL container exists in production Compose, which is consistent with intended RDS use.
- No configured log-rotation policy was found.
- No migration step exists.

Port publishing should be removed or limited to loopback if operational access requires it, with health verification moved to the proper network/public path.

### Root Compose

The root Compose file supplies backend and Nginx only, but mounts a configuration that references:

- `frontend:80`, although no frontend service is defined.
- TLS certificate paths without the required certificate mounts.
- HTTPS, although only port 80 is published.

It also requires a preexisting external network.

This is a structural/runtime mismatch. The file is not a self-contained documented development environment.

### Nginx

Implemented and observed:

- HTTP-to-HTTPS redirect.
- API proxy to backend.
- `/health` proxy.
- Application proxy to frontend.
- 26 MiB request-body allowance on API routes.
- Missing static assets return 404.
- Application shell uses no-cache; hashed assets use immutable caching.

Public HTTPS and those basic routing behaviors responded during the audit.

Missing or unverified:

- Certificate bootstrap/renewal procedure.
- Security headers.
- Capacity and slow-upload behavior.
- Explicit relevant timeout policy.
- Host configuration matching main.
- Docker-network runtime operation.

`nginx/nginx.conf` is an older alternative and is not the file mounted by the current Compose configuration.

### Deployment script

Positive implementation:

- Pulls both images before changing running containers.
- Checks backend/frontend health.
- Tests Nginx configuration.
- Restarts Nginx after container changes.

Gaps:

- No configuration/source synchronization.
- No migration execution.
- No immutable release manifest.
- No automatic rollback after replacement failure.
- No real storage/database readiness or authenticated application verification.

The script operates on the existing `/opt/clouddrop` host files. A new main commit does not automatically update those files.

### Verification script

At `verify-deployment.sh:75`, the “public health” check calls:

```text
http://127.0.0.1:5000/health
```

This verifies the host-published backend port, bypassing:

- Public DNS.
- TLS.
- Nginx.
- Frontend routing.
- Actual file operations.

The script prints image names but does not compare them with the requested image/digest.

### Rollback

Confirmed static defects:

- Git records `rollback.sh` as mode `100644`; documented direct execution is not guaranteed to work on Linux.
- Restores only the backend.
- Does not refresh Nginx after backend replacement.
- Uses `http://localhost/health` and expects 200.
- Current public Nginx redirects HTTP requests, so this check is inconsistent.
- Does not define schema compatibility or frontend/backend compatibility.

The documentation’s statement that rollback was tested previously is not proof that the current script works with the current architecture.

### Merge-sensitive files

| File | Finding |
|---|---|
| `backend/.env.example` | Present; blank secret placeholders. Production default is confusing for local setup. |
| `backend/Dockerfile` | Present; CA copying, Prisma generation, and build retained. |
| `backend/package-lock.json` | Present; new download dependency integrated; clean locked installation succeeded. |
| `docker-compose.yml` | Present; backend health check retained; current development/runtime mismatch remains. |

No unresolved merge markers were found.

History includes a Compose deletion and later conflict-resolution restoration. That does not justify restoring an old file wholesale. Fix the current identified configuration mismatch while preserving the working production frontend and TLS setup.

---

## H. CI/CD Findings

### Trigger behavior

| Event | Backend workflow | Frontend workflow | Deployment |
|---|---|---|---|
| General feature push | Not generally triggered | `feature/**`, subject to path filters | None |
| Push to `feature/devops-cicd` | Tests/builds; can publish SHA and `latest` | Runs if frontend-related paths changed | None automatically |
| Pull request to main | Backend checks | Frontend-related path changes trigger frontend checks | None |
| Push/merge to main | Backend checks and publishing | Frontend checks/publishing only when relevant paths change | None automatically |
| Manual dispatch | No backend manual trigger | Available | SSM deployment with independently supplied backend/frontend tags |

Pushes to `fix/**` do not match the frontend feature-push pattern; relevant PRs can still trigger checks.

### Configured pipeline stages

| Stage | Evidence/status |
|---|---|
| Checkout | Both CI workflows |
| Dependency installation | Both workflows; local locked installs passed |
| Prisma generation | Backend CI |
| Test DB migration | Backend CI |
| Lint | Frontend only |
| Automated tests | Backend Vitest; frontend Vitest/Playwright |
| Application build | Both workflows |
| Docker build | Both workflows |
| GHCR authentication | Both publishing paths |
| Image publishing | SHA and `latest` tags |
| AWS OIDC authentication | Separate deploy workflow |
| SSM remote commands | Separate deploy workflow |
| Image pull/Compose update | Host script |
| Container health checks | Host script |
| Public deployment verification | Inadequate current script |
| Production migration | Missing |
| Failure reporting | Partial; logs/status reported |
| Automatic rollback | Missing |

This establishes configuration, not successful GitHub execution. Authenticated run/registry evidence remains necessary.

### Priority findings

1. **Feature branch can overwrite backend `latest`.**  
   Publishing conditions check only `github.event_name == 'push'`.

2. **Deployment is not connected to successful main CI.**  
   It is manual and does not require the selected images to have passed checks.

3. **Image pair is independently mutable.**  
   Both inputs default to `latest`.

4. **Frontend/backend tags are not guaranteed to share a SHA.**  
   Frontend path filters may skip publishing on a backend-only main commit. A compatible immutable pair is appropriate; blindly requesting the latest main SHA for both images can fail.

5. **No host configuration synchronization.**  
   Deployment has no checkout and invokes preexisting host scripts.

6. **No deployment concurrency safeguard.**  
   Concurrent runs can interfere with the same host.

7. **No workflow-level approved-ref gate.**  
   Actual AWS trust restrictions are external and must be checked.

8. **Unvalidated tag strings become remote shell text.**  
   Validate allowed image references before generating SSM commands.

9. **Backend package write permission covers the whole job.**  
   Narrow publishing permissions to the job that needs them.

10. **Rollback and public verification are incomplete.**

11. **Frontend browser gates now include the download fixture suite.**  
   Local Windows WebKit results failed two assertions. Ubuntu CI results must be inspected before concluding whether publishing is blocked there.

12. **No configured backend lint stage or dependency/image security gate.**

The current main workflows do not require an SSH deployment key or explicitly configure long-lived AWS access keys. Host-side GHCR credentials and AWS role settings remain external review items.

---

## I. Security Findings

Severity reflects demonstrated impact or potential consequence. It is not a claim that production has been compromised.

### Critical

**No critical exploit or live credential exposure was confirmed.**

This is not a security certification. AWS configuration, real ownership behavior, host secrets, and production data paths were not inspected.

### High

| Finding | Evidence | Remediation | Owner |
|---|---|---|---|
| Backend authentication lacks input/password bounds | E02, E03; bcrypt boundary probe | Validate request types, names/email, password minimum and compatible byte maximum; map duplicate races. | Eunice |
| Upload restrictions can be bypassed by MIME declarations | E06 | Apply active filename/empty-file/type validation; check content signatures where appropriate; add mounted-route tests. | Eunice |
| No login/registration/upload abuse controls | E01, E04 | Introduce appropriate rate/concurrency limits and verify proxy/client-IP handling. | Eunice |
| Feature backend can publish production `latest` | E21 | Publish production alias only from approved main; deploy immutable tested pairs. | Samuel |
| Deployment accepts independently selected, ungated releases | E20, E21 | Successful-CI release gate, immutable references, validated inputs, concurrency and correct verification. | Samuel |
| Backend port is published on all interfaces | E18 | Remove/publicly restrict host binding and verify security groups. Actual internet exposure is unconfirmed. | Samuel |
| Dependency scan reports high-severity packages | E28; npm audit | Triage actual reachable paths, select compatible remediation, rebuild/retest; avoid blind major-version fixes. | Eunice |
| Test evidence does not establish cross-user isolation | E23 | Use two real users and an existing owner’s file; test every operation and verify no storage side effect. | Kizito |

The backend npm scan reported four high-severity **package entries**: `prisma`, `@prisma/config`, `deepmerge-ts`, and `mysql2`. These include propagated dependency findings, not four independent demonstrated application exploits.

The advisories cover recursive-graph stack exhaustion and MySQL protocol/authentication risks. CloudDrop uses PostgreSQL and does not directly connect with MySQL2 in the inspected application services. Production request-path exploitability was not established. The backend Dockerfile nevertheless retains development tooling. [Deepmerge maintainer advisory](https://github.com/RebeccaStevens/deepmerge-ts/security/advisories/GHSA-ggr8-5vv4-36mx), [MySQL2 authentication advisory](https://github.com/sidorares/node-mysql2/security/advisories/GHSA-3f6p-5ww8-9rcr), [MySQL2 compression advisory](https://github.com/sidorares/node-mysql2/security/advisories/GHSA-rgwj-5xj2-c3m3)

### Medium

| Finding | Evidence/impact | Remediation |
|---|---|---|
| Invalid category/malformed JSON becomes 500 | Confirmed probes; E06 | Centralize validation/parser error mapping to safe 4xx envelopes. |
| Generic error logging can include sensitive input | `console.error(err)`; parser exceptions include body | Redact error fields, request bodies, tokens, and signed URLs. |
| Live-flow script prints registration response | E26; response includes token | Log only assertions and redacted identifiers before using/publishing results. |
| CORS unrestricted in code | E01 `cors()` | Configure intended origins; do not treat CORS as authorization. |
| Security headers not configured in reviewed proxy/app | E01, E19 | Add appropriate headers and test compatibility with the actual UI. |
| JWT claims/policy not explicitly constrained | E03 | Validate claim shape and expected signing policy; document lifetime/revocation. |
| Browser token accessible to JavaScript | E11 | Harden XSS defenses and document the storage/lifetime decision. |
| Share expiry promise can be inaccurate | E08 | Return effective expiry or enforce stored-token lifetime with fresh short-lived URLs. |
| Upload compensation failure is swallowed | E04 | Record redacted failure and provide retry/reconciliation. |
| S3-first deletion can leave stale DB state | E05 | Define idempotent failure recovery and test it. |
| Backend runs without explicit non-root user | E17 | Establish non-root runtime and minimal image contents. |
| Full infrastructure/security review unavailable | E22 | Verify IAM, bucket, database/network isolation, and certificate operations. |

### Low

- `.gitignire` is an ineffective duplicate filename.
- PR template is located under `.github/workflows/`, outside the normal template location.
- Some comments still describe implemented functionality as stubs or future work.
- Both npm and stale pnpm lockfiles exist for the backend.
- Public Nginx response exposes its version.
- Documentation overstates or misdescribes parts of current implementation.

### Credential scan

The scan inspected current tracked files and accessible history using indicators for AWS access keys, GitHub tokens, and private keys, without displaying matched secret values.

Results:

- No high-confidence current tracked credential match was found.
- Historical matches occurred in previously committed third-party `backend/node_modules/dotenv/README.md`.
- The inspected historical documentation contained placeholder-style markers, an ellipsis, and no standalone long base64 body lines.
- No actual private credential was confirmed.

This is a bounded pattern scan. It does not establish that every possible secret format, deleted object, GitHub secret, or host credential is safe.

If a real credential is subsequently identified, invalidate it first and coordinate history remediation separately. No credentials were rotated or revoked.

### Former-member access review

Samuel and Ife must inventory:

| Access surface | Required manual review |
|---|---|
| GitHub | Collaborators, teams, repository/admin permissions, branch protection and environment approvals |
| GitHub Actions | Secret owners, environments, workflow dispatch permissions, OIDC subjects |
| AWS IAM | Users, access keys, roles, inline/managed policies, trust relationships |
| EC2 | SSH authorized keys, users, instance-connect permissions, sudo access |
| SSM | Session Manager and Run Command permissions, accessible instances |
| GHCR | Package permissions, host tokens, token ownership/expiry |
| Git | Deploy keys, machine accounts, automation credentials |
| Operations | Access to `.env`, certificates, logs, backups, runbooks and DNS |

Transfer operational ownership to Samuel. Review and remediate unnecessary access through the team’s authorized administration process; nothing was revoked during this audit.

---

## J. Testing Results and Coverage Gaps

### Environment and isolation

Tests used an archive of the exact committed main revision in:

```text
C:\Users\DELL\AppData\Local\Temp\
clouddrop-audit-20261013-3312b3f0bf6946e7bee2a961cd1bcfdb\source
```

Environment:

- System Node: `22.16.0`
- npm: `10.9.2`
- Supplemental test Node: `24.21.0`
- Docker CLI: `29.7.2`
- Docker engine: unavailable
- AWS/GitHub CLI: unavailable
- OpenSSL: available
- Backend DB URL: dummy unreachable loopback endpoint
- JWT secret: dummy audit-only value
- No production `.env` or database data was read

### Commands and actual outcomes

| Check/command | Result | What it proves | What remains unverified |
|---|---|---|---|
| `git fetch origin` and main comparison | Passed; matching SHA | Audit used fetched latest main | GitHub protections/reviews |
| Backend `npm ci --ignore-scripts --no-audit --no-fund` | Passed; 362 packages | Lock/manifests support clean installation | Install lifecycle scripts/image build |
| Frontend same install command | Passed; 245 packages; engine warnings | Locked installation succeeds | Supported minimum runtime consistency |
| Backend `npm exec -- prisma generate` | Passed | Prisma config discovered; client generated | Live DB/schema |
| Backend `npm exec -- prisma validate` | Passed | Schema/config valid | Migration application |
| Backend `npm run build` | Passed | Active and legacy TS source compiles | Container/runtime behavior |
| Backend `npm exec --yes --package=node@24 -- node node_modules/vitest/vitest.mjs run --pool=threads` | **55 passed, 8 failed; exit 1** | Local unit/guard/error behavior exercised | DB-backed cases failed with `P1001`; no live storage proof |
| Frontend `npm run typecheck` | Passed | Frontend TS checks | Runtime integration |
| Frontend `npm run lint` | Passed | Configured lint rules pass | Security/functional correctness |
| Frontend `npm run build` | Passed | Production bundle generated | Deployed image/source |
| First Node 24 thread-pool frontend unit run | 84 tests passed; worker failed to start for one file; exit 1 | Partial execution | Whole suite initially not green |
| Targeted omitted file run | 15 passed; exit 0 | File-action assertions passed separately | Initially did not prove one complete green run |
| Final complete Node 24 thread-pool run | **99 passed across 17 files; exit 0** | Complete local unit suite passed with stated runner | Default CI runner/environment and real backend |
| `npm run test:e2e -- --workers=1` | **18 passed, 6 skipped; exit 0** | Desktop/mobile Chromium demo UX and automated accessibility | All real-backend tests skipped |
| `npm run test:downloads` | **10 passed, 2 failed; test exit 1** | Chromium file bytes/filename and controlled transport; partial WebKit | WebKit Unicode filename and focus return; real S3 |
| `npm audit --json`, backend | Four high-severity package entries | Current advisory findings for installed lock | Reachability and remediation |
| `npm audit --json`, frontend | Zero reported findings | No npm-listed findings returned for this lock | Does not establish application/image security |
| Both Compose `config --no-env-resolution --no-interpolate --quiet` | Passed | Structural configuration syntax | Env resolution, mounts, network, startup |
| `bash -n` for deploy/verify/rollback | Passed | Shell syntax parses | Operational correctness |
| `docker info` | Failed: engine pipe unavailable | Docker runtime unavailable locally | Image build and all container checks |
| Docker image build | **Not run: engine prerequisite unavailable** | Nothing about image success | Samuel must build/run images |
| Isolated Supertest probes | Executed successfully; defects described in E | Category/parser status defects and expired-JWT rejection | Valid storage/database operations |
| Bcrypt boundary probe | Different suffix accepted after same 72-byte prefix | Missing compatible password-boundary handling | Actual account persistence |
| Public HTTPS HEAD | HTTP 200 with normal TLS verification | Current public TLS/application shell responds | Authenticated functionality |
| Public HTTP HEAD | HTTP 301 to HTTPS | Redirect works | Renewal |
| Public `/health` GET | Expected JSON | Liveness route reachable through public proxy | DB/S3 readiness |
| Public `/api/v1/categories` GET | Six expected values | Public catalog reachable | User data paths |
| Missing public asset HEAD | HTTP 404 | Missing asset did not return app shell | All cache behavior |
| EIP port 5000 HEAD | Timed out after 20 seconds | No response from this test location | Does not prove security-group configuration |
| GitHub PR/run API queries | HTTP 404 | Metadata inaccessible without suitable access | PR/run/publishing outcomes |
| Final Git diff/status | Clean | Audit did not alter project files | — |

The supplemental Node version and `--pool=threads` were audit runner choices, not changes to repository configuration.

### Public frontend revision observation

The public HTML referenced:

```text
index-DRwGMJj2.js
index-B5jMUyKt.css
```

The newly audited frontend build produced:

```text
index-AFPiBxw6.js
index-BCFzS0bU.css
```

This is evidence that the served asset set differs from this build. It supports checking for a stale release, but it does **not independently identify the deployed image digest or source SHA**.

### Test coverage weaknesses

- Successful real registration/login/password persistence untested here.
- Authentication error tests mock the service.
- “Cross-user” API tests request nonexistent files.
- Ownership helper tests cover a helper not used by active owner-scoped queries.
- Stronger file-validation tests cover an unused validator.
- Search/category/pagination acceptance tests expect empty results.
- S3 download tests mock the presigner.
- No populated database/S3 lifecycle fixture is used by normal CI.
- Real browser tests are opt-in and skipped in the normal demo suite.
- The “expired token” browser check uses a malformed token, not a truly signed expired JWT.
- Sharing expiry tests verify date arithmetic rather than real URL expiration.
- Full-flow browser test does not include another user or elapsed share expiry.
- Failure-injection, cleanup, upload/delete consistency, and accurate statistics tests are missing.
- Backend live-flow script labels all 2xx as PASS, so expected 404 denials are misleadingly reported as FAIL; it also does not consistently assert expected outcomes.
- No production migration/rollback rehearsal was performed.

### Audit artifacts

Actual local screenshots and WebKit failure traces exist in the temporary copy:

- [Chromium browser evidence](/C:/Users/DELL/AppData/Local/Temp/clouddrop-audit-20261013-3312b3f0bf6946e7bee2a961cd1bcfdb/source/frontend/test-results)
- [Download fixture evidence and traces](/C:/Users/DELL/AppData/Local/Temp/clouddrop-audit-20261013-3312b3f0bf6946e7bee2a961cd1bcfdb/source/frontend/test-results-downloads)

These are **demo/local-fixture evidence**, not live AWS implementation evidence. They were not copied into project files.

---

## K. Documentation and Presentation Gaps

| Deliverable | Finding | Exact remaining work |
|---|---|---|
| Root README | Headings without substantive content | Complete overview, problem, objectives, actual features/stack, setup, URLs, verification, team and links. |
| Backend README | Legacy routes and “S3 next stage” claim | Replace with active contract and current implementation status. |
| Frontend README | Useful detailed setup/integration documentation | Correct supported Node minimum; mark attachment backend work merged; separate deployed verification. |
| Download handoff | Describes backend change still to implement | Record PR #39 as merged; retain deployment/real-storage acceptance steps. |
| Architecture | Basic text flow | Diagram frontend container, public proxy/TLS, API, private RDS, S3, role credentials, GHCR, OIDC/SSM and trust boundaries. |
| Deployment guide | Partial and stale | Current HTTPS/frontend architecture, host bootstrap, migration, immutable releases, verification and rollback. |
| AWS documentation | Claims successful setup/testing without linked evidence | Add dated redacted records and correct public IP; distinguish reports from verification. |
| Environment documentation | Examples exist | Required/default/secret/build-time/runtime variables; local/staging/production differences. |
| API documentation | Route list | Request/response examples, multipart fields, auth, limits, errors, pagination and TTL semantics. |
| Testing guide | Several commands exist | Disposable DB/S3 setup, seeded users, supported Node, browser prerequisites, expected results and cleanup. |
| Troubleshooting | Not comprehensive | DB TLS, S3/IAM, SSM, GHCR, migrations, proxy uploads, stale assets, certificate expiry and rollback. |
| Requirements tracker | Outdated and assigns unavailable member | Update statuses/evidence and active ownership. |
| Screenshots/diagram directories | README placeholders empty | Add verified, redacted artifacts with date/SHA/environment. |
| Team contributions | Not comprehensively recorded | Map approved names to PRs/commits/deliverables without inventing attribution. |
| Presentation deck | No deck found | Produce all required topics and rehearse. |

The frontend declares support for Node 22.12+, but installed dependency engine requirements include newer minimums, such as 22.22.2 or 24.15.0. Document a supported version that satisfies the lock.

### Presentation requirements

| Required topic | Evidence/material still needed |
|---|---|
| Introduction | Concise project overview and working target URL |
| Problem statement | Explain secure storage/ownership/sharing need |
| Objectives | Map capstone objectives to actual implementation |
| Application features | Real-mode screenshots and accepted flow |
| System architecture | Accurate current diagram |
| Technology stack | Actual stack, including custom CSS |
| Security architecture | JWT, password hashing, ownership, private storage, TLS, IAM |
| CI/CD workflow | Actual triggers, tests, image publishing and release gate |
| Deployment process | OIDC → SSM → host release with migrations and verification |
| Challenges | Specific documented integration/deployment issues |
| Solutions | Merged PRs and measured outcomes |
| Results | Real QA evidence, CI runs, deployed versions |
| Future improvements | Clearly distinguish optional work |
| Conclusion | Requirement completion and remaining limitations |
| Screenshots/demo | Redacted real application and infrastructure evidence |

Do not present local mock screenshots as proof of real AWS file operations.

---

## L. Critical Blockers

Effort estimates are focused **person-days**, assuming required access is available.

| Blocker | Root cause/evidence | Affected components | Recommended fix | Owner | Dependencies | Effort |
|---|---|---|---|---|---|---|
| No accepted real application journey | Real tests skipped; no disposable DB/S3 available in audit | Backend, frontend, RDS, S3 | Establish isolated integration environment; prove complete flow and ownership | Kizito | Samuel environment; Eunice contract | 1–2 days |
| Unsafe/unverified release selection | Feature can publish `latest`; manual independent tags; served assets differ | CI, GHCR, deploy workflow | Verified immutable compatible image pair, release gate and identity checks | Samuel | Ife baseline; registry access | 0.5–1 day |
| Deployment depends on unverified host state | No config sync/bootstrap/migration stage | Host, Compose, scripts, Prisma | Reproducible configuration delivery, prerequisites and controlled migrations | Samuel | AWS/SSM access; release design | 1–2 days |
| Verification bypasses actual public path | Loopback port check; no version comparison/readiness | Verify script, Nginx | Public HTTPS app/API checks plus image matching and dependency verification | Samuel | Release/config work | 0.5 day |
| Authentication/upload validation incomplete | Raw auth input; MIME trust; unused validator; wrong 500 mapping | Controllers, middleware, validators | Validate active endpoints, normalize errors, add real-route tests | Eunice | Agreed input policy | 1–2 days |
| Sharing promises not tied to effective validity | Direct role-signed URL, unused stored token, weak TTL validation | Share API, UI, metadata | Truthful effective expiry or stored-token resolution; test signing failures/expiry | Eunice | AWS credential evidence | 0.5–2 days |
| WebKit download acceptance fails | Filename fallback and focus-return assertions failed locally | Dialog/download UI/browser fixtures | Reproduce on CI/target Safari; fix focus; resolve documented filename behavior | Jerry / Michael, separate scopes | Browser evidence; backend headers | 0.5–1.5 days |
| Required deliverables incomplete | Empty README/diagram placeholders; no deck/evidence package | Documentation/presentation | Complete current docs and verified evidence, then rehearse | Ife | Technical acceptance | 1–2 days |

Dependency advisory triage, infrastructure security verification, and current rollback also prevent a defensible production-ready claim.

---

## M. Prioritized Completion Roadmap

**Acceptance evidence must record source SHA/image digest, environment, command, result, and reviewer.** Estimates exclude waiting for accounts/access.

### P0 — Must fix immediately

| Task | Exact work required | Owner | Dependencies | Acceptance criteria | Effort |
|---|---|---|---|---|---|
| P0-01 Release baseline | Record accepted main commit, effective 25 MiB scope, compatible component versions and requirement tracker | Ife | None | One approved baseline; no feature-only functionality counted | 0.25–0.5 day |
| P0-02 Runtime inventory | Verify EC2/EIP/DNS, SSM, RDS, S3, instance role, GHCR access and host prerequisites | Samuel | AWS/GitHub access | Redacted inventory matches actual runtime and intended host | 0.5–1 day |
| P0-03 Safe image selection | Prevent feature publishing of production alias; record compatible immutable backend/frontend digests | Samuel | P0-01; CI/registry access | Feature push cannot alter production alias; selected pair has passing evidence | 0.5–1 day |
| P0-04 Reproducible deployment prerequisites | Deliver versioned scripts/config; document network, env, certificates; add controlled migration stage | Samuel | P0-02/03; Eunice schema review | Fresh staging host can reproduce release; migrations precede compatible startup | 1–2 days |
| P0-05 Correct deployment verification | Match requested images; check real public HTTPS shell/API and dependency readiness | Samuel | P0-04 | Wrong image, broken proxy/TLS, missing assets or unavailable dependencies fail verification | 0.5–1 day |
| P0-06 Real integration baseline | Run register/login/upload/list/details/search/filter/download/share/delete with PostgreSQL and isolated S3 | Kizito | P0-02/04; API contract | Correct bytes and metadata; cleanup; reproducible results | 1–2 days |
| P0-07 Real frontend integration acceptance | Disable mocks; verify actual transport, envelopes, errors, cache invalidation and file actions | Michael | P0-06; backend fixes as identified | Complete browser journey passes with actual API; no simulated functionality counted | 0.5–1 day |

### P1 — Required for capstone compliance

| Task | Exact work required | Owner | Dependencies | Acceptance criteria | Effort |
|---|---|---|---|---|---|
| P1-01 Auth validation | Add request schemas, email normalization policy, password byte bounds, duplicate-race mapping | Eunice | Input-policy decision | Malformed/weak/oversized inputs return safe 4xx; duplicate handling consistent | 0.5–1 day |
| P1-02 Active upload validation/errors | Apply filename/empty-file/MIME/content policy; map Zod/parser/Multer consistently; remove stale 2 GB handling | Eunice | P0-01 | Mounted route rejects prohibited inputs before S3; no incorrect validation 500s | 0.5–1 day |
| P1-03 Security hardening | Rate/concurrency controls, JWT claim policy, intended CORS, redacted error logging | Eunice | Proxy/IP policy with Samuel | Tests prove controls; no tokens/body secrets logged | 0.5–1 day |
| P1-04 Dependency advisory triage | Review Prisma dependency findings, reachability and compatible patched options | Eunice | E28 scan; Samuel image review | Remediated or documented justified disposition; build/migrations/tests pass | 0.5–1 day |
| P1-05 Sharing correctness | Validate TTL types/range; truthful effective expiry; handle signing failure; define token usage | Eunice | P0-02 | Advertised expiry matches chosen mechanism; failed signing creates no misleading state | 0.5–2 days |
| P1-06 Real ownership/security tests | Seed two users and existing file; test all cross-user operations, list/search/stats and side effects | Kizito | P0-06 | Every attempted cross-user action denied; owner still accesses unchanged file | 0.5–1 day |
| P1-07 Functional DB/storage tests | Populated pagination/search/category/statistics; real auth; storage compensation and deletion failures | Kizito | Eunice changes; isolated dependencies | Assertions test actual behavior, not empty/missing fixtures | 1–2 days |
| P1-08 Trustworthy QA harness | Redact script output; assert expected statuses; fail on errors; cleanup on failure | Kizito | P0-06 | Harness exits nonzero on mismatch and never prints live tokens/URLs | 0.5 day |
| P1-09 Main deployment automation | Connect approved successful CI to release; validate refs/tags; add concurrency and appropriate job permissions | Samuel | P0-03/04; GitHub/AWS trust review | Failed/unapproved/non-main run cannot deploy; compatible digests recorded | 0.5–1 day |
| P1-10 Operational rollback | Restore compatible pair; executable script; proxy refresh; HTTPS verification; schema policy | Samuel | P0-04/05 | Staging rollback returns to known-good functional release with evidence | 0.5–1 day |
| P1-11 Infrastructure security/access | Verify private S3/RDS, IAM/OIDC scope, port restrictions and former-member access | Samuel | P0-02 | Dated redacted review; necessary active-team access only | 0.5–1 day |
| P1-12 HTTPS/log operations | Verify renewal/reload/expiry alerting; security headers; log redaction/retention/monitoring | Samuel | P0-02/05; Eunice logging | Renewal and monitoring evidence; safe logs and documented troubleshooting | 0.5–1 day |
| P1-13 Dialog accessibility | Explicit focus-return behavior; verify download/share/delete dialogs and screen reader | Jerry | E24 failure; UI interface agreement | Target-browser keyboard/focus tests and human review pass | 0.5–1 day |
| P1-14 Download browser compatibility | Investigate WebKit filename fallback on CI/target Safari; verify real S3 attachment headers/bytes | Michael | P0-06; Eunice header support if needed | Supported-browser behavior accepted; regression suite green or narrowly justified | 0.5–1 day |
| P1-15 Dashboard/expiry UI | Show per-category stats; use agreed accurate expiry contract | Michael | Eunice statistics/share contract | Displayed counts/expiry match authoritative API and real fixtures | 0.5–1 day |
| P1-16 Backend/API setup docs | Correct active routes; examples/errors/limits; migrations and supported environments | Eunice | Final contract | Another member can run backend/tests from clean setup | 0.5 day |
| P1-17 Verified evidence package | Capture real flow, denied access, CI, images, TLS, health and infrastructure evidence | Kizito | P0/P1 technical acceptance | Redacted evidence linked to requirements and release version | 0.5–1 day |
| P1-18 Capstone documentation/deck | Complete root README, diagram, contributions, current links, all presentation topics and rehearsal | Ife | Accepted technical evidence | Complete package; rehearsal passes without unsupported claims | 1–2 days |

### P2 — Quality and reliability

| Task | Exact work required | Owner | Dependencies | Acceptance criteria | Effort |
|---|---|---|---|---|---|
| P2-01 Consistency recovery | Idempotent deletion/retry, recorded cleanup failures and reconciliation procedure | Eunice | P1 failure tests | Recoverable object/metadata inconsistency is observable and repairable | 1–2 days |
| P2-02 Database lifecycle | Shared Prisma client/pool, graceful shutdown, deterministic ordering, defined share metric | Eunice | P1 functional tests | Bounded pool behavior, stable pagination and correct metric tests | 0.5–1 day |
| P2-03 Development Docker | Make root Compose a valid documented local stack; align package-manager choice | Samuel | P0 baseline | Clean local setup starts without production certificates or implicit services | 0.5–1 day |
| P2-04 Runtime image hardening | Non-root/minimal image, suitable migration tooling separation, image scan | Samuel | P1 dependency decision | Runtime image builds/runs securely with required features | 0.5–1 day |
| P2-05 Readiness/monitoring | Separate dependency readiness from liveness; useful health/alert thresholds | Samuel | Eunice readiness contract | Dependency failure produces actionable signal without secret leakage | 0.5–1 day |
| P2-06 Category adapter consistency | Implement categories HTTP adapter or remove unsupported capability and document fixed enum | Michael | Stable category contract | Adapter/UI/documentation agree | 0.25 day |
| P2-07 Capacity/boundary tests | 25 MiB proxy boundary, concurrent requests, slow transfer, resource measurements | Kizito | Running staging containers | Defined safe capacity and failure behavior recorded | 0.5–1 day |
| P2-08 Wider UX/device review | Physical mobile, zoom, reduced motion, remaining contrast and screen-reader cases | Jerry | P1 dialog fixes | Supported-device usability evidence recorded | 0.5 day |

### P3 — Optional enhancements

| Task | Exact work required | Owner | Dependencies | Acceptance criteria | Effort |
|---|---|---|---|---|---|
| P3-01 Large files | Streaming/direct multipart upload, bounded resources, large-size metadata/API strategy | Eunice | Explicit requirement; Samuel capacity | Intended large size works reliably without buffering whole upload | 3–5 days |
| P3-02 Additional file UX | Preview/rename/bulk actions only after required features accepted | Michael | Capstone completion | Optional behavior tested without breaking existing contract | 1–3 days |
| P3-03 Share management | Optional revocation/history/management beyond expiring-link requirement | Eunice | Stable share model | Defined revocation behavior tested | 1–2 days |
| P3-04 Infrastructure automation | Codify externally verified resources if time permits | Samuel | Verified AWS inventory | Reproducible resource definitions without changing accepted architecture unnecessarily | 2–4 days |

If the evaluator explicitly requires 2 GB uploads, promote P3-01 into required work and revisit the critical path. Do not advertise 2 GB support in the current application.

---

## N. Team Task Allocation

These are future deliverables, not invented historical contributions.

| Member | Concrete ownership |
|---|---|
| **Ife** | Release baseline and requirements tracker; architecture decisions; PR/integration review; approved contribution mapping; root README and architecture diagram; deck and final rehearsal; final acceptance. |
| **Eunice** | Active backend validation/error/security changes; password bounds; sharing/statistics correctness; Prisma/database lifecycle and consistency design; dependency advisory decisions; backend/API documentation. |
| **Samuel** | AWS/host inventory; IAM/OIDC/SSM/security groups; secrets/access review; Docker/Nginx/runtime verification; immutable releases; config delivery/migrations execution; CI/CD and rollback; HTTPS/monitoring/deployment documentation. |
| **Jerry** | Shared dialog focus/accessibility; human screen-reader review; mobile/zoom/reduced-motion review; UI evidence and presentation visuals using verified states. |
| **Michael** | Real API/browser integration; download browser behavior; dashboard category presentation; accurate expiry rendering; categories adapter decision; frontend regression tests/docs. |
| **Kizito** | Disposable integration fixtures; real auth/files/ownership/security tests; failure-injection tests; QA harness assertions/redaction/cleanup; evidence capture and acceptance results. |

### Non-overlapping implementation boundaries

- Eunice changes backend application behavior; Kizito owns independent acceptance tests/harnesses.
- Samuel owns release/infrastructure configuration; Eunice reviews schema compatibility.
- Jerry owns shared dialog/accessibility behavior; Michael owns file-action transport/download behavior.
- Ife resolves shared-contract decisions and performs integration review.

### Work that can proceed in parallel

- Samuel’s AWS inventory and release design.
- Eunice’s validation/error/password work.
- Kizito’s seeded test design and harness correction.
- Jerry’s reproducible focus-return fix/review.
- Michael’s download fixture investigation and dashboard work.
- Ife’s documentation structure and architecture draft.

### Dependency sequence

```text
Baseline + runtime inventory
            ↓
Compatible images + reproducible staging deployment
            ↓
Real API/storage baseline and two-user fixtures
            ↓
Security/contract fixes + frontend acceptance
            ↓
Gated CI/CD + migration/rollback/TLS verification
            ↓
Redacted evidence + final documentation/deck
            ↓
Rehearsal + Ife acceptance
```

Chiemezie receives no future assignments. Existing Docker/CI/SSM/Nginx work should be retained where correct and transferred operationally to Samuel.

---

## O. Final End-to-End Verification Checklist

Use a disposable local/staging database and isolated test storage for mutating tests. The audit did not execute this checklist against production data.

### Local quality checks

Run with a supported Node version and test-only environment:

```bash
# Backend
cd backend
npm ci
npx prisma generate
npx prisma validate

# DATABASE_URL must identify the disposable test database.
npx prisma migrate deploy
npm run build
npm test -- --run

# Frontend
cd ../frontend
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium webkit
npm run test:e2e
npm run test:downloads
```

Acceptance: commands exit successfully; skips and environment assumptions are recorded; actual CI results match the supported environment.

### Docker/configuration

```bash
docker compose -f docker-compose.yml config --quiet
docker compose -f docker-compose.prod.yml config --quiet

docker build -t clouddrop-backend:audit ./backend
docker build -t clouddrop-frontend:audit ./frontend

bash -n scripts/deploy.sh
bash -n scripts/verify-deployment.sh
bash -n scripts/rollback.sh
```

- [ ] Resolve environment/network/mount prerequisites explicitly.
- [ ] Execute health commands inside the actual images.
- [ ] Confirm production frontend mock mode is disabled.
- [ ] Confirm backend database URL points to intended RDS.
- [ ] Verify RDS CA and certificate validation inside container.
- [ ] Confirm port 5000 is private or loopback-only as designed.
- [ ] Verify logs and restart/health behavior.
- [ ] Build both images from clean source.

### Functional acceptance

- [ ] Register a unique test user; verify expected envelope.
- [ ] Reject malformed registration, invalid email, empty names and password boundary violations.
- [ ] Reject duplicate email consistently, including concurrent registration.
- [ ] Login with correct credentials; reject wrong credentials safely.
- [ ] Restore session through `/auth/me`.
- [ ] Verify protected routes and logout/cache clearing.
- [ ] Upload allowed file types with selected categories.
- [ ] Verify metadata and actual downloaded bytes.
- [ ] List only the caller’s files.
- [ ] Open details; confirm name/type/size/category/timestamps.
- [ ] Search case-insensitively through populated records.
- [ ] Combine category/search/pagination.
- [ ] Traverse multiple pages without missing/duplicated fixtures.
- [ ] Verify all six categories.
- [ ] Download in supported browsers with accepted filename behavior.
- [ ] Verify cancel/retry/expiry and dialog focus.
- [ ] Create/copy/open a share link as an unauthenticated recipient.
- [ ] Verify actual expiry using a short test lifetime in staging.
- [ ] Verify effective lifetime under the intended credential source.
- [ ] Delete owned file; verify object, metadata and related share behavior.
- [ ] Verify dashboard totals/storage/per-category counts before and after changes.
- [ ] Verify loading, empty, error and success feedback.

### Security acceptance

- [ ] Missing JWT returns 401 on every protected endpoint.
- [ ] Malformed JWT returns 401.
- [ ] A genuinely signed expired JWT returns 401.
- [ ] Invalid signature and malformed claims are rejected.
- [ ] User B cannot view/download/share/delete User A’s existing file.
- [ ] User B’s list/search/stats do not include User A’s data.
- [ ] Failed cross-user deletion leaves the owner’s object/metadata intact.
- [ ] Invalid category and malformed JSON return safe 4xx.
- [ ] Executable/unsupported/MIME-spoofed/empty/malformed-name uploads are handled by active validation.
- [ ] Oversized file rejected before S3 upload.
- [ ] Boundary size works through Nginx.
- [ ] Rate/concurrency controls work behind the proxy.
- [ ] Logs/evidence contain no passwords, JWTs, signed URLs or credentials.
- [ ] Dependency/image findings are resolved or dispositioned with evidence.
- [ ] CORS/security headers work with intended origins and frontend behavior.

### Infrastructure and release acceptance

- [ ] Verify EC2/EIP/DNS association and documented IDs.
- [ ] Verify SSM managed-instance/role/trust configuration.
- [ ] Verify actual instance-role credential source without displaying credentials.
- [ ] Verify private S3 configuration and required object operations.
- [ ] Verify private RDS networking, TLS, applied migrations and backups.
- [ ] Verify least-privilege IAM/OIDC/SSM policies.
- [ ] Verify former-member access review is complete.
- [ ] Feature CI cannot publish a production alias.
- [ ] Failed/unapproved CI cannot deploy.
- [ ] Record compatible image digests and their source/test evidence.
- [ ] Release delivers matching scripts/configuration and migrations.
- [ ] Deployment verifier checks requested versions and public HTTPS application/API.
- [ ] Certificate renewal/reload and monitoring are verified.
- [ ] Rehearse rollback in staging; verify complete user flow afterward.

Read-only public boundary checks:

```bash
curl --fail --silent --show-error https://clouddrop-c8.duckdns.org/health
curl --head http://clouddrop-c8.duckdns.org/
curl --head https://clouddrop-c8.duckdns.org/
```

Passing these does not establish database/storage functionality.

### Full browser journey

On the isolated integration environment:

```bash
VITE_USE_MOCK_API=false \
VITE_API_BASE_URL=/api/v1 \
npm run test:e2e -- e2e/live-flow.spec.ts
```

- [ ] Register → login → upload → list → details → search/filter → download → share → delete.
- [ ] Extend the existing flow to include details, another real user, accurate statistics and elapsed expiry.
- [ ] Use guaranteed cleanup on failure.
- [ ] Verify attachment behavior rather than accepting an unexpected fallback silently.

### Presentation readiness

- [ ] Working accepted live URL documented.
- [ ] Diagram matches verified architecture.
- [ ] README/setup/deployment/API/troubleshooting complete.
- [ ] Evidence references accepted release and environment.
- [ ] All 15 presentation topics covered.
- [ ] Contribution attribution approved.
- [ ] Demo account/files prepared without exposing secrets.
- [ ] Rehearsal completed with named presenter and backup evidence.
- [ ] Demonstration clearly distinguishes production functionality from optional/mock behavior.

---

## P. Definition of Done

CloudDrop is **capstone-ready** when all of the following are satisfied:

1. An approved main revision and compatible immutable deployed image pair are recorded.
2. Required application features pass real PostgreSQL/S3 integration acceptance.
3. Registration/login/password persistence/session restoration work through the actual API.
4. Two-user isolation is proven against existing files across every protected operation.
5. Active validation rejects invalid input with correct safe responses.
6. The upload limit is consistent, tested through Nginx, and accurately documented.
7. Downloaded bytes and supported-browser behavior are verified.
8. Sharing provides an accurate enforced expiry and acceptable failure handling.
9. Dashboard counts/storage/category statistics match authoritative fixtures.
10. Frontend typecheck/lint/build/unit/browser checks pass in the supported environment, with narrowly justified skips only.
11. Backend tests pass with disposable dependencies and meaningful populated fixtures.
12. Actual Docker images build and run with verified health checks and RDS/S3 configuration.
13. AWS IAM, OIDC, SSM, bucket privacy, database isolation, security groups and access controls are verified.
14. Approved main CI produces tested releases and the required deployment automation.
15. Deployment executes controlled migrations and verifies the real public HTTPS application and requested versions.
16. Staging rollback restores a compatible functioning release.
17. HTTPS renewal, logs, monitoring and secret handling are operationally verified.
18. High-security/dependency findings are resolved or explicitly dispositioned with evidence.
19. README, diagram, setup, API, deployment, troubleshooting and team contribution records are complete.
20. Presentation slides cover all required topics, supported by redacted evidence and a successful rehearsal.
21. Ife signs off the requirement matrix against actual evidence.

For a stronger **production-ready** claim, also complete capacity testing, recoverable object/database failure handling, backup/restore verification, operational alerting, patch management, and sustained supported-browser/device validation.

A working home page, static health response, passing mock UI suite, or published image alone is insufficient acceptance.

---

## Q. Recommended Next 10 Actions

| Order | Action | Owner | Completion means |
|---:|---|---|---|
| 1 | Freeze the accepted main baseline and requirement scope | **Ife** | Record `47863bd`, effective upload limit, release-pair policy, active owners and evidence requirements. |
| 2 | Verify actual AWS/host identity and prerequisites | **Samuel** | EIP/DNS/instance, SSM, RDS, S3, role and GHCR inventory is accurate and redacted. |
| 3 | Prevent unsafe production image selection | **Samuel** | Feature branches cannot overwrite production backend alias; compatible immutable images are selected from verified runs. |
| 4 | Make staging deployment reproducible and correctly verified | **Samuel** | Versioned config/scripts, prerequisites, migrations, image matching and public HTTPS verification work. |
| 5 | Establish the first real integration baseline | **Kizito** | Complete database/S3 flow passes; two-user existing-file fixtures and reliable cleanup are available. |
| 6 | Correct active authentication/upload validation and security findings | **Eunice** | Password bounds, input schemas, error statuses, MIME/file policy, abuse controls and advisory disposition are tested. |
| 7 | Correct share lifetime, statistics and failure behavior | **Eunice** | Advertised expiry is enforceable; failed signing/cleanup is handled; statistics match their defined meaning. |
| 8 | Finish real frontend and browser acceptance | **Michael / Jerry, separate scopes** | Michael verifies download/integration/category/expiry behavior; Jerry resolves focus return and completes accessibility review. |
| 9 | Complete gated CI/CD, rollback, TLS operations and access review | **Samuel** | Approved release automation and staging rollback pass; AWS/secret access and certificate/log operations are verified. |
| 10 | Assemble the final capstone package and rehearse | **Ife** | Current README/diagram/deck/contributions and Kizito’s redacted evidence are complete; live rehearsal passes and requirements are signed off. |
