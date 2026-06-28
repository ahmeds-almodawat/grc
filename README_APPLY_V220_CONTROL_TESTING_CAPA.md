# v22.0 Control Testing + CAPA Execution Engine Pack

## Purpose

This patch adds the next professional GRC execution layer:

`Control → Test → Result → Exception → Issue → CAPA → Evidence → Closure`

It is designed to apply after v21 and to preserve the v14-v21 UI work.

## Structure

This is a flat/root-ready patch:

- `src/`
- `scripts/`
- `release/`
- `supabase/`
- `APPLY_V220.ps1`

Extract directly into the repository root:

`C:\Users\molte\Downloads\grc-control-center`

## Apply

```powershell
cd C:\Users\molte\Downloads\grc-control-center
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
.\APPLY_V220.ps1
```

Or without PowerShell:

```powershell
node scripts/v220-install-package-scripts.mjs
```

## Validate

```powershell
npm ci
npm run typecheck
npm run build
npm run pilot:v220-control-testing
npm run proof:all
```

Target:

- typecheck passed
- build passed
- pilot:v220-control-testing passed
- proof:all 17/0

## Notes

- This patch adds an RLS-enabled schema contract for control testing and CAPA.
- It does not add broad authenticated write policies.
- It does not fake control test results, evidence, or accreditation readiness.
- Use Codex only for local TypeScript/import fixes if your current pages differ from the expected anchors.
