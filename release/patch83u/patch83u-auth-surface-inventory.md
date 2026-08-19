# Patch 83U authenticated browser surface inventory

Status: **PASS**

This is a deterministic static replay of the ordered migration chain through reviewed migration 208 plus actual browser call sites. It is not live-catalog proof and does not claim any hosted catalog state.

## Summary

- Direct browser RPCs: 0
- Direct browser views: 357
- Direct browser materialized views: 0
- Unsafe surfaces: 0
- Search transport: authenticated_edge_bridge
- Reviewed restricted migration 176–208 SECURITY DEFINER routines: 97
- Target credential-gate migration present: yes

## search_grc_global

Disposition: **authenticated_edge_bridge_with_caller_jwt_rls**. The accepted design is the authenticated Edge bridge using an anon-key Supabase client carrying the caller Bearer token; the RPC remains SECURITY INVOKER and its complete view/base-table chain must remain security-invoker and credential-gated by RLS.

## ACL-reachable SECURITY DEFINER routines

The retained live Patch 83Q inventory permits exactly two documented read-only helpers. Target migrations 171–208 permit exactly three Patch 83U RLS decision helpers. Every SECURITY DEFINER routine introduced, replaced, or renamed by migrations 176–208 must contain its own explicit revoke from PUBLIC/anon/authenticated plus either an explicit service_role-only grant or an explicit owner-only service_role revoke; migration 174's earlier dynamic revoke is not accepted as evidence for later migrations. Migration 209 and later fail closed until separately reviewed.

| Signature | Evidence source | PUBLIC | anon | authenticated | Disposition | Purpose |
|---|---|---:|---:|---:|---|---|
| `public.current_user_org_id()` | retained_patch83q_live_catalog | no | no | yes | allowed | Read-only caller organization identity helper retained by Patch 83Q. |
| `public.has_any_role(text[])` | retained_patch83q_live_catalog | yes | yes | yes | allowed | Read-only RLS role decision helper retained by Patch 83Q. |
| `public.f1r2_create_work_item(p_actor_id uuid,p_item_type text,p_payload jsonb)` | migration197_service_role_acl_review | no | no | no | allowed |  |
| `public.patch83u_credential_access_allowed()` | target_migrations_171_208 | no | no | yes | allowed | Credential version, state, email, and session freshness decision used by restrictive RLS. |
| `public.patch83u_profile_update_allowed(p_target_user_id uuid, p_target_organization_id uuid)` | target_migrations_171_208 | no | no | yes | allowed | Same-organization credential-active profile update decision used by restrictive RLS. |
| `public.patch83u_user_role_mutation_allowed(p_target_user_id uuid, p_role public.app_role, p_scope public.access_scope, p_role_organization_id uuid, p_division_id uuid, p_department_id uuid, p_unit_id uuid)` | target_migrations_171_208 | no | no | yes | allowed | Credential-active canonical role/scope mutation decision used by restrictive RLS. |

### Reviewed restricted routines from migrations 176–208

These routines are not reachable by browser roles. They are listed explicitly so every reviewed definition and its migration-local ACL proof remain visible.

| Signature | Evidence source | service_role | Disposition | Definition evidence |
|---|---|---:|---|---|
| `public.acc_v13_authorize_evidence_access(p_actor_id uuid,p_evidence_file_id uuid,p_intent text default 'view')` | migration196_service_role_acl_review | yes | service_role_only | `supabase/migrations/196_f1r2_business_cycle_remediation.sql:1830` |
| `public.acc_v13_update_work_item_status(p_actor_id uuid,p_item_type text,p_item_id uuid,p_status text,p_progress_percent numeric,p_delay_reason text default null)` | migration196_service_role_acl_review | yes | service_role_only | `supabase/migrations/196_f1r2_business_cycle_remediation.sql:1034` |
| `public.activate_governed_document_version(p_actor_id uuid, p_version_id uuid, p_effective_date date default current_date)` | migration202_service_role_acl_review | yes | service_role_only | `supabase/migrations/202_governed_policy_sop_lifecycle_foundation.sql:1146` |
| `public.can_close_ovr(p_ovr_report_id uuid)` | migration196_service_role_acl_review | no | owner_only | `supabase/migrations/196_f1r2_business_cycle_remediation.sql:1769` |
| `public.cancel_training_assignment_with_reason(p_assignment_id uuid, p_reason text, p_actor_id uuid)` | migration208_service_role_acl_review | yes | service_role_only | `supabase/migrations/208_e2b2_training_authorization_and_compliance_contract_remediation.sql:856` |
| `public.complete_governed_document_review(p_actor_id uuid, p_trigger_id uuid, p_outcome text, p_outcome_note text)` | migration202_service_role_acl_review | yes | service_role_only | `supabase/migrations/202_governed_policy_sop_lifecycle_foundation.sql:1322` |
| `public.complete_training_assignment(p_assignment_id uuid, p_actor_id uuid, p_completion_evidence_id uuid default null)` | migration208_service_role_acl_review | yes | service_role_only | `supabase/migrations/208_e2b2_training_authorization_and_compliance_contract_remediation.sql:442` |
| `public.complete_training_assignment(p_assignment_id uuid, p_evidence_id uuid, p_actor_id uuid)` | migration205_service_role_acl_review | yes | service_role_only | `supabase/migrations/205_governed_sop_training_and_competency_lifecycle.sql:1053` |
| `public.configure_approval_authority_rule_stages(p_actor_id uuid, p_authority_rule_id uuid, p_stages jsonb)` | migration206_service_role_acl_review | yes | service_role_only | `supabase/migrations/206_governed_sop_template_alignment_and_raci.sql:418` |
| `public.create_governed_policy_draft(p_actor_id uuid, p_organization_id uuid, p_title_en text, p_title_ar text, p_purpose_en text, p_purpose_ar text, p_policy_statement_en text, p_policy_statement_ar text, p_scope_en text default null, p_scope_ar text default null, p_principles_en text default null, p_principles_ar text default null, p_exceptions_summary_en text default null, p_exceptions_summary_ar text default null, p_non_compliance_escalation_en text default null, p_non_compliance_escalation_ar text default null, p_department_id uuid default null, p_criticality_level text default 'medium', p_confidentiality_level text default 'internal', p_content_mode text default 'structured', p_requirements jsonb default '[]'::jsonb, p_department_scopes uuid[] default '{}'::uuid[], p_role_scopes jsonb default '[]'::jsonb)` | migration202_service_role_acl_review | yes | service_role_only | `supabase/migrations/202_governed_policy_sop_lifecycle_foundation.sql:169` |
| `public.create_governed_sop_draft(p_actor_id uuid, p_organization_id uuid, p_title_en text, p_title_ar text default null, p_process_name_en text default null, p_process_name_ar text default null, p_purpose_en text default null, p_purpose_ar text default null, p_process_owner_id uuid default null, p_primary_policy_version_id uuid default null, p_governance_link_state text default null, p_scope_en text default null, p_scope_ar text default null, p_department_id uuid default null, p_criticality_level text default 'medium', p_confidentiality_level text default 'internal', p_training_required boolean default false, p_acknowledgment_required boolean default false, p_competency_assessment_required boolean default false, p_acknowledgment_sla_days integer default 30, p_training_renewal_months integer default 12, p_content_mode text default 'structured', p_procedure_sections jsonb default '[]'::jsonb, p_procedure_steps jsonb default '[]'::jsonb, p_department_scopes uuid[] default '{}'::uuid[], p_role_scopes jsonb default '[]'::jsonb, p_definitions jsonb default '[]'::jsonb, p_role_responsibilities jsonb default '[]'::jsonb, p_monitoring_kpis jsonb default '[]'::jsonb, p_risk_links jsonb default '[]'::jsonb, p_accreditation_links jsonb default '[]'::jsonb, p_version_links jsonb default '[]'::jsonb)` | migration206_service_role_acl_review | yes | service_role_only | `supabase/migrations/206_governed_sop_template_alignment_and_raci.sql:1753` |
| `public.create_governed_sop_draft(p_actor_id uuid, p_organization_id uuid, p_title_en text, p_title_ar text, p_process_name_en text, p_process_name_ar text, p_purpose_en text, p_purpose_ar text, p_process_owner_id uuid, p_primary_policy_version_id uuid default null, p_governance_link_state text default 'linked', p_scope_en text default null, p_scope_ar text default null, p_department_id uuid default null, p_criticality_level text default 'medium', p_confidentiality_level text default 'internal', p_training_required boolean default false, p_acknowledgment_required boolean default false, p_competency_assessment_required boolean default false, p_acknowledgment_sla_days integer default 30, p_training_renewal_months integer default 12, p_content_mode text default 'structured', p_procedure_steps jsonb default '[]'::jsonb, p_department_scopes uuid[] default '{}'::uuid[], p_role_scopes jsonb default '[]'::jsonb, p_definitions jsonb default '[]'::jsonb, p_role_responsibilities jsonb default '[]'::jsonb, p_monitoring_kpis jsonb default '[]'::jsonb)` | migration203_service_role_acl_review | yes | service_role_only | `supabase/migrations/203_governed_sop_structured_content_expansion.sql:289` |
| `public.create_governed_sop_draft(p_actor_id uuid, p_organization_id uuid, p_title_en text, p_title_ar text, p_process_name_en text, p_process_name_ar text, p_purpose_en text, p_purpose_ar text, p_process_owner_id uuid, p_primary_policy_version_id uuid default null, p_governance_link_state text default 'linked', p_scope_en text default null, p_scope_ar text default null, p_department_id uuid default null, p_criticality_level text default 'medium', p_confidentiality_level text default 'internal', p_training_required boolean default false, p_acknowledgment_required boolean default false, p_competency_assessment_required boolean default false, p_acknowledgment_sla_days integer default 30, p_training_renewal_months integer default 12, p_content_mode text default 'structured', p_procedure_steps jsonb default '[]'::jsonb, p_department_scopes uuid[] default '{}'::uuid[], p_role_scopes jsonb default '[]'::jsonb)` | migration202_service_role_acl_review | yes | service_role_only | `supabase/migrations/202_governed_policy_sop_lifecycle_foundation.sql:322` |
| `public.decide_policy_sop_exception(p_actor_id uuid, p_exception_id uuid, p_decision text, p_decision_note text default null)` | migration202_service_role_acl_review | yes | service_role_only | `supabase/migrations/202_governed_policy_sop_lifecycle_foundation.sql:1456` |
| `public.decide_sop_rollout_requirements(p_actor_id uuid, p_version_id uuid, p_retraining_required boolean, p_reacknowledgment_required boolean, p_competency_reassessment_required boolean, p_rationale text)` | migration205_service_role_acl_review | yes | service_role_only | `supabase/migrations/205_governed_sop_training_and_competency_lifecycle.sql:280` |
| `public.enforce_policy_sop_version_immutability()` | migration206_service_role_acl_review | no | owner_only | `supabase/migrations/206_governed_sop_template_alignment_and_raci.sql:356` |
| `public.f1r2_active_actor(p_actor_id uuid)` | migration196_service_role_acl_review | yes | service_role_only | `supabase/migrations/196_f1r2_business_cycle_remediation.sql:77` |
| `public.f1r2_actor_can_manage_item(p_actor_id uuid,p_item_type text,p_item_id uuid)` | migration196_service_role_acl_review | yes | service_role_only | `supabase/migrations/196_f1r2_business_cycle_remediation.sql:135` |
| `public.f1r2_actor_has_ovr_evidence_entitlement(p_actor_id uuid,p_ovr_report_id uuid)` | migration196_service_role_acl_review | no | owner_only | `supabase/migrations/196_f1r2_business_cycle_remediation.sql:1721` |
| `public.f1r2_actor_has_work_evidence_entitlement(p_actor_id uuid,p_item_type text,p_item_id uuid)` | migration196_service_role_acl_review | no | owner_only | `supabase/migrations/196_f1r2_business_cycle_remediation.sql:1686` |
| `public.f1r2_actor_scope_allows_context(p_actor_id uuid, p_organization_id uuid, p_division_id uuid, p_department_id uuid, p_unit_id uuid, p_allowed_roles text[])` | migration196_service_role_acl_review | no | owner_only | `supabase/migrations/196_f1r2_business_cycle_remediation.sql:203` |
| `public.f1r2_assign_work_item(p_actor_id uuid,p_item_type text,p_item_id uuid,p_assignee_id uuid,p_reason text default null)` | migration196_service_role_acl_review | yes | service_role_only | `supabase/migrations/196_f1r2_business_cycle_remediation.sql:304` |
| `public.f1r2_assignment_candidate_is_eligible(p_candidate_id uuid, p_organization_id uuid, p_division_id uuid, p_department_id uuid, p_unit_id uuid, p_assignment_purpose text)` | migration196_service_role_acl_review | no | owner_only | `supabase/migrations/196_f1r2_business_cycle_remediation.sql:233` |
| `public.f1r2_can_close_work_item(p_item_type text,p_item_id uuid)` | migration196_service_role_acl_review | no | owner_only | `supabase/migrations/196_f1r2_business_cycle_remediation.sql:997` |
| `public.f1r2_cancel_work_item_assignment(p_actor_id uuid,p_assignment_id uuid,p_reason text)` | migration196_service_role_acl_review | yes | service_role_only | `supabase/migrations/196_f1r2_business_cycle_remediation.sql:436` |
| `public.f1r2_create_corrective_project(p_actor_id uuid,p_payload jsonb)` | migration196_service_role_acl_review | yes | service_role_only | `supabase/migrations/196_f1r2_business_cycle_remediation.sql:820` |
| `public.f1r2_create_ovr_report(p_actor_id uuid,p_payload jsonb)` | migration196_service_role_acl_review | yes | service_role_only | `supabase/migrations/196_f1r2_business_cycle_remediation.sql:784` |
| `public.f1r2_create_work_item(p_actor_id uuid,p_item_type text,p_payload jsonb)` | migration197_service_role_acl_review | yes | service_role_only | `supabase/migrations/197_f4_milestone_date_persistence_guard.sql:3` |
| `public.f1r2_current_assignment(p_item_type text,p_item_id uuid)` | migration196_service_role_acl_review | yes | service_role_only | `supabase/migrations/196_f1r2_business_cycle_remediation.sql:122` |
| `public.f1r2_decide_approval(p_actor_id uuid,p_approval_id uuid,p_decision text,p_note text default null)` | migration196_service_role_acl_review | yes | service_role_only | `supabase/migrations/196_f1r2_business_cycle_remediation.sql:1207` |
| `public.f1r2_enforce_project_closure()` | migration196_service_role_acl_review | no | owner_only | `supabase/migrations/196_f1r2_business_cycle_remediation.sql:920` |
| `public.f1r2_evidence_requirement_flags(p_organization_id uuid,p_item_type text,p_item_id uuid)` | migration196_service_role_acl_review | no | owner_only | `supabase/migrations/196_f1r2_business_cycle_remediation.sql:1234` |
| `public.f1r2_finalize_corrective_ovr(p_actor_id uuid,p_ovr_report_id uuid,p_final_verdict text,p_final_severity public.ovr_severity_level,p_closure_comment text,p_idempotency_key text)` | migration196_service_role_acl_review | yes | service_role_only | `supabase/migrations/196_f1r2_business_cycle_remediation.sql:1802` |
| `public.f1r2_get_evidence_pack(p_actor_id uuid,p_item_type text,p_item_id uuid)` | migration196_service_role_acl_review | yes | service_role_only | `supabase/migrations/196_f1r2_business_cycle_remediation.sql:1740` |
| `public.f1r2_guard_corrective_ovr_final_verdict()` | migration196_service_role_acl_review | no | owner_only | `supabase/migrations/196_f1r2_business_cycle_remediation.sql:1780` |
| `public.f1r2_guard_evidence_parent_change()` | migration196_service_role_acl_review | no | owner_only | `supabase/migrations/196_f1r2_business_cycle_remediation.sql:1331` |
| `public.f1r2_item_evidence_satisfied(p_organization_id uuid,p_item_type text,p_item_id uuid,p_evidence_required boolean)` | migration196_service_role_acl_review | no | owner_only | `supabase/migrations/196_f1r2_business_cycle_remediation.sql:964` |
| `public.f1r2_latest_approval_satisfied(p_item_type text,p_item_id uuid,p_required boolean)` | migration196_service_role_acl_review | no | owner_only | `supabase/migrations/196_f1r2_business_cycle_remediation.sql:934` |
| `public.f1r2_list_item_participants(p_actor_id uuid,p_item_type text,p_item_id uuid)` | migration196_service_role_acl_review | yes | service_role_only | `supabase/migrations/196_f1r2_business_cycle_remediation.sql:504` |
| `public.f1r2_list_my_work(p_actor_id uuid)` | migration196_service_role_acl_review | yes | service_role_only | `supabase/migrations/196_f1r2_business_cycle_remediation.sql:468` |
| `public.f1r2_list_project_assignments(p_actor_id uuid,p_project_id uuid)` | migration196_service_role_acl_review | yes | service_role_only | `supabase/migrations/196_f1r2_business_cycle_remediation.sql:527` |
| `public.f1r2_lock_work_item(p_item_type text,p_item_id uuid)` | migration196_service_role_acl_review | yes | service_role_only | `supabase/migrations/196_f1r2_business_cycle_remediation.sql:161` |
| `public.f1r2_relink_evidence_parent(p_actor_id uuid, p_evidence_file_id uuid, p_item_type text, p_item_id uuid, p_reason text)` | migration196_service_role_acl_review | yes | service_role_only | `supabase/migrations/196_f1r2_business_cycle_remediation.sql:1367` |
| `public.f1r2_resolve_project(p_item_type text,p_item_id uuid)` | migration196_service_role_acl_review | yes | service_role_only | `supabase/migrations/196_f1r2_business_cycle_remediation.sql:102` |
| `public.f1r2_respond_work_item_assignment(p_actor_id uuid,p_assignment_id uuid,p_decision text,p_decline_reason text default null)` | migration196_service_role_acl_review | yes | service_role_only | `supabase/migrations/196_f1r2_business_cycle_remediation.sql:376` |
| `public.f1r2_rollup_milestone_trigger()` | migration196_service_role_acl_review | no | owner_only | `supabase/migrations/196_f1r2_business_cycle_remediation.sql:909` |
| `public.f1r2_rollup_task_trigger()` | migration196_service_role_acl_review | no | owner_only | `supabase/migrations/196_f1r2_business_cycle_remediation.sql:896` |
| `public.f1r2_search_eligible_participants(p_actor_id uuid,p_item_type text,p_item_id uuid,p_assignment_purpose text, p_query text default null,p_limit integer default 50)` | migration196_service_role_acl_review | yes | service_role_only | `supabase/migrations/196_f1r2_business_cycle_remediation.sql:563` |
| `public.f1r2_sync_evidence_link()` | migration196_service_role_acl_review | no | owner_only | `supabase/migrations/196_f1r2_business_cycle_remediation.sql:1552` |
| `public.f1r2_work_item_contains(p_parent_type text,p_parent_id uuid,p_child_type text,p_child_id uuid)` | migration196_service_role_acl_review | no | owner_only | `supabase/migrations/196_f1r2_business_cycle_remediation.sql:1663` |
| `public.finalize_governed_document_approval(p_actor_id uuid, p_version_id uuid, p_approval_note text default null)` | migration206_service_role_acl_review | yes | service_role_only | `supabase/migrations/206_governed_sop_template_alignment_and_raci.sql:1060` |
| `public.fn_immutability_sop_training_target_scope()` | migration205_service_role_acl_review | yes | service_role_only | `supabase/migrations/205_governed_sop_training_and_competency_lifecycle.sql:189` |
| `public.fn_validate_sop_training_assignment()` | migration205_service_role_acl_review | yes | service_role_only | `supabase/migrations/205_governed_sop_training_and_competency_lifecycle.sql:222` |
| `public.fn_validate_sop_training_target_scope()` | migration205_service_role_acl_review | yes | service_role_only | `supabase/migrations/205_governed_sop_training_and_competency_lifecycle.sql:119` |
| `public.generate_governed_document_code(p_organization_id uuid, p_document_type text, p_department_code text default null)` | migration202_service_role_acl_review | yes | service_role_only | `supabase/migrations/202_governed_policy_sop_lifecycle_foundation.sql:86` |
| `public.get_effective_document_version(p_document_id uuid, p_target_date date default current_date)` | migration202_service_role_acl_review | yes | service_role_only | `supabase/migrations/202_governed_policy_sop_lifecycle_foundation.sql:135` |
| `public.guard_staged_approval_mutations()` | migration206_service_role_acl_review | no | owner_only | `supabase/migrations/206_governed_sop_template_alignment_and_raci.sql:310` |
| `public.ovr_executive_analytics_v1(p_actor_id uuid, p_query_shape text, p_department_filter_id uuid, p_category_filter text, p_idempotency_key text)` | migration194_service_role_acl_review | yes | service_role_only | `supabase/migrations/194_ovr_executive_analytics_foundation.sql:1139` |
| `public.ovr_v11_issue_final_verdict(p_actor_id uuid, p_ovr_report_id uuid, p_stage_instance_id uuid, p_verdict text, p_effective_severity public.ovr_severity_level, p_corrective_action_required boolean, p_idempotency_key text, p_supersedes_verdict_id uuid default null)` | migration193_service_role_acl_review | yes | service_role_only | `supabase/migrations/193_ovr_immutable_verdict_closure_foundation.sql:953` |
| `public.ovr_v11_perform_governance_closure(p_actor_id uuid, p_ovr_report_id uuid, p_stage_instance_id uuid, p_final_verdict_id uuid, p_idempotency_key text)` | migration193_service_role_acl_review | yes | service_role_only | `supabase/migrations/193_ovr_immutable_verdict_closure_foundation.sql:1157` |
| `public.ovr_v11_recuse_assignment(p_actor_id uuid, p_assignment_id uuid, p_reason text, p_idempotency_key text)` | migration192_service_role_acl_review | yes | service_role_only | `supabase/migrations/192_ovr_reviewer_routing_foundation.sql:1117` |
| `public.ovr_v11_reporter_acknowledge(p_actor_id uuid, p_ovr_report_id uuid, p_governance_closure_id uuid, p_idempotency_key text)` | migration193_service_role_acl_review | yes | service_role_only | `supabase/migrations/193_ovr_immutable_verdict_closure_foundation.sql:1366` |
| `public.ovr_v11_reporter_dispute(p_actor_id uuid, p_ovr_report_id uuid, p_governance_closure_id uuid, p_reason text, p_idempotency_key text)` | migration193_service_role_acl_review | yes | service_role_only | `supabase/migrations/193_ovr_immutable_verdict_closure_foundation.sql:1471` |
| `public.ovr_v11_route_reviewer(p_actor_id uuid, p_ovr_report_id uuid, p_stage_instance_id uuid, p_idempotency_key text)` | migration192_service_role_acl_review | yes | service_role_only | `supabase/migrations/192_ovr_reviewer_routing_foundation.sql:561` |
| `public.patch23_evidence_governance_bridge(p_actor_id uuid, p_action text, p_payload jsonb default '{}'::jsonb)` | migration200_service_role_acl_review | yes | service_role_only | `supabase/migrations/200_evidence_waiver_request_uniqueness.sql:16` |
| `public.patch83u_finalize_password_change_after_revocation(p_actor_id uuid, p_operation_id uuid, p_request_id text, p_applied_credential_version integer, p_verified_auth_email text)` | migration177_service_role_acl_review | yes | service_role_only | `supabase/migrations/177_patch83u_explicit_password_finalizer_rpc_name.sql:68` |
| `public.patch83u_finalize_required_password_change(p_actor_id uuid, p_operation_id uuid, p_request_id text, p_applied_credential_version integer, p_verified_auth_email text, p_session_revocation_confirmed boolean)` | migration189_service_role_acl_review | yes | service_role_only | `supabase/migrations/189_patch83u_post_provisioning_role_activation.sql:30` |
| `public.patch83u_reconcile_credential_state_standard_impl(p_actor_id uuid, p_target_user_id uuid, p_request_id text, p_employee_id_confirmation text)` | migration176_service_role_acl_review | no | owner_only | `supabase/migrations/176_patch83u_last_super_admin_recovery.sql:125` |
| `public.patch83u_reconcile_last_super_admin_recovery(p_actor_id uuid, p_target_user_id uuid, p_request_id text, p_employee_id_confirmation text)` | migration176_service_role_acl_review | no | owner_only | `supabase/migrations/176_patch83u_last_super_admin_recovery.sql:133` |
| `public.patch83u_reconcile_provisioning(p_actor_id uuid, p_provisioning_id uuid, p_request_id text, p_employee_id_confirmation text)` | migration189_service_role_acl_review | yes | service_role_only | `supabase/migrations/189_patch83u_post_provisioning_role_activation.sql:393` |
| `public.publish_sop_training_obligations(p_actor_id uuid, p_version_id uuid)` | migration208_service_role_acl_review | yes | service_role_only | `supabase/migrations/208_e2b2_training_authorization_and_compliance_contract_remediation.sql:1203` |
| `public.reconcile_sop_training_population(p_actor_id uuid, p_version_id uuid)` | migration205_service_role_acl_review | yes | service_role_only | `supabase/migrations/205_governed_sop_training_and_competency_lifecycle.sql:825` |
| `public.record_approval_decision(p_approval_request_id uuid, p_approver_id uuid, p_decision text, p_decision_note text default null, p_approver_role text default null)` | migration206_service_role_acl_review | yes | service_role_only | `supabase/migrations/206_governed_sop_template_alignment_and_raci.sql:572` |
| `public.record_competency_assessment(p_assignment_id uuid, p_user_id uuid, p_competency_area text, p_result text, p_score numeric default null, p_evidence_id uuid default null, p_notes text default null, p_actor_id uuid default null)` | migration208_service_role_acl_review | yes | service_role_only | `supabase/migrations/208_e2b2_training_authorization_and_compliance_contract_remediation.sql:590` |
| `public.record_competency_assessment(p_assignment_id uuid, p_user_id uuid, p_competency_area text, p_result text, p_score numeric, p_evidence_id uuid, p_notes text, p_actor_id uuid)` | migration205_service_role_acl_review | yes | service_role_only | `supabase/migrations/205_governed_sop_training_and_competency_lifecycle.sql:1128` |
| `public.record_document_acknowledgment(p_document_id uuid, p_version_id uuid, p_user_id uuid, p_acknowledgment_method text default 'manual', p_acknowledgment_note text default null)` | migration208_service_role_acl_review | yes | service_role_only | `supabase/migrations/208_e2b2_training_authorization_and_compliance_contract_remediation.sql:1082` |
| `public.refresh_milestone_progress(target_milestone_id uuid)` | migration196_service_role_acl_review | no | owner_only | `supabase/migrations/196_f1r2_business_cycle_remediation.sql:856` |
| `public.refresh_ovr_executive_analytics_snapshot_v1(p_actor_id uuid)` | migration194_service_role_acl_review | yes | service_role_only | `supabase/migrations/194_ovr_executive_analytics_foundation.sql:811` |
| `public.refresh_project_progress(target_project_id uuid)` | migration196_service_role_acl_review | no | owner_only | `supabase/migrations/196_f1r2_business_cycle_remediation.sql:876` |
| `public.reopen_training_assignment_with_reason(p_assignment_id uuid, p_reason text, p_actor_id uuid)` | migration208_service_role_acl_review | yes | service_role_only | `supabase/migrations/208_e2b2_training_authorization_and_compliance_contract_remediation.sql:969` |
| `public.request_evidence_gate_waiver(p_entity_type text, p_entity_id uuid, p_waiver_reason text, p_actor_user_id uuid, p_expires_on date default null)` | migration200_service_role_acl_review | yes | service_role_only | `supabase/migrations/200_evidence_waiver_request_uniqueness.sql:456` |
| `public.request_policy_sop_exception(p_actor_id uuid, p_version_id uuid, p_reason text, p_scope_description text, p_start_date date, p_end_date date, p_risk_summary text default null, p_compensating_controls text default null)` | migration202_service_role_acl_review | yes | service_role_only | `supabase/migrations/202_governed_policy_sop_lifecycle_foundation.sql:1383` |
| `public.retire_governed_document(p_actor_id uuid, p_document_id uuid, p_retirement_reason text)` | migration202_service_role_acl_review | yes | service_role_only | `supabase/migrations/202_governed_policy_sop_lifecycle_foundation.sql:1234` |
| `public.save_governed_policy_draft(p_actor_id uuid, p_version_id uuid, p_title_en text, p_title_ar text, p_purpose_en text, p_purpose_ar text, p_policy_statement_en text, p_policy_statement_ar text, p_scope_en text, p_scope_ar text, p_principles_en text, p_principles_ar text, p_exceptions_summary_en text, p_exceptions_summary_ar text, p_non_compliance_escalation_en text, p_non_compliance_escalation_ar text, p_requirements jsonb default '[]'::jsonb, p_department_scopes uuid[] default '{}'::uuid[], p_role_scopes jsonb default '[]'::jsonb)` | migration202_service_role_acl_review | yes | service_role_only | `supabase/migrations/202_governed_policy_sop_lifecycle_foundation.sql:485` |
| `public.save_governed_sop_draft(p_actor_id uuid, p_version_id uuid, p_title_en text default null, p_title_ar text default null, p_process_name_en text default null, p_process_name_ar text default null, p_purpose_en text default null, p_purpose_ar text default null, p_process_owner_id uuid default null, p_primary_policy_version_id uuid default null, p_governance_link_state text default null, p_scope_en text default null, p_scope_ar text default null, p_training_required boolean default null, p_acknowledgment_required boolean default null, p_competency_assessment_required boolean default null, p_acknowledgment_sla_days integer default null, p_training_renewal_months integer default null, p_content_mode text default null, p_transcription_status text default null, p_procedure_sections jsonb default null, p_procedure_steps jsonb default null, p_department_scopes uuid[] default null, p_role_scopes jsonb default null, p_definitions jsonb default null, p_role_responsibilities jsonb default null, p_monitoring_kpis jsonb default null, p_risk_links jsonb default null, p_accreditation_links jsonb default null, p_version_links jsonb default null)` | migration207_service_role_acl_review | yes | service_role_only | `supabase/migrations/207_governed_sop_runtime_contract_remediation.sql:21` |
| `public.save_governed_sop_draft(p_actor_id uuid, p_version_id uuid, p_title_en text default null, p_title_ar text default null, p_process_name_en text default null, p_process_name_ar text default null, p_purpose_en text default null, p_purpose_ar text default null, p_process_owner_id uuid default null, p_primary_policy_version_id uuid default null, p_governance_link_state text default null, p_scope_en text default null, p_scope_ar text default null, p_training_required boolean default null, p_acknowledgment_required boolean default null, p_competency_assessment_required boolean default null, p_acknowledgment_sla_days integer default null, p_training_renewal_months integer default null, p_procedure_steps jsonb default null, p_department_scopes uuid[] default null, p_role_scopes jsonb default null, p_definitions jsonb default null, p_role_responsibilities jsonb default null, p_monitoring_kpis jsonb default null, p_risk_links jsonb default null, p_accreditation_links jsonb default null)` | migration204_service_role_acl_review | yes | service_role_only | `supabase/migrations/204_governed_sop_risk_and_accreditation_traceability.sql:424` |
| `public.save_governed_sop_draft(p_actor_id uuid, p_version_id uuid, p_title_en text, p_title_ar text, p_process_name_en text, p_process_name_ar text, p_purpose_en text, p_purpose_ar text, p_process_owner_id uuid, p_primary_policy_version_id uuid, p_governance_link_state text, p_scope_en text, p_scope_ar text, p_training_required boolean default false, p_acknowledgment_required boolean default false, p_competency_assessment_required boolean default false, p_acknowledgment_sla_days integer default 30, p_training_renewal_months integer default 12, p_procedure_steps jsonb default '[]'::jsonb, p_department_scopes uuid[] default '{}'::uuid[], p_role_scopes jsonb default '[]'::jsonb, p_definitions jsonb default '[]'::jsonb, p_role_responsibilities jsonb default '[]'::jsonb, p_monitoring_kpis jsonb default '[]'::jsonb)` | migration203_service_role_acl_review | yes | service_role_only | `supabase/migrations/203_governed_sop_structured_content_expansion.sql:526` |
| `public.save_governed_sop_draft(p_actor_id uuid, p_version_id uuid, p_title_en text, p_title_ar text, p_process_name_en text, p_process_name_ar text, p_purpose_en text, p_purpose_ar text, p_process_owner_id uuid, p_primary_policy_version_id uuid, p_governance_link_state text, p_scope_en text, p_scope_ar text, p_training_required boolean default false, p_acknowledgment_required boolean default false, p_competency_assessment_required boolean default false, p_acknowledgment_sla_days integer default 30, p_training_renewal_months integer default 12, p_procedure_steps jsonb default '[]'::jsonb, p_department_scopes uuid[] default '{}'::uuid[], p_role_scopes jsonb default '[]'::jsonb)` | migration202_service_role_acl_review | yes | service_role_only | `supabase/migrations/202_governed_policy_sop_lifecycle_foundation.sql:646` |
| `public.start_governed_document_revision(p_actor_id uuid, p_source_version_id uuid, p_revision_type text default 'minor', p_revision_reason text default null)` | migration206_service_role_acl_review | yes | service_role_only | `supabase/migrations/206_governed_sop_template_alignment_and_raci.sql:1880` |
| `public.start_training_assignment(p_assignment_id uuid, p_actor_id uuid)` | migration208_service_role_acl_review | yes | service_role_only | `supabase/migrations/208_e2b2_training_authorization_and_compliance_contract_remediation.sql:350` |
| `public.submit_governed_document_for_review(p_actor_id uuid, p_version_id uuid, p_submission_note text default null)` | migration206_service_role_acl_review | yes | service_role_only | `supabase/migrations/206_governed_sop_template_alignment_and_raci.sql:879` |
| `public.trigger_governed_document_review(p_actor_id uuid, p_document_id uuid, p_trigger_type text, p_source_entity_type text default null, p_source_entity_id uuid default null, p_due_date date default (current_date + interval '30 days')` | migration202_service_role_acl_review | yes | service_role_only | `supabase/migrations/202_governed_policy_sop_lifecycle_foundation.sql:1278` |
| `public.validate_department_scope()` | migration201_service_role_acl_review | yes | service_role_only | `supabase/migrations/201_governed_policy_sop_core_foundation.sql:305` |
| `public.validate_governed_doc_ver_link_tenancy()` | migration206_service_role_acl_review | no | owner_only | `supabase/migrations/206_governed_sop_template_alignment_and_raci.sql:202` |
| `public.validate_policy_version_type()` | migration201_service_role_acl_review | yes | service_role_only | `supabase/migrations/201_governed_policy_sop_core_foundation.sql:169` |
| `public.validate_sop_version_type()` | migration204_service_role_acl_review | yes | service_role_only | `supabase/migrations/204_governed_sop_risk_and_accreditation_traceability.sql:153` |
| `public.waive_training_assignment_with_reason(p_assignment_id uuid, p_reason text, p_actor_id uuid)` | migration208_service_role_acl_review | yes | service_role_only | `supabase/migrations/208_e2b2_training_authorization_and_compliance_contract_remediation.sql:743` |

## Materialized views

No browser-referenced or ACL-reachable materialized view exists in the target replay. Migration 174 checks the live public catalog and aborts if `authenticated` can SELECT any materialized view.

## Direct browser views

| Surface | Kind | security_invoker | Base tables | Intentional authenticated grant | Disposition |
|---|---|---:|---:|---:|---|
| `v_access_control_matrix` | view | yes | 8 | yes | approved_browser_read_view |
| `v_access_control_summary` | view | yes | 3 | yes | approved_browser_read_view |
| `v_access_control_warnings` | view | yes | 2 | yes | approved_browser_read_view |
| `v_accreditation_gap_dashboard` | view | yes | 4 | yes | approved_browser_read_view |
| `v_accreditation_readiness_summary` | view | yes | 8 | yes | approved_browser_read_view |
| `v_accreditation_requirement_matrix` | view | yes | 7 | yes | approved_browser_read_view |
| `v_activity_timeline` | view | yes | 4 | yes | approved_browser_read_view |
| `v_admin_safety_console` | view | yes | 3 | yes | approved_browser_read_view |
| `v_assurance_external_auditor_portal` | view | yes | 2 | yes | approved_browser_read_view |
| `v_assurance_gate_dashboard` | view | yes | 1 | yes | approved_browser_read_view |
| `v_assurance_go_live_summary` | view | yes | 7 | yes | approved_browser_read_view |
| `v_assurance_signoff_readiness` | view | yes | 4 | yes | approved_browser_read_view |
| `v_automation_command_summary` | view | yes | 6 | yes | approved_browser_read_view |
| `v_automation_rule_catalog` | view | yes | 2 | yes | approved_browser_read_view |
| `v_backup_health_check` | view | yes | 10 | yes | approved_browser_read_view |
| `v_backup_restore_drillboard` | view | yes | 2 | yes | approved_browser_read_view |
| `v_backup_schedule_readiness` | view | yes | 3 | yes | approved_browser_read_view |
| `v_bilingual_dictionary_status` | view | yes | 1 | yes | approved_browser_read_view |
| `v_board_pack_summary` | view | yes | 11 | yes | approved_browser_read_view |
| `v_committee_action_automation` | view | yes | 4 | yes | approved_browser_read_view |
| `v_consolidated_release_packages` | view | yes | 1 | yes | approved_browser_read_view |
| `v_consolidation_defect_dashboard` | view | yes | 1 | yes | approved_browser_read_view |
| `v_critical_attention_items` | view | yes | 8 | yes | approved_browser_read_view |
| `v_cross_module_relationship_map` | view | yes | 7 | yes | approved_browser_read_view |
| `v_data_retention_readiness` | view | yes | 8 | yes | approved_browser_read_view |
| `v_delay_reason_queue` | view | yes | 5 | yes | approved_browser_read_view |
| `v_department_execution_summary` | view | yes | 7 | yes | approved_browser_read_view |
| `v_department_risk_heatmap` | view | yes | 8 | yes | approved_browser_read_view |
| `v_department_scorecard_v2` | view | yes | 8 | yes | approved_browser_read_view |
| `v_deployment_readiness_gates` | view | yes | 11 | yes | approved_browser_read_view |
| `v_document_center_items` | view | yes | 4 | yes | approved_browser_read_view |
| `v_document_center_summary` | view | yes | 5 | yes | approved_browser_read_view |
| `v_due_reminder_queue` | view | yes | 5 | yes | approved_browser_read_view |
| `v_escalation_center` | view | yes | 3 | yes | approved_browser_read_view |
| `v_evidence_review_queue` | view | yes | 11 | yes | approved_browser_read_view |
| `v_evidence_vault_inventory` | view | yes | 3 | yes | approved_browser_read_view |
| `v_executive_command_stream` | view | yes | 6 | yes | approved_browser_read_view |
| `v_executive_command_summary` | view | yes | 17 | yes | approved_browser_read_view |
| `v_executive_exception_dashboard` | view | yes | 1 | yes | approved_browser_read_view |
| `v_executive_grc_summary` | view | yes | 9 | yes | approved_browser_read_view |
| `v_export_center_summary` | view | yes | 3 | yes | approved_browser_read_view |
| `v_final_acceptance_tests` | view | yes | 1 | yes | approved_browser_read_view |
| `v_final_consolidation_artifacts` | view | yes | 1 | yes | approved_browser_read_view |
| `v_final_cutover_plan` | view | yes | 1 | yes | approved_browser_read_view |
| `v_final_finish_fast_scorecard` | view | yes | 4 | yes | approved_browser_read_view |
| `v_final_go_live_gateboard` | view | yes | 1 | yes | approved_browser_read_view |
| `v_final_handover_signoffs` | view | yes | 1 | yes | approved_browser_read_view |
| `v_final_owner_clearance` | view | yes | 1 | yes | approved_browser_read_view |
| `v_governed_policy_catalog` | view | yes | 6 | yes | approved_browser_read_view |
| `v_governed_sop_catalog` | view | yes | 6 | yes | approved_browser_read_view |
| `v_grc_kpi_scorecard` | view | yes | 13 | yes | approved_browser_read_view |
| `v_i18n_translation_coverage` | view | yes | 1 | yes | approved_browser_read_view |
| `v_kri_breach_register` | view | yes | 4 | yes | approved_browser_read_view |
| `v_live_grc_capa_queue` | view | yes | 1 | yes | approved_browser_read_view |
| `v_live_grc_obligation_dashboard` | view | yes | 1 | yes | approved_browser_read_view |
| `v_live_grc_operating_summary` | view | yes | 6 | yes | approved_browser_read_view |
| `v_live_grc_risk_control_map` | view | yes | 3 | yes | approved_browser_read_view |
| `v_load_test_seed_status` | view | yes | 1 | yes | approved_browser_read_view |
| `v_management_control_summary` | view | yes | 7 | yes | approved_browser_read_view |
| `v_manager_inbox` | view | yes | 7 | yes | approved_browser_read_view |
| `v_migration_runbook_status` | view | yes | 1 | yes | approved_browser_read_view |
| `v_migration_verification_matrix` | view | yes | 3 | yes | approved_browser_read_view |
| `v_mobile_readiness_gates` | view | yes | 8 | yes | approved_browser_read_view |
| `v_module_payload_pressure` | view | yes | 6 | yes | approved_browser_read_view |
| `v_monthly_grc_trend` | view | yes | 5 | yes | approved_browser_read_view |
| `v_notification_digest` | view | yes | 7 | yes | approved_browser_read_view |
| `v_operational_followup_summary` | view | yes | 9 | yes | approved_browser_read_view |
| `v_ovr_repeated_category_alerts` | view | yes | 3 | yes | approved_browser_read_view |
| `v_ovr_risk_indicator_summary` | view | yes | 4 | yes | approved_browser_read_view |
| `v_ovr_risk_indicators_by_department` | view | yes | 3 | yes | approved_browser_read_view |
| `v_ovr_summary` | view | yes | 2 | yes | approved_browser_read_view |
| `v_ovr_workflow_control_summary` | view | yes | 3 | yes | approved_browser_read_view |
| `v_ovr_workflow_queue` | view | yes | 3 | yes | approved_browser_read_view |
| `v_patch13_evidence_pack_readiness` | view | yes | 1 | yes | approved_browser_read_view |
| `v_patch13_failed_retest_queue` | view | yes | 3 | yes | approved_browser_read_view |
| `v_patch13_role_scenario_queue` | view | yes | 4 | yes | approved_browser_read_view |
| `v_patch13_uat_evidence_summary` | view | yes | 5 | yes | approved_browser_read_view |
| `v_patch14_hardening_queue` | view | yes | 4 | yes | approved_browser_read_view |
| `v_patch14_launch_readiness_dashboard` | view | yes | 3 | yes | approved_browser_read_view |
| `v_patch14_production_hardening_summary` | view | yes | 9 | yes | approved_browser_read_view |
| `v_patch15_final_security_closure_summary` | view | yes | 6 | yes | approved_browser_read_view |
| `v_patch15_rpc_review_queue` | view | yes | 1 | yes | approved_browser_read_view |
| `v_patch15_warning_closure_queue` | view | yes | 2 | yes | approved_browser_read_view |
| `v_patch22_executive_risk_escalations` | view | yes | 3 | yes | approved_browser_read_view |
| `v_patch22_risk_appetite_breaches` | view | yes | 3 | yes | approved_browser_read_view |
| `v_patch22_risk_closure_blockers` | view | yes | 3 | yes | approved_browser_read_view |
| `v_patch22_risk_kri_alerts` | view | yes | 3 | yes | approved_browser_read_view |
| `v_patch22_risk_treatment_queue` | view | yes | 2 | yes | approved_browser_read_view |
| `v_patch22_risk_workflow_queue` | view | yes | 3 | yes | approved_browser_read_view |
| `v_patch23_evidence_chain_of_custody` | view | yes | 3 | yes | approved_browser_read_view |
| `v_patch23_evidence_closure_gate_status` | view | yes | 4 | yes | approved_browser_read_view |
| `v_patch23_evidence_gap_dashboard` | view | yes | 4 | yes | approved_browser_read_view |
| `v_patch23_evidence_pack_index` | view | yes | 3 | yes | approved_browser_read_view |
| `v_patch23_evidence_review_queue` | view | yes | 2 | yes | approved_browser_read_view |
| `v_patch23_sensitive_evidence_register` | view | yes | 2 | yes | approved_browser_read_view |
| `v_patch24_audit_closure_gate_status` | view | yes | 5 | yes | approved_browser_read_view |
| `v_patch24_audit_closure_pack_index` | view | yes | 6 | yes | approved_browser_read_view |
| `v_patch24_audit_executive_escalations` | view | yes | 3 | yes | approved_browser_read_view |
| `v_patch24_audit_finding_workflow_queue` | view | yes | 7 | yes | approved_browser_read_view |
| `v_patch24_overdue_audit_findings` | view | yes | 3 | yes | approved_browser_read_view |
| `v_patch24_repeat_audit_findings` | view | yes | 2 | yes | approved_browser_read_view |
| `v_patch29_accreditation_training_readiness` | view | yes | 3 | yes | approved_browser_read_view |
| `v_patch29_competency_gap_dashboard` | view | yes | 6 | yes | approved_browser_read_view |
| `v_patch29_overdue_training_assignments` | view | yes | 4 | yes | approved_browser_read_view |
| `v_patch29_sop_acknowledgment_gap` | view | yes | 7 | yes | approved_browser_read_view |
| `v_patch29_training_assignment_queue` | view | yes | 4 | yes | approved_browser_read_view |
| `v_patch29_training_evidence_index` | view | yes | 4 | yes | approved_browser_read_view |
| `v_patch29_training_executive_summary` | view | yes | 10 | yes | approved_browser_read_view |
| `v_patch29_training_program_register` | view | yes | 3 | yes | approved_browser_read_view |
| `v_patch30_accreditation_readiness_summary` | view | yes | 1 | yes | approved_browser_read_view |
| `v_patch30_board_pack_truth_snapshot` | view | yes | 1 | yes | approved_browser_read_view |
| `v_patch30_department_grc_scorecard` | view | yes | 4 | yes | approved_browser_read_view |
| `v_patch30_evidence_gap_summary` | view | yes | 3 | yes | approved_browser_read_view |
| `v_patch30_executive_truth_summary` | view | yes | 5 | yes | approved_browser_read_view |
| `v_patch30_governance_exception_register` | view | yes | 1 | yes | approved_browser_read_view |
| `v_patch30_module_health_scorecard` | view | yes | 3 | yes | approved_browser_read_view |
| `v_patch30_open_executive_risk_register` | view | yes | 3 | yes | approved_browser_read_view |
| `v_patch30_overdue_governance_items` | view | yes | 2 | yes | approved_browser_read_view |
| `v_patch30_workflow_bottleneck_summary` | view | yes | 1 | yes | approved_browser_read_view |
| `v_patch33_accreditation_live_readiness_summary` | view | yes | 5 | yes | approved_browser_read_view |
| `v_patch33_capa_training_sop_evidence_dependencies` | view | yes | 5 | yes | approved_browser_read_view |
| `v_patch33_clause_control_evidence_bridge` | view | yes | 5 | yes | approved_browser_read_view |
| `v_patch33_clause_evidence_readiness` | view | yes | 5 | yes | approved_browser_read_view |
| `v_patch33_department_evidence_readiness` | view | yes | 5 | yes | approved_browser_read_view |
| `v_patch33_evidence_collection_queue` | view | yes | 5 | yes | approved_browser_read_view |
| `v_patch33_evidence_exception_register` | view | yes | 5 | yes | approved_browser_read_view |
| `v_patch33_evidence_review_queue` | view | yes | 4 | yes | approved_browser_read_view |
| `v_patch33_executive_evidence_bridge_summary` | view | yes | 5 | yes | approved_browser_read_view |
| `v_patch33_live_evidence_gap_register` | view | yes | 5 | yes | approved_browser_read_view |
| `v_patch33_overdue_evidence_requests` | view | yes | 5 | yes | approved_browser_read_view |
| `v_patch33_stale_expired_evidence_register` | view | yes | 5 | yes | approved_browser_read_view |
| `v_patch35_accreditation_operations_dashboard` | view | yes | 10 | yes | approved_browser_read_view |
| `v_patch35_active_review_cycles` | view | yes | 1 | yes | approved_browser_read_view |
| `v_patch35_clause_blocker_summary` | view | yes | 7 | yes | approved_browser_read_view |
| `v_patch35_clause_owner_register` | view | yes | 5 | yes | approved_browser_read_view |
| `v_patch35_clause_owner_task_queue` | view | yes | 6 | yes | approved_browser_read_view |
| `v_patch35_clause_reviewer_signoff_queue` | view | yes | 6 | yes | approved_browser_read_view |
| `v_patch35_clause_signoff_register` | view | yes | 5 | yes | approved_browser_read_view |
| `v_patch35_department_accreditation_workload` | view | yes | 6 | yes | approved_browser_read_view |
| `v_patch35_escalation_register` | view | yes | 5 | yes | approved_browser_read_view |
| `v_patch35_executive_accreditation_workflow_summary` | view | yes | 10 | yes | approved_browser_read_view |
| `v_patch35_overdue_clause_tasks` | view | yes | 6 | yes | approved_browser_read_view |
| `v_patch35_ready_for_survey_review_queue` | view | yes | 8 | yes | approved_browser_read_view |
| `v_patch37_audit_engagement_register` | view | yes | 7 | yes | approved_browser_read_view |
| `v_patch37_audit_finding_register` | view | yes | 6 | yes | approved_browser_read_view |
| `v_patch37_audit_findings_requiring_capa_or_evidence` | view | yes | 6 | yes | approved_browser_read_view |
| `v_patch37_audit_sample_result_register` | view | yes | 6 | yes | approved_browser_read_view |
| `v_patch37_audit_signoff_queue` | view | yes | 3 | yes | approved_browser_read_view |
| `v_patch37_audit_test_step_queue` | view | yes | 5 | yes | approved_browser_read_view |
| `v_patch37_clinical_governance_escalation_register` | view | yes | 5 | yes | approved_browser_read_view |
| `v_patch37_department_clinical_governance_workload` | view | yes | 5 | yes | approved_browser_read_view |
| `v_patch37_executive_clinical_governance_summary` | view | yes | 5 | yes | approved_browser_read_view |
| `v_patch37_overdue_audit_ovr_governance_items` | view | yes | 3 | yes | approved_browser_read_view |
| `v_patch37_ovr_capa_evidence_bridge` | view | yes | 7 | yes | approved_browser_read_view |
| `v_patch37_ovr_rca_case_register` | view | yes | 4 | yes | approved_browser_read_view |
| `v_patch38_clinical_area_register` | view | yes | 4 | yes | approved_browser_read_view |
| `v_patch38_committee_register` | view | yes | 3 | yes | approved_browser_read_view |
| `v_patch38_hospital_location_register` | view | yes | 2 | yes | approved_browser_read_view |
| `v_patch38_hospital_service_register` | view | yes | 3 | yes | approved_browser_read_view |
| `v_patch38_job_title_register` | view | yes | 1 | yes | approved_browser_read_view |
| `v_patch38_master_data_exception_register` | view | yes | 6 | yes | approved_browser_read_view |
| `v_patch38_master_data_ownership_register` | view | yes | 9 | yes | approved_browser_read_view |
| `v_patch38_quality_indicator_register` | view | yes | 3 | yes | approved_browser_read_view |
| `v_patch39_accreditation_blocker_summary` | view | yes | 9 | yes | approved_browser_read_view |
| `v_patch39_committee_action_queue` | view | yes | 4 | yes | approved_browser_read_view |
| `v_patch39_committee_meeting_register` | view | yes | 3 | yes | approved_browser_read_view |
| `v_patch39_credentialing_expiry_register` | view | yes | 5 | yes | approved_browser_read_view |
| `v_patch39_department_hospital_governance_scorecard` | view | yes | 13 | yes | approved_browser_read_view |
| `v_patch39_executive_hospital_quality_summary` | view | yes | 13 | yes | approved_browser_read_view |
| `v_patch39_facility_biomedical_safety_register` | view | yes | 5 | yes | approved_browser_read_view |
| `v_patch39_facility_safety_evidence_gap_register` | view | yes | 5 | yes | approved_browser_read_view |
| `v_patch39_hospital_governance_work_queue` | view | yes | 13 | yes | approved_browser_read_view |
| `v_patch39_infection_control_open_actions` | view | yes | 6 | yes | approved_browser_read_view |
| `v_patch39_infection_control_register` | view | yes | 6 | yes | approved_browser_read_view |
| `v_patch39_overdue_committee_actions` | view | yes | 4 | yes | approved_browser_read_view |
| `v_patch39_privileging_competency_gap_register` | view | yes | 5 | yes | approved_browser_read_view |
| `v_patch39_quality_indicator_off_target_register` | view | yes | 5 | yes | approved_browser_read_view |
| `v_patch39_quality_indicator_performance` | view | yes | 5 | yes | approved_browser_read_view |
| `v_patch4_audit_engagement_dashboard` | view | yes | 4 | yes | approved_browser_read_view |
| `v_patch4_audit_evidence_governance_summary` | view | yes | 7 | yes | approved_browser_read_view |
| `v_patch4_evidence_integrity_index` | view | yes | 3 | yes | approved_browser_read_view |
| `v_patch4_production_governance_gate_dashboard` | view | yes | 2 | yes | approved_browser_read_view |
| `v_patch40_controlled_pilot_readiness_summary` | view | yes | 1 | yes | approved_browser_read_view |
| `v_patch40_missing_translation_register` | view | yes | 1 | yes | approved_browser_read_view |
| `v_patch40_proof_suite_readiness_summary` | view | yes | 1 | yes | approved_browser_read_view |
| `v_patch40_runtime_rpc_signoff_dashboard` | view | yes | 1 | yes | approved_browser_read_view |
| `v_patch42_blocked_operations_queue` | view | yes | 9 | yes | approved_browser_read_view |
| `v_patch42_department_operations_queue` | view | yes | 10 | yes | approved_browser_read_view |
| `v_patch42_escalated_operations_queue` | view | yes | 9 | yes | approved_browser_read_view |
| `v_patch42_evidence_required_queue` | view | yes | 9 | yes | approved_browser_read_view |
| `v_patch42_executive_operations_queue` | view | yes | 9 | yes | approved_browser_read_view |
| `v_patch42_executive_operations_summary` | view | yes | 9 | yes | approved_browser_read_view |
| `v_patch42_master_data_routing_exceptions` | view | yes | 9 | yes | approved_browser_read_view |
| `v_patch42_missing_owner_queue` | view | yes | 9 | yes | approved_browser_read_view |
| `v_patch42_my_operations_queue` | view | yes | 9 | yes | approved_browser_read_view |
| `v_patch42_queue_item_detail_context` | view | yes | 9 | yes | approved_browser_read_view |
| `v_patch42_unified_operations_queue` | view | yes | 9 | yes | approved_browser_read_view |
| `v_patch42_waiting_for_review_queue` | view | yes | 9 | yes | approved_browser_read_view |
| `v_patch43_accreditation_war_room` | view | yes | 12 | yes | approved_browser_read_view |
| `v_patch43_audit_evidence_chain` | view | yes | 5 | yes | approved_browser_read_view |
| `v_patch43_capa_evidence_chain` | view | yes | 5 | yes | approved_browser_read_view |
| `v_patch43_clause_readiness_register` | view | yes | 8 | yes | approved_browser_read_view |
| `v_patch43_department_readiness_register` | view | yes | 7 | yes | approved_browser_read_view |
| `v_patch43_evidence_gap_register` | view | yes | 5 | yes | approved_browser_read_view |
| `v_patch43_evidence_gate_failure_register` | view | yes | 2 | yes | approved_browser_read_view |
| `v_patch43_evidence_waiver_register` | view | yes | 2 | yes | approved_browser_read_view |
| `v_patch43_executive_survey_readiness_summary` | view | yes | 11 | yes | approved_browser_read_view |
| `v_patch43_incident_evidence_chain` | view | yes | 5 | yes | approved_browser_read_view |
| `v_patch43_mock_survey_finding_register` | view | yes | 6 | yes | approved_browser_read_view |
| `v_patch43_queue_evidence_gate_overlay` | view | yes | 10 | yes | approved_browser_read_view |
| `v_patch43_survey_blocker_summary` | view | yes | 9 | yes | approved_browser_read_view |
| `v_patch43_training_document_evidence_chain` | view | yes | 5 | yes | approved_browser_read_view |
| `v_patch44_backup_restore_readiness_summary` | view | yes | 1 | yes | approved_browser_read_view |
| `v_patch44_bilingual_readiness_summary` | view | yes | 1 | yes | approved_browser_read_view |
| `v_patch44_executive_readiness_summary` | view | yes | 1 | yes | approved_browser_read_view |
| `v_patch44_known_limitations_summary` | view | yes | 1 | yes | approved_browser_read_view |
| `v_patch44_navigation_readiness_map` | view | yes | 1 | yes | approved_browser_read_view |
| `v_patch44_pilot_blocker_register` | view | yes | 1 | yes | approved_browser_read_view |
| `v_patch44_pilot_go_no_go_dashboard` | view | yes | 2 | yes | approved_browser_read_view |
| `v_patch44_production_readiness_summary` | view | yes | 1 | yes | approved_browser_read_view |
| `v_patch45_direct_browser_rpc_exception_register` | view | yes | 1 | yes | approved_browser_read_view |
| `v_patch45_production_security_readiness_overlay` | view | yes | 1 | yes | approved_browser_read_view |
| `v_patch45_runtime_action_register` | view | yes | 1 | yes | approved_browser_read_view |
| `v_patch46_production_readiness_access_review_overlay` | view | yes | 2 | yes | approved_browser_read_view |
| `v_patch46_runtime_access_review_blockers` | view | yes | 2 | yes | approved_browser_read_view |
| `v_patch46_runtime_access_review_register` | view | yes | 2 | yes | approved_browser_read_view |
| `v_patch47_production_readiness_staging_overlay` | view | yes | 1 | yes | approved_browser_read_view |
| `v_patch47_staging_security_blockers` | view | yes | 1 | yes | approved_browser_read_view |
| `v_patch49_controlled_pilot_blockers` | view | yes | 3 | yes | approved_browser_read_view |
| `v_patch49_department_pilot_readiness_register` | view | yes | 1 | yes | approved_browser_read_view |
| `v_patch49_department_signoff_register` | view | yes | 1 | yes | approved_browser_read_view |
| `v_patch49_pilot_participant_coverage` | view | yes | 2 | yes | approved_browser_read_view |
| `v_patch49_production_readiness_pilot_activation_overlay` | view | yes | 4 | yes | approved_browser_read_view |
| `v_patch50_department_setup_checklist_register` | view | yes | 2 | yes | approved_browser_read_view |
| `v_patch50_pilot_participant_setup_gap_register` | view | yes | 2 | yes | approved_browser_read_view |
| `v_patch50_pilot_training_gap_register` | view | yes | 2 | yes | approved_browser_read_view |
| `v_patch50_production_readiness_real_pilot_setup_overlay` | view | yes | 5 | yes | approved_browser_read_view |
| `v_patch50_real_pilot_launch_blocker_register` | view | yes | 4 | yes | approved_browser_read_view |
| `v_patch50_real_pilot_master_data_exception_register` | view | yes | 3 | yes | approved_browser_read_view |
| `v_patch51_failed_workflow_walkthrough_register` | view | yes | 2 | yes | approved_browser_read_view |
| `v_patch51_pending_workflow_walkthrough_register` | view | yes | 2 | yes | approved_browser_read_view |
| `v_patch51_production_readiness_live_pilot_execution_overlay` | view | yes | 5 | yes | approved_browser_read_view |
| `v_patch51_workflow_execution_blocker_register` | view | yes | 5 | yes | approved_browser_read_view |
| `v_patch52_accepted_limitation_register` | view | yes | 2 | yes | approved_browser_read_view |
| `v_patch52_pilot_closure_blocker_register` | view | yes | 9 | yes | approved_browser_read_view |
| `v_patch52_pilot_remediation_action_register` | view | yes | 2 | yes | approved_browser_read_view |
| `v_patch52_production_golive_decision_register` | view | yes | 2 | yes | approved_browser_read_view |
| `v_patch52_production_readiness_golive_decision_overlay` | view | yes | 8 | yes | approved_browser_read_view |
| `v_patch53_department_adoption_feedback_register` | view | yes | 3 | yes | approved_browser_read_view |
| `v_patch53_hypercare_blocker_register` | view | yes | 9 | yes | approved_browser_read_view |
| `v_patch53_hypercare_issue_register` | view | yes | 2 | yes | approved_browser_read_view |
| `v_patch53_operating_cadence_event_register` | view | yes | 2 | yes | approved_browser_read_view |
| `v_patch53_production_readiness_hypercare_overlay` | view | yes | 9 | yes | approved_browser_read_view |
| `v_patch55_department_adoption_readiness_register` | view | yes | 3 | yes | approved_browser_read_view |
| `v_patch55_department_launch_blocker_register` | view | yes | 18 | yes | approved_browser_read_view |
| `v_patch55_department_launch_checklist_register` | view | yes | 3 | yes | approved_browser_read_view |
| `v_patch55_department_launch_pack_register` | view | yes | 2 | yes | approved_browser_read_view |
| `v_patch55_department_support_readiness_register` | view | yes | 3 | yes | approved_browser_read_view |
| `v_patch55_policy_attestation_readiness_register` | view | yes | 3 | yes | approved_browser_read_view |
| `v_patch55_production_readiness_hospital_operations_overlay` | view | yes | 18 | yes | approved_browser_read_view |
| `v_pending_approvals_expanded` | view | yes | 11 | yes | approved_browser_read_view |
| `v_permission_test_personas` | view | yes | 0 | yes | approved_browser_read_view |
| `v_print_report_index` | view | yes | 1 | yes | approved_browser_read_view |
| `v_production_backup_strategy_status` | view | yes | 2 | yes | approved_browser_read_view |
| `v_production_cutover_checklist` | view | yes | 2 | yes | approved_browser_read_view |
| `v_production_go_no_go_decision_queue` | view | yes | 2 | yes | approved_browser_read_view |
| `v_production_go_no_go_evidence_queue` | view | yes | 6 | yes | approved_browser_read_view |
| `v_production_go_no_go_monitoring_dashboard` | view | yes | 2 | yes | approved_browser_read_view |
| `v_production_go_no_go_summary` | view | yes | 1 | yes | approved_browser_read_view |
| `v_professional_audit_queue` | view | yes | 3 | yes | approved_browser_read_view |
| `v_professional_issue_capa_queue` | view | yes | 2 | yes | approved_browser_read_view |
| `v_professional_risk_compliance_queue` | view | yes | 3 | yes | approved_browser_read_view |
| `v_professional_workbench_summary` | view | yes | 7 | yes | approved_browser_read_view |
| `v_qa_readiness_summary` | view | yes | 13 | yes | approved_browser_read_view |
| `v_qa_test_case_library` | view | yes | 1 | yes | approved_browser_read_view |
| `v_qa_test_runs_summary` | view | yes | 2 | yes | approved_browser_read_view |
| `v_quality_accreditation_operating_summary` | view | yes | 8 | yes | approved_browser_read_view |
| `v_quality_accreditation_requirement_dashboard` | view | yes | 2 | yes | approved_browser_read_view |
| `v_quality_indicator_dashboard` | view | yes | 2 | yes | approved_browser_read_view |
| `v_quality_rca_capa_dashboard` | view | yes | 1 | yes | approved_browser_read_view |
| `v_quality_tracer_round_dashboard` | view | yes | 2 | yes | approved_browser_read_view |
| `v_radar_control_profile` | view | yes | 13 | yes | approved_browser_read_view |
| `v_real_action_queue` | view | yes | 1 | yes | approved_browser_read_view |
| `v_real_control_evidence_map` | view | yes | 2 | yes | approved_browser_read_view |
| `v_real_data_activation_queue` | view | yes | 2 | yes | approved_browser_read_view |
| `v_real_data_activation_summary` | view | yes | 6 | yes | approved_browser_read_view |
| `v_real_data_approval_queue` | view | yes | 3 | yes | approved_browser_read_view |
| `v_real_data_cutover_readiness` | view | yes | 5 | yes | approved_browser_read_view |
| `v_real_data_import_quality_queue` | view | yes | 2 | yes | approved_browser_read_view |
| `v_real_data_validation_queue` | view | yes | 3 | yes | approved_browser_read_view |
| `v_real_evidence_review_queue` | view | yes | 2 | yes | approved_browser_read_view |
| `v_real_gap_capa_queue` | view | yes | 3 | yes | approved_browser_read_view |
| `v_real_management_response_queue` | view | yes | 2 | yes | approved_browser_read_view |
| `v_real_master_data_coverage` | view | yes | 5 | yes | approved_browser_read_view |
| `v_real_standards_master_summary` | view | yes | 9 | yes | approved_browser_read_view |
| `v_real_standards_readiness_queue` | view | yes | 4 | yes | approved_browser_read_view |
| `v_real_uat_evidence_pack_readiness` | view | yes | 2 | yes | approved_browser_read_view |
| `v_real_uat_execution_summary` | view | yes | 7 | yes | approved_browser_read_view |
| `v_real_uat_finding_retest_queue` | view | yes | 3 | yes | approved_browser_read_view |
| `v_real_uat_run_queue` | view | yes | 4 | yes | approved_browser_read_view |
| `v_real_uat_signoff_readiness` | view | yes | 2 | yes | approved_browser_read_view |
| `v_real_workflow_execution_summary` | view | yes | 7 | yes | approved_browser_read_view |
| `v_recurring_review_queue` | view | yes | 3 | yes | approved_browser_read_view |
| `v_release_candidate_gates` | view | yes | 2 | yes | approved_browser_read_view |
| `v_release_factory_checks` | view | yes | 1 | yes | approved_browser_read_view |
| `v_release_factory_scorecard` | view | yes | 2 | yes | approved_browser_read_view |
| `v_release_migration_order` | view | yes | 1 | yes | approved_browser_read_view |
| `v_report_builder_catalog` | view | yes | 2 | yes | approved_browser_read_view |
| `v_restore_verification_status` | view | yes | 2 | yes | approved_browser_read_view |
| `v_risk_appetite_dashboard` | view | yes | 2 | yes | approved_browser_read_view |
| `v_rls_persona_lab` | view | yes | 2 | yes | approved_browser_read_view |
| `v_runtime_workflow_action_queue` | view | yes | 1 | yes | approved_browser_read_view |
| `v_runtime_workflow_action_summary` | view | yes | 4 | yes | approved_browser_read_view |
| `v_runtime_workflow_exception_dashboard` | view | yes | 1 | yes | approved_browser_read_view |
| `v_runtime_workflow_notification_outbox` | view | yes | 1 | yes | approved_browser_read_view |
| `v_scenario_matrix` | view | yes | 2 | yes | approved_browser_read_view |
| `v_security_access_findings` | view | yes | 2 | yes | approved_browser_read_view |
| `v_security_governance_summary` | view | yes | 11 | yes | approved_browser_read_view |
| `v_sensitive_activity_timeline` | view | yes | 3 | yes | approved_browser_read_view |
| `v_setup_readiness_checklist` | view | yes | 11 | yes | approved_browser_read_view |
| `v_sop_procedure_step_matrix` | view | yes | 4 | yes | approved_browser_read_view |
| `v_sop_traceability_matrix` | view | yes | 11 | yes | approved_browser_read_view |
| `v_sop_training_compliance_matrix` | view | yes | 7 | yes | approved_browser_read_view |
| `v_staging_validation_checks` | view | yes | 2 | yes | approved_browser_read_view |
| `v_staging_validation_summary` | view | yes | 4 | yes | approved_browser_read_view |
| `v_uat_findings_queue` | view | yes | 1 | yes | approved_browser_read_view |
| `v_uat_readiness_dashboard` | view | yes | 4 | yes | approved_browser_read_view |
| `v_ui_performance_summary` | view | yes | 2 | yes | approved_browser_read_view |
| `v_ultra_release_summary` | view | yes | 7 | yes | approved_browser_read_view |
| `v_user_management_roster` | view | yes | 9 | yes | approved_browser_read_view |
| `v_user_management_summary` | view | yes | 3 | yes | approved_browser_read_view |
| `v_v31_final_controls` | view | yes | 1 | yes | approved_browser_read_view |
| `v_v31_go_live_scorecard` | view | yes | 4 | yes | approved_browser_read_view |
| `v_v31_module_readiness` | view | yes | 1 | yes | approved_browser_read_view |
| `v_v31_pilot_acceptance` | view | yes | 1 | yes | approved_browser_read_view |
| `v_v31_support_handover` | view | yes | 1 | yes | approved_browser_read_view |
| `v_v33_pilot_waves` | view | yes | 1 | yes | approved_browser_read_view |
| `v_v33_production_artifacts` | view | yes | 1 | yes | approved_browser_read_view |
| `v_v33_production_proof_gates` | view | yes | 1 | yes | approved_browser_read_view |
| `v_v33_production_proof_scorecard` | view | yes | 4 | yes | approved_browser_read_view |
| `v_v34_company_rollout_readiness` | view | yes | 5 | yes | approved_browser_read_view |
| `v_v34_pilot_issue_board` | view | yes | 4 | yes | approved_browser_read_view |
| `v_v34_pilot_wave_summary` | view | yes | 5 | yes | approved_browser_read_view |
| `v_v34_real_data_import_readiness` | view | yes | 1 | yes | approved_browser_read_view |
| `v_v50_backup_restore_scorecard` | view | yes | 3 | yes | approved_browser_read_view |
| `v_v50_query_optimization_queue` | view | yes | 1 | yes | approved_browser_read_view |
| `v_v50_restore_dryrun_queue` | view | yes | 2 | yes | approved_browser_read_view |
| `v_v50_scale_readiness_scorecard` | view | yes | 1 | yes | approved_browser_read_view |
| `v_workflow_blockers` | view | yes | 2 | yes | approved_browser_read_view |
| `v_workflow_kernel_module_coverage` | view | yes | 3 | yes | approved_browser_read_view |
| `v_workflow_kernel_queue` | view | yes | 2 | yes | approved_browser_read_view |
| `v_workflow_kernel_sla_dashboard` | view | yes | 1 | yes | approved_browser_read_view |
| `v_workflow_kernel_summary` | view | yes | 4 | yes | approved_browser_read_view |
| `v35_consolidation_scorecard` | view | yes | 4 | yes | approved_browser_read_view |
| `v35_data_quality_radar` | view | yes | 1 | yes | approved_browser_read_view |
| `v35_final_blocker_board` | view | yes | 4 | yes | approved_browser_read_view |
| `v35_operator_console` | view | yes | 7 | yes | approved_browser_read_view |

## Findings

No unsafe authenticated-browser surface was found in the target migration state.

## Catalog hardening evidence

Views whose original declarations were owner-executed (the target catalog hardening must cover all of them):

- `v35_consolidation_scorecard`
- `v35_data_quality_radar`
- `v35_final_blocker_board`
- `v35_operator_console`
- `v_accreditation_gap_dashboard`
- `v_accreditation_readiness_summary`
- `v_accreditation_requirement_matrix`
- `v_activity_timeline`
- `v_admin_safety_console`
- `v_automation_command_summary`
- `v_automation_rule_catalog`
- `v_bilingual_dictionary_status`
- `v_board_pack_summary`
- `v_committee_action_automation`
- `v_consolidation_defect_dashboard`
- `v_critical_attention_items`
- `v_cross_module_relationship_map`
- `v_data_retention_readiness`
- `v_delay_reason_queue`
- `v_department_execution_summary`
- `v_department_scorecard_v2`
- `v_deployment_readiness_gates`
- `v_document_center_items`
- `v_document_center_summary`
- `v_due_reminder_queue`
- `v_escalation_center`
- `v_executive_command_stream`
- `v_executive_command_summary`
- `v_executive_exception_dashboard`
- `v_executive_grc_summary`
- `v_final_acceptance_tests`
- `v_final_consolidation_artifacts`
- `v_final_cutover_plan`
- `v_final_finish_fast_scorecard`
- `v_final_go_live_gateboard`
- `v_final_handover_signoffs`
- `v_final_owner_clearance`
- `v_global_search_index`
- `v_grc_kpi_scorecard`
- `v_i18n_translation_coverage`
- `v_kri_breach_register`
- `v_load_test_seed_status`
- `v_manager_inbox`
- `v_migration_runbook_status`
- `v_migration_verification_matrix`
- `v_mobile_readiness_gates`
- `v_module_payload_pressure`
- `v_monthly_grc_trend`
- `v_notification_digest`
- `v_operational_followup_summary`
- `v_permission_test_personas`
- `v_print_report_index`
- `v_production_cutover_checklist`
- `v_qa_readiness_summary`
- `v_qa_test_case_library`
- `v_qa_test_runs_summary`
- `v_recurring_review_queue`
- `v_report_builder_catalog`
- `v_restore_verification_status`
- `v_rls_persona_lab`
- `v_scenario_matrix`
- `v_sensitive_activity_timeline`
- `v_setup_readiness_checklist`
- `v_staging_validation_checks`
- `v_staging_validation_summary`
- `v_ui_performance_summary`
- `v_v31_go_live_scorecard`
- `v_v31_module_readiness`
- `v_v31_pilot_acceptance`
- `v_v31_support_handover`
- `v_v33_pilot_waves`
- `v_v33_production_artifacts`
- `v_v33_production_proof_gates`
- `v_v33_production_proof_scorecard`
- `v_v34_company_rollout_readiness`
- `v_v34_pilot_issue_board`
- `v_v34_pilot_wave_summary`
- `v_v34_real_data_import_readiness`
- `v_v50_query_optimization_queue`
- `v_v50_restore_dryrun_queue`
- `v_v50_scale_readiness_scorecard`
- `v_workflow_blockers`

Reachable base tables still lacking RLS in the target replay:

- None.

The audited legacy base-table correction is exact and grants SELECT only after RLS is enabled:

| Base table | Scope | Credential/RLS policy | Authenticated SELECT |
|---|---|---:|---:|
| `automation_rules` | organization_id | yes | yes |
| `automation_run_log` | organization_id | yes | yes |
| `consolidation_defect_log` | organization_id | yes | yes |
| `consolidation_defects` | credential-gated global metadata | yes | yes |
| `consolidation_patch_manifest` | credential-gated global metadata | yes | yes |
| `cutover_freeze_windows` | credential-gated global metadata | yes | yes |
| `executive_exception_rules` | organization_id | yes | yes |
| `final_handover_signoffs` | organization_id | yes | yes |
| `go_live_rehearsals` | organization_id | yes | yes |
| `go_live_sop_steps` | credential-gated global metadata | yes | yes |
| `kri_observations` | organization_id | yes | yes |
| `load_test_seed_batches` | organization_id | yes | yes |
| `migration_runbook_entries` | organization_id | yes | yes |
| `pilot_fix_sprints` | credential-gated global metadata | yes | yes |
| `pilot_issues` | organization_id | yes | yes |
| `pilot_participants` | organization_id | yes | yes |
| `pilot_rollout_acceptance` | credential-gated global metadata | yes | yes |
| `pilot_signoffs` | organization_id | yes | yes |
| `pilot_waves` | organization_id | yes | yes |
| `production_operator_daily_log` | credential-gated global metadata | yes | yes |
| `production_pilot_waves` | organization_id | yes | yes |
| `production_proof_gates` | organization_id | yes | yes |
| `production_support_handover` | credential-gated global metadata | yes | yes |
| `real_data_repair_queue` | credential-gated global metadata | yes | yes |
| `recurring_reviews` | organization_id | yes | yes |
| `staging_validation_check_results` | organization_id | yes | yes |
| `staging_validation_cycles` | organization_id | yes | yes |
| `v50_query_optimization_items` | credential-gated global metadata | yes | yes |
| `v50_scale_test_plans` | credential-gated global metadata | yes | yes |

193 direct browser views rely on an ACL outside an explicit per-view repository GRANT. Their call sites prove product intent; final hosted catalog ACL evidence remains mandatory.

## Proof command

Run `node scripts/patch83u-auth-surface-proof.mjs`. It exits non-zero for a direct browser RPC, exposed SECURITY DEFINER RPC, pending direct-browser exception, owner-executed view, materialized view, missing intentional grant, non-RLS base table, missing Patch 83U credential gate, or unresolved dependency. Use `--report-only` only while preparing a corrective migration.
