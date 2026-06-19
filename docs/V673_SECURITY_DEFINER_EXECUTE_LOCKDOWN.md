# v6.7.3 Security Definer Execute Lockdown

Migration: `supabase/migrations/046_v673_lockdown_security_definer_execute.sql`

## Policy

No `public` schema `SECURITY DEFINER` function remains executable by:

- `public`
- `anon`
- `authenticated`

Remaining owner-privileged functions are executable only by `service_role`. This includes seed, release, backup, maintenance, audit-trigger, role-administration, and cross-user automation functions.

## Authenticated functions preserved safely

The following functions remain callable by `authenticated`, but are changed to `SECURITY INVOKER`. They run with the caller's privileges and RLS:

- `current_user_org_id()`
- `has_any_role(app_role[])`
- `has_global_role(app_role[])`
- `can_access_org(uuid)`
- `can_access_scope(uuid, uuid, uuid, uuid)`
- `can_manage_grc()`
- `has_role(app_role)`
- `has_role(uuid, app_role)`
- `can_read_organization(uuid)`

These read-only authorization helpers are needed by RLS policies. They can read only `profiles` and `user_roles`, with RLS still active.

## Intentional service-only impact

Privileged or mutating browser RPCs—including role assignment, OVR workflow mutation, escalation mutation, seed-data generation, backup scheduling, restore administration, release preflight, global reminders, and organization-wide automation refresh—are no longer executable directly with an authenticated browser token. They must be invoked through a trusted server/Edge Function using `service_role` after server-side authorization.

No `SECURITY DEFINER` exception is granted to `authenticated`.

## Apply and verify

```powershell
npm run v673:apply
npm run v673:security-definer-audit
npm run v672:capture
npm run v672:proof
```

The local apply helper exists because this repository's historical `016` and `0165` migration names confuse `supabase migration up --local`. It applies only migration 046, records it only after successful execution, and is safe to rerun.

`npm run v673:all` runs the migration, security audit, SQL capture, attachment quality checks, and progress audit. It intentionally does not convert the draft pilot signoff or local restore-start proof into human approval.
