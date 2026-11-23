# P08 Authentication QA

P08 login and session behavior is implemented with contract-accurate mocks. No approved development or staging API origin was configured in this workspace, so real login was not executed and no production credentials were used.

Covered behavior:

- Successful login state and workspace selection
- Invalid credentials and unverified accounts
- 429 rate limiting
- 401 session invalidation
- 403 access-denied state
- 423 suspended-workspace state
- Network and timeout errors
- Secure token removal on logout
- JWT expiry and session restoration
- Protected authenticated route boundary
