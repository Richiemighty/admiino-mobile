# Mobile API Matrix - P06B Draft

This draft contains verified source facts and unresolved P07 integration fields. It is UI-only; no mobile authentication request is implemented.

| Screen          | Candidate                            | Method  | Contract status                                                                         | Security/verification                                                                                                                               |
| --------------- | ------------------------------------ | ------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sign In         | `/api/v1/auth/login`                 | POST    | Verified from backend source                                                            | Body `{ email, password, accountType?: "workspace" }`; response includes bearer `token`, `data.user`, and `data.workspaces`; not live-mobile-tested |
| Current user    | `/api/v1/auth/me`                    | GET     | Verified from backend source                                                            | Bearer required; `x-company-id` optional; response `data.user`                                                                                      |
| Workspaces      | `/api/v1/auth/workspaces`            | GET     | Verified from backend source                                                            | Bearer required; active workspace header accepted                                                                                                   |
| Forgot Password | `/auth/forgot-password`              | POST    | Candidate only; web client calls it                                                     | Mobile request/response/rate-limit and generic anti-enumeration behavior require P07 verification                                                   |
| Create Account  | `https://www.app.admiino.com/signup` | Browser | Verified public User Portal route origin and `/signup` route in read-only source review | Browser Turnstile/signup protection must remain; no mobile OAuth callback or token handoff                                                          |

No live endpoint, staging host, signing flow or device-session response is approved here.
