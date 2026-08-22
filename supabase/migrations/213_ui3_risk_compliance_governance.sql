-- GRC v1.4 UI-3: Risk review governance and canonical Compliance execution.
-- Extends migration 212; it does not replace the governed linkage foundation.

-- ---------------------------------------------------------------------------
-- 1. Canonical Risk reassessment review state
-- ---------------------------------------------------------------------------
alter table public.risk_reassessment_history
  add column if not exists assessment_status text not null default 'recorded',
  add column if not exists governance_review_id uuid references public.governance_linkage_reviews(id) on delete restrict,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_rationale text;

alter table public.risk_reassessment_history
  drop constraint if exists risk_reassessment_history_ui3_status_check;
alter table public.risk_reassessment_history
  add constraint risk_reassessment_history_ui3_status_check
  check (assessment_status in ('recorded','under_review','approved','rejected'));

create unique index if not exists uq_ui3_risk_reassessment_governance_review
  on public.risk_reassessment_history(governance_review_id)
  where governance_review_id is not null;

-- ---------------------------------------------------------------------------
-- 2. Canonical Compliance obligation execution model
-- ---------------------------------------------------------------------------
create table if not exists public.compliance_assessments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  obligation_id uuid not null references public.compliance_obligations(id) on delete restrict,
  assessment_code text not null,
  assessment_title text not null,
  assessment_period_start date,
  assessment_period_end date,
  assessment_date date not null default current_date,
  assessment_method text,
  scope_description text,
  department_id uuid references public.departments(id) on delete set null,
  responsible_owner_id uuid references public.profiles(id) on delete set null,
  reviewer_id uuid references public.profiles(id) on delete set null,
  result text not null default 'not_assessed' check (result in (
    'not_assessed','compliant','partial_compliance','noncompliant','not_applicable','insufficient_evidence'
  )),
  workflow_status text not null default 'draft' check (workflow_status in (
    'draft','in_review','approved','rejected','closed'
  )),
  conclusion_summary text,
  evidence_reference text,
  evidence_file_id uuid references public.evidence_files(id) on delete set null,
  governance_review_id uuid references public.governance_linkage_reviews(id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete restrict,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, assessment_code),
  check (assessment_period_end is null or assessment_period_start is null or assessment_period_end >= assessment_period_start),
  check ((workflow_status = 'approved' and approved_by is not null and approved_at is not null) or workflow_status <> 'approved')
);

create table if not exists public.compliance_findings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  assessment_id uuid not null references public.compliance_assessments(id) on delete restrict,
  obligation_id uuid not null references public.compliance_obligations(id) on delete restrict,
  finding_code text not null,
  finding_description text not null,
  severity text not null default 'medium' check (severity in ('low','medium','high','critical')),
  materiality text check (materiality is null or materiality in ('minor','moderate','major','material')),
  finding_status text not null default 'open' check (finding_status in (
    'open','remediation_planned','remediation_in_progress','resolved','accepted_risk','closed'
  )),
  responsible_owner_id uuid references public.profiles(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  due_date date,
  evidence_reference text,
  evidence_file_id uuid references public.evidence_files(id) on delete set null,
  root_cause_category text,
  root_cause_description text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  closed_by uuid references public.profiles(id) on delete set null,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, finding_code),
  check ((finding_status = 'closed' and closed_by is not null and closed_at is not null) or finding_status <> 'closed')
);

create table if not exists public.compliance_remediation_actions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  finding_id uuid not null references public.compliance_findings(id) on delete restrict,
  action_code text not null,
  action_description text not null,
  owner_id uuid references public.profiles(id) on delete set null,
  due_date date,
  action_status text not null default 'planned' check (action_status in (
    'planned','in_progress','blocked','completed','verified','cancelled'
  )),
  evidence_reference text,
  evidence_file_id uuid references public.evidence_files(id) on delete set null,
  completed_by uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, action_code),
  check ((action_status in ('completed','verified') and completed_by is not null and completed_at is not null) or action_status not in ('completed','verified'))
);

create table if not exists public.compliance_workflow_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  assessment_id uuid references public.compliance_assessments(id) on delete restrict,
  finding_id uuid references public.compliance_findings(id) on delete restrict,
  remediation_action_id uuid references public.compliance_remediation_actions(id) on delete restrict,
  event_type text not null check (event_type in (
    'assessment_created','assessment_submitted','assessment_approved','assessment_rejected',
    'finding_recorded','finding_status_changed','remediation_created','remediation_status_changed'
  )),
  from_status text,
  to_status text,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  event_note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (assessment_id is not null or finding_id is not null or remediation_action_id is not null),
  check (jsonb_typeof(metadata) = 'object')
);

create index if not exists idx_ui3_compliance_assessments_obligation
  on public.compliance_assessments(organization_id, obligation_id, assessment_date desc);
create index if not exists idx_ui3_compliance_assessments_owner
  on public.compliance_assessments(responsible_owner_id, workflow_status);
create index if not exists idx_ui3_compliance_findings_assessment
  on public.compliance_findings(assessment_id, finding_status, due_date);
create index if not exists idx_ui3_compliance_findings_owner
  on public.compliance_findings(responsible_owner_id, finding_status, due_date);
create index if not exists idx_ui3_compliance_remediation_finding
  on public.compliance_remediation_actions(finding_id, action_status, due_date);
create index if not exists idx_ui3_compliance_events_assessment
  on public.compliance_workflow_events(assessment_id, created_at desc);

-- Existing compliance_items are legacy obligation records. Canonicalize real
-- records into the migration-52 obligation table without introducing seed data.
insert into public.compliance_obligations (
  id, organization_id, obligation_code, regulatory_body, framework, clause_reference,
  title, requirement_text, applicability, owner_id, department_id, risk_level,
  status, review_frequency, last_reviewed_at, next_review_date, evidence_required,
  notes, created_by, updated_by, created_at, updated_at
)
select
  c.id, c.organization_id, coalesce(c.obligation_code, c.compliance_code),
  coalesce(c.regulator_name, c.regulatory_body), c.standard_reference,
  coalesce(c.clause_reference, c.standard_clause),
  coalesce(c.obligation_title, c.title),
  coalesce(c.obligation_description, c.description, c.title),
  case when c.status::text = 'cancelled' then 'not_applicable' else 'applicable' end,
  coalesce(c.obligation_owner_id, c.owner_id), c.department_id, c.risk_level,
  c.status,
  case lower(coalesce(c.review_frequency, ''))
    when 'daily' then 'daily'::public.control_frequency
    when 'weekly' then 'weekly'::public.control_frequency
    when 'monthly' then 'monthly'::public.control_frequency
    when 'quarterly' then 'quarterly'::public.control_frequency
    when 'semiannual' then 'semi_annual'::public.control_frequency
    when 'semi_annual' then 'semi_annual'::public.control_frequency
    when 'annual' then 'annual'::public.control_frequency
    when 'ad_hoc' then 'ad_hoc'::public.control_frequency
    when 'continuous' then 'continuous'::public.control_frequency
    else 'annual'::public.control_frequency
  end,
  c.last_reviewed_at, coalesce(c.next_review_date, c.next_due_date), c.evidence_required,
  c.notes, c.created_by, c.updated_by, c.created_at, c.updated_at
from public.compliance_items c
where not exists (select 1 from public.compliance_obligations o where o.id = c.id)
  and not exists (
    select 1 from public.compliance_obligations o
    where o.organization_id = c.organization_id
      and o.obligation_code is not distinct from coalesce(c.obligation_code, c.compliance_code)
  );

create or replace function public.ui3_validate_compliance_finding()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare v_assessment public.compliance_assessments%rowtype;
begin
  select * into v_assessment from public.compliance_assessments where id = new.assessment_id;
  if not found then raise exception 'UI3_COMPLIANCE_ASSESSMENT_NOT_FOUND'; end if;
  if v_assessment.organization_id is distinct from new.organization_id
     or v_assessment.obligation_id is distinct from new.obligation_id then
    raise exception 'UI3_COMPLIANCE_FINDING_CONTEXT_MISMATCH';
  end if;
  if v_assessment.result not in ('partial_compliance','noncompliant','insufficient_evidence') then
    raise exception 'UI3_COMPLIANCE_FINDING_RESULT_REQUIRED';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ui3_validate_compliance_finding on public.compliance_findings;
create trigger trg_ui3_validate_compliance_finding
before insert or update of organization_id, assessment_id, obligation_id
on public.compliance_findings for each row execute function public.ui3_validate_compliance_finding();

create or replace function public.ui3_validate_compliance_remediation()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare v_org uuid;
begin
  select organization_id into v_org from public.compliance_findings where id = new.finding_id;
  if v_org is null then raise exception 'UI3_COMPLIANCE_FINDING_NOT_FOUND'; end if;
  if v_org is distinct from new.organization_id then raise exception 'UI3_COMPLIANCE_REMEDIATION_CONTEXT_MISMATCH'; end if;
  return new;
end;
$$;

drop trigger if exists trg_ui3_validate_compliance_remediation on public.compliance_remediation_actions;
create trigger trg_ui3_validate_compliance_remediation
before insert or update of organization_id, finding_id
on public.compliance_remediation_actions for each row execute function public.ui3_validate_compliance_remediation();

drop trigger if exists trg_ui3_compliance_assessments_updated_at on public.compliance_assessments;
create trigger trg_ui3_compliance_assessments_updated_at before update on public.compliance_assessments
for each row execute function public.set_updated_at();
drop trigger if exists trg_ui3_compliance_findings_updated_at on public.compliance_findings;
create trigger trg_ui3_compliance_findings_updated_at before update on public.compliance_findings
for each row execute function public.set_updated_at();
drop trigger if exists trg_ui3_compliance_remediation_updated_at on public.compliance_remediation_actions;
create trigger trg_ui3_compliance_remediation_updated_at before update on public.compliance_remediation_actions
for each row execute function public.set_updated_at();

create or replace function public.ui3_reject_compliance_event_mutation()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin raise exception 'UI3_COMPLIANCE_EVENT_HISTORY_IMMUTABLE'; end;
$$;
drop trigger if exists trg_ui3_compliance_events_immutable on public.compliance_workflow_events;
create trigger trg_ui3_compliance_events_immutable before update or delete on public.compliance_workflow_events
for each row execute function public.ui3_reject_compliance_event_mutation();

-- ---------------------------------------------------------------------------
-- 3. RLS and security-invoker reads
-- ---------------------------------------------------------------------------
alter table public.compliance_assessments enable row level security;
alter table public.compliance_findings enable row level security;
alter table public.compliance_remediation_actions enable row level security;
alter table public.compliance_workflow_events enable row level security;

drop policy if exists compliance_assessments_read_ui3 on public.compliance_assessments;
create policy compliance_assessments_read_ui3 on public.compliance_assessments
for select to authenticated using (
  responsible_owner_id = auth.uid() or reviewer_id = auth.uid() or created_by = auth.uid()
  or public.can_access_scope(organization_id, null, department_id, null)
  or public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer']::public.app_role[])
);

drop policy if exists compliance_findings_read_ui3 on public.compliance_findings;
create policy compliance_findings_read_ui3 on public.compliance_findings
for select to authenticated using (
  responsible_owner_id = auth.uid() or created_by = auth.uid() or reviewed_by = auth.uid()
  or public.can_access_scope(organization_id, null, department_id, null)
  or public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer']::public.app_role[])
);

drop policy if exists compliance_remediation_read_ui3 on public.compliance_remediation_actions;
create policy compliance_remediation_read_ui3 on public.compliance_remediation_actions
for select to authenticated using (
  owner_id = auth.uid() or created_by = auth.uid()
  or exists (select 1 from public.compliance_findings f where f.id = finding_id)
);

drop policy if exists compliance_workflow_events_read_ui3 on public.compliance_workflow_events;
create policy compliance_workflow_events_read_ui3 on public.compliance_workflow_events
for select to authenticated using (
  organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
  and (
    (assessment_id is not null and exists (select 1 from public.compliance_assessments a where a.id = assessment_id))
    or (finding_id is not null and exists (select 1 from public.compliance_findings f where f.id = finding_id))
    or (remediation_action_id is not null and exists (select 1 from public.compliance_remediation_actions r where r.id = remediation_action_id))
  )
);

revoke all on table public.compliance_assessments from public, anon, authenticated;
revoke all on table public.compliance_findings from public, anon, authenticated;
revoke all on table public.compliance_remediation_actions from public, anon, authenticated;
revoke all on table public.compliance_workflow_events from public, anon, authenticated;
grant select on table public.compliance_assessments to authenticated, service_role;
grant select on table public.compliance_findings to authenticated, service_role;
grant select on table public.compliance_remediation_actions to authenticated, service_role;
grant select on table public.compliance_workflow_events to authenticated, service_role;
grant insert, update, delete on table public.compliance_assessments to service_role;
grant insert, update, delete on table public.compliance_findings to service_role;
grant insert, update, delete on table public.compliance_remediation_actions to service_role;
grant insert on table public.compliance_workflow_events to service_role;

create or replace view public.v_ui3_compliance_obligation_register
with (security_invoker = true)
as
select
  o.*,
  latest.id as latest_assessment_id,
  latest.assessment_code as latest_assessment_code,
  latest.assessment_date as latest_assessment_date,
  latest.result as latest_assessment_result,
  latest.workflow_status as latest_assessment_status,
  coalesce(count(distinct f.id) filter (where f.finding_status not in ('resolved','closed')), 0)::integer as open_finding_count,
  coalesce(count(distinct r.id) filter (where r.action_status not in ('completed','verified','cancelled')), 0)::integer as open_remediation_count,
  coalesce(bool_or(r.due_date < current_date and r.action_status not in ('completed','verified','cancelled')), false) as has_overdue_remediation
from public.compliance_obligations o
left join lateral (
  select a.* from public.compliance_assessments a
  where a.obligation_id = o.id
  order by a.assessment_date desc, a.created_at desc, a.id desc limit 1
) latest on true
left join public.compliance_findings f on f.obligation_id = o.id
left join public.compliance_remediation_actions r on r.finding_id = f.id
group by o.id, latest.id, latest.assessment_code, latest.assessment_date, latest.result, latest.workflow_status;

revoke all on public.v_ui3_compliance_obligation_register from public, anon;
grant select on public.v_ui3_compliance_obligation_register to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. GOV-LINK source extension for canonical Compliance assessments
-- ---------------------------------------------------------------------------
alter table public.governance_linkage_reviews
  drop constraint if exists governance_linkage_reviews_source_entity_type_check;
alter table public.governance_linkage_reviews
  drop constraint if exists governance_linkage_reviews_source_entity_type_ui3_check;
alter table public.governance_linkage_reviews
  add constraint governance_linkage_reviews_source_entity_type_ui3_check
  check (source_entity_type in ('ovr','risk','audit_finding','capa','compliance_assessment'));

alter table public.governance_criteria_links
  drop constraint if exists governance_criteria_links_source_entity_type_check;
alter table public.governance_criteria_links
  drop constraint if exists governance_criteria_links_root_source_entity_type_check;
alter table public.governance_criteria_links
  drop constraint if exists governance_criteria_links_source_entity_type_ui3_check;
alter table public.governance_criteria_links
  drop constraint if exists governance_criteria_links_root_source_entity_type_ui3_check;
alter table public.governance_criteria_links
  add constraint governance_criteria_links_source_entity_type_ui3_check
  check (source_entity_type in ('ovr','risk','audit_finding','capa','compliance_assessment'));
alter table public.governance_criteria_links
  add constraint governance_criteria_links_root_source_entity_type_ui3_check
  check (root_source_entity_type in ('ovr','risk','audit_finding','capa','compliance_assessment'));

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
  elsif p_source_entity_type = 'compliance_assessment' then
    select department_id into v_department_id from public.compliance_assessments
      where id = p_source_entity_id and organization_id = p_organization_id;
    if exists (
      select 1 from public.compliance_assessments a where a.id = p_source_entity_id
        and p_actor_id in (a.responsible_owner_id, a.reviewer_id, a.created_by, a.reviewed_by, a.approved_by)
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

create or replace function public.governance_linkage_source_readable(
  p_organization_id uuid,
  p_source_entity_type text,
  p_source_entity_id uuid
)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select (
    coalesce(current_setting('request.jwt.claim.role', true), current_user) = 'service_role'
    or p_organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
  ) and case p_source_entity_type
    when 'ovr' then exists (select 1 from public.ovr_reports x where x.id = p_source_entity_id and x.organization_id = p_organization_id)
    when 'risk' then exists (select 1 from public.risks x where x.id = p_source_entity_id and x.organization_id = p_organization_id)
    when 'compliance_assessment' then exists (
      select 1 from public.compliance_assessments x
      where x.id = p_source_entity_id and x.organization_id = p_organization_id
        and (coalesce(current_setting('request.jwt.claim.role', true), current_user) = 'service_role'
          or x.responsible_owner_id = auth.uid() or x.reviewer_id = auth.uid() or x.created_by = auth.uid()
          or public.can_access_scope(x.organization_id, null, x.department_id, null)
          or public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer']::public.app_role[]))
    )
    when 'audit_finding' then exists (select 1 from public.audit_findings x where x.id = p_source_entity_id and x.organization_id = p_organization_id)
    when 'capa' then exists (select 1 from public.capa_action_plans x where x.id = p_source_entity_id and x.organization_id = p_organization_id)
    else false end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Governed UI-3 workflow bridge and High/Critical Risk gate
-- ---------------------------------------------------------------------------
create or replace function public.ui3_write_compliance_event(
  p_organization_id uuid,
  p_assessment_id uuid,
  p_finding_id uuid,
  p_remediation_action_id uuid,
  p_event_type text,
  p_from_status text,
  p_to_status text,
  p_actor_id uuid,
  p_note text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  insert into public.compliance_workflow_events (
    organization_id, assessment_id, finding_id, remediation_action_id, event_type,
    from_status, to_status, actor_id, event_note, metadata
  ) values (
    p_organization_id, p_assessment_id, p_finding_id, p_remediation_action_id, p_event_type,
    p_from_status, p_to_status, p_actor_id, nullif(btrim(coalesce(p_note, '')), ''), coalesce(p_metadata, '{}'::jsonb)
  ) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.ui3_risk_governance_review_complete(p_risk_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.governance_linkage_reviews r
    where r.source_entity_type = 'risk' and r.source_entity_id = p_risk_id
      and r.review_status = 'completed'
      and r.review_outcome in ('confirmed_relationship','related_not_violated','no_applicable_document','document_gap','insufficient_evidence')
      and length(btrim(coalesce(r.review_rationale, ''))) >= 3
  );
$$;

create or replace function public.ui3_enforce_risk_governance_gate()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.risk_level in ('high','critical')
     and new.status::text in ('accepted','closed')
     and new.status is distinct from old.status
     and not public.ui3_risk_governance_review_complete(new.id) then
    raise exception 'UI3_RISK_GOVERNANCE_REVIEW_REQUIRED';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ui3_risk_governance_gate on public.risks;
create trigger trg_ui3_risk_governance_gate
before update of status on public.risks
for each row execute function public.ui3_enforce_risk_governance_gate();

create or replace function public.ui3_risk_compliance_workflow_bridge(
  p_actor_id uuid,
  p_action text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_actor public.profiles%rowtype;
  v_action text := lower(coalesce(p_action, ''));
  v_obligation public.compliance_obligations%rowtype;
  v_assessment public.compliance_assessments%rowtype;
  v_finding public.compliance_findings%rowtype;
  v_remediation public.compliance_remediation_actions%rowtype;
  v_history public.risk_reassessment_history%rowtype;
  v_risk public.risks%rowtype;
  v_id uuid;
  v_code text;
  v_status text;
  v_note text := nullif(btrim(coalesce(p_payload->>'rationale', p_payload->>'note', '')), '');
  v_can_manage_compliance boolean := false;
  v_can_review_risk boolean := false;
begin
  perform public.governance_linkage_require_service_role();
  select * into v_actor from public.profiles where id = p_actor_id and is_active = true and user_status::text = 'active';
  if not found or v_actor.organization_id is null then raise exception 'UI3_ACTIVE_ACTOR_REQUIRED'; end if;

  select exists (
    select 1 from public.user_roles ur where ur.user_id = p_actor_id and ur.is_active
      and ur.organization_id = v_actor.organization_id
      and ur.role::text in ('super_admin','executive','governance_admin','compliance_officer','department_manager','auditor')
  ) into v_can_manage_compliance;
  select exists (
    select 1 from public.user_roles ur where ur.user_id = p_actor_id and ur.is_active
      and ur.organization_id = v_actor.organization_id
      and ur.role::text in ('super_admin','executive','governance_admin','division_head','department_manager','compliance_officer')
  ) into v_can_review_risk;

  if v_action = 'create_compliance_obligation' then
    if not v_can_manage_compliance then raise exception 'UI3_COMPLIANCE_AUTHORITY_REQUIRED'; end if;
    if length(btrim(coalesce(p_payload->>'title', ''))) < 3 or length(btrim(coalesce(p_payload->>'requirement_text', ''))) < 3 then
      raise exception 'UI3_COMPLIANCE_OBLIGATION_DETAILS_REQUIRED';
    end if;
    v_code := coalesce(nullif(btrim(p_payload->>'obligation_code'), ''), 'OBL-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)));
    insert into public.compliance_obligations (
      organization_id, obligation_code, regulatory_body, framework, clause_reference, title,
      requirement_text, applicability, owner_id, department_id, risk_level, status,
      review_frequency, next_review_date, evidence_required, notes, created_by, updated_by
    ) values (
      v_actor.organization_id, v_code, nullif(p_payload->>'regulatory_body',''), nullif(p_payload->>'framework',''),
      nullif(p_payload->>'clause_reference',''), btrim(p_payload->>'title'), btrim(p_payload->>'requirement_text'),
      coalesce(nullif(p_payload->>'applicability',''), 'applicable'), nullif(p_payload->>'owner_id','')::uuid,
      nullif(p_payload->>'department_id','')::uuid, coalesce(nullif(p_payload->>'risk_level','')::public.risk_level, 'medium'::public.risk_level),
      'not_started'::public.compliance_status, coalesce(nullif(p_payload->>'review_frequency','')::public.control_frequency, 'annual'::public.control_frequency),
      nullif(p_payload->>'next_review_date','')::date, coalesce((p_payload->>'evidence_required')::boolean, true),
      nullif(p_payload->>'notes',''), p_actor_id, p_actor_id
    ) returning id into v_id;
    return jsonb_build_object('id', v_id, 'obligation_code', v_code, 'status', 'not_started');

  elsif v_action = 'create_compliance_assessment' then
    if not v_can_manage_compliance then raise exception 'UI3_COMPLIANCE_AUTHORITY_REQUIRED'; end if;
    select * into v_obligation from public.compliance_obligations where id = nullif(p_payload->>'obligation_id','')::uuid;
    if not found then raise exception 'UI3_COMPLIANCE_OBLIGATION_NOT_FOUND'; end if;
    if v_obligation.organization_id is distinct from v_actor.organization_id then raise exception 'UI3_COMPLIANCE_CROSS_ORGANIZATION_DENIED'; end if;
    v_code := coalesce(nullif(btrim(p_payload->>'assessment_code'), ''), 'ASM-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)));
    insert into public.compliance_assessments (
      organization_id, obligation_id, assessment_code, assessment_title, assessment_period_start,
      assessment_period_end, assessment_date, assessment_method, scope_description, department_id,
      responsible_owner_id, reviewer_id, result, workflow_status, conclusion_summary,
      evidence_reference, evidence_file_id, created_by
    ) values (
      v_actor.organization_id, v_obligation.id, v_code,
      coalesce(nullif(btrim(p_payload->>'assessment_title'), ''), v_obligation.title || ' assessment'),
      nullif(p_payload->>'assessment_period_start','')::date, nullif(p_payload->>'assessment_period_end','')::date,
      coalesce(nullif(p_payload->>'assessment_date','')::date, current_date), nullif(p_payload->>'assessment_method',''),
      nullif(p_payload->>'scope_description',''), coalesce(nullif(p_payload->>'department_id','')::uuid, v_obligation.department_id),
      coalesce(nullif(p_payload->>'responsible_owner_id','')::uuid, v_obligation.owner_id, p_actor_id),
      nullif(p_payload->>'reviewer_id','')::uuid,
      coalesce(nullif(p_payload->>'result',''), 'not_assessed'), 'draft', nullif(p_payload->>'conclusion_summary',''),
      nullif(p_payload->>'evidence_reference',''), nullif(p_payload->>'evidence_file_id','')::uuid, p_actor_id
    ) returning id into v_id;
    perform public.ui3_write_compliance_event(v_actor.organization_id, v_id, null, null, 'assessment_created', null, 'draft', p_actor_id, v_note);
    return jsonb_build_object('id', v_id, 'assessment_code', v_code, 'status', 'draft');

  elsif v_action in ('submit_compliance_assessment','approve_compliance_assessment','reject_compliance_assessment') then
    select * into v_assessment from public.compliance_assessments where id = nullif(p_payload->>'assessment_id','')::uuid for update;
    if not found then raise exception 'UI3_COMPLIANCE_ASSESSMENT_NOT_FOUND'; end if;
    if v_assessment.organization_id is distinct from v_actor.organization_id then raise exception 'UI3_COMPLIANCE_CROSS_ORGANIZATION_DENIED'; end if;
    if not (v_can_manage_compliance or p_actor_id in (v_assessment.responsible_owner_id, v_assessment.reviewer_id, v_assessment.created_by)) then
      raise exception 'UI3_COMPLIANCE_AUTHORITY_REQUIRED';
    end if;
    if v_action <> 'submit_compliance_assessment' and length(coalesce(v_note,'')) < 3 then raise exception 'UI3_COMPLIANCE_DECISION_RATIONALE_REQUIRED'; end if;
    v_status := case v_action when 'submit_compliance_assessment' then 'in_review' when 'approve_compliance_assessment' then 'approved' else 'rejected' end;
    update public.compliance_assessments set workflow_status = v_status,
      reviewed_by = case when v_action <> 'submit_compliance_assessment' then p_actor_id else reviewed_by end,
      reviewed_at = case when v_action <> 'submit_compliance_assessment' then now() else reviewed_at end,
      approved_by = case when v_action = 'approve_compliance_assessment' then p_actor_id else approved_by end,
      approved_at = case when v_action = 'approve_compliance_assessment' then now() else approved_at end,
      conclusion_summary = coalesce(nullif(p_payload->>'conclusion_summary',''), conclusion_summary)
    where id = v_assessment.id;
    perform public.ui3_write_compliance_event(v_assessment.organization_id, v_assessment.id, null, null,
      case v_action when 'submit_compliance_assessment' then 'assessment_submitted' when 'approve_compliance_assessment' then 'assessment_approved' else 'assessment_rejected' end,
      v_assessment.workflow_status, v_status, p_actor_id, v_note);
    return jsonb_build_object('id', v_assessment.id, 'status', v_status);

  elsif v_action = 'record_compliance_finding' then
    if not v_can_manage_compliance then raise exception 'UI3_COMPLIANCE_AUTHORITY_REQUIRED'; end if;
    select * into v_assessment from public.compliance_assessments where id = nullif(p_payload->>'assessment_id','')::uuid;
    if not found then raise exception 'UI3_COMPLIANCE_ASSESSMENT_NOT_FOUND'; end if;
    if v_assessment.organization_id is distinct from v_actor.organization_id then raise exception 'UI3_COMPLIANCE_CROSS_ORGANIZATION_DENIED'; end if;
    v_code := coalesce(nullif(btrim(p_payload->>'finding_code'), ''), 'FND-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)));
    insert into public.compliance_findings (
      organization_id, assessment_id, obligation_id, finding_code, finding_description,
      severity, materiality, responsible_owner_id, department_id, due_date,
      evidence_reference, evidence_file_id, root_cause_category, root_cause_description, created_by
    ) values (
      v_assessment.organization_id, v_assessment.id, v_assessment.obligation_id, v_code,
      btrim(p_payload->>'finding_description'), coalesce(nullif(p_payload->>'severity',''),'medium'),
      nullif(p_payload->>'materiality',''), coalesce(nullif(p_payload->>'responsible_owner_id','')::uuid, v_assessment.responsible_owner_id, p_actor_id),
      coalesce(nullif(p_payload->>'department_id','')::uuid, v_assessment.department_id), nullif(p_payload->>'due_date','')::date,
      nullif(p_payload->>'evidence_reference',''), nullif(p_payload->>'evidence_file_id','')::uuid,
      nullif(p_payload->>'root_cause_category',''), nullif(p_payload->>'root_cause_description',''), p_actor_id
    ) returning id into v_id;
    perform public.ui3_write_compliance_event(v_assessment.organization_id, v_assessment.id, v_id, null, 'finding_recorded', null, 'open', p_actor_id, v_note);
    return jsonb_build_object('id', v_id, 'finding_code', v_code, 'status', 'open');

  elsif v_action = 'create_compliance_remediation' then
    if not v_can_manage_compliance then raise exception 'UI3_COMPLIANCE_AUTHORITY_REQUIRED'; end if;
    select * into v_finding from public.compliance_findings where id = nullif(p_payload->>'finding_id','')::uuid;
    if not found then raise exception 'UI3_COMPLIANCE_FINDING_NOT_FOUND'; end if;
    if v_finding.organization_id is distinct from v_actor.organization_id then raise exception 'UI3_COMPLIANCE_CROSS_ORGANIZATION_DENIED'; end if;
    v_code := coalesce(nullif(btrim(p_payload->>'action_code'), ''), 'REM-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)));
    insert into public.compliance_remediation_actions (
      organization_id, finding_id, action_code, action_description, owner_id, due_date,
      action_status, evidence_reference, evidence_file_id, created_by
    ) values (
      v_finding.organization_id, v_finding.id, v_code, btrim(p_payload->>'action_description'),
      coalesce(nullif(p_payload->>'owner_id','')::uuid, v_finding.responsible_owner_id, p_actor_id),
      nullif(p_payload->>'due_date','')::date, coalesce(nullif(p_payload->>'action_status',''),'planned'),
      nullif(p_payload->>'evidence_reference',''), nullif(p_payload->>'evidence_file_id','')::uuid, p_actor_id
    ) returning id into v_id;
    update public.compliance_findings set finding_status = 'remediation_planned' where id = v_finding.id and finding_status = 'open';
    perform public.ui3_write_compliance_event(v_finding.organization_id, v_finding.assessment_id, v_finding.id, v_id, 'remediation_created', null, 'planned', p_actor_id, v_note);
    return jsonb_build_object('id', v_id, 'action_code', v_code, 'status', 'planned');

  elsif v_action = 'update_compliance_remediation' then
    select * into v_remediation from public.compliance_remediation_actions where id = nullif(p_payload->>'remediation_action_id','')::uuid for update;
    if not found then raise exception 'UI3_COMPLIANCE_REMEDIATION_NOT_FOUND'; end if;
    if v_remediation.organization_id is distinct from v_actor.organization_id then raise exception 'UI3_COMPLIANCE_CROSS_ORGANIZATION_DENIED'; end if;
    if not (v_can_manage_compliance or v_remediation.owner_id = p_actor_id) then raise exception 'UI3_COMPLIANCE_AUTHORITY_REQUIRED'; end if;
    v_status := coalesce(nullif(p_payload->>'action_status',''), v_remediation.action_status);
    update public.compliance_remediation_actions set action_status = v_status,
      evidence_reference = coalesce(nullif(p_payload->>'evidence_reference',''), evidence_reference),
      evidence_file_id = coalesce(nullif(p_payload->>'evidence_file_id','')::uuid, evidence_file_id),
      completed_by = case when v_status in ('completed','verified') then p_actor_id else completed_by end,
      completed_at = case when v_status in ('completed','verified') then now() else completed_at end
    where id = v_remediation.id;
    select * into v_finding from public.compliance_findings where id = v_remediation.finding_id;
    perform public.ui3_write_compliance_event(v_remediation.organization_id, v_finding.assessment_id, v_finding.id, v_remediation.id,
      'remediation_status_changed', v_remediation.action_status, v_status, p_actor_id, v_note);
    return jsonb_build_object('id', v_remediation.id, 'status', v_status);

  elsif v_action in ('approve_risk_reassessment','reject_risk_reassessment') then
    if not v_can_review_risk then raise exception 'UI3_RISK_REVIEW_AUTHORITY_REQUIRED'; end if;
    if length(coalesce(v_note,'')) < 3 then raise exception 'UI3_RISK_REVIEW_RATIONALE_REQUIRED'; end if;
    select * into v_history from public.risk_reassessment_history where id = nullif(p_payload->>'reassessment_id','')::uuid for update;
    if not found then raise exception 'UI3_RISK_REASSESSMENT_NOT_FOUND'; end if;
    select * into v_risk from public.risks where id = v_history.risk_id;
    if v_risk.organization_id is distinct from v_actor.organization_id then raise exception 'UI3_RISK_CROSS_ORGANIZATION_DENIED'; end if;
    if v_action = 'approve_risk_reassessment' and v_risk.risk_level in ('high', 'critical') then
      if not exists (
        select 1 from public.governance_linkage_reviews r
        where r.id = nullif(p_payload->>'governance_review_id','')::uuid
          and r.organization_id = v_history.organization_id and r.source_entity_type = 'risk'
          and r.source_entity_id = v_history.risk_id and r.source_revision_id = v_history.id
          and r.review_status = 'completed'
      ) then raise exception 'UI3_RISK_REASSESSMENT_GOVERNANCE_REVIEW_REQUIRED'; end if;
    end if;
    v_status := case when v_action = 'approve_risk_reassessment' then 'approved' else 'rejected' end;
    update public.risk_reassessment_history set assessment_status = v_status,
      governance_review_id = case when v_action = 'approve_risk_reassessment' then nullif(p_payload->>'governance_review_id','')::uuid else governance_review_id end,
      reviewed_by = p_actor_id, reviewed_at = now(), review_rationale = v_note
    where id = v_history.id;
    return jsonb_build_object('id', v_history.id, 'status', v_status);
  else
    raise exception 'UI3_UNSUPPORTED_ACTION';
  end if;
end;
$$;

revoke all on function public.ui3_validate_compliance_finding() from public, anon, authenticated, service_role;
revoke all on function public.ui3_validate_compliance_remediation() from public, anon, authenticated, service_role;
revoke all on function public.ui3_reject_compliance_event_mutation() from public, anon, authenticated, service_role;
revoke all on function public.governance_linkage_source_context(text, uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.governance_linkage_actor_authorized(uuid, uuid, text, uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.resolve_governance_document_version_candidates(uuid, uuid, date, uuid) from public, anon, authenticated;
revoke all on function public.governance_linkage_source_readable(uuid, text, uuid) from public, anon, authenticated, service_role;
revoke all on function public.governance_linkage_target_readable(uuid, text, uuid, uuid, uuid, uuid, uuid, uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.ui3_write_compliance_event(uuid, uuid, uuid, uuid, text, text, text, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.ui3_risk_governance_review_complete(uuid) from public, anon, authenticated;
revoke all on function public.ui3_enforce_risk_governance_gate() from public, anon, authenticated, service_role;
revoke all on function public.ui3_risk_compliance_workflow_bridge(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.ui3_write_compliance_event(uuid, uuid, uuid, uuid, text, text, text, uuid, text, jsonb) to service_role;
grant execute on function public.ui3_risk_governance_review_complete(uuid) to service_role;
grant execute on function public.ui3_risk_compliance_workflow_bridge(uuid, text, jsonb) to service_role;
grant execute on function public.resolve_governance_document_version_candidates(uuid, uuid, date, uuid) to service_role;
grant execute on function public.governance_linkage_source_readable(uuid, text, uuid) to authenticated, service_role;
grant execute on function public.governance_linkage_target_readable(uuid, text, uuid, uuid, uuid, uuid, uuid, uuid, uuid) to authenticated, service_role;

create or replace function public.get_governance_criteria_linkage_capabilities()
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'contract_version', 'governance-criteria-linkage-v1',
    'schema_version', 213,
    'review_available', true,
    'suggestion_available', true,
    'decision_available', true,
    'supersession_available', true,
    'completion_available', true,
    'compliance_assessment_source_available', true,
    'facility_scope_available', false
  );
$$;

revoke all on function public.get_governance_criteria_linkage_capabilities() from public, anon, authenticated;
grant execute on function public.get_governance_criteria_linkage_capabilities() to service_role;

comment on table public.compliance_assessments is 'UI-3 canonical assessment of compliance status against one governed obligation.';
comment on table public.compliance_findings is 'UI-3 canonical observed gap produced by a non-passing compliance assessment; it is not the obligation itself.';
comment on table public.compliance_remediation_actions is 'UI-3 remediation context for a compliance finding; CAPA remains a separate later-phase object.';
comment on table public.compliance_workflow_events is 'UI-3 append-only compliance assessment, finding, and remediation activity history.';
comment on function public.ui3_risk_compliance_workflow_bridge(uuid, text, jsonb) is 'UI-3 service-role workflow bridge. Browser code must use authenticated privileged-action.';
