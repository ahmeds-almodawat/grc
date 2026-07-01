# v6.4 View Security Audit

```json
{
  "generated_at": "2026-07-01T17:28:54.905Z",
  "migration_files_scanned": 82,
  "views_detected": 233,
  "findings_total": 105,
  "critical": 0,
  "high": 0,
  "medium": 105,
  "strict_passed": true,
  "note": "Static scan deduplicates views and recognizes later ALTER VIEW ... SET (security_invoker=true). Final proof still requires staging verification."
}
```

## Findings
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_accreditation_gap_dashboard` (supabase/migrations/063_patch2_accreditation_standards_engine.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_accreditation_readiness_summary` (supabase/migrations/063_patch2_accreditation_standards_engine.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_accreditation_requirement_matrix` (supabase/migrations/063_patch2_accreditation_standards_engine.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_activity_timeline` (supabase/migrations/017_notifications_activity_timelines.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_admin_safety_console` (supabase/migrations/022_ultra_release_restore_admin_dictionary.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_automation_command_summary` (supabase/migrations/024_automation_intelligence_kri_reviews.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_automation_rule_catalog` (supabase/migrations/024_automation_intelligence_kri_reviews.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_bilingual_dictionary_status` (supabase/migrations/022_ultra_release_restore_admin_dictionary.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_board_pack_summary` (supabase/migrations/023_enterprise_intelligence_reporting.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_bulk_import_batch_summary` (supabase/migrations/008_import_export_rollout_tools.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_committee_action_automation` (supabase/migrations/024_automation_intelligence_kri_reviews.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_consolidation_defect_dashboard` (supabase/migrations/025_staging_validation_consolidation.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_critical_attention_items` (supabase/migrations/005_operational_views_and_storage.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_cross_module_relationship_map` (supabase/migrations/021_command_search_documents_release.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_data_retention_readiness` (supabase/migrations/020_security_audit_retention_controls.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_delay_reason_queue` (supabase/migrations/007_escalation_and_governance_controls.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_department_execution_summary` (supabase/migrations/006_workflow_queues_and_project_controls.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_department_scorecard_v2` (supabase/migrations/023_enterprise_intelligence_reporting.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_deployment_readiness_gates` (supabase/migrations/018_qa_permission_deployment_readiness.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_document_center_items` (supabase/migrations/021_command_search_documents_release.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_document_center_summary` (supabase/migrations/021_command_search_documents_release.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_due_reminder_queue` (supabase/migrations/017_notifications_activity_timelines.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_duplicate_active_department_codes` (supabase/migrations/008_import_export_rollout_tools.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_duplicate_active_unit_codes` (supabase/migrations/008_import_export_rollout_tools.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_escalation_center` (supabase/migrations/007_escalation_and_governance_controls.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_executive_command_stream` (supabase/migrations/021_command_search_documents_release.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_executive_command_summary` (supabase/migrations/021_command_search_documents_release.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_executive_exception_dashboard` (supabase/migrations/024_automation_intelligence_kri_reviews.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_executive_grc_summary` (supabase/migrations/002_grc_layer.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_final_acceptance_tests` (supabase/migrations/026_finish_fast_release_sprint.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_final_consolidation_artifacts` (supabase/migrations/026_finish_fast_release_sprint.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_final_cutover_plan` (supabase/migrations/026_finish_fast_release_sprint.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_final_finish_fast_scorecard` (supabase/migrations/026_finish_fast_release_sprint.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_final_go_live_gateboard` (supabase/migrations/026_finish_fast_release_sprint.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_final_handover_signoffs` (supabase/migrations/028_final_release_factory.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_final_owner_clearance` (supabase/migrations/026_finish_fast_release_sprint.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_global_search_index` (supabase/migrations/021_command_search_documents_release.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_grc_kpi_scorecard` (supabase/migrations/013_kpi_analytics_heatmap_radar.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_i18n_translation_coverage` (supabase/migrations/025_staging_validation_consolidation.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_kri_breach_register` (supabase/migrations/024_automation_intelligence_kri_reviews.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_load_test_seed_status` (supabase/migrations/025_staging_validation_consolidation.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_manager_inbox` (supabase/migrations/017_notifications_activity_timelines.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_migration_runbook_status` (supabase/migrations/025_staging_validation_consolidation.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_migration_verification_matrix` (supabase/migrations/022_ultra_release_restore_admin_dictionary.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_mobile_readiness_gates` (supabase/migrations/019_performance_responsive_usability.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_module_payload_pressure` (supabase/migrations/019_performance_responsive_usability.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_monthly_grc_trend` (supabase/migrations/013_kpi_analytics_heatmap_radar.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_my_open_work` (supabase/migrations/005_operational_views_and_storage.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_my_open_work_expanded` (supabase/migrations/006_workflow_queues_and_project_controls.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_notification_digest` (supabase/migrations/017_notifications_activity_timelines.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_operational_followup_summary` (supabase/migrations/017_notifications_activity_timelines.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_permission_test_personas` (supabase/migrations/018_qa_permission_deployment_readiness.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_print_report_index` (supabase/migrations/015_production_hardening_health_print_controls.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_production_cutover_checklist` (supabase/migrations/022_ultra_release_restore_admin_dictionary.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_qa_readiness_summary` (supabase/migrations/018_qa_permission_deployment_readiness.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_qa_test_case_library` (supabase/migrations/018_qa_permission_deployment_readiness.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_qa_test_runs_summary` (supabase/migrations/018_qa_permission_deployment_readiness.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_recurring_review_queue` (supabase/migrations/024_automation_intelligence_kri_reviews.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_report_builder_catalog` (supabase/migrations/023_enterprise_intelligence_reporting.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_restore_verification_status` (supabase/migrations/025_staging_validation_consolidation.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_rls_persona_lab` (supabase/migrations/025_staging_validation_consolidation.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_rollout_data_health_summary` (supabase/migrations/008_import_export_rollout_tools.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_scenario_matrix` (supabase/migrations/023_enterprise_intelligence_reporting.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_sensitive_activity_timeline` (supabase/migrations/020_security_audit_retention_controls.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_setup_readiness_checklist` (supabase/migrations/055_rollout_onboarding_user_guides_compat.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_staging_validation_checks` (supabase/migrations/025_staging_validation_consolidation.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_staging_validation_summary` (supabase/migrations/025_staging_validation_consolidation.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_ui_performance_summary` (supabase/migrations/019_performance_responsive_usability.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_v31_go_live_scorecard` (supabase/migrations/027_final_production_leap.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_v31_module_readiness` (supabase/migrations/027_final_production_leap.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_v31_pilot_acceptance` (supabase/migrations/027_final_production_leap.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_v31_support_handover` (supabase/migrations/027_final_production_leap.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_v33_pilot_waves` (supabase/migrations/029_production_proof_consolidation.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_v33_production_artifacts` (supabase/migrations/029_production_proof_consolidation.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_v33_production_proof_gates` (supabase/migrations/029_production_proof_consolidation.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_v33_production_proof_scorecard` (supabase/migrations/029_production_proof_consolidation.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_v34_company_rollout_readiness` (supabase/migrations/030_pilot_real_data_operations.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_v34_go_live_rehearsal_readiness` (supabase/migrations/030_pilot_real_data_operations.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_v34_pilot_issue_board` (supabase/migrations/030_pilot_real_data_operations.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_v34_pilot_wave_summary` (supabase/migrations/030_pilot_real_data_operations.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_v34_real_data_import_readiness` (supabase/migrations/030_pilot_real_data_operations.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_v38_final_readiness_scorecard` (supabase/migrations/032_final_local_doctor_production_simulator.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_v42_rls_persona_matrix` (supabase/migrations/033_v42_production_validation_and_rls_lab.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_v42_rls_readiness_summary` (supabase/migrations/033_v42_production_validation_and_rls_lab.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_v42_rls_test_case_queue` (supabase/migrations/033_v42_production_validation_and_rls_lab.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_v42_supabase_install_status` (supabase/migrations/033_v42_production_validation_and_rls_lab.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_v46_language_rtl_readiness` (supabase/migrations/034_v46_ovr_bilingual_rtl_production_hardening.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_v46_production_hardening_scorecard` (supabase/migrations/034_v46_ovr_bilingual_rtl_production_hardening.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_v50_query_optimization_queue` (supabase/migrations/035_v50_scale_backup_restore.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_v50_restore_dryrun_queue` (supabase/migrations/035_v50_scale_backup_restore.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_v50_scale_readiness_scorecard` (supabase/migrations/035_v50_scale_backup_restore.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_v58_overall_production_readiness` (supabase/migrations/037_v58_pilot_rollout_security_audit.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_v58_pilot_readiness_scorecard` (supabase/migrations/037_v58_pilot_rollout_security_audit.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_v58_rollout_readiness_scorecard` (supabase/migrations/037_v58_pilot_rollout_security_audit.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_v59_latest_phase_results` (supabase/migrations/038_v59_no_mock_phased_auto_tests.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_v59_phase_test_scorecard` (supabase/migrations/038_v59_no_mock_phased_auto_tests.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_v59_production_data_readiness` (supabase/migrations/038_v59_no_mock_phased_auto_tests.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_v60_empty_state_readiness` (supabase/migrations/039_v60_no_mock_production_data_controls.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_v62_demo_boundary_scorecard` (supabase/migrations/040_v62_real_no_mock_data_layer.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_v62_real_data_layer_scorecard` (supabase/migrations/040_v62_real_no_mock_data_layer.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v_workflow_blockers` (supabase/migrations/015_production_hardening_health_print_controls.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v35_consolidation_scorecard` (supabase/migrations/031_consolidation_pilot_fix_kit.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v35_data_quality_radar` (supabase/migrations/031_consolidation_pilot_fix_kit.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v35_final_blocker_board` (supabase/migrations/031_consolidation_pilot_fix_kit.sql) — View does not show security_invoker=true in static scan.
- **medium** VIEW_WITHOUT_SECURITY_INVOKER on `v35_operator_console` (supabase/migrations/031_consolidation_pilot_fix_kit.sql) — View does not show security_invoker=true in static scan.
