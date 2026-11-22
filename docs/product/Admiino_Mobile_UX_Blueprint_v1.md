# ADMIINO MOBILE APP
## Product, UX & Engineering Blueprint | Version 1.0

**Document date:** 22 November 2026  
**Product:** Admiino User Mobile Application (Android and iOS)  
**Status:** Proposed design baseline — subject to product and backend sign-off  
**Source:** *Admiino Mobile App — Discovery & Readiness Audit* dated 22 November 2026 (User Portal branch `fix/team-dashboard-metrics-and-navigation`, commit `e57ea33`)  
**Intended users:** Product owner, UX designer, mobile developers, backend engineer, QA/release owner

> **Purpose.** Provide one buildable specification for the Admiino mobile application. It defines the information architecture, the initial release, each MVP screen, roles and permissions, navigation, UI standards, backend dependencies, test gates and the recommended implementation order. It is **not** a claim that the mobile application has been implemented or that backend behaviour has been verified in a running environment.

> **Decision convention.** **PROPOSED** = product direction requiring approval; **CONFIRMED FROM AUDIT** = source-code finding recorded by the supplied audit; **BLOCKED** = cannot be delivered safely until the named dependency is resolved; **TO VERIFY** = requires backend, runtime or store verification.

# 1. Executive decisions

## 1.1 Product statement

Admiino Mobile is the native companion to the **authenticated Admiino User Portal**. It lets a person access their workspaces, understand what needs attention, update assigned tasks, collaborate on work, manage relevant projects and act on notifications. It supports Android and iOS from one React Native application and uses the existing Admiino backend as its system of record.

The mobile app is **not** a webview clone and will not transplant React DOM pages. Core domain types, verified endpoint definitions and small pure TypeScript utilities can be reused. Navigation, forms, lists, gestures, file handling, authentication storage and all UI are implemented as mobile-native components.

## 1.2 Proposed product choices

| Topic | Proposed choice | Rationale / guardrail |
|---|---|---|
| Mobile product scope | Authenticated User Portal companion; separate admin and landing products excluded | Keeps a clear product boundary |
| Platforms | Android + iOS using Expo React Native with TypeScript | One codebase; native capabilities through development builds |
| Primary navigation | **Home / Tasks / Projects / Inbox / More** (five stable tabs) | Durable destinations; role differences appear in content and actions |
| MVP size | **29 route-level screens**; 14 shared overlay types not included in the count | Audit 25 + activation + approvals + basic project create/edit + account deletion |
| App-wide action | Contextual create buttons; no permanent global floating action button | `create_tasks` and `create_projects` are permission-gated |
| Inbox | Activity updates + role-authorised requests. Phase 1 shows the **active workspace**; combined workspace inbox is a later enhancement | Existing notification endpoints are workspace scoped |
| New account signup | Secure hand-off to existing web signup, pending native signup/security redesign | Backend currently requires a browser Turnstile token |
| Session | Refresh-token/device-session backend design, with secure on-device storage | Current single-JWT model does not support durable native sessions |
| Push | Required for intended first public release; permissions always optional for users | Server infrastructure is not yet implemented |
| Task approvals | Only expose the action when a **server-verified review permission** exists | Web role checks are insufficient and approval enforcement remains unverified |
| Offline | Phase 1 memory-only data and drafts; no silent queued writes | Respect data isolation and avoid duplicate creates |
| Advanced administration | Remains primarily on web | Protect sensitive workflows and avoid desktop form complexity |

## 1.3 Release-readiness rule

Design work and a staging-only vertical slice can proceed before backend changes finish. **Do not ship to public stores** without approved device sessions, functioning push (if retained as a launch promise), verified deep links, safe task-approval authorisation, account deletion, security tests and Android/iOS acceptance tests. Record any change to this decision in a versioned product decision log.

# 2. Scope and screen-count reconciliation

The discovery audit inventoried **72 route entries**, **60 distinct web screens**, and **59 proposed mobile route-level screens** across all phases (25 MVP, 20 Phase 2, 14 Phase 3). These are audit-level classifications, not verified production usage statistics.

This blueprint moves three existing proposals into Phase 1: **A07 Organisation activation**, **M06 Approvals**, **P03 Create/Edit project**. It also introduces one distinct new route, **S10 Delete account**, required as part of the in-app account-management experience. The proposed new total is therefore **60 mobile route-level destinations**: **29 MVP + 17 Phase 2 + 14 Phase 3**. This is a planning count, not 60 separate visual page templates.

| Count basis | Audit | Blueprint v1 | Difference |
|---|---:|---:|---|
| MVP | 25 | **29** | +3 rephased; +1 new |
| Phase 2 | 20 | **17** | −3 rephased |
| Phase 3 | 14 | **14** | unchanged |
| All mobile destinations | 59 | **60** | +1 new |

**Counting rule:** a tab root, push destination, full-screen modal route or deep-link landing is counted once. Shared sheets, pickers, alerts, error variations, list filters, tabs within a screen and optional coaching tips are not. The route-level notification primer (A10) remains counted for traceability, though the design team can implement it as a full-screen modal route.

## 2.1 What MVP actually delivers

The minimum useful journey is: **sign in or activate → choose a workspace → view and update tasks → collaborate → act on reviews and requests → receive notifications → manage account**. Basic project creation is included because permissioned owners and managers should be able to start work without leaving the mobile application. Complex governance, commercial billing, advanced reporting, templates and broad Drive management remain out of the MVP.

# 3. Experience principles

1. **Action first.** Home prioritises a user's urgent work and decisions rather than replicating the desktop dashboard.
2. **One active workspace at a time.** Every view, request and cached object belongs to the selected workspace. A link from another workspace must confirm the switch before displaying content.
3. **Permission-led design.** Buttons and destinations derive from server-supplied effective permissions and resource-level access. Role names help tailor wording but never grant rights.
4. **Mobile-native forms.** Short first steps, gradual disclosure, searchable pickers, large touch targets and visible save/cancel controls.
5. **No invented backend behaviour.** Unavailable endpoints and uncertain approval semantics remain explicitly blocked. A pretty button is not proof of a working feature.
6. **Feedback at every step.** Loading, offline, empty, error, no-access, suspended-workspace, pending-send and retry states are designed alongside the normal state.
7. **Sensitive by default.** No authentication tokens in logs; secure credentials; no cross-workspace cache leakage; generic lock-screen push previews by default.
8. **Web and mobile should agree on meaning.** Preserve task statuses, permissions, workspace structure and brand tokens, while changing page layouts and navigation.

## 3.1 Language and content standards

Use short, plain labels: **My tasks**, **Needs review**, **Join workspace**, **Add project**, **Send back**, **Try again**. Avoid unexplained internal terms such as `x-company-id`, `in_review`, `requestId`, and `execution`. User-facing terminology should be consistent across all screens: Workspace (not Company when navigating), Task, Project, Team, Review, Inbox.

Dates must display the user's local date and time zone. Relative dates such as **Today** and **Tomorrow** need an exact date in accessibility text. Show an exact timestamp for overdue and past activity when opened.

# 4. Information architecture and navigation

## 4.1 Application shell and route hierarchy

```text
App Launch / Session Bootstrap
  ├── Signed out → Authentication stack
  │     Sign in / Signup hand-off / Verify email / Forgot / Reset / Invite / Activation
  ├── Signed in, no workspace → Workspace setup
  ├── Suspended selected workspace → Workspace suspended
  └── Signed in, active workspace → FIVE-TAB SHELL
        ├── HOME → Search / Task detail / Approvals / Workspace switcher
        ├── TASKS → Task detail → Conversation / File viewer
        │            Create task / Edit task (global full-screen routes)
        ├── PROJECTS → Project detail → Task detail / Basic project create-edit
        ├── INBOX → Updates / Requests → Target task, project or approval
        └── MORE → Profile / Settings / Account deletion / Other modules

Global: deep-link resolver, permission boundary, error/not-found, security lock,
        active workspace switcher sheet, foreground reconnect, network banner.
```

The same five tabs stay visible for owner, admin, manager, member and guest. The *content* adapts to the active workspace and the person's effective permissions. A user without a permitted action never sees a misleading create control.

## 4.2 The five tabs

| Tab | Root ID | Above-the-fold contents | Main action | Secondary route |
|---|---|---|---|---|
| **Home** | H01 | Workspace switcher, greeting, needs action, due-soon tasks, metrics | Open next task; create task if permitted | Search (H03), M06 requests |
| **Tasks** | T01 | Mine / Created / All (conditional), filters, task rows | Create task when permitted | T02, T03, T04, T05 |
| **Projects** | P01 | Project list with status and progress | Create project when permitted | P02, P03 |
| **Inbox** | N01 | Updates; optional Requests category; unread indicator | Open update or decision | M06; notification target |
| **More** | S01 | Workspace, account, available modules | Profile/settings / switch workspace | S02, S04, S10; future modules |

**Inbox terminology:** this is an activity/requests inbox, not direct messaging. Task conversations live inside each task.

## 4.3 Persistent and contextual controls

- **Header:** Home has workspace chip, search and avatar. Tasks and Projects have title, search/filter and a permission-gated create action. Inbox has unread indicator and mark-read actions. More opens with the current workspace and account details.
- **Tab bar:** five labelled icons, always in fixed order. Badge only on Inbox, based on supported unread data. Hide the bar on full-screen creation/editing, login, activation, secure account-deletion confirmation and task conversation when the keyboard is open.
- **Task scope:** Mine / Created / All. **All** appears only with `view_all_tasks`. Additional filters open a sheet. The navigation destination is still T01.
- **Workspace switching:** sheet from Home and More, not a new screen. Switching cancels in-flight requests, invalidates old workspace queries, resets visible stacks, loads permissions and reconnects WebSocket scopes.
- **Deep links:** resolve signed-out state first; store only minimal pending intent securely; authenticate; verify membership; prompt workspace switch when necessary; then route to an authorised destination.

## 4.4 Where the remaining modules go

Calendar, Teams, People, Drive, Shared with me, Time and Integrations appear in **More** when their phase is implemented and access is granted. They may also be reached from contextual shortcuts. There is no empty or dead menu item for a future module. The AI Hub placeholder is excluded.

# 5. Permissions and experience rules

## 5.1 Sources of truth

**CONFIRMED FROM AUDIT:** the legacy `User.role` frequently defaults to `executive`, so it is not a trustworthy UI or security permission signal. Workspace membership has a role of owner, admin, manager, member or guest. Workspace-level effective permissions can be changed or overridden. Task detail returns a resource-level `access` object. Governance settings can further limit actions.

**Implementation rule:** On sign-in and workspace switch, load `GET /access-requests/me/effective-permissions`; attach workspace ID to every workspace-scoped query key; load `task.access` for task actions; check project-level roles and governance capabilities for project/team/connected-services features. Server remains final enforcement.

## 5.2 Functional permission matrix (default settings; overrides may change it)

| Action / content | Owner | Admin | Manager | Member | Guest |
|---|---|---|---|---|---|
| Open own assigned tasks | Subject to resource access | Same | Same | Same | Only if explicitly granted |
| Create tasks (`create_tasks`) | Yes | Yes | Yes | No | No |
| View all tasks (`view_all_tasks`) | Yes | Yes | No | No | No |
| Create projects (`create_projects`) | Yes | Yes | Yes | No | No |
| View all projects (`view_all_projects`) | Yes | Yes | No | No | No |
| Assign workspace members | Yes | Yes | Yes | No | No |
| View workspace members | Yes | Yes | Yes | No | No |
| Upload workspace files | Yes | Yes | Yes | No | No |
| Approve join / verification / permission requests | Yes where backend permits | Yes where backend permits | Not assumed | No | No |
| Approve / complete tasks in review | **TO VERIFY server reviewer rule** | **TO VERIFY** | **TO VERIFY** | **TO VERIFY** | **TO VERIFY** |

This table describes defaults and audit findings. It is not a client-side authorisation policy to hard-code. A team lead can gain team-workflow abilities by policy without acquiring unrelated organisation rights.

## 5.3 UI behaviour by permission state

| Permission outcome | Required UI |
|---|---|
| Action allowed | Show enabled control; verify on server when submitted |
| Action not allowed | Hide the control or show read-only resource state. Do not offer an action that will always fail |
| Permission still loading | Show skeleton/placeholder, not optimistic privileged controls |
| 403 returned after opening | Explain access changed; stop action; refresh effective permissions; safely return to list |
| Workspace suspended (423) | Replace workspace content with A09; do not show cached tasks |
| Membership removed mid-session | Clear affected workspace data, stop socket subscriptions, select an eligible workspace or return to A08 |
| Guest/external | Only show resources explicitly shared; do not infer rights from a user's platform role |

## 5.4 Approval distinction

There are two separate kinds of decisions: **Task review** (inside T02, review permission to be confirmed) and **Workspace requests** (M06: invitations/join, member verification and access requests). They can feed the same Inbox and Home summary, but must retain separate backend authorisation and error handling.

# 6. End-to-end journey blueprints

## J01 — Existing member signs in and updates work

**Sign in (A01) → session validation → workspaces → active workspace selected → Home (H01) → My tasks (T01) → Task detail (T02) → permitted status change → refreshed list and activity.**

**Decision points:** unverified account → A03; expired password → A04/A05; no workspace → A08; workspace suspended → A09; no permission to edit → view-only T02. **Success signal:** task status and summary update from server response, not a local optimistic assumption alone.

## J02 — New user signs up or joins an organisation

**Sign in (A01) → Create account (A02 browser hand-off) → email confirmation (A03) → Sign in → A08 create/join or A06 accept invitation → Home → optional notification primer (A10).** Organisation-provisioned staff use **A07 activation** instead of normal signup. Invitations are retained across sign-in only as a minimal, expiring pending intent. No account creation step may bypass email verification or backend anti-abuse policy.

## J03 — Owner creates work and assigns it

**Projects (P01) → New project (P03) → Project detail (P02) → Add task (T04 prefilled with project) → choose assignees → save → Task detail (T02) → other user sees assigned task.** Create controls must reflect `create_projects`, `create_tasks` and `create_project_tasks` as applicable. Unknown workspace member IDs must never be sent as guessed values.

## J04 — Task collaboration

**Task detail (T02) → Conversation (T03) → text or allowed attachment → send with idempotent client message ID → server acknowledgement → update conversation and activity.** Foreground WebSocket is preferred; authenticated HTTP fallback handles transient failure. Retry must not create duplicate messages. If comment authorisation is lost, replace composer with read-only guidance.

## J05 — Review or request approval

**Task review:** authorised reviewer opens the task from Home/Inbox → T02 review card → Approve or Send back → server-authorised status transition → task and notification update. **Workspace request:** owner/admin opens Inbox Requests → M06 → sees request details → Approve/Reject → confirms consequences → sees server-updated state.

The task-review controls are **BLOCKED** until the backend owner verifies/implements reviewer authorisation. A "Send back" action that changes status and posts a comment must be specified transactionally or show partial-failure recovery if those are separate API operations.

## J06 — Push or deep link into another workspace

**Tap notification/link → validate link target → session check → load target workspace membership → confirm switch if different → clear old workspace views and load new permissions → open T02/P02/M06.** If the target no longer exists or the user lost access, show A12 and a safe return path. Generic push text on the lock screen does not reveal titles by default.

## J07 — Security, sign-out and account deletion

**More (S01) → Settings (S04) → Delete account (S10) → ownership/data warnings → reauthentication if required → irreversible confirmation → backend deletion/deactivation response → remove session and local data.** If a user owns an active workspace, backend rules must determine transfer or closure before deletion. Sign-out always clears all local authenticated state and unregisters push devices when possible; retry revocation safely if temporarily offline.

# 7. MVP screen register and routing inventory

This is the **29-screen proposal**. Every ID maps to one route-level destination, though a developer may place related routes in shared component files. Exact Expo Router paths will be finalised during the navigation prototype; the listed paths describe user-facing destinations, not a command to duplicate the web URL scheme.

| ID | Destination | Navigation placement | Implementation risk |
|---|---|---|---|

| A01 | Sign in | Auth / onboarding / global | High |
| A02 | Create account (secure web hand-off) | Auth / onboarding / global | High |
| A03 | Verify email | Auth / onboarding / global | High |
| A04 | Forgot password | Auth / onboarding / global | Low–Medium |
| A05 | Reset password | Auth / onboarding / global | High |
| A06 | Workspace invitation | Auth / onboarding / global | High |
| A07 | Organisation activation | Auth / onboarding / global | High |
| A08 | Workspace setup | Auth / onboarding / global | Medium |
| A09 | Workspace suspended | Auth / onboarding / global | Low–Medium |
| A10 | Notification primer | Auth / onboarding / global | High |
| A12 | Access denied / not found / error | Auth / onboarding / global | Low–Medium |
| H01 | Home | Home / global search | Medium |
| H03 | Global search | Home / global search | Low–Medium |
| T01 | Tasks list | Tasks stack / modal | Low–Medium |
| T02 | Task detail | Tasks stack / modal | High |
| T03 | Task conversation | Tasks stack / modal | High |
| T04 | Create task | Tasks stack / modal | Medium |
| T05 | Edit task | Tasks stack / modal | Medium |
| P01 | Projects list | Projects stack / modal | Low–Medium |
| P02 | Project detail | Projects stack / modal | Low–Medium |
| P03 | Basic create/edit project | Projects stack / modal | Medium |
| M06 | Workspace approvals queue | Inbox Requests / More | High |
| F03 | File viewer | Global authenticated viewer | Medium |
| N01 | Inbox | Inbox / settings | High |
| N02 | Notification settings | Inbox / settings | High |
| S01 | More | More / account | Low–Medium |
| S02 | My profile | More / account | Low–Medium |
| S04 | Settings | More / account | Low–Medium |
| S10 | Delete account | More / account | High |

# 8. Screen-by-screen functional UX specifications

Each specification is a screen design handoff for UX and engineering, **not** a visual mockup. It explicitly includes states, transitions, backend touchpoints and an acceptance condition. Every screen requires safe-area handling, screen-reader semantics, keyboard behaviour, analytics instrumentation without sensitive content, and the global error model in Section 10.

### A01 — Sign in

**Proposed destination:** `/sign-in`  
**Who enters:** All signed-out users  
**Content hierarchy:** Email field; password with show/hide; Forgot password; Sign in; Google sign-in; Create account; Terms/Privacy.  
**Controls and transitions:** Submit credentials; open A04 or A02; start Google auth only after B-03.  
**Required states and errors:** Inline validation; 401 unverified directs A03; 429 cooldown; offline/retry; admin-account rejection.  
**API and source contract:** POST /auth/login; GET /auth/me; GET /me/workspaces.  
**Dependencies / decisions:** B-01 session; B-03 Google; login response field verification.  
**Acceptance:** A valid member signs in, selects eligible workspace, no token in logs.

### A02 — Create account (secure web hand-off)

**Proposed destination:** `/create-account`  
**Who enters:** New users  
**Content hierarchy:** Short explanation; Continue securely to website; Back to sign in; privacy link.  
**Controls and transitions:** Open existing secure signup in system browser; return to A03/sign in via deep link or explicit return.  
**Required states and errors:** Browser cancelled; failed return; no network; no native Turnstile simulation.  
**API and source contract:** Existing web /signup; POST /auth/signup performed by web.  
**Dependencies / decisions:** D-03 web hand-off; B-05 return links; B-08 deletion.  
**Acceptance:** No broken blank state on return; signup respects existing Turnstile and consent.

### A03 — Verify email

**Proposed destination:** `/verify-email`  
**Who enters:** Unverified / returning signup users  
**Content hierarchy:** Email address; Check inbox instructions; Open mail; Resend with cooldown; Verify-link handler.  
**Controls and transitions:** Resend; inspect/complete token; re-enter chosen password when needed; sign in after success.  
**Required states and errors:** Expired/reused link; wrong account; rate limit; missing proof; no installed app fallback.  
**API and source contract:** POST /auth/resend-verification; POST /auth/verify-email/inspect and /complete.  
**Dependencies / decisions:** B-05 links; fragment handling spike.  
**Acceptance:** A user with valid link becomes verified; an invalid link never signs them in.

### A04 — Forgot password

**Proposed destination:** `/forgot-password`  
**Who enters:** Signed-out users  
**Content hierarchy:** Email field; Send reset link; Return to sign in.  
**Controls and transitions:** Request reset without exposing whether email exists; show check-inbox response.  
**Required states and errors:** Rate limit, network error, keyboard accessibility.  
**API and source contract:** POST /auth/forgot-password.  
**Dependencies / decisions:** B-05 reset deep link; web route fix.  
**Acceptance:** User receives generic safe confirmation and can open the reset flow.

### A05 — Reset password

**Proposed destination:** `/reset-password`  
**Who enters:** Recipient of reset link  
**Content hierarchy:** Password/new password confirmation; rules; Reset; back to sign in.  
**Controls and transitions:** Validate link and password; submit; return to sign in.  
**Required states and errors:** Missing/expired/used token; mismatched password; offline.  
**API and source contract:** POST /auth/reset-password/:token.  
**Dependencies / decisions:** B-05 deep link; web route fix.  
**Acceptance:** After reset old session is revoked per B-01 and user can sign in.

### A06 — Workspace invitation

**Proposed destination:** `/invite`  
**Who enters:** Invited users  
**Content hierarchy:** Workspace name; proposed role; invitation status; Accept; Sign in/Create account.  
**Controls and transitions:** Inspect invite; accept after account check; park intent through auth.  
**Required states and errors:** Expired/revoked token; wrong email; already a member; seat/approval constraints.  
**API and source contract:** GET /invites/:token; POST /invites/:token/accept; signup-with-invite if needed.  
**Dependencies / decisions:** B-05 links and auth return path.  
**Acceptance:** Correct account joins exactly the intended workspace; invalid invite leaks no data.

### A07 — Organisation activation

**Proposed destination:** `/activate`  
**Who enters:** New provisioned employees and owner-designate  
**Content hierarchy:** Organisation name; invitation identity; set/confirm password for new account; Accept/Activate; ownership disclosure.  
**Controls and transitions:** Inspect activation/claim token; distinguish new vs existing account; continue through authentication.  
**Required states and errors:** Expired/revoked link; already activated; mismatched account; unsupported claim.  
**API and source contract:** /auth/org-activation/inspect; /owner/activate; /owner/accept; other existing backend routes.  
**Dependencies / decisions:** B-05 links; feature flag / ownership rules to verify.  
**Acceptance:** An authorised user activates or claims ownership securely; no guest can assume ownership.

### A08 — Workspace setup

**Proposed destination:** `/workspace-setup`  
**Who enters:** Authenticated with no active workspace, or adding one  
**Content hierarchy:** Two clear choices Join with code / Create workspace; request status list; workspace name, industry, size; no billing checkout.  
**Controls and transitions:** Resolve code and request access; create free workspace; re-fetch memberships.  
**Required states and errors:** Pending request; code invalid; create duplicate; workspace limit; backend error.  
**API and source contract:** POST /company/join/resolve; POST /company/join/requests; GET /companies/join/requests/mine; POST /companies.  
**Dependencies / decisions:** D-08 free-plan rule; validate required fields.  
**Acceptance:** User reaches Home only after a confirmed workspace membership.

### A09 — Workspace suspended

**Proposed destination:** `/workspace-suspended`  
**Who enters:** Affected members  
**Content hierarchy:** Workspace name; plain explanation; support reference; Switch workspace; Sign out.  
**Controls and transitions:** Block all workspace content; switch or sign out.  
**Required states and errors:** 423 response; offline; no other workspaces.  
**API and source contract:** GET /workspaces/suspended; 423 response contract.  
**Dependencies / decisions:** Error code handling.  
**Acceptance:** No cached content from suspended workspace remains visible.

### A10 — Notification primer

**Proposed destination:** `/notification-primer`  
**Who enters:** First-time eligible users  
**Content hierarchy:** Why alerts matter; Allow notifications; Not now; privacy note.  
**Controls and transitions:** Ask OS permission only after explicit choice; register device after authorisation.  
**Required states and errors:** Denied permanently; already allowed; no push backend in staging.  
**API and source contract:** Proposed device token registration (B-02).  
**Dependencies / decisions:** B-02; D-12 privacy default.  
**Acceptance:** Skipping does not block work; app respects OS preference.

### A12 — Access denied / not found / error

**Proposed destination:** `/+not-found (and error fallback)`  
**Who enters:** Any user  
**Content hierarchy:** Clear cause; Try again when relevant; Switch workspace or Go home.  
**Controls and transitions:** Safe return without leaking resource names; handle expired and revoked links.  
**Required states and errors:** Offline; 403; 404; deleted resource; unknown link.  
**API and source contract:** None universal; contextual status code.  
**Dependencies / decisions:** All flows.  
**Acceptance:** A user is never left on an empty or permanently spinning screen.

### H01 — Home

**Proposed destination:** `/(tabs)/home`  
**Who enters:** Signed-in active-workspace members  
**Content hierarchy:** Workspace chip; greeting; Needs action if relevant; Due soon; personal task summary; shortcuts; recent activity collapsed.  
**Controls and transitions:** Open task; open requests; search; create task if allowed; pull refresh.  
**Required states and errors:** No tasks; metrics error; permission changes; offline; loading skeleton.  
**API and source contract:** GET /tasks/my/summary; GET /tasks; GET /dashboard/executive where authorised; GET effective permissions.  
**Dependencies / decisions:** Avoid manager client-side counting; task-review authority.  
**Acceptance:** Priority information fits initial viewport; every metric/filter opens source data.

### H03 — Global search

**Proposed destination:** `/search`  
**Who enters:** Signed-in members  
**Content hierarchy:** Search input; recent searches kept locally; grouped Tasks / Projects / People results; filter chips.  
**Controls and transitions:** Submit query after debounce; navigate to authorised result; clear search.  
**Required states and errors:** Empty query; no results; access removed; API downtime.  
**API and source contract:** GET /global-search.  
**Dependencies / decisions:** Result shapes and permissions contract.  
**Acceptance:** Result tap resolves correct workspace and respects server access.

### T01 — Tasks list

**Proposed destination:** `/(tabs)/tasks`  
**Who enters:** Signed-in members  
**Content hierarchy:** Mine / Created / conditional All; filter chips; task cards; section counts where available.  
**Controls and transitions:** Open task; create if permitted; select status/priority/due filters; refresh.  
**Required states and errors:** No tasks; filtered empty; loading more; denied view_all; offline.  
**API and source contract:** GET /tasks?scope=...&relation=...; GET /tasks/my/summary.  
**Dependencies / decisions:** Pagination contract; effective permissions.  
**Acceptance:** My tasks excludes unrelated tasks; filters and pagination do not double-count.

### T02 — Task detail

**Proposed destination:** `/tasks/:id`  
**Who enters:** Users allowed to view task  
**Content hierarchy:** Title; status/priority/deadline; assignees and project; review card only when authorised; description; subtasks; files; activity; conversation entry.  
**Controls and transitions:** Status picker if editable; open T03; edit T05; open file F03; approve/send back only with verified right.  
**Required states and errors:** Read-only; missing task; dependency warning; 403 revoked; partial review failure.  
**API and source contract:** GET /tasks/:id; PATCH /tasks/:id; GET /tasks/:id/activity; subtask and attachment APIs.  
**Dependencies / decisions:** B-10 review rule; do not use missing /workflow progress route.  
**Acceptance:** No action appears solely because user.role=executive; server confirms every mutation.

### T03 — Task conversation

**Proposed destination:** `/tasks/:id/conversation`  
**Who enters:** Task collaborators  
**Content hierarchy:** Header task title; chronological comments; reply indicators; attachment chips; input composer; delivery state.  
**Controls and transitions:** Send/retry text and supported files; mention; reply; open viewer; foreground WebSocket subscribe.  
**Required states and errors:** Typing without room access; failed send; duplicates; attachment too large; loss of access.  
**API and source contract:** GET/POST /task-comments/task/:id/comments; WebSocket join_task/new_comment/acks.  
**Dependencies / decisions:** Multipart response and clientMessageId contract.  
**Acceptance:** One intended comment appears once; offline draft survives screen changes in session.

### T04 — Create task

**Proposed destination:** `/task-create`  
**Who enters:** Users with appropriate create permission  
**Content hierarchy:** Title required; description per validated backend; priority; deadline; assignees; expandable project/team/category/files.  
**Controls and transitions:** Choose field values; submit once; show server error next to field; save and open created task.  
**Required states and errors:** Unsaved draft; invalid member; permission revoked; file size/mime; duplicate tap.  
**API and source contract:** POST /tasks or POST /projects/:id/tasks; member lookup.  
**Dependencies / decisions:** Backend required fields; create_tasks and create_project_tasks.  
**Acceptance:** Task saved once; correct workspace and project; prohibited create button hidden.

### T05 — Edit task

**Proposed destination:** `/task-edit`  
**Who enters:** Users with task.access.canEdit  
**Content hierarchy:** Existing fields; status; description; priority; deadline; assignees; cancel/save.  
**Controls and transitions:** Edit permitted fields; save; return to T02 with refetch.  
**Required states and errors:** Concurrency change; stale edit; invalid status; permission revoked.  
**API and source contract:** PATCH /tasks/:id.  
**Dependencies / decisions:** Review rules; field whitelist.  
**Acceptance:** No silent loss of entered changes; server decides final field permissions.

### P01 — Projects list

**Proposed destination:** `/(tabs)/projects`  
**Who enters:** Project members / users with project permission  
**Content hierarchy:** Active project cards; progress; status; due dates; search/filter; create if permitted.  
**Controls and transitions:** Open project; create P03; refresh.  
**Required states and errors:** Empty no projects; no access; pagination; stale progress.  
**API and source contract:** GET /projects.  
**Dependencies / decisions:** `view_all_projects`, project visibility contract.  
**Acceptance:** Only eligible projects shown; create action matches governance and permissions.

### P02 — Project detail

**Proposed destination:** `/projects/:id`  
**Who enters:** Authorised project participants  
**Content hierarchy:** Project header; Overview / Tasks / Members / Files segments; progress/status; key dates; project tasks; member list read-only MVP.  
**Controls and transitions:** Open task; create prefilled task; enter P03 basic edit if allowed.  
**Required states and errors:** Project inaccessible; task list empty; member permission; project deleted.  
**API and source contract:** GET /projects/:id; GET project tasks and members.  
**Dependencies / decisions:** Project ACL contract; gated add task.  
**Acceptance:** Child tasks remain scoped to project; no permission escalation via URL.

### P03 — Basic create/edit project

**Proposed destination:** `/project-create (edit: /project-edit)`  
**Who enters:** Users permitted to manage project  
**Content hierarchy:** Name; description; start/due dates; optional team; Save; cancel.  
**Controls and transitions:** Create or update; only permitted actions; validate names and dates; return to project.  
**Required states and errors:** No create permission; governance disallows; unsaved changes; duplicate submit.  
**API and source contract:** POST /projects; PATCH /projects/:id.  
**Dependencies / decisions:** D-08 plan/billing not in form; projectCreationPolicy.  
**Acceptance:** Simple project created/edited successfully; advanced member management deferred.

### M06 — Workspace approvals queue

**Proposed destination:** `/approvals`  
**Who enters:** Owner/admin when authorised  
**Content hierarchy:** Request-type segments: Join requests, Verifications, Permission requests; request list with requester, date, scope and status.  
**Controls and transitions:** Open request details; approve/reject with consequences; return to Inbox/Home.  
**Required states and errors:** No requests; stale request; permission denied; partial data source failure.  
**API and source contract:** /companies/join/requests; /team/pending-verifications; /access-requests.  
**Dependencies / decisions:** Confirm each method/status payload and reviewer permissions.  
**Acceptance:** Decisions change request status in backend; members cannot access by direct URL.

### F03 — File viewer

**Proposed destination:** `/file-viewer`  
**Who enters:** Authorised user opening a file  
**Content hierarchy:** File name/type/size; PDF/image/text viewer; Download/Open in; error explanation.  
**Controls and transitions:** Fetch authenticated content; show permitted preview; share/open through OS.  
**Required states and errors:** Unsupported Office file; expired link; oversized file; revoked membership.  
**API and source contract:** GET /tasks/:id/attachments/:aid/download; /drive/files/:id/download.  
**Dependencies / decisions:** Never call absent preview route; file headers.  
**Acceptance:** File opens without exposing bearer token in URL; cross-workspace download denied.

### N01 — Inbox

**Proposed destination:** `/(tabs)/inbox`  
**Who enters:** All signed-in members  
**Content hierarchy:** Updates / Requests (Requests only when authorised); unread filter; Today/Earlier; workspace label; mark-all-read.  
**Controls and transitions:** Tap update → target; mark read/delete; open M06 for requests.  
**Required states and errors:** Unread count stale; empty; notification target removed; offline.  
**API and source contract:** GET /notifications; GET /notifications/unread-count; PATCH read/read-all; DELETE.  
**Dependencies / decisions:** MVP active-workspace feed only; combined feed Phase 2.  
**Acceptance:** Unread updates are accurate for active workspace; no duplicate or cross-workspace item leak.

### N02 — Notification settings

**Proposed destination:** `/notification-settings`  
**Who enters:** Signed-in users  
**Content hierarchy:** Preference groups: assignments; mentions; review/status; due; project/team; workspace; channels in-app, email, WhatsApp, push if supported.  
**Controls and transitions:** Toggle category-channel; request OS permission if enabling push.  
**Required states and errors:** Push unavailable server side; OS denied; save failure; permission mismatch.  
**API and source contract:** GET/PATCH /notification-preferences; proposed device token endpoints.  
**Dependencies / decisions:** B-02 push channel.  
**Acceptance:** Preference changes persist; unavailable channels are not presented as functional.

### S01 — More

**Proposed destination:** `/(tabs)/more`  
**Who enters:** Signed-in users  
**Content hierarchy:** Workspace card; groups Work/Workspace/Account; profile; available Phase 1 items; sign out.  
**Controls and transitions:** Open screen or workspace switcher; sign out after confirmation.  
**Required states and errors:** Empty privileged menu; membership removed; loading permissions.  
**API and source contract:** GET /me/workspaces; effective permissions; feature flags.  
**Dependencies / decisions:** Never present dead Phase 2 menu items.  
**Acceptance:** Only implemented permitted entries appear; sign out clears all local data.

### S02 — My profile

**Proposed destination:** `/profile`  
**Who enters:** Signed-in users  
**Content hierarchy:** Avatar; name; contact basics; active workspace role label; edit basic info.  
**Controls and transitions:** Edit name/contact; upload photo from allowed picker; save.  
**Required states and errors:** Bad photo type/size; validation; offline; save failure.  
**API and source contract:** PATCH /profile/update; POST /profile/upload-picture.  
**Dependencies / decisions:** HEIC conversion and file 5MB limit.  
**Acceptance:** Profile updates reflect after refetch and do not leak across workspaces.

### S04 — Settings

**Proposed destination:** `/settings`  
**Who enters:** Signed-in users  
**Content hierarchy:** Account and security; light/dark/system; notification preferences; biometric lock if supported; legal; Delete account; sign out.  
**Controls and transitions:** Update preferences; open N02/S10; toggle biometric lock after supported flow.  
**Required states and errors:** Biometric unavailable; preference save; offline.  
**API and source contract:** GET /auth/me; local preference APIs.  
**Dependencies / decisions:** OS-local biometrics not alternative server login.  
**Acceptance:** No secret in AsyncStorage; controls show effective persisted state.

### S10 — Delete account

**Proposed destination:** `/account/delete`  
**Who enters:** Signed-in users requesting deletion  
**Content hierarchy:** Plain-language consequences; owned-workspace warning; deletion eligibility; request/download info where supported; irreversible confirmation.  
**Controls and transitions:** Explain data consequence; reauthenticate; request deletion; revoke session after successful server response.  
**Required states and errors:** Owns workspace; legal retention; token expired; request pending; unavailable backend.  
**API and source contract:** **NEW backend contract required:** self-service account deletion or deletion request; no route currently confirmed.  
**Dependencies / decisions:** B-08 backend and account ownership policy.  
**Acceptance:** User can initiate deletion inside app; server honours ownership and retention rules; no fake success.

# 9. Interaction and component blueprint

## 9.1 Shared components (implement once)

| Component | Key variants | States and accessibility |
|---|---|---|
| AppHeader | Tab root, detail, full-screen form | Back, label, overflow; announces screen context |
| WorkspaceChip / SwitcherSheet | Active, searching, switching, none | Current role, disabled suspended option, confirms change |
| TaskRow / ProjectCard | Regular, urgent, overdue, disabled | Clear status text, priority text, hit target, skeleton |
| MetricTile / ActionCard | Numeric, attention, empty | Accessible link to exact filtered list |
| StatusChip / PriorityChip | Six task statuses, four priorities | Status never conveyed by colour alone |
| SectionHeader | Heading + See all | Works under large text scaling |
| FormField / SearchSelect / DatePicker | Single, multiline, picker | Labels, errors, required/optional, focus order |
| BottomSheet / ActionSheet | Filter, assignee, workspace, status, file source | Swipe-to-dismiss with unsaved-change protection |
| ConfirmDialog | Delete, sign out, leave, approval consequences | Clear irreversible wording and distinct confirm/cancel |
| FileAttachment | Upload, download, failure, preview | Size/type, progress, retry, safe file source |
| MessageBubble / Composer | Text, reply, file, failed, read-only | Delivery state spoken and visible |
| EmptyState / OfflineBanner / ErrorPanel | Empty dataset, filters empty, network, 403, 423 | Actionable next step, no misleading retry |
| PermissionBoundary | Loading, allow, deny, read-only | Server-backed; does not replace backend ACL |
| LoadingSkeleton | Lists, summary, detail | No jumpy layout or endless spinner |

**Overlay register (14 categories, not screens):** workspace switcher; task filter; sort; status picker; priority picker; assignee picker; date/time picker; attachment source; review decision; message actions; task quick actions; destructive confirmation; time-entry/timer (later); permission explainers.

## 9.2 Visual design tokens

**CONFIRMED FROM AUDIT** web seed values; converted from HSL to hexadecimal for initial mobile tokens. Final accessible text/background pairs must be measured in the actual light/dark theme; raw hues should not be used blindly for body text.

| Token | Seed value | Mobile application |
|---|---|---|
| Primary (light) | `#6724DB` | Main action, selected navigation |
| Primary (dark) | `#8951EC` | Main action in dark theme |
| Canvas light | `#F3F4F6` | App background |
| Surface light | `#FFFFFF` | Cards, sheets |
| Border light | `#E5E7EB` | Dividers and card outlines |
| Canvas dark | `#0F1115` | Dark background |
| Success seed | `#20AC6B` | Done/success with accessible text token |
| Warning seed | `#F59F0A` | Review/attention; accessible label |
| Info seed | `#3C83F6` | In progress / information |
| Error seed | `#DC2828` | Urgent, error and overdue with separate accessible text |

**Status vocabulary:** Pending (neutral), In progress (blue), In review (amber), Completed (green), Delayed (red), Cancelled (grey). **Resolve the web inconsistency:** `in_review` must not be amber in one screen and violet in another. Priorities: Low, Medium, High, Urgent; each has a text label.

**Type and spacing:** platform system typefaces (SF / Roboto); body 15–16 sp/pt equivalent; secondary 13–14; **no production interactive label below 12**. Allow Dynamic Type and Android font scaling, with the functional acceptance check at 200% Android scale. Spacing uses a 4-point unit: 4, 8, 12, 16, 20, 24, 32. Cards start at 12–16 padding; page horizontal gutter 16. Main controls target **at least 44 pt on iOS and 48 dp on Android**. Use safe area insets and do not place critical actions under home indicators.

**Shape and motion:** start with 10–12 radius cards, 12–16 sheet corners, subtle elevation. Use short state transitions. Respect Reduce Motion. Support light, dark and system theme; check text contrast in both.

## 9.3 Interaction specifications

- **Pull to refresh:** Tasks, Projects, Inbox and Home; preserve filters and scroll position where feasible.
- **Keyboard:** keep composer and form-submit action above keyboard; never let keyboard cover error text; dismiss on back/safe gesture.
- **Search:** debounce queries and cancel stale requests; do not show a result from a previous workspace after switching.
- **Status picker:** present only server-allowed transitions; show conflict or dependency warning as a clear confirmation, not a toast that disappears.
- **Task quick actions:** long-press may expose permitted actions, but every action must also be reachable from a visible menu/button.
- **Swipe actions:** optional shortcut on notifications; provide visible mark-read/delete alternatives. Do not support irreversible deletion by swipe alone.
- **Attachments:** document picker, photo library and camera; normalise image type to accepted JPEG/PNG; size-check before upload; progress and cancellation; open authenticated downloads without public URLs.
- **Theme:** system default on first install; user preference stored locally; no need to synchronise across devices for MVP.
- **Notification prompting:** never ask on cold app launch; show A10 after the first active workspace and explain usefulness; skipping is permanent until user chooses settings or OS re-prompt rules permit.

# 10. Global state model and UX error contracts

## 10.1 Session lifecycle

**Boot:** loading → token missing → A01; token valid → user + workspaces → A08 or app shell. **Token expiry:** B-01 refresh attempt → resume or signed-out A01. **Sign out:** attempt device unregister and token revocation → remove SecureStore token → clear queries, WebSocket and local sensitive drafts → A01. Do not persist unencrypted task caches.

## 10.2 Network and data-state matrix

| Condition | User-facing response | Engineering behaviour |
|---|---|---|
| Slow response | Skeleton or in-context progress, not a blank page | Abort when navigating or switching workspace |
| Offline | Non-blocking offline banner, locally preserve unfinished form text in memory | No implicit writes; refetch when network returns |
| API 400 validation | Inline field message | Keep entered data |
| API 401 expired/invalid | Session handling and reauthentication | One controlled retry only after successful refresh; no request storm |
| API 403 not authorised | Read-only or A12 permission explanation | Remove stale privileged controls, refresh permissions |
| API 404 deleted/no longer exists | A12 with return destination | Remove invalid deep-link intent |
| API 409 conflict | Clear conflict explanation | Do not overwrite changed resource silently |
| API 423 workspace suspended | A09 blocking recovery | Hide previous workspace data and stop writes |
| API 429 rate limit | Retry-after/cooldown text | Respect server guidance |
| API 5xx | Retry with backoff and retry control | No duplicate POST without idempotency guard |
| Upload failure | Inline retry/cancel on attachment | Preserve the original draft |
| WebSocket disconnected | Subtle connection status only within live conversation | Reconnect on foreground, fetch missed comments |

## 10.3 Deep-link resolution contract

Parse supported HTTPS links and the app's custom scheme. Resolve to a **typed internal destination**: task, project, workspace invite, organisation activation, email verification, reset password, notifications or approval. Never trust a workspace ID in the incoming URL without membership validation. Keep an intent for sign-in; expire invitation/activation secrets according to server rules. Test `#token` fragments across Gmail, Outlook, Apple Mail and WhatsApp before relying on native handling. If universal links fail, preserve an accessible web fallback.

## 10.4 Push and unread behaviour

**MVP is active-workspace inbox**, as current list/count endpoints are workspace scoped. Push may reference another workspace; tapping it prompts a safe switch. Do not promise a combined multi-workspace inbox until a cross-workspace feed and unread-count contract exists. Use **generic lock-screen text** by default, with a future user opt-in for detailed previews. The OS notification permission is optional; the in-app Inbox remains available to all signed-in users.

# 11. Backend and integration dependency register

The User Portal API inventory from the supplied audit is useful evidence, but matching paths are not proof of contract compatibility. Each MVP endpoint needs method, required headers, request field schema, response shape, error codes, pagination and role checks verified against a staging environment.

| Workstream | Existing / proposed APIs | Required decision or fix | Release priority |
|---|---|---|---|
| Device session | Existing `POST /auth/login`, `GET /auth/me`; no refresh route | **B-01:** rotating refresh/device session, revocation, expiry | Critical |
| Signup/verification | Existing `/auth/signup`, `/auth/verify-email/*`; Turnstile on browser | D-03 browser handoff; test deep-link return | High |
| Google sign-in | Existing browser `/auth/google` callback | **B-03:** mobile-safe OAuth return or ID-token exchange; no JWT URL query | High |
| Mobile email links | Existing web-origin invitation, verification and reset | **B-05:** Universal Links/App Links association and fallback; test fragments | High |
| Workspaces and permissions | `/me/workspaces`, `/access-requests/me/effective-permissions`, `/companies`, join flows | Verify schema, guest semantics, switching and 423 | High |
| Core tasks and review | `/tasks`, `/tasks/:id`, comment, activity, attachments | **B-10 proposed:** prove/implement server reviewer authorisation; confirm status transitions | Critical |
| Projects | `/projects`, `/projects/:id`, member/project tasks | Verify create/edit field schema, ACL and governance | High |
| Workspace requests | `/companies/join/requests`, `/team/pending-verifications`, `/access-requests` | Verify decision endpoints and status names by type | High |
| Push | No current server support | **B-02:** device tokens, sender, preferences, delivery worker, routed payload | Critical for public MVP promise |
| Notifications | `/notifications*`, `/notification-preferences` | Push channel only after backend adds it; active workspace scope | High |
| File viewer and upload | Authenticated download routes; task multipart uploads | HEIC conversion; DO NOT call missing `/tasks/:id/attachments/:aid/preview` | High |
| Account deletion | No user self-service route confirmed | **B-08:** deletion/transfer/retention policy + UI contract | Critical for submission |
| Broken web methods | `/workflow/:id/progress` wrong; preview missing; websocket token missing | **B-09:** fix web or retire; do not port missing calls | Web health |

## 11.1 Suggested contract package for each MVP endpoint

1. HTTP method and canonical route; request headers (Bearer, `x-company-id` when required).
2. Query params and request body with field types, required flags and example.
3. Success response including pagination and nullability.
4. 400, 401, 403, 404, 409, 423, 429 and 5xx responses relevant to it.
5. Reviewer/role/permission/ownership test cases.
6. Idempotency rule for creates and comments; conditional update semantics.
7. Staging integration test that proves the client parses the exact contract.

## 11.2 Security requirements

- Store only session secrets in SecureStore/Keychain/Keystore, with a rotation and logout policy; no token in analytics, crash reports, query params, debug logs or screenshots.
- Make API base URL **required** in every build; CI must fail if preview/staging points to production.
- Include active workspace in query keys and cache invalidation; clear sensitive state when workspace membership changes.
- Avoid optimistic administrative approvals, account deletion and ownership changes.
- Use authenticated media download requests; do not create unprotected public links.
- Confirm whether web signup and existing Google login can satisfy app-store identity rules before public submission.

# 12. Mobile engineering blueprint

## 12.1 Proposed platform

| Layer | Proposal | Validation required |
|---|---|---|
| Framework | Expo + React Native + strict TypeScript | Current compatible SDK and dependency versions at repository creation |
| Routes | Expo Router; typed destination map | Link fragment and login-return handling |
| HTTP state | TanStack Query v5; scoped query keys | Schema-level contract tests |
| Local UI/session state | Small store (e.g., Zustand) for session + workspace + transient UI | Minimise duplicated server state |
| Credentials | `expo-secure-store`; single source for access/refresh token | Biometric lock and device-session semantics |
| Design | Shared Admiino token JSON/TS; NativeWind candidate | Prototype with sheets, long list, dark mode and accessibility |
| Forms | React Hook Form + Zod derived from server rules | Reject backend/frontend validation divergence |
| Realtime | RN WebSocket protocol port + AppState and NetInfo | Background/foreground reconnect, auth expiry, task-room access |
| Files | Expo picker/manipulator/filesystem/sharing packages | HEIC-to-JPEG, authenticated download on physical devices |
| Push | Expo notifications with backend B-02 | FCM/APNs credentials, payload, privacy and device revocation |
| Testing | Jest/RNTL; contract tests; Maestro E2E | Real staging accounts and devices |
| Builds | EAS development, staging and production profiles; Sentry | Env fail-closed and TestFlight/Play internal builds |

**Do not directly copy:** React DOM components, CSS/SCSS, shadcn Radix, `react-router-dom`, web-only Google Picker, browser PDF/Office preview, `localStorage`, `window` events or the 29 unused admin API methods. Port pure logic and API semantics through injected storage/transport abstractions.

## 12.2 Suggested repository layout

```text
admiino-mobile/
  app/
    (auth)/              sign-in, verify-email, reset, invite, activation
    (tabs)/              home, tasks, projects, inbox, more
    (screens)/           task/project detail, approvals, profile, settings
    (modals)/            create/edit task, create/edit project, search, file-viewer
    +not-found.tsx
  src/
    api/                 typed endpoint modules and request adapters
    auth/                session lifecycle and SecureStore
    workspace/           memberships, effective permissions, switch
    features/            home/tasks/projects/inbox/account etc.
    components/          shared native UX kit
    theme/               tokens, semantic palette, light/dark
    realtime/            WebSocket protocol, app state, reconnection
    notifications/       permission, push registration, deep-link mapping
    lib/                 ported pure helpers
    test/                fixtures, mocked contracts, test utilities
  e2e/                   Maestro real-device flows
  docs/                  decisions, architecture, API contract matrix
  scripts/               environment checks, API drift checks
  app.config.ts
  eas.json
  AGENTS.md
```

Repo naming is a proposal. The user app and backend remain separate repositories. Start with a slim, credited snapshot of the relevant web types and API operations, then extract a shared private package only after the mobile contract has stabilised. Include a pinned source commit and a drift review in CI; a field-name-only comparison is a signal, not a complete contract test.

# 13. Build sequence and gates

## 13.1 Implementation work packages

| Order | Package | Main screens / output | Gate to advance |
|---|---|---|---|
| **0** | Product and backend decisions | Sign off D-01 to D-08, B-01/B-02/B-03/B-05/B-08/B-10 ownership | Written contract/owners; no unresolved security contradiction |
| **1** | Technical spikes + design token prototype | Deep links; native file upload; foreground socket; push round trip; UI kit performance | Physical Android+iOS results recorded |
| **2** | Foundation | App shell, five-tab navigation, API client, permissions, theme, error system, test harness | Staging-only build passes lint/typecheck/tests |
| **3** | First vertical slice | A01 → workspace context → T01 → T02 → T03 | Two test users can sign in, read, comment and return safely |
| **4** | Task work | T04, T05, review controls, F03, task filters, attachments | Permission, idempotency, large-file, status and review tests pass |
| **5** | Projects and workspace flows | P01, P02, P03, A06, A07, A08, A09 | Create/manage allowed project; join/activate/multi-workspace E2E |
| **6** | Home and Inbox | H01, H03, N01, N02, M06, A10 | Push delivery, deep-link tap and cross-workspace switch pass |
| **7** | Account, recovery and release | A02–A05, A12, S01/S02/S04/S10; privacy, store metadata | TestFlight + Play internal acceptance; deletion tested |
| **8** | Release hardening | Performance, accessibility, observability, security and regression | All public release gates signed |

**Non-chronological dependency:** backend work can proceed in parallel with UI slices, but no screen depending on missing backend features is marked complete until integrated and accepted.

## 13.2 Minimum acceptance gates

1. User can sign in, verify email, activate/join workspace, switch safely, stay signed in for the agreed period and sign out.
2. Test users across owner/admin/manager/member/guest and team-lead scenarios see only authorised controls; direct API denials are handled cleanly.
3. Create → assign → comment → review → complete task works on staging with two accounts, and all server-side transitions are enforced.
4. Notifications arrive as in-app updates and push (when opted in); taps route correctly when app is foreground/background/killed.
5. Links for reset/verify/invite/activation resolve on a physical iPhone and Android phone; web fallback is usable.
6. No previous-workspace task, project or notification appears after switch, removal, suspension or sign-out.
7. Camera photos upload after type/size normalisation; PDF/image opens from authenticated download; unsupported files show clear alternatives.
8. Offline, expired token, 403/423, API 5xx, failed upload, duplicate request and revoked invite states have QA coverage.
9. Accessibility test: VoiceOver/TalkBack, dynamic type/font scaling, contrast, touch target and keyboard navigation.
10. No secrets/sensitive bodies in logs; dev/staging builds cannot talk to production; no real customer data in automated tests.
11. Account-deletion path works and correctly handles workspace ownership before public store submission.
12. Release build succeeds for both platforms and is accepted for internal distribution; store-policy check is current at submission.

## 13.3 Definition of done for an individual screen

A screen is **done** only if: the approved layout/content is built; all meaningful actions use real staging contracts; appropriate permissions and governance apply; loading/empty/error/offline/denied states exist; accessibility labels and focus are tested; the screen passes unit/integration tests; tracking uses no sensitive content; iOS and Android device tests pass; and the feature is documented with its source commit and QA evidence. A static visual does not count as done.

# 14. Phase 2 and Phase 3 backlog (not MVP)

## 14.1 Phase 2 — 17 proposed screens

| ID | Destination | Goal |
|---|---|---|
| A11 | Project invitation | Accept/reject project invitations in app |
| T06 | Subtask detail | More complete team subtask execution |
| P04 | Project members | Add/invite/manage project members |
| P05 | Project checklist | Create and update checklists |
| M01 | Teams list | Find and open teams |
| M02 | Team detail | Team overview, tasks, chat, activity |
| M04 | People | Member directory |
| M05 | Member profile | Member overview and work |
| C01 | Calendar | Task-deadline agenda and month strip |
| F01 | Drive | Workspace/personal file navigation |
| F02 | Folder | Folder file listing and uploads |
| F04 | Shared with me | Shared resources list |
| F05 | Shared resource | View/comment per granted access |
| S05 | Workspace overview | Name, code, logo, high-level settings |
| S06 | Integrations | Google, WhatsApp, Dropbox status and mobile-safe connect |
| S09 | Help and support | Self-service articles and support tickets |
| TM01 | Time tracking | Timer, entries, summaries |

Phase 2 also contains non-route work: Tasks Board/Calendar view modes, custom-field read-only details, safer local caching if approved, possible offline queue with idempotency, and cross-workspace inbox/feed if the backend supports it.

## 14.2 Phase 3 — 14 proposed screens

| ID | Destination | Goal |
|---|---|---|
| H02 | Workspace insights | Workspace metrics and history |
| P06 | Project portfolio and health | Portfolio summary/risk |
| P07 | Templates | Browse and use templates |
| M03 | Team management | Create/edit teams, members and lead |
| M07 | Workspace members | Manage member roles and restoration |
| M08 | Hire Talent | Submit and track assistance requests |
| M09 | Workload | Capacity/work distribution |
| F06 | Connected storage browser | Browse connected Google/Dropbox files |
| F07 | Trash | Restore and delete where permitted |
| F08 | Client access | Manage client-sharing requests |
| S03 | Professional profile | Skills, education, experience, CV |
| S07 | Activity log | View audit events |
| S08 | Subscription | Read-only plan and seats |
| HM01 | Harmony | Assessment and report |

Phase 3 should be validated against actual usage and demand before implementation. Web-only governance, automations configuration, custom-field design, audit exports, public client portals, MCP authorisation and the AI Hub placeholder remain outside the mobile commitment.

# 15. Low-fidelity wireframe blueprints

These wireframes define **content order and interaction zones**. They are not visual mockups. Apply the token and component systems from Section 9.

## 15.1 App shell and Home

```text
+------------------------------------+
| [Workspace v]          Search  Me  |
| Morning, Ana                        |
| You have 3 tasks due today          |
|                                     |
| NEEDS YOUR ACTION (when relevant)   |
| [Task review]  [Join requests]      |
|                                     |
| DUE SOON                   See all  |
|  Task card -> status / deadline      |
|  Task card -> status / deadline      |
|                                     |
| MY WORK                             |
| [Open] [In progress] [Overdue]      |
|                                     |
| QUICK ACTIONS (permission-gated)    |
| [New task] [Search] [Approvals]     |
|------------------------------------|
| Home   Tasks   Projects Inbox More  |
+------------------------------------+
```

## 15.2 Tasks list and task detail

```text
TASKS                                 TASK DETAIL
+--------------------------------+    +--------------------------------+
| Tasks             Search  [+]  |    | < Back                  [...] |
| [Mine] [Created] [All*]        |    | Task title                     |
| [Status] [Priority] [Due]      |    | In progress v - High - Fri     |
|--------------------------------|    | Assignees - Project - Team     |
| Prepare deck      In progress  |    | [Needs review actions*]        |
| Finance - Due Fri - High       |    | Description / Show more        |
|--------------------------------|    | Subtasks 2 of 5               |
| Contract review   Pending      |    | Attachments (3) -> viewer      |
| Legal - Due Sat - Medium       |    | Activity                       |
| ...                            |    | Conversation -> 4 new          |
|--------------------------------|    | [Comment]        [Edit*]      |
| Home Tasks Projects Inbox More |    +--------------------------------+
+--------------------------------+    *Only if backend permissions allow
```

## 15.3 Inbox with action queue

```text
+------------------------------------+
| Inbox                     Read all |
| [Updates] [Requests*]              |
| [All] [Unread]                    |
| TODAY                              |
| o Assigned: Prepare board deck    |
| o Comment on Contract review      |
| EARLIER                            |
| o Your join request was approved  |
|                                    |
| Requests* -> Join / Member / Access|
| Tap request -> M06 detail/decision  |
|------------------------------------|
| Home   Tasks   Projects Inbox More |
+------------------------------------+
*Requests only for authorised users.
```

## 15.4 Workspace setup and create task

```text
WORKSPACE SETUP                      CREATE TASK
+--------------------------------+   +--------------------------------+
| Join or create a workspace     |   | [Cancel] New task      [Save] |
|                                |   | Title *                        |
| [Join with company code]       |   | [__________________________]   |
| [Create a workspace]           |   | Priority   [Medium v]         |
|                                |   | Deadline   [Choose date v]    |
| Pending requests               |   | Assignees  [Choose people v]  |
| - Gamma Co — Pending           |   | [More options v]              |
|                                |   | Description / project / files |
|                                |   |                                |
+--------------------------------+   +--------------------------------+
```

## 15.5 Task conversation

```text
+------------------------------------+
| < Task title · Conversation        |
|                                    |
| Tunde - 09:12                      |
| [Draft is ready for your review]   |
|                        Me - 09:15  |
|               [Thanks, checking]  |
|               Sent OK               |
|                                    |
| [Attachment.pdf] [Preview]         |
| Tunde is typing...                   |
|------------------------------------|
| [+] [Write a message...        ] [➤]|
+------------------------------------+
```

# 16. Decision log and ownership to confirm

These are **proposals**, not approved instructions to the backend team. Confirm them at a product/engineering sign-off meeting.

| ID | Decision needed | Proposed resolution | Owner to assign |
|---|---|---|---|
| D-01 | Push required for initial public release? | Yes; may build/test other screens first | Product + Backend |
| D-02 | Session lifetime, refresh rotation and revocation | Refreshable device session; owner-approved policy | Security + Backend |
| D-03 | Signup | Existing secure browser signup in MVP | Product + Security |
| D-04 | Google login | Mobile-safe system-browser OAuth or native exchange; choose after spike | Backend + Mobile |
| D-05 | Eligible workspace roles | All roles; permission-based content | Product |
| D-06 | Inbox across workspaces | Active workspace MVP; combined later | Product + Backend |
| D-07 | Formal 'Changes requested' review state | No new state in MVP, but server-authorised transition and comment consistency required | Product + Backend |
| D-08 | Workspace plan selection | Free workspace creation only; paid/commercial actions on web | Product + Commercial |
| D-09 | Gender prompt | Remove from mandatory onboarding | Product + Privacy |
| D-10 | Offline storage | Memory only MVP; reconsider encrypted cache later | Security + Mobile |
| D-11 | Internationalisation | English first, structured strings | Product + Mobile |
| D-12 | Lock-screen notification privacy | Generic preview default | Product + Security |
| D-13 | Backend and web defect owners | Name owner and acceptance test per B-item | Engineering lead |
| D-14 | App identity/store accounts | Confirm app name, IDs, legal and support contacts | Product + Operations |
| **D-15** | Move activation, approvals and basic project creation into MVP | **Proposed yes** | Product |
| **D-16** | Account deletion | **MVP release requirement, not optional** | Product + Backend + Legal |
| **D-17** | Task reviewer authorisation | Explicit server-approved reviewer contract before enabling approvals | Backend + Security |

## 16.1 The release-critical issue list

**Must be resolved or deliberately re-scoped before launch:** B-01 device sessions; B-02 push if retained as launch promise; B-03 Google login if offered; B-05 links and hosted association files; B-08 account deletion; B-10 reviewer rules; mobile API contract tests and staging test accounts; app-store sign-in and account-deletion policy verification.

**Known web defects to fix independently:** forgot/reset/verify routes render Login; absent attachment preview and status-progress paths; stale unused websocket-token method. These defects should not be silently reproduced by porting the web API client.

# 17. Handoff checklist for design, Copilot and engineering

## 17.1 Before design is locked

- [ ] Approve five-tab navigation and Inbox as updates + authorised requests.
- [ ] Approve 29-screen MVP register and confirm that Phase 2/3 remain out of scope.
- [ ] Confirm exact task-review roles and return-to-work semantics from backend owner.
- [ ] Confirm organisation activation is a launch journey.
- [ ] Review mobile Home priorities for owner, manager, member and team lead.
- [ ] Confirm workspace naming, task labels, status vocabulary and brand seed colours.
- [ ] Produce device-frame low- and high-fidelity screens for all 29 destinations, including errors and permission variations.

## 17.2 Before repository creation

- [ ] Complete tech spikes for links, push, socket lifecycle, HEIC upload and UI-list performance.
- [ ] Confirm backend workstream owners, staging API and test organisations/roles.
- [ ] Agree package IDs, Expo SDK and dependency versions, store accounts, EAS profiles.
- [ ] Define endpoint contracts, auth/session storage, query cache and workspace isolation rules.
- [ ] Record a pinned web commit used for copied API/type snippets; no code imported from admin portal.

## 17.3 Copilot implementation guardrails

1. Build only approved screen IDs, in the work-package order. Never infer additional features from dead web pages.
2. Prefer small feature modules and tests over one giant generated component.
3. Treat `User.role` as legacy, not an authorisation source.
4. Read effective workspace permissions and resource access before privileged actions.
5. Never invent or silently change backend endpoints or production configuration.
6. Keep development and staging builds isolated from production.
7. Implement each screen's state/permission/error variants, then prove its staging API contract.
8. Record unresolved items in the decision log, never as assumed success.

---

**Blueprint status at issue:** Ready for product and UX review. Not an approved implementation specification until the decisions and release-critical backend contracts have owners and acceptance criteria.  
**Next recommended artifact:** Screen-level high-fidelity UI design pack and annotated interactive prototype for the 29 MVP destinations, then engineering tickets tied to this document's screen IDs.

