# Release Notes

## v0.2

Added:

- Supabase API service layer
- Dashboard live/fallback data loading
- Critical attention dashboard view support
- Projects page live/fallback data loading
- New draft Action Plan form
- Risk, Compliance, Audit and Governance list pages
- Operational migration 005 for storage and dashboard views
- Better README and implementation notes

Still pending:

- Authentication UI
- Project detail page
- Milestones CRUD
- Tasks CRUD
- Evidence upload and review
- Approval workflow UI
- Employee workspace
- Executive escalation workflow

## v0.3.0 - Batched workflow build

Added in this larger batch:

- My Work page for employee/task-owner workspace.
- Approvals page with approve/reject actions.
- Evidence Center page with accept/revise/reject review actions.
- Project detail modal with milestones and tasks.
- Create milestone and create task forms inside project detail.
- Create Risk form.
- Create Compliance Obligation form.
- Create Audit Finding form.
- Create Governance Decision form.
- Extended Supabase service/API layer for CRUD operations.
- Migration 006 with expanded workflow queue views.
- Department execution summary view for future dashboards.
- Project progress refresh trigger from milestones and tasks.

This version intentionally batches multiple changes into one package to reduce repeated ZIP downloads.

## v0.4.0 - Patch Package Delivery

This version is delivered as a replacement-file patch instead of a full project ZIP.

### Added

- Project, milestone, and task control actions.
- Status update modal with delay reason validation.
- Evidence upload modal connected to Supabase Storage.
- Approval request modal connected to `approvals`.
- Employee My Work control actions.
- Department Control Room page for 50-department executive tracking.
- Department summary search and attention-only filter.

### Changed

- Sidebar now includes Department Control.
- Project detail now includes project-level controls and row-level milestone/task controls.
- My Work page is now interactive instead of read-only.

### Technical

- Added `WorkItemControls.tsx`.
- Added `Departments.tsx`.
- Extended `grcApi.ts` with `updateProjectStatus`, `updateMilestoneStatus`, `uploadEvidenceForItem`, `requestApproval`, and `getDepartmentExecutionSummary`.
- Extended domain types with `DepartmentExecutionSummary`.

### Migration

No new migration required. Uses existing migrations 001–006.


## v0.7 Patch - Access Control & Role Governance

- Added Access Control Center page for role visibility and safe admin review.
- Added role assignment/deactivation service calls through Supabase RPC functions.
- Added access-control summary cards: active users, active roles, global roles, warnings, users without roles.
- Added user access matrix with active role badges, org scope, workload, pending approvals, and role removal controls.
- Added access warnings for global sensitive roles, broad employee/viewer scope, department manager scope mismatch, and missing scope references.
- Added migration `009_access_control_and_role_governance.sql`.
- Added `role_change_audit` table to record role assignment/deactivation history.
- Added admin-safe RPC functions `assign_user_role` and `deactivate_user_role`.
- Updated package version to `0.7.0`.
