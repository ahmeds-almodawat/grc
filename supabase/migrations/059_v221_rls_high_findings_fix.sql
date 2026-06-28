-- v22.1 RLS high findings fix
-- Purpose:
-- - Close v64 static RLS high findings introduced by v22.0 control-testing tables.
-- - Keep live browser access denied until reviewed org-scoped policies or Edge bridges are implemented.
-- - Do not grant broad authenticated writes and do not add delete access.

alter table if exists public.v220_control_test_plans enable row level security;
alter table if exists public.v220_control_test_steps enable row level security;
alter table if exists public.v220_control_test_results enable row level security;
alter table if exists public.v220_control_exceptions enable row level security;

drop policy if exists v221_v220_control_test_plans_select_blocked on public.v220_control_test_plans;
create policy v221_v220_control_test_plans_select_blocked
  on public.v220_control_test_plans
  for select
  to authenticated
  using (false);

drop policy if exists v221_v220_control_test_plans_insert_blocked on public.v220_control_test_plans;
create policy v221_v220_control_test_plans_insert_blocked
  on public.v220_control_test_plans
  for insert
  to authenticated
  with check (false);

drop policy if exists v221_v220_control_test_plans_update_blocked on public.v220_control_test_plans;
create policy v221_v220_control_test_plans_update_blocked
  on public.v220_control_test_plans
  for update
  to authenticated
  using (false)
  with check (false);

drop policy if exists v221_v220_control_test_steps_select_blocked on public.v220_control_test_steps;
create policy v221_v220_control_test_steps_select_blocked
  on public.v220_control_test_steps
  for select
  to authenticated
  using (false);

drop policy if exists v221_v220_control_test_steps_insert_blocked on public.v220_control_test_steps;
create policy v221_v220_control_test_steps_insert_blocked
  on public.v220_control_test_steps
  for insert
  to authenticated
  with check (false);

drop policy if exists v221_v220_control_test_steps_update_blocked on public.v220_control_test_steps;
create policy v221_v220_control_test_steps_update_blocked
  on public.v220_control_test_steps
  for update
  to authenticated
  using (false)
  with check (false);

drop policy if exists v221_v220_control_test_results_select_blocked on public.v220_control_test_results;
create policy v221_v220_control_test_results_select_blocked
  on public.v220_control_test_results
  for select
  to authenticated
  using (false);

drop policy if exists v221_v220_control_test_results_insert_blocked on public.v220_control_test_results;
create policy v221_v220_control_test_results_insert_blocked
  on public.v220_control_test_results
  for insert
  to authenticated
  with check (false);

drop policy if exists v221_v220_control_test_results_update_blocked on public.v220_control_test_results;
create policy v221_v220_control_test_results_update_blocked
  on public.v220_control_test_results
  for update
  to authenticated
  using (false)
  with check (false);

drop policy if exists v221_v220_control_exceptions_select_blocked on public.v220_control_exceptions;
create policy v221_v220_control_exceptions_select_blocked
  on public.v220_control_exceptions
  for select
  to authenticated
  using (false);

drop policy if exists v221_v220_control_exceptions_insert_blocked on public.v220_control_exceptions;
create policy v221_v220_control_exceptions_insert_blocked
  on public.v220_control_exceptions
  for insert
  to authenticated
  with check (false);

drop policy if exists v221_v220_control_exceptions_update_blocked on public.v220_control_exceptions;
create policy v221_v220_control_exceptions_update_blocked
  on public.v220_control_exceptions
  for update
  to authenticated
  using (false)
  with check (false);

comment on policy v221_v220_control_test_plans_select_blocked on public.v220_control_test_plans
  is 'v22.1 deny-by-default policy: live access blocked pending reviewed org-scoped control-testing bridge.';
comment on policy v221_v220_control_test_steps_select_blocked on public.v220_control_test_steps
  is 'v22.1 deny-by-default policy: live access blocked pending reviewed org-scoped control-testing bridge.';
comment on policy v221_v220_control_test_results_select_blocked on public.v220_control_test_results
  is 'v22.1 deny-by-default policy: live access blocked pending reviewed org-scoped control-testing bridge.';
comment on policy v221_v220_control_exceptions_select_blocked on public.v220_control_exceptions
  is 'v22.1 deny-by-default policy: live access blocked pending reviewed org-scoped control-testing bridge.';
