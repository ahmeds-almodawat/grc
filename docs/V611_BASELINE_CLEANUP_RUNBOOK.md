# v6.1.1 Baseline Cleanup Runbook

This pack cleans the baseline created in v6.1 without adding new product modules.

## Goals

1. Remove internal OpenAI registry URLs from `package-lock.json` and project `.npmrc`.
2. Generate a safe migration prefix cleanup plan for gaps/duplicates.
3. Add one canonical version truth file.
4. Generate a clean baseline cleanup report.

## Install

```bash
node scripts/v611-install-cleanup-scripts.mjs
npm run v611:all
```

## Registry cleanup

`npm run v611:registry` updates only the local project lock/config. It backs up files under:

```text
release/v611/backups/
```

Then run:

```bash
npm install --package-lock-only --ignore-scripts --registry=https://registry.npmjs.org/
npm run typecheck
npm run build
```

## Migration cleanup

By default the script creates a plan only:

```bash
npm run v611:migration-plan
```

Only apply renames if these migration files have not already been applied to any real Supabase database:

```bash
npm run v611:migration-apply
npm run v61:migrations
```

## Exit criteria

- `npm run typecheck` passes.
- `npm run build` passes.
- `npm run v61:pin-strict` passes.
- `npm run v611:all` generates `release/v611/V611_BASELINE_CLEANUP_REPORT.md`.
