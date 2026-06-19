# v6.6 Controlled Pilot Day-1 Runbook

## Scope

Use 5–15 trusted users in staging or controlled internal environment only. Do not enter real patient identifiers or confidential OVR details until persona tests and restore dry-run are verified.

## Day-1 sequence

1. Confirm migrations through 044/045 in staging.
2. Confirm local evidence: typecheck, build, no-mock strict, v64 strict, test:real.
3. Run Supabase persona SQL tests.
4. Run workflow SQL smoke tests.
5. Confirm backup and restore dry-run evidence.
6. Load pilot roster.
7. Hold 30-minute orientation.
8. Test: login, dashboard, my tasks, evidence, OVR test record, reports.
9. Record every issue in v66-pilot-issue-log.csv.
10. Daily review by IT + Quality + Admin.

## Stop conditions

- Any role can access unrelated confidential data.
- OVR confidential data visible to unauthorized user.
- Evidence files visible outside role scope.
- Backup/restore cannot be completed.
- Any critical defect affecting data integrity.
