# Apply v12.0 Operational Polish + Data Quality Command Suite

## Purpose

This is an additive patch-only pack. It adds operational polish, dashboard/readiness data structures, data-quality checks, SLA monitoring, user feedback, help/glossary, release readiness, executive narrative, and adoption metrics.

## Important prerequisite

Apply the **v11.0.1 migration hotfix** first if your v11 migration failed on `public.evidence_items`.

Expected order:

```powershell
# 1) Replace the v11 migration with the v11.0.1 hotfix
# 2) Apply v11
supabase db push --local --include-all

# 3) Then apply this v12 patch
```

## Files to add

```text
supabase/migrations/054_v120_operational_polish_data_quality_suite.sql
scripts/v120-install-package-scripts.mjs
scripts/v120-polish-static-audit.mjs
scripts/v120-generate-polish-report.mjs
scripts/v120-generate-uat-matrix.mjs
scripts/v120-final-proof.mjs
src/styles/v120-polish.css
src/lib/v120EnterprisePolish.ts
release/v120/README.md
README_APPLY_V120_OPERATIONAL_POLISH_DATA_QUALITY_SUITE.md
```

## Files to replace

```text
None.
```

## Apply commands

From the repo root:

```powershell
cd C:\Users\molte\Downloads\grc-control-center

node scripts/v120-install-package-scripts.mjs
npm run pilot:v120-polish
npm run typecheck
npm run build
```

Then apply migration to local Docker Supabase:

```powershell
supabase db push --local
```

If Supabase still complains about old ordered migrations, use:

```powershell
supabase db push --local --include-all
```

After DB migration:

```powershell
npm run pilot:v110-enterprise
npm run pilot:v120-polish
npm run pilot:v100-foundation
npm run pilot:uat-readiness
npm run proof:all
```

## Expected result

`pilot:v120-polish` should pass.

`proof:all` may still fail only at `v66:strict-proof` until real Management/Admin, IT, and Quality approvals are completed.

## Safety boundaries

- Do not enter patient identifiers.
- Do not enter confidential OVR details.
- Do not mark production ready from this patch.
- Do not bypass the v66 approval gate.
- Keep Scenario/UAT data synthetic until approvals and staging proof are complete.
