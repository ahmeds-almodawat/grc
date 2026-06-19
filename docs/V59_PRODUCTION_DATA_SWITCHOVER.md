# v5.9 Production Data Switchover

Before pilot, switch the app mindset from “demo tolerated” to “real-data only”.

## Required environment behavior

Production should not silently show fallback records.

Recommended environment variables:

```text
VITE_ALLOW_DEMO_DATA=false
VITE_REQUIRE_SUPABASE=true
VITE_APP_ENV=production
```

## UI behavior

If Supabase is not configured:

- show setup warning
- do not show fake dashboards
- do not allow users to believe sample data is real

If Supabase query fails:

- show error state
- log it
- do not replace with fake data silently

## Pilot rule

Pilot can use seed data only in staging/training environment. Real production pilot should use reviewed real company data.
