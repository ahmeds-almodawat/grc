# HF-1-R1 Final Staging Certification

Date: `2026-08-26`  
Hotfix branch: `hotfix/v1.4-super-admin-dashboard-visibility`  
Certified source candidate: `bebcca669d9a59593099186786ef4bdfb9fa3f93`  
Staging Supabase: `zghsgzrdwbqdrpuxanac`  
Production Supabase: `zbrjjecpsrzposhuarcn` (read-only inspection only)

This record contains no passwords, JWTs, session values, service-role material,
CAPTCHA secrets, raw OVR content, or unnecessary Auth identifiers.

## Defect And Correction

- The Super Admin OVR failure was a role-entitlement and fixed-aggregate defect
  with frontend masking risk (classifications B/E/H). The canonical aggregate
  resolver now accepts active global Super Admin and Executive assignments.
- Recent governed activity was hidden by profile/JWT scope divergence and stale
  frontend wiring (classifications D/F/H). The correction derives the trusted
  organization scope from the active profile and exposes only the bounded
  aggregate projection through the existing authenticated Edge bridge.
- Risk, CAPA, Compliance, Audit, and pending Approval zeroes were confirmed as
  genuine source results, not authorization failures rendered as zero.
- Migrations `232` through `234` and `privileged-action` Edge version `14` are
  deployed in Staging. Historical migrations were not edited.

## Configuration Contract And Provenance

The analytics contract requires exactly one active and currently effective
`organization_ovr_analytics_config` row for the organization. It includes the
organization, timezone, active SLA calendar, privacy minimum cell size, fixed
KPI definition version, effectivity window, configurator, and timestamps.
The linked `runtime_workflow_sla_calendars` row must be active, belong to the
same organization, and use the same timezone. Database constraints and trigger
validation enforce the relationship.

No application management UI or configuration write RPC exists for this
contract. The supported repository pattern is controlled direct SQL under an
explicit environment authorization.

Production read-only inspection found exactly one canonical active/current
configuration for the organization:

- timezone: `Asia/Riyadh`
- minimum cell size: `5`
- KPI definition version: `ovr-kpi-v2`
- SLA calendar: `riyadh_analytics_reference_v1`
- working days: Sunday through Thursday
- working hours: `08:00` to `17:00`
- holiday policy: empty canonical object
- effective-until: none

The Production configuration and calendar relationship were valid. No
Production configuration write is required for HF-1.

Staging had no active organization analytics configuration or calendar before
HF-1-R1. One guarded Staging-only transaction created fresh Staging identifiers
with the exact canonical Production business semantics above and an eligible
active Staging Super Admin as configurator. No Production identifiers were
copied. Synthetic values: **NONE**. No unrelated business record, role, raw OVR
record, or existing user was changed by the configuration transaction.

Post-write validation proved one active/current config, one valid linked active
calendar, matching organization/timezone, valid effectivity, and valid
configurator linkage.

## Aggregate And Access Results

The exact fixed analytics family used by the Dashboard was invoked in Staging.

| Persona | Result |
| --- | --- |
| Super Admin | PASS: privacy-safe organization headline aggregate |
| Executive | PASS: privacy-safe 12-month aggregate |
| Division Head | DENIED: `OVR_ANALYTICS_DASHBOARD_ENTITLEMENT_REQUIRED` |
| Department Manager | DENIED: `OVR_ANALYTICS_DASHBOARD_ENTITLEMENT_REQUIRED` |
| Employee | DENIED: `OVR_ANALYTICS_DASHBOARD_ENTITLEMENT_REQUIRED` |
| Viewer | DENIED: `OVR_ANALYTICS_DASHBOARD_ENTITLEMENT_REQUIRED` |

Both permitted results used `deterministic-bands-daily-v1`, minimum cell size
`5`, returned no exact values, and allowed no arbitrary filters. Lower-role
results were explicit entitlement denials, not empty datasets.

Focused ACL proof confirmed `anon` and `authenticated` cannot execute the OVR
refresh, OVR analytics, or dashboard recent-activity RPCs. `service_role`
retains only the intended server-side execution path. Existing raw OVR RLS and
raw governance-link access were not expanded.

## Real Browser Persona Certification

All four required representatives used normal Staging password authentication,
real Turnstile challenges completed by the operator, Patch83U credential
governance, normal profile/RBAC bootstrap, and normal logout. No session was
injected and CAPTCHA was not disabled or bypassed.

### Super Admin

- Dashboard route and organization-wide privacy-safe OVR aggregate: PASS.
- Open OVR displayed a privacy band (`<5`), not a raw count.
- GRC trend rendered 12 monthly privacy-safe buckets without entitlement error.
- Incident summary rendered privacy-safe results without entitlement error.
- Recent governed activity returned trusted same-organization records.
- Risk showed the governed live result; CAPA, Audit, and Approvals showed
  genuine empty results; Compliance and management alerts remained correct.

### Executive

- Dashboard and privacy-safe organization aggregate: PASS.
- Admin navigation was absent.
- Direct Admin navigation was denied and redirected to a permitted report page.
- No unrestricted raw OVR, service-only RPC, or privileged Admin capability was
  exposed.

### Division Head

- Normal CAPTCHA login and protected password transition: PASS.
- Direct Executive Dashboard navigation was role-gated to the scoped workspace.
- Admin navigation and organization-wide OVR aggregate were absent.
- No raw OVR content, false aggregate zero, render crash, or visible API retry
  loop appeared.

### Department Manager

- Normal CAPTCHA login and protected password transition: PASS.
- Direct Executive Dashboard navigation resolved to the scoped Daily Operations
  workspace rather than exposing organization-wide analytics.
- Department-scoped work views remained available; Admin navigation was absent.
- No raw OVR content, false aggregate zero, render crash, or visible API retry
  loop appeared.

The two bounded staging persona resets were executed through the platform's
governed Super Admin action, preserved role/scope/lifecycle state, required the
normal protected transition, and revoked prior sessions. Temporary material was
removed after logout and was not written to the repository or evidence.

## Validation And Hosted State

- Reused HF-1 focused tests: `62/62` PASS.
- TypeScript validation: PASS.
- Frontend build: PASS.
- Security/function contract audits: PASS.
- Staging logical migration ceiling: `234`.
- Staging `privileged-action`: version `14`, ACTIVE.
- Staging CAPTCHA: enabled throughout certification.
- Patch83U: enabled throughout certification.
- Production changes: **NONE**.

The final Vercel deployment identifier, deployed Git SHA metadata, PR number,
and CI result are recorded in the PR/release handoff produced after this
evidence-only commit. No Production deployment or merge is authorized here.

