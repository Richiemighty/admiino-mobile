## Summary

<!-- What changed and why? -->

## Phase or feature reference

<!-- Example: P04.3 testing infrastructure, or approved screen ID -->

## Files modified

<!-- List the main files and the purpose of each. -->

## Tests performed

- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run format:check`
- [ ] `npm run validate:environment`
- [ ] `npm run test:environment`
- [ ] `npm test`
- [ ] `npx expo-doctor`

## UI evidence

<!-- For UI changes, attach screenshots from the actual simulator/device. Mark N/A if no UI changed. -->

## Backend contracts

<!-- List approved API contract changes and evidence, or write "None". Do not invent endpoints. -->

## Permissions and workspace isolation

- [ ] No permission-sensitive behavior changed, or permission effects are described below.
- [ ] For permission-sensitive work, tests cover owner, admin, manager, member, guest, team-lead/override cases as applicable.
- [ ] Cross-workspace behavior tests verify membership, workspace-scoped queries/cache, switch behavior, and no stale data leakage as applicable.
- [ ] Server-side authorization remains authoritative.

Details:

## Known limitations

<!-- Include untested platforms, missing contracts, or follow-up work. Write "None" if applicable. -->

## Security confirmation

- [ ] I confirm no secrets, credentials, signing material, or real user data were committed.
