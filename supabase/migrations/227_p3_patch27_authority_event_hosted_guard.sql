-- P3 hosted compatibility: GoTrue exposes the effective JWT role through
-- auth.role(); request.jwt.claim.role is not populated on every Edge path.

create or replace function public.patch27_write_authority_event(
  p_approval_request_id uuid,
  p_authority_rule_id uuid,
  p_event_type text,
  p_from_status text,
  p_to_status text,
  p_actor_id uuid,
  p_event_note text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.role() is distinct from 'service_role'
     and current_user <> 'service_role' then
    raise exception 'PATCH27_AUTHORITY_EVENT_SERVICE_ROLE_REQUIRED';
  end if;

  insert into public.approval_authority_events (
    approval_request_id,
    authority_rule_id,
    event_type,
    from_status,
    to_status,
    actor_id,
    event_note
  )
  values (
    p_approval_request_id,
    p_authority_rule_id,
    p_event_type,
    p_from_status,
    p_to_status,
    p_actor_id,
    p_event_note
  );
end;
$$;

do $$
declare
  v_definition text;
begin
  select pg_get_functiondef(p.oid)
  into v_definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'patch27_write_authority_event'
    and pg_get_function_identity_arguments(p.oid) =
      'p_approval_request_id uuid, p_authority_rule_id uuid, p_event_type text, p_from_status text, p_to_status text, p_actor_id uuid, p_event_note text';

  if v_definition is null
     or lower(v_definition) not like '%auth.role() is distinct from ''service_role''%'
     or lower(v_definition) not like '%current_user <> ''service_role''%'
     or lower(v_definition) like '%request.jwt.claim.role%' then
    raise exception 'PATCH227_AUTHORITY_EVENT_GUARD_RECONCILIATION_FAILED';
  end if;
end;
$$;
