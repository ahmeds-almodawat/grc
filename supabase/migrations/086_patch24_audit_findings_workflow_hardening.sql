-- =========================================================
-- Patch 24: Audit Findings Workflow Hardening
-- Additive lifecycle, response, CAPA, evidence, validation, escalation and closure-pack governance.
-- =========================================================

alter table public.audit_findings
  add column if not exists finding_status text not null default 'issued',
  add column if not exists workflow_stage text not null default 'management_response',
  add column if not exists severity_level text not null default 'medium',
  add column if not exists finding_owner_id uuid references public.profiles(id) on delete set null,
  add column if not exists audit_manager_id uuid references public.profiles(id) on delete set null,
  add column if not exists responsible_department_id uuid references public.departments(id) on delete set null,
  add column if not exists responsible_owner_id uuid references public.profiles(id) on delete set null,
  add column if not exists corrective_action_owner_id uuid references public.profiles(id) on delete set null,
  add column if not exists executive_sponsor_id uuid references public.profiles(id) on delete set null,
  add column if not exists original_due_date date,
  add column if not exists revised_due_date date,
  add column if not exists reopened_at timestamptz,
  add column if not exists reopened_by uuid references public.profiles(id) on delete set null,
  add column if not exists reopen_reason text,
  add column if not exists management_response_required boolean not null default true,
  add column if not exists management_response_due_date date,
  add column if not exists management_response_submitted_by uuid references public.profiles(id) on delete set null,
  add column if not exists management_response_submitted_at timestamptz,
  add column if not exists management_response_status text not null default 'required',
  add column if not exists management_response_rejection_reason text,
  add column if not exists corrective_action_required boolean not null default true,
  add column if not exists corrective_action_plan text,
  add column if not exists corrective_action_due_date date,
  add column if not exists corrective_action_status text not null default 'required',
  add column if not exists corrective_action_completed_at timestamptz,
  add column if not exists corrective_action_completed_by uuid references public.profiles(id) on delete set null,
  add column if not exists corrective_action_rejection_reason text,
  add column if not exists root_cause_category text,
  add column if not exists root_cause_summary text,
  add column if not exists repeat_finding_flag boolean not null default false,
  add column if not exists repeat_of_finding_id uuid references public.audit_findings(id) on delete set null,
  add column if not exists recurrence_count integer not null default 0,
  add column if not exists recurrence_window_days integer not null default 365,
  add column if not exists systemic_issue_flag boolean not null default false,
  add column if not exists related_risk_id uuid references public.risks(id) on delete set null,
  add column if not exists related_compliance_id uuid references public.compliance_items(id) on delete set null,
  add column if not exists related_project_id uuid references public.projects(id) on delete set null,
  add column if not exists source_ovr_id uuid references public.ovr_reports(id) on delete set null,
  add column if not exists minimum_accepted_evidence_count integer not null default 1,
  add column if not exists evidence_gate_status text not null default 'pending',
  add column if not exists closure_requested_at timestamptz,
  add column if not exists closure_requested_by uuid references public.profiles(id) on delete set null,
  add column if not exists closure_validation_status text not null default 'not_requested',
  add column if not exists closure_validation_note text,
  add column if not exists closure_validated_by uuid references public.profiles(id) on delete set null,
  add column if not exists closure_validated_at timestamptz,
  add column if not exists closure_blocker text,
  add column if not exists closure_pack_generated_at timestamptz,
  add column if not exists closure_pack_reference text,
  add column if not exists escalation_required boolean not null default false,
  add column if not exists escalation_level text,
  add column if not exists escalated_at timestamptz,
  add column if not exists escalated_to uuid references public.profiles(id) on delete set null,
  add column if not exists escalation_reason text,
  add column if not exists executive_visible boolean not null default false,
  add column if not exists committee_review_required boolean not null default false,
  add column if not exists committee_review_status text not null default 'not_required',
  add column if not exists committee_review_note text;

update public.audit_findings
set
  finding_status = case
    when status::text = 'draft' then 'draft'
    when status::text = 'closed' then 'closed'
    when status::text = 'cancelled' then 'cancelled'
    when status::text = 'rejected' then 'returned_for_correction'
    when status::text = 'action_plan_submitted' then 'action_plan_in_progress'
    when status::text = 'evidence_submitted' then 'closure_requested'
    when status::text = 'under_audit_review' then 'auditor_validation'
    else coalesce(nullif(finding_status, ''), 'issued')
  end,
  workflow_stage = case
    when status::text = 'closed' then 'closed'
    when status::text = 'cancelled' then 'cancelled'
    when management_response is null or trim(management_response) = '' then 'management_response'
    when corrective_action_plan is null or trim(corrective_action_plan) = '' then 'action_plan'
    when evidence_required then 'evidence'
    else 'auditor_validation'
  end,
  severity_level = coalesce(nullif(severity_level, ''), risk_level::text, 'medium'),
  original_due_date = coalesce(original_due_date, due_date),
  finding_owner_id = coalesce(finding_owner_id, owner_id),
  audit_manager_id = coalesce(audit_manager_id, auditor_id),
  responsible_department_id = coalesce(responsible_department_id, department_id),
  responsible_owner_id = coalesce(responsible_owner_id, owner_id),
  management_response_status = case
    when management_response is not null and trim(management_response) <> '' then 'submitted'
    else coalesce(nullif(management_response_status, ''), 'required')
  end,
  corrective_action_status = case
    when corrective_action_plan is not null and trim(corrective_action_plan) <> '' then 'submitted'
    else coalesce(nullif(corrective_action_status, ''), 'required')
  end
where true;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'audit_findings_patch24_status_chk') then
    alter table public.audit_findings add constraint audit_findings_patch24_status_chk
      check (finding_status in ('draft','issued','management_response_required','management_response_submitted','action_plan_required','action_plan_in_progress','evidence_required','closure_requested','auditor_validation','returned_for_correction','escalated','closed','rejected','cancelled','reopened'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'audit_findings_patch24_stage_chk') then
    alter table public.audit_findings add constraint audit_findings_patch24_stage_chk
      check (workflow_stage in ('draft','management_response','management_response_review','action_plan','action_plan_review','evidence','closure_request','auditor_validation','correction','escalation','closed','cancelled','reopened'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'audit_findings_patch24_severity_chk') then
    alter table public.audit_findings add constraint audit_findings_patch24_severity_chk
      check (severity_level in ('low','medium','high','critical'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'audit_findings_patch24_response_status_chk') then
    alter table public.audit_findings add constraint audit_findings_patch24_response_status_chk
      check (management_response_status in ('not_required','required','submitted','accepted','rejected','overdue','waived'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'audit_findings_patch24_action_status_chk') then
    alter table public.audit_findings add constraint audit_findings_patch24_action_status_chk
      check (corrective_action_status in ('not_required','required','submitted','accepted','in_progress','completed','rejected','overdue'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'audit_findings_patch24_closure_validation_chk') then
    alter table public.audit_findings add constraint audit_findings_patch24_closure_validation_chk
      check (closure_validation_status in ('not_requested','requested','in_validation','accepted','rejected','blocked'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'audit_findings_patch24_evidence_gate_chk') then
    alter table public.audit_findings add constraint audit_findings_patch24_evidence_gate_chk
      check (evidence_gate_status in ('not_required','pending','partially_satisfied','satisfied','overdue','waived','blocked'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'audit_findings_patch24_min_evidence_chk') then
    alter table public.audit_findings add constraint audit_findings_patch24_min_evidence_chk
      check (minimum_accepted_evidence_count >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'audit_findings_patch24_recurrence_chk') then
    alter table public.audit_findings add constraint audit_findings_patch24_recurrence_chk
      check (recurrence_count >= 0 and recurrence_window_days > 0);
  end if;
end $$;

create table if not exists public.audit_finding_due_date_extensions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  audit_finding_id uuid not null references public.audit_findings(id) on delete cascade,
  previous_due_date date,
  requested_due_date date not null,
  extension_reason text not null,
  requested_by uuid references public.profiles(id) on delete set null,
  requested_at timestamptz not null default now(),
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  status text not null default 'requested' check (status in ('requested','approved','rejected','cancelled')),
  rejection_reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_finding_validation_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  audit_finding_id uuid not null references public.audit_findings(id) on delete cascade,
  validation_type text not null check (validation_type in (
    'finding_issued','management_response_submitted','management_response_accepted','management_response_rejected',
    'action_plan_submitted','action_plan_accepted','action_plan_rejected','evidence_submitted',
    'closure_requested','closure_accepted','closure_rejected','escalated','reopened',
    'due_date_extension_requested','due_date_extension_approved','due_date_extension_rejected',
    'repeat_marked','risk_linked','compliance_linked','closure_pack_generated'
  )),
  from_status text,
  to_status text,
  actor_id uuid references public.profiles(id) on delete set null,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_patch24_audit_findings_org on public.audit_findings(organization_id);
create index if not exists idx_patch24_audit_findings_status on public.audit_findings(finding_status);
create index if not exists idx_patch24_audit_findings_stage on public.audit_findings(workflow_stage);
create index if not exists idx_patch24_audit_findings_severity on public.audit_findings(severity_level);
create index if not exists idx_patch24_audit_findings_resp_dept on public.audit_findings(responsible_department_id);
create index if not exists idx_patch24_audit_findings_resp_owner on public.audit_findings(responsible_owner_id);
create index if not exists idx_patch24_audit_findings_capa_owner on public.audit_findings(corrective_action_owner_id);
create index if not exists idx_patch24_audit_findings_audit_manager on public.audit_findings(audit_manager_id);
create index if not exists idx_patch24_audit_findings_due on public.audit_findings(due_date);
create index if not exists idx_patch24_audit_findings_capa_due on public.audit_findings(corrective_action_due_date);
create index if not exists idx_patch24_audit_findings_evidence_gate on public.audit_findings(evidence_gate_status);
create index if not exists idx_patch24_audit_findings_closure_status on public.audit_findings(closure_validation_status);
create index if not exists idx_patch24_audit_findings_repeat on public.audit_findings(repeat_finding_flag);
create index if not exists idx_patch24_audit_findings_escalation on public.audit_findings(escalation_required);
create index if not exists idx_patch24_audit_findings_executive on public.audit_findings(executive_visible);
create index if not exists idx_patch24_extension_finding on public.audit_finding_due_date_extensions(audit_finding_id);
create index if not exists idx_patch24_extension_status on public.audit_finding_due_date_extensions(status);
create index if not exists idx_patch24_validation_finding on public.audit_finding_validation_events(audit_finding_id);
create index if not exists idx_patch24_validation_type on public.audit_finding_validation_events(validation_type);

alter table public.audit_finding_due_date_extensions enable row level security;
alter table public.audit_finding_validation_events enable row level security;

drop policy if exists audit_finding_due_date_extensions_read_patch24 on public.audit_finding_due_date_extensions;
create policy audit_finding_due_date_extensions_read_patch24 on public.audit_finding_due_date_extensions
for select to authenticated
using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists audit_finding_due_date_extensions_write_patch24 on public.audit_finding_due_date_extensions;
create policy audit_finding_due_date_extensions_write_patch24 on public.audit_finding_due_date_extensions
for insert to authenticated
with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists audit_finding_due_date_extensions_update_patch24 on public.audit_finding_due_date_extensions;
create policy audit_finding_due_date_extensions_update_patch24 on public.audit_finding_due_date_extensions
for update to authenticated
using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'))
with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists audit_finding_validation_events_read_patch24 on public.audit_finding_validation_events;
create policy audit_finding_validation_events_read_patch24 on public.audit_finding_validation_events
for select to authenticated
using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists audit_finding_validation_events_insert_patch24 on public.audit_finding_validation_events;
create policy audit_finding_validation_events_insert_patch24 on public.audit_finding_validation_events
for insert to authenticated
with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

create or replace view public.v_patch24_audit_closure_gate_status as
with accepted_evidence as (
  select
    af.id as audit_finding_id,
    count(distinct ef.id)::integer as accepted_evidence_count
  from public.audit_findings af
  join public.evidence_files ef on ef.organization_id = af.organization_id
  left join public.evidence_links el on el.evidence_file_id = ef.id and el.is_active = true
  where (
      ef.audit_finding_id = af.id
      or (el.linked_item_type = 'audit_finding' and el.linked_item_id = af.id)
    )
    and coalesce(ef.review_status::text, ef.status::text) = 'accepted'
    and coalesce(ef.is_current_version, true) = true
    and (ef.expiry_date is null or ef.expiry_date >= current_date)
  group by af.id
),
active_waivers as (
  select
    er.linked_item_id as audit_finding_id,
    count(distinct egw.id)::integer as approved_waiver_count,
    max(egw.approved_at) as waiver_approved_at
  from public.evidence_requirements er
  join public.evidence_gate_waivers egw on egw.requirement_id = er.id
  where er.linked_item_type = 'audit_finding'
    and er.is_active = true
    and egw.status = 'approved'
    and (egw.expiry_date is null or egw.expiry_date >= current_date)
  group by er.linked_item_id
)
select
  af.organization_id,
  af.id as audit_finding_id,
  af.finding_code,
  af.title,
  af.finding_status,
  af.workflow_stage,
  af.severity_level,
  af.evidence_required,
  af.minimum_accepted_evidence_count,
  coalesce(ae.accepted_evidence_count, 0)::integer as accepted_evidence_count,
  coalesce(aw.approved_waiver_count, 0)::integer as approved_waiver_count,
  aw.waiver_approved_at,
  case
    when coalesce(af.evidence_required, false) = false then 'not_required'
    when coalesce(ae.accepted_evidence_count, 0) >= coalesce(af.minimum_accepted_evidence_count, 1) then 'satisfied'
    when coalesce(aw.approved_waiver_count, 0) > 0 then 'waived'
    when af.due_date is not null and af.due_date < current_date then 'overdue'
    when coalesce(ae.accepted_evidence_count, 0) > 0 then 'partially_satisfied'
    else 'pending'
  end as evidence_gate_status,
  (
    (not af.management_response_required or coalesce(af.management_response_status, 'required') in ('accepted','waived','not_required'))
    and (not af.corrective_action_required or coalesce(af.corrective_action_status, 'required') in ('accepted','completed','not_required'))
    and (
      coalesce(af.evidence_required, false) = false
      or coalesce(ae.accepted_evidence_count, 0) >= coalesce(af.minimum_accepted_evidence_count, 1)
      or coalesce(aw.approved_waiver_count, 0) > 0
    )
  ) as can_close,
  case
    when af.management_response_required and coalesce(af.management_response_status, 'required') not in ('accepted','waived','not_required') then 'management_response_not_accepted'
    when af.corrective_action_required and coalesce(af.corrective_action_status, 'required') not in ('accepted','completed','not_required') then 'corrective_action_not_accepted'
    when coalesce(af.evidence_required, false) = true
      and coalesce(ae.accepted_evidence_count, 0) < coalesce(af.minimum_accepted_evidence_count, 1)
      and coalesce(aw.approved_waiver_count, 0) = 0 then 'accepted_evidence_or_waiver_required'
    when af.closure_validation_status = 'blocked' then coalesce(af.closure_blocker, 'closure_blocked')
    else null
  end as closure_blocker,
  af.closure_requested_at,
  af.closure_validation_status
from public.audit_findings af
left join accepted_evidence ae on ae.audit_finding_id = af.id
left join active_waivers aw on aw.audit_finding_id = af.id;

create or replace view public.v_patch24_audit_finding_workflow_queue as
select
  af.organization_id,
  af.id as audit_finding_id,
  af.finding_code,
  af.audit_title,
  af.title,
  af.finding_status,
  af.workflow_stage,
  af.severity_level,
  af.management_response_status,
  af.corrective_action_status,
  af.evidence_gate_status,
  af.closure_validation_status,
  af.due_date,
  af.management_response_due_date,
  af.corrective_action_due_date,
  af.responsible_department_id,
  d.name_en as department_name,
  coalesce(ro.full_name_en, legacy_owner.full_name_en) as responsible_owner_name,
  ca.full_name_en as corrective_action_owner_name,
  am.full_name_en as audit_manager_name,
  cg.accepted_evidence_count,
  cg.minimum_accepted_evidence_count,
  cg.can_close,
  cg.closure_blocker,
  case
    when af.escalation_required then 'escalation'
    when af.management_response_required and coalesce(af.management_response_status, 'required') in ('required','rejected','overdue') then 'management_response'
    when af.corrective_action_required and coalesce(af.corrective_action_status, 'required') in ('required','rejected','overdue') then 'action_plan'
    when af.evidence_required and not cg.can_close then 'evidence'
    when af.closure_requested_at is not null and coalesce(af.closure_validation_status, 'not_requested') in ('requested','in_validation') then 'auditor_validation'
    when af.finding_status = 'returned_for_correction' then 'correction'
    else 'follow_up'
  end as queue_reason,
  (
    (af.due_date is not null and af.due_date < current_date and af.finding_status not in ('closed','cancelled'))
    or (af.management_response_due_date is not null and af.management_response_due_date < current_date and coalesce(af.management_response_status, 'required') not in ('accepted','waived','not_required'))
    or (af.corrective_action_due_date is not null and af.corrective_action_due_date < current_date and coalesce(af.corrective_action_status, 'required') not in ('accepted','completed','not_required'))
  ) as is_overdue
from public.audit_findings af
left join public.departments d on d.id = coalesce(af.responsible_department_id, af.department_id)
left join public.profiles ro on ro.id = af.responsible_owner_id
left join public.profiles legacy_owner on legacy_owner.id = af.owner_id
left join public.profiles ca on ca.id = af.corrective_action_owner_id
left join public.profiles am on am.id = af.audit_manager_id
left join public.v_patch24_audit_closure_gate_status cg on cg.audit_finding_id = af.id
where af.finding_status not in ('closed','cancelled')
  and (
    af.escalation_required
    or coalesce(af.management_response_status, 'required') not in ('accepted','waived','not_required')
    or coalesce(af.corrective_action_status, 'required') not in ('accepted','completed','not_required')
    or not coalesce(cg.can_close, false)
    or af.closure_requested_at is not null
    or af.finding_status in ('returned_for_correction','reopened','escalated')
  );

create or replace view public.v_patch24_overdue_audit_findings as
select
  af.organization_id,
  af.id as audit_finding_id,
  af.finding_code,
  af.title,
  af.finding_status,
  af.severity_level,
  af.due_date,
  af.management_response_due_date,
  af.corrective_action_due_date,
  af.closure_requested_at,
  d.name_en as department_name,
  coalesce(ro.full_name_en, legacy_owner.full_name_en) as responsible_owner_name,
  case
    when af.management_response_due_date is not null and af.management_response_due_date < current_date and coalesce(af.management_response_status, 'required') not in ('accepted','waived','not_required') then 'management_response_overdue'
    when af.corrective_action_due_date is not null and af.corrective_action_due_date < current_date and coalesce(af.corrective_action_status, 'required') not in ('accepted','completed','not_required') then 'corrective_action_overdue'
    when af.closure_requested_at is not null and coalesce(af.closure_validation_status, 'not_requested') in ('requested','in_validation') and af.closure_requested_at < now() - interval '14 days' then 'validation_overdue'
    else 'finding_due_overdue'
  end as overdue_reason,
  greatest(
    coalesce(current_date - af.due_date, 0),
    coalesce(current_date - af.management_response_due_date, 0),
    coalesce(current_date - af.corrective_action_due_date, 0)
  )::integer as days_overdue
from public.audit_findings af
left join public.departments d on d.id = coalesce(af.responsible_department_id, af.department_id)
left join public.profiles ro on ro.id = af.responsible_owner_id
left join public.profiles legacy_owner on legacy_owner.id = af.owner_id
where af.finding_status not in ('closed','cancelled')
  and (
    (af.due_date is not null and af.due_date < current_date)
    or (af.management_response_due_date is not null and af.management_response_due_date < current_date and coalesce(af.management_response_status, 'required') not in ('accepted','waived','not_required'))
    or (af.corrective_action_due_date is not null and af.corrective_action_due_date < current_date and coalesce(af.corrective_action_status, 'required') not in ('accepted','completed','not_required'))
    or (af.closure_requested_at is not null and coalesce(af.closure_validation_status, 'not_requested') in ('requested','in_validation') and af.closure_requested_at < now() - interval '14 days')
  );

create or replace view public.v_patch24_repeat_audit_findings as
select
  af.organization_id,
  af.id as audit_finding_id,
  af.finding_code,
  af.title,
  af.severity_level,
  af.root_cause_category,
  af.root_cause_summary,
  af.repeat_finding_flag,
  af.repeat_of_finding_id,
  parent.finding_code as repeat_of_finding_code,
  af.recurrence_count,
  af.recurrence_window_days,
  af.systemic_issue_flag,
  af.responsible_department_id,
  d.name_en as department_name,
  (
    select count(*)::integer
    from public.audit_findings other
    where other.organization_id = af.organization_id
      and other.id <> af.id
      and other.finding_status not in ('cancelled')
      and coalesce(other.responsible_department_id, other.department_id) is not distinct from coalesce(af.responsible_department_id, af.department_id)
      and (
        nullif(other.root_cause_category, '') is not distinct from nullif(af.root_cause_category, '')
        or other.related_risk_id is not distinct from af.related_risk_id
        or other.related_compliance_id is not distinct from af.related_compliance_id
      )
      and other.created_at >= af.created_at - (coalesce(af.recurrence_window_days, 365)::text || ' days')::interval
  ) as detected_repeat_count
from public.audit_findings af
left join public.audit_findings parent on parent.id = af.repeat_of_finding_id
left join public.departments d on d.id = coalesce(af.responsible_department_id, af.department_id)
where af.repeat_finding_flag = true
   or af.systemic_issue_flag = true
   or af.recurrence_count > 0
   or exists (
    select 1
    from public.audit_findings other
    where other.organization_id = af.organization_id
      and other.id <> af.id
      and coalesce(other.responsible_department_id, other.department_id) is not distinct from coalesce(af.responsible_department_id, af.department_id)
      and nullif(other.root_cause_category, '') is not distinct from nullif(af.root_cause_category, '')
   );

create or replace view public.v_patch24_audit_executive_escalations as
select
  af.organization_id,
  af.id as audit_finding_id,
  af.finding_code,
  af.title,
  af.finding_status,
  af.severity_level,
  af.escalation_required,
  af.escalation_level,
  af.escalated_at,
  af.escalated_to,
  et.full_name_en as escalated_to_name,
  af.escalation_reason,
  af.executive_visible,
  af.committee_review_required,
  af.committee_review_status,
  af.committee_review_note,
  af.repeat_finding_flag,
  af.systemic_issue_flag,
  af.due_date,
  d.name_en as department_name,
  case
    when af.committee_review_required then 'committee_review_required'
    when af.systemic_issue_flag then 'systemic_issue'
    when af.repeat_finding_flag then 'repeat_finding'
    when af.due_date is not null and af.due_date < current_date then 'overdue_high_risk'
    else 'high_or_critical'
  end as escalation_reason_code
from public.audit_findings af
left join public.profiles et on et.id = af.escalated_to
left join public.departments d on d.id = coalesce(af.responsible_department_id, af.department_id)
where af.executive_visible
   or af.escalation_required
   or af.committee_review_required
   or af.severity_level in ('high','critical')
   or af.repeat_finding_flag
   or af.systemic_issue_flag;

create or replace view public.v_patch24_audit_closure_pack_index as
select
  af.organization_id,
  af.id as audit_finding_id,
  af.finding_code,
  af.title,
  af.audit_title,
  af.finding_status,
  af.severity_level,
  af.management_response_status,
  af.corrective_action_status,
  af.closure_validation_status,
  af.closure_pack_reference,
  af.closure_pack_generated_at,
  cg.evidence_required,
  cg.accepted_evidence_count,
  cg.minimum_accepted_evidence_count,
  cg.approved_waiver_count,
  cg.evidence_gate_status,
  cg.can_close,
  cg.closure_blocker,
  af.closure_validated_by,
  validator.full_name_en as closure_validator_name,
  af.closure_validated_at,
  count(ep.evidence_file_id)::integer as linked_evidence_count
from public.audit_findings af
left join public.v_patch24_audit_closure_gate_status cg on cg.audit_finding_id = af.id
left join public.v_patch23_evidence_pack_index ep on ep.linked_item_type = 'audit_finding' and ep.linked_item_id = af.id
left join public.profiles validator on validator.id = af.closure_validated_by
group by af.organization_id, af.id, cg.evidence_required, cg.accepted_evidence_count, cg.minimum_accepted_evidence_count, cg.approved_waiver_count, cg.evidence_gate_status, cg.can_close, cg.closure_blocker, validator.full_name_en;

alter view public.v_patch24_audit_finding_workflow_queue set (security_invoker = true);
alter view public.v_patch24_overdue_audit_findings set (security_invoker = true);
alter view public.v_patch24_repeat_audit_findings set (security_invoker = true);
alter view public.v_patch24_audit_closure_gate_status set (security_invoker = true);
alter view public.v_patch24_audit_executive_escalations set (security_invoker = true);
alter view public.v_patch24_audit_closure_pack_index set (security_invoker = true);

grant select on public.v_patch24_audit_finding_workflow_queue to authenticated;
grant select on public.v_patch24_overdue_audit_findings to authenticated;
grant select on public.v_patch24_repeat_audit_findings to authenticated;
grant select on public.v_patch24_audit_closure_gate_status to authenticated;
grant select on public.v_patch24_audit_executive_escalations to authenticated;
grant select on public.v_patch24_audit_closure_pack_index to authenticated;

create or replace function public.patch24_audit_closure_satisfied(p_audit_finding_id uuid)
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce((
    select can_close
    from public.v_patch24_audit_closure_gate_status
    where audit_finding_id = p_audit_finding_id
    limit 1
  ), false);
$$;

create or replace function public.grc_guard_audit_finding_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status::text = 'closed' then
    if coalesce(new.evidence_required, false) = true and not public.patch24_audit_closure_satisfied(new.id) then
      raise exception 'Accepted evidence or approved evidence waiver is required before closing this audit finding.';
    end if;

    if coalesce(new.closure_validated_by, new.reviewed_by) is null then
      raise exception 'Audit validation is required before closing this audit finding.';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.patch24_write_audit_event(
  p_organization_id uuid,
  p_audit_finding_id uuid,
  p_validation_type text,
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
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then
    raise exception 'PATCH24_AUDIT_EVENT_SERVICE_ROLE_REQUIRED';
  end if;

  insert into public.audit_finding_validation_events (
    organization_id,
    audit_finding_id,
    validation_type,
    from_status,
    to_status,
    actor_id,
    note,
    metadata
  )
  values (
    p_organization_id,
    p_audit_finding_id,
    p_validation_type,
    p_from_status,
    p_to_status,
    p_actor_id,
    p_note,
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

create or replace function public.patch24_audit_finding_workflow_bridge(
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
  v_finding public.audit_findings%rowtype;
  v_action text := lower(coalesce(p_action, ''));
  v_finding_id uuid := coalesce(nullif(p_payload->>'audit_finding_id', '')::uuid, nullif(p_payload->>'finding_id', '')::uuid);
  v_extension_id uuid := nullif(p_payload->>'extension_id', '')::uuid;
  v_can_manage boolean := false;
  v_is_owner boolean := false;
  v_old_status text;
  v_new_status text;
  v_note text := nullif(trim(coalesce(p_payload->>'note', p_payload->>'reason', p_payload->>'audit_note', '')), '');
  v_reason text := nullif(trim(coalesce(p_payload->>'reason', p_payload->>'rejection_reason', p_payload->>'extension_reason', p_payload->>'reopen_reason', p_payload->>'note', '')), '');
  v_response text := nullif(trim(coalesce(p_payload->>'management_response', p_payload->>'response', '')), '');
  v_action_plan text := nullif(trim(coalesce(p_payload->>'corrective_action_plan', p_payload->>'action_plan', '')), '');
  v_due_date date;
  v_blocker text;
  v_pack_reference text;
  v_result jsonb := '{}'::jsonb;
begin
  if v_jwt_role <> 'service_role' and current_user <> 'service_role' then
    raise exception 'PATCH24_AUDIT_SERVICE_ROLE_REQUIRED';
  end if;

  select * into v_actor
  from public.profiles
  where id = p_actor_id and is_active = true;

  if not found or v_actor.organization_id is null then
    raise exception 'PATCH24_AUDIT_ACTIVE_ACTOR_REQUIRED';
  end if;

  if v_action not in (
    'issue_audit_finding',
    'submit_management_response',
    'accept_management_response',
    'reject_management_response',
    'submit_corrective_action_plan',
    'accept_corrective_action_plan',
    'reject_corrective_action_plan',
    'request_audit_finding_extension',
    'approve_audit_finding_extension',
    'reject_audit_finding_extension',
    'request_audit_finding_closure',
    'validate_audit_finding_closure',
    'reject_audit_finding_closure',
    'reopen_audit_finding_with_reason',
    'escalate_audit_finding',
    'mark_repeat_audit_finding',
    'link_audit_finding_to_risk',
    'link_audit_finding_to_compliance',
    'generate_audit_closure_pack_index'
  ) then
    raise exception 'PATCH24_AUDIT_UNSUPPORTED_ACTION';
  end if;

  if v_finding_id is null then
    raise exception 'PATCH24_AUDIT_FINDING_ID_REQUIRED';
  end if;

  select * into v_finding
  from public.audit_findings
  where id = v_finding_id
  for update;

  if not found then
    raise exception 'PATCH24_AUDIT_FINDING_NOT_FOUND';
  end if;

  if v_actor.organization_id is distinct from v_finding.organization_id then
    raise exception 'PATCH24_AUDIT_CROSS_ORGANIZATION_DENIED';
  end if;

  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p_actor_id
      and ur.is_active = true
      and ur.role::text in ('super_admin','executive','governance_admin','division_head','department_manager','compliance_officer','auditor')
      and (ur.organization_id is null or ur.organization_id is not distinct from v_finding.organization_id)
  ) into v_can_manage;

  v_is_owner := p_actor_id in (
    v_finding.owner_id,
    v_finding.auditor_id,
    v_finding.finding_owner_id,
    v_finding.audit_manager_id,
    v_finding.responsible_owner_id,
    v_finding.corrective_action_owner_id,
    v_finding.executive_sponsor_id
  );

  if not (v_can_manage or v_is_owner) then
    raise exception 'PATCH24_AUDIT_NOT_AUTHORIZED';
  end if;

  v_old_status := v_finding.finding_status;

  if v_action = 'issue_audit_finding' then
    update public.audit_findings
    set
      status = 'open'::public.audit_finding_status,
      finding_status = 'management_response_required',
      workflow_stage = 'management_response',
      severity_level = coalesce(nullif(p_payload->>'severity_level', ''), severity_level, risk_level::text),
      management_response_required = coalesce((p_payload->>'management_response_required')::boolean, true),
      management_response_status = case when coalesce((p_payload->>'management_response_required')::boolean, true) then 'required' else 'waived' end,
      management_response_due_date = coalesce(nullif(p_payload->>'management_response_due_date', '')::date, management_response_due_date, current_date + 14),
      due_date = coalesce(nullif(p_payload->>'due_date', '')::date, due_date),
      original_due_date = coalesce(original_due_date, due_date, nullif(p_payload->>'due_date', '')::date),
      finding_owner_id = coalesce(nullif(p_payload->>'finding_owner_id', '')::uuid, finding_owner_id, owner_id),
      audit_manager_id = coalesce(nullif(p_payload->>'audit_manager_id', '')::uuid, audit_manager_id, auditor_id, p_actor_id),
      responsible_department_id = coalesce(nullif(p_payload->>'responsible_department_id', '')::uuid, responsible_department_id, department_id),
      responsible_owner_id = coalesce(nullif(p_payload->>'responsible_owner_id', '')::uuid, responsible_owner_id, owner_id, p_actor_id),
      escalation_required = escalation_required or (coalesce(nullif(p_payload->>'severity_level', ''), severity_level, risk_level::text) in ('high','critical') and coalesce(nullif(p_payload->>'due_date', '')::date, due_date, current_date + 30) < current_date),
      executive_visible = executive_visible or (coalesce(nullif(p_payload->>'severity_level', ''), severity_level, risk_level::text) in ('high','critical') and coalesce(nullif(p_payload->>'due_date', '')::date, due_date, current_date + 30) < current_date),
      updated_by = p_actor_id
    where id = v_finding.id;

    perform public.patch24_write_audit_event(v_finding.organization_id, v_finding.id, 'finding_issued', v_old_status, 'management_response_required', p_actor_id, coalesce(v_note, 'Finding issued.'), p_payload);
    v_result := jsonb_build_object('audit_finding_id', v_finding.id, 'finding_status', 'management_response_required');

  elsif v_action = 'submit_management_response' then
    if v_response is null then
      raise exception 'PATCH24_MANAGEMENT_RESPONSE_TEXT_REQUIRED';
    end if;

    update public.audit_findings
    set
      management_response = v_response,
      management_response_submitted_by = p_actor_id,
      management_response_submitted_at = now(),
      management_response_status = 'submitted',
      finding_status = 'management_response_submitted',
      workflow_stage = 'management_response_review',
      updated_by = p_actor_id
    where id = v_finding.id;

    perform public.patch24_write_audit_event(v_finding.organization_id, v_finding.id, 'management_response_submitted', v_old_status, 'management_response_submitted', p_actor_id, v_note, p_payload);

  elsif v_action in ('accept_management_response','reject_management_response') then
    if not v_can_manage then
      raise exception 'PATCH24_MANAGEMENT_RESPONSE_REVIEWER_REQUIRED';
    end if;
    if v_finding.management_response is null or trim(v_finding.management_response) = '' then
      raise exception 'PATCH24_MANAGEMENT_RESPONSE_TEXT_REQUIRED';
    end if;
    if v_action = 'reject_management_response' and v_reason is null then
      raise exception 'PATCH24_MANAGEMENT_RESPONSE_REJECTION_REASON_REQUIRED';
    end if;

    v_new_status := case when v_action = 'accept_management_response' then 'action_plan_required' else 'management_response_required' end;
    update public.audit_findings
    set
      management_response_status = case when v_action = 'accept_management_response' then 'accepted' else 'rejected' end,
      management_response_rejection_reason = case when v_action = 'reject_management_response' then v_reason else null end,
      finding_status = v_new_status,
      workflow_stage = case when v_action = 'accept_management_response' then 'action_plan' else 'management_response' end,
      corrective_action_status = case when v_action = 'accept_management_response' and corrective_action_required then 'required' else corrective_action_status end,
      updated_by = p_actor_id
    where id = v_finding.id;

    perform public.patch24_write_audit_event(
      v_finding.organization_id,
      v_finding.id,
      case when v_action = 'accept_management_response' then 'management_response_accepted' else 'management_response_rejected' end,
      v_old_status,
      v_new_status,
      p_actor_id,
      v_reason,
      p_payload
    );

  elsif v_action = 'submit_corrective_action_plan' then
    if v_action_plan is null then
      raise exception 'PATCH24_CORRECTIVE_ACTION_PLAN_REQUIRED';
    end if;
    if coalesce(nullif(p_payload->>'corrective_action_owner_id', '')::uuid, v_finding.corrective_action_owner_id, v_finding.responsible_owner_id) is null then
      raise exception 'PATCH24_CORRECTIVE_ACTION_OWNER_REQUIRED';
    end if;
    if coalesce(nullif(p_payload->>'corrective_action_due_date', '')::date, v_finding.corrective_action_due_date) is null then
      raise exception 'PATCH24_CORRECTIVE_ACTION_DUE_DATE_REQUIRED';
    end if;

    update public.audit_findings
    set
      corrective_action_required = true,
      corrective_action_plan = v_action_plan,
      corrective_action_owner_id = coalesce(nullif(p_payload->>'corrective_action_owner_id', '')::uuid, corrective_action_owner_id, responsible_owner_id),
      corrective_action_due_date = coalesce(nullif(p_payload->>'corrective_action_due_date', '')::date, corrective_action_due_date),
      corrective_action_status = 'submitted',
      finding_status = 'action_plan_in_progress',
      workflow_stage = 'action_plan_review',
      updated_by = p_actor_id
    where id = v_finding.id;

    perform public.patch24_write_audit_event(v_finding.organization_id, v_finding.id, 'action_plan_submitted', v_old_status, 'action_plan_in_progress', p_actor_id, v_note, p_payload);

  elsif v_action in ('accept_corrective_action_plan','reject_corrective_action_plan') then
    if not v_can_manage then
      raise exception 'PATCH24_ACTION_PLAN_REVIEWER_REQUIRED';
    end if;
    if v_action = 'accept_corrective_action_plan' and (v_finding.corrective_action_owner_id is null or v_finding.corrective_action_due_date is null) then
      raise exception 'PATCH24_CORRECTIVE_ACTION_OWNER_AND_DUE_DATE_REQUIRED';
    end if;
    if v_action = 'reject_corrective_action_plan' and v_reason is null then
      raise exception 'PATCH24_ACTION_PLAN_REJECTION_REASON_REQUIRED';
    end if;

    v_new_status := case when v_action = 'accept_corrective_action_plan' then 'evidence_required' else 'action_plan_required' end;
    update public.audit_findings
    set
      corrective_action_status = case when v_action = 'accept_corrective_action_plan' then 'accepted' else 'rejected' end,
      corrective_action_rejection_reason = case when v_action = 'reject_corrective_action_plan' then v_reason else null end,
      finding_status = v_new_status,
      workflow_stage = case when v_action = 'accept_corrective_action_plan' then 'evidence' else 'action_plan' end,
      evidence_gate_status = case when v_action = 'accept_corrective_action_plan' and evidence_required then 'pending' else evidence_gate_status end,
      updated_by = p_actor_id
    where id = v_finding.id;

    perform public.patch24_write_audit_event(
      v_finding.organization_id,
      v_finding.id,
      case when v_action = 'accept_corrective_action_plan' then 'action_plan_accepted' else 'action_plan_rejected' end,
      v_old_status,
      v_new_status,
      p_actor_id,
      v_reason,
      p_payload
    );

  elsif v_action = 'request_audit_finding_extension' then
    v_due_date := nullif(p_payload->>'requested_due_date', '')::date;
    if v_due_date is null then
      raise exception 'PATCH24_EXTENSION_REQUESTED_DUE_DATE_REQUIRED';
    end if;
    if v_reason is null then
      raise exception 'PATCH24_EXTENSION_REASON_REQUIRED';
    end if;

    insert into public.audit_finding_due_date_extensions (
      organization_id,
      audit_finding_id,
      previous_due_date,
      requested_due_date,
      extension_reason,
      requested_by
    )
    values (
      v_finding.organization_id,
      v_finding.id,
      v_finding.due_date,
      v_due_date,
      v_reason,
      p_actor_id
    )
    returning id into v_extension_id;

    perform public.patch24_write_audit_event(v_finding.organization_id, v_finding.id, 'due_date_extension_requested', v_old_status, v_old_status, p_actor_id, v_reason, p_payload || jsonb_build_object('extension_id', v_extension_id));
    v_result := jsonb_build_object('extension_id', v_extension_id);

  elsif v_action in ('approve_audit_finding_extension','reject_audit_finding_extension') then
    if not v_can_manage then
      raise exception 'PATCH24_EXTENSION_APPROVER_REQUIRED';
    end if;
    if v_extension_id is null then
      raise exception 'PATCH24_EXTENSION_ID_REQUIRED';
    end if;

    if v_action = 'approve_audit_finding_extension' then
      update public.audit_finding_due_date_extensions
      set status = 'approved', approved_by = p_actor_id, approved_at = now()
      where id = v_extension_id and audit_finding_id = v_finding.id and status = 'requested'
      returning requested_due_date into v_due_date;

      if v_due_date is null then
        raise exception 'PATCH24_EXTENSION_NOT_FOUND_OR_ALREADY_DECIDED';
      end if;

      update public.audit_findings
      set revised_due_date = v_due_date, due_date = v_due_date, updated_by = p_actor_id
      where id = v_finding.id;

      perform public.patch24_write_audit_event(v_finding.organization_id, v_finding.id, 'due_date_extension_approved', v_old_status, v_old_status, p_actor_id, v_note, p_payload);
    else
      if v_reason is null then
        raise exception 'PATCH24_EXTENSION_REJECTION_REASON_REQUIRED';
      end if;
      update public.audit_finding_due_date_extensions
      set status = 'rejected', approved_by = p_actor_id, approved_at = now(), rejection_reason = v_reason
      where id = v_extension_id and audit_finding_id = v_finding.id and status = 'requested';

      perform public.patch24_write_audit_event(v_finding.organization_id, v_finding.id, 'due_date_extension_rejected', v_old_status, v_old_status, p_actor_id, v_reason, p_payload);
    end if;

  elsif v_action = 'request_audit_finding_closure' then
    update public.audit_findings
    set
      closure_requested_at = now(),
      closure_requested_by = p_actor_id,
      closure_validation_status = 'requested',
      finding_status = 'closure_requested',
      workflow_stage = 'auditor_validation',
      status = 'under_audit_review'::public.audit_finding_status,
      updated_by = p_actor_id
    where id = v_finding.id;

    perform public.patch24_write_audit_event(v_finding.organization_id, v_finding.id, 'closure_requested', v_old_status, 'closure_requested', p_actor_id, coalesce(v_note, 'Closure requested.'), p_payload);

  elsif v_action = 'validate_audit_finding_closure' then
    if not v_can_manage then
      raise exception 'PATCH24_CLOSURE_VALIDATOR_REQUIRED';
    end if;

    select closure_blocker into v_blocker
    from public.v_patch24_audit_closure_gate_status
    where audit_finding_id = v_finding.id
      and (can_close = false or closure_blocker is not null)
    limit 1;

    if v_blocker is not null then
      update public.audit_findings
      set closure_validation_status = 'blocked', closure_blocker = v_blocker, evidence_gate_status = 'blocked'
      where id = v_finding.id;
      raise exception 'PATCH24_AUDIT_CLOSURE_BLOCKED: %', v_blocker;
    end if;

    update public.audit_findings
    set
      status = 'closed'::public.audit_finding_status,
      finding_status = 'closed',
      workflow_stage = 'closed',
      closure_validation_status = 'accepted',
      closure_validation_note = coalesce(v_note, closure_validation_note),
      closure_validated_by = p_actor_id,
      closure_validated_at = now(),
      reviewed_by = p_actor_id,
      reviewed_at = now(),
      closed_by = p_actor_id,
      closed_at = now(),
      closure_blocker = null,
      evidence_gate_status = 'satisfied',
      updated_by = p_actor_id
    where id = v_finding.id;

    perform public.patch24_write_audit_event(v_finding.organization_id, v_finding.id, 'closure_accepted', v_old_status, 'closed', p_actor_id, v_note, p_payload);

  elsif v_action = 'reject_audit_finding_closure' then
    if not v_can_manage then
      raise exception 'PATCH24_CLOSURE_VALIDATOR_REQUIRED';
    end if;
    if v_reason is null then
      raise exception 'PATCH24_CLOSURE_REJECTION_REASON_REQUIRED';
    end if;

    update public.audit_findings
    set
      status = 'rejected'::public.audit_finding_status,
      finding_status = 'returned_for_correction',
      workflow_stage = 'correction',
      closure_validation_status = 'rejected',
      closure_validation_note = v_reason,
      closure_blocker = v_reason,
      updated_by = p_actor_id
    where id = v_finding.id;

    perform public.patch24_write_audit_event(v_finding.organization_id, v_finding.id, 'closure_rejected', v_old_status, 'returned_for_correction', p_actor_id, v_reason, p_payload);

  elsif v_action = 'reopen_audit_finding_with_reason' then
    if v_reason is null then
      raise exception 'PATCH24_REOPEN_REASON_REQUIRED';
    end if;

    update public.audit_findings
    set
      status = 'open'::public.audit_finding_status,
      finding_status = 'reopened',
      workflow_stage = 'reopened',
      reopened_at = now(),
      reopened_by = p_actor_id,
      reopen_reason = v_reason,
      closed_by = null,
      closed_at = null,
      closure_validated_by = null,
      closure_validated_at = null,
      closure_validation_status = 'not_requested',
      closure_requested_at = null,
      closure_requested_by = null,
      updated_by = p_actor_id
    where id = v_finding.id;

    perform public.patch24_write_audit_event(v_finding.organization_id, v_finding.id, 'reopened', v_old_status, 'reopened', p_actor_id, v_reason, p_payload);

  elsif v_action = 'escalate_audit_finding' then
    if v_reason is null then
      raise exception 'PATCH24_ESCALATION_REASON_REQUIRED';
    end if;

    update public.audit_findings
    set
      finding_status = 'escalated',
      workflow_stage = 'escalation',
      escalation_required = true,
      escalation_level = coalesce(nullif(p_payload->>'escalation_level', ''), case when severity_level = 'critical' then 'committee' else 'executive' end),
      escalated_at = now(),
      escalated_to = coalesce(nullif(p_payload->>'escalated_to', '')::uuid, executive_sponsor_id),
      escalation_reason = v_reason,
      executive_visible = true,
      committee_review_required = committee_review_required or severity_level = 'critical' or systemic_issue_flag,
      committee_review_status = case when committee_review_required or severity_level = 'critical' or systemic_issue_flag then 'required' else committee_review_status end,
      updated_by = p_actor_id
    where id = v_finding.id;

    perform public.patch24_write_audit_event(v_finding.organization_id, v_finding.id, 'escalated', v_old_status, 'escalated', p_actor_id, v_reason, p_payload);

  elsif v_action = 'mark_repeat_audit_finding' then
    update public.audit_findings
    set
      repeat_finding_flag = coalesce((p_payload->>'repeat_finding_flag')::boolean, true),
      repeat_of_finding_id = coalesce(nullif(p_payload->>'repeat_of_finding_id', '')::uuid, repeat_of_finding_id),
      recurrence_count = greatest(coalesce(nullif(p_payload->>'recurrence_count', '')::integer, recurrence_count, 0), 1),
      recurrence_window_days = coalesce(nullif(p_payload->>'recurrence_window_days', '')::integer, recurrence_window_days, 365),
      systemic_issue_flag = coalesce((p_payload->>'systemic_issue_flag')::boolean, systemic_issue_flag),
      executive_visible = true,
      committee_review_required = true,
      committee_review_status = case when committee_review_status = 'not_required' then 'required' else committee_review_status end,
      updated_by = p_actor_id
    where id = v_finding.id;

    perform public.patch24_write_audit_event(v_finding.organization_id, v_finding.id, 'repeat_marked', v_old_status, v_old_status, p_actor_id, v_note, p_payload);

  elsif v_action = 'link_audit_finding_to_risk' then
    if nullif(p_payload->>'related_risk_id', '') is null then
      raise exception 'PATCH24_RELATED_RISK_ID_REQUIRED';
    end if;

    update public.audit_findings
    set related_risk_id = (p_payload->>'related_risk_id')::uuid, updated_by = p_actor_id
    where id = v_finding.id;

    update public.risks
    set next_review_date = least(coalesce(next_review_date, current_date + 90), current_date + 30),
        review_overdue = true,
        updated_by = p_actor_id
    where id = (p_payload->>'related_risk_id')::uuid
      and organization_id = v_finding.organization_id;

    perform public.patch24_write_audit_event(v_finding.organization_id, v_finding.id, 'risk_linked', v_old_status, v_old_status, p_actor_id, v_note, p_payload);

  elsif v_action = 'link_audit_finding_to_compliance' then
    if nullif(p_payload->>'related_compliance_id', '') is null then
      raise exception 'PATCH24_RELATED_COMPLIANCE_ID_REQUIRED';
    end if;

    update public.audit_findings
    set related_compliance_id = (p_payload->>'related_compliance_id')::uuid, updated_by = p_actor_id
    where id = v_finding.id;

    perform public.patch24_write_audit_event(v_finding.organization_id, v_finding.id, 'compliance_linked', v_old_status, v_old_status, p_actor_id, v_note, p_payload);

  elsif v_action = 'generate_audit_closure_pack_index' then
    v_pack_reference := coalesce(nullif(p_payload->>'closure_pack_reference', ''), 'AUDIT-CLOSURE-' || upper(left(v_finding.id::text, 8)) || '-' || to_char(now(), 'YYYYMMDDHH24MISS'));

    update public.audit_findings
    set closure_pack_reference = v_pack_reference,
        closure_pack_generated_at = now(),
        updated_by = p_actor_id
    where id = v_finding.id;

    perform public.patch24_write_audit_event(v_finding.organization_id, v_finding.id, 'closure_pack_generated', v_old_status, v_old_status, p_actor_id, coalesce(v_note, 'Closure pack index generated.'), p_payload || jsonb_build_object('closure_pack_reference', v_pack_reference));
    v_result := jsonb_build_object('closure_pack_reference', v_pack_reference);
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'action', v_action,
    'audit_finding_id', v_finding.id,
    'result', v_result
  );
end;
$$;

revoke all on function public.patch24_audit_closure_satisfied(uuid) from public, anon;
grant execute on function public.patch24_audit_closure_satisfied(uuid) to authenticated, service_role;

revoke all on function public.patch24_write_audit_event(uuid, uuid, text, text, text, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.patch24_write_audit_event(uuid, uuid, text, text, text, uuid, text, jsonb) to service_role;

revoke all on function public.patch24_audit_finding_workflow_bridge(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.patch24_audit_finding_workflow_bridge(uuid, text, jsonb) to service_role;

comment on function public.patch24_audit_finding_workflow_bridge(uuid, text, jsonb) is 'Patch 24 service-role audit finding workflow bridge. Browser code must call through authenticated Edge privileged-action bridge.';
comment on table public.audit_finding_validation_events is 'Patch 24 append-only workflow transition log for audit findings.';
comment on table public.audit_finding_due_date_extensions is 'Patch 24 governed due date extension requests and decisions for audit findings.';
