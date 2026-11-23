# P08 Authentication and Sessions

P08 activates the verified backend login contract without changing P06B visual screens.

## Integrated contract

- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `GET /api/v1/auth/workspaces`

Successful login stores only the returned bearer JWT and first eligible workspace ID in Expo SecureStore. The P07 SecureStore implementation is used; passwords and tokens are never written to AsyncStorage or logs.

## Session restoration

App startup checks the stored JWT expiry locally. Expired or malformed tokens are removed. Valid tokens are checked through `GET /auth/me`.

- 401: remove the local session and return to Sign In.
- 403: preserve the session and show access-denied state.
- 423: preserve the session and show suspended-workspace state.
- Network/timeouts: do not invalidate the session; report a restorable error.

The backend has no verified refresh/revoke mobile session contract. P08 does not mint or extend JWT lifetime and does not invent a refresh endpoint.

## Sign out

Sign out removes the secure access token and active workspace ID and clears in-memory auth state. It does not claim server-side token revocation.
