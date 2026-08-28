# OVERNIGHT-1 Product Surface Rationalization

## Scope and outcome

- Starting `origin/main`: `86cc797184bd9ce8f351ca580fd8c14f4f83d50e`
- Branch: `codex/v1.4.1-overnight-surface-rationalization`
- Route keys before/after: **75 / 75**
- Source pages deleted: **0**
- Database migrations: **NONE**
- Edge behavior changes: **NONE**
- Hosted environment changes: **NONE**
- Production changes: **NONE**

Visibility is centralized in `src/routes/pageSurfaceRegistry.ts`. Authorization remains exclusively governed by the existing RBAC and route-resolution contracts.

## Navigation metrics

Counts include visible group headings and visible destinations, matching the product sidebar behavior.

| Role | Sidebar before | Sidebar after | Home before | Home after |
| --- | ---: | ---: | ---: | ---: |
| Super Admin | 78 | 35 | 11 | 9 |
| Executive | 36 | 30 | 10 | 8 |
| Division | 33 | 27 | 11 | 8 |
| Department | 33 | 27 | 11 | 8 |
| Employee | 9 | 9 | 4 | 4 |
| Viewer | 15 | 13 | 5 | 4 |

- Global Search page destinations before/after: **0 / 0**. Global Search continues to search governed business objects; it did not expose page destinations before this change.
- Hidden internal pages: **26**
- Hidden legacy/duplicate pages: **6**
- Uncertain pages retained without reducing their existing discovery: **2**

## Classification legend

- **A** - Core business
- **B** - Role-specific business
- **C** - Administration
- **D** - Internal engineering, release, or testing
- **E** - Legacy, duplicate, or superseded
- **F** - Uncertain; preserved for owner review

## Complete page inventory

| Page | Classification | Previous visibility | New visibility | Authorized direct route preserved | Reason |
| --- | --- | --- | --- | --- | --- |
| Home (`home`) | A | Sidebar | Business navigation and Home | YES | Primary business workspace. |
| Executive Workspace (`executiveHub`) | E | Home/direct | Legacy hidden | YES | Superseded by the current Dashboard and Reports workspace. |
| Work Center (`workHub`) | E | Direct | Legacy hidden | YES | Superseded by Workspace and My Work. |
| Workspace (`dailyOperationsHub`) | A | Sidebar | Business navigation | YES | Current daily work and operational queue. |
| GRC (`grcHub`) | A | Sidebar | Business navigation and Home | YES | Current governance, risk, compliance, audit, and CAPA workspace. |
| Quality & Safety (`qualityHub`) | A | Sidebar | Business navigation and Home | YES | Current quality, safety, and OVR workspace. |
| Accreditation (`accreditationHub`) | A | Sidebar | Business navigation and Home | YES | Current accreditation and survey-readiness workspace. |
| Evidence & Documents Hub (`evidenceHub`) | E | Sidebar | Legacy hidden | YES | Superseded by Policy, SOP, and Evidence destinations. |
| Reports & Analytics (`reportsHub`) | A | Sidebar/Home | Business navigation and Home | YES | Current governed reporting workspace. |
| Administration (`adminHub`) | C | Sidebar/Home | Business navigation and Home | YES | Current administration workspace. |
| Production Operator Console (`productionOperatorConsole`) | D | Sidebar | Internal hidden | YES | Release-operation tooling. |
| Production Evidence Closure (`productionEvidenceClosure`) | D | Sidebar | Internal hidden | YES | Release evidence tooling. |
| Final Sprint Center (`finishFast`) | D | Sidebar | Internal hidden | YES | Historical release-control tooling. |
| Production Finish Center (`productionFinish`) | D | Sidebar | Internal hidden | YES | Historical release-control tooling. |
| Release Factory (`releaseFactory`) | D | Sidebar | Internal hidden | YES | Engineering release tooling. |
| Production Proof (`productionProof`) | D | Sidebar | Internal hidden | YES | Engineering proof tooling. |
| Dashboard (`dashboard`) | B | Sidebar | Business navigation | YES | Current role-entitled management dashboard. |
| Analytics (`analytics`) | B | Sidebar | Business navigation | YES | Current role-entitled analytics surface. |
| My Work (`myWork`) | A | Sidebar/Home | Business navigation and Home | YES | Current personal work queue. |
| Projects & Programs (`projects`) | A | Sidebar/Home | Business navigation and Home | YES | Current project and program workspace. |
| Departments (`departments`) | A | Sidebar | Business navigation | YES | Current organization and department workspace. |
| Risk Register (`risks`) | A | Sidebar/Home | Business navigation | YES | Current risk-management workspace. |
| Compliance (`compliance`) | A | Sidebar | Business navigation | YES | Current compliance workspace. |
| Audit (`audit`) | A | Sidebar | Business navigation | YES | Current audit workspace. |
| CAPA (`capa`) | A | Sidebar | Business navigation | YES | Current corrective and preventive action workspace. |
| OVR (`ovr`) | A | Sidebar/Home | Business navigation | YES | Current occurrence and incident workspace. |
| OVR Risk Indicators (`ovrRisk`) | B | Sidebar | Business navigation | YES | Current quality and safety indicator view. |
| Governance (`governance`) | A | Sidebar/Home | Business navigation | YES | Current governance workspace. |
| Escalations (`escalations`) | B | Sidebar | Business navigation | YES | Current role-entitled escalation queue. |
| Approvals (`approvals`) | A | Sidebar | Business navigation and Home | YES | Current approval queue. |
| Evidence (`evidence`) | A | Sidebar/Home | Business navigation and Home | YES | Current governed evidence workspace. |
| Import & Export (`importExport`) | C | Sidebar/Home | Owning hub and direct route | YES | Governed workflow remains in its owning administration workspace. |
| Access Control (`accessControl`) | C | Sidebar | Business navigation | YES | Current role and access administration. |
| Organization Setup (`setupCenter`) | C | Sidebar | Business navigation | YES | Current organization configuration workspace. |
| User Guide (`userGuide`) | A | Direct/contextual | Search, owning hub, and direct route | YES | Useful contextual guidance remains available without sidebar clutter. |
| Operations (`operations`) | B | Sidebar | Business navigation | YES | Current operational notifications and activity surface. |
| Testing Center (`testing`) | D | Sidebar | Internal hidden | YES | Engineering test tooling. |
| Performance Center (`performance`) | D | Sidebar | Internal hidden | YES | Engineering performance proof tooling. |
| Security Audit Center (`security`) | D | Sidebar | Internal hidden | YES | Engineering security proof tooling. |
| Executive Command Center (`commandCenter`) | E | Direct | Legacy hidden | YES | Superseded by the current Dashboard and Reports workspace. |
| Global Search (`globalSearch`) | A | Top-bar command | Top-bar command | YES | Current governed business-data search. |
| Policy Register (`documents`) | A | Sidebar/Home | Business navigation | YES | Current governed policy register. |
| SOP Register (`sops`) | A | Sidebar/Home | Business navigation | YES | Current governed procedure register. |
| Governance Relationships (`relationships`) | B | Sidebar | Business navigation | YES | Current governed clause and control relationship map. |
| Release Candidate (`releaseCandidate`) | D | Sidebar | Internal hidden | YES | Engineering release-control tooling. |
| Production Release (`productionRelease`) | D | Sidebar | Internal hidden | YES | Engineering release-control tooling. |
| Migration Verifier (`migrationVerifier`) | D | Sidebar | Internal hidden | YES | Database migration proof tooling. |
| Restore Dry-Run (`restoreDryRun`) | D | Sidebar | Internal hidden | YES | Backup and restore proof tooling. |
| Admin Safety Console (`adminSafety`) | D | Sidebar/admin link | Internal hidden | YES | Privileged operational safety tooling. |
| Bilingual Dictionary (`bilingualDictionary`) | C | Sidebar | Business navigation | YES | Current bilingual master-data administration. |
| Board Packs (`boardPacks`) | B | Sidebar | Business navigation | YES | Current role-entitled management reporting. |
| Report Builder (`reportBuilder`) | B | Sidebar | Business navigation | YES | Current role-entitled report authoring. |
| Evidence Vault (`evidenceVault`) | E | Sidebar | Legacy hidden | YES | Superseded by the current Evidence workspace. |
| Department Scorecards (`departmentScorecards`) | B | Sidebar | Business navigation | YES | Current department performance view. |
| Backup Scheduler (`backupScheduler`) | D | Sidebar | Internal hidden | YES | Infrastructure administration and proof tooling. |
| Scenario Planning (`scenarioPlanning`) | F | Search/hub/direct | Search/hub/direct unchanged | YES | Business value requires owner review; no existing discovery was removed. |
| Executive Mobile Command (`mobileCommand`) | E | Direct | Legacy hidden | YES | Superseded by responsive current management views. |
| Automation Intelligence (`automationIntelligence`) | F | Search/hub/direct | Search/hub/direct unchanged | YES | Business value requires owner review; no existing discovery was removed. |
| Risk Appetite & KRI (`riskAppetiteKri`) | B | Owning hub/direct | Owning hub/search/direct | YES | Specialized risk view remains in its owning GRC workspace. |
| Review Calendar (`smartReviews`) | B | Sidebar | Business navigation | YES | Current governance review calendar. |
| Committees (`committeeAutomation`) | B | Sidebar | Business navigation | YES | Current committee action workspace. |
| Staging Validation (`stagingValidation`) | D | Sidebar | Internal hidden | YES | Staging and release proof tooling. |
| RLS Persona Lab (`rlsPersonaLab`) | D | Sidebar | Internal hidden | YES | Security test tooling. |
| Translation Coverage (`translationCoverage`) | D | Sidebar | Internal hidden | YES | Engineering localization proof tooling. |
| Load & Seed Center (`loadSeedCenter`) | D | Sidebar | Internal hidden | YES | Synthetic-data and load-test tooling. |
| Production Backup Strategy (`productionBackupStrategy`) | D | Sidebar | Internal hidden | YES | Infrastructure proof and release tooling. |
| Migration Runbook (`migrationRunbook`) | D | Sidebar | Internal hidden | YES | Database migration operation tooling. |
| Controlled UAT Workbench (`controlledUatWorkbench`) | D | Sidebar | Internal hidden | YES | UAT and test execution tooling. |
| Scenario Test Console (`scenarioTestConsole`) | D | Sidebar/Home panel | Internal hidden | YES | Synthetic scenario test tooling. |
| UAT Issue Capture (`uatIssueCapture`) | D | Sidebar/Home panel | Internal hidden | YES | UAT test tooling. |
| Training Governance (`trainingGovernance`) | A | Sidebar | Business navigation | YES | Current training and competency governance workspace. |
| Executive Summary (`executiveTruth`) | B | Sidebar | Business navigation | YES | Current executive governed reporting view. |
| Production Readiness (`productionReadiness`) | D | Sidebar | Internal hidden | YES | Release-readiness proof tooling. |
| User Management (`admin`) | C | Sidebar | Business navigation | YES | Current governed user lifecycle administration. |
| Backup & Restore Center (`scaleBackupRestoreCenter`) | D | Direct | Internal hidden | YES | Infrastructure scale and restore proof tooling. |

## Visible core product surfaces

Home, Workspace, My Work, Approvals, Projects, Departments, Operations, Escalations, GRC, Governance, Policy Register, SOP Register, Risk, Compliance, Audit, CAPA, Evidence, Quality & Safety, OVR, Accreditation, Governance Relationships, Training, Dashboard, Analytics, Executive Summary, Reports, Report Builder, Board Packs, Administration, User Management, Access Control, Organization Setup, and Bilingual Dictionary remain visible subject to existing role authorization.

## Hidden internal surfaces

Production Operator Console, Production Evidence Closure, Final Sprint Center, Production Finish Center, Release Factory, Production Proof, Testing Center, Performance Center, Security Audit Center, Release Candidate, Production Release, Migration Verifier, Restore Dry-Run, Admin Safety Console, Backup Scheduler, Staging Validation, RLS Persona Lab, Translation Coverage, Load & Seed Center, Production Backup Strategy, Migration Runbook, Controlled UAT Workbench, Scenario Test Console, UAT Issue Capture, Production Readiness, and Backup & Restore Center.

## Hidden legacy surfaces

Executive Workspace, Work Center, Evidence & Documents Hub, Executive Command Center, Evidence Vault, and Executive Mobile Command.

## Uncertain / owner review

- **Scenario Planning**: retained in its existing search/hub/direct discovery state.
- **Automation Intelligence**: retained in its existing search/hub/direct discovery state.

Neither uncertain page was automatically hidden beyond its pre-existing direct-only sidebar status.

## Content declutter changes

- Replaced the legacy navigation tree with a compact business hierarchy while retaining the old tree as a measured pre-change snapshot.
- Reduced Super Admin sidebar discovery from 78 to 35 items and Home destinations from 11 to 9.
- Removed the UAT/scenario panel, duplicate controls card, standalone duplicate Policy/SOP cards, and Export Center from normal Home discovery.
- Hid Integrations, System Settings, Notifications, and System Information from normal Administration tabs while preserving all ten underlying view implementations.
- Removed the visible Admin Safety Console teaser from the business Audit Logs view.
- Replaced patch, migration, deployment-contract, synthetic-identity, pilot, and implementation wording on current visible Administration, User Management, Governance, banner, and Dashboard surfaces.
- Preserved business status, owners, assignments, dates, evidence, versions, privacy state, workflow state, and audit history.

## Route integrity

- The canonical route registry and surface registry each contain exactly **75** unique keys.
- `npm run audit:routes`: **PASS**, route count 75, switch count 75, no missing switch cases, no orphaned navigation values, no unused switch cases, and no duplicate locations.
- Unit coverage proves every Category D/E route remains registered while absent from navigation, mobile, Home, and page discovery.
- Browser coverage proves an authorized Super Admin can render representative hidden internal and legacy pages through direct `?page=` URLs.

## RBAC integrity

- The visibility registry declares `authorization: existing-rbac` and contains no role rules.
- Existing `canAccessPageForUser` and `resolveAuthorizedPage` behavior remains authoritative.
- Browser coverage proves an unauthorized Employee deep link retains the existing redirect/denial behavior.
- The 12-persona route matrix passes without writes.

## Mobile, accessibility, and localization

- Desktop and 390px use the same centralized visibility classification.
- Hidden navigation entries are not rendered, so they are absent from keyboard order and the accessibility tree.
- Mobile drawer, bottom destinations, responsive containment, keyboard focus, English/LTR, and Arabic/RTL checks pass.
- `npm run audit:i18n`: **PASS**, 1,290 used keys and zero missing keys.

## Test results

| Gate | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run build` | PASS; existing chunk-size advisory only |
| `npm run test:unit` | PASS, 123 files and 2,274 tests |
| `npm run test:e2e` | PASS, 95/95 |
| Post-copy Administration/UI-9 visual regression | PASS, 5/5 |
| `npm run proof:ci` with `GRC_RLS_BASE_REF=origin/main` | PASS, 8/8 gates |
| `npm run audit:routes` | PASS, 75/75 routes |
| `npm run audit:i18n` | PASS, zero missing keys |
| Strict no-mock/static gate | PASS, zero production-blocking findings |
| RLS regression against `origin/main` | PASS, zero new critical/high findings |
| `git diff --check` | PASS |

The first proof invocation omitted the required RLS baseline environment and reported `failed_base_unavailable`; rerunning the unchanged suite with `GRC_RLS_BASE_REF=origin/main` passed all eight gates.

## Visual evidence

- [Desktop light Home](screenshots/01-desktop-light-home.png)
- [Desktop dark Dashboard](screenshots/02-desktop-dark-dashboard.png)
- [390px Home](screenshots/03-home-mobile-390.png)
- [390px Arabic RTL](screenshots/04-arabic-rtl-mobile-390.png)
- [Administration](screenshots/05-administration.png)

All screenshots use deterministic test-only fixtures. Fixture identity labels are test data and are not product copy.

## Production changes

**NONE.** No hosted Supabase, Vercel, Auth, user, role, session, RLS, business-record, deployment, or Production operation was performed.
