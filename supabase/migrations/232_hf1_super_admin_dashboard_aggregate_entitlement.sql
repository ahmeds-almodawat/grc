begin;

create or replace function ovr_v11_private.executive_actor_organization(
  p_actor_id uuid
)
returns uuid
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth, ovr_v11_private, pg_temp
as $$
declare
  v_org uuid;
  v_entitlement_count integer;
begin
  select p.organization_id into v_org
  from public.profiles p
  join public.user_credential_states cs
    on cs.user_id = p.id and cs.organization_id = p.organization_id
  join auth.users au on au.id = p.id
  where p.id = p_actor_id
    and p.organization_id is not null
    and p.is_active
    and p.user_status = 'active'
    and cs.credential_state = 'active'
    and cs.requested_lifecycle = 'active'
    and cs.identity_mode in ('legacy_verified', 'employee_id_managed')
    and lower(btrim(au.email)) = cs.auth_email
    and au.email_confirmed_at is not null
    and au.deleted_at is null
    and (au.banned_until is null or au.banned_until <= statement_timestamp())
    and public.patch83u_auth_credential_version(au.raw_app_meta_data) = cs.credential_version
    and 1 = (
      select count(*)
      from auth.identities ai
      where ai.user_id = au.id
        and ai.provider = 'email'
        and lower(btrim(coalesce(ai.identity_data ->> 'email', ai.email, ''))) = cs.auth_email
    );

  if v_org is null then
    raise exception using errcode = 'P0001', message = 'OVR_ANALYTICS_ACTIVE_ACTOR_REQUIRED';
  end if;

  select count(*)::integer into v_entitlement_count
  from public.user_roles ur
  where ur.user_id = p_actor_id
    and ur.role in ('executive', 'super_admin')
    and ur.scope = 'global'
    and ur.is_active
    and public.patch83u_role_assignment_valid(
      v_org, ur.scope, ur.organization_id,
      ur.division_id, ur.department_id, ur.unit_id
    );

  if v_entitlement_count < 1 then
    raise exception using errcode = 'P0001', message = 'OVR_ANALYTICS_DASHBOARD_ENTITLEMENT_REQUIRED';
  end if;
  return v_org;
end;
$$;

revoke all on function ovr_v11_private.executive_actor_organization(uuid)
  from public, anon, authenticated, service_role;

alter function ovr_v11_private.executive_actor_organization(uuid) owner to postgres;

comment on function ovr_v11_private.executive_actor_organization(uuid) is
  'Resolves an active Patch83U-governed actor to one organization for the fixed privacy-safe OVR dashboard aggregate. Requires an active global Executive or Super Admin assignment and grants no raw OVR access.';

commit;
