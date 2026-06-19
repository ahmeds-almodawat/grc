# GRC Control Center - Production Operator Handover Bundle

Generated at: 2026-06-17T21:40:22.093Z

## Final command

Do not expand features until the migration, RLS, backup/restore, OVR and Arabic/RTL checks are evidenced.

## Migration files

- 001_core_foundation.sql
- 002_grc_layer.sql
- 003_rls_permissions_and_controls.sql
- 004_seed_reference_data.sql
- 005_operational_views_and_storage.sql
- 006_workflow_queues_and_project_controls.sql
- 007_escalation_and_governance_controls.sql
- 008_import_export_rollout_tools.sql
- 009_access_control_and_role_governance.sql
- 010_bilingual_and_ovr_module.sql
- 011_ovr_risk_indicators.sql
- 012a_ovr_workflow_enum_values.sql
- 012b_ovr_workflow_controls.sql
- 013_kpi_analytics_heatmap_radar.sql
- 014_export_center_backups_custom_reports.sql
- 015_production_hardening_health_print_controls.sql
- 016_rollout_onboarding_user_guides.sql
- 017_notifications_activity_timelines.sql
- 018_qa_permission_deployment_readiness.sql
- 019_performance_responsive_usability.sql
- 020_security_audit_retention_controls.sql
- 021_command_search_documents_release.sql
- 022_ultra_release_restore_admin_dictionary.sql
- 023_enterprise_intelligence_reporting.sql
- 024_automation_intelligence_kri_reviews.sql
- 025_staging_validation_consolidation.sql
- 026_finish_fast_release_sprint.sql
- 027_final_production_leap.sql
- 028_final_release_factory.sql
- 029_production_proof_consolidation.sql

## Documentation files

- docs/ACCEPTANCE_TEST_SCRIPT.md
- docs/FINAL_GO_LIVE_PLAYBOOK.md
- docs/FINAL_PATCH_APPLICATION_ORDER.md
- docs/FINAL_PILOT_GO_NO_GO_SCRIPT.md
- docs/FINAL_PRODUCTION_HANDOVER.md
- docs/FINAL_SECURITY_RLS_SCRIPT.md
- docs/FINAL_SUPABASE_EVIDENCE_CHECKLIST.md
- docs/FRESH_INSTALL_MIGRATION_ORDER.md
- docs/IMPLEMENTATION_NOTES.md
- docs/OPERATOR_DAY_1_RUNBOOK.md
- docs/PATCH_CONSOLIDATION_PLAN.md
- docs/PRODUCT_BLUEPRINT.md
- docs/RELEASE_NOTES.md
- docs/RELEASE_NOTES_v1.3.md
- docs/RELEASE_NOTES_v1.4.md
- docs/RELEASE_NOTES_v1.5.md
- docs/RELEASE_NOTES_v1.6.md
- docs/RELEASE_NOTES_v2.1.md
- docs/V32_FINAL_RELEASE_FACTORY.md
- docs/V33_PRODUCTION_PROOF.md

## Audit outputs

- release/audits/i18n-audit.json (1516 bytes)
- release/audits/route-audit.json (196 bytes)

## Day-1 checklist

- Confirm Supabase environment variables are production/staging correct.
- Run fresh migration verification in staging.
- Run RLS persona tests with real test accounts.
- Run OVR end-to-end test.
- Create export package and confirm restore dry-run.
- Complete Arabic/RTL visual QA for critical pages.
- Start pilot users only.
