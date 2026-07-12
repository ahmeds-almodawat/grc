$ErrorActionPreference = 'Stop'

$flagName = 'VITE_DEPARTMENT_IMPORT_EXECUTION_ENABLED'
$flagPath = "Env:$flagName"
$hadOriginalFlag = Test-Path -LiteralPath $flagPath
$originalFlag = if ($hadOriginalFlag) { (Get-Item -LiteralPath $flagPath).Value } else { $null }

try {
  Write-Output 'PATCH83P_DISABLED_BUILD_START flag=false'
  Set-Item -LiteralPath $flagPath -Value 'false'
  & npm run build
  if ($LASTEXITCODE -ne 0) {
    throw "Patch 83P disabled-mode build failed with exit code $LASTEXITCODE."
  }
  Write-Output 'PATCH83P_DISABLED_BUILD_PASS'

  Write-Output 'PATCH83P_ENABLED_BUILD_START flag=true'
  Set-Item -LiteralPath $flagPath -Value 'true'
  & npm run build
  if ($LASTEXITCODE -ne 0) {
    throw "Patch 83P enabled-mode build failed with exit code $LASTEXITCODE."
  }
  Write-Output 'PATCH83P_ENABLED_BUILD_PASS'
}
finally {
  if ($hadOriginalFlag) {
    Set-Item -LiteralPath $flagPath -Value $originalFlag
  }
  else {
    Remove-Item -LiteralPath $flagPath -ErrorAction SilentlyContinue
  }
  Write-Output 'PATCH83P_PROCESS_FLAG_RESTORED'
}
