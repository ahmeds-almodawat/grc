-- UI-7R3 rollback-only proof for the canonical Training queue grant and RLS.
begin;
create extension if not exists pgtap;
select no_plan();
select pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);

create or replace function pg_temp.ui7r3_uuid(p_value integer)
returns uuid
language sql
immutable
as $$
  select ('71730000-0000-4000-8000-' || lpad(p_value::text, 12, '0'))::uuid
$$;

create or replace function pg_temp.ui7r3_authenticate(
  p_actor_id uuid,
  p_valid_frontend_contract boolean default true
)
returns text
language plpgsql
as $$
declare
  v_email text;
  v_organization_id uuid;
  v_session_id uuid;
begin
  select lower(p.email), p.organization_id
  into v_email, v_organization_id
  from public.profiles p
  where p.id = p_actor_id;

  select s.id
  into v_session_id
  from auth.sessions s
  where s.user_id = p_actor_id
  order by s.created_at desc, s.id
  limit 1;

  perform pg_catalog.set_config('request.jwt.claim.sub', p_actor_id::text, true);
  perform pg_catalog.set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', p_actor_id,
      'role', 'authenticated',
      'email', v_email,
      'session_id', v_session_id,
      'organization_id', v_organization_id,
      'app_metadata', jsonb_build_object(
        'credential_version', 1,
        'organization_id', v_organization_id
      )
    )::text,
    true
  );
  perform pg_catalog.set_config(
    'request.headers',
    case when p_valid_frontend_contract
      then '{"x-patch83u-frontend-contract-version":"patch83u-frontend-auth-first-v1"}'
      else '{}'
    end,
    true
  );
  return p_actor_id::text;
end;
$$;

insert into public.organizations (id, name_en)
values
  (pg_temp.ui7r3_uuid(1), 'UI-7R3 training proof organization'),
  (pg_temp.ui7r3_uuid(2), 'UI-7R3 cross-organization proof');

insert into public.divisions (id, organization_id, name_en, code, is_active)
values
  (pg_temp.ui7r3_uuid(10), pg_temp.ui7r3_uuid(1), 'UI-7R3 Division A', 'UI7R3-A', true),
  (pg_temp.ui7r3_uuid(11), pg_temp.ui7r3_uuid(1), 'UI-7R3 Division B', 'UI7R3-B', true),
  (pg_temp.ui7r3_uuid(12), pg_temp.ui7r3_uuid(2), 'UI-7R3 Division X', 'UI7R3-X', true);

insert into public.departments (id, organization_id, division_id, name_en, code, is_active)
values
  (pg_temp.ui7r3_uuid(20), pg_temp.ui7r3_uuid(1), pg_temp.ui7r3_uuid(10), 'UI-7R3 Department A', 'UI7R3-DA', true),
  (pg_temp.ui7r3_uuid(21), pg_temp.ui7r3_uuid(1), pg_temp.ui7r3_uuid(11), 'UI-7R3 Department B', 'UI7R3-DB', true),
  (pg_temp.ui7r3_uuid(22), pg_temp.ui7r3_uuid(2), pg_temp.ui7r3_uuid(12), 'UI-7R3 Department X', 'UI7R3-DX', true);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, created_at, updated_at
)
select
  id, 'authenticated', 'authenticated', email, '', now(),
  jsonb_build_object('credential_version', 1), now(), now()
from (values
  (pg_temp.ui7r3_uuid(100), 'ui7r3.employee@example.test'),
  (pg_temp.ui7r3_uuid(101), 'ui7r3.peer@example.test'),
  (pg_temp.ui7r3_uuid(102), 'ui7r3.other-department@example.test'),
  (pg_temp.ui7r3_uuid(103), 'ui7r3.manager@example.test'),
  (pg_temp.ui7r3_uuid(104), 'ui7r3.division-head@example.test'),
  (pg_temp.ui7r3_uuid(105), 'ui7r3.unrelated@example.test'),
  (pg_temp.ui7r3_uuid(106), 'ui7r3.admin@example.test'),
  (pg_temp.ui7r3_uuid(107), 'ui7r3.crossorg@example.test')
) actor(id, email);

insert into public.profiles (
  id, organization_id, employee_no, full_name_en, email,
  division_id, department_id, is_active, user_status, user_type
)
select
  id,
  organization_id,
  'UI7R3-' || right(id::text, 4),
  display_name,
  email,
  division_id,
  department_id,
  true,
  'active',
  'employee'
from (values
  (pg_temp.ui7r3_uuid(100), pg_temp.ui7r3_uuid(1), pg_temp.ui7r3_uuid(10), pg_temp.ui7r3_uuid(20), 'UI7R3 Employee', 'ui7r3.employee@example.test'),
  (pg_temp.ui7r3_uuid(101), pg_temp.ui7r3_uuid(1), pg_temp.ui7r3_uuid(10), pg_temp.ui7r3_uuid(20), 'UI7R3 Peer', 'ui7r3.peer@example.test'),
  (pg_temp.ui7r3_uuid(102), pg_temp.ui7r3_uuid(1), pg_temp.ui7r3_uuid(11), pg_temp.ui7r3_uuid(21), 'UI7R3 Other Department', 'ui7r3.other-department@example.test'),
  (pg_temp.ui7r3_uuid(103), pg_temp.ui7r3_uuid(1), pg_temp.ui7r3_uuid(10), pg_temp.ui7r3_uuid(20), 'UI7R3 Manager', 'ui7r3.manager@example.test'),
  (pg_temp.ui7r3_uuid(104), pg_temp.ui7r3_uuid(1), pg_temp.ui7r3_uuid(10), pg_temp.ui7r3_uuid(20), 'UI7R3 Division Head', 'ui7r3.division-head@example.test'),
  (pg_temp.ui7r3_uuid(105), pg_temp.ui7r3_uuid(1), pg_temp.ui7r3_uuid(11), pg_temp.ui7r3_uuid(21), 'UI7R3 Unrelated Employee', 'ui7r3.unrelated@example.test'),
  (pg_temp.ui7r3_uuid(106), pg_temp.ui7r3_uuid(1), pg_temp.ui7r3_uuid(10), pg_temp.ui7r3_uuid(20), 'UI7R3 Training Admin', 'ui7r3.admin@example.test'),
  (pg_temp.ui7r3_uuid(107), pg_temp.ui7r3_uuid(2), pg_temp.ui7r3_uuid(12), pg_temp.ui7r3_uuid(22), 'UI7R3 Cross Organization', 'ui7r3.crossorg@example.test')
) actor(id, organization_id, division_id, department_id, display_name, email);

insert into public.user_credential_states (
  user_id, organization_id, auth_email, identity_mode, credential_state,
  requested_lifecycle, credential_version, session_valid_after
)
select
  p.id, p.organization_id, lower(p.email), 'legacy_verified', 'active',
  'active', 1, to_timestamp(0)
from public.profiles p
where p.id between pg_temp.ui7r3_uuid(100) and pg_temp.ui7r3_uuid(107)
on conflict (user_id) do update set
  organization_id = excluded.organization_id,
  auth_email = excluded.auth_email,
  identity_mode = excluded.identity_mode,
  credential_state = excluded.credential_state,
  requested_lifecycle = excluded.requested_lifecycle,
  credential_version = excluded.credential_version,
  session_valid_after = excluded.session_valid_after,
  invalidated_session_id = null;

insert into auth.sessions (id, user_id, created_at, updated_at)
select pg_temp.ui7r3_uuid(1000 + n), pg_temp.ui7r3_uuid(100 + n), now(), now()
from generate_series(0, 7) n;

insert into public.user_roles (
  user_id, role, scope, organization_id, division_id, department_id, is_active
)
values
  (pg_temp.ui7r3_uuid(100), 'employee', 'assigned_only', pg_temp.ui7r3_uuid(1), null, null, true),
  (pg_temp.ui7r3_uuid(101), 'employee', 'assigned_only', pg_temp.ui7r3_uuid(1), null, null, true),
  (pg_temp.ui7r3_uuid(102), 'employee', 'assigned_only', pg_temp.ui7r3_uuid(1), null, null, true),
  (pg_temp.ui7r3_uuid(103), 'department_manager', 'department', pg_temp.ui7r3_uuid(1), null, pg_temp.ui7r3_uuid(20), true),
  (pg_temp.ui7r3_uuid(104), 'division_head', 'division', pg_temp.ui7r3_uuid(1), pg_temp.ui7r3_uuid(10), null, true),
  (pg_temp.ui7r3_uuid(105), 'employee', 'assigned_only', pg_temp.ui7r3_uuid(1), null, null, true),
  (pg_temp.ui7r3_uuid(106), 'super_admin', 'global', pg_temp.ui7r3_uuid(1), null, null, true),
  (pg_temp.ui7r3_uuid(107), 'super_admin', 'global', pg_temp.ui7r3_uuid(2), null, null, true);

insert into public.training_programs (
  id, title, training_type, department_id, owner_user_id, active, created_by
)
values
  (pg_temp.ui7r3_uuid(500), 'UI7R3 Department A Training', 'compliance_training', pg_temp.ui7r3_uuid(20), pg_temp.ui7r3_uuid(106), true, pg_temp.ui7r3_uuid(106)),
  (pg_temp.ui7r3_uuid(501), 'UI7R3 Department B Training', 'compliance_training', pg_temp.ui7r3_uuid(21), pg_temp.ui7r3_uuid(106), true, pg_temp.ui7r3_uuid(106)),
  (pg_temp.ui7r3_uuid(502), 'UI7R3 Cross Organization Training', 'compliance_training', pg_temp.ui7r3_uuid(22), pg_temp.ui7r3_uuid(107), true, pg_temp.ui7r3_uuid(107));

insert into public.training_assignments (
  id, program_id, assigned_to_user_id, assigned_to_department_id,
  due_date, status, assigned_at, assigned_by
)
values
  (pg_temp.ui7r3_uuid(600), pg_temp.ui7r3_uuid(500), pg_temp.ui7r3_uuid(100), pg_temp.ui7r3_uuid(20), current_date + 7, 'assigned', now(), pg_temp.ui7r3_uuid(106)),
  (pg_temp.ui7r3_uuid(601), pg_temp.ui7r3_uuid(500), pg_temp.ui7r3_uuid(101), pg_temp.ui7r3_uuid(20), current_date + 8, 'in_progress', now(), pg_temp.ui7r3_uuid(106)),
  (pg_temp.ui7r3_uuid(602), pg_temp.ui7r3_uuid(501), pg_temp.ui7r3_uuid(102), pg_temp.ui7r3_uuid(21), current_date + 9, 'assigned', now(), pg_temp.ui7r3_uuid(106)),
  (pg_temp.ui7r3_uuid(603), pg_temp.ui7r3_uuid(502), pg_temp.ui7r3_uuid(107), pg_temp.ui7r3_uuid(22), current_date + 10, 'assigned', now(), pg_temp.ui7r3_uuid(107)),
  (pg_temp.ui7r3_uuid(604), pg_temp.ui7r3_uuid(500), pg_temp.ui7r3_uuid(100), pg_temp.ui7r3_uuid(20), current_date - 1, 'cancelled', now(), pg_temp.ui7r3_uuid(106));

select pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);

select pg_temp.ui7r3_authenticate(pg_temp.ui7r3_uuid(100));
set local role authenticated;
select is(
  (select count(*)::integer from public.v_patch29_training_assignment_queue where id in (pg_temp.ui7r3_uuid(600), pg_temp.ui7r3_uuid(604))),
  2,
  'employee sees own legitimate assignments in the canonical Training queue'
);
select is(
  (select count(*)::integer from public.v_patch29_training_assignment_queue where id in (pg_temp.ui7r3_uuid(601), pg_temp.ui7r3_uuid(602))),
  0,
  'employee does not see another employee assignment'
);
reset role;

select pg_temp.ui7r3_authenticate(pg_temp.ui7r3_uuid(103));
set local role authenticated;
select is(
  (select count(*)::integer from public.v_patch29_training_assignment_queue where id in (pg_temp.ui7r3_uuid(600), pg_temp.ui7r3_uuid(601), pg_temp.ui7r3_uuid(602))),
  2,
  'department manager sees only legitimate department-scoped assignments'
);
reset role;

select pg_temp.ui7r3_authenticate(pg_temp.ui7r3_uuid(104));
set local role authenticated;
select is(
  (select count(*)::integer from public.v_patch29_training_assignment_queue where id in (pg_temp.ui7r3_uuid(600), pg_temp.ui7r3_uuid(601), pg_temp.ui7r3_uuid(602))),
  2,
  'division head sees only legitimate division-scoped assignments'
);
reset role;

select pg_temp.ui7r3_authenticate(pg_temp.ui7r3_uuid(105));
set local role authenticated;
select is(
  (select count(*)::integer from public.v_patch29_training_assignment_queue where id between pg_temp.ui7r3_uuid(600) and pg_temp.ui7r3_uuid(604)),
  0,
  'unrelated same-organization employee sees zero unrelated assignments'
);
reset role;

select pg_temp.ui7r3_authenticate(pg_temp.ui7r3_uuid(106));
set local role authenticated;
select is(
  (select count(*)::integer from public.v_patch29_training_assignment_queue where id in (pg_temp.ui7r3_uuid(600), pg_temp.ui7r3_uuid(601), pg_temp.ui7r3_uuid(602), pg_temp.ui7r3_uuid(603), pg_temp.ui7r3_uuid(604))),
  4,
  'same-organization global Training authority follows the canonical UI-5 scope'
);
select is(
  (select count(*)::integer from public.v_patch29_training_assignment_queue where id = pg_temp.ui7r3_uuid(603)),
  0,
  'same-organization global authority does not cross organizations'
);
reset role;

select pg_temp.ui7r3_authenticate(pg_temp.ui7r3_uuid(107));
set local role authenticated;
select is(
  (select count(*)::integer from public.v_patch29_training_assignment_queue where id in (pg_temp.ui7r3_uuid(600), pg_temp.ui7r3_uuid(601), pg_temp.ui7r3_uuid(602), pg_temp.ui7r3_uuid(604))),
  0,
  'cross-organization actor sees zero assignments from the protected organization'
);
reset role;

select pg_temp.ui7r3_authenticate(pg_temp.ui7r3_uuid(100), false);
set local role authenticated;
select is(
  (select count(*)::integer from public.v_patch29_training_assignment_queue where id = pg_temp.ui7r3_uuid(600)),
  0,
  'otherwise eligible employee fails closed without the Patch83U frontend contract'
);
reset role;

select ok(
  has_table_privilege('authenticated', 'public.v_patch29_training_assignment_queue', 'SELECT')
  and not has_table_privilege('authenticated', 'public.v_patch29_training_assignment_queue', 'INSERT,UPDATE,DELETE'),
  'authenticated browser receives SELECT only on the canonical queue'
);
select ok(
  not has_table_privilege('anon', 'public.v_patch29_training_assignment_queue', 'SELECT')
  and not has_table_privilege('public', 'public.v_patch29_training_assignment_queue', 'SELECT'),
  'anon and PUBLIC retain no queue access'
);
select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'v_patch29_training_assignment_queue'
      and column_name in ('email', 'phone', 'job_title', 'description', 'user_status')
  ),
  'canonical queue does not expand confidential profile or program fields'
);
select ok(
  exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'v_patch29_training_assignment_queue'
      and coalesce(c.reloptions, array[]::text[]) @> array['security_invoker=true']
  ),
  'canonical queue remains security-invoker and cannot bypass underlying RLS'
);

select * from finish();
rollback;
