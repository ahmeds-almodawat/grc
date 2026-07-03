# Patch 47 Validation Report

## Commands

- `git status --short --branch`: ran before and after validation
- `git diff --stat`: ran after validation
- `git diff --name-only`: ran after validation
- `git grep -n -E "^(<<<<<<<|=======|>>>>>>>)" -- . ':!node_modules' ':!dist' ':!build'`: clean, no matches
- `npm run typecheck`: passed
- `npm run build`: passed
- `npm run patch47:all`: passed
- `npm run proof:all`: passed, 17/17
- `npm run v700:runtime-security`: passed

## Notes

- Patch 47 does not claim staging proof is complete without evidence.
- Missing or unavailable staging/local-clean evidence is surfaced as `evidence_required` or `blocked`.
- Patch 47 evidence runner final status: `passed`.
- Patch 47 evidence runner mode: `verified_existing_local_evidence`.
- `proof:all` executed local Supabase evidence capture and restore dry-run successfully.
- Release noise restore status: `release/v*` and Patch 43/44/45/46 generated proof noise restored.
- Patch 47 proof JSON and runner JSON are new required release artifacts and were kept.
