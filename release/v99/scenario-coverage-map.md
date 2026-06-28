# v9.9A Scenario Coverage Map

- Generated: 2026-06-28T09:25:31.474Z
- Primary organization: Al Modawat Specialized Medical Company
- External denial organization: V99 Synthetic External Organization
- Active departments covered: **9/9**
- Application roles covered: **12/12**
- Production readiness: **Not asserted**

## Core role coverage

| Role | Login | Scenario | Expected boundary |
|---|---|---|---|
| super_admin | v99.uat.core.super-admin@local.test | Admin Hub, user creation, department setup, access control, Scenario Lab, import/export. | Full controlled-pilot administration inside the primary organization. |
| executive | v99.uat.core.executive@local.test | Executive Hub, dashboards, board packs, analytics, escalations. | Organization-wide executive read access without user/role administration. |
| governance_admin | v99.uat.core.governance-admin@local.test | GRC, Quality validation, governance workflows, controlled administration. | Governance and Quality administration without replacing human approvals. |
| division_head | v99.uat.core.division-head@local.test | Division-scoped work execution, risk visibility, projects and escalations. | Only the dedicated synthetic division scope plus explicitly owned work. |
| project_owner | v99.uat.core.project-owner@local.test | Open assigned projects, update project status, add milestones and evidence. | Assigned/owned project access; no broad administration. |
| milestone_owner | v99.uat.core.milestone-owner@local.test | Milestone ownership, progress updates, evidence submission. | Assigned milestone and related project context only. |
| task_owner | v99.uat.core.task-owner@local.test | My Work, assigned tasks, progress, evidence and delay reasons. | Assigned task context only. |
| auditor | v99.uat.core.auditor@local.test | Audit follow-up, security evidence, organization-wide read-only OVR review. | Broad assurance visibility with no OVR workflow mutation. |
| compliance_officer | v99.uat.core.compliance-officer@local.test | Compliance calendar, Quality validation, OVR final review and evidence. | Compliance/Quality workflow access, not user administration. |
| viewer | v99.uat.core.viewer@local.test | Read-only reports, dashboards and controlled-pilot visibility checks. | Organization-wide viewing where RLS permits; no mutation actions. |

## Department pair coverage

| Code | Department | Manager login | Employee login | Expected boundary |
|---|---|---|---|---|
| AUDIT | Internal Audit | v99.uat.dept.audit.manager@local.test | v99.uat.dept.audit.employee@local.test | Manager sees relevant department/team work; employee sees own/assigned work. |
| ENG | Engineering & Projects | v99.uat.dept.eng.manager@local.test | v99.uat.dept.eng.employee@local.test | Manager sees relevant department/team work; employee sees own/assigned work. |
| FIN | Finance | v99.uat.dept.fin.manager@local.test | v99.uat.dept.fin.employee@local.test | Manager sees relevant department/team work; employee sees own/assigned work. |
| FMS | FMS | v99.uat.dept.fms.manager@local.test | v99.uat.dept.fms.employee@local.test | Manager sees relevant department/team work; employee sees own/assigned work. |
| GOVCOMP | Governance & Compliance | v99.uat.dept.govcomp.manager@local.test | v99.uat.dept.govcomp.employee@local.test | Manager sees relevant department/team work; employee sees own/assigned work. |
| HR | Human Resources | v99.uat.dept.hr.manager@local.test | v99.uat.dept.hr.employee@local.test | Manager sees relevant department/team work; employee sees own/assigned work. |
| IT | Information Technology | v99.uat.dept.it.manager@local.test | v99.uat.dept.it.employee@local.test | Manager sees relevant department/team work; employee sees own/assigned work. |
| NURS | Nursing | v99.uat.dept.nurs.manager@local.test | v99.uat.dept.nurs.employee@local.test | Manager sees relevant department/team work; employee sees own/assigned work. |
| QUALITY | Quality & Patient Safety | v99.uat.dept.quality.manager@local.test | v99.uat.dept.quality.employee@local.test | Manager sees relevant department/team work; employee sees own/assigned work. |

Recommended pair tests:

- Manager reviews a synthetic department OVR; employee submits and sees their own OVR.
- Manager attempts another department's records and should be denied.
- Employee attempts Admin Hub, Access Control, export, and backup functions and should be denied.
- Use two department pairs to test cross-department Quality referral and response.

## External organization denial coverage

| Login | Role | Scenario | Expected boundary |
|---|---|---|---|
| v99.uat.external.viewer@local.test | viewer | Attempt to read primary-organization projects, OVRs, evidence, and reports. | Primary-organization records must be denied by organization isolation. |
| v99.uat.external.employee@local.test | employee | Attempt normal-user access against the primary organization. | No primary-organization data; no admin, export, backup, or Quality access. |

The external accounts belong to a separate synthetic organization. They should authenticate successfully but receive no primary-organization records through RLS.

## Security and governance notes

- No service-role key is exposed to the browser.
- The generator is local operator tooling only.
- Human approvals are not created, modified, inferred, or marked verified.
- These accounts do not make the platform production ready.
