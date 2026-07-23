\set ON_ERROR_STOP on

begin;

select set_config('request.jwt.claim.role', 'service_role', true);

insert into public.organizations (id, name_en, is_active, created_at, updated_at)
values (
  '11500000-0000-4000-8000-000000000001'::uuid,
  'Gate 11R Synthetic Organization',
  true,
  timestamptz '2000-01-01 00:00:00+00',
  timestamptz '2000-01-01 00:00:00+00'
);

insert into auth.users (
  id, aud, role, email, email_confirmed_at, raw_app_meta_data, created_at, updated_at
) values
(
  '11500000-0000-4000-8000-000000000011'::uuid,
  'authenticated', 'authenticated', 'gate11r-admin@example.invalid',
  timestamptz '2000-01-01 00:00:00+00',
  '{"provider":"email","providers":["email"],"credential_version":1}'::jsonb,
  timestamptz '2000-01-01 00:00:00+00', timestamptz '2000-01-01 00:00:00+00'
),
(
  '11500000-0000-4000-8000-000000000012'::uuid,
  'authenticated', 'authenticated', 'gate11r-ordinary@example.invalid',
  timestamptz '2000-01-01 00:00:00+00',
  '{"provider":"email","providers":["email"],"credential_version":1}'::jsonb,
  timestamptz '2000-01-01 00:00:00+00', timestamptz '2000-01-01 00:00:00+00'
);

insert into public.profiles (
  id, organization_id, employee_no, full_name_en, email, is_active,
  user_status, user_type, created_at, updated_at
) values
(
  '11500000-0000-4000-8000-000000000011'::uuid,
  '11500000-0000-4000-8000-000000000001'::uuid,
  'GATE11R-ADMIN', 'Gate 11R Synthetic Administrator',
  'gate11r-admin@example.invalid', true, 'active', 'employee',
  timestamptz '2000-01-01 00:00:00+00', timestamptz '2000-01-01 00:00:00+00'
),
(
  '11500000-0000-4000-8000-000000000012'::uuid,
  '11500000-0000-4000-8000-000000000001'::uuid,
  'GATE11R-USER', 'Gate 11R Synthetic User',
  'gate11r-ordinary@example.invalid', true, 'active', 'employee',
  timestamptz '2000-01-01 00:00:00+00', timestamptz '2000-01-01 00:00:00+00'
);

insert into public.user_roles (
  id, user_id, role, scope, organization_id, is_active, assigned_at
) values (
  '11500000-0000-4000-8000-000000000021'::uuid,
  '11500000-0000-4000-8000-000000000011'::uuid,
  'super_admin', 'global',
  '11500000-0000-4000-8000-000000000001'::uuid,
  true, timestamptz '2000-01-01 00:00:00+00'
);

insert into public.pilot_go_no_go_reviews (
  id, review_title, review_status, created_by, created_at
) values (
  '11500000-0000-4000-8000-000000000031'::uuid,
  'Gate 11R synthetic review', 'draft',
  '11500000-0000-4000-8000-000000000011'::uuid,
  timestamptz '2000-01-01 00:00:00+00'
);

insert into public.pilot_go_no_go_events (
  id, review_id, event_type, event_summary, actor_user_id, created_at
) values (
  '11500000-0000-4000-8000-000000000032'::uuid,
  '11500000-0000-4000-8000-000000000031'::uuid,
  'fixture_created', 'Gate 11R synthetic event',
  '11500000-0000-4000-8000-000000000011'::uuid,
  timestamptz '2000-01-01 00:00:00+00'
);

do $contract$
declare
  v_table text;
begin
  foreach v_table in array array['pilot_go_no_go_reviews','pilot_go_no_go_events'] loop
    if has_table_privilege('anon', format('public.%I', v_table), 'SELECT')
       or has_table_privilege('anon', format('public.%I', v_table), 'INSERT')
       or has_table_privilege('anon', format('public.%I', v_table), 'UPDATE')
       or has_table_privilege('anon', format('public.%I', v_table), 'DELETE')
    then raise exception 'GATE11R_ANON_TABLE_ACCESS_REMAINS: %', v_table; end if;

    if has_table_privilege('authenticated', format('public.%I', v_table), 'INSERT')
       or has_table_privilege('authenticated', format('public.%I', v_table), 'UPDATE')
       or has_table_privilege('authenticated', format('public.%I', v_table), 'DELETE')
       or not has_table_privilege('authenticated', format('public.%I', v_table), 'SELECT')
    then raise exception 'GATE11R_AUTHENTICATED_ACL_DRIFT: %', v_table; end if;
  end loop;

  if has_table_privilege('anon', 'public.v_patch44_pilot_go_no_go_dashboard', 'SELECT')
  then raise exception 'GATE11R_ANON_VIEW_ACCESS_REMAINS'; end if;

  if exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename in ('pilot_go_no_go_reviews','pilot_go_no_go_events')
      and (roles @> array['public']::name[] or roles @> array['anon']::name[])
  ) then raise exception 'GATE11R_ANON_POLICY_REMAINS'; end if;
end;
$contract$;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '11500000-0000-4000-8000-000000000012', true);

do $ordinary_user$
begin
  if (select count(*) from public.pilot_go_no_go_reviews) <> 0
     or (select count(*) from public.pilot_go_no_go_events) <> 0
  then raise exception 'GATE11R_ORDINARY_USER_READ_ALLOWED'; end if;
end;
$ordinary_user$;

select set_config('request.jwt.claim.sub', '11500000-0000-4000-8000-000000000011', true);

do $super_admin$
begin
  if (select count(*) from public.pilot_go_no_go_reviews) <> 1
     or (select count(*) from public.pilot_go_no_go_events) <> 1
  then raise exception 'GATE11R_SUPER_ADMIN_READ_DENIED'; end if;
  if (select approved_reviews from public.v_patch44_pilot_go_no_go_dashboard) <> 0
  then raise exception 'GATE11R_SECURITY_INVOKER_VIEW_RESULT_DRIFT'; end if;
end;
$super_admin$;

reset role;
set local role service_role;

select public.create_pilot_go_no_go_review(
  'Gate 11R protected workflow review',
  '11500000-0000-4000-8000-000000000011'::uuid
);

reset role;

do $protected_workflow$
begin
  if not exists (
    select 1 from public.pilot_go_no_go_reviews
    where review_title='Gate 11R protected workflow review'
  ) then raise exception 'GATE11R_PROTECTED_WORKFLOW_FAILED'; end if;
end;
$protected_workflow$;

rollback;
