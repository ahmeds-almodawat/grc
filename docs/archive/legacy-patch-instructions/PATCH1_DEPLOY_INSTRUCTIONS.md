# Patch 1 Deployment Instructions

Patch name:

```text
patch-1-truth-ci-data-integrity
```

This ZIP contains only the Patch 1 changes and helper scripts. It does not contain the full platform.

## Contents

```text
files/.github/workflows/ci.yml
files/src/lib/liveResult.ts
scripts/apply-patch1.ps1
scripts/verify-patch1.ps1
README_CURRENT_STATUS_REPLACEMENT.md
codex-fix-commands.md
```

## What this patch does

1. Replaces the broken GitHub Actions CI workflow.
2. Adds `src/lib/liveResult.ts`.
3. Removes simple hardcoded demo organization fallbacks from:
   - `src/lib/automationApi.ts`
   - `src/lib/hardeningApi.ts`
   - `src/pages/BackupHealthCheck.tsx`
   - `src/components/ProjectDetail.tsx`
4. Updates README current status wording so technical proof does not imply production readiness.
5. Gives Codex commands for the wider query-error cleanup that depends on exact local source context.

## Before applying

Open PowerShell in your platform directory:

```powershell
cd C:\Users\molte\Downloads\grc-control-center
git status
```

If you have uncommitted work, commit or stash it first.

Recommended:

```powershell
git checkout main
git pull
git checkout -b patch-1-truth-ci-data-integrity
```

## Apply the patch

Extract this ZIP somewhere, for example:

```text
C:\Users\molte\Downloads\patch1_grc_changes
```

Then run from your platform root:

```powershell
cd C:\Users\molte\Downloads\grc-control-center
powershell -ExecutionPolicy Bypass -File "C:\Users\molte\Downloads\patch1_grc_changes\scripts\apply-patch1.ps1"
```

The script creates a backup under:

```text
.patch1-backup\<timestamp>
```

## Verify

Run:

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Users\molte\Downloads\patch1_grc_changes\scripts\verify-patch1.ps1"
```

Or run manually:

```powershell
npm ci
npm run typecheck
npm run build
npm run test:unit
npx playwright install --with-deps
npm run test:e2e
npm audit --audit-level=high
npm run proof:all
npm run v62:static-strict
```

## If v62 still fails

Open:

```text
codex-fix-commands.md
```

Run the Codex commands in order. Use Codex only for fixing.

## Check changed files

```powershell
git status
git diff --stat
```

Expected important changed files:

```text
.github/workflows/ci.yml
README.md
src/lib/liveResult.ts
src/lib/automationApi.ts
src/lib/hardeningApi.ts
src/pages/BackupHealthCheck.tsx
src/components/ProjectDetail.tsx
```

Codex may also update:

```text
src/lib/commandCenterApi.ts
src/lib/grcApi.ts
src/lib/onboardingApi.ts
src/lib/operationsApi.ts
src/lib/performanceApi.ts
src/lib/releaseOpsApi.ts
src/lib/securityApi.ts
src/lib/testingApi.ts
```

## Do not commit generated proof artifacts unless intentional

After running proof commands, these may change:

```text
release/**
test-results/.last-run.json
```

If you do not want to commit generated evidence files:

```powershell
git checkout -- release test-results/.last-run.json
```

Only do that if you are sure those files are generated and not part of your intended patch.

## Commit

```powershell
git add .github/workflows/ci.yml README.md src/lib/liveResult.ts src/lib/automationApi.ts src/lib/hardeningApi.ts src/pages/BackupHealthCheck.tsx src/components/ProjectDetail.tsx
git add src/lib/commandCenterApi.ts src/lib/grcApi.ts src/lib/onboardingApi.ts src/lib/operationsApi.ts src/lib/performanceApi.ts src/lib/releaseOpsApi.ts src/lib/securityApi.ts src/lib/testingApi.ts
git commit -m "Patch 1: stabilize CI and live data handling"
```

If some files do not exist or were not changed, Git will tell you. That is okay.

## Push

```powershell
git push -u origin patch-1-truth-ci-data-integrity
```

## GitHub deployment

After pushing:

1. Open GitHub repo:
   ```text
   https://github.com/ahmeds-almodawat/grc
   ```
2. Create a Pull Request from:
   ```text
   patch-1-truth-ci-data-integrity
   ```
   into:
   ```text
   main
   ```
3. Wait for CI to pass.
4. Review changed files.
5. Merge only if:
   ```text
   typecheck passed
   build passed
   unit tests passed
   e2e tests passed
   npm audit passed
   proof:all passed
   v62:static-strict passed locally or findings are clearly resolved
   ```

## Rollback

If something goes wrong before commit:

```powershell
git restore .
git clean -fd
```

If you need the backup copy created by the script:

```text
.patch1-backup\<timestamp>
```

Copy files back from there.
