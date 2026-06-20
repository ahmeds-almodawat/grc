# GRC Control Center v8.0 to v8.5 Governed Pilot Suite

This patch adds a safe, governance-only v8.0–v8.5 suite for pilot launch, live-staging evidence, KPI operations, security/privacy assurance, training/change management, and executive decision readiness.

## Safety boundaries

This patch does **not**:

- modify approval JSON files;
- fake Management/Admin, IT, or Quality signoff;
- mark the system production ready;
- bypass `v66:strict-proof`;
- change RLS policies;
- change database migrations;
- change runtime bridge logic;
- change Supabase Edge Functions;
- use real patient identifiers or confidential OVR data.

## Apply order

```powershell
cd C:\Users\molte\Downloads\grc-control-center

git status --short
git checkout -b v8.0-to-v8.5-governed-pilot-suite

powershell -ExecutionPolicy Bypass -File "C:\Users\molte\Downloads\grc-control-center-v8.0-to-v8.5-governed-pilot-suite\apply-v8.0-to-v8.5.ps1" -RepoPath "C:\Users\molte\Downloads\grc-control-center"

node .\scripts\v80-v85-install-package-scripts.mjs

npm run pilot:governed-launch-suite
```

Expected status remains:

```text
technical_ready_pending_human_approval
production_ready: false
```

Commit after validation:

```powershell
git status --short
git add package.json .github/workflows/governed-pilot-suite.yml README_APPLY_V80_TO_V85_PATCH.md apply-v8.0-to-v8.5.ps1 docs release/v80 release/v81 release/v82 release/v83 release/v84 release/v85 release/v80-v85 scripts
git commit -m "Add v8.0 to v8.5 governed pilot suite"
git push -u origin v8.0-to-v8.5-governed-pilot-suite
```
