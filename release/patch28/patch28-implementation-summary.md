# Patch 28 CAPA / Action Plan Execution Hardening

Generated: 2026-07-03

## Branch

- Base branch: `patch27-approval-authority-matrix`
- Patch branch: `patch28-capa-action-plan-hardening`

## Scope Implemented

Patch 28 adds an additive CAPA/action-plan execution foundation. It does not redesign the UI, run migrations, reset the database, weaken RLS, touch Patch 20 import logic, rewrite Patch 21 OVR, rewrite Patch 22 Risk, rewrite Patch 23 Evidence, rewrite Patch 24 Audit Findings, rewrite Patch 25 Compliance, rewrite Patch 26 Document Control, or start Patch 29.

## Migration

- `supabase/migrations/091_patch28_capa_action_plan_hardening.sql`

## Tables

- `public.capa_action_plans`
- `public.capa_action_items`
- `public.capa_events`
- `public.capa_due_date_extensions`
- `public.capa_effectiveness_reviews`
- `public.capa_links`

## Views

- `public.v_patch28_capa_register`
- `public.v_patch28_open_capa_queue`
- `public.v_patch28_overdue_capa`
- `public.v_patch28_capa_action_item_queue`
- `public.v_patch28_capa_closure_blockers`
- `public.v_patch28_capa_evidence_gap_dashboard`
- `public.v_patch28_capa_effectiveness_review_queue`
- `public.v_patch28_capa_executive_escalations`
- `public.v_patch28_repeat_capa_signals`
- `public.v_patch28_capa_link_index`

## Workflow Functions

- `public.create_capa_action_plan`
- `public.assign_capa_action_plan`
- `public.submit_capa_action_plan`
- `public.approve_capa_action_plan`
- `public.reject_capa_action_plan`
- `public.create_capa_action_item`
- `public.update_capa_action_item_status`
- `public.submit_capa_completion`
- `public.validate_capa_completion`
- `public.reject_capa_completion`
- `public.request_capa_due_date_extension`
- `public.approve_capa_due_date_extension`
- `public.reject_capa_due_date_extension`
- `public.start_capa_effectiveness_review`
- `public.complete_capa_effectiveness_review`
- `public.request_capa_closure`
- `public.approve_capa_closure`
- `public.reject_capa_closure`
- `public.escalate_capa`
- `public.reopen_capa_with_reason`
- `public.cancel_capa_with_reason`
- `public.link_capa_to_item`
- `public.mark_repeat_capa`

## Governance Rules

- CAPA closure is blocked when action items remain incomplete.
- CAPA closure is blocked when accepted/satisfied/waived evidence is required but not present.
- CAPA closure is blocked until validation is approved when validation is required.
- CAPA closure is blocked until effectiveness review passes when required.
- Rejection, due-date extension, escalation, reopening, and cancellation require reasons.
- Every workflow action writes to `public.capa_events`.
- Privileged workflow functions are security-definer, use safe `search_path`, and are service-role only.
- CAPA links support OVR, Risk, Audit Findings, Compliance Obligations, Evidence, Document Control, Approval Requests, Projects, Tasks, Training, and related governance objects.

## UI/API

- UI changes skipped for Patch 28 to keep this patch backend/proof focused and isolated.
- API changes skipped for Patch 28; the migration exposes controlled RPCs for later API wiring.

