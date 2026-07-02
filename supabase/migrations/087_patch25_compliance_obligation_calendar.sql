-- =========================================================
-- Patch 25: Compliance Obligation & Regulatory Calendar Hardening
-- Additive lifecycle, renewal calendar, evidence-backed closure and escalation controls.
-- =========================================================

alter table public.compliance_items
  add column if not exists obligation_code text,
  add column if not exists obligation_title text,
  add column if not exists obligation_description text,
  add column if not exists obligation_type text,
  add column if not exists regulatory_source text,
  add column if not exists regulator_name text,
  add column if not exists standard_reference text,
  add column if not exists clause_reference text,
  add column if not exists obligation_owner_id uuid references public.profiles(id) on delete set null,
  add column if not exists reviewer_id uuid references public.profiles(id) on delete set null,
  add column if not exists executive_sponsor_id uuid references public.profiles(id) on delete set null,
  add column if not exists criticality_level text not null default 'medium',
  add column if not exists obligation_status text not null default 'active',
  add column if not exists workflow_stage text not null default 'active',
  add column if not exists effective_date date,
  add column if not exists renewal_required boolean not null default false,
  add column if not exists renewal_frequency text,
  add column if not exists renewal_due_date date,
  add column if not exists renewal_started_at timestamptz,
  add column if not exists renewal_completed_at timestamptz,
  add column if not exists next_review_date date,
  add column if not exists last_reviewed_at timestamptz,
  add column if not exists review_frequency text,
  add column if not exists minimum_accepted_evidence_count integer not null default 1,
  add column if not exists evidence_gate_status text not null default 'pending',
  add column if not exists closure_requested_at timestamptz,
  add column if not exists closure_requested_by uuid references public.profiles(id) on delete set null,
  add column if not exists closure_approved_at timestamptz,
  add column if not exists closure_approved_by uuid references public.profiles(id) on delete set null,
  add column if not exists closure_rejection_reason text,
  add column if not exists closure_blocker text,
  add column if not exists overdue_flag boolean not null default false,
  add column if not exists overdue_days integer not null default 0,
  add column if not exists escalation_required boolean not null default false,
  add column if not exists escalation_level text,
  add column if not exists escalated_at timestamptz,
  add column if not exists escalated_to uuid references public.profiles(id) on delete set null,
  add column if not exists escalation_reason text,
  add column if not exists executive_visible boolean not null default false,
  add column if not exists reopened_at timestamptz,
  add column if not exists reopened_by uuid references public.profiles(id) on delete set null,
  add column if not exists reopen_reason text;

update public.compliance_items
set
  obligation_code = coalesce(obligation_code, compliance_code),
  obligation_title = coalesce(obligation_title, title),
  obligation_description = coalesce(obligation_description, description),
  obligation_type = coalesce(obligation_type, requirement_type, 'regulatory_obligation'),
  regulator_name = coalesce(regulator_name, regulatory_body),
  obligation_owner_id = coalesce(obligation_owner_id, owner_id),
  obligation_status = case
    when status::text = 'closed' then 'closed'
    when status::text = 'cancelled' then 'cancelled'
    when status::text = 'expired' then 'overdue'
    when status::text = 'due_soon' then 'due_soon'
    when status::text = 'pending_evidence' then 'evidence_required'
    when status::text = 'pending_approval' then 'submitted_for_review'
    when status::text = 'compliant' then 'accepted'
    when status::text = 'non_compliant' then 'rejected'
    else coalesce(nullif(obligation_status, ''), 'active')
  end,
  workflow_stage = case
    when status::text = 'closed' then 'closed'
    when status::text = 'cancelled' then 'cancelled'
    when coalesce(renewal_required, false) and renewal_due_date is not null and renewal_due_date <= current_date + 30 then 'renewal'
    when coalesce(evidence_required, false) then 'evidence'
    else coalesce(nullif(workflow_stage, ''), 'active')
  end,
  criticality_level = coalesce(nullif(criticality_level, ''), risk_level::text, 'medium'),
  renewal_due_date = coalesce(renewal_due_date, expiry_date, next_due_date),
  next_review_date = coalesce(next_review_date, next_due_date),
  overdue_flag = (
    coalesce(expiry_date, due_date, renewal_due_date) is not null
    and coalesce(expiry_date, due_date, renewal_due_date) < current_date
    and status::text not in ('closed','cancelled')
  ),
  overdue_days = greatest(coalesce(current_date - coalesce(expiry_date, due_date, renewal_due_date), 0), 0),
  escalation_required = escalation_required or (
    coalesce(expiry_date, due_date, renewal_due_date) is not null
    and coalesce(expiry_date, due_date, renewal_due_date) < current_date
    and risk_level in ('high','critical')
  ),
  executive_visible = executive_visible or (
    coalesce(expiry_date, due_date, renewal_due_date) is not null
    and coalesce(expiry_date, due_date, renewal_due_date) < current_date
    and risk_level in ('high','critical')
  )
where true;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'compliance_items_patch25_obligation_status_chk') then
    alter table public.compliance_items add constraint compliance_items_patch25_obligation_status_chk
      check (obligation_status in ('draft','active','due_soon','renewal_in_progress','evidence_required','submitted_for_review','accepted','rejected','overdue','escalated','closed','cancelled','reopened'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'compliance_items_patch25_workflow_stage_chk') then
    alter table public.compliance_items add constraint compliance_items_patch25_workflow_stage_chk
      check (workflow_stage in ('draft','active','renewal','evidence','review','accepted','rejected','escalation','closure_review','closed','cancelled','reopened'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'compliance_items_patch25_criticality_chk') then
    alter table public.compliance_items add constraint compliance_items_patch25_criticality_chk
      check (criticality_level in ('low','medium','high','critical'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'compliance_items_patch25_evidence_gate_chk') then
    alter table public.compliance_items add constraint compliance_items_patch25_evidence_gate_chk
      check (evidence_gate_status in ('not_required','pending','partially_satisfied','satisfied','overdue','waived','blocked'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'compliance_items_patch25_min_evidence_chk') then
    alter table public.compliance_items add constraint compliance_items_patch25_min_evidence_chk
      check (minimum_accepted_evidence_count >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'compliance_items_patch25_overdue_days_chk') then
    alter table public.compliance_items add constraint compliance_items_patch25_overdue_days_chk
      check (overdue_days >= 0);
  end if;
end $$;

create table if not exists public.compliance_regulatory_calendar (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  obligation_id uuid not null references public.compliance_items(id) on delete cascade,
  event_type text not null check (event_type in ('license_expiry','certificate_expiry','regulatory_submission','policy_review','accreditation_requirement','contract_compliance','inspection_due','renewal_due','evidence_review','board_reporting')),
  event_title text not null,
  event_description text,
  due_date date not null,
  reminder_start_date date,
  reminder_frequency text,
  owner_id uuid references public.profiles(id) on delete set null,
  reviewer_id uuid references public.profiles(id) on delete set null,
  status text not null default 'scheduled' check (status in ('scheduled','in_progress','completed','overdue','cancelled','escalated')),
  completed_at timestamptz,
  completed_by uuid references public.profiles(id) on delete set null,
  evidence_required boolean not null default false,
  escalation_required boolean not null default false,
  escalated_at timestamptz,
  escalation_level text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ux_patch25_calendar_obligation_event_due
on public.compliance_regulatory_calendar(organization_id, obligation_id, event_type, due_date);

create table if not exists public.compliance_obligation_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  obligation_id uuid not null references public.compliance_items(id) on delete cascade,
  event_type text not null check (event_type in ('created','activated','review_started','evidence_requested','submitted_for_review','accepted','rejected','renewal_started','renewal_completed','escalated','closure_requested','closure_approved','closure_rejected','reopened','cancelled','calendar_event_completed','calendar_events_generated')),
  from_status text,
  to_status text,
  actor_id uuid references public.profiles(id) on delete set null,
  event_note text,
  rejection_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_patch25_compliance_org on public.compliance_items(organization_id);
create index if not exists idx_patch25_compliance_status on public.compliance_items(obligation_status);
create index if not exists idx_patch25_compliance_stage on public.compliance_items(workflow_stage);
create index if not exists idx_patch25_compliance_department on public.compliance_items(department_id);
create index if not exists idx_patch25_compliance_owner on public.compliance_items(obligation_owner_id);
create index if not exists idx_patch25_compliance_reviewer on public.compliance_items(reviewer_id);
create index if not exists idx_patch25_compliance_expiry on public.compliance_items(expiry_date);
create index if not exists idx_patch25_compliance_renewal_due on public.compliance_items(renewal_due_date);
create index if not exists idx_patch25_compliance_next_review on public.compliance_items(next_review_date);
create index if not exists idx_patch25_compliance_evidence_gate on public.compliance_items(evidence_gate_status);
create index if not exists idx_patch25_compliance_overdue on public.compliance_items(overdue_flag);
create index if not exists idx_patch25_compliance_escalation on public.compliance_items(escalation_required);
create index if not exists idx_patch25_compliance_executive on public.compliance_items(executive_visible);
create index if not exists idx_patch25_calendar_org_due on public.compliance_regulatory_calendar(organization_id, due_date);
create index if not exists idx_patch25_calendar_obligation on public.compliance_regulatory_calendar(obligation_id);
create index if not exists idx_patch25_calendar_status on public.compliance_regulatory_calendar(status);
create index if not exists idx_patch25_events_obligation on public.compliance_obligation_events(obligation_id);
create index if not exists idx_patch25_events_type on public.compliance_obligation_events(event_type);

alter table public.compliance_regulatory_calendar enable row level security;
alter table public.compliance_obligation_events enable row level security;

drop policy if exists compliance_regulatory_calendar_read_patch25 on public.compliance_regulatory_calendar;
create policy compliance_regulatory_calendar_read_patch25 on public.compliance_regulatory_calendar
for select to authenticated
using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists compliance_regulatory_calendar_write_patch25 on public.compliance_regulatory_calendar;
create policy compliance_regulatory_calendar_write_patch25 on public.compliance_regulatory_calendar
for insert to authenticated
with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists compliance_regulatory_calendar_update_patch25 on public.compliance_regulatory_calendar;
create policy compliance_regulatory_calendar_update_patch25 on public.compliance_regulatory_calendar
for update to authenticated
using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'))
with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists compliance_obligation_events_read_patch25 on public.compliance_obligation_events;
create policy compliance_obligation_events_read_patch25 on public.compliance_obligation_events
for select to authenticated
using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists compliance_obligation_events_insert_patch25 on public.compliance_obligation_events;
create policy compliance_obligation_events_insert_patch25 on public.compliance_obligation_events
for insert to authenticated
with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

create or replace function public.patch25_compliance_accepted_evidence_count(p_obligation_id uuid)
returns integer
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_count integer := 0;
begin
  if to_regclass('public.evidence_links') is not null then
    execute $q$
      select count(distinct ef.id)::integer
      from public.evidence_files ef
      left join public.evidence_links el on el.evidence_file_id = ef.id and el.is_active = true
      where (
          ef.compliance_item_id = $1
          or (el.linked_item_type in ('compliance','compliance_item','compliance_obligation') and el.linked_item_id = $1)
        )
        and coalesce(ef.review_status::text, ef.status::text) = 'accepted'
        and coalesce(ef.is_current_version, true) = true
        and (ef.expiry_date is null or ef.expiry_date >= current_date)
    $q$ into v_count using p_obligation_id;
  else
    select count(*)::integer into v_count
    from public.evidence_files ef
    where ef.compliance_item_id = p_obligation_id
      and ef.status::text = 'accepted';
  end if;
  return coalesce(v_count, 0);
end;
$$;

create or replace function public.patch25_compliance_active_waiver_count(p_obligation_id uuid)
returns integer
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_count integer := 0;
begin
  if to_regclass('public.evidence_requirements') is not null and to_regclass('public.evidence_gate_waivers') is not null then
    execute $q$
      select count(distinct egw.id)::integer
      from public.evidence_requirements er
      join public.evidence_gate_waivers egw on egw.requirement_id = er.id
      where er.linked_item_type in ('compliance','compliance_item','compliance_obligation')
        and er.linked_item_id = $1
        and er.is_active = true
        and egw.status = 'approved'
        and (egw.expiry_date is null or egw.expiry_date >= current_date)
    $q$ into v_count using p_obligation_id;
  end if;
  return coalesce(v_count, 0);
end;
$$;

create or replace function public.patch25_compliance_closure_satisfied(p_obligation_id uuid)
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce((
    select
      case
        when coalesce(c.evidence_required, false) = false then true
        when public.patch25_compliance_accepted_evidence_count(c.id) >= coalesce(c.minimum_accepted_evidence_count, 1) then true
        when public.patch25_compliance_active_waiver_count(c.id) > 0 then true
        else false
      end
    from public.compliance_items c
    where c.id = p_obligation_id
    limit 1
  ), false);
$$;

create or replace view public.v_patch25_compliance_closure_blockers as
select
  c.organization_id,
  c.id as obligation_id,
  coalesce(c.obligation_code, c.compliance_code) as obligation_code,
  coalesce(c.obligation_title, c.title) as obligation_title,
  c.obligation_status,
  c.workflow_stage,
  c.evidence_required,
  c.minimum_accepted_evidence_count,
  public.patch25_compliance_accepted_evidence_count(c.id) as accepted_evidence_count,
  public.patch25_compliance_active_waiver_count(c.id) as approved_waiver_count,
  case
    when coalesce(c.evidence_required, false) = false then 'not_required'
    when public.patch25_compliance_accepted_evidence_count(c.id) >= coalesce(c.minimum_accepted_evidence_count, 1) then 'satisfied'
    when public.patch25_compliance_active_waiver_count(c.id) > 0 then 'waived'
    when coalesce(c.expiry_date, c.renewal_due_date, c.due_date) < current_date then 'overdue'
    when public.patch25_compliance_accepted_evidence_count(c.id) > 0 then 'partially_satisfied'
    else 'pending'
  end as evidence_gate_status,
  public.patch25_compliance_closure_satisfied(c.id) as can_close,
  case
    when c.obligation_status in ('closed','cancelled') then null
    when coalesce(c.evidence_required, false) = true and not public.patch25_compliance_closure_satisfied(c.id) then 'accepted_evidence_or_approved_waiver_required'
    when c.overdue_flag and c.closure_requested_at is null then 'overdue_obligation_requires_review'
    when c.escalation_required and c.executive_visible = false then 'executive_visibility_required'
    else null
  end as blocker_reason,
  c.closure_requested_at,
  c.closure_blocker
from public.compliance_items c
where c.obligation_status not in ('closed','cancelled');

create or replace view public.v_patch25_compliance_obligation_queue as
select
  c.organization_id,
  c.id as obligation_id,
  coalesce(c.obligation_code, c.compliance_code) as obligation_code,
  coalesce(c.obligation_title, c.title) as obligation_title,
  c.obligation_type,
  coalesce(c.regulator_name, c.regulatory_body) as regulator_name,
  c.department_id,
  d.name_en as department_name,
  c.obligation_owner_id,
  owner.full_name_en as owner_name,
  c.reviewer_id,
  reviewer.full_name_en as reviewer_name,
  c.risk_level,
  c.criticality_level,
  c.obligation_status,
  c.workflow_stage,
  c.expiry_date,
  c.renewal_required,
  c.renewal_due_date,
  c.next_review_date,
  c.evidence_required,
  b.evidence_gate_status,
  b.accepted_evidence_count,
  b.minimum_accepted_evidence_count,
  b.can_close,
  b.blocker_reason,
  c.overdue_flag,
  c.overdue_days,
  c.escalation_required,
  c.executive_visible,
  case
    when c.escalation_required then 'escalation'
    when c.overdue_flag then 'overdue'
    when c.renewal_required and c.renewal_due_date is not null and c.renewal_due_date <= current_date + 30 then 'renewal'
    when c.expiry_date is not null and c.expiry_date <= current_date + 30 then 'due_soon'
    when c.evidence_required and not b.can_close then 'evidence'
    when c.closure_requested_at is not null and c.closure_approved_at is null then 'closure_review'
    else 'monitoring'
  end as queue_reason
from public.compliance_items c
left join public.departments d on d.id = c.department_id
left join public.profiles owner on owner.id = coalesce(c.obligation_owner_id, c.owner_id)
left join public.profiles reviewer on reviewer.id = c.reviewer_id
left join public.v_patch25_compliance_closure_blockers b on b.obligation_id = c.id
where c.obligation_status not in ('closed','cancelled')
  and (
    c.escalation_required
    or c.overdue_flag
    or (c.expiry_date is not null and c.expiry_date <= current_date + 30)
    or (c.renewal_required and c.renewal_due_date is not null and c.renewal_due_date <= current_date + 30)
    or (c.evidence_required and not b.can_close)
    or (c.closure_requested_at is not null and c.closure_approved_at is null)
  );

create or replace view public.v_patch25_regulatory_calendar as
select
  cal.organization_id,
  cal.id as calendar_event_id,
  cal.obligation_id,
  coalesce(c.obligation_code, c.compliance_code) as obligation_code,
  coalesce(c.obligation_title, c.title) as obligation_title,
  cal.event_type,
  cal.event_title,
  cal.event_description,
  cal.due_date,
  cal.reminder_start_date,
  cal.reminder_frequency,
  cal.owner_id,
  owner.full_name_en as owner_name,
  cal.reviewer_id,
  reviewer.full_name_en as reviewer_name,
  cal.status,
  cal.completed_at,
  cal.completed_by,
  cal.evidence_required,
  cal.escalation_required,
  cal.escalated_at,
  cal.escalation_level,
  cal.notes,
  c.risk_level,
  c.criticality_level,
  c.department_id,
  d.name_en as department_name
from public.compliance_regulatory_calendar cal
join public.compliance_items c on c.id = cal.obligation_id
left join public.profiles owner on owner.id = cal.owner_id
left join public.profiles reviewer on reviewer.id = cal.reviewer_id
left join public.departments d on d.id = c.department_id;

create or replace view public.v_patch25_due_soon_obligations as
select *
from public.v_patch25_compliance_obligation_queue
where queue_reason in ('due_soon','renewal')
   or (coalesce(expiry_date, renewal_due_date, next_review_date) between current_date and current_date + 30);

create or replace view public.v_patch25_overdue_obligations as
select *
from public.v_patch25_compliance_obligation_queue
where overdue_flag = true
   or coalesce(expiry_date, renewal_due_date, next_review_date) < current_date;

create or replace view public.v_patch25_renewal_queue as
select *
from public.v_patch25_compliance_obligation_queue
where renewal_required = true
  and obligation_status not in ('closed','cancelled')
  and (
    renewal_due_date is null
    or renewal_due_date <= current_date + 60
    or obligation_status = 'renewal_in_progress'
  );

create or replace view public.v_patch25_compliance_evidence_gap_dashboard as
select
  organization_id,
  obligation_id,
  obligation_code,
  obligation_title,
  obligation_status,
  workflow_stage,
  evidence_required,
  minimum_accepted_evidence_count,
  accepted_evidence_count,
  approved_waiver_count,
  evidence_gate_status,
  blocker_reason,
  can_close
from public.v_patch25_compliance_closure_blockers
where evidence_required = true
  and can_close = false;

create or replace view public.v_patch25_executive_compliance_escalations as
select
  c.organization_id,
  c.id as obligation_id,
  coalesce(c.obligation_code, c.compliance_code) as obligation_code,
  coalesce(c.obligation_title, c.title) as obligation_title,
  c.obligation_status,
  c.risk_level,
  c.criticality_level,
  c.escalation_required,
  c.escalation_level,
  c.escalated_at,
  c.escalated_to,
  escalated.full_name_en as escalated_to_name,
  c.escalation_reason,
  c.executive_visible,
  c.overdue_flag,
  c.overdue_days,
  c.expiry_date,
  c.renewal_due_date,
  d.name_en as department_name,
  case
    when c.overdue_flag and c.risk_level in ('high','critical') then 'high_risk_overdue'
    when c.criticality_level = 'critical' then 'critical_obligation'
    when c.renewal_required and c.renewal_due_date < current_date then 'renewal_overdue'
    else 'executive_visible'
  end as escalation_reason_code
from public.compliance_items c
left join public.profiles escalated on escalated.id = c.escalated_to
left join public.departments d on d.id = c.department_id
where c.escalation_required
   or c.executive_visible
   or c.risk_level in ('high','critical')
   or c.criticality_level in ('high','critical')
   or c.overdue_flag;

alter view public.v_patch25_compliance_obligation_queue set (security_invoker = true);
alter view public.v_patch25_regulatory_calendar set (security_invoker = true);
alter view public.v_patch25_due_soon_obligations set (security_invoker = true);
alter view public.v_patch25_overdue_obligations set (security_invoker = true);
alter view public.v_patch25_renewal_queue set (security_invoker = true);
alter view public.v_patch25_compliance_evidence_gap_dashboard set (security_invoker = true);
alter view public.v_patch25_executive_compliance_escalations set (security_invoker = true);
alter view public.v_patch25_compliance_closure_blockers set (security_invoker = true);

grant select on public.v_patch25_compliance_obligation_queue to authenticated;
grant select on public.v_patch25_regulatory_calendar to authenticated;
grant select on public.v_patch25_due_soon_obligations to authenticated;
grant select on public.v_patch25_overdue_obligations to authenticated;
grant select on public.v_patch25_renewal_queue to authenticated;
grant select on public.v_patch25_compliance_evidence_gap_dashboard to authenticated;
grant select on public.v_patch25_executive_compliance_escalations to authenticated;
grant select on public.v_patch25_compliance_closure_blockers to authenticated;

create or replace function public.patch25_write_compliance_event(
  p_organization_id uuid,
  p_obligation_id uuid,
  p_event_type text,
  p_from_status text,
  p_to_status text,
  p_actor_id uuid,
  p_event_note text default null,
  p_rejection_reason text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then
    raise exception 'PATCH25_COMPLIANCE_EVENT_SERVICE_ROLE_REQUIRED';
  end if;

  insert into public.compliance_obligation_events (
    organization_id,
    obligation_id,
    event_type,
    from_status,
    to_status,
    actor_id,
    event_note,
    rejection_reason,
    metadata
  )
  values (
    p_organization_id,
    p_obligation_id,
    p_event_type,
    p_from_status,
    p_to_status,
    p_actor_id,
    p_event_note,
    p_rejection_reason,
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

create or replace function public.patch25_generate_calendar_events(
  p_obligation_id uuid,
  p_actor_id uuid,
  p_note text default null
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_obligation public.compliance_items%rowtype;
  v_count integer := 0;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then
    raise exception 'PATCH25_CALENDAR_SERVICE_ROLE_REQUIRED';
  end if;

  select * into v_obligation
  from public.compliance_items
  where id = p_obligation_id;

  if not found then
    raise exception 'PATCH25_OBLIGATION_NOT_FOUND';
  end if;

  if v_obligation.expiry_date is not null then
    insert into public.compliance_regulatory_calendar (
      organization_id, obligation_id, event_type, event_title, event_description, due_date,
      reminder_start_date, reminder_frequency, owner_id, reviewer_id, status, evidence_required
    )
    values (
      v_obligation.organization_id,
      v_obligation.id,
      case when coalesce(v_obligation.obligation_type, '') ilike '%certificate%' then 'certificate_expiry' else 'license_expiry' end,
      coalesce(v_obligation.obligation_title, v_obligation.title) || ' expiry',
      'Auto-generated Patch 25 expiry calendar event.',
      v_obligation.expiry_date,
      v_obligation.expiry_date - coalesce(v_obligation.reminder_days_before, 30),
      coalesce(v_obligation.review_frequency, 'monthly'),
      coalesce(v_obligation.obligation_owner_id, v_obligation.owner_id),
      v_obligation.reviewer_id,
      case when v_obligation.expiry_date < current_date then 'overdue' else 'scheduled' end,
      coalesce(v_obligation.evidence_required, false)
    )
    on conflict do nothing;
    get diagnostics v_count = row_count;
  end if;

  if v_obligation.renewal_required and v_obligation.renewal_due_date is not null then
    insert into public.compliance_regulatory_calendar (
      organization_id, obligation_id, event_type, event_title, event_description, due_date,
      reminder_start_date, reminder_frequency, owner_id, reviewer_id, status, evidence_required
    )
    values (
      v_obligation.organization_id,
      v_obligation.id,
      'renewal_due',
      coalesce(v_obligation.obligation_title, v_obligation.title) || ' renewal',
      'Auto-generated Patch 25 renewal calendar event.',
      v_obligation.renewal_due_date,
      v_obligation.renewal_due_date - coalesce(v_obligation.reminder_days_before, 30),
      coalesce(v_obligation.renewal_frequency, 'annual'),
      coalesce(v_obligation.obligation_owner_id, v_obligation.owner_id),
      v_obligation.reviewer_id,
      case when v_obligation.renewal_due_date < current_date then 'overdue' else 'scheduled' end,
      coalesce(v_obligation.evidence_required, false)
    )
    on conflict do nothing;
    get diagnostics v_count = v_count + row_count;
  end if;

  if v_obligation.next_review_date is not null then
    insert into public.compliance_regulatory_calendar (
      organization_id, obligation_id, event_type, event_title, event_description, due_date,
      reminder_start_date, reminder_frequency, owner_id, reviewer_id, status, evidence_required
    )
    values (
      v_obligation.organization_id,
      v_obligation.id,
      'policy_review',
      coalesce(v_obligation.obligation_title, v_obligation.title) || ' review',
      'Auto-generated Patch 25 review calendar event.',
      v_obligation.next_review_date,
      v_obligation.next_review_date - 14,
      coalesce(v_obligation.review_frequency, 'annual'),
      coalesce(v_obligation.obligation_owner_id, v_obligation.owner_id),
      v_obligation.reviewer_id,
      case when v_obligation.next_review_date < current_date then 'overdue' else 'scheduled' end,
      false
    )
    on conflict do nothing;
    get diagnostics v_count = v_count + row_count;
  end if;

  perform public.patch25_write_compliance_event(
    v_obligation.organization_id,
    v_obligation.id,
    'calendar_events_generated',
    v_obligation.obligation_status,
    v_obligation.obligation_status,
    p_actor_id,
    coalesce(p_note, 'Calendar events generated.'),
    null,
    jsonb_build_object('generated_count', v_count)
  );

  return v_count;
end;
$$;

create or replace function public.patch25_compliance_obligation_bridge(
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
  v_obligation public.compliance_items%rowtype;
  v_action text := lower(coalesce(p_action, ''));
  v_obligation_id uuid := coalesce(nullif(p_payload->>'obligation_id', '')::uuid, nullif(p_payload->>'compliance_item_id', '')::uuid);
  v_calendar_event_id uuid := nullif(p_payload->>'calendar_event_id', '')::uuid;
  v_can_manage boolean := false;
  v_is_owner boolean := false;
  v_old_status text;
  v_new_status text;
  v_note text := nullif(trim(coalesce(p_payload->>'note', p_payload->>'reason', '')), '');
  v_reason text := nullif(trim(coalesce(p_payload->>'reason', p_payload->>'rejection_reason', p_payload->>'escalation_reason', p_payload->>'reopen_reason', p_payload->>'note', '')), '');
  v_blocker text;
  v_generated_count integer := 0;
begin
  if v_jwt_role <> 'service_role' and current_user <> 'service_role' then
    raise exception 'PATCH25_COMPLIANCE_SERVICE_ROLE_REQUIRED';
  end if;

  select * into v_actor
  from public.profiles
  where id = p_actor_id and is_active = true;

  if not found or v_actor.organization_id is null then
    raise exception 'PATCH25_COMPLIANCE_ACTIVE_ACTOR_REQUIRED';
  end if;

  if v_action = 'complete_regulatory_calendar_event' and v_obligation_id is null and v_calendar_event_id is not null then
    select obligation_id into v_obligation_id
    from public.compliance_regulatory_calendar
    where id = v_calendar_event_id;
  end if;

  if v_obligation_id is null then
    raise exception 'PATCH25_COMPLIANCE_OBLIGATION_ID_REQUIRED';
  end if;

  select * into v_obligation
  from public.compliance_items
  where id = v_obligation_id
  for update;

  if not found then
    raise exception 'PATCH25_COMPLIANCE_OBLIGATION_NOT_FOUND';
  end if;

  if v_actor.organization_id is distinct from v_obligation.organization_id then
    raise exception 'PATCH25_COMPLIANCE_CROSS_ORGANIZATION_DENIED';
  end if;

  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p_actor_id
      and ur.is_active = true
      and ur.role::text in ('super_admin','executive','governance_admin','division_head','department_manager','compliance_officer','auditor')
      and (ur.organization_id is null or ur.organization_id is not distinct from v_obligation.organization_id)
  ) into v_can_manage;

  v_is_owner := p_actor_id in (
    v_obligation.owner_id,
    v_obligation.obligation_owner_id,
    v_obligation.reviewer_id,
    v_obligation.executive_sponsor_id,
    v_obligation.escalation_owner_id,
    v_obligation.escalated_to
  );

  if not (v_can_manage or v_is_owner) then
    raise exception 'PATCH25_COMPLIANCE_NOT_AUTHORIZED';
  end if;

  if v_action not in (
    'activate_compliance_obligation',
    'start_compliance_renewal',
    'submit_compliance_for_review',
    'accept_compliance_obligation',
    'reject_compliance_obligation',
    'request_compliance_closure',
    'approve_compliance_closure',
    'reject_compliance_closure',
    'reopen_compliance_obligation_with_reason',
    'escalate_compliance_obligation',
    'complete_regulatory_calendar_event',
    'generate_compliance_calendar_events'
  ) then
    raise exception 'PATCH25_COMPLIANCE_UNSUPPORTED_ACTION';
  end if;

  v_old_status := v_obligation.obligation_status;

  if v_action = 'activate_compliance_obligation' then
    update public.compliance_items
    set
      status = 'in_progress'::public.compliance_status,
      obligation_status = 'active',
      workflow_stage = 'active',
      obligation_owner_id = coalesce(nullif(p_payload->>'obligation_owner_id', '')::uuid, obligation_owner_id, owner_id),
      reviewer_id = coalesce(nullif(p_payload->>'reviewer_id', '')::uuid, reviewer_id),
      executive_sponsor_id = coalesce(nullif(p_payload->>'executive_sponsor_id', '')::uuid, executive_sponsor_id),
      criticality_level = coalesce(nullif(p_payload->>'criticality_level', ''), criticality_level, risk_level::text),
      next_review_date = coalesce(nullif(p_payload->>'next_review_date', '')::date, next_review_date),
      last_reviewed_at = now(),
      updated_by = p_actor_id
    where id = v_obligation.id;

    perform public.patch25_write_compliance_event(v_obligation.organization_id, v_obligation.id, 'activated', v_old_status, 'active', p_actor_id, coalesce(v_note, 'Obligation activated.'), null, p_payload);

  elsif v_action = 'start_compliance_renewal' then
    update public.compliance_items
    set
      status = 'in_progress'::public.compliance_status,
      obligation_status = 'renewal_in_progress',
      workflow_stage = 'renewal',
      renewal_required = true,
      renewal_started_at = now(),
      renewal_due_date = coalesce(nullif(p_payload->>'renewal_due_date', '')::date, renewal_due_date, expiry_date),
      updated_by = p_actor_id
    where id = v_obligation.id;

    perform public.patch25_write_compliance_event(v_obligation.organization_id, v_obligation.id, 'renewal_started', v_old_status, 'renewal_in_progress', p_actor_id, v_note, null, p_payload);

  elsif v_action = 'submit_compliance_for_review' then
    update public.compliance_items
    set
      status = 'pending_approval'::public.compliance_status,
      obligation_status = 'submitted_for_review',
      workflow_stage = 'review',
      last_submitted_at = now(),
      updated_by = p_actor_id
    where id = v_obligation.id;

    perform public.patch25_write_compliance_event(v_obligation.organization_id, v_obligation.id, 'submitted_for_review', v_old_status, 'submitted_for_review', p_actor_id, coalesce(v_note, 'Submitted for compliance review.'), null, p_payload);

  elsif v_action = 'accept_compliance_obligation' then
    if not v_can_manage then
      raise exception 'PATCH25_COMPLIANCE_REVIEWER_REQUIRED';
    end if;

    update public.compliance_items
    set
      status = 'compliant'::public.compliance_status,
      obligation_status = 'accepted',
      workflow_stage = 'accepted',
      last_reviewed_at = now(),
      reviewer_id = coalesce(reviewer_id, p_actor_id),
      renewal_completed_at = case when obligation_status = 'renewal_in_progress' then now() else renewal_completed_at end,
      evidence_gate_status = case when public.patch25_compliance_closure_satisfied(id) then 'satisfied' else evidence_gate_status end,
      updated_by = p_actor_id
    where id = v_obligation.id;

    perform public.patch25_write_compliance_event(v_obligation.organization_id, v_obligation.id, 'accepted', v_old_status, 'accepted', p_actor_id, v_note, null, p_payload);

  elsif v_action = 'reject_compliance_obligation' then
    if v_reason is null then
      raise exception 'PATCH25_COMPLIANCE_REJECTION_REASON_REQUIRED';
    end if;

    update public.compliance_items
    set
      status = 'non_compliant'::public.compliance_status,
      obligation_status = 'rejected',
      workflow_stage = 'rejected',
      closure_rejection_reason = v_reason,
      updated_by = p_actor_id
    where id = v_obligation.id;

    perform public.patch25_write_compliance_event(v_obligation.organization_id, v_obligation.id, 'rejected', v_old_status, 'rejected', p_actor_id, v_note, v_reason, p_payload);

  elsif v_action = 'request_compliance_closure' then
    update public.compliance_items
    set
      status = 'pending_approval'::public.compliance_status,
      obligation_status = 'submitted_for_review',
      workflow_stage = 'closure_review',
      closure_requested_at = now(),
      closure_requested_by = p_actor_id,
      updated_by = p_actor_id
    where id = v_obligation.id;

    perform public.patch25_write_compliance_event(v_obligation.organization_id, v_obligation.id, 'closure_requested', v_old_status, 'submitted_for_review', p_actor_id, coalesce(v_note, 'Closure requested.'), null, p_payload);

  elsif v_action = 'approve_compliance_closure' then
    if not v_can_manage then
      raise exception 'PATCH25_COMPLIANCE_CLOSURE_APPROVER_REQUIRED';
    end if;

    select blocker_reason into v_blocker
    from public.v_patch25_compliance_closure_blockers
    where obligation_id = v_obligation.id
      and blocker_reason is not null
    limit 1;

    if v_blocker is not null then
      update public.compliance_items
      set closure_blocker = v_blocker,
          evidence_gate_status = case when evidence_required then 'blocked' else evidence_gate_status end
      where id = v_obligation.id;
      raise exception 'PATCH25_COMPLIANCE_CLOSURE_BLOCKED: %', v_blocker;
    end if;

    update public.compliance_items
    set
      status = 'closed'::public.compliance_status,
      obligation_status = 'closed',
      workflow_stage = 'closed',
      closure_approved_at = now(),
      closure_approved_by = p_actor_id,
      closed_at = now(),
      closed_by = p_actor_id,
      closure_blocker = null,
      evidence_gate_status = case when evidence_required then 'satisfied' else 'not_required' end,
      updated_by = p_actor_id
    where id = v_obligation.id;

    perform public.patch25_write_compliance_event(v_obligation.organization_id, v_obligation.id, 'closure_approved', v_old_status, 'closed', p_actor_id, v_note, null, p_payload);

  elsif v_action = 'reject_compliance_closure' then
    if v_reason is null then
      raise exception 'PATCH25_COMPLIANCE_CLOSURE_REJECTION_REASON_REQUIRED';
    end if;

    update public.compliance_items
    set
      status = 'non_compliant'::public.compliance_status,
      obligation_status = 'rejected',
      workflow_stage = 'rejected',
      closure_rejection_reason = v_reason,
      closure_blocker = v_reason,
      updated_by = p_actor_id
    where id = v_obligation.id;

    perform public.patch25_write_compliance_event(v_obligation.organization_id, v_obligation.id, 'closure_rejected', v_old_status, 'rejected', p_actor_id, v_note, v_reason, p_payload);

  elsif v_action = 'reopen_compliance_obligation_with_reason' then
    if v_reason is null then
      raise exception 'PATCH25_COMPLIANCE_REOPEN_REASON_REQUIRED';
    end if;

    update public.compliance_items
    set
      status = 'in_progress'::public.compliance_status,
      obligation_status = 'reopened',
      workflow_stage = 'reopened',
      reopened_at = now(),
      reopened_by = p_actor_id,
      reopen_reason = v_reason,
      closed_at = null,
      closed_by = null,
      closure_approved_at = null,
      closure_approved_by = null,
      updated_by = p_actor_id
    where id = v_obligation.id;

    perform public.patch25_write_compliance_event(v_obligation.organization_id, v_obligation.id, 'reopened', v_old_status, 'reopened', p_actor_id, v_note, v_reason, p_payload);

  elsif v_action = 'escalate_compliance_obligation' then
    if v_reason is null then
      raise exception 'PATCH25_COMPLIANCE_ESCALATION_REASON_REQUIRED';
    end if;

    update public.compliance_items
    set
      status = case when status::text = 'closed' then status else 'non_compliant'::public.compliance_status end,
      obligation_status = 'escalated',
      workflow_stage = 'escalation',
      escalation_required = true,
      escalation_level = coalesce(nullif(p_payload->>'escalation_level', ''), case when criticality_level = 'critical' or risk_level = 'critical' then 'executive' else 'management' end),
      escalated_at = now(),
      escalated_to = coalesce(nullif(p_payload->>'escalated_to', '')::uuid, executive_sponsor_id, escalation_owner_id),
      escalation_reason = v_reason,
      executive_visible = true,
      updated_by = p_actor_id
    where id = v_obligation.id;

    perform public.patch25_write_compliance_event(v_obligation.organization_id, v_obligation.id, 'escalated', v_old_status, 'escalated', p_actor_id, v_note, v_reason, p_payload);

  elsif v_action = 'complete_regulatory_calendar_event' then
    if v_calendar_event_id is null then
      raise exception 'PATCH25_CALENDAR_EVENT_ID_REQUIRED';
    end if;

    update public.compliance_regulatory_calendar
    set status = 'completed',
        completed_at = now(),
        completed_by = p_actor_id,
        notes = coalesce(nullif(p_payload->>'notes', ''), notes),
        updated_at = now()
    where id = v_calendar_event_id
      and obligation_id = v_obligation.id;

    perform public.patch25_write_compliance_event(v_obligation.organization_id, v_obligation.id, 'calendar_event_completed', v_old_status, v_old_status, p_actor_id, coalesce(v_note, 'Calendar event completed.'), null, p_payload);

  elsif v_action = 'generate_compliance_calendar_events' then
    v_generated_count := public.patch25_generate_calendar_events(v_obligation.id, p_actor_id, v_note);
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'action', v_action,
    'obligation_id', v_obligation.id,
    'generated_calendar_event_count', v_generated_count
  );
end;
$$;

revoke all on function public.patch25_compliance_accepted_evidence_count(uuid) from public, anon;
grant execute on function public.patch25_compliance_accepted_evidence_count(uuid) to authenticated, service_role;

revoke all on function public.patch25_compliance_active_waiver_count(uuid) from public, anon;
grant execute on function public.patch25_compliance_active_waiver_count(uuid) to authenticated, service_role;

revoke all on function public.patch25_compliance_closure_satisfied(uuid) from public, anon;
grant execute on function public.patch25_compliance_closure_satisfied(uuid) to authenticated, service_role;

revoke all on function public.patch25_write_compliance_event(uuid, uuid, text, text, text, uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.patch25_write_compliance_event(uuid, uuid, text, text, text, uuid, text, text, jsonb) to service_role;

revoke all on function public.patch25_generate_calendar_events(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.patch25_generate_calendar_events(uuid, uuid, text) to service_role;

revoke all on function public.patch25_compliance_obligation_bridge(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.patch25_compliance_obligation_bridge(uuid, text, jsonb) to service_role;

comment on function public.patch25_compliance_obligation_bridge(uuid, text, jsonb) is 'Patch 25 service-role compliance obligation workflow bridge. Browser code must call through authenticated Edge privileged-action bridge.';
comment on table public.compliance_regulatory_calendar is 'Patch 25 governed regulatory calendar for obligation, license, certificate, renewal, inspection, review and reporting events.';
comment on table public.compliance_obligation_events is 'Patch 25 append-only compliance obligation lifecycle event log.';
