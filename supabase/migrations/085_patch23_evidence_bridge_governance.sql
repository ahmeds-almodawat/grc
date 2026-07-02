-- =========================================================
-- Patch 23 - Evidence Bridge & Evidence Governance
-- Additive controlled proof system for closure, approval,
-- acceptance, treatment, audit, regulatory, and board evidence.
-- =========================================================

alter table public.evidence_files
  add column if not exists evidence_code text,
  add column if not exists evidence_title text,
  add column if not exists evidence_description text,
  add column if not exists evidence_type text not null default 'general',
  add column if not exists sensitivity_level text not null default 'internal',
  add column if not exists classification_reason text,
  add column if not exists evidence_source text not null default 'upload',
  add column if not exists evidence_owner_id uuid references public.profiles(id) on delete set null,
  add column if not exists reviewer_id uuid references public.profiles(id) on delete set null,
  add column if not exists review_status text not null default 'submitted',
  add column if not exists review_required boolean not null default true,
  add column if not exists review_due_date date,
  add column if not exists review_note text,
  add column if not exists revision_required boolean not null default false,
  add column if not exists revision_due_date date,
  add column if not exists superseded_by_evidence_id uuid references public.evidence_files(id) on delete set null,
  add column if not exists version_number integer not null default 1,
  add column if not exists is_current_version boolean not null default true,
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by uuid references public.profiles(id) on delete set null,
  add column if not exists expiry_date date,
  add column if not exists renewal_required boolean not null default false,
  add column if not exists renewal_due_date date,
  add column if not exists chain_of_custody_hash text,
  add column if not exists uploaded_ip_or_context text,
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists updated_by uuid references public.profiles(id) on delete set null;

update public.evidence_files
set
  evidence_code = coalesce(evidence_code, 'EV-' || left(id::text, 8)),
  evidence_title = coalesce(evidence_title, file_name),
  evidence_description = coalesce(evidence_description, description),
  evidence_owner_id = coalesce(evidence_owner_id, uploaded_by),
  reviewer_id = coalesce(reviewer_id, reviewed_by),
  review_status = coalesce(nullif(review_status, ''), status::text),
  review_note = coalesce(review_note, rejection_reason),
  reviewed_at = coalesce(reviewed_at, reviewed_at),
  created_by = coalesce(created_by, uploaded_by),
  updated_by = coalesce(updated_by, reviewed_by, uploaded_by),
  revision_required = coalesce(revision_required, false) or status = 'needs_revision',
  renewal_required = coalesce(renewal_required, false) or (expiry_date is not null and expiry_date <= current_date + 30)
where true;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'evidence_files_patch23_review_status_chk') then
    alter table public.evidence_files add constraint evidence_files_patch23_review_status_chk
      check (review_status in ('submitted','pending_review','accepted','rejected','needs_revision','superseded','locked','expired','renewed','waived'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'evidence_files_patch23_sensitivity_chk') then
    alter table public.evidence_files add constraint evidence_files_patch23_sensitivity_chk
      check (sensitivity_level in ('public','internal','confidential','highly_sensitive','restricted'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'evidence_files_patch23_version_chk') then
    alter table public.evidence_files add constraint evidence_files_patch23_version_chk
      check (version_number >= 1);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'evidence_files_patch23_sensitive_reason_chk') then
    alter table public.evidence_files add constraint evidence_files_patch23_sensitive_reason_chk
      check (
        sensitivity_level not in ('confidential','highly_sensitive','restricted')
        or nullif(trim(coalesce(classification_reason, '')), '') is not null
      );
  end if;
end $$;

create table if not exists public.evidence_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  evidence_file_id uuid not null references public.evidence_files(id) on delete cascade,
  linked_item_type text not null check (linked_item_type in ('risk','ovr','audit_finding','compliance','project','milestone','task','approval','capa','control','policy','department')),
  linked_item_id uuid not null,
  linked_item_title text,
  link_reason text,
  is_primary boolean not null default false,
  required_for_closure boolean not null default false,
  required_for_acceptance boolean not null default false,
  required_for_approval boolean not null default false,
  required_for_treatment boolean not null default false,
  linked_by uuid references public.profiles(id) on delete set null,
  linked_at timestamptz not null default now(),
  is_active boolean not null default true,
  unique (organization_id, evidence_file_id, linked_item_type, linked_item_id)
);

create table if not exists public.evidence_requirements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  requirement_code text,
  linked_item_type text not null check (linked_item_type in ('risk','ovr','audit_finding','compliance','project','milestone','task','approval','capa','control','policy','department')),
  linked_item_id uuid not null,
  requirement_title text not null,
  requirement_description text,
  evidence_type_required text,
  minimum_accepted_files integer not null default 1 check (minimum_accepted_files >= 1),
  sensitivity_required text check (sensitivity_required is null or sensitivity_required in ('public','internal','confidential','highly_sensitive','restricted')),
  due_date date,
  required_for_gate text not null check (required_for_gate in ('closure','approval','acceptance','treatment','review','audit','regulatory','board_pack')),
  gate_status text not null default 'pending' check (gate_status in ('pending','partially_satisfied','satisfied','overdue','waived')),
  owner_id uuid references public.profiles(id) on delete set null,
  reviewer_role text,
  reviewer_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_active boolean not null default true,
  unique (organization_id, requirement_code)
);

create table if not exists public.evidence_review_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  evidence_file_id uuid references public.evidence_files(id) on delete cascade,
  event_type text not null check (event_type in ('uploaded','linked','submitted_for_review','accepted','rejected','needs_revision','superseded','locked','expired','renewed','downloaded','viewed','waiver_requested','waiver_approved','waiver_rejected')),
  from_status text,
  to_status text,
  actor_id uuid references public.profiles(id) on delete set null,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.evidence_gate_waivers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  requirement_id uuid not null references public.evidence_requirements(id) on delete cascade,
  linked_item_type text not null check (linked_item_type in ('risk','ovr','audit_finding','compliance','project','milestone','task','approval','capa','control','policy','department')),
  linked_item_id uuid not null,
  waiver_reason text not null,
  requested_by uuid references public.profiles(id) on delete set null,
  requested_at timestamptz not null default now(),
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  status text not null default 'requested' check (status in ('requested','approved','rejected','expired')),
  expiry_date date,
  audit_note text
);

create index if not exists idx_patch23_evidence_org on public.evidence_files(organization_id);
create index if not exists idx_patch23_evidence_review_status on public.evidence_files(review_status);
create index if not exists idx_patch23_evidence_sensitivity on public.evidence_files(sensitivity_level);
create index if not exists idx_patch23_evidence_review_due on public.evidence_files(review_due_date);
create index if not exists idx_patch23_evidence_expiry on public.evidence_files(expiry_date);
create index if not exists idx_patch23_evidence_owner on public.evidence_files(evidence_owner_id);
create index if not exists idx_patch23_evidence_reviewer on public.evidence_files(reviewer_id);
create index if not exists idx_patch23_links_org on public.evidence_links(organization_id);
create index if not exists idx_patch23_links_evidence on public.evidence_links(evidence_file_id);
create index if not exists idx_patch23_links_item on public.evidence_links(linked_item_type, linked_item_id);
create index if not exists idx_patch23_requirements_org on public.evidence_requirements(organization_id);
create index if not exists idx_patch23_requirements_item on public.evidence_requirements(linked_item_type, linked_item_id);
create index if not exists idx_patch23_requirements_gate_status on public.evidence_requirements(gate_status);
create index if not exists idx_patch23_events_evidence on public.evidence_review_events(evidence_file_id);
create index if not exists idx_patch23_waivers_requirement on public.evidence_gate_waivers(requirement_id);

alter table public.evidence_links enable row level security;
alter table public.evidence_requirements enable row level security;
alter table public.evidence_review_events enable row level security;
alter table public.evidence_gate_waivers enable row level security;

drop policy if exists evidence_links_read_patch23 on public.evidence_links;
create policy evidence_links_read_patch23 on public.evidence_links
for select using (public.can_access_org(organization_id) or public.can_manage_grc());

drop policy if exists evidence_links_write_patch23 on public.evidence_links;
create policy evidence_links_write_patch23 on public.evidence_links
for all using (public.can_manage_grc())
with check (public.can_manage_grc());

drop policy if exists evidence_requirements_read_patch23 on public.evidence_requirements;
create policy evidence_requirements_read_patch23 on public.evidence_requirements
for select using (public.can_access_org(organization_id) or public.can_manage_grc());

drop policy if exists evidence_requirements_write_patch23 on public.evidence_requirements;
create policy evidence_requirements_write_patch23 on public.evidence_requirements
for all using (public.can_manage_grc())
with check (public.can_manage_grc());

drop policy if exists evidence_review_events_read_patch23 on public.evidence_review_events;
create policy evidence_review_events_read_patch23 on public.evidence_review_events
for select using (public.can_access_org(organization_id) or public.can_manage_grc());

drop policy if exists evidence_review_events_insert_patch23 on public.evidence_review_events;
create policy evidence_review_events_insert_patch23 on public.evidence_review_events
for insert with check (public.can_manage_grc());

drop policy if exists evidence_gate_waivers_read_patch23 on public.evidence_gate_waivers;
create policy evidence_gate_waivers_read_patch23 on public.evidence_gate_waivers
for select using (public.can_access_org(organization_id) or public.can_manage_grc());

drop policy if exists evidence_gate_waivers_write_patch23 on public.evidence_gate_waivers;
create policy evidence_gate_waivers_write_patch23 on public.evidence_gate_waivers
for all using (public.can_manage_grc())
with check (public.can_manage_grc());

grant select, insert, update on public.evidence_links to authenticated;
grant select, insert, update on public.evidence_requirements to authenticated;
grant select on public.evidence_review_events to authenticated;
grant select, insert, update on public.evidence_gate_waivers to authenticated;

create or replace view public.v_patch23_evidence_review_queue as
select
  e.organization_id,
  e.id as evidence_file_id,
  coalesce(e.evidence_code, 'EV-' || left(e.id::text, 8)) as evidence_code,
  coalesce(e.evidence_title, e.file_name) as evidence_title,
  e.file_name,
  e.evidence_type,
  e.sensitivity_level,
  e.review_status,
  e.status::text as legacy_status,
  e.review_required,
  e.review_due_date,
  e.revision_required,
  e.revision_due_date,
  e.expiry_date,
  e.renewal_required,
  e.is_current_version,
  e.locked_at,
  e.uploaded_by,
  up.full_name_en as uploaded_by_name,
  e.evidence_owner_id,
  owner.full_name_en as owner_name,
  e.reviewer_id,
  reviewer.full_name_en as reviewer_name,
  e.created_at,
  case
    when e.review_status in ('rejected','needs_revision') or e.revision_required then 'revision_required'
    when e.review_required and e.review_due_date is not null and e.review_due_date < current_date and e.review_status not in ('accepted','rejected') then 'review_overdue'
    when e.expiry_date is not null and e.expiry_date < current_date then 'expired'
    when e.expiry_date is not null and e.expiry_date <= current_date + 30 then 'expiring'
    when e.review_status in ('submitted','pending_review') then 'pending_review'
    else 'monitor'
  end as queue_reason
from public.evidence_files e
left join public.profiles up on up.id = e.uploaded_by
left join public.profiles owner on owner.id = e.evidence_owner_id
left join public.profiles reviewer on reviewer.id = e.reviewer_id
where e.review_required
  and (
    e.review_status in ('submitted','pending_review','rejected','needs_revision')
    or e.revision_required
    or (e.review_due_date is not null and e.review_due_date < current_date and e.review_status <> 'accepted')
    or (e.expiry_date is not null and e.expiry_date <= current_date + 30)
  );

create or replace view public.v_patch23_evidence_closure_gate_status as
with accepted_counts as (
  select
    er.id as requirement_id,
    count(distinct e.id)::integer as accepted_evidence_count
  from public.evidence_requirements er
  left join public.evidence_links el
    on el.organization_id = er.organization_id
   and el.linked_item_type = er.linked_item_type
   and el.linked_item_id = er.linked_item_id
   and el.is_active
   and (
    (er.required_for_gate = 'closure' and el.required_for_closure)
    or (er.required_for_gate = 'acceptance' and el.required_for_acceptance)
    or (er.required_for_gate = 'approval' and el.required_for_approval)
    or (er.required_for_gate = 'treatment' and el.required_for_treatment)
    or er.required_for_gate in ('review','audit','regulatory','board_pack')
   )
  left join public.evidence_files e
    on e.id = el.evidence_file_id
   and coalesce(e.review_status, e.status::text) = 'accepted'
   and e.is_current_version
   and (e.expiry_date is null or e.expiry_date >= current_date)
  where er.is_active
  group by er.id
),
waivers as (
  select
    requirement_id,
    max(approved_at) as approved_at
  from public.evidence_gate_waivers
  where status = 'approved'
    and (expiry_date is null or expiry_date >= current_date)
  group by requirement_id
)
select
  er.organization_id,
  er.id as requirement_id,
  er.requirement_code,
  er.linked_item_type,
  er.linked_item_id,
  er.requirement_title,
  er.required_for_gate,
  er.minimum_accepted_files,
  coalesce(ac.accepted_evidence_count, 0) as accepted_evidence_count,
  (w.requirement_id is not null) as waiver_active,
  w.approved_at as waiver_approved_at,
  er.due_date,
  case
    when w.requirement_id is not null then 'waived'
    when coalesce(ac.accepted_evidence_count, 0) >= er.minimum_accepted_files then 'satisfied'
    when er.due_date is not null and er.due_date < current_date then 'overdue'
    when coalesce(ac.accepted_evidence_count, 0) > 0 then 'partially_satisfied'
    else 'pending'
  end as gate_status,
  (
    w.requirement_id is not null
    or coalesce(ac.accepted_evidence_count, 0) >= er.minimum_accepted_files
  ) as can_close
from public.evidence_requirements er
left join accepted_counts ac on ac.requirement_id = er.id
left join waivers w on w.requirement_id = er.id
where er.is_active;

create or replace view public.v_patch23_evidence_gap_dashboard as
select
  organization_id,
  requirement_id,
  requirement_code,
  linked_item_type,
  linked_item_id,
  requirement_title,
  required_for_gate,
  minimum_accepted_files,
  accepted_evidence_count,
  gate_status,
  due_date,
  waiver_active,
  can_close,
  case
    when gate_status = 'overdue' then 'Evidence requirement overdue.'
    when gate_status = 'pending' then 'No accepted evidence or approved waiver.'
    when gate_status = 'partially_satisfied' then 'Accepted evidence count is below minimum.'
    when gate_status = 'waived' then 'Requirement satisfied by approved waiver.'
    else 'Requirement satisfied.'
  end as gap_reason
from public.v_patch23_evidence_closure_gate_status
where gate_status in ('pending','partially_satisfied','overdue');

create or replace view public.v_patch23_evidence_chain_of_custody as
select
  ev.organization_id,
  ev.evidence_file_id,
  coalesce(e.evidence_code, 'EV-' || left(ev.evidence_file_id::text, 8)) as evidence_code,
  coalesce(e.evidence_title, e.file_name) as evidence_title,
  ev.id as event_id,
  ev.event_type,
  ev.from_status,
  ev.to_status,
  ev.actor_id,
  actor.full_name_en as actor_name,
  ev.note,
  ev.metadata,
  ev.created_at
from public.evidence_review_events ev
left join public.evidence_files e on e.id = ev.evidence_file_id
left join public.profiles actor on actor.id = ev.actor_id;

create or replace view public.v_patch23_evidence_pack_index as
select
  el.organization_id,
  el.linked_item_type,
  el.linked_item_id,
  el.linked_item_title,
  el.evidence_file_id,
  coalesce(e.evidence_code, 'EV-' || left(e.id::text, 8)) as evidence_code,
  coalesce(e.evidence_title, e.file_name) as evidence_title,
  e.file_name,
  e.evidence_type,
  e.sensitivity_level,
  coalesce(e.review_status, e.status::text) as review_status,
  e.reviewer_id,
  reviewer.full_name_en as reviewer_name,
  e.reviewed_at,
  el.is_primary,
  el.required_for_closure,
  el.required_for_acceptance,
  el.required_for_approval,
  el.required_for_treatment,
  el.linked_at
from public.evidence_links el
join public.evidence_files e on e.id = el.evidence_file_id
left join public.profiles reviewer on reviewer.id = e.reviewer_id
where el.is_active and e.is_current_version;

create or replace view public.v_patch23_sensitive_evidence_register as
select
  e.organization_id,
  e.id as evidence_file_id,
  coalesce(e.evidence_code, 'EV-' || left(e.id::text, 8)) as evidence_code,
  coalesce(e.evidence_title, e.file_name) as evidence_title,
  e.file_name,
  e.sensitivity_level,
  e.classification_reason,
  e.review_status,
  e.evidence_owner_id,
  owner.full_name_en as owner_name,
  e.reviewer_id,
  reviewer.full_name_en as reviewer_name,
  e.expiry_date,
  e.renewal_required,
  e.renewal_due_date,
  e.locked_at,
  e.locked_by,
  locker.full_name_en as locked_by_name,
  e.created_at
from public.evidence_files e
left join public.profiles owner on owner.id = e.evidence_owner_id
left join public.profiles reviewer on reviewer.id = e.reviewer_id
left join public.profiles locker on locker.id = e.locked_by
where e.sensitivity_level in ('confidential','highly_sensitive','restricted');

alter view public.v_patch23_evidence_review_queue set (security_invoker = true);
alter view public.v_patch23_evidence_gap_dashboard set (security_invoker = true);
alter view public.v_patch23_evidence_closure_gate_status set (security_invoker = true);
alter view public.v_patch23_evidence_chain_of_custody set (security_invoker = true);
alter view public.v_patch23_evidence_pack_index set (security_invoker = true);
alter view public.v_patch23_sensitive_evidence_register set (security_invoker = true);

grant select on public.v_patch23_evidence_review_queue to authenticated;
grant select on public.v_patch23_evidence_gap_dashboard to authenticated;
grant select on public.v_patch23_evidence_closure_gate_status to authenticated;
grant select on public.v_patch23_evidence_chain_of_custody to authenticated;
grant select on public.v_patch23_evidence_pack_index to authenticated;
grant select on public.v_patch23_sensitive_evidence_register to authenticated;

create or replace function public.patch23_write_evidence_event(
  p_organization_id uuid,
  p_evidence_file_id uuid,
  p_event_type text,
  p_from_status text,
  p_to_status text,
  p_actor_id uuid,
  p_note text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.evidence_review_events (
    organization_id,
    evidence_file_id,
    event_type,
    from_status,
    to_status,
    actor_id,
    note,
    metadata
  )
  values (
    p_organization_id,
    p_evidence_file_id,
    p_event_type,
    p_from_status,
    p_to_status,
    p_actor_id,
    p_note,
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

create or replace function public.patch23_evidence_governance_bridge(
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
  v_action text := lower(coalesce(p_action, ''));
  v_evidence public.evidence_files%rowtype;
  v_requirement public.evidence_requirements%rowtype;
  v_evidence_id uuid := nullif(p_payload->>'evidence_file_id', '')::uuid;
  v_requirement_id uuid := nullif(p_payload->>'requirement_id', '')::uuid;
  v_can_manage boolean := false;
  v_can_review boolean := false;
  v_is_owner boolean := false;
  v_old_status text;
  v_new_status text;
  v_note text := nullif(trim(coalesce(p_payload->>'note', p_payload->>'reason', p_payload->>'review_note', p_payload->>'audit_note', '')), '');
  v_result jsonb := '{}'::jsonb;
  v_linked_item_type text := nullif(p_payload->>'linked_item_type', '');
  v_linked_item_id uuid := nullif(p_payload->>'linked_item_id', '')::uuid;
  v_accepted_count integer;
  v_waiver_active boolean;
begin
  if v_jwt_role <> 'service_role' and current_user <> 'service_role' then
    raise exception 'PATCH23_EVIDENCE_SERVICE_ROLE_REQUIRED';
  end if;

  select * into v_actor
  from public.profiles
  where id = p_actor_id and is_active = true;

  if not found or v_actor.organization_id is null then
    raise exception 'PATCH23_EVIDENCE_ACTIVE_ACTOR_REQUIRED';
  end if;

  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p_actor_id
      and ur.is_active = true
      and ur.role::text in ('super_admin','governance_admin','executive','auditor','compliance_officer','department_manager')
      and (ur.organization_id is null or ur.organization_id is not distinct from v_actor.organization_id)
  ) into v_can_manage;

  v_can_review := v_can_manage;

  if v_action not in (
    'create_evidence_requirement',
    'link_evidence_to_item',
    'submit_evidence_for_review',
    'accept_evidence',
    'reject_evidence',
    'request_evidence_revision',
    'supersede_evidence',
    'lock_evidence',
    'request_evidence_gate_waiver',
    'approve_evidence_gate_waiver',
    'reject_evidence_gate_waiver',
    'check_evidence_gate_status',
    'generate_evidence_pack_index'
  ) then
    raise exception 'PATCH23_EVIDENCE_UNSUPPORTED_ACTION';
  end if;

  if v_action = 'create_evidence_requirement' then
    if not v_can_manage then
      raise exception 'PATCH23_EVIDENCE_REQUIREMENT_ADMIN_REQUIRED';
    end if;
    if v_linked_item_type is null or v_linked_item_id is null then
      raise exception 'PATCH23_EVIDENCE_LINKED_ITEM_REQUIRED';
    end if;

    insert into public.evidence_requirements (
      organization_id,
      requirement_code,
      linked_item_type,
      linked_item_id,
      requirement_title,
      requirement_description,
      evidence_type_required,
      minimum_accepted_files,
      sensitivity_required,
      due_date,
      required_for_gate,
      owner_id,
      reviewer_role,
      reviewer_id,
      created_by
    )
    values (
      v_actor.organization_id,
      coalesce(nullif(p_payload->>'requirement_code', ''), 'ER-' || replace(left(gen_random_uuid()::text, 8), '-', '')),
      v_linked_item_type,
      v_linked_item_id,
      coalesce(nullif(p_payload->>'requirement_title', ''), 'Evidence requirement'),
      nullif(p_payload->>'requirement_description', ''),
      nullif(p_payload->>'evidence_type_required', ''),
      coalesce(nullif(p_payload->>'minimum_accepted_files', '')::integer, 1),
      nullif(p_payload->>'sensitivity_required', ''),
      nullif(p_payload->>'due_date', '')::date,
      coalesce(nullif(p_payload->>'required_for_gate', ''), 'closure'),
      coalesce(nullif(p_payload->>'owner_id', '')::uuid, p_actor_id),
      nullif(p_payload->>'reviewer_role', ''),
      nullif(p_payload->>'reviewer_id', '')::uuid,
      p_actor_id
    )
    on conflict (organization_id, requirement_code) do update set
      requirement_title = excluded.requirement_title,
      requirement_description = excluded.requirement_description,
      evidence_type_required = excluded.evidence_type_required,
      minimum_accepted_files = excluded.minimum_accepted_files,
      sensitivity_required = excluded.sensitivity_required,
      due_date = excluded.due_date,
      required_for_gate = excluded.required_for_gate,
      owner_id = excluded.owner_id,
      reviewer_role = excluded.reviewer_role,
      reviewer_id = excluded.reviewer_id,
      updated_at = now(),
      is_active = true
    returning * into v_requirement;

    v_result := jsonb_build_object('requirement_id', v_requirement.id, 'gate_status', v_requirement.gate_status);

  else
    if v_evidence_id is not null then
      select * into v_evidence
      from public.evidence_files
      where id = v_evidence_id
      for update;
      if not found then
        raise exception 'PATCH23_EVIDENCE_NOT_FOUND';
      end if;
      if v_evidence.organization_id is distinct from v_actor.organization_id then
        raise exception 'PATCH23_EVIDENCE_CROSS_ORGANIZATION_DENIED';
      end if;
      v_is_owner := p_actor_id in (v_evidence.uploaded_by, v_evidence.evidence_owner_id, v_evidence.reviewer_id, v_evidence.reviewed_by);
      if v_evidence.locked_at is not null and not v_can_manage and v_action not in ('check_evidence_gate_status','generate_evidence_pack_index') then
        raise exception 'PATCH23_EVIDENCE_LOCKED';
      end if;
    end if;

    if v_requirement_id is not null then
      select * into v_requirement
      from public.evidence_requirements
      where id = v_requirement_id
      for update;
      if not found then
        raise exception 'PATCH23_EVIDENCE_REQUIREMENT_NOT_FOUND';
      end if;
      if v_requirement.organization_id is distinct from v_actor.organization_id then
        raise exception 'PATCH23_EVIDENCE_CROSS_ORGANIZATION_DENIED';
      end if;
    end if;

    if v_action in ('link_evidence_to_item','submit_evidence_for_review','supersede_evidence') and not (v_can_manage or v_is_owner) then
      raise exception 'PATCH23_EVIDENCE_NOT_AUTHORIZED';
    end if;

    if v_action in ('accept_evidence','reject_evidence','request_evidence_revision','lock_evidence') and not v_can_review then
      raise exception 'PATCH23_EVIDENCE_REVIEWER_REQUIRED';
    end if;

    if v_action = 'link_evidence_to_item' then
      if v_evidence_id is null or v_linked_item_type is null or v_linked_item_id is null then
        raise exception 'PATCH23_EVIDENCE_LINK_PAYLOAD_REQUIRED';
      end if;
      insert into public.evidence_links (
        organization_id,
        evidence_file_id,
        linked_item_type,
        linked_item_id,
        linked_item_title,
        link_reason,
        is_primary,
        required_for_closure,
        required_for_acceptance,
        required_for_approval,
        required_for_treatment,
        linked_by
      )
      values (
        v_actor.organization_id,
        v_evidence_id,
        v_linked_item_type,
        v_linked_item_id,
        nullif(p_payload->>'linked_item_title', ''),
        v_note,
        coalesce((p_payload->>'is_primary')::boolean, false),
        coalesce((p_payload->>'required_for_closure')::boolean, false),
        coalesce((p_payload->>'required_for_acceptance')::boolean, false),
        coalesce((p_payload->>'required_for_approval')::boolean, false),
        coalesce((p_payload->>'required_for_treatment')::boolean, false),
        p_actor_id
      )
      on conflict (organization_id, evidence_file_id, linked_item_type, linked_item_id) do update set
        linked_item_title = excluded.linked_item_title,
        link_reason = excluded.link_reason,
        is_primary = excluded.is_primary,
        required_for_closure = excluded.required_for_closure,
        required_for_acceptance = excluded.required_for_acceptance,
        required_for_approval = excluded.required_for_approval,
        required_for_treatment = excluded.required_for_treatment,
        linked_by = excluded.linked_by,
        linked_at = now(),
        is_active = true;

      perform public.patch23_write_evidence_event(v_actor.organization_id, v_evidence_id, 'linked', v_evidence.review_status, v_evidence.review_status, p_actor_id, v_note, p_payload);
      v_result := jsonb_build_object('evidence_file_id', v_evidence_id, 'linked_item_type', v_linked_item_type, 'linked_item_id', v_linked_item_id);

    elsif v_action = 'submit_evidence_for_review' then
      v_old_status := v_evidence.review_status;
      update public.evidence_files
      set
        review_status = 'pending_review',
        status = 'submitted',
        review_required = true,
        review_due_date = coalesce(nullif(p_payload->>'review_due_date', '')::date, review_due_date, current_date + 7),
        reviewer_id = coalesce(nullif(p_payload->>'reviewer_id', '')::uuid, reviewer_id),
        updated_by = p_actor_id
      where id = v_evidence_id;
      perform public.patch23_write_evidence_event(v_actor.organization_id, v_evidence_id, 'submitted_for_review', v_old_status, 'pending_review', p_actor_id, v_note, p_payload);
      v_result := jsonb_build_object('evidence_file_id', v_evidence_id, 'review_status', 'pending_review');

    elsif v_action = 'accept_evidence' then
      if v_evidence.uploaded_by = p_actor_id and not v_can_manage then
        raise exception 'PATCH23_EVIDENCE_REVIEWER_SEPARATION_REQUIRED';
      end if;
      if v_evidence.sensitivity_level in ('confidential','highly_sensitive','restricted') and nullif(trim(coalesce(v_evidence.classification_reason, '')), '') is null then
        raise exception 'PATCH23_EVIDENCE_CLASSIFICATION_REASON_REQUIRED';
      end if;
      v_old_status := v_evidence.review_status;
      update public.evidence_files
      set
        review_status = 'accepted',
        status = 'accepted',
        reviewer_id = coalesce(reviewer_id, p_actor_id),
        reviewed_by = p_actor_id,
        reviewed_at = now(),
        review_note = v_note,
        rejection_reason = null,
        revision_required = false,
        revision_due_date = null,
        updated_by = p_actor_id
      where id = v_evidence_id;
      perform public.patch23_write_evidence_event(v_actor.organization_id, v_evidence_id, 'accepted', v_old_status, 'accepted', p_actor_id, v_note, p_payload);
      v_result := jsonb_build_object('evidence_file_id', v_evidence_id, 'review_status', 'accepted');

    elsif v_action = 'reject_evidence' then
      if v_note is null then
        raise exception 'PATCH23_EVIDENCE_REJECTION_REASON_REQUIRED';
      end if;
      v_old_status := v_evidence.review_status;
      update public.evidence_files
      set
        review_status = 'rejected',
        status = 'rejected',
        reviewer_id = coalesce(reviewer_id, p_actor_id),
        reviewed_by = p_actor_id,
        reviewed_at = now(),
        review_note = v_note,
        rejection_reason = v_note,
        revision_required = true,
        revision_due_date = coalesce(nullif(p_payload->>'revision_due_date', '')::date, current_date + 7),
        updated_by = p_actor_id
      where id = v_evidence_id;
      perform public.patch23_write_evidence_event(v_actor.organization_id, v_evidence_id, 'rejected', v_old_status, 'rejected', p_actor_id, v_note, p_payload);
      v_result := jsonb_build_object('evidence_file_id', v_evidence_id, 'review_status', 'rejected');

    elsif v_action = 'request_evidence_revision' then
      v_old_status := v_evidence.review_status;
      update public.evidence_files
      set
        review_status = 'needs_revision',
        status = 'needs_revision',
        revision_required = true,
        revision_due_date = coalesce(nullif(p_payload->>'revision_due_date', '')::date, current_date + 7),
        review_note = coalesce(v_note, review_note),
        rejection_reason = coalesce(v_note, rejection_reason),
        updated_by = p_actor_id
      where id = v_evidence_id;
      perform public.patch23_write_evidence_event(v_actor.organization_id, v_evidence_id, 'needs_revision', v_old_status, 'needs_revision', p_actor_id, v_note, p_payload);
      v_result := jsonb_build_object('evidence_file_id', v_evidence_id, 'review_status', 'needs_revision');

    elsif v_action = 'supersede_evidence' then
      if nullif(p_payload->>'superseded_by_evidence_id', '') is null then
        raise exception 'PATCH23_EVIDENCE_SUPERSEDED_BY_REQUIRED';
      end if;
      v_old_status := v_evidence.review_status;
      update public.evidence_files
      set
        review_status = 'superseded',
        is_current_version = false,
        superseded_by_evidence_id = (p_payload->>'superseded_by_evidence_id')::uuid,
        updated_by = p_actor_id
      where id = v_evidence_id;
      update public.evidence_files
      set
        version_number = greatest(version_number, v_evidence.version_number + 1),
        is_current_version = true,
        updated_by = p_actor_id
      where id = (p_payload->>'superseded_by_evidence_id')::uuid
        and organization_id = v_actor.organization_id;
      perform public.patch23_write_evidence_event(v_actor.organization_id, v_evidence_id, 'superseded', v_old_status, 'superseded', p_actor_id, v_note, p_payload);
      v_result := jsonb_build_object('evidence_file_id', v_evidence_id, 'review_status', 'superseded');

    elsif v_action = 'lock_evidence' then
      v_old_status := v_evidence.review_status;
      update public.evidence_files
      set
        locked_at = now(),
        locked_by = p_actor_id,
        review_status = 'locked',
        updated_by = p_actor_id
      where id = v_evidence_id;
      perform public.patch23_write_evidence_event(v_actor.organization_id, v_evidence_id, 'locked', v_old_status, 'locked', p_actor_id, v_note, p_payload);
      v_result := jsonb_build_object('evidence_file_id', v_evidence_id, 'review_status', 'locked');

    elsif v_action = 'request_evidence_gate_waiver' then
      if v_requirement_id is null or v_note is null then
        raise exception 'PATCH23_EVIDENCE_WAIVER_REASON_REQUIRED';
      end if;
      if not (v_can_manage or v_requirement.owner_id = p_actor_id) then
        raise exception 'PATCH23_EVIDENCE_NOT_AUTHORIZED';
      end if;
      insert into public.evidence_gate_waivers (
        organization_id,
        requirement_id,
        linked_item_type,
        linked_item_id,
        waiver_reason,
        requested_by,
        expiry_date,
        audit_note
      )
      values (
        v_actor.organization_id,
        v_requirement_id,
        v_requirement.linked_item_type,
        v_requirement.linked_item_id,
        v_note,
        p_actor_id,
        nullif(p_payload->>'expiry_date', '')::date,
        nullif(p_payload->>'audit_note', '')
      );
      insert into public.evidence_review_events (organization_id, evidence_file_id, event_type, actor_id, note, metadata)
      values (v_actor.organization_id, null, 'waiver_requested', p_actor_id, v_note, p_payload);
      v_result := jsonb_build_object('requirement_id', v_requirement_id, 'waiver_status', 'requested');

    elsif v_action in ('approve_evidence_gate_waiver','reject_evidence_gate_waiver') then
      if not v_can_manage then
        raise exception 'PATCH23_EVIDENCE_WAIVER_APPROVER_REQUIRED';
      end if;
      if nullif(p_payload->>'waiver_id', '') is null then
        raise exception 'PATCH23_EVIDENCE_WAIVER_ID_REQUIRED';
      end if;
      update public.evidence_gate_waivers
      set
        status = case when v_action = 'approve_evidence_gate_waiver' then 'approved' else 'rejected' end,
        approved_by = case when v_action = 'approve_evidence_gate_waiver' then p_actor_id else approved_by end,
        approved_at = case when v_action = 'approve_evidence_gate_waiver' then now() else approved_at end,
        audit_note = coalesce(v_note, audit_note)
      where id = (p_payload->>'waiver_id')::uuid
        and organization_id = v_actor.organization_id
      returning requirement_id into v_requirement_id;
      if v_requirement_id is null then
        raise exception 'PATCH23_EVIDENCE_WAIVER_NOT_FOUND';
      end if;
      insert into public.evidence_review_events (organization_id, evidence_file_id, event_type, actor_id, note, metadata)
      values (
        v_actor.organization_id,
        null,
        case when v_action = 'approve_evidence_gate_waiver' then 'waiver_approved' else 'waiver_rejected' end,
        p_actor_id,
        v_note,
        p_payload
      );
      v_result := jsonb_build_object('requirement_id', v_requirement_id, 'waiver_status', case when v_action = 'approve_evidence_gate_waiver' then 'approved' else 'rejected' end);

    elsif v_action in ('check_evidence_gate_status','generate_evidence_pack_index') then
      if not v_can_manage and v_linked_item_type is null then
        raise exception 'PATCH23_EVIDENCE_NOT_AUTHORIZED';
      end if;
      if v_requirement_id is not null then
        select accepted_evidence_count, waiver_active
        into v_accepted_count, v_waiver_active
        from public.v_patch23_evidence_closure_gate_status
        where requirement_id = v_requirement_id
        limit 1;
      else
        select coalesce(sum(accepted_evidence_count), 0)::integer, bool_or(waiver_active)
        into v_accepted_count, v_waiver_active
        from public.v_patch23_evidence_closure_gate_status
        where linked_item_type = v_linked_item_type
          and linked_item_id = v_linked_item_id
          and organization_id = v_actor.organization_id;
      end if;
      v_result := jsonb_build_object(
        'accepted_evidence_count', coalesce(v_accepted_count, 0),
        'waiver_active', coalesce(v_waiver_active, false),
        'can_close', coalesce(v_accepted_count, 0) > 0 or coalesce(v_waiver_active, false)
      );
    end if;
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'action', v_action,
    'result', v_result
  );
end;
$$;

revoke all on function public.patch23_write_evidence_event(uuid, uuid, text, text, text, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.patch23_write_evidence_event(uuid, uuid, text, text, text, uuid, text, jsonb) to service_role;

revoke all on function public.patch23_evidence_governance_bridge(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.patch23_evidence_governance_bridge(uuid, text, jsonb) to service_role;

comment on table public.evidence_links is 'Patch 23: multi-item evidence bridge from one evidence file to risks, OVRs, audit findings, compliance, projects, tasks, approvals, CAPA, controls, policies and departments.';
comment on table public.evidence_requirements is 'Patch 23: workflow gate evidence requirements with accepted-file minimums and waiver-aware status.';
comment on table public.evidence_review_events is 'Patch 23: chain-of-custody event history for evidence uploads, links, reviews, revisions, locks, expiry and waivers.';
comment on table public.evidence_gate_waivers is 'Patch 23: authorized evidence gate waivers with reason, approval, audit note and optional expiry.';
comment on function public.patch23_evidence_governance_bridge(uuid, text, jsonb) is 'Patch 23 service-role evidence governance bridge. Browser code must call through the authenticated Edge bridge, not service-role credentials.';
