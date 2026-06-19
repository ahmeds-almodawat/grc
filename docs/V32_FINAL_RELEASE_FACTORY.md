# v3.2 Final Release Factory

This patch is designed to stop feature expansion and move the GRC Control Center into the fastest safe finish path.

## Goal

Create one final factory for:

1. Codebase consolidation
2. Ordered migration bundle
3. Route audit
4. Translation key audit
5. Production handover bundle
6. RLS persona proof
7. Backup and restore proof
8. OVR end-to-end proof
9. Arabic/RTL critical-page proof
10. Pilot sign-off

## New local commands

Run after applying all patches to your local project:

```bash
npm run migrations:bundle
npm run audit:routes
npm run audit:i18n
npm run final:handover
npm run final:all
```

## Meaning of the commands

| Command | Purpose |
|---|---|
| `npm run migrations:bundle` | Creates `supabase/_consolidated/ALL_MIGRATIONS_ORDERED.sql` and a JSON migration manifest. |
| `npm run audit:routes` | Checks that registered page keys have matching render routes and nav entries are valid. |
| `npm run audit:i18n` | Scans `t('...')` keys and reports missing translation dictionary entries. |
| `npm run final:handover` | Creates `release/PRODUCTION_OPERATOR_HANDOVER_BUNDLE.md` and `release/release-inventory.json`. |
| `npm run final:all` | Runs typecheck, build, migration verification, migration bundle, route audit, i18n audit, handover bundle and final smoke check. |

## Important warning

The consolidated migration file is a review artifact. For Supabase production, prefer applying ordered migration files unless your DBA approves a consolidated install strategy.

## Production stop rule

Do not go live for all employees until these are evidenced:

- Fresh Supabase migration run
- RLS persona matrix
- Backup and restore dry-run
- OVR workflow end-to-end
- Arabic/RTL visual QA
- Pilot wave approval
- Named support handover
