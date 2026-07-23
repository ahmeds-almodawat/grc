# Patch 83U staging multi-session reset harness readiness — 2026-07-18

## Readiness conclusion

The local proof harness is prepared for a later, separately authorized staging execution. It is inert by default and has not been run against staging. No post-reset success evidence exists.

The later run remains a high-risk one-shot operation because exactly one eligible Super Admin is expected. An operator must keep a separately reauthenticated Super Admin browser context alive, review a fresh read-only snapshot, and stop on any ambiguity. The harness never invokes abort or reconciliation automatically.

## Prepared files

- `scripts/patch83u-staging-multisession-reset-proof.mjs`
- `scripts/patch83u-staging-reset-evidence.sql`
- `tests/unit/patch83uStagingMultisessionResetProof.test.ts`
- `release/patch83u/patch83u-staging-reset-harness-schema.json`
- `release/patch83u/patch83u-staging-edge-deployment-attestation.json`
- `release/patch83u/patch83u-hosted-state-evidence-addendum-20260718.md`
- `package.json`, with the narrow `patch83u:staging-reset-proof` command

## Harness architecture

The command has four boundaries:

1. Environment refusal validates every supplied Supabase URL against staging `zghsgzrdwbqdrpuxanac` and rejects production `zbrjjecpsrzposhuarcn` before browser or database work.
2. A read-only evidence adapter accepts only a named `psql` service. It first checks `\conninfo` for the staging reference, then runs an explicit `BEGIN READ ONLY` / `ROLLBACK` evidence query. It never accepts a database URL, database password, or service-role key as a command argument.
3. Three nonpersistent Playwright contexts establish a newly reauthenticated Super Admin session and two independent Employee 11111 sessions. The two controlled refresh values are kept in overwriteable in-process buffers only.
4. A one-shot controller crosses the reset boundary only after every readiness check and an immediate exact hidden confirmation. The UI action is clicked once. An absent request correlation, timeout, network failure, or ambiguous response permanently blocks retry for that invocation.

The reset uses the real User Management UI and therefore the real `patch83u_admin_reset_password` Edge workflow. The required password change uses the Forced Password Change UI and therefore `patch83u_change_required_password`. The harness does not call credential RPCs directly.

## Secret and browser safety

- Passwords, login identifiers, and the staging browser API key are obtained only through hidden TTY prompts during the later run.
- Password-like command arguments, token arguments, database URLs, service-role values, and secret-bearing environment variables are refused.
- Empty secret input is refused; temporary and permanent passwords must differ; the reason is checked against every entered secret.
- Trace, HAR, video, storage-state export, automatic screenshots, and verbose network logging are disabled.
- No screenshot code exists in the harness. If screenshots are later added under separate review, all password fields must first be cleared and each image must be reviewed before evidence inclusion.
- Request and response bodies and headers are never emitted. The reset observer extracts only the safe request ID long enough to hash it and retains only the SHA-256.
- Evidence serialization recursively rejects password, access-token, raw refresh-token, header, cookie, session-ID, storage-state, service-role, encrypted-password, and request/response-body keys, token-shaped strings, and all known in-memory secret values.
- Output creation uses exclusive-create semantics so an existing evidence file is not silently overwritten.

## Fail-closed gates

Reset remains blocked unless the current snapshot and browser setup prove:

- staging target and absence of the production reference;
- runtime `enforced`;
- state version 5, or an explicitly reviewed newer version;
- Edge contract `patch83u-edge-auth-first-v1`;
- frontend contract `patch83u-frontend-auth-first-v1`;
- migrations 174, 176, and 177 applied;
- exact finalizer `patch83u_finalize_password_change_after_revocation`;
- target UUID, active profile/credential/requested lifecycle, database and Auth version 2, exact `employee / assigned_only`, no pending operation;
- designated administrator UUID, active profile/credential, exact `super_admin / global`;
- exactly one eligible Super Admin;
- successful isolated Super Admin reauthentication;
- two independent Employee sessions, two refresh values held only in memory, and at least two target database sessions;
- no runtime state/version transition between evidence checkpoints;
- exact interactive reset confirmation immediately before the click.

After reset, forced password change is blocked unless the database/Auth state is exactly `admin_reset_change_required / 3`, with zero sessions, zero unrevoked refresh rows, unchanged active requested lifecycle, and unchanged `employee / assigned_only`.

After required change, completion requires `active / 4` in both database and Auth, zero sessions immediately after finalization, browser sign-out, a fresh permanent-password login, unchanged `employee / assigned_only`, and denied direct Admin navigation.

## Interrupted-operation policy

Timeout, network interruption, missing request correlation, and an ambiguous Edge response are treated as an unknown mutation result. The original request-ID hash is preserved and reset is never submitted again.

Protected states produce operator-only guidance:

- `reset_in_progress`: obtain fresh operation evidence; do not retry.
- `session_revocation_review_required`: stop before password change and request protected review.
- `recovery_required`: stop credential activity and follow a separately authorized recovery runbook.
- credential-version mismatch or nonzero sessions: stop and compare read-only Auth/database evidence.
- runtime transition: abandon the run and repeat the complete readiness review.
- temporary-password rejection: inspect protected state; do not reset again.
- permanent-password policy rejection: remain at Forced Password Change and obtain a different value through a hidden prompt.
- repeated request ID: inspect the existing operation; never create a replacement ID.

The harness never invokes abort or reconciliation RPCs.

## Read-only evidence helper

`scripts/patch83u-staging-reset-evidence.sql` begins a read-only transaction, returns one JSON object, and rolls back explicitly. It reads only:

- runtime state/version and compatible contracts;
- migration rows 174, 176, and 177;
- finalizer existence, definer/search-path/execute contract;
- safe profile, credential state/version, requested lifecycle, role/scope, pending-operation state and timestamps;
- Auth credential version derived through the protected helper;
- `auth.sessions` count and unrevoked `auth.refresh_tokens` count;
- eligible Super Admin count.

It never selects credentials, token strings, session IDs, password digests, Auth email values, or raw Auth metadata. Database target proof is performed before the SQL by checking the operator-approved connection service’s `\conninfo`; the SQL output is accepted only after that check.

## Later invocation shape

Do not use this command until a separate execution window is authorized:

```powershell
npm run patch83u:staging-reset-proof -- --execute-hosted-proof --app-url <approved-staging-app-url> --supabase-url https://zghsgzrdwbqdrpuxanac.supabase.co --psql-service <approved-readonly-psql-service> --out <new-redacted-evidence-json>
```

Do not add credentials to that command. `psql` must obtain any database credential through the existing secure service/prompt mechanism. The harness prompts hidden values only after local/environment gates pass.

## Edge attestation summary

Supabase CLI 2.72.7 reported `privileged-action` version 3, `ACTIVE`, `verify_jwt=true`, with hosted `ezbr_sha256` `7fee99f2d77590f48026ddb0aaec5d540403d7c85fda462aece5154492852762`.

A supported non-mutating `supabase functions download ... --use-api` call against the explicit staging project returned `index.ts`. Its SHA-256 and byte length exactly match the reviewed repository source:

- `supabase/functions/privileged-action/index.ts`: `f4a53ddfd0167ca62661c3c9acc6b7b320a0e43f4b96efc821308e1db73caf87`, 157176 bytes.
- `supabase/config.toml`: `8dbc2b021931fb8f67fe8599bbec95d44ae7379c2a72152840443cd394619169`, 14598 bytes.

This is high-confidence source-text equality. It is not a complete cryptographic deployment-bundle attestation. The hosted `ezbr_sha256` differs from the entrypoint SHA-256, and inspected CLI/API documentation does not define it as the raw source hash. The deployed npm dependency bytes were not returned, so the complete bundle cannot be bound cryptographically without making an unsupported claim.

## Remaining blockers before hosted execution

- Obtain a separate, explicit authorization for the irreversible staging reset/password-change exercise.
- Confirm the only eligible Super Admin will not be locked out; their separate reauthenticated context and secure credential recovery path must be available.
- Provide an approved staging application URL and approved read-only `psql` service whose connection information exposes the staging project reference.
- Review CAPTCHA/manual-login handling in the actual staging UI; the harness does not bypass CAPTCHA.
- Review the redacted JSON output destination and ensure it does not already exist.
- Re-run all readiness evidence immediately before reset. Point-in-time preflight facts are not a substitute.

No blocker should be resolved by weakening RLS, permissions, credential-version enforcement, session checks, JWT verification, audit controls, or service-role isolation.

## Local validation

- `node --check scripts/patch83u-staging-multisession-reset-proof.mjs`: passed.
- JSON parse checks for the evidence schema and Edge attestation: passed.
- Inert package command `npm run patch83u:staging-reset-proof`: passed and made no hosted call.
- Focused mocked Vitest file `tests/unit/patch83uStagingMultisessionResetProof.test.ts`: 18/18 passed.
- `npm run typecheck`: passed.
- `npm run build`: passed; Vite emitted its existing chunk-size advisory and no build error.
- `git diff --check`: passed.
- Additional trailing-whitespace scan across every newly created file: zero matches.

The tests use mocks and pure functions only. They do not connect to staging or production.
