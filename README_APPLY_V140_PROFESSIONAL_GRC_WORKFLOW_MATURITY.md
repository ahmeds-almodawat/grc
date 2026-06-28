# v14.0 Professional GRC Workflow Maturity Pack

This ZIP is arranged in normal repository-root paths only.

Extract all contents directly into:

```text
C:\Users\molte\Downloads\grc-control-center
```

When Windows asks, choose to replace existing files.

## Files replaced

```text
src/pages/Risks.tsx
src/pages/Compliance.tsx
src/pages/Audit.tsx
src/pages/Governance.tsx
```

## Files added

```text
src/lib/v140ProfessionalGrcModel.ts
src/components/v140/ProfessionalGrcWorkflowMap.tsx
src/components/v140/ProfessionalGrcMaturityPanel.tsx
src/styles/v140-professional-grc.css
scripts/v140-professional-grc-static-audit.mjs
scripts/v140-professional-grc-report.mjs
scripts/v140-final-proof.mjs
scripts/v140-install-package-scripts.mjs
release/v140/README.md
release/v140/v140-static-audit.json
release/v140/v140-professional-grc-report.md
release/v140/v140-final-proof.json
```

## Apply package script update

After extraction, run:

```powershell
.\APPLY_V140.ps1
```

Then validate:

```powershell
npm ci
npm run typecheck
npm run build
npm run pilot:v140-professional-grc
npm run proof:all
```
