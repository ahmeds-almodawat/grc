# Apply v7.8 Live Staging Execution Pack

This patch adds v7.8 documentation, scripts, workflow, and generated release outputs for live staging execution planning.

It does **not** modify approval files, RLS policies, runtime bridge logic, migrations, or production readiness gates.

## Apply

```powershell
cd C:\Users\molte\Downloads\grc-control-center
git status --short
git checkout -b v7.8-live-staging-execution

powershell -ExecutionPolicy Bypass -File "C:\Users\molte\Downloads\grc-control-center-v7.8-live-staging-execution-pack\apply-v7.8.ps1" -RepoPath "C:\Users\molte\Downloads\grc-control-center"

node .\scripts\v78-install-package-scripts.mjs
npm run pilot:live-staging-plan
```

## Commit

```powershell
git status --short
git add package.json .github/workflows/live-staging-plan.yml README_APPLY_V78_PATCH.md apply-v7.8.ps1 docs release/v78 scripts
git commit -m "Add v7.8 live staging execution pack"
git push -u origin v7.8-live-staging-execution
```
