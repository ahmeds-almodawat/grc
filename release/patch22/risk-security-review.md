# Patch 22 Risk Security Review

## Posture

Patch 22 follows the current runtime bridge pattern:

- Browser code calls `invokePrivilegedAction`.
- The authenticated Edge function validates the Supabase user.
- The Edge function uses the service client to call `patch22_risk_workflow_bridge`.
- The database bridge checks active actor, organization scope, role or owner authority, and action-specific rules.

## RLS

New Patch 22 tables have row level security enabled:

- `risk_kri_indicators`
- `risk_reassessment_history`
- `risk_workflow_events`

KRI indicators allow RLS-constrained read/write for owners or GRC managers. History and workflow event tables are readable through RLS and written through the governed bridge.

## Function Grants

The Patch 22 workflow bridge and event helper are:

- `SECURITY DEFINER`
- `search_path = public, pg_temp`
- Revoked from `public`, `anon`, and `authenticated`
- Granted to `service_role`

## Safety Notes

- No service-role key is introduced into browser source.
- No Patch 22 delete policy is added.
- No destructive migration statement is introduced.
- Source linking to OVR, audit, compliance, and projects is read/link only and does not rewrite those workflows.

