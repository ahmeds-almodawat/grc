# v3.6 Performance & Bundle Guide

## Purpose

The app passed build, but Vite warned that the JavaScript bundle was large. This patch adds a production-safe `vite.config.ts` that splits the bundle into logical chunks:

- React runtime
- Supabase client
- Lucide icons
- i18n dictionary
- API/service layer
- shared components
- executive pages
- workflow pages
- GRC pages
- OVR/quality pages
- reports/data pages
- admin/release pages

This is designed to reduce the initial main chunk and make the app easier to load, especially on normal office PCs.

## How to apply

Copy the patch files into the project root and allow overwrite.

Then run:

```bash
npm run typecheck
npm run build
node scripts/v36-bundle-stats.mjs
```

## Expected result

The build should still pass. The output should show multiple JS chunks instead of one large `index-*.js` file.

## Important note

This is bundle chunking, not full route-level lazy loading. If a large warning remains, the next optimization step is to rewrite `src/App.tsx` with `React.lazy()` and `Suspense` for each hub/page.
