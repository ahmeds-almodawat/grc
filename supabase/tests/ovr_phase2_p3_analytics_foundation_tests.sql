-- GRC v1.1 OVR Phase 2 P3 behavioral contracts.
-- Run only against a disposable local database after migration 194.
-- All fixtures and mutations are rolled back; cross-session snapshot checks
-- live in the dedicated P3 concurrency/performance harness.

begin;

create extension if not exists pgtap;
select no_plan();
select pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);

create or replace function pg_temp.p3_uuid(p_value integer)
returns uuid
language sql
immutable
as $$
  select ('93400000-0000-4000-8000-' || lpad(p_value::text, 12, '0'))::uuid;
$$;

insert into public.organizations (id, name_en) values
  (pg_temp.p3_uuid(1), 'P3 Analytics Organization'),
  (pg_temp.p3_uuid(2), 'P3 Other Organization');

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, created_at, updated_at
)
select id, 'authenticated', 'authenticated', email, '', now(),
       '{"credential_version":1}'::jsonb, now(), now()
from (values
  (pg_temp.p3_uuid(10), 'p3-executive@example.test'),
  (pg_temp.p3_uuid(11), 'p3-other-executive@example.test'),
  (pg_temp.p3_uuid(12), 'p3-employee@example.test'),
  (pg_temp.p3_uuid(13), 'p3-manager@example.test'),
  (pg_temp.p3_uuid(14), 'p3-auditor@example.test'),
  (pg_temp.p3_uuid(15), 'p3-inactive-role@example.test'),
  (pg_temp.p3_uuid(16), 'p3-archived@example.test'),
  (pg_temp.p3_uuid(17), 'p3-disabled-credential@example.test'),
  (pg_temp.p3_uuid(18), 'p3-super-admin@example.test'),
  (pg_temp.p3_uuid(19), 'p3-governance@example.test'),
  (pg_temp.p3_uuid(20), 'p3-second-executive@example.test')
) fixture(id, email);

insert into auth.identities(
  id,provider_id,user_id,identity_data,provider,created_at,updated_at
)
select gen_random_uuid(),id::text,id,jsonb_build_object('sub',id::text,'email',email),
       'email',now(),now()
from auth.users
where id::text like '93400000-0000-4000-8000-%';

insert into public.profiles (
  id, organization_id, full_name_en, email, employee_no, is_active, user_status
)
select id,
       case when id = pg_temp.p3_uuid(11) then pg_temp.p3_uuid(2)
            else pg_temp.p3_uuid(1) end,
       'P3 actor ' || right(id::text, 4), email,
       'P3-' || right(replace(id::text, '-', ''), 8),
       true,
       'active'
from (values
  (pg_temp.p3_uuid(10), 'p3-executive@example.test'),
  (pg_temp.p3_uuid(11), 'p3-other-executive@example.test'),
  (pg_temp.p3_uuid(12), 'p3-employee@example.test'),
  (pg_temp.p3_uuid(13), 'p3-manager@example.test'),
  (pg_temp.p3_uuid(14), 'p3-auditor@example.test'),
  (pg_temp.p3_uuid(15), 'p3-inactive-role@example.test'),
  (pg_temp.p3_uuid(16), 'p3-archived@example.test'),
  (pg_temp.p3_uuid(17), 'p3-disabled-credential@example.test'),
  (pg_temp.p3_uuid(18), 'p3-super-admin@example.test'),
  (pg_temp.p3_uuid(19), 'p3-governance@example.test'),
  (pg_temp.p3_uuid(20), 'p3-second-executive@example.test')
) fixture(id, email);

insert into public.user_credential_states (
  user_id, organization_id, auth_email, identity_mode, credential_state,
  requested_lifecycle, credential_version
)
select p.id, p.organization_id, lower(p.email), 'legacy_verified',
       'active', 'active', 1
from public.profiles p
where p.id::text like '93400000-0000-4000-8000-%'
on conflict (user_id) do update
set organization_id=excluded.organization_id,
    auth_email=excluded.auth_email,
    identity_mode=excluded.identity_mode,
    credential_state=excluded.credential_state,
    requested_lifecycle=excluded.requested_lifecycle,
    credential_version=excluded.credential_version;

insert into public.divisions (id, organization_id, name_en, code) values
  (pg_temp.p3_uuid(101), pg_temp.p3_uuid(1), 'P3 Division', 'P3-DIV'),
  (pg_temp.p3_uuid(102), pg_temp.p3_uuid(2), 'P3 Other Division', 'P3-ODIV');

insert into public.departments (id, organization_id, division_id, name_en, code) values
  (pg_temp.p3_uuid(111), pg_temp.p3_uuid(1), pg_temp.p3_uuid(101), 'P3 Department A', 'P3-A'),
  (pg_temp.p3_uuid(112), pg_temp.p3_uuid(1), pg_temp.p3_uuid(101), 'P3 Department B', 'P3-B'),
  (pg_temp.p3_uuid(113), pg_temp.p3_uuid(2), pg_temp.p3_uuid(102), 'P3 Other Department', 'P3-O');

update public.profiles
set division_id = case when organization_id = pg_temp.p3_uuid(1)
                       then pg_temp.p3_uuid(101) else pg_temp.p3_uuid(102) end,
    department_id = case when organization_id = pg_temp.p3_uuid(1)
                         then pg_temp.p3_uuid(111) else pg_temp.p3_uuid(113) end
where id::text like '93400000-0000-4000-8000-%';

insert into public.user_roles (
  user_id, role, scope, organization_id, department_id, is_active
) values
  (pg_temp.p3_uuid(10), 'executive', 'global', pg_temp.p3_uuid(1), null, true),
  (pg_temp.p3_uuid(11), 'executive', 'global', pg_temp.p3_uuid(2), null, true),
  (pg_temp.p3_uuid(12), 'employee', 'assigned_only', pg_temp.p3_uuid(1), null, true),
  (pg_temp.p3_uuid(13), 'department_manager', 'department', pg_temp.p3_uuid(1), pg_temp.p3_uuid(111), true),
  (pg_temp.p3_uuid(14), 'auditor', 'global', pg_temp.p3_uuid(1), null, true),
  (pg_temp.p3_uuid(15), 'executive', 'global', pg_temp.p3_uuid(1), null, false),
  (pg_temp.p3_uuid(16), 'executive', 'global', pg_temp.p3_uuid(1), null, true),
  (pg_temp.p3_uuid(17), 'executive', 'global', pg_temp.p3_uuid(1), null, true),
  (pg_temp.p3_uuid(18), 'super_admin', 'global', pg_temp.p3_uuid(1), null, true),
  (pg_temp.p3_uuid(19), 'governance_admin', 'global', pg_temp.p3_uuid(1), null, true),
  (pg_temp.p3_uuid(20), 'executive', 'global', pg_temp.p3_uuid(1), null, true);

update public.profiles
set user_status='archived', is_active=false,
    deactivated_at=statement_timestamp(), deactivated_by=pg_temp.p3_uuid(19),
    deactivation_reason='P3 inactive-actor authorization fixture'
where id=pg_temp.p3_uuid(16);

update public.user_credential_states
set credential_state='disabled', requested_lifecycle='inactive'
where user_id=pg_temp.p3_uuid(17);

insert into public.runtime_workflow_sla_calendars (
  id, organization_id, calendar_code, calendar_name, timezone_name, is_active
) values
  (pg_temp.p3_uuid(201), pg_temp.p3_uuid(1), 'P3-ACTIVE', 'P3 Active Calendar', 'Asia/Riyadh', true),
  (pg_temp.p3_uuid(202), pg_temp.p3_uuid(2), 'P3-OTHER', 'P3 Other Calendar', 'UTC', true);

insert into public.organization_ovr_analytics_config (
  id, organization_id, timezone_name, sla_calendar_id, minimum_cell_size,
  kpi_definition_version, effective_from, is_active, configured_by
) values
  (pg_temp.p3_uuid(211), pg_temp.p3_uuid(1), 'Asia/Riyadh', pg_temp.p3_uuid(201), 5,
   'ovr-kpi-v2', now() - interval '1 day', true, pg_temp.p3_uuid(19)),
  (pg_temp.p3_uuid(212), pg_temp.p3_uuid(2), 'UTC', pg_temp.p3_uuid(202), 5,
   'ovr-kpi-v2', now() - interval '1 day', true, pg_temp.p3_uuid(11));

insert into public.ovr_reviewer_pool_memberships (
  id, organization_id, profile_id, capability, scope, priority,
  confidential_clearance, retaliation_clearance, valid_from, is_active, created_by
) values
  (pg_temp.p3_uuid(301), pg_temp.p3_uuid(1), pg_temp.p3_uuid(19), 'final_verdict', 'global', 10,
   true, true, now() - interval '1 day', true, pg_temp.p3_uuid(19)),
  (pg_temp.p3_uuid(302), pg_temp.p3_uuid(1), pg_temp.p3_uuid(19), 'governance_closure', 'global', 10,
   true, true, now() - interval '1 day', true, pg_temp.p3_uuid(19));

create or replace function pg_temp.p3_make_case(
  p_case integer,
  p_status public.ovr_status,
  p_severity public.ovr_severity_level,
  p_category text,
  p_department_id uuid,
  p_submitted_at timestamptz,
  p_occurrence_at timestamptz,
  p_closed_at timestamptz default null,
  p_corrective_required boolean default false,
  p_supervisor_due date default null,
  p_quality_due date default null
)
returns uuid
language plpgsql
as $$
declare
  v_id uuid := pg_temp.p3_uuid(1000 + p_case);
begin
  insert into public.ovr_reports (
    id, organization_id, ovr_number, brief_description, occurrence_category,
    occurrence_date, occurrence_time, division_id, department_id, reported_by,
    created_by, status, severity_level, final_severity_level,
    corrective_action_required, supervisor_due_date, quality_due_date,
    closed_by, closed_at, created_at
  ) values (
    v_id, pg_temp.p3_uuid(1), 'OVR-P3-' || lpad(p_case::text, 3, '0'),
    'P3 private narrative ' || p_case, p_category,
    (p_occurrence_at at time zone 'Asia/Riyadh')::date,
    (p_occurrence_at at time zone 'Asia/Riyadh')::time,
    pg_temp.p3_uuid(101), p_department_id, pg_temp.p3_uuid(12),
    pg_temp.p3_uuid(12), p_status, p_severity,
    case when p_status = 'closed' then p_severity else null end,
    p_corrective_required, p_supervisor_due, p_quality_due,
    case when p_closed_at is null then null else pg_temp.p3_uuid(19) end,
    p_closed_at, p_submitted_at - interval '60 days'
  );

  insert into public.audit_logs (
    organization_id, actor_id, action, table_name, record_id, old_data, new_data, created_at
  ) values (
    pg_temp.p3_uuid(1), pg_temp.p3_uuid(12), 'UPDATE', 'ovr_reports', v_id,
    jsonb_build_object('status', 'draft'), jsonb_build_object('status', 'submitted'),
    p_submitted_at
  );
  return v_id;
end;
$$;

-- Five medication and five infection reports provide non-suppressed cells.
select pg_temp.p3_make_case(i, 'under_supervisor_review',
  case when i=1 then 'level_4'::public.ovr_severity_level
       when i=2 then 'sentinel'::public.ovr_severity_level
       else 'level_2'::public.ovr_severity_level end,
  'Medication', pg_temp.p3_uuid(111), now() - make_interval(days => i),
  now() - make_interval(days => i), null, i in (1,2),
  case when i=2 then (now() - interval '2 days')::date else null end, null)
from generate_series(1,5) i;

select pg_temp.p3_make_case(i, 'under_quality_review', 'level_2', 'Infection',
  pg_temp.p3_uuid(111), now() - make_interval(days => i),
  now() - make_interval(days => i), null, false, null, null)
from generate_series(8,12) i;

-- One small department/category cell exercises primary and complementary suppression.
select pg_temp.p3_make_case(7, 'under_supervisor_review', 'level_2', 'Fall',
  pg_temp.p3_uuid(112), now() - interval '2 days', now() - interval '2 days');

-- Legacy closure, rejected, and cancelled compatibility cases.
select pg_temp.p3_make_case(6, 'closed', 'level_3', 'Medication',
  pg_temp.p3_uuid(111), now() - interval '10 days', now() - interval '10 days',
  now() - interval '1 day', false, null, (now() + interval '1 day')::date);
select pg_temp.p3_make_case(13, 'rejected', 'sentinel', 'Excluded',
  pg_temp.p3_uuid(111), now() - interval '1 day', now() - interval '1 day');
select pg_temp.p3_make_case(14, 'cancelled', 'sentinel', 'Excluded',
  pg_temp.p3_uuid(111), now() - interval '1 day', now() - interval '1 day');

-- Repeat-boundary fixtures: the three reports in each group span exactly the
-- labelled number of days. The 29- and 30-day groups qualify; 31 days does not.
select pg_temp.p3_make_case(30 + i, 'under_supervisor_review', 'level_2', 'Boundary29',
  pg_temp.p3_uuid(111), now() - make_interval(days => case i when 0 then 0 when 1 then 14 else 29 end),
  now() - make_interval(days => case i when 0 then 0 when 1 then 14 else 29 end))
from generate_series(0,2) i;
select pg_temp.p3_make_case(33 + i, 'under_supervisor_review', 'level_2', 'Boundary30',
  pg_temp.p3_uuid(111), now() - make_interval(days => case i when 0 then 0 when 1 then 15 else 30 end),
  now() - make_interval(days => case i when 0 then 0 when 1 then 15 else 30 end))
from generate_series(0,2) i;
select pg_temp.p3_make_case(36 + i, 'under_supervisor_review', 'level_2', 'Boundary31',
  pg_temp.p3_uuid(111), now() - make_interval(days => case i when 0 then 0 when 1 then 15 else 31 end),
  now() - make_interval(days => case i when 0 then 0 when 1 then 15 else 31 end))
from generate_series(0,2) i;

select pg_temp.p3_make_case(40, 'under_supervisor_review', 'level_2', 'SubmissionEdgeStart',
  pg_temp.p3_uuid(111),
  date_trunc('month', statement_timestamp() at time zone 'Asia/Riyadh') at time zone 'Asia/Riyadh',
  statement_timestamp());
select pg_temp.p3_make_case(41, 'under_supervisor_review', 'level_2', 'SubmissionEdgeEnd',
  pg_temp.p3_uuid(111),
  (date_trunc('month', statement_timestamp() at time zone 'Asia/Riyadh') + interval '1 month') at time zone 'Asia/Riyadh',
  statement_timestamp());

-- Persisted P1 due_at is authoritative for overdue state.
insert into public.ovr_review_cycles (
  id, organization_id, ovr_report_id, cycle_number, status, opened_by
) values (
  pg_temp.p3_uuid(401), pg_temp.p3_uuid(1), pg_temp.p3_uuid(1001), 1, 'active', pg_temp.p3_uuid(19)
);
insert into public.ovr_stage_instances (
  id, organization_id, ovr_report_id, review_cycle_id, stage_type,
  sequence_number, lifecycle_status, due_at, relationship_version
) values (
  pg_temp.p3_uuid(402), pg_temp.p3_uuid(1), pg_temp.p3_uuid(1001), pg_temp.p3_uuid(401),
  'manager_review', 1, 'assigned', now() - interval '1 hour', 0
);

create or replace function pg_temp.p3_add_p2_facts(
  p_case integer,
  p_close boolean,
  p_severity public.ovr_severity_level,
  p_corrective boolean,
  p_closed_at timestamptz default null
)
returns void
language plpgsql
as $$
declare
  v_ovr uuid := pg_temp.p3_uuid(1000 + p_case);
  v_cycle uuid := pg_temp.p3_uuid(5000 + p_case);
  v_verdict_stage uuid := pg_temp.p3_uuid(6000 + p_case);
  v_closure_stage uuid := pg_temp.p3_uuid(7000 + p_case);
  v_verdict_assignment uuid := pg_temp.p3_uuid(8000 + p_case);
  v_closure_assignment uuid := pg_temp.p3_uuid(9000 + p_case);
  v_verdict uuid := pg_temp.p3_uuid(10000 + p_case);
begin
  insert into public.ovr_review_cycles (
    id, organization_id, ovr_report_id, cycle_number, status, opened_by
  ) values (v_cycle, pg_temp.p3_uuid(1), v_ovr, 1, 'active', pg_temp.p3_uuid(19));
  insert into public.ovr_stage_instances (
    id, organization_id, ovr_report_id, review_cycle_id, stage_type,
    sequence_number, lifecycle_status, due_at, completed_at, relationship_version
  ) values
    (v_verdict_stage, pg_temp.p3_uuid(1), v_ovr, v_cycle, 'final_verdict', 1, 'completed', null, coalesce(p_closed_at, now()), 0),
    (v_closure_stage, pg_temp.p3_uuid(1), v_ovr, v_cycle, 'governance_closure', 2,
     case when p_close then 'completed' else 'assigned' end,
     coalesce(p_closed_at, now()) + interval '1 day',
     case when p_close then p_closed_at else null end, 0);
  insert into public.ovr_reviewer_assignments (
    id, organization_id, ovr_report_id, review_cycle_id, stage_instance_id,
    reviewer_profile_id, reviewer_membership_id, status, assignment_reason,
    candidate_digest, conflict_version, idempotency_key, ended_at, termination_reason
  ) values
    (v_verdict_assignment, pg_temp.p3_uuid(1), v_ovr, v_cycle, v_verdict_stage,
     pg_temp.p3_uuid(19), pg_temp.p3_uuid(301), 'completed', 'p3_fixture', repeat('a',64), 0,
     'p3-verdict-assignment-' || p_case, now(), 'p3 fixture completed'),
    (v_closure_assignment, pg_temp.p3_uuid(1), v_ovr, v_cycle, v_closure_stage,
     pg_temp.p3_uuid(19), pg_temp.p3_uuid(302),
     case when p_close then 'completed' else 'active' end,
     'p3_fixture', repeat('b',64), 0, 'p3-closure-assignment-' || p_case,
     case when p_close then p_closed_at else null end,
     case when p_close then 'p3 fixture completed' else null end);
  insert into public.ovr_final_verdicts (
    id, organization_id, ovr_report_id, review_cycle_id, stage_instance_id,
    reviewer_assignment_id, issued_by, verdict, effective_severity,
    corrective_action_required, issued_at, idempotency_key,
    semantic_request_digest, immutable_response
  ) values (
    v_verdict, pg_temp.p3_uuid(1), v_ovr, v_cycle, v_verdict_stage,
    v_verdict_assignment, pg_temp.p3_uuid(19), 'P3 immutable verdict', p_severity,
    p_corrective, now() - interval '2 days', 'p3-verdict-' || p_case,
    repeat('c',64), jsonb_build_object('result','p3')
  );
  if p_close then
    insert into public.ovr_governance_closures (
      organization_id, ovr_report_id, review_cycle_id, stage_instance_id,
      closer_assignment_id, final_verdict_id, closed_by, closed_at,
      separation_policy_applied, evidence_gate_snapshot, idempotency_key,
      semantic_request_digest, immutable_response
    ) values (
      pg_temp.p3_uuid(1), v_ovr, v_cycle, v_closure_stage,
      v_closure_assignment, v_verdict, pg_temp.p3_uuid(19), p_closed_at,
      '{}'::jsonb, '{}'::jsonb, 'p3-closure-' || p_case,
      repeat('d',64), jsonb_build_object('result','p3')
    );
  end if;
end;
$$;

-- P2-only closure and transitional P2-verdict/legacy-closed disagreement.
select pg_temp.p3_make_case(20, 'closed', 'level_1', 'P2 closed', pg_temp.p3_uuid(111),
  now() - interval '8 days', now() - interval '8 days', now() - interval '3 days');
select pg_temp.p3_add_p2_facts(20, true, 'sentinel', true, now() - interval '2 days');
select pg_temp.p3_make_case(21, 'closed', 'level_4', 'Transition', pg_temp.p3_uuid(111),
  now() - interval '4 days', now() - interval '4 days', now() - interval '1 day');
select pg_temp.p3_add_p2_facts(21, false, 'level_2', true, null);

create temporary table p3_facts as
select * from ovr_v11_private.ovr_kpi_facts_v2(
  pg_temp.p3_uuid(1), statement_timestamp(), 'Asia/Riyadh'
);

-- Authoritative fact-model KPI behavior.
select is((select count(*)::integer from p3_facts where is_open), 23,
  'J. Open OVR uses immutable/P2 closure precedence and excludes rejected/cancelled');
select ok((select first_submitted_at > created_at_compatibility_marker from p3_facts where ovr_report_id=pg_temp.p3_uuid(1001)),
  'V. first submitted audit event, not OVR created_at, is the authoritative start');
select ok((select is_overdue and current_due_source='p1_stage_due_at' from p3_facts where ovr_report_id=pg_temp.p3_uuid(1001)),
  'L/W. overdue uses persisted P1 stage due_at');
select ok((select is_overdue and current_due_source='legacy_persisted_date' from p3_facts where ovr_report_id=pg_temp.p3_uuid(1002)),
  'legacy overdue compatibility uses only a persisted due date');
select ok((select not due_measurable from p3_facts where ovr_report_id=pg_temp.p3_uuid(1003)),
  'missing persisted due time remains unknown rather than inventing a deadline');
select is((select effective_severity::text from p3_facts where ovr_report_id=pg_temp.p3_uuid(1020)), 'sentinel',
  'M. current P2 leaf verdict has severity precedence over legacy fields');
select is((select governance_closed_at from p3_facts where ovr_report_id=pg_temp.p3_uuid(1020)), now() - interval '2 days',
  'U. immutable P2 governance closure has precedence over legacy closed_at');
select ok((select is_open and governance_closed_at is null from p3_facts where ovr_report_id=pg_temp.p3_uuid(1021)),
  'transitional P2 verdict without immutable closure remains open despite legacy closed status');
select is((select count(*)::integer from p3_facts where ovr_report_id=pg_temp.p3_uuid(1020)), 1,
  'legacy/P2 transitional facts never duplicate an OVR');
select ok((select closure_duration_seconds > 0 from p3_facts where ovr_report_id=pg_temp.p3_uuid(1006)),
  'N. average-closure inputs use first submission through governance closure');
select ok((select closure_within_sla from p3_facts where ovr_report_id=pg_temp.p3_uuid(1020)),
  'O/X. closure-within-SLA uses the persisted closure-stage due_at');
select is((select count(*)::integer from p3_facts where potential_repeat and category_key='medication'), 6,
  'P. potential-repeat counts qualifying reports in a same-org/category/department rolling 30-day cluster');
select is((select count(*)::integer from p3_facts where potential_repeat and category_key='boundary29'), 3,
  'P1. potential-repeat includes a three-report group spanning 29 days');
select is((select count(*)::integer from p3_facts where potential_repeat and category_key='boundary30'), 3,
  'P2. potential-repeat includes the exact 30-day boundary');
select is((select count(*)::integer from p3_facts where potential_repeat and category_key='boundary31'), 0,
  'P3. potential-repeat excludes a three-report group spanning more than 30 days');
select is((select count(*)::integer from p3_facts where is_open and corrective_action_required), 3,
  'Q. corrective-action-required uses current verdict precedence without double counting');
select ok(not exists(select 1 from p3_facts where ovr_report_id in (pg_temp.p3_uuid(1013),pg_temp.p3_uuid(1014)) and (is_open or potential_repeat)),
  'T. rejected and cancelled reports are excluded');

-- Timezone month boundary uses the configured organization timezone.
insert into public.audit_logs (
  organization_id, actor_id, action, table_name, record_id, old_data, new_data, created_at
) values
  (pg_temp.p3_uuid(1), pg_temp.p3_uuid(12), 'UPDATE', 'ovr_reports', pg_temp.p3_uuid(1003),
   '{"status":"draft"}', '{"status":"submitted"}',
   date_trunc('month', statement_timestamp() at time zone 'Asia/Riyadh') at time zone 'Asia/Riyadh');
select ok(exists(
  select 1 from ovr_v11_private.ovr_kpi_facts_v2(pg_temp.p3_uuid(1),statement_timestamp(),'Asia/Riyadh') f
  where f.ovr_report_id=pg_temp.p3_uuid(1003)
    and f.first_submitted_at >= date_trunc('month',statement_timestamp() at time zone 'Asia/Riyadh') at time zone 'Asia/Riyadh'
), 'R. organization-local month boundary is authoritative');
select is((select count(*)::integer from p3_facts
  where category_key='submissionedgestart'
    and first_submitted_at >= date_trunc('month',statement_timestamp() at time zone 'Asia/Riyadh') at time zone 'Asia/Riyadh'
    and first_submitted_at < (date_trunc('month',statement_timestamp() at time zone 'Asia/Riyadh')+interval '1 month') at time zone 'Asia/Riyadh'), 1,
  'submission edge: exact period start is included');
select is((select count(*)::integer from p3_facts
  where category_key='submissionedgeend'
    and first_submitted_at >= date_trunc('month',statement_timestamp() at time zone 'Asia/Riyadh') at time zone 'Asia/Riyadh'
    and first_submitted_at < (date_trunc('month',statement_timestamp() at time zone 'Asia/Riyadh')+interval '1 month') at time zone 'Asia/Riyadh'), 0,
  'submission edge: exact period end is excluded');
select is(extract(epoch from (
    ('2026-03-09 00:00:00'::timestamp at time zone 'America/New_York')
    - ('2026-03-08 00:00:00'::timestamp at time zone 'America/New_York')
  ))::integer, 82800,
  'DST boundary: local-day conversion preserves the 23-hour spring-forward day');

/* P3-R1 rejected exact/dimensional contract retained only as review lineage.
-- Executive authorization and fixed-shape RPC behavior.
create temporary table p3_results(label text primary key, result jsonb);
insert into p3_results values (
  'headline', public.ovr_executive_analytics_v1(
    pg_temp.p3_uuid(10), 'headline_current_period', null, null, 'p3-headline-1'
  )
);
select is((select result->>'definition_version' from p3_results where label='headline'), 'ovr-kpi-v1',
  'A. active Executive receives versioned aggregate analytics in own organization');
select is((select result->>'query_shape' from p3_results where label='headline'), 'headline_current_period',
  'server returns only the requested fixed query shape');
select ok((select result ? 'metrics' from p3_results where label='headline'),
  'all eight KPI values are returned as aggregate metrics');
select is((select (result#>>'{metrics,open_ovr}')::integer from p3_results where label='headline'),12,
  'J. aggregate Open OVR matches the canonical fact projection');
select is((select (result#>>'{metrics,new_this_month}')::integer from p3_results where label='headline'),
  (select count(*)::integer from p3_facts
   where first_submitted_at >= date_trunc('month',statement_timestamp() at time zone 'Asia/Riyadh') at time zone 'Asia/Riyadh'
     and first_submitted_at < (date_trunc('month',statement_timestamp() at time zone 'Asia/Riyadh')+interval '1 month') at time zone 'Asia/Riyadh'),
  'K. aggregate New this month uses the organization-local first-submitted period');
select is((select (result#>>'{metrics,overdue_ovr,count}')::integer from p3_results where label='headline'),
  (select count(*)::integer from p3_facts where is_overdue),
  'L. aggregate overdue count uses persisted current-stage deadlines');
select is((select (result#>>'{metrics,major_sentinel}')::integer from p3_results where label='headline'),2,
  'M. aggregate Major/Sentinel applies current immutable-verdict precedence');
select is((select (result#>>'{metrics,average_closure_seconds,denominator}')::integer from p3_results where label='headline'),
  (select count(closure_duration_seconds)::integer from p3_facts
   where governance_closed_at >= date_trunc('month',statement_timestamp() at time zone 'Asia/Riyadh') at time zone 'Asia/Riyadh'
     and governance_closed_at < (date_trunc('month',statement_timestamp() at time zone 'Asia/Riyadh')+interval '1 month') at time zone 'Asia/Riyadh'),
  'N. average-closure denominator discloses only measurable submitted-to-closure facts');
select is((select (result#>>'{metrics,closure_within_sla,denominator}')::integer from p3_results where label='headline'),
  (select count(closure_within_sla)::integer from p3_facts
   where governance_closed_at >= date_trunc('month',statement_timestamp() at time zone 'Asia/Riyadh') at time zone 'Asia/Riyadh'
     and governance_closed_at < (date_trunc('month',statement_timestamp() at time zone 'Asia/Riyadh')+interval '1 month') at time zone 'Asia/Riyadh'),
  'O. closure-within-SLA denominator includes only persisted measurable SLA facts');
select is((select (result#>>'{metrics,potential_repeat}')::integer from p3_results where label='headline'),11,
  'P. aggregate potential-repeat KPI returns all qualifying reports, not cluster count');
select is((select (result#>>'{metrics,corrective_action_required}')::integer from p3_results where label='headline'),3,
  'Q. aggregate corrective-action-required KPI does not double count');
select ok((select not (result::text ~* 'OVR-P3|private narrative|example\\.test|93400000-0000-4000-8000-0000000010') from p3_results where label='headline'),
  'AI. aggregate output contains no OVR, person, narrative, or credential identifiers');

select throws_ok(format($sql$select public.ovr_executive_analytics_v1('%s','headline_current_period','%s',null,'p3-cross-org-dept')$sql$,
  pg_temp.p3_uuid(10),pg_temp.p3_uuid(113)), 'P0001', 'OVR_ANALYTICS_FILTER_OUTSIDE_ORGANIZATION',
  'B/AH. cross-organization department filter is denied');
select throws_ok(format($sql$select public.ovr_executive_analytics_v1('%s','headline_current_period',null,'Other-only category','p3-cross-org-category')$sql$,
  pg_temp.p3_uuid(10)), 'P0001', 'OVR_ANALYTICS_FILTER_OUTSIDE_ORGANIZATION',
  'cross-organization/unknown category filter is denied');
select throws_ok(format($sql$select public.ovr_executive_analytics_v1('%s','headline_current_period',null,null,'p3-employee')$sql$,pg_temp.p3_uuid(12)), 'P0001', 'OVR_ANALYTICS_EXECUTIVE_ENTITLEMENT_REQUIRED', 'D. Employee analytics denied');
select throws_ok(format($sql$select public.ovr_executive_analytics_v1('%s','headline_current_period',null,null,'p3-manager')$sql$,pg_temp.p3_uuid(13)), 'P0001', 'OVR_ANALYTICS_EXECUTIVE_ENTITLEMENT_REQUIRED', 'E. Department Manager analytics denied by role alone');
select throws_ok(format($sql$select public.ovr_executive_analytics_v1('%s','headline_current_period',null,null,'p3-auditor')$sql$,pg_temp.p3_uuid(14)), 'P0001', 'OVR_ANALYTICS_EXECUTIVE_ENTITLEMENT_REQUIRED', 'F. Auditor analytics denied by role alone');
select throws_ok(format($sql$select public.ovr_executive_analytics_v1('%s','headline_current_period',null,null,'p3-inactive-role')$sql$,pg_temp.p3_uuid(15)), 'P0001', 'OVR_ANALYTICS_EXECUTIVE_ENTITLEMENT_REQUIRED', 'G. inactive Executive role denied');
select throws_ok(format($sql$select public.ovr_executive_analytics_v1('%s','headline_current_period',null,null,'p3-archived')$sql$,pg_temp.p3_uuid(16)), 'P0001', 'OVR_ANALYTICS_ACTIVE_ACTOR_REQUIRED', 'H. archived Executive denied');
select throws_ok(format($sql$select public.ovr_executive_analytics_v1('%s','headline_current_period',null,null,'p3-disabled-credential')$sql$,pg_temp.p3_uuid(17)), 'P0001', 'OVR_ANALYTICS_ACTIVE_ACTOR_REQUIRED', 'I. inactive credential denied');
select throws_ok(format($sql$select public.ovr_executive_analytics_v1('%s','headline_current_period',null,null,'p3-super-admin')$sql$,pg_temp.p3_uuid(18)), 'P0001', 'OVR_ANALYTICS_EXECUTIVE_ENTITLEMENT_REQUIRED', 'Super Admin role alone does not grant Executive analytics');
select throws_ok(format($sql$select public.ovr_executive_analytics_v1('%s','headline_current_period',null,null,'p3-quality')$sql$,pg_temp.p3_uuid(19)), 'P0001', 'OVR_ANALYTICS_EXECUTIVE_ENTITLEMENT_REQUIRED', 'Quality/governance authority alone does not grant Executive analytics');

select throws_ok(format($sql$select public.ovr_executive_analytics_v1('%s','arbitrary_shape',null,null,'p3-arbitrary')$sql$,pg_temp.p3_uuid(10)), 'P0001', 'OVR_ANALYTICS_QUERY_SHAPE_DENIED', 'AC. arbitrary query shape denied');
select throws_ok(format($sql$select public.ovr_executive_analytics_v1('%s','monthly_trend_12','%s',null,'p3-bad-filter')$sql$,pg_temp.p3_uuid(10),pg_temp.p3_uuid(111)), 'P0001', 'OVR_ANALYTICS_FILTER_COMBINATION_DENIED', 'arbitrary filter on a fixed no-filter shape denied');
select throws_ok(format($sql$select public.ovr_executive_analytics_v1('%s','headline_current_period','%s','Medication','p3-two-filters')$sql$,pg_temp.p3_uuid(10),pg_temp.p3_uuid(111)), 'P0001', 'OVR_ANALYTICS_FILTER_COMBINATION_DENIED', 'multiple differencing-sensitive filters denied');

insert into p3_results values
  ('department', public.ovr_executive_analytics_v1(pg_temp.p3_uuid(10),'department_summary',null,null,'p3-department-1')),
  ('category', public.ovr_executive_analytics_v1(pg_temp.p3_uuid(10),'category_summary',null,null,'p3-category-1')),
  ('severity', public.ovr_executive_analytics_v1(pg_temp.p3_uuid(10),'severity_summary',null,null,'p3-severity-1')),
  ('trend', public.ovr_executive_analytics_v1(pg_temp.p3_uuid(10),'monthly_trend_12',null,null,'p3-trend-1')),
  ('sla', public.ovr_executive_analytics_v1(pg_temp.p3_uuid(11),'sla_summary',null,null,'p3-zero-sla')),
  ('small-headline', public.ovr_executive_analytics_v1(pg_temp.p3_uuid(10),'headline_current_period',pg_temp.p3_uuid(112),null,'p3-small-headline'));

select ok((select (result#>>'{suppression,applied}')::boolean from p3_results where label='department'),
  'Y. dimensional cells below the configured threshold are suppressed');
select ok((select (result#>>'{suppression,complementary_applied}')::boolean from p3_results where label='department'),
  'AA. deterministic complementary suppression prevents subtraction leakage');
select is((select result#>'{suppression,exact_total}' from p3_results where label='department'), 'null'::jsonb,
  'an exact dimensional total is hidden whenever suppression applies');
select ok((select exists(
  select 1 from jsonb_array_elements(result->'buckets') b
  where coalesce((b->>'suppressed')::boolean,false)=false and (b->>'open_count')::integer >= 5
) from p3_results where label='category'), 'Z. cells at or above threshold remain visible');
select ok((select jsonb_array_length(result->'buckets') > 0 from p3_results where label='severity'),
  'fixed severity summary returns only suppressed or visible aggregate severity buckets');
select is((select jsonb_array_length(result->'buckets') from p3_results where label='trend'), 12,
  'AB. monthly trend exposes exactly twelve fixed non-overlapping buckets');
select is((select result#>'{metrics,closure_within_sla,percentage}' from p3_results where label='sla'), 'null'::jsonb,
  'S. zero SLA denominator returns null percentage rather than misleading division');
select ok((select (result#>>'{suppression,applied}')::boolean
           and result#>>'{metrics,suppressed}'='true'
           and not (result::text ~ 'open_ovr|new_this_month|overdue_ovr')
           from p3_results where label='small-headline'),
  'AD. differencing-sensitive filtered headline below threshold exposes no exact KPI values');

-- Audit, append-only history, and current-authorization idempotency semantics.
select is((select count(*)::integer from public.ovr_executive_analytics_audit where actor_id=pg_temp.p3_uuid(10)), 6,
  'AE. every successful Executive aggregate request appends an audit record');
insert into p3_results values (
  'headline-replay', public.ovr_executive_analytics_v1(
    pg_temp.p3_uuid(10), 'headline_current_period', null, null, 'p3-headline-1'
  )
);
select is((select result from p3_results where label='headline-replay'),
          (select result from p3_results where label='headline'),
  'AF. same idempotency key plus same semantic request returns the stored canonical aggregate');
select throws_ok(format($sql$select public.ovr_executive_analytics_v1('%s','category_summary',null,null,'p3-headline-1')$sql$,pg_temp.p3_uuid(10)), 'P0001', 'OVR_ANALYTICS_IDEMPOTENCY_KEY_REUSE_DENIED', 'same key with changed shape fails closed');
select throws_ok(format($sql$select public.ovr_executive_analytics_v1('%s','headline_current_period',null,null,'p3-headline-1')$sql$,pg_temp.p3_uuid(20)), 'P0001', 'OVR_ANALYTICS_IDEMPOTENCY_KEY_REUSE_DENIED', 'same key with changed actor fails closed');
update public.user_roles set is_active=false where user_id=pg_temp.p3_uuid(10) and role='executive';
select throws_ok(format($sql$select public.ovr_executive_analytics_v1('%s','headline_current_period',null,null,'p3-headline-1')$sql$,pg_temp.p3_uuid(10)), 'P0001', 'OVR_ANALYTICS_EXECUTIVE_ENTITLEMENT_REQUIRED', 'analytics replay requires fresh current authorization');
update public.user_roles set is_active=true where user_id=pg_temp.p3_uuid(10) and role='executive';

select throws_ok('update public.ovr_executive_analytics_audit set query_shape=''mutated''', 'P0001', 'OVR_ANALYTICS_HISTORY_IMMUTABLE', 'aggregate audit history cannot be updated');
select throws_ok('delete from public.ovr_executive_analytics_audit', 'P0001', 'OVR_ANALYTICS_HISTORY_IMMUTABLE', 'aggregate audit history cannot be deleted');
select throws_ok('update public.ovr_executive_analytics_requests set query_shape=''mutated''', 'P0001', 'OVR_ANALYTICS_HISTORY_IMMUTABLE', 'canonical request history cannot be updated');
*/

-- P3-R2 privacy-safe Executive authorization and fixed query family.
create or replace function pg_temp.p3_band_contains(p_band jsonb, p_expected bigint)
returns boolean language sql immutable as $$
  select case p_band ->> 'state'
    when 'zero' then p_expected = 0
    when 'banded' then p_expected between (p_band ->> 'lower_bound')::bigint
                                      and (p_band ->> 'upper_bound')::bigint
    else false
  end;
$$;

create temporary table p3_r2_results(label text primary key, result jsonb);
select throws_ok(format($sql$select public.ovr_executive_analytics_v1('%s','headline_current_period',null,null,'p3-r2-no-snapshot')$sql$,pg_temp.p3_uuid(10)),
  'P0001', 'OVR_ANALYTICS_SNAPSHOT_REQUIRED',
  'snapshot contract fails closed until the controlled daily publication exists');
insert into p3_r2_results values (
  'snapshot', public.refresh_ovr_executive_analytics_snapshot_v1(pg_temp.p3_uuid(10))
);
insert into p3_r2_results values
  ('headline', public.ovr_executive_analytics_v1(
    pg_temp.p3_uuid(10), 'headline_current_period', null, null, 'p3-r2-headline-1'
  )),
  ('trend', public.ovr_executive_analytics_v1(
    pg_temp.p3_uuid(10), 'monthly_trend_12', null, null, 'p3-r2-trend-1'
  ));

select is((select result ->> 'definition_version' from p3_r2_results where label='headline'), 'ovr-kpi-v2',
  'A. active Executive receives the repaired versioned aggregate contract');
select is((select result ->> 'query_shape' from p3_r2_results where label='headline'), 'headline_current_period',
  'the server returns only the requested fixed query shape');
select ok((select result ? 'metrics' from p3_r2_results where label='headline'),
  'all eight KPI values are returned through the privacy-safe metric contract');
select ok((select pg_temp.p3_band_contains(result #> '{metrics,open_ovr}', 23)
           from p3_r2_results where label='headline'),
  'J. banded Open OVR contains the canonical exact value without revealing it');
select ok((select pg_temp.p3_band_contains(
  result #> '{metrics,new_this_month}',
  (select count(*)::bigint from p3_facts
   where first_submitted_at >= date_trunc('month',statement_timestamp() at time zone 'Asia/Riyadh') at time zone 'Asia/Riyadh'
     and first_submitted_at < (date_trunc('month',statement_timestamp() at time zone 'Asia/Riyadh')+interval '1 month') at time zone 'Asia/Riyadh'))
  from p3_r2_results where label='headline'),
  'K. New this month uses organization-local first-submission time and returns a band');
select is((select result #>> '{metrics,major_sentinel,state}' from p3_r2_results where label='headline'), 'suppressed',
  'M. exact Major/Sentinel value 2 is suppressed rather than exposed');
select is((select result #>> '{metrics,corrective_action_required,state}' from p3_r2_results where label='headline'), 'suppressed',
  'Q. exact corrective-action value 3 is suppressed rather than exposed');
select ok((select pg_temp.p3_band_contains(result #> '{metrics,potential_repeat}', 12)
           from p3_r2_results where label='headline'),
  'P. potential-repeat returns a deterministic band containing the canonical value');
select is((select result #>> '{metrics,average_closure_time,state}' from p3_r2_results where label='headline'), 'suppressed',
  'N. a sub-threshold closure-duration cohort exposes neither exact duration nor denominator');
select is((select result #>> '{metrics,closure_within_sla,state}' from p3_r2_results where label='headline'), 'suppressed',
  'O. a sub-threshold SLA cohort exposes neither exact ratio nor denominator');
select ok((select not jsonb_path_exists(result, 'strict $.** ? (@.type() == "number" && @ > 0 && @ < 5)')
           from p3_r2_results where label='headline'),
  'R2-privacy. aggregate payload contains no exact numeric cell from 1 through 4');
select ok((select not (result::text ~ 'exact_total|population_count|numerator|average_closure_seconds')
           from p3_r2_results where label='headline'),
  'R2-privacy. no hidden exact population, numerator, or duration survives in the payload');
select ok((select not (result::text ~* 'OVR-P3|private narrative|example\.test|93400000-0000-4000-8000-0000000010')
           from p3_r2_results where label='headline'),
  'AI. aggregate output contains no OVR, person, narrative, or credential identifiers');

select is((select jsonb_array_length(result -> 'buckets') from p3_r2_results where label='trend'), 12,
  'AB. monthly trend exposes exactly twelve fixed non-overlapping buckets');
select ok((select bool_and(
    (b -> 'new_reports' ->> 'state') in ('zero','suppressed','banded')
    and (b -> 'closed_reports' ->> 'state') in ('zero','suppressed','banded')
  ) from p3_r2_results r cross join lateral jsonb_array_elements(r.result -> 'buckets') b
    where r.label='trend'),
  'monthly trend exposes deterministic bands, never exact counts');
select ok((select not jsonb_path_exists(result, 'strict $.buckets[*].** ? (@.type() == "number" && @ > 0 && @ < 5)')
           from p3_r2_results where label='trend'),
  'monthly trend contains no exact sensitive numeric value 1 through 4');

select throws_ok(format($sql$select public.ovr_executive_analytics_v1('%s','department_summary',null,null,'p3-r2-department-denied')$sql$,pg_temp.p3_uuid(10)), 'P0001', 'OVR_ANALYTICS_QUERY_SHAPE_DENIED', 'cross-shape department reconstruction is structurally unavailable');
select throws_ok(format($sql$select public.ovr_executive_analytics_v1('%s','category_summary',null,null,'p3-r2-category-denied')$sql$,pg_temp.p3_uuid(10)), 'P0001', 'OVR_ANALYTICS_QUERY_SHAPE_DENIED', 'cross-shape category reconstruction is structurally unavailable');
select throws_ok(format($sql$select public.ovr_executive_analytics_v1('%s','severity_summary',null,null,'p3-r2-severity-denied')$sql$,pg_temp.p3_uuid(10)), 'P0001', 'OVR_ANALYTICS_QUERY_SHAPE_DENIED', 'alternate severity reconstruction is structurally unavailable');
select throws_ok(format($sql$select public.ovr_executive_analytics_v1('%s','sla_summary',null,null,'p3-r2-sla-denied')$sql$,pg_temp.p3_uuid(10)), 'P0001', 'OVR_ANALYTICS_QUERY_SHAPE_DENIED', 'alternate SLA reconstruction is structurally unavailable');
select throws_ok(format($sql$select public.ovr_executive_analytics_v1('%s','headline_current_period','%s',null,'p3-r2-dept-filter-denied')$sql$,pg_temp.p3_uuid(10),pg_temp.p3_uuid(111)), 'P0001', 'OVR_ANALYTICS_FILTER_COMBINATION_DENIED', 'department filtering cannot create a complementary subtraction query');
select throws_ok(format($sql$select public.ovr_executive_analytics_v1('%s','headline_current_period',null,'Medication','p3-r2-category-filter-denied')$sql$,pg_temp.p3_uuid(10)), 'P0001', 'OVR_ANALYTICS_FILTER_COMBINATION_DENIED', 'category filtering cannot create a complementary subtraction query');
select throws_ok(format($sql$select public.ovr_executive_analytics_v1('%s','arbitrary_shape',null,null,'p3-r2-arbitrary')$sql$,pg_temp.p3_uuid(10)), 'P0001', 'OVR_ANALYTICS_QUERY_SHAPE_DENIED', 'AC. arbitrary query shapes are denied');
select throws_ok(format($sql$select public.ovr_executive_analytics_v1('%s','headline_current_period',null,null,'invalid key with spaces')$sql$,pg_temp.p3_uuid(10)), 'P0001', 'OVR_ANALYTICS_IDEMPOTENCY_KEY_INVALID', 'invalid idempotency keys fail closed before history mutation');

-- A new singleton after publication cannot change the same local-day snapshot.
select pg_temp.p3_make_case(50, 'under_supervisor_review', 'level_4', 'Temporal singleton',
  pg_temp.p3_uuid(111), now(), now());
insert into p3_r2_results values (
  'snapshot-replay', public.refresh_ovr_executive_analytics_snapshot_v1(pg_temp.p3_uuid(10))
);
select is((select result ->> 'snapshot_id' from p3_r2_results where label='snapshot-replay'),
          (select result ->> 'snapshot_id' from p3_r2_results where label='snapshot'),
  'temporal differencing: same-day refresh reuses the immutable snapshot');
select is((select result -> 'headline_current_period' from p3_r2_results where label='snapshot-replay'),
          (select result -> 'headline_current_period' from p3_r2_results where label='snapshot'),
  'temporal differencing: a singleton change cannot alter the published same-day response');

-- Authorization matrix and fail-closed entitlement proof.
select throws_ok(format($sql$select public.ovr_executive_analytics_v1('%s','headline_current_period',null,null,'p3-r2-employee')$sql$,pg_temp.p3_uuid(12)), 'P0001', 'OVR_ANALYTICS_EXECUTIVE_ENTITLEMENT_REQUIRED', 'D. Employee analytics denied');
select throws_ok(format($sql$select public.ovr_executive_analytics_v1('%s','headline_current_period',null,null,'p3-r2-manager')$sql$,pg_temp.p3_uuid(13)), 'P0001', 'OVR_ANALYTICS_EXECUTIVE_ENTITLEMENT_REQUIRED', 'E. Department Manager analytics denied by role alone');
select throws_ok(format($sql$select public.ovr_executive_analytics_v1('%s','headline_current_period',null,null,'p3-r2-auditor')$sql$,pg_temp.p3_uuid(14)), 'P0001', 'OVR_ANALYTICS_EXECUTIVE_ENTITLEMENT_REQUIRED', 'F. Auditor analytics denied by role alone');
select throws_ok(format($sql$select public.ovr_executive_analytics_v1('%s','headline_current_period',null,null,'p3-r2-inactive-role')$sql$,pg_temp.p3_uuid(15)), 'P0001', 'OVR_ANALYTICS_EXECUTIVE_ENTITLEMENT_REQUIRED', 'G. inactive Executive role denied');
select throws_ok(format($sql$select public.ovr_executive_analytics_v1('%s','headline_current_period',null,null,'p3-r2-archived')$sql$,pg_temp.p3_uuid(16)), 'P0001', 'OVR_ANALYTICS_ACTIVE_ACTOR_REQUIRED', 'H. archived Executive denied');
select throws_ok(format($sql$select public.ovr_executive_analytics_v1('%s','headline_current_period',null,null,'p3-r2-disabled-credential')$sql$,pg_temp.p3_uuid(17)), 'P0001', 'OVR_ANALYTICS_ACTIVE_ACTOR_REQUIRED', 'I. inactive credential denied');
select throws_ok(format($sql$select public.ovr_executive_analytics_v1('%s','headline_current_period',null,null,'p3-r2-super-admin')$sql$,pg_temp.p3_uuid(18)), 'P0001', 'OVR_ANALYTICS_EXECUTIVE_ENTITLEMENT_REQUIRED', 'Super Admin role alone does not grant Executive analytics');
select throws_ok(format($sql$select public.ovr_executive_analytics_v1('%s','headline_current_period',null,null,'p3-r2-quality')$sql$,pg_temp.p3_uuid(19)), 'P0001', 'OVR_ANALYTICS_EXECUTIVE_ENTITLEMENT_REQUIRED', 'Governance authority alone does not grant Executive analytics');

create temporary table p3_duplicate_role_ids(id uuid);
with inserted_role as (
  insert into public.user_roles(user_id,role,scope,organization_id,is_active)
  values(pg_temp.p3_uuid(10),'executive','global',pg_temp.p3_uuid(1),true)
  returning id
)
insert into p3_duplicate_role_ids select id from inserted_role;
select throws_ok(format($sql$select public.ovr_executive_analytics_v1('%s','headline_current_period',null,null,'p3-r2-duplicate-entitlement')$sql$,pg_temp.p3_uuid(10)), 'P0001', 'OVR_ANALYTICS_EXECUTIVE_ENTITLEMENT_REQUIRED', 'duplicate valid Executive entitlements fail closed');
delete from public.user_roles where id in (select id from p3_duplicate_role_ids);

update auth.users set raw_app_meta_data='{"credential_version":2}'::jsonb where id=pg_temp.p3_uuid(10);
select throws_ok(format($sql$select public.ovr_executive_analytics_v1('%s','headline_current_period',null,null,'p3-r2-stale-version')$sql$,pg_temp.p3_uuid(10)), 'P0001', 'OVR_ANALYTICS_ACTIVE_ACTOR_REQUIRED', 'stale Auth credential version fails closed');
update auth.users set raw_app_meta_data='{"credential_version":1}'::jsonb where id=pg_temp.p3_uuid(10);

-- Audit, append-only history, and current-authorization idempotency semantics.
insert into p3_r2_results values (
  'headline-replay', public.ovr_executive_analytics_v1(
    pg_temp.p3_uuid(10), 'headline_current_period', null, null, 'p3-r2-headline-1'
  )
);
select is((select result from p3_r2_results where label='headline-replay'),
          (select result from p3_r2_results where label='headline'),
  'AF. same idempotency key plus same semantic request returns the stored canonical aggregate');
select throws_ok(format($sql$select public.ovr_executive_analytics_v1('%s','monthly_trend_12',null,null,'p3-r2-headline-1')$sql$,pg_temp.p3_uuid(10)), 'P0001', 'OVR_ANALYTICS_IDEMPOTENCY_KEY_REUSE_DENIED', 'same key with changed shape fails closed');
select throws_ok(format($sql$select public.ovr_executive_analytics_v1('%s','headline_current_period',null,null,'p3-r2-headline-1')$sql$,pg_temp.p3_uuid(20)), 'P0001', 'OVR_ANALYTICS_IDEMPOTENCY_KEY_REUSE_DENIED', 'same key with changed actor fails closed');
update public.user_roles set is_active=false where user_id=pg_temp.p3_uuid(10) and role='executive';
select throws_ok(format($sql$select public.ovr_executive_analytics_v1('%s','headline_current_period',null,null,'p3-r2-headline-1')$sql$,pg_temp.p3_uuid(10)), 'P0001', 'OVR_ANALYTICS_EXECUTIVE_ENTITLEMENT_REQUIRED', 'analytics replay requires fresh current authorization');
update public.user_roles set is_active=true where user_id=pg_temp.p3_uuid(10) and role='executive';
select is((select count(*)::integer from public.ovr_executive_analytics_audit where actor_id=pg_temp.p3_uuid(10)), 3,
  'AE. every successful aggregate access, including replay, appends one audit record');

select throws_ok('update public.ovr_executive_analytics_snapshots set privacy_model=''mutated''', 'P0001', 'OVR_ANALYTICS_HISTORY_IMMUTABLE', 'published snapshot cannot be updated');
select throws_ok('delete from public.ovr_executive_analytics_snapshots', 'P0001', 'OVR_ANALYTICS_HISTORY_IMMUTABLE', 'published snapshot cannot be deleted');
select throws_ok('update public.ovr_executive_analytics_audit set query_shape=''mutated''', 'P0001', 'OVR_ANALYTICS_HISTORY_IMMUTABLE', 'aggregate audit history cannot be updated');
select throws_ok('delete from public.ovr_executive_analytics_audit', 'P0001', 'OVR_ANALYTICS_HISTORY_IMMUTABLE', 'aggregate audit history cannot be deleted');
select throws_ok('update public.ovr_executive_analytics_requests set query_shape=''mutated''', 'P0001', 'OVR_ANALYTICS_HISTORY_IMMUTABLE', 'canonical request history cannot be updated');

-- Configuration, tenant, grant, and raw-access non-expansion controls.
select throws_ok(format($sql$insert into public.organization_ovr_analytics_config(id,organization_id,timezone_name,sla_calendar_id,minimum_cell_size,kpi_definition_version,effective_from,is_active,configured_by) values('%s','%s','UTC','%s',5,'ovr-kpi-v2',now(),true,'%s')$sql$,
  pg_temp.p3_uuid(213),pg_temp.p3_uuid(1),pg_temp.p3_uuid(201),pg_temp.p3_uuid(19)), 'P0001', 'OVR_ANALYTICS_TIMEZONE_CALENDAR_MISMATCH', 'cross-configured timezone/calendar fails closed');
select throws_ok(format($sql$insert into public.organization_ovr_analytics_config(id,organization_id,timezone_name,sla_calendar_id,minimum_cell_size,kpi_definition_version,effective_from,is_active,configured_by) values('%s','%s','Not/A_Timezone','%s',5,'ovr-kpi-v2',now(),false,'%s')$sql$,
  pg_temp.p3_uuid(214),pg_temp.p3_uuid(1),pg_temp.p3_uuid(201),pg_temp.p3_uuid(19)), 'P0001', 'OVR_ANALYTICS_TIMEZONE_INVALID', 'missing/invalid timezone silently defaults nowhere');
select throws_ok(format($sql$insert into public.organization_ovr_analytics_config(id,organization_id,timezone_name,sla_calendar_id,minimum_cell_size,kpi_definition_version,effective_from,is_active,configured_by) values('%s','%s','UTC','%s',5,'ovr-kpi-v2',now(),false,'%s')$sql$,
  pg_temp.p3_uuid(215),pg_temp.p3_uuid(1),pg_temp.p3_uuid(202),pg_temp.p3_uuid(19)), '23503', null, 'cross-organization SLA calendar reference is structurally denied');
select throws_ok(format($sql$insert into public.organization_ovr_analytics_config(id,organization_id,timezone_name,sla_calendar_id,minimum_cell_size,kpi_definition_version,effective_from,is_active,configured_by) values('%s','%s','Asia/Riyadh','%s',5,'ovr-kpi-v2',now(),true,'%s')$sql$,
  pg_temp.p3_uuid(216),pg_temp.p3_uuid(1),pg_temp.p3_uuid(201),pg_temp.p3_uuid(19)), '23505', null, 'duplicate active analytics configuration is rejected');

-- Raw-row isolation: a pure Executive has aggregate access but no organization-
-- wide raw OVR access. Reporter and operational Governance access remain intact.
-- The disposable lineage intentionally carries no application table grants, so
-- grant only the read privileges needed to exercise the production RLS surface;
-- the surrounding transaction rolls these grants back with the fixtures.
grant select on public.user_roles, public.ovr_reports, public.departments, public.projects to authenticated;
grant select on public.v_ovr_risk_indicator_feed to authenticated;
select pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
select pg_catalog.set_config('request.jwt.claim.sub', pg_temp.p3_uuid(10)::text, true);
set local role authenticated;
select is((select count(*)::bigint from public.ovr_reports where organization_id='93400000-0000-4000-8000-000000000001'), 0::bigint,
  'raw isolation: pure Executive cannot read organization-wide OVR rows');
select is((select count(*)::bigint from public.v_ovr_risk_indicator_feed where organization_id='93400000-0000-4000-8000-000000000001'), 0::bigint,
  'raw isolation: legacy risk-feed view cannot bypass Executive OVR RLS');
reset role;

select pg_catalog.set_config('request.jwt.claim.sub', pg_temp.p3_uuid(12)::text, true);
set local role authenticated;
select ok((select count(*) > 0 from public.ovr_reports where organization_id='93400000-0000-4000-8000-000000000001'),
  'raw isolation: the reporter retains normal access to their own OVR rows');
reset role;

select pg_catalog.set_config('request.jwt.claim.sub', pg_temp.p3_uuid(19)::text, true);
set local role authenticated;
select ok((select count(*) >= 20 from public.ovr_reports where organization_id='93400000-0000-4000-8000-000000000001'),
  'raw isolation: Governance operational access remains available');
reset role;
select pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);

select ok(position('executive' in lower((select qual from pg_policies where schemaname='public' and tablename='ovr_reports' and policyname='ovr_reports_read_related'))) = 0,
  'raw isolation: the OVR read policy no longer contains the legacy Executive branch');
select ok((select bool_and(coalesce(reloptions, '{}'::text[]) @> array['security_invoker=true'])
  from pg_class where oid in (
    'public.v_ovr_summary'::regclass,
    'public.v_ovr_quality_queue'::regclass,
    'public.v_ovr_workflow_queue'::regclass,
    'public.v_ovr_workflow_control_summary'::regclass,
    'public.v_ovr_risk_indicator_feed'::regclass,
    'public.v_ovr_repeated_category_alerts'::regclass,
    'public.v_ovr_risk_indicators_by_department'::regclass,
    'public.v_ovr_risk_indicator_summary'::regclass,
    'public.v_ovr_risk_attention_items'::regclass
  )), 'all legacy OVR browser views use caller-authorized security-invoker semantics');

select ok(not has_function_privilege('authenticated','public.ovr_executive_analytics_v1(uuid,text,uuid,text,text)','EXECUTE'), 'browser authenticated role cannot execute aggregate RPC directly');
select ok(has_function_privilege('service_role','public.ovr_executive_analytics_v1(uuid,text,uuid,text,text)','EXECUTE'), 'only controlled service identity receives aggregate RPC execution');
select ok(not has_function_privilege('authenticated','public.refresh_ovr_executive_analytics_snapshot_v1(uuid)','EXECUTE'), 'browser authenticated role cannot publish analytics snapshots');
select ok(has_function_privilege('service_role','public.refresh_ovr_executive_analytics_snapshot_v1(uuid)','EXECUTE'), 'only the controlled service identity can publish a daily snapshot');
select ok(not has_function_privilege('service_role','ovr_v11_private.ovr_kpi_facts_v2(uuid,timestamptz,text)','EXECUTE'), 'private raw KPI fact helper is not callable by service role');
select ok(not has_function_privilege('authenticated','ovr_v11_private.ovr_kpi_facts_v2(uuid,timestamptz,text)','EXECUTE'), 'Executive browser identity cannot call raw KPI facts');
select ok(not has_table_privilege('authenticated','public.ovr_final_verdicts','SELECT'), 'C. P3 grants no raw P2 verdict access');
select ok(not has_table_privilege('authenticated','public.ovr_governance_closures','SELECT'), 'P3 grants no raw P2 closure access');
select ok(not has_table_privilege('authenticated','public.ovr_executive_analytics_audit','SELECT'), 'browser cannot read aggregate audit rows');
select ok(not has_table_privilege('service_role','public.ovr_executive_analytics_snapshots','SELECT'), 'service role receives no direct snapshot-table read bypass');
select is((select relrowsecurity and relforcerowsecurity from pg_class where oid='public.organization_ovr_analytics_config'::regclass),true,'analytics config has RLS and FORCE RLS');
select is((select relrowsecurity and relforcerowsecurity from pg_class where oid='public.ovr_executive_analytics_audit'::regclass),true,'analytics audit has RLS and FORCE RLS');
select is((select pg_get_userbyid(proowner) from pg_proc where oid='public.ovr_executive_analytics_v1(uuid,text,uuid,text,text)'::regprocedure),'postgres','aggregate RPC has expected postgres owner');
select is((select prosecdef from pg_proc where oid='public.ovr_executive_analytics_v1(uuid,text,uuid,text,text)'::regprocedure),true,'aggregate RPC is SECURITY DEFINER with internal authorization');

select * from finish();
rollback;
