# Final RLS Persona Test Matrix

Test these users in a fresh Supabase staging project.

| Persona | Must see | Must not see |
|---|---|---|
| Executive | All command center data, high-risk items, approvals | Nothing restricted by system admin-only functions |
| Governance admin | GRC workflows, risks, compliance, audit follow-up | Auth secrets or unrelated backend keys |
| Department manager | Own department projects, tasks, OVRs, risks | Other departments' confidential OVRs |
| Normal employee | Own tasks, own submitted OVRs, assigned evidence | Company-wide risks, other staff OVRs, admin pages |
| Quality officer | OVR queue, Quality review, corrective actions | Security/admin-only settings unless separately assigned |
| Auditor | Audit findings and closure evidence | Employee-only private workspace unless assigned |

## Stop rule
Any persona seeing data outside the intended scope is a go-live blocker.
