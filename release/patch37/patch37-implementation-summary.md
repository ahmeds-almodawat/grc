# Patch 37 Implementation Summary

Generated: 2026-07-03

## Scope

Patch 37 adds the Audit + OVR Clinical Governance Engine as an additive execution layer.

## Migration

- `supabase/migrations/098_patch37_audit_ovr_clinical_governance_engine.sql`

## Tables Added

- `audit_execution_engagements`
- `audit_execution_programs`
- `audit_execution_test_steps`
- `audit_execution_samples`
- `audit_execution_results`
- `audit_execution_findings`
- `audit_execution_signoffs`
- `ovr_rca_cases`
- `ovr_capa_evidence_links`
- `clinical_governance_escalations`
- `clinical_governance_events`

## Views Added

- `v_patch37_audit_engagement_register`
- `v_patch37_audit_test_step_queue`
- `v_patch37_audit_sample_result_register`
- `v_patch37_audit_finding_register`
- `v_patch37_audit_findings_requiring_capa_or_evidence`
- `v_patch37_audit_signoff_queue`
- `v_patch37_ovr_rca_case_register`
- `v_patch37_ovr_capa_evidence_bridge`
- `v_patch37_clinical_governance_escalation_register`
- `v_patch37_overdue_audit_ovr_governance_items`
- `v_patch37_department_clinical_governance_workload`
- `v_patch37_executive_clinical_governance_summary`

## Functions Added

Audit execution functions create/start/close/reopen engagements, create programs/test steps/samples/results/findings, link findings to CAPA/evidence bridge, and manage signoffs.

OVR/RCA functions create/update/close RCA cases, link incidents to CAPA/evidence/accreditation/risk/audit/document/training/control entities, manage clinical escalations, and return summary payloads.

## Frontend/API

- Added `src/lib/clinicalGovernanceApi.ts`.
- Added `src/pages/ClinicalGovernanceCenter.tsx`.
- Added `Clinical Governance` to the Quality/Safety hub near OVR and accreditation operations.

## Security

- RLS enabled on all new tables.
- Views are marked `security_invoker`.
- Workflow functions use `security definer`, safe `search_path`, service-role-only grants, and the existing authenticated bridge pattern from the frontend.
- Event logging is required for workflow transitions and summary access.

## Integration Assumptions

- Existing OVR core tables are not modified; Patch 37 uses nullable `ovr_id` references to avoid brittle legacy foreign keys.
- CAPA linkage uses generic UUID references to avoid coupling to evolving CAPA table variants.
- Evidence Bridge integration uses Patch 33 `evidence_bridge_links` and `v_patch33_clause_control_evidence_bridge`.
- Accreditation integration uses Patch 32 `accreditation_clauses`.
