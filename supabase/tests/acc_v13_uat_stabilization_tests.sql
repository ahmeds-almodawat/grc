-- ACC v1.3 UAT stabilization behavioral contracts.
-- Run only against a disposable local database after migration 195.
-- All fixtures and mutations are rolled back.

begin;

create extension if not exists pgtap;
select plan(50);
select pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);

create or replace function pg_temp.acc_uuid(p_value integer)
returns uuid
language sql
immutable
as $$
  select ('a1300000-0000-4000-8000-' || lpad(p_value::text, 12, '0'))::uuid;
$$;

insert into public.organizations (id, name_en)
values
  (pg_temp.acc_uuid(1), 'ACC v1.3 local test organization'),
  (pg_temp.acc_uuid(2), 'ACC v1.3 cross-organization fixture');

insert into public.divisions (id, organization_id, name_en)
values
  (pg_temp.acc_uuid(3), pg_temp.acc_uuid(1), 'ACC division'),
  (pg_temp.acc_uuid(5), pg_temp.acc_uuid(1), 'ACC unrelated division');

insert into public.departments (id, organization_id, division_id, name_en)
values
  (pg_temp.acc_uuid(4), pg_temp.acc_uuid(1), pg_temp.acc_uuid(3), 'ACC department'),
  (pg_temp.acc_uuid(6), pg_temp.acc_uuid(1), pg_temp.acc_uuid(5), 'ACC unrelated department');

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, created_at, updated_at
)
select id, 'authenticated', 'authenticated', email, '', now(),
       '{"credential_version":1}'::jsonb, now(), now()
from (values
  (pg_temp.acc_uuid(10), 'acc-owner@example.test'),
  (pg_temp.acc_uuid(11), 'acc-assignee@example.test'),
  (pg_temp.acc_uuid(12), 'acc-outsider@example.test'),
  (pg_temp.acc_uuid(13), 'acc-sponsor@example.test'),
  (pg_temp.acc_uuid(14), 'acc-global@example.test'),
  (pg_temp.acc_uuid(15), 'acc-division@example.test'),
  (pg_temp.acc_uuid(16), 'acc-department@example.test'),
  (pg_temp.acc_uuid(17), 'acc-auditor@example.test'),
  (pg_temp.acc_uuid(18), 'acc-compliance@example.test'),
  (pg_temp.acc_uuid(19), 'acc-project-role@example.test'),
  (pg_temp.acc_uuid(20), 'acc-milestone-role@example.test'),
  (pg_temp.acc_uuid(21), 'acc-reviewer@example.test'),
  (pg_temp.acc_uuid(22), 'acc-ovr-reporter@example.test'),
  (pg_temp.acc_uuid(23), 'acc-unrelated-division@example.test'),
  (pg_temp.acc_uuid(24), 'acc-unrelated-department@example.test'),
  (pg_temp.acc_uuid(30), 'acc-cross-org@example.test')
) fixture(id, email);

insert into public.profiles (
  id, organization_id, full_name_en, email, employee_no, is_active, user_status
)
select id, case when id = pg_temp.acc_uuid(30) then pg_temp.acc_uuid(2) else pg_temp.acc_uuid(1) end, label, email,
       'ACC-' || right(replace(id::text, '-', ''), 6), true, 'active'
from (values
  (pg_temp.acc_uuid(10), 'ACC owner', 'acc-owner@example.test'),
  (pg_temp.acc_uuid(11), 'ACC assignee', 'acc-assignee@example.test'),
  (pg_temp.acc_uuid(12), 'ACC outsider', 'acc-outsider@example.test'),
  (pg_temp.acc_uuid(13), 'ACC sponsor', 'acc-sponsor@example.test'),
  (pg_temp.acc_uuid(14), 'ACC global approver', 'acc-global@example.test'),
  (pg_temp.acc_uuid(15), 'ACC division approver', 'acc-division@example.test'),
  (pg_temp.acc_uuid(16), 'ACC department approver', 'acc-department@example.test'),
  (pg_temp.acc_uuid(17), 'ACC unrelated auditor', 'acc-auditor@example.test'),
  (pg_temp.acc_uuid(18), 'ACC unrelated compliance', 'acc-compliance@example.test'),
  (pg_temp.acc_uuid(19), 'ACC unrelated project role', 'acc-project-role@example.test'),
  (pg_temp.acc_uuid(20), 'ACC unrelated milestone role', 'acc-milestone-role@example.test'),
  (pg_temp.acc_uuid(21), 'ACC evidence reviewer', 'acc-reviewer@example.test'),
  (pg_temp.acc_uuid(22), 'ACC OVR reporter', 'acc-ovr-reporter@example.test'),
  (pg_temp.acc_uuid(23), 'ACC unrelated division approver', 'acc-unrelated-division@example.test'),
  (pg_temp.acc_uuid(24), 'ACC unrelated department approver', 'acc-unrelated-department@example.test'),
  (pg_temp.acc_uuid(30), 'ACC cross organization', 'acc-cross-org@example.test')
) fixture(id, label, email);

insert into public.user_credential_states (
  user_id, organization_id, auth_email, identity_mode, credential_state,
  requested_lifecycle, credential_version
)
select id, case when id = pg_temp.acc_uuid(30) then pg_temp.acc_uuid(2) else pg_temp.acc_uuid(1) end, email, 'legacy_verified', 'active', 'active', 1
from (values
  (pg_temp.acc_uuid(10), 'acc-owner@example.test'),
  (pg_temp.acc_uuid(11), 'acc-assignee@example.test'),
  (pg_temp.acc_uuid(12), 'acc-outsider@example.test'),
  (pg_temp.acc_uuid(13), 'acc-sponsor@example.test'),
  (pg_temp.acc_uuid(14), 'acc-global@example.test'),
  (pg_temp.acc_uuid(15), 'acc-division@example.test'),
  (pg_temp.acc_uuid(16), 'acc-department@example.test'),
  (pg_temp.acc_uuid(17), 'acc-auditor@example.test'),
  (pg_temp.acc_uuid(18), 'acc-compliance@example.test'),
  (pg_temp.acc_uuid(19), 'acc-project-role@example.test'),
  (pg_temp.acc_uuid(20), 'acc-milestone-role@example.test'),
  (pg_temp.acc_uuid(21), 'acc-reviewer@example.test'),
  (pg_temp.acc_uuid(22), 'acc-ovr-reporter@example.test'),
  (pg_temp.acc_uuid(23), 'acc-unrelated-division@example.test'),
  (pg_temp.acc_uuid(24), 'acc-unrelated-department@example.test'),
  (pg_temp.acc_uuid(30), 'acc-cross-org@example.test')
) fixture(id, email)
on conflict (user_id) do update set
  organization_id = excluded.organization_id,
  auth_email = excluded.auth_email,
  identity_mode = excluded.identity_mode,
  credential_state = excluded.credential_state,
  requested_lifecycle = excluded.requested_lifecycle,
  credential_version = excluded.credential_version;

insert into public.patch83u_runtime_control (singleton)
values (true)
on conflict (singleton) do update set enforcement_state = 'disabled';

insert into public.user_roles (user_id, role, scope, organization_id, is_active)
values
  (pg_temp.acc_uuid(10), 'employee', 'assigned_only', pg_temp.acc_uuid(1), true),
  (pg_temp.acc_uuid(11), 'employee', 'assigned_only', pg_temp.acc_uuid(1), true),
  (pg_temp.acc_uuid(12), 'employee', 'assigned_only', pg_temp.acc_uuid(1), true),
  (pg_temp.acc_uuid(13), 'employee', 'assigned_only', pg_temp.acc_uuid(1), true),
  (pg_temp.acc_uuid(14), 'governance_admin', 'global', pg_temp.acc_uuid(1), true),
  (pg_temp.acc_uuid(17), 'auditor', 'global', pg_temp.acc_uuid(1), true),
  (pg_temp.acc_uuid(18), 'compliance_officer', 'global', pg_temp.acc_uuid(1), true),
  (pg_temp.acc_uuid(19), 'project_owner', 'assigned_only', pg_temp.acc_uuid(1), true),
  (pg_temp.acc_uuid(20), 'milestone_owner', 'assigned_only', pg_temp.acc_uuid(1), true),
  (pg_temp.acc_uuid(21), 'employee', 'assigned_only', pg_temp.acc_uuid(1), true),
  (pg_temp.acc_uuid(22), 'employee', 'assigned_only', pg_temp.acc_uuid(1), true),
  (pg_temp.acc_uuid(30), 'super_admin', 'global', pg_temp.acc_uuid(2), true);

insert into public.user_roles (user_id, role, scope, organization_id, division_id, is_active)
values
  (pg_temp.acc_uuid(15), 'division_head', 'division', pg_temp.acc_uuid(1), pg_temp.acc_uuid(3), true),
  (pg_temp.acc_uuid(23), 'division_head', 'division', pg_temp.acc_uuid(1), pg_temp.acc_uuid(5), true);

insert into public.user_roles (user_id, role, scope, organization_id, department_id, is_active)
values
  (pg_temp.acc_uuid(16), 'department_manager', 'department', pg_temp.acc_uuid(1), pg_temp.acc_uuid(4), true),
  (pg_temp.acc_uuid(24), 'department_manager', 'department', pg_temp.acc_uuid(1), pg_temp.acc_uuid(6), true);

insert into public.projects (
  id, organization_id, title, division_id, department_id, owner_id, sponsor_id, created_by, status, progress_percent
) values (
  pg_temp.acc_uuid(100), pg_temp.acc_uuid(1), 'ACC directly assigned project',
  pg_temp.acc_uuid(3), pg_temp.acc_uuid(4), pg_temp.acc_uuid(10), pg_temp.acc_uuid(13), pg_temp.acc_uuid(11), 'active', 0
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
  (select progress_percent from public.projects where id = pg_temp.acc_uuid(100)),
  45.00::numeric,
  'the existing rollup trigger preserves the 90/0 milestone-task average'
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

select is(
  (public.acc_v13_update_work_item_status(
    pg_temp.acc_uuid(11), 'milestone', pg_temp.acc_uuid(110),
    'at_risk', 75, null
  ) ->> 'status'),
  'at_risk',
  'the exact milestone owner can update the governed milestone'
);

select is(
  (public.acc_v13_update_work_item_status(
    pg_temp.acc_uuid(11), 'task', pg_temp.acc_uuid(120),
    'in_progress', 40, null
  ) ->> 'status'),
  'in_progress',
  'the exact task assignee can update the governed task'
);

select throws_ok(
  $$select public.acc_v13_update_work_item_status(
      pg_temp.acc_uuid(11), 'task', pg_temp.acc_uuid(120),
      'delayed', 40, null
    )$$,
  'ACC_V13_DELAY_REASON_REQUIRED',
  'delayed status without a reason fails closed'
);

select is(
  (public.acc_v13_update_work_item_status(
    pg_temp.acc_uuid(11), 'task', pg_temp.acc_uuid(120),
    'delayed', 40, 'Waiting for the controlled dependency'
  ) ->> 'status'),
  'delayed',
  'delayed status with a reason passes'
);

select is(
  (select delay_reason from public.tasks where id = pg_temp.acc_uuid(120)),
  'Waiting for the controlled dependency',
  'the governed task preserves the exact delay reason'
);

select throws_ok(
  $$select public.acc_v13_update_work_item_status(
      pg_temp.acc_uuid(11), 'milestone', pg_temp.acc_uuid(110),
      'closed', 100, null
    )$$,
  'Accepted evidence is required before approving or closing this milestone.',
  'the existing accepted-evidence closure guard still fires'
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

select is(
  (select array_agg(id order by id) from public.acc_v13_list_eligible_approvers(
    pg_temp.acc_uuid(10), 'project', pg_temp.acc_uuid(100)
  )),
  array[pg_temp.acc_uuid(13), pg_temp.acc_uuid(14), pg_temp.acc_uuid(15), pg_temp.acc_uuid(16)]::uuid[],
  'project approvers are limited to sponsor and exact organization-global/division/department authority'
);

select is(
  (select array_agg(id order by id) from public.acc_v13_list_eligible_approvers(
    pg_temp.acc_uuid(11), 'task', pg_temp.acc_uuid(120)
  )),
  array[pg_temp.acc_uuid(10), pg_temp.acc_uuid(13), pg_temp.acc_uuid(14), pg_temp.acc_uuid(15), pg_temp.acc_uuid(16)]::uuid[],
  'child approvers additionally include the exact parent project owner and sponsor'
);

select is(
  (select count(*)::integer from public.acc_v13_list_eligible_approvers(
    pg_temp.acc_uuid(10), 'project', pg_temp.acc_uuid(100)
  ) where id = pg_temp.acc_uuid(10)),
  0,
  'the requester is excluded from eligible approvers'
);

select is(
  (select count(*)::integer from public.acc_v13_list_eligible_approvers(
    pg_temp.acc_uuid(10), 'project', pg_temp.acc_uuid(100)
  ) where id in (pg_temp.acc_uuid(17), pg_temp.acc_uuid(18), pg_temp.acc_uuid(19), pg_temp.acc_uuid(20))),
  0,
  'auditor, compliance officer, project_owner and milestone_owner roles are not standalone approval authority'
);

select ok(
  public.acc_v13_is_eligible_approver(
    pg_temp.acc_uuid(11), pg_temp.acc_uuid(10), 'task', pg_temp.acc_uuid(120)
  ),
  'the exact parent project owner is eligible for child approval'
);

select ok(
  public.acc_v13_is_eligible_approver(
    pg_temp.acc_uuid(11), pg_temp.acc_uuid(16), 'task', pg_temp.acc_uuid(120)
  ),
  'the correctly scoped department manager is eligible'
);

select ok(
  public.acc_v13_is_eligible_approver(
    pg_temp.acc_uuid(11), pg_temp.acc_uuid(15), 'task', pg_temp.acc_uuid(120)
  ),
  'the correctly scoped division head is eligible'
);

select ok(
  public.acc_v13_is_eligible_approver(
    pg_temp.acc_uuid(11), pg_temp.acc_uuid(14), 'task', pg_temp.acc_uuid(120)
  ),
  'the organization-global governance actor is eligible'
);

select throws_ok(
  $$select public.acc_v13_request_approval(
      pg_temp.acc_uuid(11), pg_temp.acc_uuid(1), 'task', pg_temp.acc_uuid(120),
      pg_temp.acc_uuid(12), 'Unrelated employee must fail'
    )$$,
  'ACC_V13_APPROVER_NOT_ELIGIBLE',
  'an unrelated employee cannot be crafted into an approval'
);

select throws_ok(
  $$select public.acc_v13_request_approval(
      pg_temp.acc_uuid(11), pg_temp.acc_uuid(1), 'task', pg_temp.acc_uuid(120),
      pg_temp.acc_uuid(24), 'Unrelated department must fail'
    )$$,
  'ACC_V13_APPROVER_NOT_ELIGIBLE',
  'an unrelated department manager cannot be crafted into an approval'
);

select throws_ok(
  $$select public.acc_v13_request_approval(
      pg_temp.acc_uuid(11), pg_temp.acc_uuid(1), 'task', pg_temp.acc_uuid(120),
      pg_temp.acc_uuid(23), 'Unrelated division must fail'
    )$$,
  'ACC_V13_APPROVER_NOT_ELIGIBLE',
  'an unrelated division head cannot be crafted into an approval'
);

select throws_ok(
  $$select public.acc_v13_request_approval(
      pg_temp.acc_uuid(11), pg_temp.acc_uuid(1), 'task', pg_temp.acc_uuid(120),
      pg_temp.acc_uuid(17), 'Auditor must fail'
    )$$,
  'ACC_V13_APPROVER_NOT_ELIGIBLE',
  'an auditor without specific authority cannot be crafted into an approval'
);

select throws_ok(
  $$select public.acc_v13_request_approval(
      pg_temp.acc_uuid(11), pg_temp.acc_uuid(1), 'task', pg_temp.acc_uuid(120),
      pg_temp.acc_uuid(30), 'Cross organization must fail'
    )$$,
  'ACC_V13_APPROVER_NOT_ELIGIBLE',
  'a cross-organization approver cannot be crafted into an approval'
);

select is(
  (public.acc_v13_request_approval(
    pg_temp.acc_uuid(10), pg_temp.acc_uuid(1), 'project', pg_temp.acc_uuid(100),
    pg_temp.acc_uuid(13), 'ACC governed approval request'
  ) ->> 'status'),
  'pending',
  'the protected approval action accepts an exact eligible sponsor'
);

select is(
  (select count(*)::integer from public.approvals
   where project_id = pg_temp.acc_uuid(100)
     and requested_by = pg_temp.acc_uuid(10)
     and approver_id = pg_temp.acc_uuid(13)
     and status = 'pending'),
  1,
  'the protected approval action creates exactly one item-bound approval'
);

select ok(
  exists (
    select 1 from public.audit_logs
    where actor_id = pg_temp.acc_uuid(10)
      and action = 'acc_v13_approval_requested'
      and table_name = 'approvals'
  ),
  'the protected approval request is audited'
);

select throws_ok(
  $$insert into public.approvals (
      organization_id, project_id, requested_by, approver_id
    ) values (
      pg_temp.acc_uuid(1), pg_temp.acc_uuid(100),
      pg_temp.acc_uuid(10), pg_temp.acc_uuid(17)
    )$$,
  'ACC_V13_APPROVER_NOT_ELIGIBLE',
  'the database trigger rejects an unrelated auditor as approver'
);

insert into public.evidence_files (
  id, organization_id, task_id, file_name, file_path, file_type, uploaded_by, reviewed_by
) values (
  pg_temp.acc_uuid(130), pg_temp.acc_uuid(1), pg_temp.acc_uuid(120),
  'acc-proof.pdf', 'acc-v13/acc-proof.pdf', 'application/pdf', pg_temp.acc_uuid(10), pg_temp.acc_uuid(21)
);

insert into public.evidence_files (
  id, organization_id, project_id, file_name, file_path, file_type, uploaded_by
) values (
  pg_temp.acc_uuid(131), pg_temp.acc_uuid(1), pg_temp.acc_uuid(100),
  'acc-project-proof.pdf', 'acc-v13/acc-project-proof.pdf', 'application/pdf', pg_temp.acc_uuid(12)
);

insert into public.ovr_reports (
  id, organization_id, brief_description, reported_by, owner_id, status
) values (
  pg_temp.acc_uuid(140), pg_temp.acc_uuid(1), 'ACC OVR evidence entitlement fixture',
  pg_temp.acc_uuid(22), pg_temp.acc_uuid(10), 'submitted'
);

insert into public.evidence_files (
  id, organization_id, ovr_report_id, file_name, file_path, file_type, uploaded_by
) values (
  pg_temp.acc_uuid(132), pg_temp.acc_uuid(1), pg_temp.acc_uuid(140),
  'acc-ovr-proof.pdf', 'acc-v13/acc-ovr-proof.pdf', 'application/pdf', pg_temp.acc_uuid(12)
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

select is(
  (public.acc_v13_authorize_evidence_access(
    pg_temp.acc_uuid(10), pg_temp.acc_uuid(131), 'view'
  ) ->> 'evidence_file_id'),
  pg_temp.acc_uuid(131)::text,
  'the exact project owner can authorize related project evidence'
);

select is(
  (public.acc_v13_authorize_evidence_access(
    pg_temp.acc_uuid(21), pg_temp.acc_uuid(130), 'download'
  ) ->> 'intent'),
  'download',
  'the exact evidence reviewer can authorize the governed record'
);

select throws_ok(
  $$select public.acc_v13_authorize_evidence_access(
      pg_temp.acc_uuid(30), pg_temp.acc_uuid(130), 'view'
    )$$,
  'ACC_V13_EVIDENCE_NOT_FOUND',
  'cross-organization evidence access fails without disclosing the record'
);

select is(
  (public.acc_v13_authorize_evidence_access(
    pg_temp.acc_uuid(22), pg_temp.acc_uuid(132), 'view'
  ) ->> 'evidence_file_id'),
  pg_temp.acc_uuid(132)::text,
  'the exact OVR reporter entitlement authorizes its evidence record'
);

select throws_ok(
  $$select public.acc_v13_authorize_evidence_access(
      pg_temp.acc_uuid(12), pg_temp.acc_uuid(132), 'view'
    )$$,
  'ACC_V13_EVIDENCE_ACCESS_DENIED',
  'an uploader without OVR entitlement cannot bypass the OVR relationship gate'
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

insert into storage.buckets (id, name, public)
values ('grc-evidence', 'grc-evidence', false)
on conflict (id) do update set public = false;

select is(
  (select public from storage.buckets where id = 'grc-evidence'),
  false,
  'the governed evidence bucket remains private'
);

select is(
  (select count(*)::integer from pg_policies
   where schemaname = 'storage'
     and tablename = 'objects'
     and cmd = 'SELECT'
     and permissive = 'PERMISSIVE'),
  0,
  'authenticated storage reads have no permissive SELECT policy after migration 195'
);

insert into storage.objects (id, bucket_id, name)
values (pg_temp.acc_uuid(150), 'grc-evidence', 'acc-v13/direct-select-denied.pdf');

select pg_catalog.set_config('request.jwt.claim.sub', pg_temp.acc_uuid(13)::text, true);
set local role authenticated;

select is(
  (select count(*)::integer from storage.objects where id = pg_temp.acc_uuid(150)),
  0,
  'an authenticated client receives no private storage object through direct SELECT'
);

select throws_ok(
  $$delete from public.milestones where id = pg_temp.acc_uuid(110)$$,
  '42501',
  'permission denied for table milestones',
  'a parent sponsor receives no new direct milestone DELETE authority'
);

select throws_ok(
  $$delete from public.tasks where id = pg_temp.acc_uuid(120)$$,
  '42501',
  'permission denied for table tasks',
  'a parent sponsor receives no new direct task DELETE authority'
);

reset role;

select * from finish();
rollback;
