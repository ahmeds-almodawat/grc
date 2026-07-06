# Patch 81 Controlled Migration Deployment Runbook

This runbook gives operators a controlled, auditable process for applying migrations 118 through 121 to a target Supabase environment. It is a readiness and deployment-control document only. Applying these migrations records capability deployment evidence; it does not approve production launch, and controlled production authority remains separate.

## Scope

Target migrations, in exact order:

1. `118_patch76_controlled_production_authority_cutover_gate.sql`
2. `119_patch77_live_pilot_execution_issue_burndown.sql`
3. `120_patch78_identity_role_data_integrity_hardening.sql`
4. `121_patch79_production_operations_hypercare_board_pack.sql`

Patch 81 does not add a migration, edit prior migrations, apply database changes, modify RLS, change privileged RPC behavior, or change frontend behavior.

## Preflight Checklist

- Confirm current branch is `main`.
- Confirm git working tree is clean.
- Confirm latest `main` is pulled from origin.
- Confirm environment target: `local`, `staging`, or `production`.
- Confirm Supabase project ID and project name.
- Confirm database backup completed and backup reference recorded.
- Confirm restore point, database snapshot, or rollback plan is approved.
- Confirm service role secret is not exposed in frontend code, logs, screenshots, or shared documents.
- Confirm privileged-action function configuration is present for authorized service-side workflows.
- Confirm migrations 118, 119, 120, and 121 exist locally.
- Confirm no pending unexpected migrations are queued for the target environment.
- Confirm app build validation passed.
- Confirm runtime security validation passed.
- Confirm stakeholder/change approval before production apply.

## Staging-First Plan

1. Apply the target migrations to staging first during a controlled change window.
2. Capture migration output logs and timestamps.
3. Run smoke tests against the staging application.
4. Verify new tables from Patches 76 through 79 exist.
5. Verify RLS is enabled on all new tables.
6. Verify privileged bridge RPCs work only for authorized users through the existing backend bridge.
7. Verify unauthorized browser access is blocked.
8. Verify Production Readiness Center loads.
9. Verify Production Operator Console loads.
10. Verify no production launch status is created by migration apply.
11. Record results in the evidence capture template before considering production apply.

## Production Apply Plan

The commands below are examples only. Operators must replace project, environment, and credential values and must not run them blindly.

```powershell
# Example only: confirm target
supabase projects list

# Example only: inspect migration status for the selected project
supabase migration list --project-ref <TARGET_PROJECT_REF>

# Example only: apply approved migrations during the change window
supabase db push --project-ref <TARGET_PROJECT_REF>
```

Production apply requirements:

- Backup first.
- Apply only during the approved maintenance/change window.
- Capture terminal logs, screenshots, migration status, and operator notes.
- Stop immediately on unexpected errors.
- Do not add sample records as part of migration apply.
- Do not treat migration deployment evidence as production launch approval.

## Post-Apply Verification

After staging or production apply, verify:

- Patch 76 tables exist.
- Patch 77 tables exist.
- Patch 78 tables exist.
- Patch 79 tables exist.
- RLS is enabled on all new tables.
- Privileged RPCs are not callable directly by browser clients.
- No service-role secret is exposed to frontend code or browser state.
- Production Readiness Center loads.
- Production Operator Console loads.
- Patch 76 controlled cutover decision section works.
- Patch 77 pilot issue burn-down section works.
- Patch 78 access integrity section works.
- Patch 79 hypercare and board pack section works.
- No automatic production launch was triggered.
- No sample or placeholder records were inserted.

## Containment If Verification Fails

- Stop app deployment or promotion.
- Preserve all migration logs and application logs.
- Do not destructively drop tables automatically.
- Use approved backup restore, database snapshot restore, or DBA-led containment process.
- Roll back the application deployment if new UI access must be disabled while data is reviewed.
- Preserve audit logs.
- Capture failed migration logs and attach them to the change record.
- Escalate to the database owner and security owner.

## Evidence

Use `release/patch81/patch81-evidence-capture-template.md` for every target environment.
