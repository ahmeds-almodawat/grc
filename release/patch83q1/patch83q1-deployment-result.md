# Patch 83Q.1 Deployment Result

After all local gates passed, only `privileged-action` was deployed to linked project `zbrjjecpsrzposhuarcn` using `npx supabase functions deploy privileged-action --use-api`.

Post-deployment function state:

- status: `ACTIVE`
- version: `5` (previously `4`)
- deployed SHA-256: `f09dc889e4a10eb457bf3024beb14af92a6cd377fa4ee7b01f1ea440f3e80e3a`
- `verify_jwt`: `true`
- uploaded asset: `supabase/functions/privileged-action/index.ts`

No other Edge Function was deployed. No migration was pushed. Migration 170 remains present on both local and remote migration lists.

Live non-mutating denial probes passed at the Edge gateway:

- missing JWT: HTTP 401, `UNAUTHORIZED_NO_AUTH_HEADER`
- invalid JWT: HTTP 401, `UNAUTHORIZED_INVALID_JWT_FORMAT`

The deployed version change, uploaded single asset, checked-in fixed-mapping proof, and post-deployment JWT state verify that the four narrow dispatcher mappings are deployed behind JWT verification.
