# Apply v8.6 to v9.0 Pilot Execution Evidence Suite

This patch is safe by design. It adds documents, scripts, generated release folders, and a GitHub Actions workflow for pilot execution evidence. It does not modify approval JSON files, RLS policies, migrations, runtime bridge logic, Supabase functions, or production readiness gates.

## Required order

```powershell
cd C:\Users\molte\Downloads\grc-control-center

git status --short
git checkout -b v8.6-to-v9.0-pilot-execution-evidence

powershell -ExecutionPolicy Bypass -File "C:\Users\molte\Downloads\grc-control-center-v8.6-to-v9.0-pilot-execution-evidence-suite\apply-v8.6-to-v9.0.ps1" -RepoPath "C:\Users\molte\Downloads\grc-control-center"

node .\scripts\v86-v90-install-package-scripts.mjs

npm run pilot:execution-evidence
```

## Expected result

```text
ci:static = passed
v86-v90:all = passed
status = technical_ready_pending_human_approval
production_ready = false
```

## Commit

```powershell
git status --short
git add package.json .github/workflows/pilot-execution-evidence.yml README_APPLY_V86_TO_V90_PATCH.md apply-v8.6-to-v9.0.ps1 docs release/v86 release/v87 release/v88 release/v89 release/v90 release/v86-v90 scripts
git commit -m "Add v8.6 to v9.0 pilot execution evidence suite"
git push -u origin v8.6-to-v9.0-pilot-execution-evidence
```
