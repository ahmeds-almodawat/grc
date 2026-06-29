$ErrorActionPreference = "Stop"

Write-Host "Verifying Patch 5 file presence..." -ForegroundColor Cyan
$required = @(
  "supabase\migrations\066_patch5_workflow_kernel.sql",
  "src\lib\workflowKernelApi.ts",
  "src\pages\WorkflowKernelCenter.tsx"
)

foreach ($path in $required) {
  if (!(Test-Path $path)) { throw "Missing required Patch 5 file: $path" }
  Write-Host "OK: $path" -ForegroundColor Green
}

Write-Host "Checking App.tsx integration..." -ForegroundColor Cyan
$app = Get-Content "src\App.tsx" -Raw
if ($app -notmatch "WorkflowKernelCenter") { throw "WorkflowKernelCenter is not referenced in src/App.tsx" }
if ($app -notmatch "id: 'workflowKernel'") { throw "Workflow Kernel tab not found in src/App.tsx" }
if ($app -notmatch "id: 'auditEvidenceGovernance'") { throw "Audit Evidence Governance tab not found in src/App.tsx" }

Write-Host "Running TypeScript check..." -ForegroundColor Cyan
npm run typecheck

Write-Host "Running build..." -ForegroundColor Cyan
npm run build

Write-Host "Running unit tests..." -ForegroundColor Cyan
npm run test:unit

Write-Host "Running proof suite..." -ForegroundColor Cyan
npm run proof:all

Write-Host "Patch 5 verification completed." -ForegroundColor Green
