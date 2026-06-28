# Apply v10.0 Unified CAPA + Risk-Control Foundation

This is a **patch-only pack**. It is designed to be copied into the current GRC Control Center repo without replacing existing v9.9/v9.10 files.

## What to add

Add these files:

```text
supabase/migrations/052_v100_unified_capa_risk_control_foundation.sql
scripts/v100-install-package-scripts.mjs
scripts/v100-foundation-static-audit.mjs
scripts/v100-generate-foundation-report.mjs
scripts/v100-final-proof.mjs
release/v100/README.md
```

## What to replace

No existing source file must be replaced by this pack.

The package scripts are installed safely by running:

```powershell
node scripts/v100-install-package-scripts.mjs
```

That command updates only the `scripts` section of `package.json` and adds:

```json
{
  "v100:foundation-audit": "node scripts/v100-foundation-static-audit.mjs",
  "v100:foundation-report": "node scripts/v100-generate-foundation-report.mjs",
  "v100:final-proof": "node scripts/v100-final-proof.mjs",
  "pilot:v100-foundation": "npm run v100:foundation-audit && npm run v100:foundation-report && npm run v100:final-proof"
}
```

## Apply commands

From the repo root:

```powershell
cd C:\Users\molte\Downloads\grc-control-center

# 1) Copy files from this patch into the same paths in the repo.

# 2) Install package scripts.
node scripts/v100-install-package-scripts.mjs

# 3) Run v10 static proof.
npm run pilot:v100-foundation

# 4) Run normal technical checks.
npm run typecheck
npm run build
npm run pilot:uat-readiness
npm run proof:all
```

## Database migration

Apply the migration to local Supabase first, not production:

```powershell
supabase db push
```

Then repeat the proof commands.

## Safety boundaries

- This patch does not modify approval JSON files.
- This patch does not bypass v66.
- This patch does not expose a service-role key.
- This patch does not grant delete rights on new tables to normal authenticated users.
- This patch does not assert production readiness.

## Expected proof result before manual approvals

`proof:all` may still fail only at `v66:strict-proof` until real human approvals are completed.
