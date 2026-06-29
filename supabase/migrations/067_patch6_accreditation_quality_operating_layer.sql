-- Patch 6: Accreditation & Quality Operating Layer
-- Purpose: convert accreditation and quality from structural dashboards into live operating workflows.
-- Scope: licensed standards import governance, requirement ownership, measurable element scoring,
-- tracer rounds, mock survey execution, quality indicators, OVR/RCA/CAPA linkage,
-- committee decisions, department readiness, and survey evidence packs.
-- Important: this patch does not seed or embed CBAHI/JCI copyrighted standard text.

create extension if not exists pgcrypto;

-- Patch 5 static RLS remediation -------------------------------------------------
-- Patch 5 created policies dynamically. The runtime policies work, but the static RLS
-- audit cannot reliably prove dynamic CREATE POLICY statements. These explicit policy
-- declarations keep the database behavior the same while making the proof gate readable.

drop policy if exists workflow_kernel_templates_org_read on public.workflow_kernel_templates;
create policy workflow_kernel_templates_org_read on public.workflow_kernel_templates for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists workflow_kernel_templates_org_insert on public.workflow_kernel_templates;
create policy workflow_kernel_templates_org_insert on public.workflow_kernel_templates for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists workflow_kernel_templates_org_update on public.workflow_kernel_templates;
create policy workflow_kernel_templates_org_update on public.workflow_kernel_templates for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists workflow_kernel_template_steps_org_read on public.workflow_kernel_template_steps;
create policy workflow_kernel_template_steps_org_read on public.workflow_kernel_template_steps for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists workflow_kernel_template_steps_org_insert on public.workflow_kernel_template_steps;
create policy workflow_kernel_template_steps_org_insert on public.workflow_kernel_template_steps for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists workflow_kernel_template_steps_org_update on public.workflow_kernel_template_steps;
create policy workflow_kernel_template_steps_org_update on public.workflow_kernel_template_steps for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists workflow_kernel_instances_org_read on public.workflow_kernel_instances;
create policy workflow_kernel_instances_org_read on public.workflow_kernel_instances for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists workflow_kernel_instances_org_insert on public.workflow_kernel_instances;
create policy workflow_kernel_instances_org_insert on public.workflow_kernel_instances for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists workflow_kernel_instances_org_update on public.workflow_kernel_instances;
create policy workflow_kernel_instances_org_update on public.workflow_kernel_instances for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists workflow_kernel_assignments_org_read on public.workflow_kernel_assignments;
create policy workflow_kernel_assignments_org_read on public.workflow_kernel_assignments for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists workflow_kernel_assignments_org_insert on public.workflow_kernel_assignments;
create policy workflow_kernel_assignments_org_insert on public.workflow_kernel_assignments for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists workflow_kernel_assignments_org_update on public.workflow_kernel_assignments;
create policy workflow_kernel_assignments_org_update on public.workflow_kernel_assignments for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists workflow_kernel_actions_org_read on public.workflow_kernel_actions;
create policy workflow_kernel_actions_org_read on public.workflow_kernel_actions for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists workflow_kernel_actions_org_insert on public.workflow_kernel_actions;
create policy workflow_kernel_actions_org_insert on public.workflow_kernel_actions for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists workflow_kernel_actions_org_update on public.workflow_kernel_actions;
create policy workflow_kernel_actions_org_update on public.workflow_kernel_actions for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists workflow_kernel_comments_org_read on public.workflow_kernel_comments;
create policy workflow_kernel_comments_org_read on public.workflow_kernel_comments for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists workflow_kernel_comments_org_insert on public.workflow_kernel_comments;
create policy workflow_kernel_comments_org_insert on public.workflow_kernel_comments for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists workflow_kernel_comments_org_update on public.workflow_kernel_comments;
create policy workflow_kernel_comments_org_update on public.workflow_kernel_comments for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists workflow_kernel_attachments_org_read on public.workflow_kernel_attachments;
create policy workflow_kernel_attachments_org_read on public.workflow_kernel_attachments for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists workflow_kernel_attachments_org_insert on public.workflow_kernel_attachments;
create policy workflow_kernel_attachments_org_insert on public.workflow_kernel_attachments for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists workflow_kernel_attachments_org_update on public.workflow_kernel_attachments;
create policy workflow_kernel_attachments_org_update on public.workflow_kernel_attachments for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists workflow_kernel_sla_events_org_read on public.workflow_kernel_sla_events;
create policy workflow_kernel_sla_events_org_read on public.workflow_kernel_sla_events for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists workflow_kernel_sla_events_org_insert on public.workflow_kernel_sla_events;
create policy workflow_kernel_sla_events_org_insert on public.workflow_kernel_sla_events for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists workflow_kernel_sla_events_org_update on public.workflow_kernel_sla_events;
create policy workflow_kernel_sla_events_org_update on public.workflow_kernel_sla_events for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists workflow_kernel_escalations_org_read on public.workflow_kernel_escalations;
create policy workflow_kernel_escalations_org_read on public.workflow_kernel_escalations for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists workflow_kernel_escalations_org_insert on public.workflow_kernel_escalations;
create policy workflow_kernel_escalations_org_insert on public.workflow_kernel_escalations for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists workflow_kernel_escalations_org_update on public.workflow_kernel_escalations;
create policy workflow_kernel_escalations_org_update on public.workflow_kernel_escalations for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists workflow_kernel_raci_org_read on public.workflow_kernel_raci;
create policy workflow_kernel_raci_org_read on public.workflow_kernel_raci for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists workflow_kernel_raci_org_insert on public.workflow_kernel_raci;
create policy workflow_kernel_raci_org_insert on public.workflow_kernel_raci for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists workflow_kernel_raci_org_update on public.workflow_kernel_raci;
create policy workflow_kernel_raci_org_update on public.workflow_kernel_raci for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists workflow_kernel_notifications_org_read on public.workflow_kernel_notifications;
create policy workflow_kernel_notifications_org_read on public.workflow_kernel_notifications for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists workflow_kernel_notifications_org_insert on public.workflow_kernel_notifications;
create policy workflow_kernel_notifications_org_insert on public.workflow_kernel_notifications for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists workflow_kernel_notifications_org_update on public.workflow_kernel_notifications;
create policy workflow_kernel_notifications_org_update on public.workflow_kernel_notifications for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

-- Patch 6 operating tables -------------------------------------------------------

create table if not exists public.quality_accreditation_content_import_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  framework_code text not null,
  source_name text not null,
  source_version_label text,
  license_owner text,
  imported_by uuid,
  import_status text not null default 'draft'
    check (import_status in ('draft', 'validated', 'approved', 'rejected', 'retired')),
  total_requirements integer not null default 0,
  total_measurable_elements integer not null default 0,
  validation_notes text,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quality_accreditation_requirement_operations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  import_batch_id uuid references public.quality_accreditation_content_import_batches(id) on delete set null,
  standard_code text not null,
  chapter_code text,
  requirement_code text not null,
  measurable_element_code text,
  requirement_reference text not null,
  requirement_title text,
  department_name text,
  owner_id uuid,
  owner_name text,
  reviewer_id uuid,
  reviewer_name text,
  workflow_instance_id uuid references public.workflow_kernel_instances(id) on delete set null,
  applicability_status text not null default 'applicable'
    check (applicability_status in ('applicable', 'not_applicable', 'deferred', 'needs_decision')),
  readiness_status text not null default 'not_started'
    check (readiness_status in ('not_started', 'in_progress', 'evidence_submitted', 'ready', 'partially_ready', 'not_ready', 'accepted_risk')),
  target_survey_date date,
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, standard_code, requirement_reference)
);

create table if not exists public.quality_accreditation_element_scores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  requirement_operation_id uuid not null references public.quality_accreditation_requirement_operations(id) on delete cascade,
  scoring_cycle text not null,
  score_value numeric(5,2),
  score_status text not null default 'not_scored'
    check (score_status in ('not_scored', 'met', 'partially_met', 'not_met', 'not_applicable')),
  evidence_status text not null default 'not_requested'
    check (evidence_status in ('not_requested', 'requested', 'submitted', 'accepted', 'rejected', 'expired')),
  gap_severity text
    check (gap_severity in ('critical', 'high', 'medium', 'low')),
  scored_by uuid,
  scored_at timestamptz,
  score_notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.quality_indicator_definitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  indicator_code text not null,
  indicator_name text not null,
  indicator_domain text not null default 'quality'
    check (indicator_domain in ('quality', 'patient_safety', 'infection_control', 'clinical', 'operational', 'accreditation')),
  numerator_definition text,
  denominator_definition text,
  target_direction text not null default 'higher_is_better'
    check (target_direction in ('higher_is_better', 'lower_is_better', 'within_range')),
  target_value numeric(12,4),
  warning_value numeric(12,4),
  is_active boolean not null default true,
  owner_id uuid,
  owner_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, indicator_code)
);

create table if not exists public.quality_indicator_measurements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  indicator_id uuid not null references public.quality_indicator_definitions(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  numerator_value numeric(14,4),
  denominator_value numeric(14,4),
  measured_value numeric(14,4),
  measurement_status text not null default 'draft'
    check (measurement_status in ('draft', 'submitted', 'validated', 'rejected', 'published')),
  validation_notes text,
  workflow_instance_id uuid references public.workflow_kernel_instances(id) on delete set null,
  submitted_by uuid,
  validated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quality_tracer_rounds (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  tracer_code text not null,
  tracer_title text not null,
  tracer_type text not null default 'patient_tracer'
    check (tracer_type in ('patient_tracer', 'system_tracer', 'department_tracer', 'document_tracer', 'environment_tracer')),
  department_name text,
  tracer_status text not null default 'planned'
    check (tracer_status in ('planned', 'in_progress', 'completed', 'cancelled', 'follow_up')),
  round_date date,
  lead_reviewer_id uuid,
  lead_reviewer_name text,
  workflow_instance_id uuid references public.workflow_kernel_instances(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, tracer_code)
);

create table if not exists public.quality_tracer_observations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  tracer_round_id uuid not null references public.quality_tracer_rounds(id) on delete cascade,
  requirement_operation_id uuid references public.quality_accreditation_requirement_operations(id) on delete set null,
  observation_area text,
  observation_finding text not null,
  observation_status text not null default 'open'
    check (observation_status in ('open', 'accepted', 'requires_capa', 'closed', 'void')),
  severity text not null default 'medium'
    check (severity in ('critical', 'high', 'medium', 'low')),
  responsible_department text,
  due_date date,
  workflow_instance_id uuid references public.workflow_kernel_instances(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quality_rca_capa_cases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  case_code text not null,
  source_type text not null default 'quality_event'
    check (source_type in ('ovr', 'tracer_observation', 'mock_survey', 'indicator_breach', 'audit_finding', 'quality_event')),
  source_reference text,
  case_title text not null,
  department_name text,
  case_status text not null default 'open'
    check (case_status in ('open', 'rca_in_progress', 'capa_planned', 'capa_in_progress', 'retest_pending', 'closed', 'accepted_risk')),
  severity text not null default 'medium'
    check (severity in ('critical', 'high', 'medium', 'low')),
  root_cause_summary text,
  capa_summary text,
  effectiveness_status text not null default 'not_tested'
    check (effectiveness_status in ('not_tested', 'effective', 'partially_effective', 'not_effective')),
  owner_id uuid,
  owner_name text,
  workflow_instance_id uuid references public.workflow_kernel_instances(id) on delete set null,
  due_date date,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, case_code)
);

create table if not exists public.quality_committee_decisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  committee_name text not null,
  meeting_date date not null,
  decision_code text not null,
  decision_title text not null,
  decision_status text not null default 'open'
    check (decision_status in ('open', 'assigned', 'implemented', 'verified', 'cancelled')),
  linked_source_type text,
  linked_source_id uuid,
  owner_id uuid,
  owner_name text,
  due_date date,
  workflow_instance_id uuid references public.workflow_kernel_instances(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, decision_code)
);

create table if not exists public.quality_survey_evidence_packs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  pack_code text not null,
  pack_title text not null,
  framework_code text not null,
  department_name text,
  pack_status text not null default 'draft'
    check (pack_status in ('draft', 'building', 'review', 'approved', 'rejected', 'archived')),
  evidence_item_count integer not null default 0,
  accepted_evidence_count integer not null default 0,
  rejected_evidence_count integer not null default 0,
  owner_id uuid,
  owner_name text,
  workflow_instance_id uuid references public.workflow_kernel_instances(id) on delete set null,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, pack_code)
);

create index if not exists idx_qao_import_org_status on public.quality_accreditation_content_import_batches(organization_id, framework_code, import_status);
create index if not exists idx_qao_requirement_org_status on public.quality_accreditation_requirement_operations(organization_id, standard_code, readiness_status, department_name);
create index if not exists idx_qao_scores_org_status on public.quality_accreditation_element_scores(organization_id, score_status, evidence_status, gap_severity);
create index if not exists idx_qao_indicator_org_domain on public.quality_indicator_definitions(organization_id, indicator_domain, is_active);
create index if not exists idx_qao_measurements_org_period on public.quality_indicator_measurements(organization_id, period_start, period_end, measurement_status);
create index if not exists idx_qao_tracers_org_status on public.quality_tracer_rounds(organization_id, tracer_status, round_date);
create index if not exists idx_qao_observations_org_status on public.quality_tracer_observations(organization_id, observation_status, severity, due_date);
create index if not exists idx_qao_rca_org_status on public.quality_rca_capa_cases(organization_id, case_status, severity, due_date);
create index if not exists idx_qao_committee_org_status on public.quality_committee_decisions(organization_id, decision_status, due_date);
create index if not exists idx_qao_packs_org_status on public.quality_survey_evidence_packs(organization_id, framework_code, pack_status);

alter table public.quality_accreditation_content_import_batches enable row level security;
alter table public.quality_accreditation_requirement_operations enable row level security;
alter table public.quality_accreditation_element_scores enable row level security;
alter table public.quality_indicator_definitions enable row level security;
alter table public.quality_indicator_measurements enable row level security;
alter table public.quality_tracer_rounds enable row level security;
alter table public.quality_tracer_observations enable row level security;
alter table public.quality_rca_capa_cases enable row level security;
alter table public.quality_committee_decisions enable row level security;
alter table public.quality_survey_evidence_packs enable row level security;

drop policy if exists quality_accreditation_content_import_batches_org_read on public.quality_accreditation_content_import_batches;
create policy quality_accreditation_content_import_batches_org_read on public.quality_accreditation_content_import_batches for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists quality_accreditation_content_import_batches_org_insert on public.quality_accreditation_content_import_batches;
create policy quality_accreditation_content_import_batches_org_insert on public.quality_accreditation_content_import_batches for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists quality_accreditation_content_import_batches_org_update on public.quality_accreditation_content_import_batches;
create policy quality_accreditation_content_import_batches_org_update on public.quality_accreditation_content_import_batches for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists quality_accreditation_requirement_operations_org_read on public.quality_accreditation_requirement_operations;
create policy quality_accreditation_requirement_operations_org_read on public.quality_accreditation_requirement_operations for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists quality_accreditation_requirement_operations_org_insert on public.quality_accreditation_requirement_operations;
create policy quality_accreditation_requirement_operations_org_insert on public.quality_accreditation_requirement_operations for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists quality_accreditation_requirement_operations_org_update on public.quality_accreditation_requirement_operations;
create policy quality_accreditation_requirement_operations_org_update on public.quality_accreditation_requirement_operations for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists quality_accreditation_element_scores_org_read on public.quality_accreditation_element_scores;
create policy quality_accreditation_element_scores_org_read on public.quality_accreditation_element_scores for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists quality_accreditation_element_scores_org_insert on public.quality_accreditation_element_scores;
create policy quality_accreditation_element_scores_org_insert on public.quality_accreditation_element_scores for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists quality_accreditation_element_scores_org_update on public.quality_accreditation_element_scores;
create policy quality_accreditation_element_scores_org_update on public.quality_accreditation_element_scores for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists quality_indicator_definitions_org_read on public.quality_indicator_definitions;
create policy quality_indicator_definitions_org_read on public.quality_indicator_definitions for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists quality_indicator_definitions_org_insert on public.quality_indicator_definitions;
create policy quality_indicator_definitions_org_insert on public.quality_indicator_definitions for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists quality_indicator_definitions_org_update on public.quality_indicator_definitions;
create policy quality_indicator_definitions_org_update on public.quality_indicator_definitions for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists quality_indicator_measurements_org_read on public.quality_indicator_measurements;
create policy quality_indicator_measurements_org_read on public.quality_indicator_measurements for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists quality_indicator_measurements_org_insert on public.quality_indicator_measurements;
create policy quality_indicator_measurements_org_insert on public.quality_indicator_measurements for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists quality_indicator_measurements_org_update on public.quality_indicator_measurements;
create policy quality_indicator_measurements_org_update on public.quality_indicator_measurements for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists quality_tracer_rounds_org_read on public.quality_tracer_rounds;
create policy quality_tracer_rounds_org_read on public.quality_tracer_rounds for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists quality_tracer_rounds_org_insert on public.quality_tracer_rounds;
create policy quality_tracer_rounds_org_insert on public.quality_tracer_rounds for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists quality_tracer_rounds_org_update on public.quality_tracer_rounds;
create policy quality_tracer_rounds_org_update on public.quality_tracer_rounds for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists quality_tracer_observations_org_read on public.quality_tracer_observations;
create policy quality_tracer_observations_org_read on public.quality_tracer_observations for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists quality_tracer_observations_org_insert on public.quality_tracer_observations;
create policy quality_tracer_observations_org_insert on public.quality_tracer_observations for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists quality_tracer_observations_org_update on public.quality_tracer_observations;
create policy quality_tracer_observations_org_update on public.quality_tracer_observations for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists quality_rca_capa_cases_org_read on public.quality_rca_capa_cases;
create policy quality_rca_capa_cases_org_read on public.quality_rca_capa_cases for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists quality_rca_capa_cases_org_insert on public.quality_rca_capa_cases;
create policy quality_rca_capa_cases_org_insert on public.quality_rca_capa_cases for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists quality_rca_capa_cases_org_update on public.quality_rca_capa_cases;
create policy quality_rca_capa_cases_org_update on public.quality_rca_capa_cases for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists quality_committee_decisions_org_read on public.quality_committee_decisions;
create policy quality_committee_decisions_org_read on public.quality_committee_decisions for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists quality_committee_decisions_org_insert on public.quality_committee_decisions;
create policy quality_committee_decisions_org_insert on public.quality_committee_decisions for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists quality_committee_decisions_org_update on public.quality_committee_decisions;
create policy quality_committee_decisions_org_update on public.quality_committee_decisions for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists quality_survey_evidence_packs_org_read on public.quality_survey_evidence_packs;
create policy quality_survey_evidence_packs_org_read on public.quality_survey_evidence_packs for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists quality_survey_evidence_packs_org_insert on public.quality_survey_evidence_packs;
create policy quality_survey_evidence_packs_org_insert on public.quality_survey_evidence_packs for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists quality_survey_evidence_packs_org_update on public.quality_survey_evidence_packs;
create policy quality_survey_evidence_packs_org_update on public.quality_survey_evidence_packs for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

create or replace view public.v_quality_accreditation_operating_summary
with (security_invoker = true) as
select
  coalesce(req.organization_id, ind.organization_id, tr.organization_id, rca.organization_id, pack.organization_id) as organization_id,
  count(distinct req.id)::integer as requirement_operation_count,
  count(distinct req.id) filter (where req.readiness_status in ('ready', 'evidence_submitted'))::integer as ready_requirement_count,
  count(distinct score.id) filter (where score.score_status in ('partially_met', 'not_met'))::integer as gap_score_count,
  count(distinct ind.id)::integer as indicator_count,
  count(distinct meas.id) filter (where meas.measurement_status in ('submitted', 'validated', 'published'))::integer as submitted_measurement_count,
  count(distinct tr.id) filter (where tr.tracer_status in ('planned', 'in_progress', 'follow_up'))::integer as active_tracer_count,
  count(distinct obs.id) filter (where obs.observation_status in ('open', 'requires_capa'))::integer as open_observation_count,
  count(distinct rca.id) filter (where rca.case_status not in ('closed', 'accepted_risk'))::integer as open_rca_capa_count,
  count(distinct pack.id) filter (where pack.pack_status in ('building', 'review', 'rejected'))::integer as evidence_pack_attention_count
from public.quality_accreditation_requirement_operations req
full join public.quality_indicator_definitions ind on ind.organization_id = req.organization_id
full join public.quality_tracer_rounds tr on tr.organization_id = coalesce(req.organization_id, ind.organization_id)
full join public.quality_rca_capa_cases rca on rca.organization_id = coalesce(req.organization_id, ind.organization_id, tr.organization_id)
full join public.quality_survey_evidence_packs pack on pack.organization_id = coalesce(req.organization_id, ind.organization_id, tr.organization_id, rca.organization_id)
left join public.quality_accreditation_element_scores score on score.requirement_operation_id = req.id
left join public.quality_indicator_measurements meas on meas.indicator_id = ind.id
left join public.quality_tracer_observations obs on obs.tracer_round_id = tr.id
group by coalesce(req.organization_id, ind.organization_id, tr.organization_id, rca.organization_id, pack.organization_id);

create or replace view public.v_quality_accreditation_requirement_dashboard
with (security_invoker = true) as
select
  req.organization_id,
  req.standard_code,
  req.chapter_code,
  req.requirement_reference,
  req.requirement_title,
  req.department_name,
  req.owner_name,
  req.applicability_status,
  req.readiness_status,
  req.target_survey_date,
  count(score.id)::integer as scoring_count,
  count(score.id) filter (where score.score_status in ('partially_met', 'not_met'))::integer as gap_count,
  count(score.id) filter (where score.evidence_status in ('submitted', 'accepted'))::integer as evidence_submitted_count,
  max(score.scored_at) as last_scored_at
from public.quality_accreditation_requirement_operations req
left join public.quality_accreditation_element_scores score on score.requirement_operation_id = req.id
group by req.organization_id, req.standard_code, req.chapter_code, req.requirement_reference, req.requirement_title, req.department_name, req.owner_name, req.applicability_status, req.readiness_status, req.target_survey_date;

create or replace view public.v_quality_indicator_dashboard
with (security_invoker = true) as
select
  def.organization_id,
  def.indicator_code,
  def.indicator_name,
  def.indicator_domain,
  def.owner_name,
  def.target_direction,
  def.target_value,
  latest.measured_value,
  latest.measurement_status,
  latest.period_end,
  case
    when latest.measured_value is null then 'not_measured'
    when def.target_direction = 'higher_is_better' and def.target_value is not null and latest.measured_value >= def.target_value then 'on_target'
    when def.target_direction = 'lower_is_better' and def.target_value is not null and latest.measured_value <= def.target_value then 'on_target'
    when def.warning_value is not null and def.target_direction = 'higher_is_better' and latest.measured_value >= def.warning_value then 'watch'
    when def.warning_value is not null and def.target_direction = 'lower_is_better' and latest.measured_value <= def.warning_value then 'watch'
    else 'off_target'
  end as performance_signal
from public.quality_indicator_definitions def
left join lateral (
  select m.measured_value, m.measurement_status, m.period_end
  from public.quality_indicator_measurements m
  where m.indicator_id = def.id
  order by m.period_end desc, m.created_at desc
  limit 1
) latest on true;

create or replace view public.v_quality_tracer_round_dashboard
with (security_invoker = true) as
select
  tr.organization_id,
  tr.tracer_code,
  tr.tracer_title,
  tr.tracer_type,
  tr.department_name,
  tr.tracer_status,
  tr.round_date,
  tr.lead_reviewer_name,
  count(obs.id)::integer as observation_count,
  count(obs.id) filter (where obs.observation_status in ('open', 'requires_capa'))::integer as open_observation_count,
  count(obs.id) filter (where obs.severity in ('critical', 'high') and obs.observation_status in ('open', 'requires_capa'))::integer as high_risk_observation_count
from public.quality_tracer_rounds tr
left join public.quality_tracer_observations obs on obs.tracer_round_id = tr.id
group by tr.organization_id, tr.tracer_code, tr.tracer_title, tr.tracer_type, tr.department_name, tr.tracer_status, tr.round_date, tr.lead_reviewer_name;

create or replace view public.v_quality_rca_capa_dashboard
with (security_invoker = true) as
select
  organization_id,
  case_code,
  source_type,
  source_reference,
  case_title,
  department_name,
  case_status,
  severity,
  effectiveness_status,
  owner_name,
  due_date,
  case
    when due_date is not null and due_date < current_date and case_status not in ('closed', 'accepted_risk') then 'overdue'
    when severity in ('critical', 'high') and case_status not in ('closed', 'accepted_risk') then 'high_priority'
    when due_date is not null and due_date <= current_date + interval '7 days' and case_status not in ('closed', 'accepted_risk') then 'due_soon'
    else 'normal'
  end as case_signal
from public.quality_rca_capa_cases;

comment on table public.quality_accreditation_content_import_batches is 'Patch 6 licensed/current standard import governance. Does not store copyrighted text by default.';
comment on table public.quality_accreditation_requirement_operations is 'Patch 6 operational ownership, applicability, workflow, and readiness status for accreditation requirements.';
comment on table public.quality_tracer_rounds is 'Patch 6 tracer round planning and execution for patient/system/department/document/environment tracers.';
comment on table public.quality_rca_capa_cases is 'Patch 6 OVR/tracer/mock survey/indicator/audit finding RCA-to-CAPA operating loop.';
comment on view public.v_quality_accreditation_operating_summary is 'Patch 6 quality/accreditation operating summary; security_invoker keeps RLS active.';
