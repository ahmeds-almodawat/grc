# Current Validation Runbook

## Before Starting Any Patch

```powershell
git switch main
git pull origin main
git status --short --branch
```

Expected clean status on main:

```text
## main...origin/main
```

Create the patch branch only after main is clean and up to date.

## Before Committing

Run:

```powershell
git status --short --branch
git diff --stat
git diff --name-only
npm run validate:fast
```

For small targeted patches, use `npm run validate:fast` while working, then run `npm run validate:build` plus the patch-specific proof as the before-PR gate. Performance patches should run `npm run validate:build`, `npm run validate:security`, the patch proof, and `npm run release:restore-noise`. Write/security-adjacent patches must also run `npm run validate:security`. `npm run validate:release` remains the full release gate and should be run only when needed for final release confidence.

Patch 81 deployment/runbook changes should run `npm run validate:build`, `npm run validate:security`, `npm run patch81:proof`, and `npm run release:restore-noise`. Patch 81 does not apply migrations; it documents controlled migration deployment for migrations 118 through 121.

Patch 82 staging migration rehearsal evidence changes should run `npm run validate:build`, `npm run validate:security`, `npm run patch82:proof`, and `npm run release:restore-noise`. Patch 82 is staging-only evidence and does not apply production migrations.

Patch 82B frontend-only UI polish changes should run `npm run validate:build`, `npm run validate:security`, `npm run patch82b:proof`, and `npm run release:restore-noise`. Staging rehearsal remains separate.

Patch 82C frontend-only interactivity changes should run `npm run validate:build`, `npm run validate:security`, `npm run patch82c:proof`, and `npm run release:restore-noise`. Card filters, search, and drilldowns must not change backend workflow behavior.

Patch 82E frontend-only drilldown changes should run `npm run validate:build`, `npm run validate:security`, `npm run patch82e:proof`, and `npm run release:restore-noise`. Metric drilldowns must stay local to already loaded department control indicators and must not trigger backend writes.

Patch 82F login usability changes should run `npm run validate:build`, `npm run validate:security`, `npm run patch82f:proof`, and `npm run release:restore-noise`. Employee ID login aliasing must keep password sign-in required and must not change Supabase Auth, RLS, backend contracts, or privileged service-role behavior.

Patch 82G privileged action compatibility changes should run `npm run validate:build`, `npm run validate:security`, `npm run patch82g:proof`, and `npm run release:restore-noise`. Privileged admin actions must validate the caller bearer token through Supabase Auth, keep service-role usage server-side, reject missing or invalid tokens, and surface safe structured errors without weakening role checks.

Never use `git add .`. Stage only the files intentionally changed for the patch.

Do not accidentally commit:

- Generated release noise from older `release/v*` folders.
- Generated proof JSON from previous patch folders unless intentionally updating that patch.
- Local build output such as `dist/`.
- Environment files or secrets.
- Temporary notes or copied prompt files.

## Before PR

Run:

```powershell
npm run validate:release
npm run release:restore-noise
git status --short --branch
```

Inspect the final diff again:

```powershell
git diff --stat
git diff --name-only
```

## After Merge

Run on main:

```powershell
git switch main
git pull origin main
npm run validate:release
npm run release:restore-noise
git status --short --branch
```

Expected final clean status:

```text
## main...origin/main
```

## Before Deployment

Run:

```powershell
npm run validate:proof
npm run validate:security
```

Then confirm live operational approvals:

- Staging/persona SQL evidence is current.
- DR restore evidence is current.
- Department launch packs are complete.
- Training adoption is confirmed.
- Policy/SOP attestations are complete or accepted with limitations.
- Support readiness is confirmed.
- Executive signoff is approved.

## Handling Generated Release Noise

Proof commands intentionally refresh evidence files. To clean generated noise that should not be part of the current patch, run:

```powershell
npm run release:restore-noise
git status --short --branch
```

The restore helper only targets known allowlisted release evidence folders and does not stage or commit anything.

Patch 58.2 extends restore coverage to generated proof JSON noise for Patch 56, Patch 57, Patch 58, and Patch 58.1. Patch 62 extends restore coverage to the Patch 61 generated proof JSON. Patch 63 extends restore coverage to the Patch 62 generated proof JSON. Patch 64 extends restore coverage to the Patch 63 generated proof JSON. Patch 65 extends restore coverage to the Patch 64 generated proof JSON. Patch 66 extends restore coverage to the Patch 65 generated proof JSON. Patch 67 extends restore coverage to the Patch 66 generated proof JSON. Patch 68 extends restore coverage to the Patch 67 generated proof JSON. Patch 69 extends restore coverage to the Patch 68 generated proof JSON. Patch 70 extends restore coverage to the Patch 69 generated proof JSON. Patch 71 extends restore coverage to the Patch 70 generated proof JSON. Patch 72 extends restore coverage to the Patch 71 generated proof JSON. Patch 73 extends restore coverage to the Patch 72 generated proof JSON. Patch 74 extends restore coverage to the Patch 73 generated proof JSON. Patch 76 extends restore coverage to the Patch 75 generated proof JSON. Patch 77 extends restore coverage to the Patch 76 generated proof JSON. Patch 78 extends restore coverage to the Patch 77 generated proof JSON. Patch 79 extends restore coverage to the Patch 78 generated proof JSON. Patch 80A extends restore coverage to the Patch 79 generated proof JSON. Patch 81 extends restore coverage to the Patch 80A generated proof JSON. Patch 82F extends restore coverage to the Patch 82E generated proof JSON. Patch 82G extends restore coverage to the Patch 82F generated proof JSON. Keep implementation summaries, validation reports, and current status docs intentional when they are part of the active patch.
