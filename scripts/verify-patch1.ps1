$ErrorActionPreference = "Stop"

Write-Host "==> npm ci" -ForegroundColor Cyan
npm ci

Write-Host "==> npm run typecheck" -ForegroundColor Cyan
npm run typecheck

Write-Host "==> npm run build" -ForegroundColor Cyan
npm run build

Write-Host "==> npm run test:unit" -ForegroundColor Cyan
npm run test:unit

Write-Host "==> Install Playwright browsers" -ForegroundColor Cyan
npx playwright install --with-deps

Write-Host "==> npm run test:e2e" -ForegroundColor Cyan
npm run test:e2e

Write-Host "==> npm audit --audit-level=high" -ForegroundColor Cyan
npm audit --audit-level=high

Write-Host "==> npm run proof:all" -ForegroundColor Cyan
npm run proof:all

Write-Host "==> npm run v62:static-strict" -ForegroundColor Cyan
npm run v62:static-strict

Write-Host ""
Write-Host "Patch 1 verification completed." -ForegroundColor Green
