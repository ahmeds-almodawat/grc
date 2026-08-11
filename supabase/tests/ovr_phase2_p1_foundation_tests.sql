-- GRC v1.1 OVR Phase 2 P1 behavioral contracts.
-- Run against a disposable local database after migrations 191 and 192.
-- Every fixture mutation except the explicit cross-session concurrency proof is
-- enclosed in this transaction and rolled back by the caller.

begin;

create extension if not exists pgtap;
select no_plan();
select pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);

insert into public.organizations (id, name_en) values
  ('91100000-0000-4000-8000-000000000001', 'P1 Contract Organization'),
  ('91100000-0000-4000-8000-000000000002', 'P1 Other Organization');

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
select id, 'authenticated', 'authenticated', email, '', now(), now(), now()
from (values
  ('91100000-0000-4000-8000-000000000010'::uuid, 'p1-actor@example.test'),
  ('91100000-0000-4000-8000-000000000013'::uuid, 'p1-second-actor@example.test'),
  ('91100000-0000-4000-8000-000000000011'::uuid, 'p1-no-role@example.test'),
  ('91100000-0000-4000-8000-000000000012'::uuid, 'p1-other-actor@example.test'),
  ('91100000-0000-4000-8000-000000000020'::uuid, 'p1-reporter@example.test'),
  ('91100000-0000-4000-8000-000000000021'::uuid, 'p1-reporter-no-manager@example.test'),
  ('91100000-0000-4000-8000-000000000030'::uuid, 'p1-primary-manager@example.test'),
  ('91100000-0000-4000-8000-000000000031'::uuid, 'p1-secondary-manager@example.test'),
  ('91100000-0000-4000-8000-000000000037'::uuid, 'p1-archived-reviewer@example.test'),
  ('91100000-0000-4000-8000-000000000038'::uuid, 'p1-inactive-reviewer@example.test'),
  ('91100000-0000-4000-8000-000000000039'::uuid, 'p1-duplicate-role@example.test'),
  ('91100000-0000-4000-8000-000000000040'::uuid, 'p1-quality-a@example.test'),
  ('91100000-0000-4000-8000-000000000041'::uuid, 'p1-quality-b@example.test'),
  ('91100000-0000-4000-8000-000000000042'::uuid, 'p1-tie-a@example.test'),
  ('91100000-0000-4000-8000-000000000043'::uuid, 'p1-tie-b@example.test'),
  ('91100000-0000-4000-8000-000000000044'::uuid, 'p1-role-only@example.test'),
  ('91100000-0000-4000-8000-000000000045'::uuid, 'p1-referred@example.test'),
  ('91100000-0000-4000-8000-000000000046'::uuid, 'p1-subject@example.test'),
  ('91100000-0000-4000-8000-000000000047'::uuid, 'p1-subject-manager@example.test'),
  ('91100000-0000-4000-8000-000000000048'::uuid, 'p1-involved@example.test'),
  ('91100000-0000-4000-8000-000000000049'::uuid, 'p1-inactive-related@example.test'),
  ('91100000-0000-4000-8000-000000000060'::uuid, 'p1-other-org-reviewer@example.test'),
  ('91100000-0000-4000-8000-000000000061'::uuid, 'p1-other-org-candidate@example.test')
) as fixture(id, email);

insert into public.profiles (
  id, organization_id, full_name_en, email, employee_no, is_active, user_status
)
select id,
       case when id in (
         '91100000-0000-4000-8000-000000000012'::uuid,
         '91100000-0000-4000-8000-000000000060'::uuid,
         '91100000-0000-4000-8000-000000000061'::uuid
       ) then '91100000-0000-4000-8000-000000000002'::uuid
       else '91100000-0000-4000-8000-000000000001'::uuid end,
       'P1 ' || right(id::text, 4),
       email,
       'P1-' || right(replace(id::text, '-', ''), 8),
       true,
       'active'
from (values
  ('91100000-0000-4000-8000-000000000010'::uuid, 'p1-actor@example.test'),
  ('91100000-0000-4000-8000-000000000013'::uuid, 'p1-second-actor@example.test'),
  ('91100000-0000-4000-8000-000000000011'::uuid, 'p1-no-role@example.test'),
  ('91100000-0000-4000-8000-000000000012'::uuid, 'p1-other-actor@example.test'),
  ('91100000-0000-4000-8000-000000000020'::uuid, 'p1-reporter@example.test'),
  ('91100000-0000-4000-8000-000000000021'::uuid, 'p1-reporter-no-manager@example.test'),
  ('91100000-0000-4000-8000-000000000030'::uuid, 'p1-primary-manager@example.test'),
  ('91100000-0000-4000-8000-000000000031'::uuid, 'p1-secondary-manager@example.test'),
  ('91100000-0000-4000-8000-000000000037'::uuid, 'p1-archived-reviewer@example.test'),
  ('91100000-0000-4000-8000-000000000038'::uuid, 'p1-inactive-reviewer@example.test'),
  ('91100000-0000-4000-8000-000000000039'::uuid, 'p1-duplicate-role@example.test'),
  ('91100000-0000-4000-8000-000000000040'::uuid, 'p1-quality-a@example.test'),
  ('91100000-0000-4000-8000-000000000041'::uuid, 'p1-quality-b@example.test'),
  ('91100000-0000-4000-8000-000000000042'::uuid, 'p1-tie-a@example.test'),
  ('91100000-0000-4000-8000-000000000043'::uuid, 'p1-tie-b@example.test'),
  ('91100000-0000-4000-8000-000000000044'::uuid, 'p1-role-only@example.test'),
  ('91100000-0000-4000-8000-000000000045'::uuid, 'p1-referred@example.test'),
  ('91100000-0000-4000-8000-000000000046'::uuid, 'p1-subject@example.test'),
  ('91100000-0000-4000-8000-000000000047'::uuid, 'p1-subject-manager@example.test'),
  ('91100000-0000-4000-8000-000000000048'::uuid, 'p1-involved@example.test'),
  ('91100000-0000-4000-8000-000000000049'::uuid, 'p1-inactive-related@example.test'),
  ('91100000-0000-4000-8000-000000000060'::uuid, 'p1-other-org-reviewer@example.test'),
  ('91100000-0000-4000-8000-000000000061'::uuid, 'p1-other-org-candidate@example.test')
) as fixture(id, email);

insert into public.user_credential_states (
  user_id, organization_id, auth_email, identity_mode, credential_state,
  requested_lifecycle, credential_version
)
select p.id, p.organization_id, p.email, 'legacy_verified', 'active', 'active', 1
from public.profiles p
where p.id::text like '91100000-0000-4000-8000-%'
on conflict (user_id) do update
set organization_id = excluded.organization_id,
    auth_email = excluded.auth_email,
    identity_mode = excluded.identity_mode,
    credential_state = excluded.credential_state,
    requested_lifecycle = excluded.requested_lifecycle,
    credential_version = excluded.credential_version,
    session_valid_after = clock_timestamp();

insert into public.divisions (id, organization_id, name_en, code) values
  ('91100000-0000-4000-8000-000000000101', '91100000-0000-4000-8000-000000000001', 'P1 Division', 'P1-DIV'),
  ('91100000-0000-4000-8000-000000000102', '91100000-0000-4000-8000-000000000002', 'P1 Other Division', 'P1-ODIV');

insert into public.departments (id, organization_id, division_id, name_en, code) values
  ('91100000-0000-4000-8000-000000000111', '91100000-0000-4000-8000-000000000001', '91100000-0000-4000-8000-000000000101', 'P1 Department', 'P1-DEPT'),
  ('91100000-0000-4000-8000-000000000112', '91100000-0000-4000-8000-000000000002', '91100000-0000-4000-8000-000000000102', 'P1 Other Department', 'P1-ODEPT');

update public.profiles
set division_id = case when organization_id = '91100000-0000-4000-8000-000000000001'
                       then '91100000-0000-4000-8000-000000000101'::uuid
                       else '91100000-0000-4000-8000-000000000102'::uuid end,
    department_id = case when organization_id = '91100000-0000-4000-8000-000000000001'
                         then '91100000-0000-4000-8000-000000000111'::uuid
                         else '91100000-0000-4000-8000-000000000112'::uuid end
where id::text like '91100000-0000-4000-8000-%';

insert into public.user_roles (user_id, role, scope, organization_id, department_id, is_active) values
  ('91100000-0000-4000-8000-000000000010', 'governance_admin', 'global', '91100000-0000-4000-8000-000000000001', null, true),
  ('91100000-0000-4000-8000-000000000013', 'governance_admin', 'global', '91100000-0000-4000-8000-000000000001', null, true),
  ('91100000-0000-4000-8000-000000000012', 'governance_admin', 'global', '91100000-0000-4000-8000-000000000002', null, true),
  ('91100000-0000-4000-8000-000000000030', 'department_manager', 'department', '91100000-0000-4000-8000-000000000001', '91100000-0000-4000-8000-000000000111', true),
  ('91100000-0000-4000-8000-000000000031', 'department_manager', 'department', '91100000-0000-4000-8000-000000000001', '91100000-0000-4000-8000-000000000111', true),
  ('91100000-0000-4000-8000-000000000039', 'governance_admin', 'global', null, null, true),
  ('91100000-0000-4000-8000-000000000039', 'governance_admin', 'global', '91100000-0000-4000-8000-000000000001', null, true),
  ('91100000-0000-4000-8000-000000000040', 'governance_admin', 'global', '91100000-0000-4000-8000-000000000001', null, true),
  ('91100000-0000-4000-8000-000000000041', 'compliance_officer', 'global', '91100000-0000-4000-8000-000000000001', null, true),
  ('91100000-0000-4000-8000-000000000042', 'governance_admin', 'global', '91100000-0000-4000-8000-000000000001', null, true),
  ('91100000-0000-4000-8000-000000000043', 'compliance_officer', 'global', '91100000-0000-4000-8000-000000000001', null, true),
  ('91100000-0000-4000-8000-000000000044', 'super_admin', 'global', '91100000-0000-4000-8000-000000000001', null, true),
  ('91100000-0000-4000-8000-000000000047', 'department_manager', 'department', '91100000-0000-4000-8000-000000000001', '91100000-0000-4000-8000-000000000111', true),
  ('91100000-0000-4000-8000-000000000047', 'governance_admin', 'global', '91100000-0000-4000-8000-000000000001', null, true),
  ('91100000-0000-4000-8000-000000000060', 'governance_admin', 'global', '91100000-0000-4000-8000-000000000002', null, true),
  ('91100000-0000-4000-8000-000000000061', 'compliance_officer', 'global', '91100000-0000-4000-8000-000000000002', null, true);

update public.profiles
set user_status = 'inactive', is_active = false,
    deactivated_at = now(), deactivated_by = '91100000-0000-4000-8000-000000000010',
    deactivation_reason = 'P1 inactive-reviewer fixture'
where id = '91100000-0000-4000-8000-000000000038';

update public.profiles
set user_status = 'archived', is_active = false,
    deactivated_at = now(), deactivated_by = '91100000-0000-4000-8000-000000000010',
    deactivation_reason = 'P1 archived-reviewer fixture'
where id = '91100000-0000-4000-8000-000000000037';

-- A. Organization isolation and B. reporting-line cardinality.
insert into public.organization_reporting_lines (
  id, organization_id, employee_profile_id, manager_profile_id,
  relationship_type, is_primary, provenance, asserted_by, confirmed_by,
  confirmed_at, is_active
) values
  ('91100000-0000-4000-8000-000000000201', '91100000-0000-4000-8000-000000000001',
   '91100000-0000-4000-8000-000000000020', '91100000-0000-4000-8000-000000000030',
   'direct', true, 'governance_confirmation', '91100000-0000-4000-8000-000000000010',
   '91100000-0000-4000-8000-000000000010', now(), true),
  ('91100000-0000-4000-8000-000000000202', '91100000-0000-4000-8000-000000000001',
   '91100000-0000-4000-8000-000000000020', '91100000-0000-4000-8000-000000000031',
   'dotted_line', false, 'governance_confirmation', '91100000-0000-4000-8000-000000000010',
   '91100000-0000-4000-8000-000000000010', now(), true),
  ('91100000-0000-4000-8000-000000000203', '91100000-0000-4000-8000-000000000001',
   '91100000-0000-4000-8000-000000000046', '91100000-0000-4000-8000-000000000047',
   'direct', true, 'governance_confirmation', '91100000-0000-4000-8000-000000000010',
   '91100000-0000-4000-8000-000000000010', now(), true),
  ('91100000-0000-4000-8000-000000000207', '91100000-0000-4000-8000-000000000002',
   '91100000-0000-4000-8000-000000000012', '91100000-0000-4000-8000-000000000060',
   'direct', true, 'governance_confirmation', '91100000-0000-4000-8000-000000000012',
   '91100000-0000-4000-8000-000000000012', now(), true);

select is(
  (select count(*)::integer from public.organization_reporting_lines
   where employee_profile_id = '91100000-0000-4000-8000-000000000020' and is_active),
  2,
  'one primary plus secondary reporting lines are permitted'
);

select throws_ok(
  $$insert into public.organization_reporting_lines (
      organization_id, employee_profile_id, manager_profile_id, relationship_type,
      is_primary, provenance, asserted_by, confirmed_by, confirmed_at, is_active
    ) values (
      '91100000-0000-4000-8000-000000000001',
      '91100000-0000-4000-8000-000000000020',
      '91100000-0000-4000-8000-000000000047', 'direct', true,
      'governance_confirmation', '91100000-0000-4000-8000-000000000010',
      '91100000-0000-4000-8000-000000000010', now(), true
    )$$,
  '23505', null,
  'a second active primary direct manager is rejected'
);

select throws_ok(
  $$insert into public.organization_reporting_lines (
      organization_id, employee_profile_id, manager_profile_id, relationship_type,
      is_primary, provenance, asserted_by, is_active
    ) values (
      '91100000-0000-4000-8000-000000000001',
      '91100000-0000-4000-8000-000000000020',
      '91100000-0000-4000-8000-000000000060', 'dotted_line', false,
      'governance_confirmation', '91100000-0000-4000-8000-000000000010', true
    )$$,
  '23503', null,
  'cross-organization reporting-line insertion is rejected'
);

-- Shared OVR fixtures. Existing OVR business columns are not updated by P1.
insert into public.ovr_reports (
  id, organization_id, ovr_number, brief_description, occurrence_category,
  department_id, division_id, reported_by, created_by, status, severity_level
) values
  ('91100000-0000-4000-8000-000000000301', '91100000-0000-4000-8000-000000000001', 'OVR-P1-001', 'P1 conflict fixture', 'other', '91100000-0000-4000-8000-000000000111', '91100000-0000-4000-8000-000000000101', '91100000-0000-4000-8000-000000000020', '91100000-0000-4000-8000-000000000020', 'submitted', 'level_2'),
  ('91100000-0000-4000-8000-000000000302', '91100000-0000-4000-8000-000000000001', 'OVR-P1-002', 'P1 missing hierarchy', 'other', '91100000-0000-4000-8000-000000000111', '91100000-0000-4000-8000-000000000101', '91100000-0000-4000-8000-000000000021', '91100000-0000-4000-8000-000000000021', 'submitted', 'level_2'),
  ('91100000-0000-4000-8000-000000000303', '91100000-0000-4000-8000-000000000001', 'OVR-P1-003', 'P1 retaliation routing', 'other', '91100000-0000-4000-8000-000000000111', '91100000-0000-4000-8000-000000000101', '91100000-0000-4000-8000-000000000020', '91100000-0000-4000-8000-000000000020', 'submitted', 'level_3'),
  ('91100000-0000-4000-8000-000000000304', '91100000-0000-4000-8000-000000000001', 'OVR-P1-004', 'P1 deterministic routing', 'other', '91100000-0000-4000-8000-000000000111', '91100000-0000-4000-8000-000000000101', '91100000-0000-4000-8000-000000000020', '91100000-0000-4000-8000-000000000020', 'quality_validation', 'level_2'),
  ('91100000-0000-4000-8000-000000000305', '91100000-0000-4000-8000-000000000001', 'OVR-P1-005', 'P1 late conflict', 'other', '91100000-0000-4000-8000-000000000111', '91100000-0000-4000-8000-000000000101', '91100000-0000-4000-8000-000000000020', '91100000-0000-4000-8000-000000000020', 'quality_validation', 'level_2'),
  ('91100000-0000-4000-8000-000000000306', '91100000-0000-4000-8000-000000000001', 'OVR-P1-006', 'P1 recusal', 'other', '91100000-0000-4000-8000-000000000111', '91100000-0000-4000-8000-000000000101', '91100000-0000-4000-8000-000000000020', '91100000-0000-4000-8000-000000000020', 'quality_validation', 'level_2'),
  ('91100000-0000-4000-8000-000000000307', '91100000-0000-4000-8000-000000000001', 'OVR-P1-007', 'P1 confidential routing', 'other', '91100000-0000-4000-8000-000000000111', '91100000-0000-4000-8000-000000000101', '91100000-0000-4000-8000-000000000020', '91100000-0000-4000-8000-000000000020', 'submitted', 'level_2'),
  ('91100000-0000-4000-8000-000000000308', '91100000-0000-4000-8000-000000000002', 'OVR-P1-008', 'P1 other organization', 'other', '91100000-0000-4000-8000-000000000112', '91100000-0000-4000-8000-000000000102', '91100000-0000-4000-8000-000000000012', '91100000-0000-4000-8000-000000000012', 'quality_validation', 'level_2'),
  ('91100000-0000-4000-8000-000000000309', '91100000-0000-4000-8000-000000000001', 'OVR-P1-009', 'P1 late manager conflict', 'other', '91100000-0000-4000-8000-000000000111', '91100000-0000-4000-8000-000000000101', '91100000-0000-4000-8000-000000000020', '91100000-0000-4000-8000-000000000020', 'quality_validation', 'level_2');

insert into public.ovr_relationship_state (
  organization_id, ovr_report_id, sensitivity, routing_status, routing_block_reason
) values
  ('91100000-0000-4000-8000-000000000001', '91100000-0000-4000-8000-000000000301', 'normal', 'ready', null),
  ('91100000-0000-4000-8000-000000000001', '91100000-0000-4000-8000-000000000302', 'normal', 'ready', null),
  ('91100000-0000-4000-8000-000000000001', '91100000-0000-4000-8000-000000000303', 'retaliation_sensitive', 'ready', null),
  ('91100000-0000-4000-8000-000000000001', '91100000-0000-4000-8000-000000000304', 'normal', 'ready', null),
  ('91100000-0000-4000-8000-000000000001', '91100000-0000-4000-8000-000000000305', 'normal', 'ready', null),
  ('91100000-0000-4000-8000-000000000001', '91100000-0000-4000-8000-000000000306', 'normal', 'ready', null),
  ('91100000-0000-4000-8000-000000000001', '91100000-0000-4000-8000-000000000307', 'confidential', 'ready', null),
  ('91100000-0000-4000-8000-000000000002', '91100000-0000-4000-8000-000000000308', 'normal', 'ready', null),
  ('91100000-0000-4000-8000-000000000001', '91100000-0000-4000-8000-000000000309', 'normal', 'ready', null);

-- C-H: direct and derived conflicts union together server-side.
insert into public.ovr_related_persons (
  id, organization_id, ovr_report_id, profile_id, relationship_type,
  provenance, asserted_by, confirmation_status, confirmed_by, confirmed_at,
  is_active
) values
  ('91100000-0000-4000-8000-000000000401', '91100000-0000-4000-8000-000000000001', '91100000-0000-4000-8000-000000000301', '91100000-0000-4000-8000-000000000020', 'reporter', 'report_submission', '91100000-0000-4000-8000-000000000010', 'confirmed', '91100000-0000-4000-8000-000000000010', now(), true),
  ('91100000-0000-4000-8000-000000000402', '91100000-0000-4000-8000-000000000001', '91100000-0000-4000-8000-000000000301', '91100000-0000-4000-8000-000000000048', 'involved_person', 'quality_confirmation', '91100000-0000-4000-8000-000000000010', 'confirmed', '91100000-0000-4000-8000-000000000010', now(), true),
  ('91100000-0000-4000-8000-000000000403', '91100000-0000-4000-8000-000000000001', '91100000-0000-4000-8000-000000000301', '91100000-0000-4000-8000-000000000046', 'subject', 'quality_confirmation', '91100000-0000-4000-8000-000000000010', 'confirmed', '91100000-0000-4000-8000-000000000010', now(), true),
  ('91100000-0000-4000-8000-000000000404', '91100000-0000-4000-8000-000000000001', '91100000-0000-4000-8000-000000000301', '91100000-0000-4000-8000-000000000045', 'referred_party', 'referral', '91100000-0000-4000-8000-000000000010', 'confirmed', '91100000-0000-4000-8000-000000000010', now(), true),
  ('91100000-0000-4000-8000-000000000405', '91100000-0000-4000-8000-000000000001', '91100000-0000-4000-8000-000000000301', '91100000-0000-4000-8000-000000000049', 'other', 'quality_confirmation', '91100000-0000-4000-8000-000000000010', 'confirmed', '91100000-0000-4000-8000-000000000010', now(), false),
  ('91100000-0000-4000-8000-000000000406', '91100000-0000-4000-8000-000000000001', '91100000-0000-4000-8000-000000000309', '91100000-0000-4000-8000-000000000048', 'subject', 'quality_confirmation', '91100000-0000-4000-8000-000000000010', 'confirmed', '91100000-0000-4000-8000-000000000010', now(), true),
  ('91100000-0000-4000-8000-000000000407', '91100000-0000-4000-8000-000000000002', '91100000-0000-4000-8000-000000000308', '91100000-0000-4000-8000-000000000060', 'subject', 'quality_confirmation', '91100000-0000-4000-8000-000000000012', 'confirmed', '91100000-0000-4000-8000-000000000012', now(), true);

select throws_ok(
  $$insert into public.ovr_related_persons (
      organization_id, ovr_report_id, non_user_subject_key, relationship_type,
      provenance, asserted_by, confirmation_status, confirmed_at, is_active
    ) values (
      '91100000-0000-4000-8000-000000000001',
      '91100000-0000-4000-8000-000000000301',
      'p1-unattributed-confirmation', 'other', 'quality_confirmation',
      '91100000-0000-4000-8000-000000000010', 'confirmed', now(), true
    )$$,
  '23514', null,
  'confirmed related-person state requires both confirmer and timestamp'
);

select ok(exists(
  select 1 from ovr_v11_private.current_conflicts(
    '91100000-0000-4000-8000-000000000001', '91100000-0000-4000-8000-000000000301', 'manager_review', clock_timestamp()
  ) where affected_profile_id = '91100000-0000-4000-8000-000000000020' and conflict_basis = 'reporter'
), 'reporter conflict is authoritative');

select ok(exists(
  select 1 from ovr_v11_private.current_conflicts(
    '91100000-0000-4000-8000-000000000001', '91100000-0000-4000-8000-000000000301', 'quality_review', clock_timestamp()
  ) where affected_profile_id = '91100000-0000-4000-8000-000000000048' and conflict_basis = 'involved_person'
), 'involved-person conflict is authoritative');

select ok(exists(
  select 1 from ovr_v11_private.current_conflicts(
    '91100000-0000-4000-8000-000000000001', '91100000-0000-4000-8000-000000000301', 'final_verdict', clock_timestamp()
  ) where affected_profile_id = '91100000-0000-4000-8000-000000000046' and conflict_basis = 'subject'
), 'subject conflict is authoritative');

select ok(exists(
  select 1 from ovr_v11_private.current_conflicts(
    '91100000-0000-4000-8000-000000000001', '91100000-0000-4000-8000-000000000301', 'manager_review', clock_timestamp()
  ) where affected_profile_id = '91100000-0000-4000-8000-000000000047' and conflict_basis = 'manager_of_subject'
), 'manager-of-subject conflict is authoritative');

select ok(exists(
  select 1 from ovr_v11_private.current_conflicts(
    '91100000-0000-4000-8000-000000000001', '91100000-0000-4000-8000-000000000301', 'evidence_governance', clock_timestamp()
  ) where affected_profile_id = '91100000-0000-4000-8000-000000000045' and conflict_basis = 'referred_party'
), 'referred-party conflict is authoritative');

select cmp_ok((
  select count(distinct affected_profile_id)
  from ovr_v11_private.current_conflicts(
    '91100000-0000-4000-8000-000000000001', '91100000-0000-4000-8000-000000000301', 'governance_closure', clock_timestamp()
  )
), '>=', 5::bigint, 'multiple related-person conflicts are unioned');

select ok(not exists(
  select 1 from ovr_v11_private.current_conflicts(
    '91100000-0000-4000-8000-000000000001', '91100000-0000-4000-8000-000000000301', 'quality_review', clock_timestamp()
  ) where affected_profile_id = '91100000-0000-4000-8000-000000000049'
), 'inactive related-person rows do not create a current conflict');

update public.ovr_related_persons
set is_active = true, relationship_type = 'subject'
where id = '91100000-0000-4000-8000-000000000405';
update public.profiles
set user_status = 'archived', is_active = false,
    deactivated_at = now(), deactivated_by = '91100000-0000-4000-8000-000000000010',
    deactivation_reason = 'P1 archived-related-person fixture'
where id = '91100000-0000-4000-8000-000000000049';
select ok(exists(
  select 1 from ovr_v11_private.current_conflicts(
    '91100000-0000-4000-8000-000000000001', '91100000-0000-4000-8000-000000000301', 'quality_review', clock_timestamp()
  ) where affected_profile_id = '91100000-0000-4000-8000-000000000049'
), 'archiving a profile does not erase an active factual case relationship');

select throws_ok(
  $$insert into public.ovr_related_persons (
      organization_id, ovr_report_id, profile_id, relationship_type, provenance,
      asserted_by, confirmation_status, confirmed_by, confirmed_at, is_active
    ) values (
      '91100000-0000-4000-8000-000000000001',
      '91100000-0000-4000-8000-000000000301',
      '91100000-0000-4000-8000-000000000060', 'subject', 'quality_confirmation',
      '91100000-0000-4000-8000-000000000010', 'confirmed',
      '91100000-0000-4000-8000-000000000010', clock_timestamp(), true
    )$$,
  '23503', null,
  'cross-organization related-person insertion is rejected'
);

select throws_ok(
  $$insert into public.ovr_conflict_events (
      organization_id, ovr_report_id, related_person_id, affected_profile_id,
      event_type, protected_action, conflict_basis, actor_id,
      source_provenance, current_relationship_version
    ) values (
      '91100000-0000-4000-8000-000000000001',
      '91100000-0000-4000-8000-000000000301',
      '91100000-0000-4000-8000-000000000407',
      '91100000-0000-4000-8000-000000000020',
      'conflict_detected', 'quality_review', 'cross_org_related_source',
      '91100000-0000-4000-8000-000000000010', 'system_reconciliation', 0
    )$$,
  '23503', null,
  'conflict event cannot reference another organization related-person source'
);

select throws_ok(
  $$insert into public.ovr_conflict_events (
      organization_id, ovr_report_id, reporting_line_id, affected_profile_id,
      event_type, protected_action, conflict_basis, actor_id,
      source_provenance, current_relationship_version
    ) values (
      '91100000-0000-4000-8000-000000000001',
      '91100000-0000-4000-8000-000000000301',
      '91100000-0000-4000-8000-000000000207',
      '91100000-0000-4000-8000-000000000020',
      'conflict_detected', 'quality_review', 'cross_org_reporting_source',
      '91100000-0000-4000-8000-000000000010', 'system_reconciliation', 0
    )$$,
  '23503', null,
  'conflict event cannot reference another organization reporting-line source'
);

-- Reviewer pools. Duplicate app-role evidence is intentionally left on profile 039.
insert into public.ovr_reviewer_pool_memberships (
  id, organization_id, profile_id, capability, scope, division_id,
  department_id, priority, confidential_clearance, retaliation_clearance,
  valid_from, is_active, created_by
) values
  ('91100000-0000-4000-8000-000000000501', '91100000-0000-4000-8000-000000000001', '91100000-0000-4000-8000-000000000030', 'manager_review', 'department', null, '91100000-0000-4000-8000-000000000111', 10, false, false, now() - interval '1 day', true, '91100000-0000-4000-8000-000000000010'),
  ('91100000-0000-4000-8000-000000000502', '91100000-0000-4000-8000-000000000001', '91100000-0000-4000-8000-000000000031', 'manager_review', 'department', null, '91100000-0000-4000-8000-000000000111', 20, true, false, now() - interval '1 day', true, '91100000-0000-4000-8000-000000000010'),
  ('91100000-0000-4000-8000-000000000503', '91100000-0000-4000-8000-000000000001', '91100000-0000-4000-8000-000000000039', 'quality_review', 'global', null, null, 1, true, true, now() - interval '1 day', true, '91100000-0000-4000-8000-000000000010'),
  ('91100000-0000-4000-8000-000000000504', '91100000-0000-4000-8000-000000000001', '91100000-0000-4000-8000-000000000040', 'quality_review', 'global', null, null, 10, true, true, now() - interval '1 day', true, '91100000-0000-4000-8000-000000000010'),
  ('91100000-0000-4000-8000-000000000505', '91100000-0000-4000-8000-000000000001', '91100000-0000-4000-8000-000000000041', 'quality_review', 'global', null, null, 20, true, true, now() - interval '1 day', true, '91100000-0000-4000-8000-000000000010'),
  ('91100000-0000-4000-8000-000000000506', '91100000-0000-4000-8000-000000000001', '91100000-0000-4000-8000-000000000040', 'final_verdict', 'global', null, null, 10, true, true, now() - interval '1 day', true, '91100000-0000-4000-8000-000000000010'),
  ('91100000-0000-4000-8000-000000000507', '91100000-0000-4000-8000-000000000001', '91100000-0000-4000-8000-000000000041', 'final_verdict', 'global', null, null, 20, true, true, now() - interval '1 day', true, '91100000-0000-4000-8000-000000000010'),
  ('91100000-0000-4000-8000-000000000508', '91100000-0000-4000-8000-000000000001', '91100000-0000-4000-8000-000000000037', 'quality_review', 'global', null, null, 0, true, true, now() - interval '1 day', true, '91100000-0000-4000-8000-000000000010'),
  ('91100000-0000-4000-8000-000000000509', '91100000-0000-4000-8000-000000000001', '91100000-0000-4000-8000-000000000038', 'quality_review', 'global', null, null, 0, true, true, now() - interval '1 day', true, '91100000-0000-4000-8000-000000000010'),
  ('91100000-0000-4000-8000-000000000510', '91100000-0000-4000-8000-000000000001', '91100000-0000-4000-8000-000000000040', 'evidence_governance', 'global', null, null, 10, true, true, now() - interval '1 day', true, '91100000-0000-4000-8000-000000000010'),
  ('91100000-0000-4000-8000-000000000511', '91100000-0000-4000-8000-000000000001', '91100000-0000-4000-8000-000000000041', 'evidence_governance', 'global', null, null, 20, true, true, now() - interval '1 day', true, '91100000-0000-4000-8000-000000000010'),
  ('91100000-0000-4000-8000-000000000512', '91100000-0000-4000-8000-000000000001', '91100000-0000-4000-8000-000000000047', 'final_verdict', 'global', null, null, 1, true, true, now() - interval '1 day', true, '91100000-0000-4000-8000-000000000010'),
  ('91100000-0000-4000-8000-000000000513', '91100000-0000-4000-8000-000000000001', '91100000-0000-4000-8000-000000000041', 'evidence_governance', 'department', null, '91100000-0000-4000-8000-000000000111', 5, true, true, now() - interval '12 hours', true, '91100000-0000-4000-8000-000000000010'),
  ('91100000-0000-4000-8000-000000000514', '91100000-0000-4000-8000-000000000001', '91100000-0000-4000-8000-000000000042', 'governance_closure', 'global', null, null, 10, true, true, now() - interval '1 day', true, '91100000-0000-4000-8000-000000000010'),
  ('91100000-0000-4000-8000-000000000515', '91100000-0000-4000-8000-000000000001', '91100000-0000-4000-8000-000000000043', 'governance_closure', 'global', null, null, 10, true, true, now() - interval '1 day', true, '91100000-0000-4000-8000-000000000010'),
  -- Opposite physical order from 511/513: the canonical department membership
  -- is inserted before the simultaneously eligible global membership.
  ('91100000-0000-4000-8000-000000000517', '91100000-0000-4000-8000-000000000002', '91100000-0000-4000-8000-000000000061', 'quality_review', 'department', null, '91100000-0000-4000-8000-000000000112', 5, true, true, now() - interval '12 hours', true, '91100000-0000-4000-8000-000000000012'),
  ('91100000-0000-4000-8000-000000000516', '91100000-0000-4000-8000-000000000002', '91100000-0000-4000-8000-000000000061', 'quality_review', 'global', null, null, 10, true, true, now() - interval '1 day', true, '91100000-0000-4000-8000-000000000012');

select throws_ok(
  $$insert into public.ovr_reviewer_pool_memberships (
      organization_id, profile_id, capability, scope, priority, valid_from, is_active, created_by
    ) values (
      '91100000-0000-4000-8000-000000000001',
      '91100000-0000-4000-8000-000000000060', 'quality_review', 'global', 10,
      now() - interval '1 day', true, '91100000-0000-4000-8000-000000000010'
    )$$,
  '23503', null,
  'cross-organization reviewer membership is rejected'
);

-- Review-cycle and stage fixtures.
insert into public.ovr_review_cycles (
  id, organization_id, ovr_report_id, cycle_number, status, opened_at, opened_by,
  closed_at, closed_by
) values
  ('91100000-0000-4000-8000-000000000601', '91100000-0000-4000-8000-000000000001', '91100000-0000-4000-8000-000000000302', 1, 'active', now(), '91100000-0000-4000-8000-000000000010', null, null),
  ('91100000-0000-4000-8000-000000000602', '91100000-0000-4000-8000-000000000001', '91100000-0000-4000-8000-000000000303', 1, 'active', now(), '91100000-0000-4000-8000-000000000010', null, null),
  ('91100000-0000-4000-8000-000000000603', '91100000-0000-4000-8000-000000000001', '91100000-0000-4000-8000-000000000304', 1, 'active', now(), '91100000-0000-4000-8000-000000000010', null, null),
  ('91100000-0000-4000-8000-000000000604', '91100000-0000-4000-8000-000000000001', '91100000-0000-4000-8000-000000000305', 1, 'active', now(), '91100000-0000-4000-8000-000000000010', null, null),
  ('91100000-0000-4000-8000-000000000605', '91100000-0000-4000-8000-000000000001', '91100000-0000-4000-8000-000000000306', 1, 'active', now(), '91100000-0000-4000-8000-000000000010', null, null),
  ('91100000-0000-4000-8000-000000000606', '91100000-0000-4000-8000-000000000001', '91100000-0000-4000-8000-000000000307', 1, 'active', now(), '91100000-0000-4000-8000-000000000010', null, null),
  ('91100000-0000-4000-8000-000000000607', '91100000-0000-4000-8000-000000000002', '91100000-0000-4000-8000-000000000308', 1, 'active', now(), '91100000-0000-4000-8000-000000000012', null, null),
  ('91100000-0000-4000-8000-000000000608', '91100000-0000-4000-8000-000000000001', '91100000-0000-4000-8000-000000000301', 1, 'active', now(), '91100000-0000-4000-8000-000000000010', null, null),
  ('91100000-0000-4000-8000-000000000609', '91100000-0000-4000-8000-000000000001', '91100000-0000-4000-8000-000000000309', 1, 'active', now(), '91100000-0000-4000-8000-000000000010', null, null),
  ('91100000-0000-4000-8000-000000000610', '91100000-0000-4000-8000-000000000001', '91100000-0000-4000-8000-000000000304', 2, 'completed', now() - interval '2 hours', '91100000-0000-4000-8000-000000000010', now() - interval '1 hour', '91100000-0000-4000-8000-000000000010');

insert into public.ovr_stage_instances (
  id, organization_id, ovr_report_id, review_cycle_id, stage_type,
  sequence_number, lifecycle_status, opened_at, relationship_version
) select stage_id, organization_id, ovr_report_id, cycle_id, stage_type,
         case when stage_id = '91100000-0000-4000-8000-000000000711'::uuid then 2 else 1 end,
         'pending', now(), 0
from (values
  ('91100000-0000-4000-8000-000000000701'::uuid, '91100000-0000-4000-8000-000000000001'::uuid, '91100000-0000-4000-8000-000000000302'::uuid, '91100000-0000-4000-8000-000000000601'::uuid, 'manager_review'),
  ('91100000-0000-4000-8000-000000000702'::uuid, '91100000-0000-4000-8000-000000000001'::uuid, '91100000-0000-4000-8000-000000000303'::uuid, '91100000-0000-4000-8000-000000000602'::uuid, 'manager_review'),
  ('91100000-0000-4000-8000-000000000703'::uuid, '91100000-0000-4000-8000-000000000001'::uuid, '91100000-0000-4000-8000-000000000304'::uuid, '91100000-0000-4000-8000-000000000603'::uuid, 'evidence_governance'),
  ('91100000-0000-4000-8000-000000000704'::uuid, '91100000-0000-4000-8000-000000000001'::uuid, '91100000-0000-4000-8000-000000000305'::uuid, '91100000-0000-4000-8000-000000000604'::uuid, 'final_verdict'),
  ('91100000-0000-4000-8000-000000000705'::uuid, '91100000-0000-4000-8000-000000000001'::uuid, '91100000-0000-4000-8000-000000000306'::uuid, '91100000-0000-4000-8000-000000000605'::uuid, 'quality_review'),
  ('91100000-0000-4000-8000-000000000706'::uuid, '91100000-0000-4000-8000-000000000001'::uuid, '91100000-0000-4000-8000-000000000307'::uuid, '91100000-0000-4000-8000-000000000606'::uuid, 'manager_review'),
  ('91100000-0000-4000-8000-000000000707'::uuid, '91100000-0000-4000-8000-000000000002'::uuid, '91100000-0000-4000-8000-000000000308'::uuid, '91100000-0000-4000-8000-000000000607'::uuid, 'quality_review'),
  ('91100000-0000-4000-8000-000000000708'::uuid, '91100000-0000-4000-8000-000000000001'::uuid, '91100000-0000-4000-8000-000000000301'::uuid, '91100000-0000-4000-8000-000000000608'::uuid, 'evidence_governance'),
  ('91100000-0000-4000-8000-000000000709'::uuid, '91100000-0000-4000-8000-000000000001'::uuid, '91100000-0000-4000-8000-000000000309'::uuid, '91100000-0000-4000-8000-000000000609'::uuid, 'final_verdict'),
  ('91100000-0000-4000-8000-000000000711'::uuid, '91100000-0000-4000-8000-000000000001'::uuid, '91100000-0000-4000-8000-000000000304'::uuid, '91100000-0000-4000-8000-000000000603'::uuid, 'governance_closure')
) as fixture(stage_id, organization_id, ovr_report_id, cycle_id, stage_type);

insert into public.ovr_stage_instances (
  id, organization_id, ovr_report_id, review_cycle_id, stage_type,
  sequence_number, lifecycle_status, opened_at, relationship_version
) values (
  '91100000-0000-4000-8000-000000000710',
  '91100000-0000-4000-8000-000000000001',
  '91100000-0000-4000-8000-000000000304',
  '91100000-0000-4000-8000-000000000610',
  'evidence_governance', 1, 'cancelled', now(), 0
);

create temporary table p1_route_results (label text primary key, result jsonb) on commit drop;
create temporary table p1_expected_candidate_digests (
  label text primary key,
  candidate_digest text not null
) on commit drop;

-- B1. Direct conflicts retain their related-person source and manager-derived
-- conflicts retain both the related-person and reporting-line lineage.
insert into p1_route_results values (
  'lineage',
  public.ovr_v11_route_reviewer(
    '91100000-0000-4000-8000-000000000010',
    '91100000-0000-4000-8000-000000000301',
    '91100000-0000-4000-8000-000000000708',
    'p1-lineage'
  )
);
select is(
  (select result->>'status' from p1_route_results where label = 'lineage'),
  'assigned',
  'a route with direct and manager-derived conflicts remains executable'
);
select ok(exists(
  select 1 from public.ovr_conflict_events
  where ovr_report_id = '91100000-0000-4000-8000-000000000301'
    and event_type = 'conflict_detected'
    and conflict_basis = 'involved_person'
    and related_person_id = '91100000-0000-4000-8000-000000000402'
    and reporting_line_id is null
), 'direct conflict event retains the related-person source');
select ok(exists(
  select 1 from public.ovr_conflict_events
  where ovr_report_id = '91100000-0000-4000-8000-000000000301'
    and event_type = 'conflict_detected'
    and conflict_basis = 'manager_of_subject'
    and related_person_id = '91100000-0000-4000-8000-000000000403'
    and reporting_line_id = '91100000-0000-4000-8000-000000000203'
), 'manager-derived conflict event retains both source references');
select throws_ok(
  $$insert into public.ovr_conflict_events (
      organization_id, ovr_report_id, affected_profile_id, event_type,
      protected_action, conflict_basis, actor_id, source_provenance,
      current_relationship_version
    ) values (
      '91100000-0000-4000-8000-000000000001',
      '91100000-0000-4000-8000-000000000301',
      '91100000-0000-4000-8000-000000000020',
      'conflict_detected', 'quality_review', 'source_missing',
      '91100000-0000-4000-8000-000000000010',
      'system_reconciliation', 0
    )$$,
  '23514', null,
  'a conflict event without any structural provenance source is rejected'
);

-- L. Missing hierarchy blocks instead of falling back.
insert into p1_route_results values (
  'missing_hierarchy',
  public.ovr_v11_route_reviewer(
    '91100000-0000-4000-8000-000000000010',
    '91100000-0000-4000-8000-000000000302',
    '91100000-0000-4000-8000-000000000701',
    'p1-missing-hierarchy'
  )
);
select is((select result->>'status' from p1_route_results where label = 'missing_hierarchy'), 'blocked', 'missing hierarchy fails closed');
select is((select result->>'reason' from p1_route_results where label = 'missing_hierarchy'), 'missing_primary_manager', 'missing hierarchy exposes a non-sensitive block reason');

-- M. A corrupted ambiguous hierarchy is rejected even if the uniqueness
-- constraint is temporarily removed inside this rollback-only adversarial test.
drop index public.uq_organization_reporting_lines_active_primary;
insert into public.organization_reporting_lines (
  id, organization_id, employee_profile_id, manager_profile_id,
  relationship_type, is_primary, provenance, asserted_by, confirmed_by,
  confirmed_at, is_active
) values
  ('91100000-0000-4000-8000-000000000204', '91100000-0000-4000-8000-000000000001',
   '91100000-0000-4000-8000-000000000021', '91100000-0000-4000-8000-000000000030',
   'direct', true, 'governance_confirmation', '91100000-0000-4000-8000-000000000010',
   '91100000-0000-4000-8000-000000000010', clock_timestamp(), true),
  ('91100000-0000-4000-8000-000000000205', '91100000-0000-4000-8000-000000000001',
   '91100000-0000-4000-8000-000000000021', '91100000-0000-4000-8000-000000000031',
   'direct', true, 'governance_confirmation', '91100000-0000-4000-8000-000000000010',
   '91100000-0000-4000-8000-000000000010', clock_timestamp(), true);
insert into p1_route_results values (
  'ambiguous_hierarchy',
  public.ovr_v11_route_reviewer(
    '91100000-0000-4000-8000-000000000010',
    '91100000-0000-4000-8000-000000000302',
    '91100000-0000-4000-8000-000000000701',
    'p1-ambiguous-hierarchy'
  )
);
select is((select result->>'status' from p1_route_results where label = 'ambiguous_hierarchy'), 'blocked', 'ambiguous primary-manager state fails closed');
select is((select result->>'reason' from p1_route_results where label = 'ambiguous_hierarchy'), 'ambiguous_primary_manager', 'ambiguous hierarchy exposes a non-sensitive block reason');
update public.organization_reporting_lines
set is_active = false, valid_to = clock_timestamp()
where id in (
  '91100000-0000-4000-8000-000000000204',
  '91100000-0000-4000-8000-000000000205'
);
create unique index uq_organization_reporting_lines_active_primary
  on public.organization_reporting_lines (organization_id, employee_profile_id)
  where is_active and is_primary;

-- R. Retaliation-sensitive manager stage bypasses the department manager.
insert into p1_route_results values (
  'retaliation',
  public.ovr_v11_route_reviewer(
    '91100000-0000-4000-8000-000000000010',
    '91100000-0000-4000-8000-000000000303',
    '91100000-0000-4000-8000-000000000702',
    'p1-retaliation-bypass'
  )
);
select is((select result->>'reviewer_profile_id' from p1_route_results where label = 'retaliation'), '91100000-0000-4000-8000-000000000040', 'retaliation routing selects a cleared Quality reviewer');
select is((select result->>'assignment_reason' from p1_route_results where label = 'retaliation'), 'retaliation_sensitive_quality_bypass', 'retaliation routing records the bypass basis');

-- O/Q. Stable UUID tie-break and duplicate/inactive/archived role/profile exclusion.
insert into public.ovr_related_persons (
  organization_id, ovr_report_id, profile_id, relationship_type, provenance,
  asserted_by, confirmation_status, confirmed_by, confirmed_at, is_active
) values (
  '91100000-0000-4000-8000-000000000001',
  '91100000-0000-4000-8000-000000000304',
  '91100000-0000-4000-8000-000000000040', 'subject', 'quality_confirmation',
  '91100000-0000-4000-8000-000000000010', 'confirmed',
  '91100000-0000-4000-8000-000000000010', clock_timestamp(), true
);
select is((
  select count(*)::integer
  from public.ovr_reviewer_pool_memberships m
  join public.profiles p
    on p.id = m.profile_id
   and p.organization_id = m.organization_id
   and p.is_active
   and p.user_status = 'active'
  join public.user_credential_states cs
    on cs.user_id = p.id
   and cs.organization_id = p.organization_id
   and cs.credential_state = 'active'
   and cs.identity_mode in ('legacy_verified', 'employee_id_managed')
  where m.id in (
      '91100000-0000-4000-8000-000000000511',
      '91100000-0000-4000-8000-000000000513'
    )
    and m.organization_id = '91100000-0000-4000-8000-000000000001'
    and m.profile_id = '91100000-0000-4000-8000-000000000041'
    and m.capability = 'evidence_governance'
    and m.is_active
    and m.valid_from <= statement_timestamp()
    and (m.valid_to is null or m.valid_to > statement_timestamp())
    and (
      (m.scope = 'global' and m.division_id is null and m.department_id is null)
      or (m.scope = 'department' and m.department_id = '91100000-0000-4000-8000-000000000111')
    )
    and m.confidential_clearance
    and m.retaliation_clearance
    and (
      select count(*)
      from public.user_roles ur
      where ur.user_id = m.profile_id
        and ur.is_active
        and ur.role in ('super_admin', 'governance_admin', 'compliance_officer')
        and ur.scope = 'global'
        and public.patch83u_role_assignment_valid(
          m.organization_id, ur.scope, ur.organization_id,
          ur.division_id, ur.department_id, ur.unit_id
        )
    ) = 1
    and not exists (
      select 1
      from ovr_v11_private.current_conflicts(
        m.organization_id,
        '91100000-0000-4000-8000-000000000304',
        'evidence_governance',
        statement_timestamp()
      ) conflict
      where conflict.affected_profile_id = m.profile_id
    )
), 2, 'both same-profile memberships genuinely qualify before canonical collapse');

insert into p1_expected_candidate_digests (label, candidate_digest)
select
  'deterministic',
  encode(
    extensions.digest(
      convert_to(
        jsonb_build_array(
          jsonb_build_object(
            'membership_id', m.id,
            'profile_id', m.profile_id,
            'membership_scope', m.scope,
            'priority', m.priority,
            'membership_valid_from', m.valid_from,
            'active_workload', workload.active_workload,
            'last_assigned_at', history.last_assigned_at
          )
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  )
from public.ovr_reviewer_pool_memberships m
cross join lateral (
  select count(*)::integer as active_workload
  from public.ovr_reviewer_assignments a
  where a.organization_id = m.organization_id
    and a.reviewer_profile_id = m.profile_id
    and a.status = 'active'
) workload
cross join lateral (
  select max(a.assigned_at) as last_assigned_at
  from public.ovr_reviewer_assignments a
  where a.organization_id = m.organization_id
    and a.reviewer_profile_id = m.profile_id
) history
where m.id = '91100000-0000-4000-8000-000000000513';

insert into p1_route_results values (
  'deterministic',
  public.ovr_v11_route_reviewer(
    '91100000-0000-4000-8000-000000000010',
    '91100000-0000-4000-8000-000000000304',
    '91100000-0000-4000-8000-000000000703',
    'p1-deterministic'
  )
);
select is((select result->>'reviewer_profile_id' from p1_route_results where label = 'deterministic'), '91100000-0000-4000-8000-000000000041', 'a current conflict overrides the lower-priority-number candidate positive role and membership');
select is((
  select (metadata->>'candidate_count')::integer
  from public.ovr_routing_events
  where stage_instance_id = '91100000-0000-4000-8000-000000000703'
    and event_type = 'candidate_evaluated'
), 1, 'same-profile multi-membership collapse contributes one effective candidate');
select is((
  select reviewer_membership_id::text
  from public.ovr_reviewer_assignments
  where id = ((select result->>'assignment_id' from p1_route_results where label = 'deterministic'))::uuid
), '91100000-0000-4000-8000-000000000513',
  'the later-inserted department membership deterministically wins over the same profile global membership');
select is((
  select metadata->>'membership_id'
  from public.ovr_routing_events
  where idempotency_key = 'p1-deterministic'
), '91100000-0000-4000-8000-000000000513',
  'terminal routing evidence stores the canonical membership ID');
select is((
  select (metadata->>'candidate_count')::integer
  from public.ovr_routing_events
  where idempotency_key = 'p1-deterministic'
), 1, 'terminal routing evidence contains no duplicate candidate contribution');
select is((
  select candidate_digest
  from public.ovr_reviewer_assignments
  where id = ((select result->>'assignment_id' from p1_route_results where label = 'deterministic'))::uuid
), (select candidate_digest from p1_expected_candidate_digests where label = 'deterministic'),
  'assignment digest is recomputed from the exact canonical membership singleton');
select is((
  select result->>'candidate_digest'
  from p1_route_results
  where label = 'deterministic'
), (select candidate_digest from p1_expected_candidate_digests where label = 'deterministic'),
  'routing response digest reflects the exact canonical membership singleton');
select is((
  select metadata->>'membership_selection_basis'
  from public.ovr_routing_events
  where idempotency_key = 'p1-deterministic'
), 'scope_specificity_priority_valid_from_membership_uuid',
  'the selected membership and deterministic selection basis are persisted');
select ok(not exists(
  select 1 from public.ovr_reviewer_assignments
  where reviewer_profile_id in (
    '91100000-0000-4000-8000-000000000037',
    '91100000-0000-4000-8000-000000000038',
    '91100000-0000-4000-8000-000000000039'
  )
), 'inactive, archived and duplicate-role candidates are excluded');
select ok(not exists(
  select 1 from public.ovr_reviewer_assignments
  where reviewer_profile_id = '91100000-0000-4000-8000-000000000044'
), 'Super Admin role alone never substitutes for reviewer-pool membership');

select is(
  (public.ovr_v11_route_reviewer(
    '91100000-0000-4000-8000-000000000010',
    '91100000-0000-4000-8000-000000000304',
    '91100000-0000-4000-8000-000000000703',
    'p1-deterministic'
  )->>'assignment_id'),
  (select result->>'assignment_id' from p1_route_results where label = 'deterministic'),
  'identical routing requests are idempotent'
);
select is((
  select count(*)::integer from public.ovr_routing_events
  where organization_id = '91100000-0000-4000-8000-000000000001'
    and idempotency_key = 'p1-deterministic'
), 1, 'an exact routing retry creates no second terminal event');
select is((
  public.ovr_v11_route_reviewer(
    '91100000-0000-4000-8000-000000000010',
    '91100000-0000-4000-8000-000000000304',
    '91100000-0000-4000-8000-000000000703',
    'p1-deterministic'
  )->>'candidate_digest'
), (select result->>'candidate_digest' from p1_route_results where label = 'deterministic'),
  'an exact retry returns the immutable original candidate digest');

select throws_ok(
  $$select public.ovr_v11_route_reviewer(
      '91100000-0000-4000-8000-000000000013',
      '91100000-0000-4000-8000-000000000304',
      '91100000-0000-4000-8000-000000000703',
      'p1-deterministic'
    )$$,
  'P0001', 'OVR_V11_IDEMPOTENCY_KEY_REUSE_DENIED',
  'a routing idempotency key cannot be reused by another authorized actor'
);
select throws_ok(
  $$select public.ovr_v11_route_reviewer(
      '91100000-0000-4000-8000-000000000010',
      '91100000-0000-4000-8000-000000000305',
      '91100000-0000-4000-8000-000000000704',
      'p1-deterministic'
    )$$,
  'P0001', 'OVR_V11_IDEMPOTENCY_KEY_REUSE_DENIED',
  'a routing idempotency key cannot be reused for a different stage payload'
);

insert into p1_route_results values (
  'existing_assignment',
  public.ovr_v11_route_reviewer(
    '91100000-0000-4000-8000-000000000010',
    '91100000-0000-4000-8000-000000000304',
    '91100000-0000-4000-8000-000000000703',
    'p1-existing-assignment'
  )
);
select is(
  (public.ovr_v11_route_reviewer(
    '91100000-0000-4000-8000-000000000010',
    '91100000-0000-4000-8000-000000000304',
    '91100000-0000-4000-8000-000000000703',
    'p1-existing-assignment'
  )->>'assignment_id'),
  (select result->>'assignment_id' from p1_route_results where label = 'deterministic'),
  'an existing-assignment request replays the immutable first result'
);
select is((
  select count(*)::integer from public.ovr_routing_events
  where idempotency_key = 'p1-existing-assignment'
), 1, 'an existing-assignment exact retry keeps one structured terminal event');

-- J. A newly discovered relationship conflict invalidates an active assignment.
insert into p1_route_results values (
  'late_conflict',
  public.ovr_v11_route_reviewer(
    '91100000-0000-4000-8000-000000000010',
    '91100000-0000-4000-8000-000000000305',
    '91100000-0000-4000-8000-000000000704',
    'p1-late-conflict'
  )
);
insert into public.ovr_related_persons (
  organization_id, ovr_report_id, profile_id, relationship_type, provenance,
  asserted_by, confirmation_status, confirmed_by, confirmed_at, is_active
) select
  '91100000-0000-4000-8000-000000000001',
  '91100000-0000-4000-8000-000000000305',
  (select (result->>'reviewer_profile_id')::uuid from p1_route_results where label = 'late_conflict'),
  'subject', 'quality_confirmation',
  '91100000-0000-4000-8000-000000000010', 'confirmed',
  '91100000-0000-4000-8000-000000000010', now(), true;
select is((
  select status from public.ovr_reviewer_assignments
  where id = ((select result->>'assignment_id' from p1_route_results where label = 'late_conflict'))::uuid
), 'conflict_invalidated', 'late conflict invalidates the active assignment');
select ok(exists(
  select 1 from public.ovr_routing_events
  where ovr_report_id = '91100000-0000-4000-8000-000000000305'
    and event_type = 'conflict_invalidated'
), 'late conflict emits an append-only routing event');

-- A late manager relationship invalidates the assigned manager and preserves
-- both the subject relationship and reporting-line lineage in history.
insert into p1_route_results values (
  'late_manager_conflict',
  public.ovr_v11_route_reviewer(
    '91100000-0000-4000-8000-000000000010',
    '91100000-0000-4000-8000-000000000309',
    '91100000-0000-4000-8000-000000000709',
    'p1-late-manager-conflict'
  )
);
select is(
  (select result->>'reviewer_profile_id' from p1_route_results where label = 'late_manager_conflict'),
  '91100000-0000-4000-8000-000000000047',
  'the future manager-conflict subject manager is initially the deterministic reviewer'
);
insert into public.organization_reporting_lines (
  id, organization_id, employee_profile_id, manager_profile_id,
  relationship_type, is_primary, provenance, asserted_by, confirmed_by,
  confirmed_at, is_active
) values (
  '91100000-0000-4000-8000-000000000206',
  '91100000-0000-4000-8000-000000000001',
  '91100000-0000-4000-8000-000000000048',
  '91100000-0000-4000-8000-000000000047',
  'direct', true, 'governance_confirmation',
  '91100000-0000-4000-8000-000000000010',
  '91100000-0000-4000-8000-000000000010', now(), true
);
select is((
  select status from public.ovr_reviewer_assignments
  where id = ((select result->>'assignment_id' from p1_route_results where label = 'late_manager_conflict'))::uuid
), 'conflict_invalidated', 'a late manager-derived conflict invalidates the active assignment');
select ok(exists(
  select 1 from public.ovr_conflict_events
  where ovr_report_id = '91100000-0000-4000-8000-000000000309'
    and event_type = 'conflict_detected'
    and conflict_basis = 'manager_of_subject'
    and related_person_id = '91100000-0000-4000-8000-000000000406'
    and reporting_line_id = '91100000-0000-4000-8000-000000000206'
), 'late manager invalidation records both structural provenance references');
select ok(exists(
  select 1 from public.ovr_routing_events
  where ovr_report_id = '91100000-0000-4000-8000-000000000309'
    and event_type = 'conflict_invalidated'
), 'late manager invalidation records complete routing history');

-- K. Recusal ends the assignment and prevents immediate reselection.
insert into p1_route_results values (
  'recusal_first',
  public.ovr_v11_route_reviewer(
    '91100000-0000-4000-8000-000000000010',
    '91100000-0000-4000-8000-000000000306',
    '91100000-0000-4000-8000-000000000705',
    'p1-recusal-first'
  )
);
select is(
  (select result->>'reviewer_profile_id' from p1_route_results where label = 'recusal_first'),
  '91100000-0000-4000-8000-000000000040',
  'deterministic selection applies configured priority before later tie breakers'
);
select is(
  public.ovr_v11_recuse_assignment(
    '91100000-0000-4000-8000-000000000010',
    ((select result->>'assignment_id' from p1_route_results where label = 'recusal_first'))::uuid,
    'P1 declared conflict',
    'p1-recusal-event'
  )->>'status',
  'recused',
  'controlled recusal terminates the assignment'
);
select is(
  public.ovr_v11_recuse_assignment(
    '91100000-0000-4000-8000-000000000010',
    ((select result->>'assignment_id' from p1_route_results where label = 'recusal_first'))::uuid,
    '  P1 declared conflict  ',
    'p1-recusal-event'
  )->>'status',
  'recused',
  'a normalized exact recusal retry returns the immutable original response'
);
select is((
  select count(*)::integer from public.ovr_routing_events
  where idempotency_key = 'p1-recusal-event'
), 1, 'an exact recusal retry creates no second terminal event');
select throws_ok(
  $$select public.ovr_v11_recuse_assignment(
      '91100000-0000-4000-8000-000000000010',
      ((select result->>'assignment_id' from p1_route_results where label = 'recusal_first'))::uuid,
      'P1 changed reason', 'p1-recusal-event'
    )$$,
  'P0001', 'OVR_V11_IDEMPOTENCY_KEY_REUSE_DENIED',
  'a recusal idempotency key cannot be reused with a changed reason'
);
select throws_ok(
  $$select public.ovr_v11_recuse_assignment(
      '91100000-0000-4000-8000-000000000013',
      ((select result->>'assignment_id' from p1_route_results where label = 'recusal_first'))::uuid,
      'P1 declared conflict', 'p1-recusal-event'
    )$$,
  'P0001', 'OVR_V11_IDEMPOTENCY_KEY_REUSE_DENIED',
  'a recusal idempotency key cannot be reused by another actor'
);
select is(
  (public.ovr_v11_route_reviewer(
    '91100000-0000-4000-8000-000000000010',
    '91100000-0000-4000-8000-000000000306',
    '91100000-0000-4000-8000-000000000705',
    'p1-recusal-first'
  )->>'reviewer_profile_id'),
  (select result->>'reviewer_profile_id' from p1_route_results where label = 'recusal_first'),
  'routing retry after assignment lifecycle change replays the original reviewer'
);
insert into p1_route_results values (
  'recusal_second',
  public.ovr_v11_route_reviewer(
    '91100000-0000-4000-8000-000000000010',
    '91100000-0000-4000-8000-000000000306',
    '91100000-0000-4000-8000-000000000705',
    'p1-recusal-second'
  )
);
select isnt(
  (select result->>'reviewer_profile_id' from p1_route_results where label = 'recusal_second'),
  (select result->>'reviewer_profile_id' from p1_route_results where label = 'recusal_first'),
  'a recused reviewer is not selected again for the same stage'
);
select ok(exists(
  select 1 from public.ovr_routing_events
  where stage_instance_id = '91100000-0000-4000-8000-000000000705'
    and event_type = 'reassignment'
), 'post-recusal routing emits an explicit append-only reassignment event');

-- Confidential manager routing requires explicit clearance.
insert into p1_route_results values (
  'confidential_blocked',
  public.ovr_v11_route_reviewer(
    '91100000-0000-4000-8000-000000000010',
    '91100000-0000-4000-8000-000000000307',
    '91100000-0000-4000-8000-000000000706',
    'p1-confidential-blocked'
  )
);
select is((select result->>'status' from p1_route_results where label = 'confidential_blocked'), 'blocked', 'confidential routing blocks without explicit clearance');

update public.ovr_reviewer_pool_memberships
set confidential_clearance = true
where id = '91100000-0000-4000-8000-000000000501';
insert into p1_route_results values (
  'confidential_primary_manager',
  public.ovr_v11_route_reviewer(
    '91100000-0000-4000-8000-000000000010',
    '91100000-0000-4000-8000-000000000307',
    '91100000-0000-4000-8000-000000000706',
    'p1-confidential-cleared'
  )
);
select is(
  (select result->>'reviewer_profile_id' from p1_route_results where label = 'confidential_primary_manager'),
  '91100000-0000-4000-8000-000000000030',
  'a sensitive manager stage routes only to the confirmed primary manager after explicit clearance'
);
select is(
  (select result->>'assignment_reason' from p1_route_results where label = 'confidential_primary_manager'),
  'confirmed_primary_direct_manager',
  'primary-manager routing records the authoritative hierarchy basis'
);

-- Fully tied business metrics fall back to the stable profile UUID.
insert into p1_route_results values (
  'uuid_tiebreak',
  public.ovr_v11_route_reviewer(
    '91100000-0000-4000-8000-000000000010',
    '91100000-0000-4000-8000-000000000304',
    '91100000-0000-4000-8000-000000000711',
    'p1-uuid-tiebreak'
  )
);
select is(
  (select result->>'reviewer_profile_id' from p1_route_results where label = 'uuid_tiebreak'),
  '91100000-0000-4000-8000-000000000042',
  'reviewers tied on all business metrics fall back to profile UUID'
);

-- A failed authorization transaction does not reserve the idempotency key.
select throws_ok(
  $$select public.ovr_v11_route_reviewer(
      '91100000-0000-4000-8000-000000000011',
      '91100000-0000-4000-8000-000000000304',
      '91100000-0000-4000-8000-000000000711',
      'p1-failed-then-success'
    )$$,
  'P0001', 'OVR_V11_ROUTING_ACTOR_ROLE_REQUIRED',
  'failed routing authorization returns before idempotency is reserved'
);
insert into public.user_roles (
  user_id, role, scope, organization_id, department_id, is_active
) values (
  '91100000-0000-4000-8000-000000000011', 'governance_admin', 'global',
  '91100000-0000-4000-8000-000000000001', null, true
);
select is(
  public.ovr_v11_route_reviewer(
    '91100000-0000-4000-8000-000000000011',
    '91100000-0000-4000-8000-000000000304',
    '91100000-0000-4000-8000-000000000711',
    'p1-failed-then-success'
  )->>'status',
  'assigned',
  'the same key succeeds after the failed transaction condition is corrected'
);
select is((
  select count(*)::integer from public.ovr_routing_events
  where idempotency_key = 'p1-failed-then-success'
), 1, 'only the successful request persists an idempotency result');

-- Fresh opposite-insertion-order route, also used for composite immutable-history
-- FK adversarial checks. Both memberships qualify; 517 was physically inserted
-- before 516, the reverse of the original 511-before-513 fixture.
select is((
  select count(*)::integer
  from public.ovr_reviewer_pool_memberships m
  join public.profiles p
    on p.id = m.profile_id
   and p.organization_id = m.organization_id
   and p.is_active
   and p.user_status = 'active'
  join public.user_credential_states cs
    on cs.user_id = p.id
   and cs.organization_id = p.organization_id
   and cs.credential_state = 'active'
   and cs.identity_mode in ('legacy_verified', 'employee_id_managed')
  where m.id in (
      '91100000-0000-4000-8000-000000000516',
      '91100000-0000-4000-8000-000000000517'
    )
    and m.organization_id = '91100000-0000-4000-8000-000000000002'
    and m.profile_id = '91100000-0000-4000-8000-000000000061'
    and m.capability = 'quality_review'
    and m.is_active
    and m.valid_from <= statement_timestamp()
    and (m.valid_to is null or m.valid_to > statement_timestamp())
    and (
      (m.scope = 'global' and m.division_id is null and m.department_id is null)
      or (m.scope = 'department' and m.department_id = '91100000-0000-4000-8000-000000000112')
    )
    and m.confidential_clearance
    and m.retaliation_clearance
    and (
      select count(*)
      from public.user_roles ur
      where ur.user_id = m.profile_id
        and ur.is_active
        and ur.role in ('super_admin', 'governance_admin', 'compliance_officer')
        and ur.scope = 'global'
        and public.patch83u_role_assignment_valid(
          m.organization_id, ur.scope, ur.organization_id,
          ur.division_id, ur.department_id, ur.unit_id
        )
    ) = 1
    and not exists (
      select 1
      from ovr_v11_private.current_conflicts(
        m.organization_id,
        '91100000-0000-4000-8000-000000000308',
        'quality_review',
        statement_timestamp()
      ) conflict
      where conflict.affected_profile_id = m.profile_id
    )
), 2, 'both opposite-order same-profile memberships genuinely qualify before collapse');

insert into p1_expected_candidate_digests (label, candidate_digest)
select
  'other_org',
  encode(
    extensions.digest(
      convert_to(
        jsonb_build_array(
          jsonb_build_object(
            'membership_id', m.id,
            'profile_id', m.profile_id,
            'membership_scope', m.scope,
            'priority', m.priority,
            'membership_valid_from', m.valid_from,
            'active_workload', workload.active_workload,
            'last_assigned_at', history.last_assigned_at
          )
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  )
from public.ovr_reviewer_pool_memberships m
cross join lateral (
  select count(*)::integer as active_workload
  from public.ovr_reviewer_assignments a
  where a.organization_id = m.organization_id
    and a.reviewer_profile_id = m.profile_id
    and a.status = 'active'
) workload
cross join lateral (
  select max(a.assigned_at) as last_assigned_at
  from public.ovr_reviewer_assignments a
  where a.organization_id = m.organization_id
    and a.reviewer_profile_id = m.profile_id
) history
where m.id = '91100000-0000-4000-8000-000000000517';

insert into p1_route_results values (
  'other_org',
  public.ovr_v11_route_reviewer(
    '91100000-0000-4000-8000-000000000012',
    '91100000-0000-4000-8000-000000000308',
    '91100000-0000-4000-8000-000000000707',
    'p1-other-org-assignment'
  )
);
select is((select result->>'status' from p1_route_results where label = 'other_org'), 'assigned', 'other-organization control assignment is valid in its own context');
select is((
  select (metadata->>'candidate_count')::integer
  from public.ovr_routing_events
  where stage_instance_id = '91100000-0000-4000-8000-000000000707'
    and event_type = 'candidate_evaluated'
), 1, 'opposite insertion order still collapses the reviewer to one candidate');
select is((
  select reviewer_membership_id::text
  from public.ovr_reviewer_assignments
  where id = ((select result->>'assignment_id' from p1_route_results where label = 'other_org'))::uuid
), '91100000-0000-4000-8000-000000000517',
  'opposite insertion order selects the canonical department membership');
select is((
  select metadata->>'membership_id'
  from public.ovr_routing_events
  where idempotency_key = 'p1-other-org-assignment'
), '91100000-0000-4000-8000-000000000517',
  'opposite-order terminal evidence stores the canonical membership ID');
select is((
  select (metadata->>'candidate_count')::integer
  from public.ovr_routing_events
  where idempotency_key = 'p1-other-org-assignment'
), 1, 'opposite-order terminal evidence has no duplicate candidate contribution');
select is((
  select candidate_digest
  from public.ovr_reviewer_assignments
  where id = ((select result->>'assignment_id' from p1_route_results where label = 'other_org'))::uuid
), (select candidate_digest from p1_expected_candidate_digests where label = 'other_org'),
  'opposite-order assignment digest is recomputed from the canonical singleton');
select is((
  select result->>'candidate_digest'
  from p1_route_results
  where label = 'other_org'
), (select candidate_digest from p1_expected_candidate_digests where label = 'other_org'),
  'opposite-order routing digest reflects the canonical singleton');
select is((
  select jsonb_build_object(
    'candidate_count', (metadata->>'candidate_count')::integer,
    'membership_scope', metadata->>'membership_scope',
    'membership_priority', (metadata->>'membership_priority')::integer,
    'membership_valid_from', metadata->>'membership_valid_from',
    'membership_selection_basis', metadata->>'membership_selection_basis'
  )
  from public.ovr_routing_events
  where idempotency_key = 'p1-other-org-assignment'
), (
  select jsonb_build_object(
    'candidate_count', (metadata->>'candidate_count')::integer,
    'membership_scope', metadata->>'membership_scope',
    'membership_priority', (metadata->>'membership_priority')::integer,
    'membership_valid_from', metadata->>'membership_valid_from',
    'membership_selection_basis', metadata->>'membership_selection_basis'
  )
  from public.ovr_routing_events
  where idempotency_key = 'p1-deterministic'
), 'reversing physical insertion preserves semantic candidate ordering and deterministic selection');

select throws_ok(
  $$insert into public.ovr_routing_events (
      organization_id, ovr_report_id, review_cycle_id, stage_instance_id,
      assignment_id, event_type, actor_id, event_reason, conflict_version
    ) values (
      '91100000-0000-4000-8000-000000000001',
      '91100000-0000-4000-8000-000000000304',
      '91100000-0000-4000-8000-000000000603',
      '91100000-0000-4000-8000-000000000703',
      ((select result->>'assignment_id' from p1_route_results where label = 'other_org'))::uuid,
      'existing_assignment', '91100000-0000-4000-8000-000000000010',
      'cross_org_assignment', 0
    )$$,
  '23503', null,
  'an organization cannot reference another organization assignment in routing history'
);
select throws_ok(
  $$insert into public.ovr_routing_events (
      organization_id, ovr_report_id, review_cycle_id, stage_instance_id,
      assignment_id, event_type, actor_id, event_reason, conflict_version
    ) values (
      '91100000-0000-4000-8000-000000000001',
      '91100000-0000-4000-8000-000000000305',
      '91100000-0000-4000-8000-000000000604',
      '91100000-0000-4000-8000-000000000704',
      ((select result->>'assignment_id' from p1_route_results where label = 'deterministic'))::uuid,
      'existing_assignment', '91100000-0000-4000-8000-000000000010',
      'wrong_ovr_assignment', 0
    )$$,
  '23503', null,
  'routing history cannot reference a same-organization assignment from another OVR'
);
select throws_ok(
  $$insert into public.ovr_routing_events (
      organization_id, ovr_report_id, review_cycle_id, stage_instance_id,
      assignment_id, event_type, actor_id, event_reason, conflict_version
    ) values (
      '91100000-0000-4000-8000-000000000001',
      '91100000-0000-4000-8000-000000000304',
      '91100000-0000-4000-8000-000000000610',
      '91100000-0000-4000-8000-000000000710',
      ((select result->>'assignment_id' from p1_route_results where label = 'deterministic'))::uuid,
      'existing_assignment', '91100000-0000-4000-8000-000000000010',
      'wrong_cycle_assignment', 0
    )$$,
  '23503', null,
  'routing history cannot reference an assignment from another review cycle'
);
select throws_ok(
  $$insert into public.ovr_routing_events (
      organization_id, ovr_report_id, review_cycle_id, stage_instance_id,
      assignment_id, event_type, actor_id, event_reason, conflict_version
    ) values (
      '91100000-0000-4000-8000-000000000001',
      '91100000-0000-4000-8000-000000000304',
      '91100000-0000-4000-8000-000000000603',
      '91100000-0000-4000-8000-000000000711',
      ((select result->>'assignment_id' from p1_route_results where label = 'deterministic'))::uuid,
      'existing_assignment', '91100000-0000-4000-8000-000000000010',
      'wrong_stage_assignment', 0
    )$$,
  '23503', null,
  'routing history cannot reference an assignment from another stage in the same cycle'
);

update public.ovr_reviewer_assignments
set status = 'completed', ended_at = now(),
    termination_reason = 'P1 terminal idempotency proof'
where id = ((select result->>'assignment_id' from p1_route_results where label = 'other_org'))::uuid;
update public.ovr_stage_instances
set lifecycle_status = 'completed', completed_at = now()
where id = '91100000-0000-4000-8000-000000000707';
update public.ovr_review_cycles
set status = 'completed', closed_at = now(),
    closed_by = '91100000-0000-4000-8000-000000000012'
where id = '91100000-0000-4000-8000-000000000607';
select is(
  public.ovr_v11_route_reviewer(
    '91100000-0000-4000-8000-000000000012',
    '91100000-0000-4000-8000-000000000308',
    '91100000-0000-4000-8000-000000000707',
    'p1-other-org-assignment'
  )->>'assignment_id',
  (select result->>'assignment_id' from p1_route_results where label = 'other_org'),
  'exact retry returns the original response after assignment, stage and cycle become terminal'
);
select is((
  select count(*)::integer from public.ovr_routing_events
  where idempotency_key = 'p1-other-org-assignment'
), 1, 'terminal-lifecycle replay creates no additional event');

select throws_ok(
  $$insert into public.ovr_reviewer_assignments (
      organization_id, ovr_report_id, review_cycle_id, stage_instance_id,
      reviewer_profile_id, reviewer_membership_id, status, assignment_reason,
      candidate_digest, conflict_version, idempotency_key
    ) values (
      '91100000-0000-4000-8000-000000000001',
      '91100000-0000-4000-8000-000000000304',
      '91100000-0000-4000-8000-000000000603',
      '91100000-0000-4000-8000-000000000703',
      '91100000-0000-4000-8000-000000000041',
      '91100000-0000-4000-8000-000000000513',
      'active', 'duplicate active mutation', repeat('0', 64), 0,
      'p1-duplicate-active-mutation'
    )$$,
  '23505', null,
  'the database unique index rejects a second active assignment for one stage'
);

-- N. Cross-organization routing is denied even to a positive routing role.
select throws_ok(
  $$select public.ovr_v11_route_reviewer(
      '91100000-0000-4000-8000-000000000010',
      '91100000-0000-4000-8000-000000000308',
      '91100000-0000-4000-8000-000000000707',
      'p1-cross-org-routing'
    )$$,
  'P0001', 'OVR_V11_CROSS_ORGANIZATION_DENIED',
  'cross-organization routing is rejected'
);

-- Browser roles have neither table mutation nor RPC execution authority.
select pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select throws_ok(
  $$insert into public.ovr_reviewer_assignments (
      organization_id, ovr_report_id, review_cycle_id, stage_instance_id,
      reviewer_profile_id, reviewer_membership_id, status, assignment_reason,
      candidate_digest, conflict_version, assigned_at, idempotency_key
    ) values (
      '91100000-0000-4000-8000-000000000001',
      '91100000-0000-4000-8000-000000000304',
      '91100000-0000-4000-8000-000000000603',
      '91100000-0000-4000-8000-000000000703',
      '91100000-0000-4000-8000-000000000040',
      '91100000-0000-4000-8000-000000000510',
      'active', 'forbidden browser insert', repeat('0', 64), 0, now(), 'p1-forbidden'
    )$$,
  '42501', null,
  'authenticated browser cannot write protected assignment tables'
);
select throws_ok(
  $$select public.ovr_v11_route_reviewer(
      '91100000-0000-4000-8000-000000000010',
      '91100000-0000-4000-8000-000000000304',
      '91100000-0000-4000-8000-000000000703',
      'p1-forbidden-rpc'
    )$$,
  '42501', null,
  'authenticated browser cannot invoke the service-controlled routing RPC'
);
reset role;
select pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);

select ok(not has_table_privilege('authenticated', 'public.ovr_related_persons', 'SELECT'), 'authenticated has no raw relationship read privilege');
select ok(not has_table_privilege('authenticated', 'public.ovr_conflict_events', 'SELECT'), 'Auditor/Executive/Super Admin browser roles cannot inherit raw conflict reads');
select ok(not has_function_privilege('authenticated', 'public.ovr_v11_route_reviewer(uuid,uuid,uuid,text)', 'EXECUTE'), 'routing RPC execute is service-role only');

select throws_ok(
  $$update public.ovr_conflict_events set event_type = event_type where false$$,
  'P0001', 'OVR_V11_CONFLICT_EVENTS_APPEND_ONLY',
  'conflict events reject update operations'
);
select throws_ok(
  $$update public.ovr_routing_events set event_type = event_type where false$$,
  'P0001', 'OVR_V11_ROUTING_EVENTS_APPEND_ONLY',
  'routing events reject update operations'
);
select throws_ok(
  $$delete from public.ovr_routing_events where false$$,
  'P0001', 'OVR_V11_ROUTING_EVENTS_APPEND_ONLY',
  'routing events reject delete operations'
);

-- Catalog ownership and reviewer-history performance evidence.
select is((
  select count(*)::integer
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  join (values
    ('organization_reporting_lines'), ('ovr_relationship_state'),
    ('ovr_related_persons'), ('ovr_conflict_events'),
    ('ovr_reviewer_pool_memberships'), ('ovr_review_cycles'),
    ('ovr_stage_instances'), ('ovr_reviewer_assignments'),
    ('ovr_routing_events')
  ) expected(relname) on expected.relname = c.relname
  where n.nspname = 'public'
    and pg_catalog.pg_get_userbyid(c.relowner) = 'postgres'
), 9, 'all nine P1 tables retain the expected postgres owner');

select is((
  select count(*)::integer
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  join (values
    ('ovr_v11_private', 'guard_append_only'),
    ('ovr_v11_private', 'guard_reporting_line_change'),
    ('ovr_v11_private', 'guard_related_person_change'),
    ('ovr_v11_private', 'record_related_person_change'),
    ('ovr_v11_private', 'record_reporting_line_change'),
    ('ovr_v11_private', 'current_conflicts'),
    ('ovr_v11_private', 'guard_routing_events_append_only'),
    ('ovr_v11_private', 'guard_membership_update'),
    ('ovr_v11_private', 'guard_cycle_update'),
    ('ovr_v11_private', 'guard_stage_update'),
    ('ovr_v11_private', 'assert_service_caller'),
    ('ovr_v11_private', 'actor_organization_for_routing'),
    ('public', 'ovr_v11_route_reviewer'),
    ('public', 'ovr_v11_recuse_assignment'),
    ('ovr_v11_private', 'invalidate_conflicted_assignments')
  ) expected(nspname, proname)
    on expected.nspname = n.nspname and expected.proname = p.proname
  where pg_catalog.pg_get_userbyid(p.proowner) = 'postgres'
), 15, 'all protected P1 functions and trigger functions retain the expected postgres owner');

select ok(exists(
  select 1 from pg_catalog.pg_indexes
  where schemaname = 'public'
    and indexname = 'idx_ovr_reviewer_assignments_reviewer_history'
    and indexdef like '%(organization_id, reviewer_profile_id, assigned_at DESC)%'
), 'reviewer assignment history has the purpose-built descending timestamp index');

create or replace function pg_temp.p1_explain_json(p_sql text)
returns jsonb
language plpgsql
as $$
declare
  v_plan json;
begin
  execute 'explain (format json, costs off) ' || p_sql into v_plan;
  return v_plan::jsonb;
end;
$$;
set local enable_seqscan = off;
select ok(
  pg_temp.p1_explain_json($plan$
    select max(assigned_at)
    from public.ovr_reviewer_assignments
    where organization_id = '91100000-0000-4000-8000-000000000001'
      and reviewer_profile_id = '91100000-0000-4000-8000-000000000041'
  $plan$)::text like '%idx_ovr_reviewer_assignments_reviewer_history%',
  'representative reviewer-history max query uses the purpose-built index'
);
set local enable_seqscan = on;

select is(
  (select count(*)::integer from public.ovr_reviewer_assignments
   where stage_instance_id = '91100000-0000-4000-8000-000000000703' and status = 'active'),
  1,
  'one active assignment is enforced per OVR/cycle/stage'
);

select * from finish();
rollback;
