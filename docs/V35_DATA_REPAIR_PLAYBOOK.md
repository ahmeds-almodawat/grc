# v3.5 Real Data Repair Playbook

Use this when importing the real company structure: divisions, departments, units/stations, employees, roles, and pilot records.

## Repair categories

1. Duplicate department codes
2. Duplicate unit/station codes
3. Employee email conflicts
4. Employees without departments
5. Inactive users assigned as owners
6. Projects without owners
7. Tasks without due dates
8. OVRs missing Quality owner
9. Audit findings without auditor reviewer
10. Compliance items without expiry/review date

## Repair workflow

1. Log issue in `real_data_repair_queue`.
2. Assign owner.
3. Apply correction in staging.
4. Verify no downstream relationship was broken.
5. Mark as closed with approval.

## Severity rules

- Critical: blocks pilot or causes wrong data access.
- High: may affect workflow, ownership, OVR, approvals, or reporting.
- Medium: affects dashboard accuracy or user experience.
- Low: cosmetic or non-blocking cleanup.

## Approval
Any repair that changes departments, roles, or employee access should be approved by Governance/Admin before pilot.
