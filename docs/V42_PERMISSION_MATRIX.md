# v4.2 Permission Matrix

| Persona | Expected allow | Expected deny |
|---|---|---|
| CEO | Global dashboards, executive approvals, major OVR visibility | Bypassing audit logs |
| Governance Admin | GRC workflows, risks, compliance, release controls | Deleting audit history |
| Quality Manager | OVR review, OVR closure with evidence | Closing without evidence |
| Auditor | Audit findings, evidence review | Self-approval |
| Department Manager | Own department projects/tasks/OVRs | Other department data |
| Project Owner | Assigned project update, evidence request | Approving own work |
| Employee | Own tasks, own OVR submissions, own evidence requests | Unassigned tasks/OVRs |
| Viewer | Scoped read-only reports | Create/update/delete |

This matrix must be tested with real Supabase Auth users, not only visual UI checks.
