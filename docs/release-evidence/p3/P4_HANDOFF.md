# P4 Production Cutover Handoff

## Gate

P4 is NOT AUTHORIZED to start. Staging is not certified.

## Required P3 Resume

1. Restore normal Cloudflare Turnstile rendering without disabling CAPTCHA.
2. Use governed admin reset/provisioning to issue new ephemeral credentials for
   the four retained invited personas; no previous temporary credential exists.
3. Complete first-login transitions and the full six-persona hosted positive
   and negative RBAC/scope matrix.
4. Complete hosted Policy/SOP and governance-link mutation UAT using tagged
   records, including storage/import only where the staging contract permits.
5. Clean all remaining disposable access through canonical lifecycle tooling.
6. Commit the final certification evidence and deploy the exact clean ending RC
   SHA to `grc-staging`.
7. Perform the separately authorized Production read-only inventory only after
   hosted staging UAT passes.

## Current Technical State

- Staging migration ceiling: 223
- Bridge required before original migration 217: proven and already applied to
  staging without ledger manipulation
- Historical migrations: unchanged
- Local regression: 2205/2205 unit, 9/9 SQL, 95/95 Playwright, build PASS
- PR #129: open, mergeable, not merged
- Correction cycles used: 2 of 2
- Remaining substantial correction cycles: 0
- Production writes/config/Auth/deployment: none

Production compatibility and whether P4 requires the same bridge remain
UNDETERMINED because the authorized Production read-only preflight is gated on
successful staging UAT.

