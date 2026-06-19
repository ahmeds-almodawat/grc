-- =========================================================
-- GRC Control Center - Migration 027
-- Final Production Leap: go-live controls, module readiness,
-- support handover, pilot acceptance and final scorecard.
-- =========================================================

create extension if not exists "pgcrypto";

create table if not exists final_go_live_controls (
  id uuid primary key default gen_random_uuid(),
  control_code text not null unique,
  control_group text not null,
  title text not null,
  description text,
  owner_label text,
  severity text not null default 'medium' check (severity in ('critical','high','medium','low')),
  status text not null default 'pending' check (status in ('pass','warning','pending','blocked','accepted_risk')),
  evidence_required boolean not null default true,
  evidence_note text,
  go_live_blocking boolean not null default true,
  last_reviewed_at timestamptz,
  reviewed_by uuid references profiles(id) on delete set null,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists module_release_readiness (
  id uuid primary key default gen_random_uuid(),
  module_key text not null unique,
  module_name text not null,
  workspace_group text not null,
  readiness_percent integer not null default 0 check (readiness_percent between 0 and 100),
  status text not null default 'needs_review' check (status in ('ready','needs_review','blocked','pilot_only')),
  remaining_work text,
  owner_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists production_support_handover (
  id uuid primary key default gen_random_uuid(),
  support_area text not null unique,
  owner_label text not null,
  backup_owner_label text,
  runbook_ready boolean not null default false,
  escalation_path_ready boolean not null default false,
  status text not null default 'pending' check (status in ('ready','pending','blocked')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pilot_rollout_acceptance (
  id uuid primary key default gen_random_uuid(),
  pilot_area text not null unique,
  acceptance_owner text,
  target_date date,
  status text not null default 'not_started' check (status in ('not_started','in_progress','accepted','rejected','blocked')),
  acceptance_note text,
  accepted_at timestamptz,
  accepted_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_final_go_live_controls_updated_at on final_go_live_controls;
create trigger trg_final_go_live_controls_updated_at
before update on final_go_live_controls
for each row execute function set_updated_at();

drop trigger if exists trg_module_release_readiness_updated_at on module_release_readiness;
create trigger trg_module_release_readiness_updated_at
before update on module_release_readiness
for each row execute function set_updated_at();

drop trigger if exists trg_production_support_handover_updated_at on production_support_handover;
create trigger trg_production_support_handover_updated_at
before update on production_support_handover
for each row execute function set_updated_at();

drop trigger if exists trg_pilot_rollout_acceptance_updated_at on pilot_rollout_acceptance;
create trigger trg_pilot_rollout_acceptance_updated_at
before update on pilot_rollout_acceptance
for each row execute function set_updated_at();

create index if not exists idx_final_go_live_controls_status on final_go_live_controls(status);
create index if not exists idx_final_go_live_controls_blocking on final_go_live_controls(go_live_blocking, status);
create index if not exists idx_module_release_readiness_status on module_release_readiness(status);
create index if not exists idx_production_support_handover_status on production_support_handover(status);
create index if not exists idx_pilot_rollout_acceptance_status on pilot_rollout_acceptance(status);

create or replace function seed_v31_finish_fast_defaults()
returns jsonb
language plpgsql
security definer
as $$
begin
  insert into final_go_live_controls (control_code, control_group, title, description, owner_label, severity, status, evidence_required, evidence_note, go_live_blocking)
  values
    ('FF-001','Release integrity','Fresh migration run 001 → latest','Run all SQL migrations in a clean Supabase project and record the result before pilot rollout.','IT / System Admin','critical','blocked',true,'Screenshot or export of successful migration run',true),
    ('FF-002','Security','RLS persona testing complete','Test CEO, Governance, Department Manager, Quality, Auditor and Employee accounts with real scoped data.','Governance + IT','critical','blocked',true,'Persona screenshots and pass/fail log',true),
    ('FF-003','Quality safety','OVR end-to-end workflow verified','Submit, supervisor review, Quality review, corrective action, evidence and closure must be tested.','Quality Manager','high','pending',true,'One closed test OVR with audit trail',true),
    ('FF-004','Recovery','Backup and restore dry-run proven','A real database/storage restore dry-run should be documented.','IT / Supabase Admin','critical','blocked',true,'Restore dry-run job with result and notes',true),
    ('FF-005','Bilingual','Arabic / RTL screen pass','Review major pages in Arabic including tables, modals, forms, OVR, reports and dashboard cards.','Governance + Key Users','high','warning',true,'Arabic QA checklist',true),
    ('FF-006','Pilot','Pilot acceptance sign-off','Run a limited pilot before all-staff launch.','Executive Sponsor','high','pending',true,'Pilot sign-off note',true),
    ('FF-007','Performance','1,000 user / 50 department seed checked','Load realistic seed data and validate dashboard, tables and import/export performance.','IT / Governance','medium','pending',true,'Load seed run evidence',false),
    ('FF-008','Support','Support handover complete','Named support owners, backup owners, runbooks and escalation paths are documented.','System Owner','medium','warning',true,'Support handover sheet',false)
  on conflict (control_code) do nothing;

  insert into module_release_readiness (module_key, module_name, workspace_group, readiness_percent, status, remaining_work, owner_label)
  values
    ('executive','Executive Command','Executive Control',82,'needs_review','Prioritize executive cards after real data is loaded.','Executive Sponsor'),
    ('work','Projects / Work Execution','Work Execution',84,'needs_review','Test create/edit/close with evidence in staging.','Governance Admin'),
    ('risk','Risk / KRI / Compliance','GRC & Audit',80,'pilot_only','Load actual risk appetite thresholds and compliance obligations.','Risk Owner'),
    ('quality','OVR / Quality','Quality & OVR',86,'needs_review','Quality team must approve the real closure rules.','Quality Manager'),
    ('reports','Reports / Export / Backup','Reports & Data',78,'needs_review','Add production DB/storage backup outside browser export.','IT / Finance'),
    ('admin','Admin / Release / Security','Admin & Release',76,'blocked','RLS tests and admin safety gates must be passed.','System Admin')
  on conflict (module_key) do nothing;

  insert into production_support_handover (support_area, owner_label, backup_owner_label, runbook_ready, escalation_path_ready, status, notes)
  values
    ('Governance workflow support','Governance Admin','Audit Lead',true,true,'ready','Owns daily action-plan and evidence discipline.'),
    ('OVR / Quality support','Quality Manager','Quality Officer',true,true,'ready','Owns OVR review, classification and closure rules.'),
    ('Supabase / app technical support','IT Admin','External Developer',false,true,'pending','Needs production environment details and backup procedure.'),
    ('Executive reporting support','CEO Office','Finance Lead',false,false,'pending','Board pack rhythm and report owners need final confirmation.')
  on conflict (support_area) do nothing;

  insert into pilot_rollout_acceptance (pilot_area, acceptance_owner, target_date, status, acceptance_note)
  values
    ('Quality / OVR pilot','Quality Manager',null,'not_started','Run at least three test OVRs with different severity levels.'),
    ('Governance action tracking pilot','Governance Manager',null,'not_started','Create one executive decision, one risk mitigation project and one approval flow.'),
    ('Department manager pilot','Selected Department Managers',null,'not_started','Confirm department-only scope and task ownership experience.')
  on conflict (pilot_area) do nothing;

  return jsonb_build_object('seeded', true, 'migration', '027_final_production_leap');
end;
$$;

select seed_v31_finish_fast_defaults();

create or replace view v_v31_final_controls as
select
  c.*,
  case c.severity when 'critical' then 1 when 'high' then 2 when 'medium' then 3 else 4 end as severity_rank,
  case c.status when 'blocked' then 1 when 'warning' then 2 when 'pending' then 3 when 'accepted_risk' then 4 else 5 end as status_rank
from final_go_live_controls c;

create or replace view v_v31_module_readiness as
select
  m.*,
  case m.status when 'blocked' then 1 when 'needs_review' then 2 when 'pilot_only' then 3 else 4 end as status_rank
from module_release_readiness m;

create or replace view v_v31_support_handover as
select
  h.*,
  case h.status when 'blocked' then 1 when 'pending' then 2 else 3 end as status_rank
from production_support_handover h;

create or replace view v_v31_pilot_acceptance as
select
  p.*,
  case p.status when 'blocked' then 1 when 'rejected' then 2 when 'not_started' then 3 when 'in_progress' then 4 else 5 end as status_rank
from pilot_rollout_acceptance p;

create or replace view v_v31_go_live_scorecard as
with control_stats as (
  select
    count(*) filter (where go_live_blocking and status = 'blocked') as blocking_items,
    count(*) filter (where status in ('warning','pending')) as warning_items,
    count(*) filter (where status in ('pass','accepted_risk')) as passed_items,
    count(*) filter (where status = 'pending') as pending_items,
    count(*) as total_controls
  from final_go_live_controls
),
module_stats as (
  select
    count(*) filter (where status = 'ready') as modules_ready,
    count(*) as modules_total
  from module_release_readiness
),
support_stats as (
  select
    count(*) filter (where status = 'ready') as support_owners_ready,
    count(*) as support_owners_total
  from production_support_handover
),
pilot_stats as (
  select
    count(*) filter (where status = 'accepted') as pilot_accepted,
    count(*) as pilot_total
  from pilot_rollout_acceptance
)
select
  case
    when cs.blocking_items > 0 then 'blocked'
    when cs.warning_items > 0 or ms.modules_ready < ms.modules_total or ss.support_owners_ready < ss.support_owners_total then 'conditional'
    else 'go'
  end as readiness_signal,
  cs.blocking_items,
  cs.warning_items,
  cs.passed_items,
  cs.pending_items,
  ms.modules_ready,
  ms.modules_total,
  ss.support_owners_ready,
  ss.support_owners_total,
  least(100, greatest(0, round(
    (
      (cs.passed_items::numeric * 2) +
      (ms.modules_ready::numeric * 2) +
      (ss.support_owners_ready::numeric * 1.5) +
      (ps.pilot_accepted::numeric * 2) -
      (cs.blocking_items::numeric * 3)
    ) / greatest((cs.total_controls::numeric * 2) + (ms.modules_total::numeric * 2) + (ss.support_owners_total::numeric * 1.5) + (ps.pilot_total::numeric * 2), 1) * 100
  )))::integer as go_live_score
from control_stats cs
cross join module_stats ms
cross join support_stats ss
cross join pilot_stats ps;
