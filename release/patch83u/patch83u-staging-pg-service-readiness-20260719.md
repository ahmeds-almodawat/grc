# Patch 83U staging PostgreSQL service readiness — 2026-07-19

## Decision

`PG_SERVICE PREPARED — INTERACTIVE PASSWORD VALIDATION REQUIRED`

The non-secret service definition is prepared. No PostgreSQL connection was opened because `psql` is not installed on this host and this automation channel cannot provide the required secure interactive password prompt.

This decision applies only to `pg_service`. It is not classified as ready. The manually operated staging SQL Editor is separately approved as the read-only evidence channel for the hosted proof.

## Scope and staging identity

- Allowed project reference: `zghsgzrdwbqdrpuxanac`
- Linked project reference verification: passed
- Production project reference detected: no
- Production accessed: no
- Connection mode: Supabase Session pooler
- Host: `aws-0-***.pooler.supabase.com`
- Host SHA-256 prefix: `06eb5f60fd044994`
- Port: `5432`
- Database: `postgres`
- Username classification: project-scoped Supabase pooler database role
- Metadata source: existing linked-project CLI metadata, checked against the exact allowed project reference

The linked pooler metadata contained no password. The exact host and project-scoped username are stored only in the per-user PostgreSQL service file, not in this repository evidence.

## Service definition

- Service file: `C:\Users\molte\AppData\Roaming\postgresql\.pg_service.conf`
- Service name: `grc_patch83u_staging_readonly`
- Application name: `patch83u_staging_reset_evidence_readonly`
- SSL mode: `require`
- Hosted server-side SSL enforcement reported by the staging CLI check: off
- Client behavior: TLS is mandatory; no CA file or client certificate is configured
- Default read-only option present: yes
- Read-only connection acceptance gate present: yes
- Password or passfile field present: no
- `pgpass.conf` created or modified: no
- Production reference present in service parameters: no

`sslmode=require` prevents an unencrypted connection but does not provide `verify-full` CA/hostname verification. No certificate path was invented or added. The connection must still be validated interactively before use.

The service requests `default_transaction_read_only=on` and uses `target_session_attrs=read-only`. If the pooler does not honor the startup option, the connection must fail rather than be accepted as read-write. This remains unverified until the required interactive `psql` check.

## `pg_service` connection validation

- `psql` available: no
- Secure interactive password entry performed: no
- Connection opened: no
- Current database/current user/server version checked: not run
- `transaction_read_only` checked: not run
- Hosted project identity checked through database objects: not run
- Migration 174 checked: not run
- Migration 176 checked: not run
- Migration 177 checked: not run
- Runtime state and state version checked: not run
- Explicit rollback executed: not run because no transaction was opened

Required later operator command in a secure interactive terminal:

```powershell
psql "service=grc_patch83u_staging_readonly" -W -X -v ON_ERROR_STOP=1
```

The password must be entered only at the `psql` prompt. It must not be passed in arguments, stored in an environment variable, written to a password file, or captured in evidence.

## Approved alternate: staging SQL Editor

The operator-confirmed staging SQL Editor validation is accepted as the approved alternate read-only evidence mechanism. It established:

- Runtime schema `174.2-auth-first`, enforcement state `enforced`, and state version `5`.
- Compatible Edge contract `patch83u-edge-auth-first-v1`.
- Compatible frontend contract `patch83u-frontend-auth-first-v1`.
- Applied migrations `174`, `176`, and `177`.
- Stable finalizer `patch83u_finalize_password_change_after_revocation`, 50 bytes.
- Finalizer `SECURITY DEFINER`: yes.
- Finalizer execution restricted to `service_role`; `authenticated`, `anon`, and `PUBLIC` execution: no.
- No database password was stored.
- No mutation occurred.

The later hosted proof may use the six manually operated `BEGIN READ ONLY` / `ROLLBACK` blocks in `scripts/patch83u-staging-sql-editor-evidence.sql`. Before each result is accepted, the harness requires the operator to confirm the exact Dashboard project reference through a hidden prompt. The SQL labels the expected project instead of falsely claiming that PostgreSQL can derive the Dashboard project reference. Each result is then pasted into a hidden harness prompt as one safe JSON object. The harness rejects a production or unknown operator confirmation, a non-read-only result, an incorrect or out-of-order checkpoint label, a stale/future timestamp, or a secret-bearing field.

## Evidence SQL artifacts

Static review of `scripts/patch83u-staging-reset-evidence.sql` passed:

- `ON_ERROR_STOP` is enabled at line 4.
- `BEGIN READ ONLY` is present at line 6.
- Explicit `ROLLBACK` is present at line 331.
- No DDL, DML, `COPY`, or `COMMIT` is present.
- Auth sessions and refresh tokens are reduced to safe counts.
- No password, token, refresh-token value, session identifier, encrypted password, email address, secret, cookie, or authorization header is selected.

Execution result for the `psql` helper: not run.

Static review of `scripts/patch83u-staging-sql-editor-evidence.sql` passed:

- Six separately bounded checkpoint transactions are present.
- Every block begins `BEGIN READ ONLY` and ends `ROLLBACK`.
- Results contain only safe project/runtime/catalog predicates, credential states and versions, role/scope, counts, booleans, and timestamps.
- Post-mutation audit evidence contains only deterministic request-ID hashes, never raw request IDs.
- No token value, session identifier, password, email address, sensitive Auth metadata, or mutation statement is returned.

The SQL Editor channel does not classify `pg_service` as connection-validated and does not require a database password to be stored.

## Repository state

- Branch: `patch83t-controlled-user-excel-import`
- HEAD: `a9989b1e8d95a6bb775316a2d9e709ef84514c42`
- Working tree: dirty; 63 tracked modified files and 61 untracked files after creating this evidence
- Total porcelain entries with all untracked files: 124
- Staged files: 0

## Safety confirmation

No password or secret was requested, displayed, logged, or stored by this preparation. The earlier SQL Editor validation was manually read-only and performed no mutation. No login, reset, password change, refresh replay, global sign-out, hosted mutation, deployment, migration, staging data change, production access, staging, commit, or push occurred.
