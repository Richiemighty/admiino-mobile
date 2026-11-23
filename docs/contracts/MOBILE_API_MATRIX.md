# Mobile API Matrix - P06B Draft

This draft contains verified source facts and unresolved P07 integration fields. It is UI-only; no mobile authentication request is implemented.

| Screen          | Candidate                            | Method  | Contract status                                                                         | Security/verification                                                                                         |
| --------------- | ------------------------------------ | ------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Sign In         | `/auth/login`                        | POST    | Candidate only                                                                          | Backend route exists in read-only source review; mobile payload and response are not approved/contract-tested |
| Current user    | `/auth/me`                           | GET     | Candidate only                                                                          | Unverified mobile payload, bearer handling and error contract                                                 |
| Workspaces      | `/me/workspaces`                     | GET     | Candidate only                                                                          | Unverified payload and workspace membership contract                                                          |
| Forgot Password | `/auth/forgot-password`              | POST    | Candidate only; web client calls it                                                     | Mobile request/response/rate-limit and generic anti-enumeration behavior require P07 verification             |
| Create Account  | `https://www.app.admiino.com/signup` | Browser | Verified public User Portal route origin and `/signup` route in read-only source review | Browser Turnstile/signup protection must remain; no mobile OAuth callback or token handoff                    |

No live endpoint, staging host, signing flow or device-session response is approved here.
