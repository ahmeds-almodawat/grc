# v14.0 Professional GRC Workflow Maturity Pack

This pack adds a professional GRC maturity layer around the existing platform without adding another large database/schema pack.

## Professional workflow chain

Risk → Control → Test → Evidence → Issue → CAPA → Audit / Compliance Reporting

## Scope

- Frontend/static maturity model and page enhancements.
- Risks, Compliance, Audit and Governance pages receive maturity panels and workflow traceability views.
- No approval JSON changes.
- No database migration.
- No broad production readiness claim.

## Apply order

1. Copy added files into the repo.
2. Replace the four page files under `src/pages` with the files under `REPLACE/src/pages`.
3. Run `node scripts/v140-install-package-scripts.mjs`.
4. Run validation.

## Validation

```powershell
npm ci
npm run typecheck
npm run build
npm run pilot:v140-professional-grc
npm run proof:all
```

Target:

- `pilot:v140-professional-grc` passes.
- `proof:all` remains 17/0.
