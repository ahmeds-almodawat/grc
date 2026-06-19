# Final Patch Application Order

Recommended practical order if you are applying from the latest full starter plus patches:

1. Apply the latest consolidated full project when available, or apply all patches in version order.
2. Apply v2.4 UI consolidation.
3. Apply v2.5 UI polish.
4. Apply v2.6 executive UX.
5. Apply v3.0 finish fast release sprint.
6. Apply v3.1 final production leap.
7. Run `npm install`.
8. Run `npm run typecheck`.
9. Run `npm run build`.
10. Run `node scripts/final-smoke-check.mjs`.
11. Run all Supabase migrations in order.
12. Open Production Finish Center and seed final defaults.

Never run production imports or permission changes without a backup/export point.
