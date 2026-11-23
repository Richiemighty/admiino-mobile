# P07 API Foundation QA

P07 is source and test complete. Live backend connectivity was not available in this workspace:

- `http://127.0.0.1:5001/health` refused the connection.
- `http://127.0.0.1:8080/health` refused the connection.
- No production or unapproved staging host was called.

Verified backend source contracts:

- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `GET /api/v1/auth/workspaces`
- Public `GET /health` and `GET /api/health`

The source has no verified mobile refresh-token endpoint. P07 therefore validates stored sessions by `/auth/me`, clears 401/403 sessions, and does not implement an invented refresh loop.

Live Sign In remains deliberately disabled. P08 must add verified staging test credentials and activate the UI after contract testing.
