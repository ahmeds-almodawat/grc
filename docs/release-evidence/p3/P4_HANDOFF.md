# P4 Production Cutover Handoff

## Authorization Gate

P4 is not authorized until F22 real Turnstile certification passes and PR #129
remains unmerged until that decision. All non-human P3/P3.5 gates are complete.

## Exact Starting State

- Production Supabase: `zbrjjecpsrzposhuarcn`
- Production starting migration ceiling: 211
- Staging Supabase: `zghsgzrdwbqdrpuxanac`
- Staging migration source ceiling: 231
- Frozen frontend product source:
  `3c87eeb8e05427f295111c5188b95003082dfdb2`
- Final evidence RC/deployment: exact PR head recorded in PR #129
- Production writes during P3/P3.5: none

## Required Pre-217 Bridge

- SQL: `release/p3/p3-pre217-critical-attention-compatibility.sql`
- SHA-256: `26CF8F06B26132BA8FFD81E60A216B46FFA209FBAA07257963736D30D6D71491`
- Apply after canonical migrations 212-216 and before unchanged migration 217
- Bridge writes no migration-ledger entry
- Unknown view shape, owner, ACL, option, hash, or dependency must stop cutover

## P4 Ordered Plan

1. Confirm final staging Turnstile certification and exact PR/deployment SHA.
2. Take a fresh provider backup/PITR checkpoint and export schema, data,
   migration history, and roles.
3. Reconfirm Production ceiling 211 and the reviewed legacy critical-view hash.
4. Apply migrations 212-216 normally.
5. Apply the exact pre-217 compatibility bridge without ledger manipulation.
6. Apply unchanged migrations 217-231 normally and verify each ledger entry.
7. Deploy the repository `privileged-action` with JWT required; Production
   version 17 differs from the current source and staging version 10.
8. Do not deploy staging-only legacy `admin-create-user`.
9. Verify Production environment variables by name/scope. Required deltas must
   retain Patch83U and canonical CAPTCHA/Turnstile settings; never copy staging
   values or credentials.
10. Deploy the exact authorized frontend RC to the intended Production Vercel
    project `grc`, then run bounded Auth, Patch83U, RBAC, route, and security
    smoke.

## Rollback and Forward-Fix

- Before migration writes: stop with no change if backup, bridge precondition,
  environment, or source-equality proof fails.
- During migrations: stop immediately on the first failed migration; preserve
  logs and ledger state. Do not edit historical migrations or manually mark
  failed versions applied.
- Data/schema recovery: use the fresh provider checkpoint and governed exports;
  do not use ad hoc destructive resets.
- Frontend rollback: retain and use the previous immutable Production
  deployment. Its Git SHA is historically unattested, so preserve its
  deployment ID/URL before cutover.
- Edge rollback: preserve the prior `privileged-action` version and redeploy
  only through the governed function process.
- Prefer a bounded forward-fix migration for a post-apply defect when rollback
  would risk newer committed data.
