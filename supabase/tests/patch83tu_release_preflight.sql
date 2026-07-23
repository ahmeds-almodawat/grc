-- Patch 83T/83U release preflight.
--
-- This file is intentionally limited to catalog and data SELECT statements.
-- Run it with an explicitly authorized read-only database role that can inspect
-- auth.users, auth.identities, auth.sessions, and Supabase migration history. It
-- does not change data or schema and does not acquire explicit locks. It never
-- reads an Auth password verifier or password value. The predictions mirror the
-- migration 174.2 authenticate-first backfill and runtime-enforcement rules.
--
-- The catalog checks intentionally keep this preflight runnable before and
-- after migrations 174 through 176. Missing protected relations or Patch 83U
-- recovery routines are reported as blockers instead of being invoked.

select
  'population_totals'::text as report_section,
  (select count(*)::bigint from public.profiles) as total_profiles,
  (select count(*)::bigint from auth.users) as total_auth_users,
  (select count(*)::bigint from auth.identities) as total_auth_identities,
  (select count(*)::bigint from auth.sessions) as total_auth_session_rows;

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

with auth_email_identity_health as (
  select
    u.id as auth_user_id,
    u.email,
    u.email_confirmed_at,
    u.banned_until,
    u.deleted_at,
    count(i.id) filter (
      where lower(i.provider) = 'email'
    )::bigint as email_provider_identity_count,
    count(i.id) filter (
      where lower(i.provider) = 'email'
        and nullif(btrim(i.identity_data ->> 'email'), '') is not null
        and lower(btrim(i.identity_data ->> 'email')) = lower(btrim(u.email))
    )::bigint as matching_email_provider_identity_count
  from auth.users u
  left join auth.identities i on i.user_id = u.id
  group by
    u.id,
    u.email,
    u.email_confirmed_at,
    u.banned_until,
    u.deleted_at
)
select
  'auth_email_health_summary'::text as report_section,
  count(*) filter (
    where nullif(btrim(h.email), '') is null
  )::bigint as auth_identities_with_missing_email,
  count(*) filter (
    where nullif(btrim(h.email), '') is not null
      and h.email_confirmed_at is null
  )::bigint as auth_identities_with_unconfirmed_email,
  count(*) filter (
    where h.deleted_at is not null
  )::bigint as deleted_auth_users,
  count(*) filter (
    where h.banned_until is not null
      and h.banned_until > statement_timestamp()
  )::bigint as currently_banned_auth_users,
  count(*) filter (
    where nullif(btrim(h.email), '') is not null
      and h.email_provider_identity_count <> 1
  )::bigint as auth_users_without_exactly_one_email_provider_identity,
  count(*) filter (
    where nullif(btrim(h.email), '') is not null
      and h.matching_email_provider_identity_count <> 1
  )::bigint as auth_users_without_exactly_one_matching_email_identity,
  count(*) filter (
    where p.id is not null
      and (
        nullif(btrim(h.email), '') is null
        or h.email_confirmed_at is null
        or h.deleted_at is not null
        or (
          h.banned_until is not null
          and h.banned_until > statement_timestamp()
        )
        or h.email_provider_identity_count <> 1
        or h.matching_email_provider_identity_count <> 1
      )
  )::bigint as profiles_with_missing_or_unconfirmed_auth_email
from auth_email_identity_health h
left join public.profiles p on p.id = h.auth_user_id;

with auth_email_identity_health as (
  select
    u.id as auth_user_id,
    u.email,
    u.email_confirmed_at,
    u.banned_until,
    u.deleted_at,
    count(i.id) filter (
      where lower(i.provider) = 'email'
    )::bigint as email_provider_identity_count,
    count(i.id) filter (
      where lower(i.provider) = 'email'
        and nullif(btrim(i.identity_data ->> 'email'), '') is not null
        and lower(btrim(i.identity_data ->> 'email')) = lower(btrim(u.email))
    )::bigint as matching_email_provider_identity_count
  from auth.users u
  left join auth.identities i on i.user_id = u.id
  group by
    u.id,
    u.email,
    u.email_confirmed_at,
    u.banned_until,
    u.deleted_at
)
select
  'auth_email_health_detail'::text as report_section,
  h.auth_user_id,
  p.id as profile_id,
  p.organization_id,
  h.email_provider_identity_count,
  h.matching_email_provider_identity_count,
  case
    when nullif(btrim(h.email), '') is null then 'missing_email'
    when h.email_confirmed_at is null then 'unconfirmed_email'
    when h.deleted_at is not null then 'deleted_auth_user'
    when h.banned_until is not null
      and h.banned_until > statement_timestamp() then 'currently_banned_auth_user'
    when h.email_provider_identity_count = 0 then 'missing_email_provider_identity'
    when h.email_provider_identity_count > 1 then 'multiple_email_provider_identities'
    when h.matching_email_provider_identity_count = 0 then 'email_identity_mismatch'
    when h.matching_email_provider_identity_count > 1 then 'multiple_matching_email_identities'
  end as auth_email_finding
from auth_email_identity_health h
left join public.profiles p on p.id = h.auth_user_id
where nullif(btrim(h.email), '') is null
   or h.email_confirmed_at is null
   or h.deleted_at is not null
   or (h.banned_until is not null and h.banned_until > statement_timestamp())
   or h.email_provider_identity_count <> 1
   or h.matching_email_provider_identity_count <> 1
order by p.organization_id nulls last, h.auth_user_id;

with auth_email_identity_health as (
  select
    u.id as auth_user_id,
    u.email,
    u.email_confirmed_at,
    u.banned_until,
    u.deleted_at,
    count(i.id) filter (
      where lower(i.provider) = 'email'
    )::bigint as email_provider_identity_count,
    count(i.id) filter (
      where lower(i.provider) = 'email'
        and nullif(btrim(i.identity_data ->> 'email'), '') is not null
        and lower(btrim(i.identity_data ->> 'email')) = lower(btrim(u.email))
    )::bigint as matching_email_provider_identity_count
  from auth.users u
  left join auth.identities i on i.user_id = u.id
  group by
    u.id,
    u.email,
    u.email_confirmed_at,
    u.banned_until,
    u.deleted_at
), likely_existing_candidates as (
  select
    p.id as profile_id,
    p.organization_id,
    nullif(btrim(p.employee_no), '') as employee_id,
    h.email as auth_email,
    h.email_confirmed_at,
    h.email_provider_identity_count,
    h.matching_email_provider_identity_count,
    case
      when u.raw_app_meta_data is null then true
      when jsonb_typeof(u.raw_app_meta_data) = 'object'
        and not (u.raw_app_meta_data ? 'credential_version') then true
      when jsonb_typeof(u.raw_app_meta_data) = 'object'
        and coalesce(u.raw_app_meta_data ->> 'credential_version', '') ~ '^0+$' then true
      else false
    end as has_legacy_credential_version
  from public.profiles p
  join auth.users u on u.id = p.id
  join auth_email_identity_health h on h.auth_user_id = u.id
  where p.organization_id is not null
    and p.is_active = true
    and p.user_status = 'active'
    and nullif(btrim(h.email), '') is not null
    and h.email_confirmed_at is not null
    and h.deleted_at is null
    and (h.banned_until is null or h.banned_until <= statement_timestamp())
    and h.email_provider_identity_count = 1
    and h.matching_email_provider_identity_count = 1
)
select
  'likely_authenticatable_existing_users_summary'::text as report_section,
  count(*) filter (
    where has_legacy_credential_version
  )::bigint as likely_authenticatable_existing_user_count,
  count(*) filter (
    where has_legacy_credential_version and employee_id is null
  )::bigint as likely_authenticatable_existing_users_without_employee_id,
  count(*) filter (
    where not has_legacy_credential_version
  )::bigint as otherwise_safe_users_with_nonlegacy_credential_version,
  'inferred_from_safe_auth_records_without_inspecting_credentials'::text
    as authentication_likelihood_basis
from likely_existing_candidates;

with auth_email_identity_health as (
  select
    u.id as auth_user_id,
    u.email,
    u.email_confirmed_at,
    u.banned_until,
    u.deleted_at,
    count(i.id) filter (where lower(i.provider) = 'email')::bigint
      as email_provider_identity_count,
    count(i.id) filter (
      where lower(i.provider) = 'email'
        and nullif(btrim(i.identity_data ->> 'email'), '') is not null
        and lower(btrim(i.identity_data ->> 'email')) = lower(btrim(u.email))
    )::bigint as matching_email_provider_identity_count
  from auth.users u
  left join auth.identities i on i.user_id = u.id
  group by
    u.id,
    u.email,
    u.email_confirmed_at,
    u.banned_until,
    u.deleted_at
)
select
  'likely_authenticatable_existing_users_detail'::text as report_section,
  p.id as profile_id,
  p.organization_id,
  nullif(btrim(p.employee_no), '') as employee_id,
  h.email as preserved_auth_email,
  h.email_provider_identity_count,
  h.matching_email_provider_identity_count,
  'existing_password_rotation_pending'::text as predicted_credential_state,
  'candidate_only_no_credential_verifier_was_read'::text as proof_scope
from public.profiles p
join auth.users u on u.id = p.id
join auth_email_identity_health h on h.auth_user_id = u.id
where p.organization_id is not null
  and p.is_active = true
  and p.user_status = 'active'
  and nullif(btrim(h.email), '') is not null
  and h.email_confirmed_at is not null
  and h.deleted_at is null
  and (h.banned_until is null or h.banned_until <= statement_timestamp())
  and h.email_provider_identity_count = 1
  and h.matching_email_provider_identity_count = 1
  and (
    u.raw_app_meta_data is null
    or (
      jsonb_typeof(u.raw_app_meta_data) = 'object'
      and not (u.raw_app_meta_data ? 'credential_version')
    )
    or (
      jsonb_typeof(u.raw_app_meta_data) = 'object'
      and coalesce(u.raw_app_meta_data ->> 'credential_version', '') ~ '^0+$'
    )
  )
order by p.organization_id, p.id;

with auth_email_identity_health as (
  select
    u.id as auth_user_id,
    u.email,
    u.email_confirmed_at,
    u.banned_until,
    u.deleted_at,
    count(i.id) filter (where lower(i.provider) = 'email')::bigint
      as email_provider_identity_count,
    count(i.id) filter (
      where lower(i.provider) = 'email'
        and nullif(btrim(i.identity_data ->> 'email'), '') is not null
        and lower(btrim(i.identity_data ->> 'email')) = lower(btrim(u.email))
    )::bigint as matching_email_provider_identity_count
  from auth.users u
  left join auth.identities i on i.user_id = u.id
  group by
    u.id,
    u.email,
    u.email_confirmed_at,
    u.banned_until,
    u.deleted_at
), identity_prediction as (
  select
    p.id,
    p.organization_id,
    case
      -- Migration 174 intentionally classifies every verified pre-existing
      -- identity as legacy. employee_id_managed is established only by the
      -- controlled post-migration provisioning path.
      when h.auth_user_id is not null
        and nullif(btrim(h.email), '') is not null
        and h.email_confirmed_at is not null
        and h.deleted_at is null
        and (h.banned_until is null or h.banned_until <= statement_timestamp())
        and h.email_provider_identity_count = 1
        and h.matching_email_provider_identity_count = 1
        then 'legacy_verified'
      else 'unverified'
    end as predicted_identity_mode,
    h.auth_user_id is not null
      and h.email_confirmed_at is not null
      and nullif(btrim(p.employee_no), '') is not null
      and lower(btrim(h.email)) = lower(btrim(p.employee_no)) || '@almodawat.sa'
      as confirmed_exact_synthetic_alias
  from public.profiles p
  left join auth_email_identity_health h on h.auth_user_id = p.id
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

with auth_email_identity_health as (
  select
    u.id as auth_user_id,
    u.email,
    u.email_confirmed_at,
    u.banned_until,
    u.deleted_at,
    u.raw_app_meta_data,
    count(i.id) filter (where lower(i.provider) = 'email')::bigint
      as email_provider_identity_count,
    count(i.id) filter (
      where lower(i.provider) = 'email'
        and nullif(btrim(i.identity_data ->> 'email'), '') is not null
        and lower(btrim(i.identity_data ->> 'email')) = lower(btrim(u.email))
    )::bigint as matching_email_provider_identity_count
  from auth.users u
  left join auth.identities i on i.user_id = u.id
  group by
    u.id,
    u.email,
    u.email_confirmed_at,
    u.banned_until,
    u.deleted_at,
    u.raw_app_meta_data
), active_profile_prediction as (
  select
    p.id as profile_id,
    p.organization_id,
    p.employee_no,
    h.auth_user_id,
    h.email as auth_email,
    h.email_confirmed_at,
    h.banned_until,
    h.deleted_at,
    coalesce(h.email_provider_identity_count, 0) as email_provider_identity_count,
    coalesce(h.matching_email_provider_identity_count, 0)
      as matching_email_provider_identity_count,
    case
      when h.raw_app_meta_data is null then true
      when jsonb_typeof(h.raw_app_meta_data) = 'object'
        and not (h.raw_app_meta_data ? 'credential_version') then true
      when jsonb_typeof(h.raw_app_meta_data) = 'object'
        and coalesce(h.raw_app_meta_data ->> 'credential_version', '') ~ '^0+$' then true
      else false
    end as has_legacy_credential_version
  from public.profiles p
  left join auth_email_identity_health h on h.auth_user_id = p.id
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
      when a.deleted_at is not null then 'deleted_auth_user'
      when a.banned_until is not null
        and a.banned_until > statement_timestamp() then 'currently_banned_auth_user'
      when a.email_provider_identity_count = 0 then 'missing_email_provider_identity'
      when a.email_provider_identity_count > 1 then 'multiple_email_provider_identities'
      when a.matching_email_provider_identity_count = 0 then 'email_identity_mismatch'
      when a.matching_email_provider_identity_count > 1 then 'multiple_matching_email_identities'
      when not a.has_legacy_credential_version then 'credential_version_not_legacy_zero'
    end as reconciliation_reason
  from active_profile_prediction a
  where a.auth_user_id is null
     or nullif(btrim(a.auth_email), '') is null
     or a.email_confirmed_at is null
     or a.deleted_at is not null
     or (a.banned_until is not null and a.banned_until > statement_timestamp())
     or a.email_provider_identity_count <> 1
     or a.matching_email_provider_identity_count <> 1
     or not a.has_legacy_credential_version
)
select
  'predicted_active_reconciliation_summary'::text as report_section,
  count(*)::bigint as active_users_predicted_reconciliation_required
from reconciliation_prediction;

with auth_email_identity_health as (
  select
    u.id as auth_user_id,
    u.email,
    u.email_confirmed_at,
    u.banned_until,
    u.deleted_at,
    u.raw_app_meta_data,
    count(i.id) filter (where lower(i.provider) = 'email')::bigint
      as email_provider_identity_count,
    count(i.id) filter (
      where lower(i.provider) = 'email'
        and nullif(btrim(i.identity_data ->> 'email'), '') is not null
        and lower(btrim(i.identity_data ->> 'email')) = lower(btrim(u.email))
    )::bigint as matching_email_provider_identity_count
  from auth.users u
  left join auth.identities i on i.user_id = u.id
  group by
    u.id,
    u.email,
    u.email_confirmed_at,
    u.banned_until,
    u.deleted_at,
    u.raw_app_meta_data
), active_profile_prediction as (
  select
    p.id as profile_id,
    p.organization_id,
    p.employee_no,
    h.auth_user_id,
    h.email as auth_email,
    h.email_confirmed_at,
    h.banned_until,
    h.deleted_at,
    coalesce(h.email_provider_identity_count, 0) as email_provider_identity_count,
    coalesce(h.matching_email_provider_identity_count, 0)
      as matching_email_provider_identity_count,
    case
      when h.raw_app_meta_data is null then true
      when jsonb_typeof(h.raw_app_meta_data) = 'object'
        and not (h.raw_app_meta_data ? 'credential_version') then true
      when jsonb_typeof(h.raw_app_meta_data) = 'object'
        and coalesce(h.raw_app_meta_data ->> 'credential_version', '') ~ '^0+$' then true
      else false
    end as has_legacy_credential_version
  from public.profiles p
  left join auth_email_identity_health h on h.auth_user_id = p.id
  where p.organization_id is not null
    and p.is_active = true
    and p.user_status = 'active'
)
select
  'predicted_active_reconciliation_detail'::text as report_section,
  a.profile_id,
  a.organization_id,
  nullif(btrim(a.employee_no), '') as employee_id,
  a.email_provider_identity_count,
  a.matching_email_provider_identity_count,
  case
    when a.auth_user_id is null then 'missing_auth_user'
    when nullif(btrim(a.auth_email), '') is null then 'missing_auth_email'
    when a.email_confirmed_at is null then 'unconfirmed_auth_email'
    when a.deleted_at is not null then 'deleted_auth_user'
    when a.banned_until is not null
      and a.banned_until > statement_timestamp() then 'currently_banned_auth_user'
    when a.email_provider_identity_count = 0 then 'missing_email_provider_identity'
    when a.email_provider_identity_count > 1 then 'multiple_email_provider_identities'
    when a.matching_email_provider_identity_count = 0 then 'email_identity_mismatch'
    when a.matching_email_provider_identity_count > 1 then 'multiple_matching_email_identities'
    when not a.has_legacy_credential_version then 'credential_version_not_legacy_zero'
  end as reconciliation_reason,
  'reconciliation_required'::text as predicted_credential_state
from active_profile_prediction a
where a.auth_user_id is null
   or nullif(btrim(a.auth_email), '') is null
   or a.email_confirmed_at is null
   or a.deleted_at is not null
   or (a.banned_until is not null and a.banned_until > statement_timestamp())
   or a.email_provider_identity_count <> 1
   or a.matching_email_provider_identity_count <> 1
   or not a.has_legacy_credential_version
order by a.organization_id, a.profile_id;

with email_identity_counts as (
  select
    u.id as auth_user_id,
    count(i.id) filter (where lower(i.provider) = 'email')::bigint
      as email_provider_identity_count,
    count(i.id) filter (
      where lower(i.provider) = 'email'
        and nullif(btrim(i.identity_data ->> 'email'), '') is not null
        and lower(btrim(i.identity_data ->> 'email')) = lower(btrim(u.email))
    )::bigint as matching_email_provider_identity_count
  from auth.users u
  left join auth.identities i on i.user_id = u.id
  group by u.id
), rotation_prediction as (
  select
    p.id as profile_id,
    p.organization_id,
    nullif(btrim(p.employee_no), '') as employee_id,
    u.email as preserved_auth_email
  from public.profiles p
  join auth.users u on u.id = p.id
  join email_identity_counts e on e.auth_user_id = u.id
  where p.organization_id is not null
    and p.is_active = true
    and p.user_status = 'active'
    and nullif(btrim(u.email), '') is not null
    and u.email_confirmed_at is not null
    and u.deleted_at is null
    and (u.banned_until is null or u.banned_until <= statement_timestamp())
    and e.email_provider_identity_count = 1
    and e.matching_email_provider_identity_count = 1
    and (
      u.raw_app_meta_data is null
      or (
        jsonb_typeof(u.raw_app_meta_data) = 'object'
        and not (u.raw_app_meta_data ? 'credential_version')
      )
      or (
        jsonb_typeof(u.raw_app_meta_data) = 'object'
        and coalesce(u.raw_app_meta_data ->> 'credential_version', '') ~ '^0+$'
      )
    )
)
select
  'predicted_existing_password_rotation_summary'::text as report_section,
  count(*)::bigint as users_entering_existing_password_rotation,
  count(*) filter (where employee_id is null)::bigint
    as rotation_users_without_employee_id,
  'existing_password_rotation_pending'::text as migration_backfill_state,
  'existing_password_change_required'::text as enforced_lazy_transition_state
from rotation_prediction;

with email_identity_counts as (
  select
    u.id as auth_user_id,
    count(i.id) filter (where lower(i.provider) = 'email')::bigint
      as email_provider_identity_count,
    count(i.id) filter (
      where lower(i.provider) = 'email'
        and nullif(btrim(i.identity_data ->> 'email'), '') is not null
        and lower(btrim(i.identity_data ->> 'email')) = lower(btrim(u.email))
    )::bigint as matching_email_provider_identity_count
  from auth.users u
  left join auth.identities i on i.user_id = u.id
  group by u.id
)
select
  'predicted_existing_password_rotation_detail'::text as report_section,
  p.id as profile_id,
  p.organization_id,
  nullif(btrim(p.employee_no), '') as employee_id,
  u.email as preserved_auth_email,
  'existing_password_rotation_pending'::text as migration_backfill_state,
  'existing_password_change_required'::text as enforced_lazy_transition_state
from public.profiles p
join auth.users u on u.id = p.id
join email_identity_counts e on e.auth_user_id = u.id
where p.organization_id is not null
  and p.is_active = true
  and p.user_status = 'active'
  and nullif(btrim(u.email), '') is not null
  and u.email_confirmed_at is not null
  and u.deleted_at is null
  and (u.banned_until is null or u.banned_until <= statement_timestamp())
  and e.email_provider_identity_count = 1
  and e.matching_email_provider_identity_count = 1
  and (
    u.raw_app_meta_data is null
    or (
      jsonb_typeof(u.raw_app_meta_data) = 'object'
      and not (u.raw_app_meta_data ? 'credential_version')
    )
    or (
      jsonb_typeof(u.raw_app_meta_data) = 'object'
      and coalesce(u.raw_app_meta_data ->> 'credential_version', '') ~ '^0+$'
    )
  )
order by p.organization_id, p.id;

with profile_lifecycle_health as (
  select
    p.id as profile_id,
    p.organization_id,
    p.user_status,
    p.is_active,
    p.deactivated_at,
    p.deactivated_by,
    nullif(btrim(coalesce(p.deactivation_reason, '')), '') is not null
      as has_deactivation_reason,
    (
      p.user_status in ('active', 'inactive', 'archived', 'invited', 'locked')
      and p.is_active is not distinct from (p.user_status in ('active', 'invited'))
      and case
        when p.user_status in ('active', 'invited') then
          p.deactivated_at is null
          and p.deactivated_by is null
          and p.deactivation_reason is null
        else
          p.deactivated_at is not null
          and p.deactivated_by is not null
          and nullif(btrim(coalesce(p.deactivation_reason, '')), '') is not null
          and exists (
            select 1
            from public.profiles deactivation_actor
            where deactivation_actor.id = p.deactivated_by
              and deactivation_actor.organization_id = p.organization_id
          )
      end
    ) as lifecycle_metadata_valid
  from public.profiles p
)
select
  'invalid_profile_lifecycle_summary'::text as report_section,
  count(*) filter (
    where lifecycle_metadata_valid is distinct from true
  )::bigint as invalid_profile_lifecycle_rows
from profile_lifecycle_health;

with profile_lifecycle_health as (
  select
    p.id as profile_id,
    p.organization_id,
    p.user_status,
    p.is_active,
    p.deactivated_at,
    p.deactivated_by,
    nullif(btrim(coalesce(p.deactivation_reason, '')), '') is not null
      as has_deactivation_reason,
    (
      p.user_status in ('active', 'inactive', 'archived', 'invited', 'locked')
      and p.is_active is not distinct from (p.user_status in ('active', 'invited'))
      and case
        when p.user_status in ('active', 'invited') then
          p.deactivated_at is null
          and p.deactivated_by is null
          and p.deactivation_reason is null
        else
          p.deactivated_at is not null
          and p.deactivated_by is not null
          and nullif(btrim(coalesce(p.deactivation_reason, '')), '') is not null
          and exists (
            select 1
            from public.profiles deactivation_actor
            where deactivation_actor.id = p.deactivated_by
              and deactivation_actor.organization_id = p.organization_id
          )
      end
    ) as lifecycle_metadata_valid
  from public.profiles p
)
select
  'invalid_profile_lifecycle_detail'::text as report_section,
  profile_id,
  organization_id,
  user_status,
  is_active,
  deactivated_at,
  deactivated_by,
  has_deactivation_reason
from profile_lifecycle_health
where lifecycle_metadata_valid is distinct from true
order by organization_id nulls last, profile_id;

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
      when ur.role in ('super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer')
        then ur.scope = 'global'
      when ur.role = 'division_head' then ur.scope = 'division'
      when ur.role = 'department_manager' then ur.scope = 'department'
      when ur.role in ('project_owner', 'milestone_owner', 'task_owner', 'viewer', 'employee')
        then ur.scope = 'assigned_only'
      else false
    end as role_scope_valid,
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
  count(*) filter (
    where role_scope_valid is distinct from true
       or reference_shape_valid is distinct from true
  )::bigint
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
      when ur.role in ('super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer')
        then ur.scope = 'global'
      when ur.role = 'division_head' then ur.scope = 'division'
      when ur.role = 'department_manager' then ur.scope = 'department'
      when ur.role in ('project_owner', 'milestone_owner', 'task_owner', 'viewer', 'employee')
        then ur.scope = 'assigned_only'
      else false
    end as role_scope_valid,
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
  r.unit_id,
  r.role_scope_valid,
  r.reference_shape_valid
from active_role_shape r
where r.role_scope_valid is distinct from true
   or r.reference_shape_valid is distinct from true
order by r.profile_organization_id nulls last, r.user_id, r.user_role_id;

with email_identity_counts as (
  select
    u.id as auth_user_id,
    count(i.id) filter (where lower(i.provider) = 'email')::bigint
      as email_provider_identity_count,
    count(i.id) filter (
      where lower(i.provider) = 'email'
        and nullif(btrim(i.identity_data ->> 'email'), '') is not null
        and lower(btrim(i.identity_data ->> 'email')) = lower(btrim(u.email))
    )::bigint as matching_email_provider_identity_count
  from auth.users u
  left join auth.identities i on i.user_id = u.id
  group by u.id
), predicted_credential_identity as (
  select
    p.id as profile_id,
    p.organization_id,
    p.is_active,
    p.user_status,
    u.id as auth_user_id,
    u.email as auth_email,
    u.email_confirmed_at,
    u.banned_until,
    u.deleted_at,
    coalesce(e.email_provider_identity_count, 0) as email_provider_identity_count,
    coalesce(e.matching_email_provider_identity_count, 0)
      as matching_email_provider_identity_count,
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
  left join email_identity_counts e on e.auth_user_id = u.id
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
    and c.deleted_at is null
    and (c.banned_until is null or c.banned_until <= statement_timestamp())
    and c.email_provider_identity_count = 1
    and c.matching_email_provider_identity_count = 1
    and c.has_legacy_credential_version
  );

with email_identity_counts as (
  select
    u.id as auth_user_id,
    count(i.id) filter (where lower(i.provider) = 'email')::bigint
      as email_provider_identity_count,
    count(i.id) filter (
      where lower(i.provider) = 'email'
        and nullif(btrim(i.identity_data ->> 'email'), '') is not null
        and lower(btrim(i.identity_data ->> 'email')) = lower(btrim(u.email))
    )::bigint as matching_email_provider_identity_count
  from auth.users u
  left join auth.identities i on i.user_id = u.id
  group by u.id
), predicted_credential_identity as (
  select
    p.id as profile_id,
    p.organization_id,
    p.is_active,
    p.user_status,
    u.id as auth_user_id,
    u.email as auth_email,
    u.email_confirmed_at,
    u.banned_until,
    u.deleted_at,
    coalesce(e.email_provider_identity_count, 0) as email_provider_identity_count,
    coalesce(e.matching_email_provider_identity_count, 0)
      as matching_email_provider_identity_count,
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
  left join email_identity_counts e on e.auth_user_id = u.id
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
    when c.deleted_at is not null then 'deleted_auth_user'
    when c.banned_until is not null
      and c.banned_until > statement_timestamp() then 'currently_banned_auth_user'
    when c.email_provider_identity_count = 0 then 'missing_email_provider_identity'
    when c.email_provider_identity_count > 1 then 'multiple_email_provider_identities'
    when c.matching_email_provider_identity_count = 0 then 'email_identity_mismatch'
    when c.matching_email_provider_identity_count > 1 then 'multiple_matching_email_identities'
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
    and c.deleted_at is null
    and (c.banned_until is null or c.banned_until <= statement_timestamp())
    and c.email_provider_identity_count = 1
    and c.matching_email_provider_identity_count = 1
    and c.has_legacy_credential_version
  )
order by c.organization_id nulls last, ur.user_id, ur.id;

with email_identity_counts as (
  select
    u.id as auth_user_id,
    count(i.id) filter (where lower(i.provider) = 'email')::bigint
      as email_provider_identity_count,
    count(i.id) filter (
      where lower(i.provider) = 'email'
        and nullif(btrim(i.identity_data ->> 'email'), '') is not null
        and lower(btrim(i.identity_data ->> 'email')) = lower(btrim(u.email))
    )::bigint as matching_email_provider_identity_count
  from auth.users u
  left join auth.identities i on i.user_id = u.id
  group by u.id
), credential_prediction as (
  select
    p.id as profile_id,
    p.organization_id,
    case
      when p.user_status = 'active'
        and p.is_active = true
        and u.id is not null
        and nullif(btrim(u.email), '') is not null
        and u.email_confirmed_at is not null
        and u.deleted_at is null
        and (u.banned_until is null or u.banned_until <= statement_timestamp())
        and coalesce(e.email_provider_identity_count, 0) = 1
        and coalesce(e.matching_email_provider_identity_count, 0) = 1
        and (
          u.raw_app_meta_data is null
          or (
            jsonb_typeof(u.raw_app_meta_data) = 'object'
            and not (u.raw_app_meta_data ? 'credential_version')
          )
          or (
            jsonb_typeof(u.raw_app_meta_data) = 'object'
            and coalesce(u.raw_app_meta_data ->> 'credential_version', '') ~ '^0+$'
          )
        )
        then 'existing_password_rotation_pending'
      when p.user_status = 'active' and p.is_active = true
        then 'reconciliation_required'
      when p.user_status = 'invited'
        then 'reconciliation_required'
      else 'disabled'
    end as predicted_credential_state
  from public.profiles p
  left join auth.users u on u.id = p.id
  left join email_identity_counts e on e.auth_user_id = u.id
  where p.organization_id is not null
)
select
  'role_rows_becoming_runtime_ineffective_summary'::text as report_section,
  count(*)::bigint as role_rows_becoming_runtime_ineffective,
  count(distinct ur.user_id)::bigint as users_with_runtime_ineffective_roles,
  count(*) filter (
    where c.predicted_credential_state = 'existing_password_rotation_pending'
  )::bigint as role_rows_pending_existing_password_rotation,
  count(*) filter (
    where c.predicted_credential_state = 'reconciliation_required'
  )::bigint as role_rows_pending_reconciliation,
  count(*) filter (
    where c.predicted_credential_state = 'disabled'
  )::bigint as role_rows_for_disabled_profiles,
  0::bigint as role_rows_physically_deactivated_by_credential_backfill
from public.user_roles ur
join credential_prediction c on c.profile_id = ur.user_id
where ur.is_active = true
  and c.predicted_credential_state <> 'active';

with email_identity_counts as (
  select
    u.id as auth_user_id,
    count(i.id) filter (where lower(i.provider) = 'email')::bigint
      as email_provider_identity_count,
    count(i.id) filter (
      where lower(i.provider) = 'email'
        and nullif(btrim(i.identity_data ->> 'email'), '') is not null
        and lower(btrim(i.identity_data ->> 'email')) = lower(btrim(u.email))
    )::bigint as matching_email_provider_identity_count
  from auth.users u
  left join auth.identities i on i.user_id = u.id
  group by u.id
), credential_prediction as (
  select
    p.id as profile_id,
    p.organization_id,
    case
      when p.user_status = 'active'
        and p.is_active = true
        and u.id is not null
        and nullif(btrim(u.email), '') is not null
        and u.email_confirmed_at is not null
        and u.deleted_at is null
        and (u.banned_until is null or u.banned_until <= statement_timestamp())
        and coalesce(e.email_provider_identity_count, 0) = 1
        and coalesce(e.matching_email_provider_identity_count, 0) = 1
        and (
          u.raw_app_meta_data is null
          or (
            jsonb_typeof(u.raw_app_meta_data) = 'object'
            and not (u.raw_app_meta_data ? 'credential_version')
          )
          or (
            jsonb_typeof(u.raw_app_meta_data) = 'object'
            and coalesce(u.raw_app_meta_data ->> 'credential_version', '') ~ '^0+$'
          )
        )
        then 'existing_password_rotation_pending'
      when p.user_status = 'active' and p.is_active = true
        then 'reconciliation_required'
      when p.user_status = 'invited'
        then 'reconciliation_required'
      else 'disabled'
    end as predicted_credential_state
  from public.profiles p
  left join auth.users u on u.id = p.id
  left join email_identity_counts e on e.auth_user_id = u.id
  where p.organization_id is not null
)
select
  'role_rows_becoming_runtime_ineffective_detail'::text as report_section,
  ur.id as user_role_id,
  ur.user_id,
  c.organization_id,
  ur.role,
  ur.scope,
  c.predicted_credential_state,
  true as physical_role_row_remains_active,
  'ineffective_only_while_runtime_enforcement_is_enforced'::text
    as effectiveness_basis
from public.user_roles ur
join credential_prediction c on c.profile_id = ur.user_id
where ur.is_active = true
  and c.predicted_credential_state <> 'active'
order by c.organization_id, ur.user_id, ur.id;

with email_identity_counts as (
  select
    u.id as auth_user_id,
    count(i.id) filter (where lower(i.provider) = 'email')::bigint
      as email_provider_identity_count,
    count(i.id) filter (
      where lower(i.provider) = 'email'
        and nullif(btrim(i.identity_data ->> 'email'), '') is not null
        and lower(btrim(i.identity_data ->> 'email')) = lower(btrim(u.email))
    )::bigint as matching_email_provider_identity_count
  from auth.users u
  left join auth.identities i on i.user_id = u.id
  group by u.id
), employee_id_counts as (
  select
    lower(btrim(p.employee_no)) as normalized_employee_id,
    count(*)::bigint as profile_count
  from public.profiles p
  where nullif(btrim(p.employee_no), '') is not null
  group by lower(btrim(p.employee_no))
), super_admin_candidates as (
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
      and u.deleted_at is null
      and (u.banned_until is null or u.banned_until <= statement_timestamp())
      and coalesce(e.email_provider_identity_count, 0) = 1
      and coalesce(e.matching_email_provider_identity_count, 0) = 1
      and case
        when u.raw_app_meta_data is null then true
        when jsonb_typeof(u.raw_app_meta_data) = 'object'
          and not (u.raw_app_meta_data ? 'credential_version') then true
        when jsonb_typeof(u.raw_app_meta_data) = 'object'
          and coalesce(u.raw_app_meta_data ->> 'credential_version', '') ~ '^0+$' then true
        else false
      end as safe_existing_auth_identity,
    coalesce(ec.profile_count, 1) <= 1 as employee_id_collision_free,
    not exists (
      select 1
      from auth.users conflicting_user
      where nullif(btrim(p.employee_no), '') is not null
        and lower(btrim(conflicting_user.email)) =
          lower(btrim(p.employee_no)) || '@almodawat.sa'
        and conflicting_user.id <> p.id
    ) as synthetic_alias_collision_free
  from public.user_roles ur
  join public.profiles p on p.id = ur.user_id
  left join auth.users u on u.id = p.id
  left join email_identity_counts e on e.auth_user_id = u.id
  left join employee_id_counts ec
    on ec.normalized_employee_id = lower(btrim(p.employee_no))
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
        and s.safe_existing_auth_identity
        and s.employee_id_collision_free
        and s.synthetic_alias_collision_free
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
    as would_lose_last_eligible_super_admin,
  predicted_eligible_global_super_admin_count = 0
    as lacks_eligible_bootstrap_super_admin
from super_admin_by_org
order by organization_id;

with email_identity_counts as (
  select
    u.id as auth_user_id,
    count(i.id) filter (where lower(i.provider) = 'email')::bigint
      as email_provider_identity_count,
    count(i.id) filter (
      where lower(i.provider) = 'email'
        and nullif(btrim(i.identity_data ->> 'email'), '') is not null
        and lower(btrim(i.identity_data ->> 'email')) = lower(btrim(u.email))
    )::bigint as matching_email_provider_identity_count
  from auth.users u
  left join auth.identities i on i.user_id = u.id
  group by u.id
), employee_id_counts as (
  select
    lower(btrim(p.employee_no)) as normalized_employee_id,
    count(*)::bigint as profile_count
  from public.profiles p
  where nullif(btrim(p.employee_no), '') is not null
  group by lower(btrim(p.employee_no))
), eligible_candidate_source as (
  select distinct
    p.organization_id,
    ur.user_id,
    u.email as preserved_auth_email,
    nullif(btrim(p.employee_no), '') as employee_id
  from public.user_roles ur
  join public.profiles p on p.id = ur.user_id
  join auth.users u on u.id = p.id
  join email_identity_counts e on e.auth_user_id = u.id
  left join employee_id_counts ec
    on ec.normalized_employee_id = lower(btrim(p.employee_no))
  where ur.is_active = true
    and ur.role = 'super_admin'
    and ur.scope = 'global'
    and p.organization_id is not null
    and p.is_active = true
    and p.user_status = 'active'
    and (ur.organization_id is null or ur.organization_id = p.organization_id)
    and ur.division_id is null
    and ur.department_id is null
    and ur.unit_id is null
    and nullif(btrim(u.email), '') is not null
    and u.email_confirmed_at is not null
    and u.deleted_at is null
    and (u.banned_until is null or u.banned_until <= statement_timestamp())
    and e.email_provider_identity_count = 1
    and e.matching_email_provider_identity_count = 1
    and coalesce(ec.profile_count, 1) <= 1
    and not exists (
      select 1
      from auth.users conflicting_user
      where nullif(btrim(p.employee_no), '') is not null
        and lower(btrim(conflicting_user.email)) =
          lower(btrim(p.employee_no)) || '@almodawat.sa'
        and conflicting_user.id <> p.id
    )
    and (
      u.raw_app_meta_data is null
      or (
        jsonb_typeof(u.raw_app_meta_data) = 'object'
        and not (u.raw_app_meta_data ? 'credential_version')
      )
      or (
        jsonb_typeof(u.raw_app_meta_data) = 'object'
        and coalesce(u.raw_app_meta_data ->> 'credential_version', '') ~ '^0+$'
      )
    )
), eligible_candidates as (
  select
    s.*,
    row_number() over (
      partition by s.organization_id
      order by s.user_id
    ) as organization_candidate_rank
  from eligible_candidate_source s
)
select
  'designated_bootstrap_super_admin_candidate_by_organization'::text
    as report_section,
  organization_id,
  user_id as designated_super_admin_id,
  preserved_auth_email,
  employee_id,
  organization_candidate_rank,
  'lowest_eligible_user_uuid_within_organization'::text as selection_basis
from eligible_candidates
where organization_candidate_rank = 1
order by organization_id;

with email_identity_counts as (
  select
    u.id as auth_user_id,
    count(i.id) filter (where lower(i.provider) = 'email')::bigint
      as email_provider_identity_count,
    count(i.id) filter (
      where lower(i.provider) = 'email'
        and nullif(btrim(i.identity_data ->> 'email'), '') is not null
        and lower(btrim(i.identity_data ->> 'email')) = lower(btrim(u.email))
    )::bigint as matching_email_provider_identity_count
  from auth.users u
  left join auth.identities i on i.user_id = u.id
  group by u.id
), employee_id_counts as (
  select
    lower(btrim(p.employee_no)) as normalized_employee_id,
    count(*)::bigint as profile_count
  from public.profiles p
  where nullif(btrim(p.employee_no), '') is not null
  group by lower(btrim(p.employee_no))
), eligible_candidate_source as (
  select distinct
    p.organization_id,
    ur.user_id,
    u.email as preserved_auth_email,
    nullif(btrim(p.employee_no), '') as employee_id
  from public.user_roles ur
  join public.profiles p on p.id = ur.user_id
  join auth.users u on u.id = p.id
  join email_identity_counts e on e.auth_user_id = u.id
  left join employee_id_counts ec
    on ec.normalized_employee_id = lower(btrim(p.employee_no))
  where ur.is_active = true
    and ur.role = 'super_admin'
    and ur.scope = 'global'
    and p.organization_id is not null
    and p.is_active = true
    and p.user_status = 'active'
    and (ur.organization_id is null or ur.organization_id = p.organization_id)
    and ur.division_id is null
    and ur.department_id is null
    and ur.unit_id is null
    and nullif(btrim(u.email), '') is not null
    and u.email_confirmed_at is not null
    and u.deleted_at is null
    and (u.banned_until is null or u.banned_until <= statement_timestamp())
    and e.email_provider_identity_count = 1
    and e.matching_email_provider_identity_count = 1
    and coalesce(ec.profile_count, 1) <= 1
    and not exists (
      select 1
      from auth.users conflicting_user
      where nullif(btrim(p.employee_no), '') is not null
        and lower(btrim(conflicting_user.email)) =
          lower(btrim(p.employee_no)) || '@almodawat.sa'
        and conflicting_user.id <> p.id
    )
    and (
      u.raw_app_meta_data is null
      or (
        jsonb_typeof(u.raw_app_meta_data) = 'object'
        and not (u.raw_app_meta_data ? 'credential_version')
      )
      or (
        jsonb_typeof(u.raw_app_meta_data) = 'object'
        and coalesce(u.raw_app_meta_data ->> 'credential_version', '') ~ '^0+$'
      )
    )
), eligible_candidates as (
  select
    s.*,
    row_number() over (
      order by s.organization_id, s.user_id
    ) as global_candidate_rank
  from eligible_candidate_source s
)
select
  'preferred_global_designated_super_admin'::text as report_section,
  organization_id,
  user_id as designated_super_admin_id,
  preserved_auth_email,
  employee_id,
  global_candidate_rank,
  'lowest_organization_uuid_then_lowest_eligible_user_uuid'::text
    as selection_basis
from eligible_candidates
where global_candidate_rank = 1;

with email_identity_counts as (
  select
    u.id as auth_user_id,
    count(i.id) filter (where lower(i.provider) = 'email')::bigint
      as email_provider_identity_count,
    count(i.id) filter (
      where lower(i.provider) = 'email'
        and nullif(btrim(i.identity_data ->> 'email'), '') is not null
        and lower(btrim(i.identity_data ->> 'email')) = lower(btrim(u.email))
    )::bigint as matching_email_provider_identity_count
  from auth.users u
  left join auth.identities i on i.user_id = u.id
  group by u.id
), employee_id_counts as (
  select
    lower(btrim(p.employee_no)) as normalized_employee_id,
    count(*)::bigint as profile_count
  from public.profiles p
  where nullif(btrim(p.employee_no), '') is not null
  group by lower(btrim(p.employee_no))
), eligible_candidates as (
  select distinct
    p.organization_id,
    ur.user_id
  from public.user_roles ur
  join public.profiles p on p.id = ur.user_id
  join auth.users u on u.id = p.id
  join email_identity_counts e on e.auth_user_id = u.id
  left join employee_id_counts ec
    on ec.normalized_employee_id = lower(btrim(p.employee_no))
  where ur.is_active = true
    and ur.role = 'super_admin'
    and ur.scope = 'global'
    and p.organization_id is not null
    and p.is_active = true
    and p.user_status = 'active'
    and (ur.organization_id is null or ur.organization_id = p.organization_id)
    and ur.division_id is null
    and ur.department_id is null
    and ur.unit_id is null
    and nullif(btrim(u.email), '') is not null
    and u.email_confirmed_at is not null
    and u.deleted_at is null
    and (u.banned_until is null or u.banned_until <= statement_timestamp())
    and e.email_provider_identity_count = 1
    and e.matching_email_provider_identity_count = 1
    and coalesce(ec.profile_count, 1) <= 1
    and not exists (
      select 1
      from auth.users conflicting_user
      where nullif(btrim(p.employee_no), '') is not null
        and lower(btrim(conflicting_user.email)) =
          lower(btrim(p.employee_no)) || '@almodawat.sa'
        and conflicting_user.id <> p.id
    )
    and (
      u.raw_app_meta_data is null
      or (
        jsonb_typeof(u.raw_app_meta_data) = 'object'
        and not (u.raw_app_meta_data ? 'credential_version')
      )
      or (
        jsonb_typeof(u.raw_app_meta_data) = 'object'
        and coalesce(u.raw_app_meta_data ->> 'credential_version', '') ~ '^0+$'
      )
    )
), super_admin_by_org as (
  select
    o.id as organization_id,
    count(distinct e.user_id)::bigint as predicted_eligible_global_super_admin_count
  from public.organizations o
  left join eligible_candidates e on e.organization_id = o.id
  group by o.id
)
select
  'organizations_without_eligible_bootstrap_super_admin'::text as report_section,
  organization_id,
  predicted_eligible_global_super_admin_count
from super_admin_by_org
where predicted_eligible_global_super_admin_count = 0
order by organization_id;

with current_super_admin_by_org as (
  select
    p.organization_id,
    count(distinct ur.user_id)::bigint as current_active_global_super_admin_count
  from public.user_roles ur
  join public.profiles p on p.id = ur.user_id
  where ur.is_active = true
    and ur.role = 'super_admin'
    and ur.scope = 'global'
    and p.organization_id is not null
    and p.is_active = true
    and p.user_status = 'active'
    and (ur.organization_id is null or ur.organization_id = p.organization_id)
    and ur.division_id is null
    and ur.department_id is null
    and ur.unit_id is null
  group by p.organization_id
), eligible_super_admin_by_org as (
  select
    p.organization_id,
    count(distinct ur.user_id)::bigint as predicted_eligible_global_super_admin_count
  from public.user_roles ur
  join public.profiles p on p.id = ur.user_id
  join auth.users u on u.id = p.id
  where ur.is_active = true
    and ur.role = 'super_admin'
    and ur.scope = 'global'
    and p.organization_id is not null
    and p.is_active = true
    and p.user_status = 'active'
    and (ur.organization_id is null or ur.organization_id = p.organization_id)
    and ur.division_id is null
    and ur.department_id is null
    and ur.unit_id is null
    and nullif(btrim(u.email), '') is not null
    and u.email_confirmed_at is not null
    and u.deleted_at is null
    and (u.banned_until is null or u.banned_until <= statement_timestamp())
    and (
      select count(*)
      from auth.identities i
      where i.user_id = u.id
        and lower(i.provider) = 'email'
    ) = 1
    and (
      select count(*)
      from auth.identities i
      where i.user_id = u.id
        and lower(i.provider) = 'email'
        and lower(btrim(i.identity_data ->> 'email')) = lower(btrim(u.email))
    ) = 1
    and not exists (
      select 1
      from public.profiles collision_profile
      where nullif(btrim(p.employee_no), '') is not null
        and lower(btrim(collision_profile.employee_no)) = lower(btrim(p.employee_no))
        and collision_profile.id <> p.id
    )
    and not exists (
      select 1
      from auth.users conflicting_user
      where nullif(btrim(p.employee_no), '') is not null
        and lower(btrim(conflicting_user.email)) =
          lower(btrim(p.employee_no)) || '@almodawat.sa'
        and conflicting_user.id <> p.id
    )
    and (
      u.raw_app_meta_data is null
      or (
        jsonb_typeof(u.raw_app_meta_data) = 'object'
        and not (u.raw_app_meta_data ? 'credential_version')
      )
      or (
        jsonb_typeof(u.raw_app_meta_data) = 'object'
        and coalesce(u.raw_app_meta_data ->> 'credential_version', '') ~ '^0+$'
      )
    )
  group by p.organization_id
)
select
  'organizations_losing_last_eligible_super_admin'::text as report_section,
  o.id as organization_id,
  coalesce(c.current_active_global_super_admin_count, 0)
    as current_active_global_super_admin_count,
  coalesce(e.predicted_eligible_global_super_admin_count, 0)
    as predicted_eligible_global_super_admin_count
from public.organizations o
left join current_super_admin_by_org c on c.organization_id = o.id
left join eligible_super_admin_by_org e on e.organization_id = o.id
where coalesce(c.current_active_global_super_admin_count, 0) > 0
  and coalesce(e.predicted_eligible_global_super_admin_count, 0) = 0
order by o.id;

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
  'active_auth_sessions_summary'::text as report_section,
  count(*)::bigint as active_auth_session_rows,
  count(distinct s.user_id)::bigint as users_with_active_auth_sessions,
  count(*) filter (where p.id is null)::bigint as sessions_without_matching_profile,
  min(s.created_at) as oldest_session_created_at,
  max(s.updated_at) as most_recent_session_updated_at,
  'unexpired_auth_sessions_row_presence_no_session_secret_selected'::text
    as session_activity_basis
from auth.sessions s
left join public.profiles p on p.id = s.user_id
where s.not_after is null
   or s.not_after > statement_timestamp();

select
  'active_auth_sessions_by_user_detail'::text as report_section,
  s.user_id,
  p.organization_id,
  count(*)::bigint as active_auth_session_count,
  min(s.created_at) as oldest_session_created_at,
  max(s.updated_at) as most_recent_session_updated_at,
  p.is_active as profile_is_active,
  p.user_status as profile_user_status
from auth.sessions s
left join public.profiles p on p.id = s.user_id
where s.not_after is null
   or s.not_after > statement_timestamp()
group by
  s.user_id,
  p.organization_id,
  p.is_active,
  p.user_status
order by p.organization_id nulls last, s.user_id;

select
  'active_auth_sessions_by_organization'::text as report_section,
  p.organization_id,
  count(*)::bigint as active_auth_session_count,
  count(distinct s.user_id)::bigint as users_with_active_auth_sessions
from auth.sessions s
join public.profiles p on p.id = s.user_id
where s.not_after is null
   or s.not_after > statement_timestamp()
group by p.organization_id
order by p.organization_id nulls last;

select
  'patch83u_release_contract_constants'::text as report_section,
  '174.2-auth-first'::text as expected_internal_schema_contract,
  174::integer as expected_installed_schema_version,
  'patch83u-edge-auth-first-v1'::text as expected_edge_contract_version,
  'patch83u-frontend-auth-first-v1'::text as expected_frontend_contract_version,
  'disabled'::text as required_initial_enforcement_state,
  array['disabled', 'prepared', 'enforced', 'emergency_suspended']::text[]
    as allowed_enforcement_states;

select
  'patch83u_migration_history_readiness'::text as report_section,
  exists (
    select 1
    from supabase_migrations.schema_migrations m
    where m.version = '173'
  ) as migration_173_present,
  exists (
    select 1
    from supabase_migrations.schema_migrations m
    where m.version = '174'
  ) as migration_174_present,
  exists (
    select 1
    from supabase_migrations.schema_migrations m
    where m.version = '176'
  ) as migration_176_present,
  exists (
    select 1
    from supabase_migrations.schema_migrations m
    where m.version = '177'
  ) as migration_177_present,
  to_regclass('public.user_account_provisioning') is not null
    as migration_173_anchor_relation_present,
  to_regclass('public.patch83u_runtime_control') is not null
    as migration_174_runtime_relation_present,
  to_regclass('public.user_credential_states') is not null
    as migration_174_credential_relation_present;

with required_runtime_columns(column_name) as (
  values
    ('singleton'),
    ('schema_version'),
    ('enforcement_state'),
    ('prepared_at'),
    ('prepared_by'),
    ('activated_at'),
    ('activated_by'),
    ('deactivated_at'),
    ('deactivated_by'),
    ('activation_reason'),
    ('last_transition_reason'),
    ('expected_edge_contract_version'),
    ('expected_frontend_contract_version'),
    ('compatible_edge_contract_version'),
    ('compatible_frontend_contract_version'),
    ('compatibility_attested_at'),
    ('compatibility_attested_by'),
    ('preflight_hash'),
    ('designated_super_admin_id'),
    ('last_transition_request_id'),
    ('state_version'),
    ('created_at'),
    ('updated_at')
), present_runtime_columns as (
  select c.column_name
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'patch83u_runtime_control'
)
select
  'patch83u_runtime_schema_readiness'::text as report_section,
  to_regclass('public.patch83u_runtime_control') is not null
    as runtime_control_relation_present,
  count(*)::integer as required_runtime_column_count,
  count(p.column_name)::integer as present_runtime_column_count,
  count(*) = count(p.column_name) as all_required_runtime_columns_present,
  coalesce(
    array_agg(r.column_name order by r.column_name)
      filter (where p.column_name is null),
    array[]::text[]
  ) as missing_runtime_columns,
  coalesce((
    select c.relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'patch83u_runtime_control'
      and c.relkind in ('r', 'p')
  ), false) as runtime_control_rls_enabled,
  coalesce((
    select c.relforcerowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'patch83u_runtime_control'
      and c.relkind in ('r', 'p')
  ), false) as runtime_control_rls_forced
from required_runtime_columns r
left join present_runtime_columns p using (column_name);

select
  'patch83u_runtime_default_and_constraint_readiness'::text as report_section,
  count(*) = 4 and coalesce(bool_and(
    case c.column_name
      when 'schema_version' then c.column_default like '%174.2-auth-first%'
      when 'enforcement_state' then c.column_default like '%disabled%'
      when 'expected_edge_contract_version'
        then c.column_default like '%patch83u-edge-auth-first-v1%'
      when 'expected_frontend_contract_version'
        then c.column_default like '%patch83u-frontend-auth-first-v1%'
      else false
    end
  ), false) as exact_runtime_defaults_present,
  coalesce((
    select
      c.data_type = 'boolean'
      and c.column_default like '%true%'
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'patch83u_runtime_control'
      and c.column_name = 'singleton'
  ), false) as singleton_boolean_default_true,
  coalesce((
    select bool_or(
      pg_get_constraintdef(con.oid) like '%disabled%'
      and pg_get_constraintdef(con.oid) like '%prepared%'
      and pg_get_constraintdef(con.oid) like '%enforced%'
      and pg_get_constraintdef(con.oid) like '%emergency_suspended%'
    )
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace n on n.oid = rel.relnamespace
    where n.nspname = 'public'
      and rel.relname = 'patch83u_runtime_control'
      and con.contype = 'c'
  ), false) as enforcement_state_constraint_present,
  coalesce((
    select bool_or(
      con.contype = 'p'
      and pg_get_constraintdef(con.oid) like '%singleton%'
    )
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace n on n.oid = rel.relnamespace
    where n.nspname = 'public'
      and rel.relname = 'patch83u_runtime_control'
  ), false) as runtime_singleton_primary_key_present,
  coalesce((
    select bool_or(
      con.contype = 'c'
      and pg_get_constraintdef(con.oid) like '%singleton%'
    )
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace n on n.oid = rel.relnamespace
    where n.nspname = 'public'
      and rel.relname = 'patch83u_runtime_control'
  ), false) as runtime_singleton_true_constraint_present,
  coalesce((
    select bool_or(
      con.contype = 'c'
      and pg_get_constraintdef(con.oid) like '%preflight_hash%'
      and pg_get_constraintdef(con.oid) like '%64%'
    )
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace n on n.oid = rel.relnamespace
    where n.nspname = 'public'
      and rel.relname = 'patch83u_runtime_control'
  ), false) as sha256_preflight_hash_constraint_present
from information_schema.columns c
where c.table_schema = 'public'
  and c.table_name = 'patch83u_runtime_control'
  and c.column_name in (
    'schema_version',
    'enforcement_state',
    'expected_edge_contract_version',
    'expected_frontend_contract_version'
  );

select
  'patch83u_runtime_routine_readiness'::text as report_section,
  to_regprocedure(
    'public.patch83u_transition_runtime(uuid,text,text,text,text,text,uuid,text,text)'
  ) is not null as service_runtime_transition_present,
  to_regprocedure(
    'public.patch83u_runtime_activation_blockers(uuid)'
  ) is not null as service_activation_blocker_check_present,
  to_regprocedure(
    'public.patch83u_get_capabilities(uuid,text,text)'
  ) is not null as authenticated_capability_backend_present,
  to_regprocedure(
    'public.patch83u_get_credential_state(uuid,integer,text,text)'
  ) is not null as credential_state_backend_present;

select
  'patch83u_password_finalizer_rpc_name_readiness'::text as report_section,
  'patch83u_finalize_password_change_after_revocation'::text
    as final_rpc_name,
  pg_catalog.octet_length(
    'patch83u_finalize_password_change_after_revocation'
  ) as final_rpc_name_byte_length,
  pg_catalog.octet_length(
    'patch83u_finalize_password_change_after_revocation'
  ) < 63 as final_rpc_name_below_63_bytes,
  pg_catalog.to_regprocedure(
    'public.patch83u_finalize_password_change_after_revocation(uuid,uuid,text,integer,text)'
  ) is not null as exact_final_signature_present,
  (
    select count(*) = 1
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'patch83u_finalize_password_change_after_revocation'
  ) as final_rpc_name_unique,
  not exists (
    select 1
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname =
        'patch83u_finalize_required_password_change_after_session_revoca'
  ) as truncated_rpc_name_absent;

with required_patch83u_recovery_routines(
  routine_purpose,
  routine_signature,
  service_role_execute_expected
) as (
  values
    (
      'atomic_required_password_change_finalization',
      'public.patch83u_finalize_password_change_after_revocation(uuid,uuid,text,integer,text)',
      true
    ),
    (
      'credential_reconciliation_service_entry',
      'public.patch83u_reconcile_credential_state(uuid,uuid,text,text)',
      true
    ),
    (
      'credential_reconciliation_standard_owner_only_implementation',
      'public.patch83u_reconcile_credential_state_standard_impl(uuid,uuid,text,text)',
      false
    ),
    (
      'last_designated_super_admin_owner_only_recovery',
      'public.patch83u_reconcile_last_super_admin_recovery(uuid,uuid,text,text)',
      false
    )
)
select
  'patch83u_migration_177_routine_security_readiness'::text as report_section,
  r.routine_purpose,
  r.routine_signature,
  p.oid is not null as exact_signature_present,
  coalesce(p.prosecdef, false) as security_definer,
  coalesce(p.proconfig, '{}'::text[])
    @> array['search_path=pg_catalog, public, pg_temp']::text[]
    as restricted_search_path_present,
  pg_get_userbyid(p.proowner) as routine_owner,
  coalesce(
    p.proowner = (
      select guard.proowner
      from pg_proc guard
      where guard.oid = to_regprocedure(
        'public.patch83u_require_service_role()'
      )
    ),
    false
  ) as owner_matches_service_role_guard,
  exists (
    select 1
    from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
    where acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) as public_execute_granted,
  coalesce(
    has_function_privilege('anon', p.oid, 'EXECUTE'),
    false
  ) as anon_execute_granted,
  coalesce(
    has_function_privilege('authenticated', p.oid, 'EXECUTE'),
    false
  ) as authenticated_execute_granted,
  coalesce(
    has_function_privilege('service_role', p.oid, 'EXECUTE'),
    false
  ) as service_role_execute_granted,
  exists (
    select 1
    from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
    where acl.privilege_type = 'EXECUTE'
      and acl.grantee not in (
        p.proowner,
        (
          select role_entry.oid
          from pg_roles role_entry
          where role_entry.rolname = 'service_role'
        )
      )
  ) as unexpected_execute_grant_present,
  p.oid is not null
    and p.prosecdef = true
    and coalesce(p.proconfig, '{}'::text[])
      @> array['search_path=pg_catalog, public, pg_temp']::text[]
    and p.proowner = (
      select guard.proowner
      from pg_proc guard
      where guard.oid = to_regprocedure(
        'public.patch83u_require_service_role()'
      )
    )
    and not exists (
      select 1
      from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
      where acl.grantee = 0
        and acl.privilege_type = 'EXECUTE'
    )
    and not coalesce(
      has_function_privilege('anon', p.oid, 'EXECUTE'),
      false
    )
    and not coalesce(
      has_function_privilege('authenticated', p.oid, 'EXECUTE'),
      false
    )
    and coalesce(
      has_function_privilege('service_role', p.oid, 'EXECUTE'),
      false
    ) is not distinct from r.service_role_execute_expected
    and not exists (
      select 1
      from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
      where acl.privilege_type = 'EXECUTE'
        and acl.grantee not in (
          p.proowner,
          (
            select role_entry.oid
            from pg_roles role_entry
            where role_entry.rolname = 'service_role'
          )
        )
    )
    as exact_security_contract_present
from required_patch83u_recovery_routines r
left join pg_proc p on p.oid = to_regprocedure(r.routine_signature)
order by r.routine_purpose;

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

with email_identity_counts as (
  select
    u.id as auth_user_id,
    count(i.id) filter (where lower(i.provider) = 'email')::bigint
      as email_provider_identity_count,
    count(i.id) filter (
      where lower(i.provider) = 'email'
        and nullif(btrim(i.identity_data ->> 'email'), '') is not null
        and lower(btrim(i.identity_data ->> 'email')) = lower(btrim(u.email))
    )::bigint as matching_email_provider_identity_count
  from auth.users u
  left join auth.identities i on i.user_id = u.id
  group by u.id
), credential_prediction as (
  select
    p.id as profile_id,
    case
      when p.user_status = 'active'
        and p.is_active = true
        and u.id is not null
        and nullif(btrim(u.email), '') is not null
        and u.email_confirmed_at is not null
        and u.deleted_at is null
        and (u.banned_until is null or u.banned_until <= statement_timestamp())
        and coalesce(e.email_provider_identity_count, 0) = 1
        and coalesce(e.matching_email_provider_identity_count, 0) = 1
        and (
          u.raw_app_meta_data is null
          or (
            jsonb_typeof(u.raw_app_meta_data) = 'object'
            and not (u.raw_app_meta_data ? 'credential_version')
          )
          or (
            jsonb_typeof(u.raw_app_meta_data) = 'object'
            and coalesce(u.raw_app_meta_data ->> 'credential_version', '') ~ '^0+$'
          )
        )
        then 'existing_password_rotation_pending'
      when p.user_status = 'active' and p.is_active = true
        then 'reconciliation_required'
      when p.user_status = 'invited'
        then 'reconciliation_required'
      else 'disabled'
    end as predicted_credential_state
  from public.profiles p
  left join auth.users u on u.id = p.id
  left join email_identity_counts e on e.auth_user_id = u.id
  where p.organization_id is not null
), estimates as (
  select
    (select count(*)::bigint from credential_prediction)
      as credential_state_backfill_rows,
    (select count(*)::bigint from credential_prediction)
      as legacy_credential_event_backfill_rows,
    (select count(*)::bigint from credential_prediction
      where predicted_credential_state = 'existing_password_rotation_pending')
      as rotation_schedule_event_backfill_rows,
    (select count(*)::bigint from credential_prediction
      where predicted_credential_state = 'existing_password_rotation_pending')
      as existing_password_rotation_pending_rows,
    (select count(*)::bigint from credential_prediction
      where predicted_credential_state = 'reconciliation_required')
      as reconciliation_required_rows,
    (select count(*)::bigint from credential_prediction
      where predicted_credential_state = 'disabled')
      as disabled_credential_rows,
    (select count(*)::bigint
      from public.user_roles ur
      join credential_prediction c on c.profile_id = ur.user_id
      where ur.is_active = true
        and c.predicted_credential_state <> 'active')
      as role_rows_runtime_ineffective_when_enforced
)
select
  'estimated_rows_touched_by_migration_174'::text as report_section,
  credential_state_backfill_rows,
  legacy_credential_event_backfill_rows,
  rotation_schedule_event_backfill_rows,
  (
    legacy_credential_event_backfill_rows
    + rotation_schedule_event_backfill_rows
  )::bigint as credential_event_backfill_rows,
  1::bigint as runtime_control_seed_rows,
  existing_password_rotation_pending_rows,
  reconciliation_required_rows,
  disabled_credential_rows,
  role_rows_runtime_ineffective_when_enforced,
  0::bigint as credential_state_guard_recheck_rows,
  0::bigint as predicted_role_suspension_rows,
  0::bigint as predicted_suspended_role_snapshot_rows,
  0::bigint as predicted_role_change_audit_rows,
  0::bigint as predicted_role_suspension_event_rows,
  0::bigint as active_role_guard_recheck_rows_after_suspension,
  (
    credential_state_backfill_rows
    + legacy_credential_event_backfill_rows
    + rotation_schedule_event_backfill_rows
    + 1
  )::bigint as estimated_total_rows_touched
from estimates;

with required_runtime_columns(column_name) as (
  values
    ('singleton'),
    ('schema_version'),
    ('enforcement_state'),
    ('prepared_at'),
    ('prepared_by'),
    ('activated_at'),
    ('activated_by'),
    ('deactivated_at'),
    ('deactivated_by'),
    ('activation_reason'),
    ('last_transition_reason'),
    ('expected_edge_contract_version'),
    ('expected_frontend_contract_version'),
    ('compatible_edge_contract_version'),
    ('compatible_frontend_contract_version'),
    ('compatibility_attested_at'),
    ('compatibility_attested_by'),
    ('preflight_hash'),
    ('designated_super_admin_id'),
    ('last_transition_request_id'),
    ('state_version'),
    ('created_at'),
    ('updated_at')
), runtime_column_readiness as (
  select count(*) filter (where c.column_name is null)::bigint as absent_column_count
  from required_runtime_columns r
  left join information_schema.columns c
    on c.table_schema = 'public'
   and c.table_name = 'patch83u_runtime_control'
   and c.column_name = r.column_name
), runtime_default_readiness as (
  select
    (
      count(*) = 4
      and bool_and(
        case c.column_name
          when 'schema_version' then c.column_default like '%174.2-auth-first%'
          when 'enforcement_state' then c.column_default like '%disabled%'
          when 'expected_edge_contract_version'
            then c.column_default like '%patch83u-edge-auth-first-v1%'
          when 'expected_frontend_contract_version'
            then c.column_default like '%patch83u-frontend-auth-first-v1%'
          else false
        end
      )
    ) as exact_defaults_present
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'patch83u_runtime_control'
    and c.column_name in (
      'schema_version',
      'enforcement_state',
      'expected_edge_contract_version',
      'expected_frontend_contract_version'
    )
), runtime_constraint_readiness as (
  select
    exists (
      select 1
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = 'patch83u_runtime_control'
        and c.column_name = 'singleton'
        and c.data_type = 'boolean'
        and c.column_default like '%true%'
    )
    and exists (
      select 1
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace n on n.oid = rel.relnamespace
      where n.nspname = 'public'
        and rel.relname = 'patch83u_runtime_control'
        and con.contype = 'p'
        and pg_get_constraintdef(con.oid) like '%singleton%'
    )
    and exists (
      select 1
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace n on n.oid = rel.relnamespace
      where n.nspname = 'public'
        and rel.relname = 'patch83u_runtime_control'
        and con.contype = 'c'
        and pg_get_constraintdef(con.oid) like '%singleton%'
    )
    and exists (
      select 1
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace n on n.oid = rel.relnamespace
      where n.nspname = 'public'
        and rel.relname = 'patch83u_runtime_control'
        and con.contype = 'c'
        and pg_get_constraintdef(con.oid) like '%preflight_hash%'
        and pg_get_constraintdef(con.oid) like '%64%'
    )
    and exists (
      select 1
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace n on n.oid = rel.relnamespace
      where n.nspname = 'public'
        and rel.relname = 'patch83u_runtime_control'
        and con.contype = 'c'
        and pg_get_constraintdef(con.oid) like '%disabled%'
        and pg_get_constraintdef(con.oid) like '%prepared%'
        and pg_get_constraintdef(con.oid) like '%enforced%'
        and pg_get_constraintdef(con.oid) like '%emergency_suspended%'
    ) as exact_constraints_present
), email_identity_counts as (
  select
    u.id as auth_user_id,
    count(i.id) filter (where lower(i.provider) = 'email')::bigint
      as email_provider_identity_count,
    count(i.id) filter (
      where lower(i.provider) = 'email'
        and nullif(btrim(i.identity_data ->> 'email'), '') is not null
        and lower(btrim(i.identity_data ->> 'email')) = lower(btrim(u.email))
    )::bigint as matching_email_provider_identity_count
  from auth.users u
  left join auth.identities i on i.user_id = u.id
  group by u.id
), employee_id_counts as (
  select
    lower(btrim(p.employee_no)) as normalized_employee_id,
    count(*)::bigint as profile_count
  from public.profiles p
  where nullif(btrim(p.employee_no), '') is not null
  group by lower(btrim(p.employee_no))
), invalid_active_role_assignments as (
  select count(*)::bigint as blocker_count
  from public.user_roles ur
  join public.profiles p on p.id = ur.user_id
  where ur.is_active = true
    and (
      (case
        when ur.role in ('super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer')
          then ur.scope = 'global'
        when ur.role = 'division_head' then ur.scope = 'division'
        when ur.role = 'department_manager' then ur.scope = 'department'
        when ur.role in ('project_owner', 'milestone_owner', 'task_owner', 'viewer', 'employee')
          then ur.scope = 'assigned_only'
        else false
      end) is distinct from true
      or (case
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
      end) is distinct from true
    )
), invalid_profile_lifecycle_rows as (
  select count(*)::bigint as blocker_count
  from public.profiles p
  where p.user_status not in ('active', 'inactive', 'archived', 'invited', 'locked')
    or p.is_active is distinct from (p.user_status in ('active', 'invited'))
    or (
      p.user_status in ('active', 'invited')
      and (
        p.deactivated_at is not null
        or p.deactivated_by is not null
        or p.deactivation_reason is not null
      )
    )
    or (
      p.user_status in ('inactive', 'archived', 'locked')
      and (
        p.deactivated_at is null
        or p.deactivated_by is null
        or nullif(btrim(coalesce(p.deactivation_reason, '')), '') is null
        or not exists (
          select 1 from public.profiles deactivation_actor
          where deactivation_actor.id = p.deactivated_by
            and deactivation_actor.organization_id = p.organization_id
        )
      )
    )
), eligible_bootstrap_candidates as (
  select distinct
    p.organization_id,
    ur.user_id
  from public.user_roles ur
  join public.profiles p on p.id = ur.user_id
  join auth.users u on u.id = p.id
  join email_identity_counts e on e.auth_user_id = u.id
  left join employee_id_counts ec
    on ec.normalized_employee_id = lower(btrim(p.employee_no))
  where ur.is_active = true
    and ur.role = 'super_admin'
    and ur.scope = 'global'
    and p.organization_id is not null
    and p.is_active = true
    and p.user_status = 'active'
    and (ur.organization_id is null or ur.organization_id = p.organization_id)
    and ur.division_id is null
    and ur.department_id is null
    and ur.unit_id is null
    and nullif(btrim(u.email), '') is not null
    and u.email_confirmed_at is not null
    and u.deleted_at is null
    and (u.banned_until is null or u.banned_until <= statement_timestamp())
    and e.email_provider_identity_count = 1
    and e.matching_email_provider_identity_count = 1
    and coalesce(ec.profile_count, 1) <= 1
    and not exists (
      select 1
      from auth.users conflicting_user
      where nullif(btrim(p.employee_no), '') is not null
        and lower(btrim(conflicting_user.email)) =
          lower(btrim(p.employee_no)) || '@almodawat.sa'
        and conflicting_user.id <> p.id
    )
    and (
      u.raw_app_meta_data is null
      or (
        jsonb_typeof(u.raw_app_meta_data) = 'object'
        and not (u.raw_app_meta_data ? 'credential_version')
      )
      or (
        jsonb_typeof(u.raw_app_meta_data) = 'object'
        and coalesce(u.raw_app_meta_data ->> 'credential_version', '') ~ '^0+$'
      )
    )
), activation_blockers as (
  select
    'PATCH83U_MIGRATION_173_MISSING'::text as blocker_code,
    case when exists (
      select 1 from supabase_migrations.schema_migrations m where m.version = '173'
    ) then 0::bigint else 1::bigint end as blocker_count
  union all
  select
    'PATCH83U_MIGRATION_174_MISSING',
    case when exists (
      select 1 from supabase_migrations.schema_migrations m where m.version = '174'
    ) then 0::bigint else 1::bigint end
  union all
  select
    'PATCH83U_MIGRATION_176_MISSING',
    case when exists (
      select 1 from supabase_migrations.schema_migrations m where m.version = '176'
    ) then 0::bigint else 1::bigint end
  union all
  select
    'PATCH83U_MIGRATION_177_MISSING',
    case when exists (
      select 1 from supabase_migrations.schema_migrations m where m.version = '177'
    ) then 0::bigint else 1::bigint end
  union all
  select
    'PATCH83U_PASSWORD_FINALIZER_RPC_NAME_INCOMPATIBLE',
    case when
      pg_catalog.octet_length(
        'patch83u_finalize_password_change_after_revocation'
      ) < 63
      and pg_catalog.to_regprocedure(
        'public.patch83u_finalize_password_change_after_revocation(uuid,uuid,text,integer,text)'
      ) is not null
      and (
        select count(*) = 1
        from pg_catalog.pg_proc p
        join pg_catalog.pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname =
            'patch83u_finalize_password_change_after_revocation'
      )
      and not exists (
        select 1
        from pg_catalog.pg_proc p
        join pg_catalog.pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname =
            'patch83u_finalize_required_password_change_after_session_revoca'
      )
    then 0::bigint else 1::bigint end
  union all
  select
    'PATCH83U_MIGRATION_177_ROUTINE_SECURITY_INCOMPATIBLE',
    count(*)::bigint
  from (
    values
      (
        'public.patch83u_finalize_password_change_after_revocation(uuid,uuid,text,integer,text)',
        true
      ),
      (
        'public.patch83u_reconcile_credential_state(uuid,uuid,text,text)',
        true
      ),
      (
        'public.patch83u_reconcile_credential_state_standard_impl(uuid,uuid,text,text)',
        false
      ),
      (
        'public.patch83u_reconcile_last_super_admin_recovery(uuid,uuid,text,text)',
        false
      )
  ) required_routine(routine_signature, service_role_execute_expected)
  left join pg_proc routine
    on routine.oid = to_regprocedure(required_routine.routine_signature)
  where routine.oid is null
    or routine.prosecdef is distinct from true
    or not (
      coalesce(routine.proconfig, '{}'::text[])
      @> array['search_path=pg_catalog, public, pg_temp']::text[]
    )
    or routine.proowner is distinct from (
      select guard.proowner
      from pg_proc guard
      where guard.oid = to_regprocedure(
        'public.patch83u_require_service_role()'
      )
    )
    or exists (
      select 1
      from aclexplode(
        coalesce(routine.proacl, acldefault('f', routine.proowner))
      ) acl
      where acl.grantee = 0
        and acl.privilege_type = 'EXECUTE'
    )
    or coalesce(
      has_function_privilege('anon', routine.oid, 'EXECUTE'),
      false
    )
    or coalesce(
      has_function_privilege('authenticated', routine.oid, 'EXECUTE'),
      false
    )
    or coalesce(
      has_function_privilege('service_role', routine.oid, 'EXECUTE'),
      false
    ) is distinct from required_routine.service_role_execute_expected
    or exists (
      select 1
      from aclexplode(
        coalesce(routine.proacl, acldefault('f', routine.proowner))
      ) acl
      where acl.privilege_type = 'EXECUTE'
        and acl.grantee not in (
          routine.proowner,
          (
            select role_entry.oid
            from pg_roles role_entry
            where role_entry.rolname = 'service_role'
          )
        )
    )
  union all
  select
    'PATCH83U_RUNTIME_CONTROL_RELATION_MISSING',
    case when to_regclass('public.patch83u_runtime_control') is null
      then 1::bigint else 0::bigint end
  union all
  select
    'PATCH83U_RUNTIME_COLUMNS_MISSING',
    r.absent_column_count
  from runtime_column_readiness r
  union all
  select
    'PATCH83U_RUNTIME_DEFAULTS_INCOMPATIBLE',
    case when coalesce(r.exact_defaults_present, false)
      then 0::bigint else 1::bigint end
  from runtime_default_readiness r
  union all
  select
    'PATCH83U_RUNTIME_CONSTRAINTS_INCOMPATIBLE',
    case when coalesce(r.exact_constraints_present, false)
      then 0::bigint else 1::bigint end
  from runtime_constraint_readiness r
  union all
  select
    'PATCH83U_RUNTIME_RLS_NOT_FORCED',
    case when exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = 'patch83u_runtime_control'
        and c.relkind in ('r', 'p')
        and c.relrowsecurity = true
        and c.relforcerowsecurity = true
    ) then 0::bigint else 1::bigint end
  union all
  select
    'PATCH83U_RUNTIME_TRANSITION_ROUTINE_MISSING',
    case when to_regprocedure(
      'public.patch83u_transition_runtime(uuid,text,text,text,text,text,uuid,text,text)'
    ) is null then 1::bigint else 0::bigint end
  union all
  select
    'PATCH83U_CAPABILITY_ROUTINE_MISSING',
    case when to_regprocedure(
      'public.patch83u_get_capabilities(uuid,text,text)'
    ) is null then 1::bigint else 0::bigint end
  union all
  select
    'PATCH83U_EMPLOYEE_ID_COLLISION',
    count(*)::bigint
  from employee_id_counts e
  where e.profile_count > 1
  union all
  select
    'PATCH83U_SYNTHETIC_EMAIL_COLLISION',
    count(*)::bigint
  from public.profiles p
  join auth.users u
    on nullif(btrim(p.employee_no), '') is not null
   and lower(btrim(u.email)) = lower(btrim(p.employee_no)) || '@almodawat.sa'
   and u.id <> p.id
  union all
  select
    'PATCH83U_INVALID_ACTIVE_ROLE_ASSIGNMENT',
    blocker_count
  from invalid_active_role_assignments
  union all
  select
    'PATCH83U_INVALID_PROFILE_LIFECYCLE',
    blocker_count
  from invalid_profile_lifecycle_rows
  union all
  select
    'PATCH83U_ORGANIZATION_WITHOUT_ELIGIBLE_BOOTSTRAP_SUPER_ADMIN',
    count(*)::bigint
  from public.organizations o
  where not exists (
    select 1
    from eligible_bootstrap_candidates e
    where e.organization_id = o.id
  )
  union all
  select
    'PATCH83U_DESIGNATED_SUPER_ADMIN_CANDIDATE_MISSING',
    case when exists (select 1 from eligible_bootstrap_candidates)
      then 0::bigint else 1::bigint end
)
select
  'runtime_activation_blocker_detail'::text as report_section,
  blocker_code,
  blocker_count,
  blocker_count > 0 as blocks_prepared_or_enforced_transition
from activation_blockers
order by blocker_code;

with required_runtime_columns(column_name) as (
  values
    ('singleton'), ('schema_version'), ('enforcement_state'),
    ('prepared_at'), ('prepared_by'), ('activated_at'), ('activated_by'),
    ('deactivated_at'), ('deactivated_by'), ('activation_reason'),
    ('last_transition_reason'), ('expected_edge_contract_version'),
    ('expected_frontend_contract_version'), ('compatible_edge_contract_version'),
    ('compatible_frontend_contract_version'), ('compatibility_attested_at'),
    ('compatibility_attested_by'), ('preflight_hash'),
    ('designated_super_admin_id'), ('last_transition_request_id'),
    ('state_version'), ('created_at'), ('updated_at')
), runtime_column_readiness as (
  select count(*) filter (where c.column_name is null)::bigint as absent_column_count
  from required_runtime_columns r
  left join information_schema.columns c
    on c.table_schema = 'public'
   and c.table_name = 'patch83u_runtime_control'
   and c.column_name = r.column_name
), runtime_default_readiness as (
  select
    count(*) = 4 and coalesce(bool_and(
      case c.column_name
        when 'schema_version' then c.column_default like '%174.2-auth-first%'
        when 'enforcement_state' then c.column_default like '%disabled%'
        when 'expected_edge_contract_version'
          then c.column_default like '%patch83u-edge-auth-first-v1%'
        when 'expected_frontend_contract_version'
          then c.column_default like '%patch83u-frontend-auth-first-v1%'
        else false
      end
    ), false) as exact_defaults_present
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'patch83u_runtime_control'
    and c.column_name in (
      'schema_version', 'enforcement_state',
      'expected_edge_contract_version', 'expected_frontend_contract_version'
    )
), runtime_constraint_readiness as (
  select
    exists (
      select 1 from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = 'patch83u_runtime_control'
        and c.column_name = 'singleton'
        and c.data_type = 'boolean'
        and c.column_default like '%true%'
    )
    and exists (
      select 1
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace n on n.oid = rel.relnamespace
      where n.nspname = 'public'
        and rel.relname = 'patch83u_runtime_control'
        and con.contype = 'p'
        and pg_get_constraintdef(con.oid) like '%singleton%'
    )
    and exists (
      select 1
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace n on n.oid = rel.relnamespace
      where n.nspname = 'public'
        and rel.relname = 'patch83u_runtime_control'
        and con.contype = 'c'
        and pg_get_constraintdef(con.oid) like '%singleton%'
    )
    and exists (
      select 1
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace n on n.oid = rel.relnamespace
      where n.nspname = 'public'
        and rel.relname = 'patch83u_runtime_control'
        and con.contype = 'c'
        and pg_get_constraintdef(con.oid) like '%preflight_hash%'
        and pg_get_constraintdef(con.oid) like '%64%'
    )
    and exists (
      select 1
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace n on n.oid = rel.relnamespace
      where n.nspname = 'public'
        and rel.relname = 'patch83u_runtime_control'
        and con.contype = 'c'
        and pg_get_constraintdef(con.oid) like '%disabled%'
        and pg_get_constraintdef(con.oid) like '%prepared%'
        and pg_get_constraintdef(con.oid) like '%enforced%'
        and pg_get_constraintdef(con.oid) like '%emergency_suspended%'
    ) as exact_constraints_present
), email_identity_counts as (
  select
    u.id as auth_user_id,
    count(i.id) filter (where lower(i.provider) = 'email')::bigint
      as email_provider_identity_count,
    count(i.id) filter (
      where lower(i.provider) = 'email'
        and nullif(btrim(i.identity_data ->> 'email'), '') is not null
        and lower(btrim(i.identity_data ->> 'email')) = lower(btrim(u.email))
    )::bigint as matching_email_provider_identity_count
  from auth.users u
  left join auth.identities i on i.user_id = u.id
  group by u.id
), employee_id_counts as (
  select lower(btrim(p.employee_no)) as normalized_employee_id,
    count(*)::bigint as profile_count
  from public.profiles p
  where nullif(btrim(p.employee_no), '') is not null
  group by lower(btrim(p.employee_no))
), invalid_active_role_assignments as (
  select count(*)::bigint as blocker_count
  from public.user_roles ur
  join public.profiles p on p.id = ur.user_id
  where ur.is_active = true
    and (
      (case
        when ur.role in ('super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer')
          then ur.scope = 'global'
        when ur.role = 'division_head' then ur.scope = 'division'
        when ur.role = 'department_manager' then ur.scope = 'department'
        when ur.role in ('project_owner', 'milestone_owner', 'task_owner', 'viewer', 'employee')
          then ur.scope = 'assigned_only'
        else false
      end) is distinct from true
      or (case
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
      end) is distinct from true
    )
), invalid_profile_lifecycle_rows as (
  select count(*)::bigint as blocker_count
  from public.profiles p
  where p.user_status not in ('active', 'inactive', 'archived', 'invited', 'locked')
    or p.is_active is distinct from (p.user_status in ('active', 'invited'))
    or (
      p.user_status in ('active', 'invited')
      and (
        p.deactivated_at is not null
        or p.deactivated_by is not null
        or p.deactivation_reason is not null
      )
    )
    or (
      p.user_status in ('inactive', 'archived', 'locked')
      and (
        p.deactivated_at is null
        or p.deactivated_by is null
        or nullif(btrim(coalesce(p.deactivation_reason, '')), '') is null
        or not exists (
          select 1 from public.profiles deactivation_actor
          where deactivation_actor.id = p.deactivated_by
            and deactivation_actor.organization_id = p.organization_id
        )
      )
    )
), eligible_bootstrap_candidates as (
  select distinct p.organization_id, ur.user_id
  from public.user_roles ur
  join public.profiles p on p.id = ur.user_id
  join auth.users u on u.id = p.id
  join email_identity_counts e on e.auth_user_id = u.id
  left join employee_id_counts ec
    on ec.normalized_employee_id = lower(btrim(p.employee_no))
  where ur.is_active = true
    and ur.role = 'super_admin'
    and ur.scope = 'global'
    and p.organization_id is not null
    and p.is_active = true
    and p.user_status = 'active'
    and (ur.organization_id is null or ur.organization_id = p.organization_id)
    and ur.division_id is null
    and ur.department_id is null
    and ur.unit_id is null
    and nullif(btrim(u.email), '') is not null
    and u.email_confirmed_at is not null
    and u.deleted_at is null
    and (u.banned_until is null or u.banned_until <= statement_timestamp())
    and e.email_provider_identity_count = 1
    and e.matching_email_provider_identity_count = 1
    and coalesce(ec.profile_count, 1) <= 1
    and not exists (
      select 1 from auth.users conflicting_user
      where nullif(btrim(p.employee_no), '') is not null
        and lower(btrim(conflicting_user.email)) =
          lower(btrim(p.employee_no)) || '@almodawat.sa'
        and conflicting_user.id <> p.id
    )
    and (
      u.raw_app_meta_data is null
      or (jsonb_typeof(u.raw_app_meta_data) = 'object'
        and not (u.raw_app_meta_data ? 'credential_version'))
      or (jsonb_typeof(u.raw_app_meta_data) = 'object'
        and coalesce(u.raw_app_meta_data ->> 'credential_version', '') ~ '^0+$')
    )
), activation_blockers as (
  select case when exists (
    select 1 from supabase_migrations.schema_migrations m where m.version = '173'
  ) then 0::bigint else 1::bigint end as blocker_count
  union all
  select case when exists (
    select 1 from supabase_migrations.schema_migrations m where m.version = '174'
  ) then 0::bigint else 1::bigint end
  union all
  select case when exists (
    select 1 from supabase_migrations.schema_migrations m where m.version = '176'
  ) then 0::bigint else 1::bigint end
  union all
  select case when exists (
    select 1 from supabase_migrations.schema_migrations m where m.version = '177'
  ) then 0::bigint else 1::bigint end
  union all
  select case when
    pg_catalog.octet_length(
      'patch83u_finalize_password_change_after_revocation'
    ) < 63
    and pg_catalog.to_regprocedure(
      'public.patch83u_finalize_password_change_after_revocation(uuid,uuid,text,integer,text)'
    ) is not null
    and (
      select count(*) = 1
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname =
          'patch83u_finalize_password_change_after_revocation'
    )
    and not exists (
      select 1
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname =
          'patch83u_finalize_required_password_change_after_session_revoca'
    )
  then 0::bigint else 1::bigint end
  union all
  select count(*)::bigint
  from (
    values
      (
        'public.patch83u_finalize_password_change_after_revocation(uuid,uuid,text,integer,text)',
        true
      ),
      (
        'public.patch83u_reconcile_credential_state(uuid,uuid,text,text)',
        true
      ),
      (
        'public.patch83u_reconcile_credential_state_standard_impl(uuid,uuid,text,text)',
        false
      ),
      (
        'public.patch83u_reconcile_last_super_admin_recovery(uuid,uuid,text,text)',
        false
      )
  ) required_routine(routine_signature, service_role_execute_expected)
  left join pg_proc routine
    on routine.oid = to_regprocedure(required_routine.routine_signature)
  where routine.oid is null
    or routine.prosecdef is distinct from true
    or not (
      coalesce(routine.proconfig, '{}'::text[])
      @> array['search_path=pg_catalog, public, pg_temp']::text[]
    )
    or routine.proowner is distinct from (
      select guard.proowner
      from pg_proc guard
      where guard.oid = to_regprocedure(
        'public.patch83u_require_service_role()'
      )
    )
    or exists (
      select 1
      from aclexplode(
        coalesce(routine.proacl, acldefault('f', routine.proowner))
      ) acl
      where acl.grantee = 0
        and acl.privilege_type = 'EXECUTE'
    )
    or coalesce(
      has_function_privilege('anon', routine.oid, 'EXECUTE'),
      false
    )
    or coalesce(
      has_function_privilege('authenticated', routine.oid, 'EXECUTE'),
      false
    )
    or coalesce(
      has_function_privilege('service_role', routine.oid, 'EXECUTE'),
      false
    ) is distinct from required_routine.service_role_execute_expected
    or exists (
      select 1
      from aclexplode(
        coalesce(routine.proacl, acldefault('f', routine.proowner))
      ) acl
      where acl.privilege_type = 'EXECUTE'
        and acl.grantee not in (
          routine.proowner,
          (
            select role_entry.oid
            from pg_roles role_entry
            where role_entry.rolname = 'service_role'
          )
        )
    )
  union all
  select case when to_regclass('public.patch83u_runtime_control') is null
    then 1::bigint else 0::bigint end
  union all select absent_column_count from runtime_column_readiness
  union all select case when coalesce(exact_defaults_present, false)
    then 0::bigint else 1::bigint end from runtime_default_readiness
  union all select case when coalesce(exact_constraints_present, false)
    then 0::bigint else 1::bigint end from runtime_constraint_readiness
  union all
  select case when exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'patch83u_runtime_control'
      and c.relkind in ('r', 'p')
      and c.relrowsecurity = true
      and c.relforcerowsecurity = true
  ) then 0::bigint else 1::bigint end
  union all
  select case when to_regprocedure(
    'public.patch83u_transition_runtime(uuid,text,text,text,text,text,uuid,text,text)'
  ) is null then 1::bigint else 0::bigint end
  union all
  select case when to_regprocedure(
    'public.patch83u_get_capabilities(uuid,text,text)'
  ) is null then 1::bigint else 0::bigint end
  union all select count(*)::bigint from employee_id_counts where profile_count > 1
  union all
  select count(*)::bigint
  from public.profiles p
  join auth.users u
    on nullif(btrim(p.employee_no), '') is not null
   and lower(btrim(u.email)) = lower(btrim(p.employee_no)) || '@almodawat.sa'
   and u.id <> p.id
  union all
  select blocker_count from invalid_active_role_assignments
  union all
  select blocker_count from invalid_profile_lifecycle_rows
  union all
  select count(*)::bigint from public.organizations o
  where not exists (
    select 1 from eligible_bootstrap_candidates e where e.organization_id = o.id
  )
  union all
  select case when exists (select 1 from eligible_bootstrap_candidates)
    then 0::bigint else 1::bigint end
)
select
  'runtime_activation_blocker_summary'::text as report_section,
  sum(blocker_count)::bigint as runtime_activation_blocker_count,
  sum(blocker_count) = 0 as preflight_data_and_schema_ready,
  'compatibility_attestation_and_runtime_state_are_verified_by_the_service_transition'::text
    as remaining_transition_proof
from activation_blockers;

with email_identity_counts as (
  select
    u.id as auth_user_id,
    count(i.id) filter (where lower(i.provider) = 'email')::bigint
      as email_provider_identity_count,
    count(i.id) filter (
      where lower(i.provider) = 'email'
        and nullif(btrim(i.identity_data ->> 'email'), '') is not null
        and lower(btrim(i.identity_data ->> 'email')) = lower(btrim(u.email))
    )::bigint as matching_email_provider_identity_count
  from auth.users u
  left join auth.identities i on i.user_id = u.id
  group by u.id
), profile_prediction as (
  select
    p.id as profile_id,
    p.organization_id,
    lower(nullif(btrim(p.employee_no), '')) as normalized_employee_id,
    p.is_active,
    p.user_status,
    coalesce(e.email_provider_identity_count, 0) as email_identity_count,
    coalesce(e.matching_email_provider_identity_count, 0)
      as matching_email_identity_count,
    case
      when p.user_status = 'active'
        and p.is_active = true
        and u.id is not null
        and nullif(btrim(u.email), '') is not null
        and u.email_confirmed_at is not null
        and u.deleted_at is null
        and (u.banned_until is null or u.banned_until <= statement_timestamp())
        and coalesce(e.email_provider_identity_count, 0) = 1
        and coalesce(e.matching_email_provider_identity_count, 0) = 1
        and (
          u.raw_app_meta_data is null
          or (jsonb_typeof(u.raw_app_meta_data) = 'object'
            and not (u.raw_app_meta_data ? 'credential_version'))
          or (jsonb_typeof(u.raw_app_meta_data) = 'object'
            and coalesce(u.raw_app_meta_data ->> 'credential_version', '') ~ '^0+$')
        )
        then 'existing_password_rotation_pending'
      when p.user_status = 'active' and p.is_active = true
        then 'reconciliation_required'
      when p.user_status = 'invited'
        then 'reconciliation_required'
      else 'disabled'
    end as predicted_credential_state
  from public.profiles p
  left join auth.users u on u.id = p.id
  left join email_identity_counts e on e.auth_user_id = u.id
  where p.organization_id is not null
), bootstrap_candidates as (
  select distinct
    p.organization_id,
    ur.user_id
  from public.user_roles ur
  join public.profiles p on p.id = ur.user_id
  join profile_prediction prediction on prediction.profile_id = p.id
  join auth.users u on u.id = p.id
  where ur.is_active = true
    and ur.role = 'super_admin'
    and ur.scope = 'global'
    and p.is_active = true
    and p.user_status = 'active'
    and (ur.organization_id is null or ur.organization_id = p.organization_id)
    and ur.division_id is null
    and ur.department_id is null
    and ur.unit_id is null
    and prediction.predicted_credential_state = 'existing_password_rotation_pending'
    and not exists (
      select 1 from public.profiles collision_profile
      where prediction.normalized_employee_id is not null
        and lower(btrim(collision_profile.employee_no)) = prediction.normalized_employee_id
        and collision_profile.id <> p.id
    )
    and not exists (
      select 1 from auth.users conflicting_user
      where prediction.normalized_employee_id is not null
        and lower(btrim(conflicting_user.email)) =
          prediction.normalized_employee_id || '@almodawat.sa'
        and conflicting_user.id <> p.id
    )
), canonical_preflight as (
  select jsonb_build_object(
    'schema_contract', '174.2-auth-first',
    'installed_schema_version', 174,
    'edge_contract', 'patch83u-edge-auth-first-v1',
    'frontend_contract', 'patch83u-frontend-auth-first-v1',
    'profiles', coalesce((
      select jsonb_agg(
        jsonb_build_array(
          p.profile_id,
          p.organization_id,
          p.normalized_employee_id,
          p.is_active,
          p.user_status,
          p.email_identity_count,
          p.matching_email_identity_count,
          p.predicted_credential_state
        ) order by p.organization_id, p.profile_id
      )
      from profile_prediction p
    ), '[]'::jsonb),
    'active_roles', coalesce((
      select jsonb_agg(
        jsonb_build_array(
          ur.id, ur.user_id, ur.role, ur.scope, ur.organization_id,
          ur.division_id, ur.department_id, ur.unit_id
        ) order by ur.id
      )
      from public.user_roles ur
      where ur.is_active = true
    ), '[]'::jsonb),
    'bootstrap_candidates', coalesce((
      select jsonb_agg(
        jsonb_build_array(b.organization_id, b.user_id)
        order by b.organization_id, b.user_id
      )
      from bootstrap_candidates b
    ), '[]'::jsonb),
    'organizations', coalesce((
      select jsonb_agg(o.id order by o.id)
      from public.organizations o
    ), '[]'::jsonb),
    'synthetic_email_conflicts', coalesce((
      select jsonb_agg(
        jsonb_build_array(p.id, u.id)
        order by p.id, u.id
      )
      from public.profiles p
      join auth.users u
        on nullif(btrim(p.employee_no), '') is not null
       and lower(btrim(u.email)) = lower(btrim(p.employee_no)) || '@almodawat.sa'
       and u.id <> p.id
    ), '[]'::jsonb)
  ) as canonical_document
)
select
  'patch83u_deterministic_preflight_hash'::text as report_section,
  'sha256'::text as preflight_hash_algorithm,
  encode(
    digest(convert_to(canonical_document::text, 'UTF8'), 'sha256'),
    'hex'
  ) as preflight_hash,
  'ordered_nonsecret_identity_role_and_bootstrap_projection'::text
    as preflight_hash_scope
from canonical_preflight;
