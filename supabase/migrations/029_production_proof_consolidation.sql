-- =========================================================
-- GRC Control Center - Migration 029
-- Production Proof Consolidation Layer
-- Final proof gates, release artifacts and pilot waves
-- =========================================================

create table if not exists production_proof_gates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  gate_code text not null,
  gate_group text not null,
  title text not null,
  description text,
  status text not null default 'pending' check (status in ('pending','in_progress','passed','warning','blocked','accepted_risk','not_applicable')),
  severity text not null default 'high' check (severity in ('hard_gate','critical','high','medium','low')),
  owner_label text,
  proof_required text,
  fast_action text,
  sequence_no integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, gate_code)
);

create table if not exists production_release_artifacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  artifact_code text not null,
  title text not null,
  artifact_type text not null,
  status text not null default 'draft' check (status in ('missing','draft','generated','verified','approved','archived')),
  target_path text,
  owner_label text,
  required_for_pilot boolean not null default true,
  sequence_no integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, artifact_code)
);

create table if not exists production_pilot_waves (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  wave_code text not null,
  title text not null,
  participant_scope text,
  status text not null default 'not_started' check (status in ('not_started','ready','in_progress','accepted','blocked')),
  acceptance_owner text,
  success_criteria text,
  sequence_no integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, wave_code)
);

create index if not exists idx_production_proof_gates_org on production_proof_gates(organization_id);
create index if not exists idx_production_proof_gates_status on production_proof_gates(status);
create index if not exists idx_production_proof_gates_sequence on production_proof_gates(sequence_no);
create index if not exists idx_production_artifacts_org on production_release_artifacts(organization_id);
create index if not exists idx_production_pilot_waves_org on production_pilot_waves(organization_id);

create or replace function seed_v33_production_proof_defaults()
returns text
language plpgsql
security definer
as $$
declare
  org_id uuid;
begin
  select id into org_id from organizations order by created_at limit 1;
  if org_id is null then
    insert into organizations (name_en, name_ar) values ('Al Modawat Specialized Medical Company', 'شركة المداواة التخصصية الطبية') returning id into org_id;
  end if;

  insert into production_proof_gates (organization_id, gate_code, gate_group, title, description, status, severity, owner_label, proof_required, fast_action, sequence_no)
  values
    (org_id,'CLEAN-REPO','consolidation','Clean local repository prepared','All patches applied in one working tree; primary navigation is hub-based and clean.','passed','hard_gate','System Admin','Git commit hash, build output and route audit.','Apply patches in order, run npm run final:all, commit the clean tree.',10),
    (org_id,'FRESH-SUPABASE','database','Fresh Supabase install verified','The consolidated migration bundle runs cleanly in a new Supabase project.','blocked','hard_gate','IT / Supabase Admin','Successful SQL execution and seed RPC evidence.','Run supabase/_consolidated/ALL_MIGRATIONS_ORDERED.sql in staging.',20),
    (org_id,'RLS-PERSONAS','security','RLS personas proven with real accounts','Executive, department manager, quality, auditor and employee accounts see only allowed scope.','warning','hard_gate','Access Admin','Persona test evidence and sign-off.','Run RLS Persona Lab with real test users.',30),
    (org_id,'OVR-PILOT','quality','OVR workflow pilot accepted','One OVR passes from reporter to HOD, Quality, corrective action, evidence and closure.','warning','hard_gate','Quality Manager','Closed test OVR and evidence review.','Run the OVR acceptance script.',40),
    (org_id,'BACKUP-RESTORE','backup','Backup and restore dry-run completed','Export package, database backup strategy and restore dry-run are documented.','warning','hard_gate','IT / Governance','Restore dry-run log and backup location.','Perform restore dry-run before production data migration.',50),
    (org_id,'PILOT-WAVE','rollout','Pilot wave approved before all-staff rollout','First pilot group is limited and named before scaling to 1,000 users.','pending','hard_gate','Executive Sponsor','Pilot list and go/no-go approval.','Approve 20–50 pilot users first.',60)
  on conflict (organization_id, gate_code) do update set
    title = excluded.title,
    description = excluded.description,
    severity = excluded.severity,
    owner_label = excluded.owner_label,
    proof_required = excluded.proof_required,
    fast_action = excluded.fast_action,
    sequence_no = excluded.sequence_no;

  insert into production_release_artifacts (organization_id, artifact_code, title, artifact_type, status, target_path, owner_label, required_for_pilot, sequence_no)
  values
    (org_id,'SOURCE-ZIP','Final source repository bundle','source','draft','release/grc-control-center-final-source.zip','System Admin',true,10),
    (org_id,'MIGRATION-BUNDLE','Ordered SQL migration bundle','database','generated','supabase/_consolidated/ALL_MIGRATIONS_ORDERED.sql','System Admin',true,20),
    (org_id,'RLS-EVIDENCE','RLS persona evidence pack','security','draft','release/evidence/rls-persona-pack','Access Admin',true,30),
    (org_id,'OVR-EVIDENCE','OVR end-to-end acceptance evidence','quality','draft','release/evidence/ovr-workflow-pack','Quality Manager',true,40),
    (org_id,'BACKUP-PROOF','Backup and restore proof package','backup','draft','release/evidence/backup-restore-pack','IT / Governance',true,50)
  on conflict (organization_id, artifact_code) do update set
    title = excluded.title,
    artifact_type = excluded.artifact_type,
    target_path = excluded.target_path,
    owner_label = excluded.owner_label,
    required_for_pilot = excluded.required_for_pilot,
    sequence_no = excluded.sequence_no;

  insert into production_pilot_waves (organization_id, wave_code, title, participant_scope, status, acceptance_owner, success_criteria, sequence_no)
  values
    (org_id,'WAVE-0','Core admin smoke test','System admin, Governance admin, Quality manager, IT','ready','System Admin','Login, dashboard, OVR form, export, RLS smoke and backup export pass.',10),
    (org_id,'WAVE-1','Leadership and control owners','Executive, Finance, HR, Quality, Audit, selected managers','ready','Executive Sponsor','No hard blocker for one working week.',20),
    (org_id,'WAVE-2','Department manager pilot','10 departments / 50–100 users','not_started','Governance Admin','Department scope and task/evidence flow accepted.',30),
    (org_id,'WAVE-3','All-staff limited actions','All employees with assigned-only access','not_started','Executive Sponsor','Employee workspace and OVR reporting are stable.',40)
  on conflict (organization_id, wave_code) do update set
    title = excluded.title,
    participant_scope = excluded.participant_scope,
    acceptance_owner = excluded.acceptance_owner,
    success_criteria = excluded.success_criteria,
    sequence_no = excluded.sequence_no;

  return 'v3.3 production proof defaults seeded';
end;
$$;

create or replace view v_v33_production_proof_gates as
select * from production_proof_gates;

create or replace view v_v33_production_artifacts as
select * from production_release_artifacts;

create or replace view v_v33_pilot_waves as
select * from production_pilot_waves;

create or replace view v_v33_production_proof_scorecard as
select
  o.id as organization_id,
  'v3.3-production-proof'::text as release_tag,
  greatest(0, least(100,
    100
    - (coalesce(sum(case when g.status = 'blocked' then 1 else 0 end),0) * 18)
    - (coalesce(sum(case when g.status = 'warning' then 1 else 0 end),0) * 7)
    - (coalesce(sum(case when g.status in ('pending','in_progress') then 1 else 0 end),0) * 4)
  ))::integer as proof_score,
  case
    when coalesce(sum(case when g.status = 'blocked' and g.severity = 'hard_gate' then 1 else 0 end),0) > 0 then 'blocked'
    when coalesce(sum(case when g.status in ('warning','pending','in_progress') then 1 else 0 end),0) > 0 then 'conditional'
    else 'go'
  end as go_live_signal,
  count(g.id)::integer as total_gates,
  coalesce(sum(case when g.status = 'passed' then 1 else 0 end),0)::integer as passed_gates,
  coalesce(sum(case when g.status = 'blocked' then 1 else 0 end),0)::integer as blocked_gates,
  coalesce(sum(case when g.status = 'warning' then 1 else 0 end),0)::integer as warning_gates,
  coalesce(sum(case when g.status in ('pending','in_progress') then 1 else 0 end),0)::integer as pending_gates,
  coalesce(sum(case when g.severity = 'hard_gate' then 1 else 0 end),0)::integer as hard_gates,
  (select count(*)::integer from production_release_artifacts a where a.organization_id = o.id and a.status in ('generated','verified','approved')) as consolidated_artifacts,
  (select count(*)::integer from production_pilot_waves w where w.organization_id = o.id and w.status in ('ready','accepted')) as pilot_wave_ready,
  coalesce(sum(case when g.status = 'blocked' and g.severity = 'hard_gate' then 1 else 0 end),0)::integer as unsafe_to_launch
from organizations o
left join production_proof_gates g on g.organization_id = o.id
group by o.id;

select seed_v33_production_proof_defaults();
