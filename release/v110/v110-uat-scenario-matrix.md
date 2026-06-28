# v11.0 Enterprise UAT Scenario Matrix

- Generated: 2026-06-28T12:46:57.655Z
- Scope: controlled UAT only
- Data rule: synthetic/non-confidential only

| Role | Scenario | Expected result |
|---|---|---|
| super_admin | Open enterprise GRC tables/views; confirm admin access and no delete UX/API path is introduced. | Allowed create/update where role-gated; no delete grant expected. |
| governance_admin | Create draft policy, compliance training course, KRI, regulatory change, exception request review. | Governance user can manage enterprise program records. |
| compliance_officer | Map obligation to policy/control; create training assignment and regulatory change action. | Compliance workflows are available without super-admin access. |
| auditor | Create audit follow-up review and inspect board-pack readiness view. | Audit assurance/follow-up available; user management not available. |
| department_manager | Review assigned training/attestation and BCP process ownership for own department. | Department-scoped visibility only. |
| employee | Complete policy attestation/training assignment assigned to self. | Employee can see/complete own assignments only. |
| viewer | Open dashboards/read-only views and attempt mutation. | Read-only; mutation denied/hidden. |
| external employee/viewer | Attempt to read primary Al Modawat enterprise GRC records. | Primary organization records denied. |

## Stop conditions

- External organization user can see Al Modawat enterprise GRC records.
- Normal user can edit policy/vendor/board-pack records outside allowed ownership/scope.
- Any screen or script asks for patient identifiers or confidential OVR details.
- New tables appear without RLS enabled.
