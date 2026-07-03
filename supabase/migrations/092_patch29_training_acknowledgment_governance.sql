-- Migration: supabase/migrations/092_patch29_training_acknowledgment_governance.sql
-- Description: Adds Patch 29 Training, Acknowledgment & Competency Governance tables, views, and functions.

-- 1. Create Tables
create table if nulls not exists public.training_programs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  title_ar text,
  description text,
  training_type text not null check (
    training_type in (
      'sop_acknowledgment', 'compliance_training', 'accreditation_training', 
      'capa_training', 'risk_training', 'audit_training', 
      'orientation', 'competency'
    )
  ),
  linked_document_id uuid,
  linked_sop_id uuid,
  linked_compliance_obligation_id uuid,
  linked_capa_id uuid,
  linked_risk_id uuid,
  linked_audit_finding_id uuid,
  owner_user_id uuid,
  department_id uuid,
  active boolean default true,
  created_at timestamptz default now(),
  created_by uuid
);

create table if nulls not exists public.training_assignments (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.training_programs(id) on delete cascade,
  assigned_to_user_id uuid,
  assigned_to_role text,
  assigned_to_department_id uuid,
  due_date date,
  status text not null default 'assigned' check (
    status in ('assigned', 'in_progress', 'completed', 'overdue', 'waived', 'cancelled')
  ),
  assigned_at timestamptz default now(),
  assigned_by uuid,
  completed_at timestamptz,
  completion_evidence_id uuid
);

create table if nulls not exists public.training_acknowledgments (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.training_assignments(id) on delete cascade,
  user_id uuid not null,
  acknowledged_at timestamptz default now(),
  acknowledgment_text text,
  ip_address text,
  user_agent text,
  evidence_id uuid
);

create table if nulls not exists public.competency_assessments (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid references public.training_assignments(id) on delete set null,
  user_id uuid not null,
  assessor_user_id uuid,
  competency_area text not null,
  result text not null check (
    result in ('passed', 'failed', 'needs_retraining', 'pending')
  ),
  score numeric,
  assessed_at timestamptz default now(),
  evidence_id uuid,
  notes text
);

create table if nulls not exists public.training_events (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  event_type text not null,
  event_summary text not null,
  actor_user_id uuid,
  created_at timestamptz default now()
);

-- Add Indexing
create index if not exists idx_training_assignments_user on public.training_assignments(assigned_to_user_id);
create index if not exists idx_training_assignments_program on public.training_assignments(program_id);
create index if not exists idx_training_acknowledgments_user on public.training_acknowledgments(user_id);
create index if not exists idx_competency_assessments_user on public.competency_assessments(user_id);

-- Enable RLS
alter table public.training_programs enable row level security;
alter table public.training_assignments enable row level security;
alter table public.training_acknowledgments enable row level security;
alter table public.competency_assessments enable row level security;
alter table public.training_events enable row level security;

-- Conservative RLS Policies
create policy "grc_training_programs_select_policy" on public.training_programs
  for select to authenticated using (active = true or owner_user_id = auth.uid());

create policy "grc_training_programs_all_policy" on public.training_programs
  for all to authenticated using (
    exists (
      select 1 from public.user_roles ur 
      where ur.user_id = auth.uid() 
        and ur.role in ('super_admin', 'governance_admin', 'compliance_officer')
    )
  );

create policy "grc_training_assignments_select_policy" on public.training_assignments
  for select to authenticated using (
    assigned_to_user_id = auth.uid() or 
    exists (
      select 1 from public.user_roles ur 
      where ur.user_id = auth.uid() 
        and ur.role in ('super_admin', 'governance_admin', 'compliance_officer', 'department_manager')
    )
  );

create policy "grc_training_assignments_all_policy" on public.training_assignments
  for all to authenticated using (
    exists (
      select 1 from public.user_roles ur 
      where ur.user_id = auth.uid() 
        and ur.role in ('super_admin', 'governance_admin', 'compliance_officer')
    )
  );

create policy "grc_training_acknowledgments_select_policy" on public.training_acknowledgments
  for select to authenticated using (
    user_id = auth.uid() or 
    exists (
      select 1 from public.user_roles ur 
      where ur.user_id = auth.uid() 
        and ur.role in ('super_admin', 'governance_admin', 'compliance_officer')
    )
  );

create policy "grc_training_acknowledgments_insert_policy" on public.training_acknowledgments
  for insert to authenticated with check (user_id = auth.uid());

create policy "grc_competency_assessments_select_policy" on public.competency_assessments
  for select to authenticated using (
    user_id = auth.uid() or assessor_user_id = auth.uid() or
    exists (
      select 1 from public.user_roles ur 
      where ur.user_id = auth.uid() 
        and ur.role in ('super_admin', 'governance_admin', 'compliance_officer')
    )
  );

create policy "grc_competency_assessments_all_policy" on public.competency_assessments
  for all to authenticated using (
    exists (
      select 1 from public.user_roles ur 
      where ur.user_id = auth.uid() 
        and ur.role in ('super_admin', 'governance_admin', 'compliance_officer')
    )
  );

create policy "grc_training_events_select_policy" on public.training_events
  for select to authenticated using (true);

-- 2. Create Event Logging Helper Function
create or replace function public.log_training_event(
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
  insert into public.training_events (entity_type, entity_id, event_type, event_summary, actor_user_id)
  values (p_entity_type, p_entity_id, p_event_type, p_event_summary, p_actor_user_id);
end;
$$;

revoke all on function public.log_training_event(text, uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.log_training_event(text, uuid, text, text, uuid) to service_role;

-- 3. Create Views
-- 1. v_patch29_training_program_register
create or replace view public.v_patch29_training_program_register as
select 
  tp.*,
  d.name_en as department_name_en,
  d.name_ar as department_name_ar,
  p.full_name_en as owner_name_en,
  p.full_name_ar as owner_name_ar
from public.training_programs tp
left join public.departments d on tp.department_id = d.id
left join public.profiles p on tp.owner_user_id = p.id;

-- 2. v_patch29_training_assignment_queue
create or replace view public.v_patch29_training_assignment_queue as
select 
  ta.*,
  tp.title as program_title,
  tp.title_ar as program_title_ar,
  tp.training_type,
  p_assign.full_name_en as assigned_user_name_en,
  p_assign.full_name_ar as assigned_user_name_ar,
  d.name_en as department_name_en,
  d.name_ar as department_name_ar
from public.training_assignments ta
join public.training_programs tp on ta.program_id = tp.id
left join public.profiles p_assign on ta.assigned_to_user_id = p_assign.id
left join public.departments d on ta.assigned_to_department_id = d.id;

-- 3. v_patch29_overdue_training_assignments
create or replace view public.v_patch29_overdue_training_assignments as
select * 
from public.v_patch29_training_assignment_queue
where status in ('assigned', 'in_progress') and due_date < current_date;

-- 4. v_patch29_sop_acknowledgment_gap
create or replace view public.v_patch29_sop_acknowledgment_gap as
select 
  tp.id as program_id,
  tp.title as sop_title,
  tp.title_ar as sop_title_ar,
  tp.linked_sop_id,
  p.id as user_id,
  p.full_name_en as user_name_en,
  p.full_name_ar as user_name_ar,
  p.department_id,
  d.name_en as department_name_en,
  d.name_ar as department_name_ar
from public.training_programs tp
cross join public.profiles p
left join public.departments d on p.department_id = d.id
where tp.training_type = 'sop_acknowledgment' and tp.active = true and p.is_active = true
and not exists (
  select 1 
  from public.training_assignments ta
  join public.training_acknowledgments tk on tk.assignment_id = ta.id
  where ta.program_id = tp.id and ta.assigned_to_user_id = p.id and ta.status = 'completed'
);

-- 5. v_patch29_competency_gap_dashboard
create or replace view public.v_patch29_competency_gap_dashboard as
select 
  p.id as user_id,
  p.full_name_en as user_name_en,
  p.full_name_ar as user_name_ar,
  ca.competency_area,
  ca.result,
  ca.score,
  ca.assessed_at,
  ca.assessor_user_id,
  p_assess.full_name_en as assessor_name_en,
  p_assess.full_name_ar as assessor_name_ar
from public.profiles p
left join public.competency_assessments ca on p.id = ca.user_id
left join public.profiles p_assess on ca.assessor_user_id = p_assess.id
where p.is_active = true and (ca.result = 'failed' or ca.result = 'needs_retraining' or ca.id is null);

-- 6. v_patch29_training_evidence_index
create or replace view public.v_patch29_training_evidence_index as
select 
  ef.id as evidence_id,
  ef.file_name,
  ef.file_path,
  ef.created_at as uploaded_at,
  ta.id as assignment_id,
  tp.title as program_title,
  tp.training_type,
  p.full_name_en as user_name_en,
  p.full_name_ar as user_name_ar
from public.evidence_files ef
join public.training_assignments ta on ta.completion_evidence_id = ef.id
join public.training_programs tp on ta.program_id = tp.id
left join public.profiles p on ta.assigned_to_user_id = p.id;

-- 7. v_patch29_training_executive_summary
create or replace view public.v_patch29_training_executive_summary as
select
  (select count(*) from public.training_programs where active = true) as active_programs_count,
  (select count(*) from public.training_assignments where status in ('assigned', 'in_progress')) as pending_assignments_count,
  (select count(*) from public.training_assignments where status = 'completed') as completed_assignments_count,
  (select count(*) from public.v_patch29_overdue_training_assignments) as overdue_assignments_count,
  (select count(*) from public.v_patch29_sop_acknowledgment_gap) as total_sop_gaps_count,
  (select count(*) from public.v_patch29_competency_gap_dashboard where result is not null) as competency_fails_count;

-- 8. v_patch29_accreditation_training_readiness
create or replace view public.v_patch29_accreditation_training_readiness as
select 
  tp.id as program_id,
  tp.title as program_title,
  tp.title_ar as program_title_ar,
  tp.training_type,
  tp.department_id,
  d.name_en as department_name_en,
  d.name_ar as department_name_ar,
  count(ta.id) as total_assigned,
  count(case when ta.status = 'completed' then 1 end) as total_completed,
  count(case when ta.status = 'overdue' then 1 end) as total_overdue,
  case 
    when count(ta.id) = 0 then 0.0
    else round((count(case when ta.status = 'completed' then 1 end)::numeric / count(ta.id)::numeric) * 100, 2)
  end as completion_rate
from public.training_programs tp
left join public.training_assignments ta on ta.program_id = tp.id
left join public.departments d on tp.department_id = d.id
where tp.training_type = 'accreditation_training'
group by tp.id, tp.title, tp.title_ar, tp.training_type, tp.department_id, d.name_en, d.name_ar;


-- 4. Create PL/pgSQL Functions (RPCs)
-- 1. create_training_program
create or replace function public.create_training_program(
  p_title text,
  p_title_ar text,
  p_description text,
  p_training_type text,
  p_linked_document_id uuid,
  p_linked_sop_id uuid,
  p_linked_compliance_obligation_id uuid,
  p_linked_capa_id uuid,
  p_linked_risk_id uuid,
  p_linked_audit_finding_id uuid,
  p_owner_user_id uuid,
  p_department_id uuid,
  p_actor_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_program_id uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then 
    raise exception 'PATCH29_TRAINING_SERVICE_ROLE_REQUIRED'; 
  end if;

  insert into public.training_programs (
    title, title_ar, description, training_type, linked_document_id, linked_sop_id,
    linked_compliance_obligation_id, linked_capa_id, linked_risk_id, linked_audit_finding_id,
    owner_user_id, department_id, created_by
  )
  values (
    p_title, p_title_ar, p_description, p_training_type, p_linked_document_id, p_linked_sop_id,
    p_linked_compliance_obligation_id, p_linked_capa_id, p_linked_risk_id, p_linked_audit_finding_id,
    p_owner_user_id, p_department_id, p_actor_id
  )
  returning id into v_program_id;

  perform public.log_training_event(
    'training_programs', v_program_id, 'created', 
    'Training program "' || p_title || '" of type ' || p_training_type || ' was created.', 
    p_actor_id
  );

  return v_program_id;
end;
$$;

revoke all on function public.create_training_program(text, text, text, text, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.create_training_program(text, text, text, text, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid) to service_role;

-- 2. assign_training_program_to_user
create or replace function public.assign_training_program_to_user(
  p_program_id uuid,
  p_user_id uuid,
  p_due_date date,
  p_actor_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_assignment_id uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then 
    raise exception 'PATCH29_TRAINING_SERVICE_ROLE_REQUIRED'; 
  end if;

  insert into public.training_assignments (program_id, assigned_to_user_id, due_date, assigned_by)
  values (p_program_id, p_user_id, p_due_date, p_actor_id)
  returning id into v_assignment_id;

  perform public.log_training_event(
    'training_assignments', v_assignment_id, 'assigned', 
    'Training assignment created for user ' || p_user_id || '.', 
    p_actor_id
  );

  return v_assignment_id;
end;
$$;

revoke all on function public.assign_training_program_to_user(uuid, uuid, date, uuid) from public, anon, authenticated;
grant execute on function public.assign_training_program_to_user(uuid, uuid, date, uuid) to service_role;

-- 3. assign_training_program_to_department
create or replace function public.assign_training_program_to_department(
  p_program_id uuid,
  p_department_id uuid,
  p_due_date date,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer := 0;
  v_user_row record;
  v_assignment_id uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then 
    raise exception 'PATCH29_TRAINING_SERVICE_ROLE_REQUIRED'; 
  end if;

  for v_user_row in 
    select id from public.profiles where department_id = p_department_id and is_active = true
  loop
    insert into public.training_assignments (program_id, assigned_to_user_id, assigned_to_department_id, due_date, assigned_by)
    values (p_program_id, v_user_row.id, p_department_id, p_due_date, p_actor_id)
    returning id into v_assignment_id;

    perform public.log_training_event(
      'training_assignments', v_assignment_id, 'assigned', 
      'Training assignment created via department ' || p_department_id || ' rollout.', 
      p_actor_id
    );

    v_count := v_count + 1;
  end loop;

  return jsonb_build_object('status', 'ok', 'assigned_count', v_count);
end;
$$;

revoke all on function public.assign_training_program_to_department(uuid, uuid, date, uuid) from public, anon, authenticated;
grant execute on function public.assign_training_program_to_department(uuid, uuid, date, uuid) to service_role;

-- 4. start_training_assignment
create or replace function public.start_training_assignment(
  p_assignment_id uuid,
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
    raise exception 'PATCH29_TRAINING_SERVICE_ROLE_REQUIRED'; 
  end if;

  update public.training_assignments
  set status = 'in_progress'
  where id = p_assignment_id and status = 'assigned';

  if not found then
    raise exception 'PATCH29_ASSIGNMENT_NOT_STARTABLE';
  end if;

  perform public.log_training_event(
    'training_assignments', p_assignment_id, 'started', 
    'Training status updated to in_progress.', 
    p_actor_id
  );
end;
$$;

revoke all on function public.start_training_assignment(uuid, uuid) from public, anon, authenticated;
grant execute on function public.start_training_assignment(uuid, uuid) to service_role;

-- 5. complete_training_assignment
create or replace function public.complete_training_assignment(
  p_assignment_id uuid,
  p_evidence_id uuid,
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
    raise exception 'PATCH29_TRAINING_SERVICE_ROLE_REQUIRED'; 
  end if;

  update public.training_assignments
  set status = 'completed', completed_at = now(), completion_evidence_id = p_evidence_id
  where id = p_assignment_id and status in ('assigned', 'in_progress', 'overdue');

  if not found then
    raise exception 'PATCH29_ASSIGNMENT_NOT_COMPLETABLE';
  end if;

  perform public.log_training_event(
    'training_assignments', p_assignment_id, 'completed', 
    'Training completed successfully with evidence ' || coalesce(p_evidence_id::text, 'none') || '.', 
    p_actor_id
  );
end;
$$;

revoke all on function public.complete_training_assignment(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.complete_training_assignment(uuid, uuid, uuid) to service_role;

-- 6. acknowledge_training_assignment
create or replace function public.acknowledge_training_assignment(
  p_assignment_id uuid,
  p_acknowledgment_text text,
  p_ip_address text,
  p_user_agent text,
  p_evidence_id uuid,
  p_actor_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ack_id uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then 
    raise exception 'PATCH29_TRAINING_SERVICE_ROLE_REQUIRED'; 
  end if;

  -- 1. Create the acknowledgment record
  insert into public.training_acknowledgments (assignment_id, user_id, acknowledgment_text, ip_address, user_agent, evidence_id)
  values (p_assignment_id, p_actor_id, p_acknowledgment_text, p_ip_address, p_user_agent, p_evidence_id)
  returning id into v_ack_id;

  -- 2. Mark the parent assignment as completed
  update public.training_assignments
  set status = 'completed', completed_at = now(), completion_evidence_id = p_evidence_id
  where id = p_assignment_id;

  perform public.log_training_event(
    'training_acknowledgments', v_ack_id, 'acknowledged', 
    'User acknowledged compliance/SOP program.', 
    p_actor_id
  );

  return v_ack_id;
end;
$$;

revoke all on function public.acknowledge_training_assignment(uuid, text, text, text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.acknowledge_training_assignment(uuid, text, text, text, uuid, uuid) to service_role;

-- 7. waive_training_assignment_with_reason
create or replace function public.waive_training_assignment_with_reason(
  p_assignment_id uuid,
  p_reason text,
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
    raise exception 'PATCH29_TRAINING_SERVICE_ROLE_REQUIRED'; 
  end if;

  update public.training_assignments
  set status = 'waived'
  where id = p_assignment_id and status in ('assigned', 'in_progress', 'overdue');

  if not found then
    raise exception 'PATCH29_ASSIGNMENT_NOT_WAIVABLE';
  end if;

  perform public.log_training_event(
    'training_assignments', p_assignment_id, 'waived', 
    'Assignment waived with reason: ' || p_reason, 
    p_actor_id
  );
end;
$$;

revoke all on function public.waive_training_assignment_with_reason(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.waive_training_assignment_with_reason(uuid, text, uuid) to service_role;

-- 8. cancel_training_assignment_with_reason
create or replace function public.cancel_training_assignment_with_reason(
  p_assignment_id uuid,
  p_reason text,
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
    raise exception 'PATCH29_TRAINING_SERVICE_ROLE_REQUIRED'; 
  end if;

  update public.training_assignments
  set status = 'cancelled'
  where id = p_assignment_id;

  if not found then
    raise exception 'PATCH29_ASSIGNMENT_NOT_CANCELLABLE';
  end if;

  perform public.log_training_event(
    'training_assignments', p_assignment_id, 'cancelled', 
    'Assignment cancelled with reason: ' || p_reason, 
    p_actor_id
  );
end;
$$;

revoke all on function public.cancel_training_assignment_with_reason(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.cancel_training_assignment_with_reason(uuid, text, uuid) to service_role;

-- 9. record_competency_assessment
create or replace function public.record_competency_assessment(
  p_assignment_id uuid,
  p_user_id uuid,
  p_competency_area text,
  p_result text,
  p_score numeric,
  p_evidence_id uuid,
  p_notes text,
  p_actor_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_assessment_id uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then 
    raise exception 'PATCH29_TRAINING_SERVICE_ROLE_REQUIRED'; 
  end if;

  insert into public.competency_assessments (
    assignment_id, user_id, assessor_user_id, competency_area, result, score, evidence_id, notes
  )
  values (
    p_assignment_id, p_user_id, p_actor_id, p_competency_area, p_result, p_score, p_evidence_id, p_notes
  )
  returning id into v_assessment_id;

  perform public.log_training_event(
    'competency_assessments', v_assessment_id, 'assessed', 
    'Competency assessed for user ' || p_user_id || ' in area ' || p_competency_area || '. Result: ' || p_result, 
    p_actor_id
  );

  return v_assessment_id;
end;
$$;

revoke all on function public.record_competency_assessment(uuid, uuid, text, text, numeric, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.record_competency_assessment(uuid, uuid, text, text, numeric, uuid, text, uuid) to service_role;

-- 10. reopen_training_assignment_with_reason
create or replace function public.reopen_training_assignment_with_reason(
  p_assignment_id uuid,
  p_reason text,
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
    raise exception 'PATCH29_TRAINING_SERVICE_ROLE_REQUIRED'; 
  end if;

  update public.training_assignments
  set status = 'assigned', completed_at = null, completion_evidence_id = null
  where id = p_assignment_id;

  if not found then
    raise exception 'PATCH29_ASSIGNMENT_NOT_REOPENABLE';
  end if;

  perform public.log_training_event(
    'training_assignments', p_assignment_id, 'reopened', 
    'Assignment reopened for retraining. Reason: ' || p_reason, 
    p_actor_id
  );
end;
$$;

revoke all on function public.reopen_training_assignment_with_reason(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.reopen_training_assignment_with_reason(uuid, text, uuid) to service_role;

-- 11. link_training_evidence
create or replace function public.link_training_evidence(
  p_assignment_id uuid,
  p_evidence_id uuid,
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
    raise exception 'PATCH29_TRAINING_SERVICE_ROLE_REQUIRED'; 
  end if;

  update public.training_assignments
  set completion_evidence_id = p_evidence_id
  where id = p_assignment_id;

  if not found then
    raise exception 'PATCH29_ASSIGNMENT_NOT_FOUND';
  end if;

  perform public.log_training_event(
    'training_assignments', p_assignment_id, 'evidence_linked', 
    'Evidence record ' || p_evidence_id || ' linked to training assignment.', 
    p_actor_id
  );
end;
$$;

revoke all on function public.link_training_evidence(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.link_training_evidence(uuid, uuid, uuid) to service_role;

-- Set Security Invoker on Views
alter view public.v_patch29_training_program_register set (security_invoker = true);
alter view public.v_patch29_training_assignment_queue set (security_invoker = true);
alter view public.v_patch29_overdue_training_assignments set (security_invoker = true);
alter view public.v_patch29_sop_acknowledgment_gap set (security_invoker = true);
alter view public.v_patch29_competency_gap_dashboard set (security_invoker = true);
alter view public.v_patch29_training_evidence_index set (security_invoker = true);
alter view public.v_patch29_training_executive_summary set (security_invoker = true);
alter view public.v_patch29_accreditation_training_readiness set (security_invoker = true);
