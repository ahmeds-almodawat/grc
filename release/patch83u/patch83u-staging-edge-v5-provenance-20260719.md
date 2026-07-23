# Patch 83U Staging Edge Version 5 Provenance

Classification: `VERSION 5 SOURCE IDENTICAL TO FROZEN REVIEWED SOURCE`

Captured at `2026-07-19T12:17:25.1499459Z` for staging project `zghsgzrdwbqdrpuxanac`. Production was not accessed.

## Active metadata

- Function: `privileged-action`
- Version: `5`
- Status: `ACTIVE`
- JWT verification: enabled
- Hosted metadata hash: `7fee99f2d77590f48026ddb0aaec5d540403d7c85fda462aece5154492852762`
- Created at: `2026-07-16T14:51:49.2360000Z`
- Updated at: `2026-07-17T22:00:47.5100000Z`

The installed Supabase CLI exposes the active function through `functions list` and the active source through `functions download`. Its supported command surface does not expose deployment-version history, an actor, a deployment message, or a previous-version source. The available Management metadata likewise exposes only the active function. Repository evidence did not identify the operations that created versions 4 and 5.

Therefore, the exact deployment cause is not available. The safe observable fact is narrower: the active version counter advanced from the previously recorded `3` to `5`, while the hosted metadata hash and downloaded entry source remained unchanged.

## Source download and comparison

The active function was downloaded with the supported read-only command:

```powershell
supabase functions download privileged-action --project-ref zghsgzrdwbqdrpuxanac --use-api
```

The download used a temporary directory outside the repository and did not overwrite the reviewed source.

| Source | SHA-256 | Bytes |
| --- | --- | ---: |
| Downloaded active `index.ts` | `f4a53ddfd0167ca62661c3c9acc6b7b320a0e43f4b96efc821308e1db73caf87` | 157,176 |
| `supabase/functions/privileged-action/index.ts` | `f4a53ddfd0167ca62661c3c9acc6b7b320a0e43f4b96efc821308e1db73caf87` | 157,176 |

The files are byte-for-byte identical. The local hash also matches the previously frozen reviewed hash.

The downloaded source contains the exact Patch 83U actions, stable finalizer, expected Edge contract, runtime-enforcement checks, credential-version checks, session-revocation proof, server-side service-role access, and fail-closed handling. The prohibited production project reference and deployed secret-value patterns are absent.

## Hosted hash boundary

The hosted `ezbr_sha256` is unchanged from the prior attestation, but it is not equal to the raw `index.ts` SHA-256. No supported metadata establishes that it represents the raw source bytes.

This audit proves high-confidence raw entrypoint equality. It does not prove cryptographic equality of the complete deployment bundle, every dependency, runtime artifact, or hosted gateway configuration.

## Runtime and catalog contract

The approved manual staging SQL Editor evidence was captured at `2026-07-19T10:20:24.936Z`, after the active Edge `updated_at` timestamp. It records:

- runtime `enforced`;
- state version `5`;
- schema `174.2-auth-first`;
- Edge contract `patch83u-edge-auth-first-v1`;
- frontend contract `patch83u-frontend-auth-first-v1`;
- migrations `174`, `176`, and `177`;
- stable finalizer present with service-role-only execution.

No new database query was needed or performed for this provenance audit. A fresh read-only SQL Editor checkpoint remains mandatory in any later separately authorized execution window.

## Safety

No credential was entered. No login, reset, password change, refresh replay, deployment, migration, database mutation, production access, or other hosted mutation occurred.
