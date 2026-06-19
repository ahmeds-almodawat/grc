# GRC Control Center v1.3 — Production Hardening & Modern UI

## Focus

This patch strengthens the platform for production rollout and modernizes the management experience without adding heavy chart/reporting dependencies.

## Added

- Backup Health Check page.
- Workflow Blockers page section.
- Custom Reports page.
- Modern Executive Control dashboard.
- Modern glass-style visual system.
- CSS/SVG heatmap and radar visuals.
- Print-ready report output.
- CSV/JSON report export helpers.
- Workflow guard error messages in English and Arabic.
- Migration `015_production_hardening_health_print_controls.sql`.

## Database additions

- `export_logs`
- `backup_packages`
- `report_definitions`
- `system_health_snapshots`
- `v_backup_health_check`
- `v_workflow_blockers`
- `v_print_report_index`
- `create_system_health_snapshot(...)`
- Workflow guard triggers for projects, milestones, tasks, approvals, audit findings, and OVR.

## Important behavior changes

The database now blocks unsafe actions:

- Project closure without accepted evidence when evidence is required.
- Milestone/task approval or closure without accepted evidence when evidence is required.
- Delayed project/milestone/task without delay reason.
- Self-approval.
- Audit finding closure without audit review and accepted evidence.
- OVR closure without accepted evidence and Quality closure user.

## Notes

Browser exports are useful for external reports and analysis, but they are not a full Supabase backup. Full production backup still needs database backup, Storage backup, and auth/secrets handling.
