# v12.0 Validation Summary

Validated in a repo snapshot after applying the patch files.

Commands run:

```text
node scripts/v120-install-package-scripts.mjs
npm run pilot:v120-polish
npm install --no-audit --no-fund
npm run typecheck
npm run build
```

Results:

```text
pilot:v120-polish: passed
typecheck: passed
build: passed
```

Notes:

- Database migration was not applied inside this container because local Docker Supabase is on the user's machine.
- The migration was intentionally designed to avoid the v11 `evidence_items` problem by referencing only core stable tables.
- Final local proof should still be run on the user's machine after applying the migration.
