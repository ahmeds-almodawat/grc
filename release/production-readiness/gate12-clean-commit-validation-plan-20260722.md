# Gate 12 clean-commit validation plan

This plan is disabled until the clean-candidate blocker is remediated and the manifests are regenerated.

```powershell
$repo = 'C:\Users\molte\Downloads\grc-control-center'
$commit = '<approved-release-commit-sha>'
$worktree = Join-Path $env:TEMP ("grc-gate12-commit-" + [guid]::NewGuid().ToString('N'))
git -C $repo worktree add --detach $worktree $commit
Push-Location $worktree
npm ci
npm test -- --run
npm run typecheck
npm run build
Pop-Location
git -C $repo worktree remove $worktree
```

Before removal, the operator must run the approved focused SQL, Deno, Playwright, secret, JSON, skip/only and lineage checks and compare the commit-tree aggregate to the regenerated approved candidate manifest.
