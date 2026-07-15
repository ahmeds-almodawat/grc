# Patch 83U Employee-ID Credential Risk Acceptance

## Decision status

This record is **not approved** until every decision field is completed by an authorized approver and every required compensating control has current evidence. Leaving a field blank means the risk is not accepted.

## Explicit risk statement

- Employee ID is the initial password for a newly provisioned managed account.
- Five-digit Employee IDs may be accepted as initial passwords only if the hosted Supabase password policy allows them. There is no fallback password.
- First-login takeover is possible when another person knows or can predict an Employee ID and reaches the account before the intended employee.
- Forced first-login password change reduces but does not eliminate the risk, because it occurs after the initial credential has already authenticated.
- No National ID or Iqama is used as an identifier, password, recovery value, confirmation value, or identity-proofing factor.

Employee IDs must therefore be treated as discoverable identifiers, not secrets and not proof of identity. CAPTCHA, rate limits, a short claim window, monitoring, and forced change reduce exposure but cannot make a predictable initial password equivalent to a randomly issued secret.

## Required compensating controls

All controls are mandatory unless the approver records a time-bounded exception with an owner and a stricter alternative:

1. Production CAPTCHA is required for both Employee-ID and full-email sign-in, fails closed when unavailable, and keeps the provider secret outside the frontend.
2. Hosted Auth endpoint rate limits, password minimum/character policy, leaked-password protection, JWT expiry, session lifetime/inactivity, and single-session settings are reviewed and captured without exposing credentials.
3. Hosted password-policy evidence explicitly determines whether five-digit Employee IDs can be used. A rejected Employee ID produces `policy_blocked`; no fallback is generated.
4. Provisioning is limited to an approved execution window, exact organization scope, validated workbook, explicit confirmation, and authorized actor. Upload, parsing, and preview never create an account.
5. The employee's identity is verified through an independent approved channel before claim instructions or a reset password are delivered.
6. Unclaimed and `initial_change_required` accounts are monitored continuously during the claim window, have a named owner, and are disabled with sessions revoked at expiry.
7. Forced password change blocks the normal application and rejects Employee ID, synthetic-email local part, and the current temporary password as the permanent password.
8. Credential version, canonical Auth email, current Auth session, lifecycle, role, and organization scope are enforced server-side on every protected access path.
9. Super Admin reset requires a different same-organization global Super Admin, exact Employee ID, mandatory reason, exact confirmations, an explicitly reviewed temporary password (the Employee-ID default or another manually entered hosted-policy-compatible value), role suspension, and session revocation.
10. Credential/provisioning events, Auth logs, CAPTCHA/rate-limit events, role audit, collisions, resets, reconciliation, and suspected enumeration are monitored with defined response owners and retention.
11. Case-insensitive Employee-ID and synthetic Auth-email collisions are zero before release and are rechecked before provisioning.
12. A tested emergency disablement and rollback process exists, including loss-of-last-eligible-Super-Admin recovery, without weakening RLS, JWT, role, tenant, or service-role controls.

## Evidence checklist

- [ ] Read-only Patch 83T/83U migration preflight completed in the authorized environment.
- [ ] Direct RPC/view Auth-surface inventory has no unsafe exception.
- [ ] CAPTCHA required/missing/invalid/accepted paths are proven in the authorized release environment.
- [ ] Hosted Auth policy and rate-limit evidence is current.
- [ ] Five-digit Employee-ID policy outcome is explicitly recorded.
- [ ] First-login, forced-change, reset, session-revocation, and reconciliation runbooks are rehearsed.
- [ ] Monitoring alerts, owners, claim-window threshold, and response SLA are active.
- [ ] Backup, maintenance window, rollback owner, and last-Super-Admin recovery are approved.

## Mandatory decision record

| Field | Required entry |
| --- | --- |
| Approver |  |
| Decision | Accept / Reject / Defer |
| Scope | Named environment, organizations, account population, and release version |
| Risk owner |  |
| Security reviewer |  |
| Operations owner |  |
| Review date | YYYY-MM-DD |
| Expiry date | YYYY-MM-DD; acceptance must be time-bounded |
| Rollback trigger | Specific measurable condition(s) requiring disablement or rollback |
| Evidence location | Restricted evidence record; no credentials or secrets |
| Exceptions and owners | Time-bounded exception, alternative control, owner, and due date |

## Minimum rollback triggers

The decision record must include, at minimum: confirmed or suspected first-login takeover; Employee-ID enumeration above the approved threshold; CAPTCHA fail-open behavior; hosted policy drift; loss of the last eligible global Super Admin; credential-state/version/session bypass; cross-organization access; unresolved identity collision; inability to revoke sessions; unauthorized role restoration; provisioning without final execution; or reconciliation volume above the approved threshold.

At a rollback trigger, stop new provisioning and import execution, place affected entry points in the approved maintenance posture, disable affected accounts and revoke sessions through controlled actions, preserve evidence, and invoke the approved recovery plan. A rollback trigger does not authorize migration repair, database reset, direct protected-table edits, or weakened security controls.
