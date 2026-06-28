# Apply v21.0 Framework Crosswalk + Live GRC Backbone Pack

Extract this ZIP directly into:

```text
C:\Users\molte\Downloads\grc-control-center
```

Choose **replace files** if Windows asks.

Then run:

```powershell
cd C:\Users\molte\Downloads\grc-control-center

Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
.\APPLY_V210.ps1
```

Or without PowerShell:

```powershell
node scripts/v210-install-package-scripts.mjs
```

Validate:

```powershell
npm ci
npm run typecheck
npm run build
npm run pilot:v210-framework-crosswalk
npm run proof:all
```

Target:

```text
typecheck: passed
build: passed
pilot:v210-framework-crosswalk: passed
proof:all: 17/0
```

## Notes

- This pack is add-only.
- It does not touch approval JSON files.
- It does not claim external accreditation.
- The database migration enables RLS and avoids broad authenticated policies.
- Live write access should be added later only through reviewed org-scoped policies or authenticated Edge bridges.
