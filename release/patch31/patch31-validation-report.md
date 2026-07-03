# Patch 31 Validation Report

Generated: 2026-07-03

## Branch

- Branch: `patch31-runtime-rpc-classification-signoff`
- Base: `main` after Patch 30 merge

## Files Changed

- `package.json`
- `scripts/patch31-runtime-rpc-schema-proof.mjs`
- `scripts/patch31-runtime-rpc-classification-proof.mjs`
- `supabase/migrations/094_patch31_runtime_rpc_classification_signoff.sql`
- `release/patch31/patch31-implementation-summary.md`
- `release/patch31/patch31-schema-proof.json`
- `release/patch31/patch31-classification-proof.json`
- `release/patch31/patch31-validation-report.md`

## Migration

- Created: `supabase/migrations/094_patch31_runtime_rpc_classification_signoff.sql`

## Tables Added

- `public.runtime_rpc_classifications`
- `public.runtime_rpc_signoff_events`

## Views Added

- `public.v_patch31_runtime_rpc_classification_register`
- `public.v_patch31_unreviewed_runtime_rpcs`
- `public.v_patch31_privileged_rpc_review_queue`
- `public.v_patch31_frontend_rpc_signoff_summary`
- `public.v_patch31_runtime_rpc_production_readiness`
- `public.v_patch31_runtime_rpc_exception_register`

## Functions Added

- `public.patch31_actor_has_security_authority`
- `public.record_runtime_rpc_signoff_event`
- `public.classify_runtime_rpc`
- `public.mark_runtime_rpc_reviewed`
- `public.approve_runtime_rpc_for_production`
- `public.reject_runtime_rpc_for_production`

## Frontend/API

- Frontend page: not added
- API file: not added
- Reason: optional scope was skipped to keep Patch 31 focused on the controlled backend/proof signoff layer and avoid UI churn.

## Package Scripts Added

- `patch31:schema-proof`
- `patch31:classification-proof`
- `patch31:all`

## Classification Status Summary

- Current unique frontend-used RPCs: 36
- Missing classifications: 0
- `approved_for_production`: 1
- `pending_security_review`: 6
- `workflow_runtime_review`: 16
- `privileged_admin_review`: 13
- `service_role_only_rpc_called_by_frontend`: 0
- `remaining_broad_security_definer_execute_grants`: 0

## Validation Results

- `git status --short --branch`: ran before and after validation
- `git diff --stat`: ran
- Conflict marker scan: passed, no markers found
- `npm run typecheck`: passed
- `npm run build`: passed
- `npm run patch31:all`: passed
- `npm run proof:all`: passed, 17/17 gates
- `npm run v700:runtime-security`: passed

## Generated Release Noise

Generated `release/v*` timestamp/report noise was restored after validation with:

```powershell
git restore release/v62 release/v64 release/v66 release/v661 release/v662 release/v663 release/v672 release/v673 release/v674 release/v700 release/v72
```

Restore status: yes.

## Safety Conclusion

Patch 31 is safe to review and prepare for commit. It adds a classification/signoff control layer without broad execute grants, without exposing service-role-only RPCs to the browser, and without changing frontend transport behavior.

