# Patch 83Q root cause

The pre-Patch 83Q runtime audit queried the local Supabase container, not the linked live database. That local catalog reported 25 broad `public` SECURITY DEFINER functions, while the authoritative live schema-only catalog dump contains 383 SECURITY DEFINER functions in `public` and only six with PUBLIC-, anon-, or authenticated-derived execution.

The exact 25 original local findings were:

1. `public.acknowledge_escalation_event(uuid, text)`
2. `public.assign_user_role(uuid, app_role, access_scope, uuid, uuid, uuid, uuid, text)`
3. `public.audit_log_row_change()`
4. `public.can_access_org(uuid)`
5. `public.can_access_scope(uuid, uuid, uuid, uuid)`
6. `public.can_manage_grc()`
7. `public.can_manage_roles()`
8. `public.can_read_organization(uuid)`
9. `public.create_escalation_if_missing(uuid, text, uuid, text, uuid, uuid, date, risk_level, text, text)`
10. `public.create_system_health_snapshot(uuid, uuid)`
11. `public.current_user_org_id()`
12. `public.deactivate_user_role(uuid, text)`
13. `public.generate_due_reminders()`
14. `public.has_accepted_evidence(text, uuid)`
15. `public.has_active_role(app_role)`
16. `public.has_any_role(app_role[])`
17. `public.has_global_role(app_role[])`
18. `public.has_role(app_role)`
19. `public.has_role(uuid, app_role)`
20. `public.mark_overdue_work_items()`
21. `public.refresh_escalation_events()`
22. `public.refresh_project_progress(uuid)`
23. `public.refresh_project_progress_trigger()`
24. `public.resolve_escalation_event(uuid, text)`
25. `public.seed_default_qa_test_cases(uuid)`

The live dump proves that most of those are already closed to browser roles. It also exposes an overload distinction missed by the local result: live `public.has_any_role(text[])` is SECURITY DEFINER and browser-executable, while `public.has_any_role(app_role[])` is a separate SECURITY INVOKER overload in the live schema.

Four genuine privileged write exposures were introduced by migrations that revoked PUBLIC/authenticated but either omitted anon or explicitly retained browser grants. Migration 170 targets only those exact overloads.
