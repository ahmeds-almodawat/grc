# Patch 23 Evidence Migration Summary

Migration: `supabase/migrations/085_patch23_evidence_bridge_governance.sql`

The migration is additive. It extends the existing `evidence_files` table, creates governed evidence bridge tables, adds security-invoker views, and exposes a service-role-only SQL bridge for the existing privileged action edge function.

## Existing Table Extensions
`evidence_files` receives governance metadata for code/title/type, sensitivity, ownership, review status, revision, versioning, lock status, expiry, renewal, custody hash, upload context and created/updated actor compatibility.

## New Tables
- `evidence_links`: links one evidence file to many workflow items.
- `evidence_requirements`: stores required proof for gates.
- `evidence_review_events`: stores custody and review events.
- `evidence_gate_waivers`: stores explicit waiver requests and decisions.

## Views
- `v_patch23_evidence_review_queue`
- `v_patch23_evidence_gap_dashboard`
- `v_patch23_evidence_closure_gate_status`
- `v_patch23_evidence_chain_of_custody`
- `v_patch23_evidence_pack_index`
- `v_patch23_sensitive_evidence_register`

## Security
RLS is enabled on new tables. Views use `security_invoker = true`. The transition bridge is callable by the edge function through `service_role`; browser code uses `invokePrivilegedAction` and does not call the SQL bridge directly.
