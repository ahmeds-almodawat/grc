# Patch 83E: RLS Remediation Preflight Matrix

## Statement of Intent
This is a **documentation-only** preflight matrix. There are **no migrations** and **no policy changes** included in this patch.

## 1. Scope
- Analysis of tables and policy areas requiring RLS review.
- Definition of proposed future policy controls.
- Identification of pre-migration requirements and required test evidence.
- Definition of rollback strategies and stop/go gates.
- Sequencing of future implementation steps.

## 2. Non-Scope
- Actual remediation or deployment of RLS policies.
- Changes to database schemas, application behavior, `authAccess.ts`, or privileged actions.
- Any claim that the system is ready for production.

## 3. RLS Remediation Matrix
Based on findings in **Patch 82V** and **Patch 82W**:

| Affected Area | Current Risk Pattern | Proposed Future Policy Direction |
| --- | --- | --- |
| `ovr_incidents` | Broad authenticated access | Department scoping where operationally required; organization/tenant scoping. |
| `risks` | Overly permissive read/write | Role-based read/write boundaries (governance admins vs normal users). |
| `evidence` | Missing upload constraints | Organization/tenant scoping; append-only audit/event patterns where applicable. |
| `user_profiles` | Excessive read visibility | Tenant isolation; users only read within their organization/department. |
| `audit_logs` | Potential for authenticated writes | Service-role-only write paths; read-only for auditors/governance admins. |

## 4. Pre-Migration Checks
Before any RLS migration, the following must be validated:
- Table columns available for scoping (e.g., `organization_id`, `department_id`).
- Existing data has organization/department ownership values populated.
- User role/profile mapping exists and is correctly populated in auth tables.
- Test personas are established: normal user, manager, auditor, governance admin, super_admin.

## 5. Test Evidence Required
Before finalizing any real migration, we require:
- positive access tests
- negative access tests
- cross-department denial tests
- auditor read-only tests
- privileged action tests
- service-role edge function tests

## 6. Rollback Strategy
- Backup current policies using pg_dump before any migration.
- Have a standardized `down` migration script ready that drops the new policies and recreates the exact previous broad policies.
- Conduct a dry-run rollback in staging to verify it works instantly.

## 7. Stop/Go Gates
- **Stop**: If staging tests fail negative access checks, data ownership is incomplete, or rollback script fails dry-run.
- **Go**: Staging tests 100% pass for all personas, code review is approved, rollback is verified.

## 8. Future Implementation Sequence
- 83F: RLS policy design SQL draft, docs only
- 83G: local/staging RLS test harness, docs/scripts only
- 83H: first narrow low-risk RLS migration, only after explicit approval

## 9. Known Limitations
- this does not make the system production-ready
- this does not remediate RLS yet
- this does not replace manual security review
