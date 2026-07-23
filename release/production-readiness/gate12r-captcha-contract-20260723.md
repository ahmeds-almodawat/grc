# Gate 12R CAPTCHA contract

## Decision

The contract is proven from current source and existing Patch 83U evidence. Manual provider configuration and protected Supabase Auth verification are still required before the Vercel Preview values can be completed.

## Exact contract

- Provider: Cloudflare Turnstile, explicitly rendered from `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit`.
- Frontend requirement flag: `VITE_AUTH_CAPTCHA_REQUIRED`, exactly `true` for the hosted release candidate.
- Frontend public site-key variable: `VITE_AUTH_CAPTCHA_SITE_KEY`.
- The site key is public browser configuration. A provider secret must never be stored in a `VITE_` variable.
- A missing site key while CAPTCHA is required fails closed before an Auth request. Invalid required-flag values also fail closed.
- Login and forced password reauthentication pass a fresh one-time CAPTCHA token through the supported Supabase Auth request contract.
- Supabase Auth performs authoritative server-side token verification. The corresponding Turnstile secret belongs only in the protected Supabase Auth CAPTCHA provider configuration. It is neither a Vercel frontend value nor a separate Edge Function secret.
- The Edge Function forwards a CAPTCHA token only for protected password reauthentication and maps provider rejection to a safe application error.

## Host and environment boundary

The dedicated staging hostname must be registered with the Turnstile widget exactly as:

`grc-staging-lilac.vercel.app`

The approved frontend values belong only to the `grc-staging` Preview environment. No Vercel Production environment change is required or authorized. The production GRC origin, wildcard production domains, localhost-only configuration, unrelated Preview hosts, and Turnstile test keys are not accepted for the release candidate.

## Required secure dashboard action

1. In Cloudflare Dashboard, open **Turnstile**, select or create the dedicated staging widget, and configure the hostname `grc-staging-lilac.vercel.app` exactly. Use a normal staging widget, not a provider test key.
2. In the `grc-staging` Vercel project, configure Preview-only `VITE_AUTH_CAPTCHA_REQUIRED` as `true` and enter the widget's public site key into Preview-only `VITE_AUTH_CAPTCHA_SITE_KEY` through the Vercel Dashboard. Do not paste either value into chat or a shell command.
3. In the staging Supabase Dashboard, inspect **Authentication → Bot and Abuse Protection / CAPTCHA**. Confirm CAPTCHA is enabled, the provider is Turnstile, and the matching provider secret is present as a masked protected setting. Do not reveal it. If it is missing, a separate explicit authorization is required before changing staging Auth configuration.

After these actions, the operator should report only three booleans: hostname configured, Vercel Preview variables configured, and Supabase Auth Turnstile secret present. No site key or secret value should be reported.

## Current safe status

- Turnstile hostname: manual confirmation required.
- Vercel Preview CAPTCHA variables: not yet configured.
- Supabase Auth CAPTCHA enabled/provider/secret: unable to verify without an authorized dashboard session or process-local Management API credential.
- Deployments: remain zero.
- No secret or CAPTCHA value was read or recorded.
