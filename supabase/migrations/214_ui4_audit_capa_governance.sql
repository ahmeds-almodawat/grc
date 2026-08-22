-- GRC v1.4 UI-4: Audit criteria independence and canonical Patch 28 CAPA execution.
-- Extends migrations 212-213. Historical migrations and canonical models remain unchanged.

-- ---------------------------------------------------------------------------
-- 1. Audit criterion dates, formal/advisory classification, and disputes
-- ---------------------------------------------------------------------------
alter table public.audit_findings
  add column if not exists finding_classification text not null default 'formal_finding',
  add column if not exists finding_date date,
  add column if not exists audit_period_end_date date,
  add column if not exists observed_condition text,
  add column if not exists effect_impact text;

update public.audit_findings
set finding_date = coalesce(finding_date, created_at::date),
    observed_condition = coalesce(nullif(observed_condition, ''), description),
    effect_impact = coalesce(nullif(effect_impact, ''), nullif(recommendation, ''))
where finding_date is null or observed_condition is null or effect_impact is null;

alter table public.audit_findings
  alter column finding_date set default current_date,
  alter column finding_date set not null;

alter table public.audit_findings
  drop constraint if exists audit_findings_ui4_classification_check;
alter table public.audit_findings
  add constraint audit_findings_ui4_classification_check
  check (finding_classification in ('formal_finding','advisory_observation'));

alter table public.audit_findings
  drop constraint if exists audit_findings_ui4_period_date_check;
alter table public.audit_findings
  add constraint audit_findings_ui4_period_date_check
  check (audit_period_end_date is null or audit_period_end_date <= finding_date);

create table if not exists public.audit_finding_criteria_disputes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  audit_finding_id uuid not null references public.audit_findings(id) on delete restrict,
  governance_link_id uuid references public.governance_criteria_links(id) on delete restrict,
  dispute_type text not null default 'criterion_dispute' check (dispute_type in (
    'criterion_dispute','scope_correction','version_correction','applicability_correction','evidence_response'
  )),
  dispute_statement text not null check (length(btrim(dispute_statement)) >= 3),
  proposed_correction text,
  evidence_reference text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists idx_ui4_audit_criteria_disputes_finding
  on public.audit_finding_criteria_disputes(audit_finding_id, created_at desc);

create or replace function public.ui4_reject_audit_dispute_mutation()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin raise exception 'UI4_AUDIT_CRITERIA_DISPUTE_APPEND_ONLY'; end;
$$;

drop trigger if exists trg_ui4_audit_criteria_disputes_immutable on public.audit_finding_criteria_disputes;
create trigger trg_ui4_audit_criteria_disputes_immutable
before update or delete on public.audit_finding_criteria_disputes
for each row execute function public.ui4_reject_audit_dispute_mutation();

alter table public.audit_finding_criteria_disputes enable row level security;
drop policy if exists audit_finding_criteria_disputes_read_ui4 on public.audit_finding_criteria_disputes;
create policy audit_finding_criteria_disputes_read_ui4 on public.audit_finding_criteria_disputes
for select to authenticated using (
  organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
  and exists (select 1 from public.audit_findings f where f.id = audit_finding_id)
);

revoke all on table public.audit_finding_criteria_disputes from public, anon, authenticated;
grant select on table public.audit_finding_criteria_disputes to authenticated, service_role;
grant insert on table public.audit_finding_criteria_disputes to service_role;

-- Audit Policy/SOP version resolution uses the audit-period end date, then the
-- finding date. Every other source keeps the migration-213 semantics.
create or replace function public.governance_linkage_source_context(
  p_source_entity_type text,
  p_source_entity_id uuid,
  p_source_revision_id uuid default null
)
returns table (organization_id uuid, source_date date, department_id uuid)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if p_source_entity_type = 'ovr' then
    if p_source_revision_id is not null then raise exception 'GOV_LINK_OVR_REVISION_UNSUPPORTED'; end if;
    return query select o.organization_id, o.occurrence_date, o.department_id
      from public.ovr_reports o where o.id = p_source_entity_id;
  elsif p_source_entity_type = 'risk' then
    if p_source_revision_id is not null and not exists (
      select 1 from public.risk_reassessment_history h where h.id = p_source_revision_id and h.risk_id = p_source_entity_id
    ) then raise exception 'GOV_LINK_RISK_REVISION_MISMATCH'; end if;
    return query select r.organization_id,
      coalesce((select h.changed_at::date from public.risk_reassessment_history h where h.id = p_source_revision_id), r.last_reviewed_at::date, r.created_at::date),
      r.department_id from public.risks r where r.id = p_source_entity_id;
  elsif p_source_entity_type = 'compliance_assessment' then
    if p_source_revision_id is not null then raise exception 'GOV_LINK_COMPLIANCE_ASSESSMENT_REVISION_UNSUPPORTED'; end if;
    return query select a.organization_id, a.assessment_date, a.department_id
      from public.compliance_assessments a where a.id = p_source_entity_id;
  elsif p_source_entity_type = 'audit_finding' then
    if p_source_revision_id is not null then raise exception 'GOV_LINK_AUDIT_REVISION_UNSUPPORTED'; end if;
    return query select a.organization_id,
      coalesce(a.audit_period_end_date, a.finding_date, a.created_at::date),
      coalesce(a.responsible_department_id, a.department_id)
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

-- Audit criteria can be suggested/reviewed only by assigned or authorized
-- auditors and independent governance reviewers. Management participants keep
-- a separate append-only dispute path and cannot rewrite the criterion.
create or replace function public.governance_linkage_actor_authorized(
  p_actor_id uuid,
  p_organization_id uuid,
  p_source_entity_type text,
  p_source_entity_id uuid,
  p_authority text
)
returns boolean language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_actor public.profiles%rowtype; v_department_id uuid;
begin
  select * into v_actor from public.profiles where id = p_actor_id;
  if not found or not coalesce(v_actor.is_active, false) or v_actor.user_status::text <> 'active'
     or v_actor.organization_id is distinct from p_organization_id then return false; end if;

  if exists (
    select 1 from public.user_roles ur where ur.user_id = p_actor_id and ur.is_active
      and ur.organization_id = p_organization_id and ur.scope::text = 'global'
      and ur.role::text in ('super_admin','governance_admin')
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
  elsif p_source_entity_type = 'compliance_assessment' then
    select department_id into v_department_id from public.compliance_assessments
      where id = p_source_entity_id and organization_id = p_organization_id;
    if exists (
      select 1 from public.user_roles ur where ur.user_id = p_actor_id and ur.is_active
        and ur.organization_id = p_organization_id and ur.role::text = 'compliance_officer'
    ) then return true; end if;
    if exists (
      select 1 from public.compliance_assessments a where a.id = p_source_entity_id
        and p_actor_id in (a.responsible_owner_id, a.reviewer_id, a.created_by, a.reviewed_by, a.approved_by)
    ) then return true; end if;
  elsif p_source_entity_type = 'audit_finding' then
    select coalesce(responsible_department_id, department_id) into v_department_id
      from public.audit_findings where id = p_source_entity_id and organization_id = p_organization_id;
    if p_authority in ('suggest','review') and exists (
      select 1 from public.user_roles ur where ur.user_id = p_actor_id and ur.is_active
        and ur.organization_id = p_organization_id and ur.role::text = 'auditor'
    ) then return true; end if;
    if p_authority in ('suggest','review') and exists (
      select 1 from public.audit_findings a where a.id = p_source_entity_id
        and p_actor_id in (a.auditor_id, a.audit_manager_id, a.created_by, a.reviewed_by)
    ) then return true; end if;
    return false;
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
      and p_source_entity_type <> 'audit_finding'
      and (ur.scope::text = 'global' or ur.department_id = v_department_id)
  );
end;
$$;

-- Inherited CAPA links preserve the source determination. They cannot receive
-- a child-level correction; corrections must be appended at the source.
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
  if v_link.relationship_origin = 'inherited' then raise exception 'UI4_INHERITED_GOVERNANCE_LINK_READ_ONLY'; end if;
  if not public.governance_linkage_actor_authorized(p_actor_id, v_link.organization_id,
      v_link.source_entity_type, v_link.source_entity_id, 'review') then
    raise exception 'GOV_LINK_REVIEW_AUTHORITY_REQUIRED';
  end if;
  if p_decision_type not in ('under_review','confirmed','rejected','superseded') then raise exception 'GOV_LINK_DECISION_TYPE_INVALID'; end if;
  if p_supersedes_decision_id is not null and length(btrim(coalesce(p_correction_reason, ''))) < 3 then
    raise exception 'GOV_LINK_CORRECTION_REASON_REQUIRED';
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

-- ---------------------------------------------------------------------------
-- 2. Audit closure criterion gate and read contract
-- ---------------------------------------------------------------------------
create or replace function public.ui4_audit_finding_has_legitimate_criterion(p_audit_finding_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select finding_classification = 'advisory_observation'
    from public.audit_findings where id = p_audit_finding_id), false)
  or exists (
    select 1 from public.v_current_governance_criteria_links l
    where l.source_entity_type = 'audit_finding'
      and l.source_entity_id = p_audit_finding_id
      and l.decision_type = 'confirmed'
      and l.target_criterion_type in (
        'policy','policy_requirement','sop','sop_step','compliance_obligation','accreditation_clause','control'
      )
  );
$$;

create or replace function public.ui4_enforce_audit_criterion_closure()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.finding_status = 'closed'
     and new.finding_status is distinct from old.finding_status
     and not public.ui4_audit_finding_has_legitimate_criterion(new.id) then
    raise exception 'UI4_AUDIT_FORMAL_FINDING_CRITERION_REQUIRED';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ui4_audit_criterion_closure on public.audit_findings;
create trigger trg_ui4_audit_criterion_closure
before update of finding_status on public.audit_findings
for each row execute function public.ui4_enforce_audit_criterion_closure();

create or replace view public.v_ui4_audit_criteria_contract
with (security_invoker = true)
as
select
  f.organization_id,
  f.id as audit_finding_id,
  f.finding_code,
  f.finding_classification,
  f.finding_date,
  f.audit_period_end_date,
  coalesce(f.audit_period_end_date, f.finding_date, f.created_at::date) as criteria_resolution_date,
  count(distinct l.link_id) filter (where l.decision_type = 'confirmed')::integer as confirmed_criterion_count,
  count(distinct d.id)::integer as dispute_count,
  public.ui4_audit_finding_has_legitimate_criterion(f.id) as criterion_gate_satisfied
from public.audit_findings f
left join public.v_current_governance_criteria_links l
  on l.source_entity_type = 'audit_finding' and l.source_entity_id = f.id
left join public.audit_finding_criteria_disputes d on d.audit_finding_id = f.id
group by f.organization_id, f.id;

revoke all on public.v_ui4_audit_criteria_contract from public, anon;
grant select on public.v_ui4_audit_criteria_contract to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Canonical Patch 28 CAPA source compatibility and inherited linkage
-- ---------------------------------------------------------------------------
alter table public.capa_action_plans
  drop constraint if exists capa_action_plans_source_type_check;
alter table public.capa_action_plans
  add constraint capa_action_plans_source_type_check check (source_type in (
    'ovr','risk','audit_finding','compliance_obligation','compliance_assessment','compliance_finding',
    'evidence_gap','document_control','inspection','management_review','customer_complaint','internal_issue','other'
  ));

create or replace function public.ui4_capa_governance_source(
  p_source_type text,
  p_source_id uuid
)
returns table (source_entity_type text, source_entity_id uuid)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if p_source_type in ('ovr','risk','audit_finding','compliance_assessment') then
    return query select p_source_type, p_source_id;
  elsif p_source_type = 'compliance_finding' then
    return query select 'compliance_assessment'::text, f.assessment_id
      from public.compliance_findings f where f.id = p_source_id;
  elsif p_source_type = 'compliance_obligation' then
    return query select 'compliance_assessment'::text, a.id
      from public.compliance_assessments a where a.obligation_id = p_source_id
      order by a.assessment_date desc, a.created_at desc limit 1;
  end if;
end;
$$;

create or replace function public.ui4_inherit_governance_links_to_capa(
  p_actor_id uuid,
  p_capa_id uuid
)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_capa public.capa_action_plans%rowtype;
  v_source_type text;
  v_source_id uuid;
  v_review_id uuid;
  v_parent record;
  v_child jsonb;
  v_child_id uuid;
  v_count integer := 0;
begin
  perform public.governance_linkage_require_service_role();
  select * into v_capa from public.capa_action_plans where id = p_capa_id;
  if not found then raise exception 'UI4_CAPA_NOT_FOUND'; end if;
  select source_entity_type, source_entity_id into v_source_type, v_source_id
    from public.ui4_capa_governance_source(v_capa.source_type, v_capa.source_id);
  if v_source_type is null or v_source_id is null then
    return jsonb_build_object('capa_id', p_capa_id, 'inherited_link_count', 0, 'source_available', false);
  end if;

  select id into v_review_id from public.governance_linkage_reviews
  where organization_id = v_capa.organization_id and source_entity_type = 'capa'
    and source_entity_id = p_capa_id and source_revision_id is null
    and review_status in ('draft','under_review') order by created_at desc limit 1;
  if v_review_id is null then
    v_review_id := (public.start_governance_linkage_review(
      p_actor_id, 'capa', p_capa_id, null, v_capa.created_at::date,
      'Source Governance Linkage inherited from ' || v_source_type || '.'
    )->>'review_id')::uuid;
  end if;

  for v_parent in
    select l.* from public.v_current_governance_criteria_links l
    where l.source_entity_type = v_source_type and l.source_entity_id = v_source_id
      and l.decision_type = 'confirmed'
    order by l.created_at
  loop
    if exists (
      select 1 from public.governance_criteria_link_lineage x
      join public.governance_criteria_links child on child.id = x.child_link_id
      where x.parent_link_id = v_parent.link_id and child.source_entity_type = 'capa'
        and child.source_entity_id = p_capa_id
    ) then continue; end if;
    v_child := public.suggest_governance_criterion_link(
      p_actor_id, v_review_id, v_parent.target_criterion_type,
      v_parent.target_document_id, v_parent.target_version_id,
      v_parent.target_policy_requirement_id, v_parent.target_sop_step_id,
      v_parent.target_compliance_obligation_id, v_parent.target_accreditation_clause_id,
      v_parent.target_control_id, 'inherited', 'inherited', v_parent.resolution_date,
      null, v_parent.root_source_entity_type, v_parent.root_source_entity_id,
      v_parent.link_id, 'Inherited source determination; source remains authoritative.'
    );
    v_child_id := (v_child->>'link_id')::uuid;
    insert into public.governance_criteria_link_decisions (
      organization_id, link_id, decision_type, significance, adherence_status,
      adequacy_status, actor_id, rationale
    ) values (
      v_capa.organization_id, v_child_id, 'confirmed', v_parent.significance,
      v_parent.adherence_status, v_parent.adequacy_status, p_actor_id,
      'Inherited read-only determination from source governance link ' || v_parent.link_id::text || '.'
    );
    v_count := v_count + 1;
  end loop;
  return jsonb_build_object('capa_id', p_capa_id, 'inherited_link_count', v_count, 'source_available', true);
end;
$$;

-- Inherited confirmations are traceability, not additional violation truth.
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
  (not c.inherited and c.significance in ('primary','contributing')
    and c.adherence_status in ('noncompliance','procedure_not_followed')) as counts_as_violation
from public.v_current_governance_criteria_links c
where c.decision_type = 'confirmed';

-- ---------------------------------------------------------------------------
-- 4. Governed UI-4 Audit/CAPA workflow bridge
-- ---------------------------------------------------------------------------
create or replace function public.ui4_audit_capa_workflow_bridge(
  p_actor_id uuid,
  p_action text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_actor public.profiles%rowtype;
  v_action text := lower(coalesce(p_action, ''));
  v_capa public.capa_action_plans%rowtype;
  v_finding public.audit_findings%rowtype;
  v_capa_id uuid;
  v_item_id uuid;
  v_review_id uuid;
  v_result jsonb;
  v_source_id uuid;
  v_source_type text;
  v_elevated boolean := false;
  v_reviewer boolean := false;
  v_note text := nullif(btrim(coalesce(p_payload->>'note', p_payload->>'rationale', '')), '');
begin
  perform public.governance_linkage_require_service_role();
  select * into v_actor from public.profiles where id = p_actor_id and is_active = true and user_status::text = 'active';
  if not found or v_actor.organization_id is null then raise exception 'UI4_ACTIVE_ACTOR_REQUIRED'; end if;
  select exists (
    select 1 from public.user_roles ur where ur.user_id = p_actor_id and ur.is_active
      and ur.organization_id = v_actor.organization_id
      and ur.role::text in ('super_admin','governance_admin','compliance_officer','department_manager')
  ) into v_elevated;
  select exists (
    select 1 from public.user_roles ur where ur.user_id = p_actor_id and ur.is_active
      and ur.organization_id = v_actor.organization_id
      and ur.role::text in ('super_admin','governance_admin','auditor','compliance_officer')
  ) into v_reviewer;

  if v_action = 'ui4_record_audit_criteria_dispute' then
    select * into v_finding from public.audit_findings where id = nullif(p_payload->>'audit_finding_id','')::uuid;
    if not found then raise exception 'UI4_AUDIT_FINDING_NOT_FOUND'; end if;
    if v_finding.organization_id is distinct from v_actor.organization_id then raise exception 'UI4_CROSS_ORGANIZATION_DENIED'; end if;
    if not (v_elevated or p_actor_id in (v_finding.owner_id, v_finding.finding_owner_id,
      v_finding.responsible_owner_id, v_finding.management_response_submitted_by)) then
      raise exception 'UI4_AUDIT_DISPUTE_AUTHORITY_REQUIRED';
    end if;
    if length(btrim(coalesce(p_payload->>'dispute_statement',''))) < 3 then raise exception 'UI4_AUDIT_DISPUTE_STATEMENT_REQUIRED'; end if;
    if nullif(p_payload->>'governance_link_id','')::uuid is not null and not exists (
      select 1 from public.governance_criteria_links l
      where l.id = nullif(p_payload->>'governance_link_id','')::uuid
        and l.source_entity_type = 'audit_finding' and l.source_entity_id = v_finding.id
    ) then raise exception 'UI4_AUDIT_DISPUTE_LINK_MISMATCH'; end if;
    insert into public.audit_finding_criteria_disputes (
      organization_id, audit_finding_id, governance_link_id, dispute_type,
      dispute_statement, proposed_correction, evidence_reference, created_by
    ) values (
      v_finding.organization_id, v_finding.id, nullif(p_payload->>'governance_link_id','')::uuid,
      coalesce(nullif(p_payload->>'dispute_type',''),'criterion_dispute'), btrim(p_payload->>'dispute_statement'),
      nullif(p_payload->>'proposed_correction',''), nullif(p_payload->>'evidence_reference',''), p_actor_id
    ) returning id into v_item_id;
    return jsonb_build_object('dispute_id', v_item_id, 'status', 'recorded');

  elsif v_action = 'ui4_create_capa' then
    if not v_elevated then raise exception 'UI4_CAPA_CREATE_AUTHORITY_REQUIRED'; end if;
    if length(btrim(coalesce(p_payload->>'capa_title',''))) < 3 then raise exception 'UI4_CAPA_TITLE_REQUIRED'; end if;
    v_source_type := coalesce(nullif(p_payload->>'source_type',''),'other');
    v_source_id := nullif(p_payload->>'source_id','')::uuid;
    if v_source_id is not null then
      if v_source_type = 'audit_finding' and not exists (select 1 from public.audit_findings where id = v_source_id and organization_id = v_actor.organization_id) then raise exception 'UI4_CAPA_SOURCE_NOT_FOUND'; end if;
      if v_source_type = 'risk' and not exists (select 1 from public.risks where id = v_source_id and organization_id = v_actor.organization_id) then raise exception 'UI4_CAPA_SOURCE_NOT_FOUND'; end if;
      if v_source_type = 'ovr' and not exists (select 1 from public.ovr_reports where id = v_source_id and organization_id = v_actor.organization_id) then raise exception 'UI4_CAPA_SOURCE_NOT_FOUND'; end if;
      if v_source_type = 'compliance_assessment' and not exists (select 1 from public.compliance_assessments where id = v_source_id and organization_id = v_actor.organization_id) then raise exception 'UI4_CAPA_SOURCE_NOT_FOUND'; end if;
      if v_source_type = 'compliance_finding' and not exists (select 1 from public.compliance_findings where id = v_source_id and organization_id = v_actor.organization_id) then raise exception 'UI4_CAPA_SOURCE_NOT_FOUND'; end if;
    end if;
    v_capa_id := public.create_capa_action_plan(
      v_actor.organization_id,
      coalesce(nullif(p_payload->>'capa_code',''), 'CAPA-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
      btrim(p_payload->>'capa_title'), coalesce(nullif(p_payload->>'capa_type',''),'corrective_action'),
      v_source_type, p_actor_id, p_payload
    );
    if v_source_id is not null and v_source_type in ('ovr','risk','audit_finding','compliance_obligation') then
      perform public.link_capa_to_item(v_capa_id, v_source_type, v_source_id, p_actor_id, 'source', true);
    end if;
    v_result := public.ui4_inherit_governance_links_to_capa(p_actor_id, v_capa_id);
    return jsonb_build_object('capa_id', v_capa_id, 'status', 'draft', 'inheritance', v_result);

  else
    if v_action = 'ui4_update_capa_action_item' then
      select c.* into v_capa from public.capa_action_plans c
      join public.capa_action_items i on i.capa_id = c.id
      where i.id = nullif(p_payload->>'action_item_id','')::uuid;
    else
      select * into v_capa from public.capa_action_plans where id = nullif(p_payload->>'capa_id','')::uuid;
    end if;
    if not found then raise exception 'UI4_CAPA_NOT_FOUND'; end if;
    if v_capa.organization_id is distinct from v_actor.organization_id then raise exception 'UI4_CROSS_ORGANIZATION_DENIED'; end if;
    if not (v_elevated or p_actor_id in (v_capa.capa_owner_id, v_capa.action_owner_id, v_capa.reviewer_id,
      v_capa.approver_id, v_capa.validator_id, v_capa.effectiveness_reviewer_id, v_capa.created_by)) then
      raise exception 'UI4_CAPA_ACTION_AUTHORITY_REQUIRED';
    end if;

    if v_action in ('ui4_approve_capa_plan','ui4_reject_capa_plan','ui4_validate_capa_completion',
      'ui4_reject_capa_completion','ui4_start_capa_effectiveness','ui4_complete_capa_effectiveness',
      'ui4_approve_capa_closure','ui4_reject_capa_closure') and not (
        v_reviewer or p_actor_id in (v_capa.reviewer_id, v_capa.approver_id, v_capa.validator_id, v_capa.effectiveness_reviewer_id)
      ) then raise exception 'UI4_CAPA_REVIEW_AUTHORITY_REQUIRED'; end if;

    if v_action = 'ui4_assign_capa' then
      return public.assign_capa_action_plan(v_capa.id, p_actor_id, nullif(p_payload->>'owner_id','')::uuid, v_note);
    elsif v_action = 'ui4_submit_capa_plan' then
      return public.submit_capa_action_plan(v_capa.id, p_actor_id, v_note);
    elsif v_action = 'ui4_approve_capa_plan' then
      return public.approve_capa_action_plan(v_capa.id, p_actor_id, v_note);
    elsif v_action = 'ui4_reject_capa_plan' then
      return public.reject_capa_action_plan(v_capa.id, p_actor_id, btrim(p_payload->>'reason'), v_note);
    elsif v_action = 'ui4_create_capa_action_item' then
      v_item_id := public.create_capa_action_item(v_capa.id, btrim(p_payload->>'action_item_title'), p_actor_id, p_payload);
      return jsonb_build_object('action_item_id', v_item_id, 'status', 'open');
    elsif v_action = 'ui4_update_capa_action_item' then
      return public.update_capa_action_item_status(nullif(p_payload->>'action_item_id','')::uuid, p_payload->>'status', p_actor_id, v_note);
    elsif v_action = 'ui4_submit_capa_completion' then
      return public.submit_capa_completion(v_capa.id, p_actor_id, v_note);
    elsif v_action = 'ui4_validate_capa_completion' then
      return public.validate_capa_completion(v_capa.id, p_actor_id, v_note);
    elsif v_action = 'ui4_reject_capa_completion' then
      return public.reject_capa_completion(v_capa.id, p_actor_id, btrim(p_payload->>'reason'), v_note);
    elsif v_action = 'ui4_start_capa_effectiveness' then
      v_review_id := public.start_capa_effectiveness_review(v_capa.id, p_actor_id,
        nullif(p_payload->>'review_due_date','')::date, nullif(p_payload->>'review_method',''));
      return jsonb_build_object('review_id', v_review_id, 'status', 'pending');
    elsif v_action = 'ui4_complete_capa_effectiveness' then
      return public.complete_capa_effectiveness_review(nullif(p_payload->>'review_id','')::uuid,
        p_actor_id, p_payload->>'review_result', v_note);
    elsif v_action = 'ui4_request_capa_closure' then
      return public.request_capa_closure(v_capa.id, p_actor_id, v_note);
    elsif v_action = 'ui4_approve_capa_closure' then
      return public.approve_capa_closure(v_capa.id, p_actor_id, v_note);
    elsif v_action = 'ui4_reject_capa_closure' then
      return public.reject_capa_closure(v_capa.id, p_actor_id, btrim(p_payload->>'reason'), v_note);
    elsif v_action = 'ui4_reopen_capa' then
      return public.reopen_capa_with_reason(v_capa.id, p_actor_id, btrim(p_payload->>'reason'));
    elsif v_action = 'ui4_refresh_capa_inheritance' then
      return public.ui4_inherit_governance_links_to_capa(p_actor_id, v_capa.id);
    else
      raise exception 'UI4_UNSUPPORTED_ACTION';
    end if;
  end if;
end;
$$;

revoke all on function public.ui4_reject_audit_dispute_mutation() from public, anon, authenticated, service_role;
revoke all on function public.governance_linkage_source_context(text, uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.governance_linkage_actor_authorized(uuid, uuid, text, uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.append_governance_criterion_decision(uuid, uuid, text, text, text, text, text, text, uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.append_governance_criterion_decision(uuid, uuid, text, text, text, text, text, text, uuid, uuid[]) to service_role;
revoke all on function public.ui4_audit_finding_has_legitimate_criterion(uuid) from public, anon, authenticated;
grant execute on function public.ui4_audit_finding_has_legitimate_criterion(uuid) to service_role;
revoke all on function public.ui4_enforce_audit_criterion_closure() from public, anon, authenticated, service_role;
revoke all on function public.ui4_capa_governance_source(text, uuid) from public, anon, authenticated, service_role;
revoke all on function public.ui4_inherit_governance_links_to_capa(uuid, uuid) from public, anon, authenticated;
grant execute on function public.ui4_inherit_governance_links_to_capa(uuid, uuid) to service_role;
revoke all on function public.ui4_audit_capa_workflow_bridge(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.ui4_audit_capa_workflow_bridge(uuid, text, jsonb) to service_role;

create or replace function public.get_governance_criteria_linkage_capabilities()
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'contract_version', 'governance-criteria-linkage-v1',
    'schema_version', 214,
    'review_available', true,
    'suggestion_available', true,
    'decision_available', true,
    'supersession_available', true,
    'completion_available', true,
    'compliance_assessment_source_available', true,
    'audit_independence_available', true,
    'capa_inheritance_available', true,
    'facility_scope_available', false
  );
$$;

revoke all on function public.get_governance_criteria_linkage_capabilities() from public, anon, authenticated;
grant execute on function public.get_governance_criteria_linkage_capabilities() to service_role;

comment on table public.audit_finding_criteria_disputes is 'UI-4 append-only management disputes against auditor-owned governance criteria.';
comment on function public.ui4_audit_capa_workflow_bridge(uuid, text, jsonb) is 'UI-4 service-role Audit/CAPA workflow bridge. Browser code must use authenticated privileged-action.';
comment on function public.ui4_inherit_governance_links_to_capa(uuid, uuid) is 'Copies confirmed source criteria into CAPA as immutable inherited lineage without creating additional violation truth.';
