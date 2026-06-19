# v6.4.2 Auth Route RLS Static Fix

This patch closes the remaining v6.4 strict RLS static finding after v6.4.1.

## Why this patch exists

v6.3 added `auth_route_protection_controls`, which is a security/control table. The v6.4 RLS static audit correctly classified it as sensitive because of the `controls` suffix. v6.4.1 was created before that local migration was present in the tested tree, so one critical finding remained.

## What it changes

- Enables RLS on `public.auth_route_protection_controls`.
- Adds a conservative deny-all authenticated policy until staging persona tests define final scoped access.
- Marks `public.v_v63_auth_route_protection_scorecard` as `security_invoker` where supported.
- Fixes/revokes broad public execution for `public.seed_v63_auth_route_protection_defaults()`.

## Expected local result

After applying this patch, run:

```bash
npm run v64:strict-all
```

Expected static result:

- RLS strict: passed
- Function strict: passed
- View strict: passed
- Database proof status: static-ready, pending staging persona SQL tests

## Important

This is still static proof only. Final production proof requires applying migrations in a staging Supabase project and running:

```text
supabase/tests/v64_persona_security_tests.sql
```
