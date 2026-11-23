# P06B Authentication UI

P06B is UI-only. It does not authenticate users, store credentials or tokens, create accounts, or send password-reset requests.

## Routes

- `/sign-in`
- `/create-account`
- `/forgot-password`

`AccountChoiceScreen` routes to Create Account and Sign In. Sign In routes back to Account Choice or onward to forgot-password/create-account. Forgot Password routes back to Sign In.

## Reusable components

`AuthScreen` provides safe-area handling, keyboard avoidance, scrolling, branded header content, and optional footer/back controls. P05 `AppInput`, `AppButton`, `AppText`, `InlineError`, and `Logo` provide form and feedback styling.

## UI-only boundaries

Sign In validates locally and displays an awaiting-backend state. It never calls the API or changes the authenticated session.

Forgot Password validates locally and displays awaiting-backend integration. It never claims an email was sent and never reveals account existence.

Create Account opens the verified public User Portal HTTPS signup route at `https://www.app.admiino.com/signup` through the system browser. The page retains Turnstile and existing signup protections.

## Outstanding integration

Live contracts require P07/P08 verification:

- `POST /auth/login`
- `GET /auth/me`
- `GET /me/workspaces`
- `POST /auth/forgot-password`
- secure signup hand-off/mobile redirect contract
- device-session and token-storage decisions
