# GitHub Actions Runbook

## Current workflows

The project should include:

```text
.github/workflows/ci.yml
.github/workflows/repo-health.yml
```

## CI workflow

The CI workflow should run:

```powershell
npm install
npm run ci:static
```

## Repo health workflow

The repo health workflow should run:

```powershell
npm install
npm run repo:health
```

## Failure handling

### Typecheck failure

Fix TypeScript issues before merge.

### Build failure

Fix build or Vite configuration before merge.

### Repo hygiene warning

Review `release/v76/repo-hygiene-audit.md`.

### Human signoff still pending

This is not a CI failure unless the branch claims controlled pilot approval is complete.

## What not to do

Do not make `proof:all` required until real human signoff has been completed and committed.
