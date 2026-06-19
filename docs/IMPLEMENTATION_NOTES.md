# Implementation Notes

## Current build status

Version: v0.2 foundation

Completed:

- Core database design
- GRC database layer
- RLS helper functions and validation triggers
- Evidence storage bucket migration
- Executive dashboard views
- React app shell
- Supabase client setup
- API service layer with demo fallback
- Main list pages for Projects, Risks, Compliance, Audit and Governance
- First Action Plan create form

## Architecture rule

Do not let the platform become a normal task app. Every controlled action should link to a source:

- Risk
- Audit finding
- Compliance requirement
- CEO decision
- Committee decision
- Policy gap
- Department KPI
- Incident / OVR
- Strategic goal

## Next coding order

1. Project Detail page
2. Milestone CRUD under project
3. Task CRUD under milestone/project
4. Evidence upload to `grc-evidence` bucket
5. Approval workflow
6. My Tasks workspace
7. Notifications and escalation view
8. Import users/departments by Excel
9. Backup/export center

## Security notes

RLS is intentionally strict. First admin bootstrapping may require manually adding the first `profiles` row and `user_roles` record for the authenticated user.

Recommended first role:

- role: `super_admin`
- scope: `global`
- organization_id: Al Modawat organization UUID
