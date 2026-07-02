# Platform Health Fix Summary

Date: 2026-07-02

## Issues Fixed

- Removed remaining broad `EXECUTE` grants from public `SECURITY DEFINER` functions by adding an idempotent post-patch lockdown migration.
- Updated the local migration apply helper so it applies both the original v6.7.3 lockdown migration and the post-patch lockdown migration.
- Updated the v7.2 persona proof script to discover Supabase containers from `supabase/config.toml` `project_id`, avoiding folder/worktree name mismatches.

## Validation

- `npm run typecheck`: passed
- `npm run build`: passed
- `npm run v673:security-definer-audit`: passed, `remaining_broad_execute_grants: 0`
- `npm run v672:capture`: passed, `sql_passed: 3/3`
- `npm run v662:strict-proof`: passed
- `npm run v66:strict-proof`: passed
- `npm run v72:persona-proof`: passed, `authenticated_personas: 8/8`, `required_scenarios: 9/9`
- `npm run proof:all`: passed, `17/17`
- `npm run v700:runtime-security`: passed
- `npm run test:unit`: passed, `3/3`
- `npm run test:e2e`: passed, `7/7`
- `npm audit --audit-level=high`: passed, `0 vulnerabilities`

## Notes

- The local database was not reset.
- The fix is additive and does not weaken RLS.
- Proof output files under `release/v*` were refreshed by the validation commands.
