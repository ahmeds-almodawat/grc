# Patch Consolidation Plan

The platform has grown through many patch ZIPs. Before production, consolidate them into one clean project tree.

## Consolidation steps

1. Start from the latest complete local project folder.
2. Apply patches in order without skipping.
3. Confirm these files reflect the latest version:
   - `src/App.tsx`
   - `src/components/Layout.tsx`
   - `src/i18n/I18nContext.tsx`
   - `src/styles.css`
   - every migration through `026_finish_fast_release_sprint.sql`
4. Run `npm run typecheck`.
5. Run `npm run build`.
6. Create a final clean ZIP excluding:
   - `node_modules`
   - `dist`
   - `.env`
   - local backups
7. Record checksum and date in Release Candidate Center.

## Recommended final release name

```text
grc-control-center-v3.0-rc-final-sprint.zip
```

## What not to do
Do not deploy a folder where patch order is uncertain. Do not mix old App/Layout/i18n files from earlier patches with new pages from later patches.
