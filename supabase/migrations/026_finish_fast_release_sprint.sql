-- =========================================================
-- GRC Control Center - Migration 026
-- Finish Fast Release Sprint, acceptance tests, cutover plan,
-- consolidation artifacts and final go-live gateboard
-- =========================================================

create extension if not exists "pgcrypto";

-- =========================
-- ENUMS
-- =========================

do $$ begin
  create type final_gate_status as enum ('pending', 'in_progress', 'pass', 'warning', 'blocked', 'accepted_risk', 'not_applicable');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type final_test_status as enum ('not_run', 'pass', 'fail', 'warning', 'blocked');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type final_cutover_status as enum ('not_started', 'ready', 'in_progress', 'done', 'blocked', 'cancelled');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type final_artifact_status as enum ('draft', 'ready', 'verified', 'blocked', 'archived');
exception when duplicate_object then null;
end $$;

-- =========================
-- FINAL RELEASE SPRINT TABLES
-- =========================

create table if not exists final_release_sprint_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  release_tag text not null default 'v3.0-rc-final-sprint',
  gate_code text not null,
  gate_group text not null,
  title text not null,
  description text,
  owner_label text,
  severity text not null default 'high' check (severity in ('critical','high','medium','low')),
  status final_gate_status not null default 'pending',
  evidence_required boolean not null default true,
  evidence_note text,
  target_date date,
  sequence_no integer not null default 100,
  go_live_blocking boolean not null default true,
  created_by uuid references profiles(id) on delete set null,
  updated_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, gate_code)
);

create table if not exists final_acceptance_test_results (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  test_code text not null,
  test_area text not null,
  title text not null,
  persona text,
  expected_result text not null,
  status final_test_status not null default 'not_run',
  is_critical boolean not null default true,
  evidence_note text,
  failure_note text,
  tested_by uuid references profiles(id) on delete set null,
  tested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, test_code)
);

create table if not exists final_cutover_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  phase_name text not null,
  sequence_no integer not null default 100,
  title text not null,
  owner_label text,
  planned_window text,
  rollback_note text,
  status final_cutover_status not null default 'not_started',
  is_critical boolean not null default true,
  evidence_note text,
  completed_by uuid references profiles(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, phase_name, sequence_no, title)
);

create table if not exists final_consolidation_artifacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  artifact_code text not null,
  title text not null,
  artifact_type text not null,
  status final_artifact_status not null default 'draft',
  owner_label text,
  file_path text,
  verification_note text,
  verified_by uuid references profiles(id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, artifact_code)
);

create table if not exists final_ui_polish_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  screen_key text not null,
  title text not null,
  issue_type text not null default 'polish',
  severity text not null default 'medium' check (severity in ('critical','high','medium','low')),
  status final_gate_status not null default 'pending',
  notes text,
  owner_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, screen_key, title)
);

-- =========================
-- UPDATED_AT TRIGGERS
-- =========================

drop trigger if exists trg_final_release_sprint_items_updated_at on final_release_sprint_items;
create trigger trg_final_release_sprint_items_updated_at
before update on final_release_sprint_items
for each row execute function set_updated_at();

drop trigger if exists trg_final_acceptance_test_results_updated_at on final_acceptance_test_results;
create trigger trg_final_acceptance_test_results_updated_at
before update on final_acceptance_test_results
for each row execute function set_updated_at();

drop trigger if exists trg_final_cutover_tasks_updated_at on final_cutover_tasks;
create trigger trg_final_cutover_tasks_updated_at
before update on final_cutover_tasks
for each row execute function set_updated_at();

drop trigger if exists trg_final_consolidation_artifacts_updated_at on final_consolidation_artifacts;
create trigger trg_final_consolidation_artifacts_updated_at
before update on final_consolidation_artifacts
for each row execute function set_updated_at();

drop trigger if exists trg_final_ui_polish_items_updated_at on final_ui_polish_items;
create trigger trg_final_ui_polish_items_updated_at
before update on final_ui_polish_items
for each row execute function set_updated_at();

-- =========================
-- DEFAULT SEED FUNCTION
-- =========================

create or replace function seed_final_release_defaults()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  org record;
begin
  for org in select id from organizations loop
    insert into final_release_sprint_items (organization_id, gate_code, gate_group, title, description, owner_label, severity, status, target_date, sequence_no, go_live_blocking, evidence_note)
    values
      (org.id, 'MIG-FRESH-001-026', 'migration', 'Fresh Supabase migration run from 001 to 026', 'Run every migration in a clean staging project and record evidence.', 'System Admin', 'critical', 'blocked', current_date + 7, 10, true, 'Migration verifier screenshot required.'),
      (org.id, 'RLS-PERSONA-MATRIX', 'security', 'RLS persona matrix completed', 'CEO, Governance, Department Manager, Quality, Auditor and Employee personas tested.', 'Access Control Admin', 'critical', 'blocked', current_date + 8, 20, true, 'Persona lab export required.'),
      (org.id, 'BACKUP-RESTORE-DRYRUN', 'backup', 'Backup and restore dry-run completed', 'Database and storage restore evidence required.', 'IT / Governance', 'critical', 'warning', current_date + 9, 30, true, 'Restore dry-run record required.'),
      (org.id, 'AR-RTL-FINAL-QA', 'bilingual', 'Arabic/RTL final QA completed', 'Review high-traffic pages, OVR, reports and print layouts.', 'Governance Admin', 'high', 'warning', current_date + 10, 40, false, 'Translation coverage export.'),
      (org.id, 'OVR-END-TO-END', 'quality', 'OVR end-to-end scenario passed', 'Reporter to Supervisor/HOD to Quality to corrective action to evidence closure.', 'Quality Manager', 'critical', 'pending', current_date + 11, 50, true, 'OVR workflow screenshot required.'),
      (org.id, 'EXPORT-PACKAGE-READY', 'reporting', 'Export and board pack package verified', 'External JSON/CSV report pack generated and reviewed.', 'Governance Admin', 'medium', 'pending', current_date + 12, 60, false, 'Export package file and report preview.'),
      (org.id, 'PILOT-ACCESS-LIST', 'rollout', 'Pilot department access list approved', 'Limit first rollout to control departments and selected managers.', 'Executive Sponsor', 'high', 'pending', current_date + 12, 70, true, 'Approved pilot access list.')
    on conflict (organization_id, gate_code) do update set
      title = excluded.title,
      description = excluded.description,
      owner_label = excluded.owner_label,
      severity = excluded.severity,
      sequence_no = excluded.sequence_no,
      go_live_blocking = excluded.go_live_blocking;

    insert into final_acceptance_test_results (organization_id, test_code, test_area, title, persona, expected_result, status, is_critical)
    values
      (org.id, 'EMP-MYWORK-ONLY', 'rls', 'Employee sees only assigned tasks and own submitted OVRs', 'employee', 'No executive, other department or confidential OVR data is visible.', 'not_run', true),
      (org.id, 'DEPT-SCOPE', 'rls', 'Department Manager sees department scope only', 'department_manager', 'Own department data visible; unrelated department data hidden.', 'not_run', true),
      (org.id, 'OVR-QUALITY-CLOSE', 'ovr', 'Quality-only OVR closure with accepted evidence', 'quality', 'Closure blocked until evidence and Quality closure comments exist.', 'not_run', true),
      (org.id, 'NO-SELF-APPROVAL', 'workflow', 'Self-approval is blocked', 'project_owner', 'Owner cannot approve own request.', 'not_run', true),
      (org.id, 'EXPORT-BACKUP-HEALTH', 'backup', 'Export package and backup health snapshot created', 'governance_admin', 'External package generated and restore dry-run plan documented.', 'warning', true),
      (org.id, 'AR-RTL-HIGH-TRAFFIC', 'bilingual', 'Arabic/RTL high-traffic screen review completed', 'governance_admin', 'Home, Command, OVR, My Work, Reports and Admin screens are usable in Arabic.', 'not_run', false)
    on conflict (organization_id, test_code) do update set
      title = excluded.title,
      expected_result = excluded.expected_result,
      is_critical = excluded.is_critical;

    insert into final_cutover_tasks (organization_id, phase_name, sequence_no, title, owner_label, planned_window, rollback_note, status, is_critical, evidence_note)
    values
      (org.id, 'T-7 days', 10, 'Freeze migrations and create final consolidated release ZIP', 'System Admin', 'One week before go-live', 'Rollback to last validated patch set.', 'not_started', true, 'Final ZIP checksum and migration list.'),
      (org.id, 'T-3 days', 20, 'Run backup/export package and database/storage backup', 'IT / Governance', 'Three days before go-live', 'Restore staging from backup to confirm viability.', 'not_started', true, 'Backup run IDs and restore dry-run.'),
      (org.id, 'T-1 day', 30, 'Run acceptance test script with five key personas', 'Governance Admin', 'One day before go-live', 'Delay rollout if any critical persona fails.', 'not_started', true, 'QA export signed off.'),
      (org.id, 'Go-live day', 40, 'Enable production access for pilot departments only', 'Super Admin', 'Morning go-live window', 'Disable invitations and restore previous access list.', 'not_started', true, 'Pilot access list.'),
      (org.id, 'T+7 days', 50, 'Review incidents, performance, access warnings and user feedback', 'Executive Sponsor', 'First week review', 'Pause rollout wave 2 if blockers remain.', 'not_started', false, 'Week-one executive report.')
    on conflict (organization_id, phase_name, sequence_no, title) do update set
      owner_label = excluded.owner_label,
      rollback_note = excluded.rollback_note,
      is_critical = excluded.is_critical;

    insert into final_consolidation_artifacts (organization_id, artifact_code, title, artifact_type, status, owner_label, file_path, verification_note)
    values
      (org.id, 'FINAL-ZIP', 'Final consolidated release ZIP', 'release_package', 'draft', 'System Admin', null, 'Create after migration run is verified.'),
      (org.id, 'MIGRATION-ORDER', 'Migration order and verification runbook', 'runbook', 'ready', 'System Admin', 'docs/FRESH_INSTALL_MIGRATION_ORDER.md', 'Included in patch.'),
      (org.id, 'ACCEPTANCE-SCRIPT', 'Final acceptance test script', 'qa_script', 'ready', 'Governance Admin', 'docs/ACCEPTANCE_TEST_SCRIPT.md', 'Included in patch.'),
      (org.id, 'CUTOVER-PLAYBOOK', 'Go-live cutover playbook', 'playbook', 'ready', 'Executive Sponsor', 'docs/FINAL_GO_LIVE_PLAYBOOK.md', 'Included in patch.'),
      (org.id, 'CONSOLIDATION-PLAN', 'Patch consolidation plan', 'runbook', 'ready', 'System Admin', 'docs/PATCH_CONSOLIDATION_PLAN.md', 'Included in patch.')
    on conflict (organization_id, artifact_code) do update set
      title = excluded.title,
      artifact_type = excluded.artifact_type,
      file_path = excluded.file_path,
      verification_note = excluded.verification_note;

    insert into final_ui_polish_items (organization_id, screen_key, title, issue_type, severity, status, notes, owner_label)
    values
      (org.id, 'home', 'Home launchpad spacing and mobile wrapping', 'polish', 'medium', 'pending', 'Final responsive check after applying v3.0.', 'UI Owner'),
      (org.id, 'ovr', 'OVR form Arabic/English review and print layout', 'bilingual', 'high', 'warning', 'Healthcare form must be reviewed by Quality before rollout.', 'Quality Manager'),
      (org.id, 'reports', 'CSV/JSON export labels and report filters', 'bilingual', 'medium', 'pending', 'Ensure exported columns are understood by finance/governance users.', 'Governance Admin'),
      (org.id, 'admin', 'Danger actions require confirmation wording', 'safety', 'high', 'pending', 'Confirm reset/import/role-change language before production.', 'System Admin')
    on conflict (organization_id, screen_key, title) do update set
      issue_type = excluded.issue_type,
      severity = excluded.severity,
      notes = excluded.notes,
      owner_label = excluded.owner_label;
  end loop;

  return 'Final release defaults seeded.';
end;
$$;

-- Seed on migration for immediate visibility.
select seed_final_release_defaults();

-- =========================
-- INDEXES
-- =========================

create index if not exists idx_final_sprint_org_status on final_release_sprint_items(organization_id, status, severity);
create index if not exists idx_final_sprint_blocking on final_release_sprint_items(organization_id, go_live_blocking, status);
create index if not exists idx_final_acceptance_org_status on final_acceptance_test_results(organization_id, status, is_critical);
create index if not exists idx_final_cutover_org_status on final_cutover_tasks(organization_id, status, sequence_no);
create index if not exists idx_final_artifacts_org_status on final_consolidation_artifacts(organization_id, status);
create index if not exists idx_final_ui_polish_org_status on final_ui_polish_items(organization_id, status, severity);

-- =========================
-- VIEWS
-- =========================

create or replace view v_final_go_live_gateboard as
select
  id,
  organization_id,
  release_tag,
  gate_code,
  gate_group,
  title,
  description,
  owner_label,
  severity,
  status,
  evidence_required,
  evidence_note,
  target_date,
  sequence_no,
  go_live_blocking,
  case
    when status = 'blocked' then 100
    when status = 'warning' and go_live_blocking then 80
    when status = 'warning' then 50
    when status = 'pending' and go_live_blocking then 60
    when status = 'in_progress' then 30
    else 0
  end as gate_weight
from final_release_sprint_items;

create or replace view v_final_acceptance_tests as
select
  id,
  organization_id,
  test_code,
  test_area,
  title,
  persona,
  expected_result,
  status,
  is_critical,
  evidence_note,
  failure_note,
  tested_by,
  tested_at
from final_acceptance_test_results;

create or replace view v_final_cutover_plan as
select
  id,
  organization_id,
  phase_name,
  sequence_no,
  title,
  owner_label,
  planned_window,
  rollback_note,
  status,
  is_critical,
  evidence_note,
  completed_by,
  completed_at
from final_cutover_tasks;

create or replace view v_final_consolidation_artifacts as
select
  id,
  organization_id,
  artifact_code,
  title,
  artifact_type,
  status,
  owner_label,
  file_path,
  verification_note,
  verified_by,
  verified_at
from final_consolidation_artifacts;

create or replace view v_final_owner_clearance as
select
  organization_id,
  coalesce(owner_label, 'Unassigned') as owner_label,
  count(*)::integer as total_items,
  count(*) filter (where status = 'blocked')::integer as blocked_items,
  count(*) filter (where status = 'warning')::integer as warning_items,
  count(*) filter (where status = 'pass')::integer as passed_items,
  count(*) filter (where status in ('pending','in_progress'))::integer as pending_items,
  case
    when count(*) filter (where status = 'blocked') > 0 then 'blocked'
    when count(*) filter (where status in ('warning','pending','in_progress')) > 0 then 'watch'
    else 'clear'
  end as clearance_signal
from final_release_sprint_items
group by organization_id, coalesce(owner_label, 'Unassigned');

create or replace view v_final_finish_fast_scorecard as
select
  o.id as organization_id,
  'v3.0-rc-final-sprint'::text as release_tag,
  greatest(0, least(100,
    100
    - (select count(*) * 18 from final_release_sprint_items g where g.organization_id = o.id and g.status = 'blocked' and g.go_live_blocking = true)
    - (select count(*) * 8 from final_release_sprint_items g where g.organization_id = o.id and g.status = 'warning')
    - (select count(*) * 5 from final_release_sprint_items g where g.organization_id = o.id and g.status in ('pending','in_progress') and g.go_live_blocking = true)
    - (select count(*) * 12 from final_acceptance_test_results t where t.organization_id = o.id and t.status in ('fail','blocked') and t.is_critical = true)
  ))::integer as go_live_score,
  (select count(*) from final_release_sprint_items g where g.organization_id = o.id and g.status = 'blocked')::integer as blockers,
  (select count(*) from final_release_sprint_items g where g.organization_id = o.id and g.status = 'warning')::integer as warnings,
  (select count(*) from final_release_sprint_items g where g.organization_id = o.id and g.status = 'pass')::integer as passed,
  (select count(*) from final_release_sprint_items g where g.organization_id = o.id and g.status in ('pending','in_progress'))::integer as pending,
  (select count(*) from final_release_sprint_items g where g.organization_id = o.id and g.gate_group = 'migration' and g.status in ('blocked','warning','pending'))::integer as migration_blocked,
  (select count(*) from final_release_sprint_items g where g.organization_id = o.id and g.gate_group = 'security' and g.status in ('blocked','warning','pending'))::integer as rls_blocked,
  (select count(*) from final_release_sprint_items g where g.organization_id = o.id and g.gate_group = 'backup' and g.status in ('blocked','warning','pending'))::integer as backup_blocked,
  (select count(*) from final_release_sprint_items g where g.organization_id = o.id and g.gate_group = 'bilingual' and g.status in ('blocked','warning','pending'))::integer as bilingual_warnings,
  (select count(*) from final_ui_polish_items u where u.organization_id = o.id and u.severity = 'critical' and u.status not in ('pass','not_applicable'))::integer as open_critical_issues,
  (select count(*) from final_ui_polish_items u where u.organization_id = o.id and u.severity = 'high' and u.status not in ('pass','not_applicable'))::integer as open_high_issues,
  case
    when exists (select 1 from final_release_sprint_items g where g.organization_id = o.id and g.status = 'blocked' and g.go_live_blocking = true) then 'blocked'
    when exists (select 1 from final_release_sprint_items g where g.organization_id = o.id and g.status in ('warning','pending','in_progress') and g.go_live_blocking = true) then 'conditional'
    else 'ready'
  end as ready_signal
from organizations o;

-- =========================
-- RLS
-- =========================

alter table final_release_sprint_items enable row level security;
alter table final_acceptance_test_results enable row level security;
alter table final_cutover_tasks enable row level security;
alter table final_consolidation_artifacts enable row level security;
alter table final_ui_polish_items enable row level security;

-- Safe default read policies for authenticated users. Existing role-specific RLS can be tightened later.
do $$ begin
  create policy final_release_sprint_read on final_release_sprint_items for select to authenticated using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy final_acceptance_tests_read on final_acceptance_test_results for select to authenticated using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy final_cutover_read on final_cutover_tasks for select to authenticated using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy final_artifacts_read on final_consolidation_artifacts for select to authenticated using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy final_ui_polish_read on final_ui_polish_items for select to authenticated using (true);
exception when duplicate_object then null;
end $$;
