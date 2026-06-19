# CI/CD Expansion Plan

## Current CI target

Current CI should stay conservative:

```text
typecheck + build
```

This is safe because human approval is still pending.

## Why proof:all should not run as a required CI gate yet

`proof:all` is expected to fail until real human approval files are completed. Making it a required CI check now would create false failures.

## v7.6 repo health workflow

v7.6 adds a safe repo health workflow that can run:

```powershell
npm run repo:health
```

This checks static build quality and repo/evidence hygiene without bypassing the human signoff gate.

## Future CI stages

### Stage 1 — Current

- Install dependencies.
- Run typecheck.
- Run build.

### Stage 2 — Pre-pilot

- Run repo health.
- Generate v7.6 review artifacts.
- Upload artifacts.

### Stage 3 — After real signoff

- Run full `proof:all` as required.
- Block merges if strict proof fails.

### Stage 4 — Staging deployment

- Deploy to staging.
- Run authenticated persona tests against real staging Supabase.
- Upload proof artifacts.

### Stage 5 — Production candidate

- Require branch protection.
- Require approvals.
- Require staging proof.
- Require rollback plan.
