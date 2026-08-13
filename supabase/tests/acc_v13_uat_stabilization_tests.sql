-- ACC v1.3 UAT stabilization behavioral contracts.
-- Run only against a disposable local database after migration 195.
-- All fixtures and mutations are rolled back.

begin;

create extension if not exists pgtap;
select plan(16);
select pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);

create or replace function pg_temp.acc_uuid(p_value integer)
returns uuid
language sql
immutable
as $$
  select ('a1300000-0000-4000-8000-' || lpad(p_value::text, 12, '0'))::uuid;
$$;

insert into public.organizations (id, name_en)
values (pg_temp.acc_uuid(1), 'ACC v1.3 local test organization');

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, created_at, updated_at
)
select id, 'authenticated', 'authenticated', email, '', now(),
       '{"credential_version":1}'::jsonb, now(), now()
from (values
  (pg_temp.acc_uuid(10), 'acc-owner@example.test'),
  (pg_temp.acc_uuid(11), 'acc-assignee@example.test'),
  (pg_temp.acc_uuid(12), 'acc-outsider@example.test')
) fixture(id, email);

insert into public.profiles (
  id, organization_id, full_name_en, email, employee_no, is_active, user_status
)
select id, pg_temp.acc_uuid(1), label, email,
       'ACC-' || right(replace(id::text, '-', ''), 6), true, 'active'
from (values
  (pg_temp.acc_uuid(10), 'ACC owner', 'acc-owner@example.test'),
  (pg_temp.acc_uuid(11), 'ACC assignee', 'acc-assignee@example.test'),
  (pg_temp.acc_uuid(12), 'ACC outsider', 'acc-outsider@example.test')
) fixture(id, label, email);

insert into public.user_credential_states (
  user_id, organization_id, auth_email, identity_mode, credential_state,
  requested_lifecycle, credential_version
)
select id, pg_temp.acc_uuid(1), email, 'legacy_verified', 'active', 'active', 1
from (values
  (pg_temp.acc_uuid(10), 'acc-owner@example.test'),
  (pg_temp.acc_uuid(11), 'acc-assignee@example.test'),
  (pg_temp.acc_uuid(12), 'acc-outsider@example.test')
) fixture(id, email);

insert into public.user_roles (user_id, role, scope, organization_id, is_active)
values
  (pg_temp.acc_uuid(10), 'employee', 'assigned_only', pg_temp.acc_uuid(1), true),
  (pg_temp.acc_uuid(11), 'employee', 'assigned_only', pg_temp.acc_uuid(1), true),
  (pg_temp.acc_uuid(12), 'employee', 'assigned_only', pg_temp.acc_uuid(1), true);

insert into public.projects (
  id, organization_id, title, owner_id, sponsor_id, created_by, status, progress_percent
) values (
  pg_temp.acc_uuid(100), pg_temp.acc_uuid(1), 'ACC directly assigned project',
  pg_temp.acc_uuid(10), null, pg_temp.acc_uuid(11), 'active', 0
);

insert into public.milestones (
  id, organization_id, project_id, title, owner_id, created_by, status, progress_percent
) values (
  pg_temp.acc_uuid(110), pg_temp.acc_uuid(1), pg_temp.acc_uuid(100),
  'ACC milestone', pg_temp.acc_uuid(11), pg_temp.acc_uuid(10), 'not_started', 0
);

insert into public.tasks (
  id, organization_id, project_id, milestone_id, title, owner_id, assigned_to,
  created_by, status, progress_percent
) values (
  pg_temp.acc_uuid(120), pg_temp.acc_uuid(1), pg_temp.acc_uuid(100), pg_temp.acc_uuid(110),
  'ACC assigned task', pg_temp.acc_uuid(10), pg_temp.acc_uuid(11),
  pg_temp.acc_uuid(10), 'not_started', 0
);

select ok(
  public.acc_v13_actor_can_control_project(
    pg_temp.acc_uuid(10),
    (select p from public.projects p where id = pg_temp.acc_uuid(100))
  ),
  'direct project owner controls the project without a broad manager role'
);

select ok(
  public.acc_v13_actor_can_control_project(
    pg_temp.acc_uuid(11),
    (select p from public.projects p where id = pg_temp.acc_uuid(100))
  ),
  'the exact project creator controls the assigned project without a broad manager role'
);

select is(
  (public.acc_v13_update_work_item_status(
    pg_temp.acc_uuid(10), 'milestone', pg_temp.acc_uuid(110),
    'in_progress', 90, null
  ) ->> 'status'),
  'in_progress',
  'project owner can set the child milestone to in_progress'
);

select is(
  (select progress_percent from public.milestones where id = pg_temp.acc_uuid(110)),
  90.00::numeric,
  'the exact 90 percent milestone update persists'
);

select is(
  (select updated_by from public.milestones where id = pg_temp.acc_uuid(110)),
  pg_temp.acc_uuid(10),
  'the controlled status update records its actor'
);

select ok(
  exists (
    select 1 from public.audit_logs
    where actor_id = pg_temp.acc_uuid(10)
      and action = 'acc_v13_status_update'
      and table_name = 'milestone'
      and record_id = pg_temp.acc_uuid(110)
  ),
  'the milestone status update writes normal audit evidence'
);

select throws_ok(
  $$select public.acc_v13_update_work_item_status(
      pg_temp.acc_uuid(12), 'milestone', pg_temp.acc_uuid(110),
      'in_progress', 80, null
    )$$,
  'ACC_V13_WORK_ITEM_NOT_AUTHORIZED',
  'an unrelated assigned-only employee fails closed'
);

select throws_ok(
  $$select public.acc_v13_update_work_item_status(
      pg_temp.acc_uuid(10), 'milestone', pg_temp.acc_uuid(110),
      'in_progress', 101, null
    )$$,
  'ACC_V13_PROGRESS_OUT_OF_RANGE',
  'progress above 100 fails closed'
);

select throws_ok(
  $$insert into public.approvals (
      organization_id, project_id, requested_by, approver_id
    ) values (
      pg_temp.acc_uuid(1), pg_temp.acc_uuid(100),
      pg_temp.acc_uuid(10), pg_temp.acc_uuid(10)
    )$$,
  'You cannot approve your own request. Select another authorized approver.',
  'requester and approver cannot be the same person'
);

insert into public.evidence_files (
  id, organization_id, task_id, file_name, file_path, file_type, uploaded_by
) values (
  pg_temp.acc_uuid(130), pg_temp.acc_uuid(1), pg_temp.acc_uuid(120),
  'acc-proof.pdf', 'acc-v13/acc-proof.pdf', 'application/pdf', pg_temp.acc_uuid(10)
);

select is(
  (public.acc_v13_authorize_evidence_access(
    pg_temp.acc_uuid(11), pg_temp.acc_uuid(130), 'view'
  ) ->> 'intent'),
  'view',
  'the exact task assignee can authorize access to related evidence'
);

select ok(
  exists (
    select 1 from public.audit_logs
    where actor_id = pg_temp.acc_uuid(11)
      and action = 'acc_v13_evidence_view'
      and record_id = pg_temp.acc_uuid(130)
  ),
  'evidence view authorization is audited'
);

select throws_ok(
  $$select public.acc_v13_authorize_evidence_access(
      pg_temp.acc_uuid(12), pg_temp.acc_uuid(130), 'view'
    )$$,
  'ACC_V13_EVIDENCE_ACCESS_DENIED',
  'an unrelated employee cannot authorize evidence access'
);

select throws_ok(
  $$select public.acc_v13_authorize_evidence_access(
      pg_temp.acc_uuid(11), pg_temp.acc_uuid(130), 'share'
    )$$,
  'ACC_V13_EVIDENCE_INTENT_INVALID',
  'an unsupported evidence intent fails closed'
);

select is(
  (select count(*)::integer from public.user_roles where user_id = pg_temp.acc_uuid(10) and role = 'project_owner'),
  0,
  'direct project assignment does not grant a broad project_owner role'
);

select pg_catalog.set_config('request.jwt.claim.sub', pg_temp.acc_uuid(10)::text, true);

select is(
  (select count(*)::integer from public.v_my_open_work_expanded where id = pg_temp.acc_uuid(100)),
  1,
  'the directly assigned project appears once in the governed My Work view'
);

select is(
  (select count(*)::integer from public.audit_logs where actor_id = pg_temp.acc_uuid(12)),
  0,
  'failed authorization attempts make no business or audit mutation'
);

select * from finish();
rollback;
