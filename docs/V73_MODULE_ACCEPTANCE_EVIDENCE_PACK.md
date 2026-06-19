# v7.3 Module Acceptance Evidence Pack

Purpose: create module-level controlled-pilot acceptance evidence based on the existing v7.3 plan and the latest v7.2 runtime/persona proof artifacts.

This pack does not approve the pilot and does not fill human signoff fields. Management/Admin, IT and Quality approval remains manual through the v6.7.4/v66 approval gates.

## Added scripts

- `scripts/v73-module-acceptance.mjs`
- `scripts/v73-module-report.mjs`
- `scripts/v73-install-module-acceptance-scripts.mjs`

## Install

```powershell
node scripts/v73-install-module-acceptance-scripts.mjs
```

## Run

```powershell
npm run v73:all
npm run proof:all
```

## Outputs

- `release/v73/module-acceptance-results.json`
- `release/v73/module-acceptance-summary.md`
- `release/v73/module-issues.csv`
- `release/v73/module-signoff-review-pack.md`

## Rules preserved

- Synthetic/non-confidential data only
- No real patient identifiers
- No confidential OVR details
- No fake human approvals
- No migration changes
- No runtime app code changes
