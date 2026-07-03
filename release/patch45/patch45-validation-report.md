# Patch 45 Validation Report

Status: passed.

Validation results:

- `git status --short --branch`: passed on `patch45-runtime-action-authorization-review`.
- `git diff --stat`: reviewed.
- `git diff --name-only`: reviewed.
- `git grep -n -E "^(<<<<<<<|=======|>>>>>>>)" -- . ':!node_modules' ':!dist' ':!build'`: passed, no conflict markers found.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- `npm run patch45:all`: passed.
- `npm run proof:all`: passed, 17/17.
- `npm run v700:runtime-security`: passed.

Runtime action classification result:

- Unique frontend runtime actions: 57.
- Classified actions: 57.
- Remaining `unknown_requires_review` classifications: 0.
- Pending access-review signoffs: 57.
- Direct browser RPC exceptions: 1, `search_grc_global`.

Runtime security result:

- Service-role-only frontend calls: 0.
- Remaining broad SECURITY DEFINER execute grants: 0.

Generated release/v* and Patch 43/44 proof JSON noise restored after validation.
