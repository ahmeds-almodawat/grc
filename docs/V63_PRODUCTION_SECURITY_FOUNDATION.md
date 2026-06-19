# v6.3 Production Security Foundation

This patch adds the first frontend security foundation for controlled pilot use.

## What changed

- Supabase Auth session shell.
- Login/logout UI.
- Current profile and role context.
- Inactive-user and missing-role blocking.
- Role-based page and navigation visibility.
- Unauthorized screen.
- Local development auth bypass is allowed only when both conditions are true:
  - Vite development mode is active.
  - `VITE_AUTH_BYPASS_LOCAL=true`.

## Production rules

- Do not enable `VITE_AUTH_BYPASS_LOCAL` in production.
- Real users must have a `profiles` row.
- Real users must have at least one active `user_roles` row.
- Normal employees should not see admin, release, security, setup, RLS lab, or backup strategy pages.

## Validation

Run:

```bash
node scripts/v63-install-security-foundation-scripts.mjs
npm run v63:all
```

## Next phase

v6.4 should harden RLS and add executable Supabase persona tests.
