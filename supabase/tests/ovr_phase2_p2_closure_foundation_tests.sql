-- GRC v1.1 OVR Phase 2 P2 behavioral contracts.
-- Run only against a disposable local database after migration 193.
-- All fixtures and mutations are rolled back; cross-session races live in the
-- dedicated P2 concurrency harness.

begin;

create extension if not exists pgtap;
select no_plan();
select pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);

create or replace function pg_temp.p2_uuid(p_value integer)
returns uuid
language sql
immutable
as $$
  select ('93200000-0000-4000-8000-' || lpad(p_value::text, 12, '0'))::uuid;
$$;

insert into public.organizations (id, name_en) values
  (pg_temp.p2_uuid(1), 'P2 Contract Organization'),
  (pg_temp.p2_uuid(2), 'P2 Other Organization');

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at
)
select id, 'authenticated', 'authenticated', email, '', now(), now(), now()
from (values
  (pg_temp.p2_uuid(10), 'p2-reporter@example.test'),
  (pg_temp.p2_uuid(11), 'p2-other-reporter@example.test'),
  (pg_temp.p2_uuid(20), 'p2-quality-a@example.test'),
  (pg_temp.p2_uuid(21), 'p2-quality-b@example.test'),
  (pg_temp.p2_uuid(22), 'p2-role-only@example.test'),
  (pg_temp.p2_uuid(23), 'p2-executive@example.test'),
  (pg_temp.p2_uuid(24), 'p2-auditor@example.test'),
  (pg_temp.p2_uuid(25), 'p2-conflicted@example.test'),
  (pg_temp.p2_uuid(30), 'p2-other-org-actor@example.test'),
  (pg_temp.p2_uuid(31), 'p2-other-org-reporter@example.test')
) fixture(id, email);

insert into public.profiles (
  id, organization_id, full_name_en, email, employee_no, is_active, user_status
)
select
  id,
  case when id in (pg_temp.p2_uuid(30), pg_temp.p2_uuid(31))
       then pg_temp.p2_uuid(2) else pg_temp.p2_uuid(1) end,
  'P2 ' || right(id::text, 4),
  email,
  'P2-' || right(replace(id::text, '-', ''), 8),
  true,
  'active'
from (values
  (pg_temp.p2_uuid(10), 'p2-reporter@example.test'),
  (pg_temp.p2_uuid(11), 'p2-other-reporter@example.test'),
  (pg_temp.p2_uuid(20), 'p2-quality-a@example.test'),
  (pg_temp.p2_uuid(21), 'p2-quality-b@example.test'),
  (pg_temp.p2_uuid(22), 'p2-role-only@example.test'),
  (pg_temp.p2_uuid(23), 'p2-executive@example.test'),
  (pg_temp.p2_uuid(24), 'p2-auditor@example.test'),
  (pg_temp.p2_uuid(25), 'p2-conflicted@example.test'),
  (pg_temp.p2_uuid(30), 'p2-other-org-actor@example.test'),
  (pg_temp.p2_uuid(31), 'p2-other-org-reporter@example.test')
) fixture(id, email);

insert into public.user_credential_states (
  user_id, organization_id, auth_email, identity_mode, credential_state,
  requested_lifecycle, credential_version
)
select id, organization_id, email, 'legacy_verified', 'active', 'active', 1
from public.profiles
where id::text like '93200000-0000-4000-8000-%'
on conflict (user_id) do update
set organization_id = excluded.organization_id,
    auth_email = excluded.auth_email,
    identity_mode = excluded.identity_mode,
    credential_state = excluded.credential_state,
    requested_lifecycle = excluded.requested_lifecycle,
    credential_version = excluded.credential_version,
    session_valid_after = clock_timestamp();

insert into public.divisions (id, organization_id, name_en, code) values
  (pg_temp.p2_uuid(101), pg_temp.p2_uuid(1), 'P2 Division', 'P2-DIV'),
  (pg_temp.p2_uuid(102), pg_temp.p2_uuid(2), 'P2 Other Division', 'P2-ODIV');

insert into public.departments (id, organization_id, division_id, name_en, code) values
  (pg_temp.p2_uuid(111), pg_temp.p2_uuid(1), pg_temp.p2_uuid(101), 'P2 Department', 'P2-DEPT'),
  (pg_temp.p2_uuid(112), pg_temp.p2_uuid(2), pg_temp.p2_uuid(102), 'P2 Other Department', 'P2-ODEPT');

update public.profiles
set division_id = case when organization_id = pg_temp.p2_uuid(1) then pg_temp.p2_uuid(101) else pg_temp.p2_uuid(102) end,
    department_id = case when organization_id = pg_temp.p2_uuid(1) then pg_temp.p2_uuid(111) else pg_temp.p2_uuid(112) end
where id::text like '93200000-0000-4000-8000-%';

insert into public.user_roles (user_id, role, scope, organization_id, is_active) values
  (pg_temp.p2_uuid(10), 'employee', 'assigned_only', pg_temp.p2_uuid(1), true),
  (pg_temp.p2_uuid(11), 'employee', 'assigned_only', pg_temp.p2_uuid(1), true),
  (pg_temp.p2_uuid(20), 'governance_admin', 'global', pg_temp.p2_uuid(1), true),
  (pg_temp.p2_uuid(21), 'compliance_officer', 'global', pg_temp.p2_uuid(1), true),
  (pg_temp.p2_uuid(22), 'super_admin', 'global', pg_temp.p2_uuid(1), true),
  (pg_temp.p2_uuid(23), 'executive', 'global', pg_temp.p2_uuid(1), true),
  (pg_temp.p2_uuid(24), 'auditor', 'global', pg_temp.p2_uuid(1), true),
  (pg_temp.p2_uuid(25), 'governance_admin', 'global', pg_temp.p2_uuid(1), true),
  (pg_temp.p2_uuid(30), 'governance_admin', 'global', pg_temp.p2_uuid(2), true),
  (pg_temp.p2_uuid(31), 'employee', 'assigned_only', pg_temp.p2_uuid(2), true);

insert into public.ovr_reviewer_pool_memberships (
  id, organization_id, profile_id, capability, scope, priority,
  confidential_clearance, retaliation_clearance, valid_from, is_active, created_by
) values
  (pg_temp.p2_uuid(201), pg_temp.p2_uuid(1), pg_temp.p2_uuid(20), 'final_verdict', 'global', 10, true, true, now() - interval '1 day', true, pg_temp.p2_uuid(20)),
  (pg_temp.p2_uuid(202), pg_temp.p2_uuid(1), pg_temp.p2_uuid(20), 'governance_closure', 'global', 10, true, true, now() - interval '1 day', true, pg_temp.p2_uuid(20)),
  (pg_temp.p2_uuid(203), pg_temp.p2_uuid(1), pg_temp.p2_uuid(21), 'final_verdict', 'global', 20, true, true, now() - interval '1 day', true, pg_temp.p2_uuid(20)),
  (pg_temp.p2_uuid(204), pg_temp.p2_uuid(1), pg_temp.p2_uuid(21), 'governance_closure', 'global', 20, true, true, now() - interval '1 day', true, pg_temp.p2_uuid(20)),
  (pg_temp.p2_uuid(205), pg_temp.p2_uuid(1), pg_temp.p2_uuid(25), 'final_verdict', 'global', 30, true, true, now() - interval '1 day', true, pg_temp.p2_uuid(20)),
  (pg_temp.p2_uuid(206), pg_temp.p2_uuid(1), pg_temp.p2_uuid(25), 'governance_closure', 'global', 30, true, true, now() - interval '1 day', true, pg_temp.p2_uuid(20)),
  (pg_temp.p2_uuid(207), pg_temp.p2_uuid(2), pg_temp.p2_uuid(30), 'final_verdict', 'global', 10, true, true, now() - interval '1 day', true, pg_temp.p2_uuid(30)),
  (pg_temp.p2_uuid(208), pg_temp.p2_uuid(2), pg_temp.p2_uuid(30), 'governance_closure', 'global', 10, true, true, now() - interval '1 day', true, pg_temp.p2_uuid(30)),
  (pg_temp.p2_uuid(209), pg_temp.p2_uuid(1), pg_temp.p2_uuid(10), 'governance_closure', 'global', 40, true, true, now() - interval '1 day', true, pg_temp.p2_uuid(20));

insert into public.ovr_separation_policies (
  organization_id, allow_same_actor_ordinary, configured_by, configuration_reason
) values (
  pg_temp.p2_uuid(1), true, pg_temp.p2_uuid(20), 'P2 explicit ordinary-case test policy'
), (
  pg_temp.p2_uuid(2), false, pg_temp.p2_uuid(30), 'P2 fail-closed control policy'
);

create or replace function pg_temp.p2_make_case(
  p_case integer,
  p_severity public.ovr_severity_level,
  p_sensitivity text,
  p_verdict_actor uuid,
  p_closure_actor uuid,
  p_evidence_required boolean default true,
  p_accept_evidence boolean default true,
  p_organization_id uuid default pg_temp.p2_uuid(1),
  p_reporter_id uuid default pg_temp.p2_uuid(10),
  p_linked_project_id uuid default null
)
returns table (
  ovr_id uuid,
  cycle_id uuid,
  verdict_stage_id uuid,
  closure_stage_id uuid,
  verdict_assignment_id uuid,
  closure_assignment_id uuid
)
language plpgsql
as $$
declare
  v_division_id uuid := case when p_organization_id = pg_temp.p2_uuid(1) then pg_temp.p2_uuid(101) else pg_temp.p2_uuid(102) end;
  v_department_id uuid := case when p_organization_id = pg_temp.p2_uuid(1) then pg_temp.p2_uuid(111) else pg_temp.p2_uuid(112) end;
  v_verdict_membership uuid;
  v_closure_membership uuid;
begin
  ovr_id := pg_temp.p2_uuid(1000 + p_case);
  cycle_id := pg_temp.p2_uuid(2000 + p_case);
  verdict_stage_id := pg_temp.p2_uuid(3000 + p_case);
  closure_stage_id := pg_temp.p2_uuid(4000 + p_case);
  verdict_assignment_id := pg_temp.p2_uuid(5000 + p_case);
  closure_assignment_id := pg_temp.p2_uuid(6000 + p_case);

  select id into strict v_verdict_membership
  from public.ovr_reviewer_pool_memberships
  where organization_id = p_organization_id
    and profile_id = p_verdict_actor
    and capability = 'final_verdict'
    and is_active;

  select id into strict v_closure_membership
  from public.ovr_reviewer_pool_memberships
  where organization_id = p_organization_id
    and profile_id = p_closure_actor
    and capability = 'governance_closure'
    and is_active;

  insert into public.ovr_reports (
    id, organization_id, ovr_number, brief_description, occurrence_category,
    division_id, department_id, reported_by, created_by, status, severity_level,
    evidence_required, linked_project_id
  ) values (
    ovr_id, p_organization_id, 'OVR-P2-' || lpad(p_case::text, 3, '0'),
    'P2 immutable closure fixture ' || p_case, 'other', v_division_id,
    v_department_id, p_reporter_id, p_reporter_id, 'quality_final_review',
    p_severity, p_evidence_required, p_linked_project_id
  );

  insert into public.ovr_relationship_state (
    organization_id, ovr_report_id, sensitivity, routing_status, routing_block_reason
  ) values (p_organization_id, ovr_id, p_sensitivity, 'ready', null);

  insert into public.ovr_related_persons (
    organization_id, ovr_report_id, profile_id, relationship_type, provenance,
    asserted_by, confirmation_status, confirmed_by, confirmed_at, is_active
  ) values (
    p_organization_id, ovr_id, p_reporter_id, 'reporter', 'report_submission',
    p_reporter_id, 'confirmed', p_reporter_id, now(), true
  );

  insert into public.ovr_review_cycles (
    id, organization_id, ovr_report_id, cycle_number, status, opened_by
  ) values (cycle_id, p_organization_id, ovr_id, 1, 'active', p_verdict_actor);

  insert into public.ovr_stage_instances (
    id, organization_id, ovr_report_id, review_cycle_id, stage_type,
    sequence_number, lifecycle_status, relationship_version
  ) values
    (verdict_stage_id, p_organization_id, ovr_id, cycle_id, 'final_verdict', 1, 'assigned', 0),
    (closure_stage_id, p_organization_id, ovr_id, cycle_id, 'governance_closure', 2, 'assigned', 0);

  insert into public.ovr_reviewer_assignments (
    id, organization_id, ovr_report_id, review_cycle_id, stage_instance_id,
    reviewer_profile_id, reviewer_membership_id, status, assignment_reason,
    candidate_digest, conflict_version, idempotency_key
  ) values
    (verdict_assignment_id, p_organization_id, ovr_id, cycle_id, verdict_stage_id,
     p_verdict_actor, v_verdict_membership, 'active', 'p2_contract_fixture',
     repeat('a', 64), 0, 'p2-fixture-verdict-' || p_case),
    (closure_assignment_id, p_organization_id, ovr_id, cycle_id, closure_stage_id,
     p_closure_actor, v_closure_membership, 'active', 'p2_contract_fixture',
     repeat('b', 64), 0, 'p2-fixture-closure-' || p_case);

  if p_accept_evidence then
    insert into public.evidence_files (
      organization_id, ovr_report_id, file_name, file_path, status,
      uploaded_by, review_status, is_current_version, expiry_date
    ) values (
      p_organization_id, ovr_id, 'p2-evidence-' || p_case || '.pdf',
      'p2/' || p_case || '/evidence.pdf', 'accepted', p_reporter_id,
      'accepted', true, current_date + 30
    );
  end if;

  return next;
end;
$$;

create or replace function pg_temp.p2_insert_lineage_fixture(
  p_seed integer,
  p_ovr_report_id uuid,
  p_supersedes_verdict_id uuid,
  p_self_supersession boolean default false
)
returns uuid
language plpgsql
as $$
declare
  v_cycle uuid := pg_temp.p2_uuid(10000 + p_seed);
  v_stage uuid := pg_temp.p2_uuid(11000 + p_seed);
  v_assignment uuid := pg_temp.p2_uuid(12000 + p_seed);
  v_verdict uuid := pg_temp.p2_uuid(13000 + p_seed);
  v_cycle_number integer;
begin
  select coalesce(max(cycle_number), 0) + 1 into v_cycle_number
  from public.ovr_review_cycles
  where organization_id=pg_temp.p2_uuid(1) and ovr_report_id=p_ovr_report_id;

  insert into public.ovr_review_cycles(
    id,organization_id,ovr_report_id,cycle_number,status,opened_by,closed_at,closed_by
  ) values (
    v_cycle,pg_temp.p2_uuid(1),p_ovr_report_id,v_cycle_number,'completed',
    pg_temp.p2_uuid(20),now(),pg_temp.p2_uuid(20)
  );
  insert into public.ovr_stage_instances(
    id,organization_id,ovr_report_id,review_cycle_id,stage_type,
    sequence_number,lifecycle_status,relationship_version,completed_at
  ) values (
    v_stage,pg_temp.p2_uuid(1),p_ovr_report_id,v_cycle,
    'final_verdict',1,'completed',0,now()
  );
  insert into public.ovr_reviewer_assignments(
    id,organization_id,ovr_report_id,review_cycle_id,stage_instance_id,
    reviewer_profile_id,reviewer_membership_id,status,assignment_reason,
    candidate_digest,conflict_version,idempotency_key,ended_at,termination_reason
  ) values (
    v_assignment,pg_temp.p2_uuid(1),p_ovr_report_id,v_cycle,v_stage,
    pg_temp.p2_uuid(20),pg_temp.p2_uuid(201),'completed','p2_lineage_fixture',
    repeat('d',64),0,'p2-lineage-assignment-' || p_seed,now(),'p2 lineage fixture'
  );
  insert into public.ovr_final_verdicts(
    id,organization_id,ovr_report_id,review_cycle_id,stage_instance_id,
    reviewer_assignment_id,issued_by,verdict,effective_severity,
    corrective_action_required,supersedes_verdict_id,idempotency_key,
    semantic_request_digest,immutable_response
  ) values (
    v_verdict,pg_temp.p2_uuid(1),p_ovr_report_id,v_cycle,v_stage,
    v_assignment,pg_temp.p2_uuid(20),'direct lineage fixture','level_2',false,
    case when p_self_supersession then v_verdict else p_supersedes_verdict_id end,
    'p2-lineage-verdict-' || p_seed,repeat('e',64),
    jsonb_build_object('status','issued','final_verdict_id',v_verdict)
  );
  return v_verdict;
end;
$$;

create temporary table p2_cases (
  label text primary key,
  ovr_id uuid,
  cycle_id uuid,
  verdict_stage_id uuid,
  closure_stage_id uuid,
  verdict_assignment_id uuid,
  closure_assignment_id uuid
) on commit drop;

insert into p2_cases select 'ordinary_same', c.* from pg_temp.p2_make_case(1, 'level_2', 'normal', pg_temp.p2_uuid(20), pg_temp.p2_uuid(20)) c;
insert into p2_cases select 'ordinary_distinct', c.* from pg_temp.p2_make_case(2, 'level_2', 'normal', pg_temp.p2_uuid(20), pg_temp.p2_uuid(21)) c;
insert into p2_cases select 'level4_same', c.* from pg_temp.p2_make_case(3, 'level_4', 'normal', pg_temp.p2_uuid(20), pg_temp.p2_uuid(20)) c;
insert into p2_cases select 'sentinel_same', c.* from pg_temp.p2_make_case(4, 'sentinel', 'normal', pg_temp.p2_uuid(20), pg_temp.p2_uuid(20)) c;
insert into p2_cases select 'confidential_same', c.* from pg_temp.p2_make_case(5, 'level_2', 'confidential', pg_temp.p2_uuid(20), pg_temp.p2_uuid(20)) c;
insert into p2_cases select 'retaliation_same', c.* from pg_temp.p2_make_case(6, 'level_2', 'retaliation_sensitive', pg_temp.p2_uuid(20), pg_temp.p2_uuid(20)) c;
insert into p2_cases select 'missing_evidence', c.* from pg_temp.p2_make_case(7, 'level_2', 'normal', pg_temp.p2_uuid(20), pg_temp.p2_uuid(21), true, false) c;
insert into p2_cases select 'missing_verdict', c.* from pg_temp.p2_make_case(8, 'level_2', 'normal', pg_temp.p2_uuid(20), pg_temp.p2_uuid(21)) c;
insert into p2_cases select 'verdict_conflict', c.* from pg_temp.p2_make_case(9, 'level_2', 'normal', pg_temp.p2_uuid(25), pg_temp.p2_uuid(21)) c;
insert into p2_cases select 'closure_conflict', c.* from pg_temp.p2_make_case(10, 'level_2', 'normal', pg_temp.p2_uuid(20), pg_temp.p2_uuid(25)) c;
insert into p2_cases select 'inactive_assignment', c.* from pg_temp.p2_make_case(11, 'level_2', 'normal', pg_temp.p2_uuid(20), pg_temp.p2_uuid(21)) c;
insert into p2_cases select 'ack', c.* from pg_temp.p2_make_case(12, 'level_2', 'normal', pg_temp.p2_uuid(20), pg_temp.p2_uuid(21)) c;
insert into p2_cases select 'dispute', c.* from pg_temp.p2_make_case(13, 'level_2', 'normal', pg_temp.p2_uuid(20), pg_temp.p2_uuid(21)) c;
insert into p2_cases select 'idempotency', c.* from pg_temp.p2_make_case(14, 'level_2', 'normal', pg_temp.p2_uuid(20), pg_temp.p2_uuid(21)) c;
insert into p2_cases select 'ordinary_unconfigured', c.* from pg_temp.p2_make_case(15, 'level_2', 'normal', pg_temp.p2_uuid(20), pg_temp.p2_uuid(20)) c;

-- Dedicated fixtures for the R1/R2/R3/R6 adversarial matrix.
insert into public.projects (
  id, organization_id, title, status, owner_id, created_by, closed_by, closed_at
) values (
  pg_temp.p2_uuid(901), pg_temp.p2_uuid(1), 'P2 closed corrective project',
  'closed', pg_temp.p2_uuid(20), pg_temp.p2_uuid(20), pg_temp.p2_uuid(20), now()
);

insert into p2_cases select 'evidence_submitted', c.* from pg_temp.p2_make_case(16, 'level_2', 'normal', pg_temp.p2_uuid(20), pg_temp.p2_uuid(21), true, false) c;
insert into p2_cases select 'evidence_rejected', c.* from pg_temp.p2_make_case(17, 'level_2', 'normal', pg_temp.p2_uuid(20), pg_temp.p2_uuid(21), true, false) c;
insert into p2_cases select 'evidence_noncurrent', c.* from pg_temp.p2_make_case(18, 'level_2', 'normal', pg_temp.p2_uuid(20), pg_temp.p2_uuid(21), true, false) c;
insert into p2_cases select 'evidence_superseded', c.* from pg_temp.p2_make_case(19, 'level_2', 'normal', pg_temp.p2_uuid(20), pg_temp.p2_uuid(21), true, false) c;
insert into p2_cases select 'evidence_expired', c.* from pg_temp.p2_make_case(20, 'level_2', 'normal', pg_temp.p2_uuid(20), pg_temp.p2_uuid(21), true, false) c;
insert into p2_cases select 'evidence_wrong_org', c.* from pg_temp.p2_make_case(21, 'level_2', 'normal', pg_temp.p2_uuid(20), pg_temp.p2_uuid(21), true, false) c;
insert into p2_cases select 'evidence_other_ovr', c.* from pg_temp.p2_make_case(22, 'level_2', 'normal', pg_temp.p2_uuid(20), pg_temp.p2_uuid(21), true, false) c;
insert into p2_cases select 'evidence_not_required', c.* from pg_temp.p2_make_case(23, 'level_2', 'normal', pg_temp.p2_uuid(20), pg_temp.p2_uuid(21), false, false) c;
insert into p2_cases select 'evidence_closed_project', c.* from pg_temp.p2_make_case(24, 'level_2', 'normal', pg_temp.p2_uuid(20), pg_temp.p2_uuid(21), true, false, pg_temp.p2_uuid(1), pg_temp.p2_uuid(10), pg_temp.p2_uuid(901)) c;
insert into p2_cases select 'evidence_stale_legacy', c.* from pg_temp.p2_make_case(26, 'level_2', 'normal', pg_temp.p2_uuid(20), pg_temp.p2_uuid(21), true, false) c;
insert into p2_cases select 'wrong_stage', c.* from pg_temp.p2_make_case(27, 'level_2', 'normal', pg_temp.p2_uuid(20), pg_temp.p2_uuid(21)) c;
insert into p2_cases select 'recused_verdict', c.* from pg_temp.p2_make_case(28, 'level_2', 'normal', pg_temp.p2_uuid(20), pg_temp.p2_uuid(21)) c;
insert into p2_cases select 'recused_closer', c.* from pg_temp.p2_make_case(29, 'level_2', 'normal', pg_temp.p2_uuid(20), pg_temp.p2_uuid(21)) c;
insert into p2_cases select 'expired_verdict', c.* from pg_temp.p2_make_case(30, 'level_2', 'normal', pg_temp.p2_uuid(20), pg_temp.p2_uuid(21)) c;
insert into p2_cases select 'expired_closer', c.* from pg_temp.p2_make_case(31, 'level_2', 'normal', pg_temp.p2_uuid(20), pg_temp.p2_uuid(21)) c;
insert into p2_cases select 'cross_org_close', c.* from pg_temp.p2_make_case(32, 'level_2', 'normal', pg_temp.p2_uuid(20), pg_temp.p2_uuid(21)) c;
insert into p2_cases select 'reporter_multirole', c.* from pg_temp.p2_make_case(33, 'level_2', 'normal', pg_temp.p2_uuid(20), pg_temp.p2_uuid(10)) c;
insert into p2_cases select 'dispute_cancelled', c.* from pg_temp.p2_make_case(34, 'level_2', 'normal', pg_temp.p2_uuid(20), pg_temp.p2_uuid(21)) c;
insert into p2_cases select 'lifecycle_replay', c.* from pg_temp.p2_make_case(35, 'level_2', 'normal', pg_temp.p2_uuid(20), pg_temp.p2_uuid(21)) c;
insert into p2_cases select 'ambiguous_lineage', c.* from pg_temp.p2_make_case(36, 'level_2', 'normal', pg_temp.p2_uuid(20), pg_temp.p2_uuid(21)) c;

insert into public.evidence_files (
  id, organization_id, ovr_report_id, file_name, file_path, status,
  uploaded_by, review_status, is_current_version, expiry_date
) values
  (pg_temp.p2_uuid(9101), pg_temp.p2_uuid(1), (select ovr_id from p2_cases where label='evidence_submitted'), 'submitted.pdf', 'p2/evidence/submitted.pdf', 'submitted', pg_temp.p2_uuid(10), 'submitted', true, current_date + 30),
  (pg_temp.p2_uuid(9102), pg_temp.p2_uuid(1), (select ovr_id from p2_cases where label='evidence_rejected'), 'rejected.pdf', 'p2/evidence/rejected.pdf', 'rejected', pg_temp.p2_uuid(10), 'rejected', true, current_date + 30),
  (pg_temp.p2_uuid(9103), pg_temp.p2_uuid(1), (select ovr_id from p2_cases where label='evidence_noncurrent'), 'noncurrent.pdf', 'p2/evidence/noncurrent.pdf', 'accepted', pg_temp.p2_uuid(10), 'accepted', false, current_date + 30),
  (pg_temp.p2_uuid(9104), pg_temp.p2_uuid(1), (select ovr_id from p2_cases where label='evidence_superseded'), 'successor.pdf', 'p2/evidence/successor.pdf', 'submitted', pg_temp.p2_uuid(10), 'submitted', true, current_date + 30),
  (pg_temp.p2_uuid(9105), pg_temp.p2_uuid(1), (select ovr_id from p2_cases where label='evidence_expired'), 'expired.pdf', 'p2/evidence/expired.pdf', 'accepted', pg_temp.p2_uuid(10), 'accepted', true, current_date - 1),
  (pg_temp.p2_uuid(9106), pg_temp.p2_uuid(2), (select ovr_id from p2_cases where label='evidence_wrong_org'), 'wrong-org.pdf', 'p2/evidence/wrong-org.pdf', 'accepted', pg_temp.p2_uuid(31), 'accepted', true, current_date + 30),
  (pg_temp.p2_uuid(9107), pg_temp.p2_uuid(1), (select ovr_id from p2_cases where label='ordinary_same'), 'other-ovr.pdf', 'p2/evidence/other-ovr.pdf', 'accepted', pg_temp.p2_uuid(10), 'accepted', true, current_date + 30),
  (pg_temp.p2_uuid(9108), pg_temp.p2_uuid(1), (select ovr_id from p2_cases where label='evidence_stale_legacy'), 'stale-legacy.pdf', 'p2/evidence/stale-legacy.pdf', 'accepted', pg_temp.p2_uuid(10), 'accepted', false, current_date + 30),
  (pg_temp.p2_uuid(9109), pg_temp.p2_uuid(1), (select ovr_id from p2_cases where label='evidence_superseded'), 'superseded.pdf', 'p2/evidence/superseded.pdf', 'accepted', pg_temp.p2_uuid(10), 'accepted', false, current_date + 30);

update public.evidence_files
set superseded_by_evidence_id = pg_temp.p2_uuid(9104), is_current_version = false
where id = pg_temp.p2_uuid(9109);

-- A-F. Exact assignment, tenant, conflict, idempotency, and immutability.
create temporary table p2_results (label text primary key, result jsonb) on commit drop;

create or replace function pg_temp.p2_issue_and_close(
  p_label text,
  p_key text
)
returns jsonb
language plpgsql
as $$
declare
  v_case p2_cases%rowtype;
  v_verdict jsonb;
begin
  select * into strict v_case from p2_cases where label = p_label;
  v_verdict := public.ovr_v11_issue_final_verdict(
    pg_temp.p2_uuid(20), v_case.ovr_id, v_case.verdict_stage_id,
    'confirmed_occurrence', 'level_2', false, p_key || '-verdict', null
  );
  return public.ovr_v11_perform_governance_closure(
    pg_temp.p2_uuid(21), v_case.ovr_id, v_case.closure_stage_id,
    (v_verdict->>'final_verdict_id')::uuid, p_key || '-closure'
  );
end;
$$;

insert into p2_results
select 'ordinary_same_verdict', public.ovr_v11_issue_final_verdict(
  pg_temp.p2_uuid(20), ovr_id, verdict_stage_id, 'near_miss', 'level_2', false,
  'p2-verdict-ordinary-same', null
) from p2_cases where label = 'ordinary_same';

select is((select result->>'status' from p2_results where label = 'ordinary_same_verdict'), 'issued', 'A. exact assigned authorized reviewer issues verdict');
select is((select count(*)::integer from public.ovr_final_verdicts where ovr_report_id = (select ovr_id from p2_cases where label = 'ordinary_same')), 1, 'one authoritative verdict is stored for the cycle');

insert into public.ovr_related_persons (
  organization_id, ovr_report_id, profile_id, relationship_type, provenance,
  asserted_by, confirmation_status, confirmed_by, confirmed_at, is_active,
  conflict_actions
)
select pg_temp.p2_uuid(1), ovr_id, pg_temp.p2_uuid(25), 'subject',
       'quality_confirmation', pg_temp.p2_uuid(20), 'confirmed',
       pg_temp.p2_uuid(20), now(), true, array['final_verdict']::text[]
from p2_cases where label = 'verdict_conflict';

select throws_ok(
  format($sql$select public.ovr_v11_issue_final_verdict('%s','%s','%s','confirmed_occurrence','level_2',false,'p2-verdict-conflict',null)$sql$,
    pg_temp.p2_uuid(25),
    (select ovr_id from p2_cases where label = 'verdict_conflict'),
    (select verdict_stage_id from p2_cases where label = 'verdict_conflict')),
  'P0001', 'OVR_V11_ACTOR_CONFLICTED', 'B. conflicted reviewer is denied verdict'
);

select throws_ok(
  format($sql$select public.ovr_v11_issue_final_verdict('%s','%s','%s','confirmed_occurrence','level_2',false,'p2-verdict-cross-org',null)$sql$,
    pg_temp.p2_uuid(30),
    (select ovr_id from p2_cases where label = 'ordinary_distinct'),
    (select verdict_stage_id from p2_cases where label = 'ordinary_distinct')),
  'P0001', 'OVR_V11_CROSS_ORGANIZATION_DENIED', 'C. wrong-organization reviewer is denied'
);

select throws_ok(
  format($sql$update public.ovr_final_verdicts set verdict = 'mutated' where ovr_report_id = '%s'$sql$,
    (select ovr_id from p2_cases where label = 'ordinary_same')),
  'P0001', 'OVR_V11_IMMUTABLE_HISTORY', 'D/E. verdict UPDATE is denied'
);

select throws_ok(
  format($sql$delete from public.ovr_final_verdicts where ovr_report_id = '%s'$sql$,
    (select ovr_id from p2_cases where label = 'ordinary_same')),
  'P0001', 'OVR_V11_IMMUTABLE_HISTORY', 'F. verdict DELETE is denied'
);

-- G-O. Closure prerequisites, exact assignment, evidence, idempotency and immutability.
select throws_ok(
  format($sql$select public.ovr_v11_perform_governance_closure('%s','%s','%s','%s','p2-close-no-verdict')$sql$,
    pg_temp.p2_uuid(21),
    (select ovr_id from p2_cases where label = 'missing_verdict'),
    (select closure_stage_id from p2_cases where label = 'missing_verdict'),
    pg_temp.p2_uuid(999999)),
  'P0001', 'OVR_V11_FINAL_VERDICT_REQUIRED', 'G. closure requires an existing authoritative final verdict'
);

insert into p2_results
select 'inactive_verdict', public.ovr_v11_issue_final_verdict(
  pg_temp.p2_uuid(20), ovr_id, verdict_stage_id, 'confirmed_occurrence', 'level_2', false,
  'p2-verdict-inactive', null
) from p2_cases where label = 'inactive_assignment';

update public.ovr_reviewer_assignments
set status = 'ended', ended_at = now(), termination_reason = 'p2 inactive test'
where id = (select closure_assignment_id from p2_cases where label = 'inactive_assignment');

select throws_ok(
  format($sql$select public.ovr_v11_perform_governance_closure('%s','%s','%s','%s','p2-close-inactive')$sql$,
    pg_temp.p2_uuid(21),
    (select c.ovr_id from p2_cases c where c.label = 'inactive_assignment'),
    (select c.closure_stage_id from p2_cases c where c.label = 'inactive_assignment'),
    (select (r.result->>'final_verdict_id')::uuid from p2_results r where r.label = 'inactive_verdict')),
  'P0001', 'OVR_V11_ACTIVE_EXACT_ASSIGNMENT_REQUIRED', 'H. closure requires the current active exact assignment'
);

insert into p2_results
select 'closure_conflict_verdict', public.ovr_v11_issue_final_verdict(
  pg_temp.p2_uuid(20), ovr_id, verdict_stage_id, 'confirmed_occurrence', 'level_2', false,
  'p2-verdict-closure-conflict', null
) from p2_cases where label = 'closure_conflict';

insert into public.ovr_related_persons (
  organization_id, ovr_report_id, profile_id, relationship_type, provenance,
  asserted_by, confirmation_status, confirmed_by, confirmed_at, is_active,
  conflict_actions
)
select pg_temp.p2_uuid(1), ovr_id, pg_temp.p2_uuid(25), 'subject',
       'quality_confirmation', pg_temp.p2_uuid(20), 'confirmed',
       pg_temp.p2_uuid(20), now(), true, array['governance_closure']::text[]
from p2_cases where label = 'closure_conflict';

select throws_ok(
  format($sql$select public.ovr_v11_perform_governance_closure('%s','%s','%s','%s','p2-close-conflict')$sql$,
    pg_temp.p2_uuid(25),
    (select c.ovr_id from p2_cases c where c.label = 'closure_conflict'),
    (select c.closure_stage_id from p2_cases c where c.label = 'closure_conflict'),
    (select (r.result->>'final_verdict_id')::uuid from p2_results r where r.label = 'closure_conflict_verdict')),
  'P0001', 'OVR_V11_ACTOR_CONFLICTED', 'I. conflicted closer is denied'
);

insert into p2_results
select 'missing_evidence_verdict', public.ovr_v11_issue_final_verdict(
  pg_temp.p2_uuid(20), ovr_id, verdict_stage_id, 'confirmed_occurrence', 'level_2', false,
  'p2-verdict-missing-evidence', null
) from p2_cases where label = 'missing_evidence';

select throws_ok(
  format($sql$select public.ovr_v11_perform_governance_closure('%s','%s','%s','%s','p2-close-missing-evidence')$sql$,
    pg_temp.p2_uuid(21),
    (select c.ovr_id from p2_cases c where c.label = 'missing_evidence'),
    (select c.closure_stage_id from p2_cases c where c.label = 'missing_evidence'),
    (select (r.result->>'final_verdict_id')::uuid from p2_results r where r.label = 'missing_evidence_verdict')),
  'P0001', 'OVR_V11_EVIDENCE_GATE_NOT_SATISFIED', 'J. closure requires the versioned evidence gate'
);

insert into public.evidence_files(
  organization_id,ovr_report_id,file_name,file_path,status,uploaded_by,
  review_status,is_current_version,expiry_date
)
select pg_temp.p2_uuid(1),ovr_id,'p2-late-evidence.pdf','p2/late/evidence.pdf',
       'accepted',pg_temp.p2_uuid(10),'accepted',true,current_date+30
from p2_cases where label='missing_evidence';
select is((select public.ovr_v11_perform_governance_closure(
  pg_temp.p2_uuid(21),c.ovr_id,c.closure_stage_id,
  (select (result->>'final_verdict_id')::uuid from p2_results where label='missing_evidence_verdict'),
  'p2-close-missing-evidence')->>'status'
from p2_cases c where label='missing_evidence'), 'closed',
'a failed evidence-gate transaction does not reserve its idempotency key');

insert into p2_results
select 'ordinary_same_closure', public.ovr_v11_perform_governance_closure(
  pg_temp.p2_uuid(20), c.ovr_id, c.closure_stage_id,
  (select (result->>'final_verdict_id')::uuid from p2_results where label = 'ordinary_same_verdict'),
  'p2-close-ordinary-same'
) from p2_cases c where c.label = 'ordinary_same';

insert into p2_results
select 'ordinary_same_closure_retry', public.ovr_v11_perform_governance_closure(
  pg_temp.p2_uuid(20), c.ovr_id, c.closure_stage_id,
  (select (result->>'final_verdict_id')::uuid from p2_results where label = 'ordinary_same_verdict'),
  'p2-close-ordinary-same'
) from p2_cases c where c.label = 'ordinary_same';

select is((select result from p2_results where label = 'ordinary_same_closure_retry'), (select result from p2_results where label = 'ordinary_same_closure'), 'K. exact closure retry returns the original immutable response');
select is((select count(*)::integer from public.ovr_governance_closures where ovr_report_id = (select ovr_id from p2_cases where label = 'ordinary_same')), 1, 'L. duplicate governance closure is impossible');
select is((select status::text from public.ovr_reports where id = (select ovr_id from p2_cases where label = 'ordinary_same')), 'closed', 'governance closure closes the OVR');

select throws_ok(
  format($sql$update public.ovr_governance_closures set closed_at = now() + interval '1 day' where ovr_report_id = '%s'$sql$,
    (select ovr_id from p2_cases where label = 'ordinary_same')),
  'P0001', 'OVR_V11_IMMUTABLE_HISTORY', 'M/N. closure UPDATE is denied'
);
select throws_ok(
  format($sql$delete from public.ovr_governance_closures where ovr_report_id = '%s'$sql$,
    (select ovr_id from p2_cases where label = 'ordinary_same')),
  'P0001', 'OVR_V11_IMMUTABLE_HISTORY', 'O. closure DELETE is denied'
);

-- P-T. Explicit ordinary exception and mandatory risk separation.
select is((select result->>'status' from p2_results where label = 'ordinary_same_closure'), 'closed', 'P. configured ordinary Level 1-3 case permits the same cleared actor');

do $p2_mandatory_separation$
declare
  v_label text;
  v_key text;
  v_verdict jsonb;
  v_case p2_cases%rowtype;
begin
  foreach v_label in array array['level4_same','sentinel_same','confidential_same','retaliation_same'] loop
    select * into v_case from p2_cases where label = v_label;
    v_key := replace(v_label, '_', '-');
    v_verdict := public.ovr_v11_issue_final_verdict(
      pg_temp.p2_uuid(20), v_case.ovr_id, v_case.verdict_stage_id,
      'confirmed_occurrence', (select severity_level from public.ovr_reports where id = v_case.ovr_id),
      false, 'p2-verdict-' || v_key, null
    );
    insert into p2_results(label, result) values (v_label || '_verdict', v_verdict);
  end loop;
end;
$p2_mandatory_separation$;

select throws_ok(format($sql$select public.ovr_v11_perform_governance_closure('%s','%s','%s','%s','p2-close-level4')$sql$, pg_temp.p2_uuid(20), (select ovr_id from p2_cases where label='level4_same'), (select closure_stage_id from p2_cases where label='level4_same'), (select (result->>'final_verdict_id')::uuid from p2_results where label='level4_same_verdict')), 'P0001', 'OVR_V11_MANDATORY_SEPARATION_REQUIRED', 'Q. Level 4 requires distinct verdict and closure actors');
select throws_ok(format($sql$select public.ovr_v11_perform_governance_closure('%s','%s','%s','%s','p2-close-sentinel')$sql$, pg_temp.p2_uuid(20), (select ovr_id from p2_cases where label='sentinel_same'), (select closure_stage_id from p2_cases where label='sentinel_same'), (select (result->>'final_verdict_id')::uuid from p2_results where label='sentinel_same_verdict')), 'P0001', 'OVR_V11_MANDATORY_SEPARATION_REQUIRED', 'R. Sentinel requires distinct verdict and closure actors');
select throws_ok(format($sql$select public.ovr_v11_perform_governance_closure('%s','%s','%s','%s','p2-close-confidential')$sql$, pg_temp.p2_uuid(20), (select ovr_id from p2_cases where label='confidential_same'), (select closure_stage_id from p2_cases where label='confidential_same'), (select (result->>'final_verdict_id')::uuid from p2_results where label='confidential_same_verdict')), 'P0001', 'OVR_V11_MANDATORY_SEPARATION_REQUIRED', 'S. confidential case requires distinct verdict and closure actors');
select throws_ok(format($sql$select public.ovr_v11_perform_governance_closure('%s','%s','%s','%s','p2-close-retaliation')$sql$, pg_temp.p2_uuid(20), (select ovr_id from p2_cases where label='retaliation_same'), (select closure_stage_id from p2_cases where label='retaliation_same'), (select (result->>'final_verdict_id')::uuid from p2_results where label='retaliation_same_verdict')), 'P0001', 'OVR_V11_MANDATORY_SEPARATION_REQUIRED', 'T. retaliation-sensitive case requires distinct actors');

update public.ovr_separation_policies set allow_same_actor_ordinary = false where organization_id = pg_temp.p2_uuid(1);
insert into p2_results
select 'distinct_verdict', public.ovr_v11_issue_final_verdict(pg_temp.p2_uuid(20), ovr_id, verdict_stage_id, 'confirmed_occurrence', 'level_2', false, 'p2-verdict-distinct', null)
from p2_cases where label='ordinary_distinct';
select is((select public.ovr_v11_perform_governance_closure(pg_temp.p2_uuid(21), c.ovr_id, c.closure_stage_id, (select (result->>'final_verdict_id')::uuid from p2_results where label='distinct_verdict'), 'p2-close-distinct')->>'status' from p2_cases c where label='ordinary_distinct'), 'closed', 'ordinary policy with no same-actor exception succeeds for distinct assigned actors');
insert into p2_results
select 'ordinary_unconfigured_verdict', public.ovr_v11_issue_final_verdict(pg_temp.p2_uuid(20),ovr_id,verdict_stage_id,'confirmed_occurrence','level_2',false,'p2-verdict-unconfigured',null)
from p2_cases where label='ordinary_unconfigured';
select throws_ok(format($sql$select public.ovr_v11_perform_governance_closure('%s','%s','%s','%s','p2-close-unconfigured')$sql$,pg_temp.p2_uuid(20),(select ovr_id from p2_cases where label='ordinary_unconfigured'),(select closure_stage_id from p2_cases where label='ordinary_unconfigured'),(select (result->>'final_verdict_id')::uuid from p2_results where label='ordinary_unconfigured_verdict')),'P0001','OVR_V11_MANDATORY_SEPARATION_REQUIRED','ordinary same-actor closure is denied without an explicit allowing policy');

-- U-X. Broad application roles never replace the exact assignment.
select throws_ok(format($sql$select public.ovr_v11_perform_governance_closure('%s','%s','%s','%s','p2-close-reporter')$sql$, pg_temp.p2_uuid(10), (select ovr_id from p2_cases where label='missing_verdict'), (select closure_stage_id from p2_cases where label='missing_verdict'), pg_temp.p2_uuid(999999)), 'P0001', 'OVR_V11_ACTOR_CONFLICTED', 'U. reporter cannot governance-close');
select throws_ok(format($sql$select public.ovr_v11_perform_governance_closure('%s','%s','%s','%s','p2-close-role-only')$sql$, pg_temp.p2_uuid(22), (select ovr_id from p2_cases where label='missing_verdict'), (select closure_stage_id from p2_cases where label='missing_verdict'), pg_temp.p2_uuid(999999)), 'P0001', 'OVR_V11_ACTIVE_EXACT_ASSIGNMENT_REQUIRED', 'V. Super Admin role alone cannot governance-close');
select throws_ok(format($sql$select public.ovr_v11_perform_governance_closure('%s','%s','%s','%s','p2-close-executive')$sql$, pg_temp.p2_uuid(23), (select ovr_id from p2_cases where label='missing_verdict'), (select closure_stage_id from p2_cases where label='missing_verdict'), pg_temp.p2_uuid(999999)), 'P0001', 'OVR_V11_ACTIVE_EXACT_ASSIGNMENT_REQUIRED', 'W. Executive cannot governance-close');
select throws_ok(format($sql$select public.ovr_v11_perform_governance_closure('%s','%s','%s','%s','p2-close-auditor')$sql$, pg_temp.p2_uuid(24), (select ovr_id from p2_cases where label='missing_verdict'), (select closure_stage_id from p2_cases where label='missing_verdict'), pg_temp.p2_uuid(999999)), 'P0001', 'OVR_V11_ACTIVE_EXACT_ASSIGNMENT_REQUIRED', 'X. Auditor cannot governance-close');

-- Prepare independent closed cases for reporter response contracts.
insert into p2_results
select 'ack_verdict', public.ovr_v11_issue_final_verdict(pg_temp.p2_uuid(20), ovr_id, verdict_stage_id, 'confirmed_occurrence', 'level_2', false, 'p2-ack-verdict', null)
from p2_cases where label='ack';
insert into p2_results
select 'ack_closure', public.ovr_v11_perform_governance_closure(pg_temp.p2_uuid(21), c.ovr_id, c.closure_stage_id, (select (result->>'final_verdict_id')::uuid from p2_results where label='ack_verdict'), 'p2-ack-closure')
from p2_cases c where label='ack';

create temporary table p2_closure_snapshot as
select
  o.id as ovr_id,
  to_jsonb(o) as ovr_row,
  c.id as closure_id,
  to_jsonb(c) as closure_row,
  v.id as verdict_id,
  to_jsonb(v) as verdict_row
from public.ovr_reports o
join public.ovr_governance_closures c
  on c.organization_id=o.organization_id and c.ovr_report_id=o.id
join public.ovr_final_verdicts v
  on v.organization_id=c.organization_id and v.ovr_report_id=c.ovr_report_id
 and v.id=c.final_verdict_id
where o.id = (select ovr_id from p2_cases where label='ack');

insert into p2_results
select 'ack_response', public.ovr_v11_reporter_acknowledge(
  pg_temp.p2_uuid(10), ovr_id,
  (select (result->>'governance_closure_id')::uuid from p2_results where label='ack_closure'),
  'p2-reporter-ack'
)
from p2_cases where label='ack';
insert into p2_results
select 'ack_retry', public.ovr_v11_reporter_acknowledge(
  pg_temp.p2_uuid(10), ovr_id,
  (select (result->>'governance_closure_id')::uuid from p2_results where label='ack_closure'),
  'p2-reporter-ack'
)
from p2_cases where label='ack';

select is((select result->>'response_type' from p2_results where label='ack_response'), 'acknowledged', 'Y. reporter acknowledgment is allowed only after governance closure');
select ok(not exists(
  select 1
  from p2_closure_snapshot s
  join public.ovr_reports o on o.id=s.ovr_id
  join public.ovr_governance_closures c on c.id=s.closure_id
  join public.ovr_final_verdicts v on v.id=s.verdict_id
  where to_jsonb(o) is distinct from s.ovr_row
     or to_jsonb(c) is distinct from s.closure_row
     or to_jsonb(v) is distinct from s.verdict_row
), 'Z. acknowledgment preserves the complete OVR, closure, and verdict snapshots');
select is((select result from p2_results where label='ack_retry'), (select result from p2_results where label='ack_response'), 'AA. acknowledgment exact retry is idempotent');
select throws_ok(format($sql$select public.ovr_v11_reporter_acknowledge('%s','%s','%s','p2-nonreporter-ack')$sql$, pg_temp.p2_uuid(11), (select ovr_id from p2_cases where label='ack'), (select (result->>'governance_closure_id')::uuid from p2_results where label='ack_closure')), 'P0001', 'OVR_V11_REPORTER_ONLY', 'AB. non-reporter acknowledgment is denied');
select is((select count(*)::integer from public.ovr_governance_closures where ovr_report_id=(select ovr_id from p2_cases where label='ack')),1,'acknowledgment never creates a second closure');
select throws_ok(format($sql$select public.ovr_v11_reporter_acknowledge('%s','%s','%s','p2-ack-before-closure')$sql$,pg_temp.p2_uuid(10),(select ovr_id from p2_cases where label='missing_verdict'),pg_temp.p2_uuid(999998)),'P0001','OVR_V11_GOVERNANCE_CLOSURE_REQUIRED','acknowledgment before governance closure is denied');
select throws_ok(format($sql$select public.ovr_v11_reporter_acknowledge('%s','%s','%s','p2-reporter-ack')$sql$,pg_temp.p2_uuid(10),(select ovr_id from p2_cases where label='ordinary_same'),(select (result->>'governance_closure_id')::uuid from p2_results where label='ordinary_same_closure')),'P0001','OVR_V11_IDEMPOTENCY_KEY_REUSE_DENIED','same acknowledgment key with a different target closure fails closed');
select throws_ok($$update public.ovr_reporter_responses set response_type='disputed' where response_type='acknowledged'$$,'P0001','OVR_V11_IMMUTABLE_HISTORY','reporter response UPDATE is denied');
select throws_ok($$delete from public.ovr_reporter_responses where response_type='acknowledged'$$,'P0001','OVR_V11_IMMUTABLE_HISTORY','reporter response DELETE is denied');

-- AC-AI. Dispute is append-only and opens one separate review cycle.
insert into p2_results
select 'dispute_verdict', public.ovr_v11_issue_final_verdict(pg_temp.p2_uuid(20), ovr_id, verdict_stage_id, 'confirmed_occurrence', 'level_2', false, 'p2-dispute-verdict', null)
from p2_cases where label='dispute';
insert into p2_results
select 'dispute_closure', public.ovr_v11_perform_governance_closure(pg_temp.p2_uuid(21), c.ovr_id, c.closure_stage_id, (select (result->>'final_verdict_id')::uuid from p2_results where label='dispute_verdict'), 'p2-dispute-closure')
from p2_cases c where label='dispute';

create temporary table p2_dispute_snapshot as
select v.id verdict_id, v.verdict, v.effective_severity, c.id closure_id, c.closed_by, c.closed_at
from public.ovr_final_verdicts v
join public.ovr_governance_closures c on c.final_verdict_id=v.id
where v.ovr_report_id=(select ovr_id from p2_cases where label='dispute');

insert into p2_results
select 'dispute_response', public.ovr_v11_reporter_dispute(
  pg_temp.p2_uuid(10), ovr_id,
  (select (result->>'governance_closure_id')::uuid from p2_results where label='dispute_closure'),
  'The immutable outcome requires a separate review.', 'p2-reporter-dispute'
)
from p2_cases where label='dispute';
insert into p2_results
select 'dispute_retry', public.ovr_v11_reporter_dispute(
  pg_temp.p2_uuid(10), ovr_id,
  (select (result->>'governance_closure_id')::uuid from p2_results where label='dispute_closure'),
  'The immutable outcome requires a separate review.', 'p2-reporter-dispute'
)
from p2_cases where label='dispute';

select is((select result->>'response_type' from p2_results where label='dispute_response'), 'disputed', 'AC. reporter dispute is allowed after governance closure');
select is((select status::text from public.ovr_reports where id=(select ovr_id from p2_cases where label='dispute')), 'closed', 'AD. dispute does not change the main OVR closed status');
select ok(not exists(select 1 from public.ovr_final_verdicts v join p2_dispute_snapshot s on s.verdict_id=v.id where v.verdict is distinct from s.verdict or v.effective_severity is distinct from s.effective_severity), 'AE. dispute does not alter original verdict');
select ok(not exists(select 1 from public.ovr_governance_closures c join p2_dispute_snapshot s on s.closure_id=c.id where c.closed_by is distinct from s.closed_by or c.closed_at is distinct from s.closed_at), 'AF. dispute does not alter original closure');
select is((select count(*)::integer from public.ovr_post_closure_reviews where ovr_report_id=(select ovr_id from p2_cases where label='dispute')), 1, 'AG. dispute creates one post-closure review cycle');
select is((select result from p2_results where label='dispute_retry'), (select result from p2_results where label='dispute_response'), 'AH. identical dispute retry is idempotent');
select throws_ok(format($sql$select public.ovr_v11_reporter_dispute('%s','%s','%s','unauthorized dispute','p2-nonreporter-dispute')$sql$, pg_temp.p2_uuid(11), (select ovr_id from p2_cases where label='dispute'), (select (result->>'governance_closure_id')::uuid from p2_results where label='dispute_closure')), 'P0001', 'OVR_V11_REPORTER_ONLY', 'AI. non-reporter dispute is denied');

-- AJ. A later verdict supersedes by reference and never mutates history.
do $p2_supersession_fixture$
declare
  v_ovr uuid := (select ovr_id from p2_cases where label='dispute');
  v_cycle uuid := (select review_cycle_id from public.ovr_post_closure_reviews where ovr_report_id=v_ovr);
  v_stage uuid := pg_temp.p2_uuid(7013);
begin
  insert into public.ovr_stage_instances(id,organization_id,ovr_report_id,review_cycle_id,stage_type,sequence_number,lifecycle_status,relationship_version)
  values(v_stage,pg_temp.p2_uuid(1),v_ovr,v_cycle,'final_verdict',1,'assigned',0);
  insert into public.ovr_reviewer_assignments(id,organization_id,ovr_report_id,review_cycle_id,stage_instance_id,reviewer_profile_id,reviewer_membership_id,status,assignment_reason,candidate_digest,conflict_version,idempotency_key)
  values(pg_temp.p2_uuid(8013),pg_temp.p2_uuid(1),v_ovr,v_cycle,v_stage,pg_temp.p2_uuid(20),pg_temp.p2_uuid(201),'active','p2_post_closure_review',repeat('c',64),0,'p2-superseding-assignment');
end;
$p2_supersession_fixture$;

insert into p2_results
select 'superseding_verdict', public.ovr_v11_issue_final_verdict(
  pg_temp.p2_uuid(20), p.ovr_report_id, pg_temp.p2_uuid(7013),
  'superseding_outcome', 'level_1', false, 'p2-superseding-verdict', p.originating_verdict_id
)
from public.ovr_post_closure_reviews p
where p.ovr_report_id=(select ovr_id from p2_cases where label='dispute');

select is((select count(*)::integer from public.ovr_final_verdicts where ovr_report_id=(select ovr_id from p2_cases where label='dispute')), 2, 'AJ. superseding outcome appends a second verdict and preserves the original row');
select ok(exists(select 1 from public.ovr_final_verdicts v join p2_dispute_snapshot s on s.verdict_id=v.id where v.verdict=s.verdict), 'original verdict remains byte-semantically preserved after supersession');

-- AK and semantic-key mismatch protections.
select throws_ok(format($sql$select public.ovr_v11_reporter_dispute('%s','%s','%s','cross organization','p2-cross-org-dispute')$sql$, pg_temp.p2_uuid(31), (select ovr_id from p2_cases where label='dispute'), (select (result->>'governance_closure_id')::uuid from p2_results where label='dispute_closure')), 'P0001', 'OVR_V11_CROSS_ORGANIZATION_DENIED', 'AK. cross-organization reporter response is denied');

insert into p2_results
select 'idempotency_verdict', public.ovr_v11_issue_final_verdict(pg_temp.p2_uuid(20), ovr_id, verdict_stage_id, 'confirmed_occurrence', 'level_2', false, 'p2-shared-key', null)
from p2_cases where label='idempotency';
select throws_ok(format($sql$select public.ovr_v11_issue_final_verdict('%s','%s','%s','changed_verdict','level_2',false,'p2-shared-key',null)$sql$, pg_temp.p2_uuid(20), (select ovr_id from p2_cases where label='idempotency'), (select verdict_stage_id from p2_cases where label='idempotency')), 'P0001', 'OVR_V11_IDEMPOTENCY_KEY_REUSE_DENIED', 'same idempotency key with different verdict fails closed');
select throws_ok(format($sql$select public.ovr_v11_issue_final_verdict('%s','%s','%s','confirmed_occurrence','level_2',false,'p2-shared-key',null)$sql$, pg_temp.p2_uuid(21), (select ovr_id from p2_cases where label='idempotency'), (select verdict_stage_id from p2_cases where label='idempotency')), 'P0001', 'OVR_V11_IDEMPOTENCY_KEY_REUSE_DENIED', 'same idempotency key with different actor fails closed');

-- AL. Strict P2 evidence truth, not the legacy compatibility result, controls closure.
select is(
  (select evidence_gate_snapshot->>'satisfied'
   from public.ovr_governance_closures
   where ovr_report_id=(select ovr_id from p2_cases where label='ordinary_distinct')),
  'true',
  'AL. current accepted exact-tenant evidence satisfies the strict closure gate'
);
select is(
  (select evidence_gate_snapshot->>'strict_accepted_current_evidence_count'
   from public.ovr_governance_closures
   where ovr_report_id=(select ovr_id from p2_cases where label='ordinary_distinct')),
  '1',
  'strict evidence count is preserved in the immutable closure snapshot'
);
select throws_ok($$select pg_temp.p2_issue_and_close('evidence_submitted','p2-evidence-submitted')$$, 'P0001', 'OVR_V11_EVIDENCE_GATE_NOT_SATISFIED', 'submitted evidence cannot satisfy strict closure');
select throws_ok($$select pg_temp.p2_issue_and_close('evidence_rejected','p2-evidence-rejected')$$, 'P0001', 'OVR_V11_EVIDENCE_GATE_NOT_SATISFIED', 'rejected evidence cannot satisfy strict closure');
select throws_ok($$select pg_temp.p2_issue_and_close('evidence_noncurrent','p2-evidence-noncurrent')$$, 'P0001', 'OVR_V11_EVIDENCE_GATE_NOT_SATISFIED', 'accepted non-current evidence cannot satisfy strict closure');
select throws_ok($$select pg_temp.p2_issue_and_close('evidence_superseded','p2-evidence-superseded')$$, 'P0001', 'OVR_V11_EVIDENCE_GATE_NOT_SATISFIED', 'accepted superseded evidence cannot satisfy strict closure');
select throws_ok($$select pg_temp.p2_issue_and_close('evidence_expired','p2-evidence-expired')$$, 'P0001', 'OVR_V11_EVIDENCE_GATE_NOT_SATISFIED', 'expired evidence cannot satisfy strict closure');
select throws_ok($$select pg_temp.p2_issue_and_close('evidence_wrong_org','p2-evidence-wrong-org')$$, 'P0001', 'OVR_V11_EVIDENCE_GATE_NOT_SATISFIED', 'wrong-organization evidence cannot satisfy strict closure');
select throws_ok($$select pg_temp.p2_issue_and_close('evidence_other_ovr','p2-evidence-other-ovr')$$, 'P0001', 'OVR_V11_EVIDENCE_GATE_NOT_SATISFIED', 'evidence for another OVR cannot satisfy strict closure');
select is((pg_temp.p2_issue_and_close('evidence_not_required','p2-evidence-not-required')->>'status'), 'closed', 'evidence_required=false satisfies closure without an evidence row');
select is((pg_temp.p2_issue_and_close('evidence_closed_project','p2-evidence-closed-project')->>'status'), 'closed', 'closed linked corrective project preserves the authoritative compatibility path');
select is(public.can_close_ovr((select ovr_id from p2_cases where label='evidence_stale_legacy')), true, 'legacy can_close_ovr still reports stale accepted evidence for compatibility comparison');
select throws_ok($$select pg_temp.p2_issue_and_close('evidence_stale_legacy','p2-evidence-stale-legacy')$$, 'P0001', 'OVR_V11_EVIDENCE_GATE_NOT_SATISFIED', 'stale evidence cannot close even when legacy can_close_ovr is true');

-- R4/R5. Policy is migration-controlled, and tenant-scoped reporter lookups use the composite key.
select ok(has_table_privilege('service_role','public.ovr_separation_policies','SELECT'), 'service_role retains only controlled policy read access');
select ok(not has_table_privilege('service_role','public.ovr_separation_policies','INSERT'), 'service_role cannot arbitrarily insert separation policy');
select ok(not has_table_privilege('service_role','public.ovr_separation_policies','UPDATE'), 'service_role cannot arbitrarily update separation policy');
select ok(not has_table_privilege('anon','public.ovr_separation_policies','SELECT'), 'anon cannot read raw separation policy');
select ok(not has_table_privilege('authenticated','public.ovr_separation_policies','SELECT'), 'authenticated cannot read raw separation policy');
select ok(obj_description('public.ovr_separation_policies'::regclass, 'pg_class') like '%migration-controlled%', 'policy table documents its migration-controlled P2 governance model');
select ok(position(
  'whereorganization_id=v_actor_organdovr_report_id=p_ovr_report_idandgovernance_closure_id=v_closure.id'
  in regexp_replace(pg_get_functiondef('public.ovr_v11_reporter_acknowledge(uuid,uuid,uuid,text)'::regprocedure), E'\\s+', '', 'g')
) > 0, 'acknowledgment lookup retains exact tenant and OVR predicates');
select ok(position(
  'whereorganization_id=v_actor_organdovr_report_id=p_ovr_report_idandgovernance_closure_id=v_closure.id'
  in regexp_replace(pg_get_functiondef('public.ovr_v11_reporter_dispute(uuid,uuid,uuid,text,text)'::regprocedure), E'\\s+', '', 'g')
) > 0, 'dispute lookup retains exact tenant and OVR predicates');
create or replace function pg_temp.p2_explain_json(p_sql text)
returns jsonb language plpgsql as $$
declare v_plan json;
begin
  execute 'explain (format json, costs off) ' || p_sql into v_plan;
  return v_plan::jsonb;
end;
$$;
set local enable_seqscan = off;
select ok(
  pg_temp.p2_explain_json(format(
    'select 1 from public.ovr_reporter_responses where organization_id=%L and ovr_report_id=%L and governance_closure_id=%L',
    pg_temp.p2_uuid(1),
    (select ovr_id from p2_cases where label='ack'),
    (select (result->>'governance_closure_id')::uuid from p2_results where label='ack_closure')
  ))::text like '%Index Scan%'
  and pg_temp.p2_explain_json(format(
    'select 1 from public.ovr_reporter_responses where organization_id=%L and ovr_report_id=%L and governance_closure_id=%L',
    pg_temp.p2_uuid(1),
    (select ovr_id from p2_cases where label='ack'),
    (select (result->>'governance_closure_id')::uuid from p2_results where label='ack_closure')
  ))::text not like '%Seq Scan%',
  'representative tenant-scoped reporter-response lookup uses an index plan without sequential scan'
);
set local enable_seqscan = on;

-- R6-A/B. Exact P1 assignment, stage, tenant, expiry and recusal remain authoritative.
select throws_ok(format($sql$select public.ovr_v11_issue_final_verdict('%s','%s','%s','bad-stage','level_2',false,'p2-wrong-stage',null)$sql$,pg_temp.p2_uuid(20),(select ovr_id from p2_cases where label='wrong_stage'),(select closure_stage_id from p2_cases where label='wrong_stage')), 'P0001', 'OVR_V11_ACTIVE_FINAL_VERDICT_STAGE_REQUIRED', 'verdict action rejects a governance-closure stage');
select throws_ok(format($sql$select public.ovr_v11_issue_final_verdict('%s','%s','%s','wrong-assignment','level_2',false,'p2-wrong-assignment',null)$sql$,pg_temp.p2_uuid(20),(select ovr_id from p2_cases where label='wrong_stage'),(select verdict_stage_id from p2_cases where label='recused_verdict')), 'P0001', 'OVR_V11_STAGE_NOT_FOUND', 'verdict action rejects a stage/assignment from another OVR');
select throws_ok(format($sql$select public.ovr_v11_issue_final_verdict('%s','%s','%s','other-reviewer','level_2',false,'p2-other-reviewer',null)$sql$,pg_temp.p2_uuid(21),(select ovr_id from p2_cases where label='wrong_stage'),(select verdict_stage_id from p2_cases where label='wrong_stage')), 'P0001', 'OVR_V11_ACTIVE_EXACT_ASSIGNMENT_REQUIRED', 'assignment belonging to another reviewer is rejected');
select throws_ok(format($sql$select public.ovr_v11_issue_final_verdict('%s','%s','%s','role-only','level_2',false,'p2-role-only-verdict',null)$sql$,pg_temp.p2_uuid(22),(select ovr_id from p2_cases where label='wrong_stage'),(select verdict_stage_id from p2_cases where label='wrong_stage')), 'P0001', 'OVR_V11_ACTIVE_EXACT_ASSIGNMENT_REQUIRED', 'Super Admin role alone cannot issue a verdict');

update public.ovr_reviewer_pool_memberships set valid_to=now()-interval '1 second' where id=pg_temp.p2_uuid(201);
select throws_ok(format($sql$select public.ovr_v11_issue_final_verdict('%s','%s','%s','expired','level_2',false,'p2-expired-verdict',null)$sql$,pg_temp.p2_uuid(20),(select ovr_id from p2_cases where label='expired_verdict'),(select verdict_stage_id from p2_cases where label='expired_verdict')), 'P0001', 'OVR_V11_ACTIVE_EXACT_ASSIGNMENT_REQUIRED', 'expired verdict membership/assignment is denied');
update public.ovr_reviewer_pool_memberships set valid_to=null where id=pg_temp.p2_uuid(201);
update public.ovr_reviewer_assignments set status='recused',ended_at=now(),termination_reason='p2 recused verdict',recusal_reason='p2 recused verdict' where id=(select verdict_assignment_id from p2_cases where label='recused_verdict');
select throws_ok(format($sql$select public.ovr_v11_issue_final_verdict('%s','%s','%s','recused','level_2',false,'p2-recused-verdict',null)$sql$,pg_temp.p2_uuid(20),(select ovr_id from p2_cases where label='recused_verdict'),(select verdict_stage_id from p2_cases where label='recused_verdict')), 'P0001', 'OVR_V11_ACTIVE_EXACT_ASSIGNMENT_REQUIRED', 'recused verdict assignment is denied');

insert into p2_results select 'expired_closer_verdict', public.ovr_v11_issue_final_verdict(pg_temp.p2_uuid(20),ovr_id,verdict_stage_id,'confirmed_occurrence','level_2',false,'p2-expired-closer-verdict',null) from p2_cases where label='expired_closer';
update public.ovr_reviewer_pool_memberships set valid_to=now()-interval '1 second' where id=pg_temp.p2_uuid(204);
select throws_ok(format($sql$select public.ovr_v11_perform_governance_closure('%s','%s','%s','%s','p2-expired-closer')$sql$,pg_temp.p2_uuid(21),(select ovr_id from p2_cases where label='expired_closer'),(select closure_stage_id from p2_cases where label='expired_closer'),(select (result->>'final_verdict_id')::uuid from p2_results where label='expired_closer_verdict')), 'P0001', 'OVR_V11_ACTIVE_EXACT_ASSIGNMENT_REQUIRED', 'expired closer membership/assignment is denied');
update public.ovr_reviewer_pool_memberships set valid_to=null where id=pg_temp.p2_uuid(204);

insert into p2_results select 'recused_closer_verdict', public.ovr_v11_issue_final_verdict(pg_temp.p2_uuid(20),ovr_id,verdict_stage_id,'confirmed_occurrence','level_2',false,'p2-recused-closer-verdict',null) from p2_cases where label='recused_closer';
update public.ovr_reviewer_assignments set status='recused',ended_at=now(),termination_reason='p2 recused closer',recusal_reason='p2 recused closer' where id=(select closure_assignment_id from p2_cases where label='recused_closer');
select throws_ok(format($sql$select public.ovr_v11_perform_governance_closure('%s','%s','%s','%s','p2-recused-closer')$sql$,pg_temp.p2_uuid(21),(select ovr_id from p2_cases where label='recused_closer'),(select closure_stage_id from p2_cases where label='recused_closer'),(select (result->>'final_verdict_id')::uuid from p2_results where label='recused_closer_verdict')), 'P0001', 'OVR_V11_ACTIVE_EXACT_ASSIGNMENT_REQUIRED', 'recused closer assignment is denied');

insert into p2_results select 'cross_org_close_verdict', public.ovr_v11_issue_final_verdict(pg_temp.p2_uuid(20),ovr_id,verdict_stage_id,'confirmed_occurrence','level_2',false,'p2-cross-org-close-verdict',null) from p2_cases where label='cross_org_close';
select throws_ok(format($sql$select public.ovr_v11_perform_governance_closure('%s','%s','%s','%s','p2-cross-org-close')$sql$,pg_temp.p2_uuid(30),(select ovr_id from p2_cases where label='cross_org_close'),(select closure_stage_id from p2_cases where label='cross_org_close'),(select (result->>'final_verdict_id')::uuid from p2_results where label='cross_org_close_verdict')), 'P0001', 'OVR_V11_CROSS_ORGANIZATION_DENIED', 'cross-organization governance closure is denied');

insert into public.user_roles(user_id,role,scope,organization_id,department_id,is_active) values
  (pg_temp.p2_uuid(10),'department_manager','department',pg_temp.p2_uuid(1),pg_temp.p2_uuid(111),true);
insert into public.user_roles(user_id,role,scope,organization_id,is_active) values
  (pg_temp.p2_uuid(10),'governance_admin','global',pg_temp.p2_uuid(1),true),
  (pg_temp.p2_uuid(10),'super_admin','global',pg_temp.p2_uuid(1),true);
insert into p2_results select 'reporter_multirole_verdict', public.ovr_v11_issue_final_verdict(pg_temp.p2_uuid(20),ovr_id,verdict_stage_id,'confirmed_occurrence','level_2',false,'p2-reporter-multirole-verdict',null) from p2_cases where label='reporter_multirole';
select throws_ok(format($sql$select public.ovr_v11_perform_governance_closure('%s','%s','%s','%s','p2-reporter-multirole-close')$sql$,pg_temp.p2_uuid(10),(select ovr_id from p2_cases where label='reporter_multirole'),(select closure_stage_id from p2_cases where label='reporter_multirole'),(select (result->>'final_verdict_id')::uuid from p2_results where label='reporter_multirole_verdict')), 'P0001', 'OVR_V11_ACTOR_CONFLICTED', 'reporter plus Employee, Department Manager, governance and Super Admin roles cannot bypass conflict authority');

-- R2. Semantic-key mismatches fail closed; completed responses are immutable bytes.
select throws_ok(format($sql$select public.ovr_v11_issue_final_verdict('%s','%s','%s','confirmed_occurrence','level_3',false,'p2-shared-key',null)$sql$,pg_temp.p2_uuid(20),(select ovr_id from p2_cases where label='idempotency'),(select verdict_stage_id from p2_cases where label='idempotency')), 'P0001', 'OVR_V11_IDEMPOTENCY_KEY_REUSE_DENIED', 'same verdict key with changed severity fails closed');
select throws_ok(format($sql$select public.ovr_v11_reporter_dispute('%s','%s','%s','A changed dispute reason','p2-reporter-dispute')$sql$,pg_temp.p2_uuid(10),(select ovr_id from p2_cases where label='dispute'),(select (result->>'governance_closure_id')::uuid from p2_results where label='dispute_closure')), 'P0001', 'OVR_V11_IDEMPOTENCY_KEY_REUSE_DENIED', 'same dispute key with changed reason fails closed');
select is(
  (select result from p2_results where label='dispute_retry'),
  (select immutable_response from public.ovr_workflow_events_v11 where idempotency_key='p2-reporter-dispute'),
  'immutable dispute replay returns the stored original JSON rather than reconstructing current state'
);

-- R3. Structural verdict lineage and post-review identity are database-enforced.
select is(
  (select id from ovr_v11_private.current_verdict(pg_temp.p2_uuid(1),(select ovr_id from p2_cases where label='dispute'))),
  (select (result->>'final_verdict_id')::uuid from p2_results where label='superseding_verdict'),
  'AN. private current-verdict resolver returns the unique final lineage leaf'
);
select throws_ok(
  format($sql$update public.ovr_post_closure_reviews set resulting_verdict_id='%s' where ovr_report_id='%s'$sql$,
    (select originating_verdict_id from public.ovr_post_closure_reviews where ovr_report_id=(select ovr_id from p2_cases where label='dispute')),
    (select ovr_id from p2_cases where label='dispute')),
  '23503', null,
  'same-OVR but wrong-cycle resulting verdict fails the composite structural foreign key'
);
alter table public.ovr_post_closure_reviews disable trigger trg_ovr_post_closure_review_guard;
select throws_ok(
  format($sql$update public.ovr_post_closure_reviews set originating_verdict_id=resulting_verdict_id where ovr_report_id='%s'$sql$,
    (select ovr_id from p2_cases where label='dispute')),
  '23503', null,
  'originating verdict cannot differ from the originating closure verdict'
);
alter table public.ovr_post_closure_reviews enable trigger trg_ovr_post_closure_review_guard;
select throws_ok(
  format($sql$select pg_temp.p2_insert_lineage_fixture(1,'%s',null,true)$sql$,
    (select ovr_id from p2_cases where label='dispute')),
  '23514', null,
  'self-supersession is structurally rejected'
);
select throws_ok(
  format($sql$select pg_temp.p2_insert_lineage_fixture(2,'%s','%s',false)$sql$,
    (select ovr_id from p2_cases where label='dispute'),
    (select originating_verdict_id from public.ovr_post_closure_reviews where ovr_report_id=(select ovr_id from p2_cases where label='dispute'))),
  '23505', null,
  'a second sibling supersession is structurally rejected'
);
select is((select count(*)::integer from public.ovr_final_verdicts where ovr_report_id=(select ovr_id from p2_cases where label='dispute')),2,'valid sequential origin-to-successor lineage remains intact');

insert into p2_results select 'ambiguous_origin', public.ovr_v11_issue_final_verdict(pg_temp.p2_uuid(20),ovr_id,verdict_stage_id,'confirmed_occurrence','level_2',false,'p2-ambiguous-origin',null) from p2_cases where label='ambiguous_lineage';
select lives_ok(format($sql$select pg_temp.p2_insert_lineage_fixture(3,'%s',null,false)$sql$,(select ovr_id from p2_cases where label='ambiguous_lineage')),'adversarial fixture creates two roots to prove resolver fail-closed behavior');
select throws_ok(format($sql$select id from ovr_v11_private.current_verdict('%s','%s')$sql$,pg_temp.p2_uuid(1),(select ovr_id from p2_cases where label='ambiguous_lineage')), 'P0001', 'OVR_V11_CURRENT_VERDICT_AMBIGUOUS', 'current-verdict resolver fails closed on two lineage leaves');

select throws_ok(format($sql$update public.ovr_post_closure_reviews set originating_closure_id='%s' where ovr_report_id='%s'$sql$,pg_temp.p2_uuid(999997),(select ovr_id from p2_cases where label='dispute')), 'P0001', 'OVR_V11_POST_CLOSURE_REVIEW_IDENTITY_IMMUTABLE', 'controlled post-review identity fields cannot change');
update public.ovr_post_closure_reviews set status='completed',completed_at=now() where ovr_report_id=(select ovr_id from p2_cases where label='dispute');
select throws_ok(format($sql$update public.ovr_post_closure_reviews set updated_at=now()+interval '1 second' where ovr_report_id='%s'$sql$,(select ovr_id from p2_cases where label='dispute')), 'P0001', 'OVR_V11_POST_CLOSURE_REVIEW_IMMUTABLE', 'completed post-review row is terminal and immutable');

insert into p2_results select 'cancelled_verdict', public.ovr_v11_issue_final_verdict(pg_temp.p2_uuid(20),ovr_id,verdict_stage_id,'confirmed_occurrence','level_2',false,'p2-cancelled-verdict',null) from p2_cases where label='dispute_cancelled';
insert into p2_results select 'cancelled_closure', public.ovr_v11_perform_governance_closure(pg_temp.p2_uuid(21),c.ovr_id,c.closure_stage_id,(select (result->>'final_verdict_id')::uuid from p2_results where label='cancelled_verdict'),'p2-cancelled-closure') from p2_cases c where label='dispute_cancelled';
insert into p2_results select 'cancelled_dispute', public.ovr_v11_reporter_dispute(pg_temp.p2_uuid(10),ovr_id,(select (result->>'governance_closure_id')::uuid from p2_results where label='cancelled_closure'),'Cancel this separate review','p2-cancelled-dispute') from p2_cases where label='dispute_cancelled';
update public.ovr_post_closure_reviews set status='cancelled' where ovr_report_id=(select ovr_id from p2_cases where label='dispute_cancelled');
select throws_ok(format($sql$update public.ovr_post_closure_reviews set updated_at=now()+interval '1 second' where ovr_report_id='%s'$sql$,(select ovr_id from p2_cases where label='dispute_cancelled')), 'P0001', 'OVR_V11_POST_CLOSURE_REVIEW_IMMUTABLE', 'cancelled post-review row is terminal and immutable');

-- Security, append-only events, and released v1.0.0 compatibility.
select throws_ok($$update public.ovr_workflow_events_v11 set event_type='mutated'$$, 'P0001', 'OVR_V11_IMMUTABLE_HISTORY', 'immutable workflow event UPDATE is denied');
select throws_ok($$delete from public.ovr_workflow_events_v11$$, 'P0001', 'OVR_V11_IMMUTABLE_HISTORY', 'immutable workflow event DELETE is denied');
select ok(not has_table_privilege('authenticated','public.ovr_final_verdicts','SELECT'), 'authenticated has no raw final-verdict table privilege');
select ok(not has_table_privilege('authenticated','public.ovr_governance_closures','SELECT'), 'authenticated has no raw governance-closure table privilege');
select ok(not has_function_privilege('authenticated','public.ovr_v11_perform_governance_closure(uuid,uuid,uuid,uuid,text)','EXECUTE'), 'authenticated/Super Admin browser role has no closure RPC execute privilege');
select is((select relrowsecurity and relforcerowsecurity from pg_class where oid='public.ovr_final_verdicts'::regclass), true, 'final verdict table has RLS and FORCE RLS');
select is((select relrowsecurity and relforcerowsecurity from pg_class where oid='public.ovr_governance_closures'::regclass), true, 'governance closure table has RLS and FORCE RLS');
select ok(pg_get_functiondef('public.v98_update_ovr_workflow(uuid,uuid,text,jsonb)'::regprocedure) like '%reporter_response = ''accepted''%', 'released v98 reporter-close implementation remains present and unchanged in purpose');
select ok(not exists(select 1 from public.ovr_final_verdicts where ovr_report_id is null), 'all verdict rows retain complete organization/OVR context');
select ok(not exists(select 1 from public.ovr_governance_closures c join public.ovr_final_verdicts v on v.id=c.final_verdict_id where (c.organization_id,c.ovr_report_id,c.review_cycle_id) is distinct from (v.organization_id,v.ovr_report_id,v.review_cycle_id)), 'closure-to-verdict context remains structurally exact');

-- AM. Completed operations replay before mutable actor, credential, and assignment checks.
insert into p2_results
select 'lifecycle_verdict', public.ovr_v11_issue_final_verdict(
  pg_temp.p2_uuid(20),ovr_id,verdict_stage_id,'confirmed_occurrence','level_2',false,
  'p2-lifecycle-verdict',null
) from p2_cases where label='lifecycle_replay';
insert into p2_results
select 'lifecycle_verdict_active_retry', public.ovr_v11_issue_final_verdict(
  pg_temp.p2_uuid(20),ovr_id,verdict_stage_id,'confirmed_occurrence','level_2',false,
  'p2-lifecycle-verdict',null
) from p2_cases where label='lifecycle_replay';
select is((select result from p2_results where label='lifecycle_verdict_active_retry'),(select result from p2_results where label='lifecycle_verdict'),'exact verdict retry while active returns the original response after assignment became terminal');

insert into p2_results
select 'lifecycle_closure', public.ovr_v11_perform_governance_closure(
  pg_temp.p2_uuid(21),c.ovr_id,c.closure_stage_id,
  (select (result->>'final_verdict_id')::uuid from p2_results where label='lifecycle_verdict'),
  'p2-lifecycle-closure'
) from p2_cases c where label='lifecycle_replay';
insert into p2_results
select 'lifecycle_closure_active_retry', public.ovr_v11_perform_governance_closure(
  pg_temp.p2_uuid(21),c.ovr_id,c.closure_stage_id,
  (select (result->>'final_verdict_id')::uuid from p2_results where label='lifecycle_verdict'),
  'p2-lifecycle-closure'
) from p2_cases c where label='lifecycle_replay';
select is((select result from p2_results where label='lifecycle_closure_active_retry'),(select result from p2_results where label='lifecycle_closure'),'exact closure retry while active returns the original response after assignment became terminal');

update public.user_credential_states set credential_state='disabled',requested_lifecycle='inactive' where user_id=pg_temp.p2_uuid(20);
select is(
  (select public.ovr_v11_issue_final_verdict(pg_temp.p2_uuid(20),ovr_id,verdict_stage_id,'confirmed_occurrence','level_2',false,'p2-lifecycle-verdict',null) from p2_cases where label='lifecycle_replay'),
  (select result from p2_results where label='lifecycle_verdict'),
  'exact replay survives a later credential-lifecycle change'
);

update public.profiles
set user_status='inactive',is_active=false,deactivated_at=now(),
    deactivated_by=pg_temp.p2_uuid(25),deactivation_reason='P2 immutable replay lifecycle proof'
where id in (pg_temp.p2_uuid(10),pg_temp.p2_uuid(20),pg_temp.p2_uuid(21));
select is(
  (select public.ovr_v11_issue_final_verdict(pg_temp.p2_uuid(20),ovr_id,verdict_stage_id,'confirmed_occurrence','level_2',false,'p2-lifecycle-verdict',null) from p2_cases where label='lifecycle_replay'),
  (select result from p2_results where label='lifecycle_verdict'),
  'AM. exact verdict replay survives represented-actor deactivation'
);
select is(
  (select public.ovr_v11_perform_governance_closure(pg_temp.p2_uuid(21),c.ovr_id,c.closure_stage_id,(select (result->>'final_verdict_id')::uuid from p2_results where label='lifecycle_verdict'),'p2-lifecycle-closure') from p2_cases c where label='lifecycle_replay'),
  (select result from p2_results where label='lifecycle_closure'),
  'exact governance-closure replay survives represented-actor deactivation'
);
select is(
  (select public.ovr_v11_reporter_acknowledge(pg_temp.p2_uuid(10),ovr_id,(select (result->>'governance_closure_id')::uuid from p2_results where label='ack_closure'),'p2-reporter-ack') from p2_cases where label='ack'),
  (select result from p2_results where label='ack_response'),
  'exact acknowledgment replay survives reporter deactivation'
);
select is(
  (select public.ovr_v11_reporter_dispute(pg_temp.p2_uuid(10),ovr_id,(select (result->>'governance_closure_id')::uuid from p2_results where label='dispute_closure'),'The immutable outcome requires a separate review.','p2-reporter-dispute') from p2_cases where label='dispute'),
  (select result from p2_results where label='dispute_response'),
  'exact dispute replay survives reporter deactivation'
);

select * from finish();
rollback;
