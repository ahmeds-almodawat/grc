-- v6.4.1 Database security static remediation
-- Purpose: close critical/high static RLS, view, and privileged findings without adding UI features.
-- Note: deny-all fallback policies are intentionally conservative; refine in staging persona tests before production.

begin;

-- 1) Enable RLS and add conservative deny-all policies for high-risk tables missing explicit protection.

alter table if exists public.access_security_findings_v58 enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.access_security_findings_v58;
create policy "v641_deny_all_until_persona_verified" on public.access_security_findings_v58
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.audit_trail_controls_v58 enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.audit_trail_controls_v58;
create policy "v641_deny_all_until_persona_verified" on public.audit_trail_controls_v58
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.audit_trail_samples_v58 enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.audit_trail_samples_v58;
create policy "v641_deny_all_until_persona_verified" on public.audit_trail_samples_v58
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.backup_restore_verifications enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.backup_restore_verifications;
create policy "v641_deny_all_until_persona_verified" on public.backup_restore_verifications
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.backup_schedule_plans enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.backup_schedule_plans;
create policy "v641_deny_all_until_persona_verified" on public.backup_schedule_plans
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.backup_schedule_runs enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.backup_schedule_runs;
create policy "v641_deny_all_until_persona_verified" on public.backup_schedule_runs
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.consolidated_release_packages enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.consolidated_release_packages;
create policy "v641_deny_all_until_persona_verified" on public.consolidated_release_packages
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.department_kpi_targets enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.department_kpi_targets;
create policy "v641_deny_all_until_persona_verified" on public.department_kpi_targets
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.department_onboarding_status enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.department_onboarding_status;
create policy "v641_deny_all_until_persona_verified" on public.department_onboarding_status
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.department_scorecard_notes enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.department_scorecard_notes;
create policy "v641_deny_all_until_persona_verified" on public.department_scorecard_notes
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.evidence_file_versions enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.evidence_file_versions;
create policy "v641_deny_all_until_persona_verified" on public.evidence_file_versions
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.evidence_retention_reviews enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.evidence_retention_reviews;
create policy "v641_deny_all_until_persona_verified" on public.evidence_retention_reviews
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.final_go_live_controls enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.final_go_live_controls;
create policy "v641_deny_all_until_persona_verified" on public.final_go_live_controls
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.i18n_translation_audit enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.i18n_translation_audit;
create policy "v641_deny_all_until_persona_verified" on public.i18n_translation_audit
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.key_risk_indicators enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.key_risk_indicators;
create policy "v641_deny_all_until_persona_verified" on public.key_risk_indicators
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.module_release_readiness enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.module_release_readiness;
create policy "v641_deny_all_until_persona_verified" on public.module_release_readiness
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.no_mock_audit_findings enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.no_mock_audit_findings;
create policy "v641_deny_all_until_persona_verified" on public.no_mock_audit_findings
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.no_mock_audit_runs enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.no_mock_audit_runs;
create policy "v641_deny_all_until_persona_verified" on public.no_mock_audit_runs
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.ovr_production_checklist_results enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.ovr_production_checklist_results;
create policy "v641_deny_all_until_persona_verified" on public.ovr_production_checklist_results
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.ovr_production_checklist_templates enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.ovr_production_checklist_templates;
create policy "v641_deny_all_until_persona_verified" on public.ovr_production_checklist_templates
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.ovr_risk_calibration_rules enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.ovr_risk_calibration_rules;
create policy "v641_deny_all_until_persona_verified" on public.ovr_risk_calibration_rules
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.pilot_wave_departments enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.pilot_wave_departments;
create policy "v641_deny_all_until_persona_verified" on public.pilot_wave_departments
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.production_backup_strategies enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.production_backup_strategies;
create policy "v641_deny_all_until_persona_verified" on public.production_backup_strategies
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.production_data_controls enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.production_data_controls;
create policy "v641_deny_all_until_persona_verified" on public.production_data_controls
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.production_evidence_registry enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.production_evidence_registry;
create policy "v641_deny_all_until_persona_verified" on public.production_evidence_registry
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.production_release_artifacts enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.production_release_artifacts;
create policy "v641_deny_all_until_persona_verified" on public.production_release_artifacts
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.real_data_import_controls enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.real_data_import_controls;
create policy "v641_deny_all_until_persona_verified" on public.real_data_import_controls
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.release_factory_checks enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.release_factory_checks;
create policy "v641_deny_all_until_persona_verified" on public.release_factory_checks
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.risk_appetite_statements enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.risk_appetite_statements;
create policy "v641_deny_all_until_persona_verified" on public.risk_appetite_statements
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.risk_scenarios enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.risk_scenarios;
create policy "v641_deny_all_until_persona_verified" on public.risk_scenarios
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.rls_persona_scenarios enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.rls_persona_scenarios;
create policy "v641_deny_all_until_persona_verified" on public.rls_persona_scenarios
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.role_change_audit enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.role_change_audit;
create policy "v641_deny_all_until_persona_verified" on public.role_change_audit
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.security_review_checks_v58 enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.security_review_checks_v58;
create policy "v641_deny_all_until_persona_verified" on public.security_review_checks_v58
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.v50_backup_runs enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.v50_backup_runs;
create policy "v641_deny_all_until_persona_verified" on public.v50_backup_runs
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.v50_backup_strategy_items enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.v50_backup_strategy_items;
create policy "v641_deny_all_until_persona_verified" on public.v50_backup_strategy_items
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.v50_restore_dryrun_jobs enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.v50_restore_dryrun_jobs;
create policy "v641_deny_all_until_persona_verified" on public.v50_restore_dryrun_jobs
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.v50_restore_dryrun_steps enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.v50_restore_dryrun_steps;
create policy "v641_deny_all_until_persona_verified" on public.v50_restore_dryrun_steps
  for all to authenticated
  using (false)
  with check (false);

-- 2) Mark sensitive views as security_invoker where Postgres supports the option.

alter view if exists public.v_access_control_matrix set (security_invoker = true);
alter view if exists public.v_access_control_summary set (security_invoker = true);
alter view if exists public.v_access_control_warnings set (security_invoker = true);
alter view if exists public.v_backup_health_check set (security_invoker = true);
alter view if exists public.v_backup_restore_drillboard set (security_invoker = true);
alter view if exists public.v_backup_schedule_readiness set (security_invoker = true);
alter view if exists public.v_consolidated_release_packages set (security_invoker = true);
alter view if exists public.v_department_risk_heatmap set (security_invoker = true);
alter view if exists public.v_duplicate_profile_emails set (security_invoker = true);
alter view if exists public.v_evidence_review_queue set (security_invoker = true);
alter view if exists public.v_evidence_vault_inventory set (security_invoker = true);
alter view if exists public.v_export_center_summary set (security_invoker = true);
alter view if exists public.v_export_dataset_catalog set (security_invoker = true);
alter view if exists public.v_management_control_summary set (security_invoker = true);
alter view if exists public.v_ovr_quality_queue set (security_invoker = true);
alter view if exists public.v_ovr_repeated_category_alerts set (security_invoker = true);
alter view if exists public.v_ovr_risk_attention_items set (security_invoker = true);
alter view if exists public.v_ovr_risk_indicator_feed set (security_invoker = true);
alter view if exists public.v_ovr_risk_indicator_summary set (security_invoker = true);
alter view if exists public.v_ovr_risk_indicators_by_department set (security_invoker = true);
alter view if exists public.v_ovr_summary set (security_invoker = true);
alter view if exists public.v_ovr_workflow_control_summary set (security_invoker = true);
alter view if exists public.v_ovr_workflow_queue set (security_invoker = true);
alter view if exists public.v_pending_approvals_expanded set (security_invoker = true);
alter view if exists public.v_production_backup_strategy_status set (security_invoker = true);
alter view if exists public.v_radar_control_profile set (security_invoker = true);
alter view if exists public.v_release_candidate_gates set (security_invoker = true);
alter view if exists public.v_release_factory_checks set (security_invoker = true);
alter view if exists public.v_release_factory_scorecard set (security_invoker = true);
alter view if exists public.v_release_migration_order set (security_invoker = true);
alter view if exists public.v_risk_appetite_dashboard set (security_invoker = true);
alter view if exists public.v_security_access_findings set (security_invoker = true);
alter view if exists public.v_security_governance_summary set (security_invoker = true);
alter view if exists public.v_ultra_release_summary set (security_invoker = true);
alter view if exists public.v_v31_final_controls set (security_invoker = true);
alter view if exists public.v_v42_release_candidate_scorecard set (security_invoker = true);
alter view if exists public.v_v46_ovr_production_queue set (security_invoker = true);
alter view if exists public.v_v46_ovr_risk_calibration set (security_invoker = true);
alter view if exists public.v_v50_backup_restore_scorecard set (security_invoker = true);
alter view if exists public.v_v58_audit_trail_scorecard set (security_invoker = true);
alter view if exists public.v_v58_security_review_scorecard set (security_invoker = true);
alter view if exists public.v_v59_mock_data_findings_summary set (security_invoker = true);
alter view if exists public.v_v60_latest_no_mock_audit set (security_invoker = true);
alter view if exists public.v_v60_no_mock_control_scorecard set (security_invoker = true);

-- 3) Add fixed search_path and revoke broad public execution for high-risk privileged functions.

alter function public.create_system_health_snapshot(uuid, uuid) set search_path = public, pg_temp;
revoke all on function public.create_system_health_snapshot(uuid, uuid) from public;
alter function public.seed_release_factory_defaults() set search_path = public, pg_temp;
revoke all on function public.seed_release_factory_defaults() from public;
alter function public.seed_v31_finish_fast_defaults() set search_path = public, pg_temp;
revoke all on function public.seed_v31_finish_fast_defaults() from public;
alter function public.seed_v33_production_proof_defaults() set search_path = public, pg_temp;
revoke all on function public.seed_v33_production_proof_defaults() from public;
alter function public.seed_v34_pilot_defaults() set search_path = public, pg_temp;
revoke all on function public.seed_v34_pilot_defaults() from public;

commit;
