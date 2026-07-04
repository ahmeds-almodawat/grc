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
```

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
npm run typecheck
npm run build
npm run patch55:all
npm run proof:all
npm run v700:runtime-security
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
npm run typecheck
npm run build
npm run patch55:all
npm run proof:all
npm run v700:runtime-security
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
npm run proof:all
npm run v700:runtime-security
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
