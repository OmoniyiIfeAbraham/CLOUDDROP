# API integration and security testing

Owner: Kizito (KIZMAN)
Scope: prove the mounted `/api/v1` contract. Do not rebuild frontend or AWS workflows.

## What is actually mounted

`backend/src/server.ts` mounts only:

| Method | Path | Auth |
| --- | --- | --- |
| POST | `/api/v1/auth/register` | public |
| POST | `/api/v1/auth/login` | public |
| GET | `/api/v1/auth/me` | JWT |
| POST | `/api/v1/files` | JWT, multipart field `file` |
| GET | `/api/v1/files` | JWT, `search`, `category`, `page`, `limit` |
| GET | `/api/v1/files/:id` | JWT, owner only |
| GET | `/api/v1/files/:id/download` | JWT, owner only, presigned URL |
| DELETE | `/api/v1/files/:id` | JWT, owner only |
| POST | `/api/v1/files/:id/share` | JWT, owner only, body `{ ttlHours? }` |
| GET | `/api/v1/categories` | JWT |
| GET | `/api/v1/dashboard/stats` | JWT, scoped to caller |

`backend/src/routes/file.routes.ts` (GET `/upload`, GET `/:id/share`) is **not** mounted. Do not test it as the live API.

Register body: `{ firstName, lastName, email, password }`.
Login body: `{ email, password }`.
Token is at `data.token`.

## Automated checks

`backend/tests/access-control.test.ts` covers:

- every protected route returns 401 with no token and with a bad token
- a second user cannot read, download, delete, or share an id they do not own (404, no URL leaked)
- upload without a file returns 400
- dashboard stats require auth and return the expected shape

Run:

```bash
cd backend
npx vitest run tests/access-control.test.ts
```

List and dashboard cases need `DATABASE_URL` and `JWT_SECRET`, same as the existing files API tests.

## Live flow (real backend + AWS)

Target: register → login → upload → list → download → share → delete, then a second user must fail every file action.

```bash
BASE_URL=http://localhost:5000 node backend/scripts/live-flow.mjs
```

Paste the script output into the evidence table below and attach screenshots of the same calls in Postman (mock mode off on the frontend).

## Evidence log

| ID | Case | Expected | Result | Evidence |
| --- | --- | --- | --- | --- |
| A1 | No token on files, share, dashboard | 401 UNAUTHORIZED | | |
| A2 | Bad JWT | 401 UNAUTHORIZED | | |
| C1 | User B GET User A file | 404, no body leak | | |
| C2 | User B download | 404, no downloadUrl | | |
| C3 | User B delete | 404, file still exists for A | | |
| C4 | User B share | 404, no token or shareUrl | | |
| F1 | Register + login | 201/200 + JWT at data.token | | |
| F2 | Upload allowed type | 201 + file id | | |
| F3 | List shows only caller files | 200, pagination | | |
| F4 | Download presign | 200, URL expires | | |
| F5 | Share TTL 1–168h | 201, expiresAt | | |
| F6 | Share TTL 0 or >168 | 400 | | |
| F7 | Delete then get | 200 then 404 | | |
| D1 | Dashboard counts match files | totals scoped to user | | |

## Not this work

- Share migration schema changes, upload MIME rules, and dashboard formula fixes stay with Eunice.
- CI/CD consolidation and HTTPS stay with Samuel.
- Frontend visual fixes stay with Jerry.
