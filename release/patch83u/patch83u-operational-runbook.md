# Patch 83U Operational Runbook

## Scope and operating principles

This runbook covers Employee-ID-managed accounts created through the controlled Patch 83T/83U flow. An Employee ID is an account identifier and initial password, not identity proof. Never place passwords, access tokens, refresh tokens, service-role keys, CAPTCHA secrets, or full Auth responses in tickets or logs. Never create an account merely because a workbook was uploaded or previewed; provisioning begins only after the authorized import execution and server-side validation succeed.

Use the authenticated privileged Edge bridge for provisioning, credential changes, resets, session revocation, and reconciliation. Do not work around a credential lock with direct profile, role, provisioning, Auth, or session-table changes.

## Provisioning

1. Require the approved Patch 83T workbook, a fully valid preview, exact execution confirmation, and an actor with the required organization-scoped authority.
2. Confirm Employee ID uniqueness case-insensitively and confirm that `<lowercase-employee-id>@almodawat.sa` does not belong to another Auth identity or open provisioning record.
3. Execute the import only after the operator clicks the final action. Unknown users enter the protected provisioning queue; the workbook never supplies a password.
4. The trusted server creates the Auth account with the canonical synthetic email and an initial password exactly equal to the Employee ID. It then finalizes the profile, credential state, and roles only from exact Auth/database proof.
5. Treat `policy_blocked` as a hosted password-policy decision. Do not invent a fallback password. Treat an ambiguous Auth response or incomplete finalization as `reconciliation_required`; do not blindly retry account creation.
6. Give the employee the claim instructions through the approved, identity-verified channel. Do not transmit the Employee ID as if it were a secret.

## Login instructions

1. The employee enters the exact Employee ID, or an existing full email for a legacy account.
2. The application derives the managed Auth email as `<lowercase-employee-id>@almodawat.sa`; there is no Employee-ID bypass of CAPTCHA, rate limits, credential state, session freshness, role checks, or organization scope.
3. For the first managed login, the employee enters the Employee ID as the initial password.
4. If CAPTCHA is required, the employee must complete the configured challenge. Support must not disable or bypass the challenge for a known Employee ID.
5. Successful initial authentication leads only to the forced password-change flow until credential finalization succeeds.

## First password change

1. Confirm the user sees only the credential-change surface and logout, not the normal application layout.
2. Require a permanent password that satisfies the hosted policy and is not the Employee ID, synthetic-email local part, or current temporary password.
3. The server begins the protected operation, changes the Auth password, revokes sessions, and finalizes from the exact credential version, canonical email, and absence of remaining Auth sessions.
4. If any proof is missing, keep roles suspended and route the account to recovery/reconciliation. Never mark the account active based only on a successful browser response.

## Unclaimed accounts

1. Monitor accounts remaining in `initial_change_required`, provisioning entries not completed, and invited profiles past the approved claim window.
2. Contact the employee and manager through independently verified channels. Do not reveal whether an Employee ID is a valid login to an unverified caller.
3. At expiry, use the controlled lifecycle/credential action to disable the account and revoke sessions. Do not delete protected provisioning evidence.
4. Re-enable only after identity verification and a Super Admin-controlled reset that requires another forced password change.

## Suspected takeover

1. Open a security incident and record the user, organization, detection source, and timestamps without recording credentials.
2. Immediately disable/lock the affected account through the controlled administrative path and revoke all Auth sessions.
3. Preserve credential events, role-change audit, Auth audit evidence, login telemetry, and provisioning evidence. Do not alter or delete the evidence records.
4. Review profile, roles, organization scope, recent password/reset events, and changes made during the suspected window.
5. Verify the employee out of band. A Super Admin may issue a manually entered temporary password only after authorization, then require first-login change again.
6. Restore roles only after database-backed credential and session proof succeeds. Escalate ambiguous state to reconciliation.

## Failed login

1. Do not confirm whether an Employee ID exists. Check service health, CAPTCHA availability, rate-limit events, Auth logs, credential state, and lifecycle status using authorized operational tools.
2. Missing or invalid CAPTCHA when required must remain a closed failure. Do not retry without a new accepted token.
3. Repeated failures trigger the incident/abuse threshold and may require temporary disablement. Do not weaken hosted rate limits or password policy as a support workaround.
4. If the password is forgotten, follow the Super Admin reset procedure. Support staff must never request the current password.

## Super Admin reset

1. Require a different, active global Super Admin in the same organization. Self-reset and cross-organization reset are prohibited.
2. Independently verify the target employee. Enter the exact Employee ID, a mandatory reason, the UI confirmation `RESET USER PASSWORD`, and the backend confirmation required by Patch 83U.
3. Review both temporary-password fields, which default to the exact Employee ID. The Super Admin may deliberately keep that value or replace and confirm it with another hosted-policy-compatible temporary password. Never generate a hidden fallback.
4. Submit once. The server suspends roles, changes the Auth password, revokes sessions, and accepts completion only from exact Auth/database proof.
5. Provide the temporary password through the approved secure channel. The target remains in `admin_reset_change_required` until it is changed.
6. Verify the audit event, credential version, session revocation evidence, and continued role suspension.

## Session revocation

Use revocation after an administrator reset, password change, account disablement, suspected takeover, or credential-version mismatch. Invoke the protected server action, then require database proof that no target `auth.sessions` rows remain before considering revocation complete. A UI success message or JWT expiry alone is insufficient. Existing JWTs must also fail the credential-version/session-freshness gate. If proof fails, leave access locked and escalate to reconciliation.

## Reconciliation

1. Use reconciliation for ambiguous Auth creation, interrupted finalization, stale password/reset operations, version mismatch, missing Auth users, or unresolved session evidence.
2. Identify the canonical profile, exact case-sensitive Employee ID, expected synthetic Auth email, organization, provisioning record, and current Auth user ID.
3. Run only the protected Super Admin reconciliation action with its exact Employee-ID confirmation and request ID.
4. The server compares Auth user, canonical email, ownership metadata, credential version, provisioning snapshot, lifecycle, and session evidence. It must not create another Auth identity merely because the first response was lost.
5. Restore access only when the returned database proof is exact. Otherwise retain `reconciliation_required`/`recovery_required`, keep roles suspended, assign an owner, and escalate.

## Monitoring

Monitor and alert on:

- Login failures, CAPTCHA failures, hosted rate-limit events, and unusual Employee-ID enumeration patterns.
- Accounts that remain unclaimed or change-required beyond the approved window.
- `policy_blocked`, `retryable_failed`, `recovery_required`, and `reconciliation_required` states.
- Repeated reset/reconciliation attempts, session-revocation failures, and credential-version mismatches.
- Role suspension/restoration, last-Super-Admin guard failures, cross-organization denials, and privileged-role changes.
- Differences between protected provisioning records, profiles, Auth identities, and the Auth-surface inventory.

Review alerts at the security-approved cadence. Route suspected abuse to the incident process; do not include passwords or tokens in telemetry.

## Emergency disablement

1. Declare the incident and name an incident commander, affected organization(s), and scope.
2. Disable final User Import execution through its controlled deployment flag if import is implicated. Upload/preview evidence can remain available only if the incident commander approves.
3. Place affected authentication/application entry points in the approved maintenance posture when credential-gate or Auth integrity is uncertain.
4. Disable affected profiles and revoke their sessions through controlled actions. Keep credential and role evidence intact.
5. Do not repair by changing RLS, JWT verification, role checks, organization scoping, service-role handling, migrations, or protected tables ad hoc.
6. Re-enable only after cause, data integrity, eligible Super Admin coverage, hosted controls, and end-to-end credential proof have been reviewed and signed off.

## Coordinated migration, Edge, and frontend deployment order

These components cannot be made atomic across providers. Use an approved maintenance window and keep user-import execution frozen throughout the transition.

1. Complete backups, the read-only Patch 83T/83U preflight, Auth-surface inventory, hosted-control evidence, risk acceptance, and rollback decision. Resolve every release blocker.
2. Enter maintenance/freeze and verify no import, reset, reconciliation, role, or lifecycle operation is in progress.
3. Apply migration 173, then migration 174, using the reviewed artifacts and authorized database process. Stop immediately on any guard failure; do not use migration repair.
4. Deploy the reviewed privileged Edge function immediately after the database migrations. Keep maintenance active while the old Edge/frontend combination is incompatible with the new credential gate.
5. Deploy the reviewed frontend with matching action registry, CAPTCHA configuration, credential lock, and Employee-ID login behavior.
6. Perform authorized smoke tests: legacy email login, Employee-ID login, CAPTCHA fail-closed behavior, forced change, session revocation, roster/permission load, provisioning/reconciliation proof, Patch 83T preview without automatic execution, and Patch 83S regression.
7. Confirm eligible global Super Admin coverage and monitoring, then remove maintenance and re-enable final import execution only under the approved decision.

Rollback triggers include loss of eligible Super Admin access, credential-gate bypass, unexplained identity collision, cross-organization access, inability to revoke sessions, unsafe RPC/view exposure, widespread reconciliation, or failed provisioning proof. Stop traffic and follow the approved backup/rollback plan; there is no authorization in this runbook to improvise a down migration.
