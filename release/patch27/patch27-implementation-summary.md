# Patch 27 Implementation Summary

Date: 2026-07-03

## Scope

Patch 27 adds a central Approval Authority Matrix backend foundation for GRC workflows. It defines who can approve workflow actions by workflow type, action type, linked item type, department, role, approver, amount, risk/severity/criticality, document type, escalation level, required approval count, self-approval rules, delegation, and exceptional overrides.

## Base

- Base branch: `main` / V81
- Current branch: `patch27-approval-authority-matrix`
- Patch 26 was clean before this branch was created.

## Migration

- Added: `supabase/migrations/090_patch27_approval_authority_matrix.sql`

## Tables Added

- `approval_authority_rules`
- `approval_requests`
- `approval_decisions`
- `approval_authority_events`
- `approval_delegations`
- `approval_authority_overrides`

## Views Added

- `v_patch27_active_authority_rules`
- `v_patch27_pending_approval_requests`
- `v_patch27_overdue_approval_requests`
- `v_patch27_approval_decision_history`
- `v_patch27_authority_rule_coverage`
- `v_patch27_executive_approval_queue`
- `v_patch27_approval_bottlenecks`
- `v_patch27_unmatched_approval_requests`
- `v_patch27_active_approval_delegations`
- `v_patch27_approval_override_register`

## Functions Added

- `create_approval_authority_rule`
- `update_approval_authority_rule`
- `disable_approval_authority_rule`
- `request_workflow_approval`
- `record_approval_decision`
- `reject_approval_request`
- `return_approval_request_for_correction`
- `escalate_approval_request`
- `cancel_approval_request`
- `create_approval_delegation`
- `revoke_approval_delegation`
- `override_approval_request_with_reason`
- `resolve_approval_authority_rule`
- `check_user_approval_authority`
- Internal event helper: `patch27_write_authority_event`

## Compatibility

Patch 27 is generic and references workflow types for OVR, Risk, Evidence, Audit Findings, Compliance Obligations, Document Control/SOPs, CAPA, Projects, Access Control, Financial approvals, and General approvals. It does not modify earlier workflow patches.

## Explicitly Skipped

- Patch 28 CAPA
- Patch 29 Training/Competency
- Broad UI redesign
- Prior workflow rewrites
- Patch 20 import logic
- Payroll-sensitive fields
