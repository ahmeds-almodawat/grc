# HF-1 Dashboard Source Census

Baseline: `58c06da8640edaf09c0db233278cab9d536fa3a8`  
Production inspection: read-only, 2026-08-26  
Production project: `zbrjjecpsrzposhuarcn`  
Production migration ceiling: `231`

## Surface Boundaries

| Surface | Component | Route entitlement | Source family | HF-1 disposition |
| --- | --- | --- | --- | --- |
| Dashboard | `src/pages/Dashboard.tsx` | Executive page group: Super Admin, Executive, Governance Admin | Fixed OVR aggregate plus RLS-scoped operational sources | Corrected |
| Analytics | `src/pages/Analytics.tsx` | Executive page group | `v_grc_kpi_scorecard`, `v_department_risk_heatmap`, `v_monthly_grc_trend`, `v_radar_control_profile` | Audited; separate security-invoker analytics contract |
| Executive Truth | `src/pages/ExecutiveTruthCenter.tsx` | Executive page group | Patch30 truth/scorecard/register views | Audited; no OVR aggregate dependency |
| Production Readiness | `src/pages/ProductionReadinessCenter.tsx` | Super Admin only | Release-readiness views and controlled actions | Audited; release-control semantics unchanged |
| Production Operator | `src/pages/ProductionOperatorConsole.tsx` | Super Admin only | Composite production-readiness API | Audited; release-control semantics unchanged |
| Production Evidence | `src/pages/ProductionEvidenceClosureCenter.tsx` | Super Admin only | Composite evidence-closure API | Audited; evidence separation of duties unchanged |

## Main Dashboard Widgets

| Widget | Client/source | Filters | Authorization dependency | Production truth before HF-1 | Classification | HF-1 result |
| --- | --- | --- | --- | --- | --- | --- |
| Open OVR KPI | `getOvrExecutiveDashboardAnalytics` -> `privileged-action` -> fixed service RPCs | No client dimensions | Active Patch83U actor plus one active global dashboard-aggregate role | 1 OVR report and 1 privacy-safe snapshot existed; Super Admin received 403 | B, E | Canonical resolver accepts active global Executive or Super Admin; raw OVR RLS unchanged |
| GRC performance trend | Same fixed aggregate, `monthly_trend_12` | Fixed 12 months | Same as Open OVR | Restricted for Super Admin despite available snapshot | B, E, H | Aggregate loads; 403 remains restricted and non-403 failures render unavailable |
| Incident severity / safe OVR | Same fixed aggregate, `headline_current_period` | No client dimensions | Same as Open OVR | Restricted for Super Admin despite available aggregate | B, E, H | Same corrected entitlement and error semantics |
| Critical risks / heatmap | `getRisks` -> `risks` | Department, status, severity | Table grants plus canonical risk RLS | 0 Production risks | A; H latent | True zero remains zero; read failures render unavailable |
| Governed CAPA queue | `getLiveGrcCapaQueue` -> `v_live_grc_capa_queue` | Period, status | Security-invoker view and underlying CAPA RLS | 0 CAPAs and 0 queue rows | A | True zero unchanged; existing LiveResult error states preserved |
| Compliance deadlines/domains | `getComplianceItems` -> `compliance_items` | Period, department, status, severity | Table grants plus compliance RLS | 0 obligations | A; H latent | True empty remains empty; read failures render unavailable |
| Audit findings/coverage | `getAuditFindings` -> `audit_findings` | Period, responsible department, status, severity | Table grants plus audit RLS | 0 findings | A | Existing strict source failure behavior retained |
| Approvals requiring attention | `getApprovals` -> `v_pending_approvals_expanded` | Period | Security-invoker view and approval participant RLS | 0 pending approvals | A; H latent | True empty remains empty; read failures render unavailable |
| Management alerts | `getManagementControlSummary` -> `v_management_control_summary` | None | Security-invoker view and organization scope | Live source returned | Working | Unchanged |
| Critical attention | `getCriticalAttentionItems` -> `v_critical_attention_items` | Period, department, status, severity | Security-invoker view and underlying RLS | 2 rows | Working; H latent | Read failures now render unavailable |
| Projects/programs | `getProjects` + `getPortfolioMilestones` | Period, department, status, severity | Project/milestone RLS | 1 project | Working; H latent | Project read failures now render unavailable |
| Recent governed activity | `getDashboardRecentGovernedActivity` -> authenticated Edge bridge -> `dashboard_recent_governed_activity_v1` -> `v_recent_governed_activity` | Latest 12 | Service-only RPC; active global aggregate entitlement; explicit organization filter; browser/anonymous execute denied; raw source RLS unchanged | Production view had 0 source rows and the UI was hardcoded unavailable; staging exposed 16 same-organization rows hidden by stale JWT organization scope and raw-link readability | F; D found during staging | Migration 233 restores profile-derived read scope; migration 234 exposes only the trusted activity projection through the existing service bridge without granting raw linkage access |
| Accreditation readiness | No trusted aggregate configured | None | N/A | Unavailable | F, intentional | Unchanged; no fabricated value |

## Intended Entitlement

- Super Admin: every dashboard page and organization-wide privacy-safe aggregate through an active global role. Detail rows remain subject to their existing RLS and confidentiality controls.
- Executive: the same privacy-safe OVR aggregate through an active global role. Admin and release-control pages remain denied.
- Governance Admin: Dashboard page access and its RLS-visible operational widgets, but no OVR privacy-safe aggregate entitlement.
- Division and Department roles: no new Dashboard page or aggregate capability. Existing module-level records remain limited to canonical division/department RLS.
- Contributor, Viewer, Employee, and anonymous users: no aggregate entitlement. Anonymous access to governed dashboard sources remains denied.

## Production Classification Summary

- A true zero: Risk, CAPA, Compliance, Audit, pending Approvals, and Recent Governed Activity source rows.
- B role entitlement defect: Super Admin omitted from the canonical OVR aggregate resolver.
- C scope defect: not observed; the active Super Admin assignment is global and organization-consistent.
- D RLS/grant defect: not observed for the reported Production sources.
- E aggregate defect: the fixed privacy-safe OVR RPC path accepted Executive only.
- F source not configured: stale frontend wiring for Recent Governed Activity despite an existing trusted view; Accreditation remains intentionally unconfigured.
- G expected restriction: raw OVR/detail RLS and lower-scope aggregate denial remain intentional.
- H frontend masking: Risk, Compliance, Approvals, Projects, and Critical Attention could convert source errors to empty arrays; the Dashboard now requests strict errors and renders them independently.
