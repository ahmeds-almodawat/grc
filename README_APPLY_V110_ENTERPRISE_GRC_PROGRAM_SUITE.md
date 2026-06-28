# Apply v11.0 Enterprise GRC Program Suite Patch

## Purpose

This is an additive patch-only pack. It extends the v10.0 CAPA/risk-control foundation into a fuller enterprise GRC program foundation.

## Prerequisites

- v10.0 patch is already copied and committed or at least present locally.
- Local Docker Supabase is running.
- `npm run pilot:first-run-bootstrap` works.
- `npm run pilot:v100-foundation` passes.

## Files to add

```text
supabase/migrations/053_v110_enterprise_grc_program_suite.sql
scripts/v110-install-package-scripts.mjs
scripts/v110-enterprise-static-audit.mjs
scripts/v110-generate-enterprise-report.mjs
scripts/v110-uat-scenario-matrix.mjs
scripts/v110-final-proof.mjs
release/v110/README.md
README_APPLY_V110_ENTERPRISE_GRC_PROGRAM_SUITE.md
```

## Files to replace

```text
None.
```

## Apply commands

From the repo root:

```powershell
node scripts/v110-install-package-scripts.mjs
npm run pilot:v110-enterprise
npm run typecheck
npm run build
```

Then apply migration to local Docker Supabase:

```powershell
supabase db push --local
```

If your local migration history is broken, use the same safe reset approach as before only if you are okay recreating synthetic local data.

After DB migration:

```powershell
npm run pilot:first-run-bootstrap
npm run pilot:bulk-uat-users
npm run pilot:ovr-workflow-verification
npm run pilot:v100-foundation
npm run pilot:v110-enterprise
npm run pilot:uat-readiness
npm run proof:all
```

## Expected result

`pilot:v110-enterprise` should pass. `proof:all` may still fail only at `v66:strict-proof` until real Management/Admin, IT, and Quality approvals are completed.

## Safety boundaries

- Do not enter patient identifiers.
- Do not enter confidential OVR details.
- Do not mark production ready from this patch.
- Do not bypass v66 approval gate.
- Keep Scenario/UAT data synthetic until approvals and staging proof are complete.
