# Patch 46 Validation Report

## Commands

- `git status --short --branch`: ran before and after validation
- `git diff --stat`: ran after validation
- `git diff --name-only`: ran after validation
- `git grep -n -E "^(<<<<<<<|=======|>>>>>>>)" -- . ':!node_modules' ':!dist' ':!build'`: clean, no matches
- `npm run typecheck`: passed
- `npm run build`: passed
- `npm run patch46:all`: passed
- `npm run proof:all`: passed, 17/17
- `npm run v700:runtime-security`: passed

## Notes

- Patch 46 does not create fake approvals.
- Missing signoff data is surfaced as pending access review.
- `patch46:all` also re-ran `patch45:all`; Patch 45 remained passing.
- Release noise restore status: `release/v*` and Patch 43/44/45 generated proof noise restored.
- Patch 46 proof JSON files are new required release artifacts and were kept.
