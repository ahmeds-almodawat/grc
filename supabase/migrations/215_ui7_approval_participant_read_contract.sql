-- UI-7R2: participant-scoped approval read contract.
-- Browser mutations remain service-controlled through privileged-action.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';

create schema if not exists ui7_approval_private;
revoke all on schema ui7_approval_private from public, anon, authenticated, service_role;
grant usage on schema ui7_approval_private to authenticated;

create or replace function ui7_approval_private.can_read_approval_request(
  p_approval_request_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public, ui7_approval_private, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_organization_id uuid;
  v_request public.approval_requests%rowtype;
begin
  if v_actor_id is null
    or public.patch83u_credential_access_allowed() is distinct from true
  then
    return false;
  end if;

  select p.organization_id
  into v_actor_organization_id
  from public.profiles p
  where p.id = v_actor_id
    and p.is_active = true
    and p.user_status = 'active';

  if v_actor_organization_id is null then
    return false;
  end if;

  select ar.*
  into v_request
  from public.approval_requests ar
  where ar.id = p_approval_request_id;

  if not found
    or v_request.organization_id is distinct from v_actor_organization_id
    or v_request.organization_id::text is distinct from coalesce(
      auth.jwt() ->> 'organization_id',
      auth.jwt() -> 'app_metadata' ->> 'organization_id'
    )
  then
    return false;
  end if;

  if exists (
    select 1
    from public.user_roles ur
    where ur.user_id = v_actor_id
      and ur.is_active = true
      and ur.scope::text = 'global'
      and ur.role::text in ('super_admin', 'governance_admin')
      and (ur.organization_id is null or ur.organization_id = v_request.organization_id)
  ) then
    return true;
  end if;

  if v_request.requested_by = v_actor_id
    or v_request.escalated_to = v_actor_id
    or v_request.final_decision_by = v_actor_id
    or exists (
      select 1
      from public.approval_decisions ad
      where ad.approval_request_id = v_request.id
        and ad.approver_id = v_actor_id
    )
    or exists (
      select 1
      from public.approval_request_stages ars
      where ars.approval_request_id = v_request.id
        and ars.assigned_user_id = v_actor_id
    )
  then
    return true;
  end if;

  if v_request.request_status in ('pending', 'partially_approved', 'escalated')
    and exists (
      select 1
      from public.approval_request_stages ars
      where ars.approval_request_id = v_request.id
        and ars.stage_status = 'in_progress'
        and (
          (
            ars.assigned_role is not null
            and exists (
              select 1
              from public.user_roles ur
              where ur.user_id = v_actor_id
                and ur.is_active = true
                and ur.role::text = ars.assigned_role
                and (ur.organization_id is null or ur.organization_id = v_request.organization_id)
            )
          )
          or exists (
            select 1
            from public.approval_delegations d
            where d.organization_id = v_request.organization_id
              and d.delegate_id = v_actor_id
              and d.active_flag = true
              and d.effective_from <= statement_timestamp()
              and d.effective_to >= statement_timestamp()
              and (d.workflow_type is null or d.workflow_type = v_request.workflow_type)
              and (d.action_type is null or d.action_type = v_request.action_type)
              and (d.department_id is null or d.department_id is not distinct from v_request.department_id)
              and (
                d.delegator_id = ars.assigned_user_id
                or (
                  ars.assigned_role is not null
                  and exists (
                    select 1
                    from public.user_roles delegator_role
                    where delegator_role.user_id = d.delegator_id
                      and delegator_role.is_active = true
                      and delegator_role.role::text = ars.assigned_role
                      and (
                        delegator_role.organization_id is null
                        or delegator_role.organization_id = v_request.organization_id
                      )
                  )
                )
              )
          )
        )
    )
  then
    return true;
  end if;

  if v_request.request_status in ('pending', 'partially_approved', 'escalated')
    and not exists (
      select 1
      from public.approval_request_stages ars
      where ars.approval_request_id = v_request.id
    )
    and exists (
      select 1
      from public.approval_authority_rules aar
      where aar.id = v_request.authority_rule_id
        and aar.organization_id = v_request.organization_id
        and aar.active_flag = true
        and (aar.effective_date is null or aar.effective_date <= current_date)
        and (aar.expiry_date is null or aar.expiry_date >= current_date)
        and (
          aar.approver_user_id = v_actor_id
          or (
            aar.approver_role is not null
            and exists (
              select 1
              from public.user_roles ur
              where ur.user_id = v_actor_id
                and ur.is_active = true
                and ur.role::text = aar.approver_role
                and (ur.organization_id is null or ur.organization_id = v_request.organization_id)
            )
          )
          or exists (
            select 1
            from public.approval_delegations d
            where d.organization_id = v_request.organization_id
              and d.delegate_id = v_actor_id
              and d.active_flag = true
              and d.effective_from <= statement_timestamp()
              and d.effective_to >= statement_timestamp()
              and (d.workflow_type is null or d.workflow_type = v_request.workflow_type)
              and (d.action_type is null or d.action_type = v_request.action_type)
              and (d.department_id is null or d.department_id is not distinct from v_request.department_id)
              and (
                d.delegator_id = aar.approver_user_id
                or (
                  aar.approver_role is not null
                  and exists (
                    select 1
                    from public.user_roles delegator_role
                    where delegator_role.user_id = d.delegator_id
                      and delegator_role.is_active = true
                      and delegator_role.role::text = aar.approver_role
                      and (
                        delegator_role.organization_id is null
                        or delegator_role.organization_id = v_request.organization_id
                      )
                  )
                )
              )
          )
        )
    )
  then
    return true;
  end if;

  return false;
end;
$$;

create or replace function ui7_approval_private.can_read_approval_delegation(
  p_approval_delegation_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public, ui7_approval_private, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_organization_id uuid;
  v_delegation public.approval_delegations%rowtype;
begin
  if v_actor_id is null
    or public.patch83u_credential_access_allowed() is distinct from true
  then
    return false;
  end if;

  select p.organization_id
  into v_actor_organization_id
  from public.profiles p
  where p.id = v_actor_id
    and p.is_active = true
    and p.user_status = 'active';

  select d.*
  into v_delegation
  from public.approval_delegations d
  where d.id = p_approval_delegation_id;

  if v_actor_organization_id is null
    or not found
    or v_delegation.organization_id is distinct from v_actor_organization_id
    or v_delegation.organization_id::text is distinct from coalesce(
      auth.jwt() ->> 'organization_id',
      auth.jwt() -> 'app_metadata' ->> 'organization_id'
    )
  then
    return false;
  end if;

  return v_delegation.delegator_id = v_actor_id
    or v_delegation.delegate_id = v_actor_id
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = v_actor_id
        and ur.is_active = true
        and ur.scope::text = 'global'
        and ur.role::text in ('super_admin', 'governance_admin')
        and (ur.organization_id is null or ur.organization_id = v_delegation.organization_id)
    );
end;
$$;

create or replace function ui7_approval_private.can_read_approval_authority_rule(
  p_approval_authority_rule_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public, ui7_approval_private, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_organization_id uuid;
  v_rule_organization_id uuid;
begin
  if v_actor_id is null
    or public.patch83u_credential_access_allowed() is distinct from true
  then
    return false;
  end if;

  select p.organization_id
  into v_actor_organization_id
  from public.profiles p
  where p.id = v_actor_id
    and p.is_active = true
    and p.user_status = 'active';

  select aar.organization_id
  into v_rule_organization_id
  from public.approval_authority_rules aar
  where aar.id = p_approval_authority_rule_id;

  if v_actor_organization_id is null
    or v_rule_organization_id is null
    or v_rule_organization_id is distinct from v_actor_organization_id
    or v_rule_organization_id::text is distinct from coalesce(
      auth.jwt() ->> 'organization_id',
      auth.jwt() -> 'app_metadata' ->> 'organization_id'
    )
  then
    return false;
  end if;

  if exists (
    select 1
    from public.user_roles ur
    where ur.user_id = v_actor_id
      and ur.is_active = true
      and ur.scope::text = 'global'
      and ur.role::text in ('super_admin', 'governance_admin')
      and (ur.organization_id is null or ur.organization_id = v_rule_organization_id)
  ) then
    return true;
  end if;

  return exists (
    select 1
    from public.approval_requests ar
    where ar.authority_rule_id = p_approval_authority_rule_id
      and ui7_approval_private.can_read_approval_request(ar.id)
  );
end;
$$;

revoke all on function ui7_approval_private.can_read_approval_request(uuid)
from public, anon, authenticated, service_role;
revoke all on function ui7_approval_private.can_read_approval_delegation(uuid)
from public, anon, authenticated, service_role;
revoke all on function ui7_approval_private.can_read_approval_authority_rule(uuid)
from public, anon, authenticated, service_role;

grant execute on function ui7_approval_private.can_read_approval_request(uuid)
to authenticated;
grant execute on function ui7_approval_private.can_read_approval_delegation(uuid)
to authenticated;
grant execute on function ui7_approval_private.can_read_approval_authority_rule(uuid)
to authenticated;

drop policy if exists ui7_approval_requests_participant_select on public.approval_requests;
create policy ui7_approval_requests_participant_select
on public.approval_requests
as restrictive
for select
to authenticated
using (ui7_approval_private.can_read_approval_request(id));

drop policy if exists ui7_approval_request_stages_participant_select on public.approval_request_stages;
create policy ui7_approval_request_stages_participant_select
on public.approval_request_stages
as restrictive
for select
to authenticated
using (ui7_approval_private.can_read_approval_request(approval_request_id));

drop policy if exists ui7_approval_decisions_participant_select on public.approval_decisions;
create policy ui7_approval_decisions_participant_select
on public.approval_decisions
as restrictive
for select
to authenticated
using (ui7_approval_private.can_read_approval_request(approval_request_id));

drop policy if exists ui7_approval_delegations_participant_select on public.approval_delegations;
create policy ui7_approval_delegations_participant_select
on public.approval_delegations
as restrictive
for select
to authenticated
using (ui7_approval_private.can_read_approval_delegation(id));

drop policy if exists ui7_approval_authority_rules_participant_select on public.approval_authority_rules;
create policy ui7_approval_authority_rules_participant_select
on public.approval_authority_rules
as restrictive
for select
to authenticated
using (ui7_approval_private.can_read_approval_authority_rule(id));

revoke all privileges on table
  public.approval_requests,
  public.approval_request_stages,
  public.approval_decisions,
  public.approval_delegations,
  public.approval_authority_rules
from anon;

revoke all privileges on table
  public.approval_requests,
  public.approval_request_stages,
  public.approval_decisions,
  public.approval_delegations,
  public.approval_authority_rules
from public;

revoke all privileges on table
  public.approval_requests,
  public.approval_request_stages,
  public.approval_decisions,
  public.approval_delegations,
  public.approval_authority_rules
from authenticated;

grant select on table
  public.approval_requests,
  public.approval_request_stages,
  public.approval_decisions,
  public.approval_delegations,
  public.approval_authority_rules
to authenticated;

commit;
