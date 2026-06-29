-- Patch 2: Accreditation Standards Engine
-- Purpose: governed standards backbone for CBAHI/JCI/ISO accreditation readiness.
-- Important: this migration creates the engine only. Do not load copyrighted CBAHI/JCI
-- clause text unless your organization owns or licenses the current standard content.

create extension if not exists pgcrypto;

create table if not exists public.accreditation_standards (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_en text not null,
  name_ar text,
  authority text,
  standard_type text not null default 'healthcare_accreditation',
  licensing_note text not null default 'Load only organization-owned or licensed standard content.',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.accreditation_standard_versions (
  id uuid primary key default gen_random_uuid(),
  standard_id uuid not null references public.accreditation_standards(id) on delete cascade,
  version_label text not null,
  effective_from date,
  effective_to date,
  content_status text not null default 'empty_contract'
    check (content_status in ('empty_contract', 'draft', 'loaded', 'approved', 'retired')),
  approval_status text not null default 'not_approved'
    check (approval_status in ('not_approved', 'under_review', 'approved', 'retired')),
  approved_by uuid,
  approved_at timestamptz,
  notes text,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (standard_id, version_label)
);

create table if not exists public.accreditation_chapters (
  id uuid primary key default gen_random_uuid(),
  standard_version_id uuid not null references public.accreditation_standard_versions(id) on delete cascade,
  chapter_code text not null,
  title_en text not null,
  title_ar text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (standard_version_id, chapter_code)
);

create table if not exists public.accreditation_requirements (
  id uuid primary key default gen_random_uuid(),
  standard_version_id uuid not null references public.accreditation_standard_versions(id) on delete cascade,
  chapter_id uuid not null references public.accreditation_chapters(id) on delete cascade,
  requirement_code text not null,
  title_en text not null,
  title_ar text,
  description_en text,
  description_ar text,
  requirement_type text not null default 'standard'
    check (requirement_type in ('standard', 'policy', 'procedure', 'process', 'outcome', 'documented_evidence')),
  priority text not null default 'normal'
    check (priority in ('critical', 'high', 'normal', 'low')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (standard_version_id, requirement_code)
);

create table if not exists public.accreditation_measurable_elements (
  id uuid primary key default gen_random_uuid(),
  requirement_id uuid not null references public.accreditation_requirements(id) on delete cascade,
  element_code text not null,
  text_en text not null,
  text_ar text,
  scoring_weight numeric(10,2) not null default 1,
  is_mandatory boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (requirement_id, element_code)
);

create table if not exists public.accreditation_applicability_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  requirement_id uuid references public.accreditation_requirements(id) on delete cascade,
  measurable_element_id uuid references public.accreditation_measurable_elements(id) on delete cascade,
  department_id uuid,
  applicability_status text not null default 'not_assessed'
    check (applicability_status in ('applicable', 'not_applicable', 'not_assessed')),
  rationale text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requirement_id is not null or measurable_element_id is not null)
);

create table if not exists public.accreditation_survey_methods (
  id uuid primary key default gen_random_uuid(),
  measurable_element_id uuid not null references public.accreditation_measurable_elements(id) on delete cascade,
  method_code text not null,
  method_name_en text not null,
  method_name_ar text,
  instructions_en text,
  instructions_ar text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (measurable_element_id, method_code)
);

create table if not exists public.accreditation_required_evidence (
  id uuid primary key default gen_random_uuid(),
  measurable_element_id uuid not null references public.accreditation_measurable_elements(id) on delete cascade,
  evidence_type text not null,
  evidence_description_en text not null,
  evidence_description_ar text,
  frequency text,
  owner_role text,
  is_required boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.accreditation_scoring_rules (
  id uuid primary key default gen_random_uuid(),
  standard_version_id uuid not null references public.accreditation_standard_versions(id) on delete cascade,
  rule_code text not null,
  rule_name_en text not null,
  rule_name_ar text,
  score_min numeric(10,2) not null default 0,
  score_max numeric(10,2) not null default 100,
  passing_score numeric(10,2),
  rule_json jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (standard_version_id, rule_code)
);

create table if not exists public.accreditation_not_applicable_rationales (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  requirement_id uuid references public.accreditation_requirements(id) on delete cascade,
  measurable_element_id uuid references public.accreditation_measurable_elements(id) on delete cascade,
  department_id uuid,
  rationale text not null,
  evidence_reference text,
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'approved', 'rejected')),
  submitted_by uuid,
  approved_by uuid,
  submitted_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requirement_id is not null or measurable_element_id is not null)
);

create table if not exists public.accreditation_requirement_owners (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  requirement_id uuid not null references public.accreditation_requirements(id) on delete cascade,
  department_id uuid,
  owner_id uuid,
  owner_name text,
  responsibility text not null default 'primary_owner'
    check (responsibility in ('primary_owner', 'evidence_owner', 'reviewer', 'approver')),
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.accreditation_evidence_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  requirement_id uuid references public.accreditation_requirements(id) on delete cascade,
  measurable_element_id uuid references public.accreditation_measurable_elements(id) on delete cascade,
  evidence_id uuid,
  evidence_title text,
  evidence_url text,
  evidence_status text not null default 'missing'
    check (evidence_status in ('missing', 'requested', 'submitted', 'accepted', 'rejected', 'expired')),
  reviewer_id uuid,
  review_notes text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requirement_id is not null or measurable_element_id is not null)
);

create table if not exists public.accreditation_gap_findings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  requirement_id uuid not null references public.accreditation_requirements(id) on delete cascade,
  measurable_element_id uuid references public.accreditation_measurable_elements(id) on delete cascade,
  department_id uuid,
  gap_status text not null default 'open'
    check (gap_status in ('open', 'in_progress', 'evidence_submitted', 'ready_for_retest', 'closed', 'deferred')),
  severity text not null default 'medium'
    check (severity in ('critical', 'high', 'medium', 'low')),
  finding_text text not null,
  root_cause text,
  corrective_action_id uuid,
  owner_id uuid,
  owner_name text,
  due_date date,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.accreditation_mock_surveys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  standard_version_id uuid not null references public.accreditation_standard_versions(id) on delete cascade,
  survey_name text not null,
  survey_type text not null default 'mock_survey'
    check (survey_type in ('mock_survey', 'tracer', 'department_round', 'document_review')),
  survey_status text not null default 'planned'
    check (survey_status in ('planned', 'in_progress', 'completed', 'cancelled')),
  start_date date,
  end_date date,
  lead_surveyor_id uuid,
  lead_surveyor_name text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.accreditation_mock_survey_items (
  id uuid primary key default gen_random_uuid(),
  mock_survey_id uuid not null references public.accreditation_mock_surveys(id) on delete cascade,
  requirement_id uuid references public.accreditation_requirements(id) on delete cascade,
  measurable_element_id uuid references public.accreditation_measurable_elements(id) on delete cascade,
  department_id uuid,
  survey_method text,
  score numeric(10,2),
  compliance_status text not null default 'not_assessed'
    check (compliance_status in ('compliant', 'partially_compliant', 'non_compliant', 'not_applicable', 'not_assessed')),
  observation text,
  evidence_notes text,
  gap_finding_id uuid references public.accreditation_gap_findings(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requirement_id is not null or measurable_element_id is not null)
);

create table if not exists public.accreditation_readiness_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  standard_version_id uuid not null references public.accreditation_standard_versions(id) on delete cascade,
  readiness_score numeric(10,2) not null default 0,
  applicable_requirements integer not null default 0,
  covered_requirements integer not null default 0,
  open_gaps integer not null default 0,
  critical_gaps integer not null default 0,
  evidence_missing integer not null default 0,
  snapshot_status text not null default 'draft'
    check (snapshot_status in ('draft', 'reviewed', 'approved')),
  generated_by uuid,
  generated_at timestamptz not null default now(),
  notes text
);

create table if not exists public.accreditation_crosswalk_mappings (
  id uuid primary key default gen_random_uuid(),
  requirement_id uuid references public.accreditation_requirements(id) on delete cascade,
  measurable_element_id uuid references public.accreditation_measurable_elements(id) on delete cascade,
  mapped_framework text not null,
  mapped_reference_code text,
  mapped_item_type text not null,
  mapped_item_id uuid,
  mapping_strength text not null default 'partial'
    check (mapping_strength in ('strong', 'partial', 'weak', 'informational')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requirement_id is not null or measurable_element_id is not null)
);

create index if not exists idx_acc_versions_standard on public.accreditation_standard_versions(standard_id, is_current, approval_status);
create index if not exists idx_acc_chapters_version on public.accreditation_chapters(standard_version_id, sort_order);
create index if not exists idx_acc_requirements_version on public.accreditation_requirements(standard_version_id, requirement_code);
create index if not exists idx_acc_requirements_chapter on public.accreditation_requirements(chapter_id);
create index if not exists idx_acc_elements_requirement on public.accreditation_measurable_elements(requirement_id);
create index if not exists idx_acc_required_evidence_element on public.accreditation_required_evidence(measurable_element_id);
create index if not exists idx_acc_gaps_org_status on public.accreditation_gap_findings(organization_id, gap_status, severity);
create index if not exists idx_acc_evidence_org_status on public.accreditation_evidence_links(organization_id, evidence_status);
create index if not exists idx_acc_snapshots_org_version on public.accreditation_readiness_snapshots(organization_id, standard_version_id, generated_at desc);
create index if not exists idx_acc_crosswalk_requirement on public.accreditation_crosswalk_mappings(requirement_id, mapped_framework);

alter table public.accreditation_standards enable row level security;
alter table public.accreditation_standard_versions enable row level security;
alter table public.accreditation_chapters enable row level security;
alter table public.accreditation_requirements enable row level security;
alter table public.accreditation_measurable_elements enable row level security;
alter table public.accreditation_applicability_rules enable row level security;
alter table public.accreditation_survey_methods enable row level security;
alter table public.accreditation_required_evidence enable row level security;
alter table public.accreditation_scoring_rules enable row level security;
alter table public.accreditation_not_applicable_rationales enable row level security;
alter table public.accreditation_requirement_owners enable row level security;
alter table public.accreditation_evidence_links enable row level security;
alter table public.accreditation_gap_findings enable row level security;
alter table public.accreditation_mock_surveys enable row level security;
alter table public.accreditation_mock_survey_items enable row level security;
alter table public.accreditation_readiness_snapshots enable row level security;
alter table public.accreditation_crosswalk_mappings enable row level security;

-- Reference library read policies. These records contain only metadata/content that your
-- organization loads intentionally. Licensed clause text remains controlled by customer process.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'accreditation_standards',
    'accreditation_standard_versions',
    'accreditation_chapters',
    'accreditation_requirements',
    'accreditation_measurable_elements',
    'accreditation_survey_methods',
    'accreditation_required_evidence',
    'accreditation_scoring_rules',
    'accreditation_crosswalk_mappings'
  ] loop
    execute format('drop policy if exists %I on public.%I', table_name || '_authenticated_read', table_name);
    execute format('create policy %I on public.%I for select to authenticated using (true)', table_name || '_authenticated_read', table_name);
  end loop;
end $$;

-- Organization-scoped read/write policies for operating records.
do $do$
declare
  table_name text;
  org_expr text := $sql$coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')$sql$;
begin
  foreach table_name in array array[
    'accreditation_applicability_rules',
    'accreditation_not_applicable_rationales',
    'accreditation_requirement_owners',
    'accreditation_evidence_links',
    'accreditation_gap_findings',
    'accreditation_mock_surveys',
    'accreditation_readiness_snapshots'
  ] loop
    execute format('drop policy if exists %I on public.%I', table_name || '_org_read', table_name);
    execute format('create policy %I on public.%I for select to authenticated using (organization_id::text = %s)', table_name || '_org_read', table_name, org_expr);
    execute format('drop policy if exists %I on public.%I', table_name || '_org_insert', table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check (organization_id::text = %s)', table_name || '_org_insert', table_name, org_expr);
    execute format('drop policy if exists %I on public.%I', table_name || '_org_update', table_name);
    execute format('create policy %I on public.%I for update to authenticated using (organization_id::text = %s) with check (organization_id::text = %s)', table_name || '_org_update', table_name, org_expr, org_expr);
  end loop;
end $do$;

drop policy if exists accreditation_required_evidence_static_read on public.accreditation_required_evidence;
create policy accreditation_required_evidence_static_read on public.accreditation_required_evidence
for select to authenticated using (true);

drop policy if exists accreditation_evidence_links_static_read on public.accreditation_evidence_links;
create policy accreditation_evidence_links_static_read on public.accreditation_evidence_links
for select to authenticated using (
  organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
);

drop policy if exists accreditation_evidence_links_static_insert on public.accreditation_evidence_links;
create policy accreditation_evidence_links_static_insert on public.accreditation_evidence_links
for insert to authenticated with check (
  organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
);

drop policy if exists accreditation_evidence_links_static_update on public.accreditation_evidence_links;
create policy accreditation_evidence_links_static_update on public.accreditation_evidence_links
for update to authenticated using (
  organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
) with check (
  organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
);

drop policy if exists accreditation_gap_findings_static_read on public.accreditation_gap_findings;
create policy accreditation_gap_findings_static_read on public.accreditation_gap_findings
for select to authenticated using (
  organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
);

drop policy if exists accreditation_gap_findings_static_insert on public.accreditation_gap_findings;
create policy accreditation_gap_findings_static_insert on public.accreditation_gap_findings
for insert to authenticated with check (
  organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
);

drop policy if exists accreditation_gap_findings_static_update on public.accreditation_gap_findings;
create policy accreditation_gap_findings_static_update on public.accreditation_gap_findings
for update to authenticated using (
  organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
) with check (
  organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
);

-- Mock survey items inherit organization from their parent mock survey.
drop policy if exists accreditation_mock_survey_items_org_read on public.accreditation_mock_survey_items;
create policy accreditation_mock_survey_items_org_read on public.accreditation_mock_survey_items
for select to authenticated using (
  exists (
    select 1 from public.accreditation_mock_surveys s
    where s.id = mock_survey_id
      and s.organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
  )
);

drop policy if exists accreditation_mock_survey_items_org_insert on public.accreditation_mock_survey_items;
create policy accreditation_mock_survey_items_org_insert on public.accreditation_mock_survey_items
for insert to authenticated with check (
  exists (
    select 1 from public.accreditation_mock_surveys s
    where s.id = mock_survey_id
      and s.organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
  )
);

drop policy if exists accreditation_mock_survey_items_org_update on public.accreditation_mock_survey_items;
create policy accreditation_mock_survey_items_org_update on public.accreditation_mock_survey_items
for update to authenticated using (
  exists (
    select 1 from public.accreditation_mock_surveys s
    where s.id = mock_survey_id
      and s.organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
  )
) with check (
  exists (
    select 1 from public.accreditation_mock_surveys s
    where s.id = mock_survey_id
      and s.organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
  )
);

create or replace view public.v_accreditation_readiness_summary as
select
  s.code as standard_code,
  s.name_en as standard_name_en,
  s.name_ar as standard_name_ar,
  v.id as standard_version_id,
  v.version_label,
  v.content_status,
  v.approval_status,
  count(distinct c.id)::integer as chapter_count,
  count(distinct r.id)::integer as requirement_count,
  count(distinct me.id)::integer as measurable_element_count,
  count(distinct ev.id)::integer as evidence_rule_count,
  count(distinct gf.id)::integer as open_gap_count,
  max(rs.generated_at) as latest_snapshot_at,
  (
    select rs2.readiness_score
    from public.accreditation_readiness_snapshots rs2
    where rs2.standard_version_id = v.id
    order by rs2.generated_at desc
    limit 1
  ) as latest_readiness_score
from public.accreditation_standards s
join public.accreditation_standard_versions v on v.standard_id = s.id
left join public.accreditation_chapters c on c.standard_version_id = v.id and c.is_active
left join public.accreditation_requirements r on r.standard_version_id = v.id and r.is_active
left join public.accreditation_measurable_elements me on me.requirement_id = r.id and me.is_active
left join public.accreditation_required_evidence ev on ev.measurable_element_id = me.id and ev.is_required
left join public.accreditation_gap_findings gf on gf.requirement_id = r.id and gf.gap_status not in ('closed', 'deferred')
left join public.accreditation_readiness_snapshots rs on rs.standard_version_id = v.id
where s.is_active
group by s.code, s.name_en, s.name_ar, v.id, v.version_label, v.content_status, v.approval_status;

create or replace view public.v_accreditation_requirement_matrix as
select
  s.code as standard_code,
  v.version_label,
  c.chapter_code,
  c.title_en as chapter_title_en,
  r.id as requirement_id,
  r.requirement_code,
  r.title_en as requirement_title_en,
  r.title_ar as requirement_title_ar,
  r.requirement_type,
  r.priority,
  count(distinct me.id)::integer as measurable_element_count,
  count(distinct ev.id)::integer as evidence_rule_count,
  count(distinct x.id)::integer as crosswalk_count
from public.accreditation_standards s
join public.accreditation_standard_versions v on v.standard_id = s.id
join public.accreditation_chapters c on c.standard_version_id = v.id
join public.accreditation_requirements r on r.chapter_id = c.id
left join public.accreditation_measurable_elements me on me.requirement_id = r.id and me.is_active
left join public.accreditation_required_evidence ev on ev.measurable_element_id = me.id and ev.is_required
left join public.accreditation_crosswalk_mappings x on x.requirement_id = r.id
group by s.code, v.version_label, c.chapter_code, c.title_en, r.id, r.requirement_code, r.title_en, r.title_ar, r.requirement_type, r.priority;

create or replace view public.v_accreditation_gap_dashboard as
select
  gf.organization_id,
  s.code as standard_code,
  v.version_label,
  r.requirement_code,
  r.title_en as requirement_title_en,
  gf.severity,
  gf.gap_status,
  count(*)::integer as gap_count,
  min(gf.due_date) as nearest_due_date
from public.accreditation_gap_findings gf
join public.accreditation_requirements r on r.id = gf.requirement_id
join public.accreditation_standard_versions v on v.id = r.standard_version_id
join public.accreditation_standards s on s.id = v.standard_id
group by gf.organization_id, s.code, v.version_label, r.requirement_code, r.title_en, gf.severity, gf.gap_status;

comment on table public.accreditation_standards is 'Patch 2 standards registry. Do not load copyrighted standards unless licensed/owned by the organization.';
comment on table public.accreditation_requirements is 'Clause/requirement level accreditation contract; content must come from licensed/current sources.';
comment on table public.accreditation_measurable_elements is 'Measurable element level scoring and evidence backbone.';
comment on table public.accreditation_gap_findings is 'Accreditation gap finding register linked to requirement/measurable element and CAPA.';

insert into public.accreditation_standards (code, name_en, name_ar, authority, standard_type, licensing_note)
values
  ('CBAHI', 'CBAHI Healthcare Accreditation', 'اعتماد سباهي للرعاية الصحية', 'CBAHI', 'healthcare_accreditation', 'Load only licensed/current CBAHI content owned by the organization.'),
  ('JCI', 'JCI Hospital Accreditation', 'اعتماد المستشفيات من اللجنة الدولية المشتركة', 'Joint Commission International', 'healthcare_accreditation', 'Load only licensed/current JCI content owned by the organization.'),
  ('ISO_9001', 'ISO 9001 Quality Management System', 'آيزو 9001 لنظام إدارة الجودة', 'ISO', 'quality_management', 'Reference framework metadata only.'),
  ('ISO_37301', 'ISO 37301 Compliance Management System', 'آيزو 37301 لنظام إدارة الالتزام', 'ISO', 'compliance_management', 'Reference framework metadata only.'),
  ('ISO_31000', 'ISO 31000 Risk Management', 'آيزو 31000 لإدارة المخاطر', 'ISO', 'risk_management', 'Reference framework metadata only.'),
  ('IIA_GIAS', 'IIA Global Internal Audit Standards', 'المعايير العالمية للتدقيق الداخلي', 'IIA', 'internal_audit', 'Reference framework metadata only.'),
  ('NIST_CSF', 'NIST Cybersecurity Framework 2.0', 'إطار الأمن السيبراني NIST CSF 2.0', 'NIST', 'cybersecurity', 'Reference framework metadata only.')
on conflict (code) do update
set name_en = excluded.name_en,
    name_ar = excluded.name_ar,
    authority = excluded.authority,
    standard_type = excluded.standard_type,
    licensing_note = excluded.licensing_note,
    updated_at = now();

insert into public.accreditation_standard_versions (standard_id, version_label, content_status, approval_status, is_current, notes)
select id, 'content-to-be-loaded-by-owner', 'empty_contract', 'not_approved', true, 'Patch 2 creates metadata only. Load licensed/current content through controlled import.'
from public.accreditation_standards
where code in ('CBAHI', 'JCI', 'ISO_9001', 'ISO_37301', 'ISO_31000', 'IIA_GIAS', 'NIST_CSF')
on conflict (standard_id, version_label) do update
set content_status = excluded.content_status,
    approval_status = excluded.approval_status,
    is_current = excluded.is_current,
    notes = excluded.notes,
    updated_at = now();
