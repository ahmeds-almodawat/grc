# Patch 83U Auth security-settings evidence preflight

## Purpose and boundary

This preflight records the hosted Supabase Auth security settings required by the Patch 83U release review. It performs one authenticated `GET` request to the official Management API Auth-config endpoint. It does not update Supabase, Vercel, Auth users, sessions, database objects, migrations, or provider settings.

The local implementation and automated tests are not hosted proof. A release operator must run this preflight in the explicitly authorized production-evidence window and review the resulting record before approval.

## Credential handling

- Supply the Management API credential only through the process-local `SUPABASE_ACCESS_TOKEN` environment variable. Do not place it in a `VITE_` variable, command argument, repository file, log, screenshot, or evidence artifact.
- Supply `SUPABASE_PROJECT_REF` through the process environment or the non-secret `--project-ref` argument.
- The preflight uses an allowlist and discards the raw Management API response. It does not retain CAPTCHA secrets, SMTP credentials, OAuth credentials, hooks, API keys, access tokens, or the plain project reference.
- The output contains only a SHA-256 project-reference fingerprint so the operator can correlate evidence without publishing the reference.
- `--out` uses exclusive creation and refuses to overwrite an existing evidence file.

## Frontend release configuration

- `VITE_AUTH_CAPTCHA_REQUIRED=true` requires CAPTCHA for every password sign-in, regardless of whether the user entered an Employee ID or a full email address.
- `VITE_AUTH_CAPTCHA_SITE_KEY` contains only the Cloudflare Turnstile public site key. The Turnstile secret is configured only in the provider/Supabase control plane and must never be exposed as a `VITE_` value.
- An invalid required-flag value, or a required challenge with no public site key, fails closed before any Supabase sign-in request.
- `VITE_AUTH_CAPTCHA_REQUIRED=false` explicitly disables the frontend challenge. An unset flag also preserves the existing local-development flow. A production release seeking CAPTCHA approval must set the flag to exactly `true`; there is no Employee-ID, hostname, or local-network exception in the sign-in code.
- The login form resets the one-time challenge after each Auth attempt. Supabase performs the authoritative token validation when hosted CAPTCHA protection is enabled.

## Controlled command

From the repository root, in a shell whose environment has the authorized token and project reference:

```powershell
node scripts/patch83u-auth-settings-preflight.mjs --out release/patch83u/evidence/patch83u-auth-settings-evidence.json
```

Without `--out`, the sanitized record is written to standard output. Redirect it only to an approved evidence location. Clear the process-local token when the capture is complete.

## Recorded fields

The sanitized evidence records:

- CAPTCHA enabled status and provider, never the provider secret;
- every returned `rate_limit_*` Auth endpoint setting, plus explicit observed/missing status for the currently documented fields;
- password minimum length and required-character policy;
- leaked-password protection status (`password_hibp_enabled`);
- JWT expiry in seconds;
- session lifetime, inactivity timeout, and single-session-per-user settings;
- any requested field omitted by the Management API, so absence cannot be mistaken for a disabled control.

## Review procedure

1. Confirm the source method is `GET`, `raw_response_retained` is `false`, and `credentials_retained` is `false`.
2. Confirm `settings.captcha.enabled` is observed and matches the frontend release flag. A production build requiring CAPTCHA must have hosted CAPTCHA enabled and the provider set to Turnstile.
3. Compare every observed Auth rate limit with the approved abuse-protection baseline. Escalate missing fields rather than inferring defaults.
4. Confirm the minimum password length and required-character policy are compatible with the controlled five-digit initial-password decision. Do not claim five-digit acceptance without an authorized hosted test.
5. Confirm leaked-password protection, JWT expiry, session lifetime, inactivity timeout, and single-session behavior against the approved security baseline.
6. Record reviewer, timestamp, environment, evidence hash, decision, and deviations in the release record.

## Remaining hosted proof

No hosted settings were read or changed while implementing this preflight. CAPTCHA verification, invalid-token rejection, rate limits, password policy, leaked-password checks, JWT expiry, and session controls remain unproven until the sanitized preflight is run and the relevant behavior is tested in an explicitly authorized environment.

References: [Supabase CAPTCHA protection](https://supabase.com/docs/guides/auth/auth-captcha), [Supabase Management API](https://supabase.com/docs/reference/api/getting-started).
