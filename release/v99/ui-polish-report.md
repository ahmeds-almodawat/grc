# v9.9B Pilot UI Polish Report

## Outcome

The pilot interface now uses live, RLS-scoped counts where safe and professional unavailable/empty states otherwise. It does not present the previous fixed employee, department, OVR workflow, or report-summary counters as live facts.

This patch does not mark the platform production ready. The interface is explicitly labelled as a controlled pilot using synthetic data only.

## Files changed

- `src/pages/WorkspaceHome.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/Admin.tsx`
- `src/pages/ExecutiveCommandCenter.tsx`
- `src/pages/ExecutiveMobileCommand.tsx`
- `src/pages/Analytics.tsx`
- `src/pages/OVR.tsx`
- `src/pages/Risks.tsx`
- `src/pages/Audit.tsx`
- `src/pages/Evidence.tsx`
- `src/pages/Projects.tsx`
- `src/pages/Departments.tsx`
- `src/pages/ImportExport.tsx`
- `src/pages/AccessControl.tsx`
- `src/components/Layout.tsx`
- `src/components/DataState.tsx`
- `src/components/ControlledPilotBanner.tsx`
- `src/components/EmptySupabaseNotice.tsx`
- `src/components/LiveDataState.tsx`
- `src/components/ScenarioFillButton.tsx`
- `src/auth/AuthProvider.tsx`
- `src/auth/authAccess.ts`
- `src/auth/authTypes.ts`
- `src/lib/grcApi.ts`
- `src/lib/commandCenterApi.ts`
- `src/i18n/I18nContext.tsx`
- `src/styles.css`
- `scripts/v99-ui-polish-check.mjs`
- `package.json`

## Fake or confusing values removed

- Fixed homepage values for employee scale, department count, and workspace count.
- Invented OVR workflow fallback counters.
- Invented department execution fallback counters.
- Report-summary fallback based on the number of client-side dataset definitions.
- Fixed rollout claims referencing specific employee or department volumes.
- Production-like visible wording that said records would fall back to demo data.
- Nonfunctional command-center search action.

## Real counts added

`getPilotUiCounts()` reads exact counts through the signed-in browser client, so existing RLS remains authoritative:

- active profiles visible in scope
- active departments
- total OVR reports
- open OVR reports
- risks
- active risk controls
- evidence items
- projects / corrective actions

Unavailable queries return `Not configured`; they do not return invented values.

## Empty states added

Professional empty states now explain missing or unavailable data for:

- executive dashboard summaries and attention items
- OVR summaries, workflow controls, queue and report list
- departments and admin profile lists
- risks, audit findings, evidence and projects
- executive command summary and stream
- analytics scorecard
- access-control summary

Actions remain visible only when the signed-in role is allowed to perform them.

## Role visibility notes

- `super_admin` and `governance_admin` can see Admin and Scenario Lab controls.
- Scenario fill buttons now require both local/pilot enablement and an authorized admin role.
- auditors receive read-only Risk, Audit, OVR and reporting surfaces; create/review actions are hidden.
- viewers do not receive import, report-builder or backup-scheduler write surfaces.
- employees receive My Work and OVR entry points instead of administrative workspaces.
- the V99 external synthetic organization is restricted to its small external pilot navigation set; RLS remains the security boundary.
- UAT tools have their own sidebar and homepage section.

## Remaining manual review

- Confirm visual spacing at common desktop and mobile sizes.
- Login with representative V99 users and confirm each role sees the intended cards and tabs.
- Confirm Arabic labels and RTL flow on the rewritten homepage and pilot badges.
- Confirm each count matches a direct SQL count for the same authenticated persona.
- Human governance approvals remain separate and must not be inferred from this UI work.
