# v6.4 RLS Static Audit

```json
{
  "generated_at": "2026-07-01T13:07:54.113Z",
  "migration_files_scanned": 82,
  "created_tables_detected": 461,
  "tables_with_explicit_rls": 401,
  "tables_with_detected_policies": 369,
  "findings_total": 60,
  "critical": 0,
  "high": 0,
  "medium": 60,
  "strict_passed": true,
  "note": "Static audit only. Final proof requires applying migrations to staging and running supabase/tests/v64_persona_security_tests.sql."
}
```

## Findings

- **medium** RLS_NOT_ENABLED on `automation_rules` (supabase/migrations/024_automation_intelligence_kri_reviews.sql) — Table is created in migrations but no explicit ALTER TABLE ... ENABLE ROW LEVEL SECURITY was found.
- **medium** RLS_NOT_ENABLED on `automation_run_log` (supabase/migrations/024_automation_intelligence_kri_reviews.sql) — Table is created in migrations but no explicit ALTER TABLE ... ENABLE ROW LEVEL SECURITY was found.
- **medium** RLS_NOT_ENABLED on `company_rollout_waves` (supabase/migrations/037_v58_pilot_rollout_security_audit.sql) — Table is created in migrations but no explicit ALTER TABLE ... ENABLE ROW LEVEL SECURITY was found.
- **medium** RLS_NOT_ENABLED on `consolidation_defect_log` (supabase/migrations/025_staging_validation_consolidation.sql) — Table is created in migrations but no explicit ALTER TABLE ... ENABLE ROW LEVEL SECURITY was found.
- **medium** RLS_NOT_ENABLED on `consolidation_defects` (supabase/migrations/031_consolidation_pilot_fix_kit.sql) — Table is created in migrations but no explicit ALTER TABLE ... ENABLE ROW LEVEL SECURITY was found.
- **medium** RLS_NOT_ENABLED on `consolidation_patch_manifest` (supabase/migrations/031_consolidation_pilot_fix_kit.sql) — Table is created in migrations but no explicit ALTER TABLE ... ENABLE ROW LEVEL SECURITY was found.
- **medium** RLS_NOT_ENABLED on `cutover_freeze_windows` (supabase/migrations/031_consolidation_pilot_fix_kit.sql) — Table is created in migrations but no explicit ALTER TABLE ... ENABLE ROW LEVEL SECURITY was found.
- **medium** RLS_NOT_ENABLED on `executive_exception_rules` (supabase/migrations/024_automation_intelligence_kri_reviews.sql) — Table is created in migrations but no explicit ALTER TABLE ... ENABLE ROW LEVEL SECURITY was found.
- **medium** RLS_NOT_ENABLED on `final_go_live_stop_rules` (supabase/migrations/032_final_local_doctor_production_simulator.sql) — Table is created in migrations but no explicit ALTER TABLE ... ENABLE ROW LEVEL SECURITY was found.
- **medium** RLS_NOT_ENABLED on `final_handover_signoffs` (supabase/migrations/028_final_release_factory.sql) — Table is created in migrations but no explicit ALTER TABLE ... ENABLE ROW LEVEL SECURITY was found.
- **medium** RLS_NOT_ENABLED on `final_pilot_signoff_matrix` (supabase/migrations/032_final_local_doctor_production_simulator.sql) — Table is created in migrations but no explicit ALTER TABLE ... ENABLE ROW LEVEL SECURITY was found.
- **medium** RLS_NOT_ENABLED on `final_validation_runs` (supabase/migrations/032_final_local_doctor_production_simulator.sql) — Table is created in migrations but no explicit ALTER TABLE ... ENABLE ROW LEVEL SECURITY was found.
- **medium** RLS_NOT_ENABLED on `go_live_rehearsals` (supabase/migrations/030_pilot_real_data_operations.sql) — Table is created in migrations but no explicit ALTER TABLE ... ENABLE ROW LEVEL SECURITY was found.
- **medium** RLS_NOT_ENABLED on `go_live_sop_steps` (supabase/migrations/031_consolidation_pilot_fix_kit.sql) — Table is created in migrations but no explicit ALTER TABLE ... ENABLE ROW LEVEL SECURITY was found.
- **medium** RLS_NOT_ENABLED on `i18n_translation_coverage_items` (supabase/migrations/034_v46_ovr_bilingual_rtl_production_hardening.sql) — Table is created in migrations but no explicit ALTER TABLE ... ENABLE ROW LEVEL SECURITY was found.
- **medium** RLS_NOT_ENABLED on `kri_observations` (supabase/migrations/024_automation_intelligence_kri_reviews.sql) — Table is created in migrations but no explicit ALTER TABLE ... ENABLE ROW LEVEL SECURITY was found.
- **medium** RLS_NOT_ENABLED on `load_test_seed_batches` (supabase/migrations/025_staging_validation_consolidation.sql) — Table is created in migrations but no explicit ALTER TABLE ... ENABLE ROW LEVEL SECURITY was found.
- **medium** RLS_NOT_ENABLED on `migration_runbook_entries` (supabase/migrations/025_staging_validation_consolidation.sql) — Table is created in migrations but no explicit ALTER TABLE ... ENABLE ROW LEVEL SECURITY was found.
- **medium** RLS_NOT_ENABLED on `mock_data_allowlist` (supabase/migrations/038_v59_no_mock_phased_auto_tests.sql) — Table is created in migrations but no explicit ALTER TABLE ... ENABLE ROW LEVEL SECURITY was found.
- **medium** RLS_NOT_ENABLED on `phased_auto_test_cases` (supabase/migrations/038_v59_no_mock_phased_auto_tests.sql) — Table is created in migrations but no explicit ALTER TABLE ... ENABLE ROW LEVEL SECURITY was found.
- **medium** RLS_NOT_ENABLED on `phased_auto_test_phases` (supabase/migrations/038_v59_no_mock_phased_auto_tests.sql) — Table is created in migrations but no explicit ALTER TABLE ... ENABLE ROW LEVEL SECURITY was found.
- **medium** RLS_NOT_ENABLED on `phased_auto_test_results` (supabase/migrations/038_v59_no_mock_phased_auto_tests.sql) — Table is created in migrations but no explicit ALTER TABLE ... ENABLE ROW LEVEL SECURITY was found.
- **medium** RLS_NOT_ENABLED on `phased_auto_test_runs` (supabase/migrations/038_v59_no_mock_phased_auto_tests.sql) — Table is created in migrations but no explicit ALTER TABLE ... ENABLE ROW LEVEL SECURITY was found.
- **medium** RLS_NOT_ENABLED on `pilot_execution_runs` (supabase/migrations/037_v58_pilot_rollout_security_audit.sql) — Table is created in migrations but no explicit ALTER TABLE ... ENABLE ROW LEVEL SECURITY was found.
- **medium** RLS_NOT_ENABLED on `pilot_feedback_items` (supabase/migrations/037_v58_pilot_rollout_security_audit.sql) — Table is created in migrations but no explicit ALTER TABLE ... ENABLE ROW LEVEL SECURITY was found.
- **medium** RLS_NOT_ENABLED on `pilot_fix_sprint_items` (supabase/migrations/031_consolidation_pilot_fix_kit.sql) — Table is created in migrations but no explicit ALTER TABLE ... ENABLE ROW LEVEL SECURITY was found.
- **medium** RLS_NOT_ENABLED on `pilot_fix_sprints` (supabase/migrations/031_consolidation_pilot_fix_kit.sql) — Table is created in migrations but no explicit ALTER TABLE ... ENABLE ROW LEVEL SECURITY was found.
- **medium** RLS_NOT_ENABLED on `pilot_issues` (supabase/migrations/030_pilot_real_data_operations.sql) — Table is created in migrations but no explicit ALTER TABLE ... ENABLE ROW LEVEL SECURITY was found.
- **medium** RLS_NOT_ENABLED on `pilot_participants` (supabase/migrations/030_pilot_real_data_operations.sql) — Table is created in migrations but no explicit ALTER TABLE ... ENABLE ROW LEVEL SECURITY was found.
- **medium** RLS_NOT_ENABLED on `pilot_rollout_acceptance` (supabase/migrations/027_final_production_leap.sql) — Table is created in migrations but no explicit ALTER TABLE ... ENABLE ROW LEVEL SECURITY was found.
- **medium** RLS_NOT_ENABLED on `pilot_signoffs` (supabase/migrations/030_pilot_real_data_operations.sql) — Table is created in migrations but no explicit ALTER TABLE ... ENABLE ROW LEVEL SECURITY was found.
- **medium** RLS_NOT_ENABLED on `pilot_waves` (supabase/migrations/030_pilot_real_data_operations.sql) — Table is created in migrations but no explicit ALTER TABLE ... ENABLE ROW LEVEL SECURITY was found.
- **medium** RLS_NOT_ENABLED on `production_data_switchovers` (supabase/migrations/038_v59_no_mock_phased_auto_tests.sql) — Table is created in migrations but no explicit ALTER TABLE ... ENABLE ROW LEVEL SECURITY was found.
- **medium** RLS_NOT_ENABLED on `production_empty_state_checks` (supabase/migrations/039_v60_no_mock_production_data_controls.sql) — Table is created in migrations but no explicit ALTER TABLE ... ENABLE ROW LEVEL SECURITY was found.
- **medium** RLS_NOT_ENABLED on `production_exception_register_v58` (supabase/migrations/037_v58_pilot_rollout_security_audit.sql) — Table is created in migrations but no explicit ALTER TABLE ... ENABLE ROW LEVEL SECURITY was found.
- **medium** RLS_NOT_ENABLED on `production_operator_daily_log` (supabase/migrations/031_consolidation_pilot_fix_kit.sql) — Table is created in migrations but no explicit ALTER TABLE ... ENABLE ROW LEVEL SECURITY was found.
- **medium** RLS_NOT_ENABLED on `production_pilot_waves` (supabase/migrations/029_production_proof_consolidation.sql) — Table is created in migrations but no explicit ALTER TABLE ... ENABLE ROW LEVEL SECURITY was found.
- **medium** RLS_NOT_ENABLED on `production_proof_gates` (supabase/migrations/029_production_proof_consolidation.sql) — Table is created in migrations but no explicit ALTER TABLE ... ENABLE ROW LEVEL SECURITY was found.
- **medium** RLS_NOT_ENABLED on `production_support_handover` (supabase/migrations/027_final_production_leap.sql) — Table is created in migrations but no explicit ALTER TABLE ... ENABLE ROW LEVEL SECURITY was found.
- **medium** RLS_NOT_ENABLED on `real_data_repair_queue` (supabase/migrations/031_consolidation_pilot_fix_kit.sql) — Table is created in migrations but no explicit ALTER TABLE ... ENABLE ROW LEVEL SECURITY was found.
- **medium** RLS_NOT_ENABLED on `recurring_reviews` (supabase/migrations/024_automation_intelligence_kri_reviews.sql) — Table is created in migrations but no explicit ALTER TABLE ... ENABLE ROW LEVEL SECURITY was found.
- **medium** RLS_NOT_ENABLED on `rtl_visual_qa_items` (supabase/migrations/034_v46_ovr_bilingual_rtl_production_hardening.sql) — Table is created in migrations but no explicit ALTER TABLE ... ENABLE ROW LEVEL SECURITY was found.
- **medium** RLS_NOT_ENABLED on `staging_validation_check_results` (supabase/migrations/025_staging_validation_consolidation.sql) — Table is created in migrations but no explicit ALTER TABLE ... ENABLE ROW LEVEL SECURITY was found.
- **medium** RLS_NOT_ENABLED on `staging_validation_cycles` (supabase/migrations/025_staging_validation_consolidation.sql) — Table is created in migrations but no explicit ALTER TABLE ... ENABLE ROW LEVEL SECURITY was found.
- **medium** RLS_NOT_ENABLED on `v120_action_decision_log` (supabase/migrations/054_v120_operational_polish_data_quality_suite.sql) — Table is created in migrations but no explicit ALTER TABLE ... ENABLE ROW LEVEL SECURITY was found.
- **medium** RLS_NOT_ENABLED on `v120_adoption_metrics` (supabase/migrations/054_v120_operational_polish_data_quality_suite.sql) — Table is created in migrations but no explicit ALTER TABLE ... ENABLE ROW LEVEL SECURITY was found.
- **medium** RLS_NOT_ENABLED on `v120_dashboard_tiles` (supabase/migrations/054_v120_operational_polish_data_quality_suite.sql) — Table is created in migrations but no explicit ALTER TABLE ... ENABLE ROW LEVEL SECURITY was found.
- **medium** RLS_NOT_ENABLED on `v120_data_quality_rules` (supabase/migrations/054_v120_operational_polish_data_quality_suite.sql) — Table is created in migrations but no explicit ALTER TABLE ... ENABLE ROW LEVEL SECURITY was found.
- **medium** RLS_NOT_ENABLED on `v120_executive_narratives` (supabase/migrations/054_v120_operational_polish_data_quality_suite.sql) — Table is created in migrations but no explicit ALTER TABLE ... ENABLE ROW LEVEL SECURITY was found.
- **medium** RLS_NOT_ENABLED on `v120_glossary_terms` (supabase/migrations/054_v120_operational_polish_data_quality_suite.sql) — Table is created in migrations but no explicit ALTER TABLE ... ENABLE ROW LEVEL SECURITY was found.
- **medium** RLS_NOT_ENABLED on `v120_help_articles` (supabase/migrations/054_v120_operational_polish_data_quality_suite.sql) — Table is created in migrations but no explicit ALTER TABLE ... ENABLE ROW LEVEL SECURITY was found.
- **medium** RLS_NOT_ENABLED on `v120_polish_backlog` (supabase/migrations/054_v120_operational_polish_data_quality_suite.sql) — Table is created in migrations but no explicit ALTER TABLE ... ENABLE ROW LEVEL SECURITY was found.
- **medium** RLS_NOT_ENABLED on `v120_program_workspaces` (supabase/migrations/054_v120_operational_polish_data_quality_suite.sql) — Table is created in migrations but no explicit ALTER TABLE ... ENABLE ROW LEVEL SECURITY was found.
- **medium** RLS_NOT_ENABLED on `v120_saved_views` (supabase/migrations/054_v120_operational_polish_data_quality_suite.sql) — Table is created in migrations but no explicit ALTER TABLE ... ENABLE ROW LEVEL SECURITY was found.
- **medium** RLS_NOT_ENABLED on `v120_workflow_sla_events` (supabase/migrations/054_v120_operational_polish_data_quality_suite.sql) — Table is created in migrations but no explicit ALTER TABLE ... ENABLE ROW LEVEL SECURITY was found.
- **medium** RLS_NOT_ENABLED on `v120_workflow_sla_policies` (supabase/migrations/054_v120_operational_polish_data_quality_suite.sql) — Table is created in migrations but no explicit ALTER TABLE ... ENABLE ROW LEVEL SECURITY was found.
- **medium** RLS_NOT_ENABLED on `v120_workspace_modules` (supabase/migrations/054_v120_operational_polish_data_quality_suite.sql) — Table is created in migrations but no explicit ALTER TABLE ... ENABLE ROW LEVEL SECURITY was found.
- **medium** RLS_NOT_ENABLED on `v50_query_optimization_items` (supabase/migrations/035_v50_scale_backup_restore.sql) — Table is created in migrations but no explicit ALTER TABLE ... ENABLE ROW LEVEL SECURITY was found.
- **medium** RLS_NOT_ENABLED on `v50_scale_test_plans` (supabase/migrations/035_v50_scale_backup_restore.sql) — Table is created in migrations but no explicit ALTER TABLE ... ENABLE ROW LEVEL SECURITY was found.
- **medium** RLS_NOT_ENABLED on `v50_scale_test_results` (supabase/migrations/035_v50_scale_backup_restore.sql) — Table is created in migrations but no explicit ALTER TABLE ... ENABLE ROW LEVEL SECURITY was found.
