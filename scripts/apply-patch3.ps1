$ErrorActionPreference = "Stop"

$PatchRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$RepoRoot = (Get-Location).Path
$FilesRoot = Join-Path $PatchRoot "files"

Write-Host "Applying Patch 3: Live GRC Operating Core" -ForegroundColor Cyan
Write-Host "Patch root: $PatchRoot"
Write-Host "Repo root:  $RepoRoot"

function Copy-PatchFile($relativePath) {
  $source = Join-Path $FilesRoot $relativePath
  $target = Join-Path $RepoRoot $relativePath
  $targetDir = Split-Path -Parent $target
  New-Item -ItemType Directory -Force -Path $targetDir | Out-Null

  if (Test-Path $source) {
    Copy-Item -Force $source $target
    Write-Host "Copied $relativePath" -ForegroundColor Green
    return
  }

  if (Test-Path $target) {
    Write-Host "Patch payload source missing for $relativePath; destination already exists, skipping copy" -ForegroundColor Yellow
    return
  }

  throw "Patch payload source does not exist and destination is missing: $source"
}

Copy-PatchFile "supabase/migrations/064_patch3_live_grc_operating_core.sql"
Copy-PatchFile "src/lib/liveGrcOperatingApi.ts"
Copy-PatchFile "src/pages/LiveGrcOperatingCore.tsx"

$AppPath = Join-Path $RepoRoot "src/App.tsx"
if (!(Test-Path $AppPath)) {
  throw "src/App.tsx was not found. Run this script from the repository root."
}

$app = Get-Content $AppPath -Raw
$AccreditationPagePath = Join-Path $RepoRoot "src/pages/AccreditationCenter.tsx"
$HasAccreditationPage = Test-Path $AccreditationPagePath

if ($HasAccreditationPage -and $app -notmatch "AccreditationCenter") {
  $app = $app -replace "import \{ OvrRiskIndicators \} from './pages/OvrRiskIndicators';", "import { OvrRiskIndicators } from './pages/OvrRiskIndicators';`r`nimport { AccreditationCenter } from './pages/AccreditationCenter';"
  Write-Host "Inserted AccreditationCenter import" -ForegroundColor Yellow
}

if ($app -notmatch "LiveGrcOperatingCore") {
  if ($app -match "import \{ AccreditationCenter \} from './pages/AccreditationCenter';") {
    $app = $app -replace "import \{ AccreditationCenter \} from './pages/AccreditationCenter';", "import { AccreditationCenter } from './pages/AccreditationCenter';`r`nimport { LiveGrcOperatingCore } from './pages/LiveGrcOperatingCore';"
  } else {
    $app = $app -replace "import \{ OvrRiskIndicators \} from './pages/OvrRiskIndicators';", "import { OvrRiskIndicators } from './pages/OvrRiskIndicators';`r`nimport { LiveGrcOperatingCore } from './pages/LiveGrcOperatingCore';"
  }
  Write-Host "Inserted LiveGrcOperatingCore import" -ForegroundColor Yellow
}

if ($HasAccreditationPage -and $app -notmatch "id: 'accreditation'") {
  $qualityNeedle = "{ id: 'ovrRisk', label: t('hub.tab.ovrRisk'), description: t('hub.tab.ovrRisk.desc'), icon: <Activity size={17} />, content: <OvrRiskIndicators /> },"
  $qualityInsert = "$qualityNeedle`r`n        { id: 'accreditation', label: t('hub.tab.accreditation', 'Accreditation'), description: t('hub.tab.accreditation.desc', 'CBAHI and international accreditation readiness.'), icon: <FileSearch size={17} />, content: <AccreditationCenter /> },"
  $app = $app.Replace($qualityNeedle, $qualityInsert)
  Write-Host "Inserted Accreditation tab in Quality/Safety hub" -ForegroundColor Yellow
}

if ($app -notmatch "id: 'operatingCore'") {
  $grcNeedle = "{ id: 'risks', label: t('hub.tab.risks'), description: t('hub.tab.risks.desc'), icon: <ShieldAlert size={17} />, content: <Risks /> },"
  $grcInsert = "$grcNeedle`r`n    { id: 'operatingCore', label: t('hub.tab.operatingCore', 'Operating Core'), description: t('hub.tab.operatingCore.desc', 'Risk, controls, tests, evidence, CAPA, and obligations.'), icon: <Network size={17} />, content: <LiveGrcOperatingCore /> },"
  $app = $app.Replace($grcNeedle, $grcInsert)
  Write-Host "Inserted Operating Core tab in GRC hub" -ForegroundColor Yellow
}

Set-Content -Path $AppPath -Value $app -Encoding UTF8

$ReadmePath = Join-Path $RepoRoot "README.md"
if (Test-Path $ReadmePath) {
  $readme = Get-Content $ReadmePath -Raw
  $pattern = "(?s)\r?\nRun full proof suite:\r?\n\r?\n```powershell\r?\nnpm run proof:all\r?\n```\r?\n\r?\nExpected result before real signoff:\r?\n\r?\n```text\r?\nstatus: failed_review_required\r?\npassed_count: 16\r?\nfailed_count: 1\r?\nfailed_commands: \[`"v66:strict-proof`"\]\r?\n```\r?\n"
  if ($readme -match "Expected result before real signoff") {
    $replacement = "`r`nRun full proof suite:`r`n`r`n```powershell`r`nnpm run proof:all`r`n```r`n`r`nExpected result depends on real approval state. Passing technical proof does not equal production approval.`r`n"
    $readme = [regex]::Replace($readme, $pattern, $replacement)
    Set-Content -Path $ReadmePath -Value $readme -Encoding UTF8
    Write-Host "Cleaned old README 16/1 proof block if matched" -ForegroundColor Yellow
  }
}

Write-Host "Patch 3 applied. Run scripts/verify-patch3.ps1 next." -ForegroundColor Green
