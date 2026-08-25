-- UI-7R3: restore the canonical Training assignment queue read contract.
-- The view remains security-invoker and all row visibility stays governed by
-- the existing Training, profile, department, and Patch83U RLS policies.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $$
declare
  v_expected_columns text[] := array[
    'id',
    'program_id',
    'assigned_to_user_id',
    'assigned_to_role',
    'assigned_to_department_id',
    'due_date',
    'status',
    'assigned_at',
    'assigned_by',
    'completed_at',
    'completion_evidence_id',
    'program_title',
    'program_title_ar',
    'training_type',
    'assigned_user_name_en',
    'assigned_user_name_ar',
    'department_name_en',
    'department_name_ar'
  ];
  v_actual_columns text[];
begin
  if to_regclass('public.v_patch29_training_assignment_queue') is null then
    raise exception 'UI7R3_TRAINING_ASSIGNMENT_QUEUE_REQUIRED';
  end if;

  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'v_patch29_training_assignment_queue'
      and c.relkind = 'v'
      and coalesce(c.reloptions, array[]::text[]) @> array['security_invoker=true']
  ) then
    raise exception 'UI7R3_SECURITY_INVOKER_REQUIRED';
  end if;

  select array_agg(a.attname::text order by a.attnum)
  into v_actual_columns
  from pg_attribute a
  where a.attrelid = 'public.v_patch29_training_assignment_queue'::regclass
    and a.attnum > 0
    and not a.attisdropped;

  if v_actual_columns is distinct from v_expected_columns then
    raise exception 'UI7R3_TRAINING_QUEUE_COLUMN_CONTRACT_MISMATCH';
  end if;

  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('training_assignments', 'training_programs', 'profiles', 'departments')
      and c.relrowsecurity is not true
  ) then
    raise exception 'UI7R3_UNDERLYING_RLS_REQUIRED';
  end if;

  if not (
    has_table_privilege('authenticated', 'public.training_assignments', 'SELECT')
    and has_table_privilege('authenticated', 'public.training_programs', 'SELECT')
    and has_table_privilege('authenticated', 'public.profiles', 'SELECT')
    and has_table_privilege('authenticated', 'public.departments', 'SELECT')
  ) then
    raise exception 'UI7R3_UNDERLYING_SELECT_REQUIRED';
  end if;

  if has_table_privilege('authenticated', 'public.training_assignments', 'INSERT,UPDATE,DELETE')
    or has_table_privilege('authenticated', 'public.training_programs', 'INSERT,UPDATE,DELETE')
  then
    raise exception 'UI7R3_BROWSER_TRAINING_DML_MUST_REMAIN_DENIED';
  end if;
end;
$$;

revoke all privileges on table public.v_patch29_training_assignment_queue
from public, anon, authenticated;

grant select on table public.v_patch29_training_assignment_queue
to authenticated;

commit;
