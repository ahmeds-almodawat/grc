-- HF-1: service-only recent governed activity projection for global dashboard
-- aggregate roles. The browser retains no direct access to this RPC and raw
-- source/linkage RLS remains unchanged.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';

create or replace function public.dashboard_recent_governed_activity_v1(
  p_actor_id uuid,
  p_limit integer default 12
)
returns table (
  activity_id uuid,
  organization_id uuid,
  activity_type text,
  title text,
  reference_code text,
  status text,
  occurred_at timestamptz,
  due_date date
)
language plpgsql
security definer
set search_path = pg_catalog, public, auth, ovr_v11_private, pg_temp
as $$
declare
  v_organization_id uuid;
begin
  perform ovr_v11_private.assert_service_caller();
  v_organization_id := ovr_v11_private.executive_actor_organization(p_actor_id);

  if p_limit is null or p_limit < 1 or p_limit > 50 then
    raise exception using errcode = 'P0001', message = 'DASHBOARD_RECENT_ACTIVITY_LIMIT_INVALID';
  end if;

  return query
  select activity.activity_id,
         activity.organization_id,
         activity.activity_type,
         activity.title,
         activity.reference_code,
         activity.status,
         activity.occurred_at,
         activity.due_date
  from public.v_recent_governed_activity activity
  where activity.organization_id = v_organization_id
  order by activity.occurred_at desc, activity.activity_id
  limit p_limit;
end;
$$;

alter function public.dashboard_recent_governed_activity_v1(uuid, integer)
  owner to postgres;
revoke all on function public.dashboard_recent_governed_activity_v1(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.dashboard_recent_governed_activity_v1(uuid, integer)
  to service_role;

comment on function public.dashboard_recent_governed_activity_v1(uuid, integer) is
  'HF-1 service-only organization activity projection for active global dashboard aggregate roles; raw source RLS and browser grants are unchanged.';

commit;
