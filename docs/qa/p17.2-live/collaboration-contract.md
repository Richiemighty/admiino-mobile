# Collaboration contract

Finding: **FAIL / backend contract gap remains**.

`admiino-backend/src/services/taskAccessService.js` returns `canCollaborate: true` for an active Team member who may collaborate while read-only. The task comment authorization service consumes that field and rejects read-only users without it. However, the task-detail controller currently serializes only `canView`, `canEdit` and `readOnly` in the response access object. The mobile task-detail contract therefore cannot safely distinguish collaboration access from other read-only access.

Required backend handoff (not implemented here): expose `canCollaborate` in the authoritative `GET /tasks/:id` access payload, including an explicit `false` for non-collaborators where the response contract requires it. Add backend tests for Team collaborator, view-all read-only member, external viewer, revoked Team membership and cross-workspace task access. Update `MOBILE_API_MATRIX.md` and mobile types/tests after the backend contract is approved.

Mobile behavior today is safe: missing collaboration authority does not grant comment or attachment access. It may be overly restrictive for a valid Team collaborator until the field is exposed. No extra access was granted to make tests pass.

Status: **BLOCKED** pending backend contract approval and a live staging check of comments, attachments and downloads.
