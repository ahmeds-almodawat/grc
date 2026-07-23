-- Gate 11R: remove anonymous access to legacy global pilot-governance records.
-- These records have no organization_id. The current application surface is
-- Super-Admin-only, so browser reads require an active credential-valid global
-- Super Admin. All writes remain behind the existing service-role-only RPCs.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $gate11r_preflight$
declare
  v_table text;
  v_old_policy text;
  v_new_policy text;
  v_old_count integer;
  v_new_count integer;
  v_new_qual text;
begin
  if to_regprocedure('public.patch83u_credential_access_allowed()') is null
     or to_regprocedure('public.has_any_role(public.app_role[])') is null
  then
    raise exception 'PATCH185_REQUIRED_AUTHORIZATION_HELPER_MISSING';
  end if;

  if to_regclass('public.v_patch44_pilot_go_no_go_dashboard') is null
     or not exists (
       select 1
       from pg_class c
       where c.oid = 'public.v_patch44_pilot_go_no_go_dashboard'::regclass
         and c.relkind = 'v'
         and coalesce(c.reloptions, array[]::text[]) @> array['security_invoker=true']
     )
  then
    raise exception 'PATCH185_SECURITY_INVOKER_VIEW_REQUIRED';
  end if;

  foreach v_table in array array[
    'pilot_go_no_go_reviews',
    'pilot_go_no_go_events'
  ] loop
    if to_regclass(format('public.%I', v_table)) is null
       or not exists (
         select 1
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public'
           and c.relname = v_table
           and c.relkind in ('r', 'p')
           and c.relrowsecurity
       )
    then
      raise exception 'PATCH185_REQUIRED_RLS_TABLE_MISSING: %', v_table;
    end if;

    if v_table = 'pilot_go_no_go_reviews' then
      v_old_policy := 'pilot_go_no_go_reviews_select_all';
      v_new_policy := 'pilot_go_no_go_reviews_super_admin_read';
    else
      v_old_policy := 'pilot_go_no_go_events_select_all';
      v_new_policy := 'pilot_go_no_go_events_super_admin_read';
    end if;

    select count(*) into v_old_count
    from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = v_table
      and p.policyname = v_old_policy
      and p.permissive = 'PERMISSIVE'
      and p.cmd = 'SELECT'
      and p.roles = array['public']::name[]
      and p.qual = 'true'
      and p.with_check is null;

    select count(*), max(p.qual) into v_new_count, v_new_qual
    from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = v_table
      and p.policyname = v_new_policy
      and p.permissive = 'PERMISSIVE'
      and p.cmd = 'SELECT'
      and p.roles = array['authenticated']::name[]
      and p.with_check is null;

    if v_old_count = 1 and v_new_count = 0 then
      null;
    elsif v_old_count = 0 and v_new_count = 1 then
      if regexp_replace(coalesce(v_new_qual, ''), '\s+', '', 'g')
           <> regexp_replace(
             '(patch83u_credential_access_allowed() AND has_any_role(ARRAY[''super_admin''::app_role]))',
             '\s+', '', 'g'
           )
      then
        raise exception 'PATCH185_RESTRICTIVE_POLICY_DEFINITION_DRIFT: %', v_table;
      end if;
    else
      raise exception 'PATCH185_POLICY_STATE_CONFLICT: % old=% new=%',
        v_table, v_old_count, v_new_count;
    end if;

    if exists (
      select 1
      from pg_policies p
      where p.schemaname = 'public'
        and p.tablename = v_table
        and p.policyname not in (
          'patch83u_credential_gate', v_old_policy, v_new_policy
        )
    )
    then
      raise exception 'PATCH185_UNEXPECTED_POLICY_PRESENT: %', v_table;
    end if;
  end loop;
end;
$gate11r_preflight$;

lock table public.pilot_go_no_go_reviews in share row exclusive mode;
lock table public.pilot_go_no_go_events in share row exclusive mode;

alter table public.pilot_go_no_go_reviews enable row level security;
alter table public.pilot_go_no_go_reviews force row level security;
alter table public.pilot_go_no_go_events enable row level security;
alter table public.pilot_go_no_go_events force row level security;

drop policy if exists pilot_go_no_go_reviews_select_all
  on public.pilot_go_no_go_reviews;
drop policy if exists pilot_go_no_go_events_select_all
  on public.pilot_go_no_go_events;

do $gate11r_create_policies$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'pilot_go_no_go_reviews'
      and policyname = 'pilot_go_no_go_reviews_super_admin_read'
  ) then
    create policy pilot_go_no_go_reviews_super_admin_read
      on public.pilot_go_no_go_reviews
      as permissive
      for select
      to authenticated
      using (
        public.patch83u_credential_access_allowed()
        and public.has_any_role(array['super_admin']::public.app_role[])
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'pilot_go_no_go_events'
      and policyname = 'pilot_go_no_go_events_super_admin_read'
  ) then
    create policy pilot_go_no_go_events_super_admin_read
      on public.pilot_go_no_go_events
      as permissive
      for select
      to authenticated
      using (
        public.patch83u_credential_access_allowed()
        and public.has_any_role(array['super_admin']::public.app_role[])
      );
  end if;
end;
$gate11r_create_policies$;

revoke all on table public.pilot_go_no_go_reviews from public, anon, authenticated, service_role;
revoke all on table public.pilot_go_no_go_events from public, anon, authenticated, service_role;
grant select on table public.pilot_go_no_go_reviews to authenticated, service_role;
grant select on table public.pilot_go_no_go_events to authenticated, service_role;

revoke all on table public.v_patch44_pilot_go_no_go_dashboard
  from public, anon, authenticated, service_role;
grant select on table public.v_patch44_pilot_go_no_go_dashboard
  to authenticated, service_role;

comment on policy pilot_go_no_go_reviews_super_admin_read
  on public.pilot_go_no_go_reviews is
  'Gate 11R: credential-valid active global Super Admin read of legacy unscoped pilot governance reviews.';
comment on policy pilot_go_no_go_events_super_admin_read
  on public.pilot_go_no_go_events is
  'Gate 11R: credential-valid active global Super Admin read of append-only pilot governance events.';
comment on table public.pilot_go_no_go_reviews is
  'Gate 11R remediated: no anonymous access; protected RPC writes; credential-valid global Super Admin reads only.';
comment on table public.pilot_go_no_go_events is
  'Gate 11R remediated append-only audit events: no anonymous access; protected RPC writes; credential-valid global Super Admin reads only.';

do $gate11r_postflight$
declare
  v_table text;
  v_policy text;
  v_qual text;
begin
  foreach v_table in array array[
    'pilot_go_no_go_reviews',
    'pilot_go_no_go_events'
  ] loop
    v_policy := case v_table
      when 'pilot_go_no_go_reviews' then 'pilot_go_no_go_reviews_super_admin_read'
      else 'pilot_go_no_go_events_super_admin_read'
    end;

    if not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = v_table
        and c.relrowsecurity
        and c.relforcerowsecurity
    ) then
      raise exception 'PATCH185_RLS_FORCE_POSTFLIGHT_FAILED: %', v_table;
    end if;

    select p.qual into v_qual
    from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = v_table
      and p.policyname = v_policy
      and p.permissive = 'PERMISSIVE'
      and p.cmd = 'SELECT'
      and p.roles = array['authenticated']::name[]
      and p.with_check is null;

    if regexp_replace(coalesce(v_qual, ''), '\s+', '', 'g')
         <> regexp_replace(
           '(patch83u_credential_access_allowed() AND has_any_role(ARRAY[''super_admin''::app_role]))',
           '\s+', '', 'g'
         )
    then
      raise exception 'PATCH185_RESTRICTIVE_POLICY_POSTFLIGHT_FAILED: %', v_table;
    end if;

    if has_table_privilege('anon', format('public.%I', v_table), 'SELECT')
       or has_table_privilege('anon', format('public.%I', v_table), 'INSERT')
       or has_table_privilege('anon', format('public.%I', v_table), 'UPDATE')
       or has_table_privilege('anon', format('public.%I', v_table), 'DELETE')
       or has_table_privilege('authenticated', format('public.%I', v_table), 'INSERT')
       or has_table_privilege('authenticated', format('public.%I', v_table), 'UPDATE')
       or has_table_privilege('authenticated', format('public.%I', v_table), 'DELETE')
       or not has_table_privilege('authenticated', format('public.%I', v_table), 'SELECT')
       or not has_table_privilege('service_role', format('public.%I', v_table), 'SELECT')
    then
      raise exception 'PATCH185_TABLE_ACL_POSTFLIGHT_FAILED: %', v_table;
    end if;
  end loop;

  if has_table_privilege('anon', 'public.v_patch44_pilot_go_no_go_dashboard', 'SELECT')
     or not has_table_privilege('authenticated', 'public.v_patch44_pilot_go_no_go_dashboard', 'SELECT')
     or not has_table_privilege('service_role', 'public.v_patch44_pilot_go_no_go_dashboard', 'SELECT')
  then
    raise exception 'PATCH185_VIEW_ACL_POSTFLIGHT_FAILED';
  end if;

  if has_function_privilege('anon', 'public.create_pilot_go_no_go_review(text,uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.create_pilot_go_no_go_review(text,uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.update_pilot_go_no_go_review_status(uuid,text,text,uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.update_pilot_go_no_go_review_status(uuid,text,text,uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.record_pilot_go_no_go_event(uuid,text,text,uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.record_pilot_go_no_go_event(uuid,text,text,uuid)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.create_pilot_go_no_go_review(text,uuid)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.update_pilot_go_no_go_review_status(uuid,text,text,uuid)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.record_pilot_go_no_go_event(uuid,text,text,uuid)', 'EXECUTE')
  then
    raise exception 'PATCH185_PROTECTED_RPC_ACL_DRIFT';
  end if;
end;
$gate11r_postflight$;

commit;
