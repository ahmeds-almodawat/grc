-- Disposable Gate 11 contract fixture. Synthetic identifiers only.
-- This fixture is never applied to hosted environments and is destroyed with the
-- isolated local database after validation.
\set ON_ERROR_STOP on

begin;

select set_config('request.jwt.claim.role', 'service_role', true);

insert into public.organizations (id, name_en, is_active, created_at, updated_at)
values (
  '11000000-0000-4000-8000-000000000001'::uuid,
  'Gate 11 Synthetic Organization',
  true,
  timestamptz '2000-01-01 00:00:00+00',
  timestamptz '2000-01-01 00:00:00+00'
);

insert into auth.users (
  id, aud, role, email, email_confirmed_at, raw_app_meta_data, created_at, updated_at
) values (
  '11000000-0000-4000-8000-000000000011'::uuid,
  'authenticated',
  'authenticated',
  'gate11-admin@example.invalid',
  timestamptz '2000-01-01 00:00:00+00',
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'credential_version', 1),
  timestamptz '2000-01-01 00:00:00+00',
  timestamptz '2000-01-01 00:00:00+00'
);

insert into public.profiles (
  id, organization_id, employee_no, full_name_en, email, is_active,
  user_status, user_type, created_at, updated_at
) values (
  '11000000-0000-4000-8000-000000000011'::uuid,
  '11000000-0000-4000-8000-000000000001'::uuid,
  'GATE11-ADMIN',
  'Gate 11 Synthetic Administrator',
  'gate11-admin@example.invalid',
  true,
  'active',
  'employee',
  timestamptz '2000-01-01 00:00:00+00',
  timestamptz '2000-01-01 00:00:00+00'
);

insert into public.user_roles (
  id, user_id, role, scope, organization_id, is_active, assigned_at
) values (
  '11000000-0000-4000-8000-000000000021'::uuid,
  '11000000-0000-4000-8000-000000000011'::uuid,
  'super_admin',
  'global',
  '11000000-0000-4000-8000-000000000001'::uuid,
  true,
  timestamptz '2000-01-01 00:00:00+00'
);

update public.patch83u_runtime_control
set enforcement_state = 'enforced',
    prepared_at = timestamptz '2000-01-01 00:00:00+00',
    prepared_by = '11000000-0000-4000-8000-000000000011'::uuid,
    activated_at = timestamptz '2000-01-01 00:00:00+00',
    activated_by = '11000000-0000-4000-8000-000000000011'::uuid,
    designated_super_admin_id = '11000000-0000-4000-8000-000000000011'::uuid,
    preflight_hash = repeat('0', 64),
    compatibility_attested_at = timestamptz '2000-01-01 00:00:00+00',
    compatibility_attested_by = '11000000-0000-4000-8000-000000000011'::uuid,
    compatible_edge_contract_version = expected_edge_contract_version,
    compatible_frontend_contract_version = expected_frontend_contract_version,
    state_version = 5,
    updated_at = timestamptz '2000-01-01 00:00:00+00'
where singleton;

commit;
