# Environment Variable Validation Guide

## Required categories

- Supabase URL for staging.
- Supabase anon key for staging frontend.
- Supabase service role key only for server-side or Edge operations.
- Auth redirect URLs for staging.
- Feature flags for controlled pilot mode.
- Evidence capture configuration.

## Forbidden patterns

- Production database URL in staging.
- Service role key exposed to frontend.
- Patient data import flags enabled.
- Demo fallback bypass flags enabled.
- Real OVR data connection enabled.

## Template files

Allowed template files include:

- `.env.example`
- `.env.production.example`
- `.env.staging.example`
- `.env.development.example`

Real secret-bearing `.env` files must stay local and untracked.
