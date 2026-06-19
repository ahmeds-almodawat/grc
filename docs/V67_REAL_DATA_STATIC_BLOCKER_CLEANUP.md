# v6.7 Real Data Static Blocker Cleanup

This pack removes the remaining static real-data blockers without adding features.

It converts runtime fallback/demo/mock symbols into production-safe empty live-data placeholders and updates the v6.2 audit so it focuses on real blockers rather than broad false positives from ordinary object returns.

## Files changed by the pack

Replace:

- `scripts/v62-real-data-static-audit.mjs`

Add:

- `scripts/v67-install-real-data-cleanup-scripts.mjs`
- `scripts/v67-real-data-static-blocker-cleanup.mjs`
- `scripts/v67-real-data-cleanup-report.mjs`
- `docs/V67_REAL_DATA_STATIC_BLOCKER_CLEANUP.md`
- `PATCH_NOTES.md`

## Run order

```bash
node scripts/v67-install-real-data-cleanup-scripts.mjs
npm run v67:all
```

## Backup

The cleanup script backs up files it changes under:

```text
release/v67/backups/
```

## Expected target

```text
typecheck: pass
build: pass
test:real: pass
v62 production_blocking_findings: 0
manual evidence: still separate
```

## Important

This does not attach or fake staging evidence. The six manual evidence files under `release/v66/evidence-attachments/` remain required before pilot approval.
