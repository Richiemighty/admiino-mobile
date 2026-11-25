# Contract discrepancies and release blockers

| Blocker                   | Required behavior                                                                  | Verified current evidence                                                                             | Owner / status                           |
| ------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| B-01 device sessions      | Rotating refresh, expiry and revocation with safe resume                           | Matrix documents login/me but no confirmed refresh/device-session route                               | Backend/auth: BLOCKED pending contract   |
| B-02 push delivery        | Device registration, APNs/FCM delivery, preferences and routed payloads            | No mobile device-registration or server push contract in `MOBILE_API_MATRIX.md`; Inbox is in-app only | Backend/platform: BLOCKED                |
| B-03 Google mobile auth   | Mobile-safe OAuth return or ID-token exchange without JWT in URL                   | No native mobile contract; sign-in keeps Google unavailable rather than bypassing web security        | Backend/auth: BLOCKED                    |
| B-05 universal/app links  | Verified association files and safe token-fragment handling                        | Expo routes/custom schemes exist, but no verified association evidence or device test                 | Web/mobile release: NOT RUN / BLOCKED    |
| B-08 account deletion     | Authenticated deletion/request contract, ownership transfer and retention behavior | `/account/delete` explicitly states no request is submitted; no confirmed backend route               | Backend/policy: BLOCKED                  |
| B-10 reviewer permissions | Server-authoritative review/status permission matrix                               | Mobile consumes effective permission data; staging reviewer cases and contract tests are not supplied | Backend/product: BLOCKED pending staging |

Additional discrepancy: the API matrix documents authenticated task/project file downloads and in-app Inbox endpoints, but does not provide a push transport or account-deletion contract. The mobile implementation does not invent either capability.
