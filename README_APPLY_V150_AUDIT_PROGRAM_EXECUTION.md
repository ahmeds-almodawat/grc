# Apply v15.0 Audit Program Execution Pack

## What this patch changes

Replaces:

- `src/pages/Audit.tsx`

Adds:

- `src/lib/v150AuditProgramModel.ts`
- `src/components/v150/AuditProgramWorkflowMap.tsx`
- `src/components/v150/AuditEngagementChecklist.tsx`
- `src/components/v150/AuditAssuranceCoveragePanel.tsx`
- `src/styles/v150-audit-program.css`
- `scripts/v150-audit-program-static-audit.mjs`
- `scripts/v150-audit-program-report.mjs`
- `scripts/v150-final-proof.mjs`
- `scripts/v150-install-package-scripts.mjs`
- `release/v150/*`

The ZIP is flat/root-ready. Extract it into the repository root and choose **replace files**.

## Apply

```powershell
cd C:\Users\molte\Downloads\grc-control-center
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
.\APPLY_V150.ps1
```

Or without PowerShell script:

```powershell
cd C:\Users\molte\Downloads\grc-control-center
node scripts/v150-install-package-scripts.mjs
```

## Validate

```powershell
npm ci
npm run typecheck
npm run build
npm run pilot:v150-audit-program
npm run proof:all
```

## Commit only after validation passes

```powershell
git status --short
git add src/pages/Audit.tsx src/lib/v150AuditProgramModel.ts src/components/v150 src/styles/v150-audit-program.css scripts/v150-audit-program-static-audit.mjs scripts/v150-audit-program-report.mjs scripts/v150-final-proof.mjs scripts/v150-install-package-scripts.mjs release/v150 package.json .github/workflows/ci.yml
git commit -m "Add v15 audit program execution pack"
git push
```

Do not commit `node_modules/`, `dist/`, `.env`, `.env.local`, or `supabase/.temp/`.
