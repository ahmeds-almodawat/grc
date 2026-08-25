begin;

-- P2 restores only the read contract consumed by accepted release/readiness
-- surfaces. Every source table already has RLS and an authenticated policy.
grant select on table
  public.admin_change_requests,
  public.admin_safety_locks,
  public.app_translation_dictionary,
  public.bilingual_readiness_items,
  public.document_center_items,
  public.final_go_live_controls,
  public.migration_verification_items,
  public.migration_verification_runs,
  public.module_release_readiness,
  public.policies,
  public.production_cutover_checklist,
  public.production_go_no_go_access_reviews,
  public.production_go_no_go_confidentiality_checks,
  public.production_go_no_go_cycles,
  public.production_go_no_go_decisions,
  public.production_go_no_go_launch_monitoring_checks,
  public.production_go_no_go_restore_rollback_proofs,
  public.production_go_no_go_staging_persona_runs,
  public.production_readiness_signoffs,
  public.release_candidate_gates,
  public.release_migration_order,
  public.risk_mitigation_actions,
  public.runtime_rpc_classifications
to authenticated;

alter view public.v_admin_safety_console set (security_invoker = true);
alter view public.v_bilingual_dictionary_status set (security_invoker = true);
alter view public.v_cross_module_relationship_map set (security_invoker = true);
alter view public.v_document_center_items set (security_invoker = true);
alter view public.v_document_center_summary set (security_invoker = true);
alter view public.v_executive_command_stream set (security_invoker = true);
alter view public.v_executive_command_summary set (security_invoker = true);
alter view public.v_migration_verification_matrix set (security_invoker = true);
alter view public.v_patch40_controlled_pilot_readiness_summary set (security_invoker = true);
alter view public.v_patch40_missing_translation_register set (security_invoker = true);
alter view public.v_patch40_proof_suite_readiness_summary set (security_invoker = true);
alter view public.v_patch40_runtime_rpc_signoff_dashboard set (security_invoker = true);
alter view public.v_production_cutover_checklist set (security_invoker = true);
alter view public.v_production_go_no_go_decision_queue set (security_invoker = true);
alter view public.v_production_go_no_go_evidence_queue set (security_invoker = true);
alter view public.v_production_go_no_go_monitoring_dashboard set (security_invoker = true);
alter view public.v_production_go_no_go_summary set (security_invoker = true);
alter view public.v_release_candidate_gates set (security_invoker = true);
alter view public.v_release_migration_order set (security_invoker = true);
alter view public.v_v31_final_controls set (security_invoker = true);
alter view public.v_v31_go_live_scorecard set (security_invoker = true);
alter view public.v_v31_module_readiness set (security_invoker = true);
alter view public.v_v31_pilot_acceptance set (security_invoker = true);
alter view public.v_v31_support_handover set (security_invoker = true);

revoke all on table
  public.v_admin_safety_console,
  public.v_bilingual_dictionary_status,
  public.v_cross_module_relationship_map,
  public.v_document_center_items,
  public.v_document_center_summary,
  public.v_executive_command_stream,
  public.v_executive_command_summary,
  public.v_migration_verification_matrix,
  public.v_patch40_controlled_pilot_readiness_summary,
  public.v_patch40_missing_translation_register,
  public.v_patch40_proof_suite_readiness_summary,
  public.v_patch40_runtime_rpc_signoff_dashboard,
  public.v_production_cutover_checklist,
  public.v_production_go_no_go_decision_queue,
  public.v_production_go_no_go_evidence_queue,
  public.v_production_go_no_go_monitoring_dashboard,
  public.v_production_go_no_go_summary,
  public.v_release_candidate_gates,
  public.v_release_migration_order,
  public.v_v31_final_controls,
  public.v_v31_go_live_scorecard,
  public.v_v31_module_readiness,
  public.v_v31_pilot_acceptance,
  public.v_v31_support_handover
from public, anon;

grant select on table
  public.v_admin_safety_console,
  public.v_bilingual_dictionary_status,
  public.v_cross_module_relationship_map,
  public.v_document_center_items,
  public.v_document_center_summary,
  public.v_executive_command_stream,
  public.v_executive_command_summary,
  public.v_migration_verification_matrix,
  public.v_patch40_controlled_pilot_readiness_summary,
  public.v_patch40_missing_translation_register,
  public.v_patch40_proof_suite_readiness_summary,
  public.v_patch40_runtime_rpc_signoff_dashboard,
  public.v_production_cutover_checklist,
  public.v_production_go_no_go_decision_queue,
  public.v_production_go_no_go_evidence_queue,
  public.v_production_go_no_go_monitoring_dashboard,
  public.v_production_go_no_go_summary,
  public.v_release_candidate_gates,
  public.v_release_migration_order,
  public.v_v31_final_controls,
  public.v_v31_go_live_scorecard,
  public.v_v31_module_readiness,
  public.v_v31_pilot_acceptance,
  public.v_v31_support_handover
to authenticated;

comment on view public.v_patch40_controlled_pilot_readiness_summary is
  'P2 governed release-readiness input. Empty source data means not assessable; no readiness value is fabricated.';

commit;
