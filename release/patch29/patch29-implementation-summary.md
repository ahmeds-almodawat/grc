# Patch 29 Implementation Summary
**Scope**: Training, Acknowledgment & Competency Governance.
**Purpose**: Add a professional training governance layer connected to SOP/document control, approval authority, CAPA, compliance, audit, risk, and accreditation readiness.

## Database Objects

### 1. New Tables Added
- `training_programs`: Holds training materials, SOP/document link, compliance obligations, CAPA action plans, risks, audit findings, owner, department, and active status.
- `training_assignments`: Matches a training program to a user, role, or department, including statuses (`assigned`, `in_progress`, `completed`, `overdue`, `waived`, `cancelled`), due date, completion evidence ID, etc.
- `training_acknowledgments`: Stores individual compliance SOP/policy read acknowledgments, containing user ID, IP address, user agent, and evidence ID.
- `competency_assessments`: Tracks user competency evaluations by assessors, including competency area, score, result (`passed`, `failed`, `needs_retraining`, `pending`), notes, and evidence.
- `training_events`: Stores structured event logs for auditing actions (e.g., assignment, start, completion, waiver, cancellation, competency check).

### 2. New Views Added
- `v_patch29_training_program_register`: Flat registry of training courses with owners and departments.
- `v_patch29_training_assignment_queue`: Flat assignment queue showing program details and assigned operators.
- `v_patch29_overdue_training_assignments`: Filtered assignments where status is not completed and due date is in the past.
- `v_patch29_sop_acknowledgment_gap`: Cross-joins active users and active SOP training programs, filtering out completed acknowledgments to show gaps.
- `v_patch29_competency_gap_dashboard`: Lists active users with competency failures, needs retraining, or missing assessments.
- `v_patch29_training_evidence_index`: Indexes completion evidence files associated with training assignments.
- `v_patch29_training_executive_summary`: KPI counts for active programs, pending assignments, completed training, overdue tasks, SOP gaps, and competency issues.
- `v_patch29_accreditation_training_readiness`: Completion rates grouped by training program for accreditation courses.

### 3. PL/pgSQL Functions (RPCs)
Every RPC function is declared `security definer` with a safe `search_path`, has `public, anon, authenticated` execute permissions revoked, and is restricted solely to the `service_role`.
- `create_training_program`
- `assign_training_program_to_user`
- `assign_training_program_to_department`
- `start_training_assignment`
- `complete_training_assignment`
- `acknowledge_training_assignment`
- `waive_training_assignment_with_reason`
- `cancel_training_assignment_with_reason`
- `record_competency_assessment`
- `reopen_training_assignment_with_reason`
- `link_training_evidence`

---

## Security Layer
- RLS enabled on all new tables (`training_programs`, `training_assignments`, `training_acknowledgments`, `competency_assessments`, `training_events`).
- Views are protected using PostgreSQL's `security_invoker = true` option to propagate the caller's RLS context.
- Audit trailing logs all state transitions into the `training_events` registry.

---

## Client API and Frontend Page
- **API File**: [trainingGovernanceApi.ts](file:///C:/Users/molte/Downloads/grc-control-center/src/lib/trainingGovernanceApi.ts) contains all client wrappers with Supabase client bindings, offline empty array/object fallbacks, and privileged edge-bridge RPC triggers.
- **Frontend Component**: [TrainingGovernanceCenter.tsx](file:///C:/Users/molte/Downloads/grc-control-center/src/pages/TrainingGovernanceCenter.tsx) is a beautiful, tabbed command dashboard showcasing training registries, assignment queues, overdue tasks, competency gaps, and evidence indices.
- **Bilingual Support**: Fully localized English and Arabic labels.
