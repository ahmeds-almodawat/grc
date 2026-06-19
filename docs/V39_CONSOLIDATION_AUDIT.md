# v3.9 Full Consolidation Audit

Purpose: prove the local project tree is clean after many patch applications.

Run:

```bash
node scripts/v39-full-consolidation-audit.mjs
```

Checks:

- required core files
- migration count
- duplicate migration number prefixes
- page/lib/script/doc counts
- risk signals for missing pilot/consolidation files
- route duplicate signals from `src/App.tsx`

Output:

- `release/v39-consolidation-audit.json`
- `release/v39-consolidation-audit.md`

Stop if the report shows missing required files or duplicate migration prefixes.
