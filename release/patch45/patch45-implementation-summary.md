# Patch 45 Implementation Summary

Patch 45 adds Runtime Action Authorization & RPC Classification Closure.

## Purpose

The existing v700 runtime security audit already passes, but the inventory had many heuristic `unknown_requires_review` classifications. Patch 45 adds a source-controlled runtime action registry, a governed database review layer, production readiness visibility, and proof scripts without weakening the existing v700 checks.

## Registry

- Added `src/lib/runtimeActionRegistry.ts`.
- The registry covers every current frontend-triggered runtime action in the v700 inventory.
- `search_grc_global` remains explicitly tracked as a direct browser RPC exception.
- Registry fields include action name, transport, module, classification, risk level, required access level, owner role, review status, direct browser exception flag, and notes.
- Classifications are separated from review status. Actions can be classified while still requiring human access-review signoff.

## Migration

Added `supabase/migrations/105_patch45_runtime_action_authorization_review.sql`.

Tables:

- `runtime_action_reviews`
- `runtime_action_review_events`

Views:

- `v_patch45_runtime_action_register`
- `v_patch45_unclassified_runtime_action_register`
- `v_patch45_privileged_runtime_action_register`
- `v_patch45_direct_browser_rpc_exception_register`
- `v_patch45_runtime_authorization_summary`
- `v_patch45_access_review_evidence_register`
- `v_patch45_production_security_readiness_overlay`

Functions:

- `record_runtime_action_review_event`
- `create_runtime_action_review`
- `update_runtime_action_review_status`
- `get_runtime_authorization_summary`
- `get_production_security_readiness_overlay`

All Patch 45 views use `security_invoker=true`. Mutating review functions are service-role-bridge-gated and do not grant execute to `authenticated`.

## Production Readiness

`ProductionReadinessCenter` now displays:

- runtime action total
- classified action count
- pending review count
- privileged/high-risk action count
- direct browser RPC exception count
- service-role-only frontend calls
- broad SECURITY DEFINER execute grants
- next action required
- direct browser RPC exception register
- runtime action register

## Security Posture

Patch 45 does not hide the direct browser RPC exception and does not remove or weaken v700 runtime security checks. It improves the v700 inventory classification through a reusable registry lookup.
