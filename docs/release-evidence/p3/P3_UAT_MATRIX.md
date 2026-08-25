# P3/P3.5 Hosted Staging UAT Matrix

## Persona Matrix

| Persona | Authentication/bootstrap | Positive scope | Negative scope |
| --- | --- | --- | --- |
| Super Admin | PASS | All release routes and governed actions | N/A |
| Executive | PASS | Executive Dashboard and Reports | Administration denied |
| Division Head | PASS | Division-scoped Risk | Administration denied |
| Department Manager | PASS | Department-scoped Compliance | Administration denied |
| Contributor / Reporter | PASS | Projects and assigned work | Risk register denied |
| Read-only external auditor | PASS | Reports and governed reads | Import denied |

All six personas passed normal password Auth, Patch83U capability and credential
bootstrap, profile resolution, RBAC bootstrap, and expected route scope during
the controlled CAPTCHA-disabled bulk-UAT window. No session injection,
service-role browser authentication, or RBAC/RLS weakening was used.

The read-only final inventory reports eight Auth users/profiles, six active
tagged UAT profiles, six tagged active roles, and eight total active roles.
No identity or role mutation occurred during final non-human closure.

## Workflow Coverage

| Workflow | Hosted result | Evidence |
| --- | --- | --- |
| Policy | PASS | Creation, approval, finalization, governed linkage |
| SOP | PASS | Creation, approval, RACI/procedure, Policy linkage |
| Risk | PASS | Reassessment and residual score persisted |
| Compliance | PASS | Assessment advanced to review |
| Audit | PASS | Finding and governance linkage reviewed |
| CAPA | PASS | Plan, action, review, validation, and effectiveness gates exercised |
| Training | PASS WITH DATA LIMIT | Route/contracts passed; no live programs existed |
| OVR | PASS | Review/verdict passed; closure correctly blocked by evidence gate |
| Projects | PASS | Tagged project created and verified |
| Evidence/storage | PASS | Private upload verified; self-review denied by SoD |
| My Work / Approvals | PASS | Assignment, participant scope, history, decisions |
| Reports / analytics | PASS | Filters, reset, drill-down, unavailable-source truth |
| Administration | PASS | Super Admin access and negative role gates |
| Imports | NOT APPLICABLE | Both staging execution flags absent/default-disabled |
| Notifications | NOT APPLICABLE | No mutable audited delivery contract in this release |

## F23 Shared-Control Coverage

- Search: Policy/SOP, My Work, Reports, and governed module instances passed.
- Single and combined filters: passed.
- Clear/reset and no-results states: passed.
- Pagination first/last boundaries, disabled controls, and current-page
  semantics: passed.
- Role-scoped results: passed across the persona matrix.
- Arabic/RTL representative controls: passed.
- Keyboard-only shell navigation and visible focus: passed.
- Modal initial focus, containment, Escape close, and focus return: passed.
- Labels, errors, responsive table/action semantics, unnamed-button scan, and
  duplicate-ID scan: passed.
- Deeper manual screen-reader certification is nonblocking follow-up and is not
  declared mandatory by the release contract.

## Import/Notification Closure

The dedicated `grc-staging` project has neither
`VITE_DEPARTMENT_IMPORT_EXECUTION_ENABLED` nor
`VITE_PATCH83T_USER_EXCEL_IMPORT_ENABLED`. The exact-lowercase flag contract
therefore disables execution. Automated compatibility testing proves zero
Patch83T requests when disabled and fail-closed behavior for incompatible
contracts. A credential-free hosted execution attempt returned
`401 UNAUTHORIZED_NO_AUTH_HEADER`; no import mutation was performed.

Notification administration explicitly displays a disabled reason because no
mutable, audited delivery contract or browser-governed provider configuration
exists in this release. External email/SMS testing is therefore not applicable.
