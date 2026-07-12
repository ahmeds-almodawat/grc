$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0

$verifiedProjectUrl = 'https://zbrjjecpsrzposhuarcn.supabase.co'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$originalLocation = Get-Location
$temporaryAuthenticationResponseFiles = New-Object 'System.Collections.Generic.List[string]'
$adminPassword = $null
$nonAdminPassword = $null
$adminPasswordPlain = $null
$nonAdminPasswordPlain = $null
$adminSession = $null
$nonAdminSession = $null
$adminIdentity = $null
$nonAdminIdentity = $null
$adminAccessToken = $null
$nonAdminAccessToken = $null
$projectUrl = $null
$anonKey = $null

$temporaryEnvironmentNames = @(
  'PATCH83O_PROJECT_URL',
  'PATCH83O_ANON_KEY',
  'PATCH83O_TEST_ORGANIZATION_ID',
  'PATCH83O_TEST_DIVISION_ID',
  'PATCH83O_EDGE_FUNCTION_VERSION'
)
$savedEnvironment = @{}
foreach ($name in $temporaryEnvironmentNames) {
  $item = Get-Item -LiteralPath "Env:$name" -ErrorAction SilentlyContinue
  $savedEnvironment[$name] = @{
    Exists = $null -ne $item
    Value = if ($null -ne $item) { $item.Value } else { $null }
  }
}

function Get-DotEnvValue {
  param(
    [Parameter(Mandatory = $true)][string[]]$Paths,
    [Parameter(Mandatory = $true)][string]$Name
  )

  foreach ($path in $Paths) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { continue }
    foreach ($line in Get-Content -LiteralPath $path) {
      if ($line -match "^\s*$([regex]::Escape($Name))\s*=\s*(.*)\s*$") {
        $value = $Matches[1].Trim()
        if ($value.Length -ge 2 -and (($value[0] -eq '"' -and $value[$value.Length - 1] -eq '"') -or ($value[0] -eq "'" -and $value[$value.Length - 1] -eq "'"))) {
          return $value.Substring(1, $value.Length - 2)
        }
        return $value
      }
    }
  }
  return $null
}

function ConvertFrom-SecurePassword {
  param([Parameter(Mandatory = $true)][Security.SecureString]$SecurePassword)

  $bstr = [IntPtr]::Zero
  $plainPassword = $null
  try {
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecurePassword)
    $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    return $plainPassword
  } finally {
    $plainPassword = $null
    if ($bstr -ne [IntPtr]::Zero) {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
      $bstr = [IntPtr]::Zero
    }
  }
}

function Get-JwtPayload {
  param([Parameter(Mandatory = $true)][string]$AccessToken)

  $parts = $AccessToken.Split('.')
  if ($parts.Count -ne 3 -or @($parts | Where-Object { [string]::IsNullOrWhiteSpace($_) }).Count -ne 0) {
    throw 'Authentication returned an access token that is not a three-part JWT.'
  }

  $encoded = $parts[1].Replace('-', '+').Replace('_', '/')
  switch ($encoded.Length % 4) {
    2 { $encoded += '==' }
    3 { $encoded += '=' }
    1 { throw 'Authentication returned a JWT with invalid base64url encoding.' }
  }

  try {
    $json = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($encoded))
    return $json | ConvertFrom-Json
  } catch {
    throw 'Authentication returned a JWT with an unreadable payload.'
  } finally {
    $json = $null
    $encoded = $null
    $parts = $null
  }
}

function Invoke-PasswordAuthentication {
  param(
    [Parameter(Mandatory = $true)][string]$ProjectUrl,
    [Parameter(Mandatory = $true)][string]$AnonKey,
    [Parameter(Mandatory = $true)][string]$Email,
    [Parameter(Mandatory = $true)][Security.SecureString]$SecurePassword,
    [Parameter(Mandatory = $true)][string]$Persona
  )

  $plainPassword = $null
  $requestBody = $null
  try {
    $plainPassword = ConvertFrom-SecurePassword -SecurePassword $SecurePassword
    $requestBody = @{ email = $Email; password = $plainPassword } | ConvertTo-Json -Compress
    return Invoke-RestMethod -Method Post -Uri "$ProjectUrl/auth/v1/token?grant_type=password" -Headers @{ apikey = $AnonKey } -ContentType 'application/json' -Body $requestBody
  } catch {
    throw "$Persona authentication failed. Verify the existing user's email and password."
  } finally {
    $requestBody = $null
    $plainPassword = $null
  }
}

function Assert-ValidSession {
  param(
    [Parameter(Mandatory = $true)][string]$ProjectUrl,
    [Parameter(Mandatory = $true)][string]$AnonKey,
    [Parameter(Mandatory = $true)][object]$Session,
    [Parameter(Mandatory = $true)][string]$Persona
  )

  $accessToken = [string]$Session.access_token
  if ([string]::IsNullOrWhiteSpace($accessToken)) {
    throw "$Persona authentication did not return an access token."
  }

  $payload = Get-JwtPayload -AccessToken $accessToken
  $expectedIssuer = "$($ProjectUrl.TrimEnd('/'))/auth/v1"
  if ([string]$payload.iss -ne $expectedIssuer) { throw "$Persona token issuer does not match the configured Supabase project." }
  if ([string]::IsNullOrWhiteSpace([string]$payload.sub)) { throw "$Persona token has no subject." }

  $expiry = 0L
  if (-not [long]::TryParse([string]$payload.exp, [ref]$expiry)) { throw "$Persona token has no valid expiry." }
  if ([DateTimeOffset]::FromUnixTimeSeconds($expiry) -le [DateTimeOffset]::UtcNow) { throw "$Persona token is expired." }

  try {
    $user = Invoke-RestMethod -Method Get -Uri "$ProjectUrl/auth/v1/user" -Headers @{ apikey = $AnonKey; Authorization = "Bearer $accessToken" }
  } catch {
    throw "$Persona token was rejected by /auth/v1/user."
  }
  if ([string]::IsNullOrWhiteSpace([string]$user.id) -or [string]$user.id -ne [string]$payload.sub) {
    throw "$Persona session subject was not confirmed by /auth/v1/user."
  }

  return [pscustomobject]@{ AccessToken = $accessToken; Subject = [string]$payload.sub }
}

function Invoke-SupabaseRead {
  param(
    [Parameter(Mandatory = $true)][string]$ProjectUrl,
    [Parameter(Mandatory = $true)][string]$AnonKey,
    [Parameter(Mandatory = $true)][string]$AccessToken,
    [Parameter(Mandatory = $true)][string]$Resource
  )

  return Invoke-RestMethod -Method Get -Uri "$ProjectUrl/rest/v1/$Resource" -Headers @{ apikey = $AnonKey; Authorization = "Bearer $AccessToken" }
}

function Invoke-NpmScript {
  param([Parameter(Mandatory = $true)][string]$Name)
  & npm.cmd run $Name
  if ($LASTEXITCODE -ne 0) { throw "npm run $Name failed with exit code $LASTEXITCODE." }
}

try {
  if ($env:PATCH83O_APPROVE_LIVE_MUTATION -ieq 'YES') {
    throw 'Refusing to run: PATCH83O_APPROVE_LIVE_MUTATION=YES. This runner is non-mutating only.'
  }
  Remove-Item Env:PATCH83O_APPROVE_LIVE_MUTATION -ErrorAction SilentlyContinue

  $envPaths = @((Join-Path $repositoryRoot '.env.local'), (Join-Path $repositoryRoot '.env'))
  $projectUrl = Get-DotEnvValue -Paths $envPaths -Name 'VITE_SUPABASE_URL'
  if ([string]::IsNullOrWhiteSpace($projectUrl)) { $projectUrl = $verifiedProjectUrl }
  $projectUrl = $projectUrl.Trim().TrimEnd('/')
  $anonKey = Get-DotEnvValue -Paths $envPaths -Name 'VITE_SUPABASE_ANON_KEY'
  if ([string]::IsNullOrWhiteSpace($anonKey)) { throw 'VITE_SUPABASE_ANON_KEY was not found in .env.local or .env.' }

  $adminEmail = (Read-Host 'Existing administrator email').Trim()
  $adminPassword = Read-Host 'Administrator password' -AsSecureString
  $nonAdminEmail = (Read-Host 'Existing non-admin email').Trim()
  $nonAdminPassword = Read-Host 'Non-admin password' -AsSecureString
  if ([string]::IsNullOrWhiteSpace($adminEmail) -or [string]::IsNullOrWhiteSpace($nonAdminEmail)) { throw 'Both existing-user email addresses are required.' }

  Write-Host 'Authenticating existing users and validating fresh sessions...'
  $adminSession = Invoke-PasswordAuthentication -ProjectUrl $projectUrl -AnonKey $anonKey -Email $adminEmail -SecurePassword $adminPassword -Persona 'Administrator'
  $adminIdentity = Assert-ValidSession -ProjectUrl $projectUrl -AnonKey $anonKey -Session $adminSession -Persona 'Administrator'
  $adminAccessToken = $adminIdentity.AccessToken
  $nonAdminSession = Invoke-PasswordAuthentication -ProjectUrl $projectUrl -AnonKey $anonKey -Email $nonAdminEmail -SecurePassword $nonAdminPassword -Persona 'Non-admin'
  $nonAdminIdentity = Assert-ValidSession -ProjectUrl $projectUrl -AnonKey $anonKey -Session $nonAdminSession -Persona 'Non-admin'
  $nonAdminAccessToken = $nonAdminIdentity.AccessToken

  $organizationId = $env:PATCH83O_TEST_ORGANIZATION_ID
  if ([string]::IsNullOrWhiteSpace($organizationId)) {
    $profileId = [Uri]::EscapeDataString($adminIdentity.Subject)
    $profiles = @(Invoke-SupabaseRead -ProjectUrl $projectUrl -AnonKey $anonKey -AccessToken $adminAccessToken -Resource "profiles?id=eq.$profileId&select=organization_id&limit=1")
    if ($profiles.Count -ne 1 -or [string]::IsNullOrWhiteSpace([string]$profiles[0].organization_id)) {
      throw 'Could not derive the administrator organization through the authenticated profile.'
    }
    $organizationId = [string]$profiles[0].organization_id
  }

  $divisionId = $env:PATCH83O_TEST_DIVISION_ID
  if ([string]::IsNullOrWhiteSpace($divisionId)) {
    $organizationFilter = [Uri]::EscapeDataString($organizationId)
    $divisions = @(Invoke-SupabaseRead -ProjectUrl $projectUrl -AnonKey $anonKey -AccessToken $adminAccessToken -Resource "divisions?organization_id=eq.$organizationFilter&is_active=eq.true&select=id,code,name_en&order=name_en.asc")
    if ($divisions.Count -eq 0) { throw 'No active divisions are visible in the administrator organization.' }
    Write-Host 'Valid active divisions:'
    for ($index = 0; $index -lt $divisions.Count; $index++) {
      $label = if ([string]::IsNullOrWhiteSpace([string]$divisions[$index].code)) { [string]$divisions[$index].name_en } else { "$($divisions[$index].name_en) [$($divisions[$index].code)]" }
      Write-Host ("  {0}. {1}" -f ($index + 1), $label)
    }
    do {
      $selectionText = Read-Host 'Select a division by number'
      $selection = 0
      $validSelection = [int]::TryParse($selectionText, [ref]$selection) -and $selection -ge 1 -and $selection -le $divisions.Count
      if (-not $validSelection) { Write-Host 'Enter one of the listed numbers.' }
    } until ($validSelection)
    $divisionId = [string]$divisions[$selection - 1].id
  }

  $env:PATCH83O_PROJECT_URL = $projectUrl
  $env:PATCH83O_ANON_KEY = $anonKey
  $env:PATCH83O_TEST_ORGANIZATION_ID = $organizationId
  $env:PATCH83O_TEST_DIVISION_ID = $divisionId
  $env:PATCH83O_EDGE_FUNCTION_VERSION = '4'
  $env:PATCH83O_NON_MUTATING_ONLY = 'YES'
  $env:PATCH83O_ADMIN_JWT = $adminAccessToken
  $env:PATCH83O_NON_ADMIN_JWT = $nonAdminAccessToken

  Set-Location -LiteralPath $repositoryRoot
  Invoke-NpmScript -Name 'patch83o:test'
  & node scripts/generate-evidence-83o.mjs
  if ($LASTEXITCODE -ne 0) { throw "Patch 83O evidence generation failed with exit code $LASTEXITCODE." }
  Invoke-NpmScript -Name 'patch83o:proof'
  Invoke-NpmScript -Name 'patch83o1:proof'
  Write-Host 'Patch 83O non-mutating secure test matrix completed.'
} finally {
  $adminPasswordPlain = $null
  $nonAdminPasswordPlain = $null
  $adminAccessToken = $null
  $nonAdminAccessToken = $null
  $adminSession = $null
  $nonAdminSession = $null
  $adminIdentity = $null
  $nonAdminIdentity = $null
  if ($adminPassword -is [IDisposable]) { $adminPassword.Dispose() }
  if ($nonAdminPassword -is [IDisposable]) { $nonAdminPassword.Dispose() }
  $adminPassword = $null
  $nonAdminPassword = $null
  $anonKey = $null

  Remove-Item Env:PATCH83O_ADMIN_JWT -ErrorAction SilentlyContinue
  Remove-Item Env:PATCH83O_NON_ADMIN_JWT -ErrorAction SilentlyContinue
  Remove-Item Env:PATCH83O_NON_MUTATING_ONLY -ErrorAction SilentlyContinue
  Remove-Item Env:PATCH83O_APPROVE_LIVE_MUTATION -ErrorAction SilentlyContinue

  foreach ($file in $temporaryAuthenticationResponseFiles) {
    if (Test-Path -LiteralPath $file -PathType Leaf) { Remove-Item -LiteralPath $file -Force }
  }
  $temporaryAuthenticationResponseFiles.Clear()

  foreach ($name in $temporaryEnvironmentNames) {
    if ($savedEnvironment[$name].Exists) {
      Set-Item -LiteralPath "Env:$name" -Value $savedEnvironment[$name].Value
    } else {
      Remove-Item -LiteralPath "Env:$name" -ErrorAction SilentlyContinue
    }
  }
  Set-Location -LiteralPath $originalLocation
}
