# v9.10 Manual UAT Readiness Checklist

- Generated: 2026-06-28T13:21:52.284Z
- Data boundary: **synthetic/non-confidential only**
- Environment: **local/staging controlled pilot**

## Before testing

- [ ] Start local Supabase and the app.
- [ ] Run `npm run pilot:first-run-bootstrap`.
- [ ] Run `npm run pilot:bulk-uat-users`.
- [ ] Open `release/v99/uat-user-matrix.md` and assign testers to synthetic accounts.
- [ ] Confirm no real patient identifiers or confidential OVR details will be entered.

## Per-role UAT flow

- [ ] Sign in with the assigned v99 synthetic account.
- [ ] Confirm the controlled pilot banner is visible.
- [ ] Confirm only authorized navigation items are visible.
- [ ] Test the primary scenario listed in the UAT user matrix.
- [ ] Verify denied pages/actions fail safely.
- [ ] Capture bugs in the UAT issue page with no real patient/confidential data.

## Core modules to cover

- [ ] OVR same-department workflow.
- [ ] OVR cross-department workflow after Quality validation.
- [ ] Risks and controls visibility.
- [ ] Evidence submission/review visibility.
- [ ] Corrective actions/projects.
- [ ] Reports/read-only access.
- [ ] Access Control/Admin visibility for authorized users only.
- [ ] Scenario Lab actions for super_admin/governance_admin only.

## Stop conditions

- Any user sees unrelated confidential OVR data.
- Any external synthetic organization account sees primary-organization records.
- Normal users can access Admin, Access Control, import/export, backup, or Scenario Lab actions.
- UAT issue capture cannot record structured bugs after migrations are applied.
