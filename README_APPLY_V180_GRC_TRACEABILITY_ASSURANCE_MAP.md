# v18.0 GRC Traceability + Assurance Map Pack

## Apply

Extract this ZIP directly into:

```text
C:\Users\molte\Downloads\grc-control-center
```

Choose replace if Windows asks.

Then run:

```powershell
cd C:\Users\molte\Downloads\grc-control-center
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
.\APPLY_V180.ps1
```

Or without PowerShell script:

```powershell
node scripts/v180-install-package-scripts.mjs
```

## Validate

```powershell
npm ci
npm run typecheck
npm run build
npm run pilot:v180-traceability
npm run proof:all
```

Expected:

```text
typecheck: passed
build: passed
pilot:v180-traceability: passed
proof:all: 17/0
```

## Scope

This patch adds traceability and assurance mapping across Governance, Evidence and Executive Command pages. It does not modify approval evidence, Supabase migrations, or proof:all logic.
