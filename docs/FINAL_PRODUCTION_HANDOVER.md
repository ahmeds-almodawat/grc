# Final Production Handover

This document is the final handover checklist for the GRC Control Center before a limited pilot or production launch.

## Launch rule

Do not launch to all staff until the Production Finish Center shows no critical blockers and the pilot group signs off.

## Required evidence before pilot

1. Fresh Supabase migration run from `001` to latest.
2. RLS persona test screenshots for CEO, Governance Admin, Department Manager, Quality, Auditor and Employee.
3. OVR end-to-end test: submit → supervisor/HOD review → Quality review → corrective action → evidence → closure.
4. Backup/export package plus database/storage restore dry-run evidence.
5. Arabic/RTL QA checklist for Home, OVR, dashboards, reports, approvals and admin pages.
6. 1,000-user / 50-department load seed or equivalent performance check.
7. Named support owners and backup owners.

## Pilot scope

Recommended first pilot users:

- CEO / executive sponsor
- Governance administrator
- Quality manager + one Quality officer
- Internal audit user
- Finance manager
- HR manager
- IT administrator
- 3 to 5 selected department managers
- 10 to 20 normal employees as task/OVR users

## All-staff rollout rule

Move to all-staff rollout only after:

- No open critical blockers
- Pilot acceptance is recorded
- Backup restore drill is successful
- OVR workflow is approved by Quality
- RLS tests are passed with real accounts
- Arabic/English visible QA is completed

## Support ownership

Production must have these named owners:

| Area | Primary owner | Backup owner |
|---|---|---|
| Governance workflow | Governance Admin | Audit Lead |
| OVR / Quality workflow | Quality Manager | Quality Officer |
| Supabase / technical | IT Admin | External Developer |
| Executive reporting | CEO Office | Finance Lead |
| Import/export and backup | IT Admin | Governance Admin |

## Emergency rollback

If a critical issue appears during pilot:

1. Stop new user onboarding.
2. Export current data package.
3. Capture screenshots/logs of the issue.
4. Revert the last applied patch or restore staging backup if needed.
5. Record the issue in the consolidation defect log.
6. Re-test the impacted workflow before reopening the pilot.
