# Patch 31 Runtime RPC Classification Closure / Production Security Signoff

Generated: 2026-07-03

## Branch

- Branch: `patch31-runtime-rpc-classification-signoff`
- Base: `main` at Patch 30 merge

## Scope

Patch 31 adds a controlled runtime RPC classification and signoff layer for the current v700 frontend RPC inventory. It does not weaken security, grant broad execute, expose service-role-only RPCs to the browser, bypass the authenticated Edge bridge, touch Patch 20 import logic, touch payroll-sensitive fields, run destructive migrations, or redesign the UI.

## Migration

- `supabase/migrations/094_patch31_runtime_rpc_classification_signoff.sql`

## Tables

- `public.runtime_rpc_classifications`
- `public.runtime_rpc_signoff_events`

## Views

- `public.v_patch31_runtime_rpc_classification_register`
- `public.v_patch31_unreviewed_runtime_rpcs`
- `public.v_patch31_privileged_rpc_review_queue`
- `public.v_patch31_frontend_rpc_signoff_summary`
- `public.v_patch31_runtime_rpc_production_readiness`
- `public.v_patch31_runtime_rpc_exception_register`

## Functions

- `public.classify_runtime_rpc`
- `public.mark_runtime_rpc_reviewed`
- `public.approve_runtime_rpc_for_production`
- `public.reject_runtime_rpc_for_production`
- `public.record_runtime_rpc_signoff_event`
- `public.patch31_actor_has_security_authority`

## Security Model

- RLS enabled on both new tables.
- Read access limited to security-facing roles through existing role helpers.
- Write access limited to `super_admin` and `governance_admin` policies.
- Signoff functions are `SECURITY DEFINER`, use safe `search_path`, and are revoked from `public`, `anon`, and `authenticated`.
- Signoff functions are granted only to `service_role` for controlled bridge/operator execution.
- Production approval blocks direct browser use of service-role-only RPCs and RPCs requiring the authenticated bridge.

## Classification Summary

The current v700 runtime inventory contains 36 unique frontend-used RPCs. Patch 31 seeds all 36:

- `approved_for_production`: 1
- `pending_security_review`: 6
- `privileged_admin_review`: 13
- `workflow_runtime_review`: 16
- Missing classifications: 0

## Frontend/API

No frontend/API page was added in this patch. The requested UI was optional if clean and minimal; this patch stays backend/proof focused to avoid broad UI changes.

## Proof

- `release/patch31/patch31-schema-proof.json`
- `release/patch31/patch31-classification-proof.json`

