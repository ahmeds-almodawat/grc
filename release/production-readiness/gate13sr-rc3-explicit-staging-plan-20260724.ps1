$ErrorActionPreference = 'Stop'

$repo = 'C:\Users\molte\Downloads\grc-control-center'
$expectedHead = '578315455642a1c1d006eb77d1f2b089cd41e6a6'
$expectedBranch = 'release/grc-platform-1.0.0-rc.2'
$newBranch = 'release/grc-platform-1.0.0-rc.3'
$manifestPath = 'release/production-readiness/gate13sr-rc3-release-file-manifest-20260724.json'

Set-Location -LiteralPath $repo
if ((git rev-parse --show-toplevel) -ne $repo.Replace('\', '/')) { throw 'Repository root mismatch.' }
if ((git branch --show-current) -ne $expectedBranch) { throw 'Starting branch mismatch.' }
if ((git rev-parse HEAD) -ne $expectedHead) { throw 'Starting commit mismatch.' }
if (@(git diff --cached --name-only).Count -ne 0) { throw 'Index is not empty.' }
if (@(git ls-files --deleted).Count -ne 0) { throw 'Tracked deletions exist.' }

$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
if ($manifest.status -ne 'ready_for_explicit_authorization') { throw 'Release manifest is not ready.' }
if (@(git branch --list $newBranch).Count -ne 0) { throw 'RC3 branch already exists.' }

git switch -c $newBranch
foreach ($path in $manifest.included_paths) {
  if ($path -match '(^|/)(\.env|.*\.local|node_modules|\.vercel|\.supabase)(/|$)') {
    throw "Forbidden path in manifest: $path"
  }
  git add -- $path
}

$actual = @(git diff --cached --name-only | Sort-Object)
$expected = @($manifest.included_paths | Sort-Object)
if (Compare-Object $expected $actual) { throw 'Staged paths differ from the approved manifest.' }

git diff --cached --check
git diff --cached --stat
git diff --cached --name-status
git diff --cached

Write-Host 'STOP: review the exact staged RC3 payload. Commit, tag, and push require the separate authorization phrase.'
