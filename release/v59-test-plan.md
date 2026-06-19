# v5.9 Phased Auto-Test Plan

## Phase 1 — Local build foundation

- Code: `LOCAL_BUILD`
- Command: `npm run test:phase1`
- Gate: typecheck and build must pass

## Phase 2 — No-mock audit

- Code: `NO_MOCK`
- Command: `npm run test:phase2`
- Gate: mock audit and removal plan generated

## Phase 3 — Migration/schema artifact check

- Code: `MIGRATIONS`
- Command: `npm run test:phase3`
- Gate: migration files and v5.9 migration exist

## Phase 4 — Workflow artifact check

- Code: `WORKFLOWS`
- Command: `npm run test:phase4`
- Gate: main business module files exist

## Phase 5 — Backup/restore proof artifacts

- Code: `BACKUP_RESTORE`
- Command: `npm run test:phase5`
- Gate: backup and restore scripts run locally

## Phase 6 — Pilot readiness artifacts

- Code: `PILOT_READY`
- Command: `npm run test:phase6`
- Gate: pilot/rollout/security artifacts exist and run

## Run all

```bash
npm run test:phases
```