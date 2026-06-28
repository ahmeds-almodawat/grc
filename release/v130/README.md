# v13.0 Executive UX Polish + Guided Workbench

v13.0 is a safe add-only polish pack. It does not contain a Supabase migration.

## Included

- Executive workbench model
- Guided UAT scenarios
- Role coach prompts
- Premium CSS polish tokens
- Static UX audit
- Final proof report

## Validation

Run:

```powershell
node scripts/v130-install-package-scripts.mjs
npm run pilot:v130-polish
npm run typecheck
npm run build
```

Then continue with existing proof commands. `v66:strict-proof` remains blocked until real approvals are completed.
