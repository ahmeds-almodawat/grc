# Patch 33 Validation Report

Generated: 2026-07-03

## Branch

- Branch: `patch33-evidence-bridge-live-operation`

## Files Changed

- `package.json`
- `scripts/patch33-evidence-bridge-schema-proof.mjs`
- `scripts/patch33-evidence-bridge-workflow-proof.mjs`
- `supabase/migrations/096_patch33_evidence_bridge_live_operation.sql`
- `release/patch33/patch33-implementation-summary.md`
- `release/patch33/patch33-schema-proof.json`
- `release/patch33/patch33-workflow-proof.json`
- `release/patch33/patch33-validation-report.md`

## Migration

- `supabase/migrations/096_patch33_evidence_bridge_live_operation.sql`
- Additive migration only.
- No destructive table drops.
- No Patch 20 import logic changes.
- No Patch 21/22/23/24/25/26/27/28/29/30/31/32 rewrites.

## Tables Added

- `public.evidence_bridge_links`
- `public.evidence_collection_requests`
- `public.evidence_bridge_reviews`
- `public.evidence_bridge_events`

## Views Added

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

## Functions Added

- `public.patch33_actor_has_evidence_bridge_authority`
- `public.patch33_actor_can_submit_request`
- `public.record_evidence_bridge_event`
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
- `public.get_clause_evidence_bridge`
- `public.get_live_evidence_readiness_summary`

## Frontend/API

- No frontend or TypeScript API surface was added in this patch.
- Patch 33 is implemented as a backend evidence bridge and proof package to avoid navigation/UI churn.

## Package Scripts

- `patch33:schema-proof`
- `patch33:workflow-proof`
- `patch33:all`

## Evidence Bridge Readiness

- Supported relationship types include `clause`, `control`, `evidence`, `document`, `sop`, `capa`, `risk`, `audit_finding`, `training_program`, and `training_assignment`.
- Supported evidence statuses: `missing`, `pending_collection`, `pending_review`, `accepted`, `rejected`, `stale`, `expired`, `not_applicable`.
- Supported request statuses: `open`, `in_progress`, `submitted`, `under_review`, `accepted`, `rejected`, `overdue`, `cancelled`, `waived`.
- Supported review statuses: `pending_review`, `accepted`, `rejected`, `needs_rework`, `waived`.
- Supported freshness statuses: `current`, `due_soon`, `stale`, `expired`, `unknown`.
- Service-role-only RPC frontend usage: `0`.
- Remaining broad security definer execute grants: `0`.

## Validation Results

- Conflict marker scan: passed; no markers found.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- `npm run patch33:all`: passed.
- `npm run proof:all`: passed, 17/17 proof gates.
- `npm run v700:runtime-security`: passed.
- `npm run patch33:schema-proof`: passed, blocking count `0`.
- `npm run patch33:workflow-proof`: passed, finding count `0`.

## Generated Release Noise

- Generated `release/v*` timestamp/proof noise restored after validation: yes.

## Safety Conclusion

- Patch 33 is safe to commit/push for review.
- New tables have RLS enabled with conservative policies.
- Security definer functions are service-role gated and not broadly executable by authenticated users.
- No frontend privileged RPC calls were introduced.
