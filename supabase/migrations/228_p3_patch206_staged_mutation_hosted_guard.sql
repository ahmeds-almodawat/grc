-- P3 hosted compatibility for Patch206 staged-approval mutation guards.
-- Authenticated browser mutations remain blocked; hosted service execution is
-- recognized through the canonical GoTrue auth.role() contract.

create or replace function public.guard_staged_approval_mutations()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.role() is distinct from 'service_role'
     and current_user <> 'service_role' then
    if TG_TABLE_NAME = 'approval_requests' then
      if exists (select 1 from public.approval_request_stages where approval_request_id = OLD.id) then
        if (NEW.request_status is distinct from OLD.request_status
            or NEW.final_decision is distinct from OLD.final_decision
            or NEW.received_approval_count is distinct from OLD.received_approval_count) then
          raise exception 'PATCH206_DIRECT_STAGED_REQUEST_MUTATION_FORBIDDEN';
        end if;
      end if;
    elsif TG_TABLE_NAME = 'approval_decisions' then
      if exists (
        select 1 from public.approval_request_stages
        where approval_request_id = coalesce(NEW.approval_request_id, OLD.approval_request_id)
      ) then
        raise exception 'PATCH206_DIRECT_STAGED_DECISION_MUTATION_FORBIDDEN';
      end if;
    end if;
  end if;

  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end;
$$;

do $$
declare
  v_definition text;
begin
  select lower(p.prosrc)
  into v_definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'guard_staged_approval_mutations'
    and pg_get_function_identity_arguments(p.oid) = '';

  if v_definition is null
     or v_definition not like '%auth.role() is distinct from ''service_role''%'
     or v_definition not like '%current_user <> ''service_role''%'
     or v_definition like '%request.jwt.claim.role%'
     or v_definition not like '%patch206_direct_staged_request_mutation_forbidden%'
     or v_definition not like '%patch206_direct_staged_decision_mutation_forbidden%' then
    raise exception 'PATCH228_STAGED_MUTATION_GUARD_RECONCILIATION_FAILED';
  end if;
end;
$$;
