# v13.0 Executive UX Polish + Guided Workbench Patch

## Purpose

This is a safe, add-only polish pack for the GRC Control Center. It does **not** add a database migration and does **not** touch approval files.

It adds an enterprise UX layer that can be wired into pages gradually:

- executive workbench model
- guided UAT scripts
- role-based coach prompts
- board-readiness polish language
- data-quality visual language
- premium CSS tokens
- static validation scripts
- release report pack

## Files to add

```text
scripts/v130-install-package-scripts.mjs
scripts/v130-ux-static-audit.mjs
scripts/v130-generate-executive-polish-report.mjs
scripts/v130-generate-guided-uat-script.mjs
scripts/v130-final-proof.mjs

src/lib/v130ExecutivePolish.ts
src/components/v130/ExecutivePolishWorkbench.tsx
src/styles/v130-executive-polish.css

release/v130/README.md
release/v130/v130-ux-static-audit.json
release/v130/v130-ux-static-audit.md
release/v130/v130-executive-polish-report.md
release/v130/v130-guided-uat-script.md
release/v130/v130-final-proof.json
release/v130/v130-final-proof.md
release/v130/v130-validation-summary.md
```

## Files to replace

```text
None.
```

## Apply

Copy these files into your repository root, then run:

```powershell
cd C:\Users\molte\Downloads\grc-control-center

node scripts/v130-install-package-scripts.mjs
npm run pilot:v130-polish
npm run typecheck
npm run build
```

## Full validation

After v13 passes:

```powershell
npm run pilot:v120-polish
npm run pilot:v110-enterprise
npm run pilot:v100-foundation
npm run pilot:uat-readiness
npm run proof:all
```

Expected current proof state remains:

```text
proof:all fails only at v66:strict-proof until real approvals are filled.
```

## Notes

- No Supabase migration is included in this pack.
- No `supabase db push` is required for v13.
- No production readiness is asserted.
- This patch is designed to be safe even while the local `016` migration-history issue is being cleaned up separately.
