# Patch 2 Deployment Instructions - Accreditation Standards Engine

This ZIP contains only Patch 2 change files and scripts.

## What it adds

- `supabase/migrations/063_patch2_accreditation_standards_engine.sql`
- `src/lib/accreditationApi.ts`
- `src/pages/AccreditationCenter.tsx`
- `src/App.tsx` patch to add an Accreditation tab inside Quality/Safety hub
- README cleanup for the old Patch 1 `16 passed / 1 failed` inconsistency if still present

## Important licensing rule

Patch 2 creates the standards engine only. Do not load copyrighted CBAHI/JCI clause text unless the hospital/company owns or licenses the current standard content.

## Apply

From your platform root:

```powershell
cd C:\Users\molte\Downloads\grc-control-center

git checkout main
git pull
if (git branch --list patch-2-accreditation-standards-engine) {
  git switch patch-2-accreditation-standards-engine
} else {
  git switch -c patch-2-accreditation-standards-engine
}

powershell -ExecutionPolicy Bypass -File .\scripts\apply-patch2.ps1
```

## Verify locally

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\verify-patch2.ps1
```

Recommended full verification:

```powershell
npm ci
npm run typecheck
npm run build
npm run test:unit
npx playwright install --with-deps
npm run test:e2e
npm audit --audit-level=high
npm run proof:all
```

## Apply Supabase migration

For local Supabase:

```powershell
supabase db reset
```

For a linked/staging Supabase project, use your normal controlled migration flow, for example:

```powershell
supabase db push
```

Do not run production migrations until backup, restore dry-run, and rollback plan are approved.

## Commit and push

```powershell
git status
git diff --stat

git add src/lib/accreditationApi.ts src/pages/AccreditationCenter.tsx src/App.tsx README.md supabase/migrations/063_patch2_accreditation_standards_engine.sql

git commit -m "Patch 2: add accreditation standards engine"
git push -u origin patch-2-accreditation-standards-engine
```

Then open a PR into `main`.
