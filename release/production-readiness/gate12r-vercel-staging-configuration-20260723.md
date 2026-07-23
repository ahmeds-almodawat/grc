# Gate 12R Vercel staging configuration

Captured at `2026-07-22T21:50:42.8851944Z` under the exact authorized configuration scope. The authorization phrase is bound by SHA-256 `98a8f14b21a8e014d7f98f0312e3c07892e5f4cb3a4c33c90eee2c54a063d13f`; the phrase did not authorize deployment or any production change.

## Result

The dedicated Vercel project `grc-staging` was created and configured without a deployment. Its project-owned origin is `https://grc-staging-lilac.vercel.app`. The project has zero deployments and no custom domain.

The clean temporary release candidate was linked to this project. The source repository itself was not linked. Project build settings are fixed to Vite, `npm run build`, output directory `dist`, and `npm ci` on Node.js 24.x.

Preview environment variables were configured by name only:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_PATCH83U_CREDENTIAL_GOVERNANCE_ENABLED`

The values were read only from the ignored local staging configuration, validated in memory, sent to Vercel through redirected process input, and stored as encrypted Preview values. The Supabase URL was required to resolve exactly to staging project `zghsgzrdwbqdrpuxanac`; production project `zbrjjecpsrzposhuarcn` was rejected. Only a publishable or legacy anon browser key was accepted. No value was printed, placed in a command argument, written into release evidence, or copied into the candidate source.

SSO deployment protection is active for all deployments except custom domains, and Git-fork protection is enabled.

## Remaining prerequisite

CAPTCHA configuration is not present in the approved ignored staging settings. `VITE_AUTH_CAPTCHA_REQUIRED` and, when required, `VITE_AUTH_CAPTCHA_SITE_KEY` were therefore not invented or configured. The appropriate public CAPTCHA configuration must be established through a secure provider mechanism before hosted staging deployment authorization. No CAPTCHA value should be supplied in chat.

No deployment occurred. No staging Supabase mutation occurred. Production was neither accessed nor changed. The Git index remained empty.

The temporary linked candidate and its temporary Git archive were removed after confirming that no active process referenced either path. This also removed the provider-generated local linkage state; no Vercel linkage or credential file was added to the source repository.
