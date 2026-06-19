-- =========================================================
-- GRC Control Center - Migration 028
-- Final Release Factory, consolidation evidence, handover signoff
-- =========================================================

create extension if not exists "pgcrypto";

create table if not exists release_factory_checks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  release_tag text not null default 'v3.2-final-release-factory',
  check_code text not null,
  check_group text not null,
  title text not null,
  description text,
  owner_label text,
  status text not null default 'pending' check (status in ('pending','in_progress','passed','warning','blocked','accepted_risk','not_applicable')),
  severity text not null default 'medium' check (severity in ('critical','high','medium','low')),
  evidence_required boolean not null default true,
  evidence_note text,
  sequence_no integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, release_tag, check_code)
);

create table if not exists consolidated_release_packages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  release_tag text not null default 'v3.2-final-release-factory',
  package_code text not null,
  title text not null,
  package_type text not null,
  status text not null default 'draft' check (status in ('draft','generated','verified','approved','blocked')),
  file_path text,
  checksum_note text,
  owner_label text,
  generated_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, release_tag, package_code)
);

create table if not exists final_handover_signoffs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  release_tag text not null default 'v3.2-final-release-factory',
  signoff_area text not null,
  owner_label text not null,
  status text not null default 'not_started' check (status in ('not_started','in_progress','signed_off','blocked','accepted_risk')),
  evidence_note text,
  signed_at timestamptz,
  sequence_no integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, release_tag, signoff_area)
);

create index if not exists idx_release_factory_checks_org on release_factory_checks(organization_id, release_tag);
create index if not exists idx_release_factory_checks_status on release_factory_checks(status, severity);
create index if not exists idx_release_factory_checks_group on release_factory_checks(check_group);
create index if not exists idx_consolidated_release_packages_org on consolidated_release_packages(organization_id, release_tag);
create index if not exists idx_final_handover_signoffs_org on final_handover_signoffs(organization_id, release_tag);

create or replace view v_release_factory_checks as
select
  id,
  organization_id,
  release_tag,
  check_code,
  check_group,
  title,
  description,
  owner_label,
  status,
  severity,
  evidence_required,
  evidence_note,
  sequence_no,
  created_at,
  updated_at
from release_factory_checks;

create or replace view v_consolidated_release_packages as
select
  id,
  organization_id,
  release_tag,
  package_code,
  title,
  package_type,
  status,
  file_path,
  checksum_note,
  owner_label,
  generated_at,
  verified_at,
  created_at,
  updated_at
from consolidated_release_packages;

create or replace view v_final_handover_signoffs as
select
  id,
  organization_id,
  release_tag,
  signoff_area,
  owner_label,
  status,
  evidence_note,
  signed_at,
  sequence_no,
  created_at,
  updated_at
from final_handover_signoffs;

create or replace view v_release_factory_scorecard as
with orgs as (
  select id as organization_id from organizations limit 1
), checks as (
  select
    organization_id,
    count(*) as total_checks,
    count(*) filter (where status = 'passed') as passed_checks,
    count(*) filter (where status = 'blocked') as blocked_checks,
    count(*) filter (where status = 'warning') as warning_checks,
    count(*) filter (where status in ('pending','in_progress')) as pending_checks,
    count(*) filter (where check_group = 'migration') as migration_checks,
    count(*) filter (where check_group = 'security') as rls_checks,
    count(*) filter (where check_group = 'backup') as backup_checks,
    count(*) filter (where check_group = 'bilingual') as bilingual_checks,
    count(*) filter (where check_group = 'ui') as ui_checks,
    count(*) filter (where check_group = 'handover') as handover_checks
  from release_factory_checks
  group by organization_id
)
select
  o.organization_id,
  'v3.2-final-release-factory' as release_tag,
  coalesce(c.total_checks, 0) as total_checks,
  coalesce(c.passed_checks, 0) as passed_checks,
  coalesce(c.blocked_checks, 0) as blocked_checks,
  coalesce(c.warning_checks, 0) as warning_checks,
  coalesce(c.pending_checks, 0) as pending_checks,
  coalesce(c.migration_checks, 0) as migration_checks,
  coalesce(c.rls_checks, 0) as rls_checks,
  coalesce(c.backup_checks, 0) as backup_checks,
  coalesce(c.bilingual_checks, 0) as bilingual_checks,
  coalesce(c.ui_checks, 0) as ui_checks,
  coalesce(c.handover_checks, 0) as handover_checks,
  case
    when coalesce(c.total_checks, 0) = 0 then 0
    else greatest(0, least(100, round(((coalesce(c.passed_checks, 0) * 100.0) + (coalesce(c.warning_checks, 0) * 50.0) + (coalesce(c.accepted_risk_checks, 0) * 70.0)) / nullif(c.total_checks, 0))))::int
  end as final_score,
  case
    when coalesce(c.blocked_checks, 0) > 0 then 'blocked'
    when coalesce(c.warning_checks, 0) > 0 or coalesce(c.pending_checks, 0) > 0 then 'conditional'
    else 'go'
  end as ready_signal
from orgs o
left join (
  select
    organization_id,
    count(*) as total_checks,
    count(*) filter (where status = 'passed') as passed_checks,
    count(*) filter (where status = 'blocked') as blocked_checks,
    count(*) filter (where status = 'warning') as warning_checks,
    count(*) filter (where status in ('pending','in_progress')) as pending_checks,
    count(*) filter (where status = 'accepted_risk') as accepted_risk_checks,
    count(*) filter (where check_group = 'migration') as migration_checks,
    count(*) filter (where check_group = 'security') as rls_checks,
    count(*) filter (where check_group = 'backup') as backup_checks,
    count(*) filter (where check_group = 'bilingual') as bilingual_checks,
    count(*) filter (where check_group = 'ui') as ui_checks,
    count(*) filter (where check_group = 'handover') as handover_checks
  from release_factory_checks
  group by organization_id
) c on c.organization_id = o.organization_id;

create or replace function seed_release_factory_defaults()
returns text
language plpgsql
security definer
as $$
declare
  org_id uuid;
begin
  select id into org_id from organizations limit 1;
  if org_id is null then
    insert into organizations (name_en, name_ar)
    values ('Al Modawat Specialized Medical Company', 'شركة المداواة التخصصية الطبية')
    returning id into org_id;
  end if;

  insert into release_factory_checks (organization_id, check_code, check_group, title, description, owner_label, status, severity, evidence_required, evidence_note, sequence_no)
  values
    (org_id, 'CODEBASE-CONSOLIDATED', 'consolidation', 'Single clean codebase created from all patches', 'Apply patches in order and remove obsolete duplicate files before pilot.', 'System Admin', 'pending', 'critical', true, 'Final repository commit hash and build output.', 10),
    (org_id, 'MIGRATIONS-BUNDLED', 'migration', 'Migrations bundled and verified in order', 'Generate migration manifest and run in a fresh Supabase staging project.', 'System Admin', 'blocked', 'critical', true, 'Migration manifest and Supabase fresh-run evidence.', 20),
    (org_id, 'RLS-PERSONA-PASS', 'security', 'RLS personas passed', 'Employee, department manager, Quality, Auditor and Executive scopes must be tested.', 'Access Admin', 'blocked', 'critical', true, 'Persona lab export and screenshots.', 30),
    (org_id, 'OVR-END-TO-END-PASS', 'quality', 'OVR workflow end-to-end passed', 'Reporter to HOD to Quality to corrective action to evidence to closure.', 'Quality Manager', 'warning', 'critical', true, 'One real test OVR closure package.', 40),
    (org_id, 'BACKUP-RESTORE-PROVED', 'backup', 'Backup and restore proved', 'Browser export plus database and storage backup dry-run.', 'IT / Governance', 'warning', 'critical', true, 'Restore dry-run record.', 50),
    (org_id, 'AR-RTL-QA-PASS', 'bilingual', 'Arabic/RTL critical pages reviewed', 'Home, OVR, reports, command center, export and admin screens verified.', 'Governance Admin', 'warning', 'high', true, 'Translation audit report.', 60),
    (org_id, 'UI-HUBS-CLEAN', 'ui', 'Navigation is clean and hub-based', 'Legacy routes stay available but daily navigation uses hubs.', 'Product Owner', 'passed', 'medium', false, 'Hub cleanup applied.', 70),
    (org_id, 'PILOT-WAVE-APPROVED', 'handover', 'Pilot wave approved', 'Start with leadership, Governance, Quality, Audit, Finance and selected department managers.', 'Executive Sponsor', 'pending', 'high', true, 'Pilot user list.', 80)
  on conflict (organization_id, release_tag, check_code) do nothing;

  insert into consolidated_release_packages (organization_id, package_code, title, package_type, status, file_path, checksum_note, owner_label)
  values
    (org_id, 'FINAL-CODEBASE', 'Final consolidated application source', 'source_bundle', 'draft', 'release/grc-control-center-final-source.zip', null, 'System Admin'),
    (org_id, 'MIGRATION-BUNDLE', 'Ordered migration bundle and manifest', 'sql_bundle', 'generated', 'supabase/_consolidated/ALL_MIGRATIONS_ORDERED.sql', 'Generated by npm run migrations:bundle', 'System Admin'),
    (org_id, 'HANDOVER-PACK', 'Operations handover and Day-1 runbook', 'documentation', 'generated', 'docs/PRODUCTION_OPERATOR_HANDOVER_BUNDLE.md', null, 'Governance Admin'),
    (org_id, 'ACCEPTANCE-EVIDENCE', 'Acceptance evidence package', 'qa_evidence', 'draft', null, 'Attach after pilot acceptance.', 'QA Owner')
  on conflict (organization_id, release_tag, package_code) do nothing;

  insert into final_handover_signoffs (organization_id, signoff_area, owner_label, status, evidence_note, sequence_no)
  values
    (org_id, 'Executive sponsor approval', 'Executive Sponsor', 'not_started', 'Signed go-live decision.', 10),
    (org_id, 'Quality / OVR workflow approval', 'Quality Manager', 'not_started', 'OVR scenario accepted.', 20),
    (org_id, 'Access control approval', 'Access Admin', 'not_started', 'RLS persona matrix accepted.', 30),
    (org_id, 'Backup and restore approval', 'IT / Governance', 'not_started', 'Restore dry-run passed.', 40)
  on conflict (organization_id, release_tag, signoff_area) do nothing;

  return 'Release factory defaults seeded.';
end;
$$;
