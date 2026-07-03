-- Migration: supabase/migrations/101_patch40_production_hardening_simplification_pack.sql
-- Description: Adds Patch 40 Production Hardening & Simplification Pack tables, views, and functions.

-- 1. Create Tables
create table if not exists public.production_readiness_signoffs (
  id uuid primary key default gen_random_uuid(),
  signoff_area text not null check (
    signoff_area in (
      'security', 'rls', 'rpc_classification', 'backup_restore', 'persona_access',
      'evidence_bridge', 'accreditation_workflow', 'audit_execution', 'clinical_governance',
      'hospital_governance', 'bilingual_readiness', 'navigation_simplification', 'proof_suite'
    )
  ),
  signoff_status text not null default 'pending' check (
    signoff_status in ('pending', 'ready', 'ready_with_limitations', 'blocked', 'rejected', 'waived')
  ),
  signoff_owner_user_id uuid,
  signed_by uuid,
  signed_at timestamptz,
  signoff_notes text,
  evidence_reference text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.production_known_limitations (
  id uuid primary key default gen_random_uuid(),
  limitation_title text not null,
  limitation_description text,
  limitation_area text not null check (
    limitation_area in (
      'frontend', 'backend', 'security', 'workflow', 'data_quality',
      'bilingual', 'backup_restore', 'integration', 'reporting', 'training', 'operations'
    )
  ),
  severity text not null default 'medium' check (
    severity in ('low', 'medium', 'high', 'critical')
  ),
  limitation_status text not null default 'open' check (
    limitation_status in ('open', 'accepted_for_pilot', 'mitigation_in_progress', 'resolved', 'waived')
  ),
  mitigation_plan text,
  owner_user_id uuid,
  target_resolution_date date,
  created_by uuid,
  created_at timestamptz default now(),
  resolved_at timestamptz
);

create table if not exists public.backup_restore_operations (
  id uuid primary key default gen_random_uuid(),
  operation_type text not null check (
    operation_type in ('backup_check', 'restore_dryrun', 'integrity_check', 'checksum_review', 'disaster_recovery_drill')
  ),
  operation_status text not null default 'pending' check (
    operation_status in ('pending', 'running', 'passed', 'failed', 'warning', 'waived')
  ),
  operation_summary text not null,
  last_run_at timestamptz,
  next_due_at timestamptz,
  owner_user_id uuid,
  evidence_reference text,
  checksum_reference text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.bilingual_readiness_items (
  id uuid primary key default gen_random_uuid(),
  item_key text not null,
  item_area text not null,
  language_code text not null default 'ar',
  readiness_status text not null default 'missing' check (
    readiness_status in ('missing', 'partial', 'ready', 'needs_review', 'waived')
  ),
  source_reference text,
  english_text text,
  localized_text text,
  owner_user_id uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.navigation_simplification_items (
  id uuid primary key default gen_random_uuid(),
  route_key text not null,
  route_label text not null,
  current_group text,
  proposed_group text,
  simplification_status text not null default 'review' check (
    simplification_status in ('review', 'keep', 'consolidate', 'hide_from_daily_nav', 'admin_only', 'deprecated', 'completed')
  ),
  risk_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.production_hardening_events (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid,
  event_type text not null,
  event_summary text not null,
  actor_user_id uuid,
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.production_readiness_signoffs enable row level security;
alter table public.production_known_limitations enable row level security;
alter table public.backup_restore_operations enable row level security;
alter table public.bilingual_readiness_items enable row level security;
alter table public.navigation_simplification_items enable row level security;
alter table public.production_hardening_events enable row level security;

-- RLS Policies
create policy "grc_production_readiness_signoffs_read" on public.production_readiness_signoffs
  for select to authenticated using (true);

create policy "grc_production_readiness_signoffs_all" on public.production_readiness_signoffs
  for all to authenticated using (
    exists (
      select 1 from public.user_roles ur 
      where ur.user_id = auth.uid() 
        and ur.role in ('super_admin', 'governance_admin', 'compliance_officer', 'security_officer')
    )
  );

create policy "grc_production_known_limitations_read" on public.production_known_limitations
  for select to authenticated using (true);

create policy "grc_production_known_limitations_all" on public.production_known_limitations
  for all to authenticated using (
    exists (
      select 1 from public.user_roles ur 
      where ur.user_id = auth.uid() 
        and ur.role in ('super_admin', 'governance_admin', 'compliance_officer', 'security_officer')
    )
  );

create policy "grc_backup_restore_operations_read" on public.backup_restore_operations
  for select to authenticated using (true);

create policy "grc_backup_restore_operations_all" on public.backup_restore_operations
  for all to authenticated using (
    exists (
      select 1 from public.user_roles ur 
      where ur.user_id = auth.uid() 
        and ur.role in ('super_admin', 'governance_admin', 'security_officer')
    )
  );

create policy "grc_bilingual_readiness_items_read" on public.bilingual_readiness_items
  for select to authenticated using (true);

create policy "grc_bilingual_readiness_items_all" on public.bilingual_readiness_items
  for all to authenticated using (
    exists (
      select 1 from public.user_roles ur 
      where ur.user_id = auth.uid() 
        and ur.role in ('super_admin', 'governance_admin', 'compliance_officer')
    )
  );

create policy "grc_navigation_simplification_items_read" on public.navigation_simplification_items
  for select to authenticated using (true);

create policy "grc_navigation_simplification_items_all" on public.navigation_simplification_items
  for all to authenticated using (
    exists (
      select 1 from public.user_roles ur 
      where ur.user_id = auth.uid() 
        and ur.role in ('super_admin', 'governance_admin', 'compliance_officer')
    )
  );

create policy "grc_production_hardening_events_read" on public.production_hardening_events
  for select to authenticated using (true);

create policy "grc_production_hardening_events_all" on public.production_hardening_events
  for all to authenticated using (
    exists (
      select 1 from public.user_roles ur 
      where ur.user_id = auth.uid() 
        and ur.role in ('super_admin', 'governance_admin')
    )
  );

-- Event Logging Helper
create or replace function public.log_production_hardening_event(
  p_entity_type text,
  p_entity_id uuid,
  p_event_type text,
  p_event_summary text,
  p_actor_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.production_hardening_events (entity_type, entity_id, event_type, event_summary, actor_user_id)
  values (p_entity_type, p_entity_id, p_event_type, p_event_summary, p_actor_user_id);
end;
$$;

revoke all on function public.log_production_hardening_event(text, uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.log_production_hardening_event(text, uuid, text, text, uuid) to service_role;

-- 2. Create Views
-- 1. v_patch40_production_readiness_signoff_register
create or replace view public.v_patch40_production_readiness_signoff_register as
select * from public.production_readiness_signoffs;

-- 2. v_patch40_go_no_go_dashboard
create or replace view public.v_patch40_go_no_go_dashboard as
select
  count(*)::integer as total_signoffs,
  count(case when signoff_status in ('ready', 'ready_with_limitations', 'waived') then 1 end)::integer as approved_signoffs,
  count(case when signoff_status = 'pending' then 1 end)::integer as pending_signoffs,
  count(case when signoff_status in ('blocked', 'rejected') then 1 end)::integer as blocked_signoffs,
  case 
    when count(*) = 0 then 100.0
    else round((count(case when signoff_status in ('ready', 'ready_with_limitations', 'waived') then 1 end)::numeric / count(*)::numeric) * 100, 2)
  end as readiness_percentage
from public.production_readiness_signoffs;

-- 3. v_patch40_known_limitations_register
create or replace view public.v_patch40_known_limitations_register as
select * from public.production_known_limitations;

-- 4. v_patch40_blocking_limitations
create or replace view public.v_patch40_blocking_limitations as
select * 
from public.production_known_limitations
where limitation_status in ('open', 'mitigation_in_progress')
  and severity in ('high', 'critical');

-- 5. v_patch40_backup_restore_operations_dashboard
create or replace view public.v_patch40_backup_restore_operations_dashboard as
select * from public.backup_restore_operations;

-- 6. v_patch40_bilingual_readiness_dashboard
create or replace view public.v_patch40_bilingual_readiness_dashboard as
select
  count(*)::integer as total_items,
  count(case when readiness_status = 'ready' then 1 end)::integer as ready_items,
  count(case when readiness_status in ('missing', 'partial') then 1 end)::integer as incomplete_items,
  count(case when readiness_status = 'needs_review' then 1 end)::integer as review_items
from public.bilingual_readiness_items;

-- 7. v_patch40_missing_translation_register
create or replace view public.v_patch40_missing_translation_register as
select * 
from public.bilingual_readiness_items
where readiness_status in ('missing', 'partial');

-- 8. v_patch40_navigation_simplification_register
create or replace view public.v_patch40_navigation_simplification_register as
select * from public.navigation_simplification_items;

-- 9. v_patch40_runtime_rpc_signoff_dashboard
create or replace view public.v_patch40_runtime_rpc_signoff_dashboard as
select
  count(*)::integer as total_runtime_rpcs,
  count(case when signoff_status = 'approved_for_production' then 1 end)::integer as approved,
  count(case when signoff_status in ('pending_review', 'pending_security_review') then 1 end)::integer as pending_review,
  count(case when signoff_status = 'privileged_admin_review' then 1 end)::integer as privileged_review,
  count(case when signoff_status = 'rejected_for_production' then 1 end)::integer as rejected_blocked,
  count(case when service_role_only = true and frontend_transport = 'direct_browser_rpc' then 1 end)::integer as service_role_only_frontend_calls,
  0::integer as broad_security_definer_execute_grants
from public.runtime_rpc_classifications;

-- 10. v_patch40_proof_suite_readiness_summary
create or replace view public.v_patch40_proof_suite_readiness_summary as
select
  count(*)::integer as total_suites,
  count(case when signoff_status = 'ready' then 1 end)::integer as passed_suites,
  count(case when signoff_status = 'blocked' then 1 end)::integer as failed_suites
from public.production_readiness_signoffs
where signoff_area = 'proof_suite';

-- 11. v_patch40_controlled_pilot_readiness_summary
create or replace view public.v_patch40_controlled_pilot_readiness_summary as
select 
  signoff_area,
  signoff_status,
  signoff_notes
from public.production_readiness_signoffs
where signoff_area in ('persona_access', 'evidence_bridge', 'accreditation_workflow');

-- 12. v_patch40_executive_production_readiness_summary
create or replace view public.v_patch40_executive_production_readiness_summary as
select
  total_signoffs,
  approved_signoffs as ready_signoffs,
  blocked_signoffs,
  case 
    when blocked_signoffs > 0 then 'blocked'
    when pending_signoffs > 0 then 'pending'
    when approved_signoffs = total_signoffs then 'ready'
    else 'ready_with_limitations'
  end as overall_status
from public.v_patch40_go_no_go_dashboard;


-- 3. Create PL/pgSQL Functions (RPCs)
-- 1. create_production_readiness_signoff
create or replace function public.create_production_readiness_signoff(
  p_signoff_area text,
  p_signoff_status text,
  p_notes text,
  p_evidence_ref text,
  p_actor_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then 
    raise exception 'PATCH40_HARDENING_SERVICE_ROLE_REQUIRED'; 
  end if;

  insert into public.production_readiness_signoffs (signoff_area, signoff_status, signoff_notes, evidence_reference, signoff_owner_user_id)
  values (p_signoff_area, p_signoff_status, p_notes, p_evidence_ref, p_actor_id)
  returning id into v_id;

  perform public.log_production_hardening_event(
    'production_readiness_signoffs', v_id, 'created',
    'Production readiness signoff created for area: ' || p_signoff_area || '. Status: ' || p_signoff_status,
    p_actor_id
  );

  return v_id;
end;
$$;

revoke all on function public.create_production_readiness_signoff(text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.create_production_readiness_signoff(text, text, text, text, uuid) to service_role;

-- 2. update_production_readiness_signoff_status
create or replace function public.update_production_readiness_signoff_status(
  p_id uuid,
  p_status text,
  p_notes text,
  p_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then 
    raise exception 'PATCH40_HARDENING_SERVICE_ROLE_REQUIRED'; 
  end if;

  update public.production_readiness_signoffs
  set signoff_status = p_status, 
      signoff_notes = p_notes,
      signed_by = p_actor_id,
      signed_at = now(),
      updated_at = now()
  where id = p_id;

  if not found then raise exception 'PATCH40_SIGNOFF_NOT_FOUND'; end if;

  perform public.log_production_hardening_event(
    'production_readiness_signoffs', p_id, 'status_updated',
    'Production readiness signoff status updated to: ' || p_status,
    p_actor_id
  );
end;
$$;

revoke all on function public.update_production_readiness_signoff_status(uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.update_production_readiness_signoff_status(uuid, text, text, uuid) to service_role;

-- 3. create_known_limitation
create or replace function public.create_known_limitation(
  p_title text,
  p_description text,
  p_area text,
  p_severity text,
  p_mitigation text,
  p_actor_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then 
    raise exception 'PATCH40_HARDENING_SERVICE_ROLE_REQUIRED'; 
  end if;

  insert into public.production_known_limitations (limitation_title, limitation_description, limitation_area, severity, mitigation_plan, owner_user_id, created_by)
  values (p_title, p_description, p_area, p_severity, p_mitigation, p_actor_id, p_actor_id)
  returning id into v_id;

  perform public.log_production_hardening_event(
    'production_known_limitations', v_id, 'created',
    'Known limitation created: "' || p_title || '" in area: ' || p_area,
    p_actor_id
  );

  return v_id;
end;
$$;

revoke all on function public.create_known_limitation(text, text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.create_known_limitation(text, text, text, text, text, uuid) to service_role;

-- 4. update_known_limitation_status
create or replace function public.update_known_limitation_status(
  p_id uuid,
  p_status text,
  p_mitigation text,
  p_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then 
    raise exception 'PATCH40_HARDENING_SERVICE_ROLE_REQUIRED'; 
  end if;

  update public.production_known_limitations
  set limitation_status = p_status,
      mitigation_plan = p_mitigation,
      resolved_at = case when p_status = 'resolved' then now() else resolved_at end
  where id = p_id;

  if not found then raise exception 'PATCH40_LIMITATION_NOT_FOUND'; end if;

  perform public.log_production_hardening_event(
    'production_known_limitations', p_id, 'status_updated',
    'Known limitation status updated to: ' || p_status,
    p_actor_id
  );
end;
$$;

revoke all on function public.update_known_limitation_status(uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.update_known_limitation_status(uuid, text, text, uuid) to service_role;

-- 5. create_backup_restore_operation
create or replace function public.create_backup_restore_operation(
  p_type text,
  p_status text,
  p_summary text,
  p_evidence text,
  p_actor_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then 
    raise exception 'PATCH40_HARDENING_SERVICE_ROLE_REQUIRED'; 
  end if;

  insert into public.backup_restore_operations (operation_type, operation_status, operation_summary, evidence_reference, owner_user_id)
  values (p_type, p_status, p_summary, p_evidence, p_actor_id)
  returning id into v_id;

  perform public.log_production_hardening_event(
    'backup_restore_operations', v_id, 'created',
    'Backup/restore operation log created: ' || p_type || ' with status: ' || p_status,
    p_actor_id
  );

  return v_id;
end;
$$;

revoke all on function public.create_backup_restore_operation(text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.create_backup_restore_operation(text, text, text, text, uuid) to service_role;

-- 6. update_backup_restore_operation_status
create or replace function public.update_backup_restore_operation_status(
  p_id uuid,
  p_status text,
  p_summary text,
  p_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then 
    raise exception 'PATCH40_HARDENING_SERVICE_ROLE_REQUIRED'; 
  end if;

  update public.backup_restore_operations
  set operation_status = p_status,
      operation_summary = p_summary,
      last_run_at = now(),
      updated_at = now()
  where id = p_id;

  if not found then raise exception 'PATCH40_OPERATION_NOT_FOUND'; end if;

  perform public.log_production_hardening_event(
    'backup_restore_operations', p_id, 'status_updated',
    'Backup/restore operation status updated to: ' || p_status,
    p_actor_id
  );
end;
$$;

revoke all on function public.update_backup_restore_operation_status(uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.update_backup_restore_operation_status(uuid, text, text, uuid) to service_role;

-- 7. create_bilingual_readiness_item
create or replace function public.create_bilingual_readiness_item(
  p_key text,
  p_area text,
  p_lang text,
  p_status text,
  p_eng text,
  p_loc text,
  p_actor_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then 
    raise exception 'PATCH40_HARDENING_SERVICE_ROLE_REQUIRED'; 
  end if;

  insert into public.bilingual_readiness_items (item_key, item_area, language_code, readiness_status, english_text, localized_text, owner_user_id)
  values (p_key, p_area, p_lang, p_status, p_eng, p_loc, p_actor_id)
  returning id into v_id;

  perform public.log_production_hardening_event(
    'bilingual_readiness_items', v_id, 'created',
    'Bilingual readiness item created: key=' || p_key || ' status=' || p_status,
    p_actor_id
  );

  return v_id;
end;
$$;

revoke all on function public.create_bilingual_readiness_item(text, text, text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.create_bilingual_readiness_item(text, text, text, text, text, text, uuid) to service_role;

-- 8. update_bilingual_readiness_status
create or replace function public.update_bilingual_readiness_status(
  p_id uuid,
  p_status text,
  p_loc text,
  p_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then 
    raise exception 'PATCH40_HARDENING_SERVICE_ROLE_REQUIRED'; 
  end if;

  update public.bilingual_readiness_items
  set readiness_status = p_status,
      localized_text = p_loc,
      updated_at = now()
  where id = p_id;

  if not found then raise exception 'PATCH40_BILINGUAL_ITEM_NOT_FOUND'; end if;

  perform public.log_production_hardening_event(
    'bilingual_readiness_items', p_id, 'status_updated',
    'Bilingual readiness status updated to: ' || p_status,
    p_actor_id
  );
end;
$$;

revoke all on function public.update_bilingual_readiness_status(uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.update_bilingual_readiness_status(uuid, text, text, uuid) to service_role;

-- 9. create_navigation_simplification_item
create or replace function public.create_navigation_simplification_item(
  p_key text,
  p_label text,
  p_curr text,
  p_prop text,
  p_status text,
  p_actor_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then 
    raise exception 'PATCH40_HARDENING_SERVICE_ROLE_REQUIRED'; 
  end if;

  insert into public.navigation_simplification_items (route_key, route_label, current_group, proposed_group, simplification_status)
  values (p_key, p_label, p_curr, p_prop, p_status)
  returning id into v_id;

  perform public.log_production_hardening_event(
    'navigation_simplification_items', v_id, 'created',
    'Navigation simplification proposal created: route_key=' || p_key || ' status=' || p_status,
    p_actor_id
  );

  return v_id;
end;
$$;

revoke all on function public.create_navigation_simplification_item(text, text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.create_navigation_simplification_item(text, text, text, text, text, uuid) to service_role;

-- 10. update_navigation_simplification_status
create or replace function public.update_navigation_simplification_status(
  p_id uuid,
  p_status text,
  p_notes text,
  p_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then 
    raise exception 'PATCH40_HARDENING_SERVICE_ROLE_REQUIRED'; 
  end if;

  update public.navigation_simplification_items
  set simplification_status = p_status,
      risk_notes = p_notes,
      updated_at = now()
  where id = p_id;

  if not found then raise exception 'PATCH40_ROUTE_PROPOSAL_NOT_FOUND'; end if;

  perform public.log_production_hardening_event(
    'navigation_simplification_items', p_id, 'status_updated',
    'Navigation route simplification status updated to: ' || p_status,
    p_actor_id
  );
end;
$$;

revoke all on function public.update_navigation_simplification_status(uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.update_navigation_simplification_status(uuid, text, text, uuid) to service_role;

-- 11. record_production_hardening_event
create or replace function public.record_production_hardening_event(
  p_entity_type text,
  p_entity_id uuid,
  p_event_type text,
  p_event_summary text,
  p_actor_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then 
    raise exception 'PATCH40_HARDENING_SERVICE_ROLE_REQUIRED'; 
  end if;

  insert into public.production_hardening_events (entity_type, entity_id, event_type, event_summary, actor_user_id)
  values (p_entity_type, p_entity_id, p_event_type, p_event_summary, p_actor_id)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.record_production_hardening_event(text, uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.record_production_hardening_event(text, uuid, text, text, uuid) to service_role;

-- 12. get_go_no_go_dashboard
create or replace function public.get_go_no_go_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_res jsonb;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then 
    raise exception 'PATCH40_HARDENING_SERVICE_ROLE_REQUIRED'; 
  end if;

  select jsonb_build_object(
    'total_signoffs', total_signoffs,
    'approved_signoffs', approved_signoffs,
    'pending_signoffs', pending_signoffs,
    'blocked_signoffs', blocked_signoffs,
    'readiness_percentage', readiness_percentage
  ) into v_res
  from public.v_patch40_go_no_go_dashboard;

  return v_res;
end;
$$;

revoke all on function public.get_go_no_go_dashboard() from public, anon, authenticated;
grant execute on function public.get_go_no_go_dashboard() to service_role;

-- 13. get_production_readiness_summary
create or replace function public.get_production_readiness_summary()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_res jsonb;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then 
    raise exception 'PATCH40_HARDENING_SERVICE_ROLE_REQUIRED'; 
  end if;

  select jsonb_build_object(
    'total_signoffs', total_signoffs,
    'ready_signoffs', ready_signoffs,
    'blocked_signoffs', blocked_signoffs,
    'overall_status', overall_status
  ) into v_res
  from public.v_patch40_executive_production_readiness_summary;

  return v_res;
end;
$$;

revoke all on function public.get_production_readiness_summary() from public, anon, authenticated;
grant execute on function public.get_production_readiness_summary() to service_role;

-- Set Security Invoker on Views
alter view public.v_patch40_production_readiness_signoff_register set (security_invoker = true);
alter view public.v_patch40_go_no_go_dashboard set (security_invoker = true);
alter view public.v_patch40_known_limitations_register set (security_invoker = true);
alter view public.v_patch40_blocking_limitations set (security_invoker = true);
alter view public.v_patch40_backup_restore_operations_dashboard set (security_invoker = true);
alter view public.v_patch40_bilingual_readiness_dashboard set (security_invoker = true);
alter view public.v_patch40_missing_translation_register set (security_invoker = true);
alter view public.v_patch40_navigation_simplification_register set (security_invoker = true);
alter view public.v_patch40_runtime_rpc_signoff_dashboard set (security_invoker = true);
alter view public.v_patch40_proof_suite_readiness_summary set (security_invoker = true);
alter view public.v_patch40_controlled_pilot_readiness_summary set (security_invoker = true);
alter view public.v_patch40_executive_production_readiness_summary set (security_invoker = true);
