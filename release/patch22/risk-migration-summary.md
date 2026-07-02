# Patch 22 Risk Migration Summary

## Migration

`supabase/migrations/084_patch22_risk_workflow_hardening.sql`

## Additive Changes

- Extends `public.risks` with lifecycle, ownership, appetite, treatment, acceptance, review, closure, escalation, duplicate, and source-link fields.
- Preserves existing generated `inherent_score` and `residual_score` behavior.
- Backfills new owner and workflow fields from existing risk data where safe.
- Adds constraints for lifecycle, score range, appetite threshold, treatment status, acceptance status, and escalation level.

## New Tables

- `public.risk_kri_indicators`
- `public.risk_reassessment_history`
- `public.risk_workflow_events`

## New Views

- `public.v_patch22_risk_workflow_queue`
- `public.v_patch22_risk_appetite_breaches`
- `public.v_patch22_risk_treatment_queue`
- `public.v_patch22_risk_kri_alerts`
- `public.v_patch22_executive_risk_escalations`
- `public.v_patch22_risk_closure_blockers`

All Patch 22 views are set to `security_invoker = true`.

## New Functions

- `public.patch22_write_risk_event(...)`
- `public.patch22_risk_level_from_score(integer)`
- `public.patch22_risk_workflow_bridge(uuid, text, jsonb)`

The workflow bridge and event helper are revoked from `public`, `anon`, and `authenticated`, then granted to `service_role` for use through the authenticated Edge bridge only.

