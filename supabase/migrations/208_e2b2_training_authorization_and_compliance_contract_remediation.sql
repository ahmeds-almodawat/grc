-- ----------------------------------------------------------------------------
-- Migration: 208_e2b2_training_authorization_and_compliance_contract_remediation.sql
-- Description: GRC v1.4-E2B2 Training Authorization and Compliance Contract Remediation
-- Part A: Database source authorization hardening, browser DML lockdown, scoped SELECT policies,
-- and hardened operational training mutation RPCs.
-- (Part B will extend this same migration with acknowledgment and compliance read-model corrections).
-- ----------------------------------------------------------------------------

-- ============================================================================
-- 1. Browser Table Privilege Lockdown
-- Direct governed mutation must flow through privileged-action Edge bridge.
-- Revoke all direct browser mutation capabilities (INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER).
-- ============================================================================

-- A. training_programs
revoke all on table public.training_programs from anon, public;
revoke insert, update, delete, truncate, references, trigger on table public.training_programs from authenticated;
grant select on table public.training_programs to authenticated;
grant all on table public.training_programs to service_role;

-- B. training_assignments
revoke all on table public.training_assignments from anon, public;
revoke insert, update, delete, truncate, references, trigger on table public.training_assignments from authenticated;
grant select on table public.training_assignments to authenticated;
grant all on table public.training_assignments to service_role;

-- C. training_acknowledgments
revoke all on table public.training_acknowledgments from anon, public;
revoke insert, update, delete, truncate, references, trigger on table public.training_acknowledgments from authenticated;
grant select on table public.training_acknowledgments to authenticated;
grant all on table public.training_acknowledgments to service_role;

-- D. competency_assessments
revoke all on table public.competency_assessments from anon, public;
revoke insert, update, delete, truncate, references, trigger on table public.competency_assessments from authenticated;
grant select on table public.competency_assessments to authenticated;
grant all on table public.competency_assessments to service_role;

-- E. training_events
-- Revoke direct anon/authenticated access completely. Logging flows through service_role.
revoke all on table public.training_events from public, anon, authenticated;
grant all on table public.training_events to service_role;

-- F. document_acknowledgment_requirements (Temporary boundary: 208-A removes write, preserves same-org read)
revoke all on table public.document_acknowledgment_requirements from anon, public;
revoke insert, update, delete, truncate, references, trigger on table public.document_acknowledgment_requirements from authenticated;
grant select on table public.document_acknowledgment_requirements to authenticated;
grant all on table public.document_acknowledgment_requirements to service_role;

-- G. document_acknowledgments
revoke all on table public.document_acknowledgments from anon, public;
revoke insert, update, delete, truncate, references, trigger on table public.document_acknowledgments from authenticated;
grant select on table public.document_acknowledgments to authenticated;
grant all on table public.document_acknowledgments to service_role;

-- H. sop_version_training_target_scopes
revoke all on table public.sop_version_training_target_scopes from anon, public;
revoke insert, update, delete, truncate, references, trigger on table public.sop_version_training_target_scopes from authenticated;
grant select on table public.sop_version_training_target_scopes to authenticated;
grant all on table public.sop_version_training_target_scopes to service_role;

-- ============================================================================
-- 2. Drop Obsolete Permissive Browser Write Policies
-- Note: patch83u_credential_gate is RESTRICTIVE and is preserved.
-- ============================================================================
drop policy if exists "grc_training_programs_all_policy" on public.training_programs;
drop policy if exists "grc_training_assignments_all_policy" on public.training_assignments;
drop policy if exists "grc_training_acknowledgments_insert_policy" on public.training_acknowledgments;
drop policy if exists "grc_competency_assessments_all_policy" on public.competency_assessments;
drop policy if exists "document_ack_req_org_write_patch26" on public.document_acknowledgment_requirements;
drop policy if exists "document_ack_org_write_patch26" on public.document_acknowledgments;
drop policy if exists "grc_training_events_select_policy" on public.training_events;

-- ============================================================================
-- 3. Remediate Governed SELECT Policies
-- ============================================================================

-- 3A. Training Programs SELECT Policy (Organization-Safe)
drop policy if exists "grc_training_programs_select_policy" on public.training_programs;
create policy "grc_training_programs_select_policy" on public.training_programs
  for select to authenticated
  using (
    -- 1. Program owner can view owned program
    owner_user_id = auth.uid()
    -- 2. Employee with an active assignment to this program can view it
    or exists (
      select 1 from public.training_assignments ta
      where ta.program_id = training_programs.id
        and ta.assigned_to_user_id = auth.uid()
    )
    -- 3. Actor belongs to same organization and has legitimate authority / visibility
    or exists (
      select 1 from public.profiles actor_p
      where actor_p.id = auth.uid()
        and actor_p.organization_id is not null
        and (
          -- Derive program organization from linked SOP / controlled document
          exists (
            select 1 from public.controlled_documents cd
            where cd.id in (training_programs.linked_sop_id, training_programs.linked_document_id)
              and cd.organization_id = actor_p.organization_id
          )
          -- Derive program organization from linked department
          or exists (
            select 1 from public.departments d
            where d.id = training_programs.department_id
              and d.organization_id = actor_p.organization_id
          )
          -- Derive program organization from owner profile
          or exists (
            select 1 from public.profiles op
            where op.id = training_programs.owner_user_id
              and op.organization_id = actor_p.organization_id
          )
          -- Derive program organization from creator profile
          or exists (
            select 1 from public.profiles cp
            where cp.id = training_programs.created_by
              and cp.organization_id = actor_p.organization_id
          )
        )
        and (
          -- If active program, visible within same organization
          training_programs.active = true
          -- Or actor has governance / manager authority within organization
          or exists (
            select 1 from public.user_roles ur
            where ur.user_id = auth.uid()
              and ur.is_active = true
              and (
                (
                  ur.role in ('super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer')
                  and ur.scope = 'global'
                  and ur.organization_id = actor_p.organization_id
                )
                or (
                  ur.role = 'department_manager'
                  and ur.scope = 'department'
                  and ur.department_id is not null
                  and ur.department_id = training_programs.department_id
                )
              )
          )
        )
    )
  );

-- 3B. Training Assignments SELECT Policy (Scoped)
drop policy if exists "grc_training_assignments_select_policy" on public.training_assignments;
create policy "grc_training_assignments_select_policy" on public.training_assignments
  for select to authenticated
  using (
    -- Employee reads own assignments
    assigned_to_user_id = auth.uid()
    or exists (
      select 1
      from public.user_roles ur
      join public.profiles p on p.id = training_assignments.assigned_to_user_id
      where ur.user_id = auth.uid()
        and ur.is_active = true
        and (
          -- Department Manager: exact active department scope
          (
            ur.role = 'department_manager'
            and ur.scope = 'department'
            and ur.department_id is not null
            and p.department_id = ur.department_id
          )
          -- Division Head: exact active division scope
          or (
            ur.role = 'division_head'
            and ur.scope = 'division'
            and ur.division_id is not null
            and p.division_id = ur.division_id
          )
          -- Global read-only / governance roles: same organization
          or (
            ur.role in ('super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer')
            and ur.scope = 'global'
            and ur.organization_id is not null
            and p.organization_id = ur.organization_id
          )
        )
    )
  );

-- 3C. Competency Assessments SELECT Policy (Scoped)
drop policy if exists "grc_competency_assessments_select_policy" on public.competency_assessments;
create policy "grc_competency_assessments_select_policy" on public.competency_assessments
  for select to authenticated
  using (
    -- Subject user reads own assessment
    user_id = auth.uid()
    -- Assessor reads assessments they personally performed
    or assessor_user_id = auth.uid()
    or exists (
      select 1
      from public.user_roles ur
      join public.profiles p on p.id = competency_assessments.user_id
      where ur.user_id = auth.uid()
        and ur.is_active = true
        and (
          -- Department Manager: exact active department scope
          (
            ur.role = 'department_manager'
            and ur.scope = 'department'
            and ur.department_id is not null
            and p.department_id = ur.department_id
          )
          -- Division Head: exact active division scope
          or (
            ur.role = 'division_head'
            and ur.scope = 'division'
            and ur.division_id is not null
            and p.division_id = ur.division_id
          )
          -- Global read-only / governance roles: same organization
          or (
            ur.role in ('super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer')
            and ur.scope = 'global'
            and ur.organization_id is not null
            and p.organization_id = ur.organization_id
          )
        )
    )
  );

-- 3D. Training Acknowledgments SELECT Policy (Scoped)
drop policy if exists "grc_training_acknowledgments_select_policy" on public.training_acknowledgments;
create policy "grc_training_acknowledgments_select_policy" on public.training_acknowledgments
  for select to authenticated
  using (
    -- Employee reads own acknowledgment records
    user_id = auth.uid()
    or exists (
      select 1
      from public.user_roles ur
      join public.profiles p on p.id = training_acknowledgments.user_id
      where ur.user_id = auth.uid()
        and ur.is_active = true
        and (
          -- Department Manager: exact active department scope
          (
            ur.role = 'department_manager'
            and ur.scope = 'department'
            and ur.department_id is not null
            and p.department_id = ur.department_id
          )
          -- Division Head: exact active division scope
          or (
            ur.role = 'division_head'
            and ur.scope = 'division'
            and ur.division_id is not null
            and p.division_id = ur.division_id
          )
          -- Global read-only / governance roles: same organization
          or (
            ur.role in ('super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer')
            and ur.scope = 'global'
            and ur.organization_id is not null
            and p.organization_id = ur.organization_id
          )
        )
    )
  );

-- 3E. Document Acknowledgments SELECT Policy (Scoped)
drop policy if exists "document_ack_org_read_patch26" on public.document_acknowledgments;
create policy "document_ack_org_read_patch26" on public.document_acknowledgments
  for select to authenticated
  using (
    -- Employee reads own document acknowledgments
    user_id = auth.uid()
    or exists (
      select 1
      from public.user_roles ur
      join public.profiles p on p.id = document_acknowledgments.user_id
      where ur.user_id = auth.uid()
        and ur.is_active = true
        and (
          -- Department Manager: exact active department scope
          (
            ur.role = 'department_manager'
            and ur.scope = 'department'
            and ur.department_id is not null
            and p.department_id = ur.department_id
          )
          -- Division Head: exact active division scope
          or (
            ur.role = 'division_head'
            and ur.scope = 'division'
            and ur.division_id is not null
            and p.division_id = ur.division_id
          )
          -- Global read-only / governance roles: same organization
          or (
            ur.role in ('super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer')
            and ur.scope = 'global'
            and ur.organization_id is not null
            and p.organization_id = ur.organization_id
          )
        )
    )
  );

-- ============================================================================
-- 4. Hardened Governed Training Mutation RPCs
-- ============================================================================

-- 4A. start_training_assignment
create or replace function public.start_training_assignment(
  p_assignment_id uuid,
  p_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_assign record;
  v_actor_is_active boolean;
  v_actor_org_id uuid;
  v_prog_doc_org_id uuid;
  v_prog_dept_org_id uuid;
  v_prog_owner_org_id uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then 
    raise exception 'PATCH29_TRAINING_SERVICE_ROLE_REQUIRED'; 
  end if;

  select * into v_assign
  from public.training_assignments
  where id = p_assignment_id;

  if not found then
    raise exception 'PATCH29_ASSIGNMENT_NOT_STARTABLE';
  end if;

  if v_assign.assigned_to_user_id is null then
    raise exception 'ASSIGNMENT_NO_USER: Assignment must have an assigned user';
  end if;

  if p_actor_id is null or p_actor_id <> v_assign.assigned_to_user_id then
    raise exception 'UNAUTHORIZED_TRAINING_STARTER: Only assignment owner may start training';
  end if;

  select is_active, organization_id into v_actor_is_active, v_actor_org_id
  from public.profiles
  where id = p_actor_id;

  if v_actor_is_active is null or not v_actor_is_active then
    raise exception 'ACTOR_INACTIVE: Actor profile is not active or does not exist';
  end if;

  select cd.organization_id as doc_org_id, d.organization_id as dept_org_id, op.organization_id as owner_org_id
  into v_prog_doc_org_id, v_prog_dept_org_id, v_prog_owner_org_id
  from public.training_programs tp
  left join public.controlled_documents cd on cd.id in (tp.linked_sop_id, tp.linked_document_id)
  left join public.departments d on d.id = tp.department_id
  left join public.profiles op on op.id = tp.owner_user_id
  where tp.id = v_assign.program_id;

  if v_actor_org_id is null or (
    (v_prog_doc_org_id is not null and v_prog_doc_org_id <> v_actor_org_id) or
    (v_prog_dept_org_id is not null and v_prog_dept_org_id <> v_actor_org_id) or
    (v_prog_owner_org_id is not null and v_prog_owner_org_id <> v_actor_org_id)
  ) then
    raise exception 'CROSS_ORGANIZATION_DENIED: Actor organization does not match training program organization';
  end if;

  if v_assign.status <> 'assigned' then
    raise exception 'PATCH29_ASSIGNMENT_NOT_STARTABLE';
  end if;

  update public.training_assignments
  set status = 'in_progress'
  where id = p_assignment_id;

  perform public.log_training_event(
    'training_assignments', p_assignment_id, 'started', 
    'Training status updated to in_progress.', 
    p_actor_id
  );
end;
$$;

revoke all on function public.start_training_assignment(uuid, uuid) from public, anon, authenticated;
grant execute on function public.start_training_assignment(uuid, uuid) to service_role;

-- 4B. complete_training_assignment
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
declare
  v_assign record;
  v_prog record;
  v_actor_is_active boolean;
  v_actor_org_id uuid;
  v_target_is_active boolean;
  v_target_org_id uuid;
  v_target_dept_id uuid;
  v_target_div_id uuid;
  v_has_auth boolean := false;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then 
    raise exception 'PATCH29_TRAINING_SERVICE_ROLE_REQUIRED'; 
  end if;

  select * into v_assign
  from public.training_assignments
  where id = p_assignment_id;

  if not found or v_assign.status not in ('assigned', 'in_progress', 'overdue') then
    raise exception 'PATCH29_ASSIGNMENT_NOT_COMPLETABLE';
  end if;

  if v_assign.assigned_to_user_id is null then
    raise exception 'ASSIGNMENT_NO_USER: Assignment has no assigned employee';
  end if;

  select is_active, organization_id into v_actor_is_active, v_actor_org_id
  from public.profiles
  where id = p_actor_id;

  select is_active, organization_id, department_id, division_id
  into v_target_is_active, v_target_org_id, v_target_dept_id, v_target_div_id
  from public.profiles
  where id = v_assign.assigned_to_user_id;

  if v_actor_is_active is null or not v_actor_is_active then
    raise exception 'ACTOR_INACTIVE: Actor profile is not active';
  end if;

  if v_target_is_active is null or not v_target_is_active then
    raise exception 'TARGET_INACTIVE: Target employee profile is not active';
  end if;

  if v_actor_org_id is null or v_target_org_id is null or v_actor_org_id <> v_target_org_id then
    raise exception 'CROSS_ORGANIZATION_DENIED';
  end if;

  select * into v_prog
  from public.training_programs
  where id = v_assign.program_id;

  -- Distinction: SOP acknowledgment self-completion vs formal training certifier
  if v_prog.training_type = 'sop_acknowledgment' and v_assign.assigned_to_user_id = p_actor_id then
    v_has_auth := true;
  else
    if v_prog.owner_user_id = p_actor_id and v_actor_org_id = v_target_org_id then
      v_has_auth := true;
    else
      select exists (
        select 1 from public.user_roles ur
        where ur.user_id = p_actor_id
          and ur.is_active = true
          and (
            -- Active same-organization global governance certifiers
            (
              ur.role in ('super_admin', 'governance_admin', 'compliance_officer')
              and ur.scope = 'global'
              and ur.organization_id = v_target_org_id
            )
            -- Scoped Department Manager
            or (
              ur.role = 'department_manager'
              and ur.scope = 'department'
              and ur.department_id is not null
              and v_target_dept_id is not null
              and ur.department_id = v_target_dept_id
            )
            -- Scoped Division Head
            or (
              ur.role = 'division_head'
              and ur.scope = 'division'
              and ur.division_id is not null
              and v_target_div_id is not null
              and ur.division_id = v_target_div_id
            )
          )
      ) into v_has_auth;
    end if;
  end if;

  if not v_has_auth then
    raise exception 'UNAUTHORIZED_TRAINING_COMPLETER: Only authorized managers, program owner, or Governance authorities may certify training completion';
  end if;

  update public.training_assignments
  set status = 'completed', completed_at = now(), completion_evidence_id = p_evidence_id
  where id = p_assignment_id;

  perform public.log_training_event(
    'training_assignments', p_assignment_id, 'completed', 
    'Training completed successfully with evidence ' || coalesce(p_evidence_id::text, 'none') || '.', 
    p_actor_id
  );
end;
$$;

revoke all on function public.complete_training_assignment(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.complete_training_assignment(uuid, uuid, uuid) to service_role;

-- 4C. record_competency_assessment
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
  v_assign_user_id uuid;
  v_actor_is_active boolean;
  v_actor_org_id uuid;
  v_target_is_active boolean;
  v_target_org_id uuid;
  v_target_dept_id uuid;
  v_target_div_id uuid;
  v_actor_has_role boolean;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then 
    raise exception 'PATCH29_TRAINING_SERVICE_ROLE_REQUIRED'; 
  end if;

  -- Segregation of Duties: Assessor cannot assess themselves
  if p_actor_id = p_user_id then
    raise exception 'SOD_VIOLATION_SELF_ASSESSMENT: Employees cannot assess their own competency';
  end if;

  -- Validate Assignment Subject
  if p_assignment_id is not null then
    select assigned_to_user_id into v_assign_user_id
    from public.training_assignments
    where id = p_assignment_id;

    if not found then
      raise exception 'ASSIGNMENT_NOT_FOUND: Specified training assignment does not exist';
    end if;

    if v_assign_user_id is not null and v_assign_user_id <> p_user_id then
      raise exception 'SUBJECT_MISMATCH: Target user does not match assignment owner';
    end if;
  end if;

  if p_result not in ('passed', 'failed', 'needs_retraining', 'pending') then
    raise exception 'INVALID_RESULT: Assessment result must be passed, failed, needs_retraining, or pending';
  end if;

  select is_active, organization_id into v_actor_is_active, v_actor_org_id
  from public.profiles
  where id = p_actor_id;

  select is_active, organization_id, department_id, division_id
  into v_target_is_active, v_target_org_id, v_target_dept_id, v_target_div_id
  from public.profiles
  where id = p_user_id;

  if v_actor_is_active is null or not v_actor_is_active then
    raise exception 'ACTOR_INACTIVE: Assessor profile is not active';
  end if;

  if v_target_is_active is null or not v_target_is_active then
    raise exception 'TARGET_USER_INACTIVE: Subject user profile is not active';
  end if;

  if v_actor_org_id is null or v_target_org_id is null or v_actor_org_id <> v_target_org_id then
    raise exception 'CROSS_ORGANIZATION_DENIED';
  end if;

  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = p_actor_id
      and ur.is_active = true
      and (
        (
          ur.role in ('super_admin', 'governance_admin', 'compliance_officer')
          and ur.scope = 'global'
          and ur.organization_id = v_target_org_id
        )
        or (
          ur.role = 'department_manager'
          and ur.scope = 'department'
          and ur.department_id is not null
          and v_target_dept_id is not null
          and ur.department_id = v_target_dept_id
        )
        or (
          ur.role = 'division_head'
          and ur.scope = 'division'
          and ur.division_id is not null
          and v_target_div_id is not null
          and ur.division_id = v_target_div_id
        )
      )
  ) into v_actor_has_role;

  if not v_actor_has_role then
    raise exception 'UNAUTHORIZED_ASSESSOR: Assessor must hold department manager or governance authority';
  end if;

  insert into public.competency_assessments (
    assignment_id, user_id, assessor_user_id, competency_area, result, score, evidence_id, notes
  ) values (
    p_assignment_id, p_user_id, p_actor_id, p_competency_area, p_result, p_score, p_evidence_id, p_notes
  ) returning id into v_assessment_id;

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

-- 4D. waive_training_assignment_with_reason
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
declare
  v_assign record;
  v_actor_is_active boolean;
  v_actor_org_id uuid;
  v_target_is_active boolean;
  v_target_org_id uuid;
  v_target_dept_id uuid;
  v_target_div_id uuid;
  v_has_auth boolean := false;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then 
    raise exception 'PATCH29_TRAINING_SERVICE_ROLE_REQUIRED'; 
  end if;

  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'REASON_REQUIRED: A valid waiver reason is mandatory';
  end if;

  select * into v_assign
  from public.training_assignments
  where id = p_assignment_id;

  if not found then
    raise exception 'PATCH29_ASSIGNMENT_NOT_FOUND: Specified training assignment does not exist';
  end if;

  if v_assign.status not in ('assigned', 'in_progress', 'overdue') then
    raise exception 'PATCH29_ASSIGNMENT_NOT_WAIVABLE';
  end if;

  if v_assign.assigned_to_user_id is not null and v_assign.assigned_to_user_id = p_actor_id then
    raise exception 'CANNOT_WAIVE_OWN_ASSIGNMENT: Employees cannot waive their own training assignments';
  end if;

  select is_active, organization_id into v_actor_is_active, v_actor_org_id
  from public.profiles
  where id = p_actor_id;

  select is_active, organization_id, department_id, division_id
  into v_target_is_active, v_target_org_id, v_target_dept_id, v_target_div_id
  from public.profiles
  where id = v_assign.assigned_to_user_id;

  if v_actor_is_active is null or not v_actor_is_active then
    raise exception 'ACTOR_INACTIVE: Actor profile is not active';
  end if;

  if v_assign.assigned_to_user_id is not null and (v_target_is_active is null or not v_target_is_active) then
    raise exception 'TARGET_INACTIVE: Target employee profile is not active';
  end if;

  if v_actor_org_id is null or (v_target_org_id is not null and v_actor_org_id <> v_target_org_id) then
    raise exception 'CROSS_ORGANIZATION_DENIED';
  end if;

  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = p_actor_id
      and ur.is_active = true
      and (
        (
          ur.role in ('super_admin', 'governance_admin', 'compliance_officer')
          and ur.scope = 'global'
          and ur.organization_id = v_actor_org_id
        )
        or (
          ur.role = 'department_manager'
          and ur.scope = 'department'
          and ur.department_id is not null
          and v_target_dept_id is not null
          and ur.department_id = v_target_dept_id
        )
        or (
          ur.role = 'division_head'
          and ur.scope = 'division'
          and ur.division_id is not null
          and v_target_div_id is not null
          and ur.division_id = v_target_div_id
        )
      )
  ) into v_has_auth;

  if not v_has_auth then
    raise exception 'UNAUTHORIZED_WAIVER_AUTHORITY: Only authorized managers or Governance administrators may waive assignments';
  end if;

  update public.training_assignments
  set status = 'waived'
  where id = p_assignment_id;

  perform public.log_training_event(
    'training_assignments', p_assignment_id, 'waived', 
    'Assignment waived with reason: ' || trim(p_reason), 
    p_actor_id
  );
end;
$$;

revoke all on function public.waive_training_assignment_with_reason(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.waive_training_assignment_with_reason(uuid, text, uuid) to service_role;

-- 4E. cancel_training_assignment_with_reason
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
declare
  v_assign record;
  v_actor_is_active boolean;
  v_actor_org_id uuid;
  v_target_is_active boolean;
  v_target_org_id uuid;
  v_target_dept_id uuid;
  v_target_div_id uuid;
  v_has_auth boolean := false;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then 
    raise exception 'PATCH29_TRAINING_SERVICE_ROLE_REQUIRED'; 
  end if;

  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'REASON_REQUIRED: A valid cancellation reason is mandatory';
  end if;

  select * into v_assign
  from public.training_assignments
  where id = p_assignment_id;

  if not found then
    raise exception 'PATCH29_ASSIGNMENT_NOT_FOUND: Specified training assignment does not exist';
  end if;

  if v_assign.status not in ('assigned', 'in_progress', 'overdue') then
    raise exception 'PATCH29_ASSIGNMENT_NOT_CANCELLABLE: Only open assignments can be cancelled';
  end if;

  if v_assign.assigned_to_user_id is not null and v_assign.assigned_to_user_id = p_actor_id then
    raise exception 'CANNOT_CANCEL_OWN_ASSIGNMENT: Employees cannot cancel their own training assignments';
  end if;

  select is_active, organization_id into v_actor_is_active, v_actor_org_id
  from public.profiles
  where id = p_actor_id;

  select is_active, organization_id, department_id, division_id
  into v_target_is_active, v_target_org_id, v_target_dept_id, v_target_div_id
  from public.profiles
  where id = v_assign.assigned_to_user_id;

  if v_actor_is_active is null or not v_actor_is_active then
    raise exception 'ACTOR_INACTIVE: Actor profile is not active';
  end if;

  if v_assign.assigned_to_user_id is not null and (v_target_is_active is null or not v_target_is_active) then
    raise exception 'TARGET_INACTIVE: Target employee profile is not active';
  end if;

  if v_actor_org_id is null or (v_target_org_id is not null and v_actor_org_id <> v_target_org_id) then
    raise exception 'CROSS_ORGANIZATION_DENIED';
  end if;

  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = p_actor_id
      and ur.is_active = true
      and (
        (
          ur.role in ('super_admin', 'governance_admin', 'compliance_officer')
          and ur.scope = 'global'
          and ur.organization_id = v_actor_org_id
        )
        or (
          ur.role = 'department_manager'
          and ur.scope = 'department'
          and ur.department_id is not null
          and v_target_dept_id is not null
          and ur.department_id = v_target_dept_id
        )
        or (
          ur.role = 'division_head'
          and ur.scope = 'division'
          and ur.division_id is not null
          and v_target_div_id is not null
          and ur.division_id = v_target_div_id
        )
      )
  ) into v_has_auth;

  if not v_has_auth then
    raise exception 'UNAUTHORIZED_CANCELLATION_AUTHORITY: Only authorized managers or Governance administrators may cancel assignments';
  end if;

  update public.training_assignments
  set status = 'cancelled'
  where id = p_assignment_id;

  perform public.log_training_event(
    'training_assignments', p_assignment_id, 'cancelled', 
    'Assignment cancelled with reason: ' || trim(p_reason), 
    p_actor_id
  );
end;
$$;

revoke all on function public.cancel_training_assignment_with_reason(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.cancel_training_assignment_with_reason(uuid, text, uuid) to service_role;

-- 4F. reopen_training_assignment_with_reason
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
declare
  v_assign record;
  v_actor_is_active boolean;
  v_actor_org_id uuid;
  v_target_is_active boolean;
  v_target_org_id uuid;
  v_target_dept_id uuid;
  v_target_div_id uuid;
  v_has_auth boolean := false;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then 
    raise exception 'PATCH29_TRAINING_SERVICE_ROLE_REQUIRED'; 
  end if;

  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'REASON_REQUIRED: A valid reopening reason is mandatory';
  end if;

  select * into v_assign
  from public.training_assignments
  where id = p_assignment_id;

  if not found then
    raise exception 'PATCH29_ASSIGNMENT_NOT_FOUND: Specified training assignment does not exist';
  end if;

  if v_assign.status not in ('completed', 'waived', 'cancelled') then
    raise exception 'PATCH29_ASSIGNMENT_NOT_REOPENABLE: Only closed assignments (completed, waived, cancelled) can be reopened';
  end if;

  if v_assign.assigned_to_user_id is not null and v_assign.assigned_to_user_id = p_actor_id then
    raise exception 'CANNOT_REOPEN_OWN_ASSIGNMENT: Employees cannot reopen their own training assignments';
  end if;

  select is_active, organization_id into v_actor_is_active, v_actor_org_id
  from public.profiles
  where id = p_actor_id;

  select is_active, organization_id, department_id, division_id
  into v_target_is_active, v_target_org_id, v_target_dept_id, v_target_div_id
  from public.profiles
  where id = v_assign.assigned_to_user_id;

  if v_actor_is_active is null or not v_actor_is_active then
    raise exception 'ACTOR_INACTIVE: Actor profile is not active';
  end if;

  if v_assign.assigned_to_user_id is not null and (v_target_is_active is null or not v_target_is_active) then
    raise exception 'TARGET_INACTIVE: Target employee profile is not active';
  end if;

  if v_actor_org_id is null or (v_target_org_id is not null and v_actor_org_id <> v_target_org_id) then
    raise exception 'CROSS_ORGANIZATION_DENIED';
  end if;

  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = p_actor_id
      and ur.is_active = true
      and (
        (
          ur.role in ('super_admin', 'governance_admin', 'compliance_officer')
          and ur.scope = 'global'
          and ur.organization_id = v_actor_org_id
        )
        or (
          ur.role = 'department_manager'
          and ur.scope = 'department'
          and ur.department_id is not null
          and v_target_dept_id is not null
          and ur.department_id = v_target_dept_id
        )
        or (
          ur.role = 'division_head'
          and ur.scope = 'division'
          and ur.division_id is not null
          and v_target_div_id is not null
          and ur.division_id = v_target_div_id
        )
      )
  ) into v_has_auth;

  if not v_has_auth then
    raise exception 'UNAUTHORIZED_REOPEN_AUTHORITY: Only authorized managers or Governance administrators may reopen assignments';
  end if;

  update public.training_assignments
  set status = 'assigned', completed_at = null, completion_evidence_id = null
  where id = p_assignment_id;

  perform public.log_training_event(
    'training_assignments', p_assignment_id, 'reopened', 
    'Assignment reopened for retraining. Reason: ' || trim(p_reason), 
    p_actor_id
  );
end;
$$;

revoke all on function public.reopen_training_assignment_with_reason(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.reopen_training_assignment_with_reason(uuid, text, uuid) to service_role;
