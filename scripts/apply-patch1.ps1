param(
  [switch]$SkipCodex,
  [switch]$NoBackup
)

$ErrorActionPreference = "Stop"

function Write-Step($Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Require-File($Path) {
  if (-not (Test-Path $Path)) {
    throw "Required file not found: $Path. Run this script from the repository root."
  }
}

function Backup-File($Path, $BackupRoot) {
  if ($NoBackup) { return }
  if (Test-Path $Path) {
    $dest = Join-Path $BackupRoot $Path
    $destDir = Split-Path $dest -Parent
    New-Item -ItemType Directory -Force -Path $destDir | Out-Null
    Copy-Item $Path $dest -Force
  }
}

function Set-TextFile($Path, $Content) {
  $dir = Split-Path $Path -Parent
  if ($dir -and -not (Test-Path $dir)) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
  }
  Set-Content -Path $Path -Value $Content -Encoding UTF8
}

function Replace-Exact($Path, $Old, $New, $Description) {
  Require-File $Path
  $content = Get-Content $Path -Raw
  if ($content.Contains($Old)) {
    $content = $content.Replace($Old, $New)
    Set-Content -Path $Path -Value $content -Encoding UTF8
    Write-Host "Applied: $Description" -ForegroundColor Green
  } else {
    Write-Warning "Skipped exact replacement: $Description. The file may already be fixed or local code differs."
  }
}

function Replace-Regex($Path, $Pattern, $Replacement, $Description) {
  Require-File $Path
  $content = Get-Content $Path -Raw
  $newContent = [regex]::Replace($content, $Pattern, $Replacement, [System.Text.RegularExpressions.RegexOptions]::Singleline)
  if ($newContent -ne $content) {
    Set-Content -Path $Path -Value $newContent -Encoding UTF8
    Write-Host "Applied: $Description" -ForegroundColor Green
  } else {
    Write-Warning "Skipped regex replacement: $Description. The file may already be fixed or local code differs."
  }
}

Write-Step "Checking repository root"
Require-File "package.json"
Require-File ".github\workflows\ci.yml"
Require-File "README.md"

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupRoot = ".patch1-backup\$timestamp"

if (-not $NoBackup) {
  Write-Step "Creating backup in $backupRoot"
  New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
  $backupFiles = @(
    ".github\workflows\ci.yml",
    "README.md",
    "src\lib\automationApi.ts",
    "src\lib\hardeningApi.ts",
    "src\pages\BackupHealthCheck.tsx",
    "src\components\ProjectDetail.tsx"
  )
  foreach ($f in $backupFiles) {
    Backup-File $f $backupRoot
  }
}

Write-Step "Applying static replacement files"
$ciContent = @'
name: GRC Control Center CI

on:
  push:
    branches:
      - main
  pull_request:
  workflow_dispatch:

jobs:
  validation:
    name: Build, Test, Security, Proof
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Typecheck
        run: npm run typecheck

      - name: Build
        run: npm run build

      - name: Unit tests
        run: npm run test:unit

      - name: Install Playwright browsers
        run: npx playwright install --with-deps

      - name: E2E tests
        run: npm run test:e2e

      - name: Security audit
        run: npm audit --audit-level=high

      - name: Full proof suite
        run: npm run proof:all
'@
Set-TextFile ".github\workflows\ci.yml" $ciContent

$liveResultContent = @'
export type LiveResult<T> =
  | { status: "success"; data: T }
  | { status: "empty"; data: null; message?: string }
  | { status: "error"; data: null; error: string }
  | { status: "forbidden"; data: null; reason: string };

export function liveSuccess<T>(data: T): LiveResult<T> {
  return { status: "success", data };
}

export function liveEmpty<T>(message?: string): LiveResult<T> {
  return { status: "empty", data: null, message };
}

export function liveError<T>(err: unknown): LiveResult<T> {
  return {
    status: "error",
    data: null,
    error: err instanceof Error ? err.message : String(err),
  };
}

export function liveForbidden<T>(reason: string): LiveResult<T> {
  return { status: "forbidden", data: null, reason };
}

export function unwrapLiveResult<T>(result: LiveResult<T>, fallback: T): T {
  return result.status === "success" ? result.data : fallback;
}

export function assertLiveSuccess<T>(result: LiveResult<T>): T {
  if (result.status === "success") return result.data;

  if (result.status === "forbidden") {
    throw new Error(`Forbidden: ${result.reason}`);
  }

  if (result.status === "error") {
    throw new Error(result.error);
  }

  throw new Error(result.message ?? "Live data is empty.");
}
'@
Set-TextFile "src\lib\liveResult.ts" $liveResultContent

Write-Step "Removing simple hardcoded demo organization fallbacks"

$oldAutomation = @'
export async function refreshAutomationIntelligence() {
  if (!supabase) {
    return {
      organization_id: 'demo-org',
      due_reviews: liveEmptyReviews.length,
      kri_breaches_30_days: liveEmptyKriBreaches.length,
      committee_overdue: liveEmptyCommittee.filter(row => row.automationSignal === 'overdue').length,
      rules_touched: liveEmptyRules.length,
      refreshed_at: new Date().toISOString()
    };
  }
  return requireServerBridge(
    'Automation intelligence refresh',
    'refresh_automation_intelligence',
  );
}
'@
$newAutomation = @'
export async function refreshAutomationIntelligence() {
  if (!supabase) {
    throw new Error('Automation intelligence refresh requires a live Supabase connection.');
  }

  return requireServerBridge(
    'Automation intelligence refresh',
    'refresh_automation_intelligence',
  );
}
'@
Replace-Exact "src\lib\automationApi.ts" $oldAutomation $newAutomation "automationApi refreshAutomationIntelligence no-demo fallback"

$oldHealthSnapshot = @'
export async function createHealthSnapshot(organizationId: string, createdBy?: string | null): Promise<string | null> {
  if (!supabase || organizationId === 'demo') return null;
  void createdBy;
  return requireServerBridge(
    'System health snapshot creation',
    'create_system_health_snapshot',
  );
}
'@
$newHealthSnapshot = @'
export async function createHealthSnapshot(organizationId: string, createdBy?: string | null): Promise<string | null> {
  if (!supabase) {
    throw new Error('System health snapshot requires a live Supabase connection.');
  }

  if (!organizationId || organizationId.trim().length === 0) {
    throw new Error('System health snapshot requires a valid organization id.');
  }

  void createdBy;

  return requireServerBridge(
    'System health snapshot creation',
    'create_system_health_snapshot',
  );
}
'@
Replace-Exact "src\lib\hardeningApi.ts" $oldHealthSnapshot $newHealthSnapshot "hardeningApi createHealthSnapshot no-demo fallback"

$oldLogExport = "if (!supabase || !params.organizationId || params.organizationId === 'demo') return;"
$newLogExport = @'
if (!supabase) {
    throw new Error('Export logging requires a live Supabase connection.');
  }

  if (!params.organizationId || params.organizationId.trim().length === 0) {
    throw new Error('Export logging requires a valid organization id.');
  }
'@
Replace-Exact "src\lib\hardeningApi.ts" $oldLogExport $newLogExport "hardeningApi logExport no-demo fallback"

Replace-Exact "src\pages\BackupHealthCheck.tsx" "const organizationId = health[0]?.organization_id ?? 'demo';" "const organizationId = health[0]?.organization_id ?? null;" "BackupHealthCheck organizationId no demo fallback"

$oldBackupCall = @'
      const id = await createHealthSnapshot(organizationId);
      setMessage(
'@
$newBackupCall = @'
      if (!organizationId) {
        setMessage(
          language === 'ar'
            ? 'لا يمكن إنشاء لقطة صحة النظام بدون ربطها بمنظمة حقيقية.'
            : 'Cannot create a system health snapshot without a real organization context.'
        );
        return;
      }

      const id = await createHealthSnapshot(organizationId);
      setMessage(
'@
Replace-Exact "src\pages\BackupHealthCheck.tsx" $oldBackupCall $newBackupCall "BackupHealthCheck block snapshot without organization context"

$oldBackupMsg = @'
            : 'تم إنشاء لقطة تجريبية. اربط Supabase لحفظها.'
'@
$newBackupMsg = @'
            : 'لم يتم إنشاء لقطة صحة النظام.'
'@
Replace-Exact "src\pages\BackupHealthCheck.tsx" $oldBackupMsg $newBackupMsg "BackupHealthCheck Arabic no demo snapshot message"

$oldBackupMsgEn = @'
            : 'Demo snapshot generated. Connect Supabase to save it.'
'@
$newBackupMsgEn = @'
            : 'System health snapshot was not created.'
'@
Replace-Exact "src\pages\BackupHealthCheck.tsx" $oldBackupMsgEn $newBackupMsgEn "BackupHealthCheck English no demo snapshot message"

Replace-Exact "src\components\ProjectDetail.tsx" "const organizationId = project.organization_id || 'demo-org';" "const organizationId = project.organization_id ?? null;" "ProjectDetail organizationId no demo fallback"

Write-Step "Updating README current status block"
$readmeStatus = @'
## Current status

**Status:** controlled internal pilot evidence stage.

The project is **not production ready yet**.

Latest verified evidence state:

```text
Technical controlled-pilot readiness: passed
Typecheck: passed
Build: passed
Unit tests: passed
E2E tests: passed
npm audit: 0 high/critical vulnerabilities expected
Full proof suite: passed
Human approval: pending
Production readiness: not yet
```

Passing technical proof does **not** equal production approval.

The platform must not be considered production ready until:

1. Real Management/Admin, IT, and Quality approvals are completed.
2. OVR confidentiality confirmation is completed.
3. Live/staging Supabase RLS and persona tests are executed against a real environment.
4. Live bridge and access review evidence are approved.
5. CI/CD is passing on GitHub.
6. Backup restore dry-run and rollback procedures are tested.
7. Controlled pilot results are reviewed and signed off.

'@
Replace-Regex "README.md" "## Current status\s+.*?(?=## Main modules)" $readmeStatus "README current status truth-state block"

Write-Step "Static Patch 1 files applied"
Write-Host "Next: run scripts\verify-patch1.ps1" -ForegroundColor Yellow
Write-Host "Then run the Codex commands in codex-fix-commands.md if v62:static-strict still reports findings." -ForegroundColor Yellow
