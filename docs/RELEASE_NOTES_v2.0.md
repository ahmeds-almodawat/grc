# Release Notes — v2.0 Ultra Release Patch

This patch moves the platform from feature-building into pre-production control.

## Added

- Ultra Release Control Center
- Migration Verifier
- Restore Dry-run Center
- Admin Safety Console
- Bilingual Dictionary Center
- Production cutover checklist
- Migration verification runs/items
- Restore dry-run steps
- Admin safety locks and change request controls
- Arabic/English core governance dictionary
- Release preflight RPC
- Restore dry-run RPC

## Why it matters

This release helps the company avoid going live with weak controls by checking:

- migrations are in sequence
- backup/export exists
- restore dry-run is documented
- admin-dangerous actions are locked
- bilingual rollout terms are standardized
- blockers/warnings are visible before production

## Tested

Tested on reconstructed project tree:

```bash
npm run typecheck
npm run build
```

Both passed. Vite showed only the normal chunk-size warning.
