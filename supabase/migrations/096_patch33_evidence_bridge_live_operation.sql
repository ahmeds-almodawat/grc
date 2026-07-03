-- =========================================================
-- Patch 33: Evidence Bridge / Live Clause-to-Control-to-Evidence Operation
-- Operational evidence readiness bridge for accreditation clauses, controls,
-- documents/SOPs, evidence, CAPA, risk, audit, and training dependencies.
-- =========================================================

create table if not exists public.evidence_bridge_links (
  id uuid primary key default gen_random_uuid(),
  clause_id uuid references public.accreditation_clauses(id) on delete set null,
  control_id uuid,
  evidence_id uuid,
  document_id uuid,
  sop_id uuid,
  linked_entity_type text not null check (linked_entity_type in (
    'clause','control','document','sop','evidence','capa','risk','audit_finding',
    'training_program','training_assignment','policy','approval_authority','other'
  )),
  linked_entity_id uuid not null,
  bridge_role text not null default 'supporting' check (bridge_role in (
    'primary_evidence','supporting_evidence','control_evidence','sop_evidence',
    'capa_evidence','risk_evidence','audit_evidence','training_evidence','supporting'
  )),
  evidence_status text not null default 'pending_review' check (evidence_status in (
    'missing','pending_collection','pending_review','accepted','rejected','stale','expired','not_applicable'
  )),
  freshness_status text not null default 'unknown' check (freshness_status in ('current','due_soon','stale','expired','unknown')),
  valid_from date,
  valid_until date,
  owner_user_id uuid references public.profiles(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

create table if not exists public.evidence_collection_requests (
  id uuid primary key default gen_random_uuid(),
  bridge_link_id uuid references public.evidence_bridge_links(id) on delete set null,
  clause_id uuid references public.accreditation_clauses(id) on delete set null,
  requested_entity_type text not null,
  requested_entity_id uuid,
  request_title text not null,
  request_description text,
  assigned_to_user_id uuid references public.profiles(id) on delete set null,
  assigned_to_department_id uuid references public.departments(id) on delete set null,
  due_date date,
  priority text not null default 'medium' check (priority in ('low','medium','high','critical')),
  status text not null default 'open' check (status in (
    'open','in_progress','submitted','under_review','accepted','rejected','overdue','cancelled','waived'
  )),
  submitted_evidence_id uuid,
  requested_by uuid references public.profiles(id) on delete set null,
  requested_at timestamptz default now(),
  completed_at timestamptz
);

create table if not exists public.evidence_bridge_reviews (
  id uuid primary key default gen_random_uuid(),
  bridge_link_id uuid references public.evidence_bridge_links(id) on delete set null,
  collection_request_id uuid references public.evidence_collection_requests(id) on delete set null,
  evidence_id uuid,
  review_status text not null default 'pending_review' check (review_status in ('pending_review','accepted','rejected','needs_rework','waived')),
  review_notes text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.evidence_bridge_events (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid,
  event_type text not null check (event_type in (
    'bridge_link_created','bridge_status_updated','collection_request_created',
    'collection_request_submitted','submission_reviewed','submission_accepted',
    'submission_rejected','collection_request_waived','collection_request_reopened',
    'bridge_marked_not_applicable','freshness_refreshed','bridge_viewed'
  )),
  event_summary text not null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

create index if not exists idx_patch33_bridge_clause on public.evidence_bridge_links(clause_id, active);
create index if not exists idx_patch33_bridge_control on public.evidence_bridge_links(control_id);
create index if not exists idx_patch33_bridge_evidence on public.evidence_bridge_links(evidence_id);
create index if not exists idx_patch33_bridge_document on public.evidence_bridge_links(document_id);
create index if not exists idx_patch33_bridge_entity on public.evidence_bridge_links(linked_entity_type, linked_entity_id);
create index if not exists idx_patch33_bridge_status on public.evidence_bridge_links(evidence_status, freshness_status);
create index if not exists idx_patch33_bridge_owner on public.evidence_bridge_links(owner_user_id);
create index if not exists idx_patch33_bridge_department on public.evidence_bridge_links(department_id);
create index if not exists idx_patch33_requests_bridge on public.evidence_collection_requests(bridge_link_id);
create index if not exists idx_patch33_requests_clause on public.evidence_collection_requests(clause_id);
create index if not exists idx_patch33_requests_status on public.evidence_collection_requests(status, due_date);
create index if not exists idx_patch33_requests_assigned_user on public.evidence_collection_requests(assigned_to_user_id);
create index if not exists idx_patch33_reviews_bridge on public.evidence_bridge_reviews(bridge_link_id, created_at desc);
create index if not exists idx_patch33_reviews_request on public.evidence_bridge_reviews(collection_request_id, created_at desc);
create index if not exists idx_patch33_events_entity on public.evidence_bridge_events(entity_type, entity_id, created_at desc);

alter table public.evidence_bridge_links enable row level security;
alter table public.evidence_collection_requests enable row level security;
alter table public.evidence_bridge_reviews enable row level security;
alter table public.evidence_bridge_events enable row level security;

drop policy if exists evidence_bridge_links_read_governance on public.evidence_bridge_links;
create policy evidence_bridge_links_read_governance on public.evidence_bridge_links
for select using (
  owner_user_id = auth.uid()
  or public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer','department_manager']::public.app_role[])
);

drop policy if exists evidence_bridge_links_write_governance on public.evidence_bridge_links;
create policy evidence_bridge_links_write_governance on public.evidence_bridge_links
for all using (public.has_any_role(array['super_admin','governance_admin','compliance_officer','auditor']::public.app_role[]))
with check (public.has_any_role(array['super_admin','governance_admin','compliance_officer','auditor']::public.app_role[]));

drop policy if exists evidence_collection_requests_read_assigned_or_governance on public.evidence_collection_requests;
create policy evidence_collection_requests_read_assigned_or_governance on public.evidence_collection_requests
for select using (
  assigned_to_user_id = auth.uid()
  or requested_by = auth.uid()
  or public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer','department_manager']::public.app_role[])
);

drop policy if exists evidence_collection_requests_write_governance on public.evidence_collection_requests;
create policy evidence_collection_requests_write_governance on public.evidence_collection_requests
for all using (public.has_any_role(array['super_admin','governance_admin','compliance_officer','auditor']::public.app_role[]))
with check (public.has_any_role(array['super_admin','governance_admin','compliance_officer','auditor']::public.app_role[]));

drop policy if exists evidence_collection_requests_update_assigned_owner on public.evidence_collection_requests;
create policy evidence_collection_requests_update_assigned_owner on public.evidence_collection_requests
for update using (assigned_to_user_id = auth.uid() and status in ('open','in_progress','rejected'))
with check (assigned_to_user_id = auth.uid());

drop policy if exists evidence_bridge_reviews_read_governance on public.evidence_bridge_reviews;
create policy evidence_bridge_reviews_read_governance on public.evidence_bridge_reviews
for select using (
  public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer','department_manager']::public.app_role[])
);

drop policy if exists evidence_bridge_reviews_write_reviewers on public.evidence_bridge_reviews;
create policy evidence_bridge_reviews_write_reviewers on public.evidence_bridge_reviews
for all using (public.has_any_role(array['super_admin','governance_admin','compliance_officer','auditor']::public.app_role[]))
with check (public.has_any_role(array['super_admin','governance_admin','compliance_officer','auditor']::public.app_role[]));

drop policy if exists evidence_bridge_events_read_governance on public.evidence_bridge_events;
create policy evidence_bridge_events_read_governance on public.evidence_bridge_events
for select using (
  actor_user_id = auth.uid()
  or public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer']::public.app_role[])
);

drop policy if exists evidence_bridge_events_insert_governance on public.evidence_bridge_events;
create policy evidence_bridge_events_insert_governance on public.evidence_bridge_events
for insert with check (
  public.has_any_role(array['super_admin','governance_admin','compliance_officer','auditor']::public.app_role[])
);

drop trigger if exists trg_patch33_evidence_bridge_links_updated_at on public.evidence_bridge_links;
create trigger trg_patch33_evidence_bridge_links_updated_at
before update on public.evidence_bridge_links
for each row execute function public.set_updated_at();

create or replace view public.v_patch33_clause_control_evidence_bridge as
select
  b.id as bridge_link_id,
  b.clause_id,
  c.clause_code,
  c.clause_title,
  s.framework,
  s.standard_code,
  b.control_id,
  b.evidence_id,
  b.document_id,
  b.sop_id,
  b.linked_entity_type,
  b.linked_entity_id,
  b.bridge_role,
  b.evidence_status,
  b.freshness_status,
  b.valid_from,
  b.valid_until,
  b.owner_user_id,
  p.full_name as owner_name,
  b.department_id,
  d.name as department_name,
  b.active,
  b.updated_at
from public.evidence_bridge_links b
left join public.accreditation_clauses c on c.id = b.clause_id
left join public.accreditation_standards s on s.id = c.standard_id
left join public.profiles p on p.id = b.owner_user_id
left join public.departments d on d.id = b.department_id
where b.active = true;

create or replace view public.v_patch33_live_evidence_gap_register as
select *
from public.v_patch33_clause_control_evidence_bridge
where evidence_status in ('missing','pending_collection','pending_review','rejected','stale','expired')
   or freshness_status in ('stale','expired','unknown');

create or replace view public.v_patch33_evidence_collection_queue as
select
  r.*,
  b.evidence_status,
  b.freshness_status,
  c.clause_code,
  c.clause_title,
  d.name as assigned_department_name,
  p.full_name as assigned_user_name,
  case when r.due_date is not null and r.due_date < current_date and r.status not in ('accepted','cancelled','waived') then true else false end as is_overdue
from public.evidence_collection_requests r
left join public.evidence_bridge_links b on b.id = r.bridge_link_id
left join public.accreditation_clauses c on c.id = r.clause_id
left join public.departments d on d.id = r.assigned_to_department_id
left join public.profiles p on p.id = r.assigned_to_user_id
where r.status not in ('accepted','cancelled','waived');

create or replace view public.v_patch33_overdue_evidence_requests as
select *
from public.v_patch33_evidence_collection_queue
where is_overdue = true;

create or replace view public.v_patch33_stale_expired_evidence_register as
select *
from public.v_patch33_clause_control_evidence_bridge
where freshness_status in ('stale','expired')
   or evidence_status in ('stale','expired')
   or (valid_until is not null and valid_until < current_date);

create or replace view public.v_patch33_evidence_review_queue as
select
  rv.*,
  r.request_title,
  r.clause_id,
  c.clause_code,
  c.clause_title,
  b.evidence_status,
  b.freshness_status
from public.evidence_bridge_reviews rv
left join public.evidence_collection_requests r on r.id = rv.collection_request_id
left join public.evidence_bridge_links b on b.id = coalesce(rv.bridge_link_id, r.bridge_link_id)
left join public.accreditation_clauses c on c.id = coalesce(r.clause_id, b.clause_id)
where rv.review_status in ('pending_review','needs_rework');

create or replace view public.v_patch33_department_evidence_readiness as
select
  department_id,
  department_name,
  count(*) as bridge_link_count,
  count(*) filter (where evidence_status = 'accepted' and freshness_status = 'current') as ready_evidence_count,
  count(*) filter (where evidence_status in ('missing','pending_collection','pending_review','rejected','stale','expired') or freshness_status in ('stale','expired','unknown')) as gap_count,
  avg(case when evidence_status = 'accepted' and freshness_status = 'current' then 100 else 0 end) as evidence_readiness_score
from public.v_patch33_clause_control_evidence_bridge
group by department_id, department_name;

create or replace view public.v_patch33_clause_evidence_readiness as
select
  clause_id,
  clause_code,
  clause_title,
  framework,
  standard_code,
  count(*) as bridge_link_count,
  count(*) filter (where bridge_role in ('primary_evidence','control_evidence')) as primary_bridge_count,
  count(*) filter (where evidence_status = 'accepted' and freshness_status = 'current') as accepted_current_count,
  count(*) filter (where evidence_status in ('missing','pending_collection','pending_review','rejected','stale','expired') or freshness_status in ('stale','expired','unknown')) as evidence_gap_count,
  case
    when count(*) = 0 then 'no_bridge_links'
    when count(*) filter (where evidence_status in ('missing','pending_collection','pending_review','rejected','stale','expired') or freshness_status in ('stale','expired','unknown')) > 0 then 'evidence_gaps_open'
    else 'ready_for_reviewer_signoff'
  end as readiness_status
from public.v_patch33_clause_control_evidence_bridge
group by clause_id, clause_code, clause_title, framework, standard_code;

create or replace view public.v_patch33_capa_training_sop_evidence_dependencies as
select *
from public.v_patch33_clause_control_evidence_bridge
where linked_entity_type in ('capa','training_program','training_assignment','sop','document','risk','audit_finding')
   or bridge_role in ('capa_evidence','training_evidence','sop_evidence','risk_evidence','audit_evidence');

create or replace view public.v_patch33_accreditation_live_readiness_summary as
select
  framework,
  standard_code,
  count(distinct clause_id) as clause_count,
  count(*) as bridge_link_count,
  count(*) filter (where evidence_status = 'accepted' and freshness_status = 'current') as accepted_current_evidence_count,
  count(*) filter (where evidence_status in ('missing','pending_collection','pending_review','rejected','stale','expired') or freshness_status in ('stale','expired','unknown')) as evidence_gap_count,
  avg(case when evidence_status = 'accepted' and freshness_status = 'current' then 100 else 0 end) as live_evidence_readiness_score
from public.v_patch33_clause_control_evidence_bridge
group by framework, standard_code;

create or replace view public.v_patch33_evidence_exception_register as
select *
from public.v_patch33_clause_control_evidence_bridge
where evidence_status in ('missing','pending_collection','rejected','stale','expired')
   or freshness_status in ('stale','expired')
   or (valid_until is not null and valid_until < current_date);

create or replace view public.v_patch33_executive_evidence_bridge_summary as
select
  count(*) as total_bridge_links,
  count(distinct clause_id) as clauses_with_bridge_links,
  count(*) filter (where evidence_status = 'accepted' and freshness_status = 'current') as ready_links,
  count(*) filter (where evidence_status in ('missing','pending_collection','pending_review','rejected','stale','expired') or freshness_status in ('stale','expired','unknown')) as gap_links,
  count(*) filter (where freshness_status in ('stale','expired')) as stale_or_expired_links,
  count(*) filter (where linked_entity_type in ('capa','risk','audit_finding','training_program','training_assignment','sop','document')) as dependency_links,
  avg(case when evidence_status = 'accepted' and freshness_status = 'current' then 100 else 0 end) as overall_evidence_readiness_score
from public.v_patch33_clause_control_evidence_bridge;

alter view public.v_patch33_clause_control_evidence_bridge set (security_invoker = true);
alter view public.v_patch33_live_evidence_gap_register set (security_invoker = true);
alter view public.v_patch33_evidence_collection_queue set (security_invoker = true);
alter view public.v_patch33_overdue_evidence_requests set (security_invoker = true);
alter view public.v_patch33_stale_expired_evidence_register set (security_invoker = true);
alter view public.v_patch33_evidence_review_queue set (security_invoker = true);
alter view public.v_patch33_department_evidence_readiness set (security_invoker = true);
alter view public.v_patch33_clause_evidence_readiness set (security_invoker = true);
alter view public.v_patch33_capa_training_sop_evidence_dependencies set (security_invoker = true);
alter view public.v_patch33_accreditation_live_readiness_summary set (security_invoker = true);
alter view public.v_patch33_evidence_exception_register set (security_invoker = true);
alter view public.v_patch33_executive_evidence_bridge_summary set (security_invoker = true);

grant select on public.v_patch33_clause_control_evidence_bridge to authenticated;
grant select on public.v_patch33_live_evidence_gap_register to authenticated;
grant select on public.v_patch33_evidence_collection_queue to authenticated;
grant select on public.v_patch33_overdue_evidence_requests to authenticated;
grant select on public.v_patch33_stale_expired_evidence_register to authenticated;
grant select on public.v_patch33_evidence_review_queue to authenticated;
grant select on public.v_patch33_department_evidence_readiness to authenticated;
grant select on public.v_patch33_clause_evidence_readiness to authenticated;
grant select on public.v_patch33_capa_training_sop_evidence_dependencies to authenticated;
grant select on public.v_patch33_accreditation_live_readiness_summary to authenticated;
grant select on public.v_patch33_evidence_exception_register to authenticated;
grant select on public.v_patch33_executive_evidence_bridge_summary to authenticated;

create or replace function public.patch33_actor_has_evidence_bridge_authority(p_actor_user_id uuid)
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p_actor_user_id
      and ur.is_active = true
      and ur.role in ('super_admin','governance_admin','compliance_officer','auditor')
  );
$$;

create or replace function public.patch33_actor_can_submit_request(p_request_id uuid, p_actor_user_id uuid)
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.evidence_collection_requests r
    where r.id = p_request_id and r.assigned_to_user_id = p_actor_user_id
  ) or public.patch33_actor_has_evidence_bridge_authority(p_actor_user_id);
$$;

create or replace function public.record_evidence_bridge_event(
  p_entity_type text,
  p_entity_id uuid,
  p_event_type text,
  p_event_summary text,
  p_actor_user_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event_id uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then raise exception 'PATCH33_SERVICE_ROLE_REQUIRED'; end if;
  if p_actor_user_id is not null
     and not public.patch33_actor_has_evidence_bridge_authority(p_actor_user_id)
     and not exists (select 1 from public.evidence_collection_requests r where r.id = p_entity_id and r.assigned_to_user_id = p_actor_user_id) then
    raise exception 'PATCH33_EVIDENCE_BRIDGE_AUTHORITY_REQUIRED';
  end if;
  insert into public.evidence_bridge_events (entity_type, entity_id, event_type, event_summary, actor_user_id)
  values (p_entity_type, p_entity_id, p_event_type, p_event_summary, p_actor_user_id)
  returning id into v_event_id;
  return v_event_id;
end;
$$;

create or replace function public.create_evidence_bridge_link(
  p_linked_entity_type text,
  p_linked_entity_id uuid,
  p_actor_user_id uuid,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_bridge_id uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role' and current_user <> 'service_role' then raise exception 'PATCH33_SERVICE_ROLE_REQUIRED'; end if;
  if not public.patch33_actor_has_evidence_bridge_authority(p_actor_user_id) then raise exception 'PATCH33_EVIDENCE_BRIDGE_AUTHORITY_REQUIRED'; end if;
  insert into public.evidence_bridge_links (
    clause_id, control_id, evidence_id, document_id, sop_id, linked_entity_type, linked_entity_id,
    bridge_role, evidence_status, freshness_status, valid_from, valid_until, owner_user_id,
    department_id, active, created_by, updated_by
  )
  values (
    nullif(p_payload->>'clause_id','')::uuid,
    nullif(p_payload->>'control_id','')::uuid,
    nullif(p_payload->>'evidence_id','')::uuid,
    nullif(p_payload->>'document_id','')::uuid,
    nullif(p_payload->>'sop_id','')::uuid,
    p_linked_entity_type,
    p_linked_entity_id,
    coalesce(nullif(p_payload->>'bridge_role',''), 'supporting'),
    coalesce(nullif(p_payload->>'evidence_status',''), 'pending_review'),
    coalesce(nullif(p_payload->>'freshness_status',''), 'unknown'),
    nullif(p_payload->>'valid_from','')::date,
    nullif(p_payload->>'valid_until','')::date,
    nullif(p_payload->>'owner_user_id','')::uuid,
    nullif(p_payload->>'department_id','')::uuid,
    coalesce(nullif(p_payload->>'active','')::boolean, true),
    p_actor_user_id,
    p_actor_user_id
  )
  returning id into v_bridge_id;
  perform public.record_evidence_bridge_event('evidence_bridge_link', v_bridge_id, 'bridge_link_created', 'Evidence bridge link created.', p_actor_user_id);
  return v_bridge_id;
end;
$$;

create or replace function public.update_evidence_bridge_status(
  p_bridge_link_id uuid,
  p_evidence_status text,
  p_freshness_status text,
  p_actor_user_id uuid,
  p_update_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role' and current_user <> 'service_role' then raise exception 'PATCH33_SERVICE_ROLE_REQUIRED'; end if;
  if not public.patch33_actor_has_evidence_bridge_authority(p_actor_user_id) then raise exception 'PATCH33_EVIDENCE_BRIDGE_AUTHORITY_REQUIRED'; end if;
  update public.evidence_bridge_links
  set evidence_status = p_evidence_status,
      freshness_status = p_freshness_status,
      updated_by = p_actor_user_id,
      updated_at = now()
  where id = p_bridge_link_id;
  if not found then raise exception 'PATCH33_BRIDGE_LINK_NOT_FOUND'; end if;
  perform public.record_evidence_bridge_event('evidence_bridge_link', p_bridge_link_id, 'bridge_status_updated', coalesce(p_update_note, 'Evidence bridge status updated.'), p_actor_user_id);
  return jsonb_build_object('status','ok','bridge_link_id',p_bridge_link_id);
end;
$$;

create or replace function public.create_evidence_collection_request(
  p_request_title text,
  p_requested_entity_type text,
  p_actor_user_id uuid,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request_id uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role' and current_user <> 'service_role' then raise exception 'PATCH33_SERVICE_ROLE_REQUIRED'; end if;
  if not public.patch33_actor_has_evidence_bridge_authority(p_actor_user_id) then raise exception 'PATCH33_EVIDENCE_BRIDGE_AUTHORITY_REQUIRED'; end if;
  insert into public.evidence_collection_requests (
    bridge_link_id, clause_id, requested_entity_type, requested_entity_id, request_title,
    request_description, assigned_to_user_id, assigned_to_department_id, due_date, priority,
    status, requested_by
  )
  values (
    nullif(p_payload->>'bridge_link_id','')::uuid,
    nullif(p_payload->>'clause_id','')::uuid,
    p_requested_entity_type,
    nullif(p_payload->>'requested_entity_id','')::uuid,
    p_request_title,
    p_payload->>'request_description',
    nullif(p_payload->>'assigned_to_user_id','')::uuid,
    nullif(p_payload->>'assigned_to_department_id','')::uuid,
    nullif(p_payload->>'due_date','')::date,
    coalesce(nullif(p_payload->>'priority',''), 'medium'),
    coalesce(nullif(p_payload->>'status',''), 'open'),
    p_actor_user_id
  )
  returning id into v_request_id;
  perform public.record_evidence_bridge_event('evidence_collection_request', v_request_id, 'collection_request_created', 'Evidence collection request created.', p_actor_user_id);
  return v_request_id;
end;
$$;

create or replace function public.submit_evidence_collection_request(
  p_collection_request_id uuid,
  p_submitted_evidence_id uuid,
  p_actor_user_id uuid,
  p_submission_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_bridge_id uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role' and current_user <> 'service_role' then raise exception 'PATCH33_SERVICE_ROLE_REQUIRED'; end if;
  if not public.patch33_actor_can_submit_request(p_collection_request_id, p_actor_user_id) then raise exception 'PATCH33_EVIDENCE_OWNER_OR_AUTHORITY_REQUIRED'; end if;
  update public.evidence_collection_requests
  set submitted_evidence_id = p_submitted_evidence_id,
      status = 'submitted',
      completed_at = null
  where id = p_collection_request_id
  returning bridge_link_id into v_bridge_id;
  if not found then raise exception 'PATCH33_COLLECTION_REQUEST_NOT_FOUND'; end if;
  if v_bridge_id is not null then
    update public.evidence_bridge_links set evidence_id = p_submitted_evidence_id, evidence_status = 'pending_review', updated_by = p_actor_user_id, updated_at = now() where id = v_bridge_id;
  end if;
  perform public.record_evidence_bridge_event('evidence_collection_request', p_collection_request_id, 'collection_request_submitted', coalesce(p_submission_note, 'Evidence collection request submitted.'), p_actor_user_id);
  return jsonb_build_object('status','ok','collection_request_id',p_collection_request_id);
end;
$$;

create or replace function public.review_evidence_bridge_submission(
  p_bridge_link_id uuid,
  p_collection_request_id uuid,
  p_evidence_id uuid,
  p_review_status text,
  p_actor_user_id uuid,
  p_review_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_review_id uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role' and current_user <> 'service_role' then raise exception 'PATCH33_SERVICE_ROLE_REQUIRED'; end if;
  if not public.patch33_actor_has_evidence_bridge_authority(p_actor_user_id) then raise exception 'PATCH33_REVIEW_AUTHORITY_REQUIRED'; end if;
  insert into public.evidence_bridge_reviews (bridge_link_id, collection_request_id, evidence_id, review_status, review_notes, reviewed_by, reviewed_at)
  values (p_bridge_link_id, p_collection_request_id, p_evidence_id, p_review_status, p_review_notes, p_actor_user_id, now())
  returning id into v_review_id;
  perform public.record_evidence_bridge_event('evidence_bridge_review', v_review_id, 'submission_reviewed', coalesce(p_review_notes, 'Evidence bridge submission reviewed.'), p_actor_user_id);
  return v_review_id;
end;
$$;

create or replace function public.accept_evidence_bridge_submission(
  p_bridge_link_id uuid,
  p_collection_request_id uuid,
  p_evidence_id uuid,
  p_actor_user_id uuid,
  p_review_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_review_id uuid;
begin
  v_review_id := public.review_evidence_bridge_submission(p_bridge_link_id, p_collection_request_id, p_evidence_id, 'accepted', p_actor_user_id, p_review_notes);
  update public.evidence_bridge_links set evidence_id = coalesce(p_evidence_id, evidence_id), evidence_status = 'accepted', freshness_status = case when valid_until is not null and valid_until < current_date then 'expired' else 'current' end, updated_by = p_actor_user_id, updated_at = now() where id = p_bridge_link_id;
  update public.evidence_collection_requests set status = 'accepted', completed_at = now(), submitted_evidence_id = coalesce(p_evidence_id, submitted_evidence_id) where id = p_collection_request_id;
  perform public.record_evidence_bridge_event('evidence_bridge_review', v_review_id, 'submission_accepted', coalesce(p_review_notes, 'Evidence bridge submission accepted.'), p_actor_user_id);
  return v_review_id;
end;
$$;

create or replace function public.reject_evidence_bridge_submission(
  p_bridge_link_id uuid,
  p_collection_request_id uuid,
  p_evidence_id uuid,
  p_actor_user_id uuid,
  p_rejection_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_review_id uuid;
begin
  if nullif(trim(coalesce(p_rejection_reason,'')), '') is null then raise exception 'PATCH33_REJECTION_REASON_REQUIRED'; end if;
  v_review_id := public.review_evidence_bridge_submission(p_bridge_link_id, p_collection_request_id, p_evidence_id, 'rejected', p_actor_user_id, p_rejection_reason);
  update public.evidence_bridge_links set evidence_status = 'rejected', updated_by = p_actor_user_id, updated_at = now() where id = p_bridge_link_id;
  update public.evidence_collection_requests set status = 'rejected' where id = p_collection_request_id;
  perform public.record_evidence_bridge_event('evidence_bridge_review', v_review_id, 'submission_rejected', p_rejection_reason, p_actor_user_id);
  return v_review_id;
end;
$$;

create or replace function public.waive_evidence_collection_request(
  p_collection_request_id uuid,
  p_actor_user_id uuid,
  p_waiver_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_bridge_id uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role' and current_user <> 'service_role' then raise exception 'PATCH33_SERVICE_ROLE_REQUIRED'; end if;
  if not public.patch33_actor_has_evidence_bridge_authority(p_actor_user_id) then raise exception 'PATCH33_EVIDENCE_BRIDGE_AUTHORITY_REQUIRED'; end if;
  if nullif(trim(coalesce(p_waiver_reason,'')), '') is null then raise exception 'PATCH33_WAIVER_REASON_REQUIRED'; end if;
  update public.evidence_collection_requests set status = 'waived', completed_at = now() where id = p_collection_request_id returning bridge_link_id into v_bridge_id;
  if not found then raise exception 'PATCH33_COLLECTION_REQUEST_NOT_FOUND'; end if;
  if v_bridge_id is not null then update public.evidence_bridge_links set evidence_status = 'not_applicable', updated_by = p_actor_user_id, updated_at = now() where id = v_bridge_id; end if;
  perform public.record_evidence_bridge_event('evidence_collection_request', p_collection_request_id, 'collection_request_waived', p_waiver_reason, p_actor_user_id);
  return jsonb_build_object('status','ok','collection_request_id',p_collection_request_id);
end;
$$;

create or replace function public.reopen_evidence_collection_request(
  p_collection_request_id uuid,
  p_actor_user_id uuid,
  p_reopen_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_bridge_id uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role' and current_user <> 'service_role' then raise exception 'PATCH33_SERVICE_ROLE_REQUIRED'; end if;
  if not public.patch33_actor_has_evidence_bridge_authority(p_actor_user_id) then raise exception 'PATCH33_EVIDENCE_BRIDGE_AUTHORITY_REQUIRED'; end if;
  if nullif(trim(coalesce(p_reopen_reason,'')), '') is null then raise exception 'PATCH33_REOPEN_REASON_REQUIRED'; end if;
  update public.evidence_collection_requests set status = 'open', completed_at = null where id = p_collection_request_id returning bridge_link_id into v_bridge_id;
  if not found then raise exception 'PATCH33_COLLECTION_REQUEST_NOT_FOUND'; end if;
  if v_bridge_id is not null then update public.evidence_bridge_links set evidence_status = 'pending_collection', updated_by = p_actor_user_id, updated_at = now() where id = v_bridge_id; end if;
  perform public.record_evidence_bridge_event('evidence_collection_request', p_collection_request_id, 'collection_request_reopened', p_reopen_reason, p_actor_user_id);
  return jsonb_build_object('status','ok','collection_request_id',p_collection_request_id);
end;
$$;

create or replace function public.mark_evidence_bridge_not_applicable(
  p_bridge_link_id uuid,
  p_actor_user_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role' and current_user <> 'service_role' then raise exception 'PATCH33_SERVICE_ROLE_REQUIRED'; end if;
  if not public.patch33_actor_has_evidence_bridge_authority(p_actor_user_id) then raise exception 'PATCH33_EVIDENCE_BRIDGE_AUTHORITY_REQUIRED'; end if;
  if nullif(trim(coalesce(p_reason,'')), '') is null then raise exception 'PATCH33_NOT_APPLICABLE_REASON_REQUIRED'; end if;
  update public.evidence_bridge_links set evidence_status = 'not_applicable', freshness_status = 'current', updated_by = p_actor_user_id, updated_at = now() where id = p_bridge_link_id;
  if not found then raise exception 'PATCH33_BRIDGE_LINK_NOT_FOUND'; end if;
  perform public.record_evidence_bridge_event('evidence_bridge_link', p_bridge_link_id, 'bridge_marked_not_applicable', p_reason, p_actor_user_id);
  return jsonb_build_object('status','ok','bridge_link_id',p_bridge_link_id);
end;
$$;

create or replace function public.refresh_evidence_freshness_status(
  p_bridge_link_id uuid,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role' and current_user <> 'service_role' then raise exception 'PATCH33_SERVICE_ROLE_REQUIRED'; end if;
  if not public.patch33_actor_has_evidence_bridge_authority(p_actor_user_id) then raise exception 'PATCH33_EVIDENCE_BRIDGE_AUTHORITY_REQUIRED'; end if;
  update public.evidence_bridge_links
  set freshness_status = case
      when valid_until is null then 'unknown'
      when valid_until < current_date then 'expired'
      when valid_until <= current_date + interval '30 days' then 'due_soon'
      else 'current'
    end,
    evidence_status = case
      when valid_until is not null and valid_until < current_date and evidence_status = 'accepted' then 'expired'
      else evidence_status
    end,
    updated_by = p_actor_user_id,
    updated_at = now()
  where id = p_bridge_link_id
  returning freshness_status into v_status;
  if not found then raise exception 'PATCH33_BRIDGE_LINK_NOT_FOUND'; end if;
  perform public.record_evidence_bridge_event('evidence_bridge_link', p_bridge_link_id, 'freshness_refreshed', 'Evidence freshness status refreshed.', p_actor_user_id);
  return jsonb_build_object('status','ok','bridge_link_id',p_bridge_link_id,'freshness_status',v_status);
end;
$$;

create or replace function public.get_clause_evidence_bridge(p_clause_id uuid)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'clause_id', p_clause_id,
    'bridge_links', coalesce((select jsonb_agg(to_jsonb(b)) from public.v_patch33_clause_control_evidence_bridge b where b.clause_id = p_clause_id), '[]'::jsonb),
    'collection_requests', coalesce((select jsonb_agg(to_jsonb(r)) from public.v_patch33_evidence_collection_queue r where r.clause_id = p_clause_id), '[]'::jsonb),
    'readiness', coalesce((select to_jsonb(c) from public.v_patch33_clause_evidence_readiness c where c.clause_id = p_clause_id), '{}'::jsonb)
  );
$$;

create or replace function public.get_live_evidence_readiness_summary()
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'executive_summary', coalesce((select to_jsonb(s) from public.v_patch33_executive_evidence_bridge_summary s), '{}'::jsonb),
    'framework_summary', coalesce((select jsonb_agg(to_jsonb(r)) from public.v_patch33_accreditation_live_readiness_summary r), '[]'::jsonb),
    'department_readiness', coalesce((select jsonb_agg(to_jsonb(d)) from public.v_patch33_department_evidence_readiness d), '[]'::jsonb)
  );
$$;

revoke all on function public.patch33_actor_has_evidence_bridge_authority(uuid) from public, anon, authenticated;
grant execute on function public.patch33_actor_has_evidence_bridge_authority(uuid) to service_role;

revoke all on function public.patch33_actor_can_submit_request(uuid, uuid) from public, anon, authenticated;
grant execute on function public.patch33_actor_can_submit_request(uuid, uuid) to service_role;

revoke all on function public.record_evidence_bridge_event(text, uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.record_evidence_bridge_event(text, uuid, text, text, uuid) to service_role;

revoke all on function public.create_evidence_bridge_link(text, uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.create_evidence_bridge_link(text, uuid, uuid, jsonb) to service_role;

revoke all on function public.update_evidence_bridge_status(uuid, text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.update_evidence_bridge_status(uuid, text, text, uuid, text) to service_role;

revoke all on function public.create_evidence_collection_request(text, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.create_evidence_collection_request(text, text, uuid, jsonb) to service_role;

revoke all on function public.submit_evidence_collection_request(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.submit_evidence_collection_request(uuid, uuid, uuid, text) to service_role;

revoke all on function public.review_evidence_bridge_submission(uuid, uuid, uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.review_evidence_bridge_submission(uuid, uuid, uuid, text, uuid, text) to service_role;

revoke all on function public.accept_evidence_bridge_submission(uuid, uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.accept_evidence_bridge_submission(uuid, uuid, uuid, uuid, text) to service_role;

revoke all on function public.reject_evidence_bridge_submission(uuid, uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.reject_evidence_bridge_submission(uuid, uuid, uuid, uuid, text) to service_role;

revoke all on function public.waive_evidence_collection_request(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.waive_evidence_collection_request(uuid, uuid, text) to service_role;

revoke all on function public.reopen_evidence_collection_request(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.reopen_evidence_collection_request(uuid, uuid, text) to service_role;

revoke all on function public.mark_evidence_bridge_not_applicable(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.mark_evidence_bridge_not_applicable(uuid, uuid, text) to service_role;

revoke all on function public.refresh_evidence_freshness_status(uuid, uuid) from public, anon, authenticated;
grant execute on function public.refresh_evidence_freshness_status(uuid, uuid) to service_role;

revoke all on function public.get_clause_evidence_bridge(uuid) from public, anon, authenticated;
grant execute on function public.get_clause_evidence_bridge(uuid) to service_role;

revoke all on function public.get_live_evidence_readiness_summary() from public, anon, authenticated;
grant execute on function public.get_live_evidence_readiness_summary() to service_role;

comment on table public.evidence_bridge_links is 'Patch 33 operational bridge from accreditation clauses and controls/documents/SOPs to live evidence readiness.';
comment on table public.evidence_collection_requests is 'Patch 33 evidence owner collection queue for accreditation readiness gaps.';
comment on table public.evidence_bridge_reviews is 'Patch 33 reviewer signoff records for submitted bridge evidence.';
comment on table public.evidence_bridge_events is 'Patch 33 audit trail for evidence bridge operations.';
