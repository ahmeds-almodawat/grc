# Apply v7.5 Controlled-Pilot Readiness Pack

This patch adds a large **controlled-pilot readiness pack** for the GRC Control Center.

It is intentionally safe:

- It does not modify human approval files.
- It does not fake Management/Admin, IT, or Quality signoff.
- It does not mark the platform production ready.
- It does not bypass `v66:strict-proof`.
- It does not change RLS policies, runtime bridge logic, migrations, or Supabase functions.
- It does not rewrite Git history.

## Apply

```powershell
cd C:\Users\molte\Downloads\grc-control-center
git status
git checkout -b v7.5-controlled-pilot-readiness
powershell -ExecutionPolicy Bypass -File "C:\Users\molte\Downloads\grc-control-center-v7.5-controlled-pilot-readiness-pack\apply-v7.5.ps1" -RepoPath "C:\Users\molte\Downloads\grc-control-center"
```

## Validate

```powershell
npm run ci:static
npm run v75:all
```

Optional full proof:

```powershell
npm run proof:all
```

`proof:all` is still expected to fail at `v66:strict-proof` until real human signoff and confidentiality confirmation are completed.

## Commit

```powershell
git status
git add docs scripts release/v75 package.json apply-v7.5.ps1
git commit -m "Add v7.5 controlled pilot readiness pack"
git push -u origin v7.5-controlled-pilot-readiness
```
