# Patch 83U staging frontend target readiness — 2026-07-18

## Decision

**STAGING FRONTEND TARGET NOT READY**

The isolated staging path and fail-closed guards are implemented and locally validated. Startup remains blocked because no staging public browser key is available locally. This decision does not authorize the reset harness, and the separate `pg_service` blocker was not addressed.

## Previous production derivation

The frontend uses:

- `VITE_SUPABASE_URL` for the Supabase URL.
- `VITE_SUPABASE_ANON_KEY` for the public browser client key.

Although the root `.env` also contains `VITE_SUPABASE_PUBLISHABLE_KEY`, current frontend source does not read it.

The default `npm run dev` command remains `vite`, which uses development mode. Vite considers `.env`, `.env.local`, `.env.development`, and `.env.development.local`; only `.env` currently exists among those automatically loaded files. `.env.example` and `.env.production.example` are not loaded automatically.

The root `.env` supplies a production `VITE_SUPABASE_URL`, so the default development path derives prohibited project `zbrjjecpsrzposhuarcn`. No `src` file contains a hardcoded hosted Supabase URL, production ref, or production fallback. The reset harness does not start Vite; it expects an already-running origin supplied through `--app-url`. No separate staging Vite mode existed before this task.

No full browser key, secret, URL credential, token, cookie, authorization header, service-role value, or database credential was printed or recorded.

## Staging-only launch path

Exact command:

```powershell
npm run dev:staging
```

The command invokes `scripts/start-patch83u-staging-frontend.mjs`, which:

1. Reads only root `.env.staging.local`.
2. Does not read or merge `.env`, `.env.local`, or process-level `VITE_*` values.
3. Requires the exact HTTPS URL `https://zghsgzrdwbqdrpuxanac.supabase.co`.
4. Rejects production, unknown, empty, malformed, credential-bearing, path-bearing, query-bearing, and fragment-bearing Supabase URLs.
5. Recursively rejects production ref `zbrjjecpsrzposhuarcn` in browser configuration.
6. Requires a nonempty public browser key and rejects `sb_secret_` or decoded `service_role` keys.
7. Removes all inherited `VITE_*` values before spawning Vite.
8. Sets a verified staging marker consumed by `vite.config.ts`.
9. Starts Vite only after every check passes, on exact origin `http://localhost:5173`, mode `staging`, strict port `5173`.
10. Prints only `Verified staging Supabase project: zghsgzrdwbqdrpuxanac` on successful validation.

For staging mode, `vite.config.ts` requires the startup marker, independently rechecks the URL/key/production-ref boundary, and sets `envDir: false`. Direct `vite --mode staging` therefore cannot silently load the production `.env` or bypass the guard.

The ordinary `npm run dev` command remains unchanged.

## Environment-file safety

`.env.staging.local` is covered by the existing `.gitignore` rule `.env.*.local`; `.gitignore` did not require modification. The local file contains the exact staging URL, the Patch 83U frontend feature flag, and an intentionally empty `VITE_SUPABASE_ANON_KEY`.

The root production `.env` was not modified. Its audit-only SHA-256 remains `557ab4fa0bc7e9b92f724e2351e58ae560701c74aeadf97fa472d36fe6aace77`.

No staging or production key was added to tracked source, package scripts, tests, logs, or evidence. No service-role key was requested or used.

Missing prerequisite: an operator must place a valid public browser key belonging to staging project `zghsgzrdwbqdrpuxanac` into ignored `.env.staging.local` as `VITE_SUPABASE_ANON_KEY` using an approved local secret-handling channel. It must not be supplied in chat, source, package scripts, or command arguments.

## Harness integration

The reset harness now:

- Requires exact application origin `http://localhost:5173`.
- Refuses `127.0.0.1`, alternate ports, hosted origins, paths, query strings, fragments, or credential-bearing URLs.
- Probes that exact local origin before requesting any credentials and fails closed when unreachable.
- Attests the loaded same-origin browser bundle contains the staging ref and not the production ref before filling credential fields.
- Blocks production network requests and any Supabase hostname that does not begin with the exact staging project ref.
- Preserves all existing runtime, database, administrator, role/scope, credential-version, session, refresh, one-shot and ambiguity gates.

The harness still does not start Vite and was not executed with `--execute-hosted-proof`.

## Validation

| Validation | Result |
|---|---|
| JavaScript syntax checks | PASS |
| Focused tests | PASS — 2 files, 31/31 tests |
| Exact staging URL accepted | PASS |
| Production URL rejected | PASS |
| Unknown project rejected | PASS |
| Malformed/missing URL rejected | PASS |
| Production ref hidden in another configuration value rejected | PASS |
| Default `.env`/inherited `VITE_*` isolation | PASS |
| Safe summary serialization; no public key in output | PASS |
| Missing public key blocks before Vite | PASS |
| TypeScript typecheck | PASS |
| Production build | PASS — Vite 8.0.16, 2,003 modules; existing large-chunk warning only |
| Local Vite smoke test | NOT RUN — valid staging public browser key unavailable |
| Application request leaving the local process | No |
| Hosted request in unit tests | No |

- Readiness JSON parse: PASS.
- `git diff --check`: PASS with existing LF-to-CRLF conversion warnings and no whitespace error.

## File hashes

| File | SHA-256 | Bytes |
|---|---|---:|
| `scripts/start-patch83u-staging-frontend.mjs` | `e5ced674c7b791b23ac602065563d9ab125509bffb1046246778ac311bf08579` | 8,337 |
| `vite.config.ts` | `ad4807d5842c861c2d39392994ce3b3a3021455c6c91102b49dd901717e7661b` | 4,129 |
| `package.json` | `bd940adb14e7afb37fe8e7e40678dd4a4d264723beae0448c19b3f02e9ad8007` | 59,000 |
| `.gitignore` | `feeae89860fde2ee0a690374f0ee36fd86080617f2a812e9cd5fdab438bbb53c` | 360 |
| `.env.staging.local` | `6d7407724084d0864e3b1a8933e05e29ce6a83b9b0d9e0cea09b120f8149d2ca` | 266 |
| `scripts/patch83u-staging-multisession-reset-proof.mjs` | `649da662188e3345ad9ea41be66f0fe53f11fb8aff02f183c006ee81a2f66602` | 52,397 |
| `tests/unit/patch83uStagingFrontendTarget.test.ts` | `a2456c06085e5c6806a3f65bcf027d1032c0d5e685a4c3b68f5327c88c187a8a` | 4,626 |
| `tests/unit/patch83uStagingMultisessionResetProof.test.ts` | `eb78dfe9384c23634b63a3900c476e23dc9b97c3f5d2d30085092c0eb938e287` | 14,013 |

## Repository state

- Branch: `patch83t-controlled-user-excel-import`
- HEAD: `a9989b1e8d95a6bb775316a2d9e709ef84514c42`
- Expected final working tree: 116 entries — 63 modified, 53 untracked
- Staged files: 0

No credentials were entered. No login, password reset, password change, database connection, PostgreSQL operation, deployment, migration, hosted mutation, production access, staging, commit, or push occurred.
