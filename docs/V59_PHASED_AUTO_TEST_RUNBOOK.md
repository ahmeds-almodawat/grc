# v5.9 Phased Auto-Test Runbook

Use phases instead of one giant test. This makes errors easier to isolate.

## Phase 1 — Local build foundation

```bash
npm run test:phase1
```

Checks:
- `npm run typecheck`
- `npm run build`
- `dist/` exists
- JS assets are generated

## Phase 2 — No-mock audit

```bash
npm run test:phase2
```

Checks:
- mock/demo/fallback/sample scan
- produces `release/v59-no-mock-audit.json`
- produces `release/v59-mock-removal-plan.md`

Strict mode:

```bash
npm run no-mock:fail
```

## Phase 3 — Migration/schema artifact check

```bash
npm run test:phase3
```

Checks:
- migrations folder exists
- migration count is reasonable
- latest v5.9 migration exists
- no duplicate migration filenames

## Phase 4 — Workflow artifact check

```bash
npm run test:phase4
```

Checks important source artifacts for:
- OVR
- Risk
- Compliance
- Audit
- Export/Backup
- RLS/QA
- Pilot/Rollout

## Phase 5 — Backup/restore proof artifacts

```bash
npm run test:phase5
```

Checks:
- v50 backup scripts exist
- v50 restore scripts exist
- release folder exists
- restore dry-run evidence can be produced

## Phase 6 — Pilot readiness artifacts

```bash
npm run test:phase6
```

Checks:
- v58 or v35 pilot scripts exist
- pilot/rollout security artifacts exist
- pilot readiness docs exist

## Run all phases

```bash
npm run test:phases
```

The result is saved under:

```text
release/v59-phase-test-results.json
release/v59-phase-test-report.md
```
