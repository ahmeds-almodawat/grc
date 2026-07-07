# Patch 82G Validation Report

Patch 82G validation should confirm that privileged admin actions no longer crash on local ES256 Supabase tokens and still reject unauthenticated callers.

## Required validation

- `npm run validate:build`
- `npm run validate:security`
- `npm run patch82g:proof`
- `npm run release:restore-noise`

## Manual local smoke test

1. Restart local Supabase Edge Functions if needed.
2. Sign in as an authorized pilot administrator.
3. Assign or change a user department from the UI.
4. Confirm the action reaches the normal server-side authorization path.
5. Confirm the local Edge Runtime logs do not show the ES256 CryptoKey crash.
6. Confirm any safe server-side rejection appears as a structured user-facing error instead of only a generic non-2xx message.

## Completed validation

- `npm run validate:build` passed.
- `npm run validate:security` passed.
- `npm run patch82g:proof` passed.
- `npm run release:restore-noise` passed.

## Local smoke status

- Local Supabase Edge Runtime was restarted.
- Fresh Edge Runtime logs after restart did not show the ES256 CryptoKey crash.
- Full UI department-assignment smoke testing still requires a valid pilot administrator session and should be completed manually.

## Status

Ready for manual local smoke testing of privileged admin department assignment.
