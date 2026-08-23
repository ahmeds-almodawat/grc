# P2 RC Environment Contract

No actual hosted value is recorded here.

## Browser-Safe Build Variables

| Variable | Requirement | Scope |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Required | Public environment-specific Supabase API URL |
| `VITE_SUPABASE_ANON_KEY` | Required | Browser-safe publishable/legacy anon key only |
| `VITE_PATCH83U_CREDENTIAL_GOVERNANCE_ENABLED` | Required as exact `true` for the governed credential path | Build-time |
| `VITE_AUTH_CAPTCHA_REQUIRED` | Required explicit `true`/`false` in managed environments | Build-time |
| `VITE_AUTH_CAPTCHA_SITE_KEY` | Required when CAPTCHA is enabled | Public provider site key |
| `VITE_PATCH83T_USER_EXCEL_IMPORT_ENABLED` | Optional, default disabled | Build-time deployment gate |
| `VITE_DEPARTMENT_IMPORT_EXECUTION_ENABLED` | Optional, default disabled | Build-time deployment gate |
| `VITE_ALLOW_DEMO_DATA` | Required `false` for staging/Production | Build-time safety gate |
| `VITE_AUTH_BYPASS_LOCAL` | Must be false/empty outside local Vite development | Local-only safety gate |
| `VITE_CONTROLLED_PILOT_MODE` | Optional and controlled; disabled for normal release | Build-time |

## Edge Runtime / Private Variables

| Variable | Requirement | Handling |
| --- | --- | --- |
| `SUPABASE_URL` | Required by privileged-action | Runtime-injected environment URL |
| `SUPABASE_ANON_KEY` | Required by privileged-action | Server runtime only |
| `SUPABASE_SERVICE_ROLE_KEY` | Required by privileged-action | Secret; never browser-visible |
| `V99_SCENARIO_LAB_ENABLED` | Optional; exact `true` only for an authorized controlled lab | Server-side feature gate |
| `SUPABASE_AUTH_SMS_TWILIO_AUTH_TOKEN` | Optional when Twilio SMS is configured | Supabase Auth secret |
| `SUPABASE_AUTH_EXTERNAL_APPLE_SECRET` | Optional when Apple Auth is configured | Supabase Auth secret |

## Deployment Rules

- Vite variables are built into the frontend artifact; verify them before build.
- Only publishable/anon credentials may enter the browser bundle.
- Service-role, database, JWT-signing, OAuth-client, and provider secret values
  remain in the managed server/Supabase secret store.
- P2 did not fetch, print, or modify hosted environment values.

