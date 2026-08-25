-- P1: complete the shared governed linkage architecture without replacing
-- migration 212. Compliance findings become first-class sources; analytics
-- remain RLS-scoped raw counts; review patterns can only open a review.

-- ---------------------------------------------------------------------------
-- 1. Compliance Finding as a first-class governance-link source.
-- ---------------------------------------------------------------------------
alter table public.governance_linkage_reviews
  drop constraint if exists governance_linkage_reviews_source_entity_type_ui3_check;
alter table public.governance_linkage_reviews
  drop constraint if exists governance_linkage_reviews_source_entity_type_p1_check;
alter table public.governance_linkage_reviews
  add constraint governance_linkage_reviews_source_entity_type_p1_check
  check (source_entity_type in ('ovr','risk','audit_finding','capa','compliance_assessment','compliance_finding'));

alter table public.governance_criteria_links
  drop constraint if exists governance_criteria_links_source_entity_type_ui3_check;
alter table public.governance_criteria_links
  drop constraint if exists governance_criteria_links_root_source_entity_type_ui3_check;
alter table public.governance_criteria_links
  drop constraint if exists governance_criteria_links_source_entity_type_p1_check;
alter table public.governance_criteria_links
  drop constraint if exists governance_criteria_links_root_source_entity_type_p1_check;
alter table public.governance_criteria_links
  add constraint governance_criteria_links_source_entity_type_p1_check
  check (source_entity_type in ('ovr','risk','audit_finding','capa','compliance_assessment','compliance_finding'));
alter table public.governance_criteria_links
  add constraint governance_criteria_links_root_source_entity_type_p1_check
  check (root_source_entity_type in ('ovr','risk','audit_finding','capa','compliance_assessment','compliance_finding'));

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
      coalesce(
        (select h.changed_at::date from public.risk_reassessment_history h where h.id = p_source_revision_id),
        r.last_reviewed_at::date,
        r.created_at::date
      ),
      r.department_id from public.risks r where r.id = p_source_entity_id;
  elsif p_source_entity_type = 'compliance_assessment' then
    if p_source_revision_id is not null then raise exception 'GOV_LINK_COMPLIANCE_ASSESSMENT_REVISION_UNSUPPORTED'; end if;
    return query select a.organization_id, a.assessment_date, a.department_id
      from public.compliance_assessments a where a.id = p_source_entity_id;
  elsif p_source_entity_type = 'compliance_finding' then
    if p_source_revision_id is not null then raise exception 'GOV_LINK_COMPLIANCE_FINDING_REVISION_UNSUPPORTED'; end if;
    return query select f.organization_id, a.assessment_date, coalesce(f.department_id, a.department_id)
      from public.compliance_findings f
      join public.compliance_assessments a on a.id = f.assessment_id
      where f.id = p_source_entity_id;
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
  elsif p_source_entity_type = 'compliance_finding' then
    select coalesce(f.department_id, a.department_id) into v_department_id
      from public.compliance_findings f
      join public.compliance_assessments a on a.id = f.assessment_id
      where f.id = p_source_entity_id and f.organization_id = p_organization_id;
    if exists (
      select 1 from public.user_roles ur where ur.user_id = p_actor_id and ur.is_active
        and ur.organization_id = p_organization_id and ur.role::text = 'compliance_officer'
    ) then return true; end if;
    if exists (
      select 1 from public.compliance_findings f
      join public.compliance_assessments a on a.id = f.assessment_id
      where f.id = p_source_entity_id
        and p_actor_id in (
          f.responsible_owner_id, f.created_by, f.reviewed_by,
          a.responsible_owner_id, a.reviewer_id, a.created_by, a.reviewed_by, a.approved_by
        )
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

create or replace function public.ui4_capa_governance_source(p_source_type text, p_source_id uuid)
returns table(source_entity_type text, source_entity_id uuid)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if p_source_type in ('ovr','risk','audit_finding','compliance_assessment','compliance_finding') then
    return query select p_source_type, p_source_id;
  elsif p_source_type = 'compliance_obligation' then
    return query select 'compliance_assessment'::text, a.id
      from public.compliance_assessments a where a.obligation_id = p_source_id
      order by a.assessment_date desc, a.created_at desc limit 1;
  end if;
end;
$$;

revoke all on function public.governance_linkage_source_context(text, uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.governance_linkage_actor_authorized(uuid, uuid, text, uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.ui4_capa_governance_source(text, uuid) from public, anon, authenticated, service_role;

-- Append decisions created within one transaction share the same now(). A
-- monotonic sequence makes current truth deterministic without rewriting or
-- deleting any decision history.
alter table public.governance_criteria_link_decisions
  add column if not exists decision_sequence bigint generated always as identity;
create unique index if not exists uq_governance_criteria_decision_sequence
  on public.governance_criteria_link_decisions(decision_sequence);

create or replace view public.v_current_governance_criteria_links
with (security_invoker = true)
as
with current_decisions as (
  select distinct on (decision.link_id)
    decision.id, decision.link_id, decision.decision_type, decision.significance,
    decision.adherence_status, decision.adequacy_status, decision.actor_id,
    decision.decided_at, decision.rationale, decision.correction_reason,
    decision.supersedes_decision_id
  from public.governance_criteria_link_decisions decision
  order by decision.link_id, decision.decision_sequence desc
), actor_document_access as (
  select document.id as document_id,
    document.confidentiality_level not in ('confidential','restricted')
    or document.document_owner_id = auth.uid() or document.reviewer_id = auth.uid()
    or document.approver_id = auth.uid() or document.executive_sponsor_id = auth.uid()
    or exists (
      select 1 from public.user_roles role
      where role.user_id = auth.uid() and role.is_active
        and role.organization_id = document.organization_id
        and role.role::text in ('super_admin','governance_admin','compliance_officer','auditor')
    ) as may_label
  from public.controlled_documents document
)
select
  link.id as link_id,
  link.organization_id,
  link.review_id,
  link.source_entity_type,
  link.source_entity_id,
  link.source_revision_id,
  link.root_source_entity_type,
  link.root_source_entity_id,
  link.target_criterion_type,
  link.target_document_id,
  link.target_version_id,
  link.target_policy_requirement_id,
  link.target_sop_step_id,
  link.target_compliance_obligation_id,
  link.target_accreditation_clause_id,
  link.target_control_id,
  case
    when link.target_document_id is not null and not coalesce(access.may_label, false) then '[restricted]'
    when link.target_criterion_type = 'policy_requirement' then coalesce(document.document_code, 'Policy') || ' requirement'
    when link.target_criterion_type = 'sop_step' then coalesce(document.document_code, 'SOP') || ' step'
    when link.target_document_id is not null then document.document_title
    when link.target_criterion_type = 'compliance_obligation' then 'Compliance obligation'
    when link.target_criterion_type = 'accreditation_clause' then 'Accreditation clause'
    when link.target_criterion_type = 'control' then 'Control'
  end as target_display_label,
  document.confidentiality_level as target_confidentiality_level,
  link.relationship_origin,
  link.resolution_date,
  link.resolution_method,
  link.resolution_snapshot,
  link.resolution_override_rationale,
  link.supersedes_link_id,
  link.legacy_document_link_id,
  link.created_by,
  link.created_at,
  current_decision.id as current_decision_id,
  current_decision.decision_type,
  current_decision.significance,
  current_decision.adherence_status,
  current_decision.adequacy_status,
  current_decision.actor_id as decision_actor_id,
  current_decision.decided_at,
  current_decision.rationale as decision_rationale,
  current_decision.correction_reason,
  (link.root_source_entity_type <> link.source_entity_type
    or link.root_source_entity_id <> link.source_entity_id
    or link.relationship_origin = 'inherited') as inherited,
  link.root_source_entity_type || ':' || link.root_source_entity_id::text as root_event_key
from public.governance_criteria_links link
left join current_decisions current_decision on current_decision.link_id = link.id
left join public.controlled_documents document on document.id = link.target_document_id
left join actor_document_access access on access.document_id = document.id;

-- ---------------------------------------------------------------------------
-- 2. Governed analytics. These are raw, RLS-visible counts; no exposure rate
-- is inferred because no canonical denominator exists.
-- ---------------------------------------------------------------------------
grant select on table public.capa_effectiveness_reviews to authenticated, service_role;
revoke select on table public.capa_effectiveness_reviews from anon;

create or replace view public.v_governance_link_analytics_events
with (security_invoker = true)
as
select
  link.link_id,
  link.organization_id,
  link.source_entity_type,
  link.source_entity_id,
  link.root_source_entity_type,
  link.root_source_entity_id,
  link.root_event_key,
  link.target_criterion_type,
  link.target_document_id,
  link.target_version_id,
  link.target_policy_requirement_id,
  link.target_sop_step_id,
  link.target_compliance_obligation_id,
  link.target_accreditation_clause_id,
  link.target_control_id,
  link.target_display_label,
  link.relationship_origin,
  link.decision_type,
  link.significance,
  link.adherence_status,
  link.adequacy_status,
  link.inherited,
  link.resolution_date,
  link.created_at,
  case link.root_source_entity_type
    when 'ovr' then (select coalesce(o.final_severity_level::text, o.quality_confirmed_severity, o.severity_level::text) from public.ovr_reports o where o.id = link.root_source_entity_id)
    when 'risk' then (select coalesce(r.severity_level, r.residual_level::text, r.risk_level::text) from public.risks r where r.id = link.root_source_entity_id)
    when 'audit_finding' then (select coalesce(a.severity_level, a.risk_level::text) from public.audit_findings a where a.id = link.root_source_entity_id)
    when 'compliance_finding' then (select f.severity from public.compliance_findings f where f.id = link.root_source_entity_id)
    when 'capa' then (select coalesce(c.severity_level, c.risk_level) from public.capa_action_plans c where c.id = link.root_source_entity_id)
    else null
  end as source_severity,
  case link.root_source_entity_type
    when 'ovr' then (select o.department_id from public.ovr_reports o where o.id = link.root_source_entity_id)
    when 'risk' then (select r.department_id from public.risks r where r.id = link.root_source_entity_id)
    when 'audit_finding' then (select coalesce(a.responsible_department_id, a.department_id) from public.audit_findings a where a.id = link.root_source_entity_id)
    when 'compliance_assessment' then (select a.department_id from public.compliance_assessments a where a.id = link.root_source_entity_id)
    when 'compliance_finding' then (select coalesce(f.department_id, a.department_id) from public.compliance_findings f join public.compliance_assessments a on a.id = f.assessment_id where f.id = link.root_source_entity_id)
    when 'capa' then (select c.department_id from public.capa_action_plans c where c.id = link.root_source_entity_id)
    else null
  end as department_id,
  case link.root_source_entity_type
    when 'ovr' then (select coalesce(o.rca_summary, o.final_classification) from public.ovr_reports o where o.id = link.root_source_entity_id)
    when 'audit_finding' then (select coalesce(a.root_cause_category, a.root_cause_summary, a.root_cause) from public.audit_findings a where a.id = link.root_source_entity_id)
    when 'compliance_finding' then (select coalesce(f.root_cause_category, f.root_cause_description) from public.compliance_findings f where f.id = link.root_source_entity_id)
    when 'capa' then (select coalesce(c.root_cause_category, c.root_cause_summary) from public.capa_action_plans c where c.id = link.root_source_entity_id)
    else null
  end as root_cause,
  (link.decision_type in ('suggested','under_review')) as suspected,
  (link.decision_type = 'confirmed') as confirmed,
  (link.decision_type = 'confirmed' and link.adequacy_status = 'training_competency_gap') as training_gap,
  (link.decision_type = 'confirmed' and link.adequacy_status in (
    'unclear','incomplete','conflicting','obsolete_version_used','missing_policy','missing_sop'
  )) as document_gap,
  (link.decision_type = 'confirmed' and (
    link.adherence_status in ('noncompliance','procedure_not_followed')
    or link.adequacy_status in ('implementation_gap','control_failed_despite_compliance')
  )) as execution_gap,
  case link.root_source_entity_type
    when 'risk' then coalesce((select r.repeat_signal_flag from public.risks r where r.id = link.root_source_entity_id), false)
    when 'audit_finding' then coalesce((select a.repeat_finding_flag or a.recurrence_count > 0 from public.audit_findings a where a.id = link.root_source_entity_id), false)
    when 'capa' then coalesce((select c.repeat_issue_flag from public.capa_action_plans c where c.id = link.root_source_entity_id), false)
    else false
  end as recurring_source,
  (
    select count(distinct c.id)::integer
    from public.capa_action_plans c
    where c.organization_id = link.organization_id
      and c.source_type = link.root_source_entity_type
      and c.source_id = link.root_source_entity_id
  ) as related_capa_count,
  (
    select count(distinct c.id)::integer
    from public.capa_action_plans c
    join public.capa_effectiveness_reviews review on review.capa_id = c.id and review.review_result = 'effective'
    where c.organization_id = link.organization_id
      and c.source_type = link.root_source_entity_type
      and c.source_id = link.root_source_entity_id
  ) as effective_capa_count,
  exists (
    select 1
    from public.capa_action_plans c
    join public.capa_effectiveness_reviews review on review.capa_id = c.id and review.review_result = 'effective'
    join public.v_current_governance_criteria_links capa_link
      on capa_link.source_entity_type = 'capa' and capa_link.source_entity_id = c.id
      and capa_link.decision_type = 'confirmed'
    where c.organization_id = link.organization_id
      and coalesce(c.closed_at, review.completed_at) < link.created_at
      and capa_link.target_criterion_type = link.target_criterion_type
      and capa_link.target_document_id is not distinct from link.target_document_id
      and capa_link.target_version_id is not distinct from link.target_version_id
      and capa_link.target_policy_requirement_id is not distinct from link.target_policy_requirement_id
      and capa_link.target_sop_step_id is not distinct from link.target_sop_step_id
  ) as recurrence_after_effective_capa
from public.v_current_governance_criteria_links link;

create or replace view public.v_governance_link_analytics_summary
with (security_invoker = true)
as
select
  organization_id,
  target_criterion_type,
  target_document_id,
  target_version_id,
  target_policy_requirement_id,
  target_sop_step_id,
  target_compliance_obligation_id,
  target_accreditation_clause_id,
  target_control_id,
  max(target_display_label) as target_display_label,
  count(*)::integer as raw_link_count,
  count(distinct root_event_key)::integer as distinct_root_event_count,
  count(distinct root_event_key) filter (where suspected)::integer as suspected_event_count,
  count(distinct root_event_key) filter (where confirmed and not inherited)::integer as confirmed_event_count,
  count(distinct root_event_key) filter (where decision_type = 'rejected')::integer as rejected_event_count,
  count(distinct root_event_key) filter (where confirmed and source_severity in ('critical','high','level_4','sentinel'))::integer as high_critical_event_count,
  count(distinct department_id) filter (where confirmed)::integer as department_count,
  count(distinct root_event_key) filter (where confirmed and recurring_source)::integer as recurring_source_count,
  count(distinct root_event_key) filter (where confirmed and recurrence_after_effective_capa)::integer as recurrence_after_effective_capa_count,
  coalesce(sum(related_capa_count) filter (where confirmed and not inherited), 0)::integer as related_capa_count,
  coalesce(sum(effective_capa_count) filter (where confirmed and not inherited), 0)::integer as effective_capa_count,
  count(distinct root_event_key) filter (where training_gap and not inherited)::integer as training_gap_count,
  count(distinct root_event_key) filter (where document_gap and not inherited)::integer as document_gap_count,
  count(distinct root_event_key) filter (where execution_gap and not inherited)::integer as execution_gap_count,
  false as normalized_rate_available,
  'No canonical exposure denominator is available; counts are raw RLS-visible events.'::text as rate_note
from public.v_governance_link_analytics_events
group by organization_id, target_criterion_type, target_document_id, target_version_id,
  target_policy_requirement_id, target_sop_step_id, target_compliance_obligation_id,
  target_accreditation_clause_id, target_control_id;

revoke all on public.v_governance_link_analytics_events from public, anon;
revoke all on public.v_governance_link_analytics_summary from public, anon;
grant select on public.v_governance_link_analytics_events to authenticated, service_role;
grant select on public.v_governance_link_analytics_summary to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Pattern evaluation starts a governed review only. It never creates a
-- revision, approval, publication, or document mutation.
-- ---------------------------------------------------------------------------
alter table public.governed_document_review_triggers
  drop constraint if exists governed_document_review_triggers_trigger_type_check;
alter table public.governed_document_review_triggers
  drop constraint if exists governed_document_review_triggers_trigger_type_p1_check;
alter table public.governed_document_review_triggers
  add constraint governed_document_review_triggers_trigger_type_p1_check
  check (trigger_type in (
    'scheduled','regulatory_change','audit_finding','ovr','capa','management_decision',
    'accreditation_finding','governance_pattern'
  ));

create or replace function public.evaluate_governance_document_review_trigger(
  p_actor_id uuid,
  p_document_id uuid,
  p_due_date date default (current_date + 30)
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_document public.controlled_documents%rowtype;
  v_actor public.profiles%rowtype;
  v_summary record;
  v_trigger_id uuid;
  v_rationale text;
begin
  perform public.governance_linkage_require_service_role();
  select * into v_document from public.controlled_documents where id = p_document_id;
  if not found then raise exception 'P1_REVIEW_DOCUMENT_NOT_FOUND'; end if;
  select * into v_actor from public.profiles where id = p_actor_id;
  if not found or not v_actor.is_active or v_actor.user_status::text <> 'active'
     or v_actor.organization_id is distinct from v_document.organization_id then
    raise exception 'P1_REVIEW_ACTIVE_SAME_ORG_ACTOR_REQUIRED';
  end if;
  if v_document.document_owner_id is distinct from p_actor_id and not exists (
    select 1 from public.user_roles ur
    where ur.user_id = p_actor_id and ur.organization_id = v_document.organization_id and ur.is_active
      and ur.role::text in ('super_admin','governance_admin','compliance_officer')
  ) then raise exception 'P1_REVIEW_TRIGGER_AUTHORITY_REQUIRED'; end if;

  select
    coalesce(sum(confirmed_event_count), 0)::integer as confirmed_count,
    coalesce(sum(high_critical_event_count), 0)::integer as severe_count,
    coalesce(sum(recurring_source_count), 0)::integer as recurring_count,
    coalesce(sum(recurrence_after_effective_capa_count), 0)::integer as post_capa_recurrence_count,
    coalesce(sum(training_gap_count), 0)::integer as training_count,
    coalesce(sum(document_gap_count), 0)::integer as document_gap_count,
    coalesce(sum(execution_gap_count), 0)::integer as execution_gap_count
  into v_summary
  from public.v_governance_link_analytics_summary
  where organization_id = v_document.organization_id and target_document_id = p_document_id;

  if v_summary.confirmed_count < 3
     and v_summary.severe_count < 1
     and v_summary.recurring_count < 1
     and v_summary.post_capa_recurrence_count < 1
     and v_summary.training_count < 2
     and v_summary.document_gap_count < 1 then
    return jsonb_build_object(
      'document_id', p_document_id,
      'triggered', false,
      'reason', 'pattern_threshold_not_met',
      'confirmed_event_count', v_summary.confirmed_count
    );
  end if;

  select id into v_trigger_id from public.governed_document_review_triggers
  where document_id = p_document_id and trigger_type = 'governance_pattern'
    and source_entity_type = 'governance_pattern' and source_entity_id = p_document_id
    and status in ('open','in_progress')
  order by created_at desc limit 1;
  if v_trigger_id is not null then
    return jsonb_build_object('document_id', p_document_id, 'trigger_id', v_trigger_id, 'triggered', false, 'reason', 'review_already_open');
  end if;

  v_rationale := format(
    'Governed pattern review: confirmed=%s; high/critical=%s; recurring=%s; recurrence after effective CAPA=%s; training gaps=%s; document gaps=%s; execution gaps=%s. Review only; no revision is automatic.',
    v_summary.confirmed_count, v_summary.severe_count, v_summary.recurring_count,
    v_summary.post_capa_recurrence_count, v_summary.training_count,
    v_summary.document_gap_count, v_summary.execution_gap_count
  );
  insert into public.governed_document_review_triggers (
    organization_id, document_id, version_id, trigger_type, source_entity_type,
    source_entity_id, triggered_by, review_owner_id, due_date, status,
    outcome_note, trigger_rationale
  ) values (
    v_document.organization_id, p_document_id, v_document.current_version_id,
    'governance_pattern', 'governance_pattern', p_document_id, p_actor_id,
    v_document.document_owner_id, coalesce(p_due_date, current_date + 30), 'open',
    v_rationale, v_rationale
  ) returning id into v_trigger_id;
  return jsonb_build_object(
    'document_id', p_document_id,
    'trigger_id', v_trigger_id,
    'triggered', true,
    'status', 'open'
  );
end;
$$;

revoke all on function public.evaluate_governance_document_review_trigger(uuid, uuid, date) from public, anon, authenticated;
grant execute on function public.evaluate_governance_document_review_trigger(uuid, uuid, date) to service_role;

create or replace function public.get_governance_criteria_linkage_capabilities()
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'contract_version', 'governance-criteria-linkage-v1',
    'schema_version', 218,
    'review_available', true,
    'suggestion_available', true,
    'decision_available', true,
    'supersession_available', true,
    'completion_available', true,
    'compliance_assessment_source_available', true,
    'compliance_finding_source_available', true,
    'audit_independence_available', true,
    'capa_inheritance_available', true,
    'analytics_available', true,
    'review_trigger_evaluation_available', true,
    'facility_scope_available', false
  );
$$;

revoke all on function public.get_governance_criteria_linkage_capabilities() from public, anon, authenticated;
grant execute on function public.get_governance_criteria_linkage_capabilities() to service_role;

comment on view public.v_governance_link_analytics_summary is
  'P1 RLS-scoped raw governance-link analytics. No exposure denominator or normalized rate is fabricated.';
comment on function public.evaluate_governance_document_review_trigger(uuid, uuid, date) is
  'P1 service-only pattern evaluator that may open a governed review and cannot revise, approve, or publish a document.';
