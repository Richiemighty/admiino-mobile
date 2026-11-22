# Temporary main-only Git workflow

The product owner explicitly approved committing and pushing approved Admiino Mobile work directly to `main`, effective immediately. This temporary override remains in effect until the product owner changes it.

- Do not create or use `staging` or feature branches for new work.
- Preserve existing branches, including the existing `staging` branch.
- Use normal fast-forward-compatible pushes only. Never force-push, rewrite history, or delete branches.
- Continue to inspect the worktree and remote history, run the applicable checks, review staged paths for secrets and generated output, and stop on conflicts or failed required checks.
- This changes only the Git destination. It does not authorize deployment, production or staging API access, backend changes, or bypassing any permission, environment, security, accessibility, or testing requirements.

The product owner may replace or revoke this policy at any time.
