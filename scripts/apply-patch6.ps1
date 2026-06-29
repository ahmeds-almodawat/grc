param()

$ErrorActionPreference = "Stop"

function Resolve-PatchRoot {
  $candidates = @(
    (Split-Path -Parent $PSScriptRoot),
    (Join-Path $env:USERPROFILE "Downloads\patch6_grc_changes"),
    (Join-Path (Get-Location) "patch6_grc_changes")
  ) | Select-Object -Unique

  foreach ($candidate in $candidates) {
    if ([string]::IsNullOrWhiteSpace($candidate)) { continue }
    if ((Test-Path (Join-Path $candidate "supabase\migrations\067_patch6_accreditation_quality_operating_layer.sql")) -and
        (Test-Path (Join-Path $candidate "src\lib\qualityAccreditationOperatingApi.ts")) -and
        (Test-Path (Join-Path $candidate "src\pages\QualityAccreditationOperatingCenter.tsx"))) {
      return $candidate
    }
  }

  throw "Cannot locate patch6_grc_changes with supabase and src folders. Extract grc_patch6_accreditation_quality_operating_layer.zip under C:\Users\molte\Downloads."
}

$RepoRoot = (Get-Location).Path
if (!(Test-Path (Join-Path $RepoRoot "package.json"))) {
  throw "Run this from the repository root, e.g. C:\Users\molte\Downloads\grc-control-center"
}

$PatchRoot = Resolve-PatchRoot
Write-Host "Applying Patch 6: Accreditation & Quality Operating Layer..."
Write-Host "Repo root: $RepoRoot"
Write-Host "Patch root: $PatchRoot"

$copyMap = @(
  @{ Source = "supabase\migrations\067_patch6_accreditation_quality_operating_layer.sql"; Dest = "supabase\migrations\067_patch6_accreditation_quality_operating_layer.sql" },
  @{ Source = "src\lib\qualityAccreditationOperatingApi.ts"; Dest = "src\lib\qualityAccreditationOperatingApi.ts" },
  @{ Source = "src\pages\QualityAccreditationOperatingCenter.tsx"; Dest = "src\pages\QualityAccreditationOperatingCenter.tsx" }
)

foreach ($item in $copyMap) {
  $src = Join-Path $PatchRoot $item.Source
  $dest = Join-Path $RepoRoot $item.Dest
  if (!(Test-Path $src)) { throw "Missing patch file: $src" }
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $dest) | Out-Null
  $srcResolved = (Resolve-Path $src).Path
  $destResolved = if (Test-Path $dest) { (Resolve-Path $dest).Path } else { $dest }
  if ($srcResolved -ieq $destResolved) {
    Write-Host "Already in place: $($item.Dest)" -ForegroundColor Yellow
  } else {
    Copy-Item -Force $src $dest
  }
}

$appPath = Join-Path $RepoRoot "src\App.tsx"
$app = Get-Content $appPath -Raw

if ($app -notmatch "QualityAccreditationOperatingCenter") {
  $importNeedle = "import { AccreditationCenter } from './pages/AccreditationCenter';"
  $importInsert = "import { QualityAccreditationOperatingCenter } from './pages/QualityAccreditationOperatingCenter';"
  if ($app -notmatch [regex]::Escape($importNeedle)) {
    throw "Could not find AccreditationCenter import in src/App.tsx"
  }
  $app = $app.Replace($importNeedle, "$importNeedle`r`n$importInsert")
}

if ($app -notmatch "qualityAccreditationOperating") {
  $tabNeedle = "{ id: 'accreditation', label: t('hub.tab.accreditation', 'Accreditation'), description: t('hub.tab.accreditation.desc', 'CBAHI and international accreditation readiness engine.'), icon: <ClipboardCheck size={17} />, content: <AccreditationCenter /> },"
  $tabInsert = "{ id: 'qualityAccreditationOperating', label: t('hub.tab.qualityAccreditationOperating', 'Quality Operating Layer'), description: t('hub.tab.qualityAccreditationOperating.desc', 'Tracer rounds, indicators, RCA/CAPA, evidence packs, and requirement readiness work.'), icon: <ClipboardCheck size={17} />, content: <QualityAccreditationOperatingCenter /> },"
  if ($app -notmatch [regex]::Escape($tabNeedle)) {
    throw "Could not find Accreditation tab line in src/App.tsx"
  }
  $app = $app.Replace($tabNeedle, "$tabNeedle`r`n        $tabInsert")
}

if ($app -notmatch "QualityAccreditationOperatingCenter") {
  throw "QualityAccreditationOperatingCenter was not inserted into src/App.tsx"
}
if ($app -notmatch "qualityAccreditationOperating") {
  throw "qualityAccreditationOperating tab was not inserted into src/App.tsx"
}

Set-Content -Path $appPath -Value $app -Encoding UTF8

$readmePath = Join-Path $RepoRoot "README.md"
if (Test-Path $readmePath) {
  $readme = Get-Content $readmePath -Raw
  $note = @"

## Patch 6 - Accreditation & Quality Operating Layer

Patch 6 adds the daily operating layer for accreditation and quality work: licensed standards import governance, requirement ownership, measurable element scoring, tracer rounds, quality indicators, OVR/RCA/CAPA linkage, committee decisions, and survey evidence packs. It does not embed copyrighted CBAHI/JCI standard text. It also adds explicit Patch 5 workflow-kernel policies so static RLS proof can read the same org-scoped controls that runtime already enforces.
"@
  if ($readme -notmatch "Patch 6 - Accreditation & Quality Operating Layer") {
    Add-Content -Path $readmePath -Value $note -Encoding UTF8
  }
}

Write-Host "Patch 6 files copied and App.tsx integration attempted."
Write-Host "Next: run scripts\verify-patch6.ps1"
