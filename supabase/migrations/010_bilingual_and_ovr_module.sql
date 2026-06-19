-- =========================================================
-- GRC Control Center - Migration 010
-- Bilingual application support + OVR healthcare incident module
-- =========================================================

-- =========================
-- ENUMS
-- =========================

do $$ begin
  create type public.ovr_involved_person_type as enum (
    'patient',
    'visitor',
    'employee',
    'company_representative',
    'other'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.ovr_status as enum (
    'draft',
    'submitted',
    'under_supervisor_review',
    'under_quality_review',
    'action_plan_required',
    'corrective_action_in_progress',
    'evidence_submitted',
    'closed',
    'rejected',
    'cancelled'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.ovr_severity_level as enum (
    'level_1',
    'level_2',
    'level_3',
    'level_4',
    'sentinel'
  );
exception when duplicate_object then null;
end $$;

-- =========================
-- OVR NUMBERING
-- =========================

create sequence if not exists public.ovr_number_seq start 1;

create or replace function public.assign_ovr_number()
returns trigger
language plpgsql
as $$
begin
  if new.ovr_number is null or trim(new.ovr_number) = '' then
    new.ovr_number := 'OVR-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.ovr_number_seq')::text, 5, '0');
  end if;
  return new;
end;
$$;

-- =========================
-- OVR REPORTS
-- =========================

create table if not exists public.ovr_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,

  ovr_number text,
  logging_number text,

  occurrence_date date,
  occurrence_time time,
  occurrence_location text,
  notification_at timestamptz,

  involved_person_type public.ovr_involved_person_type not null default 'patient',
  person_involved_name text,
  mrn_or_id_no text,
  age integer check (age is null or age >= 0),
  sex text,

  identifier_name text,
  identifier_id_no text,
  identifier_title text,
  identifier_department text,

  witness_name_title text,
  witness_id_no text,
  witness_department text,

  division_id uuid references public.divisions(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  unit_id uuid references public.units(id) on delete set null,

  physical_condition text,
  mental_condition text,
  pre_occurrence_condition_flags text[] not null default '{}',

  brief_description text not null,
  occurrence_category text not null default 'other',
  occurrence_subcategory text,
  occurrence_details jsonb not null default '{}'::jsonb,

  injury_type text,
  severity_level public.ovr_severity_level,

  supervisor_investigation text,
  corrective_action text,
  quality_manager_comments text,

  referred_to_person text,
  referred_to_department text,
  referred_to_date date,
  quality_actions jsonb not null default '{}'::jsonb,

  corrective_action_required boolean not null default false,
  evidence_required boolean not null default true,
  linked_project_id uuid references public.projects(id) on delete set null,

  status public.ovr_status not null default 'draft',
  delay_reason text,
  rejection_reason text,

  reported_by uuid references public.profiles(id) on delete set null,
  owner_id uuid references public.profiles(id) on delete set null,
  supervisor_id uuid references public.profiles(id) on delete set null,
  quality_reviewer_id uuid references public.profiles(id) on delete set null,

  reviewed_at timestamptz,
  closed_by uuid references public.profiles(id) on delete set null,
  closed_at timestamptz,

  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint uq_ovr_reports_org_number unique (organization_id, ovr_number)
);

create index if not exists idx_ovr_reports_org on public.ovr_reports(organization_id);
create index if not exists idx_ovr_reports_department on public.ovr_reports(department_id);
create index if not exists idx_ovr_reports_reported_by on public.ovr_reports(reported_by);
create index if not exists idx_ovr_reports_owner on public.ovr_reports(owner_id);
create index if not exists idx_ovr_reports_status on public.ovr_reports(status);
create index if not exists idx_ovr_reports_severity on public.ovr_reports(severity_level);
create index if not exists idx_ovr_reports_occurrence_date on public.ovr_reports(occurrence_date);
create index if not exists idx_ovr_reports_category on public.ovr_reports(occurrence_category);
create index if not exists idx_ovr_reports_project on public.ovr_reports(linked_project_id);

-- Existing updated_at helper comes from Migration 001.
drop trigger if exists trg_ovr_reports_updated_at on public.ovr_reports;
create trigger trg_ovr_reports_updated_at
before update on public.ovr_reports
for each row execute function public.set_updated_at();

drop trigger if exists trg_ovr_reports_number on public.ovr_reports;
create trigger trg_ovr_reports_number
before insert on public.ovr_reports
for each row execute function public.assign_ovr_number();

-- Audit log trigger from Migration 003.
drop trigger if exists trg_audit_ovr_reports on public.ovr_reports;
create trigger trg_audit_ovr_reports
after insert or update or delete on public.ovr_reports
for each row execute function public.audit_log_row_change();

-- =========================
-- LINK EVIDENCE / APPROVALS / COMMENTS TO OVR
-- =========================

alter table public.evidence_files
add column if not exists ovr_report_id uuid references public.ovr_reports(id) on delete cascade;

alter table public.evidence_files
drop constraint if exists evidence_must_link_to_item;

alter table public.evidence_files
add constraint evidence_must_link_to_item
check (
  project_id is not null
  or milestone_id is not null
  or task_id is not null
  or risk_id is not null
  or risk_control_id is not null
  or compliance_item_id is not null
  or audit_finding_id is not null
  or policy_id is not null
  or committee_decision_id is not null
  or ovr_report_id is not null
);

alter table public.approvals
add column if not exists ovr_report_id uuid references public.ovr_reports(id) on delete cascade;

alter table public.approvals
drop constraint if exists approval_must_link_to_item;

alter table public.approvals
add constraint approval_must_link_to_item
check (
  project_id is not null
  or milestone_id is not null
  or task_id is not null
  or evidence_id is not null
  or risk_id is not null
  or compliance_item_id is not null
  or audit_finding_id is not null
  or policy_id is not null
  or committee_decision_id is not null
  or ovr_report_id is not null
);

alter table public.comments
add column if not exists ovr_report_id uuid references public.ovr_reports(id) on delete cascade;

alter table public.comments
drop constraint if exists comment_must_link_to_item;

alter table public.comments
add constraint comment_must_link_to_item
check (
  project_id is not null
  or milestone_id is not null
  or task_id is not null
  or risk_id is not null
  or compliance_item_id is not null
  or audit_finding_id is not null
  or policy_id is not null
  or committee_decision_id is not null
  or ovr_report_id is not null
);

create index if not exists idx_evidence_ovr_report on public.evidence_files(ovr_report_id);
create index if not exists idx_approvals_ovr_report on public.approvals(ovr_report_id);
create index if not exists idx_comments_ovr_report on public.comments(ovr_report_id);

-- =========================
-- OVR VIEWS
-- =========================

create or replace view public.v_ovr_summary as
select
  o.id as organization_id,
  count(r.id)::int as total_reports,
  count(r.id) filter (where r.status not in ('closed','cancelled'))::int as open_reports,
  count(r.id) filter (where r.status = 'under_quality_review')::int as under_quality_review,
  count(r.id) filter (where r.corrective_action_required = true and r.status not in ('closed','cancelled'))::int as corrective_actions_required,
  count(r.id) filter (where r.severity_level = 'sentinel')::int as sentinel_events,
  count(r.id) filter (where r.severity_level = 'level_1')::int as near_miss_level_1
from public.organizations o
left join public.ovr_reports r on r.organization_id = o.id
group by o.id;

create or replace view public.v_ovr_quality_queue as
select
  r.id,
  r.organization_id,
  r.ovr_number,
  r.logging_number,
  r.occurrence_date,
  r.occurrence_time,
  r.occurrence_location,
  r.occurrence_category,
  r.severity_level,
  r.status,
  r.corrective_action_required,
  r.linked_project_id,
  d.name_en as department_name_en,
  d.name_ar as department_name_ar,
  owner.full_name_en as owner_name_en,
  owner.full_name_ar as owner_name_ar,
  reporter.full_name_en as reporter_name_en,
  reporter.full_name_ar as reporter_name_ar,
  r.created_at
from public.ovr_reports r
left join public.departments d on d.id = r.department_id
left join public.profiles owner on owner.id = r.owner_id
left join public.profiles reporter on reporter.id = r.reported_by
where r.status not in ('closed','cancelled')
order by
  case r.severity_level
    when 'sentinel' then 1
    when 'level_4' then 2
    when 'level_3' then 3
    when 'level_2' then 4
    when 'level_1' then 5
    else 6
  end,
  r.created_at desc;

-- =========================
-- RLS POLICIES
-- =========================

alter table public.ovr_reports enable row level security;

drop policy if exists ovr_reports_read_related on public.ovr_reports;
create policy ovr_reports_read_related on public.ovr_reports
for select using (
  reported_by = auth.uid()
  or owner_id = auth.uid()
  or supervisor_id = auth.uid()
  or quality_reviewer_id = auth.uid()
  or public.can_access_scope(organization_id, division_id, department_id, unit_id)
  or public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer']::public.app_role[])
);

drop policy if exists ovr_reports_insert_authenticated on public.ovr_reports;
create policy ovr_reports_insert_authenticated on public.ovr_reports
for insert with check (
  reported_by = auth.uid()
  or created_by = auth.uid()
  or public.has_any_role(array['super_admin','executive','governance_admin','department_manager','auditor','compliance_officer','employee']::public.app_role[])
);

drop policy if exists ovr_reports_update_related on public.ovr_reports;
create policy ovr_reports_update_related on public.ovr_reports
for update using (
  owner_id = auth.uid()
  or supervisor_id = auth.uid()
  or quality_reviewer_id = auth.uid()
  or public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer']::public.app_role[])
)
with check (
  owner_id = auth.uid()
  or supervisor_id = auth.uid()
  or quality_reviewer_id = auth.uid()
  or public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer']::public.app_role[])
);

-- Allow reporters/managers to create a linked corrective-action project from an OVR.
drop policy if exists projects_insert_ovr_reporters on public.projects;
create policy projects_insert_ovr_reporters on public.projects
for insert with check (
  source_type = 'incident_ovr'
  and created_by = auth.uid()
  and organization_id = public.current_user_org_id()
);

-- Allow OVR evidence to be read by the report stakeholders.
drop policy if exists evidence_read_ovr_related on public.evidence_files;
create policy evidence_read_ovr_related on public.evidence_files
for select using (
  exists (
    select 1
    from public.ovr_reports r
    where r.id = ovr_report_id
      and (
        r.reported_by = auth.uid()
        or r.owner_id = auth.uid()
        or r.supervisor_id = auth.uid()
        or r.quality_reviewer_id = auth.uid()
        or public.can_manage_grc()
      )
  )
);
