# v3.7 Route Lazy Loading Guide

## Goal

The v3.6 patch improved Vite chunking. v3.7 goes deeper by converting page imports in `src/App.tsx` to `React.lazy()` imports.

This reduces the initial JavaScript loaded by the browser because pages are downloaded only when opened.

## Apply steps

1. Copy the patch files into the project root.
2. Run:

```bash
node scripts/v37-convert-app-to-lazy.mjs
npm run typecheck
npm run build
node scripts/v37-post-build-budget.mjs
```

The converter creates this backup automatically:

```text
src/App.pre-v37-lazy-backup.tsx
```

## Rollback

If anything goes wrong:

```bash
copy src\App.pre-v37-lazy-backup.tsx src\App.tsx
```

Then run:

```bash
npm run typecheck
npm run build
```

## Expected result

Before lazy loading, Vite may produce one large JS asset around 1 MB. After lazy loading, you should see more JS files but smaller initial chunks.

More files is normal. The browser only loads the needed page chunk when the user opens a module.

## Notes

- No database migration is required.
- This patch does not change business logic.
- This patch is safe to test locally because it creates a backup of `App.tsx`.
