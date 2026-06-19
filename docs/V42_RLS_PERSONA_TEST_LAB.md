# v4.2 RLS Persona Test Lab

Purpose: prove that users only see and do what they are allowed to see and do.

Run:

```bash
node scripts/v42-rls-persona-test-lab.mjs
node scripts/v42-generate-rls-persona-sql.mjs
```

Then in Supabase SQL Editor after migration 033:

```sql
select seed_v42_release_validation_defaults();
select * from v_v42_rls_persona_matrix;
select * from v_v42_rls_test_case_queue;
```

Hard stop rules:

- Employee can view unrelated OVR: stop.
- Employee can view unrelated department tasks: stop.
- Department manager can see another department: stop.
- Any user can self-approve: stop.
- OVR can close without Quality/evidence when required: stop.
- Inactive user can still access active workflows: stop.

Minimum personas:

- CEO / Executive
- Governance Admin
- Quality Manager
- Auditor
- Department Manager
- Project Owner
- Employee
- Scoped Viewer
