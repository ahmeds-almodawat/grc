# v9.8 First-Run Pilot Bootstrap Verification

- Generated: 2026-06-21T00:03:14.986Z
- Status: **PASSED**
- Environment: Local Supabase Docker staging/pilot only
- Supabase project: grc-control-center
- Database container: supabase_db_grc-control-center
- Target email: pilot.admin@almodawat.test
- Production readiness: **Not asserted**

## Required checks

- Auth user exists: **PASS**
- Profile exists: **PASS**
- Profile active: **PASS**
- Active organization selected: **PASS**
- Active global super-admin role: **PASS**
- Exactly one active matching role: **PASS** (1)
- All required departments active: **PASS**

| Code | Expected department | Result | Actual name |
|---|---|---|---|
| AUDIT | Internal Audit | PASS | Internal Audit |
| ENG | Engineering & Projects | PASS | Engineering & Projects |
| FIN | Finance | PASS | Finance |
| GOVCOMP | Governance & Compliance | PASS | Governance & Compliance |
| HR | Human Resources | PASS | Human Resources |
| IT | Information Technology | PASS | Information Technology |
| NURS | Nursing | PASS | Nursing |
| QUALITY | Quality & Patient Safety | PASS | Quality & Patient Safety |

Missing departments: none

This verification confirms local bootstrap integrity only. It does not constitute production approval.

