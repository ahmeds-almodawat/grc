# Patch 83F: RLS SQL Design Draft

## Statement of Intent
This is a **documentation-only SQL draft**. Do not run this directly. No `.sql` migration file has been created under `supabase/migrations`.

## References
This draft builds upon the findings and plans in:
- Patch 82V
- Patch 82W
- Patch 83E

## 1. Assumptions
Before applying these policies, we assume the existence of:
- `auth.uid()` mapped securely to `public.user_profiles.id`.
- User profile mapping that contains `organization_id` and `department_id`.
- Role mapping (e.g., `user_roles.role`) properly constrained.
- Organization/department ownership fields existing on all target tables.
- Service-role-only operations bypassing RLS by design.

## 2. Helper Function Patterns
Helper functions will be defined using `security definer` to fetch user attributes securely without infinite recursion, e.g., `get_user_organization_id()` and `get_user_role()`.

## 3. Proposed Policy Patterns
We address broad authenticated-access findings by implementing strict, scoped policies.

### Organization-Scoped Read
Users should only see data belonging to their organization.

### Department-Scoped Read
Users should only see data belonging to their department, unless they have elevated privileges.

### Owner/Assignee-Scoped Read
Direct owners/assignees of records have read access.

### Role-Based Write
Writes are restricted to specific roles, such as managers or governance admins.

### Auditor Read-Only
Auditors have broad read access across the organization but zero write access.

### Super_Admin/Governance_Admin Elevated Read
Admins bypass department scoping to view all organizational data.

### Service-Role-Only Writes
Tables like `audit_logs` only allow inserts from the backend service-role.

### Append-Only Audit/Event Tables
Users can insert events but cannot update or delete them.

## 4. Proposed Affected-Area Examples
- `ovr_incidents`: Department-scoped read, service-role insert, organization-scoped admin read.
- `risks`: Role-based write, organization-scoped read.
- `evidence`: Append-only audit/event pattern.

## 5. Table-by-Table Draft Checklist
- [ ] `ovr_incidents` RLS defined
- [ ] `risks` RLS defined
- [ ] `evidence` RLS defined
- [ ] `audit_logs` RLS defined

## 6. Test Persona Matrix
| Persona | Role | Expected Scope |
| --- | --- | --- |
| Normal User | `employee` | Department / Owner |
| Auditor | `auditor` | Org (Read Only) |
| Gov Admin | `governance_admin` | Org (Read/Write) |
| Service Role | `service_role` | Bypasses RLS |

## 7. Access Test Cases
- **Positive:** Employee can read their own department's OVR incident.
- **Negative:** Employee blocked from reading another department's OVR incident.

## 8. Rollback Notes
Rollback involves dropping the new policies and restoring the previous broad `public` or `authenticated` access patterns.

## 9. Stop/Go Gates
- **Stop**: If missing columns block scoping or staging tests fail.
- **Go**: Staging tests pass 100%, rollback script dry-run passes.

## 10. Future Sequence
- 83G: local/staging RLS test harness, no production DB changes
- 83H: first narrow low-risk RLS migration, only after explicit approval
