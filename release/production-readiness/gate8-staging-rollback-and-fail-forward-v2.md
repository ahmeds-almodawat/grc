# Gate 8 v2 rollback and fail-forward limits

Gate 8 v2 is a one-attempt, forward-only staging rehearsal. A current platform recovery point with proven restore availability is mandatory immediately before execution. Its safe identity and validity window must be bound into the new Gate 8 freeze and reservation.

Each migration is transactional. An error before its `COMMIT` rolls back that migration, but earlier committed migrations remain. Never edit a committed migration, change migration-history rows manually, or rerun after an ambiguous result.

- **178:** if committed, retain its exact indexes unless a separately reviewed forward migration proves removal safe. Never delete conflicting data.
- **179:** restore or correct the view only through a new reviewed forward migration using captured normalized definitions.
- **180:** do not reopen browser DML or weaken runtime signoff. Correct policy, ACL, view or function drift forward.
- **181:** an attestation/prerequisite failure is a stop signal. Preserve the owner-only recovery function and audited wrapper relationship; never recreate the removed synthetic helper or expose the recovery implementation to service/browser roles.
- **182:** do not disable RLS or restore broad grants. Add any legitimate access path only through a separately reviewed organization/ownership policy or protected RPC.

After timeout, connection loss, CLI crash or unclear acknowledgement:

1. Mark the reservation `execution_state_ambiguous`.
2. Do not issue a second migration command.
3. Determine migration-history and principal-object state using read-only catalog SQL with rollback.
4. Classify each of 178–182 as history absent/present and catalog absent/partial/exact.
5. Preserve the original attempt correlation and sanitized output.
6. Recommend either a separately authorized restore to the verified recovery point or a separately reviewed forward correction. Do neither automatically.

Production is never a rehearsal or recovery target. No Auth, password, session, user, or business-data mutation is part of this plan.
