# v9.8 First-Run Pilot Bootstrap Report

- Generated: 2026-06-28T09:17:29.606Z
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

- Auth user ID: `bbbd3a00-dc7f-49c4-b917-81bbd6091576`
- Profile ID: `bbbd3a00-dc7f-49c4-b917-81bbd6091576`
- Organization: Al Modawat Specialized Medical Company (`3edf43ce-bf3b-495c-80af-c9bfed20a208`)
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

