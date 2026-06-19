# v6.6 Restore Dry-Run Evidence

Status: **manual evidence required**

## 1. Identify backup source

- Status: `manual_required`
- Required evidence: Database backup/export package location and timestamp

## 2. Restore database to staging

- Status: `manual_required`
- Required evidence: Restore command/log and target project reference

## 3. Verify critical table counts

- Status: `manual_required`
- Required evidence: Before/after counts for users, projects, tasks, OVR, evidence, approvals, roles

## 4. Verify evidence storage samples

- Status: `manual_required`
- Required evidence: At least 3 evidence files opened from restored storage

## 5. Run app smoke test after restore

- Status: `manual_required`
- Required evidence: Login, dashboard, OVR, tasks, evidence, reports smoke result

## 6. Document issues and signoff

- Status: `manual_required`
- Required evidence: Named IT owner signoff and issue list

