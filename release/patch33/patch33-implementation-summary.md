# Patch 33 Evidence Bridge / Live Clause-to-Control-to-Evidence Operation

Generated: 2026-07-03

## Branch

- Branch: `patch33-evidence-bridge-live-operation`
- Base: `main` after Patch 32 merge

## Scope

Patch 33 adds the live operating evidence bridge that connects accreditation clauses, controls, documents/SOPs, evidence, CAPA, risks, audit findings, training, policy, and approval authority through an operational evidence readiness layer.

This patch does not touch payroll-sensitive fields, Patch 20 import logic, destructive migrations, production data, unrelated modules, RLS weakening, broad `SECURITY DEFINER` grants, service-role-only frontend exposure, OCR/file upload automation, or external accreditation portal integration.

## Existing Schema Reuse

The repo already contains evidence governance, document control, CAPA, risk, audit finding, training, and accreditation traceability tables. Patch 33 reuses Patch 32 `accreditation_clauses` as a confirmed FK and keeps module item references generic with `linked_entity_type` plus `linked_entity_id` to avoid brittle foreign keys across older/newer module table variants.

## Migration

- `supabase/migrations/096_patch33_evidence_bridge_live_operation.sql`

## Tables

- `public.evidence_bridge_links`
- `public.evidence_collection_requests`
- `public.evidence_bridge_reviews`
- `public.evidence_bridge_events`

## Views

- `public.v_patch33_clause_control_evidence_bridge`
- `public.v_patch33_live_evidence_gap_register`
- `public.v_patch33_evidence_collection_queue`
- `public.v_patch33_overdue_evidence_requests`
- `public.v_patch33_stale_expired_evidence_register`
- `public.v_patch33_evidence_review_queue`
- `public.v_patch33_department_evidence_readiness`
- `public.v_patch33_clause_evidence_readiness`
- `public.v_patch33_capa_training_sop_evidence_dependencies`
- `public.v_patch33_accreditation_live_readiness_summary`
- `public.v_patch33_evidence_exception_register`
- `public.v_patch33_executive_evidence_bridge_summary`

## Functions

- `public.create_evidence_bridge_link`
- `public.update_evidence_bridge_status`
- `public.create_evidence_collection_request`
- `public.submit_evidence_collection_request`
- `public.review_evidence_bridge_submission`
- `public.accept_evidence_bridge_submission`
- `public.reject_evidence_bridge_submission`
- `public.waive_evidence_collection_request`
- `public.reopen_evidence_collection_request`
- `public.mark_evidence_bridge_not_applicable`
- `public.refresh_evidence_freshness_status`
- `public.record_evidence_bridge_event`
- `public.get_clause_evidence_bridge`
- `public.get_live_evidence_readiness_summary`
- `public.patch33_actor_has_evidence_bridge_authority`
- `public.patch33_actor_can_submit_request`

## Operational Coverage

Supported relationship types:

- `clause`
- `control`
- `evidence`
- `document`
- `sop`
- `capa`
- `risk`
- `audit_finding`
- `training_program`
- `training_assignment`
- `policy`
- `approval_authority`
- `other`

Supported evidence statuses:

- `missing`
- `pending_collection`
- `pending_review`
- `accepted`
- `rejected`
- `stale`
- `expired`
- `not_applicable`

Supported collection request statuses:

- `open`
- `in_progress`
- `submitted`
- `under_review`
- `accepted`
- `rejected`
- `overdue`
- `cancelled`
- `waived`

Supported review statuses:

- `pending_review`
- `accepted`
- `rejected`
- `needs_rework`
- `waived`

Supported freshness statuses:

- `current`
- `due_soon`
- `stale`
- `expired`
- `unknown`

## Security Model

- RLS enabled on all new tables.
- Governance/compliance/audit roles manage bridge links, reviews, and authoritative status changes.
- Assigned evidence owners may safely update their own collection requests.
- Mutating workflow functions are `SECURITY DEFINER`, use safe `search_path`, require service-role execution, and validate actor authority.
- All function execute privileges are revoked from `public`, `anon`, and `authenticated`; execution is granted only to `service_role`.
- Views are marked `security_invoker`.

## Frontend/API

No frontend or API page was added. The optional UI scope was skipped to keep Patch 33 focused on the live evidence bridge backend/proof layer and avoid broad UI/navigation changes.

## Proof

- `release/patch33/patch33-schema-proof.json`
- `release/patch33/patch33-workflow-proof.json`

