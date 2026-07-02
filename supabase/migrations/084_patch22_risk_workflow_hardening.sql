-- =========================================================
-- Patch 22 - Risk Workflow Hardening
-- Additive hospital-grade risk governance workflow controls.
-- =========================================================

alter table public.risks
  add column if not exists lifecycle_status text not null default 'identified',
  add column if not exists risk_owner_id uuid references public.profiles(id) on delete set null,
  add column if not exists control_owner_id uuid references public.profiles(id) on delete set null,
  add column if not exists treatment_owner_id uuid references public.profiles(id) on delete set null,
  add column if not exists executive_sponsor_id uuid references public.profiles(id) on delete set null,
  add column if not exists inherent_likelihood smallint,
  add column if not exists inherent_impact smallint,
  add column if not exists scoring_method text not null default 'standard_5x5',
  add column if not exists score_last_changed_at timestamptz,
  add column if not exists score_last_changed_by uuid references public.profiles(id) on delete set null,
  add column if not exists appetite_level text not null default 'within_appetite',
  add column if not exists appetite_threshold integer not null default 12,
  add column if not exists appetite_breached boolean not null default false,
  add column if not exists appetite_breach_reason text,
  add column if not exists treatment_required boolean not null default false,
  add column if not exists treatment_status text not null default 'not_required',
  add column if not exists treatment_plan_summary text,
  add column if not exists treatment_due_date date,
  add column if not exists treatment_completed_at timestamptz,
  add column if not exists acceptance_required boolean not null default false,
  add column if not exists acceptance_status text not null default 'not_required',
  add column if not exists acceptance_requested_by uuid references public.profiles(id) on delete set null,
  add column if not exists acceptance_requested_at timestamptz,
  add column if not exists accepted_by uuid references public.profiles(id) on delete set null,
  add column if not exists accepted_at timestamptz,
  add column if not exists acceptance_expiry_date date,
  add column if not exists acceptance_reason text,
  add column if not exists review_overdue boolean not null default false,
  add column if not exists last_reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists closure_requested_at timestamptz,
  add column if not exists closure_requested_by uuid references public.profiles(id) on delete set null,
  add column if not exists closure_approved_by uuid references public.profiles(id) on delete set null,
  add column if not exists closure_approved_at timestamptz,
  add column if not exists closure_reason text,
  add column if not exists closure_evidence_required boolean not null default true,
  add column if not exists closure_blocker text,
  add column if not exists escalation_required boolean not null default false,
  add column if not exists escalation_level text not null default 'none',
  add column if not exists escalated_at timestamptz,
  add column if not exists escalated_to uuid references public.profiles(id) on delete set null,
  add column if not exists executive_visible boolean not null default false,
  add column if not exists executive_visibility_override_reason text,
  add column if not exists duplicate_of_risk_id uuid references public.risks(id) on delete set null,
  add column if not exists related_risk_ids uuid[] not null default '{}',
  add column if not exists repeat_signal_flag boolean not null default false,
  add column if not exists source_ovr_id uuid references public.ovr_reports(id) on delete set null,
  add column if not exists source_audit_finding_id uuid references public.audit_findings(id) on delete set null,
  add column if not exists source_compliance_id uuid references public.compliance_items(id) on delete set null,
  add column if not exists source_project_id uuid references public.projects(id) on delete set null;

update public.risks
set
  risk_owner_id = coalesce(risk_owner_id, owner_id),
  control_owner_id = coalesce(control_owner_id, owner_id),
  treatment_owner_id = coalesce(treatment_owner_id, owner_id),
  inherent_likelihood = coalesce(inherent_likelihood, likelihood),
  inherent_impact = coalesce(inherent_impact, impact),
  score_last_changed_at = coalesce(score_last_changed_at, updated_at, created_at),
  appetite_threshold = coalesce(nullif(appetite_threshold, 0), case when risk_level in ('critical','high') then 12 else 16 end),
  appetite_breached = coalesce(appetite_breached, false) or residual_score >= coalesce(nullif(appetite_threshold, 0), 12),
  appetite_level = case
    when residual_score >= 20 then 'critical_breach'
    when residual_score >= coalesce(nullif(appetite_threshold, 0), 12) then 'above_appetite'
    else coalesce(nullif(appetite_level, ''), 'within_appetite')
  end,
  treatment_required = coalesce(treatment_required, false) or (residual_score >= 12 and acceptance_status <> 'approved'),
  treatment_status = case
    when coalesce(treatment_status, 'not_required') = 'not_required' and residual_score >= 12 and acceptance_status <> 'approved' then 'required'
    else coalesce(nullif(treatment_status, ''), 'not_required')
  end,
  acceptance_required = coalesce(acceptance_required, false) or response_type = 'accept' or residual_score >= coalesce(nullif(appetite_threshold, 0), 12),
  acceptance_status = case
    when response_type = 'accept' and coalesce(acceptance_status, 'not_required') = 'not_required' then 'requested'
    when residual_score >= coalesce(nullif(appetite_threshold, 0), 12) and coalesce(acceptance_status, 'not_required') = 'not_required' then 'required'
    else coalesce(nullif(acceptance_status, ''), 'not_required')
  end,
  review_overdue = next_review_date is not null and next_review_date < current_date and status not in ('closed','cancelled'),
  escalation_required = coalesce(escalation_required, false) or risk_level in ('critical','high') or residual_score >= 12,
  escalation_level = case
    when risk_level = 'critical' or residual_score >= 20 then 'executive'
    when risk_level = 'high' or residual_score >= 12 then 'management'
    else coalesce(nullif(escalation_level, ''), 'none')
  end,
  executive_visible = coalesce(executive_visible, false) or risk_level = 'critical' or residual_score >= 20
where true;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'risks_patch22_lifecycle_chk') then
    alter table public.risks add constraint risks_patch22_lifecycle_chk
      check (lifecycle_status in ('identified','assessed','treatment_required','treatment_in_progress','acceptance_requested','accepted','monitoring','closure_requested','closed','reopened','cancelled'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'risks_patch22_inherent_likelihood_chk') then
    alter table public.risks add constraint risks_patch22_inherent_likelihood_chk
      check (inherent_likelihood is null or inherent_likelihood between 1 and 5);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'risks_patch22_inherent_impact_chk') then
    alter table public.risks add constraint risks_patch22_inherent_impact_chk
      check (inherent_impact is null or inherent_impact between 1 and 5);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'risks_patch22_appetite_threshold_chk') then
    alter table public.risks add constraint risks_patch22_appetite_threshold_chk
      check (appetite_threshold between 1 and 25);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'risks_patch22_treatment_status_chk') then
    alter table public.risks add constraint risks_patch22_treatment_status_chk
      check (treatment_status in ('not_required','required','planned','in_progress','completed','overdue','accepted'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'risks_patch22_acceptance_status_chk') then
    alter table public.risks add constraint risks_patch22_acceptance_status_chk
      check (acceptance_status in ('not_required','required','requested','approved','rejected','expired','withdrawn'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'risks_patch22_escalation_level_chk') then
    alter table public.risks add constraint risks_patch22_escalation_level_chk
      check (escalation_level in ('none','management','division','executive','board'));
  end if;
end $$;

create table if not exists public.risk_kri_indicators (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  risk_id uuid not null references public.risks(id) on delete cascade,
  kri_code text,
  name_en text not null,
  name_ar text,
  current_value numeric,
  threshold_warning numeric,
  threshold_critical numeric,
  direction text not null default 'higher_is_worse',
  status text not null default 'normal',
  measured_at timestamptz not null default now(),
  owner_id uuid references public.profiles(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, risk_id, kri_code)
);

create table if not exists public.risk_reassessment_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  risk_id uuid not null references public.risks(id) on delete cascade,
  previous_likelihood smallint,
  previous_impact smallint,
  previous_score integer,
  new_likelihood smallint,
  new_impact smallint,
  new_score integer,
  previous_residual_likelihood smallint,
  previous_residual_impact smallint,
  previous_residual_score integer,
  new_residual_likelihood smallint,
  new_residual_impact smallint,
  new_residual_score integer,
  change_reason text,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);

create table if not exists public.risk_workflow_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  risk_id uuid not null references public.risks(id) on delete cascade,
  from_status text,
  to_status text,
  action text not null,
  note text,
  actor_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.risk_kri_indicators enable row level security;
alter table public.risk_reassessment_history enable row level security;
alter table public.risk_workflow_events enable row level security;

drop policy if exists risk_kri_indicators_read on public.risk_kri_indicators;
create policy risk_kri_indicators_read on public.risk_kri_indicators
for select using (
  owner_id = auth.uid()
  or public.can_access_org(organization_id)
  or public.can_manage_grc()
);

drop policy if exists risk_kri_indicators_write on public.risk_kri_indicators;
create policy risk_kri_indicators_write on public.risk_kri_indicators
for all using (owner_id = auth.uid() or public.can_manage_grc())
with check (owner_id = auth.uid() or public.can_manage_grc());

drop policy if exists risk_reassessment_history_read on public.risk_reassessment_history;
create policy risk_reassessment_history_read on public.risk_reassessment_history
for select using (public.can_access_org(organization_id) or public.can_manage_grc());

drop policy if exists risk_reassessment_history_write on public.risk_reassessment_history;
create policy risk_reassessment_history_write on public.risk_reassessment_history
for insert with check (public.can_manage_grc());

drop policy if exists risk_workflow_events_read on public.risk_workflow_events;
create policy risk_workflow_events_read on public.risk_workflow_events
for select using (public.can_access_org(organization_id) or public.can_manage_grc());

drop policy if exists risk_workflow_events_write on public.risk_workflow_events;
create policy risk_workflow_events_write on public.risk_workflow_events
for insert with check (public.can_manage_grc());

create index if not exists idx_patch22_risks_org on public.risks(organization_id);
create index if not exists idx_patch22_risks_risk_owner on public.risks(risk_owner_id);
create index if not exists idx_patch22_risks_control_owner on public.risks(control_owner_id);
create index if not exists idx_patch22_risks_treatment_owner on public.risks(treatment_owner_id);
create index if not exists idx_patch22_risks_risk_level on public.risks(risk_level);
create index if not exists idx_patch22_risks_residual_score on public.risks(residual_score);
create index if not exists idx_patch22_risks_appetite_breached on public.risks(organization_id, appetite_breached);
create index if not exists idx_patch22_risks_treatment_required on public.risks(organization_id, treatment_required);
create index if not exists idx_patch22_risks_treatment_due on public.risks(organization_id, treatment_due_date);
create index if not exists idx_patch22_risks_next_review on public.risks(organization_id, next_review_date);
create index if not exists idx_patch22_risks_acceptance_status on public.risks(organization_id, acceptance_status);
create index if not exists idx_patch22_risks_escalation on public.risks(organization_id, escalation_required, escalation_level);
create index if not exists idx_patch22_risks_duplicate on public.risks(duplicate_of_risk_id);
create index if not exists idx_patch22_kri_risk on public.risk_kri_indicators(risk_id, status, is_active);
create index if not exists idx_patch22_kri_org_status on public.risk_kri_indicators(organization_id, status, measured_at desc);
create index if not exists idx_patch22_reassessment_risk on public.risk_reassessment_history(risk_id, changed_at desc);
create index if not exists idx_patch22_events_risk on public.risk_workflow_events(risk_id, created_at desc);
create index if not exists idx_patch22_events_org on public.risk_workflow_events(organization_id, action, created_at desc);

drop trigger if exists trg_risk_kri_indicators_updated_at on public.risk_kri_indicators;
create trigger trg_risk_kri_indicators_updated_at
before update on public.risk_kri_indicators
for each row execute function public.set_updated_at();

create or replace view public.v_patch22_risk_workflow_queue as
select
  r.organization_id,
  r.id as risk_id,
  r.risk_code,
  r.title,
  r.risk_level,
  r.status::text as status,
  r.lifecycle_status,
  r.residual_score,
  r.appetite_breached,
  r.treatment_required,
  r.treatment_status,
  r.treatment_due_date,
  r.acceptance_required,
  r.acceptance_status,
  r.next_review_date,
  r.review_overdue,
  r.closure_requested_at,
  r.escalation_required,
  r.escalation_level,
  r.executive_visible,
  d.name_en as department_name,
  coalesce(ro.full_name_en, legacy_owner.full_name_en) as risk_owner_name,
  tr.full_name_en as treatment_owner_name,
  case
    when r.closure_requested_at is not null and r.closure_approved_at is null then 'closure_approval'
    when r.escalation_required then 'escalation'
    when r.appetite_breached and r.acceptance_status not in ('approved') then 'appetite_acceptance'
    when r.treatment_required and r.treatment_status not in ('completed','accepted') then 'treatment'
    when r.next_review_date is not null and r.next_review_date < current_date then 'review_overdue'
    else 'monitoring'
  end as queue_reason,
  coalesce(r.treatment_due_date, r.next_review_date, r.acceptance_expiry_date) as due_date,
  (
    (r.treatment_due_date is not null and r.treatment_due_date < current_date and r.treatment_status not in ('completed','accepted'))
    or (r.next_review_date is not null and r.next_review_date < current_date and r.status not in ('closed','cancelled'))
    or (r.acceptance_expiry_date is not null and r.acceptance_expiry_date <= current_date + interval '14 days')
  ) as is_overdue
from public.risks r
left join public.departments d on d.id = r.department_id
left join public.profiles ro on ro.id = r.risk_owner_id
left join public.profiles legacy_owner on legacy_owner.id = r.owner_id
left join public.profiles tr on tr.id = r.treatment_owner_id
where r.status not in ('closed','cancelled')
  and (
    r.escalation_required
    or r.appetite_breached
    or (r.treatment_required and r.treatment_status not in ('completed','accepted'))
    or (r.acceptance_required and r.acceptance_status not in ('approved','not_required'))
    or (r.next_review_date is not null and r.next_review_date < current_date)
    or (r.closure_requested_at is not null and r.closure_approved_at is null)
  );

create or replace view public.v_patch22_risk_appetite_breaches as
select
  r.organization_id,
  r.id as risk_id,
  r.risk_code,
  r.title,
  r.risk_level,
  r.residual_score,
  r.appetite_level,
  r.appetite_threshold,
  r.appetite_breached,
  r.appetite_breach_reason,
  r.acceptance_status,
  r.acceptance_expiry_date,
  d.name_en as department_name,
  coalesce(ro.full_name_en, legacy_owner.full_name_en) as risk_owner_name
from public.risks r
left join public.departments d on d.id = r.department_id
left join public.profiles ro on ro.id = r.risk_owner_id
left join public.profiles legacy_owner on legacy_owner.id = r.owner_id
where r.appetite_breached = true
  and r.status not in ('closed','cancelled');

create or replace view public.v_patch22_risk_treatment_queue as
select
  r.organization_id,
  r.id as risk_id,
  r.risk_code,
  r.title,
  r.risk_level,
  r.residual_score,
  r.treatment_required,
  r.treatment_status,
  r.treatment_plan_summary,
  r.treatment_due_date,
  r.treatment_owner_id,
  tr.full_name_en as treatment_owner_name,
  (r.treatment_due_date is not null and r.treatment_due_date < current_date and r.treatment_status not in ('completed','accepted')) as treatment_overdue
from public.risks r
left join public.profiles tr on tr.id = r.treatment_owner_id
where r.treatment_required = true
  and r.status not in ('closed','cancelled');

create or replace view public.v_patch22_risk_kri_alerts as
select
  k.organization_id,
  k.id as kri_id,
  k.risk_id,
  r.risk_code,
  r.title as risk_title,
  k.kri_code,
  k.name_en,
  k.name_ar,
  k.current_value,
  k.threshold_warning,
  k.threshold_critical,
  k.direction,
  k.status,
  k.measured_at,
  k.owner_id,
  p.full_name_en as owner_name,
  r.risk_level,
  r.residual_score
from public.risk_kri_indicators k
join public.risks r on r.id = k.risk_id
left join public.profiles p on p.id = k.owner_id
where k.is_active = true
  and k.status in ('warning','critical');

create or replace view public.v_patch22_executive_risk_escalations as
select
  r.organization_id,
  r.id as risk_id,
  r.risk_code,
  r.title,
  r.risk_level,
  r.residual_score,
  r.escalation_required,
  r.escalation_level,
  r.escalated_at,
  r.executive_visible,
  r.appetite_breached,
  r.treatment_status,
  r.acceptance_status,
  r.next_review_date,
  d.name_en as department_name,
  coalesce(sponsor.full_name_en, ro.full_name_en, legacy_owner.full_name_en) as executive_owner_name
from public.risks r
left join public.departments d on d.id = r.department_id
left join public.profiles sponsor on sponsor.id = r.executive_sponsor_id
left join public.profiles ro on ro.id = r.risk_owner_id
left join public.profiles legacy_owner on legacy_owner.id = r.owner_id
where r.status not in ('closed','cancelled')
  and (
    r.executive_visible
    or r.escalation_level in ('executive','board')
    or r.risk_level = 'critical'
    or r.residual_score >= 20
  );

create or replace view public.v_patch22_risk_closure_blockers as
select
  r.organization_id,
  r.id as risk_id,
  r.risk_code,
  r.title,
  r.risk_level,
  r.status::text as status,
  r.closure_requested_at,
  r.closure_reason,
  r.closure_evidence_required,
  case
    when r.treatment_required and r.treatment_status not in ('completed','accepted') then 'Treatment is required and not complete.'
    when r.acceptance_required and r.acceptance_status <> 'approved' then 'Acceptance is required and not approved.'
    when r.closure_evidence_required and not exists (
      select 1 from public.evidence_files e
      where e.risk_id = r.id and e.status = 'accepted'
    ) then 'Accepted closure evidence is required.'
    when exists (
      select 1 from public.risk_kri_indicators k
      where k.risk_id = r.id and k.is_active = true and k.status = 'critical'
    ) then 'A critical KRI alert is still active.'
    when r.next_review_date is not null and r.next_review_date < current_date and r.last_reviewed_at is null then 'Review is overdue without a documented review.'
    else null
  end as blocker_reason
from public.risks r
where r.status not in ('closed','cancelled')
  and (
    r.closure_requested_at is not null
    or r.treatment_required
    or r.acceptance_required
    or r.closure_evidence_required
    or exists (
      select 1 from public.risk_kri_indicators k
      where k.risk_id = r.id and k.is_active = true and k.status = 'critical'
    )
  );

alter view public.v_patch22_risk_workflow_queue set (security_invoker = true);
alter view public.v_patch22_risk_appetite_breaches set (security_invoker = true);
alter view public.v_patch22_risk_treatment_queue set (security_invoker = true);
alter view public.v_patch22_risk_kri_alerts set (security_invoker = true);
alter view public.v_patch22_executive_risk_escalations set (security_invoker = true);
alter view public.v_patch22_risk_closure_blockers set (security_invoker = true);

grant select on public.v_patch22_risk_workflow_queue to authenticated;
grant select on public.v_patch22_risk_appetite_breaches to authenticated;
grant select on public.v_patch22_risk_treatment_queue to authenticated;
grant select on public.v_patch22_risk_kri_alerts to authenticated;
grant select on public.v_patch22_executive_risk_escalations to authenticated;
grant select on public.v_patch22_risk_closure_blockers to authenticated;
grant select, insert, update on public.risk_kri_indicators to authenticated;
grant select on public.risk_reassessment_history to authenticated;
grant select on public.risk_workflow_events to authenticated;

create or replace function public.patch22_write_risk_event(
  p_organization_id uuid,
  p_risk_id uuid,
  p_from_status text,
  p_to_status text,
  p_action text,
  p_note text,
  p_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.risk_workflow_events (
    organization_id, risk_id, from_status, to_status, action, note, actor_id
  )
  values (
    p_organization_id, p_risk_id, p_from_status, p_to_status, p_action, nullif(trim(coalesce(p_note, '')), ''), p_actor_id
  );

  insert into public.audit_logs (
    organization_id, actor_id, action, table_name, record_id, old_data, new_data
  )
  values (
    p_organization_id,
    p_actor_id,
    'patch22_' || p_action,
    'risks',
    p_risk_id,
    jsonb_build_object('from_status', p_from_status),
    jsonb_build_object('to_status', p_to_status, 'note', p_note)
  );
end;
$$;

create or replace function public.patch22_risk_level_from_score(p_score integer)
returns public.risk_level
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when coalesce(p_score, 0) >= 20 then 'critical'::public.risk_level
    when coalesce(p_score, 0) >= 12 then 'high'::public.risk_level
    when coalesce(p_score, 0) >= 6 then 'medium'::public.risk_level
    else 'low'::public.risk_level
  end;
$$;

create or replace function public.patch22_risk_workflow_bridge(
  p_actor_id uuid,
  p_action text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_jwt_role text := coalesce(current_setting('request.jwt.claim.role', true), current_user);
  v_actor public.profiles%rowtype;
  v_risk public.risks%rowtype;
  v_action text := lower(coalesce(p_action, ''));
  v_risk_id uuid := nullif(p_payload->>'risk_id', '')::uuid;
  v_can_manage boolean := false;
  v_is_owner boolean := false;
  v_old_status text;
  v_new_status text;
  v_reason text := nullif(trim(coalesce(p_payload->>'reason', p_payload->>'note', p_payload->>'change_reason', '')), '');
  v_likelihood smallint;
  v_impact smallint;
  v_residual_likelihood smallint;
  v_residual_impact smallint;
  v_residual_score integer;
  v_appetite_threshold integer;
  v_blocker text;
begin
  if v_jwt_role <> 'service_role' and current_user <> 'service_role' then
    raise exception 'PATCH22_RISK_SERVICE_ROLE_REQUIRED';
  end if;

  select * into v_actor
  from public.profiles
  where id = p_actor_id and is_active = true;

  if not found or v_actor.organization_id is null then
    raise exception 'PATCH22_RISK_ACTIVE_ACTOR_REQUIRED';
  end if;

  if v_action not in (
    'update_risk_assessment',
    'request_risk_acceptance',
    'approve_risk_acceptance',
    'reject_risk_acceptance',
    'update_risk_treatment',
    'complete_risk_treatment',
    'request_risk_closure',
    'approve_risk_closure',
    'reopen_risk_with_reason',
    'link_risk_source',
    'mark_duplicate_risk'
  ) then
    raise exception 'PATCH22_RISK_UNSUPPORTED_ACTION';
  end if;

  if v_risk_id is null then
    raise exception 'PATCH22_RISK_ID_REQUIRED';
  end if;

  select * into v_risk
  from public.risks
  where id = v_risk_id
  for update;

  if not found then
    raise exception 'PATCH22_RISK_NOT_FOUND';
  end if;

  if v_actor.organization_id is distinct from v_risk.organization_id then
    raise exception 'PATCH22_RISK_CROSS_ORGANIZATION_DENIED';
  end if;

  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p_actor_id
      and ur.is_active = true
      and ur.role::text in ('super_admin','executive','governance_admin','division_head','department_manager','compliance_officer','auditor')
      and (ur.organization_id is null or ur.organization_id is not distinct from v_risk.organization_id)
  ) into v_can_manage;

  v_is_owner := p_actor_id in (
    v_risk.owner_id,
    v_risk.risk_owner_id,
    v_risk.control_owner_id,
    v_risk.treatment_owner_id,
    v_risk.executive_sponsor_id
  );

  if not (v_can_manage or v_is_owner) then
    raise exception 'PATCH22_RISK_NOT_AUTHORIZED';
  end if;

  v_old_status := v_risk.status::text;

  if v_action = 'update_risk_assessment' then
    v_likelihood := coalesce(nullif(p_payload->>'inherent_likelihood', '')::smallint, nullif(p_payload->>'likelihood', '')::smallint, v_risk.likelihood);
    v_impact := coalesce(nullif(p_payload->>'inherent_impact', '')::smallint, nullif(p_payload->>'impact', '')::smallint, v_risk.impact);
    v_residual_likelihood := coalesce(nullif(p_payload->>'residual_likelihood', '')::smallint, v_risk.residual_likelihood);
    v_residual_impact := coalesce(nullif(p_payload->>'residual_impact', '')::smallint, v_risk.residual_impact);
    v_residual_score := v_residual_likelihood * v_residual_impact;
    v_appetite_threshold := coalesce(nullif(p_payload->>'appetite_threshold', '')::integer, v_risk.appetite_threshold, 12);

    if v_likelihood not between 1 and 5 or v_impact not between 1 and 5 or v_residual_likelihood not between 1 and 5 or v_residual_impact not between 1 and 5 then
      raise exception 'PATCH22_RISK_SCORE_RANGE_REQUIRED';
    end if;
    if v_reason is null then
      raise exception 'PATCH22_RISK_SCORE_CHANGE_REASON_REQUIRED';
    end if;

    insert into public.risk_reassessment_history (
      organization_id,
      risk_id,
      previous_likelihood,
      previous_impact,
      previous_score,
      new_likelihood,
      new_impact,
      new_score,
      previous_residual_likelihood,
      previous_residual_impact,
      previous_residual_score,
      new_residual_likelihood,
      new_residual_impact,
      new_residual_score,
      change_reason,
      changed_by
    )
    values (
      v_risk.organization_id,
      v_risk.id,
      v_risk.likelihood,
      v_risk.impact,
      v_risk.inherent_score,
      v_likelihood,
      v_impact,
      v_likelihood * v_impact,
      v_risk.residual_likelihood,
      v_risk.residual_impact,
      v_risk.residual_score,
      v_residual_likelihood,
      v_residual_impact,
      v_residual_score,
      v_reason,
      p_actor_id
    );

    update public.risks
    set
      likelihood = v_likelihood,
      impact = v_impact,
      inherent_likelihood = v_likelihood,
      inherent_impact = v_impact,
      residual_likelihood = v_residual_likelihood,
      residual_impact = v_residual_impact,
      risk_level = public.patch22_risk_level_from_score(v_residual_score),
      scoring_method = coalesce(nullif(p_payload->>'scoring_method', ''), scoring_method, 'standard_5x5'),
      score_last_changed_at = now(),
      score_last_changed_by = p_actor_id,
      appetite_threshold = v_appetite_threshold,
      appetite_breached = v_residual_score >= v_appetite_threshold,
      appetite_level = case
        when v_residual_score >= 20 then 'critical_breach'
        when v_residual_score >= v_appetite_threshold then 'above_appetite'
        else 'within_appetite'
      end,
      appetite_breach_reason = case
        when v_residual_score >= v_appetite_threshold then coalesce(nullif(p_payload->>'appetite_breach_reason', ''), v_reason)
        else null
      end,
      treatment_required = (v_residual_score >= 12 and acceptance_status <> 'approved'),
      treatment_status = case
        when v_residual_score >= 12 and treatment_status in ('not_required','completed','accepted') and acceptance_status <> 'approved' then 'required'
        else treatment_status
      end,
      acceptance_required = v_residual_score >= v_appetite_threshold or response_type = 'accept',
      acceptance_status = case
        when v_residual_score >= v_appetite_threshold and acceptance_status in ('not_required','withdrawn') then 'required'
        else acceptance_status
      end,
      escalation_required = v_residual_score >= 12 or risk_level in ('critical','high'),
      escalation_level = case
        when v_residual_score >= 20 then 'executive'
        when v_residual_score >= 12 then 'management'
        else escalation_level
      end,
      executive_visible = case
        when v_residual_score >= 20 then true
        when v_residual_score >= 12 and nullif(trim(coalesce(executive_visibility_override_reason, '')), '') is null then true
        else executive_visible
      end,
      lifecycle_status = case
        when v_residual_score >= 12 then 'treatment_required'
        else 'assessed'
      end,
      updated_by = p_actor_id
    where id = v_risk.id;

    perform public.patch22_write_risk_event(v_risk.organization_id, v_risk.id, v_old_status, v_old_status, 'update_risk_assessment', v_reason, p_actor_id);

  elsif v_action = 'request_risk_acceptance' then
    if v_reason is null then
      raise exception 'PATCH22_RISK_ACCEPTANCE_REASON_REQUIRED';
    end if;
    if nullif(p_payload->>'acceptance_expiry_date', '') is null then
      raise exception 'PATCH22_RISK_ACCEPTANCE_EXPIRY_REQUIRED';
    end if;

    update public.risks
    set
      acceptance_required = true,
      acceptance_status = 'requested',
      acceptance_requested_by = p_actor_id,
      acceptance_requested_at = now(),
      acceptance_expiry_date = (p_payload->>'acceptance_expiry_date')::date,
      acceptance_reason = v_reason,
      lifecycle_status = 'acceptance_requested',
      updated_by = p_actor_id
    where id = v_risk.id;

    perform public.patch22_write_risk_event(v_risk.organization_id, v_risk.id, v_old_status, 'acceptance_requested', 'request_risk_acceptance', v_reason, p_actor_id);

  elsif v_action in ('approve_risk_acceptance','reject_risk_acceptance') then
    if not v_can_manage then
      raise exception 'PATCH22_RISK_ACCEPTANCE_APPROVER_REQUIRED';
    end if;
    if v_action = 'approve_risk_acceptance' and (v_risk.acceptance_reason is null or v_risk.acceptance_expiry_date is null) then
      raise exception 'PATCH22_RISK_ACCEPTANCE_REASON_AND_EXPIRY_REQUIRED';
    end if;
    v_new_status := case when v_action = 'approve_risk_acceptance' then 'accepted' else 'under_review' end;

    update public.risks
    set
      status = case when v_action = 'approve_risk_acceptance' then 'accepted'::public.risk_status else 'under_review'::public.risk_status end,
      acceptance_status = case when v_action = 'approve_risk_acceptance' then 'approved' else 'rejected' end,
      accepted_by = case when v_action = 'approve_risk_acceptance' then p_actor_id else accepted_by end,
      accepted_at = case when v_action = 'approve_risk_acceptance' then now() else accepted_at end,
      treatment_required = case when v_action = 'approve_risk_acceptance' then false else treatment_required end,
      treatment_status = case when v_action = 'approve_risk_acceptance' then 'accepted' else treatment_status end,
      lifecycle_status = case when v_action = 'approve_risk_acceptance' then 'accepted' else 'assessed' end,
      next_review_date = case
        when v_action = 'approve_risk_acceptance' then least(coalesce(acceptance_expiry_date, current_date + 90), current_date + 90)
        else next_review_date
      end,
      updated_by = p_actor_id
    where id = v_risk.id;

    perform public.patch22_write_risk_event(v_risk.organization_id, v_risk.id, v_old_status, v_new_status, v_action, v_reason, p_actor_id);

  elsif v_action = 'update_risk_treatment' then
    update public.risks
    set
      treatment_required = true,
      treatment_status = coalesce(nullif(p_payload->>'treatment_status', ''), 'planned'),
      treatment_plan_summary = coalesce(nullif(p_payload->>'treatment_plan_summary', ''), treatment_plan_summary),
      treatment_due_date = coalesce(nullif(p_payload->>'treatment_due_date', '')::date, treatment_due_date),
      treatment_owner_id = coalesce(nullif(p_payload->>'treatment_owner_id', '')::uuid, treatment_owner_id, p_actor_id),
      lifecycle_status = 'treatment_in_progress',
      updated_by = p_actor_id
    where id = v_risk.id;

    perform public.patch22_write_risk_event(v_risk.organization_id, v_risk.id, v_old_status, v_old_status, 'update_risk_treatment', v_reason, p_actor_id);

  elsif v_action = 'complete_risk_treatment' then
    update public.risks
    set
      treatment_status = 'completed',
      treatment_completed_at = now(),
      lifecycle_status = 'monitoring',
      updated_by = p_actor_id
    where id = v_risk.id;

    perform public.patch22_write_risk_event(v_risk.organization_id, v_risk.id, v_old_status, v_old_status, 'complete_risk_treatment', coalesce(v_reason, 'Treatment completed.'), p_actor_id);

  elsif v_action = 'request_risk_closure' then
    if v_reason is null then
      raise exception 'PATCH22_RISK_CLOSURE_REASON_REQUIRED';
    end if;

    update public.risks
    set
      closure_requested_at = now(),
      closure_requested_by = p_actor_id,
      closure_reason = v_reason,
      lifecycle_status = 'closure_requested',
      updated_by = p_actor_id
    where id = v_risk.id;

    perform public.patch22_write_risk_event(v_risk.organization_id, v_risk.id, v_old_status, 'closure_requested', 'request_risk_closure', v_reason, p_actor_id);

  elsif v_action = 'approve_risk_closure' then
    if not v_can_manage then
      raise exception 'PATCH22_RISK_CLOSURE_APPROVER_REQUIRED';
    end if;

    select blocker_reason into v_blocker
    from public.v_patch22_risk_closure_blockers
    where risk_id = v_risk.id
    limit 1;

    if v_blocker is not null then
      update public.risks set closure_blocker = v_blocker where id = v_risk.id;
      raise exception 'PATCH22_RISK_CLOSURE_BLOCKED: %', v_blocker;
    end if;

    update public.risks
    set
      status = 'closed'::public.risk_status,
      lifecycle_status = 'closed',
      closure_approved_by = p_actor_id,
      closure_approved_at = now(),
      closed_by = p_actor_id,
      closed_at = now(),
      closure_blocker = null,
      updated_by = p_actor_id
    where id = v_risk.id;

    perform public.patch22_write_risk_event(v_risk.organization_id, v_risk.id, v_old_status, 'closed', 'approve_risk_closure', v_reason, p_actor_id);

  elsif v_action = 'reopen_risk_with_reason' then
    if v_reason is null then
      raise exception 'PATCH22_RISK_REOPEN_REASON_REQUIRED';
    end if;

    update public.risks
    set
      status = 'open'::public.risk_status,
      lifecycle_status = 'reopened',
      closure_requested_at = null,
      closure_approved_by = null,
      closure_approved_at = null,
      closed_by = null,
      closed_at = null,
      closure_blocker = null,
      updated_by = p_actor_id
    where id = v_risk.id;

    perform public.patch22_write_risk_event(v_risk.organization_id, v_risk.id, v_old_status, 'open', 'reopen_risk_with_reason', v_reason, p_actor_id);

  elsif v_action = 'link_risk_source' then
    update public.risks
    set
      source_ovr_id = coalesce(nullif(p_payload->>'source_ovr_id', '')::uuid, source_ovr_id),
      source_audit_finding_id = coalesce(nullif(p_payload->>'source_audit_finding_id', '')::uuid, source_audit_finding_id),
      source_compliance_id = coalesce(nullif(p_payload->>'source_compliance_id', '')::uuid, source_compliance_id),
      source_project_id = coalesce(nullif(p_payload->>'source_project_id', '')::uuid, source_project_id),
      updated_by = p_actor_id
    where id = v_risk.id;

    perform public.patch22_write_risk_event(v_risk.organization_id, v_risk.id, v_old_status, v_old_status, 'link_risk_source', v_reason, p_actor_id);

  elsif v_action = 'mark_duplicate_risk' then
    if nullif(p_payload->>'duplicate_of_risk_id', '') is null then
      raise exception 'PATCH22_DUPLICATE_RISK_ID_REQUIRED';
    end if;

    update public.risks
    set
      duplicate_of_risk_id = (p_payload->>'duplicate_of_risk_id')::uuid,
      repeat_signal_flag = true,
      related_risk_ids = array_append(coalesce(related_risk_ids, '{}'), (p_payload->>'duplicate_of_risk_id')::uuid),
      updated_by = p_actor_id
    where id = v_risk.id;

    perform public.patch22_write_risk_event(v_risk.organization_id, v_risk.id, v_old_status, v_old_status, 'mark_duplicate_risk', v_reason, p_actor_id);
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'action', v_action,
    'risk_id', v_risk.id
  );
end;
$$;

revoke all on function public.patch22_write_risk_event(uuid, uuid, text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.patch22_write_risk_event(uuid, uuid, text, text, text, text, uuid) to service_role;

revoke all on function public.patch22_risk_workflow_bridge(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.patch22_risk_workflow_bridge(uuid, text, jsonb) to service_role;

grant execute on function public.patch22_risk_level_from_score(integer) to authenticated, service_role;

comment on table public.risk_kri_indicators is 'Patch 22: KRI early-warning indicators linked to risk records.';
comment on table public.risk_reassessment_history is 'Patch 22: immutable reassessment history for likelihood, impact, inherent and residual score changes.';
comment on table public.risk_workflow_events is 'Patch 22: workflow/audit event trail for risk governance actions.';
comment on function public.patch22_risk_workflow_bridge(uuid, text, jsonb) is 'Patch 22 service-role bridge for governed risk workflow actions. Browser code must call through the authenticated Edge bridge, not service-role credentials.';
