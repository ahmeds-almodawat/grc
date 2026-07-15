-- Patch 83T/83U release preflight.
--
-- This file is intentionally limited to catalog and data SELECT statements.
-- Run it with an explicitly authorized read-only database role that can inspect
-- auth.users and auth.identities. It does not change data or schema and does not acquire explicit
-- locks. The predictions below mirror the unapplied migration 174 backfill and
-- role-reference rules in this repository.

select
  'population_totals'::text as report_section,
  (select count(*)::bigint from public.profiles) as total_profiles,
  (select count(*)::bigint from auth.users) as total_auth_users,
  (select count(*)::bigint from auth.identities) as total_auth_identities;

select
  'profiles_without_matching_auth_users_summary'::text as report_section,
  count(*)::bigint as profiles_without_matching_auth_users
from public.profiles p
left join auth.users u on u.id = p.id
where u.id is null;

select
  'profiles_without_matching_auth_users_detail'::text as report_section,
  p.id as profile_id,
  p.organization_id,
  nullif(btrim(p.employee_no), '') as employee_id
from public.profiles p
left join auth.users u on u.id = p.id
where u.id is null
order by p.organization_id nulls last, p.id;

select
  'auth_email_health_summary'::text as report_section,
  count(*) filter (
    where nullif(btrim(u.email), '') is null
  )::bigint as auth_identities_with_missing_email,
  count(*) filter (
    where nullif(btrim(u.email), '') is not null
      and u.email_confirmed_at is null
  )::bigint as auth_identities_with_unconfirmed_email,
  count(*) filter (
    where p.id is not null
      and (
        nullif(btrim(u.email), '') is null
        or u.email_confirmed_at is null
      )
  )::bigint as profiles_with_missing_or_unconfirmed_auth_email
from auth.users u
left join public.profiles p on p.id = u.id;

select
  'auth_email_health_detail'::text as report_section,
  u.id as auth_user_id,
  p.id as profile_id,
  p.organization_id,
  case
    when nullif(btrim(u.email), '') is null then 'missing_email'
    when u.email_confirmed_at is null then 'unconfirmed_email'
  end as auth_email_finding
from auth.users u
left join public.profiles p on p.id = u.id
where nullif(btrim(u.email), '') is null
   or u.email_confirmed_at is null
order by p.organization_id nulls last, u.id;

with identity_prediction as (
  select
    p.id,
    p.organization_id,
    case
      -- Migration 174 intentionally classifies every verified pre-existing
      -- identity as legacy. employee_id_managed is established only by the
      -- controlled post-migration provisioning path.
      when u.id is not null
        and nullif(btrim(u.email), '') is not null
        and u.email_confirmed_at is not null
        then 'legacy_verified'
      else 'unverified'
    end as predicted_identity_mode,
    u.id is not null
      and u.email_confirmed_at is not null
      and nullif(btrim(p.employee_no), '') is not null
      and lower(btrim(u.email)) = lower(btrim(p.employee_no)) || '@almodawat.sa'
      as confirmed_exact_synthetic_alias
  from public.profiles p
  left join auth.users u on u.id = p.id
  where p.organization_id is not null
)
select
  'predicted_identity_modes'::text as report_section,
  count(*) filter (
    where predicted_identity_mode = 'legacy_verified'
  )::bigint as predicted_legacy_verified_count,
  count(*) filter (
    where predicted_identity_mode = 'employee_id_managed'
  )::bigint as predicted_employee_id_managed_count,
  count(*) filter (
    where predicted_identity_mode = 'unverified'
  )::bigint as predicted_unverified_count,
  count(*) filter (
    where confirmed_exact_synthetic_alias
  )::bigint as confirmed_exact_synthetic_alias_profiles
from identity_prediction;

with active_profile_prediction as (
  select
    p.id as profile_id,
    p.organization_id,
    p.employee_no,
    u.id as auth_user_id,
    u.email as auth_email,
    u.email_confirmed_at,
    case
      when u.raw_app_meta_data is null then true
      when jsonb_typeof(u.raw_app_meta_data) = 'object'
        and not (u.raw_app_meta_data ? 'credential_version') then true
      when jsonb_typeof(u.raw_app_meta_data) = 'object'
        and coalesce(u.raw_app_meta_data ->> 'credential_version', '') ~ '^0+$' then true
      else false
    end as has_legacy_credential_version
  from public.profiles p
  left join auth.users u on u.id = p.id
  where p.organization_id is not null
    and p.is_active = true
    and p.user_status = 'active'
), reconciliation_prediction as (
  select
    a.*,
    case
      when a.auth_user_id is null then 'missing_auth_user'
      when nullif(btrim(a.auth_email), '') is null then 'missing_auth_email'
      when a.email_confirmed_at is null then 'unconfirmed_auth_email'
      when not a.has_legacy_credential_version then 'credential_version_not_legacy_zero'
    end as reconciliation_reason
  from active_profile_prediction a
  where a.auth_user_id is null
     or nullif(btrim(a.auth_email), '') is null
     or a.email_confirmed_at is null
     or not a.has_legacy_credential_version
)
select
  'predicted_active_reconciliation_summary'::text as report_section,
  count(*)::bigint as active_users_predicted_reconciliation_required
from reconciliation_prediction;

with active_profile_prediction as (
  select
    p.id as profile_id,
    p.organization_id,
    p.employee_no,
    u.id as auth_user_id,
    u.email as auth_email,
    u.email_confirmed_at,
    case
      when u.raw_app_meta_data is null then true
      when jsonb_typeof(u.raw_app_meta_data) = 'object'
        and not (u.raw_app_meta_data ? 'credential_version') then true
      when jsonb_typeof(u.raw_app_meta_data) = 'object'
        and coalesce(u.raw_app_meta_data ->> 'credential_version', '') ~ '^0+$' then true
      else false
    end as has_legacy_credential_version
  from public.profiles p
  left join auth.users u on u.id = p.id
  where p.organization_id is not null
    and p.is_active = true
    and p.user_status = 'active'
)
select
  'predicted_active_reconciliation_detail'::text as report_section,
  a.profile_id,
  a.organization_id,
  nullif(btrim(a.employee_no), '') as employee_id,
  case
    when a.auth_user_id is null then 'missing_auth_user'
    when nullif(btrim(a.auth_email), '') is null then 'missing_auth_email'
    when a.email_confirmed_at is null then 'unconfirmed_auth_email'
    when not a.has_legacy_credential_version then 'credential_version_not_legacy_zero'
  end as reconciliation_reason
from active_profile_prediction a
where a.auth_user_id is null
   or nullif(btrim(a.auth_email), '') is null
   or a.email_confirmed_at is null
   or not a.has_legacy_credential_version
order by a.organization_id, a.profile_id;

with active_role_shape as (
  select
    ur.id as user_role_id,
    ur.user_id,
    p.organization_id as profile_organization_id,
    ur.role,
    ur.scope,
    ur.organization_id as role_organization_id,
    ur.division_id,
    ur.department_id,
    ur.unit_id,
    case
      when p.organization_id is null then false
      when ur.scope = 'global' then
        (ur.organization_id is null or ur.organization_id = p.organization_id)
        and ur.division_id is null
        and ur.department_id is null
        and ur.unit_id is null
      when ur.organization_id is distinct from p.organization_id then false
      when ur.scope = 'division' then
        ur.division_id is not null
        and ur.department_id is null
        and ur.unit_id is null
        and exists (
          select 1
          from public.divisions d
          where d.id = ur.division_id
            and d.organization_id = p.organization_id
            and d.is_active = true
        )
      when ur.scope = 'department' then
        ur.department_id is not null
        and ur.unit_id is null
        and exists (
          select 1
          from public.departments d
          where d.id = ur.department_id
            and d.organization_id = p.organization_id
            and d.is_active = true
            and d.archived_at is null
            and (ur.division_id is null or d.division_id = ur.division_id)
        )
      when ur.scope = 'unit' then
        ur.unit_id is not null
        and ur.department_id is not null
        and exists (
          select 1
          from public.units u
          join public.departments d on d.id = u.department_id
          where u.id = ur.unit_id
            and u.organization_id = p.organization_id
            and u.is_active = true
            and d.id = ur.department_id
            and d.organization_id = p.organization_id
            and d.is_active = true
            and d.archived_at is null
            and (ur.division_id is null or d.division_id = ur.division_id)
        )
      when ur.scope = 'assigned_only' then
        ur.division_id is null
        and ur.department_id is null
        and ur.unit_id is null
      else false
    end as reference_shape_valid
  from public.user_roles ur
  join public.profiles p on p.id = ur.user_id
  where ur.is_active = true
)
select
  'invalid_active_role_shape_summary'::text as report_section,
  count(*) filter (where not reference_shape_valid)::bigint
    as active_roles_with_invalid_tenant_or_hierarchy_shape
from active_role_shape;

with active_role_shape as (
  select
    ur.id as user_role_id,
    ur.user_id,
    p.organization_id as profile_organization_id,
    ur.role,
    ur.scope,
    ur.organization_id as role_organization_id,
    ur.division_id,
    ur.department_id,
    ur.unit_id,
    case
      when p.organization_id is null then false
      when ur.scope = 'global' then
        (ur.organization_id is null or ur.organization_id = p.organization_id)
        and ur.division_id is null
        and ur.department_id is null
        and ur.unit_id is null
      when ur.organization_id is distinct from p.organization_id then false
      when ur.scope = 'division' then
        ur.division_id is not null
        and ur.department_id is null
        and ur.unit_id is null
        and exists (
          select 1 from public.divisions d
          where d.id = ur.division_id
            and d.organization_id = p.organization_id
            and d.is_active = true
        )
      when ur.scope = 'department' then
        ur.department_id is not null
        and ur.unit_id is null
        and exists (
          select 1 from public.departments d
          where d.id = ur.department_id
            and d.organization_id = p.organization_id
            and d.is_active = true
            and d.archived_at is null
            and (ur.division_id is null or d.division_id = ur.division_id)
        )
      when ur.scope = 'unit' then
        ur.unit_id is not null
        and ur.department_id is not null
        and exists (
          select 1
          from public.units u
          join public.departments d on d.id = u.department_id
          where u.id = ur.unit_id
            and u.organization_id = p.organization_id
            and u.is_active = true
            and d.id = ur.department_id
            and d.organization_id = p.organization_id
            and d.is_active = true
            and d.archived_at is null
            and (ur.division_id is null or d.division_id = ur.division_id)
        )
      when ur.scope = 'assigned_only' then
        ur.division_id is null
        and ur.department_id is null
        and ur.unit_id is null
      else false
    end as reference_shape_valid
  from public.user_roles ur
  join public.profiles p on p.id = ur.user_id
  where ur.is_active = true
)
select
  'invalid_active_role_shape_detail'::text as report_section,
  r.user_role_id,
  r.user_id,
  r.profile_organization_id,
  r.role,
  r.scope,
  r.role_organization_id,
  r.division_id,
  r.department_id,
  r.unit_id
from active_role_shape r
where not r.reference_shape_valid
order by r.profile_organization_id nulls last, r.user_id, r.user_role_id;

with predicted_credential_identity as (
  select
    p.id as profile_id,
    p.organization_id,
    p.is_active,
    p.user_status,
    u.id as auth_user_id,
    u.email as auth_email,
    u.email_confirmed_at,
    case
      when u.raw_app_meta_data is null then true
      when jsonb_typeof(u.raw_app_meta_data) = 'object'
        and not (u.raw_app_meta_data ? 'credential_version') then true
      when jsonb_typeof(u.raw_app_meta_data) = 'object'
        and coalesce(u.raw_app_meta_data ->> 'credential_version', '') ~ '^0+$' then true
      else false
    end as has_legacy_credential_version
  from public.profiles p
  left join auth.users u on u.id = p.id
)
select
  'active_roles_without_valid_credential_identity_summary'::text as report_section,
  count(*)::bigint as active_roles_without_valid_credential_identity
from public.user_roles ur
join predicted_credential_identity c on c.profile_id = ur.user_id
where ur.is_active = true
  and not (
    c.organization_id is not null
    and c.is_active = true
    and c.user_status = 'active'
    and c.auth_user_id is not null
    and nullif(btrim(c.auth_email), '') is not null
    and c.email_confirmed_at is not null
    and c.has_legacy_credential_version
  );

with predicted_credential_identity as (
  select
    p.id as profile_id,
    p.organization_id,
    p.is_active,
    p.user_status,
    u.id as auth_user_id,
    u.email as auth_email,
    u.email_confirmed_at,
    case
      when u.raw_app_meta_data is null then true
      when jsonb_typeof(u.raw_app_meta_data) = 'object'
        and not (u.raw_app_meta_data ? 'credential_version') then true
      when jsonb_typeof(u.raw_app_meta_data) = 'object'
        and coalesce(u.raw_app_meta_data ->> 'credential_version', '') ~ '^0+$' then true
      else false
    end as has_legacy_credential_version
  from public.profiles p
  left join auth.users u on u.id = p.id
)
select
  'active_roles_without_valid_credential_identity_detail'::text as report_section,
  ur.id as user_role_id,
  ur.user_id,
  c.organization_id,
  case
    when c.organization_id is null then 'missing_profile_organization'
    when c.is_active = false or c.user_status <> 'active' then 'inactive_profile_lifecycle'
    when c.auth_user_id is null then 'missing_auth_user'
    when nullif(btrim(c.auth_email), '') is null then 'missing_auth_email'
    when c.email_confirmed_at is null then 'unconfirmed_auth_email'
    when not c.has_legacy_credential_version then 'credential_version_not_legacy_zero'
  end as credential_identity_finding
from public.user_roles ur
join predicted_credential_identity c on c.profile_id = ur.user_id
where ur.is_active = true
  and not (
    c.organization_id is not null
    and c.is_active = true
    and c.user_status = 'active'
    and c.auth_user_id is not null
    and nullif(btrim(c.auth_email), '') is not null
    and c.email_confirmed_at is not null
    and c.has_legacy_credential_version
  )
order by c.organization_id nulls last, ur.user_id, ur.id;

with super_admin_candidates as (
  select
    p.organization_id,
    ur.user_id,
    p.is_active = true
      and p.user_status = 'active'
      and (
        ur.organization_id is null
        or ur.organization_id = p.organization_id
      )
      and ur.division_id is null
      and ur.department_id is null
      and ur.unit_id is null
      as current_lifecycle_and_shape_valid,
    u.id is not null
      and nullif(btrim(u.email), '') is not null
      and u.email_confirmed_at is not null
      and case
        when u.raw_app_meta_data is null then true
        when jsonb_typeof(u.raw_app_meta_data) = 'object'
          and not (u.raw_app_meta_data ? 'credential_version') then true
        when jsonb_typeof(u.raw_app_meta_data) = 'object'
          and coalesce(u.raw_app_meta_data ->> 'credential_version', '') ~ '^0+$' then true
        else false
      end as predicted_credential_active
  from public.user_roles ur
  join public.profiles p on p.id = ur.user_id
  left join auth.users u on u.id = p.id
  where ur.is_active = true
    and ur.role = 'super_admin'
    and ur.scope = 'global'
    and p.organization_id is not null
), super_admin_by_org as (
  select
    o.id as organization_id,
    count(distinct s.user_id) filter (
      where s.current_lifecycle_and_shape_valid
    )::bigint as current_active_global_super_admin_count,
    count(distinct s.user_id) filter (
      where s.current_lifecycle_and_shape_valid
        and s.predicted_credential_active
    )::bigint as predicted_eligible_global_super_admin_count
  from public.organizations o
  left join super_admin_candidates s on s.organization_id = o.id
  group by o.id
)
select
  'eligible_global_super_admins_by_organization'::text as report_section,
  organization_id,
  current_active_global_super_admin_count,
  predicted_eligible_global_super_admin_count,
  current_active_global_super_admin_count > 0
    and predicted_eligible_global_super_admin_count = 0
    as would_lose_last_eligible_super_admin
from super_admin_by_org
order by organization_id;

with super_admin_candidates as (
  select
    p.organization_id,
    ur.user_id,
    p.is_active = true
      and p.user_status = 'active'
      and (ur.organization_id is null or ur.organization_id = p.organization_id)
      and ur.division_id is null
      and ur.department_id is null
      and ur.unit_id is null
      as current_lifecycle_and_shape_valid,
    u.id is not null
      and nullif(btrim(u.email), '') is not null
      and u.email_confirmed_at is not null
      and case
        when u.raw_app_meta_data is null then true
        when jsonb_typeof(u.raw_app_meta_data) = 'object'
          and not (u.raw_app_meta_data ? 'credential_version') then true
        when jsonb_typeof(u.raw_app_meta_data) = 'object'
          and coalesce(u.raw_app_meta_data ->> 'credential_version', '') ~ '^0+$' then true
        else false
      end as predicted_credential_active
  from public.user_roles ur
  join public.profiles p on p.id = ur.user_id
  left join auth.users u on u.id = p.id
  where ur.is_active = true
    and ur.role = 'super_admin'
    and ur.scope = 'global'
    and p.organization_id is not null
), super_admin_by_org as (
  select
    o.id as organization_id,
    count(distinct s.user_id) filter (
      where s.current_lifecycle_and_shape_valid
    )::bigint as current_active_global_super_admin_count,
    count(distinct s.user_id) filter (
      where s.current_lifecycle_and_shape_valid
        and s.predicted_credential_active
    )::bigint as predicted_eligible_global_super_admin_count
  from public.organizations o
  left join super_admin_candidates s on s.organization_id = o.id
  group by o.id
)
select
  'organizations_losing_last_eligible_super_admin'::text as report_section,
  organization_id,
  current_active_global_super_admin_count,
  predicted_eligible_global_super_admin_count
from super_admin_by_org
where current_active_global_super_admin_count > 0
  and predicted_eligible_global_super_admin_count = 0
order by organization_id;

with normalized_employee_ids as (
  select
    lower(btrim(p.employee_no)) as normalized_employee_id,
    p.id as profile_id,
    p.organization_id
  from public.profiles p
  where nullif(btrim(p.employee_no), '') is not null
)
select
  'case_insensitive_employee_id_collisions'::text as report_section,
  normalized_employee_id,
  count(*)::bigint as profile_count,
  array_agg(profile_id order by profile_id) as profile_ids,
  array_agg(distinct organization_id) filter (
    where organization_id is not null
  ) as organization_ids
from normalized_employee_ids
group by normalized_employee_id
having count(*) > 1
order by normalized_employee_id;

with synthetic_aliases as (
  select
    lower(btrim(p.employee_no)) || '@almodawat.sa' as synthetic_auth_email,
    p.id as profile_id,
    p.organization_id
  from public.profiles p
  where nullif(btrim(p.employee_no), '') is not null
), alias_groups as (
  select
    synthetic_auth_email,
    count(*)::bigint as profile_count,
    array_agg(profile_id order by profile_id) as profile_ids,
    array_agg(distinct organization_id) filter (
      where organization_id is not null
    ) as organization_ids
  from synthetic_aliases
  group by synthetic_auth_email
), alias_findings as (
  select
    g.*,
    coalesce((
      select count(*)::bigint
      from auth.users u
      where lower(btrim(u.email)) = g.synthetic_auth_email
        and u.id <> all(g.profile_ids)
    ), 0::bigint) as conflicting_auth_identity_count,
    coalesce((
      select array_agg(u.id order by u.id)
      from auth.users u
      where lower(btrim(u.email)) = g.synthetic_auth_email
        and u.id <> all(g.profile_ids)
    ), array[]::uuid[]) as conflicting_auth_user_ids
  from alias_groups g
)
select
  'synthetic_auth_email_collisions'::text as report_section,
  synthetic_auth_email,
  profile_count,
  profile_ids,
  organization_ids,
  conflicting_auth_identity_count,
  conflicting_auth_user_ids
from alias_findings
where profile_count > 1
   or conflicting_auth_identity_count > 0
order by synthetic_auth_email;

select
  'rls_enabled_public_tables'::text as report_section,
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced,
  pg_get_userbyid(c.relowner) as table_owner
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'p')
  and c.relrowsecurity = true
order by c.relname;

select
  'authenticated_executable_rpcs'::text as report_section,
  n.nspname as schema_name,
  p.proname as routine_name,
  p.oid::regprocedure::text as routine_signature,
  case p.prokind when 'p' then 'procedure' else 'function' end as routine_kind,
  p.prosecdef as security_definer,
  pg_get_userbyid(p.proowner) as routine_owner,
  case when acl.grantee = 0 then 'PUBLIC' else 'authenticated' end as grant_via,
  acl.is_grantable
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
cross join lateral aclexplode(
  coalesce(p.proacl, acldefault('f', p.proowner))
) acl
where n.nspname = 'public'
  and acl.privilege_type = 'EXECUTE'
  and (
    acl.grantee = 0
    or acl.grantee = (select oid from pg_roles where rolname = 'authenticated')
  )
order by p.proname, p.oid::regprocedure::text, grant_via;

select
  'authenticated_selectable_views'::text as report_section,
  n.nspname as schema_name,
  c.relname as view_name,
  case c.relkind when 'm' then 'materialized_view' else 'view' end as view_kind,
  coalesce(c.reloptions, array[]::text[]) @> array['security_invoker=true']
    as security_invoker,
  pg_get_userbyid(c.relowner) as view_owner,
  owner_role.rolsuper as owner_is_superuser,
  owner_role.rolbypassrls as owner_bypasses_rls,
  case when acl.grantee = 0 then 'PUBLIC' else 'authenticated' end as grant_via,
  acl.is_grantable
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
join pg_roles owner_role on owner_role.oid = c.relowner
cross join lateral aclexplode(c.relacl) acl
where n.nspname = 'public'
  and c.relkind in ('v', 'm')
  and acl.privilege_type = 'SELECT'
  and (
    acl.grantee = 0
    or acl.grantee = (select oid from pg_roles where rolname = 'authenticated')
  )
order by c.relname, grant_via;

with credential_prediction as (
  select
    p.id as profile_id,
    case
      when p.user_status = 'active'
        and p.is_active = true
        and u.id is not null
        and nullif(btrim(u.email), '') is not null
        and u.email_confirmed_at is not null
        and case
          when u.raw_app_meta_data is null then true
          when jsonb_typeof(u.raw_app_meta_data) = 'object'
            and not (u.raw_app_meta_data ? 'credential_version') then true
          when jsonb_typeof(u.raw_app_meta_data) = 'object'
            and coalesce(u.raw_app_meta_data ->> 'credential_version', '') ~ '^0+$' then true
          else false
        end
        then 'active'
      when p.user_status = 'active' and p.is_active = true
        then 'reconciliation_required'
      when p.user_status = 'invited' then 'reconciliation_required'
      else 'disabled'
    end as predicted_credential_state
  from public.profiles p
  left join auth.users u on u.id = p.id
  where p.organization_id is not null
), estimates as (
  select
    (select count(*)::bigint from credential_prediction)
      as credential_state_backfill_rows,
    (select count(*)::bigint from credential_prediction)
      as credential_event_backfill_rows,
    (select count(*)::bigint from credential_prediction
      where predicted_credential_state <> 'active')
      as credential_state_guard_recheck_rows,
    (select count(*)::bigint
      from public.user_roles ur
      join credential_prediction c on c.profile_id = ur.user_id
      where ur.is_active = true
        and c.predicted_credential_state <> 'active')
      as predicted_role_suspension_rows,
    (select count(distinct ur.user_id)::bigint
      from public.user_roles ur
      join credential_prediction c on c.profile_id = ur.user_id
      where ur.is_active = true
        and c.predicted_credential_state <> 'active')
      as predicted_role_suspension_event_rows,
    (select count(*)::bigint
      from public.user_roles ur
      where ur.is_active = true
        and not exists (
          select 1
          from credential_prediction c
          where c.profile_id = ur.user_id
            and c.predicted_credential_state <> 'active'
        ))
      as active_role_guard_recheck_rows_after_suspension
)
select
  'estimated_rows_touched_by_migration_174'::text as report_section,
  credential_state_backfill_rows,
  credential_event_backfill_rows,
  credential_state_guard_recheck_rows,
  predicted_role_suspension_rows,
  predicted_role_suspension_rows as predicted_suspended_role_snapshot_rows,
  predicted_role_suspension_rows as predicted_role_change_audit_rows,
  predicted_role_suspension_event_rows,
  active_role_guard_recheck_rows_after_suspension,
  (
    credential_state_backfill_rows
    + credential_event_backfill_rows
    + credential_state_guard_recheck_rows
    + (predicted_role_suspension_rows * 3)
    + predicted_role_suspension_event_rows
    + active_role_guard_recheck_rows_after_suspension
  )::bigint as estimated_total_rows_touched
from estimates;
