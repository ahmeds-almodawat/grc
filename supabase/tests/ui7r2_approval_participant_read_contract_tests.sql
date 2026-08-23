-- UI-7R2 rollback-only participant-scoped approval RLS proof.
begin;
create extension if not exists pgtap;
select no_plan();
select pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);

create or replace function pg_temp.ui7r2_uuid(p_value integer)
returns uuid
language sql
immutable
as $$
  select ('71520000-0000-4000-8000-' || lpad(p_value::text, 12, '0'))::uuid
$$;

create or replace function pg_temp.ui7r2_authenticate(
  p_actor_id uuid,
  p_valid_frontend_contract boolean default true
)
returns text
language plpgsql
as $$
declare
  v_email text;
  v_organization_id uuid;
  v_session_id uuid;
begin
  select lower(p.email), p.organization_id
  into v_email, v_organization_id
  from public.profiles p
  where p.id = p_actor_id;

  select s.id
  into v_session_id
  from auth.sessions s
  where s.user_id = p_actor_id
  order by s.created_at desc, s.id
  limit 1;

  perform pg_catalog.set_config('request.jwt.claim.sub', p_actor_id::text, true);
  perform pg_catalog.set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', p_actor_id,
      'role', 'authenticated',
      'email', v_email,
      'session_id', v_session_id,
      'organization_id', v_organization_id,
      'app_metadata', jsonb_build_object(
        'credential_version', 1,
        'organization_id', v_organization_id
      )
    )::text,
    true
  );
  perform pg_catalog.set_config(
    'request.headers',
    case when p_valid_frontend_contract
      then '{"x-patch83u-frontend-contract-version":"patch83u-frontend-auth-first-v1"}'
      else '{}'
    end,
    true
  );
  return p_actor_id::text;
end;
$$;

insert into public.organizations (id, name_en)
values
  (pg_temp.ui7r2_uuid(1), 'UI-7R2 approval proof organization'),
  (pg_temp.ui7r2_uuid(2), 'UI-7R2 cross-organization proof');

insert into public.departments (id, organization_id, name_en, code, is_active)
values (
  pg_temp.ui7r2_uuid(30), pg_temp.ui7r2_uuid(1),
  'UI-7R2 scoped department', 'UI7R2', true
);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, created_at, updated_at
)
select
  id, 'authenticated', 'authenticated', email, '', now(),
  jsonb_build_object('credential_version', 1), now(), now()
from (values
  (pg_temp.ui7r2_uuid(10), 'ui7r2.requester@example.test'),
  (pg_temp.ui7r2_uuid(11), 'ui7r2.approver@example.test'),
  (pg_temp.ui7r2_uuid(12), 'ui7r2.delegate@example.test'),
  (pg_temp.ui7r2_uuid(13), 'ui7r2.admin@example.test'),
  (pg_temp.ui7r2_uuid(14), 'ui7r2.historical@example.test'),
  (pg_temp.ui7r2_uuid(15), 'ui7r2.employee@example.test'),
  (pg_temp.ui7r2_uuid(16), 'ui7r2.viewer@example.test'),
  (pg_temp.ui7r2_uuid(17), 'ui7r2.manager@example.test'),
  (pg_temp.ui7r2_uuid(18), 'ui7r2.crossorg@example.test'),
  (pg_temp.ui7r2_uuid(19), 'ui7r2.other-requester@example.test')
) actor(id, email);

insert into public.profiles (
  id, organization_id, employee_no, full_name_en, email,
  is_active, user_status, user_type
)
select
  id,
  case when id = pg_temp.ui7r2_uuid(18)
    then pg_temp.ui7r2_uuid(2)
    else pg_temp.ui7r2_uuid(1)
  end,
  'UI7R2-' || right(id::text, 4),
  display_name,
  email,
  true,
  'active',
  'employee'
from (values
  (pg_temp.ui7r2_uuid(10), 'UI7R2 Requester', 'ui7r2.requester@example.test'),
  (pg_temp.ui7r2_uuid(11), 'UI7R2 Approver', 'ui7r2.approver@example.test'),
  (pg_temp.ui7r2_uuid(12), 'UI7R2 Delegate', 'ui7r2.delegate@example.test'),
  (pg_temp.ui7r2_uuid(13), 'UI7R2 Super Admin', 'ui7r2.admin@example.test'),
  (pg_temp.ui7r2_uuid(14), 'UI7R2 Historical Participant', 'ui7r2.historical@example.test'),
  (pg_temp.ui7r2_uuid(15), 'UI7R2 Unrelated Employee', 'ui7r2.employee@example.test'),
  (pg_temp.ui7r2_uuid(16), 'UI7R2 Unrelated Viewer', 'ui7r2.viewer@example.test'),
  (pg_temp.ui7r2_uuid(17), 'UI7R2 Unrelated Manager', 'ui7r2.manager@example.test'),
  (pg_temp.ui7r2_uuid(18), 'UI7R2 Cross Organization', 'ui7r2.crossorg@example.test'),
  (pg_temp.ui7r2_uuid(19), 'UI7R2 Other Requester', 'ui7r2.other-requester@example.test')
) actor(id, display_name, email);

insert into public.user_credential_states (
  user_id, organization_id, auth_email, identity_mode, credential_state,
  requested_lifecycle, credential_version, session_valid_after
)
select
  p.id, p.organization_id, lower(p.email), 'legacy_verified', 'active',
  'active', 1, to_timestamp(0)
from public.profiles p
where p.id between pg_temp.ui7r2_uuid(10) and pg_temp.ui7r2_uuid(19)
on conflict (user_id) do update set
  organization_id = excluded.organization_id,
  auth_email = excluded.auth_email,
  identity_mode = excluded.identity_mode,
  credential_state = excluded.credential_state,
  requested_lifecycle = excluded.requested_lifecycle,
  credential_version = excluded.credential_version,
  session_valid_after = excluded.session_valid_after,
  invalidated_session_id = null;

insert into auth.sessions (id, user_id, created_at, updated_at)
select pg_temp.ui7r2_uuid(1000 + n), pg_temp.ui7r2_uuid(10 + n), now(), now()
from generate_series(0, 9) n;

insert into public.user_roles (
  user_id, role, scope, organization_id, department_id, is_active
)
values
  (pg_temp.ui7r2_uuid(10), 'employee', 'assigned_only', pg_temp.ui7r2_uuid(1), null, true),
  (pg_temp.ui7r2_uuid(11), 'compliance_officer', 'global', pg_temp.ui7r2_uuid(1), null, true),
  (pg_temp.ui7r2_uuid(12), 'employee', 'assigned_only', pg_temp.ui7r2_uuid(1), null, true),
  (pg_temp.ui7r2_uuid(13), 'super_admin', 'global', pg_temp.ui7r2_uuid(1), null, true),
  (pg_temp.ui7r2_uuid(14), 'employee', 'assigned_only', pg_temp.ui7r2_uuid(1), null, true),
  (pg_temp.ui7r2_uuid(15), 'employee', 'assigned_only', pg_temp.ui7r2_uuid(1), null, true),
  (pg_temp.ui7r2_uuid(16), 'viewer', 'assigned_only', pg_temp.ui7r2_uuid(1), null, true),
  (pg_temp.ui7r2_uuid(17), 'department_manager', 'department', pg_temp.ui7r2_uuid(1), pg_temp.ui7r2_uuid(30), true),
  (pg_temp.ui7r2_uuid(18), 'employee', 'assigned_only', pg_temp.ui7r2_uuid(2), null, true),
  (pg_temp.ui7r2_uuid(19), 'employee', 'assigned_only', pg_temp.ui7r2_uuid(1), null, true);

insert into public.approval_authority_rules (
  id, organization_id, rule_code, rule_name, workflow_type, action_type,
  approver_user_id, approver_role, allow_self_approval, active_flag,
  effective_date, expiry_date
)
values
  (
    pg_temp.ui7r2_uuid(100), pg_temp.ui7r2_uuid(1), 'UI7R2-RULE-1',
    'UI7R2 participant rule', 'general', 'approve',
    pg_temp.ui7r2_uuid(11), null, false, true,
    current_date - 1, current_date + 1
  ),
  (
    pg_temp.ui7r2_uuid(101), pg_temp.ui7r2_uuid(1), 'UI7R2-RULE-2',
    'UI7R2 unrelated rule', 'general', 'approve',
    pg_temp.ui7r2_uuid(19), null, false, true,
    current_date - 1, current_date + 1
  ),
  (
    pg_temp.ui7r2_uuid(102), pg_temp.ui7r2_uuid(2), 'UI7R2-RULE-X',
    'UI7R2 cross-organization rule', 'general', 'approve',
    pg_temp.ui7r2_uuid(18), null, false, true,
    current_date - 1, current_date + 1
  );

insert into public.approval_requests (
  id, organization_id, request_code, workflow_type, linked_item_type,
  action_type, department_id, requested_by, request_status,
  required_approval_count, received_approval_count, authority_rule_id,
  final_decision, final_decision_by, final_decision_at
)
values
  (
    pg_temp.ui7r2_uuid(200), pg_temp.ui7r2_uuid(1), 'UI7R2-REQ-REQUESTER',
    'general', 'proof_item', 'approve', null, pg_temp.ui7r2_uuid(10),
    'partially_approved', 2, 1, pg_temp.ui7r2_uuid(100), null, null, null
  ),
  (
    pg_temp.ui7r2_uuid(201), pg_temp.ui7r2_uuid(1), 'UI7R2-REQ-DELEGATE',
    'general', 'proof_item', 'approve', pg_temp.ui7r2_uuid(30), pg_temp.ui7r2_uuid(19),
    'pending', 1, 0, pg_temp.ui7r2_uuid(100), null, null, null
  ),
  (
    pg_temp.ui7r2_uuid(202), pg_temp.ui7r2_uuid(1), 'UI7R2-REQ-COMPLETED',
    'general', 'proof_item', 'approve', null, pg_temp.ui7r2_uuid(19),
    'approved', 1, 1, pg_temp.ui7r2_uuid(100), 'approved', pg_temp.ui7r2_uuid(14), now()
  ),
  (
    pg_temp.ui7r2_uuid(203), pg_temp.ui7r2_uuid(1), 'UI7R2-REQ-STALE',
    'general', 'proof_item', 'approve', null, pg_temp.ui7r2_uuid(19),
    'pending', 1, 0, pg_temp.ui7r2_uuid(100), null, null, null
  ),
  (
    pg_temp.ui7r2_uuid(204), pg_temp.ui7r2_uuid(2), 'UI7R2-REQ-CROSSORG',
    'general', 'proof_item', 'approve', null, pg_temp.ui7r2_uuid(18),
    'pending', 1, 0, pg_temp.ui7r2_uuid(102), null, null, null
  );

insert into public.approval_request_stages (
  id, approval_request_id, stage_order, stage_key, stage_name_en,
  stage_status, required_decision_count, received_decision_count,
  assigned_user_id, allow_self_approval, started_at, completed_at
)
values
  (
    pg_temp.ui7r2_uuid(300), pg_temp.ui7r2_uuid(200), 1, 'historical',
    'Historical review', 'approved', 1, 1, pg_temp.ui7r2_uuid(14), false,
    now() - interval '2 days', now() - interval '1 day'
  ),
  (
    pg_temp.ui7r2_uuid(301), pg_temp.ui7r2_uuid(200), 2, 'current',
    'Current review', 'in_progress', 1, 0, pg_temp.ui7r2_uuid(11), false,
    now() - interval '1 day', null
  ),
  (
    pg_temp.ui7r2_uuid(302), pg_temp.ui7r2_uuid(201), 1, 'delegated',
    'Delegated review', 'in_progress', 1, 0, pg_temp.ui7r2_uuid(11), false,
    now() - interval '1 hour', null
  ),
  (
    pg_temp.ui7r2_uuid(303), pg_temp.ui7r2_uuid(202), 1, 'complete',
    'Completed review', 'approved', 1, 1, pg_temp.ui7r2_uuid(14), false,
    now() - interval '2 days', now() - interval '1 day'
  ),
  (
    pg_temp.ui7r2_uuid(304), pg_temp.ui7r2_uuid(203), 1, 'stale',
    'Stale review', 'approved', 1, 1, pg_temp.ui7r2_uuid(11), false,
    now() - interval '2 days', now() - interval '1 day'
  ),
  (
    pg_temp.ui7r2_uuid(305), pg_temp.ui7r2_uuid(204), 1, 'crossorg',
    'Cross-organization review', 'in_progress', 1, 0, pg_temp.ui7r2_uuid(18), false,
    now() - interval '1 hour', null
  );

insert into public.approval_decisions (
  id, approval_request_id, request_stage_id, approver_id,
  authority_rule_id, approver_role, decision, decision_note, decided_at
)
values
  (
    pg_temp.ui7r2_uuid(400), pg_temp.ui7r2_uuid(200), pg_temp.ui7r2_uuid(300),
    pg_temp.ui7r2_uuid(14), pg_temp.ui7r2_uuid(100), 'assigned_user',
    'approved', 'Historical approval proof', now() - interval '1 day'
  ),
  (
    pg_temp.ui7r2_uuid(401), pg_temp.ui7r2_uuid(202), pg_temp.ui7r2_uuid(303),
    pg_temp.ui7r2_uuid(14), pg_temp.ui7r2_uuid(100), 'assigned_user',
    'approved', 'Completed approval proof', now() - interval '1 day'
  );

insert into public.approval_delegations (
  id, organization_id, delegator_id, delegate_id, workflow_type,
  action_type, department_id, effective_from, effective_to,
  delegation_reason, active_flag, created_by
)
values (
  pg_temp.ui7r2_uuid(500), pg_temp.ui7r2_uuid(1),
  pg_temp.ui7r2_uuid(11), pg_temp.ui7r2_uuid(12), 'general',
  'approve', pg_temp.ui7r2_uuid(30), now() - interval '1 day',
  now() + interval '1 day', 'Scoped UI-7R2 delegation', true,
  pg_temp.ui7r2_uuid(11)
);

select pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);

select pg_temp.ui7r2_authenticate(pg_temp.ui7r2_uuid(10));
set local role authenticated;
select is(
  (select count(*)::integer from public.approval_requests where id = pg_temp.ui7r2_uuid(200)),
  1,
  'requester can read own legitimate approval request'
);
select is(
  (select count(*)::integer from public.approval_request_stages where approval_request_id = pg_temp.ui7r2_uuid(200)),
  2,
  'legitimate request reader can read parent-bounded stages'
);
select is(
  (select count(*)::integer from public.approval_decisions where approval_request_id = pg_temp.ui7r2_uuid(200)),
  1,
  'legitimate request reader can read parent-bounded decision history'
);
select is(
  (select count(*)::integer from public.approval_authority_rules where id in (pg_temp.ui7r2_uuid(100), pg_temp.ui7r2_uuid(101))),
  1,
  'requester sees only authority metadata referenced by a visible request'
);
reset role;

select pg_temp.ui7r2_authenticate(pg_temp.ui7r2_uuid(11));
set local role authenticated;
select is(
  (select count(*)::integer from public.approval_requests where id = pg_temp.ui7r2_uuid(200)),
  1,
  'assigned current approver can read assigned request'
);
select is(
  (select count(*)::integer from public.approval_delegations where id = pg_temp.ui7r2_uuid(500)),
  1,
  'delegator can read own delegation'
);
reset role;

select pg_temp.ui7r2_authenticate(pg_temp.ui7r2_uuid(12));
set local role authenticated;
select is(
  (select count(*)::integer from public.approval_requests where id = pg_temp.ui7r2_uuid(201)),
  1,
  'active scoped delegate can read delegated request'
);
select is(
  (select count(*)::integer from public.approval_requests where id = pg_temp.ui7r2_uuid(200)),
  0,
  'delegate cannot read request outside delegation department scope'
);
select is(
  (select count(*)::integer from public.approval_delegations where id = pg_temp.ui7r2_uuid(500)),
  1,
  'delegate can read own delegation'
);
reset role;

select pg_temp.ui7r2_authenticate(pg_temp.ui7r2_uuid(13));
set local role authenticated;
select is(
  (select count(*)::integer from public.approval_requests where organization_id = pg_temp.ui7r2_uuid(1)),
  4,
  'authorized same-organization Super Admin can read approval requests'
);
select is(
  (select count(*)::integer from public.approval_requests where organization_id = pg_temp.ui7r2_uuid(2)),
  0,
  'Super Admin authority does not cross organizations'
);
select is(
  (select count(*)::integer from public.approval_authority_rules where id in (pg_temp.ui7r2_uuid(100), pg_temp.ui7r2_uuid(101), pg_temp.ui7r2_uuid(102))),
  2,
  'Super Admin sees only same-organization approval rules'
);
reset role;

select pg_temp.ui7r2_authenticate(pg_temp.ui7r2_uuid(14));
set local role authenticated;
select is(
  (select count(*)::integer from public.approval_requests where id = pg_temp.ui7r2_uuid(200)),
  1,
  'historical stage and decision participant retains legitimate request visibility'
);
reset role;

select pg_temp.ui7r2_authenticate(pg_temp.ui7r2_uuid(15));
set local role authenticated;
select is(
  (select count(*)::integer from public.approval_requests where id in (pg_temp.ui7r2_uuid(200), pg_temp.ui7r2_uuid(201), pg_temp.ui7r2_uuid(202))),
  0,
  'unrelated same-organization employee reads zero approval requests'
);
select is(
  (select count(*)::integer from public.approval_request_stages where approval_request_id = pg_temp.ui7r2_uuid(200)),
  0,
  'user without parent request visibility reads zero stages'
);
select is(
  (select count(*)::integer from public.approval_decisions where approval_request_id = pg_temp.ui7r2_uuid(200)),
  0,
  'user without parent request visibility reads zero decisions'
);
select is(
  (select count(*)::integer from public.approval_delegations where id = pg_temp.ui7r2_uuid(500)),
  0,
  'unrelated same-organization employee reads zero delegations'
);
select is(
  (select count(*)::integer from public.approval_authority_rules where id in (pg_temp.ui7r2_uuid(100), pg_temp.ui7r2_uuid(101))),
  0,
  'ordinary unauthorized user reads zero authority rules'
);
reset role;

select pg_temp.ui7r2_authenticate(pg_temp.ui7r2_uuid(16));
set local role authenticated;
select is(
  (select count(*)::integer from public.approval_requests where id in (pg_temp.ui7r2_uuid(200), pg_temp.ui7r2_uuid(201), pg_temp.ui7r2_uuid(202))),
  0,
  'unrelated same-organization viewer reads zero approval requests'
);
reset role;

select pg_temp.ui7r2_authenticate(pg_temp.ui7r2_uuid(17));
set local role authenticated;
select is(
  (select count(*)::integer from public.approval_requests where id in (pg_temp.ui7r2_uuid(200), pg_temp.ui7r2_uuid(201), pg_temp.ui7r2_uuid(202))),
  0,
  'unrelated same-organization manager receives no implicit approval visibility'
);
reset role;

select pg_temp.ui7r2_authenticate(pg_temp.ui7r2_uuid(18));
set local role authenticated;
select is(
  (select count(*)::integer from public.approval_requests where organization_id = pg_temp.ui7r2_uuid(1)),
  0,
  'cross-organization actor reads zero requests from the protected organization'
);
reset role;

select pg_temp.ui7r2_authenticate(pg_temp.ui7r2_uuid(10), false);
set local role authenticated;
select is(
  (select count(*)::integer from public.approval_requests where id = pg_temp.ui7r2_uuid(200)),
  0,
  'otherwise eligible participant failing Patch83U reads zero requests'
);
reset role;

select pg_temp.ui7r2_authenticate(pg_temp.ui7r2_uuid(10), true);
set local role authenticated;
select is(
  (select count(*)::integer from public.approval_requests where id = pg_temp.ui7r2_uuid(200)),
  1,
  'equivalent participant with valid Patch83U state can read'
);
reset role;

set local role anon;
select throws_ok(
  $$select * from public.approval_requests$$,
  '42501', null,
  'anon has no approval request SELECT privilege'
);
reset role;

select ok(
  not has_table_privilege('public', 'public.approval_requests', 'SELECT')
  and not has_table_privilege('public', 'public.approval_request_stages', 'SELECT')
  and not has_table_privilege('public', 'public.approval_decisions', 'SELECT')
  and not has_table_privilege('public', 'public.approval_delegations', 'SELECT')
  and not has_table_privilege('public', 'public.approval_authority_rules', 'SELECT'),
  'PUBLIC has no SELECT privilege on approval relations'
);
select ok(
  has_table_privilege('authenticated', 'public.approval_requests', 'SELECT')
  and has_table_privilege('authenticated', 'public.approval_request_stages', 'SELECT')
  and has_table_privilege('authenticated', 'public.approval_decisions', 'SELECT')
  and has_table_privilege('authenticated', 'public.approval_delegations', 'SELECT')
  and has_table_privilege('authenticated', 'public.approval_authority_rules', 'SELECT'),
  'authenticated has SELECT on the exact five approval relations'
);
select ok(
  not has_table_privilege('authenticated', 'public.approval_requests', 'INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated', 'public.approval_request_stages', 'INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated', 'public.approval_decisions', 'INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated', 'public.approval_delegations', 'INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated', 'public.approval_authority_rules', 'INSERT,UPDATE,DELETE'),
  'authenticated browser has no direct approval DML privileges'
);
select ok(
  not has_schema_privilege('public', 'ui7_approval_private', 'USAGE')
  and not has_schema_privilege('anon', 'ui7_approval_private', 'USAGE')
  and has_schema_privilege('authenticated', 'ui7_approval_private', 'USAGE'),
  'private helper schema is unavailable to PUBLIC and anon and minimally usable by authenticated policies'
);

select pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
select throws_ok(
  $$select public.record_approval_decision(
    pg_temp.ui7r2_uuid(200), pg_temp.ui7r2_uuid(10),
    'approved', 'self approval must fail', null
  )$$,
  'PATCH27_SELF_APPROVAL_BLOCKED',
  'requester cannot self-approve solely because read access exists'
);
select throws_ok(
  $$select public.record_approval_decision(
    pg_temp.ui7r2_uuid(200), pg_temp.ui7r2_uuid(15),
    'approved', 'unrelated approval must fail', null
  )$$,
  'PATCH27_APPROVER_USER_MISMATCH',
  'unrelated user cannot decide an approval request'
);
select throws_ok(
  $$select public.record_approval_decision(
    pg_temp.ui7r2_uuid(202), pg_temp.ui7r2_uuid(14),
    'approved', 'completed approval must remain immutable', null
  )$$,
  'PATCH27_REQUEST_ALREADY_CLOSED',
  'completed approval decision remains immutable'
);
select throws_ok(
  $$select public.record_approval_decision(
    pg_temp.ui7r2_uuid(203), pg_temp.ui7r2_uuid(11),
    'approved', 'stale approval must fail', null
  )$$,
  'PATCH27_NO_IN_PROGRESS_STAGE',
  'stale request without an in-progress stage remains non-actionable'
);

select * from finish();
rollback;
