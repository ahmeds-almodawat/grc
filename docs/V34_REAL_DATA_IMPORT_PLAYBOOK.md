# v3.4 Real Data Import Playbook

## Import order
1. Organizations
2. Divisions
3. Departments
4. Units/stations
5. Employees/profiles
6. Roles/scopes
7. Projects/action plans
8. Risks
9. Compliance items
10. Audit findings
11. Policies/documents

## Mandatory validation before import
- Department codes unique per organization.
- Unit/station codes unique per department.
- Employee emails unique.
- Employee numbers unique per organization.
- Every active employee has department.
- Every scoped role has matching department/division/unit.
- No inactive user owns an active critical project.

## Real data advice
Do not import daily tasks. Import only major action plans, major risks, audit findings, compliance obligations, and governance decisions.
