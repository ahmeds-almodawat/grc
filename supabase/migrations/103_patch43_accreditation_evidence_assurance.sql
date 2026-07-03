-- =========================================================
-- Patch 43: Accreditation & Evidence Assurance Engine
-- Additive survey readiness, evidence gate, waiver, and traceability layer.
-- =========================================================

create table if not exists public.evidence_gate_rules (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  gate_name text not null,
  required_evidence_type text,
  minimum_accepted_evidence integer not null default 1 check (minimum_accepted_evidence >= 0),
  allow_waiver boolean not null default true,
  applies_to_statuses text[] not null default array[]::text[],
  severity text not null default 'high' check (severity in ('low','medium','high','critical')),
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entity_type, gate_name)
);

create table if not exists public.evidence_gate_evaluations (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  gate_rule_id uuid references public.evidence_gate_rules(id) on delete set null,
  gate_status text not null check (gate_status in (
    'pass','fail_missing_evidence','fail_rejected_evidence','fail_expired_evidence',
    'fail_superseded_evidence','waived','not_required','requires_review'
  )),
  accepted_evidence_count integer not null default 0 check (accepted_evidence_count >= 0),
  rejected_evidence_count integer not null default 0 check (rejected_evidence_count >= 0),
  expired_evidence_count integer not null default 0 check (expired_evidence_count >= 0),
  superseded_evidence_count integer not null default 0 check (superseded_evidence_count >= 0),
  missing_evidence_count integer not null default 0 check (missing_evidence_count >= 0),
  active_waiver_id uuid,
  evaluated_by uuid references public.profiles(id) on delete set null,
  evaluated_at timestamptz not null default now(),
  evaluation_context jsonb not null default '{}'::jsonb
);

create table if not exists public.accreditation_war_room_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_title text not null,
  readiness_signal text not null default 'watch' check (readiness_signal in ('on_track','watch','attention_required','blocked')),
  overall_readiness_score numeric(5,2),
  open_blocker_count integer not null default 0 check (open_blocker_count >= 0),
  evidence_gap_count integer not null default 0 check (evidence_gap_count >= 0),
  gate_failure_count integer not null default 0 check (gate_failure_count >= 0),
  active_waiver_count integer not null default 0 check (active_waiver_count >= 0),
  snapshot_payload jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.survey_readiness_events (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid,
  event_type text not null,
  event_summary text not null,
  event_payload jsonb not null default '{}'::jsonb,
  actor_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.evidence_gate_waivers add column if not exists entity_type text;
alter table public.evidence_gate_waivers add column if not exists entity_id uuid;
alter table public.evidence_gate_waivers add column if not exists waiver_status text;
alter table public.evidence_gate_waivers add column if not exists expires_on date;
alter table public.evidence_gate_waivers add column if not exists rejected_by uuid references public.profiles(id) on delete set null;
alter table public.evidence_gate_waivers add column if not exists rejected_at timestamptz;
alter table public.evidence_gate_waivers add column if not exists rejection_reason text;
alter table public.evidence_gate_waivers add column if not exists revoked_by uuid references public.profiles(id) on delete set null;
alter table public.evidence_gate_waivers add column if not exists revoked_at timestamptz;
alter table public.evidence_gate_waivers add column if not exists revoke_reason text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'evidence_gate_waivers_patch43_status_chk'
  ) then
    alter table public.evidence_gate_waivers
      add constraint evidence_gate_waivers_patch43_status_chk
      check (waiver_status is null or waiver_status in ('pending','approved','rejected','revoked','expired'));
  end if;
end $$;

update public.evidence_gate_waivers
set waiver_status = case status
  when 'requested' then 'pending'
  else status
end,
expires_on = coalesce(expires_on, expiry_date),
entity_type = coalesce(entity_type, linked_item_type),
entity_id = coalesce(entity_id, linked_item_id)
where waiver_status is null or entity_type is null or entity_id is null or expires_on is null;

create index if not exists idx_patch43_gate_rules_entity on public.evidence_gate_rules(entity_type, active);
create index if not exists idx_patch43_gate_eval_entity on public.evidence_gate_evaluations(entity_type, entity_id, evaluated_at desc);
create index if not exists idx_patch43_gate_eval_status on public.evidence_gate_evaluations(gate_status);
create index if not exists idx_patch43_war_room_created on public.accreditation_war_room_snapshots(created_at desc);
create index if not exists idx_patch43_readiness_events_entity on public.survey_readiness_events(entity_type, entity_id, created_at desc);
create index if not exists idx_patch43_waivers_entity on public.evidence_gate_waivers(entity_type, entity_id, waiver_status);

alter table public.evidence_gate_rules enable row level security;
alter table public.evidence_gate_evaluations enable row level security;
alter table public.evidence_gate_waivers enable row level security;
alter table public.accreditation_war_room_snapshots enable row level security;
alter table public.survey_readiness_events enable row level security;

drop policy if exists patch43_gate_rules_read on public.evidence_gate_rules;
create policy patch43_gate_rules_read on public.evidence_gate_rules
for select to authenticated
using (public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer','department_manager']));

drop policy if exists patch43_gate_rules_write on public.evidence_gate_rules;
create policy patch43_gate_rules_write on public.evidence_gate_rules
for all to authenticated
using (public.has_any_role(array['super_admin','governance_admin','compliance_officer']))
with check (public.has_any_role(array['super_admin','governance_admin','compliance_officer']));

drop policy if exists patch43_gate_evaluations_read on public.evidence_gate_evaluations;
create policy patch43_gate_evaluations_read on public.evidence_gate_evaluations
for select to authenticated
using (public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer','department_manager']));

drop policy if exists patch43_gate_evaluations_write on public.evidence_gate_evaluations;
create policy patch43_gate_evaluations_write on public.evidence_gate_evaluations
for all to authenticated
using (public.has_any_role(array['super_admin','governance_admin','compliance_officer','auditor']))
with check (public.has_any_role(array['super_admin','governance_admin','compliance_officer','auditor']));

drop policy if exists patch43_waivers_read on public.evidence_gate_waivers;
create policy patch43_waivers_read on public.evidence_gate_waivers
for select to authenticated
using (public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer','department_manager']));

drop policy if exists patch43_waivers_write on public.evidence_gate_waivers;
create policy patch43_waivers_write on public.evidence_gate_waivers
for all to authenticated
using (public.has_any_role(array['super_admin','governance_admin','compliance_officer']))
with check (public.has_any_role(array['super_admin','governance_admin','compliance_officer']));

drop policy if exists patch43_war_room_snapshots_read on public.accreditation_war_room_snapshots;
create policy patch43_war_room_snapshots_read on public.accreditation_war_room_snapshots
for select to authenticated
using (public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer','department_manager']));

drop policy if exists patch43_war_room_snapshots_write on public.accreditation_war_room_snapshots;
create policy patch43_war_room_snapshots_write on public.accreditation_war_room_snapshots
for insert to authenticated
with check (public.has_any_role(array['super_admin','governance_admin','compliance_officer']));

drop policy if exists patch43_readiness_events_read on public.survey_readiness_events;
create policy patch43_readiness_events_read on public.survey_readiness_events
for select to authenticated
using (public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer','department_manager']));

drop policy if exists patch43_readiness_events_write on public.survey_readiness_events;
create policy patch43_readiness_events_write on public.survey_readiness_events
for insert to authenticated
with check (public.has_any_role(array['super_admin','governance_admin','compliance_officer','auditor']));

insert into public.evidence_gate_rules(entity_type, gate_name, required_evidence_type, minimum_accepted_evidence, severity)
values
  ('clause', 'survey_closure', 'accreditation_evidence', 1, 'critical'),
  ('audit_finding', 'finding_closure', 'audit_evidence', 1, 'high'),
  ('rca_case', 'rca_closure', 'rca_evidence', 1, 'high'),
  ('capa', 'capa_closure', 'capa_evidence', 1, 'high'),
  ('training_assignment', 'competency_proof', 'training_evidence', 1, 'medium'),
  ('document', 'document_control_proof', 'document_evidence', 1, 'medium')
on conflict (entity_type, gate_name) do nothing;

create or replace function public.patch43_service_role_required()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'Patch 43 assurance actions require the privileged action bridge';
  end if;
end;
$$;

create or replace function public.patch43_actor_organization(p_actor_user_id uuid)
returns uuid
language sql
security definer
set search_path = public
as $$
  select organization_id from public.profiles where id = p_actor_user_id limit 1;
$$;

create or replace function public.patch43_actor_has_authority(p_actor_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p_actor_user_id
      and coalesce(ur.is_active, true) = true
      and ur.role in ('super_admin','governance_admin','compliance_officer','auditor')
  );
$$;

create or replace function public.record_survey_readiness_event(
  p_entity_type text,
  p_entity_id uuid,
  p_event_type text,
  p_event_summary text,
  p_actor_user_id uuid,
  p_event_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  perform public.patch43_service_role_required();
  if not public.patch43_actor_has_authority(p_actor_user_id) then
    raise exception 'Actor is not authorized to record survey readiness events';
  end if;

  insert into public.survey_readiness_events(entity_type, entity_id, event_type, event_summary, event_payload, actor_user_id)
  values (p_entity_type, p_entity_id, p_event_type, p_event_summary, coalesce(p_event_payload, '{}'::jsonb), p_actor_user_id)
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.evaluate_evidence_gate(
  p_entity_type text,
  p_entity_id uuid,
  p_actor_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule public.evidence_gate_rules%rowtype;
  v_accepted integer := 0;
  v_rejected integer := 0;
  v_expired integer := 0;
  v_superseded integer := 0;
  v_missing integer := 0;
  v_waiver_id uuid;
  v_status text;
  v_evaluation_id uuid;
begin
  perform public.patch43_service_role_required();
  if p_actor_user_id is not null and not public.patch43_actor_has_authority(p_actor_user_id) then
    raise exception 'Actor is not authorized to evaluate evidence gates';
  end if;

  select * into v_rule
  from public.evidence_gate_rules
  where entity_type = p_entity_type and active = true
  order by severity desc, created_at asc
  limit 1;

  if v_rule.id is null then
    v_status := 'not_required';
  else
    select
      count(*) filter (where b.evidence_status = 'accepted' and b.freshness_status = 'current'),
      count(*) filter (where b.evidence_status = 'rejected'),
      count(*) filter (where b.evidence_status = 'expired' or b.freshness_status = 'expired' or (b.valid_until is not null and b.valid_until < current_date)),
      count(*) filter (where b.evidence_status in ('superseded','stale') or b.freshness_status = 'stale'),
      greatest(v_rule.minimum_accepted_evidence - count(*) filter (where b.evidence_status = 'accepted' and b.freshness_status = 'current'), 0)
    into v_accepted, v_rejected, v_expired, v_superseded, v_missing
    from public.evidence_bridge_links b
    where b.active = true
      and (
        (p_entity_type = 'clause' and b.clause_id = p_entity_id)
        or (b.linked_entity_type = p_entity_type and b.linked_entity_id = p_entity_id)
      );

    select w.id into v_waiver_id
    from public.evidence_gate_waivers w
    where coalesce(w.entity_type, w.linked_item_type) = p_entity_type
      and coalesce(w.entity_id, w.linked_item_id) = p_entity_id
      and coalesce(w.waiver_status, case when w.status = 'requested' then 'pending' else w.status end) = 'approved'
      and coalesce(w.expires_on, w.expiry_date, current_date + interval '1 day')::date >= current_date
    order by coalesce(w.approved_at, w.requested_at) desc
    limit 1;

    v_status := case
      when v_waiver_id is not null then 'waived'
      when v_accepted >= v_rule.minimum_accepted_evidence then 'pass'
      when v_expired > 0 then 'fail_expired_evidence'
      when v_rejected > 0 then 'fail_rejected_evidence'
      when v_superseded > 0 then 'fail_superseded_evidence'
      when v_missing > 0 then 'fail_missing_evidence'
      else 'requires_review'
    end;
  end if;

  insert into public.evidence_gate_evaluations(
    entity_type, entity_id, gate_rule_id, gate_status, accepted_evidence_count,
    rejected_evidence_count, expired_evidence_count, superseded_evidence_count,
    missing_evidence_count, active_waiver_id, evaluated_by, evaluation_context
  )
  values (
    p_entity_type, p_entity_id, v_rule.id, v_status, coalesce(v_accepted,0),
    coalesce(v_rejected,0), coalesce(v_expired,0), coalesce(v_superseded,0),
    coalesce(v_missing,0), v_waiver_id, p_actor_user_id,
    jsonb_build_object('level', 'evaluation', 'source', 'patch43')
  )
  returning id into v_evaluation_id;

  if p_actor_user_id is not null then
    insert into public.survey_readiness_events(entity_type, entity_id, event_type, event_summary, event_payload, actor_user_id)
    values (
      p_entity_type, p_entity_id, 'evidence_gate_evaluated',
      'Evidence gate evaluated as ' || v_status,
      jsonb_build_object('evaluation_id', v_evaluation_id, 'gate_status', v_status),
      p_actor_user_id
    );
  end if;

  return jsonb_build_object(
    'evaluation_id', v_evaluation_id,
    'entity_type', p_entity_type,
    'entity_id', p_entity_id,
    'gate_status', v_status,
    'accepted_evidence_count', coalesce(v_accepted,0),
    'rejected_evidence_count', coalesce(v_rejected,0),
    'expired_evidence_count', coalesce(v_expired,0),
    'superseded_evidence_count', coalesce(v_superseded,0),
    'missing_evidence_count', coalesce(v_missing,0),
    'active_waiver_id', v_waiver_id
  );
end;
$$;

create or replace function public.evaluate_evidence_gate_for_entity(
  p_entity_type text,
  p_entity_id uuid,
  p_actor_user_id uuid default null
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.evaluate_evidence_gate(p_entity_type, p_entity_id, p_actor_user_id);
$$;

create or replace function public.request_evidence_gate_waiver(
  p_entity_type text,
  p_entity_id uuid,
  p_waiver_reason text,
  p_actor_user_id uuid,
  p_expires_on date default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_requirement_id uuid;
  v_waiver_id uuid;
  v_linked_type text;
begin
  perform public.patch43_service_role_required();
  if not public.patch43_actor_has_authority(p_actor_user_id) then
    raise exception 'Actor is not authorized to request evidence gate waivers';
  end if;

  v_org := public.patch43_actor_organization(p_actor_user_id);
  if v_org is null then
    raise exception 'Actor profile is missing organization_id';
  end if;

  v_linked_type := case
    when p_entity_type in ('risk','ovr','audit_finding','compliance','project','milestone','task','approval','capa','control','policy','department')
      then p_entity_type
    else 'task'
  end;

  insert into public.evidence_requirements(
    organization_id, requirement_code, linked_item_type, linked_item_id,
    requirement_title, requirement_description, required_for_gate, owner_id, created_by
  )
  values (
    v_org, 'PATCH43-' || p_entity_type || '-' || p_entity_id::text,
    v_linked_type, p_entity_id,
    'Patch 43 evidence gate waiver requirement',
    'Compatibility requirement created to govern a Patch 43 evidence gate waiver.',
    'audit', p_actor_user_id, p_actor_user_id
  )
  on conflict (organization_id, requirement_code)
  do update set updated_at = now()
  returning id into v_requirement_id;

  insert into public.evidence_gate_waivers(
    organization_id, requirement_id, linked_item_type, linked_item_id, waiver_reason,
    requested_by, status, expiry_date, audit_note, entity_type, entity_id, waiver_status, expires_on
  )
  values (
    v_org, v_requirement_id, v_linked_type, p_entity_id, p_waiver_reason,
    p_actor_user_id, 'requested', p_expires_on, 'Patch 43 evidence gate waiver requested.',
    p_entity_type, p_entity_id, 'pending', p_expires_on
  )
  returning id into v_waiver_id;

  insert into public.survey_readiness_events(entity_type, entity_id, event_type, event_summary, event_payload, actor_user_id)
  values (p_entity_type, p_entity_id, 'waiver_requested', p_waiver_reason, jsonb_build_object('waiver_id', v_waiver_id), p_actor_user_id);

  return v_waiver_id;
end;
$$;

create or replace function public.approve_evidence_gate_waiver(
  p_waiver_id uuid,
  p_actor_user_id uuid,
  p_audit_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entity_type text;
  v_entity_id uuid;
begin
  perform public.patch43_service_role_required();
  if not public.patch43_actor_has_authority(p_actor_user_id) then
    raise exception 'Actor is not authorized to approve evidence gate waivers';
  end if;

  update public.evidence_gate_waivers
  set waiver_status = 'approved',
      status = 'approved',
      approved_by = p_actor_user_id,
      approved_at = now(),
      audit_note = coalesce(p_audit_note, audit_note)
  where id = p_waiver_id
  returning coalesce(entity_type, linked_item_type), coalesce(entity_id, linked_item_id)
  into v_entity_type, v_entity_id;

  insert into public.survey_readiness_events(entity_type, entity_id, event_type, event_summary, event_payload, actor_user_id)
  values (v_entity_type, v_entity_id, 'waiver_approved', coalesce(p_audit_note, 'Evidence gate waiver approved.'), jsonb_build_object('waiver_id', p_waiver_id), p_actor_user_id);

  return p_waiver_id;
end;
$$;

create or replace function public.reject_evidence_gate_waiver(
  p_waiver_id uuid,
  p_actor_user_id uuid,
  p_rejection_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entity_type text;
  v_entity_id uuid;
begin
  perform public.patch43_service_role_required();
  if not public.patch43_actor_has_authority(p_actor_user_id) then
    raise exception 'Actor is not authorized to reject evidence gate waivers';
  end if;

  update public.evidence_gate_waivers
  set waiver_status = 'rejected',
      status = 'rejected',
      rejected_by = p_actor_user_id,
      rejected_at = now(),
      rejection_reason = p_rejection_reason,
      audit_note = coalesce(audit_note, p_rejection_reason)
  where id = p_waiver_id
  returning coalesce(entity_type, linked_item_type), coalesce(entity_id, linked_item_id)
  into v_entity_type, v_entity_id;

  insert into public.survey_readiness_events(entity_type, entity_id, event_type, event_summary, event_payload, actor_user_id)
  values (v_entity_type, v_entity_id, 'waiver_rejected', p_rejection_reason, jsonb_build_object('waiver_id', p_waiver_id), p_actor_user_id);

  return p_waiver_id;
end;
$$;

create or replace function public.revoke_evidence_gate_waiver(
  p_waiver_id uuid,
  p_actor_user_id uuid,
  p_revoke_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entity_type text;
  v_entity_id uuid;
begin
  perform public.patch43_service_role_required();
  if not public.patch43_actor_has_authority(p_actor_user_id) then
    raise exception 'Actor is not authorized to revoke evidence gate waivers';
  end if;

  update public.evidence_gate_waivers
  set waiver_status = 'revoked',
      status = 'expired',
      revoked_by = p_actor_user_id,
      revoked_at = now(),
      revoke_reason = p_revoke_reason,
      audit_note = coalesce(audit_note, p_revoke_reason)
  where id = p_waiver_id
  returning coalesce(entity_type, linked_item_type), coalesce(entity_id, linked_item_id)
  into v_entity_type, v_entity_id;

  insert into public.survey_readiness_events(entity_type, entity_id, event_type, event_summary, event_payload, actor_user_id)
  values (v_entity_type, v_entity_id, 'waiver_revoked', p_revoke_reason, jsonb_build_object('waiver_id', p_waiver_id), p_actor_user_id);

  return p_waiver_id;
end;
$$;

create or replace function public.create_accreditation_war_room_snapshot(
  p_snapshot_title text,
  p_actor_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_id uuid;
begin
  perform public.patch43_service_role_required();
  if not public.patch43_actor_has_authority(p_actor_user_id) then
    raise exception 'Actor is not authorized to create accreditation war room snapshots';
  end if;

  select * into v_row from public.v_patch43_accreditation_war_room limit 1;

  insert into public.accreditation_war_room_snapshots(
    snapshot_title, readiness_signal, overall_readiness_score, open_blocker_count,
    evidence_gap_count, gate_failure_count, active_waiver_count, snapshot_payload, created_by
  )
  values (
    p_snapshot_title,
    coalesce(v_row.readiness_signal, 'watch'),
    v_row.overall_readiness_score,
    coalesce(v_row.total_blocker_count, 0),
    coalesce(v_row.evidence_gap_count, 0),
    coalesce(v_row.gate_failure_count, 0),
    coalesce(v_row.active_waiver_count, 0),
    to_jsonb(v_row),
    p_actor_user_id
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace view public.v_patch43_clause_readiness_register as
select
  coalesce(cr.clause_id, bs.clause_id) as clause_id,
  coalesce(cr.framework, bs.framework) as framework,
  coalesce(cr.standard_code, bs.standard_code) as standard_code,
  coalesce(cr.clause_code, bs.clause_code) as clause_code,
  coalesce(cr.clause_title, bs.clause_title) as clause_title,
  cr.bridge_link_count,
  cr.primary_bridge_count,
  cr.accepted_current_count,
  cr.evidence_gap_count,
  cr.readiness_status,
  coalesce(bs.workflow_blocker_count, 0) as workflow_blocker_count,
  coalesce(bs.evidence_blocker_count, 0) as workflow_evidence_blocker_count,
  coalesce(bs.dependency_link_count, 0) as dependency_link_count,
  coalesce(bs.open_escalation_count, 0) as open_escalation_count,
  ev.gate_status,
  ev.accepted_evidence_count,
  ev.missing_evidence_count,
  ev.active_waiver_id,
  ev.evaluated_at
from public.v_patch33_clause_evidence_readiness cr
full join public.v_patch35_clause_blocker_summary bs on bs.clause_id = cr.clause_id
left join lateral (
  select *
  from public.evidence_gate_evaluations e
  where e.entity_type = 'clause' and e.entity_id = coalesce(cr.clause_id, bs.clause_id)
  order by e.evaluated_at desc
  limit 1
) ev on true;

create or replace view public.v_patch43_department_readiness_register as
select
  coalesce(er.department_id, wl.department_id) as department_id,
  coalesce(er.department_name, wl.department_name) as department_name,
  er.bridge_link_count,
  er.ready_evidence_count,
  er.gap_count as evidence_gap_count,
  er.evidence_readiness_score,
  wl.open_task_count,
  wl.overdue_task_count,
  wl.high_priority_task_count,
  wl.pending_review_count,
  wl.nearest_due_date,
  case
    when coalesce(wl.overdue_task_count, 0) > 0 or coalesce(er.gap_count, 0) > 0 then 'attention_required'
    when coalesce(wl.high_priority_task_count, 0) > 0 then 'watch'
    else 'on_track'
  end as readiness_signal
from public.v_patch33_department_evidence_readiness er
full join public.v_patch35_department_accreditation_workload wl on wl.department_id = er.department_id;

create or replace view public.v_patch43_evidence_gap_register as
select
  bridge_link_id,
  clause_id,
  clause_code,
  clause_title,
  framework,
  standard_code,
  linked_entity_type,
  linked_entity_id,
  evidence_status,
  freshness_status,
  valid_until,
  owner_user_id,
  owner_name,
  department_id,
  department_name,
  updated_at
from public.v_patch33_live_evidence_gap_register;

create or replace view public.v_patch43_evidence_gate_failure_register as
select
  e.*,
  r.gate_name,
  r.required_evidence_type,
  r.severity
from public.evidence_gate_evaluations e
left join public.evidence_gate_rules r on r.id = e.gate_rule_id
where e.gate_status in (
  'fail_missing_evidence','fail_rejected_evidence','fail_expired_evidence',
  'fail_superseded_evidence','requires_review'
);

create or replace view public.v_patch43_evidence_waiver_register as
select
  w.id as waiver_id,
  coalesce(w.entity_type, w.linked_item_type) as entity_type,
  coalesce(w.entity_id, w.linked_item_id) as entity_id,
  w.waiver_reason,
  coalesce(w.waiver_status, case when w.status = 'requested' then 'pending' else w.status end) as waiver_status,
  w.requested_by,
  requester.full_name as requested_by_name,
  w.requested_at,
  w.approved_by,
  approver.full_name as approved_by_name,
  w.approved_at,
  w.rejected_by,
  w.rejected_at,
  w.rejection_reason,
  w.revoked_by,
  w.revoked_at,
  w.revoke_reason,
  coalesce(w.expires_on, w.expiry_date) as expires_on,
  w.audit_note
from public.evidence_gate_waivers w
left join public.profiles requester on requester.id = w.requested_by
left join public.profiles approver on approver.id = w.approved_by;

create or replace view public.v_patch43_mock_survey_finding_register as
select
  t.id as finding_id,
  'accreditation_task'::text as source_type,
  t.clause_id,
  t.clause_code,
  t.clause_title,
  t.framework,
  t.standard_code,
  t.priority,
  t.status,
  t.outcome_notes as finding_summary,
  t.assigned_to_user_id,
  t.assigned_to_name,
  t.assigned_to_department_id,
  t.assigned_department_name,
  t.due_date,
  t.is_overdue,
  t.created_at,
  t.updated_at
from public.v_patch35_clause_owner_task_queue t
where t.status in ('rejected','reopened','escalated')
   or t.is_overdue = true;

create or replace view public.v_patch43_incident_evidence_chain as
select
  bridge_link_id,
  linked_entity_type,
  linked_entity_id,
  evidence_id,
  evidence_status,
  freshness_status,
  owner_user_id,
  owner_name,
  department_id,
  department_name,
  valid_from,
  valid_until,
  updated_at
from public.v_patch33_clause_control_evidence_bridge
where linked_entity_type in ('ovr','incident','rca_case');

create or replace view public.v_patch43_audit_evidence_chain as
select
  bridge_link_id,
  linked_entity_type,
  linked_entity_id,
  evidence_id,
  evidence_status,
  freshness_status,
  owner_user_id,
  owner_name,
  department_id,
  department_name,
  valid_from,
  valid_until,
  updated_at
from public.v_patch33_clause_control_evidence_bridge
where linked_entity_type in ('audit_finding','audit_execution','audit_test_step')
   or bridge_role = 'audit_evidence';

create or replace view public.v_patch43_capa_evidence_chain as
select
  bridge_link_id,
  linked_entity_type,
  linked_entity_id,
  evidence_id,
  evidence_status,
  freshness_status,
  owner_user_id,
  owner_name,
  department_id,
  department_name,
  valid_from,
  valid_until,
  updated_at
from public.v_patch33_clause_control_evidence_bridge
where linked_entity_type = 'capa'
   or bridge_role = 'capa_evidence';

create or replace view public.v_patch43_training_document_evidence_chain as
select
  bridge_link_id,
  linked_entity_type,
  linked_entity_id,
  evidence_id,
  document_id,
  sop_id,
  evidence_status,
  freshness_status,
  owner_user_id,
  owner_name,
  department_id,
  department_name,
  valid_from,
  valid_until,
  updated_at
from public.v_patch33_clause_control_evidence_bridge
where linked_entity_type in ('training_program','training_assignment','document','sop','policy')
   or bridge_role in ('training_evidence','sop_evidence');

create or replace view public.v_patch43_survey_blocker_summary as
select
  'evidence_gate'::text as blocker_type,
  entity_type,
  entity_id,
  gate_status as blocker_status,
  coalesce(gate_status, 'requires_review') as blocker_summary,
  evaluated_at as created_at
from public.v_patch43_evidence_gate_failure_register
union all
select
  'evidence_gap',
  coalesce(linked_entity_type, 'clause'),
  coalesce(linked_entity_id, clause_id),
  evidence_status,
  concat_ws(' ', clause_code, evidence_status, freshness_status),
  updated_at
from public.v_patch43_evidence_gap_register
union all
select
  'workflow_blocker',
  'clause',
  clause_id,
  'blocked',
  concat_ws(' ', clause_code, 'workflow blockers:', workflow_blocker_count::text, 'evidence blockers:', evidence_blocker_count::text),
  now()
from public.v_patch35_clause_blocker_summary
where workflow_blocker_count > 0 or evidence_blocker_count > 0 or open_escalation_count > 0;

create or replace view public.v_patch43_executive_survey_readiness_summary as
select
  (select count(*) from public.v_patch43_clause_readiness_register) as clause_count,
  (select count(*) from public.v_patch43_clause_readiness_register where coalesce(readiness_status,'') in ('ready_for_reviewer_signoff')) as ready_clause_count,
  (select count(*) from public.v_patch43_evidence_gap_register) as evidence_gap_count,
  (select count(*) from public.v_patch43_evidence_gate_failure_register) as gate_failure_count,
  (select count(*) from public.v_patch43_evidence_waiver_register where waiver_status = 'approved' and coalesce(expires_on, current_date + interval '1 day')::date >= current_date) as active_waiver_count,
  (select count(*) from public.v_patch43_survey_blocker_summary) as total_blocker_count,
  (select count(*) from public.v_patch43_mock_survey_finding_register) as mock_survey_finding_count,
  (select avg(evidence_readiness_score) from public.v_patch43_department_readiness_register) as department_readiness_score,
  case
    when (select count(*) from public.v_patch43_evidence_gate_failure_register) > 0 then 'blocked'
    when (select count(*) from public.v_patch43_survey_blocker_summary) > 0 then 'attention_required'
    when (select count(*) from public.v_patch43_evidence_gap_register) > 0 then 'watch'
    else 'on_track'
  end as readiness_signal;

create or replace view public.v_patch43_accreditation_war_room as
select
  s.*,
  round(
    case when coalesce(s.clause_count, 0) = 0 then 0
      else (s.ready_clause_count::numeric / nullif(s.clause_count, 0)::numeric) * 100
    end,
    2
  ) as overall_readiness_score,
  (select max(created_at) from public.accreditation_war_room_snapshots) as latest_snapshot_at
from public.v_patch43_executive_survey_readiness_summary s;

create or replace view public.v_patch43_queue_evidence_gate_overlay as
select
  q.queue_item_id,
  q.source_module,
  q.source_entity_type,
  q.source_entity_id,
  q.title,
  q.status as work_status,
  q.priority,
  q.severity,
  q.due_date,
  q.assigned_to_user_id,
  q.assigned_to_department_id,
  q.is_overdue,
  q.is_escalated,
  q.waiting_for_review,
  q.next_action as queue_next_action,
  ev.gate_status,
  ev.accepted_evidence_count,
  ev.missing_evidence_count,
  ev.rejected_evidence_count,
  ev.expired_evidence_count,
  ev.superseded_evidence_count,
  ev.active_waiver_id,
  ev.evaluated_at,
  case
    when ev.gate_status is null then 'Evaluate evidence gate'
    when ev.gate_status = 'pass' then coalesce(q.next_action, 'Proceed')
    when ev.gate_status = 'waived' then coalesce(q.next_action, 'Proceed with waiver')
    else 'Resolve evidence gate before closure'
  end as evidence_gate_next_action
from public.v_patch42_unified_operations_queue q
left join lateral (
  select *
  from public.evidence_gate_evaluations e
  where e.entity_type = q.source_entity_type
    and e.entity_id = q.source_entity_id
  order by e.evaluated_at desc
  limit 1
) ev on true
where q.status not in ('completed','closed','resolved','cancelled');

alter view if exists public.v_patch43_accreditation_war_room set (security_invoker = true);
alter view if exists public.v_patch43_clause_readiness_register set (security_invoker = true);
alter view if exists public.v_patch43_department_readiness_register set (security_invoker = true);
alter view if exists public.v_patch43_evidence_gap_register set (security_invoker = true);
alter view if exists public.v_patch43_evidence_gate_failure_register set (security_invoker = true);
alter view if exists public.v_patch43_evidence_waiver_register set (security_invoker = true);
alter view if exists public.v_patch43_mock_survey_finding_register set (security_invoker = true);
alter view if exists public.v_patch43_incident_evidence_chain set (security_invoker = true);
alter view if exists public.v_patch43_audit_evidence_chain set (security_invoker = true);
alter view if exists public.v_patch43_capa_evidence_chain set (security_invoker = true);
alter view if exists public.v_patch43_training_document_evidence_chain set (security_invoker = true);
alter view if exists public.v_patch43_survey_blocker_summary set (security_invoker = true);
alter view if exists public.v_patch43_executive_survey_readiness_summary set (security_invoker = true);
alter view if exists public.v_patch43_queue_evidence_gate_overlay set (security_invoker = true);

grant select on public.v_patch43_accreditation_war_room to authenticated;
grant select on public.v_patch43_clause_readiness_register to authenticated;
grant select on public.v_patch43_department_readiness_register to authenticated;
grant select on public.v_patch43_evidence_gap_register to authenticated;
grant select on public.v_patch43_evidence_gate_failure_register to authenticated;
grant select on public.v_patch43_evidence_waiver_register to authenticated;
grant select on public.v_patch43_mock_survey_finding_register to authenticated;
grant select on public.v_patch43_incident_evidence_chain to authenticated;
grant select on public.v_patch43_audit_evidence_chain to authenticated;
grant select on public.v_patch43_capa_evidence_chain to authenticated;
grant select on public.v_patch43_training_document_evidence_chain to authenticated;
grant select on public.v_patch43_survey_blocker_summary to authenticated;
grant select on public.v_patch43_executive_survey_readiness_summary to authenticated;
grant select on public.v_patch43_queue_evidence_gate_overlay to authenticated;

create or replace function public.get_accreditation_war_room()
returns setof public.v_patch43_accreditation_war_room
language sql
security definer
set search_path = public
as $$ select * from public.v_patch43_accreditation_war_room; $$;

create or replace function public.get_evidence_gate_failure_register()
returns setof public.v_patch43_evidence_gate_failure_register
language sql
security definer
set search_path = public
as $$ select * from public.v_patch43_evidence_gate_failure_register; $$;

create or replace function public.get_survey_blocker_summary()
returns setof public.v_patch43_survey_blocker_summary
language sql
security definer
set search_path = public
as $$ select * from public.v_patch43_survey_blocker_summary; $$;

create or replace function public.get_executive_survey_readiness_summary()
returns setof public.v_patch43_executive_survey_readiness_summary
language sql
security definer
set search_path = public
as $$ select * from public.v_patch43_executive_survey_readiness_summary; $$;

revoke all on function public.patch43_service_role_required() from public, anon, authenticated;
revoke all on function public.patch43_actor_organization(uuid) from public, anon, authenticated;
revoke all on function public.patch43_actor_has_authority(uuid) from public, anon, authenticated;
revoke all on function public.record_survey_readiness_event(text, uuid, text, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.evaluate_evidence_gate(text, uuid, uuid) from public, anon, authenticated;
revoke all on function public.evaluate_evidence_gate_for_entity(text, uuid, uuid) from public, anon, authenticated;
revoke all on function public.request_evidence_gate_waiver(text, uuid, text, uuid, date) from public, anon, authenticated;
revoke all on function public.approve_evidence_gate_waiver(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.reject_evidence_gate_waiver(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.revoke_evidence_gate_waiver(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.create_accreditation_war_room_snapshot(text, uuid) from public, anon, authenticated;
revoke all on function public.get_accreditation_war_room() from public, anon, authenticated;
revoke all on function public.get_evidence_gate_failure_register() from public, anon, authenticated;
revoke all on function public.get_survey_blocker_summary() from public, anon, authenticated;
revoke all on function public.get_executive_survey_readiness_summary() from public, anon, authenticated;

grant execute on function public.patch43_service_role_required() to service_role;
grant execute on function public.patch43_actor_organization(uuid) to service_role;
grant execute on function public.patch43_actor_has_authority(uuid) to service_role;
grant execute on function public.record_survey_readiness_event(text, uuid, text, text, uuid, jsonb) to service_role;
grant execute on function public.evaluate_evidence_gate(text, uuid, uuid) to service_role;
grant execute on function public.evaluate_evidence_gate_for_entity(text, uuid, uuid) to service_role;
grant execute on function public.request_evidence_gate_waiver(text, uuid, text, uuid, date) to service_role;
grant execute on function public.approve_evidence_gate_waiver(uuid, uuid, text) to service_role;
grant execute on function public.reject_evidence_gate_waiver(uuid, uuid, text) to service_role;
grant execute on function public.revoke_evidence_gate_waiver(uuid, uuid, text) to service_role;
grant execute on function public.create_accreditation_war_room_snapshot(text, uuid) to service_role;
grant execute on function public.get_accreditation_war_room() to service_role;
grant execute on function public.get_evidence_gate_failure_register() to service_role;
grant execute on function public.get_survey_blocker_summary() to service_role;
grant execute on function public.get_executive_survey_readiness_summary() to service_role;

comment on table public.evidence_gate_rules is 'Patch 43 evidence gate definitions for accreditation, audit, RCA, CAPA, training, and document survey readiness.';
comment on table public.evidence_gate_evaluations is 'Patch 43 evaluated evidence gate status for survey readiness decisions.';
comment on table public.accreditation_war_room_snapshots is 'Patch 43 accreditation war room point-in-time readiness snapshots.';
comment on table public.survey_readiness_events is 'Patch 43 survey readiness event ledger for gate evaluation, waivers, and war room actions.';
