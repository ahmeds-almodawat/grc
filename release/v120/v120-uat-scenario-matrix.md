# v12.0 UAT Scenario Matrix

- Generated: 2026-06-28T13:21:42.344Z
- Scope: controlled UAT only
- Data rule: synthetic/non-confidential only

| Role | Scenario | Expected result |
|---|---|---|
| super_admin | Open v12 workspace/dashboard/data quality tables and confirm create/update access. | Allowed. No delete path/grant should exist. |
| governance_admin | Create synthetic workspace module health update and release readiness check. | Allowed in own organization. |
| compliance_officer | Create data-quality rule/finding for policy review date or training completion. | Allowed in own organization. |
| auditor | Review data-quality board and add audit-style finding/remediation note. | Allowed where governance policy permits; no user-management access. |
| department_manager | Create/triage department feedback item and review SLA events assigned to department. | Department-scoped operational visibility only. |
| employee | Submit feedback and view assigned help/glossary/saved view records. | Can submit feedback; cannot manage enterprise settings. |
| viewer | Open read-only dashboard views and try mutation. | Read-only behavior. Mutation hidden or denied. |
| external employee/viewer | Attempt to view Al Modawat v12 organization records. | Denied. No primary organization leakage. |

## Stop conditions

- External organization user can see primary organization records.
- Normal user can delete or manage v12 settings outside authority.
- Any test requires patient identifiers or confidential OVR details.
- v12 migration appears without RLS or with broad delete grants.
