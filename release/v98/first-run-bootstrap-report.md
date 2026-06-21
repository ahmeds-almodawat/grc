# v9.8 First-Run Pilot Bootstrap Report

- Generated: 2026-06-21T00:03:13.677Z
- Status: **PASSED**
- Environment: Local Supabase Docker staging/pilot only
- Supabase project: grc-control-center
- Database container: supabase_db_grc-control-center
- Target email: pilot.admin@almodawat.test
- Production readiness: **Not asserted**

## Safety controls

- The helper did not insert into `auth.users`; the auth user had to exist first.
- The helper connected only to the running local Supabase Docker database container.
- Running this bootstrap helper does not modify RLS policies, migrations, approval records, or frontend runtime source files.
- Re-running the helper reuses the profile, organization, departments, and role assignment.

## Bootstrap result

- Auth user ID: `5a305a09-afb6-4691-b432-2c000bf175d8`
- Profile ID: `5a305a09-afb6-4691-b432-2c000bf175d8`
- Organization: Al Modawat Specialized Medical Company (`69641b94-bc57-4cb0-80d9-ee84cc70db80`)
- Role: `super_admin` / `global`
- Active matching role rows: 1

| Code | Department | State |
|---|---|---|
| AUDIT | Internal Audit | active |
| ENG | Engineering & Projects | active |
| FIN | Finance | active |
| GOVCOMP | Governance & Compliance | active |
| HR | Human Resources | active |
| IT | Information Technology | active |
| NURS | Nursing | active |
| QUALITY | Quality & Patient Safety | active |

The database bootstrap completed. This report is local technical evidence only and is not a human approval or production-readiness declaration.

