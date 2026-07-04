# Patch 3 - Live GRC Operating Core

This patch adds the live operating workflow backbone for:

- Risk appetite
- Risk register
- KRIs
- Controls
- Control test plans/results/exceptions
- Compliance obligations
- Regulatory change impact
- Policies and attestations
- Evidence requests/reviews
- CAPA and retests
- Vendor risk
- Evidence-based closure packets

It also adds a GRC Hub tab: **Operating Core**.

## Apply

Extract this ZIP to:

```text
C:\Users\molte\Downloads
```

Then run from the repo root:

```powershell
cd C:\Users\molte\Downloads\grc-control-center

git checkout main
git pull
if (git branch --list patch-3-live-grc-operating-core) {
  git switch patch-3-live-grc-operating-core
} else {
  git switch -c patch-3-live-grc-operating-core
}

powershell -ExecutionPolicy Bypass -File .\scripts\apply-patch3.ps1
```

## Verify

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\verify-patch3.ps1
```

Full check:

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

## Supabase migration

Local reset:

```powershell
supabase db reset
```

Linked staging database:

```powershell
supabase db push
```

Do not push to production without backup, restore dry-run, access review, and rollback approval.

## Commit

```powershell
git status
git diff --stat

git add supabase/migrations/064_patch3_live_grc_operating_core.sql src/lib/liveGrcOperatingApi.ts src/pages/LiveGrcOperatingCore.tsx src/App.tsx README.md

git commit -m "Patch 3: add live GRC operating core"
git push -u origin patch-3-live-grc-operating-core
```

Then open PR into `main`.
