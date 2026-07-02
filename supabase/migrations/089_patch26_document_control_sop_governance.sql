-- =========================================================
-- Patch 26: Document Control & SOP Governance
-- Backend foundation for controlled documents, versions, links,
-- acknowledgments, and lifecycle audit history.
--
-- Note: version 088 already exists in main for the platform security
-- definer lockdown, so Patch 26 uses the next safe migration version.
-- =========================================================

create table if not exists public.controlled_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_code text unique,
  document_title text not null,
  document_description text,
  document_type text not null check (document_type in ('policy','sop','work_instruction','form','checklist','guideline','manual','template','external_standard','other')),
  document_category text,
  department_id uuid references public.departments(id) on delete set null,
  document_owner_id uuid references public.profiles(id) on delete set null,
  reviewer_id uuid references public.profiles(id) on delete set null,
  approver_id uuid references public.profiles(id) on delete set null,
  executive_sponsor_id uuid references public.profiles(id) on delete set null,
  criticality_level text check (criticality_level is null or criticality_level in ('low','medium','high','critical')),
  confidentiality_level text check (confidentiality_level is null or confidentiality_level in ('public','internal','confidential','restricted')),
  document_status text not null default 'draft' check (document_status in ('draft','under_review','pending_approval','approved','active','under_revision','expired','superseded','retired','rejected','cancelled')),
  workflow_stage text,
  current_version_id uuid,
  effective_date date,
  next_review_date date,
  review_frequency text,
  expiry_date date,
  active_flag boolean default true,
  external_reference text,
  regulatory_source text,
  standard_reference text,
  clause_reference text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.controlled_documents(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  version_label text,
  file_reference text,
  file_name text,
  file_mime_type text,
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0),
  content_hash text,
  change_summary text,
  revision_reason text,
  prepared_by uuid references public.profiles(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  effective_date date,
  expiry_date date,
  is_current_version boolean default false,
  supersedes_version_id uuid references public.document_versions(id) on delete set null,
  superseded_by_version_id uuid references public.document_versions(id) on delete set null,
  locked_at timestamptz,
  locked_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now(),
  unique (document_id, version_number)
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'controlled_documents_current_version_id_fkey'
  ) then
    alter table public.controlled_documents
      add constraint controlled_documents_current_version_id_fkey
      foreign key (current_version_id) references public.document_versions(id) on delete set null;
  end if;
end $$;

create table if not exists public.document_review_events (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.controlled_documents(id) on delete cascade,
  version_id uuid references public.document_versions(id) on delete set null,
  event_type text not null check (event_type in ('created','submitted_for_review','review_started','review_accepted','review_rejected','submitted_for_approval','approved','rejected','activated','revision_started','superseded','retired','expired','reopened','cancelled','linked','acknowledged')),
  from_status text,
  to_status text,
  actor_id uuid references public.profiles(id) on delete set null,
  event_note text,
  rejection_reason text,
  created_at timestamptz default now()
);

create table if not exists public.document_links (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.controlled_documents(id) on delete cascade,
  version_id uuid references public.document_versions(id) on delete set null,
  linked_item_type text not null check (linked_item_type in ('compliance_obligation','risk','ovr','audit_finding','evidence','control','department','project','capa','policy','accreditation_clause')),
  linked_item_id uuid,
  link_type text,
  required_flag boolean default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists public.document_acknowledgment_requirements (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.controlled_documents(id) on delete cascade,
  version_id uuid references public.document_versions(id) on delete set null,
  requirement_scope text,
  department_id uuid references public.departments(id) on delete set null,
  role_name text,
  user_id uuid references public.profiles(id) on delete cascade,
  due_date date,
  required_flag boolean default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists public.document_acknowledgments (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.controlled_documents(id) on delete cascade,
  version_id uuid references public.document_versions(id) on delete set null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  acknowledged_at timestamptz default now(),
  acknowledgment_method text,
  acknowledgment_note text,
  created_at timestamptz default now(),
  unique (document_id, version_id, user_id)
);

create index if not exists idx_patch26_documents_org on public.controlled_documents(organization_id);
create index if not exists idx_patch26_documents_type on public.controlled_documents(document_type);
create index if not exists idx_patch26_documents_status on public.controlled_documents(document_status);
create index if not exists idx_patch26_documents_department on public.controlled_documents(department_id);
create index if not exists idx_patch26_documents_owner on public.controlled_documents(document_owner_id);
create index if not exists idx_patch26_documents_next_review on public.controlled_documents(next_review_date);
create index if not exists idx_patch26_documents_expiry on public.controlled_documents(expiry_date);
create index if not exists idx_patch26_versions_document on public.document_versions(document_id);
create index if not exists idx_patch26_versions_current on public.document_versions(document_id, is_current_version);
create index if not exists idx_patch26_events_document on public.document_review_events(document_id, created_at desc);
create index if not exists idx_patch26_links_document on public.document_links(document_id);
create index if not exists idx_patch26_links_target on public.document_links(linked_item_type, linked_item_id);
create index if not exists idx_patch26_ack_req_document on public.document_acknowledgment_requirements(document_id);
create index if not exists idx_patch26_ack_req_user on public.document_acknowledgment_requirements(user_id);
create index if not exists idx_patch26_ack_user on public.document_acknowledgments(user_id);

alter table public.controlled_documents enable row level security;
alter table public.document_versions enable row level security;
alter table public.document_review_events enable row level security;
alter table public.document_links enable row level security;
alter table public.document_acknowledgment_requirements enable row level security;
alter table public.document_acknowledgments enable row level security;

drop policy if exists controlled_documents_org_read_patch26 on public.controlled_documents;
create policy controlled_documents_org_read_patch26 on public.controlled_documents
for select to authenticated
using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists controlled_documents_org_insert_patch26 on public.controlled_documents;
create policy controlled_documents_org_insert_patch26 on public.controlled_documents
for insert to authenticated
with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists controlled_documents_org_update_patch26 on public.controlled_documents;
create policy controlled_documents_org_update_patch26 on public.controlled_documents
for update to authenticated
using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'))
with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists document_versions_org_read_patch26 on public.document_versions;
create policy document_versions_org_read_patch26 on public.document_versions
for select to authenticated
using (exists (
  select 1 from public.controlled_documents d
  where d.id = document_versions.document_id
    and d.organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
));

drop policy if exists document_versions_org_write_patch26 on public.document_versions;
create policy document_versions_org_write_patch26 on public.document_versions
for all to authenticated
using (exists (
  select 1 from public.controlled_documents d
  where d.id = document_versions.document_id
    and d.organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
))
with check (exists (
  select 1 from public.controlled_documents d
  where d.id = document_versions.document_id
    and d.organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
));

drop policy if exists document_events_org_read_patch26 on public.document_review_events;
create policy document_events_org_read_patch26 on public.document_review_events
for select to authenticated
using (exists (
  select 1 from public.controlled_documents d
  where d.id = document_review_events.document_id
    and d.organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
));

drop policy if exists document_events_org_insert_patch26 on public.document_review_events;
create policy document_events_org_insert_patch26 on public.document_review_events
for insert to authenticated
with check (exists (
  select 1 from public.controlled_documents d
  where d.id = document_review_events.document_id
    and d.organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
));

drop policy if exists document_links_org_read_patch26 on public.document_links;
create policy document_links_org_read_patch26 on public.document_links
for select to authenticated
using (exists (
  select 1 from public.controlled_documents d
  where d.id = document_links.document_id
    and d.organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
));

drop policy if exists document_links_org_write_patch26 on public.document_links;
create policy document_links_org_write_patch26 on public.document_links
for all to authenticated
using (exists (
  select 1 from public.controlled_documents d
  where d.id = document_links.document_id
    and d.organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
))
with check (exists (
  select 1 from public.controlled_documents d
  where d.id = document_links.document_id
    and d.organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
));

drop policy if exists document_ack_req_org_read_patch26 on public.document_acknowledgment_requirements;
create policy document_ack_req_org_read_patch26 on public.document_acknowledgment_requirements
for select to authenticated
using (exists (
  select 1 from public.controlled_documents d
  where d.id = document_acknowledgment_requirements.document_id
    and d.organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
));

drop policy if exists document_ack_req_org_write_patch26 on public.document_acknowledgment_requirements;
create policy document_ack_req_org_write_patch26 on public.document_acknowledgment_requirements
for all to authenticated
using (exists (
  select 1 from public.controlled_documents d
  where d.id = document_acknowledgment_requirements.document_id
    and d.organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
))
with check (exists (
  select 1 from public.controlled_documents d
  where d.id = document_acknowledgment_requirements.document_id
    and d.organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
));

drop policy if exists document_ack_org_read_patch26 on public.document_acknowledgments;
create policy document_ack_org_read_patch26 on public.document_acknowledgments
for select to authenticated
using (exists (
  select 1 from public.controlled_documents d
  where d.id = document_acknowledgments.document_id
    and d.organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
));

drop policy if exists document_ack_org_write_patch26 on public.document_acknowledgments;
create policy document_ack_org_write_patch26 on public.document_acknowledgments
for all to authenticated
using (exists (
  select 1 from public.controlled_documents d
  where d.id = document_acknowledgments.document_id
    and d.organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
))
with check (exists (
  select 1 from public.controlled_documents d
  where d.id = document_acknowledgments.document_id
    and d.organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
));

create or replace view public.v_patch26_document_control_register as
select
  d.id as document_id,
  d.organization_id,
  d.document_code,
  d.document_title,
  d.document_type,
  d.document_category,
  d.department_id,
  dept.name_en as department_name,
  d.document_owner_id,
  owner.full_name_en as document_owner_name,
  d.reviewer_id,
  reviewer.full_name_en as reviewer_name,
  d.approver_id,
  approver.full_name_en as approver_name,
  d.criticality_level,
  d.confidentiality_level,
  d.document_status,
  d.workflow_stage,
  d.current_version_id,
  v.version_number as current_version_number,
  v.version_label as current_version_label,
  v.file_reference as current_file_reference,
  d.effective_date,
  d.next_review_date,
  d.expiry_date,
  d.active_flag,
  d.regulatory_source,
  d.standard_reference,
  d.clause_reference,
  d.created_at,
  d.updated_at
from public.controlled_documents d
left join public.document_versions v on v.id = d.current_version_id
left join public.departments dept on dept.id = d.department_id
left join public.profiles owner on owner.id = d.document_owner_id
left join public.profiles reviewer on reviewer.id = d.reviewer_id
left join public.profiles approver on approver.id = d.approver_id;

create or replace view public.v_patch26_active_sops as
select *
from public.v_patch26_document_control_register
where document_type = 'sop'
  and document_status = 'active'
  and coalesce(active_flag, true) = true;

create or replace view public.v_patch26_documents_due_for_review as
select *
from public.v_patch26_document_control_register
where next_review_date is not null
  and next_review_date <= current_date + 30
  and document_status not in ('retired','cancelled','superseded');

create or replace view public.v_patch26_expired_documents as
select *
from public.v_patch26_document_control_register
where expiry_date is not null
  and expiry_date < current_date
  and document_status not in ('retired','cancelled','superseded');

create or replace view public.v_patch26_pending_document_reviews as
select *
from public.v_patch26_document_control_register
where document_status = 'under_review'
   or workflow_stage = 'review';

create or replace view public.v_patch26_pending_document_approvals as
select *
from public.v_patch26_document_control_register
where document_status = 'pending_approval'
   or workflow_stage = 'approval';

create or replace view public.v_patch26_superseded_documents as
select r.*
from public.v_patch26_document_control_register r
where r.document_status = 'superseded'
   or exists (
     select 1
     from public.document_versions dv
     where dv.document_id = r.document_id
       and dv.superseded_by_version_id is not null
   );

create or replace view public.v_patch26_staff_acknowledgment_gaps as
select
  r.id as requirement_id,
  r.document_id,
  d.organization_id,
  d.document_code,
  d.document_title,
  r.version_id,
  coalesce(r.user_id, p.id) as user_id,
  p.full_name_en as user_name,
  r.department_id,
  r.role_name,
  r.due_date,
  r.required_flag,
  case
    when a.id is not null then 'acknowledged'
    when r.due_date is not null and r.due_date < current_date then 'overdue'
    else 'pending'
  end as acknowledgment_status
from public.document_acknowledgment_requirements r
join public.controlled_documents d on d.id = r.document_id
left join public.profiles p on p.id = r.user_id
left join public.document_acknowledgments a
  on a.document_id = r.document_id
 and a.version_id is not distinct from r.version_id
 and a.user_id = r.user_id
where coalesce(r.required_flag, true) = true
  and r.user_id is not null
  and a.id is null;

create or replace view public.v_patch26_document_link_index as
select
  l.id as link_id,
  d.organization_id,
  l.document_id,
  d.document_code,
  d.document_title,
  l.version_id,
  v.version_number,
  l.linked_item_type,
  l.linked_item_id,
  l.link_type,
  l.required_flag,
  l.created_by,
  l.created_at
from public.document_links l
join public.controlled_documents d on d.id = l.document_id
left join public.document_versions v on v.id = l.version_id;

alter view public.v_patch26_document_control_register set (security_invoker = true);
alter view public.v_patch26_active_sops set (security_invoker = true);
alter view public.v_patch26_documents_due_for_review set (security_invoker = true);
alter view public.v_patch26_expired_documents set (security_invoker = true);
alter view public.v_patch26_pending_document_reviews set (security_invoker = true);
alter view public.v_patch26_pending_document_approvals set (security_invoker = true);
alter view public.v_patch26_superseded_documents set (security_invoker = true);
alter view public.v_patch26_staff_acknowledgment_gaps set (security_invoker = true);
alter view public.v_patch26_document_link_index set (security_invoker = true);

grant select on public.v_patch26_document_control_register to authenticated;
grant select on public.v_patch26_active_sops to authenticated;
grant select on public.v_patch26_documents_due_for_review to authenticated;
grant select on public.v_patch26_expired_documents to authenticated;
grant select on public.v_patch26_pending_document_reviews to authenticated;
grant select on public.v_patch26_pending_document_approvals to authenticated;
grant select on public.v_patch26_superseded_documents to authenticated;
grant select on public.v_patch26_staff_acknowledgment_gaps to authenticated;
grant select on public.v_patch26_document_link_index to authenticated;

create or replace function public.patch26_write_document_event(
  p_document_id uuid,
  p_version_id uuid,
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
    raise exception 'PATCH26_DOCUMENT_EVENT_SERVICE_ROLE_REQUIRED';
  end if;

  insert into public.document_review_events (
    document_id,
    version_id,
    event_type,
    from_status,
    to_status,
    actor_id,
    event_note,
    rejection_reason
  )
  values (
    p_document_id,
    p_version_id,
    p_event_type,
    p_from_status,
    p_to_status,
    p_actor_id,
    p_event_note,
    p_rejection_reason
  );
end;
$$;

create or replace function public.submit_document_for_review(
  p_document_id uuid,
  p_version_id uuid,
  p_actor_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_old_status text;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then
    raise exception 'PATCH26_DOCUMENT_SERVICE_ROLE_REQUIRED';
  end if;

  select document_status into v_old_status
  from public.controlled_documents
  where id = p_document_id
  for update;

  if not found then
    raise exception 'PATCH26_DOCUMENT_NOT_FOUND';
  end if;

  update public.controlled_documents
  set document_status = 'under_review',
      workflow_stage = 'review',
      updated_by = p_actor_id,
      updated_at = now()
  where id = p_document_id;

  perform public.patch26_write_document_event(p_document_id, p_version_id, 'submitted_for_review', v_old_status, 'under_review', p_actor_id, p_note, null);
  return jsonb_build_object('status', 'ok', 'document_id', p_document_id, 'document_status', 'under_review');
end;
$$;

create or replace function public.approve_document_version(
  p_document_id uuid,
  p_version_id uuid,
  p_actor_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_old_status text;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then
    raise exception 'PATCH26_DOCUMENT_SERVICE_ROLE_REQUIRED';
  end if;

  select document_status into v_old_status
  from public.controlled_documents
  where id = p_document_id
  for update;

  if not found then
    raise exception 'PATCH26_DOCUMENT_NOT_FOUND';
  end if;

  update public.document_versions
  set approved_by = p_actor_id,
      approved_at = now()
  where id = p_version_id
    and document_id = p_document_id;

  if not found then
    raise exception 'PATCH26_VERSION_NOT_FOUND';
  end if;

  update public.controlled_documents
  set document_status = 'approved',
      workflow_stage = 'approval',
      approver_id = coalesce(approver_id, p_actor_id),
      updated_by = p_actor_id,
      updated_at = now()
  where id = p_document_id;

  perform public.patch26_write_document_event(p_document_id, p_version_id, 'approved', v_old_status, 'approved', p_actor_id, p_note, null);
  return jsonb_build_object('status', 'ok', 'document_id', p_document_id, 'document_status', 'approved');
end;
$$;

create or replace function public.reject_document_version(
  p_document_id uuid,
  p_version_id uuid,
  p_actor_id uuid,
  p_rejection_reason text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_old_status text;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then
    raise exception 'PATCH26_DOCUMENT_SERVICE_ROLE_REQUIRED';
  end if;
  if nullif(trim(coalesce(p_rejection_reason, '')), '') is null then
    raise exception 'PATCH26_REJECTION_REASON_REQUIRED';
  end if;

  select document_status into v_old_status
  from public.controlled_documents
  where id = p_document_id
  for update;

  if not found then
    raise exception 'PATCH26_DOCUMENT_NOT_FOUND';
  end if;

  update public.controlled_documents
  set document_status = 'rejected',
      workflow_stage = 'rejected',
      updated_by = p_actor_id,
      updated_at = now()
  where id = p_document_id;

  perform public.patch26_write_document_event(p_document_id, p_version_id, 'rejected', v_old_status, 'rejected', p_actor_id, p_note, p_rejection_reason);
  return jsonb_build_object('status', 'ok', 'document_id', p_document_id, 'document_status', 'rejected');
end;
$$;

create or replace function public.activate_document_version(
  p_document_id uuid,
  p_version_id uuid,
  p_actor_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_old_status text;
  v_effective_date date;
  v_expiry_date date;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then
    raise exception 'PATCH26_DOCUMENT_SERVICE_ROLE_REQUIRED';
  end if;

  select document_status into v_old_status
  from public.controlled_documents
  where id = p_document_id
  for update;

  if not found then
    raise exception 'PATCH26_DOCUMENT_NOT_FOUND';
  end if;

  select effective_date, expiry_date into v_effective_date, v_expiry_date
  from public.document_versions
  where id = p_version_id
    and document_id = p_document_id;

  if not found then
    raise exception 'PATCH26_VERSION_NOT_FOUND';
  end if;

  update public.document_versions
  set is_current_version = false
  where document_id = p_document_id
    and id <> p_version_id;

  update public.document_versions
  set is_current_version = true,
      locked_at = coalesce(locked_at, now()),
      locked_by = coalesce(locked_by, p_actor_id)
  where id = p_version_id;

  update public.controlled_documents
  set current_version_id = p_version_id,
      document_status = 'active',
      workflow_stage = 'active',
      effective_date = coalesce(v_effective_date, current_date),
      expiry_date = v_expiry_date,
      active_flag = true,
      updated_by = p_actor_id,
      updated_at = now()
  where id = p_document_id;

  perform public.patch26_write_document_event(p_document_id, p_version_id, 'activated', v_old_status, 'active', p_actor_id, p_note, null);
  return jsonb_build_object('status', 'ok', 'document_id', p_document_id, 'current_version_id', p_version_id);
end;
$$;

create or replace function public.start_document_revision(
  p_document_id uuid,
  p_actor_id uuid,
  p_revision_reason text,
  p_change_summary text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_old_status text;
  v_current_version_id uuid;
  v_new_version_id uuid;
  v_next_version integer;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then
    raise exception 'PATCH26_DOCUMENT_SERVICE_ROLE_REQUIRED';
  end if;
  if nullif(trim(coalesce(p_revision_reason, '')), '') is null then
    raise exception 'PATCH26_REVISION_REASON_REQUIRED';
  end if;

  select document_status, current_version_id into v_old_status, v_current_version_id
  from public.controlled_documents
  where id = p_document_id
  for update;

  if not found then
    raise exception 'PATCH26_DOCUMENT_NOT_FOUND';
  end if;

  select coalesce(max(version_number), 0) + 1 into v_next_version
  from public.document_versions
  where document_id = p_document_id;

  insert into public.document_versions (
    document_id,
    version_number,
    version_label,
    revision_reason,
    change_summary,
    prepared_by,
    supersedes_version_id
  )
  values (
    p_document_id,
    v_next_version,
    'v' || v_next_version::text,
    p_revision_reason,
    p_change_summary,
    p_actor_id,
    v_current_version_id
  )
  returning id into v_new_version_id;

  update public.controlled_documents
  set document_status = 'under_revision',
      workflow_stage = 'revision',
      updated_by = p_actor_id,
      updated_at = now()
  where id = p_document_id;

  perform public.patch26_write_document_event(p_document_id, v_new_version_id, 'revision_started', v_old_status, 'under_revision', p_actor_id, p_change_summary, null);
  return v_new_version_id;
end;
$$;

create or replace function public.retire_controlled_document(
  p_document_id uuid,
  p_actor_id uuid,
  p_retirement_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_old_status text;
  v_current_version_id uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then
    raise exception 'PATCH26_DOCUMENT_SERVICE_ROLE_REQUIRED';
  end if;
  if nullif(trim(coalesce(p_retirement_reason, '')), '') is null then
    raise exception 'PATCH26_RETIREMENT_REASON_REQUIRED';
  end if;

  select document_status, current_version_id into v_old_status, v_current_version_id
  from public.controlled_documents
  where id = p_document_id
  for update;

  if not found then
    raise exception 'PATCH26_DOCUMENT_NOT_FOUND';
  end if;

  update public.controlled_documents
  set document_status = 'retired',
      workflow_stage = 'retired',
      active_flag = false,
      updated_by = p_actor_id,
      updated_at = now()
  where id = p_document_id;

  perform public.patch26_write_document_event(p_document_id, v_current_version_id, 'retired', v_old_status, 'retired', p_actor_id, p_retirement_reason, null);
  return jsonb_build_object('status', 'ok', 'document_id', p_document_id, 'document_status', 'retired');
end;
$$;

create or replace function public.link_document_to_item(
  p_document_id uuid,
  p_version_id uuid,
  p_linked_item_type text,
  p_linked_item_id uuid,
  p_link_type text,
  p_required_flag boolean,
  p_actor_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_link_id uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then
    raise exception 'PATCH26_DOCUMENT_SERVICE_ROLE_REQUIRED';
  end if;

  insert into public.document_links (
    document_id,
    version_id,
    linked_item_type,
    linked_item_id,
    link_type,
    required_flag,
    created_by
  )
  values (
    p_document_id,
    p_version_id,
    p_linked_item_type,
    p_linked_item_id,
    p_link_type,
    coalesce(p_required_flag, false),
    p_actor_id
  )
  returning id into v_link_id;

  perform public.patch26_write_document_event(p_document_id, p_version_id, 'linked', null, null, p_actor_id, 'Document linked to ' || p_linked_item_type, null);
  return v_link_id;
end;
$$;

create or replace function public.record_document_acknowledgment(
  p_document_id uuid,
  p_version_id uuid,
  p_user_id uuid,
  p_acknowledgment_method text default 'manual',
  p_acknowledgment_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ack_id uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then
    raise exception 'PATCH26_DOCUMENT_SERVICE_ROLE_REQUIRED';
  end if;

  insert into public.document_acknowledgments (
    document_id,
    version_id,
    user_id,
    acknowledgment_method,
    acknowledgment_note
  )
  values (
    p_document_id,
    p_version_id,
    p_user_id,
    coalesce(p_acknowledgment_method, 'manual'),
    p_acknowledgment_note
  )
  on conflict (document_id, version_id, user_id) do update
    set acknowledged_at = now(),
        acknowledgment_method = excluded.acknowledgment_method,
        acknowledgment_note = excluded.acknowledgment_note
  returning id into v_ack_id;

  perform public.patch26_write_document_event(p_document_id, p_version_id, 'acknowledged', null, null, p_user_id, p_acknowledgment_note, null);
  return v_ack_id;
end;
$$;

revoke all on function public.patch26_write_document_event(uuid, uuid, text, text, text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.patch26_write_document_event(uuid, uuid, text, text, text, uuid, text, text) to service_role;

revoke all on function public.submit_document_for_review(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.submit_document_for_review(uuid, uuid, uuid, text) to service_role;

revoke all on function public.approve_document_version(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.approve_document_version(uuid, uuid, uuid, text) to service_role;

revoke all on function public.reject_document_version(uuid, uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.reject_document_version(uuid, uuid, uuid, text, text) to service_role;

revoke all on function public.activate_document_version(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.activate_document_version(uuid, uuid, uuid, text) to service_role;

revoke all on function public.start_document_revision(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.start_document_revision(uuid, uuid, text, text) to service_role;

revoke all on function public.retire_controlled_document(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.retire_controlled_document(uuid, uuid, text) to service_role;

revoke all on function public.link_document_to_item(uuid, uuid, text, uuid, text, boolean, uuid) from public, anon, authenticated;
grant execute on function public.link_document_to_item(uuid, uuid, text, uuid, text, boolean, uuid) to service_role;

revoke all on function public.record_document_acknowledgment(uuid, uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.record_document_acknowledgment(uuid, uuid, uuid, text, text) to service_role;

comment on table public.controlled_documents is 'Patch 26 controlled document and SOP governance register.';
comment on table public.document_versions is 'Patch 26 immutable controlled document version register.';
comment on table public.document_review_events is 'Patch 26 document workflow and lifecycle audit trail.';
comment on table public.document_links is 'Patch 26 compatibility bridge linking controlled documents to compliance, risk, OVR, audit, evidence, controls, departments, projects, CAPA, policies, and accreditation clauses.';
comment on table public.document_acknowledgment_requirements is 'Patch 26 acknowledgment requirement foundation; full training and competency remain future Patch 29 scope.';
comment on table public.document_acknowledgments is 'Patch 26 controlled document acknowledgment records.';
