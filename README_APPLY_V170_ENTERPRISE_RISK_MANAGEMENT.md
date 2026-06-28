# Apply v17.0 Enterprise Risk Management Execution Pack

Extract this ZIP directly into your repository root:

```text
C:\Users\molte\Downloads\grc-control-center
```

Choose replace files when Windows asks.

Then run:

```powershell
cd C:\Users\molte\Downloads\grc-control-center
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
.\APPLY_V170.ps1
```

Or without PowerShell:

```powershell
node scripts/v170-install-package-scripts.mjs
```

Validate:

```powershell
npm ci
npm run typecheck
npm run build
npm run pilot:v170-enterprise-risk
npm run proof:all
```

Target:

```text
typecheck: passed
build: passed
pilot:v170-enterprise-risk: passed
proof:all: 17/0
```

Do not commit `node_modules/`, `dist/`, `.env`, `.env.local`, or `supabase/.temp/`.
