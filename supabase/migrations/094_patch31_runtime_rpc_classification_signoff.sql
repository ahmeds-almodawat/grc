-- =========================================================
-- Patch 31: Runtime RPC Classification Closure / Production Security Signoff
-- Controlled register for frontend-used RPC classification, bridge validation,
-- exception tracking, and production signoff evidence.
-- =========================================================

create table if not exists public.runtime_rpc_classifications (
  id uuid primary key default gen_random_uuid(),
  rpc_name text not null unique,
  frontend_transport text not null check (frontend_transport in ('direct_browser_rpc','authenticated_edge_bridge','server_only','unknown')),
  classification text not null check (classification in ('browser_safe_candidate','edge_bridge_required','workflow_runtime_review','privileged_admin_review','pending_security_review','server_only')),
  risk_level text not null check (risk_level in ('low','medium','high','critical')),
  allowed_frontend_use boolean not null default false,
  requires_authenticated_bridge boolean not null default true,
  service_role_only boolean not null default false,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  signoff_status text not null default 'pending_review' check (signoff_status in ('pending_review','pending_security_review','approved_for_production','rejected_for_production','privileged_admin_review','workflow_runtime_review')),
  signoff_notes text,
  source_file text,
  source_line integer,
  bridge_validation_status text not null default 'pending_validation' check (bridge_validation_status in ('not_required','pending_validation','authenticated_bridge_present','server_only','rejected')),
  production_exception_reason text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.runtime_rpc_signoff_events (
  id uuid primary key default gen_random_uuid(),
  rpc_name text not null,
  event_type text not null check (event_type in ('seeded','classified','reviewed','approved','rejected','exception_recorded','bridge_validated')),
  event_summary text not null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

create index if not exists idx_patch31_rpc_classification_name on public.runtime_rpc_classifications(rpc_name);
create index if not exists idx_patch31_rpc_classification_status on public.runtime_rpc_classifications(signoff_status);
create index if not exists idx_patch31_rpc_classification_risk on public.runtime_rpc_classifications(risk_level);
create index if not exists idx_patch31_rpc_classification_transport on public.runtime_rpc_classifications(frontend_transport);
create index if not exists idx_patch31_rpc_events_name on public.runtime_rpc_signoff_events(rpc_name, created_at desc);
create index if not exists idx_patch31_rpc_events_type on public.runtime_rpc_signoff_events(event_type);

alter table public.runtime_rpc_classifications enable row level security;
alter table public.runtime_rpc_signoff_events enable row level security;

drop policy if exists runtime_rpc_classifications_read_security_roles on public.runtime_rpc_classifications;
create policy runtime_rpc_classifications_read_security_roles on public.runtime_rpc_classifications
for select using (
  public.has_any_role(array['super_admin','executive','governance_admin','auditor']::public.app_role[])
);

drop policy if exists runtime_rpc_classifications_write_security_admins on public.runtime_rpc_classifications;
create policy runtime_rpc_classifications_write_security_admins on public.runtime_rpc_classifications
for all using (
  public.has_any_role(array['super_admin','governance_admin']::public.app_role[])
)
with check (
  public.has_any_role(array['super_admin','governance_admin']::public.app_role[])
);

drop policy if exists runtime_rpc_signoff_events_read_security_roles on public.runtime_rpc_signoff_events;
create policy runtime_rpc_signoff_events_read_security_roles on public.runtime_rpc_signoff_events
for select using (
  public.has_any_role(array['super_admin','executive','governance_admin','auditor']::public.app_role[])
);

drop policy if exists runtime_rpc_signoff_events_insert_security_admins on public.runtime_rpc_signoff_events;
create policy runtime_rpc_signoff_events_insert_security_admins on public.runtime_rpc_signoff_events
for insert with check (
  public.has_any_role(array['super_admin','governance_admin']::public.app_role[])
);

drop trigger if exists trg_patch31_runtime_rpc_classifications_updated_at on public.runtime_rpc_classifications;
create trigger trg_patch31_runtime_rpc_classifications_updated_at
before update on public.runtime_rpc_classifications
for each row execute function public.set_updated_at();

create or replace view public.v_patch31_runtime_rpc_classification_register as
select
  rpc_name,
  frontend_transport,
  classification,
  risk_level,
  allowed_frontend_use,
  requires_authenticated_bridge,
  service_role_only,
  signoff_status,
  bridge_validation_status,
  reviewed_by,
  reviewed_at,
  source_file,
  source_line,
  signoff_notes,
  production_exception_reason,
  updated_at
from public.runtime_rpc_classifications;

create or replace view public.v_patch31_unreviewed_runtime_rpcs as
select *
from public.v_patch31_runtime_rpc_classification_register
where signoff_status in ('pending_review','pending_security_review')
   or reviewed_at is null;

create or replace view public.v_patch31_privileged_rpc_review_queue as
select *
from public.v_patch31_runtime_rpc_classification_register
where classification = 'privileged_admin_review'
   or signoff_status = 'privileged_admin_review'
   or risk_level in ('high','critical');

create or replace view public.v_patch31_frontend_rpc_signoff_summary as
select
  count(*) as total_classified_rpcs,
  count(*) filter (where allowed_frontend_use) as allowed_frontend_use_count,
  count(*) filter (where requires_authenticated_bridge) as requires_authenticated_bridge_count,
  count(*) filter (where service_role_only) as service_role_only_count,
  count(*) filter (where signoff_status = 'approved_for_production') as approved_for_production_count,
  count(*) filter (where signoff_status in ('pending_review','pending_security_review','privileged_admin_review','workflow_runtime_review')) as pending_review_count,
  count(*) filter (where signoff_status = 'rejected_for_production') as rejected_for_production_count,
  count(*) filter (where bridge_validation_status = 'authenticated_bridge_present') as authenticated_bridge_present_count
from public.runtime_rpc_classifications;

create or replace view public.v_patch31_runtime_rpc_production_readiness as
select
  count(*) as total_classified_rpcs,
  count(*) filter (where signoff_status <> 'approved_for_production') as unresolved_rpc_count,
  count(*) filter (where service_role_only and frontend_transport = 'direct_browser_rpc') as direct_service_role_frontend_count,
  count(*) filter (where requires_authenticated_bridge and frontend_transport <> 'authenticated_edge_bridge') as missing_bridge_count,
  count(*) filter (where risk_level in ('high','critical') and signoff_status <> 'approved_for_production') as high_risk_pending_count,
  (
    count(*) filter (where service_role_only and frontend_transport = 'direct_browser_rpc') = 0
    and count(*) filter (where signoff_status = 'rejected_for_production') = 0
  ) as production_security_signoff_ready
from public.runtime_rpc_classifications;

create or replace view public.v_patch31_runtime_rpc_exception_register as
select *
from public.v_patch31_runtime_rpc_classification_register
where signoff_status <> 'approved_for_production'
   or production_exception_reason is not null
   or bridge_validation_status in ('pending_validation','rejected');

alter view public.v_patch31_runtime_rpc_classification_register set (security_invoker = true);
alter view public.v_patch31_unreviewed_runtime_rpcs set (security_invoker = true);
alter view public.v_patch31_privileged_rpc_review_queue set (security_invoker = true);
alter view public.v_patch31_frontend_rpc_signoff_summary set (security_invoker = true);
alter view public.v_patch31_runtime_rpc_production_readiness set (security_invoker = true);
alter view public.v_patch31_runtime_rpc_exception_register set (security_invoker = true);

grant select on public.v_patch31_runtime_rpc_classification_register to authenticated;
grant select on public.v_patch31_unreviewed_runtime_rpcs to authenticated;
grant select on public.v_patch31_privileged_rpc_review_queue to authenticated;
grant select on public.v_patch31_frontend_rpc_signoff_summary to authenticated;
grant select on public.v_patch31_runtime_rpc_production_readiness to authenticated;
grant select on public.v_patch31_runtime_rpc_exception_register to authenticated;

create or replace function public.patch31_actor_has_security_authority(p_actor_user_id uuid)
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p_actor_user_id
      and ur.is_active = true
      and ur.role in ('super_admin','governance_admin','auditor')
  );
$$;

create or replace function public.record_runtime_rpc_signoff_event(
  p_rpc_name text,
  p_event_type text,
  p_event_summary text,
  p_actor_user_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event_id uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then
    raise exception 'PATCH31_SERVICE_ROLE_REQUIRED';
  end if;
  if p_actor_user_id is not null and not public.patch31_actor_has_security_authority(p_actor_user_id) then
    raise exception 'PATCH31_SECURITY_AUTHORITY_REQUIRED';
  end if;
  insert into public.runtime_rpc_signoff_events (rpc_name, event_type, event_summary, actor_user_id)
  values (p_rpc_name, p_event_type, p_event_summary, p_actor_user_id)
  returning id into v_event_id;
  return v_event_id;
end;
$$;

create or replace function public.classify_runtime_rpc(
  p_rpc_name text,
  p_frontend_transport text,
  p_classification text,
  p_risk_level text,
  p_allowed_frontend_use boolean,
  p_requires_authenticated_bridge boolean,
  p_service_role_only boolean,
  p_actor_user_id uuid,
  p_signoff_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then
    raise exception 'PATCH31_SERVICE_ROLE_REQUIRED';
  end if;
  if not public.patch31_actor_has_security_authority(p_actor_user_id) then
    raise exception 'PATCH31_SECURITY_AUTHORITY_REQUIRED';
  end if;
  insert into public.runtime_rpc_classifications (
    rpc_name,
    frontend_transport,
    classification,
    risk_level,
    allowed_frontend_use,
    requires_authenticated_bridge,
    service_role_only,
    reviewed_by,
    reviewed_at,
    signoff_status,
    signoff_notes,
    bridge_validation_status
  )
  values (
    p_rpc_name,
    p_frontend_transport,
    p_classification,
    p_risk_level,
    p_allowed_frontend_use,
    p_requires_authenticated_bridge,
    p_service_role_only,
    p_actor_user_id,
    now(),
    case
      when p_classification = 'privileged_admin_review' then 'privileged_admin_review'
      when p_classification = 'workflow_runtime_review' then 'workflow_runtime_review'
      when p_classification = 'pending_security_review' then 'pending_security_review'
      else 'pending_review'
    end,
    p_signoff_notes,
    case
      when p_frontend_transport = 'authenticated_edge_bridge' then 'authenticated_bridge_present'
      when p_frontend_transport = 'direct_browser_rpc' and not p_requires_authenticated_bridge then 'not_required'
      else 'pending_validation'
    end
  )
  on conflict (rpc_name) do update set
    frontend_transport = excluded.frontend_transport,
    classification = excluded.classification,
    risk_level = excluded.risk_level,
    allowed_frontend_use = excluded.allowed_frontend_use,
    requires_authenticated_bridge = excluded.requires_authenticated_bridge,
    service_role_only = excluded.service_role_only,
    reviewed_by = excluded.reviewed_by,
    reviewed_at = excluded.reviewed_at,
    signoff_status = excluded.signoff_status,
    signoff_notes = excluded.signoff_notes,
    bridge_validation_status = excluded.bridge_validation_status,
    updated_at = now();
  perform public.record_runtime_rpc_signoff_event(p_rpc_name, 'classified', 'Runtime RPC classification updated.', p_actor_user_id);
  return jsonb_build_object('status','ok','rpc_name',p_rpc_name);
end;
$$;

create or replace function public.mark_runtime_rpc_reviewed(
  p_rpc_name text,
  p_actor_user_id uuid,
  p_signoff_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then
    raise exception 'PATCH31_SERVICE_ROLE_REQUIRED';
  end if;
  if not public.patch31_actor_has_security_authority(p_actor_user_id) then
    raise exception 'PATCH31_SECURITY_AUTHORITY_REQUIRED';
  end if;
  update public.runtime_rpc_classifications
  set reviewed_by = p_actor_user_id,
      reviewed_at = now(),
      signoff_notes = coalesce(p_signoff_notes, signoff_notes),
      updated_at = now()
  where rpc_name = p_rpc_name;
  if not found then raise exception 'PATCH31_RPC_CLASSIFICATION_NOT_FOUND'; end if;
  perform public.record_runtime_rpc_signoff_event(p_rpc_name, 'reviewed', 'Runtime RPC classification reviewed.', p_actor_user_id);
  return jsonb_build_object('status','ok','rpc_name',p_rpc_name);
end;
$$;

create or replace function public.approve_runtime_rpc_for_production(
  p_rpc_name text,
  p_actor_user_id uuid,
  p_signoff_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then
    raise exception 'PATCH31_SERVICE_ROLE_REQUIRED';
  end if;
  if not public.patch31_actor_has_security_authority(p_actor_user_id) then
    raise exception 'PATCH31_SECURITY_AUTHORITY_REQUIRED';
  end if;
  if nullif(trim(coalesce(p_signoff_notes, '')), '') is null then
    raise exception 'PATCH31_SIGNOFF_NOTES_REQUIRED';
  end if;
  update public.runtime_rpc_classifications
  set signoff_status = 'approved_for_production',
      allowed_frontend_use = true,
      reviewed_by = p_actor_user_id,
      reviewed_at = now(),
      signoff_notes = p_signoff_notes,
      bridge_validation_status = case
        when frontend_transport = 'authenticated_edge_bridge' then 'authenticated_bridge_present'
        when frontend_transport = 'direct_browser_rpc' and requires_authenticated_bridge = false then 'not_required'
        else bridge_validation_status
      end,
      updated_at = now()
  where rpc_name = p_rpc_name
    and not (service_role_only = true and frontend_transport = 'direct_browser_rpc')
    and not (requires_authenticated_bridge = true and frontend_transport <> 'authenticated_edge_bridge');
  if not found then raise exception 'PATCH31_RPC_APPROVAL_BLOCKED_OR_NOT_FOUND'; end if;
  perform public.record_runtime_rpc_signoff_event(p_rpc_name, 'approved', 'Runtime RPC approved for production.', p_actor_user_id);
  return jsonb_build_object('status','ok','rpc_name',p_rpc_name,'signoff_status','approved_for_production');
end;
$$;

create or replace function public.reject_runtime_rpc_for_production(
  p_rpc_name text,
  p_actor_user_id uuid,
  p_rejection_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then
    raise exception 'PATCH31_SERVICE_ROLE_REQUIRED';
  end if;
  if not public.patch31_actor_has_security_authority(p_actor_user_id) then
    raise exception 'PATCH31_SECURITY_AUTHORITY_REQUIRED';
  end if;
  if nullif(trim(coalesce(p_rejection_reason, '')), '') is null then
    raise exception 'PATCH31_REJECTION_REASON_REQUIRED';
  end if;
  update public.runtime_rpc_classifications
  set signoff_status = 'rejected_for_production',
      allowed_frontend_use = false,
      reviewed_by = p_actor_user_id,
      reviewed_at = now(),
      signoff_notes = p_rejection_reason,
      bridge_validation_status = 'rejected',
      production_exception_reason = p_rejection_reason,
      updated_at = now()
  where rpc_name = p_rpc_name;
  if not found then raise exception 'PATCH31_RPC_CLASSIFICATION_NOT_FOUND'; end if;
  perform public.record_runtime_rpc_signoff_event(p_rpc_name, 'rejected', 'Runtime RPC rejected for production.', p_actor_user_id);
  return jsonb_build_object('status','ok','rpc_name',p_rpc_name,'signoff_status','rejected_for_production');
end;
$$;

insert into public.runtime_rpc_classifications (
  rpc_name,
  frontend_transport,
  classification,
  risk_level,
  allowed_frontend_use,
  requires_authenticated_bridge,
  service_role_only,
  signoff_status,
  signoff_notes,
  source_file,
  source_line,
  bridge_validation_status,
  production_exception_reason
) values
  ('search_grc_global','direct_browser_rpc','browser_safe_candidate','low',true,false,false,'approved_for_production','Security invoker global search remains browser-safe only while RLS and tenant filtering stay verified.','src/lib/commandCenterApi.ts',180,'not_required',null),
  ('create_board_pack_snapshot','authenticated_edge_bridge','pending_security_review','high',false,true,true,'pending_security_review','Service-role snapshot creation is bridged but needs board-pack authority signoff.','src/lib/enterpriseApi.ts',174,'authenticated_bridge_present','Pending executive board-pack authority confirmation.'),
  ('create_executive_truth_snapshot','authenticated_edge_bridge','pending_security_review','high',false,true,true,'pending_security_review','Patch 30 executive truth snapshot creation is bridged and needs executive/security signoff.','src/lib/executiveTruthApi.ts',165,'authenticated_bridge_present','Pending executive truth authority confirmation.'),
  ('refresh_executive_truth_snapshot','authenticated_edge_bridge','pending_security_review','high',false,true,true,'pending_security_review','Patch 30 executive truth refresh is bridged and needs executive/security signoff.','src/lib/executiveTruthApi.ts',176,'authenticated_bridge_present','Pending executive truth refresh confirmation.'),
  ('record_executive_truth_event','authenticated_edge_bridge','workflow_runtime_review','medium',false,true,true,'workflow_runtime_review','Executive truth event write is bridged and should remain workflow reviewed.','src/lib/executiveTruthApi.ts',189,'authenticated_bridge_present','Pending workflow event authority signoff.'),
  ('acknowledge_escalation_event','authenticated_edge_bridge','workflow_runtime_review','medium',false,true,true,'workflow_runtime_review','Escalation acknowledgement is bridged and workflow-state sensitive.','src/lib/grcApi.ts',745,'authenticated_bridge_present','Pending escalation workflow signoff.'),
  ('resolve_escalation_event','authenticated_edge_bridge','workflow_runtime_review','medium',false,true,true,'workflow_runtime_review','Escalation resolution is bridged and workflow-state sensitive.','src/lib/grcApi.ts',753,'authenticated_bridge_present','Pending escalation workflow signoff.'),
  ('assign_user_role','authenticated_edge_bridge','privileged_admin_review','high',false,true,true,'privileged_admin_review','Role assignment is bridged and remains privileged admin review.','src/lib/grcApi.ts',1680,'authenticated_bridge_present','Pending access-control signoff.'),
  ('deactivate_user_role','authenticated_edge_bridge','privileged_admin_review','high',false,true,true,'privileged_admin_review','Role deactivation is bridged and remains privileged admin review.','src/lib/grcApi.ts',1695,'authenticated_bridge_present','Pending access-control signoff.'),
  ('create_department','authenticated_edge_bridge','privileged_admin_review','medium',false,true,true,'privileged_admin_review','Department creation changes org structure and needs admin review.','src/lib/grcApi.ts',1709,'authenticated_bridge_present','Pending organization-structure signoff.'),
  ('create_user','authenticated_edge_bridge','privileged_admin_review','high',false,true,true,'privileged_admin_review','User creation is bridged and remains privileged admin review.','src/lib/grcApi.ts',1734,'authenticated_bridge_present','Pending user lifecycle signoff.'),
  ('update_ovr_workflow','authenticated_edge_bridge','workflow_runtime_review','high',false,true,true,'workflow_runtime_review','OVR workflow mutation is bridged and requires workflow/confidentiality review.','src/lib/grcApi.ts',1902,'authenticated_bridge_present','Pending OVR workflow signoff.'),
  ('create_ovr_corrective_action_project','authenticated_edge_bridge','workflow_runtime_review','medium',false,true,true,'workflow_runtime_review','OVR corrective-action project creation is bridged and workflow scoped.','src/lib/grcApi.ts',1929,'authenticated_bridge_present','Pending OVR/CAPA linkage signoff.'),
  ('v99_create_scenario','authenticated_edge_bridge','pending_security_review','medium',false,true,true,'pending_security_review','Scenario Lab creation should remain reviewed before production use.','src/lib/scenarioLab.ts',50,'authenticated_bridge_present','Pending UAT/scenario production boundary signoff.'),
  ('v99_cleanup_scenarios','authenticated_edge_bridge','pending_security_review','medium',false,true,true,'pending_security_review','Scenario cleanup is bridged but destructive to test data and needs review.','src/lib/scenarioLab.ts',60,'authenticated_bridge_present','Pending UAT/scenario cleanup signoff.'),
  ('v99_scenario_status','authenticated_edge_bridge','pending_security_review','low',false,true,true,'pending_security_review','Scenario status is bridged and needs production-boundary review.','src/lib/scenarioLab.ts',74,'authenticated_bridge_present','Pending UAT/scenario status signoff.'),
  ('create_training_program','authenticated_edge_bridge','workflow_runtime_review','medium',false,true,true,'workflow_runtime_review','Training program creation is bridged and workflow-governed.','src/lib/trainingGovernanceApi.ts',145,'authenticated_bridge_present','Pending training governance signoff.'),
  ('assign_training_program_to_user','authenticated_edge_bridge','workflow_runtime_review','medium',false,true,true,'workflow_runtime_review','Training assignment to user is bridged and workflow-governed.','src/lib/trainingGovernanceApi.ts',158,'authenticated_bridge_present','Pending training assignment signoff.'),
  ('assign_training_program_to_department','authenticated_edge_bridge','workflow_runtime_review','medium',false,true,true,'workflow_runtime_review','Training assignment to department is bridged and workflow-governed.','src/lib/trainingGovernanceApi.ts',171,'authenticated_bridge_present','Pending training assignment signoff.'),
  ('start_training_assignment','authenticated_edge_bridge','workflow_runtime_review','low',false,true,true,'workflow_runtime_review','Training start is bridged and workflow tracked.','src/lib/trainingGovernanceApi.ts',189,'authenticated_bridge_present','Pending training workflow signoff.'),
  ('complete_training_assignment','authenticated_edge_bridge','workflow_runtime_review','medium',false,true,true,'workflow_runtime_review','Training completion is bridged and competency evidence sensitive.','src/lib/trainingGovernanceApi.ts',201,'authenticated_bridge_present','Pending training completion signoff.'),
  ('acknowledge_training_assignment','authenticated_edge_bridge','workflow_runtime_review','medium',false,true,true,'workflow_runtime_review','Training acknowledgment is bridged and compliance-sensitive.','src/lib/trainingGovernanceApi.ts',216,'authenticated_bridge_present','Pending training acknowledgment signoff.'),
  ('waive_training_assignment_with_reason','authenticated_edge_bridge','workflow_runtime_review','high',false,true,true,'workflow_runtime_review','Training waiver is bridged and requires reason/signoff.','src/lib/trainingGovernanceApi.ts',228,'authenticated_bridge_present','Pending training waiver signoff.'),
  ('cancel_training_assignment_with_reason','authenticated_edge_bridge','workflow_runtime_review','medium',false,true,true,'workflow_runtime_review','Training cancellation is bridged and requires reason/signoff.','src/lib/trainingGovernanceApi.ts',240,'authenticated_bridge_present','Pending training cancellation signoff.'),
  ('record_competency_assessment','authenticated_edge_bridge','workflow_runtime_review','high',false,true,true,'workflow_runtime_review','Competency assessment is bridged and credential-sensitive.','src/lib/trainingGovernanceApi.ts',257,'authenticated_bridge_present','Pending competency assessment signoff.'),
  ('reopen_training_assignment_with_reason','authenticated_edge_bridge','workflow_runtime_review','medium',false,true,true,'workflow_runtime_review','Training reopen is bridged and requires reason/signoff.','src/lib/trainingGovernanceApi.ts',269,'authenticated_bridge_present','Pending training reopen signoff.'),
  ('link_training_evidence','authenticated_edge_bridge','workflow_runtime_review','medium',false,true,true,'workflow_runtime_review','Training evidence link is bridged and evidence-governed.','src/lib/trainingGovernanceApi.ts',281,'authenticated_bridge_present','Pending evidence linkage signoff.'),
  ('list_user_management_roster','authenticated_edge_bridge','privileged_admin_review','medium',false,true,true,'privileged_admin_review','User roster read is bridged and contains administrative identity data.','src/lib/userManagementApi.ts',440,'authenticated_bridge_present','Pending user-management read signoff.'),
  ('patch19_apply_import_batch','authenticated_edge_bridge','privileged_admin_review','high',false,true,true,'privileged_admin_review','Patch 19 import batch application is bridged and remains privileged admin review.','src/lib/userManagementApi.ts',916,'authenticated_bridge_present','Pending import operator signoff.'),
  ('patch19_update_user_profile','authenticated_edge_bridge','privileged_admin_review','high',false,true,true,'privileged_admin_review','User profile mutation is bridged and admin-governed.','src/lib/userManagementApi.ts',980,'authenticated_bridge_present','Pending profile mutation signoff.'),
  ('patch19_update_user_department','authenticated_edge_bridge','privileged_admin_review','high',false,true,true,'privileged_admin_review','User department mutation is bridged and admin-governed.','src/lib/userManagementApi.ts',997,'authenticated_bridge_present','Pending department assignment signoff.'),
  ('patch19_assign_user_role','authenticated_edge_bridge','privileged_admin_review','high',false,true,true,'privileged_admin_review','Patch 19 role assignment is bridged and privileged.','src/lib/userManagementApi.ts',1016,'authenticated_bridge_present','Pending role assignment signoff.'),
  ('patch19_deactivate_user','authenticated_edge_bridge','privileged_admin_review','high',false,true,true,'privileged_admin_review','User deactivation is bridged and privileged.','src/lib/userManagementApi.ts',1032,'authenticated_bridge_present','Pending deactivation signoff.'),
  ('patch19_reactivate_user','authenticated_edge_bridge','privileged_admin_review','high',false,true,true,'privileged_admin_review','User reactivation is bridged and privileged.','src/lib/userManagementApi.ts',1042,'authenticated_bridge_present','Pending reactivation signoff.'),
  ('patch19_archive_user','authenticated_edge_bridge','privileged_admin_review','high',false,true,true,'privileged_admin_review','User archive is bridged and privileged.','src/lib/userManagementApi.ts',1051,'authenticated_bridge_present','Pending archive signoff.'),
  ('patch19_unarchive_user','authenticated_edge_bridge','privileged_admin_review','high',false,true,true,'privileged_admin_review','User unarchive is bridged and privileged.','src/lib/userManagementApi.ts',1061,'authenticated_bridge_present','Pending unarchive signoff.')
on conflict (rpc_name) do update set
  frontend_transport = excluded.frontend_transport,
  classification = excluded.classification,
  risk_level = excluded.risk_level,
  allowed_frontend_use = excluded.allowed_frontend_use,
  requires_authenticated_bridge = excluded.requires_authenticated_bridge,
  service_role_only = excluded.service_role_only,
  signoff_status = excluded.signoff_status,
  signoff_notes = excluded.signoff_notes,
  source_file = excluded.source_file,
  source_line = excluded.source_line,
  bridge_validation_status = excluded.bridge_validation_status,
  production_exception_reason = excluded.production_exception_reason,
  updated_at = now();

insert into public.runtime_rpc_signoff_events (rpc_name, event_type, event_summary)
select rpc_name, 'seeded', 'Patch 31 seeded runtime RPC classification from current v700 inventory.'
from public.runtime_rpc_classifications
on conflict do nothing;

revoke all on function public.patch31_actor_has_security_authority(uuid) from public, anon, authenticated;
grant execute on function public.patch31_actor_has_security_authority(uuid) to service_role;

revoke all on function public.record_runtime_rpc_signoff_event(text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.record_runtime_rpc_signoff_event(text, text, text, uuid) to service_role;

revoke all on function public.classify_runtime_rpc(text, text, text, text, boolean, boolean, boolean, uuid, text) from public, anon, authenticated;
grant execute on function public.classify_runtime_rpc(text, text, text, text, boolean, boolean, boolean, uuid, text) to service_role;

revoke all on function public.mark_runtime_rpc_reviewed(text, uuid, text) from public, anon, authenticated;
grant execute on function public.mark_runtime_rpc_reviewed(text, uuid, text) to service_role;

revoke all on function public.approve_runtime_rpc_for_production(text, uuid, text) from public, anon, authenticated;
grant execute on function public.approve_runtime_rpc_for_production(text, uuid, text) to service_role;

revoke all on function public.reject_runtime_rpc_for_production(text, uuid, text) from public, anon, authenticated;
grant execute on function public.reject_runtime_rpc_for_production(text, uuid, text) to service_role;

comment on table public.runtime_rpc_classifications is 'Patch 31 controlled classification and production signoff register for frontend-used RPCs.';
comment on table public.runtime_rpc_signoff_events is 'Patch 31 runtime RPC classification/signoff audit events.';
