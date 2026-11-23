# P07 API and Session Foundation

P07 establishes transport and secure-session infrastructure. P08 is required before live Sign In is activated.

## API

- `src/api/config.ts` derives the `/api/v1` origin from the existing P03 environment validator.
- `src/api/client.ts` provides typed timeout/network/HTTP response handling.
- Protected requests add `Authorization: Bearer <token>` and optional `x-company-id`.
- Backend errors retain HTTP status and backend `status`, `code`, and `message`.

## Verified contracts

- Public health: `GET /health` and `GET /api/health`
- Login: `POST /api/v1/auth/login`
- Current user: `GET /api/v1/auth/me`
- Workspaces: `GET /api/v1/auth/workspaces`

Login returns `{ status, message, token, data: { user, workspaces } }`. The backend uses one bearer JWT with a configured expiry; no mobile refresh endpoint was found. `x-company-id` selects workspace scope.

## Secure storage

`src/auth/sessionStorage.ts` uses `expo-secure-store` for the access token and active workspace ID. AsyncStorage is not used for authentication.

## Session behavior

- `restoreSession` deduplicates simultaneous restore calls and validates the stored JWT through `GET /auth/me`.
- 401/403 clears the secure session.
- Network/server errors do not invalidate the session.
- Logout removes token and workspace values.
- No refresh endpoint exists, so there is no invented refresh loop.
