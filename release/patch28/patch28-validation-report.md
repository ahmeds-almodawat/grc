# Patch 28 Validation Report

Generated: 2026-07-03

## Branch

- Base branch: `patch27-approval-authority-matrix`
- Current branch: `patch28-capa-action-plan-hardening`
- Base HEAD before Patch 28: `022000c Add Patch 27 approval authority matrix`

## Isolation

- Patch 29 started: no
- UI redesign performed: no
- UI/API changes: skipped intentionally for this backend/proof-focused patch
- Database reset performed: no
- Migration execution performed: no
- RLS weakened: no
- Patch 20 import logic touched: no
- Patch 21 OVR workflow rewritten: no
- Patch 22 Risk workflow rewritten: no
- Patch 23 Evidence Bridge rewritten: no
- Patch 24 Audit Findings rewritten: no
- Patch 25 Compliance rewritten: no
- Patch 26 Document Control rewritten: no
- Patch 27 Approval Authority rewritten: no

## Files Changed

Patch 28 implementation files:

- `package.json`
- `scripts/patch28-capa-schema-proof.mjs`
- `scripts/patch28-capa-workflow-proof.mjs`
- `supabase/migrations/091_patch28_capa_action_plan_hardening.sql`
- `release/patch28/patch28-implementation-summary.md`
- `release/patch28/patch28-schema-proof.json`
- `release/patch28/patch28-workflow-proof.json`
- `release/patch28/patch28-validation-report.md`

Validation commands also refreshed existing repo-wide proof artifacts under:

- `release/v62/`
- `release/v64/`
- `release/v66/`
- `release/v661/`
- `release/v662/`
- `release/v663/`
- `release/v672/`
- `release/v673/`
- `release/v674/`
- `release/v700/`
- `release/v72/`

## Migration

- Found: `supabase/migrations/091_patch28_capa_action_plan_hardening.sql`

## Tables Added

- `public.capa_action_plans`
- `public.capa_action_items`
- `public.capa_events`
- `public.capa_due_date_extensions`
- `public.capa_effectiveness_reviews`
- `public.capa_links`

## Views Added

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

## Functions Added

- `public.patch28_write_capa_event`
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

## Validation Results

- `npm run typecheck`: passed as part of `npm run patch28:all` and `npm run proof:all`
- `npm run build`: passed as part of `npm run patch28:all` and `npm run proof:all`
- `npm run patch28:all`: passed
- `npm run proof:all`: passed, 17/17 gates
- `npm run v700:runtime-security`: passed
- Conflict marker scan: no markers found

## Proof Files

- `release/patch28/patch28-schema-proof.json`: passed
- `release/patch28/patch28-workflow-proof.json`: passed
- `release/v700/proof-suite-all.json`: passed
- `release/v700/runtime-security-bridge-audit.json`: passed

## Skipped Or Missing

- No commands were missing.
- UI/API implementation was skipped by design to avoid broad refactor risk.
- No migrations were applied to a live database.

## Safety Conclusion

Patch 28 is safe to manually test and safe to prepare for commit/push from the current branch. The patch is isolated from Patch 29 and does not redesign UI or alter previous workflow patches.

