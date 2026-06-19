# v7.3 Lightweight Module Acceptance Plan

This is planning only. No runtime code, migrations, npm scripts, heavy tests, or acceptance evidence were created.

## Scope summary

- Acceptance modules: **67**
- Active/support modules: **60**
- Legacy or currently unmounted pages: **7**
- Source inventory: `src/App.tsx`, `src/components/Layout.tsx`, `src/auth/authAccess.ts`, `src/pages/*.tsx`, and API modules under `src/lib`
- Test types: **browser**, **API**, and **SQL**

Recommended order:

1. Authentication, authorization, access control and OVR confidentiality.
2. Core work, approvals, evidence and GRC workflows.
3. Import/export, reporting, backup and restore.
4. Executive analytics and operational intelligence.
5. Release, staging and administrative assurance.
6. Legacy pages only after a retain-or-retire decision.

## Acceptance matrix

| Module | Status | Objective | Synthetic data | Pass / fail condition | Test | Risk |
|---|---|---|---|---|---|---|
| Application shell and hubs | Active | Login gating, role navigation, tab hubs and unauthorized fallback. | Users for each role group and one user without a role. | Pass: only permitted navigation/tabs render. Fail: protected content or invalid page survives role change. | Browser + API | Critical |
| Access Control | Active | Scoped role assignment/deactivation and escalation protection. | Admins and employees in two organizations/departments. | Pass: authorized bridge actions persist; unauthorized/cross-org actions fail. | Browser + API + SQL | Critical |
| Admin | Active | Scoped profile and department administration view. | Active/inactive profiles across departments. | Pass: correct scoped rows. Fail: cross-org data or non-admin access. | Browser + API + SQL | High |
| Admin Safety Console | Active | Display privileged-operation safety findings accurately. | Pass, warning and blocker findings. | Pass: severity/remediation match source. Fail: blockers hidden or downgraded. | Browser + API | High |
| Advanced Report Builder | Active | Template execution, scoped results, export/print and run logging. | Two templates, populated and empty result sets. | Pass: rows/export/log reconcile. Fail: scope bypass or silent logging failure. | Browser + API + SQL | High |
| Analytics | Active | KPI, heatmap, trend and radar reconciliation. | Risks and controls with known monthly/department values. | Pass: charts equal source queries. Fail: double counts or scope mixing. | Browser + API + SQL | High |
| Approvals | Active | Queue scope, decisions and self-approval prevention. | Separate requester/approver and self-approval attempt. | Pass: one authorized decision with audit fields. Fail: unrelated/self approval succeeds. | Browser + API + SQL | Critical |
| Audit Findings | Active | Register, creation, ownership and closure controls. | Open, overdue, closed and evidence-required findings. | Pass: scoped creation/listing. Fail: evidence bypass or cross-scope leak. | Browser + API + SQL | High |
| Automation Intelligence | Active | Summaries, rules, exceptions and protected refresh. | Healthy/overdue rules, breach and exception. | Pass: totals reconcile and refresh is server-owned. Fail: browser performs privileged refresh. | Browser + API | High |
| Backup Health Check | Active | Health KPIs, blockers and protected snapshot action. | Healthy, stale and failed checks. | Pass: KPIs match rows. Fail: failed control shown healthy or browser snapshot succeeds. | Browser + API | High |
| Backup Scheduler | Active | Schedule readiness and protected run recording. | Daily/weekly/overdue plans and run history. | Pass: due state correct and browser cannot fabricate a run. | Browser + API + SQL | Critical |
| Bilingual Dictionary | Active | Translation coverage and export consistency. | Complete, missing-Arabic and inactive entries. | Pass: coverage/export reconcile. Fail: missing text counted complete or RTL corrupt. | Browser + API | Medium |
| Board Pack | Active | Executive pack data, export and authorized snapshot bridge. | Executive/employee users, scorecards and scenarios. | Pass: executive snapshot matches scoped data. Fail: employee or cross-org snapshot. | Browser + API + SQL | Critical |
| Committee Automation | Active | Committee actions and overdue automation signals. | Upcoming, overdue, complete and unowned actions. | Pass: status/export match dates. Fail: overdue items omitted. | Browser + API + SQL | Medium |
| Compliance | Active | Register, creation, due dates and scope. | Due, overdue, expired and complete requirements. | Pass: authorized rows persist. Fail: invalid dates or scope leakage. | Browser + API + SQL | High |
| Custom Reports | Active | Report rows, printing/export and export logging. | Scoped definitions, rows and empty report. | Pass: display/export/log agree. Fail: restricted rows exported. | Browser + API + SQL | High |
| Dashboard | Active | Executive totals, critical attention and OVR risk. | Known blockers, approvals, evidence and OVR records. | Pass: totals reconcile. Fail: critical items hidden or stale. | Browser + API + SQL | High |
| Departments | Active | Department execution summaries and progress. | Two departments with different work/risk states. | Pass: totals equal work items. Fail: wrong percentages or cross-org rows. | Browser + API + SQL | Medium |
| Department Scorecards | Active | Scores, ranking, tones and export. | Three varied department scorecards. | Pass: ranking/export match source. Fail: misranking or silent zero substitution. | Browser + API + SQL | Medium |
| Escalations | Active | Visibility, delay queue and bridge transitions. | Owned/unrelated escalations and overdue delays. | Pass: authorized acknowledge/resolve. Fail: unauthorized transition or direct trusted refresh. | Browser + API + SQL | Critical |
| Evidence | Active | Scoped review queue and reviewer decisions. | Submitted/accepted/rejected evidence for separate users. | Pass: authorized decision records reviewer/time. Fail: leak or unauthorized review. | Browser + API + SQL | Critical |
| Evidence Vault | Active | Inventory, versions, retention and confidentiality. | Versioned, expiring, rejected and OVR evidence. | Pass: counts/flags reconcile with scope. Fail: metadata leak or missed retention. | Browser + API + SQL | High |
| Executive Command Center | Active | Prioritized executive stream and summary. | Critical/high/overdue/resolved items. | Pass: order/severity/links reconcile. Fail: resolved item remains critical or unauthorized access. | Browser + API + SQL | High |
| Executive Mobile Command | Active | Mobile parity and RTL usability. | Command fixture with long bilingual labels. | Pass: same data as desktop and usable layout. Fail: divergence or overflow. | Browser + API | Medium |
| Final Sprint | Active | Final scorecard, gates and server-only seed. | Passing/warning/blocking gates. | Pass: readiness reconciles and seed is blocked. Fail: blocked release shown ready. | Browser + API + SQL | High |
| Global Search | Active | Relevant, navigable and RLS-safe search. | Matching project/risk/document/OVR including restricted record. | Pass: accessible matches only. Fail: restricted OVR/cross-org result leaks. | Browser + API + SQL | Critical |
| Governance | Active | Decision register, creation and status. | Draft, approved, overdue and complete decisions. | Pass: authorized creation/listing. Fail: unauthorized creation or scope leak. | Browser + API + SQL | High |
| Import / Export | Active | Scoped export, report definitions, backup package and staged import. | Valid/invalid CSV, scoped datasets and definitions. | Pass: invalid rows rejected and exports scoped. Fail: confidential export or fake backup. | Browser + API + SQL | Critical |
| Load Seed Center | Active | Read-only load-seed readiness. | Complete, partial and missing statuses. | Pass: accurate status with no browser mutation. Fail: missing seed shown ready. | Browser + API | High |
| Login | Auth support | Valid/invalid/inactive/profile-missing authentication. | Four corresponding Auth users. | Pass: only active profiled user enters. Fail: bypass or session leak. | Browser + API | Critical |
| Migration Runbook | Active | Safe ordered runbook and rollback guidance. | Pending/completed steps and blocked prerequisite. | Pass: sequence/blockers match source. Fail: unsafe order appears executable. | Browser + API | High |
| Migration Verifier | Active | Applied/expected migration comparison. | Applied, missing, duplicate and checksum mismatch records. | Pass: all discrepancies visible. Fail: mismatch shown verified. | Browser + API + SQL | High |
| Modern Executive Dashboard | Standalone route | Health, blockers, heatmap, radar and RTL. | Backup checks, blockers and chart values. | Pass: route values reconcile in both languages. Fail: auth bypass or chart divergence. | Browser + API + SQL | High |
| My Work | Active | Personal assignment queue and updates. | Owned, assigned, overdue and unrelated work. | Pass: own/assigned only. Fail: unrelated visibility/update. | Browser + API + SQL | High |
| No-Mock Auto-Test Center | Legacy unmounted | Retain/retire and static command review. | None. | Pass: retired or aligned to current policy. Fail: stale scores presented as assurance. | Browser | Low |
| Operations | Active | Inbox, reminders, digest, timeline and protected generation. | Notifications, overdue work and pending approvals. | Pass: counts reconcile and generation is server-owned. Fail: browser creates trusted reminders. | Browser + API + SQL | High |
| OVR | Active | Confidential creation, workflow bridge, action project and closure. | Synthetic non-patient reporter/supervisor/Quality fixtures. | Pass: valid role transitions only. Fail: confidentiality leak or closure bypass. | Browser + API + SQL | Critical |
| OVR Risk Indicators | Active | Summary, departmental rates and repeated alerts. | Synthetic categories/severities across dates/departments. | Pass: aggregates reconcile without detail leakage. Fail: missed severe/repeated event. | Browser + API + SQL | High |
| Performance | Active | Performance/usability signals and save behavior. | Pass/warn/fail checks. | Pass: thresholds and saves match source. Fail: critical signal hidden. | Browser + API | Medium |
| Pilot Operations | Legacy unmounted | Retain/retire; pilot waves, issues, import and export if retained. | Waves, blocker, issue and readiness rows. | Pass: blockers prevent rollout-ready. Fail: unsafe rollout shown ready. | Browser + API + SQL | High |
| Pilot/Rollout/Security Audit | Legacy unmounted | Replace hard-coded readiness or retire. | None until connected. | Pass: retired or evidence-backed. Fail: static percentages shown as live. | Browser | Medium |
| Policy Documents | Active | Document status, versions and scope. | Draft, approved, expired and restricted documents. | Pass: metadata correct and restricted rows hidden. Fail: expired shown current or leak. | Browser + API + SQL | High |
| Production Backup Strategy | Active | Backup strategy and restore verification readiness. | Current/stale plans and pass/fail restores. | Pass: readiness requires recent passed restore. Fail: failed/missing proof shown ready. | Browser + API + SQL | Critical |
| Production Data Control | Legacy unmounted | Retain/retire and environment-policy accuracy. | Production/development configurations. | Pass: production demo disabled. Fail: demo enabled or stale guidance. | Browser + API | Medium |
| Production Finish | Active | Final controls, modules, handover and protected seed. | Passing/pending/blocking controls. | Pass: blockers prevent go. Fail: go with blockers or browser seed. | Browser + API + SQL | High |
| Production Proof | Active | Hard gates, artifacts, pilot waves and stop rules. | Missing/passed artifacts and blocked/ready waves. | Pass: unsafe launch blocked. Fail: missing RLS/restore/OVR proof accepted. | Browser + API + SQL | High |
| Production Release | Active | Release summary, checklist and protected preflight. | Pass/warning/blocker checklist. | Pass: score/export reconcile and preflight server-owned. Fail: blocker ignored. | Browser + API + SQL | High |
| Projects | Active | Project hierarchy, creation, progress and workflow guards. | Scoped projects, milestones, tasks and delayed state. | Pass: authorized changes and required reasons. Fail: cross-scope access or invalid status. | Browser + API + SQL | High |
| Relationship Map | Active | Cross-object links without confidential leakage. | Project-risk-control-evidence and restricted OVR links. | Pass: accessible links complete. Fail: broken/duplicate or confidential nodes. | Browser + API + SQL | High |
| Release Candidate | Active | Gates, migration steps and blocker export. | Pass/warn/block gates and ordered steps. | Pass: ready only with all blockers cleared. Fail: blocker omitted. | Browser + API + SQL | High |
| Release Factory | Active | Scorecard, packages, signoffs and protected seed. | Blocked/passing checks, artifacts and draft signoffs. | Pass: readiness matches evidence. Fail: draft signoff counted approved. | Browser + API + SQL | High |
| Restore Dry Run | Active | Restore history and trusted drill start. | Passed/failed/running/planned drills. | Pass: history matches evidence and browser cannot fabricate drill. | Browser + API + SQL | Critical |
| Risk Appetite / KRI | Active | Appetite thresholds and breach register. | Within/warning/breached observations. | Pass: thresholds reconcile. Fail: breach shown healthy. | Browser + API + SQL | High |
| Risks | Active | Register, creation, scoring, review date and scope. | Varied risks and overdue reviews. | Pass: scores/status persist. Fail: invalid score or scope leak. | Browser + API + SQL | High |
| RLS Persona Lab | Active | Display executable persona-proof truth. | Current v7.2 proof and one failed scenario fixture. | Pass: passed/failed/not-run distinct. Fail: planned SQL shown executed. | Browser + API | High |
| Scale/Backup/Restore | Legacy unmounted | Retain/retire; scale and restore queues if retained. | Scale controls, optimization and restore rows. | Pass: failures remain blocking. Fail: stale score implies readiness. | Browser + API + SQL | Medium |
| Scenario Planning | Active | Exposure calculation, ranking and export. | Low through critical scenarios. | Pass: score/level/order reconcile. Fail: critical downgrade or scope leak. | Browser + API + SQL | Medium |
| Security Audit | Active | Findings, retention, access events and export. | Critical finding, expired retention and denied event. | Pass: severity/counts/scope reconcile. Fail: critical hidden or normal-user access. | Browser + API + SQL | Critical |
| Setup Center | Active | Setup readiness and role training checklist. | Complete/pending/blocked items. | Pass: required items drive score. Fail: required incomplete item ignored. | Browser + API | Medium |
| Smart Review Calendar | Active | Due/overdue recurring reviews and export. | Future, due, overdue and complete reviews. | Pass: calendar state matches dates. Fail: overdue shown current. | Browser + API + SQL | Medium |
| Staging Validation | Active | Readiness, checks, defects and protected seed. | Pass/warn/block checks and defects. | Pass: critical defect blocks. Fail: blocker ignored or browser seed. | Browser + API + SQL | High |
| Testing Center | Active | QA cases, personas, gates, runs and protected seed. | Pass/fail cases, blocked gate and run history. | Pass: readiness reconciles. Fail: blocker hidden or result fabricated. | Browser + API + SQL | High |
| Translation Coverage | Active | Coverage and missing-language lists. | Complete, English-only and Arabic-only labels. | Pass: percentage/lists reconcile. Fail: missing text counted complete. | Browser + API | Medium |
| Unauthorized Page | Auth support | Safe denial and home recovery. | Employee opening admin/release/security pages. | Pass: no child content and safe explanation. Fail: protected content renders. | Browser | High |
| User Guide | Active | Current bilingual workflow guidance. | None. | Pass: instructions match current modules. Fail: stale or unsafe bypass guidance. | Browser | Low |
| v3.5 Consolidation Fix Kit | Legacy unmounted | Retain/retire; scorecard, defects, SOP and export. | Patches, critical defect, repair and SOP steps. | Pass: critical defect blocks. Fail: legacy patch state treated current. | Browser + API + SQL | Medium |
| Workspace Home | Active | Role-filtered workspace cards and destinations. | Executive, manager, employee and admin sessions. | Pass: only allowed cards open. Fail: restricted card/content appears. | Browser | High |

## Planning notes

- Browser tests should focus on role visibility, interaction, error states, bilingual/RTL layout, and exported content.
- API tests should exercise Supabase client/Edge Function contracts using synthetic users and records.
- SQL tests should prove RLS, constraints, trigger guards, aggregate correctness, and audit persistence.
- Legacy/unmounted pages should not receive implementation effort until product ownership decides whether each page is retained, reconnected, consolidated, or removed.
- No acceptance execution should use real patient identifiers or confidential OVR details.
