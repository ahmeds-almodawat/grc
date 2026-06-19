# Staging Smoke Test Matrix

| Area | Scenario | Expected Result |
| --- | --- | --- |
| Auth | Login with approved test persona | Login succeeds |
| Auth | Access with unauthorized persona | Access denied |
| Dashboard | Load executive/dashboard pages | No runtime crash |
| GRC | View governance/risk/compliance modules | Synthetic data only |
| Audit | View audit evidence areas | Authorized roles only |
| OVR | Create synthetic OVR | No real patient data required |
| OVR | Review OVR as unauthorized user | Restricted |
| Projects | Create task/project from synthetic scenario | Created successfully |
| Evidence | Open release evidence | Current status is clear |
| Reports | Generate report preview | No confidential data |
| Admin | Assign/deactivate role | Edge bridge path only |
| Rollback | Revert staging deployment | Rollback works |
