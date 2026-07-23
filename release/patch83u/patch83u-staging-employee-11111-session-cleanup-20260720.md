# Patch83U staging Employee 11111 session cleanup

Decision: **PATCH83U STAGING SESSION CLEANUP STOPPED FAIL-CLOSED**

## Scope

- Staging project: `zghsgzrdwbqdrpuxanac`
- Employee UUID: `2a276bdb-cf51-4303-846e-6b7fecf38b0c`
- Branch: `patch83t-controlled-user-excel-import`
- HEAD: `a9989b1e8d95a6bb775316a2d9e709ef84514c42`

## Read-only evidence

The initial SQL Editor transaction used `BEGIN READ ONLY` and `ROLLBACK`.
It confirmed:

- Runtime `174.2-auth-first`, enforced, state version `5`.
- Employee state `active`, database/Auth credential versions `2 / 2`.
- Lifecycle `active`, role/scope `employee / assigned_only`.
- No pending credential operation.
- Session count `1`.
- Unrevoked refresh-token count `1`.
- The designated Super Admin remained active at version `1`,
  `super_admin / global`, with no pending operation.

## Cleanup attempt

One disposable nonpersistent browser context submitted one staging Employee login
request. Auth rejected the login with safe HTTP status `400`
(`EMPLOYEE_LOGIN_REJECTED`). The password was cleared from process memory, was
not displayed or persisted, and the context closed.

The authenticated UUID gate was not reached. Supabase global sign-out was
therefore not invoked. A second hidden/manual form was offered but was not
submitted; it was stopped without issuing another login or any sign-out.

Tracing, HAR, video, storage-state export, screenshots, request-header logging,
and request-body logging remained disabled. No request targeted production or
an unknown Supabase project.

## Final safe state

A second read-only SQL Editor transaction confirmed the protected state remained
unchanged:

- Session count `1`.
- Unrevoked refresh-token count `1`.
- Employee remains `active`, database/Auth versions `2 / 2`,
  `employee / assigned_only`, lifecycle `active`.
- No pending, recovery, or reconciliation state.
- The designated Super Admin remains unchanged and active.
- Runtime remains enforced at state version `5`.

## Required operator action

Provide the verified current permanent password through a newly authorized
hidden/manual prompt, or authorize another supported session-termination path.
Do not write directly to Auth tables. Do not restart Run 006 until fresh
read-only evidence proves both session counts are zero.

No password reset, password change, credential-version change, deployment,
migration, commit, push, Git staging, or production access occurred.
