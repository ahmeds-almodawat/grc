-- ============================================================================
-- Migration 206: Governed SOP Template Alignment, Composite RACI & Ordered Approval Stages
-- GRC v1.4 Cumulative E1-R1 Backend Architecture
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Ordered Approval Stages Foundation
-- ----------------------------------------------------------------------------
create table if not exists public.approval_authority_rule_stages (
  id uuid primary key default gen_random_uuid(),
  authority_rule_id uuid not null references public.approval_authority_rules(id) on delete cascade,
  stage_order integer not null,
  stage_key text not null,
  stage_name_en text not null,
  stage_name_ar text,
  reviewer_role text,
  reviewer_user_id uuid references public.profiles(id) on delete restrict,
  required_decision_count integer not null default 1 check (required_decision_count >= 1),
  allow_self_approval boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_stage_order_positive check (stage_order >= 1),
  constraint chk_stage_auth_selector check (
    (reviewer_user_id is not null and reviewer_role is null) or
    (reviewer_user_id is null and reviewer_role is not null)
  ),
  constraint chk_user_stage_count check (
    reviewer_user_id is null or required_decision_count = 1
  ),
  unique (authority_rule_id, stage_order),
  unique (authority_rule_id, stage_key)
);

create index if not exists idx_rule_stages_rule on public.approval_authority_rule_stages(authority_rule_id, stage_order);

-- ----------------------------------------------------------------------------
-- 2. Snapshotted Approval Request Stages
-- ----------------------------------------------------------------------------
create table if not exists public.approval_request_stages (
  id uuid primary key default gen_random_uuid(),
  approval_request_id uuid not null references public.approval_requests(id) on delete cascade,
  stage_order integer not null,
  stage_key text not null,
  stage_name_en text not null,
  stage_name_ar text,
  stage_status text not null default 'pending' check (stage_status in ('pending', 'in_progress', 'approved', 'rejected', 'returned', 'skipped')),
  required_decision_count integer not null default 1 check (required_decision_count >= 1),
  received_decision_count integer not null default 0 check (received_decision_count >= 0),
  assigned_role text,
  assigned_user_id uuid references public.profiles(id) on delete restrict,
  allow_self_approval boolean not null default false,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_req_stage_order_positive check (stage_order >= 1),
  constraint chk_req_stage_auth_selector check (
    (assigned_user_id is not null and assigned_role is null) or
    (assigned_user_id is null and assigned_role is not null)
  ),
  unique (approval_request_id, stage_order),
  unique (id, approval_request_id)
);

create index if not exists idx_req_stages_request on public.approval_request_stages(approval_request_id, stage_order);

-- Allow stage configuration events in authority events
alter table public.approval_authority_events
  drop constraint if exists approval_authority_events_event_type_check;

alter table public.approval_authority_events
  add constraint approval_authority_events_event_type_check
  check (event_type in (
    'rule_created','rule_updated','rule_disabled','stages_configured',
    'request_created','approver_matched','no_rule_matched',
    'approval_recorded','rejection_recorded','returned_for_correction',
    'escalated','expired','cancelled','final_approved','final_rejected'
  ));

-- Bind approval decisions to request stages
alter table public.approval_decisions
  add column if not exists request_stage_id uuid;

alter table public.approval_decisions
  drop constraint if exists fk_decision_stage_containment;

alter table public.approval_decisions
  add constraint fk_decision_stage_containment
  foreign key (request_stage_id, approval_request_id)
  references public.approval_request_stages(id, approval_request_id)
  on delete cascade;

create unique index if not exists uq_stage_decision_approver
  on public.approval_decisions(request_stage_id, approver_id)
  where request_stage_id is not null;

-- ----------------------------------------------------------------------------
-- 3. SOP Procedure Sections
-- ----------------------------------------------------------------------------
create table if not exists public.sop_procedure_sections (
  id uuid primary key default gen_random_uuid(),
  sop_version_id uuid not null references public.document_versions(id) on delete cascade,
  sequence_number integer not null check (sequence_number >= 1),
  title_en text not null,
  title_ar text,
  description_en text,
  description_ar text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_sop_sections_version_seq unique (sop_version_id, sequence_number) deferrable initially immediate,
  unique (id, sop_version_id)
);

create index if not exists idx_sop_sections_version on public.sop_procedure_sections(sop_version_id, sequence_number);

-- ----------------------------------------------------------------------------
-- 4. SOP Procedure Steps Migration & Relational Containment
-- ----------------------------------------------------------------------------
alter table public.sop_procedure_steps
  alter column responsible_role drop not null;

alter table public.sop_procedure_steps
  add column if not exists section_id uuid;

alter table public.sop_procedure_steps
  drop constraint if exists uq_sop_procedure_steps_seq;

alter table public.sop_procedure_steps
  drop constraint if exists sop_procedure_steps_sop_version_id_sequence_number_key;

alter table public.sop_procedure_steps
  drop constraint if exists uq_sop_steps_version_seq;

alter table public.sop_procedure_steps
  add constraint uq_sop_steps_version_seq
  unique (sop_version_id, sequence_number) deferrable initially immediate;

alter table public.sop_procedure_steps
  drop constraint if exists uq_sop_steps_id_version;

alter table public.sop_procedure_steps
  add constraint uq_sop_steps_id_version
  unique (id, sop_version_id);

alter table public.sop_procedure_steps
  drop constraint if exists fk_sop_steps_section_containment;

alter table public.sop_procedure_steps
  add constraint fk_sop_steps_section_containment
  foreign key (section_id, sop_version_id)
  references public.sop_procedure_sections(id, sop_version_id)
  on delete restrict;

-- ----------------------------------------------------------------------------
-- 5. Relational Step-Level RACI Matrix
-- ----------------------------------------------------------------------------
create table if not exists public.sop_procedure_step_raci_assignments (
  id uuid primary key default gen_random_uuid(),
  sop_version_id uuid not null references public.document_versions(id) on delete cascade,
  step_id uuid not null,
  raci_type text not null check (raci_type in ('R', 'A', 'C', 'I')),
  role_name text not null,
  role_label_ar text,
  job_title text,
  sequence_number integer not null default 1,
  created_at timestamptz not null default now(),
  constraint fk_step_raci_containment
    foreign key (step_id, sop_version_id)
    references public.sop_procedure_steps(id, sop_version_id)
    on delete cascade,
  unique (sop_version_id, step_id, raci_type, role_name)
);

create index if not exists idx_step_raci_lookup on public.sop_procedure_step_raci_assignments(step_id, raci_type);
create index if not exists idx_step_raci_version on public.sop_procedure_step_raci_assignments(sop_version_id);

create unique index if not exists uq_step_raci_accountable
  on public.sop_procedure_step_raci_assignments(step_id)
  where raci_type = 'A';

-- ----------------------------------------------------------------------------
-- 6. Exact Version-to-Version Governed Document Links
-- ----------------------------------------------------------------------------
create table if not exists public.governed_document_version_links (
  id uuid primary key default gen_random_uuid(),
  source_version_id uuid not null references public.document_versions(id) on delete cascade,
  target_version_id uuid not null references public.document_versions(id) on delete restrict,
  relationship_type text not null check (relationship_type in ('implements_policy', 'references_sop', 'supersedes_version', 'supported_by_sop', 'related_governance')),
  context_note_en text,
  context_note_ar text,
  sequence_number integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_no_self_link check (source_version_id <> target_version_id),
  unique (source_version_id, target_version_id, relationship_type)
);

create index if not exists idx_doc_ver_links_source on public.governed_document_version_links(source_version_id, sequence_number);
create index if not exists idx_doc_ver_links_target on public.governed_document_version_links(target_version_id);

-- Tenant Isolation Validation Trigger for Version Links
create or replace function public.validate_governed_doc_ver_link_tenancy()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_src_org uuid;
  v_tgt_org uuid;
begin
  select d.organization_id into v_src_org
  from public.document_versions v
  join public.controlled_documents d on d.id = v.document_id
  where v.id = NEW.source_version_id;

  select d.organization_id into v_tgt_org
  from public.document_versions v
  join public.controlled_documents d on d.id = v.document_id
  where v.id = NEW.target_version_id;

  if v_src_org is null or v_tgt_org is null then
    raise exception 'PATCH206_LINKED_VERSION_NOT_FOUND';
  end if;

  if v_src_org <> v_tgt_org then
    raise exception 'PATCH206_CROSS_ORGANIZATION_LINK_DENIED';
  end if;

  return NEW;
end;
$$;

revoke execute on function public.validate_governed_doc_ver_link_tenancy() from public, anon, authenticated, service_role;

drop trigger if exists trg_validate_doc_ver_link_tenancy on public.governed_document_version_links;
create trigger trg_validate_doc_ver_link_tenancy
before insert or update on public.governed_document_version_links
for each row execute function public.validate_governed_doc_ver_link_tenancy();

-- ----------------------------------------------------------------------------
-- 7. Row Level Security & Direct-Mutation Guards
-- ----------------------------------------------------------------------------
alter table public.approval_authority_rule_stages enable row level security;
alter table public.approval_request_stages enable row level security;
alter table public.sop_procedure_sections enable row level security;
alter table public.sop_procedure_step_raci_assignments enable row level security;
alter table public.governed_document_version_links enable row level security;

-- Read policies for authenticated users
drop policy if exists approval_rule_stages_select on public.approval_authority_rule_stages;
create policy approval_rule_stages_select on public.approval_authority_rule_stages
for select to authenticated
using (
  exists (
    select 1 from public.approval_authority_rules r
    where r.id = approval_authority_rule_stages.authority_rule_id
      and r.organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
  )
);

drop policy if exists approval_request_stages_select on public.approval_request_stages;
create policy approval_request_stages_select on public.approval_request_stages
for select to authenticated
using (
  exists (
    select 1 from public.approval_requests req
    where req.id = approval_request_stages.approval_request_id
      and req.organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
  )
);

drop policy if exists sop_procedure_sections_select on public.sop_procedure_sections;
create policy sop_procedure_sections_select on public.sop_procedure_sections
for select to authenticated
using (
  exists (
    select 1 from public.document_versions v
    join public.controlled_documents d on d.id = v.document_id
    where v.id = sop_procedure_sections.sop_version_id
      and d.organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
  )
);

drop policy if exists sop_step_raci_select on public.sop_procedure_step_raci_assignments;
create policy sop_step_raci_select on public.sop_procedure_step_raci_assignments
for select to authenticated
using (
  exists (
    select 1 from public.document_versions v
    join public.controlled_documents d on d.id = v.document_id
    where v.id = sop_procedure_step_raci_assignments.sop_version_id
      and d.organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
  )
);

drop policy if exists governed_doc_version_links_select on public.governed_document_version_links;
create policy governed_doc_version_links_select on public.governed_document_version_links
for select to authenticated
using (
  exists (
    select 1 from public.document_versions v
    join public.controlled_documents d on d.id = v.document_id
    where v.id = governed_document_version_links.source_version_id
      and d.organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
  )
);

-- Direct Mutation Guard Triggers
create or replace function public.guard_staged_approval_mutations()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if current_user <> 'service_role' and coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    if TG_TABLE_NAME = 'approval_requests' then
      if exists (select 1 from public.approval_request_stages where approval_request_id = OLD.id) then
        if (NEW.request_status is distinct from OLD.request_status
            or NEW.final_decision is distinct from OLD.final_decision
            or NEW.received_approval_count is distinct from OLD.received_approval_count) then
          raise exception 'PATCH206_DIRECT_STAGED_REQUEST_MUTATION_FORBIDDEN';
        end if;
      end if;
    elsif TG_TABLE_NAME = 'approval_decisions' then
      if exists (
        select 1 from public.approval_request_stages
        where approval_request_id = coalesce(NEW.approval_request_id, OLD.approval_request_id)
      ) then
        raise exception 'PATCH206_DIRECT_STAGED_DECISION_MUTATION_FORBIDDEN';
      end if;
    end if;
  end if;

  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end;
$$;

revoke execute on function public.guard_staged_approval_mutations() from public, anon, authenticated, service_role;

drop trigger if exists trg_guard_staged_requests on public.approval_requests;
create trigger trg_guard_staged_requests
before update on public.approval_requests
for each row execute function public.guard_staged_approval_mutations();

drop trigger if exists trg_guard_staged_decisions on public.approval_decisions;
create trigger trg_guard_staged_decisions
before insert or update or delete on public.approval_decisions
for each row execute function public.guard_staged_approval_mutations();

-- ----------------------------------------------------------------------------
-- 8. Complete Immutability Function Extension
-- ----------------------------------------------------------------------------
create or replace function public.enforce_policy_sop_version_immutability()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_version_id uuid;
  v_locked_at timestamptz;
  v_approved_at timestamptz;
begin
  if TG_TABLE_NAME in ('governed_policy_details', 'governed_sop_details', 'document_version_department_scope', 'document_version_role_scope') then
    v_version_id := coalesce(NEW.version_id, OLD.version_id);
  elsif TG_TABLE_NAME = 'policy_requirements' then
    v_version_id := coalesce(NEW.policy_version_id, OLD.policy_version_id);
  elsif TG_TABLE_NAME = 'governed_document_version_links' then
    v_version_id := coalesce(NEW.source_version_id, OLD.source_version_id);
  elsif TG_TABLE_NAME in (
    'sop_procedure_sections', 'sop_procedure_steps', 'sop_procedure_step_raci_assignments',
    'sop_definitions', 'sop_role_responsibilities', 'sop_monitoring_kpis',
    'sop_version_risk_links', 'sop_version_accreditation_links',
    'sop_version_training_target_scopes'
  ) then
    v_version_id := coalesce(NEW.sop_version_id, OLD.sop_version_id);
  end if;

  select v.locked_at, v.approved_at
  into v_locked_at, v_approved_at
  from public.document_versions v
  where v.id = v_version_id;

  if v_locked_at is not null or v_approved_at is not null then
    raise exception 'PATCH201_VERSION_IMMUTABLE_LOCKED';
  end if;

  if TG_OP = 'DELETE' then
    return OLD;
  end if;
  return NEW;
end;
$$;

revoke execute on function public.enforce_policy_sop_version_immutability() from public, anon, authenticated, service_role;

drop trigger if exists trg_immutability_sop_procedure_sections on public.sop_procedure_sections;
create trigger trg_immutability_sop_procedure_sections
before insert or update or delete on public.sop_procedure_sections
for each row execute function public.enforce_policy_sop_version_immutability();

drop trigger if exists trg_immutability_sop_step_raci on public.sop_procedure_step_raci_assignments;
create trigger trg_immutability_sop_step_raci
before insert or update or delete on public.sop_procedure_step_raci_assignments
for each row execute function public.enforce_policy_sop_version_immutability();

drop trigger if exists trg_immutability_governed_doc_ver_links on public.governed_document_version_links;
create trigger trg_immutability_governed_doc_ver_links
before insert or update or delete on public.governed_document_version_links
for each row execute function public.enforce_policy_sop_version_immutability();

-- ----------------------------------------------------------------------------
-- 9. Authority-Stage Configuration RPC
-- ----------------------------------------------------------------------------
create or replace function public.configure_approval_authority_rule_stages(
  p_actor_id uuid,
  p_authority_rule_id uuid,
  p_stages jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rule record;
  v_actor_org_id uuid;
  v_stage jsonb;
  v_order integer := 1;
  v_user_id uuid;
  v_role text;
  v_count integer;
  v_self_appr boolean;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then
    raise exception 'PATCH27_AUTHORITY_SERVICE_ROLE_REQUIRED';
  end if;

  select * into v_rule
  from public.approval_authority_rules
  where id = p_authority_rule_id;

  if not found then
    raise exception 'PATCH27_AUTHORITY_RULE_NOT_FOUND';
  end if;

  -- 1. Validate Actor Profile and Organization Scope
  select organization_id into v_actor_org_id
  from public.profiles
  where id = p_actor_id and coalesce(is_active, true) = true;

  if v_actor_org_id is null then
    raise exception 'PATCH202_ACTOR_NOT_FOUND';
  end if;

  if v_actor_org_id <> v_rule.organization_id then
    raise exception 'PATCH202_ACTOR_CROSS_ORG_FORBIDDEN';
  end if;

  -- 2. Validate Canonical Administrative Governance Role
  if not exists (
    select 1 from public.user_roles ur
    where ur.user_id = p_actor_id
      and ur.is_active = true
      and ur.role in ('super_admin', 'governance_admin')
      and (ur.organization_id is null or ur.organization_id = v_rule.organization_id)
  ) then
    raise exception 'PATCH206_ACTOR_UNAUTHORIZED_FOR_STAGE_CONFIG';
  end if;

  if p_stages is null or jsonb_array_length(p_stages) = 0 then
    raise exception 'PATCH206_EMPTY_STAGE_CONFIGURATION';
  end if;

  delete from public.approval_authority_rule_stages where authority_rule_id = p_authority_rule_id;

  -- 3. Deterministic Server-Authoritative Contiguous 1..N Order Assignment
  for v_stage in select * from jsonb_array_elements(p_stages)
  loop
    v_user_id := nullif(v_stage->>'reviewer_user_id', '')::uuid;
    v_role := nullif(trim(v_stage->>'reviewer_role'), '');
    v_count := coalesce((v_stage->>'required_decision_count')::integer, 1);
    v_self_appr := coalesce((v_stage->>'allow_self_approval')::boolean, false);

    if (v_user_id is not null and v_role is not null) or (v_user_id is null and v_role is null) then
      raise exception 'PATCH206_INVALID_STAGE_AUTH_SELECTOR';
    end if;

    if v_user_id is not null and v_count <> 1 then
      raise exception 'PATCH206_USER_STAGE_REQUIRES_COUNT_ONE';
    end if;

    insert into public.approval_authority_rule_stages (
      authority_rule_id, stage_order, stage_key, stage_name_en, stage_name_ar,
      reviewer_role, reviewer_user_id, required_decision_count, allow_self_approval
    ) values (
      p_authority_rule_id,
      v_order,
      coalesce(nullif(trim(v_stage->>'stage_key'), ''), 'stage_' || v_order::text),
      coalesce(nullif(trim(v_stage->>'stage_name_en'), ''), 'Stage ' || v_order::text),
      nullif(trim(v_stage->>'stage_name_ar'), ''),
      v_role,
      v_user_id,
      v_count,
      v_self_appr
    );
    v_order := v_order + 1;
  end loop;

  -- 4. Write Patch 27 Authority Configuration Event
  perform public.patch27_write_authority_event(
    null,
    p_authority_rule_id,
    'stages_configured',
    null,
    null,
    p_actor_id,
    'Approval authority rule stages configured: ' || (v_order - 1)::text || ' stages.'
  );

  return jsonb_build_object(
    'success', true,
    'authority_rule_id', p_authority_rule_id,
    'stage_count', v_order - 1
  );
end;
$$;

revoke all on function public.configure_approval_authority_rule_stages(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.configure_approval_authority_rule_stages(uuid, uuid, jsonb) to service_role;

-- ----------------------------------------------------------------------------
-- 10. Ordered-Stage Decision Engine: record_approval_decision
-- ----------------------------------------------------------------------------
create or replace function public.record_approval_decision(
  p_approval_request_id uuid,
  p_approver_id uuid,
  p_decision text,
  p_decision_note text default null,
  p_approver_role text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.approval_requests%rowtype;
  v_current_stage public.approval_request_stages%rowtype;
  v_next_stage public.approval_request_stages%rowtype;
  v_actor_org_id uuid;
  v_is_delegate boolean;
  v_has_role boolean;
  v_auth_role text;
  v_new_req_status text;
  v_approved_count integer;
  v_doc_id uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then
    raise exception 'PATCH27_AUTHORITY_SERVICE_ROLE_REQUIRED';
  end if;

  if p_decision not in ('approved','rejected','returned','abstained') then
    raise exception 'PATCH27_INVALID_DECISION';
  end if;

  select * into v_request
  from public.approval_requests
  where id = p_approval_request_id
  for update;

  if not found then
    raise exception 'PATCH27_APPROVAL_REQUEST_NOT_FOUND';
  end if;

  if v_request.request_status in ('approved', 'rejected', 'returned', 'cancelled') then
    raise exception 'PATCH27_REQUEST_ALREADY_CLOSED';
  end if;

  -- 1. Infer Current In-Progress Stage
  select * into v_current_stage
  from public.approval_request_stages
  where approval_request_id = p_approval_request_id
    and stage_status = 'in_progress'
  order by stage_order asc
  limit 1
  for update;

  -- ==========================================================================
  -- PATH A: Request HAS Instantiated Stages
  -- ==========================================================================
  if found then
    -- Actor organization verification
    select organization_id into v_actor_org_id
    from public.profiles
    where id = p_approver_id and coalesce(is_active, true) = true;

    if v_actor_org_id is null or v_actor_org_id <> v_request.organization_id then
      raise exception 'PATCH27_APPROVER_ORGANIZATION_MISMATCH';
    end if;

    -- Self-approval check against stage snapshot
    if v_request.requested_by = p_approver_id and coalesce(v_current_stage.allow_self_approval, false) = false then
      raise exception 'PATCH27_SELF_APPROVAL_BLOCKED';
    end if;

    -- User authorization validation
    if v_current_stage.assigned_user_id is not null then
      if v_current_stage.assigned_user_id = p_approver_id then
        v_auth_role := 'assigned_user';
      else
        -- Check active delegation
        select exists (
          select 1 from public.approval_delegations
          where delegator_id = v_current_stage.assigned_user_id
            and delegate_id = p_approver_id
            and organization_id = v_request.organization_id
            and active_flag = true
            and (workflow_type is null or workflow_type = v_request.workflow_type)
            and (action_type is null or action_type = v_request.action_type)
            and (department_id is null or department_id = v_request.department_id)
            and now() between effective_from and effective_to
        ) into v_is_delegate;

        if not v_is_delegate then
          raise exception 'PATCH27_APPROVER_USER_MISMATCH';
        end if;
        v_auth_role := 'delegate_user';
      end if;
    elsif v_current_stage.assigned_role is not null then
      -- Role authorization validation: exact role match in organization scope
      select exists (
        select 1 from public.user_roles ur
        where ur.user_id = p_approver_id
          and ur.is_active = true
          and ur.role::text = v_current_stage.assigned_role
          and (ur.organization_id is null or ur.organization_id = v_request.organization_id)
      ) into v_has_role;

      if not v_has_role then
        select exists (
          select 1 from public.approval_delegations del
          join public.user_roles ur on ur.user_id = del.delegator_id
          where del.delegate_id = p_approver_id
            and del.organization_id = v_request.organization_id
            and del.active_flag = true
            and (del.workflow_type is null or del.workflow_type = v_request.workflow_type)
            and (del.action_type is null or del.action_type = v_request.action_type)
            and (del.department_id is null or del.department_id = v_request.department_id)
            and now() between del.effective_from and del.effective_to
            and ur.is_active = true
            and ur.role::text = v_current_stage.assigned_role
            and (ur.organization_id is null or ur.organization_id = v_request.organization_id)
        ) into v_has_role;
      end if;

      if not v_has_role then
        raise exception 'PATCH27_APPROVER_ROLE_MISMATCH';
      end if;
      v_auth_role := v_current_stage.assigned_role;
    end if;

    -- Prevent duplicate decision in same stage
    if exists (
      select 1 from public.approval_decisions
      where request_stage_id = v_current_stage.id and approver_id = p_approver_id
    ) then
      raise exception 'PATCH27_DUPLICATE_STAGE_DECISION';
    end if;

    -- Record decision bound to stage
    insert into public.approval_decisions (
      approval_request_id, request_stage_id, approver_id, approver_role,
      authority_rule_id, decision, decision_note
    ) values (
      p_approval_request_id, v_current_stage.id, p_approver_id, v_auth_role,
      v_request.authority_rule_id, p_decision, p_decision_note
    );

    if p_decision = 'rejected' then
      update public.approval_request_stages set stage_status = 'rejected', completed_at = now() where id = v_current_stage.id;
      v_new_req_status := 'rejected';

      if v_request.linked_item_type = 'document_version' then
        select document_id into v_doc_id from public.document_versions where id = v_request.linked_item_id;
        update public.controlled_documents set document_status = 'rejected', workflow_stage = 'rejected', updated_at = now() where id = v_doc_id;
      end if;
    elsif p_decision = 'returned' then
      update public.approval_request_stages set stage_status = 'returned', completed_at = now() where id = v_current_stage.id;
      v_new_req_status := 'returned';

      if v_request.linked_item_type = 'document_version' then
        select document_id into v_doc_id from public.document_versions where id = v_request.linked_item_id;
        update public.controlled_documents set document_status = 'draft', workflow_stage = 'draft', updated_at = now() where id = v_doc_id;
      end if;
    elsif p_decision = 'approved' then
      v_current_stage.received_decision_count := v_current_stage.received_decision_count + 1;
      update public.approval_request_stages set
        received_decision_count = v_current_stage.received_decision_count
      where id = v_current_stage.id;

      if v_current_stage.received_decision_count >= v_current_stage.required_decision_count then
        update public.approval_request_stages set stage_status = 'approved', completed_at = now() where id = v_current_stage.id;

        -- Check next stage
        select * into v_next_stage
        from public.approval_request_stages
        where approval_request_id = p_approval_request_id
          and stage_order > v_current_stage.stage_order
        order by stage_order asc
        limit 1
        for update;

        if found then
          update public.approval_request_stages set stage_status = 'in_progress', started_at = now() where id = v_next_stage.id;
          v_new_req_status := 'partially_approved';

          if v_request.linked_item_type = 'document_version' then
            select document_id into v_doc_id from public.document_versions where id = v_request.linked_item_id;
            update public.controlled_documents set workflow_stage = v_next_stage.stage_key, updated_at = now() where id = v_doc_id;
          end if;
        else
          v_new_req_status := 'approved';
          if v_request.linked_item_type = 'document_version' then
            select document_id into v_doc_id from public.document_versions where id = v_request.linked_item_id;
            update public.controlled_documents set workflow_stage = 'pending_finalization', updated_at = now() where id = v_doc_id;
          end if;
        end if;
      else
        v_new_req_status := 'partially_approved';
      end if;
    else
      -- Abstained does not advance
      v_new_req_status := v_request.request_status;
    end if;

  -- ==========================================================================
  -- PATH B: UN-STAGED Request (Preserves Patch27 Non-Regression Exact Behavior)
  -- ==========================================================================
  else
    if exists (
      select 1 from public.approval_request_stages
      where approval_request_id = p_approval_request_id and stage_status <> 'in_progress'
    ) then
      raise exception 'PATCH27_NO_IN_PROGRESS_STAGE';
    end if;

    if v_request.requested_by = p_approver_id
       and exists (
         select 1 from public.approval_authority_rules r
         where r.id = v_request.authority_rule_id
           and coalesce(r.allow_self_approval, false) = false
       ) then
      raise exception 'PATCH27_SELF_APPROVAL_BLOCKED';
    end if;

    insert into public.approval_decisions (
      approval_request_id, approver_id, approver_role,
      authority_rule_id, decision, decision_note
    ) values (
      p_approval_request_id, p_approver_id, p_approver_role,
      v_request.authority_rule_id, p_decision, p_decision_note
    );

    if p_decision = 'rejected' then
      v_new_req_status := 'rejected';
    elsif p_decision = 'returned' then
      v_new_req_status := 'returned';
    elsif p_decision = 'approved' then
      select count(*)::integer into v_approved_count
      from public.approval_decisions
      where approval_request_id = p_approval_request_id
        and decision = 'approved';

      if v_approved_count >= v_request.required_approval_count then
        v_new_req_status := 'approved';
      elsif v_approved_count > 0 then
        v_new_req_status := 'partially_approved';
      else
        v_new_req_status := v_request.request_status;
      end if;
    else
      v_new_req_status := v_request.request_status;
    end if;
  end if;

  -- Update request root
  update public.approval_requests set
    request_status = v_new_req_status,
    received_approval_count = (
      select count(*)::integer from public.approval_decisions
      where approval_request_id = p_approval_request_id and decision = 'approved'
    ),
    final_decision = case when v_new_req_status in ('approved','rejected','returned') then v_new_req_status else final_decision end,
    final_decision_by = case when v_new_req_status in ('approved','rejected','returned') then p_approver_id else final_decision_by end,
    final_decision_at = case when v_new_req_status in ('approved','rejected','returned') then now() else final_decision_at end,
    final_decision_note = case when v_new_req_status in ('approved','rejected','returned') then p_decision_note else final_decision_note end,
    updated_at = now()
  where id = p_approval_request_id;

  -- Write Patch 27 Authority Events
  perform public.patch27_write_authority_event(
    p_approval_request_id,
    v_request.authority_rule_id,
    case when p_decision = 'approved' then 'approval_recorded'
         when p_decision = 'rejected' then 'rejection_recorded'
         else 'returned_for_correction' end,
    v_request.request_status,
    v_new_req_status,
    p_approver_id,
    p_decision_note
  );

  if v_new_req_status = 'approved' then
    perform public.patch27_write_authority_event(
      p_approval_request_id, v_request.authority_rule_id, 'final_approved',
      v_request.request_status, 'approved', p_approver_id, p_decision_note
    );
  elsif v_new_req_status = 'rejected' then
    perform public.patch27_write_authority_event(
      p_approval_request_id, v_request.authority_rule_id, 'final_rejected',
      v_request.request_status, 'rejected', p_approver_id, p_decision_note
    );
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'approval_request_id', p_approval_request_id,
    'request_status', v_new_req_status,
    'current_stage_key', coalesce(v_next_stage.stage_key, v_current_stage.stage_key)
  );
end;
$$;

revoke all on function public.record_approval_decision(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.record_approval_decision(uuid, uuid, text, text, text) to service_role;

-- ----------------------------------------------------------------------------
-- 11. Fail-Closed Submission RPC: submit_governed_document_for_review
-- ----------------------------------------------------------------------------
create or replace function public.submit_governed_document_for_review(
  p_actor_id uuid,
  p_version_id uuid,
  p_submission_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_doc_id uuid;
  v_doc_type text;
  v_org_id uuid;
  v_dept_id uuid;
  v_criticality text;
  v_content_mode text;
  v_transcription_status text;
  v_step_count integer;
  v_raci_invalid_step_count integer;
  v_appr_req_id uuid;
  v_matched_rule_id uuid;
  v_stage record;
  v_first_stage_key text;
begin
  select d.id, d.document_type, d.organization_id, d.department_id, d.criticality_level
  into v_doc_id, v_doc_type, v_org_id, v_dept_id, v_criticality
  from public.document_versions v
  join public.controlled_documents d on d.id = v.document_id
  where v.id = p_version_id and v.locked_at is null and v.approved_at is null;

  if v_doc_id is null then
    raise exception 'PATCH202_VERSION_NOT_EDITABLE_FOR_SUBMISSION';
  end if;

  -- Validate Actor Tenancy
  if not exists (
    select 1 from public.profiles
    where id = p_actor_id and organization_id = v_org_id and coalesce(is_active, true) = true
  ) then
    raise exception 'PATCH202_ACTOR_CROSS_ORG_FORBIDDEN';
  end if;

  if exists (
    select 1 from public.approval_requests
    where linked_item_type = 'document_version'
      and linked_item_id = p_version_id
      and request_status in ('pending', 'partially_approved')
  ) then
    raise exception 'PATCH202_DUPLICATE_OPEN_SUBMISSION';
  end if;

  -- Completeness validation
  if v_doc_type = 'policy' then
    if not exists (select 1 from public.governed_policy_details where version_id = p_version_id and length(trim(policy_statement_en)) > 0) then
      raise exception 'PATCH202_POLICY_STATEMENT_REQUIRED';
    end if;
  elsif v_doc_type = 'sop' then
    select content_mode, transcription_status into v_content_mode, v_transcription_status
    from public.governed_sop_details where version_id = p_version_id;

    if coalesce(v_content_mode, 'structured') = 'structured' and coalesce(v_transcription_status, 'not_required') in ('not_required', 'complete') then
      select count(*) into v_step_count from public.sop_procedure_steps where sop_version_id = p_version_id;
      if v_step_count = 0 then
        raise exception 'PATCH202_SOP_STEPS_REQUIRED';
      end if;

      select count(*) into v_raci_invalid_step_count
      from public.sop_procedure_steps st
      where st.sop_version_id = p_version_id
        and (
          (select count(*) from public.sop_procedure_step_raci_assignments r where r.step_id = st.id and r.raci_type = 'R') < 1
          or
          (select count(*) from public.sop_procedure_step_raci_assignments r where r.step_id = st.id and r.raci_type = 'A') <> 1
        );

      if v_raci_invalid_step_count > 0 then
        raise exception 'PATCH206_SOP_STEP_RACI_INCOMPLETE';
      end if;
    end if;
  end if;

  -- 1. Create Approval Request via Patch 27 (Resolves Rule Authoritatively Once)
  v_appr_req_id := public.request_workflow_approval(
    p_organization_id => v_org_id,
    p_workflow_type   => 'document_control',
    p_linked_item_type=> 'document_version',
    p_linked_item_id  => p_version_id,
    p_action_type     => 'approve_document',
    p_requested_by    => p_actor_id,
    p_payload         => jsonb_build_object(
      'department_id', v_dept_id,
      'document_type', v_doc_type,
      'criticality_level', v_criticality,
      'request_reason', p_submission_note
    )
  );

  -- 2. Inspect Matched Rule ID (Fail-Closed)
  select authority_rule_id into v_matched_rule_id
  from public.approval_requests
  where id = v_appr_req_id;

  if v_matched_rule_id is null then
    raise exception 'PATCH206_AUTHORITY_RULE_REQUIRED';
  end if;

  if not exists (select 1 from public.approval_authority_rule_stages where authority_rule_id = v_matched_rule_id) then
    raise exception 'PATCH206_ORDERED_STAGES_REQUIRED';
  end if;

  -- 3. Instantiate Ordered Stages from Exact Matched Rule
  for v_stage in (
    select * from public.approval_authority_rule_stages
    where authority_rule_id = v_matched_rule_id
    order by stage_order asc
  )
  loop
    insert into public.approval_request_stages (
      approval_request_id, stage_order, stage_key, stage_name_en, stage_name_ar,
      stage_status, required_decision_count, assigned_role, assigned_user_id,
      allow_self_approval, started_at
    ) values (
      v_appr_req_id, v_stage.stage_order, v_stage.stage_key, v_stage.stage_name_en, v_stage.stage_name_ar,
      case when v_stage.stage_order = 1 then 'in_progress' else 'pending' end,
      v_stage.required_decision_count, v_stage.reviewer_role, v_stage.reviewer_user_id,
      v_stage.allow_self_approval,
      case when v_stage.stage_order = 1 then now() else null end
    );

    if v_stage.stage_order = 1 then
      v_first_stage_key := v_stage.stage_key;
    end if;
  end loop;

  -- 4. Update Document Status & Initial Stage
  update public.controlled_documents set
    document_status = 'under_review',
    workflow_stage = v_first_stage_key,
    updated_at = now()
  where id = v_doc_id;

  insert into public.document_review_events (
    document_id, version_id, event_type, from_status, to_status, actor_id, event_note
  ) values (
    v_doc_id, p_version_id, 'submitted_for_approval', 'draft', 'under_review', p_actor_id, p_submission_note
  );

  return jsonb_build_object(
    'document_id', v_doc_id,
    'version_id', p_version_id,
    'approval_request_id', v_appr_req_id,
    'workflow_stage', v_first_stage_key,
    'status', 'under_review'
  );
end;
$$;

revoke all on function public.submit_governed_document_for_review(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.submit_governed_document_for_review(uuid, uuid, text) to service_role;

-- ----------------------------------------------------------------------------
-- 12. Fail-Closed Finalization RPC: finalize_governed_document_approval
-- ----------------------------------------------------------------------------
create or replace function public.finalize_governed_document_approval(
  p_actor_id uuid,
  p_version_id uuid,
  p_approval_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_doc_id uuid;
  v_org_id uuid;
  v_is_locked boolean;
  v_appr_req_id uuid;
  v_final_decision text;
  v_final_approver_id uuid;
begin
  select d.id, d.organization_id, (v.locked_at is not null or v.approved_at is not null)
  into v_doc_id, v_org_id, v_is_locked
  from public.document_versions v
  join public.controlled_documents d on d.id = v.document_id
  where v.id = p_version_id;

  if v_doc_id is null then
    raise exception 'PATCH202_VERSION_NOT_FOUND';
  end if;

  -- Validate Actor Tenancy
  if not exists (
    select 1 from public.profiles
    where id = p_actor_id and organization_id = v_org_id and coalesce(is_active, true) = true
  ) then
    raise exception 'PATCH202_ACTOR_CROSS_ORG_FORBIDDEN';
  end if;

  if v_is_locked then
    return jsonb_build_object('success', true, 'already_approved', true, 'version_id', p_version_id);
  end if;

  -- 1. Authoritative Latest Approval Request Exists
  select id, final_decision
  into v_appr_req_id, v_final_decision
  from public.approval_requests
  where linked_item_type = 'document_version'
    and linked_item_id = p_version_id
    and workflow_type = 'document_control'
    and organization_id = v_org_id
  order by requested_at desc
  limit 1;

  if v_appr_req_id is null then
    raise exception 'PATCH202_APPROVAL_REQUEST_NOT_FOUND';
  end if;

  if v_final_decision is distinct from 'approved' then
    raise exception 'PATCH202_APPROVAL_NOT_FINALIZED';
  end if;

  -- 2. Verify Instantiated Stages Exist and Are ALL Approved
  if not exists (select 1 from public.approval_request_stages where approval_request_id = v_appr_req_id) then
    raise exception 'PATCH206_NO_STAGES_INSTANTIATED';
  end if;

  if exists (
    select 1 from public.approval_request_stages
    where approval_request_id = v_appr_req_id and stage_status <> 'approved'
  ) then
    raise exception 'PATCH206_APPROVAL_STAGES_INCOMPLETE';
  end if;

  -- 3. Derive approved_by strictly from the Final Stage Sign-Off
  select d.approver_id into v_final_approver_id
  from public.approval_decisions d
  join public.approval_request_stages s on s.id = d.request_stage_id
  where s.approval_request_id = v_appr_req_id
    and d.decision = 'approved'
  order by s.stage_order desc, d.decided_at desc
  limit 1;

  if v_final_approver_id is null then
    raise exception 'PATCH206_FINAL_APPROVER_NOT_FOUND';
  end if;

  -- 4. Lock Version and Finalize Status
  update public.document_versions set
    approved_by = v_final_approver_id,
    approved_at = now(),
    locked_by = p_actor_id,
    locked_at = now()
  where id = p_version_id;

  update public.controlled_documents set
    document_status = 'approved',
    workflow_stage = 'approved',
    updated_at = now()
  where id = v_doc_id;

  insert into public.document_review_events (
    document_id, version_id, event_type, from_status, to_status, actor_id, event_note
  ) values (
    v_doc_id, p_version_id, 'approved', 'under_review', 'approved', v_final_approver_id, p_approval_note
  );

  return jsonb_build_object(
    'document_id', v_doc_id,
    'version_id', p_version_id,
    'approved_by', v_final_approver_id,
    'status', 'approved'
  );
end;
$$;

revoke all on function public.finalize_governed_document_approval(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.finalize_governed_document_approval(uuid, uuid, text) to service_role;

-- ----------------------------------------------------------------------------
-- 13. Atomic Draft Save RPC: save_governed_sop_draft
-- ----------------------------------------------------------------------------
drop function if exists public.save_governed_sop_draft(uuid, uuid, text, text, text, text, text, text, uuid, uuid, text, text, text, boolean, boolean, boolean, integer, integer, jsonb, uuid[], jsonb);
drop function if exists public.save_governed_sop_draft(uuid, uuid, text, text, text, text, text, text, uuid, uuid, text, text, text, boolean, boolean, boolean, integer, integer, jsonb, uuid[], jsonb, jsonb, jsonb, jsonb);
drop function if exists public.save_governed_sop_draft(uuid, uuid, text, text, text, text, text, text, uuid, uuid, text, text, text, boolean, boolean, boolean, integer, integer, jsonb, uuid[], jsonb, jsonb, jsonb, jsonb, jsonb, jsonb);
drop function if exists public.save_governed_sop_draft(uuid, uuid, text, text, text, text, text, text, uuid, uuid, text, text, text, boolean, boolean, boolean, integer, integer, jsonb, jsonb, uuid[], jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb);
drop function if exists public.save_governed_sop_draft(uuid, uuid, text, text, text, text, text, text, uuid, uuid, text, text, text, boolean, boolean, boolean, integer, integer, text, text, jsonb, jsonb, uuid[], jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb);

create or replace function public.save_governed_sop_draft(
  p_actor_id uuid,
  p_version_id uuid,
  p_title_en text default null,
  p_title_ar text default null,
  p_process_name_en text default null,
  p_process_name_ar text default null,
  p_purpose_en text default null,
  p_purpose_ar text default null,
  p_process_owner_id uuid default null,
  p_primary_policy_version_id uuid default null,
  p_governance_link_state text default null,
  p_scope_en text default null,
  p_scope_ar text default null,
  p_training_required boolean default null,
  p_acknowledgment_required boolean default null,
  p_competency_assessment_required boolean default null,
  p_acknowledgment_sla_days integer default null,
  p_training_renewal_months integer default null,
  p_content_mode text default null,
  p_transcription_status text default null,
  p_procedure_sections jsonb default null,
  p_procedure_steps jsonb default null,
  p_department_scopes uuid[] default null,
  p_role_scopes jsonb default null,
  p_definitions jsonb default null,
  p_role_responsibilities jsonb default null,
  p_monitoring_kpis jsonb default null,
  p_risk_links jsonb default null,
  p_accreditation_links jsonb default null,
  p_version_links jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_doc_id uuid;
  v_org_id uuid;
  v_sec jsonb;
  v_step jsonb;
  v_raci jsonb;
  v_def jsonb;
  v_resp jsonb;
  v_kpi jsonb;
  v_risk jsonb;
  v_acc jsonb;
  v_link jsonb;
  v_dept_id uuid;
  v_role jsonb;
  v_item_id uuid;
  v_step_id uuid;
  v_sec_id uuid;
  v_primary_r_role text;

  v_existing_sec_ids uuid[];
  v_existing_step_ids uuid[];
  v_existing_def_ids uuid[];
  v_existing_resp_ids uuid[];
  v_existing_kpi_ids uuid[];
  v_existing_risk_ids uuid[];
  v_existing_acc_ids uuid[];
  v_existing_link_ids uuid[];

  v_payload_sec_ids uuid[] := '{}'::uuid[];
  v_payload_step_ids uuid[] := '{}'::uuid[];
  v_payload_def_ids uuid[] := '{}'::uuid[];
  v_payload_resp_ids uuid[] := '{}'::uuid[];
  v_payload_kpi_ids uuid[] := '{}'::uuid[];
  v_payload_risk_ids uuid[] := '{}'::uuid[];
  v_payload_acc_ids uuid[] := '{}'::uuid[];
  v_payload_link_ids uuid[] := '{}'::uuid[];

  v_section_key_map jsonb := '{}'::jsonb;
  v_step_key_map jsonb := '{}'::jsonb;
begin
  set constraints uq_sop_sections_version_seq, uq_sop_steps_version_seq deferred;

  select d.id, d.organization_id into v_doc_id, v_org_id
  from public.document_versions v
  join public.controlled_documents d on d.id = v.document_id
  where v.id = p_version_id and d.document_type = 'sop';

  if v_doc_id is null then raise exception 'PATCH202_SOP_VERSION_NOT_FOUND'; end if;

  -- Validate Actor Tenancy
  if not exists (
    select 1 from public.profiles
    where id = p_actor_id and organization_id = v_org_id and coalesce(is_active, true) = true
  ) then
    raise exception 'PATCH202_ACTOR_CROSS_ORG_FORBIDDEN';
  end if;

  if exists (select 1 from public.document_versions where id = p_version_id and (locked_at is not null or approved_at is not null)) then
    raise exception 'PATCH201_VERSION_IMMUTABLE_LOCKED';
  end if;

  if p_title_en is not null then
    update public.controlled_documents set document_title = p_title_en, updated_at = now() where id = v_doc_id;
  end if;

  insert into public.governed_sop_details (
    version_id, title_en, title_ar, process_name_en, process_name_ar,
    purpose_en, purpose_ar, scope_en, scope_ar, process_owner_id,
    primary_policy_version_id, governance_link_state, training_required,
    acknowledgment_required, competency_assessment_required,
    acknowledgment_sla_days, training_renewal_months,
    content_mode, transcription_status, updated_at
  ) values (
    p_version_id, coalesce(p_title_en, 'Untitled SOP'), p_title_ar,
    coalesce(p_process_name_en, 'General Process'), p_process_name_ar,
    coalesce(p_purpose_en, 'Operational standard procedure'), p_purpose_ar,
    p_scope_en, p_scope_ar, p_process_owner_id, p_primary_policy_version_id,
    coalesce(p_governance_link_state, case when p_primary_policy_version_id is not null then 'linked' else 'not_applicable' end),
    coalesce(p_training_required, false), coalesce(p_acknowledgment_required, true),
    coalesce(p_competency_assessment_required, false), coalesce(p_acknowledgment_sla_days, 30),
    coalesce(p_training_renewal_months, 12),
    coalesce(p_content_mode, 'structured'),
    case when coalesce(p_content_mode, 'structured') = 'structured'
         then coalesce(p_transcription_status, 'complete')
         else coalesce(p_transcription_status, 'not_required') end,
    now()
  )
  on conflict (version_id) do update set
    title_en = coalesce(p_title_en, governed_sop_details.title_en),
    title_ar = coalesce(p_title_ar, governed_sop_details.title_ar),
    process_name_en = coalesce(p_process_name_en, governed_sop_details.process_name_en),
    process_name_ar = coalesce(p_process_name_ar, governed_sop_details.process_name_ar),
    purpose_en = coalesce(p_purpose_en, governed_sop_details.purpose_en),
    purpose_ar = coalesce(p_purpose_ar, governed_sop_details.purpose_ar),
    scope_en = coalesce(p_scope_en, governed_sop_details.scope_en),
    scope_ar = coalesce(p_scope_ar, governed_sop_details.scope_ar),
    process_owner_id = coalesce(p_process_owner_id, governed_sop_details.process_owner_id),
    primary_policy_version_id = coalesce(p_primary_policy_version_id, governed_sop_details.primary_policy_version_id),
    governance_link_state = coalesce(p_governance_link_state, case when coalesce(p_primary_policy_version_id, governed_sop_details.primary_policy_version_id) is not null then 'linked' else governed_sop_details.governance_link_state end),
    training_required = coalesce(p_training_required, governed_sop_details.training_required),
    acknowledgment_required = coalesce(p_acknowledgment_required, governed_sop_details.acknowledgment_required),
    competency_assessment_required = coalesce(p_competency_assessment_required, governed_sop_details.competency_assessment_required),
    acknowledgment_sla_days = coalesce(p_acknowledgment_sla_days, governed_sop_details.acknowledgment_sla_days),
    training_renewal_months = coalesce(p_training_renewal_months, governed_sop_details.training_renewal_months),
    content_mode = coalesce(p_content_mode, governed_sop_details.content_mode),
    transcription_status = coalesce(p_transcription_status, governed_sop_details.transcription_status),
    updated_at = now();

  -- 1. Reconcile Sections & Map Keys
  create temp table if not exists tmp_sec_key_map (client_key text primary key, sec_id uuid not null) on commit drop;
  truncate table tmp_sec_key_map;

  if p_procedure_sections is not null then
    select array_agg(id) into v_existing_sec_ids from public.sop_procedure_sections where sop_version_id = p_version_id;

    for v_sec in select * from jsonb_array_elements(p_procedure_sections)
    loop
      v_item_id := nullif(v_sec->>'id', '')::uuid;
      if v_item_id is not null then
        if not (v_item_id = any(coalesce(v_existing_sec_ids, '{}'::uuid[]))) then
          raise exception 'PATCH202_CROSS_VERSION_CHILD_ID_DENIED';
        end if;
        v_payload_sec_ids := array_append(v_payload_sec_ids, v_item_id);
        update public.sop_procedure_sections set
          sequence_number = (v_sec->>'sequence_number')::integer,
          title_en = coalesce(v_sec->>'title_en', title_en),
          title_ar = v_sec->>'title_ar',
          description_en = v_sec->>'description_en',
          description_ar = v_sec->>'description_ar',
          updated_at = now()
        where id = v_item_id and sop_version_id = p_version_id;
      else
        v_item_id := gen_random_uuid();
        insert into public.sop_procedure_sections (
          id, sop_version_id, sequence_number, title_en, title_ar, description_en, description_ar
        ) values (
          v_item_id, p_version_id, (v_sec->>'sequence_number')::integer,
          coalesce(v_sec->>'title_en', 'Section ' || coalesce(v_sec->>'sequence_number', '1')),
          v_sec->>'title_ar', v_sec->>'description_en', v_sec->>'description_ar'
        );
        v_payload_sec_ids := array_append(v_payload_sec_ids, v_item_id);
      end if;

      if nullif(v_sec->>'client_key', '') is not null then
        insert into tmp_sec_key_map (client_key, sec_id) values (v_sec->>'client_key', v_item_id);
        v_section_key_map := jsonb_set(v_section_key_map, array[v_sec->>'client_key'], to_jsonb(v_item_id::text));
      end if;
    end loop;
  end if;

  -- 2. Reconcile Steps & Nested RACI
  if p_procedure_steps is not null then
    select array_agg(id) into v_existing_step_ids from public.sop_procedure_steps where sop_version_id = p_version_id;

    for v_step in select * from jsonb_array_elements(p_procedure_steps)
    loop
      v_sec_id := nullif(v_step->>'section_id', '')::uuid;
      if v_sec_id is null and nullif(v_step->>'section_client_key', '') is not null then
        select sec_id into v_sec_id from tmp_sec_key_map where client_key = v_step->>'section_client_key';
        if v_sec_id is null then
          raise exception 'PATCH206_UNRESOLVED_SECTION_CLIENT_KEY';
        end if;
      end if;

      v_step_id := nullif(v_step->>'id', '')::uuid;
      if v_step_id is not null then
        if not (v_step_id = any(coalesce(v_existing_step_ids, '{}'::uuid[]))) then
          raise exception 'PATCH202_CROSS_VERSION_CHILD_ID_DENIED';
        end if;
        v_payload_step_ids := array_append(v_payload_step_ids, v_step_id);

        if v_step ? 'raci_assignments' then
          -- A. raci_assignments explicitly present with >=1 R -> primary R
          -- B. raci_assignments explicitly present with no R -> NULL
          select nullif(trim(r->>'role_name'), '') into v_primary_r_role
          from jsonb_array_elements(v_step->'raci_assignments') r
          where r->>'raci_type' = 'R'
          limit 1;

          update public.sop_procedure_steps set
            section_id = v_sec_id,
            sequence_number = (v_step->>'sequence_number')::integer,
            responsible_role = v_primary_r_role,
            action_instruction_en = coalesce(v_step->>'action_instruction_en', action_instruction_en),
            action_instruction_ar = v_step->>'action_instruction_ar',
            required_control_id = nullif(v_step->>'required_control_id', '')::uuid,
            expected_evidence_record_en = v_step->>'expected_evidence_record_en',
            expected_evidence_record_ar = v_step->>'expected_evidence_record_ar',
            timing_sla_en = v_step->>'timing_sla_en',
            timing_sla_ar = v_step->>'timing_sla_ar',
            is_decision_point = coalesce((v_step->>'is_decision_point')::boolean, false),
            decision_criteria_en = v_step->>'decision_criteria_en',
            decision_criteria_ar = v_step->>'decision_criteria_ar',
            criticality = coalesce(v_step->>'criticality', 'medium'),
            escalation_trigger_en = v_step->>'escalation_trigger_en',
            escalation_trigger_ar = v_step->>'escalation_trigger_ar',
            escalation_destination_role = v_step->>'escalation_destination_role',
            updated_at = now()
          where id = v_step_id and sop_version_id = p_version_id;
        else
          -- C. raci_assignments omitted:
          -- If explicit responsible_role supplied -> use supplied legacy value
          -- If responsible_role omitted -> PRESERVE existing DB value
          update public.sop_procedure_steps set
            section_id = v_sec_id,
            sequence_number = (v_step->>'sequence_number')::integer,
            responsible_role = case when v_step ? 'responsible_role' then nullif(trim(v_step->>'responsible_role'), '') else responsible_role end,
            action_instruction_en = coalesce(v_step->>'action_instruction_en', action_instruction_en),
            action_instruction_ar = v_step->>'action_instruction_ar',
            required_control_id = nullif(v_step->>'required_control_id', '')::uuid,
            expected_evidence_record_en = v_step->>'expected_evidence_record_en',
            expected_evidence_record_ar = v_step->>'expected_evidence_record_ar',
            timing_sla_en = v_step->>'timing_sla_en',
            timing_sla_ar = v_step->>'timing_sla_ar',
            is_decision_point = coalesce((v_step->>'is_decision_point')::boolean, false),
            decision_criteria_en = v_step->>'decision_criteria_en',
            decision_criteria_ar = v_step->>'decision_criteria_ar',
            criticality = coalesce(v_step->>'criticality', 'medium'),
            escalation_trigger_en = v_step->>'escalation_trigger_en',
            escalation_trigger_ar = v_step->>'escalation_trigger_ar',
            escalation_destination_role = v_step->>'escalation_destination_role',
            updated_at = now()
          where id = v_step_id and sop_version_id = p_version_id;
        end if;
      else
        -- NEW step
        v_step_id := gen_random_uuid();
        if v_step ? 'raci_assignments' then
          select nullif(trim(r->>'role_name'), '') into v_primary_r_role
          from jsonb_array_elements(v_step->'raci_assignments') r
          where r->>'raci_type' = 'R'
          limit 1;
        else
          v_primary_r_role := nullif(trim(v_step->>'responsible_role'), '');
        end if;

        insert into public.sop_procedure_steps (
          id, sop_version_id, section_id, sequence_number, responsible_role,
          action_instruction_en, action_instruction_ar, required_control_id,
          expected_evidence_record_en, expected_evidence_record_ar,
          timing_sla_en, timing_sla_ar, is_decision_point,
          decision_criteria_en, decision_criteria_ar, criticality,
          escalation_trigger_en, escalation_trigger_ar, escalation_destination_role
        ) values (
          v_step_id, p_version_id, v_sec_id, (v_step->>'sequence_number')::integer,
          v_primary_r_role,
          coalesce(v_step->>'action_instruction_en', 'Step ' || coalesce(v_step->>'sequence_number', '1')),
          v_step->>'action_instruction_ar',
          nullif(v_step->>'required_control_id', '')::uuid,
          v_step->>'expected_evidence_record_en', v_step->>'expected_evidence_record_ar',
          v_step->>'timing_sla_en', v_step->>'timing_sla_ar',
          coalesce((v_step->>'is_decision_point')::boolean, false),
          v_step->>'decision_criteria_en', v_step->>'decision_criteria_ar',
          coalesce(v_step->>'criticality', 'medium'),
          v_step->>'escalation_trigger_en', v_step->>'escalation_trigger_ar',
          v_step->>'escalation_destination_role'
        );
        v_payload_step_ids := array_append(v_payload_step_ids, v_step_id);
      end if;

      if nullif(v_step->>'client_key', '') is not null then
        v_step_key_map := jsonb_set(v_step_key_map, array[v_step->>'client_key'], to_jsonb(v_step_id::text));
      end if;

      -- Reconcile RACI rows for this step
      if v_step ? 'raci_assignments' then
        delete from public.sop_procedure_step_raci_assignments where step_id = v_step_id and sop_version_id = p_version_id;

        for v_raci in select * from jsonb_array_elements(v_step->'raci_assignments')
        loop
          if nullif(trim(v_raci->>'role_name'), '') is not null then
            insert into public.sop_procedure_step_raci_assignments (
              sop_version_id, step_id, raci_type, role_name, role_label_ar, job_title, sequence_number
            ) values (
              p_version_id, v_step_id, v_raci->>'raci_type',
              trim(v_raci->>'role_name'),
              nullif(trim(v_raci->>'role_label_ar'), ''),
              nullif(trim(v_raci->>'job_title'), ''),
              coalesce((v_raci->>'sequence_number')::integer, 1)
            );
          end if;
        end loop;
      end if;
    end loop;

    delete from public.sop_procedure_steps where sop_version_id = p_version_id and not (id = any(v_payload_step_ids));
  end if;

  if p_procedure_sections is not null then
    delete from public.sop_procedure_sections where sop_version_id = p_version_id and not (id = any(v_payload_sec_ids));
  end if;

  -- 3. Reconcile Version Links
  if p_version_links is not null then
    select array_agg(id) into v_existing_link_ids from public.governed_document_version_links where source_version_id = p_version_id;
    for v_link in select * from jsonb_array_elements(p_version_links) loop
      v_item_id := nullif(v_link->>'id', '')::uuid;
      if v_item_id is not null and (v_item_id = any(coalesce(v_existing_link_ids, '{}'::uuid[]))) then
        v_payload_link_ids := array_append(v_payload_link_ids, v_item_id);
        update public.governed_document_version_links set
          target_version_id = (v_link->>'target_version_id')::uuid,
          relationship_type = v_link->>'relationship_type',
          context_note_en = v_link->>'context_note_en',
          context_note_ar = v_link->>'context_note_ar',
          sequence_number = coalesce((v_link->>'sequence_number')::integer, 1),
          updated_at = now()
        where id = v_item_id and source_version_id = p_version_id;
      else
        insert into public.governed_document_version_links (
          source_version_id, target_version_id, relationship_type, context_note_en, context_note_ar, sequence_number
        ) values (
          p_version_id, (v_link->>'target_version_id')::uuid, v_link->>'relationship_type',
          v_link->>'context_note_en', v_link->>'context_note_ar', coalesce((v_link->>'sequence_number')::integer, 1)
        ) returning id into v_item_id;
        v_payload_link_ids := array_append(v_payload_link_ids, v_item_id);
      end if;
    end loop;
    delete from public.governed_document_version_links where source_version_id = p_version_id and not (id = any(v_payload_link_ids));
  end if;

  -- 4. Scope, Definitions, Responsibilities, KPIs, Risks, Accreditations
  if p_department_scopes is not null then
    delete from public.document_version_department_scope where version_id = p_version_id;
    foreach v_dept_id in array p_department_scopes loop
      insert into public.document_version_department_scope (version_id, department_id) values (p_version_id, v_dept_id);
    end loop;
  end if;

  if p_role_scopes is not null then
    delete from public.document_version_role_scope where version_id = p_version_id;
    for v_role in select * from jsonb_array_elements(p_role_scopes) loop
      insert into public.document_version_role_scope (version_id, role_name, role_label_ar, is_mandatory)
      values (p_version_id, v_role->>'role_name', v_role->>'role_label_ar', coalesce((v_role->>'is_mandatory')::boolean, true));
    end loop;
  end if;

  if p_definitions is not null then
    select array_agg(id) into v_existing_def_ids from public.sop_definitions where sop_version_id = p_version_id;
    for v_def in select * from jsonb_array_elements(p_definitions) loop
      v_item_id := nullif(v_def->>'id', '')::uuid;
      if v_item_id is not null and (v_item_id = any(coalesce(v_existing_def_ids, '{}'::uuid[]))) then
        v_payload_def_ids := array_append(v_payload_def_ids, v_item_id);
        update public.sop_definitions set
          term_en = coalesce(v_def->>'term_en', term_en),
          term_ar = v_def->>'term_ar',
          definition_en = coalesce(v_def->>'definition_en', definition_en),
          definition_ar = v_def->>'definition_ar',
          abbreviation = coalesce(v_def->>'abbreviation', v_def->>'acronym'),
          sequence_number = coalesce((v_def->>'sequence_number')::integer, 1),
          updated_at = now()
        where id = v_item_id and sop_version_id = p_version_id;
      else
        insert into public.sop_definitions (
          sop_version_id, term_en, term_ar, definition_en, definition_ar, abbreviation, sequence_number
        ) values (
          p_version_id, coalesce(v_def->>'term_en', 'Term'), v_def->>'term_ar',
          coalesce(v_def->>'definition_en', 'Definition'), v_def->>'definition_ar',
          coalesce(v_def->>'abbreviation', v_def->>'acronym'), coalesce((v_def->>'sequence_number')::integer, 1)
        ) returning id into v_item_id;
        v_payload_def_ids := array_append(v_payload_def_ids, v_item_id);
      end if;
    end loop;
    delete from public.sop_definitions where sop_version_id = p_version_id and not (id = any(v_payload_def_ids));
  end if;

  if p_role_responsibilities is not null then
    select array_agg(id) into v_existing_resp_ids from public.sop_role_responsibilities where sop_version_id = p_version_id;
    for v_resp in select * from jsonb_array_elements(p_role_responsibilities) loop
      v_item_id := nullif(v_resp->>'id', '')::uuid;
      if v_item_id is not null and (v_item_id = any(coalesce(v_existing_resp_ids, '{}'::uuid[]))) then
        v_payload_resp_ids := array_append(v_payload_resp_ids, v_item_id);
        update public.sop_role_responsibilities set
          role_name = coalesce(v_resp->>'role_name', role_name),
          role_label_ar = v_resp->>'role_label_ar',
          job_title = v_resp->>'job_title',
          responsibility_en = coalesce(v_resp->>'responsibility_en', responsibility_en),
          responsibility_ar = v_resp->>'responsibility_ar',
          sequence_number = coalesce((v_resp->>'sequence_number')::integer, 1),
          updated_at = now()
        where id = v_item_id and sop_version_id = p_version_id;
      else
        insert into public.sop_role_responsibilities (
          sop_version_id, role_name, role_label_ar, job_title, responsibility_en, responsibility_ar, sequence_number
        ) values (
          p_version_id, coalesce(v_resp->>'role_name', 'Role'), v_resp->>'role_label_ar',
          v_resp->>'job_title', coalesce(v_resp->>'responsibility_en', 'Responsibility'),
          v_resp->>'responsibility_ar', coalesce((v_resp->>'sequence_number')::integer, 1)
        ) returning id into v_item_id;
        v_payload_resp_ids := array_append(v_payload_resp_ids, v_item_id);
      end if;
    end loop;
    delete from public.sop_role_responsibilities where sop_version_id = p_version_id and not (id = any(v_payload_resp_ids));
  end if;

  if p_monitoring_kpis is not null then
    select array_agg(id) into v_existing_kpi_ids from public.sop_monitoring_kpis where sop_version_id = p_version_id;
    for v_kpi in select * from jsonb_array_elements(p_monitoring_kpis) loop
      v_item_id := nullif(v_kpi->>'id', '')::uuid;
      if v_item_id is not null and (v_item_id = any(coalesce(v_existing_kpi_ids, '{}'::uuid[]))) then
        v_payload_kpi_ids := array_append(v_payload_kpi_ids, v_item_id);
        update public.sop_monitoring_kpis set
          kpi_name_en = coalesce(v_kpi->>'kpi_name_en', kpi_name_en),
          kpi_name_ar = v_kpi->>'kpi_name_ar',
          target_metric_en = coalesce(v_kpi->>'target_metric_en', target_metric_en),
          target_metric_ar = v_kpi->>'target_metric_ar',
          measurement_frequency = coalesce(v_kpi->>'measurement_frequency', measurement_frequency),
          reporting_responsible_role = v_kpi->>'reporting_responsible_role',
          sequence_number = coalesce((v_kpi->>'sequence_number')::integer, 1),
          updated_at = now()
        where id = v_item_id and sop_version_id = p_version_id;
      else
        insert into public.sop_monitoring_kpis (
          sop_version_id, kpi_name_en, kpi_name_ar, target_metric_en, target_metric_ar, measurement_frequency, reporting_responsible_role, sequence_number
        ) values (
          p_version_id, coalesce(v_kpi->>'kpi_name_en', 'KPI'), v_kpi->>'kpi_name_ar',
          coalesce(v_kpi->>'target_metric_en', 'Target'), v_kpi->>'target_metric_ar',
          coalesce(v_kpi->>'measurement_frequency', 'monthly'), v_kpi->>'reporting_responsible_role',
          coalesce((v_kpi->>'sequence_number')::integer, 1)
        ) returning id into v_item_id;
        v_payload_kpi_ids := array_append(v_payload_kpi_ids, v_item_id);
      end if;
    end loop;
    delete from public.sop_monitoring_kpis where sop_version_id = p_version_id and not (id = any(v_payload_kpi_ids));
  end if;

  if p_risk_links is not null then
    select array_agg(id) into v_existing_risk_ids from public.sop_version_risk_links where sop_version_id = p_version_id;
    for v_risk in select * from jsonb_array_elements(p_risk_links) loop
      v_item_id := nullif(v_risk->>'id', '')::uuid;
      if v_item_id is not null and (v_item_id = any(coalesce(v_existing_risk_ids, '{}'::uuid[]))) then
        v_payload_risk_ids := array_append(v_payload_risk_ids, v_item_id);
        update public.sop_version_risk_links set
          risk_id = (v_risk->>'risk_id')::uuid,
          mitigation_type = coalesce(v_risk->>'mitigation_type', mitigation_type),
          notes = v_risk->>'notes',
          sequence_number = coalesce((v_risk->>'sequence_number')::integer, 1),
          updated_at = now()
        where id = v_item_id and sop_version_id = p_version_id;
      else
        insert into public.sop_version_risk_links (
          sop_version_id, risk_id, mitigation_type, notes, sequence_number
        ) values (
          p_version_id, (v_risk->>'risk_id')::uuid, coalesce(v_risk->>'mitigation_type', 'prevents'),
          v_risk->>'notes', coalesce((v_risk->>'sequence_number')::integer, 1)
        ) returning id into v_item_id;
        v_payload_risk_ids := array_append(v_payload_risk_ids, v_item_id);
      end if;
    end loop;
    delete from public.sop_version_risk_links where sop_version_id = p_version_id and not (id = any(v_payload_risk_ids));
  end if;

  if p_accreditation_links is not null then
    select array_agg(id) into v_existing_acc_ids from public.sop_version_accreditation_links where sop_version_id = p_version_id;
    for v_acc in select * from jsonb_array_elements(p_accreditation_links) loop
      v_item_id := nullif(v_acc->>'id', '')::uuid;
      if v_item_id is not null and (v_item_id = any(coalesce(v_existing_acc_ids, '{}'::uuid[]))) then
        v_payload_acc_ids := array_append(v_payload_acc_ids, v_item_id);
        update public.sop_version_accreditation_links set
          requirement_id = (v_acc->>'requirement_id')::uuid,
          compliance_type = coalesce(v_acc->>'compliance_type', compliance_type),
          notes = v_acc->>'notes',
          sequence_number = coalesce((v_acc->>'sequence_number')::integer, 1),
          updated_at = now()
        where id = v_item_id and sop_version_id = p_version_id;
      else
        insert into public.sop_version_accreditation_links (
          sop_version_id, requirement_id, compliance_type, notes, sequence_number
        ) values (
          p_version_id, (v_acc->>'requirement_id')::uuid, coalesce(v_acc->>'compliance_type', 'satisfies'),
          v_acc->>'notes', coalesce((v_acc->>'sequence_number')::integer, 1)
        ) returning id into v_item_id;
        v_payload_acc_ids := array_append(v_payload_acc_ids, v_item_id);
      end if;
    end loop;
    delete from public.sop_version_accreditation_links where sop_version_id = p_version_id and not (id = any(v_payload_acc_ids));
  end if;

  return jsonb_build_object(
    'document_id', v_doc_id,
    'version_id', p_version_id,
    'section_key_map', v_section_key_map,
    'step_key_map', v_step_key_map
  );
end;
$$;

revoke all on function public.save_governed_sop_draft(uuid, uuid, text, text, text, text, text, text, uuid, uuid, text, text, text, boolean, boolean, boolean, integer, integer, text, text, jsonb, jsonb, uuid[], jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.save_governed_sop_draft(uuid, uuid, text, text, text, text, text, text, uuid, uuid, text, text, text, boolean, boolean, boolean, integer, integer, text, text, jsonb, jsonb, uuid[], jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) to service_role;

-- ----------------------------------------------------------------------------
-- 14. Create Governed SOP Draft RPC: create_governed_sop_draft
-- ----------------------------------------------------------------------------
drop function if exists public.create_governed_sop_draft(uuid, uuid, text, text, text, text, text, text, uuid, uuid, text, text, text, uuid, text, text, boolean, boolean, boolean, integer, integer, text, jsonb, uuid[], jsonb);
drop function if exists public.create_governed_sop_draft(uuid, uuid, text, text, text, text, text, text, uuid, uuid, text, text, text, uuid, text, text, boolean, boolean, boolean, integer, integer, text, jsonb, uuid[], jsonb, jsonb, jsonb, jsonb);
drop function if exists public.create_governed_sop_draft(uuid, uuid, text, text, text, text, text, text, uuid, uuid, text, text, text, uuid, text, text, boolean, boolean, boolean, integer, integer, text, jsonb, jsonb, uuid[], jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb);

create or replace function public.create_governed_sop_draft(
  p_actor_id uuid,
  p_organization_id uuid,
  p_title_en text,
  p_title_ar text default null,
  p_process_name_en text default null,
  p_process_name_ar text default null,
  p_purpose_en text default null,
  p_purpose_ar text default null,
  p_process_owner_id uuid default null,
  p_primary_policy_version_id uuid default null,
  p_governance_link_state text default null,
  p_scope_en text default null,
  p_scope_ar text default null,
  p_department_id uuid default null,
  p_criticality_level text default 'medium',
  p_confidentiality_level text default 'internal',
  p_training_required boolean default false,
  p_acknowledgment_required boolean default false,
  p_competency_assessment_required boolean default false,
  p_acknowledgment_sla_days integer default 30,
  p_training_renewal_months integer default 12,
  p_content_mode text default 'structured',
  p_procedure_sections jsonb default '[]'::jsonb,
  p_procedure_steps jsonb default '[]'::jsonb,
  p_department_scopes uuid[] default '{}'::uuid[],
  p_role_scopes jsonb default '[]'::jsonb,
  p_definitions jsonb default '[]'::jsonb,
  p_role_responsibilities jsonb default '[]'::jsonb,
  p_monitoring_kpis jsonb default '[]'::jsonb,
  p_risk_links jsonb default '[]'::jsonb,
  p_accreditation_links jsonb default '[]'::jsonb,
  p_version_links jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_doc_id uuid;
  v_ver_id uuid;
  v_dept_code text;
  v_doc_code text;
  v_save_res jsonb;
begin
  if not exists (
    select 1 from public.profiles
    where id = p_actor_id and organization_id = p_organization_id and coalesce(is_active, true) = true
  ) then
    raise exception 'PATCH202_ACTOR_NOT_AUTHORIZED';
  end if;

  if p_department_id is not null then
    select code into v_dept_code from public.departments where id = p_department_id and organization_id = p_organization_id;
  end if;

  v_doc_code := public.generate_governed_document_code(p_organization_id, 'sop', v_dept_code);

  insert into public.controlled_documents (
    organization_id, document_code, document_title, document_type,
    department_id, document_owner_id, criticality_level, confidentiality_level,
    document_status, created_by, updated_by
  ) values (
    p_organization_id, v_doc_code, p_title_en, 'sop',
    p_department_id, p_process_owner_id, p_criticality_level, p_confidentiality_level,
    'draft', p_actor_id, p_actor_id
  ) returning id into v_doc_id;

  insert into public.document_versions (
    document_id, version_number, version_label, prepared_by, is_current_version
  ) values (
    v_doc_id, 1, '1.0', p_actor_id, true
  ) returning id into v_ver_id;

  update public.controlled_documents set current_version_id = v_ver_id where id = v_doc_id;

  -- Delegate structured content population to atomic save
  v_save_res := public.save_governed_sop_draft(
    p_actor_id => p_actor_id,
    p_version_id => v_ver_id,
    p_title_en => p_title_en,
    p_title_ar => p_title_ar,
    p_process_name_en => p_process_name_en,
    p_process_name_ar => p_process_name_ar,
    p_purpose_en => p_purpose_en,
    p_purpose_ar => p_purpose_ar,
    p_process_owner_id => p_process_owner_id,
    p_primary_policy_version_id => p_primary_policy_version_id,
    p_governance_link_state => p_governance_link_state,
    p_scope_en => p_scope_en,
    p_scope_ar => p_scope_ar,
    p_training_required => p_training_required,
    p_acknowledgment_required => p_acknowledgment_required,
    p_competency_assessment_required => p_competency_assessment_required,
    p_acknowledgment_sla_days => p_acknowledgment_sla_days,
    p_training_renewal_months => p_training_renewal_months,
    p_content_mode => p_content_mode,
    p_transcription_status => case when p_content_mode = 'legacy_controlled_document' then 'not_required' else 'complete' end,
    p_procedure_sections => p_procedure_sections,
    p_procedure_steps => p_procedure_steps,
    p_department_scopes => p_department_scopes,
    p_role_scopes => p_role_scopes,
    p_definitions => p_definitions,
    p_role_responsibilities => p_role_responsibilities,
    p_monitoring_kpis => p_monitoring_kpis,
    p_risk_links => p_risk_links,
    p_accreditation_links => p_accreditation_links,
    p_version_links => p_version_links
  );

  return jsonb_build_object(
    'document_id', v_doc_id,
    'version_id', v_ver_id,
    'document_code', v_doc_code,
    'section_key_map', v_save_res->'section_key_map',
    'step_key_map', v_save_res->'step_key_map'
  );
end;
$$;

revoke all on function public.create_governed_sop_draft(uuid, uuid, text, text, text, text, text, text, uuid, uuid, text, text, text, uuid, text, text, boolean, boolean, boolean, integer, integer, text, jsonb, jsonb, uuid[], jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.create_governed_sop_draft(uuid, uuid, text, text, text, text, text, text, uuid, uuid, text, text, text, uuid, text, text, boolean, boolean, boolean, integer, integer, text, jsonb, jsonb, uuid[], jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) to service_role;

-- ----------------------------------------------------------------------------
-- 15. Revision Cloning with Explicit UUID Maps: start_governed_document_revision
-- ----------------------------------------------------------------------------
create or replace function public.start_governed_document_revision(
  p_actor_id uuid,
  p_source_version_id uuid,
  p_revision_type text default 'minor',
  p_revision_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_doc_id uuid;
  v_doc_type text;
  v_org_id uuid;
  v_source_ver_num integer;
  v_new_ver_num integer;
  v_new_ver_label text;
  v_new_ver_id uuid;
begin
  select d.id, d.document_type, d.organization_id, v.version_number
  into v_doc_id, v_doc_type, v_org_id, v_source_ver_num
  from public.document_versions v
  join public.controlled_documents d on d.id = v.document_id
  where v.id = p_source_version_id;

  if v_doc_id is null then
    raise exception 'PATCH202_SOURCE_VERSION_NOT_FOUND';
  end if;

  -- Validate Actor Tenancy
  if not exists (
    select 1 from public.profiles
    where id = p_actor_id and organization_id = v_org_id and coalesce(is_active, true) = true
  ) then
    raise exception 'PATCH202_ACTOR_CROSS_ORG_FORBIDDEN';
  end if;

  if p_revision_type not in ('minor', 'major') then
    raise exception 'PATCH202_INVALID_REVISION_TYPE';
  end if;

  if exists (
    select 1 from public.document_versions
    where document_id = v_doc_id and locked_at is null and approved_at is null
  ) then
    raise exception 'PATCH202_ACTIVE_DRAFT_ALREADY_EXISTS';
  end if;

  select coalesce(max(version_number), v_source_ver_num) + 1 into v_new_ver_num
  from public.document_versions where document_id = v_doc_id;

  v_new_ver_label := case when p_revision_type = 'major'
    then floor(v_new_ver_num)::text || '.0'
    else (v_source_ver_num / 10)::text || '.' || (v_new_ver_num % 10)::text end;

  insert into public.document_versions (
    document_id, version_number, version_label, change_summary, revision_reason, prepared_by, is_current_version
  ) values (
    v_doc_id, v_new_ver_num, v_new_ver_label, p_revision_reason, p_revision_reason, p_actor_id, false
  ) returning id into v_new_ver_id;

  if v_doc_type = 'policy' then
    insert into public.governed_policy_details (
      version_id, title_en, title_ar, policy_statement_en, policy_statement_ar,
      purpose_en, purpose_ar, scope_en, scope_ar, policy_owner_id,
      compliance_target, exceptions_policy_en, exceptions_policy_ar,
      non_compliance_escalation_en, non_compliance_escalation_ar, content_mode, transcription_status
    )
    select
      v_new_ver_id, title_en, title_ar, policy_statement_en, policy_statement_ar,
      purpose_en, purpose_ar, scope_en, scope_ar, policy_owner_id,
      compliance_target, exceptions_policy_en, exceptions_policy_ar,
      non_compliance_escalation_en, non_compliance_escalation_ar, content_mode, transcription_status
    from public.governed_policy_details
    where version_id = p_source_version_id;

    insert into public.policy_requirements (
      policy_version_id, sequence_number, requirement_statement_en, requirement_statement_ar,
      guidance_en, guidance_ar, is_mandatory, criticality
    )
    select
      v_new_ver_id, sequence_number, requirement_statement_en, requirement_statement_ar,
      guidance_en, guidance_ar, is_mandatory, criticality
    from public.policy_requirements
    where policy_version_id = p_source_version_id;

  elsif v_doc_type = 'sop' then
    insert into public.governed_sop_details (
      version_id, title_en, title_ar, process_name_en, process_name_ar,
      process_owner_id, purpose_en, purpose_ar, scope_en, scope_ar,
      primary_policy_version_id, governance_link_state, training_required,
      acknowledgment_required, competency_assessment_required, acknowledgment_sla_days,
      training_renewal_months, content_mode, transcription_status,
      retraining_required, reacknowledgment_required, competency_reassessment_required,
      rollout_decision_rationale, rollout_decided_by, rollout_decided_at
    )
    select
      v_new_ver_id, title_en, title_ar, process_name_en, process_name_ar,
      process_owner_id, purpose_en, purpose_ar, scope_en, scope_ar,
      primary_policy_version_id, governance_link_state, training_required,
      acknowledgment_required, competency_assessment_required, acknowledgment_sla_days,
      training_renewal_months, content_mode, transcription_status,
      false, true, false,
      null, null, null
    from public.governed_sop_details
    where version_id = p_source_version_id;

    -- 1. Section UUID Map
    create temp table if not exists tmp_sec_clone_map (old_id uuid primary key, new_id uuid not null) on commit drop;
    truncate table tmp_sec_clone_map;

    insert into tmp_sec_clone_map (old_id, new_id)
    select id, gen_random_uuid()
    from public.sop_procedure_sections
    where sop_version_id = p_source_version_id;

    insert into public.sop_procedure_sections (
      id, sop_version_id, sequence_number, title_en, title_ar, description_en, description_ar
    )
    select
      m.new_id, v_new_ver_id, s.sequence_number, s.title_en, s.title_ar, s.description_en, s.description_ar
    from public.sop_procedure_sections s
    join tmp_sec_clone_map m on m.old_id = s.id
    where s.sop_version_id = p_source_version_id;

    -- 2. Step UUID Map
    create temp table if not exists tmp_step_clone_map (old_id uuid primary key, new_id uuid not null) on commit drop;
    truncate table tmp_step_clone_map;

    insert into tmp_step_clone_map (old_id, new_id)
    select id, gen_random_uuid()
    from public.sop_procedure_steps
    where sop_version_id = p_source_version_id;

    insert into public.sop_procedure_steps (
      id, sop_version_id, section_id, sequence_number, responsible_role,
      action_instruction_en, action_instruction_ar, required_control_id,
      expected_evidence_record_en, expected_evidence_record_ar,
      timing_sla_en, timing_sla_ar, is_decision_point,
      decision_criteria_en, decision_criteria_ar, criticality,
      escalation_trigger_en, escalation_trigger_ar, escalation_destination_role
    )
    select
      sm.new_id, v_new_ver_id, sec_map.new_id, st.sequence_number, st.responsible_role,
      st.action_instruction_en, st.action_instruction_ar, st.required_control_id,
      st.expected_evidence_record_en, st.expected_evidence_record_ar,
      st.timing_sla_en, st.timing_sla_ar, st.is_decision_point,
      st.decision_criteria_en, st.decision_criteria_ar, st.criticality,
      st.escalation_trigger_en, st.escalation_trigger_ar, st.escalation_destination_role
    from public.sop_procedure_steps st
    join tmp_step_clone_map sm on sm.old_id = st.id
    left join tmp_sec_clone_map sec_map on sec_map.old_id = st.section_id
    where st.sop_version_id = p_source_version_id;

    -- 3. Clone RACI Rows with Cloned Step IDs
    insert into public.sop_procedure_step_raci_assignments (
      sop_version_id, step_id, raci_type, role_name, role_label_ar, job_title, sequence_number
    )
    select
      v_new_ver_id, sm.new_id, r.raci_type, r.role_name, r.role_label_ar, r.job_title, r.sequence_number
    from public.sop_procedure_step_raci_assignments r
    join tmp_step_clone_map sm on sm.old_id = r.step_id
    where r.sop_version_id = p_source_version_id;

    -- 4. Clone Definitions
    insert into public.sop_definitions (
      sop_version_id, term_en, term_ar, definition_en, definition_ar, abbreviation, sequence_number
    )
    select
      v_new_ver_id, term_en, term_ar, definition_en, definition_ar, abbreviation, sequence_number
    from public.sop_definitions
    where sop_version_id = p_source_version_id;

    -- 5. Clone Role Responsibilities
    insert into public.sop_role_responsibilities (
      sop_version_id, sequence_number, role_name, job_title, responsibility_en, responsibility_ar, accountable_for_en, accountable_for_ar
    )
    select
      v_new_ver_id, sequence_number, role_name, job_title, responsibility_en, responsibility_ar, accountable_for_en, accountable_for_ar
    from public.sop_role_responsibilities
    where sop_version_id = p_source_version_id;

    -- 6. Clone Monitoring KPIs
    insert into public.sop_monitoring_kpis (
      sop_version_id, sequence_number, kpi_name_en, kpi_name_ar, target_value, measurement_frequency, owner_id, description_en, description_ar
    )
    select
      v_new_ver_id, sequence_number, kpi_name_en, kpi_name_ar, target_value, measurement_frequency, owner_id, description_en, description_ar
    from public.sop_monitoring_kpis
    where sop_version_id = p_source_version_id;

    -- 7. Clone Risk Links
    insert into public.sop_version_risk_links (
      sop_version_id, risk_id, relationship_type, context_note_en, context_note_ar, sequence_number
    )
    select
      v_new_ver_id, risk_id, relationship_type, context_note_en, context_note_ar, sequence_number
    from public.sop_version_risk_links
    where sop_version_id = p_source_version_id;

    -- 8. Clone Accreditation Links
    insert into public.sop_version_accreditation_links (
      sop_version_id, clause_id, link_strength, context_note_en, context_note_ar, sequence_number
    )
    select
      v_new_ver_id, clause_id, link_strength, context_note_en, context_note_ar, sequence_number
    from public.sop_version_accreditation_links
    where sop_version_id = p_source_version_id;

    -- 9. Clone Training Target Scopes
    insert into public.sop_version_training_target_scopes (
      sop_version_id, scope_type, department_id, role_name, created_by
    )
    select
      v_new_ver_id, scope_type, department_id, role_name, p_actor_id
    from public.sop_version_training_target_scopes
    where sop_version_id = p_source_version_id;

    -- 10. Clone Version Links
    insert into public.governed_document_version_links (
      source_version_id, target_version_id, relationship_type, context_note_en, context_note_ar, sequence_number
    )
    select
      v_new_ver_id, target_version_id, relationship_type, context_note_en, context_note_ar, sequence_number
    from public.governed_document_version_links
    where source_version_id = p_source_version_id;
  end if;

  -- Clone Common Department Scopes
  insert into public.document_version_department_scope (version_id, department_id)
  select v_new_ver_id, department_id
  from public.document_version_department_scope
  where version_id = p_source_version_id;

  -- Clone Common Role Scopes
  insert into public.document_version_role_scope (version_id, role_name, job_title)
  select v_new_ver_id, role_name, job_title
  from public.document_version_role_scope
  where version_id = p_source_version_id;

  -- Record Revision Lifecycle Event
  insert into public.document_review_events (
    document_id, version_id, event_type, from_status, to_status, actor_id, event_note
  ) values (
    v_doc_id, v_new_ver_id, 'revision_started', 'approved', 'draft', p_actor_id, p_revision_reason
  );

  return jsonb_build_object(
    'document_id', v_doc_id,
    'source_version_id', p_source_version_id,
    'new_version_id', v_new_ver_id,
    'version_number', v_new_ver_num,
    'version_label', v_new_ver_label,
    'status', 'draft'
  );
end;
$$;

revoke all on function public.start_governed_document_revision(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.start_governed_document_revision(uuid, uuid, text, text) to service_role;
