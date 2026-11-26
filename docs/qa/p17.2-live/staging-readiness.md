# Staging readiness

Status: **BLOCKED**.

## Available

- Mobile repository and existing P17.2 automated fixtures/tests.
- Backend source and backend-local test suite.
- Mobile environment validation. It reports `production` with host `api.admiino.com`; this is not an approved staging environment and was not used for writes.

## Missing

- Verified non-production API base URL.
- Approved owner, admin, manager, member, team-lead, guest/external-viewer and restricted-member accounts.
- Synthetic workspace, teams, projects, private resources and review-required tasks.
- Safe credentials/test-token mechanism and reset/cleanup procedure.
- Approved live-test operator and evidence capture instructions.

## Safe boundary

No state-changing permission request was sent to production or any unverified endpoint. Live cases are recorded as **BLOCKED** or **NOT RUN**, not replaced with mocks. Backend-local tests were run only where their setup permitted it.
