# AGENTS.md — Admiino Mobile

> Repository-level operating instructions for AI coding agents and contributors.
> Product: **Admiino Mobile**, an Expo / React Native / TypeScript companion to the authenticated Admiino User Portal.
> Platforms: **Android and iOS**. Source of product intent: `docs/product/Admiino_Mobile_UX_Blueprint_v1.md` (copy the approved blueprint into this path before feature work).
> Status at repository inception: **proposed architecture and scope; backend dependencies are not yet certified**.

## 0. Instruction precedence and required reading

1. Follow system/developer instructions, then this file, then approved task instructions, then repository conventions. If instructions conflict, stop and report the conflict.
2. Before changing code, read `AGENTS.md`, the current approved blueprint, `docs/decisions/DECISIONS.md`, `docs/contracts/MOBILE_API_MATRIX.md`, and the files directly involved in the task. If these documents have not yet been created, report that fact; do not invent their contents.
3. Use the **22 November 2026 discovery audit** as evidence of source-level findings, not proof of runtime or production behaviour. Its audited web commit was `e57ea33` on `fix/team-dashboard-metrics-and-navigation`. Re-check the current source before porting anything.
4. This repository is a **new mobile client**, not a mirror of the web repository. Never copy whole web pages or the 5,423-line web `api.ts` wholesale.
5. Work in **one approved phase and one bounded task** at a time. A prompt for one phase does not authorise future phases.

## 1. Product contract and non-goals

- Support the authenticated **User Portal**, with one active workspace context at a time.
- MVP navigation: **Home / Tasks / Projects / Inbox / More**. Tab order stays consistent for all workspace roles; content and actions change with permissions.
- The approved working scope in Blueprint v1 is **29 route-level MVP destinations**, **17 Phase 2**, **14 Phase 3**. These are planning counts, not automatic build instructions.
- MVP IDs: `A01 A02 A03 A04 A05 A06 A07 A08 A09 A10 A12 H01 H03 T01 T02 T03 T04 T05 P01 P02 P03 M06 F03 N01 N02 S01 S02 S04 S10`.
- Out of scope unless separately authorised: platform Admin Portal, super-admin functions, marketing pages, AI Hub placeholder, public Client View/External Portal, web-only governance/automations/custom-field administration, and unsupported browser-only widgets.
- Mobile is **not** a wrapped website. Rebuild UI with React Native; reuse verified domain definitions and pure TypeScript logic where suitable.
- A wireframe or scaffold is not evidence that a feature works end-to-end. Call a feature **implemented** only when its approved API, permission, error, accessibility and device tests pass.

## 2. Repository ownership and safe change boundaries

- Default write scope is the **new `admiino-mobile` repository only**. Treat `adminno-task-manager`, `admiino-backend`, `admiino-admin`, and the landing-page repository as read-only references unless a separate task explicitly authorises changes there.
- Never alter production accounts, databases, credentials, domains, OAuth consoles, push-provider consoles, DNS, store listings or remote branches without an explicit approved task.
- Do not run destructive commands, clean data, overwrite `.env` values, remove files wholesale, force-push, change remote URLs or merge branches without approval.
- Never assume an existing `main` or `staging` is safe to rewrite. Inspect `git status`, branch, remotes and diff before work; report pre-existing changes and preserve them.
- **Temporary user-approved Git policy override:** commit and push approved mobile work directly to `main` until the product owner changes this policy. Do not create or use `staging` or feature branches for new work; preserve existing branches, especially `staging`, and never force-push or rewrite history. This override changes only the branch destination: all security, environment, permission, review, test, and deployment safeguards in this file remain in force. See `docs/decisions/TEMPORARY_MAIN_ONLY_GIT_WORKFLOW.md`.
- Keep PRs small, with one phase/subphase objective. Do not combine design-system refactoring, auth, push and unrelated bug fixes.
- In each response, state: files changed, commands run, tests passed/failed, remaining blockers and recommended next bounded step.

## 3. Definition of the approved architecture

Use these as the working direction, subject to the Phase 00 decision log and SDK compatibility checks:

- Expo-managed React Native with **development builds**, TypeScript strict, Expo Router, EAS for Android/iOS builds.
- TanStack Query for server state. A small app state layer may hold session, active workspace and UI flags; do not duplicate server data in a global store.
- `expo-secure-store` for credentials; non-sensitive preferences in an appropriate local store. Never put access/refresh tokens in AsyncStorage, URL query strings, logs, analytics or push payloads.
- Design tokens derived from the web brand, with native components; evaluate NativeWind versus `StyleSheet`/theme approach during the designated spike, rather than adding both.
- `lucide-react-native` for approved icons; accessible semantic colours and labels, not colour alone.
- System browser for OAuth hand-offs only when a **mobile-safe backend contract** and redirect allow-list have been approved.
- Foreground WebSocket only, with AppState and network-aware reconnect; refetch after resume. Push covers background delivery once backend support is available.
- Phase 1 data persistence: memory-only authenticated query cache, no offline write queue. Preserve drafts only under an approved privacy policy.
- Tests: TypeScript, lint, Jest/React Native Testing Library, contract tests against mock/staging as appropriate, and Maestro end-to-end flows on both platforms.

## 4. Folder and dependency boundaries

Proposed structure (adapt to the selected Expo Router template; do not create unused folders):

```text
app/                 Expo Router screens, layouts, groups and deep-link entries
src/api/             typed endpoints, transport adapters, error mapping, contracts
src/auth/            session bootstrap, secure token storage, device-session lifecycle
src/workspace/       membership, active workspace, effective permissions, switch rules
src/features/        home/, tasks/, projects/, inbox/, account/, onboarding/
src/components/      shared mobile UI components with no business-specific API calls
src/theme/           tokens, semantic colours, typography, spacing
src/realtime/        socket protocol, connection lifecycle and cache invalidation
src/notifications/   in-app notification mapping and later push device management
src/lib/             proven pure TypeScript helpers imported from pinned sources
src/test/            fixtures, mocks and shared test helpers
scripts/             environment verification and contract drift tools
docs/                product baseline, decisions, contracts, ADRs, QA evidence
e2e/                 Maestro flows
```

Rules:
- Screens compose views and hooks; they do not implement transport, permissions or security policies themselves.
- API methods live behind typed feature endpoints; no ad-hoc `fetch` calls inside screen JSX.
- Query keys for workspace data **must include the workspace ID**. Switching workspace cancels requests and removes or invalidates prior workspace data before showing new content.
- Keep React Native UI components independent of browser DOM, `window`, `document`, `localStorage`, `sessionStorage`, `File`, web CSS and `import.meta.env`.
- Avoid creating a new shared npm package until a separate approved extraction design exists.
- Dependencies must be compatible with the selected Expo SDK. Use `npx expo install` where applicable; explain additions and do not upgrade the SDK as a side effect of unrelated work.

## 5. Environment discipline (critical)

- Use explicit, validated environments: **development**, **staging/preview**, and **production**. The current EAS environment naming must be confirmed from Expo documentation during setup; a custom build profile name alone is not an environment security guarantee.
- Never allow a development or staging binary to target production APIs or production WebSockets. Enforce this with a checked-in validation script and CI failure, not comments alone.
- `EXPO_PUBLIC_*` values are **public build-time values**, never secrets. Put only API origins and other intentionally public identifiers there.
- Every build displays a non-sensitive environment indicator in development/staging. No demo credentials, static tokens or sensitive data in the bundle.
- `.env.example` may contain placeholders only. Real credentials and build signing material must never be committed.
- Before authenticated endpoint testing, verify the effective API host, workspace header, certificate and account type. Use synthetic staging data and authorised test accounts only.
- Production `api.admiino.com` migration status is **not established by the audit**. Do not assume the domain is live or authoritative without runtime verification and approval.

## 6. Authentication, privacy and workspace isolation

- The audit found a web bearer token and `x-company-id` workspace header; this is a starting contract, not a guarantee of current backend behaviour.
- **B-01** (refreshable/revocable device sessions) is a release blocker until implemented and tested. Never solve it by silently making an access JWT long-lived in the client.
- On 401: attempt the agreed safe refresh once under a single-flight policy; if refresh fails, clear session and return to sign-in without loops. Do not invent endpoint paths until approved.
- On 403: show resource-specific access denial. On 423 `WORKSPACE_SUSPENDED`: show the dedicated recovery screen and block workspace data access. Handle rate limiting and 5xx separately.
- Verify membership and resource access on **every** deep link, push tap and workspace switch. Do not render stale prior-workspace records while a new workspace is loading.
- No PII, task description, message body, invitation token, password, or authentication token in analytics, crash logs, error breadcrumbs, or lock-screen push content by default.
- Sign-out: revoke the device session if contract supports it; clear credentials, active workspace, memory cache, local drafts and device registration in a safe order. Handle offline revocation as an unresolved state, not a false success.
- Self-service account deletion (`S10`) requires a **real approved backend path** with owner-transfer/retention rules. Never fake deletion with client-only sign-out.

## 7. Permissions and review actions

- **NEVER authorise from legacy `user.role`** (`executive` is often the default). Use workspace membership, `GET /access-requests/me/effective-permissions`, governance capabilities and resource-level access objects.
- Workspace role names (`owner`, `admin`, `manager`, `member`, `guest`) may tailor wording; the permissions endpoint and backend checks determine actual actions.
- The owner/admin/manager/member defaults in the audit are not permanent hard-coded rules; owners can override permissions by workspace and user.
- For task actions, use `task.access` (`canView`, `canEdit`, `readOnly`, `canCollaborate`) and the verified server transition contract.
- **B-10: reviewer authorisation is unresolved.** Do not render a working Approve/Complete/Send Back action until a backend test proves exactly who may do it and which transitions are permitted.
- Hide unauthorised controls; also handle server denial because frontend visibility is not security.
- Write tests for owner, admin, manager, member, guest and a team-lead scenario, including overrides and role changes while a screen is open.

## 8. API, file and realtime integration

- Maintain `docs/contracts/MOBILE_API_MATRIX.md`: screen ID, endpoint, method, payload/response schema, bearer/workspace requirements, error codes, backend file/commit reference, staging test evidence.
- The discovery audit counted 323/347 matching client calls by **method and path only**. This is not contract validation. Verify every endpoint used on mobile against current backend source and staging.
- Do not port known broken web methods: `PATCH /workflow/:id/progress`, missing attachment preview route and unused `GET /auth/websocket-token`. Use approved backend contracts, not guessed replacements.
- Never add a backend route to this repo or claim backend work was completed here. Prepare a handoff ticket with required method, body, response, permission and tests.
- API transport handles bearer, `x-company-id`, timeouts, errors, multipart and retries centrally. Limit retryable writes; use idempotency keys only when endpoint support is confirmed.
- Do not expose Cloudinary/private file URLs or use unauthenticated preview URLs. Authenticated file download/open flows must respect size, MIME and workspace permissions.
- Photos may be HEIC/HEIF; convert to approved JPEG/PNG with quality/size checks before upload, or document a backend change. Never assume video/audio upload is allowed.
- WebSocket: use the verified handshake and event contracts, foreground lifecycle, task-room access gating, de-duplication and refetch-on-resume. Never log token-bearing URLs.
- **B-02 push** is not currently available in audited backend source. Device registration, delivery, workspace routing, privacy preference and revocation require separate approved backend implementation.
- **B-03 mobile OAuth** and **B-05 Universal/App Links** require approved end-to-end contracts; don't put a user JWT in a mobile redirect query parameter.

## 9. UX standards and screen implementation

- Follow the **screen IDs** and functional specifications in the approved blueprint. Do not extrapolate extra routes from orphaned web pages.
- Navigation: Home, Tasks, Projects, Inbox and More. Inbox means **activity updates and authorised requests**, not general chat; conversations belong to tasks.
- Preserve Admiino's violet visual identity; token baseline is in the blueprint. Verify contrast and light/dark usage in native screens.
- Use platform system fonts and native safe areas. Minimum target size: iOS 44pt / Android 48dp; support large text, VoiceOver, TalkBack and Reduce Motion.
- Every screen needs initial, loading, success, empty, filtered-empty, offline, error, no-access and relevant suspended states. Full-screen forms need keyboard handling, validation and unsaved-change confirmation.
- Never allow mock data in an allegedly integrated screen. During UI-only phases, prominently identify and isolate fixtures and mark the screen **UI-only**.
- The **first screen milestone is A01 Sign In, UI-only** after the design system and router shell. Do not wire real credentials until the API/session phase. Test its layout and validation locally first.
- Add `testID` and accessible labels to meaningful controls; use IDs stable enough for Maestro without encoding sensitive content.
- Prefer small, composable native components to one very large screen component.

## 10. Testing, gates and definition of done

For each bounded task:

1. State exact phase/subphase, permitted files, assumptions and the acceptance tests **before coding**.
2. Implement the smallest change that satisfies the acceptance criteria.
3. Run: formatting/lint, TypeScript check, relevant unit/component tests, environment validation and applicable device/simulator check. If a command is unavailable, report why; never imply it passed.
4. Add or update tests for errors, permissions, workspace switch and regressions affected by the change.
5. Inspect the diff, report any unrelated file modifications and any introduced dependencies.
6. Do not commit/push/deploy unless specifically requested in that task.

A route is **UI complete** when visuals, navigation and local states are accepted. It is **integrated** only when staging API, error and permission contracts are tested. It is **release-ready** only when Android/iOS device tests, accessibility, security and regression gates pass. Keep these labels distinct.

Required release journeys: sign in/recovery; invitation/activation; workspace switch; task create/assign/update; conversation and authenticated attachment; review/approval; notification tap across app lifecycle; sign-out; account deletion.

## 11. Agent execution response template

Every Copilot/agent task must finish with:

```text
PHASE / SUBPHASE:
RESULT: UI-only / Integrated (staging) / Blocked / Not completed
FILES CHANGED:
WHY THESE FILES:
COMMANDS RUN + RESULTS:
DEVICE/PLATFORM CHECKS:
APIs / PERMISSIONS VERIFIED:
BLOCKERS / DECISIONS:
DIFF / BRANCH STATUS:
NEXT SAFE STEP (one task only):
```

When blocked, deliver the smallest reproducible evidence and a proposed resolution. Do not weaken permissions, disable checks, invent endpoints or use production data to make a demo pass.

## 12. Phase map (read the development playbook for full prompts)

| Phase | Workstream | Earliest status |
|---|---|---|
| P00 | Product decisions, contracts, risk owners | Design-ready gate |
| P01 | Repository, access and Git safety | Local repo established |
| P02 | Toolchain and Expo scaffold | App boots locally |
| P03 | Environments and EAS development builds | Staging-safe builds |
| P04 | Quality tools, test harness and CI | Baseline tests green |
| P05 | Mobile tokens and shared UI primitives | Design foundation |
| **P06** | **A01 Sign In — first UI-only screen** | **First-screen milestone** |
| P07 | Typed API client and endpoint contracts | Mock + staging contract tests |
| P08 | Secure session and functional sign-in | Staging login vertical slice |
| P09 | Signup, verification, recovery, invitations, activation | Auth journeys |
| P10 | Workspace switching, permissions and five-tab shell | Safe authorised navigation |
| P11 | Home, search and More | H01/H03/S01 |
| P12 | Tasks list, details, create/edit and review | T01/T02/T04/T05 |
| P13 | Task conversation and file viewer | T03/F03 |
| P14 | Projects | P01/P02/P03 |
| P15 | Inbox, approvals, preferences and push | N01/N02/M06/A10 |
| P16 | Profile, settings and deletion | S02/S04/S10 |
| P17 | Full QA, beta, release and Phase 2/3 handoff | Go/no-go |

**Do not skip gates.** P07–P16 feature work may be parallelised only when dependency contracts are documented and integration owners agree. Never call a missing backend feature done because its UI exists.

## 13. Source references and approved docs

- `docs/product/Admiino_Mobile_UX_Blueprint_v1.md` — design baseline; copy from product-approved source, record version.
- Discovery audit, 22 November 2026 — static read of User Portal and targeted backend source.
- `docs/decisions/DECISIONS.md` — owner decisions and unresolved B/D items.
- `docs/contracts/MOBILE_API_MATRIX.md` — approved endpoint schemas and staging evidence.
- `docs/qa/` — platform-specific test records and exit-gate evidence.
- Official Expo docs for setup, Router, EAS environments, dev builds and tests: https://docs.expo.dev/ . Confirm current CLI commands and SDK compatibility during P02/P03.

**Last reviewed:** 22 November 2026. Update this file through a reviewed PR when the blueprint or backend contracts change; record why and what implementation phases are affected.
