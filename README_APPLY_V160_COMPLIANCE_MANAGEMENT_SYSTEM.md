# Apply v16.0 Compliance Management System Execution Pack

## Extract

Extract this ZIP directly into your repository root:

```text
C:\Users\molte\Downloads\grc-control-center
```

Choose **replace files** when Windows asks.

The ZIP is flat/root-ready:

```text
src/
scripts/
release/
APPLY_V160.ps1
README_APPLY_V160_COMPLIANCE_MANAGEMENT_SYSTEM.md
```

## Apply package scripts and CI step

```powershell
cd C:\Users\molte\Downloads\grc-control-center
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
.\APPLY_V160.ps1
```

Alternative without PowerShell script:

```powershell
node scripts/v160-install-package-scripts.mjs
```

## Validate

```powershell
npm ci
npm run typecheck
npm run build
npm run pilot:v160-compliance-management
npm run proof:all
```

Expected:

```text
typecheck: passed
build: passed
pilot:v160-compliance-management: passed
proof:all: 17/0
```

## Scope controls

- No database migration.
- No approval JSON changes.
- No UAT result fabrication.
- No proof-gate bypass.
- No broad production claim.
