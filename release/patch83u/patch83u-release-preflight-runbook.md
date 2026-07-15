# Patch 83T/83U Release Preflight Runbook

## Purpose and boundary

Use `supabase/tests/patch83tu_release_preflight.sql` before any authorized application of migrations 173 and 174. The script contains only `SELECT`/`WITH` statements. It neither changes data or schema nor requests explicit locks. It does not apply a migration, repair migration history, reset a database, change Auth settings, or prove hosted behavior.

The output contains account identifiers and must be handled as restricted operational evidence. Do not paste it into tickets, chat, or source control. Store it in the approved release-evidence location with access limited to the release approver, database owner, security reviewer, and incident responders.

## Preconditions

1. Obtain a change record and written authorization for the named environment. Production authorization is separate from permission to inspect a local or test database.
2. Confirm the checked-out migration files are the reviewed, unapplied migrations 173 and 174.
3. Use an explicitly read-only database role with `SELECT` access to `public`, `auth.users`, `auth.identities`, and PostgreSQL catalogs. Prefer a connection whose `default_transaction_read_only` is enforced by the database. Do not place a database password, service-role key, or connection string in the command history or evidence file.
4. Confirm the operator can identify the organization owner who will remediate account and role findings.
5. Record the database environment, project reference, execution timestamp, Git revision, SQL file checksum, operator, and reviewer in the release evidence.

## Execution

Run the complete SQL file unchanged in the authorized database session. An empty detail result is evidence of no findings only when its corresponding summary result was also captured successfully. A SQL error, truncated output, insufficient catalog access, or partial execution is a failed preflight, not a zero finding.

Capture every result set in order:

1. `population_totals`: total profiles, Auth users, and provider identities. The two Auth totals are intentionally separate because one Auth user can have more than one provider identity.
2. `profiles_without_matching_auth_users_*`: count and affected profile IDs.
3. `auth_email_health_*`: missing and unconfirmed Auth email counts and affected identities.
4. `predicted_identity_modes`: predicted `legacy_verified`, `employee_id_managed`, and `unverified` counts. Migration 174 deliberately predicts zero existing `employee_id_managed` rows; controlled post-migration provisioning establishes that mode. The additional exact-alias count is informational.
5. `predicted_active_reconciliation_*`: active users that migration 174 predicts will become `reconciliation_required`, with the reason.
6. `invalid_active_role_shape_*`: active tenant/hierarchy references that do not satisfy migration 174's canonical scope rules.
7. `active_roles_without_valid_credential_identity_*`: active assignments whose profile/Auth/lifecycle/version evidence cannot produce an active credential row.
8. `eligible_global_super_admins_by_organization` and `organizations_losing_last_eligible_super_admin`: current and predicted eligible administrator counts by organization.
9. `case_insensitive_employee_id_collisions` and `synthetic_auth_email_collisions`: identities requiring deterministic remediation before provisioning.
10. `rls_enabled_public_tables`: current public tables with RLS enabled and whether RLS is forced.
11. `authenticated_executable_rpcs` and `authenticated_selectable_views`: catalog grants reachable through `authenticated` or `PUBLIC`. Reconcile these outputs with the Patch 83U Auth-surface inventory; this preflight is discovery, not a safety waiver.
12. `estimated_rows_touched_by_migration_174`: direct backfill/recheck rows plus predicted suspension snapshots, role audit rows, and suspension events. The estimate assumes the migration reaches each phase; a guard failure can abort it.

## Release gates

Do not authorize migration execution while any of the following is true:

- The script failed, was edited for execution, or did not return every named result set.
- `organizations_losing_last_eligible_super_admin` returns any row.
- An organization has no predicted eligible global Super Admin without an approved bootstrap/recovery procedure.
- Any case-insensitive Employee-ID or synthetic Auth-email collision remains unresolved.
- Any active role has an invalid tenant/hierarchy shape.
- Any active role lacks a valid predicted credential identity.
- Any active user predicted for reconciliation lacks a named owner and approved remediation plan.
- Missing Auth users or missing/unconfirmed Auth emails are unexplained.
- The RPC/view result differs from the reviewed Auth-surface inventory.
- The row-touch estimate exceeds the approved maintenance, backup, or rollback capacity.

`predicted_unverified_count` and `active_users_predicted_reconciliation_required` may be accepted only as an explicit, user-by-user remediation exception; they are never silently treated as healthy.

## Remediation and rerun

Remediation is a separate authorized change. Do not edit data from the preflight session. Correct identity, lifecycle, role, or hierarchy data through an approved administrative path, then open a new read-only session and rerun the entire file. Preserve both the original and clean evidence with the decision record.

## Evidence sign-off

Record:

- Environment and project reference:
- Git revision and SQL checksum:
- Executed at and operator:
- Database read-only role:
- Summary result archive location:
- Exceptions and remediation owners:
- Security reviewer:
- Database owner:
- Release approver and decision:
- Approval expiry/review date:

No entry in this runbook is proof that the hosted password policy, CAPTCHA, Auth rate limits, Auth Admin operations, session revocation, migrations, or Edge deployment were tested. Those require separately authorized hosted evidence.
