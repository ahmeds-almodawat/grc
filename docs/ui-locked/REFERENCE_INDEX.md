# Locked UI Reference Index

This index records the visual coverage of every approved PNG in `docs/ui-locked`.
The images are locked visual specifications. Supplied PNG files must not be
regenerated, recolored, cropped, resized, compressed, or overwritten.

## Foundational Visual Authority

1. `00_FOUNDATIONAL/Executive Command Center Dashboard Mockup.png`
2. `00_FOUNDATIONAL/Governance Hub Dashboard Showcase.png`
3. `00_FOUNDATIONAL/Policy Register Light and Dark UI Comparison.png`

The authority order is:

1. Existing governed business behavior for RBAC, permissions, workflows,
   validation, auditability, calculations, APIs, schema, and security.
2. The Executive Command Center reference for the global shell and visual system.
3. The Governance Hub reference for governance landing composition.
4. The Policy Register reference for dense registers, filters, KPIs, tables, and
   responsive list behavior.
5. Each module reference for its own downstream module composition.

Where module shell details conflict with the Executive Command Center, the
Executive Command Center wins. Mock data and obvious generated-text errors are
illustrative only and do not override product terminology or behavior.

## Reference Inventory

Availability values describe what is visibly depicted in the image, not a claim
about intended future support. "Partial" means that the image contains a
representative viewport or selected screens, but not every screen in the batch.

| Filename | Module | Page / Screen represented | Desktop Light | Desktop Dark | 390px Mobile | Authority Level | Primary UI patterns represented | Notes |
|---|---|---|---|---|---|---|---|---|
| `00_FOUNDATIONAL/Executive Command Center Dashboard Mockup.png` | Platform / Executive | Executive Command Center dashboard | Yes | Partial | No | B - Master shell | Sidebar, header filters, KPI row, charts, alerts, approvals, project timeline, status legends, interaction guidance | Master authority for shell, palette, surfaces, density, borders, spacing, and dashboard language; route/RBAC semantics remain governed by the application. |
| `00_FOUNDATIONAL/Governance Hub Dashboard Showcase.png` | Governance | Governance Hub landing | Yes | Yes | Yes | C - Governance foundation | Shell adaptation, scoped filters, page actions, KPI cards, status chart, activity feed, quick access, mobile bottom navigation | Authoritative governance landing composition. |
| `00_FOUNDATIONAL/Policy Register Light and Dark UI Comparison.png` | Policy | Policy Register list view | Yes | Yes | Yes | D - Register foundation | Breadcrumbs, page header, search/filter bar, KPI row, dense table, status badges, pagination, mobile record cards | Authoritative register/table and responsive-list baseline. |
| `03_POLICY/03B_Policy_Details_Locked.png` | Policy | Policy Details view mode | Yes | Yes | Yes | E - Policy module | Nested navigation, breadcrumbs, record header/actions, tabs, overview metadata, status panel, metrics, related records, mobile detail flow | Module authority for governed record-detail composition. |
| `04_SOP/04A_SOP_Register_Locked.png` | SOP | SOP Register list view | Yes | Yes | Yes | E - SOP module | Search, filters, KPI row, register table, row actions, pagination, mobile summary cards and quick links | Full light/dark/mobile register comparison. |
| `04_SOP/04A-04J_SOP_10_Page_Batch_Locked.png` | SOP | Register, template selection, editor, procedure builder, risks, forms, training, preview, and review workflow | Partial | Partial | Partial | E - SOP module | Multi-step editor, tabs, forms, workflow stepper, risk/control rows, training records, preview, mobile forms | Batch board; viewport coverage varies by represented screen. |
| `04_SOP/04B_SOP_Details_Locked.png` | SOP | SOP Details / Builder view mode | Yes | Yes | Yes | E - SOP module | Record hero, actions, tabs, governed metadata, summary, outcomes, mobile detail navigation | Full light/dark/mobile comparison. |
| `04_SOP/04C_SOP_Editor_Locked.png` | SOP | SOP Builder / Editor edit mode | Yes | Yes | Yes | E - SOP module | Bilingual form fields, selectors, tags, editor toolbar, save/review actions, responsive form | Full light/dark/mobile comparison. |
| `04_SOP/04D_Procedure_Builder_Locked.png` | SOP | Procedure Builder tab | Yes | Yes | Yes | E - SOP module | Ordered steps, responsibility labels, duration, sidebar summary, drag/reorder affordances, mobile step cards | Full light/dark/mobile comparison. |
| `04_SOP/04E_Risks_and_Controls_Locked.png` | SOP | Risks & Controls tab | Yes | Yes | Yes | E - SOP module | Risk severity, control mappings, owners, row actions, KPI summary, mobile risk cards | Full light/dark/mobile comparison; heading contains a generated-text typo that is not authoritative. |
| `05_RISK/05A-05J_Risk_10_Page_Batch_Locked.png` | Risk | Dashboard, register, details, assessment, heatmap, treatments, KRIs, category view, history, review | Yes | No | No | E - Risk module | Risk heatmap, dense register, assessment fields, risk scoring, treatment plans, metrics, review workflow | Desktop-light batch; footer support claims do not substitute for a depicted dark/mobile viewport. |
| `05_RISK/05B_Risk_Details_Supplement_Locked.png` | Risk | Risk Details | Yes | Yes | Yes | E - Risk module | Record detail, scoring, matrix, controls, trend, actions, tabs, mobile progressive disclosure | Full light/dark/mobile comparison. |
| `06_COMPLIANCE/06A-06J_Compliance_10_Page_Batch_Locked.png` | Compliance | Dashboard, obligations, details, assessment, library, mapping, findings, reports, remediation, review | Yes | No | Partial | E - Compliance module | Compliance KPIs, obligation register, assessment stepper, regulatory cards, mappings, findings, report, mobile review form | Desktop-light batch with one mobile workflow view. |
| `07_AUDIT/07A-07J_Audit_10_Page_Batch_Locked.png` | Audit | Dashboard, register, engagement, planning, procedures, findings, report, follow-up, approval | Yes | No | Partial | E - Audit module | Audit lifecycle, scope/objectives, procedure table, findings, evidence, reports, follow-up, approval workflow | Desktop-light batch with narrow supplemental panes; no explicit dark composition. |
| `08_CAPA/08A-08J_CAPA_10_Page_Batch_Locked.png` | CAPA | Dashboard, register, details, plan, implementation, verification, closure, report, analytics, review | Yes | Yes | Yes | E - CAPA module | Lifecycle stepper, progress, status tables, evidence, analytics, review, mobile dashboard/workflow | Light and dark dashboard/workflow coverage plus 390px examples. |
| `09_TRAINING/09A-09J_Training_10_Page_Batch_Locked.png` | Training | Dashboard, register, details, catalog, assignments, competencies, assessments, profile, reports, review | Yes | Yes | Yes | E - Training module | Training KPIs, catalog/list patterns, competency levels, reports, review workflow, mobile dashboard | Light and dark module coverage plus 390px dashboard. |
| `10_OVR/10A-10J_OVR_10_Page_Batch_Locked.png` | OVR / Incidents | Dashboard, register, details, report incident, investigations, root cause, actions, reports, analytics, approval | Yes | Yes | Yes | E - OVR module | Incident KPIs, reporting form, investigation queues, RCA, corrective actions, analytics, approval, mobile dashboard | Light and dark module coverage plus 390px dashboard. |
| `11_PROJECTS/11A-11J_Projects_10_Page_Batch_Locked.png` | Projects | Dashboard, register, portfolios, timeline, resources, reports, risks, benefits, analytics, approval | Yes | Yes | Yes | E - Projects module | Portfolio KPIs, registers, Gantt timeline, resource bars, risks/issues, benefits, analytics, mobile dashboard | Light and dark module coverage plus 390px dashboard. |
| `12_EVIDENCE/12A-12J_Evidence_10_Page_Batch_Locked.png` | Evidence | Dashboard, status, recent evidence, categories, retention, requests, collections, storage, actions, search | Yes | Yes | Yes | E - Evidence module | Repository KPIs, evidence tables, retention/compliance, storage, search, quick actions, mobile dashboard | Light and dark module coverage plus 390px dashboard. |
| `13_APPROVALS/13A-13J_Approvals_10_Page_Batch_Locked.png` | Approvals | My Work dashboard, approvals, actions, delegations, due-soon, type/performance/activity, filters | Yes | Yes | Yes | E - Approvals module | Workload KPIs, queue tabs, approval statuses, delegations, filters, mobile work queue | Light and dark module coverage plus 390px dashboard. |
| `14_REPORTS/14A-14J_Reports_10_Page_Batch_Locked.png` | Reports | Reports dashboard, library, time period, performance, actions, activity | Yes | Yes | Yes | E - Reports module | Report KPIs, library table, charts, success/accuracy metrics, action list, mobile dashboard | Light and dark module coverage plus 390px dashboard. |
| `15_ADMINISTRATION/15A-15J_Administration_10_Page_Batch_Locked.png` | Administration | System overview, users, roles, organizations, integrations, settings, notifications, logs, data, system info | Yes | Yes | Yes | E - Administration module | System health, users/RBAC summaries, hierarchy, integrations, logs, storage, admin actions, mobile dashboard | Light and dark module coverage plus 390px dashboard. |
| `16_SHARED_SYSTEM/16A-16I_Shared_System_UX_Locked.png` | Shared / System | Search, notifications, empty/loading/error states, modals, drawer, responsive table, accessibility, interactions | Yes | No | Partial | E - Shared-system foundation | Global search, notifications, empty/loading/error, modal, right drawer, responsive table/cards, focus, validation, tabs, breadcrumbs, filters, bulk/context actions, tooltip | UI-1 authority for reusable system states and shared interaction patterns; phone table example supplies partial mobile coverage. |

## Package Notes

- Total approved reference images: **23**.
- All three required foundational images are physically present and were visually
  inspected before UI-1 source implementation.
- `IMAGE_INVENTORY_SHA256.md` records the original 20-image archive. The three
  subsequently supplied foundational images are present but are not listed in that
  original checksum inventory.
- `00_FOUNDATIONAL/README_REQUIRED_FOUNDATIONAL_REFERENCES.md` describes the
  foundational files as absent; that note is historical and is superseded by their
  current physical presence. The supplied note itself remains unmodified.
