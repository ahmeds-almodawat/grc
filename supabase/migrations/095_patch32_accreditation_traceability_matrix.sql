-- =========================================================
-- Patch 32: Accreditation Traceability Matrix
-- Clause-to-control/SOP/evidence/CAPA/risk/audit/training/readiness layer.
-- =========================================================

create table if not exists public.accreditation_standards (
  id uuid primary key default gen_random_uuid(),
  standard_code text not null unique,
  standard_name text not null,
  standard_name_ar text,
  framework text not null default 'CBAHI',
  version text,
  active boolean not null default true,
  created_at timestamptz default now(),
  created_by uuid references public.profiles(id) on delete set null
);

create table if not exists public.accreditation_clauses (
  id uuid primary key default gen_random_uuid(),
  standard_id uuid not null references public.accreditation_standards(id) on delete cascade,
  clause_code text not null,
  clause_title text not null,
  clause_title_ar text,
  clause_description text,
  clause_category text,
  department_id uuid references public.departments(id) on delete set null,
  owner_user_id uuid references public.profiles(id) on delete set null,
  criticality text not null default 'medium' check (criticality in ('critical','high','medium','low')),
  active boolean not null default true,
  created_at timestamptz default now(),
  created_by uuid references public.profiles(id) on delete set null,
  unique (standard_id, clause_code)
);

create table if not exists public.accreditation_clause_links (
  id uuid primary key default gen_random_uuid(),
  clause_id uuid not null references public.accreditation_clauses(id) on delete cascade,
  linked_entity_type text not null check (linked_entity_type in (
    'control','sop','document','evidence','capa','risk','audit_finding',
    'training_program','training_assignment','approval_authority','policy'
  )),
  linked_entity_id uuid not null,
  link_strength text not null default 'supporting' check (link_strength in ('primary','supporting','reference','gap')),
  link_notes text,
  active boolean not null default true,
  created_at timestamptz default now(),
  created_by uuid references public.profiles(id) on delete set null,
  unique (clause_id, linked_entity_type, linked_entity_id)
);

create table if not exists public.accreditation_clause_assessments (
  id uuid primary key default gen_random_uuid(),
  clause_id uuid not null references public.accreditation_clauses(id) on delete cascade,
  assessment_status text not null default 'not_assessed' check (assessment_status in (
    'not_assessed','ready','partial_gap','major_gap','not_applicable',
    'pending_evidence','pending_owner_review'
  )),
  readiness_score numeric check (readiness_score is null or (readiness_score >= 0 and readiness_score <= 100)),
  evidence_status text not null default 'missing' check (evidence_status in ('missing','partial','complete','outdated','under_review')),
  assessment_notes text,
  assessed_by uuid references public.profiles(id) on delete set null,
  assessed_at timestamptz default now()
);

create table if not exists public.accreditation_traceability_events (
  id uuid primary key default gen_random_uuid(),
  clause_id uuid references public.accreditation_clauses(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  event_type text not null check (event_type in (
    'standard_created','clause_created','entity_linked','entity_unlinked',
    'clause_assessed','marked_not_applicable','assessment_reopened','traceability_viewed'
  )),
  event_summary text not null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

create index if not exists idx_patch32_standards_framework on public.accreditation_standards(framework, active);
create index if not exists idx_patch32_clauses_standard on public.accreditation_clauses(standard_id, active);
create index if not exists idx_patch32_clauses_department on public.accreditation_clauses(department_id);
create index if not exists idx_patch32_clauses_owner on public.accreditation_clauses(owner_user_id);
create index if not exists idx_patch32_clause_links_clause on public.accreditation_clause_links(clause_id, active);
create index if not exists idx_patch32_clause_links_entity on public.accreditation_clause_links(linked_entity_type, linked_entity_id);
create index if not exists idx_patch32_assessments_clause on public.accreditation_clause_assessments(clause_id, assessed_at desc);
create index if not exists idx_patch32_assessments_status on public.accreditation_clause_assessments(assessment_status, evidence_status);
create index if not exists idx_patch32_events_clause on public.accreditation_traceability_events(clause_id, created_at desc);
create index if not exists idx_patch32_events_entity on public.accreditation_traceability_events(entity_type, entity_id);

alter table public.accreditation_standards enable row level security;
alter table public.accreditation_clauses enable row level security;
alter table public.accreditation_clause_links enable row level security;
alter table public.accreditation_clause_assessments enable row level security;
alter table public.accreditation_traceability_events enable row level security;

drop policy if exists accreditation_standards_read on public.accreditation_standards;
create policy accreditation_standards_read on public.accreditation_standards
for select using (public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer','department_manager']::public.app_role[]));

drop policy if exists accreditation_standards_write on public.accreditation_standards;
create policy accreditation_standards_write on public.accreditation_standards
for all using (public.has_any_role(array['super_admin','governance_admin','compliance_officer']::public.app_role[]))
with check (public.has_any_role(array['super_admin','governance_admin','compliance_officer']::public.app_role[]));

drop policy if exists accreditation_clauses_read on public.accreditation_clauses;
create policy accreditation_clauses_read on public.accreditation_clauses
for select using (public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer','department_manager']::public.app_role[]));

drop policy if exists accreditation_clauses_write on public.accreditation_clauses;
create policy accreditation_clauses_write on public.accreditation_clauses
for all using (public.has_any_role(array['super_admin','governance_admin','compliance_officer']::public.app_role[]))
with check (public.has_any_role(array['super_admin','governance_admin','compliance_officer']::public.app_role[]));

drop policy if exists accreditation_clause_links_read on public.accreditation_clause_links;
create policy accreditation_clause_links_read on public.accreditation_clause_links
for select using (public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer','department_manager']::public.app_role[]));

drop policy if exists accreditation_clause_links_write on public.accreditation_clause_links;
create policy accreditation_clause_links_write on public.accreditation_clause_links
for all using (public.has_any_role(array['super_admin','governance_admin','compliance_officer']::public.app_role[]))
with check (public.has_any_role(array['super_admin','governance_admin','compliance_officer']::public.app_role[]));

drop policy if exists accreditation_clause_assessments_read on public.accreditation_clause_assessments;
create policy accreditation_clause_assessments_read on public.accreditation_clause_assessments
for select using (public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer','department_manager']::public.app_role[]));

drop policy if exists accreditation_clause_assessments_write on public.accreditation_clause_assessments;
create policy accreditation_clause_assessments_write on public.accreditation_clause_assessments
for all using (public.has_any_role(array['super_admin','governance_admin','compliance_officer','auditor']::public.app_role[]))
with check (public.has_any_role(array['super_admin','governance_admin','compliance_officer','auditor']::public.app_role[]));

drop policy if exists accreditation_traceability_events_read on public.accreditation_traceability_events;
create policy accreditation_traceability_events_read on public.accreditation_traceability_events
for select using (public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer']::public.app_role[]));

drop policy if exists accreditation_traceability_events_insert on public.accreditation_traceability_events;
create policy accreditation_traceability_events_insert on public.accreditation_traceability_events
for insert with check (public.has_any_role(array['super_admin','governance_admin','compliance_officer','auditor']::public.app_role[]));

create or replace view public.v_patch32_accreditation_clause_register as
select
  c.id as clause_id,
  s.id as standard_id,
  s.framework,
  s.standard_code,
  s.standard_name,
  s.standard_name_ar,
  s.version,
  c.clause_code,
  c.clause_title,
  c.clause_title_ar,
  c.clause_description,
  c.clause_category,
  c.department_id,
  d.name as department_name,
  c.owner_user_id,
  p.full_name as owner_name,
  c.criticality,
  c.active,
  c.created_at
from public.accreditation_clauses c
join public.accreditation_standards s on s.id = c.standard_id
left join public.departments d on d.id = c.department_id
left join public.profiles p on p.id = c.owner_user_id
where s.active = true and c.active = true;

create or replace view public.v_patch32_clause_traceability_matrix as
select
  r.*,
  count(l.id) filter (where l.active) as linked_entity_count,
  count(l.id) filter (where l.linked_entity_type = 'control' and l.active) as control_link_count,
  count(l.id) filter (where l.linked_entity_type in ('sop','document','policy') and l.active) as sop_document_link_count,
  count(l.id) filter (where l.linked_entity_type = 'evidence' and l.active) as evidence_link_count,
  count(l.id) filter (where l.linked_entity_type = 'capa' and l.active) as capa_link_count,
  count(l.id) filter (where l.linked_entity_type = 'risk' and l.active) as risk_link_count,
  count(l.id) filter (where l.linked_entity_type = 'audit_finding' and l.active) as audit_finding_link_count,
  count(l.id) filter (where l.linked_entity_type in ('training_program','training_assignment') and l.active) as training_link_count,
  count(l.id) filter (where l.linked_entity_type = 'approval_authority' and l.active) as approval_authority_link_count
from public.v_patch32_accreditation_clause_register r
left join public.accreditation_clause_links l on l.clause_id = r.clause_id
group by r.clause_id, r.standard_id, r.framework, r.standard_code, r.standard_name, r.standard_name_ar,
  r.version, r.clause_code, r.clause_title, r.clause_title_ar, r.clause_description, r.clause_category,
  r.department_id, r.department_name, r.owner_user_id, r.owner_name, r.criticality, r.active, r.created_at;

create or replace view public.v_patch32_clause_evidence_gap_summary as
select
  m.*,
  a.assessment_status,
  a.evidence_status,
  a.readiness_score,
  case
    when coalesce(m.evidence_link_count, 0) = 0 then 'missing_evidence_link'
    when coalesce(a.evidence_status, 'missing') in ('missing','partial','outdated','under_review') then 'evidence_not_ready'
    else 'evidence_ready'
  end as evidence_gap_status
from public.v_patch32_clause_traceability_matrix m
left join lateral (
  select *
  from public.accreditation_clause_assessments a
  where a.clause_id = m.clause_id
  order by a.assessed_at desc
  limit 1
) a on true;

create or replace view public.v_patch32_clause_sop_document_gap_summary as
select
  m.*,
  case
    when coalesce(m.sop_document_link_count, 0) = 0 then 'missing_sop_document_link'
    else 'sop_document_linked'
  end as sop_document_gap_status
from public.v_patch32_clause_traceability_matrix m;

create or replace view public.v_patch32_clause_capa_risk_audit_summary as
select
  m.*,
  (coalesce(m.capa_link_count, 0) + coalesce(m.risk_link_count, 0) + coalesce(m.audit_finding_link_count, 0)) as issue_link_count,
  case
    when (coalesce(m.capa_link_count, 0) + coalesce(m.risk_link_count, 0) + coalesce(m.audit_finding_link_count, 0)) > 0 then 'issue_links_present'
    else 'no_issue_links'
  end as issue_traceability_status
from public.v_patch32_clause_traceability_matrix m;

create or replace view public.v_patch32_clause_training_readiness_summary as
select
  m.*,
  case
    when coalesce(m.training_link_count, 0) = 0 then 'training_not_linked'
    else 'training_linked'
  end as training_readiness_status
from public.v_patch32_clause_traceability_matrix m;

create or replace view public.v_patch32_department_accreditation_readiness as
select
  department_id,
  department_name,
  count(*) as clause_count,
  avg(coalesce(readiness_score, 0)) as average_readiness_score,
  count(*) filter (where assessment_status = 'ready') as ready_clause_count,
  count(*) filter (where assessment_status in ('partial_gap','major_gap','pending_evidence','pending_owner_review','not_assessed') or assessment_status is null) as open_gap_count,
  count(*) filter (where evidence_gap_status <> 'evidence_ready') as evidence_gap_count
from public.v_patch32_clause_evidence_gap_summary
group by department_id, department_name;

create or replace view public.v_patch32_accreditation_executive_summary as
select
  e.framework,
  count(*) as active_clause_count,
  avg(coalesce(readiness_score, 0)) as average_readiness_score,
  count(*) filter (where assessment_status = 'ready') as ready_clause_count,
  count(*) filter (where evidence_gap_status <> 'evidence_ready') as evidence_gap_count,
  count(*) filter (where sop_document_link_count = 0) as sop_document_gap_count,
  count(*) filter (where training_link_count = 0) as training_gap_count,
  count(*) filter (where issue_link_count > 0) as issue_traceability_count
from public.v_patch32_clause_evidence_gap_summary e
join public.v_patch32_clause_capa_risk_audit_summary i using (clause_id)
group by framework;

create or replace view public.v_patch32_accreditation_exception_register as
select
  e.*,
  s.sop_document_gap_status,
  t.training_readiness_status,
  i.issue_traceability_status
from public.v_patch32_clause_evidence_gap_summary e
join public.v_patch32_clause_sop_document_gap_summary s using (clause_id)
join public.v_patch32_clause_training_readiness_summary t using (clause_id)
join public.v_patch32_clause_capa_risk_audit_summary i using (clause_id)
where e.evidence_gap_status <> 'evidence_ready'
   or s.sop_document_gap_status <> 'sop_document_linked'
   or t.training_readiness_status <> 'training_linked'
   or coalesce(e.assessment_status, 'not_assessed') in ('not_assessed','partial_gap','major_gap','pending_evidence','pending_owner_review');

create or replace view public.v_patch32_accreditation_review_queue as
select *
from public.v_patch32_accreditation_exception_register
where coalesce(assessment_status, 'not_assessed') in ('not_assessed','partial_gap','major_gap','pending_evidence','pending_owner_review')
   or criticality in ('critical','high');

alter view public.v_patch32_accreditation_clause_register set (security_invoker = true);
alter view public.v_patch32_clause_traceability_matrix set (security_invoker = true);
alter view public.v_patch32_clause_evidence_gap_summary set (security_invoker = true);
alter view public.v_patch32_clause_sop_document_gap_summary set (security_invoker = true);
alter view public.v_patch32_clause_capa_risk_audit_summary set (security_invoker = true);
alter view public.v_patch32_clause_training_readiness_summary set (security_invoker = true);
alter view public.v_patch32_department_accreditation_readiness set (security_invoker = true);
alter view public.v_patch32_accreditation_executive_summary set (security_invoker = true);
alter view public.v_patch32_accreditation_exception_register set (security_invoker = true);
alter view public.v_patch32_accreditation_review_queue set (security_invoker = true);

grant select on public.v_patch32_accreditation_clause_register to authenticated;
grant select on public.v_patch32_clause_traceability_matrix to authenticated;
grant select on public.v_patch32_clause_evidence_gap_summary to authenticated;
grant select on public.v_patch32_clause_sop_document_gap_summary to authenticated;
grant select on public.v_patch32_clause_capa_risk_audit_summary to authenticated;
grant select on public.v_patch32_clause_training_readiness_summary to authenticated;
grant select on public.v_patch32_department_accreditation_readiness to authenticated;
grant select on public.v_patch32_accreditation_executive_summary to authenticated;
grant select on public.v_patch32_accreditation_exception_register to authenticated;
grant select on public.v_patch32_accreditation_review_queue to authenticated;

create or replace function public.patch32_actor_has_accreditation_authority(p_actor_user_id uuid)
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

create or replace function public.record_accreditation_traceability_event(
  p_clause_id uuid,
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
     and current_user <> 'service_role' then
    raise exception 'PATCH32_SERVICE_ROLE_REQUIRED';
  end if;
  if p_actor_user_id is not null and not public.patch32_actor_has_accreditation_authority(p_actor_user_id) then
    raise exception 'PATCH32_ACCREDITATION_AUTHORITY_REQUIRED';
  end if;
  insert into public.accreditation_traceability_events (clause_id, entity_type, entity_id, event_type, event_summary, actor_user_id)
  values (p_clause_id, p_entity_type, p_entity_id, p_event_type, p_event_summary, p_actor_user_id)
  returning id into v_event_id;
  return v_event_id;
end;
$$;

create or replace function public.create_accreditation_standard(
  p_standard_code text,
  p_standard_name text,
  p_framework text,
  p_actor_user_id uuid,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_standard_id uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role' and current_user <> 'service_role' then raise exception 'PATCH32_SERVICE_ROLE_REQUIRED'; end if;
  if not public.patch32_actor_has_accreditation_authority(p_actor_user_id) then raise exception 'PATCH32_ACCREDITATION_AUTHORITY_REQUIRED'; end if;
  insert into public.accreditation_standards (standard_code, standard_name, standard_name_ar, framework, version, active, created_by)
  values (p_standard_code, p_standard_name, p_payload->>'standard_name_ar', coalesce(nullif(p_framework,''),'CBAHI'), nullif(p_payload->>'version',''), coalesce(nullif(p_payload->>'active','')::boolean, true), p_actor_user_id)
  on conflict (standard_code) do update set
    standard_name = excluded.standard_name,
    standard_name_ar = excluded.standard_name_ar,
    framework = excluded.framework,
    version = excluded.version,
    active = excluded.active
  returning id into v_standard_id;
  perform public.record_accreditation_traceability_event(null, 'accreditation_standard', v_standard_id, 'standard_created', 'Accreditation standard created or updated.', p_actor_user_id);
  return v_standard_id;
end;
$$;

create or replace function public.create_accreditation_clause(
  p_standard_id uuid,
  p_clause_code text,
  p_clause_title text,
  p_actor_user_id uuid,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_clause_id uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role' and current_user <> 'service_role' then raise exception 'PATCH32_SERVICE_ROLE_REQUIRED'; end if;
  if not public.patch32_actor_has_accreditation_authority(p_actor_user_id) then raise exception 'PATCH32_ACCREDITATION_AUTHORITY_REQUIRED'; end if;
  insert into public.accreditation_clauses (
    standard_id, clause_code, clause_title, clause_title_ar, clause_description, clause_category,
    department_id, owner_user_id, criticality, active, created_by
  )
  values (
    p_standard_id, p_clause_code, p_clause_title, p_payload->>'clause_title_ar', p_payload->>'clause_description',
    nullif(p_payload->>'clause_category',''), nullif(p_payload->>'department_id','')::uuid, nullif(p_payload->>'owner_user_id','')::uuid,
    coalesce(nullif(p_payload->>'criticality',''), 'medium'), coalesce(nullif(p_payload->>'active','')::boolean, true), p_actor_user_id
  )
  on conflict (standard_id, clause_code) do update set
    clause_title = excluded.clause_title,
    clause_title_ar = excluded.clause_title_ar,
    clause_description = excluded.clause_description,
    clause_category = excluded.clause_category,
    department_id = excluded.department_id,
    owner_user_id = excluded.owner_user_id,
    criticality = excluded.criticality,
    active = excluded.active
  returning id into v_clause_id;
  perform public.record_accreditation_traceability_event(v_clause_id, 'accreditation_clause', v_clause_id, 'clause_created', 'Accreditation clause created or updated.', p_actor_user_id);
  return v_clause_id;
end;
$$;

create or replace function public.link_accreditation_clause_entity(
  p_clause_id uuid,
  p_linked_entity_type text,
  p_linked_entity_id uuid,
  p_actor_user_id uuid,
  p_link_strength text default 'supporting',
  p_link_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_link_id uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role' and current_user <> 'service_role' then raise exception 'PATCH32_SERVICE_ROLE_REQUIRED'; end if;
  if not public.patch32_actor_has_accreditation_authority(p_actor_user_id) then raise exception 'PATCH32_ACCREDITATION_AUTHORITY_REQUIRED'; end if;
  insert into public.accreditation_clause_links (clause_id, linked_entity_type, linked_entity_id, link_strength, link_notes, active, created_by)
  values (p_clause_id, p_linked_entity_type, p_linked_entity_id, coalesce(nullif(p_link_strength,''),'supporting'), p_link_notes, true, p_actor_user_id)
  on conflict (clause_id, linked_entity_type, linked_entity_id) do update set
    link_strength = excluded.link_strength,
    link_notes = excluded.link_notes,
    active = true
  returning id into v_link_id;
  perform public.record_accreditation_traceability_event(p_clause_id, p_linked_entity_type, p_linked_entity_id, 'entity_linked', 'Accreditation clause entity linked.', p_actor_user_id);
  return v_link_id;
end;
$$;

create or replace function public.unlink_accreditation_clause_entity(
  p_clause_id uuid,
  p_linked_entity_type text,
  p_linked_entity_id uuid,
  p_actor_user_id uuid,
  p_unlink_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role' and current_user <> 'service_role' then raise exception 'PATCH32_SERVICE_ROLE_REQUIRED'; end if;
  if not public.patch32_actor_has_accreditation_authority(p_actor_user_id) then raise exception 'PATCH32_ACCREDITATION_AUTHORITY_REQUIRED'; end if;
  if nullif(trim(coalesce(p_unlink_reason,'')), '') is null then raise exception 'PATCH32_UNLINK_REASON_REQUIRED'; end if;
  update public.accreditation_clause_links
  set active = false, link_notes = concat_ws(' | ', link_notes, 'Unlinked: ' || p_unlink_reason)
  where clause_id = p_clause_id and linked_entity_type = p_linked_entity_type and linked_entity_id = p_linked_entity_id;
  if not found then raise exception 'PATCH32_CLAUSE_LINK_NOT_FOUND'; end if;
  perform public.record_accreditation_traceability_event(p_clause_id, p_linked_entity_type, p_linked_entity_id, 'entity_unlinked', p_unlink_reason, p_actor_user_id);
  return jsonb_build_object('status','ok','clause_id',p_clause_id);
end;
$$;

create or replace function public.assess_accreditation_clause(
  p_clause_id uuid,
  p_assessment_status text,
  p_evidence_status text,
  p_readiness_score numeric,
  p_actor_user_id uuid,
  p_assessment_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_assessment_id uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role' and current_user <> 'service_role' then raise exception 'PATCH32_SERVICE_ROLE_REQUIRED'; end if;
  if not public.patch32_actor_has_accreditation_authority(p_actor_user_id) then raise exception 'PATCH32_ACCREDITATION_AUTHORITY_REQUIRED'; end if;
  insert into public.accreditation_clause_assessments (clause_id, assessment_status, readiness_score, evidence_status, assessment_notes, assessed_by)
  values (p_clause_id, p_assessment_status, p_readiness_score, p_evidence_status, p_assessment_notes, p_actor_user_id)
  returning id into v_assessment_id;
  perform public.record_accreditation_traceability_event(p_clause_id, 'accreditation_clause_assessment', v_assessment_id, 'clause_assessed', coalesce(p_assessment_notes, 'Accreditation clause assessed.'), p_actor_user_id);
  return v_assessment_id;
end;
$$;

create or replace function public.mark_accreditation_clause_not_applicable(
  p_clause_id uuid,
  p_actor_user_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_assessment_id uuid;
begin
  if nullif(trim(coalesce(p_reason,'')), '') is null then raise exception 'PATCH32_NOT_APPLICABLE_REASON_REQUIRED'; end if;
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role' and current_user <> 'service_role' then raise exception 'PATCH32_SERVICE_ROLE_REQUIRED'; end if;
  if not public.patch32_actor_has_accreditation_authority(p_actor_user_id) then raise exception 'PATCH32_ACCREDITATION_AUTHORITY_REQUIRED'; end if;
  insert into public.accreditation_clause_assessments (clause_id, assessment_status, readiness_score, evidence_status, assessment_notes, assessed_by)
  values (p_clause_id, 'not_applicable', 100, 'complete', p_reason, p_actor_user_id)
  returning id into v_assessment_id;
  perform public.record_accreditation_traceability_event(p_clause_id, 'accreditation_clause_assessment', v_assessment_id, 'marked_not_applicable', p_reason, p_actor_user_id);
  return v_assessment_id;
end;
$$;

create or replace function public.reopen_accreditation_clause_assessment(
  p_clause_id uuid,
  p_actor_user_id uuid,
  p_reopen_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_assessment_id uuid;
begin
  if nullif(trim(coalesce(p_reopen_reason,'')), '') is null then raise exception 'PATCH32_REOPEN_REASON_REQUIRED'; end if;
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role' and current_user <> 'service_role' then raise exception 'PATCH32_SERVICE_ROLE_REQUIRED'; end if;
  if not public.patch32_actor_has_accreditation_authority(p_actor_user_id) then raise exception 'PATCH32_ACCREDITATION_AUTHORITY_REQUIRED'; end if;
  insert into public.accreditation_clause_assessments (clause_id, assessment_status, readiness_score, evidence_status, assessment_notes, assessed_by)
  values (p_clause_id, 'pending_owner_review', null, 'under_review', p_reopen_reason, p_actor_user_id)
  returning id into v_assessment_id;
  perform public.record_accreditation_traceability_event(p_clause_id, 'accreditation_clause_assessment', v_assessment_id, 'assessment_reopened', p_reopen_reason, p_actor_user_id);
  return v_assessment_id;
end;
$$;

create or replace function public.get_accreditation_clause_traceability(p_clause_id uuid)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'clause', to_jsonb(r),
    'links', coalesce((select jsonb_agg(to_jsonb(l)) from public.accreditation_clause_links l where l.clause_id = p_clause_id and l.active), '[]'::jsonb),
    'assessments', coalesce((select jsonb_agg(to_jsonb(a) order by a.assessed_at desc) from public.accreditation_clause_assessments a where a.clause_id = p_clause_id), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at desc) from public.accreditation_traceability_events e where e.clause_id = p_clause_id), '[]'::jsonb)
  )
  from public.v_patch32_accreditation_clause_register r
  where r.clause_id = p_clause_id;
$$;

create or replace function public.get_accreditation_readiness_summary()
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb)
  from public.v_patch32_accreditation_executive_summary s;
$$;

revoke all on function public.patch32_actor_has_accreditation_authority(uuid) from public, anon, authenticated;
grant execute on function public.patch32_actor_has_accreditation_authority(uuid) to service_role;

revoke all on function public.record_accreditation_traceability_event(uuid, text, uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.record_accreditation_traceability_event(uuid, text, uuid, text, text, uuid) to service_role;

revoke all on function public.create_accreditation_standard(text, text, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.create_accreditation_standard(text, text, text, uuid, jsonb) to service_role;

revoke all on function public.create_accreditation_clause(uuid, text, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.create_accreditation_clause(uuid, text, text, uuid, jsonb) to service_role;

revoke all on function public.link_accreditation_clause_entity(uuid, text, uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.link_accreditation_clause_entity(uuid, text, uuid, uuid, text, text) to service_role;

revoke all on function public.unlink_accreditation_clause_entity(uuid, text, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.unlink_accreditation_clause_entity(uuid, text, uuid, uuid, text) to service_role;

revoke all on function public.assess_accreditation_clause(uuid, text, text, numeric, uuid, text) from public, anon, authenticated;
grant execute on function public.assess_accreditation_clause(uuid, text, text, numeric, uuid, text) to service_role;

revoke all on function public.mark_accreditation_clause_not_applicable(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.mark_accreditation_clause_not_applicable(uuid, uuid, text) to service_role;

revoke all on function public.reopen_accreditation_clause_assessment(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.reopen_accreditation_clause_assessment(uuid, uuid, text) to service_role;

revoke all on function public.get_accreditation_clause_traceability(uuid) from public, anon, authenticated;
grant execute on function public.get_accreditation_clause_traceability(uuid) to service_role;

revoke all on function public.get_accreditation_readiness_summary() from public, anon, authenticated;
grant execute on function public.get_accreditation_readiness_summary() to service_role;

comment on table public.accreditation_standards is 'Patch 32 accreditation standard/framework catalog.';
comment on table public.accreditation_clauses is 'Patch 32 accreditation clause ownership and criticality register.';
comment on table public.accreditation_clause_links is 'Patch 32 traceability links from clauses to controls, SOPs, evidence, CAPA, risk, audit, training, approval authority, and policy records.';
comment on table public.accreditation_clause_assessments is 'Patch 32 accreditation clause readiness/evidence assessment history.';
comment on table public.accreditation_traceability_events is 'Patch 32 accreditation traceability audit event log.';
