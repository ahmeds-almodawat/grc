# v4.6 Apply and Validate

1. Copy patch files into the project root.
2. Run:

```bash
node scripts/v46-install-validation-scripts.mjs
npm run typecheck
npm run build
npm run v46:all
```

3. Apply the migration:

```text
supabase/migrations/034_v46_ovr_bilingual_rtl_production_hardening.sql
```

4. Seed defaults in Supabase:

```sql
select seed_v46_ovr_bilingual_rtl_defaults();
```

5. Review:

```sql
select * from v_v46_ovr_production_queue;
select * from v_v46_ovr_risk_calibration;
select * from v_v46_language_rtl_readiness;
select * from v_v46_production_hardening_scorecard;
```

No existing working UI files are replaced by this pack. It is intentionally low-risk.
