-- =========================================================
-- Patch 28: CAPA / Action Plan Execution Hardening
-- Professional CAPA execution foundation with action items,
-- due-date governance, validation, effectiveness review,
-- closure blockers, links, and audit events.
-- =========================================================

create table if not exists public.capa_action_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  capa_code text unique,
  capa_title text not null,
  capa_description text,
  capa_type text not null check (capa_type in ('correction','corrective_action','preventive_action','improvement_action','containment_action','effectiveness_action')),
  source_type text not null check (source_type in ('ovr','risk','audit_finding','compliance_obligation','evidence_gap','document_control','inspection','management_review','customer_complaint','internal_issue','other')),
  source_id uuid,
  source_reference text,
  department_id uuid references public.departments(id) on delete set null,
  capa_owner_id uuid references public.profiles(id) on delete set null,
  action_owner_id uuid references public.profiles(id) on delete set null,
  reviewer_id uuid references public.profiles(id) on delete set null,
  approver_id uuid references public.profiles(id) on delete set null,
  validator_id uuid references public.profiles(id) on delete set null,
  effectiveness_reviewer_id uuid references public.profiles(id) on delete set null,
  executive_sponsor_id uuid references public.profiles(id) on delete set null,
  severity_level text,
  risk_level text,
  priority_level text,
  root_cause_category text,
  root_cause_summary text,
  containment_summary text,
  correction_summary text,
  corrective_action_summary text,
  preventive_action_summary text,
  capa_status text not null default 'draft' check (capa_status in ('draft','assigned','action_plan_required','action_plan_submitted','action_plan_approved','in_progress','evidence_required','completion_submitted','validation_pending','validation_rejected','effectiveness_review_pending','effectiveness_review_passed','effectiveness_review_failed','closure_requested','closed','overdue','escalated','cancelled','reopened')),
  workflow_stage text,
  due_date date,
  original_due_date date,
  revised_due_date date,
  completion_due_date date,
  started_at timestamptz,
  completed_at timestamptz,
  completion_submitted_at timestamptz,
  completion_submitted_by uuid references public.profiles(id) on delete set null,
  validation_required boolean default true,
  validation_status text,
  validated_by uuid references public.profiles(id) on delete set null,
  validated_at timestamptz,
  validation_note text,
  validation_rejection_reason text,
  effectiveness_review_required boolean default false,
  effectiveness_review_due_date date,
  effectiveness_review_status text default 'pending',
  effectiveness_review_completed_at timestamptz,
  evidence_required boolean default true,
  minimum_accepted_evidence_count integer default 1 check (minimum_accepted_evidence_count >= 0),
  evidence_requirement_id uuid,
  evidence_gate_status text,
  action_item_count integer default 0 check (action_item_count >= 0),
  completed_action_item_count integer default 0 check (completed_action_item_count >= 0),
  closure_requested_at timestamptz,
  closure_requested_by uuid references public.profiles(id) on delete set null,
  closure_approved_at timestamptz,
  closure_approved_by uuid references public.profiles(id) on delete set null,
  closed_at timestamptz,
  closure_rejection_reason text,
  closure_blocker text,
  overdue_flag boolean default false,
  overdue_days integer default 0 check (overdue_days >= 0),
  escalation_required boolean default false,
  escalation_level text,
  escalated_at timestamptz,
  escalated_to uuid references public.profiles(id) on delete set null,
  escalation_reason text,
  executive_visible boolean default false,
  repeat_issue_flag boolean default false,
  repeat_of_capa_id uuid references public.capa_action_plans(id) on delete set null,
  reopened_at timestamptz,
  reopened_by uuid references public.profiles(id) on delete set null,
  reopen_reason text,
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles(id) on delete set null,
  cancel_reason text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.capa_action_items (
  id uuid primary key default gen_random_uuid(),
  capa_id uuid not null references public.capa_action_plans(id) on delete cascade,
  action_item_code text,
  action_item_title text not null,
  action_item_description text,
  action_owner_id uuid references public.profiles(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  priority_level text,
  due_date date,
  status text not null default 'open' check (status in ('open','assigned','in_progress','blocked','evidence_required','completed','rejected','overdue','cancelled')),
  progress_percent integer default 0 check (progress_percent between 0 and 100),
  completion_note text,
  completed_at timestamptz,
  completed_by uuid references public.profiles(id) on delete set null,
  evidence_required boolean default false,
  evidence_gate_status text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.capa_events (
  id uuid primary key default gen_random_uuid(),
  capa_id uuid not null references public.capa_action_plans(id) on delete cascade,
  action_item_id uuid references public.capa_action_items(id) on delete set null,
  event_type text not null check (event_type in ('created','assigned','action_plan_submitted','action_plan_approved','action_plan_rejected','started','action_item_created','action_item_updated','evidence_requested','completion_submitted','validation_approved','validation_rejected','effectiveness_review_started','effectiveness_review_passed','effectiveness_review_failed','closure_requested','closure_approved','closure_rejected','extension_requested','extension_approved','extension_rejected','escalated','reopened','cancelled','linked')),
  from_status text,
  to_status text,
  actor_id uuid references public.profiles(id) on delete set null,
  event_note text,
  rejection_reason text,
  created_at timestamptz default now()
);

create table if not exists public.capa_due_date_extensions (
  id uuid primary key default gen_random_uuid(),
  capa_id uuid not null references public.capa_action_plans(id) on delete cascade,
  requested_by uuid references public.profiles(id) on delete set null,
  requested_at timestamptz default now(),
  current_due_date date,
  requested_due_date date,
  extension_reason text not null check (length(trim(extension_reason)) > 0),
  extension_status text not null default 'pending' check (extension_status in ('pending','approved','rejected','cancelled')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz default now()
);

create table if not exists public.capa_effectiveness_reviews (
  id uuid primary key default gen_random_uuid(),
  capa_id uuid not null references public.capa_action_plans(id) on delete cascade,
  review_due_date date,
  reviewer_id uuid references public.profiles(id) on delete set null,
  review_method text,
  review_result text default 'pending' check (review_result in ('pending','effective','ineffective','needs_more_time','repeated_issue_detected')),
  review_note text,
  evidence_required boolean default false,
  completed_at timestamptz,
  completed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists public.capa_links (
  id uuid primary key default gen_random_uuid(),
  capa_id uuid not null references public.capa_action_plans(id) on delete cascade,
  linked_item_type text not null check (linked_item_type in ('ovr','risk','audit_finding','compliance_obligation','evidence','evidence_requirement','evidence_file','document_control','approval_request','project','task','department','control','policy','sop','training','other')),
  linked_item_id uuid,
  link_type text,
  required_flag boolean default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

create index if not exists idx_patch28_capa_org on public.capa_action_plans(organization_id);
create index if not exists idx_patch28_capa_status on public.capa_action_plans(capa_status);
create index if not exists idx_patch28_capa_source on public.capa_action_plans(source_type, source_id);
create index if not exists idx_patch28_capa_owner on public.capa_action_plans(capa_owner_id);
create index if not exists idx_patch28_capa_due on public.capa_action_plans(due_date);
create index if not exists idx_patch28_capa_overdue on public.capa_action_plans(overdue_flag);
create index if not exists idx_patch28_items_capa on public.capa_action_items(capa_id);
create index if not exists idx_patch28_items_status on public.capa_action_items(status);
create index if not exists idx_patch28_events_capa on public.capa_events(capa_id, created_at desc);
create index if not exists idx_patch28_extensions_capa on public.capa_due_date_extensions(capa_id);
create index if not exists idx_patch28_reviews_capa on public.capa_effectiveness_reviews(capa_id);
create index if not exists idx_patch28_links_capa on public.capa_links(capa_id);
create index if not exists idx_patch28_links_target on public.capa_links(linked_item_type, linked_item_id);

alter table public.capa_action_plans enable row level security;
alter table public.capa_action_items enable row level security;
alter table public.capa_events enable row level security;
alter table public.capa_due_date_extensions enable row level security;
alter table public.capa_effectiveness_reviews enable row level security;
alter table public.capa_links enable row level security;

drop policy if exists capa_action_plans_org_read_patch28 on public.capa_action_plans;
create policy capa_action_plans_org_read_patch28 on public.capa_action_plans
for select to authenticated
using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists capa_action_plans_org_write_patch28 on public.capa_action_plans;
create policy capa_action_plans_org_write_patch28 on public.capa_action_plans
for all to authenticated
using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'))
with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists capa_child_org_read_patch28 on public.capa_action_items;
create policy capa_child_org_read_patch28 on public.capa_action_items
for select to authenticated
using (exists (select 1 from public.capa_action_plans c where c.id = capa_action_items.capa_id and c.organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')));

drop policy if exists capa_child_org_write_patch28 on public.capa_action_items;
create policy capa_child_org_write_patch28 on public.capa_action_items
for all to authenticated
using (exists (select 1 from public.capa_action_plans c where c.id = capa_action_items.capa_id and c.organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')))
with check (exists (select 1 from public.capa_action_plans c where c.id = capa_action_items.capa_id and c.organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')));

drop policy if exists capa_events_org_read_patch28 on public.capa_events;
create policy capa_events_org_read_patch28 on public.capa_events
for select to authenticated
using (exists (select 1 from public.capa_action_plans c where c.id = capa_events.capa_id and c.organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')));

drop policy if exists capa_events_org_insert_patch28 on public.capa_events;
create policy capa_events_org_insert_patch28 on public.capa_events
for insert to authenticated
with check (exists (select 1 from public.capa_action_plans c where c.id = capa_events.capa_id and c.organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')));

drop policy if exists capa_extensions_org_all_patch28 on public.capa_due_date_extensions;
create policy capa_extensions_org_all_patch28 on public.capa_due_date_extensions
for all to authenticated
using (exists (select 1 from public.capa_action_plans c where c.id = capa_due_date_extensions.capa_id and c.organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')))
with check (exists (select 1 from public.capa_action_plans c where c.id = capa_due_date_extensions.capa_id and c.organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')));

drop policy if exists capa_reviews_org_all_patch28 on public.capa_effectiveness_reviews;
create policy capa_reviews_org_all_patch28 on public.capa_effectiveness_reviews
for all to authenticated
using (exists (select 1 from public.capa_action_plans c where c.id = capa_effectiveness_reviews.capa_id and c.organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')))
with check (exists (select 1 from public.capa_action_plans c where c.id = capa_effectiveness_reviews.capa_id and c.organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')));

drop policy if exists capa_links_org_all_patch28 on public.capa_links;
create policy capa_links_org_all_patch28 on public.capa_links
for all to authenticated
using (exists (select 1 from public.capa_action_plans c where c.id = capa_links.capa_id and c.organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')))
with check (exists (select 1 from public.capa_action_plans c where c.id = capa_links.capa_id and c.organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')));

create or replace view public.v_patch28_capa_register as
select
  c.*,
  d.name_en as department_name,
  owner.full_name_en as capa_owner_name,
  action_owner.full_name_en as action_owner_name,
  reviewer.full_name_en as reviewer_name,
  approver.full_name_en as approver_name
from public.capa_action_plans c
left join public.departments d on d.id = c.department_id
left join public.profiles owner on owner.id = c.capa_owner_id
left join public.profiles action_owner on action_owner.id = c.action_owner_id
left join public.profiles reviewer on reviewer.id = c.reviewer_id
left join public.profiles approver on approver.id = c.approver_id;

create or replace view public.v_patch28_open_capa_queue as
select * from public.v_patch28_capa_register
where capa_status not in ('closed','cancelled');

create or replace view public.v_patch28_overdue_capa as
select * from public.v_patch28_open_capa_queue
where (overdue_flag = true or (due_date is not null and due_date < current_date));

create or replace view public.v_patch28_capa_action_item_queue as
select
  i.*,
  c.organization_id,
  c.capa_code,
  c.capa_title
from public.capa_action_items i
join public.capa_action_plans c on c.id = i.capa_id
where i.status not in ('completed','cancelled');

create or replace view public.v_patch28_capa_closure_blockers as
select
  c.organization_id,
  c.id as capa_id,
  c.capa_code,
  c.capa_title,
  c.capa_status,
  exists (select 1 from public.capa_action_items i where i.capa_id = c.id and i.status not in ('completed','cancelled')) as has_incomplete_action_items,
  (coalesce(c.evidence_required, false) and coalesce(c.evidence_gate_status, 'pending') not in ('accepted','satisfied','waived','not_required')) as has_evidence_blocker,
  (coalesce(c.validation_required, false) and coalesce(c.validation_status, 'pending') <> 'approved') as has_validation_blocker,
  (coalesce(c.effectiveness_review_required, false) and coalesce(c.effectiveness_review_status, 'pending') not in ('passed','effective')) as has_effectiveness_blocker,
  case
    when exists (select 1 from public.capa_action_items i where i.capa_id = c.id and i.status not in ('completed','cancelled')) then 'incomplete_action_items'
    when coalesce(c.evidence_required, false) and coalesce(c.evidence_gate_status, 'pending') not in ('accepted','satisfied','waived','not_required') then 'evidence_gate_not_satisfied'
    when coalesce(c.validation_required, false) and coalesce(c.validation_status, 'pending') <> 'approved' then 'validation_approval_required'
    when coalesce(c.effectiveness_review_required, false) and coalesce(c.effectiveness_review_status, 'pending') not in ('passed','effective') then 'effectiveness_review_not_passed'
    else null
  end as blocker_reason,
  not (
    exists (select 1 from public.capa_action_items i where i.capa_id = c.id and i.status not in ('completed','cancelled'))
    or (coalesce(c.evidence_required, false) and coalesce(c.evidence_gate_status, 'pending') not in ('accepted','satisfied','waived','not_required'))
    or (coalesce(c.validation_required, false) and coalesce(c.validation_status, 'pending') <> 'approved')
    or (coalesce(c.effectiveness_review_required, false) and coalesce(c.effectiveness_review_status, 'pending') not in ('passed','effective'))
  ) as can_close
from public.capa_action_plans c;

create or replace view public.v_patch28_capa_evidence_gap_dashboard as
select * from public.v_patch28_capa_closure_blockers
where has_evidence_blocker = true;

create or replace view public.v_patch28_capa_effectiveness_review_queue as
select * from public.v_patch28_capa_register
where effectiveness_review_required = true
  and coalesce(effectiveness_review_status, 'pending') not in ('passed','effective');

create or replace view public.v_patch28_capa_executive_escalations as
select * from public.v_patch28_capa_register
where escalation_required = true or executive_visible = true or capa_status = 'escalated';

create or replace view public.v_patch28_repeat_capa_signals as
select * from public.v_patch28_capa_register
where repeat_issue_flag = true or repeat_of_capa_id is not null;

create or replace view public.v_patch28_capa_link_index as
select
  l.id as link_id,
  c.organization_id,
  l.capa_id,
  c.capa_code,
  c.capa_title,
  l.linked_item_type,
  l.linked_item_id,
  l.link_type,
  l.required_flag,
  l.created_by,
  l.created_at
from public.capa_links l
join public.capa_action_plans c on c.id = l.capa_id;

alter view public.v_patch28_capa_register set (security_invoker = true);
alter view public.v_patch28_open_capa_queue set (security_invoker = true);
alter view public.v_patch28_overdue_capa set (security_invoker = true);
alter view public.v_patch28_capa_action_item_queue set (security_invoker = true);
alter view public.v_patch28_capa_evidence_gap_dashboard set (security_invoker = true);
alter view public.v_patch28_capa_closure_blockers set (security_invoker = true);
alter view public.v_patch28_capa_effectiveness_review_queue set (security_invoker = true);
alter view public.v_patch28_capa_executive_escalations set (security_invoker = true);
alter view public.v_patch28_repeat_capa_signals set (security_invoker = true);
alter view public.v_patch28_capa_link_index set (security_invoker = true);

grant select on public.v_patch28_capa_register to authenticated;
grant select on public.v_patch28_open_capa_queue to authenticated;
grant select on public.v_patch28_overdue_capa to authenticated;
grant select on public.v_patch28_capa_action_item_queue to authenticated;
grant select on public.v_patch28_capa_evidence_gap_dashboard to authenticated;
grant select on public.v_patch28_capa_closure_blockers to authenticated;
grant select on public.v_patch28_capa_effectiveness_review_queue to authenticated;
grant select on public.v_patch28_capa_executive_escalations to authenticated;
grant select on public.v_patch28_repeat_capa_signals to authenticated;
grant select on public.v_patch28_capa_link_index to authenticated;

create or replace function public.patch28_write_capa_event(
  p_capa_id uuid,
  p_action_item_id uuid,
  p_event_type text,
  p_from_status text,
  p_to_status text,
  p_actor_id uuid,
  p_event_note text default null,
  p_rejection_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then
    raise exception 'PATCH28_CAPA_EVENT_SERVICE_ROLE_REQUIRED';
  end if;

  insert into public.capa_events (capa_id, action_item_id, event_type, from_status, to_status, actor_id, event_note, rejection_reason)
  values (p_capa_id, p_action_item_id, p_event_type, p_from_status, p_to_status, p_actor_id, p_event_note, p_rejection_reason);
end;
$$;

create or replace function public.create_capa_action_plan(
  p_organization_id uuid,
  p_capa_code text,
  p_capa_title text,
  p_capa_type text,
  p_source_type text,
  p_actor_id uuid,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_capa_id uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then raise exception 'PATCH28_CAPA_SERVICE_ROLE_REQUIRED'; end if;

  insert into public.capa_action_plans (
    organization_id, capa_code, capa_title, capa_description, capa_type, source_type, source_id, source_reference,
    department_id, capa_owner_id, action_owner_id, reviewer_id, approver_id, validator_id, effectiveness_reviewer_id, executive_sponsor_id,
    severity_level, risk_level, priority_level, root_cause_category, root_cause_summary,
    correction_summary, corrective_action_summary, preventive_action_summary, due_date, original_due_date,
    validation_required, effectiveness_review_required, effectiveness_review_due_date,
    evidence_required, minimum_accepted_evidence_count, evidence_requirement_id, completion_due_date, created_by, updated_by
  )
  values (
    p_organization_id, p_capa_code, p_capa_title, p_payload->>'capa_description', p_capa_type, p_source_type, nullif(p_payload->>'source_id', '')::uuid, nullif(p_payload->>'source_reference', ''),
    nullif(p_payload->>'department_id', '')::uuid, nullif(p_payload->>'capa_owner_id', '')::uuid, nullif(p_payload->>'action_owner_id', '')::uuid,
    nullif(p_payload->>'reviewer_id', '')::uuid, nullif(p_payload->>'approver_id', '')::uuid, nullif(p_payload->>'validator_id', '')::uuid, nullif(p_payload->>'effectiveness_reviewer_id', '')::uuid, nullif(p_payload->>'executive_sponsor_id', '')::uuid,
    nullif(p_payload->>'severity_level', ''), nullif(p_payload->>'risk_level', ''), nullif(p_payload->>'priority_level', ''),
    nullif(p_payload->>'root_cause_category', ''), nullif(p_payload->>'root_cause_summary', ''),
    nullif(p_payload->>'correction_summary', ''), nullif(p_payload->>'corrective_action_summary', ''), nullif(p_payload->>'preventive_action_summary', ''),
    nullif(p_payload->>'due_date', '')::date, nullif(p_payload->>'due_date', '')::date,
    coalesce(nullif(p_payload->>'validation_required', '')::boolean, true),
    coalesce(nullif(p_payload->>'effectiveness_review_required', '')::boolean, false),
    nullif(p_payload->>'effectiveness_review_due_date', '')::date,
    coalesce(nullif(p_payload->>'evidence_required', '')::boolean, true),
    coalesce(nullif(p_payload->>'minimum_accepted_evidence_count', '')::integer, 1),
    nullif(p_payload->>'evidence_requirement_id', '')::uuid,
    nullif(p_payload->>'completion_due_date', '')::date,
    p_actor_id, p_actor_id
  )
  returning id into v_capa_id;

  perform public.patch28_write_capa_event(v_capa_id, null, 'created', null, 'draft', p_actor_id, p_capa_title, null);
  return v_capa_id;
end;
$$;

create or replace function public.assign_capa_action_plan(p_capa_id uuid, p_actor_id uuid, p_owner_id uuid, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_old text;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role' and current_user <> 'service_role' then raise exception 'PATCH28_CAPA_SERVICE_ROLE_REQUIRED'; end if;
  select capa_status into v_old from public.capa_action_plans where id = p_capa_id for update;
  if not found then raise exception 'PATCH28_CAPA_NOT_FOUND'; end if;
  update public.capa_action_plans set capa_status = 'assigned', workflow_stage = 'assigned', capa_owner_id = p_owner_id, updated_by = p_actor_id, updated_at = now() where id = p_capa_id;
  perform public.patch28_write_capa_event(p_capa_id, null, 'assigned', v_old, 'assigned', p_actor_id, p_note, null);
  return jsonb_build_object('status','ok','capa_id',p_capa_id,'capa_status','assigned');
end $$;

create or replace function public.submit_capa_action_plan(p_capa_id uuid, p_actor_id uuid, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_old text;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role' and current_user <> 'service_role' then raise exception 'PATCH28_CAPA_SERVICE_ROLE_REQUIRED'; end if;
  select capa_status into v_old from public.capa_action_plans where id = p_capa_id for update;
  if not found then raise exception 'PATCH28_CAPA_NOT_FOUND'; end if;
  update public.capa_action_plans set capa_status = 'action_plan_submitted', workflow_stage = 'review', updated_by = p_actor_id, updated_at = now() where id = p_capa_id;
  perform public.patch28_write_capa_event(p_capa_id, null, 'action_plan_submitted', v_old, 'action_plan_submitted', p_actor_id, p_note, null);
  return jsonb_build_object('status','ok','capa_id',p_capa_id);
end $$;

create or replace function public.approve_capa_action_plan(p_capa_id uuid, p_actor_id uuid, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_old text;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role' and current_user <> 'service_role' then raise exception 'PATCH28_CAPA_SERVICE_ROLE_REQUIRED'; end if;
  select capa_status into v_old from public.capa_action_plans where id = p_capa_id for update;
  if not found then raise exception 'PATCH28_CAPA_NOT_FOUND'; end if;
  update public.capa_action_plans set capa_status = 'action_plan_approved', workflow_stage = 'approved', approver_id = coalesce(approver_id, p_actor_id), updated_by = p_actor_id, updated_at = now() where id = p_capa_id;
  perform public.patch28_write_capa_event(p_capa_id, null, 'action_plan_approved', v_old, 'action_plan_approved', p_actor_id, p_note, null);
  return jsonb_build_object('status','ok','capa_id',p_capa_id);
end $$;

create or replace function public.reject_capa_action_plan(p_capa_id uuid, p_actor_id uuid, p_rejection_reason text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_old text;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role' and current_user <> 'service_role' then raise exception 'PATCH28_CAPA_SERVICE_ROLE_REQUIRED'; end if;
  if nullif(trim(coalesce(p_rejection_reason,'')), '') is null then raise exception 'PATCH28_REJECTION_REASON_REQUIRED'; end if;
  select capa_status into v_old from public.capa_action_plans where id = p_capa_id for update;
  if not found then raise exception 'PATCH28_CAPA_NOT_FOUND'; end if;
  update public.capa_action_plans set capa_status = 'action_plan_required', workflow_stage = 'correction', closure_rejection_reason = p_rejection_reason, updated_by = p_actor_id, updated_at = now() where id = p_capa_id;
  perform public.patch28_write_capa_event(p_capa_id, null, 'action_plan_rejected', v_old, 'action_plan_required', p_actor_id, p_note, p_rejection_reason);
  return jsonb_build_object('status','ok','capa_id',p_capa_id);
end $$;

create or replace function public.create_capa_action_item(p_capa_id uuid, p_action_item_title text, p_actor_id uuid, p_payload jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_item_id uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role' and current_user <> 'service_role' then raise exception 'PATCH28_CAPA_SERVICE_ROLE_REQUIRED'; end if;
  insert into public.capa_action_items (capa_id, action_item_code, action_item_title, action_item_description, action_owner_id, department_id, priority_level, due_date, evidence_required, created_by, updated_by)
  values (p_capa_id, nullif(p_payload->>'action_item_code',''), p_action_item_title, p_payload->>'action_item_description', nullif(p_payload->>'action_owner_id','')::uuid, nullif(p_payload->>'department_id','')::uuid, nullif(p_payload->>'priority_level',''), nullif(p_payload->>'due_date','')::date, coalesce(nullif(p_payload->>'evidence_required','')::boolean, false), p_actor_id, p_actor_id)
  returning id into v_item_id;
  update public.capa_action_plans
  set action_item_count = action_item_count + 1,
      updated_by = p_actor_id,
      updated_at = now()
  where id = p_capa_id;
  perform public.patch28_write_capa_event(p_capa_id, v_item_id, 'action_item_created', null, 'open', p_actor_id, p_action_item_title, null);
  return v_item_id;
end $$;

create or replace function public.update_capa_action_item_status(p_action_item_id uuid, p_status text, p_actor_id uuid, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_capa_id uuid; v_old text;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role' and current_user <> 'service_role' then raise exception 'PATCH28_CAPA_SERVICE_ROLE_REQUIRED'; end if;
  select capa_id, status into v_capa_id, v_old from public.capa_action_items where id = p_action_item_id for update;
  if not found then raise exception 'PATCH28_ACTION_ITEM_NOT_FOUND'; end if;
  update public.capa_action_items set status = p_status, progress_percent = case when p_status = 'completed' then 100 else progress_percent end, completed_at = case when p_status = 'completed' then now() else completed_at end, completed_by = case when p_status = 'completed' then p_actor_id else completed_by end, completion_note = coalesce(p_note, completion_note), updated_by = p_actor_id, updated_at = now() where id = p_action_item_id;
  update public.capa_action_plans
  set completed_action_item_count = (select count(*) from public.capa_action_items where capa_id = v_capa_id and status = 'completed'),
      updated_by = p_actor_id,
      updated_at = now()
  where id = v_capa_id;
  perform public.patch28_write_capa_event(v_capa_id, p_action_item_id, 'action_item_updated', v_old, p_status, p_actor_id, p_note, null);
  return jsonb_build_object('status','ok','action_item_id',p_action_item_id,'item_status',p_status);
end $$;

create or replace function public.submit_capa_completion(p_capa_id uuid, p_actor_id uuid, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_old text;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role' and current_user <> 'service_role' then raise exception 'PATCH28_CAPA_SERVICE_ROLE_REQUIRED'; end if;
  select capa_status into v_old from public.capa_action_plans where id = p_capa_id for update;
  if not found then raise exception 'PATCH28_CAPA_NOT_FOUND'; end if;
  update public.capa_action_plans set capa_status = 'completion_submitted', workflow_stage = 'validation', completion_submitted_at = now(), completion_submitted_by = p_actor_id, updated_by = p_actor_id, updated_at = now() where id = p_capa_id;
  perform public.patch28_write_capa_event(p_capa_id, null, 'completion_submitted', v_old, 'completion_submitted', p_actor_id, p_note, null);
  return jsonb_build_object('status','ok','capa_id',p_capa_id);
end $$;

create or replace function public.validate_capa_completion(p_capa_id uuid, p_actor_id uuid, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_old text;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role' and current_user <> 'service_role' then raise exception 'PATCH28_CAPA_SERVICE_ROLE_REQUIRED'; end if;
  select capa_status into v_old from public.capa_action_plans where id = p_capa_id for update;
  if not found then raise exception 'PATCH28_CAPA_NOT_FOUND'; end if;
  update public.capa_action_plans set capa_status = case when effectiveness_review_required then 'effectiveness_review_pending' else 'closure_requested' end, workflow_stage = case when effectiveness_review_required then 'effectiveness_review' else 'closure' end, validation_status = 'approved', validated_by = p_actor_id, validated_at = now(), validation_note = p_note, updated_by = p_actor_id, updated_at = now() where id = p_capa_id;
  perform public.patch28_write_capa_event(p_capa_id, null, 'validation_approved', v_old, 'validation_approved', p_actor_id, p_note, null);
  return jsonb_build_object('status','ok','capa_id',p_capa_id);
end $$;

create or replace function public.reject_capa_completion(p_capa_id uuid, p_actor_id uuid, p_rejection_reason text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_old text;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role' and current_user <> 'service_role' then raise exception 'PATCH28_CAPA_SERVICE_ROLE_REQUIRED'; end if;
  if nullif(trim(coalesce(p_rejection_reason,'')), '') is null then raise exception 'PATCH28_REJECTION_REASON_REQUIRED'; end if;
  select capa_status into v_old from public.capa_action_plans where id = p_capa_id for update;
  if not found then raise exception 'PATCH28_CAPA_NOT_FOUND'; end if;
  update public.capa_action_plans set capa_status = 'validation_rejected', workflow_stage = 'correction', validation_status = 'rejected', validation_rejection_reason = p_rejection_reason, updated_by = p_actor_id, updated_at = now() where id = p_capa_id;
  perform public.patch28_write_capa_event(p_capa_id, null, 'validation_rejected', v_old, 'validation_rejected', p_actor_id, p_note, p_rejection_reason);
  return jsonb_build_object('status','ok','capa_id',p_capa_id);
end $$;

create or replace function public.request_capa_due_date_extension(p_capa_id uuid, p_actor_id uuid, p_requested_due_date date, p_extension_reason text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_ext_id uuid; v_due date;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role' and current_user <> 'service_role' then raise exception 'PATCH28_CAPA_SERVICE_ROLE_REQUIRED'; end if;
  if nullif(trim(coalesce(p_extension_reason,'')), '') is null then raise exception 'PATCH28_EXTENSION_REASON_REQUIRED'; end if;
  select due_date into v_due from public.capa_action_plans where id = p_capa_id;
  if not found then raise exception 'PATCH28_CAPA_NOT_FOUND'; end if;
  insert into public.capa_due_date_extensions (capa_id, requested_by, current_due_date, requested_due_date, extension_reason) values (p_capa_id, p_actor_id, v_due, p_requested_due_date, p_extension_reason) returning id into v_ext_id;
  perform public.patch28_write_capa_event(p_capa_id, null, 'extension_requested', null, 'pending', p_actor_id, p_extension_reason, null);
  return v_ext_id;
end $$;

create or replace function public.approve_capa_due_date_extension(p_extension_id uuid, p_actor_id uuid, p_review_note text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_capa_id uuid; v_due date;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role' and current_user <> 'service_role' then raise exception 'PATCH28_CAPA_SERVICE_ROLE_REQUIRED'; end if;
  update public.capa_due_date_extensions set extension_status = 'approved', reviewed_by = p_actor_id, reviewed_at = now(), review_note = p_review_note where id = p_extension_id returning capa_id, requested_due_date into v_capa_id, v_due;
  if not found then raise exception 'PATCH28_EXTENSION_NOT_FOUND'; end if;
  update public.capa_action_plans set revised_due_date = v_due, due_date = v_due, updated_by = p_actor_id, updated_at = now() where id = v_capa_id;
  perform public.patch28_write_capa_event(v_capa_id, null, 'extension_approved', null, 'approved', p_actor_id, p_review_note, null);
  return jsonb_build_object('status','ok','extension_id',p_extension_id,'due_date',v_due);
end $$;

create or replace function public.reject_capa_due_date_extension(p_extension_id uuid, p_actor_id uuid, p_review_note text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_capa_id uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role' and current_user <> 'service_role' then raise exception 'PATCH28_CAPA_SERVICE_ROLE_REQUIRED'; end if;
  update public.capa_due_date_extensions set extension_status = 'rejected', reviewed_by = p_actor_id, reviewed_at = now(), review_note = p_review_note where id = p_extension_id returning capa_id into v_capa_id;
  if not found then raise exception 'PATCH28_EXTENSION_NOT_FOUND'; end if;
  perform public.patch28_write_capa_event(v_capa_id, null, 'extension_rejected', null, 'rejected', p_actor_id, p_review_note, null);
  return jsonb_build_object('status','ok','extension_id',p_extension_id);
end $$;

create or replace function public.start_capa_effectiveness_review(p_capa_id uuid, p_actor_id uuid, p_review_due_date date, p_review_method text default null)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_review_id uuid; v_old text;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role' and current_user <> 'service_role' then raise exception 'PATCH28_CAPA_SERVICE_ROLE_REQUIRED'; end if;
  select capa_status into v_old from public.capa_action_plans where id = p_capa_id for update;
  if not found then raise exception 'PATCH28_CAPA_NOT_FOUND'; end if;
  insert into public.capa_effectiveness_reviews (capa_id, review_due_date, reviewer_id, review_method) values (p_capa_id, p_review_due_date, p_actor_id, p_review_method) returning id into v_review_id;
  update public.capa_action_plans set capa_status = 'effectiveness_review_pending', workflow_stage = 'effectiveness_review', effectiveness_review_required = true, effectiveness_review_due_date = p_review_due_date, effectiveness_review_status = 'pending', updated_by = p_actor_id, updated_at = now() where id = p_capa_id;
  perform public.patch28_write_capa_event(p_capa_id, null, 'effectiveness_review_started', v_old, 'effectiveness_review_pending', p_actor_id, p_review_method, null);
  return v_review_id;
end $$;

create or replace function public.complete_capa_effectiveness_review(p_review_id uuid, p_actor_id uuid, p_review_result text, p_review_note text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_capa_id uuid; v_event text;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role' and current_user <> 'service_role' then raise exception 'PATCH28_CAPA_SERVICE_ROLE_REQUIRED'; end if;
  v_event := case when p_review_result in ('effective','needs_more_time') then 'effectiveness_review_passed' else 'effectiveness_review_failed' end;
  update public.capa_effectiveness_reviews set review_result = p_review_result, review_note = p_review_note, completed_at = now(), completed_by = p_actor_id where id = p_review_id returning capa_id into v_capa_id;
  if not found then raise exception 'PATCH28_EFFECTIVENESS_REVIEW_NOT_FOUND'; end if;
  update public.capa_action_plans set effectiveness_review_status = case when p_review_result = 'effective' then 'passed' else p_review_result end, effectiveness_review_completed_at = now(), capa_status = case when p_review_result = 'effective' then 'effectiveness_review_passed' else 'effectiveness_review_failed' end, repeat_issue_flag = case when p_review_result = 'repeated_issue_detected' then true else repeat_issue_flag end, updated_by = p_actor_id, updated_at = now() where id = v_capa_id;
  perform public.patch28_write_capa_event(v_capa_id, null, v_event, null, p_review_result, p_actor_id, p_review_note, null);
  return jsonb_build_object('status','ok','review_id',p_review_id,'review_result',p_review_result);
end $$;

create or replace function public.request_capa_closure(p_capa_id uuid, p_actor_id uuid, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_old text;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role' and current_user <> 'service_role' then raise exception 'PATCH28_CAPA_SERVICE_ROLE_REQUIRED'; end if;
  select capa_status into v_old from public.capa_action_plans where id = p_capa_id for update;
  if not found then raise exception 'PATCH28_CAPA_NOT_FOUND'; end if;
  update public.capa_action_plans set capa_status = 'closure_requested', workflow_stage = 'closure', closure_requested_at = now(), closure_requested_by = p_actor_id, updated_by = p_actor_id, updated_at = now() where id = p_capa_id;
  perform public.patch28_write_capa_event(p_capa_id, null, 'closure_requested', v_old, 'closure_requested', p_actor_id, p_note, null);
  return jsonb_build_object('status','ok','capa_id',p_capa_id);
end $$;

create or replace function public.approve_capa_closure(p_capa_id uuid, p_actor_id uuid, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_old text; v_blocker text;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role' and current_user <> 'service_role' then raise exception 'PATCH28_CAPA_SERVICE_ROLE_REQUIRED'; end if;
  select blocker_reason into v_blocker from public.v_patch28_capa_closure_blockers where capa_id = p_capa_id and can_close = false limit 1;
  if v_blocker is not null then
    update public.capa_action_plans set closure_blocker = v_blocker, updated_by = p_actor_id, updated_at = now() where id = p_capa_id;
    raise exception 'PATCH28_CAPA_CLOSURE_BLOCKED: %', v_blocker;
  end if;
  select capa_status into v_old from public.capa_action_plans where id = p_capa_id for update;
  if not found then raise exception 'PATCH28_CAPA_NOT_FOUND'; end if;
  update public.capa_action_plans set capa_status = 'closed', workflow_stage = 'closed', completed_at = coalesce(completed_at, now()), closure_approved_at = now(), closure_approved_by = p_actor_id, closed_at = now(), closure_blocker = null, updated_by = p_actor_id, updated_at = now() where id = p_capa_id;
  perform public.patch28_write_capa_event(p_capa_id, null, 'closure_approved', v_old, 'closed', p_actor_id, p_note, null);
  return jsonb_build_object('status','ok','capa_id',p_capa_id,'capa_status','closed');
end $$;

create or replace function public.reject_capa_closure(p_capa_id uuid, p_actor_id uuid, p_rejection_reason text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_old text;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role' and current_user <> 'service_role' then raise exception 'PATCH28_CAPA_SERVICE_ROLE_REQUIRED'; end if;
  if nullif(trim(coalesce(p_rejection_reason,'')), '') is null then raise exception 'PATCH28_REJECTION_REASON_REQUIRED'; end if;
  select capa_status into v_old from public.capa_action_plans where id = p_capa_id for update;
  if not found then raise exception 'PATCH28_CAPA_NOT_FOUND'; end if;
  update public.capa_action_plans set capa_status = 'validation_rejected', workflow_stage = 'correction', closure_rejection_reason = p_rejection_reason, closure_blocker = p_rejection_reason, updated_by = p_actor_id, updated_at = now() where id = p_capa_id;
  perform public.patch28_write_capa_event(p_capa_id, null, 'closure_rejected', v_old, 'validation_rejected', p_actor_id, p_note, p_rejection_reason);
  return jsonb_build_object('status','ok','capa_id',p_capa_id);
end $$;

create or replace function public.escalate_capa(p_capa_id uuid, p_actor_id uuid, p_escalation_reason text, p_escalation_level text default 'management', p_escalated_to uuid default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_old text;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role' and current_user <> 'service_role' then raise exception 'PATCH28_CAPA_SERVICE_ROLE_REQUIRED'; end if;
  if nullif(trim(coalesce(p_escalation_reason,'')), '') is null then raise exception 'PATCH28_ESCALATION_REASON_REQUIRED'; end if;
  select capa_status into v_old from public.capa_action_plans where id = p_capa_id for update;
  if not found then raise exception 'PATCH28_CAPA_NOT_FOUND'; end if;
  update public.capa_action_plans set capa_status = 'escalated', workflow_stage = 'escalation', escalation_required = true, escalation_level = p_escalation_level, escalated_at = now(), escalated_to = p_escalated_to, escalation_reason = p_escalation_reason, executive_visible = true, updated_by = p_actor_id, updated_at = now() where id = p_capa_id;
  perform public.patch28_write_capa_event(p_capa_id, null, 'escalated', v_old, 'escalated', p_actor_id, p_escalation_reason, null);
  return jsonb_build_object('status','ok','capa_id',p_capa_id);
end $$;

create or replace function public.reopen_capa_with_reason(p_capa_id uuid, p_actor_id uuid, p_reopen_reason text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_old text;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role' and current_user <> 'service_role' then raise exception 'PATCH28_CAPA_SERVICE_ROLE_REQUIRED'; end if;
  if nullif(trim(coalesce(p_reopen_reason,'')), '') is null then raise exception 'PATCH28_REOPEN_REASON_REQUIRED'; end if;
  select capa_status into v_old from public.capa_action_plans where id = p_capa_id for update;
  if not found then raise exception 'PATCH28_CAPA_NOT_FOUND'; end if;
  update public.capa_action_plans set capa_status = 'reopened', workflow_stage = 'reopened', reopened_at = now(), reopened_by = p_actor_id, reopen_reason = p_reopen_reason, closure_approved_at = null, closure_approved_by = null, updated_by = p_actor_id, updated_at = now() where id = p_capa_id;
  perform public.patch28_write_capa_event(p_capa_id, null, 'reopened', v_old, 'reopened', p_actor_id, p_reopen_reason, null);
  return jsonb_build_object('status','ok','capa_id',p_capa_id);
end $$;

create or replace function public.cancel_capa_with_reason(p_capa_id uuid, p_actor_id uuid, p_cancel_reason text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_old text;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role' and current_user <> 'service_role' then raise exception 'PATCH28_CAPA_SERVICE_ROLE_REQUIRED'; end if;
  if nullif(trim(coalesce(p_cancel_reason,'')), '') is null then raise exception 'PATCH28_CANCEL_REASON_REQUIRED'; end if;
  select capa_status into v_old from public.capa_action_plans where id = p_capa_id for update;
  if not found then raise exception 'PATCH28_CAPA_NOT_FOUND'; end if;
  update public.capa_action_plans set capa_status = 'cancelled', workflow_stage = 'cancelled', cancelled_at = now(), cancelled_by = p_actor_id, cancel_reason = p_cancel_reason, updated_by = p_actor_id, updated_at = now() where id = p_capa_id;
  perform public.patch28_write_capa_event(p_capa_id, null, 'cancelled', v_old, 'cancelled', p_actor_id, p_cancel_reason, null);
  return jsonb_build_object('status','ok','capa_id',p_capa_id);
end $$;

create or replace function public.link_capa_to_item(p_capa_id uuid, p_linked_item_type text, p_linked_item_id uuid, p_actor_id uuid, p_link_type text default null, p_required_flag boolean default false)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_link_id uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role' and current_user <> 'service_role' then raise exception 'PATCH28_CAPA_SERVICE_ROLE_REQUIRED'; end if;
  insert into public.capa_links (capa_id, linked_item_type, linked_item_id, link_type, required_flag, created_by) values (p_capa_id, p_linked_item_type, p_linked_item_id, p_link_type, coalesce(p_required_flag, false), p_actor_id) returning id into v_link_id;
  perform public.patch28_write_capa_event(
    p_capa_id,
    null,
    'linked',
    null,
    null,
    p_actor_id,
    'Linked CAPA to ' || p_linked_item_type,
    jsonb_build_object('linked_item_id', p_linked_item_id, 'link_type', p_link_type, 'required_flag', coalesce(p_required_flag, false))::text
  );
  return v_link_id;
end $$;

create or replace function public.mark_repeat_capa(p_capa_id uuid, p_actor_id uuid, p_repeat_of_capa_id uuid, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role' and current_user <> 'service_role' then raise exception 'PATCH28_CAPA_SERVICE_ROLE_REQUIRED'; end if;
  update public.capa_action_plans set repeat_issue_flag = true, repeat_of_capa_id = p_repeat_of_capa_id, updated_by = p_actor_id, updated_at = now() where id = p_capa_id;
  if not found then raise exception 'PATCH28_CAPA_NOT_FOUND'; end if;
  perform public.patch28_write_capa_event(p_capa_id, null, 'reopened', null, 'repeat_issue', p_actor_id, p_note, null);
  return jsonb_build_object('status','ok','capa_id',p_capa_id,'repeat_issue_flag',true);
end $$;

revoke all on function public.patch28_write_capa_event(uuid, uuid, text, text, text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.patch28_write_capa_event(uuid, uuid, text, text, text, uuid, text, text) to service_role;

revoke all on function public.create_capa_action_plan(uuid, text, text, text, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.create_capa_action_plan(uuid, text, text, text, text, uuid, jsonb) to service_role;

revoke all on function public.assign_capa_action_plan(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.assign_capa_action_plan(uuid, uuid, uuid, text) to service_role;

revoke all on function public.submit_capa_action_plan(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.submit_capa_action_plan(uuid, uuid, text) to service_role;

revoke all on function public.approve_capa_action_plan(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.approve_capa_action_plan(uuid, uuid, text) to service_role;

revoke all on function public.reject_capa_action_plan(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.reject_capa_action_plan(uuid, uuid, text, text) to service_role;

revoke all on function public.create_capa_action_item(uuid, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.create_capa_action_item(uuid, text, uuid, jsonb) to service_role;

revoke all on function public.update_capa_action_item_status(uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.update_capa_action_item_status(uuid, text, uuid, text) to service_role;

revoke all on function public.submit_capa_completion(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.submit_capa_completion(uuid, uuid, text) to service_role;

revoke all on function public.validate_capa_completion(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.validate_capa_completion(uuid, uuid, text) to service_role;

revoke all on function public.reject_capa_completion(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.reject_capa_completion(uuid, uuid, text, text) to service_role;

revoke all on function public.request_capa_due_date_extension(uuid, uuid, date, text) from public, anon, authenticated;
grant execute on function public.request_capa_due_date_extension(uuid, uuid, date, text) to service_role;

revoke all on function public.approve_capa_due_date_extension(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.approve_capa_due_date_extension(uuid, uuid, text) to service_role;

revoke all on function public.reject_capa_due_date_extension(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.reject_capa_due_date_extension(uuid, uuid, text) to service_role;

revoke all on function public.start_capa_effectiveness_review(uuid, uuid, date, text) from public, anon, authenticated;
grant execute on function public.start_capa_effectiveness_review(uuid, uuid, date, text) to service_role;

revoke all on function public.complete_capa_effectiveness_review(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.complete_capa_effectiveness_review(uuid, uuid, text, text) to service_role;

revoke all on function public.request_capa_closure(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.request_capa_closure(uuid, uuid, text) to service_role;

revoke all on function public.approve_capa_closure(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.approve_capa_closure(uuid, uuid, text) to service_role;

revoke all on function public.reject_capa_closure(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.reject_capa_closure(uuid, uuid, text, text) to service_role;

revoke all on function public.escalate_capa(uuid, uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.escalate_capa(uuid, uuid, text, text, uuid) to service_role;

revoke all on function public.reopen_capa_with_reason(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.reopen_capa_with_reason(uuid, uuid, text) to service_role;

revoke all on function public.cancel_capa_with_reason(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.cancel_capa_with_reason(uuid, uuid, text) to service_role;

revoke all on function public.link_capa_to_item(uuid, text, uuid, uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.link_capa_to_item(uuid, text, uuid, uuid, text, boolean) to service_role;

revoke all on function public.mark_repeat_capa(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.mark_repeat_capa(uuid, uuid, uuid, text) to service_role;

comment on table public.capa_action_plans is 'Patch 28 CAPA and action plan execution register.';
comment on table public.capa_action_items is 'Patch 28 executable CAPA action item queue.';
comment on table public.capa_events is 'Patch 28 CAPA workflow audit trail.';
comment on table public.capa_due_date_extensions is 'Patch 28 governed CAPA due-date extension requests.';
comment on table public.capa_effectiveness_reviews is 'Patch 28 post-completion CAPA effectiveness review register.';
comment on table public.capa_links is 'Patch 28 generic CAPA compatibility links to OVR, risk, evidence, audit, compliance, document control, approval, project, and training records.';
