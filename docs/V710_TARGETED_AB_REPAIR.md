# v7.1 Targeted A+B Repair

## Security audit scope resolution

The v6.7.3 database audit intentionally checks application-owned functions in
the `public` schema. The earlier v7.0 runtime audit checked every non-system
schema and therefore counted three Supabase-managed functions:

- `net.http_get(text,jsonb,jsonb,integer)` — `anon`, `authenticated`
- `net.http_post(text,jsonb,jsonb,jsonb,integer)` — `anon`, `authenticated`
- `supabase_functions.http_request()` — `anon`, `authenticated`

These are extension/platform functions in Supabase-managed schemas, not GRC
application RPCs. v7.1 lists them as managed-schema observations but does not
revoke their platform grants with an application migration. Broad execution on
an application-owned `public` SECURITY DEFINER function remains blocking.

## Runtime RPC bridge policy

The v7.1 runtime report keeps the full reviewed catalog of the original 20
service-role-only RPC calls. Each entry includes its reviewed frontend
location, current call presence, effective grants, security mode, classification,
and recommended bridge action.

The first repair removes or guards operations that are clearly server/operator
responsibilities:

- seed and release fixture creation
- restore and release preflight execution
- scheduled reminder and automation refresh
- backup run recording
- system health snapshot creation
- escalation event refresh

Critical business actions such as role changes, escalation transitions, OVR
workflow transitions, and board-pack snapshots are not converted blindly.
Their direct calls remain documented bridge work and now return a clear
server-bridge-required message when the database denies browser execution.

## v6.5 proof strengthening

The canonical v6.5 SQL proof now:

- uses `public.evidence_files`, not `public.evidence`
- checks implemented security-control relations
- raises on missing critical relations
- raises when RLS is not enabled on expected sensitive tables
- raises when any application-owned SECURITY DEFINER function is executable by
  `public`, `anon`, or `authenticated`
- emits explicit `V65_PASS_*` signals only after the assertions succeed

`FORCE ROW LEVEL SECURITY` is reported but is not required by this repair.
Enabling it changes table-owner behavior and would require a separately
reviewed migration.

## Proof commands

```powershell
npm run proof:technical
npm run proof:runtime-security
npm run proof:personas
npm run proof:restore
npm run proof:pilot
npm run proof:all
```

The pilot proof remains expected to fail until real human
signoff/confidentiality approvals are completed. v7.1 does not manufacture
those approvals.
