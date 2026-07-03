# Patch 35 Accreditation Clause Owner Workflow

Patch 35 makes accreditation operational by adding owner assignments, review cycles, task queues, signoff records, escalations, event history, and executive workload views.

## Migration

- `supabase/migrations/097_patch35_accreditation_clause_owner_workflow.sql`

## Tables

- `accreditation_clause_owner_assignments`
- `accreditation_review_cycles`
- `accreditation_clause_review_tasks`
- `accreditation_clause_signoffs`
- `accreditation_workflow_escalations`
- `accreditation_workflow_events`

## Views

- `v_patch35_clause_owner_register`
- `v_patch35_active_review_cycles`
- `v_patch35_clause_owner_task_queue`
- `v_patch35_overdue_clause_tasks`
- `v_patch35_clause_reviewer_signoff_queue`
- `v_patch35_department_accreditation_workload`
- `v_patch35_clause_blocker_summary`
- `v_patch35_clause_signoff_register`
- `v_patch35_escalation_register`
- `v_patch35_accreditation_operations_dashboard`
- `v_patch35_executive_accreditation_workflow_summary`
- `v_patch35_ready_for_survey_review_queue`

## Workflow Functions

- `assign_accreditation_clause_owner`
- `transfer_accreditation_clause_owner`
- `create_accreditation_review_cycle`
- `start_accreditation_review_cycle`
- `complete_accreditation_review_cycle`
- `create_accreditation_clause_review_task`
- `submit_accreditation_clause_task`
- `approve_accreditation_clause_task`
- `reject_accreditation_clause_task`
- `reopen_accreditation_clause_task`
- `signoff_accreditation_clause`
- `reject_accreditation_clause_signoff`
- `escalate_accreditation_clause_task`
- `acknowledge_accreditation_escalation`
- `resolve_accreditation_escalation`
- `record_accreditation_workflow_event`
- `get_accreditation_operations_dashboard`
- `get_clause_owner_workload`

## Integration

- Uses Patch 32 `accreditation_clauses` and `accreditation_standards`.
- Uses Patch 33 `v_patch33_clause_control_evidence_bridge` for evidence and dependency blockers.
- Exposes views ready for a later frontend/API operations center.

## Frontend/API

- No frontend/API page was added in Patch 35.
- This patch is backend/proof focused to avoid UI churn while establishing the workflow contract.

## Security

- RLS enabled on all new tables.
- Conservative read/write policies.
- Workflow RPCs are service-role only with safe `search_path`.
- Events are written for assignment, transfer, cycle, task, signoff, escalation, and workload/dashboard actions.
