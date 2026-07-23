# Gate 12R hosted staging CAPTCHA configuration

The dedicated `grc-staging` target is configured for Cloudflare Turnstile at `grc-staging-lilac.vercel.app`. The provider hostname, Supabase Auth Turnstile provider and masked secret, exact `true` feature flags, staging Supabase project reference, and absence of a production reference were confirmed by the authorized operator without supplying any value.

Read-only Vercel metadata independently confirmed that all five required names exist in both Preview and Production scopes and are stored as sensitive values:

- `VITE_AUTH_CAPTCHA_REQUIRED`
- `VITE_AUTH_CAPTCHA_SITE_KEY`
- `VITE_PATCH83U_CREDENTIAL_GOVERNANCE_ENABLED`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_URL`

No Turnstile secret, service-role key, database credential, or other forbidden credential-shaped variable name exists in the Vercel project metadata. Values were not retrieved. Supabase Auth remains the protected location for the matching Turnstile secret. Gate 10 and Gate 11R evidence continue to prove leaked-password protection is enabled.

The dedicated staging project has zero deployments. The existing `grc` project remains unchanged. This gate made no Vercel or Supabase mutation.
