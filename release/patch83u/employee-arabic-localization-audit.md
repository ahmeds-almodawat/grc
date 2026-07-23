# Patch 83U Employee Arabic Localization Audit

## Scope and derivation

This is the pre-edit Phase 1 inventory for an authenticated Employee with:

- role: `employee`
- scope: `assigned_only`
- credential state: `active`
- selected language: Arabic

The accessible page set was derived programmatically from the existing
`PAGE_LOCATION_REGISTRY`, navigation `pageGroups`, role/scope assignments, and
`canAccessPageForUser`/`SUPER_ADMIN_ONLY_PAGES` enforcement. No route or access
rule was changed.

The resulting Employee page keys are:

1. `home`
2. `myWork`
3. `ovr`
4. `approvals`
5. `evidence`
6. `userGuide`
7. `globalSearch`

`userGuide` is directly accessible but is not currently rendered in the
Employee sidebar tree. `globalSearch` is exposed through the top bar. All
administrative and Super Admin-only pages are outside this phase.

## Existing localization architecture

- The application uses the existing `I18nContext` translation map and `t()`
  helper.
- Language selection is stored in `grc-language`.
- `I18nContext` updates the document `lang` and `dir` attributes immediately.
- The authenticated shell already receives the selected direction, but parts
  of the navigation tree and several shared components bypass `t()`.
- Raw database and API values must remain unchanged; enum/status localization
  must occur only when values are rendered.

## Pre-edit page inventory

The counts below are candidate user-facing English/fallback occurrences, not
unique translation keys. Proper names, user-entered content, identifiers,
emails, URLs, file names, and approved technical acronyms are not counted.

| Page/surface | Access path | Pre-edit findings | Candidate occurrences |
| --- | --- | --- | ---: |
| Authenticated shell | Sidebar and top bar | Employee navigation group/item labels, navigation help, role label, sign-out text, and accessibility labels bypass or incompletely use localization | 17 |
| Home | `home` | Main Employee-visible page content already uses `t()`; denied Export Center content is not Employee-visible | 0 |
| My Work | `myWork` | Page title, instructions, filters, metrics, empty states, table headings, and work-item controls are English | 16 |
| OVR | `ovr` | Filters, empty/detail states, table labels, type/status values, and supporting text contain English or raw enums | 31 |
| Approvals | `approvals` | Page title, metrics, filters, table/detail labels, decision controls, loading/error/empty text, and status values are English | 38 |
| Evidence | `evidence` | Main headings, metrics, warnings, filters, empty states, tables, detail/action modals, disabled reasons, and rendered enum values contain English | 134 |
| User Guide | `userGuide` | Employee-visible content already uses the existing translation architecture | 0 |
| Global Search | `globalSearch` | Main content uses `t()`; one local error fallback remains English | 1 |
| Shared Employee components | All Employee routes | Modal close fallback, loading/empty states, Supabase empty notice, work-item controls, and secure-session initialization text contain English or malformed Arabic | 31 |
| **Total** |  |  | **268** |

## Shared-component findings

- `Layout`: navigation tree labels and hints are stored in the real navigation
  configuration but rendered without translation keys.
- `Modal`: the default close label is English when a caller does not supply a
  label.
- `DataState`: default loading and empty-state strings are English.
- `WorkItemControls`: Employee-visible action labels, confirmations, validation
  messages, and progress states are English.
- `EmptySupabaseNotice`: Employee-visible configuration/empty messaging is
  English.
- Secure-session initialization includes English and malformed Arabic text.
- `ModuleHeader`, `EntityTable`, and `StatusBadge` are primarily pass-through
  presentation components; localization belongs at their Employee page call
  sites.

## Route-by-route pre-edit title and correction inventory

| Page key | English title | Existing Arabic title before correction | Missing/hardcoded Employee-visible content | RTL issue | Correction status |
| --- | --- | --- | --- | --- | --- |
| `home` | One clean entrance for governance, risk, quality and execution. | مدخل موحد ونظيف للحوكمة والمخاطر والجودة والتنفيذ. | Page body was localized; shared pilot banner keys rendered literally and shell navigation remained English | Forward icons and shared shell alignment required verification | Complete |
| `myWork` | My assigned milestones, tasks, due dates and evidence requirements | No page-title translation | 16 page occurrences plus shared status, evidence-upload and approval-request controls | Table overflow, modal direction, dates and action alignment | Complete |
| `ovr` | OVR / Incident Management | إدارة بلاغات OVR والحوادث | 31 filter, empty/detail, placeholder and rendered-enum occurrences | Filters, detail panels, arrows, tables and dates | Complete |
| `approvals` | Pending approvals for closure, evidence, projects and governance actions | No page-title translation | 38 page, decision, prompt, empty-state and status occurrences | Queue table, detail alignment and date localization | Complete |
| `evidence` | Evidence Library | No page-title translation | 134 warning, metric, queue, gate, detail, modal, action and rendered-enum occurrences | Wide tables, modal direction, action controls and dates | Complete |
| `userGuide` | User Guide | دليل المستخدم | No page-body gap found; shared shell remained English | Shared shell and responsive navigation only | Complete |
| `globalSearch` | Global Search Center | مركز البحث الشامل | One local English error fallback; shared shell remained English | Search control and shared responsive shell verification | Complete |

The route correction uses translation keys at render time. Stored values such
as `employee`, `assigned_only`, `submitted`, `queued`, and `in_progress` remain
unchanged.

## RTL and responsive findings

- The application root already switches `dir`, and the sidebar moves through
  the document direction, but physical-direction icons and some alignment rules
  require Employee-surface verification.
- Navigation group chevrons and forward arrows need direction-aware treatment.
- Employee tables and modal content require internal overflow at laptop/mobile
  widths without causing application-level horizontal overflow.
- Logical alignment must be preserved for Arabic text while IDs, email
  addresses, and technical values remain readable.
- Shared modal close placement must follow the selected direction and remain
  keyboard accessible.

## Correction rules

- Add Employee strings only through the existing `I18nContext`.
- Preserve route keys, permissions, handlers, request/response contracts,
  database enum values, and all stored data.
- Translate status/role/scope/action values only at render time.
- Preserve loading, empty, error, disabled, confirmation, and accessibility
  behavior.
- Keep a documented English detector allowlist limited to proper nouns,
  technical terms, and acronyms that must remain unchanged.
- Stop after the seven Employee-accessible pages and their shared visible
  components.

## Verification plan

- Add a read-only authenticated Employee Playwright route crawl derived from
  the same page/access registries.
- Verify Arabic mode, English mode, live language switching without route loss,
  direct route access, denial of administrative routes, and zero mutation
  requests.
- Exercise 1920×1080, 1440×900, 1366×768, 1024×768, and 390×844 viewports.
- Run TypeScript, relevant localization/navigation/auth tests, Patch 83U
  regression suites, production build, and `git diff --check`.

## Post-edit completion evidence

- Accessible Employee pages: 7.
- Pre-edit candidate English/fallback occurrences: 268.
- Corrected occurrences: 268.
- Remaining unjustified visible English found by the authenticated Arabic
  route crawl: 0.
- The fixture-backed modal/detail pass covers all three My Work control
  dialogs, the Employee OVR report form, approval detail, and evidence detail.
- English mode remains English and two live language switches preserve the
  canonical `my-work` route.
- A direct `admin` route request is redirected to `home` for the Employee
  persona.
- All five required viewport sizes retain RTL and application-level horizontal
  containment.
- The browser proof recorded no REST/Auth mutation request, no unexpected Edge
  action, no console warning/error, no page error, and no HTTP error.

Approved visible Latin terms are limited to identifiers, language-switch
labels, proper technical names and established acronyms: `GRC`, `OVR`, `RLS`,
`KPI`, `KRI`, `ISO`, `CBAHI`, `API`, `UAT`, `URL`, `PDF`, `CSV`, `JSON`, `ERP`,
`HIS`, `SLA`, `Supabase`, `English`, `EN`, `AR`, and the fixed private bucket
identifier `grc-evidence`. Email addresses, URLs, file names, IDs, numeric
values, user-entered data and backend-provided proper names are ignored by the
detector rather than allowlisting an entire component.

### Validation results

- TypeScript: passed.
- Focused localization/navigation/auth/Patch 83U unit suite: 7 files, 50 tests
  passed.
- Employee Arabic Playwright: 4 tests passed, including 35 route/viewport
  combinations and fixture-backed modal/detail coverage.
- Existing Patch 83U Playwright: 6 tests in the selected file. One combined-run
  sticky-header geometry check initially differed by 0.28 px; the affected
  Arabic queue test and the following reset test both passed on an immediate
  focused rerun without a source change.
- Production build: passed (2,003 modules transformed).
- `git diff --check`: passed; only existing line-ending notices were emitted.

No database, migration, Supabase/Edge function, authentication, credential,
provisioning, RLS, permission, route-access, API-contract, business-rule,
runtime-enforcement, user-data, staging, or production change was made for this
localization phase.
