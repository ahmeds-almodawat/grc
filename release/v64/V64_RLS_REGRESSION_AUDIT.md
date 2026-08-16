# v6.4 RLS PR Regression Audit

Status: **passed**

```json
{
  "base_unresolved_critical": 0,
  "base_unresolved_high": 6,
  "inherited_unresolved_critical": 0,
  "inherited_unresolved_high": 6,
  "resolved_critical": 0,
  "resolved_high": 0,
  "new_critical": 0,
  "new_high": 0,
  "new_unsafe_browser_grants": 0,
  "head_controlled_deny_all": 20,
  "strict_regression_passed": true
}
```

## Inherited unresolved blockers

- **INHERITED UNRESOLVED** high RLS_NO_POLICY_FOUND: `patch83b_release_migration_events` (supabase/migrations/186_legacy_role_scope_reconciliation.sql)
- **INHERITED UNRESOLVED** high RLS_NO_POLICY_FOUND: `patch83u_runtime_control` (supabase/migrations/174_patch83u_employee_id_auth_and_credential_governance.sql)
- **INHERITED UNRESOLVED** high RLS_NO_POLICY_FOUND: `user_account_provisioning` (supabase/migrations/173_patch83t_controlled_user_excel_import.sql)
- **INHERITED UNRESOLVED** high RLS_NO_POLICY_FOUND: `user_credential_events` (supabase/migrations/174_patch83u_employee_id_auth_and_credential_governance.sql)
- **INHERITED UNRESOLVED** high RLS_NO_POLICY_FOUND: `user_credential_states` (supabase/migrations/174_patch83u_employee_id_auth_and_credential_governance.sql)
- **INHERITED UNRESOLVED** high RLS_NO_POLICY_FOUND: `user_credential_suspended_roles` (supabase/migrations/174_patch83u_employee_id_auth_and_credential_governance.sql)

## Resolved blockers

None.

## Newly introduced blockers

None.

## Controlled deny-all observations at HEAD

- **CONTROLLED_DENY_ALL** `f1r2_evidence_link_reconciliation` (supabase/migrations/196_f1r2_business_cycle_remediation.sql)
- **CONTROLLED_DENY_ALL** `organization_ovr_analytics_config` (supabase/migrations/194_ovr_executive_analytics_foundation.sql)
- **CONTROLLED_DENY_ALL** `organization_reporting_lines` (supabase/migrations/191_ovr_relationship_conflict_foundation.sql)
- **CONTROLLED_DENY_ALL** `ovr_conflict_events` (supabase/migrations/191_ovr_relationship_conflict_foundation.sql)
- **CONTROLLED_DENY_ALL** `ovr_executive_analytics_audit` (supabase/migrations/194_ovr_executive_analytics_foundation.sql)
- **CONTROLLED_DENY_ALL** `ovr_executive_analytics_requests` (supabase/migrations/194_ovr_executive_analytics_foundation.sql)
- **CONTROLLED_DENY_ALL** `ovr_executive_analytics_snapshots` (supabase/migrations/194_ovr_executive_analytics_foundation.sql)
- **CONTROLLED_DENY_ALL** `ovr_final_verdicts` (supabase/migrations/193_ovr_immutable_verdict_closure_foundation.sql)
- **CONTROLLED_DENY_ALL** `ovr_governance_closures` (supabase/migrations/193_ovr_immutable_verdict_closure_foundation.sql)
- **CONTROLLED_DENY_ALL** `ovr_post_closure_reviews` (supabase/migrations/193_ovr_immutable_verdict_closure_foundation.sql)
- **CONTROLLED_DENY_ALL** `ovr_related_persons` (supabase/migrations/191_ovr_relationship_conflict_foundation.sql)
- **CONTROLLED_DENY_ALL** `ovr_relationship_state` (supabase/migrations/191_ovr_relationship_conflict_foundation.sql)
- **CONTROLLED_DENY_ALL** `ovr_reporter_responses` (supabase/migrations/193_ovr_immutable_verdict_closure_foundation.sql)
- **CONTROLLED_DENY_ALL** `ovr_review_cycles` (supabase/migrations/192_ovr_reviewer_routing_foundation.sql)
- **CONTROLLED_DENY_ALL** `ovr_reviewer_assignments` (supabase/migrations/192_ovr_reviewer_routing_foundation.sql)
- **CONTROLLED_DENY_ALL** `ovr_reviewer_pool_memberships` (supabase/migrations/192_ovr_reviewer_routing_foundation.sql)
- **CONTROLLED_DENY_ALL** `ovr_routing_events` (supabase/migrations/192_ovr_reviewer_routing_foundation.sql)
- **CONTROLLED_DENY_ALL** `ovr_separation_policies` (supabase/migrations/193_ovr_immutable_verdict_closure_foundation.sql)
- **CONTROLLED_DENY_ALL** `ovr_stage_instances` (supabase/migrations/192_ovr_reviewer_routing_foundation.sql)
- **CONTROLLED_DENY_ALL** `ovr_workflow_events_v11` (supabase/migrations/193_ovr_immutable_verdict_closure_foundation.sql)
