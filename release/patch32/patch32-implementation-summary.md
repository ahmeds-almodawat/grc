# Patch 32 Accreditation Traceability Matrix

Generated: 2026-07-03

## Branch

- Branch: `patch32-accreditation-traceability-matrix`
- Base: `main` after Patch 31 merge

## Scope

Patch 32 adds a backend and proof foundation for accreditation traceability. It connects accreditation standards and clauses to controls, SOPs/documents, evidence, CAPA, risks, audit findings, training, approval authority, and policy records through a governed link table and assessment history.

This patch does not touch payroll-sensitive fields, Patch 20 import logic, production data, unrelated modules, destructive migrations, RLS weakening, broad `SECURITY DEFINER` grants, or service-role-only frontend exposure.

## Migration

- `supabase/migrations/095_patch32_accreditation_traceability_matrix.sql`

## Tables

- `public.accreditation_standards`
- `public.accreditation_clauses`
- `public.accreditation_clause_links`
- `public.accreditation_clause_assessments`
- `public.accreditation_traceability_events`

## Views

- `public.v_patch32_accreditation_clause_register`
- `public.v_patch32_clause_traceability_matrix`
- `public.v_patch32_clause_evidence_gap_summary`
- `public.v_patch32_clause_sop_document_gap_summary`
- `public.v_patch32_clause_capa_risk_audit_summary`
- `public.v_patch32_clause_training_readiness_summary`
- `public.v_patch32_department_accreditation_readiness`
- `public.v_patch32_accreditation_executive_summary`
- `public.v_patch32_accreditation_exception_register`
- `public.v_patch32_accreditation_review_queue`

## Functions

- `public.create_accreditation_standard`
- `public.create_accreditation_clause`
- `public.link_accreditation_clause_entity`
- `public.unlink_accreditation_clause_entity`
- `public.assess_accreditation_clause`
- `public.mark_accreditation_clause_not_applicable`
- `public.reopen_accreditation_clause_assessment`
- `public.record_accreditation_traceability_event`
- `public.get_accreditation_clause_traceability`
- `public.get_accreditation_readiness_summary`
- `public.patch32_actor_has_accreditation_authority`

## Traceability Coverage

Supported clause link entity types:

- `control`
- `sop`
- `document`
- `evidence`
- `capa`
- `risk`
- `audit_finding`
- `training_program`
- `training_assignment`
- `approval_authority`
- `policy`

Supported assessment statuses:

- `not_assessed`
- `ready`
- `partial_gap`
- `major_gap`
- `not_applicable`
- `pending_evidence`
- `pending_owner_review`

## Security Model

- RLS enabled on all new tables.
- Read policies use existing role helpers for executive, governance, audit, compliance, and department manager visibility.
- Write policies are limited to governance/admin/compliance roles, with auditor assessment participation where appropriate.
- Mutating functions are `SECURITY DEFINER`, use safe `search_path`, require service-role execution, and validate actor authority.
- All function execute privileges are revoked from `public`, `anon`, and `authenticated`; execution is granted only to `service_role`.
- Views are marked `security_invoker`.

## Frontend/API

No frontend or API page was added. The optional UI scope was skipped to keep Patch 32 focused on the accreditation traceability layer and avoid broad navigation/UI changes.

## Proof

- `release/patch32/patch32-schema-proof.json`
- `release/patch32/patch32-traceability-proof.json`

