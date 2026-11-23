# P09 Account Recovery and Activation

## Production API configuration

The mobile app is configured for the verified production API origin
`https://api.admiino.com`. The API client adds `/api/v1`; the health probe uses `/health`.
Production environment validation accepts only this HTTPS host. The retired
`admiino-backend.onrender.com` service is not an allowed API target.

## Account journeys

- **Signup:** `CreateAccountScreen` opens the approved Admiino User Portal signup flow. Browser-based Turnstile and backend signup controls remain in the portal.
- **Unverified sign-in:** the backend's explicit unverified-account response is preserved and links to the mobile resend-verification screen; other 401 responses remain generic invalid-credential errors.
- **Forgot password:** `POST /api/v1/auth/forgot-password` sends `{ email }`. The mobile app displays generic inbox guidance only after an accepted response and never indicates whether an account exists.
- **Reset password:** existing email links use the portal's `/reset-password/:token` flow. The mobile route hands the token to that approved HTTPS page; no mobile deep-link association or alternate reset contract is assumed.
- **Email verification:** the mobile screen can inspect a verification token with `POST /api/v1/auth/verify-email/inspect`, resend with `POST /api/v1/auth/resend-verification`, and open the device email app. Verification and password setup remain server-confirmed in the existing web flow.
- **Workspace invitations:** `GET /api/v1/invites/:token` displays the server-provided masked recipient and workspace. An authenticated user can accept via `POST /api/v1/invites/:token/accept`; the backend enforces the invited-email match. Signed-out users continue through the existing portal invitation flow.
- **Organisation activation:** the app checks `POST /api/v1/auth/org-activation/inspect`, then hands off to the existing portal. The single-use token is in the URL fragment, matching the portal contract; activation is never claimed until the server completes it.

## Verification boundaries

Automated tests use mocked responses. Only read-only production health endpoints were checked; no production login, password recovery, verification, invitation or activation request was sent. The reset, verification-completion and organisation-activation user journeys remain web-based because mobile universal/app links are not approved.

Refreshable/revocable device sessions remain a backend production-release dependency.
