# Patch 81 Preflight Checklist

Complete before applying migrations 118 through 121 to any target Supabase environment.

- [ ] Current branch is `main`.
- [ ] Git working tree is clean.
- [ ] Latest `main` has been pulled from origin.
- [ ] Target environment is recorded: `local`, `staging`, or `production`.
- [ ] Supabase project ID is recorded.
- [ ] Database backup is complete.
- [ ] Backup reference is recorded.
- [ ] Restore point, database snapshot, or rollback plan is approved.
- [ ] Service role secret is not exposed in frontend code, logs, screenshots, or shared documents.
- [ ] Privileged-action function configuration is confirmed.
- [ ] `118_patch76_controlled_production_authority_cutover_gate.sql` exists locally.
- [ ] `119_patch77_live_pilot_execution_issue_burndown.sql` exists locally.
- [ ] `120_patch78_identity_role_data_integrity_hardening.sql` exists locally.
- [ ] `121_patch79_production_operations_hypercare_board_pack.sql` exists locally.
- [ ] No pending unexpected migrations are queued for the target.
- [ ] `npm run validate:build` passed.
- [ ] `npm run validate:security` passed.
- [ ] Stakeholder/change approval is recorded before production apply.

Migration deployment evidence does not approve production launch. Controlled production authority and real hospital execution remain separate.
