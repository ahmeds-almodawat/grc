$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0

$verifiedProjectUrl = 'https://zbrjjecpsrzposhuarcn.supabase.co'
$approvedDivisionId = '0c1aaf03-b795-4dc0-acb7-c496cb917e8a'
$requiredConfirmation = 'RUN PATCH 83O LIVE MUTATION'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$originalLocation = Get-Location
$adminPassword = $null
$adminSession = $null
$adminIdentity = $null
$adminAccessToken = $null
$anonKey = $null

$temporaryEnvironmentNames = @(
  'PATCH83O_PROJECT_URL',
  'PATCH83O_ANON_KEY',
  'PATCH83O_TEST_ORGANIZATION_ID',
  'PATCH83O_TEST_DIVISION_ID',
  'PATCH83O_TEST_DIVISION_CODE',
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
  try {
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecurePassword)
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  } finally {
    if ($bstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
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
    return [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($encoded)) | ConvertFrom-Json
  } catch {
    throw 'Authentication returned a JWT with an unreadable payload.'
  }
}

function Invoke-PasswordAuthentication {
  param(
    [Parameter(Mandatory = $true)][string]$ProjectUrl,
    [Parameter(Mandatory = $true)][string]$AnonKey,
    [Parameter(Mandatory = $true)][string]$Email,
    [Parameter(Mandatory = $true)][Security.SecureString]$SecurePassword
  )
  $plainPassword = $null
  $requestBody = $null
  try {
    $plainPassword = ConvertFrom-SecurePassword -SecurePassword $SecurePassword
    $requestBody = @{ email = $Email; password = $plainPassword } | ConvertTo-Json -Compress
    return Invoke-RestMethod -Method Post -Uri "$ProjectUrl/auth/v1/token?grant_type=password" -Headers @{ apikey = $AnonKey } -ContentType 'application/json' -Body $requestBody
  } catch {
    throw 'Administrator authentication failed. Verify the existing administrator credentials.'
  } finally {
    $requestBody = $null
    $plainPassword = $null
  }
}

function Assert-ValidSession {
  param(
    [Parameter(Mandatory = $true)][string]$ProjectUrl,
    [Parameter(Mandatory = $true)][string]$AnonKey,
    [Parameter(Mandatory = $true)][object]$Session
  )
  $accessToken = [string]$Session.access_token
  if ([string]::IsNullOrWhiteSpace($accessToken)) { throw 'Administrator authentication did not return an access token.' }
  $payload = Get-JwtPayload -AccessToken $accessToken
  if ([string]$payload.iss -ne "$($ProjectUrl.TrimEnd('/'))/auth/v1") { throw 'Administrator token issuer does not match the configured Supabase project.' }
  if ([string]::IsNullOrWhiteSpace([string]$payload.sub)) { throw 'Administrator token has no subject.' }
  $expiry = 0L
  if (-not [long]::TryParse([string]$payload.exp, [ref]$expiry)) { throw 'Administrator token has no valid expiry.' }
  if ([DateTimeOffset]::FromUnixTimeSeconds($expiry) -le [DateTimeOffset]::UtcNow) { throw 'Administrator token is expired.' }
  try {
    $user = Invoke-RestMethod -Method Get -Uri "$ProjectUrl/auth/v1/user" -Headers @{ apikey = $AnonKey; Authorization = "Bearer $accessToken" }
  } catch {
    throw 'Administrator token was rejected by /auth/v1/user.'
  }
  if ([string]::IsNullOrWhiteSpace([string]$user.id) -or [string]$user.id -ne [string]$payload.sub) {
    throw 'Administrator session subject was not confirmed by /auth/v1/user.'
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
  Remove-Item Env:PATCH83O_APPROVE_LIVE_MUTATION -ErrorAction SilentlyContinue
  Remove-Item Env:PATCH83O_ADMIN_JWT -ErrorAction SilentlyContinue
  Remove-Item Env:PATCH83O_NON_ADMIN_JWT -ErrorAction SilentlyContinue
  Remove-Item Env:PATCH83O_NON_MUTATING_ONLY -ErrorAction SilentlyContinue

  $envPaths = @((Join-Path $repositoryRoot '.env.local'), (Join-Path $repositoryRoot '.env'))
  $projectUrl = Get-DotEnvValue -Paths $envPaths -Name 'VITE_SUPABASE_URL'
  if ([string]::IsNullOrWhiteSpace($projectUrl)) { $projectUrl = $verifiedProjectUrl }
  $projectUrl = $projectUrl.Trim().TrimEnd('/')
  if ($projectUrl -ne $verifiedProjectUrl) { throw 'Configured Supabase project does not match the verified Patch 83O project.' }
  $anonKey = Get-DotEnvValue -Paths $envPaths -Name 'VITE_SUPABASE_ANON_KEY'
  if ([string]::IsNullOrWhiteSpace($anonKey)) { throw 'VITE_SUPABASE_ANON_KEY was not found in .env.local or .env.' }

  $adminEmail = (Read-Host 'Existing administrator email').Trim()
  if ([string]::IsNullOrWhiteSpace($adminEmail)) { throw 'Existing administrator email is required.' }
  $adminPassword = Read-Host 'Administrator password' -AsSecureString

  Write-Host 'Authenticating the existing administrator and validating the session...'
  $adminSession = Invoke-PasswordAuthentication -ProjectUrl $projectUrl -AnonKey $anonKey -Email $adminEmail -SecurePassword $adminPassword
  $adminIdentity = Assert-ValidSession -ProjectUrl $projectUrl -AnonKey $anonKey -Session $adminSession
  $adminAccessToken = $adminIdentity.AccessToken

  $profileId = [Uri]::EscapeDataString($adminIdentity.Subject)
  $profiles = @(Invoke-SupabaseRead -ProjectUrl $projectUrl -AnonKey $anonKey -AccessToken $adminAccessToken -Resource "profiles?id=eq.$profileId&select=organization_id,is_active,user_status&limit=1")
  if ($profiles.Count -ne 1 -or [string]::IsNullOrWhiteSpace([string]$profiles[0].organization_id) -or $profiles[0].is_active -ne $true -or [string]$profiles[0].user_status -ne 'active') {
    throw 'Could not derive the administrator organization through the authenticated profile.'
  }
  $organizationId = [string]$profiles[0].organization_id

  $administratorRoles = @(Invoke-SupabaseRead -ProjectUrl $projectUrl -AnonKey $anonKey -AccessToken $adminAccessToken -Resource "user_roles?user_id=eq.$profileId&is_active=eq.true&scope=eq.global&select=role,organization_id")
  $authorizedRoles = @($administratorRoles | Where-Object {
    ([string]$_.role -in @('super_admin', 'governance_admin')) -and
    ([string]::IsNullOrWhiteSpace([string]$_.organization_id) -or [string]$_.organization_id -eq $organizationId)
  })
  if ($authorizedRoles.Count -eq 0) { throw 'Authenticated user is not an active Patch 83O department import administrator.' }

  $divisionFilter = [Uri]::EscapeDataString($approvedDivisionId)
  $organizationFilter = [Uri]::EscapeDataString($organizationId)
  $divisions = @(Invoke-SupabaseRead -ProjectUrl $projectUrl -AnonKey $anonKey -AccessToken $adminAccessToken -Resource "divisions?id=eq.$divisionFilter&organization_id=eq.$organizationFilter&is_active=eq.true&select=id,organization_id,code,is_active&limit=2")
  if ($divisions.Count -ne 1 -or [string]::IsNullOrWhiteSpace([string]$divisions[0].code)) {
    throw 'Approved GRC division is not active in the administrator organization.'
  }
  $divisionCode = [string]$divisions[0].code

  Write-Host 'This will create, update, and inactivate randomized Patch 83O.3 department test data while preserving audit history.'
  $confirmation = Read-Host "Type exactly: $requiredConfirmation"
  if ($confirmation -cne $requiredConfirmation) { throw 'Exact interactive live mutation confirmation was not provided.' }

  $env:PATCH83O_PROJECT_URL = $projectUrl
  $env:PATCH83O_ANON_KEY = $anonKey
  $env:PATCH83O_TEST_ORGANIZATION_ID = $organizationId
  $env:PATCH83O_TEST_DIVISION_ID = $approvedDivisionId
  $env:PATCH83O_TEST_DIVISION_CODE = $divisionCode
  $env:PATCH83O_EDGE_FUNCTION_VERSION = '4'
  $env:PATCH83O_ADMIN_JWT = $adminAccessToken
  $env:PATCH83O_APPROVE_LIVE_MUTATION = 'YES'

  Set-Location -LiteralPath $repositoryRoot
  & node scripts/patch83o3-live-mutation-tests.mjs
  if ($LASTEXITCODE -ne 0) { throw "Patch 83O.3 live mutation verification stopped with exit code $LASTEXITCODE." }
  Remove-Item Env:PATCH83O_ADMIN_JWT -ErrorAction SilentlyContinue
  Remove-Item Env:PATCH83O_APPROVE_LIVE_MUTATION -ErrorAction SilentlyContinue
  Invoke-NpmScript -Name 'patch83o:proof'
  Invoke-NpmScript -Name 'patch83o1:proof'
  Invoke-NpmScript -Name 'patch83o2:proof'
  Invoke-NpmScript -Name 'patch83o3:proof'
  Write-Host 'Patch 83O.3 controlled live mutation verification and inactivation cleanup completed.'
} finally {
  $adminAccessToken = $null
  $adminSession = $null
  $adminIdentity = $null
  if ($adminPassword -is [IDisposable]) { $adminPassword.Dispose() }
  $adminPassword = $null
  $anonKey = $null

  Remove-Item Env:PATCH83O_ADMIN_JWT -ErrorAction SilentlyContinue
  Remove-Item Env:PATCH83O_NON_ADMIN_JWT -ErrorAction SilentlyContinue
  Remove-Item Env:PATCH83O_NON_MUTATING_ONLY -ErrorAction SilentlyContinue
  Remove-Item Env:PATCH83O_APPROVE_LIVE_MUTATION -ErrorAction SilentlyContinue
  Remove-Item Env:PATCH83O_TEST_DIVISION_CODE -ErrorAction SilentlyContinue

  foreach ($name in $temporaryEnvironmentNames) {
    if ($savedEnvironment[$name].Exists) {
      Set-Item -LiteralPath "Env:$name" -Value $savedEnvironment[$name].Value
    } else {
      Remove-Item -LiteralPath "Env:$name" -ErrorAction SilentlyContinue
    }
  }
  Set-Location -LiteralPath $originalLocation
}
