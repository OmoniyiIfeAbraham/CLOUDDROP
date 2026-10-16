# Registration and unverified sign-in recovery

## Report and reproduction

The reported sequence was: registration says the account could not be created, retry says the account already exists, and sign-in returns a generic failure.

The backend deliberately keeps the newly created, unverified user when email delivery fails. It clears the unusable code and returns `503 VERIFICATION_EMAIL_FAILED`. Retrying registration returns `409 EMAIL_ALREADY_REGISTERED`; signing in with the correct password returns `403 EMAIL_NOT_VERIFIED`. The frontend on main did not handle the first and third codes, and its verification step was restricted to successful registration.

On October 16, 2026, read-only public checks returned HTTP 200 for `/health`, `/login` and `/register`. The deployed bundle was `index-cwlQEJeU.js`; it contained the verification UI but neither missing error-code handler. Running that deployed frontend with **all API calls intercepted and fulfilled locally** reproduced the exact three reported messages. No production registration, login or email request was sent. This confirms the UI failure mode; it does not establish the deployed email provider's underlying failure or the affected account's state.

## Frontend behavior

- A registration `VERIFICATION_EMAIL_FAILED` opens verification, states that the account was created, and keeps the delivery error and resend action visible.
- An unverified sign-in opens verification for that email instead of suggesting incorrect credentials. The entered password is cleared from form state.
- Duplicate or ambiguous failed registrations offer sign-in and an explicit finish-verification action. Sign-in carries the email forward; ambiguous responses never assert account creation.
- Verification errors distinguish invalid/expired codes, exhausted attempts and provider failure. Resend success uses a conditional status message, separate from field validation; delivery failures do not mark an untouched code invalid.
- An already-verified response directs the user to sign-in. Neither that response nor any recovery screen creates a session. Only successful verification/login accepts the backend's token.
- Opening recovery does not send email automatically. Resend remains an explicit action, and the backend's existing 60-second resend cooldown and attempt limits remain authoritative.

## Tests and isolation

Two regression tests failed before the fix: registration email failure could not reach verification, and unverified sign-in could not reach verification. HTTP fixture coverage now includes the complete recovery UI, invalid credentials, already-verified accounts, code errors, attempt limits, resend failures and conditional confirmation. The recovery Playwright runner exercises these plus password recovery in desktop/mobile Chromium and WebKit, with accessibility and overflow checks and masked screenshots.

The real-backend auth suite also exercises the exact `503 → 409 → 403` chain followed by resend and successful verification. It uses the existing private `NODE_ENV=test` mailbox and instance guard. For the unique disposable recipient only, the helper temporarily creates an empty private directory at the expected message-file path. This blocks atomic delivery, so the actual backend performs its normal delivery-failure handling. The directory is removed in `finally` before resend. No application fault endpoint, email-provider request, authentication mock or looser mailbox permissions are introduced. Normal live registration is unchanged when this optional fault is absent.

Use the [isolated email-verification setup](live-email-verification.md), then run:

```bash
npm run test:recovery
E2E_BASE_URL=http://127.0.0.1:25000 CLOUDDROP_LOCAL_FRONTEND=true \
  npm run test:live -- e2e/live-auth.spec.ts
```

The live runner needs a disposable database and the same private mailbox path exported to the backend and test runner. Its existing guard refuses ordinary production backends before registration. Existing live/S3 opt-in conditions remain unchanged.

## Backend and deployment handoff

Eunice/Samuel should inspect the deployed backend's sanitized error logs and email-provider delivery results to identify why verification mail failed, including the configured `RESEND_API_KEY`, verified sending domain and `EMAIL_FROM`. Do not paste secrets or verification codes into reports. The frontend fix makes recovery available; successful delivery still requires a working provider configuration. Confirm the affected user's verification state through authorized backend tooling, and test resend with a coordinated test account after release. Health HTTP 200 alone does not verify outbound email delivery.

The production Compose file sets `NODE_ENV=production` and loads the root `.env` on EC2 (the deployment workflow runs under `/opt/clouddrop`). Check that the email settings reach that running backend container, reporting only set/unset status. The backend Docker build excludes `.env` files; editing a local `backend/.env` does not configure the deployed image. Startup currently validates only `DATABASE_URL` and `JWT_SECRET`, so missing email credentials can coexist with a healthy container; production email sending then throws instead of using the development log fallback. The actual server settings have not been inspected in this investigation.

For the deployment owner, this read-only check reports presence without displaying values:

```bash
docker exec clouddrop-backend node -e 'for (const name of ["RESEND_API_KEY", "EMAIL_FROM", "FRONTEND_URL"]) console.log(name, process.env[name] ? "set" : "unset")'
```

Set variables still need valid credentials/sender configuration; presence alone does not prove delivery.

This follow-up is based on password-recovery PR #49 so it shares the auth layout and recovery test runner. Review/merge #49 before this follow-up; no shared migration, environment change or production deployment is performed by this work.

## Validation on October 16, 2026

| Check | Result |
| --- | --- |
| Before-fix regression | The two new delivery-failure/unverified-login tests failed |
| Frontend unit tests | 156 passed |
| Auth/password recovery HTTP browser fixtures | 40 passed across desktop/mobile Chromium and WebKit |
| Actual backend auth browser tests | Eight passed across the same four projects, including delivery failure recovery and normal registration/login |
| Standard demo UI regression | 20 passed; 18 expected live-only skips |
| Frontend production build, app/E2E types and lint | Passed |

The actual-backend run used a disposable PostgreSQL 16 database with all four existing migrations. Its eight accounts finished verified, with no pending code hashes, private message files or blocked message directories. Automated accessibility checks also passed against the real recovery screens. Screenshots mask the code/password fields; no test traces or videos were recorded. The container and mailbox were removed after the run. No production email delivery, shared-database migration or deployment was performed.
