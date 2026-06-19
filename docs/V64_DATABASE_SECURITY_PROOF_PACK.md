# v6.4 Database Security + Proof Pack

This pack is the second major hardening release in the squashed Cursor plan.

It does not add new business modules. It adds database-security proof tools and a staging SQL test script.

## Goals

- Prove which public tables have explicit RLS.
- Identify sensitive tables without detected policies.
- Detect risky SECURITY DEFINER functions.
- Detect sensitive views without `security_invoker=true`.
- Generate executable SQL tests for staging.
- Create a release evidence catalogue for database security controls and persona tests.

## Local validation

```bash
node scripts/v64-install-database-security-scripts.mjs
npm run v64:all
```

Strict mode, after you have reviewed/fixed RLS gaps:

```bash
npm run v64:strict-all
```

## Supabase staging proof

Apply migration:

```text
supabase/migrations/042_v64_database_security_proof.sql
```

Then run in Supabase SQL editor:

```sql
select public.seed_v64_database_security_proof_defaults();
select * from public.v_v64_security_control_scorecard;
select * from public.v_v64_persona_test_matrix;
select * from public.v_v64_database_security_readiness;
```

Then execute:

```text
supabase/tests/v64_persona_security_tests.sql
```

Any raised exception means the database is not yet ready for production/pilot proof.

## Important

Passing `typecheck` and `build` is not database security proof. The proof is complete only after the SQL tests pass in a fresh staging Supabase project with real personas.
