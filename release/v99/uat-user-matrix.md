# v9.9A Synthetic UAT User Matrix

- Generated: 2026-06-24T07:23:00.953Z
- Environment: **Local Supabase Docker / controlled pilot only**
- Synthetic users: **30/30**
- Dataset tag: `V99_BULK_UAT_USERS`
- Shared local password: `V99-UAT-Local-Only!990A`
- Production readiness: **Not asserted**

All accounts are synthetic. Do not reuse this password or these identities outside the local controlled-pilot environment.

## Login matrix

| # | Category | Email | Role | Scope | Organization | Department | Primary manual test |
|---:|---|---|---|---|---|---|---|
| 1 | core role | v99.uat.core.super-admin@local.test | super_admin | global | Al Modawat Specialized Medical Company | IT | Admin Hub, user creation, department setup, access control, Scenario Lab, import/export. |
| 2 | core role | v99.uat.core.executive@local.test | executive | global | Al Modawat Specialized Medical Company | - | Executive Hub, dashboards, board packs, analytics, escalations. |
| 3 | core role | v99.uat.core.governance-admin@local.test | governance_admin | global | Al Modawat Specialized Medical Company | GOVCOMP | GRC, Quality validation, governance workflows, controlled administration. |
| 4 | core role | v99.uat.core.division-head@local.test | division_head | division | Al Modawat Specialized Medical Company | ENG | Division-scoped work execution, risk visibility, projects and escalations. |
| 5 | core role | v99.uat.core.project-owner@local.test | project_owner | assigned_only | Al Modawat Specialized Medical Company | ENG | Open assigned projects, update project status, add milestones and evidence. |
| 6 | core role | v99.uat.core.milestone-owner@local.test | milestone_owner | assigned_only | Al Modawat Specialized Medical Company | ENG | Milestone ownership, progress updates, evidence submission. |
| 7 | core role | v99.uat.core.task-owner@local.test | task_owner | assigned_only | Al Modawat Specialized Medical Company | ENG | My Work, assigned tasks, progress, evidence and delay reasons. |
| 8 | core role | v99.uat.core.auditor@local.test | auditor | global | Al Modawat Specialized Medical Company | AUDIT | Audit follow-up, security evidence, organization-wide read-only OVR review. |
| 9 | core role | v99.uat.core.compliance-officer@local.test | compliance_officer | global | Al Modawat Specialized Medical Company | QUALITY | Compliance calendar, Quality validation, OVR final review and evidence. |
| 10 | core role | v99.uat.core.viewer@local.test | viewer | global | Al Modawat Specialized Medical Company | - | Read-only reports, dashboards and controlled-pilot visibility checks. |
| 11 | department user | v99.uat.dept.audit.manager@local.test | department_manager | department | Al Modawat Specialized Medical Company | AUDIT | Review Internal Audit projects, team work, and department OVR queue. |
| 12 | department user | v99.uat.dept.audit.employee@local.test | employee | assigned_only | Al Modawat Specialized Medical Company | AUDIT | Submit an OVR and test own-work visibility inside Internal Audit. |
| 13 | department user | v99.uat.dept.eng.manager@local.test | department_manager | department | Al Modawat Specialized Medical Company | ENG | Review Engineering & Projects projects, team work, and department OVR queue. |
| 14 | department user | v99.uat.dept.eng.employee@local.test | employee | assigned_only | Al Modawat Specialized Medical Company | ENG | Submit an OVR and test own-work visibility inside Engineering & Projects. |
| 15 | department user | v99.uat.dept.fin.manager@local.test | department_manager | department | Al Modawat Specialized Medical Company | FIN | Review Finance projects, team work, and department OVR queue. |
| 16 | department user | v99.uat.dept.fin.employee@local.test | employee | assigned_only | Al Modawat Specialized Medical Company | FIN | Submit an OVR and test own-work visibility inside Finance. |
| 17 | department user | v99.uat.dept.fms.manager@local.test | department_manager | department | Al Modawat Specialized Medical Company | FMS | Review FMS projects, team work, and department OVR queue. |
| 18 | department user | v99.uat.dept.fms.employee@local.test | employee | assigned_only | Al Modawat Specialized Medical Company | FMS | Submit an OVR and test own-work visibility inside FMS. |
| 19 | department user | v99.uat.dept.govcomp.manager@local.test | department_manager | department | Al Modawat Specialized Medical Company | GOVCOMP | Review Governance & Compliance projects, team work, and department OVR queue. |
| 20 | department user | v99.uat.dept.govcomp.employee@local.test | employee | assigned_only | Al Modawat Specialized Medical Company | GOVCOMP | Submit an OVR and test own-work visibility inside Governance & Compliance. |
| 21 | department user | v99.uat.dept.hr.manager@local.test | department_manager | department | Al Modawat Specialized Medical Company | HR | Review Human Resources projects, team work, and department OVR queue. |
| 22 | department user | v99.uat.dept.hr.employee@local.test | employee | assigned_only | Al Modawat Specialized Medical Company | HR | Submit an OVR and test own-work visibility inside Human Resources. |
| 23 | department user | v99.uat.dept.it.manager@local.test | department_manager | department | Al Modawat Specialized Medical Company | IT | Review Information Technology projects, team work, and department OVR queue. |
| 24 | department user | v99.uat.dept.it.employee@local.test | employee | assigned_only | Al Modawat Specialized Medical Company | IT | Submit an OVR and test own-work visibility inside Information Technology. |
| 25 | department user | v99.uat.dept.nurs.manager@local.test | department_manager | department | Al Modawat Specialized Medical Company | NURS | Review Nursing projects, team work, and department OVR queue. |
| 26 | department user | v99.uat.dept.nurs.employee@local.test | employee | assigned_only | Al Modawat Specialized Medical Company | NURS | Submit an OVR and test own-work visibility inside Nursing. |
| 27 | department user | v99.uat.dept.quality.manager@local.test | department_manager | department | Al Modawat Specialized Medical Company | QUALITY | Review Quality & Patient Safety projects, team work, and department OVR queue. |
| 28 | department user | v99.uat.dept.quality.employee@local.test | employee | assigned_only | Al Modawat Specialized Medical Company | QUALITY | Submit an OVR and test own-work visibility inside Quality & Patient Safety. |
| 29 | external denial | v99.uat.external.viewer@local.test | viewer | global | V99 Synthetic External Organization | - | Attempt to read primary-organization projects, OVRs, evidence, and reports. |
| 30 | external denial | v99.uat.external.employee@local.test | employee | assigned_only | V99 Synthetic External Organization | - | Attempt normal-user access against the primary organization. |

## Usage

1. Start the app with `npm run dev`.
2. Choose the account matching the workflow under test.
3. Sign in with the shared local password above.
4. Use only synthetic/non-confidential test records.
5. Run `npm run v99:cleanup-bulk-users` when the UAT identity pack is no longer needed.
