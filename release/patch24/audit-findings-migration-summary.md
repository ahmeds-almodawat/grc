# Patch 24 Audit Findings Migration Summary

Migration: `supabase/migrations/086_patch24_audit_findings_workflow_hardening.sql`

The migration is additive. It preserves the existing `audit_findings.status` enum and adds Patch 24 lifecycle fields through text-backed workflow columns.

## Table Extensions
`audit_findings` receives:
- Lifecycle and stage fields.
- Owner, audit manager, responsible department and sponsor fields.
- Management response fields.
- Corrective action plan fields.
- Root cause, recurrence, repeat and systemic fields.
- Evidence gate and closure validation fields.
- Escalation, executive visibility and committee review fields.

## New Tables
- `audit_finding_due_date_extensions`: governed extension requests and decisions.
- `audit_finding_validation_events`: append-only lifecycle event log.

## Views
- `v_patch24_audit_finding_workflow_queue`
- `v_patch24_overdue_audit_findings`
- `v_patch24_repeat_audit_findings`
- `v_patch24_audit_closure_gate_status`
- `v_patch24_audit_executive_escalations`
- `v_patch24_audit_closure_pack_index`

## Functions
- `patch24_audit_closure_satisfied`
- `patch24_write_audit_event`
- `patch24_audit_finding_workflow_bridge`

The existing audit closure guard is updated to accept Patch 23 evidence links and approved waivers while keeping closure blocked when audit validation is missing.
