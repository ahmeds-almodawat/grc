# P2 Migration Manifest

## Integrity

- Migrations 001-216: no changes since pre-P1 commit `45614aac9464062df1a1c32ef90b65164871be6f`.
- P1 additions 217-219: verified as forward migrations.
- P2 additions 220-222: verified as forward migrations.
- Duplicate migration versions: none.
- Accepted local ending ceiling: 222.

## Forward Migrations

| Version | Purpose | Data mutation |
| --- | --- | --- |
| 217 | Governed read contracts, critical-attention and activity views | None |
| 218 | Shared governance-link completion, analytics, review trigger | Schema/contract only |
| 219 | Controlled-deny-all ACL reassertion | None |
| 220 | Canonical release/readiness view and source ACL contract | None |
| 221 | RLS-backed My Work source read contract | None |
| 222 | RLS-scoped Audit criterion view; helper remains service-only | None |

## Application Evidence

The preserved local upgrade database applied 220-222 successfully. Views and
functions compile; constraints, foreign keys, and indexes are valid; canonical
critical-attention/activity and release/readiness surfaces are available. The
business-data baseline remains 251 rows with the accepted digest.

## Clean-Chain Qualification

An isolated disposable project was attempted without touching the accepted
review database. The raw chain stopped at unchanged migration 022 on a missing
historical `restore_dry_run_jobs.title` column. Applying the authoritative
baseline followed by 188-215 succeeded; unchanged migration 216 then required
a grant introduced by 217, while applying 217 first exposed baseline view-type
drift. This is a pre-existing new-install baseline defect, not a P2 migration
regression. Release Engineering owns a future baseline refresh. P3 must use an
existing governed ledger and perform drift inventory before applying 220-222.

