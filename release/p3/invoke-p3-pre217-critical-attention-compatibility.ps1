param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('LocalProof', 'Staging')]
  [string]$Target,

  [string]$DatabaseUrl
)

$ErrorActionPreference = 'Stop'
$expectedStagingRef = 'zghsgzrdwbqdrpuxanac'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$sqlPath = Join-Path $PSScriptRoot 'p3-pre217-critical-attention-compatibility.sql'

Push-Location $root
try {
  if ($Target -eq 'Staging') {
    if ($DatabaseUrl) {
      throw 'P3_STAGING_DATABASE_URL_FORBIDDEN'
    }

    $projectRefPath = Join-Path $root 'supabase\.temp\project-ref'
    if (-not (Test-Path -LiteralPath $projectRefPath)) {
      throw 'P3_STAGING_LINK_REQUIRED'
    }

    $actualProjectRef = (Get-Content -Raw -LiteralPath $projectRefPath).Trim()
    if ($actualProjectRef -ne $expectedStagingRef) {
      throw "P3_WRONG_STAGING_TARGET expected=$expectedStagingRef actual=$actualProjectRef"
    }

    & npx supabase db query --linked --file $sqlPath
  } else {
    if (-not $DatabaseUrl) {
      throw 'P3_LOCAL_PROOF_DATABASE_URL_REQUIRED'
    }

    $proofUri = [System.Uri]$DatabaseUrl
    if (($proofUri.Host -notin @('127.0.0.1', 'localhost')) -or
      ($proofUri.AbsolutePath.Trim('/') -ne 'p3_r1_proof')) {
      throw 'P3_LOCAL_PROOF_TARGET_INVALID'
    }

    & npx supabase db query --db-url $DatabaseUrl --file $sqlPath
  }

  if ($LASTEXITCODE -ne 0) {
    throw "P3_PRE217_BRIDGE_FAILED target=$Target exit=$LASTEXITCODE"
  }

  Write-Output "P3_PRE217_BRIDGE_PASS target=$Target"
} finally {
  Pop-Location
}
