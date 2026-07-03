# Patch 32 Validation Report

Generated: 2026-07-03

## Branch

- Branch: `patch32-accreditation-traceability-matrix`
- Base: `main` after Patch 31 merge

## Files Changed

- `package.json`
- `scripts/patch32-accreditation-schema-proof.mjs`
- `scripts/patch32-accreditation-traceability-proof.mjs`
- `supabase/migrations/095_patch32_accreditation_traceability_matrix.sql`
- `release/patch32/patch32-implementation-summary.md`
- `release/patch32/patch32-schema-proof.json`
- `release/patch32/patch32-traceability-proof.json`
- `release/patch32/patch32-validation-report.md`

## Migration

- Created: `supabase/migrations/095_patch32_accreditation_traceability_matrix.sql`

## Tables Added

- `public.accreditation_standards`
- `public.accreditation_clauses`
- `public.accreditation_clause_links`
- `public.accreditation_clause_assessments`
- `public.accreditation_traceability_events`

## Views Added

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

## Functions Added

- `public.patch32_actor_has_accreditation_authority`
- `public.record_accreditation_traceability_event`
- `public.create_accreditation_standard`
- `public.create_accreditation_clause`
- `public.link_accreditation_clause_entity`
- `public.unlink_accreditation_clause_entity`
- `public.assess_accreditation_clause`
- `public.mark_accreditation_clause_not_applicable`
- `public.reopen_accreditation_clause_assessment`
- `public.get_accreditation_clause_traceability`
- `public.get_accreditation_readiness_summary`

## Frontend/API

- Frontend page: not added
- API file: not added
- Reason: optional scope was skipped to keep Patch 32 focused on the accreditation traceability database/proof layer and avoid broad UI/navigation changes.

## Package Scripts Added

- `patch32:schema-proof`
- `patch32:traceability-proof`
- `patch32:all`

## Traceability Status Summary

- Supported link types: `control`, `sop`, `document`, `evidence`, `capa`, `risk`, `audit_finding`, `training_program`, `training_assignment`, `approval_authority`, `policy`
- Supported assessment statuses: `not_assessed`, `ready`, `partial_gap`, `major_gap`, `not_applicable`, `pending_evidence`, `pending_owner_review`
- `service_role_only_rpc_called_by_frontend`: 0
- `remaining_broad_security_definer_execute_grants`: 0
- Runtime security status: passed

## Validation Results

- `git status --short --branch`: ran before and after validation
- `git diff --stat`: ran
- Conflict marker scan: passed, no markers found
- `npm run typecheck`: passed
- `npm run build`: passed
- `npm run patch32:all`: passed
- `npm run proof:all`: passed, 17/17 gates
- `npm run v700:runtime-security`: passed

## Generated Release Noise

Generated `release/v*` timestamp/report noise was restored after validation with:

```powershell
git restore release/v62 release/v64 release/v66 release/v661 release/v662 release/v663 release/v672 release/v673 release/v674 release/v700 release/v72
```

Restore status: yes.

## Safety Conclusion

Patch 32 is safe to review and prepare for commit. It adds accreditation traceability tables, role-aware RLS, security-invoker reporting views, and service-role-only guarded workflow functions without broad execute grants or frontend service-role exposure.

