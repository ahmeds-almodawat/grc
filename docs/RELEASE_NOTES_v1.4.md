# GRC Control Center v1.4 — Rollout UX & Onboarding Patch

## Purpose
This patch strengthens rollout usability for a 1,000-employee, 50-department launch. It does not add a new business module; it improves readiness, guided setup, training, bilingual support, and user adoption.

## Added
- Setup Center page.
- User Guide page.
- Rollout readiness score.
- Readiness checklist fed by Supabase view.
- Role-based training plan.
- CSV export for setup checklist.
- New onboarding API layer.
- New database migration `016_rollout_onboarding_user_guides.sql`.
- Rollout waves tables.
- Restore dry-run job table.
- Training checklist table.
- Setup readiness view.
- Arabic/English labels for the new rollout and user-guide pages.
- Modern UI cards, readiness ring, segmented filters, guide tiles, rule tiles and training cards.

## New database objects
- `grc_training_checklist`
- `rollout_waves`
- `rollout_wave_departments`
- `restore_dry_run_jobs`
- `v_setup_readiness_checklist`

## Readiness checks included
- Organization structure readiness.
- Active user import readiness.
- Critical admin/control role readiness.
- Workflow ownership readiness.
- OVR operational readiness.
- Backup/export readiness.
- Custom report template readiness.

## Recommended rollout sequence
1. Apply migrations through `016_rollout_onboarding_user_guides.sql`.
2. Open Setup Center.
3. Import departments and users in waves.
4. Review Access Control warnings.
5. Run Export Center backup before large imports or permission changes.
6. Train executives, governance, Quality, Audit, department managers and employees using the User Guide.
7. Launch to a pilot group before full-company release.

## Testing
Validated in the build workspace with:

```bash
npm run typecheck
npm run build
```

Both passed. Vite showed only the existing chunk-size warning.
