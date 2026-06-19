# v3.3 Production Proof Patch

This patch is a finish-fast control layer. It does not add random features. It forces the project into proof-based go-live readiness.

## What it proves

1. Clean consolidated repository.
2. Fresh Supabase migration proof.
3. RLS persona proof.
4. OVR end-to-end proof.
5. Backup and restore proof.
6. Pilot wave acceptance before all-staff rollout.

## Mandatory sequence

```bash
npm run final:all
npm run proof:production
npm run bundle:production-proof
```

Then run the SQL bundle in a fresh Supabase staging project and collect screenshots/evidence.
