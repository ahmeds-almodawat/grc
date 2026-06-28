# v19.0 Executive Reporting + Automation Pack

## Apply

Extract this ZIP directly into:

`C:\Users\molte\Downloads\grc-control-center`

Choose replace files if Windows asks.

Then run:

```powershell
cd C:\Users\molte\Downloads\grc-control-center
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
.\APPLY_V190.ps1
```

Or without PowerShell:

```powershell
node scripts/v190-install-package-scripts.mjs
```

## Validate

```powershell
npm ci
npm run typecheck
npm run build
npm run pilot:v190-executive-reporting
npm run proof:all
```

## Target

- typecheck passed
- build passed
- pilot:v190-executive-reporting passed
- proof:all remains 17/0

## Notes

The installer injects v19 panels into existing pages instead of replacing v15-v18 work.
