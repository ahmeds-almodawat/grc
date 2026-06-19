# Final Security and RLS Script

Create test users for each role/scope and verify access.

## Personas

| Persona | Expected access |
|---|---|
| CEO / Executive | Global dashboards and critical risks |
| Governance Admin | GRC workflows and action plans |
| Department Manager | Own department projects/tasks/OVRs only |
| Quality Officer | OVR review queues and Quality workflow |
| Auditor | Audit findings and evidence review |
| Employee | Own tasks and own submitted OVRs only |

## Negative tests

- Employee cannot view another employee's assigned task.
- Department manager cannot view other department's private items.
- Reporter cannot close OVR.
- Department cannot close own audit finding.
- User cannot approve own request.
- Closed item without accepted evidence is blocked.

Record screenshots and keep them as release evidence.
