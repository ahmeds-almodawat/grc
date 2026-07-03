# Patch 47 Staging Migration & Persona Security Evidence Closure

Patch 47 adds operational evidence closure for migration replay and persona SQL proof.

## Scope

- Added a staging/local-clean evidence run register.
- Added an evidence event ledger.
- Added security-invoker views for latest run, persona SQL evidence, blockers, summary, and Production Readiness overlay.
- Added service-role-gated mutation functions for creating/updating evidence runs and recording events.
- Added a runner that verifies existing local/staging evidence artifacts or reports `evidence_required`/`blocked`.
- Extended Production Readiness to surface staging evidence readiness, migration replay status, persona SQL status, RLS/function/view proof status, restore dry-run status, and blockers.

## Safety

- Missing staging evidence is shown as `evidence_required`.
- A run cannot be marked `passed` unless migration replay, persona SQL, RLS, function, view, restore dry-run, zero failures, and evidence path are present.
- The runner does not fake SQL execution or staging results.
- No production data or RLS policy weakening is introduced.

## Migration

- `supabase/migrations/107_patch47_staging_migration_persona_evidence_closure.sql`
