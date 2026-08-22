-- GRC v1.4 GOV-LINK-1: normalized governed source-to-criterion linkage.

-- ---------------------------------------------------------------------------
-- 1. Core model
-- ---------------------------------------------------------------------------
create table if not exists public.governance_linkage_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_entity_type text not null check (source_entity_type in ('ovr','risk','audit_finding','capa')),
  source_entity_id uuid not null,
  source_revision_id uuid,
  source_date date,
  applicability_date date,
  review_status text not null default 'draft' check (review_status in ('draft','under_review','completed')),
  review_outcome text check (review_outcome is null or review_outcome in (
    'confirmed_relationship','related_not_violated','no_applicable_document',
    'document_gap','insufficient_evidence'
  )),
  uncertainty_recorded boolean not null default false,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_rationale text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (applicability_date is null or source_date is null or applicability_date >= source_date),
  check (
    (review_status = 'completed' and review_outcome is not null and reviewed_at is not null and reviewed_by is not null)
    or (review_status <> 'completed' and review_outcome is null)
  )
);

create unique index if not exists uq_governance_linkage_active_review
  on public.governance_linkage_reviews (
    organization_id,
    source_entity_type,
    source_entity_id,
    coalesce(source_revision_id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) where review_status in ('draft','under_review');

create index if not exists idx_governance_linkage_reviews_queue
  on public.governance_linkage_reviews (organization_id, review_status, created_at desc);

create table if not exists public.governance_criteria_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  review_id uuid not null references public.governance_linkage_reviews(id) on delete restrict,
  source_entity_type text not null check (source_entity_type in ('ovr','risk','audit_finding','capa')),
  source_entity_id uuid not null,
  source_revision_id uuid,
  root_source_entity_type text not null check (root_source_entity_type in ('ovr','risk','audit_finding','capa')),
  root_source_entity_id uuid not null,
  target_criterion_type text not null check (target_criterion_type in (
    'policy','policy_requirement','sop','sop_step','compliance_obligation','accreditation_clause','control'
  )),
  target_document_id uuid references public.controlled_documents(id) on delete restrict,
  target_version_id uuid references public.document_versions(id) on delete restrict,
  target_policy_requirement_id uuid references public.policy_requirements(id) on delete restrict,
  target_sop_step_id uuid references public.sop_procedure_steps(id) on delete restrict,
  target_compliance_obligation_id uuid references public.compliance_obligations(id) on delete restrict,
  target_accreditation_clause_id uuid references public.accreditation_clauses(id) on delete restrict,
  target_control_id uuid references public.control_library_items(id) on delete restrict,
  relationship_origin text not null check (relationship_origin in (
    'reporter_suggested','direct','investigator_confirmed','inherited','system_recommended','legacy_f1'
  )),
  resolution_date date,
  resolution_method text not null check (resolution_method in (
    'resolver_exact','reviewer_override','direct_selection','persistent_context','inherited','legacy_f1'
  )),
  resolution_snapshot jsonb not null default '{}'::jsonb,
  resolution_override_rationale text,
  supersedes_link_id uuid references public.governance_criteria_links(id) on delete restrict,
  legacy_document_link_id uuid references public.document_links(id) on delete restrict,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (jsonb_typeof(resolution_snapshot) = 'object'),
  check (supersedes_link_id is null or supersedes_link_id <> id),
  check (legacy_document_link_id is null or relationship_origin = 'legacy_f1'),
  check (resolution_method <> 'reviewer_override' or length(btrim(coalesce(resolution_override_rationale, ''))) >= 3),
  check (
    (target_criterion_type = 'policy'
      and target_document_id is not null
      and target_policy_requirement_id is null and target_sop_step_id is null
      and target_compliance_obligation_id is null and target_accreditation_clause_id is null and target_control_id is null)
    or
    (target_criterion_type = 'policy_requirement'
      and target_document_id is not null and target_version_id is not null and target_policy_requirement_id is not null
      and target_sop_step_id is null and target_compliance_obligation_id is null
      and target_accreditation_clause_id is null and target_control_id is null)
    or
    (target_criterion_type = 'sop'
      and target_document_id is not null
      and target_policy_requirement_id is null and target_sop_step_id is null
      and target_compliance_obligation_id is null and target_accreditation_clause_id is null and target_control_id is null)
    or
    (target_criterion_type = 'sop_step'
      and target_document_id is not null and target_version_id is not null and target_sop_step_id is not null
      and target_policy_requirement_id is null and target_compliance_obligation_id is null
      and target_accreditation_clause_id is null and target_control_id is null)
    or
    (target_criterion_type = 'compliance_obligation'
      and target_compliance_obligation_id is not null and target_document_id is null and target_version_id is null
      and target_policy_requirement_id is null and target_sop_step_id is null
      and target_accreditation_clause_id is null and target_control_id is null)
    or
    (target_criterion_type = 'accreditation_clause'
      and target_accreditation_clause_id is not null and target_document_id is null and target_version_id is null
      and target_policy_requirement_id is null and target_sop_step_id is null
      and target_compliance_obligation_id is null and target_control_id is null)
    or
    (target_criterion_type = 'control'
      and target_control_id is not null and target_document_id is null and target_version_id is null
      and target_policy_requirement_id is null and target_sop_step_id is null
      and target_compliance_obligation_id is null and target_accreditation_clause_id is null)
  )
);

create unique index if not exists uq_governance_criteria_legacy_f1
  on public.governance_criteria_links (legacy_document_link_id)
  where legacy_document_link_id is not null;

create unique index if not exists uq_governance_criteria_review_target
  on public.governance_criteria_links (
    review_id,
    target_criterion_type,
    coalesce(target_document_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(target_version_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(target_policy_requirement_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(target_sop_step_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(target_compliance_obligation_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(target_accreditation_clause_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(target_control_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create index if not exists idx_governance_criteria_links_root
  on public.governance_criteria_links (organization_id, root_source_entity_type, root_source_entity_id);
create index if not exists idx_governance_criteria_links_review
  on public.governance_criteria_links (review_id, created_at);

create table if not exists public.governance_criteria_link_decisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  link_id uuid not null references public.governance_criteria_links(id) on delete restrict,
  decision_type text not null check (decision_type in ('suggested','under_review','confirmed','rejected','superseded')),
  significance text check (significance is null or significance in ('primary','contributing','context_only')),
  adherence_status text check (adherence_status is null or adherence_status in (
    'complied','partial_adherence','noncompliance','procedure_not_followed','authorized_exception',
    'emergency_justified_deviation','insufficient_evidence','not_applicable','unknown'
  )),
  adequacy_status text check (adequacy_status is null or adequacy_status in (
    'adequate','unclear','incomplete','conflicting','obsolete_version_used','missing_policy','missing_sop',
    'implementation_gap','training_competency_gap','control_failed_despite_compliance',
    'related_context_only','not_applicable','not_assessed'
  )),
  actor_id uuid not null references public.profiles(id) on delete restrict,
  decided_at timestamptz not null default now(),
  rationale text,
  correction_reason text,
  supersedes_decision_id uuid references public.governance_criteria_link_decisions(id) on delete restrict,
  check (supersedes_decision_id is null or supersedes_decision_id <> id),
  check (decision_type <> 'confirmed' or (significance is not null and adherence_status is not null and adequacy_status is not null)),
  check (decision_type <> 'superseded' or (supersedes_decision_id is not null and length(btrim(coalesce(correction_reason, ''))) >= 3))
);

create index if not exists idx_governance_criteria_decisions_current
  on public.governance_criteria_link_decisions (link_id, decided_at desc, id desc);

create table if not exists public.governance_criteria_link_lineage (
  parent_link_id uuid not null references public.governance_criteria_links(id) on delete restrict,
  child_link_id uuid not null references public.governance_criteria_links(id) on delete restrict,
  lineage_type text not null check (lineage_type in ('inherited_from','derived_from','supersedes')),
  created_at timestamptz not null default now(),
  primary key (parent_link_id, child_link_id, lineage_type),
  check (parent_link_id <> child_link_id)
);

create table if not exists public.governance_criteria_link_evidence (
  decision_id uuid not null references public.governance_criteria_link_decisions(id) on delete restrict,
  evidence_file_id uuid not null references public.evidence_files(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  evidence_role text not null default 'supporting' check (evidence_role in ('primary','supporting','contradicting')),
  added_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (decision_id, evidence_file_id)
);

-- ---------------------------------------------------------------------------
-- 2. Polymorphic source and target integrity
-- ---------------------------------------------------------------------------
create or replace function public.governance_linkage_source_context(
  p_source_entity_type text,
  p_source_entity_id uuid,
  p_source_revision_id uuid default null
)
returns table (organization_id uuid, source_date date, department_id uuid)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if p_source_entity_type = 'ovr' then
    if p_source_revision_id is not null then raise exception 'GOV_LINK_OVR_REVISION_UNSUPPORTED'; end if;
    return query select o.organization_id, o.occurrence_date, o.department_id
      from public.ovr_reports o where o.id = p_source_entity_id;
  elsif p_source_entity_type = 'risk' then
    if p_source_revision_id is not null and not exists (
      select 1 from public.risk_reassessment_history h
      where h.id = p_source_revision_id and h.risk_id = p_source_entity_id
    ) then raise exception 'GOV_LINK_RISK_REVISION_MISMATCH'; end if;
    return query select r.organization_id,
      coalesce((select h.changed_at::date from public.risk_reassessment_history h where h.id = p_source_revision_id), r.last_reviewed_at::date, r.created_at::date),
      r.department_id from public.risks r where r.id = p_source_entity_id;
  elsif p_source_entity_type = 'audit_finding' then
    if p_source_revision_id is not null then raise exception 'GOV_LINK_AUDIT_REVISION_UNSUPPORTED'; end if;
    -- No canonical audit-period record exists yet; finding creation date is the locked fallback.
    return query select a.organization_id, a.created_at::date, coalesce(a.responsible_department_id, a.department_id)
      from public.audit_findings a where a.id = p_source_entity_id;
  elsif p_source_entity_type = 'capa' then
    if p_source_revision_id is not null then raise exception 'GOV_LINK_CAPA_REVISION_UNSUPPORTED'; end if;
    return query select c.organization_id, c.created_at::date, c.department_id
      from public.capa_action_plans c where c.id = p_source_entity_id;
  else
    raise exception 'GOV_LINK_SOURCE_TYPE_UNSUPPORTED';
  end if;
end;
$$;

create or replace function public.validate_governance_linkage_review_source()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare v_org uuid; v_date date; v_department uuid;
begin
  select organization_id, source_date, department_id into v_org, v_date, v_department
  from public.governance_linkage_source_context(new.source_entity_type, new.source_entity_id, new.source_revision_id);
  if v_org is null then raise exception 'GOV_LINK_SOURCE_NOT_FOUND'; end if;
  if v_org is distinct from new.organization_id then raise exception 'GOV_LINK_SOURCE_CROSS_ORGANIZATION_DENIED'; end if;
  new.source_date := coalesce(new.source_date, v_date);
  new.applicability_date := coalesce(new.applicability_date, new.source_date);
  return new;
end;
$$;

drop trigger if exists trg_validate_governance_linkage_review_source on public.governance_linkage_reviews;
create trigger trg_validate_governance_linkage_review_source
before insert or update of organization_id, source_entity_type, source_entity_id, source_revision_id, source_date, applicability_date
on public.governance_linkage_reviews
for each row execute function public.validate_governance_linkage_review_source();

create or replace function public.validate_governance_criteria_link()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_review public.governance_linkage_reviews%rowtype;
  v_source_org uuid; v_source_date date; v_source_department uuid;
  v_root_org uuid; v_root_date date; v_root_department uuid;
  v_doc_org uuid; v_doc_type text; v_version_doc uuid; v_approved_at timestamptz; v_locked_at timestamptz;
  v_detail_version uuid; v_target_org uuid; v_clause_active boolean; v_clause_department_org uuid;
begin
  select * into v_review from public.governance_linkage_reviews where id = new.review_id;
  if not found then raise exception 'GOV_LINK_REVIEW_NOT_FOUND'; end if;
  if v_review.review_status = 'completed'
     and not (new.relationship_origin = 'legacy_f1' and new.legacy_document_link_id is not null) then
    raise exception 'GOV_LINK_COMPLETED_REVIEW_IMMUTABLE';
  end if;
  if new.organization_id is distinct from v_review.organization_id
     or new.source_entity_type is distinct from v_review.source_entity_type
     or new.source_entity_id is distinct from v_review.source_entity_id
     or new.source_revision_id is distinct from v_review.source_revision_id then
    raise exception 'GOV_LINK_REVIEW_SOURCE_MISMATCH';
  end if;

  select organization_id, source_date, department_id into v_source_org, v_source_date, v_source_department
  from public.governance_linkage_source_context(new.source_entity_type, new.source_entity_id, new.source_revision_id);
  select organization_id, source_date, department_id into v_root_org, v_root_date, v_root_department
  from public.governance_linkage_source_context(new.root_source_entity_type, new.root_source_entity_id, null);
  if v_source_org is distinct from new.organization_id or v_root_org is distinct from new.organization_id then
    raise exception 'GOV_LINK_ROOT_OR_SOURCE_CROSS_ORGANIZATION_DENIED';
  end if;
  if (new.root_source_entity_type <> new.source_entity_type or new.root_source_entity_id <> new.source_entity_id)
     and new.relationship_origin <> 'inherited' then
    raise exception 'GOV_LINK_INHERITED_ROOT_ORIGIN_REQUIRED';
  end if;

  if new.target_criterion_type in ('policy','policy_requirement','sop','sop_step') then
    select d.organization_id, d.document_type into v_doc_org, v_doc_type
    from public.controlled_documents d where d.id = new.target_document_id;
    if v_doc_org is null then raise exception 'GOV_LINK_TARGET_DOCUMENT_NOT_FOUND'; end if;
    if v_doc_org is distinct from new.organization_id then raise exception 'GOV_LINK_TARGET_CROSS_ORGANIZATION_DENIED'; end if;
    if (new.target_criterion_type in ('policy','policy_requirement') and v_doc_type <> 'policy')
       or (new.target_criterion_type in ('sop','sop_step') and v_doc_type <> 'sop') then
      raise exception 'GOV_LINK_TARGET_DOCUMENT_TYPE_MISMATCH';
    end if;
    if new.target_version_id is not null then
      select v.document_id, v.approved_at, v.locked_at into v_version_doc, v_approved_at, v_locked_at
      from public.document_versions v where v.id = new.target_version_id;
      if v_version_doc is null then raise exception 'GOV_LINK_TARGET_VERSION_NOT_FOUND'; end if;
      if v_version_doc is distinct from new.target_document_id then raise exception 'GOV_LINK_TARGET_VERSION_DOCUMENT_MISMATCH'; end if;
      if v_approved_at is null or v_locked_at is null then raise exception 'GOV_LINK_APPROVED_LOCKED_VERSION_REQUIRED'; end if;
    elsif not (
      new.source_entity_type = 'risk' and new.source_revision_id is null
      and new.target_criterion_type in ('policy','sop')
      and new.resolution_method = 'persistent_context'
    ) then
      raise exception 'GOV_LINK_EXACT_VERSION_REQUIRED';
    end if;
  end if;

  if new.target_criterion_type = 'policy_requirement' then
    select r.policy_version_id into v_detail_version from public.policy_requirements r where r.id = new.target_policy_requirement_id;
    if v_detail_version is null or v_detail_version is distinct from new.target_version_id then
      raise exception 'GOV_LINK_POLICY_REQUIREMENT_VERSION_MISMATCH';
    end if;
  elsif new.target_criterion_type = 'sop_step' then
    select s.sop_version_id into v_detail_version from public.sop_procedure_steps s where s.id = new.target_sop_step_id;
    if v_detail_version is null or v_detail_version is distinct from new.target_version_id then
      raise exception 'GOV_LINK_SOP_STEP_VERSION_MISMATCH';
    end if;
  elsif new.target_criterion_type = 'compliance_obligation' then
    select o.organization_id into v_target_org from public.compliance_obligations o where o.id = new.target_compliance_obligation_id;
    if v_target_org is null then raise exception 'GOV_LINK_COMPLIANCE_OBLIGATION_NOT_FOUND'; end if;
    if v_target_org is distinct from new.organization_id then raise exception 'GOV_LINK_TARGET_CROSS_ORGANIZATION_DENIED'; end if;
  elsif new.target_criterion_type = 'control' then
    select c.organization_id into v_target_org from public.control_library_items c where c.id = new.target_control_id;
    if v_target_org is null then raise exception 'GOV_LINK_CONTROL_NOT_FOUND'; end if;
    if v_target_org is distinct from new.organization_id then raise exception 'GOV_LINK_TARGET_CROSS_ORGANIZATION_DENIED'; end if;
  elsif new.target_criterion_type = 'accreditation_clause' then
    select c.active, d.organization_id into v_clause_active, v_clause_department_org
    from public.accreditation_clauses c
    left join public.departments d on d.id = c.department_id
    where c.id = new.target_accreditation_clause_id;
    if v_clause_active is null then raise exception 'GOV_LINK_ACCREDITATION_CLAUSE_NOT_FOUND'; end if;
    if not v_clause_active then raise exception 'GOV_LINK_ACTIVE_ACCREDITATION_CLAUSE_REQUIRED'; end if;
    if v_clause_department_org is not null and v_clause_department_org is distinct from new.organization_id then
      raise exception 'GOV_LINK_ACCREDITATION_TENANT_INCOMPATIBLE';
    end if;
  end if;

  if new.supersedes_link_id is not null and not exists (
    select 1 from public.governance_criteria_links prior_link
    where prior_link.id = new.supersedes_link_id and prior_link.organization_id = new.organization_id
      and prior_link.root_source_entity_type = new.root_source_entity_type
      and prior_link.root_source_entity_id = new.root_source_entity_id
  ) then raise exception 'GOV_LINK_SUPERSEDED_LINK_ROOT_MISMATCH'; end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_governance_criteria_link on public.governance_criteria_links;
create trigger trg_validate_governance_criteria_link
before insert on public.governance_criteria_links
for each row execute function public.validate_governance_criteria_link();

create or replace function public.reject_governance_link_mutation()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin raise exception 'GOV_LINK_IMMUTABLE_HISTORY'; end;
$$;

drop trigger if exists trg_governance_criteria_links_immutable on public.governance_criteria_links;
create trigger trg_governance_criteria_links_immutable
before update or delete on public.governance_criteria_links
for each row execute function public.reject_governance_link_mutation();

create or replace function public.validate_governance_criteria_decision()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare v_link public.governance_criteria_links%rowtype; v_actor_org uuid; v_actor_active boolean; v_actor_status text;
begin
  select * into v_link from public.governance_criteria_links where id = new.link_id;
  if not found then raise exception 'GOV_LINK_LINK_NOT_FOUND'; end if;
  if v_link.organization_id is distinct from new.organization_id then raise exception 'GOV_LINK_DECISION_CROSS_ORGANIZATION_DENIED'; end if;
  select organization_id, is_active, user_status::text into v_actor_org, v_actor_active, v_actor_status
  from public.profiles where id = new.actor_id;
  if v_actor_org is distinct from new.organization_id or not coalesce(v_actor_active, false) or v_actor_status <> 'active' then
    raise exception 'GOV_LINK_ACTIVE_SAME_ORG_ACTOR_REQUIRED';
  end if;
  if new.supersedes_decision_id is not null and not exists (
    select 1 from public.governance_criteria_link_decisions d
    where d.id = new.supersedes_decision_id and d.link_id = new.link_id and d.organization_id = new.organization_id
  ) then raise exception 'GOV_LINK_SUPERSEDED_DECISION_MISMATCH'; end if;
  if new.decision_type = 'confirmed'
     and v_link.target_criterion_type in ('policy','policy_requirement','sop','sop_step')
     and v_link.target_version_id is null then
    raise exception 'GOV_LINK_CONFIRMED_EXACT_VERSION_REQUIRED';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_governance_criteria_decision on public.governance_criteria_link_decisions;
create trigger trg_validate_governance_criteria_decision
before insert on public.governance_criteria_link_decisions
for each row execute function public.validate_governance_criteria_decision();
drop trigger if exists trg_governance_criteria_decisions_append_only on public.governance_criteria_link_decisions;
create trigger trg_governance_criteria_decisions_append_only
before update or delete on public.governance_criteria_link_decisions
for each row execute function public.reject_governance_link_mutation();

create or replace function public.validate_governance_link_lineage()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare v_parent_org uuid; v_child_org uuid; v_parent_root_type text; v_child_root_type text; v_parent_root uuid; v_child_root uuid;
begin
  select organization_id, root_source_entity_type, root_source_entity_id
    into v_parent_org, v_parent_root_type, v_parent_root
  from public.governance_criteria_links where id = new.parent_link_id;
  select organization_id, root_source_entity_type, root_source_entity_id
    into v_child_org, v_child_root_type, v_child_root
  from public.governance_criteria_links where id = new.child_link_id;
  if v_parent_org is null or v_child_org is null then raise exception 'GOV_LINK_LINEAGE_LINK_NOT_FOUND'; end if;
  if v_parent_org is distinct from v_child_org then raise exception 'GOV_LINK_LINEAGE_CROSS_ORGANIZATION_DENIED'; end if;
  if v_parent_root_type is distinct from v_child_root_type or v_parent_root is distinct from v_child_root then
    raise exception 'GOV_LINK_LINEAGE_ROOT_IDENTITY_MISMATCH';
  end if;
  if exists (
    with recursive ancestors(link_id) as (
      select new.parent_link_id
      union
      select l.parent_link_id from public.governance_criteria_link_lineage l join ancestors a on l.child_link_id = a.link_id
    ) select 1 from ancestors where link_id = new.child_link_id
  ) then raise exception 'GOV_LINK_LINEAGE_CYCLE_DENIED'; end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_governance_link_lineage on public.governance_criteria_link_lineage;
create trigger trg_validate_governance_link_lineage
before insert on public.governance_criteria_link_lineage
for each row execute function public.validate_governance_link_lineage();
drop trigger if exists trg_governance_link_lineage_immutable on public.governance_criteria_link_lineage;
create trigger trg_governance_link_lineage_immutable
before update or delete on public.governance_criteria_link_lineage
for each row execute function public.reject_governance_link_mutation();

create or replace function public.validate_governance_link_evidence()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare v_decision_org uuid; v_evidence_org uuid; v_actor_org uuid;
begin
  select organization_id into v_decision_org from public.governance_criteria_link_decisions where id = new.decision_id;
  select organization_id into v_evidence_org from public.evidence_files where id = new.evidence_file_id;
  select organization_id into v_actor_org from public.profiles where id = new.added_by and is_active and user_status::text = 'active';
  if v_decision_org is null or v_evidence_org is null then raise exception 'GOV_LINK_EVIDENCE_REFERENCE_NOT_FOUND'; end if;
  if v_decision_org is distinct from new.organization_id or v_evidence_org is distinct from new.organization_id
     or v_actor_org is distinct from new.organization_id then
    raise exception 'GOV_LINK_EVIDENCE_CROSS_ORGANIZATION_DENIED';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_governance_link_evidence on public.governance_criteria_link_evidence;
create trigger trg_validate_governance_link_evidence
before insert on public.governance_criteria_link_evidence
for each row execute function public.validate_governance_link_evidence();
drop trigger if exists trg_governance_link_evidence_immutable on public.governance_criteria_link_evidence;
create trigger trg_governance_link_evidence_immutable
before update or delete on public.governance_criteria_link_evidence
for each row execute function public.reject_governance_link_mutation();

-- ---------------------------------------------------------------------------
-- 3. Diagnostic effective-version resolver
-- ---------------------------------------------------------------------------
create or replace function public.resolve_governance_document_version_candidates(
  p_organization_id uuid,
  p_document_id uuid,
  p_source_date date,
  p_department_id uuid default null
)
returns table (
  candidate_version_id uuid,
  candidate_count integer,
  resolution_status text,
  exception_id uuid,
  department_applicable boolean,
  facility_scope_status text,
  diagnostic_detail text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_doc_org uuid;
  v_count integer;
  v_department_mismatch boolean;
  v_expired boolean;
  v_obsolete boolean;
begin
  select d.organization_id into v_doc_org from public.controlled_documents d where d.id = p_document_id;
  if v_doc_org is null then raise exception 'GOV_LINK_TARGET_DOCUMENT_NOT_FOUND'; end if;
  if v_doc_org is distinct from p_organization_id then raise exception 'GOV_LINK_TARGET_CROSS_ORGANIZATION_DENIED'; end if;

  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and p_organization_id::text is distinct from coalesce(
       auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'
     ) then
    raise exception 'GOV_LINK_RESOLVER_ORGANIZATION_DENIED';
  end if;

  if p_source_date is null then
    return query select null::uuid, 0, 'missing_source_date', null::uuid, null::boolean,
      'facility_scope_unavailable', 'A source/applicability date is required for point-in-time resolution';
    return;
  end if;

  with candidates as (
    select v.id,
      not exists (select 1 from public.document_version_department_scope s where s.version_id = v.id)
      or p_department_id is null
      or exists (select 1 from public.document_version_department_scope s where s.version_id = v.id and s.department_id = p_department_id)
      as department_ok
    from public.document_versions v
    where v.document_id = p_document_id
      and v.approved_at is not null and v.locked_at is not null
      and (v.effective_date is null or v.effective_date <= p_source_date)
      and (v.expiry_date is null or v.expiry_date >= p_source_date)
      and (v.superseded_by_version_id is null or exists (
        select 1 from public.document_versions sup
        where sup.id = v.superseded_by_version_id
          and (sup.effective_date is null or sup.effective_date > p_source_date)
      ))
  )
  select count(*) filter (where department_ok), bool_or(not department_ok)
    into v_count, v_department_mismatch from candidates;

  if v_count = 0 then
    select exists (
      select 1 from public.document_versions v where v.document_id = p_document_id
        and v.approved_at is not null and v.locked_at is not null and v.expiry_date < p_source_date
    ), exists (
      select 1 from public.document_versions v join public.document_versions sup on sup.id = v.superseded_by_version_id
      where v.document_id = p_document_id and sup.effective_date is not null and sup.effective_date <= p_source_date
    ) into v_expired, v_obsolete;

    return query select null::uuid, 0,
      case when coalesce(v_department_mismatch, false) then 'department_not_applicable'
           when v_obsolete then 'superseded_or_obsolete_version'
           when v_expired then 'expired_version'
           else 'zero_candidates' end,
      null::uuid, not coalesce(v_department_mismatch, false), 'facility_scope_unavailable',
      case when coalesce(v_department_mismatch, false) then 'Effective versions exist but none includes the selected department'
           when v_obsolete then 'Only a superseded or obsolete version matched the date boundary'
           when v_expired then 'Only expired approved versions exist for the supplied date'
           else 'No approved, locked version is effective for the supplied date' end;
    return;
  end if;

  return query
  with candidates as (
    select v.id,
      (select e.id from public.policy_sop_exceptions e
       where e.organization_id = p_organization_id and e.document_id = p_document_id
         and e.document_version_id = v.id and e.status = 'approved'
         and p_source_date between e.effective_start_date and e.effective_end_date
       order by e.decision_at desc nulls last, e.id limit 1) as approved_exception_id
    from public.document_versions v
    where v.document_id = p_document_id
      and v.approved_at is not null and v.locked_at is not null
      and (v.effective_date is null or v.effective_date <= p_source_date)
      and (v.expiry_date is null or v.expiry_date >= p_source_date)
      and (v.superseded_by_version_id is null or exists (
        select 1 from public.document_versions sup
        where sup.id = v.superseded_by_version_id
          and (sup.effective_date is null or sup.effective_date > p_source_date)
      ))
      and (
        not exists (select 1 from public.document_version_department_scope s where s.version_id = v.id)
        or p_department_id is null
        or exists (select 1 from public.document_version_department_scope s where s.version_id = v.id and s.department_id = p_department_id)
      )
  )
  select c.id, v_count,
    case when v_count > 1 then 'overlapping_candidates'
         when c.approved_exception_id is not null then 'exactly_one_with_approved_exception'
         else 'exactly_one' end,
    c.approved_exception_id, true, 'facility_scope_unavailable',
    case when v_count > 1 then 'Multiple approved, locked versions overlap the supplied date'
         when c.approved_exception_id is not null then 'Exactly one version applies with an approved dated exception'
         else 'Exactly one approved, locked version applies' end
  from candidates c
  order by c.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Governed authority and mutation RPCs
-- ---------------------------------------------------------------------------
create or replace function public.governance_linkage_require_service_role()
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then
    raise exception 'GOV_LINK_SERVICE_ROLE_REQUIRED';
  end if;
end;
$$;

create or replace function public.governance_linkage_actor_authorized(
  p_actor_id uuid,
  p_organization_id uuid,
  p_source_entity_type text,
  p_source_entity_id uuid,
  p_authority text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare v_actor public.profiles%rowtype; v_department_id uuid;
begin
  select * into v_actor from public.profiles where id = p_actor_id;
  if not found or not coalesce(v_actor.is_active, false) or v_actor.user_status::text <> 'active'
     or v_actor.organization_id is distinct from p_organization_id then return false; end if;

  if exists (
    select 1 from public.user_roles ur where ur.user_id = p_actor_id and ur.is_active
      and ur.organization_id = p_organization_id and ur.scope::text = 'global'
      and ur.role::text in ('super_admin','governance_admin','compliance_officer')
  ) then return true; end if;

  if p_source_entity_type = 'ovr' then
    select department_id into v_department_id from public.ovr_reports where id = p_source_entity_id and organization_id = p_organization_id;
    if p_authority = 'suggest' and exists (
      select 1 from public.ovr_reports o where o.id = p_source_entity_id
        and p_actor_id in (o.reported_by, o.created_by, o.owner_id, o.supervisor_id, o.quality_reviewer_id)
    ) then return true; end if;
    if p_authority = 'review' and exists (
      select 1 from public.ovr_reports o where o.id = p_source_entity_id
        and p_actor_id in (o.owner_id, o.supervisor_id, o.quality_reviewer_id)
    ) then return true; end if;
  elsif p_source_entity_type = 'risk' then
    select department_id into v_department_id from public.risks where id = p_source_entity_id and organization_id = p_organization_id;
    if exists (
      select 1 from public.risks r where r.id = p_source_entity_id
        and p_actor_id in (r.owner_id, r.risk_owner_id, r.control_owner_id, r.treatment_owner_id, r.created_by, r.last_reviewed_by)
    ) then return true; end if;
  elsif p_source_entity_type = 'audit_finding' then
    select coalesce(responsible_department_id, department_id) into v_department_id
      from public.audit_findings where id = p_source_entity_id and organization_id = p_organization_id;
    if exists (
      select 1 from public.audit_findings a where a.id = p_source_entity_id
        and p_actor_id in (a.owner_id, a.auditor_id, a.finding_owner_id, a.audit_manager_id,
          a.responsible_owner_id, a.created_by, a.reviewed_by)
    ) then return true; end if;
    if p_authority = 'review' and exists (
      select 1 from public.user_roles ur where ur.user_id = p_actor_id and ur.is_active
        and ur.organization_id = p_organization_id and ur.role::text = 'auditor'
    ) then return true; end if;
  elsif p_source_entity_type = 'capa' then
    select department_id into v_department_id from public.capa_action_plans where id = p_source_entity_id and organization_id = p_organization_id;
    if exists (
      select 1 from public.capa_action_plans c where c.id = p_source_entity_id
        and p_actor_id in (c.capa_owner_id, c.action_owner_id, c.reviewer_id, c.approver_id,
          c.validator_id, c.effectiveness_reviewer_id, c.created_by)
    ) then return true; end if;
  else return false;
  end if;

  return exists (
    select 1 from public.user_roles ur where ur.user_id = p_actor_id and ur.is_active
      and ur.organization_id = p_organization_id and ur.role::text = 'department_manager'
      and (ur.scope::text = 'global' or ur.department_id = v_department_id)
  );
end;
$$;

create or replace function public.start_governance_linkage_review(
  p_actor_id uuid,
  p_source_entity_type text,
  p_source_entity_id uuid,
  p_source_revision_id uuid default null,
  p_source_date date default null,
  p_review_rationale text default null
)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_org uuid; v_default_date date; v_department uuid; v_review_id uuid;
begin
  perform public.governance_linkage_require_service_role();
  select organization_id, source_date, department_id into v_org, v_default_date, v_department
  from public.governance_linkage_source_context(p_source_entity_type, p_source_entity_id, p_source_revision_id);
  if v_org is null then raise exception 'GOV_LINK_SOURCE_NOT_FOUND'; end if;
  if not public.governance_linkage_actor_authorized(p_actor_id, v_org, p_source_entity_type, p_source_entity_id, 'suggest') then
    raise exception 'GOV_LINK_SOURCE_AUTHORITY_REQUIRED';
  end if;
  if p_review_rationale is not null and char_length(p_review_rationale) > 4000 then raise exception 'GOV_LINK_RATIONALE_TOO_LONG'; end if;

  insert into public.governance_linkage_reviews (
    organization_id, source_entity_type, source_entity_id, source_revision_id,
    source_date, applicability_date, review_status, review_rationale, created_by
  ) values (
    v_org, p_source_entity_type, p_source_entity_id, p_source_revision_id,
    coalesce(p_source_date, v_default_date), coalesce(p_source_date, v_default_date),
    'under_review', nullif(btrim(p_review_rationale), ''), p_actor_id
  )
  on conflict (
    organization_id, source_entity_type, source_entity_id,
    (coalesce(source_revision_id, '00000000-0000-0000-0000-000000000000'::uuid))
  ) where review_status in ('draft','under_review')
  do update set updated_at = governance_linkage_reviews.updated_at
  returning id into v_review_id;

  return jsonb_build_object('review_id', v_review_id, 'status', 'under_review');
end;
$$;

create or replace function public.governance_linkage_resolution_snapshot(
  p_target_criterion_type text,
  p_target_document_id uuid,
  p_target_version_id uuid,
  p_target_policy_requirement_id uuid,
  p_target_sop_step_id uuid,
  p_target_compliance_obligation_id uuid,
  p_target_accreditation_clause_id uuid,
  p_target_control_id uuid,
  p_resolution_date date,
  p_resolution_method text
)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'schema_version', 212,
    'criterion_type', p_target_criterion_type,
    'resolution_date', p_resolution_date,
    'resolution_method', p_resolution_method,
    'document_id', d.id,
    'document_code', d.document_code,
    'document_type', d.document_type,
    'version_id', v.id,
    'version_number', v.version_number,
    'version_label', v.version_label,
    'version_effective_date', v.effective_date,
    'version_expiry_date', v.expiry_date,
    'version_approved_at', v.approved_at,
    'version_locked_at', v.locked_at,
    'policy_requirement_id', p_target_policy_requirement_id,
    'sop_step_id', p_target_sop_step_id,
    'compliance_obligation_id', p_target_compliance_obligation_id,
    'accreditation_clause_id', p_target_accreditation_clause_id,
    'control_id', p_target_control_id,
    'facility_scope_status', 'facility_scope_unavailable'
  ))
  from (select 1) seed
  left join public.controlled_documents d on d.id = p_target_document_id
  left join public.document_versions v on v.id = p_target_version_id;
$$;

create or replace function public.suggest_governance_criterion_link(
  p_actor_id uuid,
  p_review_id uuid,
  p_target_criterion_type text,
  p_target_document_id uuid default null,
  p_target_version_id uuid default null,
  p_target_policy_requirement_id uuid default null,
  p_target_sop_step_id uuid default null,
  p_target_compliance_obligation_id uuid default null,
  p_target_accreditation_clause_id uuid default null,
  p_target_control_id uuid default null,
  p_relationship_origin text default 'direct',
  p_resolution_method text default 'direct_selection',
  p_resolution_date date default null,
  p_override_rationale text default null,
  p_root_source_entity_type text default null,
  p_root_source_entity_id uuid default null,
  p_parent_link_id uuid default null,
  p_rationale text default null
)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_review public.governance_linkage_reviews%rowtype; v_link_id uuid; v_decision_id uuid;
  v_root_type text; v_root_id uuid; v_candidate record; v_candidate_matches boolean := false;
begin
  perform public.governance_linkage_require_service_role();
  select * into v_review from public.governance_linkage_reviews where id = p_review_id for update;
  if not found then raise exception 'GOV_LINK_REVIEW_NOT_FOUND'; end if;
  if v_review.review_status = 'completed' then raise exception 'GOV_LINK_REVIEW_COMPLETED'; end if;
  if not public.governance_linkage_actor_authorized(p_actor_id, v_review.organization_id,
      v_review.source_entity_type, v_review.source_entity_id, 'suggest') then
    raise exception 'GOV_LINK_SOURCE_AUTHORITY_REQUIRED';
  end if;
  if p_relationship_origin = 'system_recommended' and p_actor_id is null then raise exception 'GOV_LINK_HUMAN_ACTOR_REQUIRED'; end if;
  if p_resolution_method = 'reviewer_override' then
    if not public.governance_linkage_actor_authorized(p_actor_id, v_review.organization_id,
        v_review.source_entity_type, v_review.source_entity_id, 'review') then raise exception 'GOV_LINK_REVIEW_AUTHORITY_REQUIRED'; end if;
    if length(btrim(coalesce(p_override_rationale, ''))) < 3 then raise exception 'GOV_LINK_OVERRIDE_RATIONALE_REQUIRED'; end if;
  elsif p_resolution_method = 'resolver_exact' and p_target_document_id is not null then
    for v_candidate in select * from public.resolve_governance_document_version_candidates(
      v_review.organization_id, p_target_document_id, coalesce(p_resolution_date, v_review.applicability_date),
      (select department_id from public.governance_linkage_source_context(v_review.source_entity_type, v_review.source_entity_id, v_review.source_revision_id))
    ) loop
      if v_candidate.candidate_count = 1 and v_candidate.candidate_version_id = p_target_version_id
         and v_candidate.resolution_status in ('exactly_one','exactly_one_with_approved_exception') then v_candidate_matches := true; end if;
    end loop;
    if not v_candidate_matches then raise exception 'GOV_LINK_RESOLVER_EXACT_VERSION_MISMATCH'; end if;
  end if;

  v_root_type := coalesce(p_root_source_entity_type, v_review.source_entity_type);
  v_root_id := coalesce(p_root_source_entity_id, v_review.source_entity_id);
  if p_parent_link_id is not null then
    select root_source_entity_type, root_source_entity_id into v_root_type, v_root_id
    from public.governance_criteria_links where id = p_parent_link_id and organization_id = v_review.organization_id;
    if not found then raise exception 'GOV_LINK_PARENT_NOT_FOUND'; end if;
    if p_relationship_origin <> 'inherited' then raise exception 'GOV_LINK_INHERITED_ORIGIN_REQUIRED'; end if;
  end if;

  insert into public.governance_criteria_links (
    organization_id, review_id, source_entity_type, source_entity_id, source_revision_id,
    root_source_entity_type, root_source_entity_id, target_criterion_type,
    target_document_id, target_version_id, target_policy_requirement_id, target_sop_step_id,
    target_compliance_obligation_id, target_accreditation_clause_id, target_control_id,
    relationship_origin, resolution_date, resolution_method, resolution_snapshot,
    resolution_override_rationale, created_by
  ) values (
    v_review.organization_id, v_review.id, v_review.source_entity_type, v_review.source_entity_id, v_review.source_revision_id,
    v_root_type, v_root_id, p_target_criterion_type,
    p_target_document_id, p_target_version_id, p_target_policy_requirement_id, p_target_sop_step_id,
    p_target_compliance_obligation_id, p_target_accreditation_clause_id, p_target_control_id,
    p_relationship_origin, coalesce(p_resolution_date, v_review.applicability_date), p_resolution_method,
    public.governance_linkage_resolution_snapshot(
      p_target_criterion_type, p_target_document_id, p_target_version_id, p_target_policy_requirement_id,
      p_target_sop_step_id, p_target_compliance_obligation_id, p_target_accreditation_clause_id,
      p_target_control_id, coalesce(p_resolution_date, v_review.applicability_date), p_resolution_method
    ), nullif(btrim(p_override_rationale), ''), p_actor_id
  ) returning id into v_link_id;

  insert into public.governance_criteria_link_decisions (
    organization_id, link_id, decision_type, actor_id, rationale
  ) values (v_review.organization_id, v_link_id, 'suggested', p_actor_id, nullif(btrim(p_rationale), ''))
  returning id into v_decision_id;

  if p_parent_link_id is not null then
    insert into public.governance_criteria_link_lineage (parent_link_id, child_link_id, lineage_type)
    values (p_parent_link_id, v_link_id, 'inherited_from');
  end if;
  return jsonb_build_object('link_id', v_link_id, 'decision_id', v_decision_id, 'decision_type', 'suggested');
end;
$$;

create or replace function public.append_governance_criterion_decision(
  p_actor_id uuid,
  p_link_id uuid,
  p_decision_type text,
  p_significance text default null,
  p_adherence_status text default null,
  p_adequacy_status text default null,
  p_rationale text default null,
  p_correction_reason text default null,
  p_supersedes_decision_id uuid default null,
  p_evidence_file_ids uuid[] default '{}'::uuid[]
)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_link public.governance_criteria_links%rowtype; v_decision_id uuid; v_evidence_id uuid;
begin
  perform public.governance_linkage_require_service_role();
  select * into v_link from public.governance_criteria_links where id = p_link_id;
  if not found then raise exception 'GOV_LINK_LINK_NOT_FOUND'; end if;
  if p_decision_type not in ('under_review','confirmed','rejected','superseded') then
    raise exception 'GOV_LINK_DECISION_TYPE_INVALID';
  end if;
  if not public.governance_linkage_actor_authorized(p_actor_id, v_link.organization_id,
      v_link.source_entity_type, v_link.source_entity_id, 'review') then
    raise exception 'GOV_LINK_REVIEW_AUTHORITY_REQUIRED';
  end if;
  if p_decision_type in ('confirmed','rejected','superseded') and length(btrim(coalesce(p_rationale, ''))) < 3 then
    raise exception 'GOV_LINK_DECISION_RATIONALE_REQUIRED';
  end if;
  if p_decision_type = 'confirmed' and v_link.relationship_origin = 'system_recommended' and p_actor_id is null then
    raise exception 'GOV_LINK_HUMAN_CONFIRMATION_REQUIRED';
  end if;
  insert into public.governance_criteria_link_decisions (
    organization_id, link_id, decision_type, significance, adherence_status, adequacy_status,
    actor_id, rationale, correction_reason, supersedes_decision_id
  ) values (
    v_link.organization_id, v_link.id, p_decision_type, p_significance, p_adherence_status, p_adequacy_status,
    p_actor_id, nullif(btrim(p_rationale), ''), nullif(btrim(p_correction_reason), ''), p_supersedes_decision_id
  ) returning id into v_decision_id;

  foreach v_evidence_id in array coalesce(p_evidence_file_ids, '{}'::uuid[]) loop
    insert into public.governance_criteria_link_evidence (
      decision_id, evidence_file_id, organization_id, added_by
    ) values (v_decision_id, v_evidence_id, v_link.organization_id, p_actor_id);
  end loop;
  return jsonb_build_object('decision_id', v_decision_id, 'link_id', v_link.id, 'decision_type', p_decision_type);
end;
$$;

create or replace function public.supersede_governance_criterion_link(
  p_actor_id uuid,
  p_link_id uuid,
  p_replacement_link_id uuid,
  p_reason text
)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_link public.governance_criteria_links%rowtype; v_replacement public.governance_criteria_links%rowtype;
  v_current_decision uuid; v_decision_id uuid;
begin
  perform public.governance_linkage_require_service_role();
  if length(btrim(coalesce(p_reason, ''))) < 3 then raise exception 'GOV_LINK_CORRECTION_REASON_REQUIRED'; end if;
  select * into v_link from public.governance_criteria_links where id = p_link_id;
  select * into v_replacement from public.governance_criteria_links where id = p_replacement_link_id;
  if v_link.id is null or v_replacement.id is null then raise exception 'GOV_LINK_LINK_NOT_FOUND'; end if;
  if v_link.organization_id is distinct from v_replacement.organization_id
     or v_link.root_source_entity_type is distinct from v_replacement.root_source_entity_type
     or v_link.root_source_entity_id is distinct from v_replacement.root_source_entity_id then
    raise exception 'GOV_LINK_REPLACEMENT_ROOT_MISMATCH';
  end if;
  if not public.governance_linkage_actor_authorized(p_actor_id, v_link.organization_id,
      v_link.source_entity_type, v_link.source_entity_id, 'review') then
    raise exception 'GOV_LINK_REVIEW_AUTHORITY_REQUIRED';
  end if;
  select d.id into v_current_decision from public.governance_criteria_link_decisions d
  where d.link_id = v_link.id order by d.decided_at desc, d.id desc limit 1;
  if v_current_decision is null then raise exception 'GOV_LINK_CURRENT_DECISION_NOT_FOUND'; end if;
  insert into public.governance_criteria_link_decisions (
    organization_id, link_id, decision_type, actor_id, rationale, correction_reason, supersedes_decision_id
  ) values (
    v_link.organization_id, v_link.id, 'superseded', p_actor_id, p_reason, p_reason, v_current_decision
  ) returning id into v_decision_id;
  insert into public.governance_criteria_link_lineage (parent_link_id, child_link_id, lineage_type)
  values (v_link.id, v_replacement.id, 'supersedes') on conflict do nothing;
  return jsonb_build_object('link_id', v_link.id, 'replacement_link_id', v_replacement.id, 'decision_id', v_decision_id);
end;
$$;

create or replace function public.complete_governance_linkage_review(
  p_actor_id uuid,
  p_review_id uuid,
  p_review_outcome text,
  p_review_rationale text,
  p_uncertainty_recorded boolean default false
)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_review public.governance_linkage_reviews%rowtype; v_confirmed_count integer;
begin
  perform public.governance_linkage_require_service_role();
  if p_review_outcome not in (
    'confirmed_relationship','related_not_violated','no_applicable_document','document_gap','insufficient_evidence'
  ) then raise exception 'GOV_LINK_REVIEW_OUTCOME_INVALID'; end if;
  if length(btrim(coalesce(p_review_rationale, ''))) < 3 then raise exception 'GOV_LINK_REVIEW_RATIONALE_REQUIRED'; end if;
  select * into v_review from public.governance_linkage_reviews where id = p_review_id for update;
  if not found then raise exception 'GOV_LINK_REVIEW_NOT_FOUND'; end if;
  if v_review.review_status = 'completed' then raise exception 'GOV_LINK_REVIEW_ALREADY_COMPLETED'; end if;
  if not public.governance_linkage_actor_authorized(p_actor_id, v_review.organization_id,
      v_review.source_entity_type, v_review.source_entity_id, 'review') then
    raise exception 'GOV_LINK_REVIEW_AUTHORITY_REQUIRED';
  end if;
  select count(*) into v_confirmed_count
  from public.governance_criteria_links l
  join lateral (
    select d.decision_type from public.governance_criteria_link_decisions d
    where d.link_id = l.id order by d.decided_at desc, d.id desc limit 1
  ) current_decision on true
  where l.review_id = v_review.id and current_decision.decision_type = 'confirmed';
  if p_review_outcome = 'confirmed_relationship' and v_confirmed_count = 0 then
    raise exception 'GOV_LINK_CONFIRMED_OUTCOME_REQUIRES_CONFIRMED_LINK';
  end if;
  update public.governance_linkage_reviews set
    review_status = 'completed', review_outcome = p_review_outcome,
    uncertainty_recorded = coalesce(p_uncertainty_recorded, false), reviewed_by = p_actor_id,
    reviewed_at = now(), review_rationale = btrim(p_review_rationale), updated_at = now()
  where id = v_review.id;
  return jsonb_build_object('review_id', v_review.id, 'status', 'completed', 'outcome', p_review_outcome,
    'confirmed_link_count', v_confirmed_count);
end;
$$;

create or replace function public.get_governance_criteria_linkage_capabilities()
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'contract_version', 'governance-criteria-linkage-v1',
    'schema_version', 212,
    'review_available', true,
    'suggestion_available', true,
    'decision_available', true,
    'supersession_available', true,
    'completion_available', true,
    'facility_scope_available', false
  );
$$;

-- ---------------------------------------------------------------------------
-- 5. F1 compatibility backfill (continuity only; never violation truth)
-- ---------------------------------------------------------------------------
insert into public.governance_linkage_reviews (
  id, organization_id, source_entity_type, source_entity_id, source_date, applicability_date,
  review_status, review_outcome, uncertainty_recorded, reviewed_by, reviewed_at,
  review_rationale, created_by, created_at, updated_at
)
select distinct on (o.id)
  md5('gov-link-legacy-f1-review:' || o.id::text)::uuid,
  o.organization_id, 'ovr', o.id, coalesce(o.occurrence_date, l.created_at::date),
  coalesce(o.occurrence_date, l.created_at::date), 'completed', 'confirmed_relationship', false,
  coalesce(l.created_by, o.quality_reviewer_id, o.owner_id, o.created_by), l.created_at,
  'Migration 212 continuity review for an existing F1 exact governed-version relationship.',
  coalesce(l.created_by, o.quality_reviewer_id, o.owner_id, o.created_by), l.created_at, l.created_at
from public.document_links l
join public.ovr_reports o on o.id = l.linked_item_id
where l.linked_item_type = 'ovr' and l.link_type = 'governed_version' and l.version_id is not null
  and coalesce(l.created_by, o.quality_reviewer_id, o.owner_id, o.created_by) is not null
order by o.id, l.created_at, l.id
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 6. Organization/source/target-aware read boundary
-- ---------------------------------------------------------------------------
create or replace function public.governance_linkage_source_readable(
  p_organization_id uuid,
  p_source_entity_type text,
  p_source_entity_id uuid
)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select (
    coalesce(current_setting('request.jwt.claim.role', true), current_user) = 'service_role'
    or p_organization_id::text = coalesce(
      auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'
    )
  ) and case p_source_entity_type
    when 'ovr' then exists (select 1 from public.ovr_reports x where x.id = p_source_entity_id and x.organization_id = p_organization_id)
    when 'risk' then exists (select 1 from public.risks x where x.id = p_source_entity_id and x.organization_id = p_organization_id)
    when 'audit_finding' then exists (select 1 from public.audit_findings x where x.id = p_source_entity_id and x.organization_id = p_organization_id)
    when 'capa' then exists (select 1 from public.capa_action_plans x where x.id = p_source_entity_id and x.organization_id = p_organization_id)
    else false end;
$$;

create or replace function public.governance_linkage_target_readable(
  p_organization_id uuid,
  p_target_criterion_type text,
  p_target_document_id uuid,
  p_target_version_id uuid,
  p_target_policy_requirement_id uuid,
  p_target_sop_step_id uuid,
  p_target_compliance_obligation_id uuid,
  p_target_accreditation_clause_id uuid,
  p_target_control_id uuid
)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select (
    coalesce(current_setting('request.jwt.claim.role', true), current_user) = 'service_role'
    or p_organization_id::text = coalesce(
      auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'
    )
  ) and case
    when p_target_criterion_type in ('policy','sop') then exists (
      select 1 from public.controlled_documents d
      left join public.document_versions v on v.id = p_target_version_id and v.document_id = d.id
      where d.id = p_target_document_id and d.organization_id = p_organization_id
        and (p_target_version_id is null or v.id is not null)
    )
    when p_target_criterion_type = 'policy_requirement' then exists (
      select 1 from public.policy_requirements r
      join public.document_versions v on v.id = r.policy_version_id
      join public.controlled_documents d on d.id = v.document_id
      where r.id = p_target_policy_requirement_id and v.id = p_target_version_id
        and d.id = p_target_document_id and d.organization_id = p_organization_id
    )
    when p_target_criterion_type = 'sop_step' then exists (
      select 1 from public.sop_procedure_steps s
      join public.document_versions v on v.id = s.sop_version_id
      join public.controlled_documents d on d.id = v.document_id
      where s.id = p_target_sop_step_id and v.id = p_target_version_id
        and d.id = p_target_document_id and d.organization_id = p_organization_id
    )
    when p_target_criterion_type = 'compliance_obligation' then exists (
      select 1 from public.compliance_obligations o
      where o.id = p_target_compliance_obligation_id and o.organization_id = p_organization_id
    )
    when p_target_criterion_type = 'accreditation_clause' then exists (
      select 1 from public.accreditation_clauses c
      left join public.departments d on d.id = c.department_id
      where c.id = p_target_accreditation_clause_id and c.active
        and (d.organization_id is null or d.organization_id = p_organization_id)
    )
    when p_target_criterion_type = 'control' then exists (
      select 1 from public.control_library_items c
      where c.id = p_target_control_id and c.organization_id = p_organization_id
    )
    else false end;
$$;

alter table public.governance_linkage_reviews enable row level security;
alter table public.governance_criteria_links enable row level security;
alter table public.governance_criteria_link_decisions enable row level security;
alter table public.governance_criteria_link_lineage enable row level security;
alter table public.governance_criteria_link_evidence enable row level security;

drop policy if exists governance_linkage_reviews_read on public.governance_linkage_reviews;
create policy governance_linkage_reviews_read on public.governance_linkage_reviews
for select to authenticated using (
  organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
  and public.governance_linkage_source_readable(organization_id, source_entity_type, source_entity_id)
);

drop policy if exists governance_criteria_links_read on public.governance_criteria_links;
create policy governance_criteria_links_read on public.governance_criteria_links
for select to authenticated using (
  organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
  and public.governance_linkage_source_readable(organization_id, source_entity_type, source_entity_id)
  and public.governance_linkage_target_readable(
    organization_id, target_criterion_type, target_document_id, target_version_id,
    target_policy_requirement_id, target_sop_step_id, target_compliance_obligation_id,
    target_accreditation_clause_id, target_control_id
  )
);

drop policy if exists governance_criteria_decisions_read on public.governance_criteria_link_decisions;
create policy governance_criteria_decisions_read on public.governance_criteria_link_decisions
for select to authenticated using (
  organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
  and exists (select 1 from public.governance_criteria_links l where l.id = governance_criteria_link_decisions.link_id)
);

drop policy if exists governance_criteria_lineage_read on public.governance_criteria_link_lineage;
create policy governance_criteria_lineage_read on public.governance_criteria_link_lineage
for select to authenticated using (
  exists (select 1 from public.governance_criteria_links p where p.id = governance_criteria_link_lineage.parent_link_id)
  and exists (select 1 from public.governance_criteria_links c where c.id = governance_criteria_link_lineage.child_link_id)
);

drop policy if exists governance_criteria_evidence_read on public.governance_criteria_link_evidence;
create policy governance_criteria_evidence_read on public.governance_criteria_link_evidence
for select to authenticated using (
  organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
  and exists (select 1 from public.governance_criteria_link_decisions d where d.id = governance_criteria_link_evidence.decision_id)
  and exists (select 1 from public.evidence_files e where e.id = governance_criteria_link_evidence.evidence_file_id and e.organization_id = organization_id)
);

-- ---------------------------------------------------------------------------
-- 7. Security-invoker current state and confirmed truth
-- ---------------------------------------------------------------------------
create or replace view public.v_current_governance_criteria_links
with (security_invoker = true)
as
with current_decisions as (
  select distinct on (d.link_id)
    d.id, d.link_id, d.decision_type, d.significance, d.adherence_status,
    d.adequacy_status, d.actor_id, d.decided_at, d.rationale,
    d.correction_reason, d.supersedes_decision_id
  from public.governance_criteria_link_decisions d
  order by d.link_id, d.decided_at desc, d.id desc
), actor_document_access as (
  select d.id as document_id,
    d.confidentiality_level not in ('confidential','restricted')
    or d.document_owner_id = auth.uid() or d.reviewer_id = auth.uid()
    or d.approver_id = auth.uid() or d.executive_sponsor_id = auth.uid()
    or exists (
      select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.is_active
        and ur.organization_id = d.organization_id and ur.role::text in ('super_admin','governance_admin','compliance_officer','auditor')
    ) as may_label
  from public.controlled_documents d
)
select
  l.id as link_id,
  l.organization_id,
  l.review_id,
  l.source_entity_type,
  l.source_entity_id,
  l.source_revision_id,
  l.root_source_entity_type,
  l.root_source_entity_id,
  l.target_criterion_type,
  l.target_document_id,
  l.target_version_id,
  l.target_policy_requirement_id,
  l.target_sop_step_id,
  l.target_compliance_obligation_id,
  l.target_accreditation_clause_id,
  l.target_control_id,
  case
    when l.target_document_id is not null and not coalesce(ada.may_label, false) then '[restricted]'
    when l.target_criterion_type = 'policy_requirement' then coalesce(d.document_code, 'Policy') || ' requirement'
    when l.target_criterion_type = 'sop_step' then coalesce(d.document_code, 'SOP') || ' step'
    when l.target_document_id is not null then d.document_title
    when l.target_criterion_type = 'compliance_obligation' then 'Compliance obligation'
    when l.target_criterion_type = 'accreditation_clause' then 'Accreditation clause'
    when l.target_criterion_type = 'control' then 'Control'
  end as target_display_label,
  d.confidentiality_level as target_confidentiality_level,
  l.relationship_origin,
  l.resolution_date,
  l.resolution_method,
  l.resolution_snapshot,
  l.resolution_override_rationale,
  l.supersedes_link_id,
  l.legacy_document_link_id,
  l.created_by,
  l.created_at,
  cd.id as current_decision_id,
  cd.decision_type,
  cd.significance,
  cd.adherence_status,
  cd.adequacy_status,
  cd.actor_id as decision_actor_id,
  cd.decided_at,
  cd.rationale as decision_rationale,
  cd.correction_reason,
  (l.root_source_entity_type <> l.source_entity_type or l.root_source_entity_id <> l.source_entity_id or l.relationship_origin = 'inherited') as inherited,
  l.root_source_entity_type || ':' || l.root_source_entity_id::text as root_event_key
from public.governance_criteria_links l
left join current_decisions cd on cd.link_id = l.id
left join public.controlled_documents d on d.id = l.target_document_id
left join actor_document_access ada on ada.document_id = d.id;

create or replace view public.v_governance_linkage_review_queue
with (security_invoker = true)
as
select
  r.*,
  count(l.id)::integer as candidate_link_count,
  count(l.id) filter (where c.decision_type = 'confirmed')::integer as confirmed_link_count
from public.governance_linkage_reviews r
left join public.governance_criteria_links l on l.review_id = r.id
left join public.v_current_governance_criteria_links c on c.link_id = l.id
where r.review_status in ('draft','under_review')
group by r.id;

create or replace view public.v_confirmed_governance_criteria_truth
with (security_invoker = true)
as
select
  c.*,
  (c.significance in ('primary','contributing')
    and c.adherence_status in ('noncompliance','procedure_not_followed')) as confirmed_noncompliance,
  (c.significance in ('primary','contributing')
    and c.adherence_status = 'procedure_not_followed') as confirmed_procedure_failure,
  (c.significance in ('primary','contributing')
    and c.adequacy_status in ('unclear','incomplete','conflicting','obsolete_version_used','missing_policy','missing_sop')) as document_inadequacy,
  (c.significance in ('primary','contributing') and c.adequacy_status = 'training_competency_gap') as training_gap,
  (c.significance in ('primary','contributing') and c.adequacy_status = 'control_failed_despite_compliance') as control_failure,
  (c.significance in ('primary','contributing')
    and c.adherence_status in ('noncompliance','procedure_not_followed')) as counts_as_violation
from public.v_current_governance_criteria_links c
where c.decision_type = 'confirmed';

-- ---------------------------------------------------------------------------
-- 8. ACL hardening
-- ---------------------------------------------------------------------------
revoke all on table public.governance_linkage_reviews from public, anon, authenticated;
revoke all on table public.governance_criteria_links from public, anon, authenticated;
revoke all on table public.governance_criteria_link_decisions from public, anon, authenticated;
revoke all on table public.governance_criteria_link_lineage from public, anon, authenticated;
revoke all on table public.governance_criteria_link_evidence from public, anon, authenticated;
grant select on table public.governance_linkage_reviews to authenticated, service_role;
grant select on table public.governance_criteria_links to authenticated, service_role;
grant select on table public.governance_criteria_link_decisions to authenticated, service_role;
grant select on table public.governance_criteria_link_lineage to authenticated, service_role;
grant select on table public.governance_criteria_link_evidence to authenticated, service_role;
grant insert, update, delete on table public.governance_linkage_reviews to service_role;
grant insert on table public.governance_criteria_links to service_role;
grant insert on table public.governance_criteria_link_decisions to service_role;
grant insert on table public.governance_criteria_link_lineage to service_role;
grant insert on table public.governance_criteria_link_evidence to service_role;

revoke all on public.v_current_governance_criteria_links from public, anon;
revoke all on public.v_governance_linkage_review_queue from public, anon;
revoke all on public.v_confirmed_governance_criteria_truth from public, anon;
grant select on public.v_current_governance_criteria_links to authenticated, service_role;
grant select on public.v_governance_linkage_review_queue to authenticated, service_role;
grant select on public.v_confirmed_governance_criteria_truth to authenticated, service_role;

revoke all on function public.governance_linkage_source_context(text, uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.validate_governance_linkage_review_source() from public, anon, authenticated, service_role;
revoke all on function public.validate_governance_criteria_link() from public, anon, authenticated, service_role;
revoke all on function public.reject_governance_link_mutation() from public, anon, authenticated, service_role;
revoke all on function public.validate_governance_criteria_decision() from public, anon, authenticated, service_role;
revoke all on function public.validate_governance_link_lineage() from public, anon, authenticated, service_role;
revoke all on function public.validate_governance_link_evidence() from public, anon, authenticated, service_role;
revoke all on function public.governance_linkage_require_service_role() from public, anon, authenticated, service_role;
revoke all on function public.governance_linkage_actor_authorized(uuid, uuid, text, uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.governance_linkage_resolution_snapshot(text, uuid, uuid, uuid, uuid, uuid, uuid, uuid, date, text) from public, anon, authenticated, service_role;

revoke all on function public.governance_linkage_source_readable(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.governance_linkage_target_readable(uuid, text, uuid, uuid, uuid, uuid, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.governance_linkage_source_readable(uuid, text, uuid) to authenticated, service_role;
grant execute on function public.governance_linkage_target_readable(uuid, text, uuid, uuid, uuid, uuid, uuid, uuid, uuid) to authenticated, service_role;

revoke all on function public.resolve_governance_document_version_candidates(uuid, uuid, date, uuid) from public, anon;
grant execute on function public.resolve_governance_document_version_candidates(uuid, uuid, date, uuid) to authenticated, service_role;

revoke all on function public.start_governance_linkage_review(uuid, text, uuid, uuid, date, text) from public, anon, authenticated;
revoke all on function public.suggest_governance_criterion_link(uuid, uuid, text, uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, text, date, text, text, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.append_governance_criterion_decision(uuid, uuid, text, text, text, text, text, text, uuid, uuid[]) from public, anon, authenticated;
revoke all on function public.supersede_governance_criterion_link(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.complete_governance_linkage_review(uuid, uuid, text, text, boolean) from public, anon, authenticated;
revoke all on function public.get_governance_criteria_linkage_capabilities() from public, anon, authenticated;
grant execute on function public.start_governance_linkage_review(uuid, text, uuid, uuid, date, text) to service_role;
grant execute on function public.suggest_governance_criterion_link(uuid, uuid, text, uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, text, date, text, text, uuid, uuid, text) to service_role;
grant execute on function public.append_governance_criterion_decision(uuid, uuid, text, text, text, text, text, text, uuid, uuid[]) to service_role;
grant execute on function public.supersede_governance_criterion_link(uuid, uuid, uuid, text) to service_role;
grant execute on function public.complete_governance_linkage_review(uuid, uuid, text, text, boolean) to service_role;
grant execute on function public.get_governance_criteria_linkage_capabilities() to service_role;

comment on view public.v_confirmed_governance_criteria_truth is
  'GOV-LINK-1 current confirmed truth. Violation flags exclude context-only and unknown legacy continuity links.';
comment on function public.resolve_governance_document_version_candidates(uuid, uuid, date, uuid) is
  'Diagnostic point-in-time resolver. Facility applicability is intentionally reported unavailable until Facility Master exists.';

insert into public.governance_criteria_links (
  id, organization_id, review_id, source_entity_type, source_entity_id,
  root_source_entity_type, root_source_entity_id, target_criterion_type,
  target_document_id, target_version_id, relationship_origin, resolution_date,
  resolution_method, resolution_snapshot, legacy_document_link_id, created_by, created_at
)
select
  md5('gov-link-legacy-f1-link:' || l.id::text)::uuid,
  o.organization_id, md5('gov-link-legacy-f1-review:' || o.id::text)::uuid,
  'ovr', o.id, 'ovr', o.id, d.document_type,
  d.id, v.id, 'legacy_f1', coalesce(o.occurrence_date, l.created_at::date), 'legacy_f1',
  public.governance_linkage_resolution_snapshot(
    d.document_type, d.id, v.id, null, null, null, null, null,
    coalesce(o.occurrence_date, l.created_at::date), 'legacy_f1'
  ) || jsonb_build_object('legacy_document_link_id', l.id, 'classification', 'continuity_only'),
  l.id, l.created_by, l.created_at
from public.document_links l
join public.ovr_reports o on o.id = l.linked_item_id
join public.controlled_documents d on d.id = l.document_id and d.organization_id = o.organization_id
join public.document_versions v on v.id = l.version_id and v.document_id = d.id
where l.linked_item_type = 'ovr' and l.link_type = 'governed_version'
  and exists (select 1 from public.governance_linkage_reviews r where r.id = md5('gov-link-legacy-f1-review:' || o.id::text)::uuid)
on conflict (legacy_document_link_id) where legacy_document_link_id is not null do nothing;

insert into public.governance_criteria_link_decisions (
  id, organization_id, link_id, decision_type, significance, adherence_status, adequacy_status,
  actor_id, decided_at, rationale
)
select
  md5('gov-link-legacy-f1-decision:' || l.id::text)::uuid,
  o.organization_id, md5('gov-link-legacy-f1-link:' || l.id::text)::uuid,
  'confirmed', 'context_only', 'unknown', 'not_assessed',
  coalesce(l.created_by, o.quality_reviewer_id, o.owner_id, o.created_by), l.created_at,
  'Historical F1 relationship imported for continuity; no adherence, violation, or adequacy finding was inferred.'
from public.document_links l
join public.ovr_reports o on o.id = l.linked_item_id
where l.linked_item_type = 'ovr' and l.link_type = 'governed_version'
  and coalesce(l.created_by, o.quality_reviewer_id, o.owner_id, o.created_by) is not null
  and exists (select 1 from public.governance_criteria_links gl where gl.legacy_document_link_id = l.id)
on conflict (id) do nothing;
