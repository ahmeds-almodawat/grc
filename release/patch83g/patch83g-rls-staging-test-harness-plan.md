# Patch 83G: RLS Staging/Local Test Harness Plan

## Statement of Intent
This patch makes no production database changes, creates no migration, changes no policies, applies no RLS remediation, and does not run `supabase db push`. It is documentation and safe test templates only.

## References
This plan relies on previous analysis and design drafts:
- Patch 82V
- Patch 82W
- Patch 83E
- Patch 83F

## 1. Scope
- Definition of a test harness for safe RLS policy evaluation in local/staging environments.
- Requirements for environment, personas, test data, and expected evidence outputs.
- Definition of stop/go gates before applying real migrations.

## 2. Non-Scope
- No real RLS remediation applied.
- No live policies tested by this patch.
- No production database changes.

## 3. Environment Requirements
- local Supabase or dedicated staging project only
- production project reference must be rejected
- no service-role secret committed
- secrets supplied only through local environment variables
- test scripts must fail closed when environment checks are missing

## 4. Test Personas
The test harness requires the following simulated identities:
- normal user
- department manager
- auditor/read-only
- compliance or governance admin
- super_admin
- cross-department user

## 5. Test Data Requirements
The environment must be seeded with controlled data to test constraints:
- at least two organizations where supported by schema
- at least two departments
- organization ownership
- department ownership
- assigned owner
- unassigned record
- cross-department denial sample
- cross-organization denial sample where supported
- auditor read-only sample
- audit/event append-only sample

## 6. Test Categories
We will validate RLS through the following categories:
- positive read access
- negative read access
- allowed write access
- denied write access
- cross-department denial
- cross-organization denial
- auditor read-only enforcement
- owner/assignee access
- privileged action path
- service-role-only write path
- append-only audit/event enforcement
- anonymous access denial where applicable

## 7. Evidence Outputs
Before progressing, the test harness must produce verifiable artifacts:
- environment validation result
- command log
- persona result matrix
- expected-versus-actual result
- failed test list
- policy inventory before test
- policy inventory after test
- rollback confirmation
- protected-table verification
- final pass/fail summary

## 8. Stop/Go Gates
- staging/local environment confirmed
- production ref rejected
- persona matrix complete
- negative tests defined
- rollback procedure documented
- no unresolved schema assumptions
- no service-role secret stored in repository
- explicit user approval required before Patch 83H

## 9. Future Sequence
- Patch 83H: first narrow, low-risk RLS migration only after explicit approval
- Patch 83I: staged expansion only if 83H passes
- no broad multi-table rollout in the first migration

## 10. Known Limitations
- no RLS remediated yet
- no live policies tested by this documentation patch
- no production readiness claim
- results depend on staging/local data quality
- schema assumptions must be verified before implementation
