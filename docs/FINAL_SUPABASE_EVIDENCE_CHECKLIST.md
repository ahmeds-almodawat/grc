# Final Supabase Evidence Checklist

Use this checklist before pilot rollout.

## Migration evidence

- Fresh Supabase staging project created.
- Migrations applied in numeric order.
- No SQL errors.
- `v_release_factory_scorecard` returns one row.
- `seed_release_factory_defaults()` runs successfully.
- Dashboard loads without Supabase API errors.

## RLS evidence

Test with real accounts:

- Executive account sees company-wide data.
- Governance admin sees governance workflows.
- Department manager sees department scope only.
- Employee sees assigned tasks and own OVR only.
- Quality user can review OVR but normal employee cannot close OVR.
- Auditor can review audit findings but department owner cannot close own audit finding.

## Backup evidence

- Browser export package generated.
- Database backup taken.
- Storage backup plan documented.
- Restore dry-run performed in staging.
- Restore evidence attached in the platform.

## OVR evidence

- Create test OVR as reporter.
- Route to Supervisor/HOD.
- Add investigation and corrective action.
- Submit to Quality.
- Quality returns clarification once.
- Department responds.
- Evidence uploaded and accepted.
- Quality closes OVR.
- OVR risk indicator updates.

## Arabic / RTL evidence

Check these pages in Arabic:

- Home
- Executive Command Center
- OVR
- Reports / Export
- Admin / Access
- Release Factory
- Print/export screens

## Pilot evidence

- Pilot departments listed.
- Pilot users imported.
- Training completed.
- Support owner named.
- Escalation owner named.
- Go/no-go decision recorded.
