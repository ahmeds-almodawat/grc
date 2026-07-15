# Patch 83U — Security Review

## Authorization and isolation

- Browser actions use the authenticated `privileged-action` Edge bridge. Supabase Auth Admin operations and the service-role key remain server-only.
- Patch 83U database mutation functions independently require the service role and recheck the verified actor, active profile and credential, same organization, canonical global role/scope with null hierarchy references, target organization, verified identity mode, and exact Employee ID.
- Provisioning, reconciliation, and password reset are global-Super-Admin-only. Governance Admin receives none of those authorities.
- Reset is organization-scoped, non-self, and protected against loss of the last eligible Super Admin. Dedicated service-only role assignment/deactivation and lifecycle paths derive or revalidate the target tenant, reject invalid scope/hierarchy-reference shapes, and retain the same self-change, organization, canonical-actor, and last-admin controls. Generic role authorization remains scope-driven; these paths do not impose Patch 83T's narrower workbook persona matrix on ordinary role management.
- Provisioning records, credential states/events, and suspended-role snapshots use forced RLS, no browser table grants, safe `search_path`, and service-role-only mutation paths.

## Browser RPC and view boundary

- `search_grc_global` is no longer invoked directly by browser code. It is allowlisted behind the authenticated Edge bridge, after the Patch 83U credential/session check, and is invoked through a caller-token client so its `SECURITY INVOKER` implementation and dependent table RLS remain effective.
- The release inventory reports zero direct browser RPCs, 353 browser-referenced views, zero authenticated-readable materialized views, and zero unsafe exposed surfaces. Its catalog proof covers all 83 originally owner-executed reachable views through the migration 174 `security_invoker` hardening loop.
- Migration 174 enables credential-gated RLS evidence on the exact 29 audited legacy view-base tables. Organization-bearing tables also require the current credential organization; the 11 global release-metadata tables retain credential gating without inventing an organization column.
- The exposed `SECURITY DEFINER` allowlist is limited to two retained Patch 83Q read helpers and three Patch 83U RLS decision helpers. All other Patch 83U routines are dynamically revoked from browser roles, and the automated proof rejects future unaudited definer routines or unsafe exceptions.

## CAPTCHA boundary

- Employee-ID and full-email login share one CAPTCHA requirement and token path; no Employee-ID bypass exists.
- Only the Turnstile public site key is compiled into the frontend. The provider secret remains Supabase/provider-side.
- The requirement flag accepts only exact `true` or `false`. Required-but-unavailable, missing-key, missing-token, expired-token, and invalid configuration paths fail closed. The login page blocks early, and the Auth provider independently enforces the same requirement before forwarding the token through the installed Supabase SDK.
- Local browser tests prove frontend control flow only. They do not prove that CAPTCHA is enabled or accepted by the hosted Supabase project.

## Managed identity and initial credential

- Employee ID is preserved as trimmed text and the server derives the canonical Auth alias as `lower(employee_id) + '@almodawat.sa'`. Optional `contact_email` remains a separate profile attribute.
- Existing legacy Auth identities are not rewritten. Protected credential proof classifies identities as `employee_id_managed`, `legacy_verified`, or `unverified`; the canonical Auth email comes from that proof, and credential actions are disabled for missing or unverified proof. Provisioning rejects case-insensitive Employee-ID collisions, Auth-alias ambiguity, and tenant/profile conflicts instead of silently attaching the wrong profile.
- The initial password is the exact Employee ID and exists only transiently inside the server provisioning action and Supabase Auth request. It is not persisted, audited, logged, exported, returned, or included in the workbook.
- No local six-character rule blocks Employee ID `11111`. Because hosted policy acceptance is unproven, an Auth password-policy rejection maps to `policy_blocked`, creates no partial profile/role/credential state, generates no alternate password, and returns only the documented safe message.
- A lost or ambiguous Auth response cannot trigger blind recreation. The record remains recoverable and retry resolves the canonical Auth identity first. After finalization is attempted, a subsequent error never deletes the Auth user; the action requires an exact protected finalization response before reporting success.

## Initial-password and takeover risk

Employee ID is often known or discoverable and may be short. Using it as the initial password creates a first-login takeover window until the intended employee completes the required change. The forced-change gate limits post-authentication access but cannot prevent an unauthorized person who already knows the Employee ID from attempting the first sign-in.

Operational release controls must therefore treat provisioning as just-in-time, verify the employee through an independent channel, avoid broadcasting Employee IDs as credentials, monitor first-login events, and escalate unclaimed accounts quickly. The system does not email or display the initial password and does not claim that forced change eliminates this risk.

## Required password change

- The server accepts current, new, and confirmation passwords only in the authenticated request and never records them.
- Employee ID is obtained from trusted database state, not browser input. New password must match its confirmation and must differ from the current temporary password, trusted Employee ID, and managed Auth local part.
- Credential state moves to `password_change_in_progress` and reserves the next credential version before the Auth update. Database activation, `must_change_password` clearing, database credential-version advancement, eligible-role restoration, and non-secret audit occur only after the Auth mutation and required Auth/session proof are finalized successfully.
- If Auth may have changed but database finalization fails, the user remains locked in `recovery_required`. No role is restored and no fallback bypass is available.
- While change is required or recovery is unresolved, the only allowed capabilities are minimal own credential-state read, required password change, and logout.

## Administrator reset

- Reset requires exact Employee ID, mandatory reason, matching temporary-password fields, the typed phrase `RESET USER PASSWORD`, and the server confirmation code `PATCH83U_RESET_USER_PASSWORD`.
- Both password fields default to Employee ID, and equality with Employee ID is permitted. A different administrator-entered value is also permitted if Supabase Auth accepts it; Patch 83U does not invent an unrelated length policy.
- The reset-begin database function repeats the exact confirmation-code check and authorization protections before the Auth password update.
- Reset-begin suspends eligible roles and reserves the next credential version; it does not advance the authoritative database `credential_version`. Only after the Auth mutation and required target-session proof does reset finalization advance that version, set `password_reset_at`, require reauthentication, and emit password-free audit evidence. Begin, failed Auth mutation, and abort do not update the completion timestamp. Partial, mismatched, or ambiguous finalization proof stays fail closed for controlled recovery.
- Password and confirmation inputs are cleared/reset on close, target change, success, or a failure requiring fresh authorization. The typed phrase `RESET USER PASSWORD`, exact Employee ID, and matching password confirmation must be entered again after such a failure.

## Session enforcement and limitation

- Required password change requests global caller sign-out. Administrator reset proves the new temporary credential in an isolated, non-persistent target session and requests global target sign-out.
- Finalization verifies the database session condition and credential cutoff. Old application access is also rejected through credential state, signed credential version, session ownership/cutoff, active profile lifecycle, restrictive public-table RLS, and storage-object gates.
- Hosted sign-out and session-row behavior cannot be proven by static or mocked tests, and already-issued JWTs may remain cryptographically valid until expiry. The independent state/version/cutoff checks are therefore part of the security boundary, not optional hardening.
- If the Auth or session outcome is uncertain, the workflow does not report success or restore access; it enters recovery/reconciliation or requires a fresh controlled reset.

## Secret and audit handling

- No migration table, JSON event, audit record, provisioning snapshot, response, export, or log stores a current, new, confirmation, temporary, or initial password; password digest; bearer/refresh token; session secret; or service-role key.
- Safe error mapping records only controlled codes and messages. Auth error text must not be copied into protected snapshots when it could reveal sensitive request material.
- Reconciliation is canonical-global-Super-Admin-only, organization-scoped, idempotent, and auditable. It can bind only one uniquely resolved Auth identity, validates protected provisioning/profile/credential/role evidence and exact response shape, and never accepts a plaintext password as stored reconciliation data.

## Coordinated deployment boundary

The required order is migration 173, migration 174, matching `privileged-action` Edge Function, then matching frontend. Running the new frontend against the old Edge deployment returns `UNSUPPORTED_PRIVILEGED_ACTION` and fails closed. A direct Auth/RPC or legacy-login fallback would weaken credential-state enforcement and is prohibited.

Neither migration was applied or executed, no database proof transaction was run, and no Edge/frontend deployment or hosted Auth/session operation was performed as part of this work.

## Existing controls unchanged

- Migration 172 and Patch 83S Department Import behavior remain unchanged.
- Existing Patch 83S RLS, JWT validation, role checks, organization scoping, audit logging, last-admin controls, and service-role isolation are preserved. Migration 174 deliberately adds the Patch 83U restrictive credential gate, the exact 29-table legacy compatibility policies, and security-invoker view hardening; it does not weaken existing mutation ACLs.
- No `.env` or `.env.local` file is modified.
