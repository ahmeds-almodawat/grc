# GRC Control Center v3.8 Patch

This is a non-breaking mega patch focused on final local readiness proof.

Apply it after v3.7 and the v3.5.2 hotfix.

Main command:

```bash
node scripts/v38-install-package-scripts.mjs
npm run v38:all
```

Migration:

```sql
-- apply 032_final_local_doctor_production_simulator.sql
select seed_v38_final_validation_defaults();
```
