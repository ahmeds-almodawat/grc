param(
  [string]$RepoRoot = (Get-Location).Path
)

$ErrorActionPreference = "Stop"

function Copy-PatchFile {
  param(
    [string]$SourceRelative,
    [string]$DestinationRelative
  )
  $scriptRoot = Split-Path -Parent $MyInvocation.ScriptName
  $patchRoot = Split-Path -Parent $scriptRoot
  $source = Join-Path $patchRoot (Join-Path "files" $SourceRelative)
  $destination = Join-Path $RepoRoot $DestinationRelative
  $destinationDir = Split-Path -Parent $destination
  New-Item -ItemType Directory -Force -Path $destinationDir | Out-Null

  if (Test-Path $source) {
    Copy-Item -Force $source $destination
    Write-Host "Copied $DestinationRelative"
    return
  }

  if (Test-Path $destination) {
    Write-Host "Patch payload source missing for $DestinationRelative; destination already exists, skipping copy"
    return
  }

  throw "Patch payload source does not exist and destination is missing: $source"
}

if (!(Test-Path (Join-Path $RepoRoot "package.json"))) {
  throw "RepoRoot does not look like the GRC platform root: $RepoRoot"
}

Copy-PatchFile "src\lib\accreditationApi.ts" "src\lib\accreditationApi.ts"
Copy-PatchFile "src\pages\AccreditationCenter.tsx" "src\pages\AccreditationCenter.tsx"
Copy-PatchFile "supabase\migrations\063_patch2_accreditation_standards_engine.sql" "supabase\migrations\063_patch2_accreditation_standards_engine.sql"

$appPath = Join-Path $RepoRoot "src\App.tsx"
$app = Get-Content $appPath -Raw

if ($app -notmatch "AccreditationCenter") {
  $app = $app -replace "import \{ DepartmentScorecards \} from './pages/DepartmentScorecards';", "import { DepartmentScorecards } from './pages/DepartmentScorecards';`r`nimport { AccreditationCenter } from './pages/AccreditationCenter';"

  $qualityTab = "        { id: 'ovrRisk', label: t('hub.tab.ovrRisk'), description: t('hub.tab.ovrRisk.desc'), icon: <Activity size={17} />, content: <OvrRiskIndicators /> },"
  $accreditationTab = "        { id: 'accreditation', label: t('hub.tab.accreditation', 'Accreditation'), description: t('hub.tab.accreditation.desc', 'CBAHI and international accreditation readiness engine.'), icon: <ClipboardCheck size={17} />, content: <AccreditationCenter /> },"
  if ($app.Contains($qualityTab)) {
    $app = $app.Replace($qualityTab, "$qualityTab`r`n$accreditationTab")
  } else {
    throw "Could not find QualitySafetyHub OVR Risk tab anchor in src/App.tsx. Apply AccreditationCenter import/tab manually."
  }

  Set-Content -Path $appPath -Value $app -Encoding UTF8
  Write-Host "Updated src/App.tsx with Accreditation tab"
} else {
  Write-Host "src/App.tsx already references AccreditationCenter; skipping App patch"
}

# Patch remaining README truth-state inconsistency from Patch 1 if it still exists.
$readmePath = Join-Path $RepoRoot "README.md"
$readme = Get-Content $readmePath -Raw
$oldBlock = @"
Expected result before real signoff:

``````text
status: failed_review_required
passed_count: 16
failed_count: 1
failed_commands: ["v66:strict-proof"]
``````
"@
$newBlock = @"
Expected result before real signoff:

``````text
Technical proof may pass, but production approval remains blocked until real signoff, OVR confidentiality confirmation, live/staging RLS persona proof, live bridge/access review evidence, rollback, and pilot review are complete.
``````
"@
if ($readme.Contains($oldBlock)) {
  $readme = $readme.Replace($oldBlock, $newBlock)
  Set-Content -Path $readmePath -Value $readme -Encoding UTF8
  Write-Host "Updated README outdated 16/1 proof block"
} else {
  Write-Host "README old 16/1 proof block not found; skipping README patch"
}

Write-Host "Patch 2 files applied. Run scripts\verify-patch2.ps1 next."
