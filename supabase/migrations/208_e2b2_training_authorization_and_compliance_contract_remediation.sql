-- ============================================================================
-- GRC v1.4-E2B2: MIGRATION 208
-- TRAINING AUTHORIZATION AND COMPLIANCE CONTRACT REMEDIATION
--
-- Authoritative Schema & Contract Enhancements:
-- 1. Browser Table Privilege Lockdown (Revoke DML on 8 training & doc ack tables)
-- 2. Training Events Complete Browser Isolation (Audit trail service-role only)
-- 3. Drop Permissive Legacy Browser Write & Obsolete Read Policies
-- 4. Scoped SELECT Policies (training_programs, training_assignments,
--    competency_assessments, training_acknowledgments, document_acknowledgments,
--    and document_acknowledgment_requirements)
-- 5. Hardened Governed Training Operational RPCs:
--    - start_training_assignment (owner-only, active, startable, formal training required check)
--    - complete_training_assignment (governed version-bound formal training certifier controls)
--    - record_competency_assessment (no self-assessment, manager/governance authority only)
--    - waive_training_assignment_with_reason (bounded reason 3-1000, open states only)
--    - cancel_training_assignment_with_reason (bounded reason 3-1000, open states only, no completed cancel)
--    - reopen_training_assignment_with_reason (bounded reason 3-1000, closed states only)
--    - record_document_acknowledgment (strengthened org tenancy & target eligibility validation)
--    - publish_sop_training_obligations (materialized specific_users ack reqs & dual training/competency obligations)
-- 6. Corrected Compliance & Reporting Read Models (Security Invoker Views):
--    - v_patch29_sop_acknowledgment_gap
--    - v_patch29_competency_gap_dashboard
--    - v_sop_training_compliance_matrix
--    - v_patch29_training_executive_summary
-- ============================================================================

-- ============================================================================
-- 1. TABLE PRIVILEGE HARDENING (REVOKE BROWSER DML)
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

-- E. training_events (Audit trail: NO browser access)
revoke all on table public.training_events from public, anon, authenticated;
grant all on table public.training_events to service_role;

-- F. document_acknowledgment_requirements
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
-- 2. DROP OBSOLETE & PERMISSIVE BROWSER POLICIES
-- ============================================================================

drop policy if exists "grc_training_programs_all_policy" on public.training_programs;
drop policy if exists "grc_training_programs_select_policy" on public.training_programs;
drop policy if exists "grc_training_assignments_all_policy" on public.training_assignments;
drop policy if exists "grc_training_assignments_select_policy" on public.training_assignments;
drop policy if exists "grc_training_acknowledgments_insert_policy" on public.training_acknowledgments;
drop policy if exists "grc_training_acknowledgments_select_policy" on public.training_acknowledgments;
drop policy if exists "grc_competency_assessments_all_policy" on public.competency_assessments;
drop policy if exists "grc_competency_assessments_select_policy" on public.competency_assessments;
drop policy if exists "document_ack_req_org_write_patch26" on public.document_acknowledgment_requirements;
drop policy if exists "document_ack_req_org_read_patch26" on public.document_acknowledgment_requirements;
drop policy if exists "document_ack_req_select_policy_e2b2" on public.document_acknowledgment_requirements;
drop policy if exists "document_ack_org_write_patch26" on public.document_acknowledgments;
drop policy if exists "document_ack_org_read_patch26" on public.document_acknowledgments;
drop policy if exists "grc_training_events_select_policy" on public.training_events;

-- ============================================================================
-- 3. REMEDIATED SCOPED SELECT POLICIES
-- ============================================================================

-- 3A. training_programs SELECT Policy (No broad active-program fallback for ordinary employees)
create policy "grc_training_programs_select_policy" on public.training_programs
  for select to authenticated
  using (
    -- 1. Program owner
    (owner_user_id = auth.uid())
    -- 2. Assigned employee
    or exists (
      select 1 from public.training_assignments ta
      where ta.program_id = training_programs.id
        and ta.assigned_to_user_id = auth.uid()
    )
    -- 3. Department Manager: exact department match
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.is_active = true
        and ur.role = 'department_manager'
        and ur.scope = 'department'
        and ur.department_id is not null
        and (
          training_programs.department_id = ur.department_id
          or exists (
            select 1 from public.training_assignments ta
            join public.profiles tp on tp.id = ta.assigned_to_user_id
            where ta.program_id = training_programs.id
              and tp.department_id = ur.department_id
          )
        )
    )
    -- 4. Division Head: exact division match
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.is_active = true
        and ur.role = 'division_head'
        and ur.scope = 'division'
        and ur.division_id is not null
        and (
          exists (
            select 1 from public.training_assignments ta
            join public.profiles tp on tp.id = ta.assigned_to_user_id
            where ta.program_id = training_programs.id
              and tp.division_id = ur.division_id
          )
          or exists (
            select 1 from public.departments d
            where d.id = training_programs.department_id
              and d.division_id = ur.division_id
          )
        )
    )
    -- 5. Global Governance Read Roles: exact matching organization
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.is_active = true
        and ur.role in ('super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer')
        and ur.scope = 'global'
        and ur.organization_id is not null
        and (
          exists (
            select 1 from public.controlled_documents cd
            where cd.id in (training_programs.linked_sop_id, training_programs.linked_document_id)
              and cd.organization_id = ur.organization_id
          )
          or exists (
            select 1 from public.departments d
            where d.id = training_programs.department_id
              and d.organization_id = ur.organization_id
          )
          or exists (
            select 1 from public.profiles op
            where op.id = training_programs.owner_user_id
              and op.organization_id = ur.organization_id
          )
          or exists (
            select 1 from public.profiles cp
            where cp.id = training_programs.created_by
              and cp.organization_id = ur.organization_id
          )
        )
    )
  );

-- 3B. training_assignments SELECT Policy
create policy "grc_training_assignments_select_policy" on public.training_assignments
  for select to authenticated
  using (
    -- 1. Assigned employee
    (assigned_to_user_id = auth.uid())
    -- 2. Scoped Managers & Global Governance Authority
    or exists (
      select 1
      from public.profiles p
      join public.user_roles ur on ur.user_id = auth.uid()
      where p.id = training_assignments.assigned_to_user_id
        and ur.is_active = true
        and (
          (ur.role = 'department_manager' and ur.scope = 'department' and p.department_id is not null and ur.department_id = p.department_id)
          or (ur.role = 'division_head' and ur.scope = 'division' and p.division_id is not null and ur.division_id = p.division_id)
          or (ur.role in ('super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer') and ur.scope = 'global' and ur.organization_id = p.organization_id)
        )
    )
  );

-- 3C. competency_assessments SELECT Policy
create policy "grc_competency_assessments_select_policy" on public.competency_assessments
  for select to authenticated
  using (
    -- 1. Subject employee or Assessor
    (user_id = auth.uid() or assessor_user_id = auth.uid())
    -- 2. Scoped Managers & Global Governance Authority
    or exists (
      select 1
      from public.profiles p
      join public.user_roles ur on ur.user_id = auth.uid()
      where p.id = competency_assessments.user_id
        and ur.is_active = true
        and (
          (ur.role = 'department_manager' and ur.scope = 'department' and p.department_id is not null and ur.department_id = p.department_id)
          or (ur.role = 'division_head' and ur.scope = 'division' and p.division_id is not null and ur.division_id = p.division_id)
          or (ur.role in ('super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer') and ur.scope = 'global' and ur.organization_id = p.organization_id)
        )
    )
  );

-- 3D. training_acknowledgments SELECT Policy
create policy "grc_training_acknowledgments_select_policy" on public.training_acknowledgments
  for select to authenticated
  using (
    -- 1. Acknowledging employee
    (user_id = auth.uid())
    -- 2. Scoped Managers & Global Governance Authority
    or exists (
      select 1
      from public.profiles p
      join public.user_roles ur on ur.user_id = auth.uid()
      where p.id = training_acknowledgments.user_id
        and ur.is_active = true
        and (
          (ur.role = 'department_manager' and ur.scope = 'department' and p.department_id is not null and ur.department_id = p.department_id)
          or (ur.role = 'division_head' and ur.scope = 'division' and p.division_id is not null and ur.division_id = p.division_id)
          or (ur.role in ('super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer') and ur.scope = 'global' and ur.organization_id = p.organization_id)
        )
    )
  );

-- 3E. document_acknowledgment_requirements SELECT Policy
create policy "document_ack_req_select_policy_e2b2" on public.document_acknowledgment_requirements
  for select to authenticated
  using (
    -- 1. Specific user requirement: assigned to actor
    (requirement_scope = 'specific_users' and user_id = auth.uid())
    -- 2. Legacy / broader scopes for active employee
    or (
      requirement_scope = 'department'
      and department_id is not null
      and department_id = (select department_id from public.profiles where id = auth.uid() and is_active = true)
    )
    or (
      requirement_scope = 'role'
      and role_name is not null
      and exists (
        select 1 from public.user_roles ur
        where ur.user_id = auth.uid()
          and ur.is_active = true
          and ur.role::text = document_acknowledgment_requirements.role_name
      )
    )
    or (
      requirement_scope = 'all_employees'
      and exists (
        select 1 from public.controlled_documents cd
        join public.profiles p on p.id = auth.uid()
        where cd.id = document_acknowledgment_requirements.document_id
          and cd.organization_id = p.organization_id
          and p.is_active = true
      )
    )
    -- 3. Scoped Managers & Global Governance Authority
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.is_active = true
        and (
          (
            ur.role = 'department_manager'
            and ur.scope = 'department'
            and ur.department_id is not null
            and (
              document_acknowledgment_requirements.department_id = ur.department_id
              or exists (
                select 1 from public.profiles tp
                where tp.id = document_acknowledgment_requirements.user_id
                  and tp.department_id = ur.department_id
              )
            )
          )
          or (
            ur.role = 'division_head'
            and ur.scope = 'division'
            and ur.division_id is not null
            and exists (
              select 1 from public.profiles tp
              where tp.id = document_acknowledgment_requirements.user_id
                and tp.division_id = ur.division_id
            )
          )
          or (
            ur.role in ('super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer')
            and ur.scope = 'global'
            and ur.organization_id is not null
            and exists (
              select 1 from public.controlled_documents cd
              where cd.id = document_acknowledgment_requirements.document_id
                and cd.organization_id = ur.organization_id
            )
          )
        )
    )
  );

-- 3F. document_acknowledgments SELECT Policy
create policy "document_ack_org_read_patch26" on public.document_acknowledgments
  for select to authenticated
  using (
    -- 1. Acknowledging employee
    (user_id = auth.uid())
    -- 2. Scoped Managers & Global Governance Authority
    or exists (
      select 1
      from public.profiles p
      join public.user_roles ur on ur.user_id = auth.uid()
      where p.id = document_acknowledgments.user_id
        and ur.is_active = true
        and (
          (ur.role = 'department_manager' and ur.scope = 'department' and p.department_id is not null and ur.department_id = p.department_id)
          or (ur.role = 'division_head' and ur.scope = 'division' and p.division_id is not null and ur.division_id = p.division_id)
          or (ur.role in ('super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer') and ur.scope = 'global' and ur.organization_id = p.organization_id)
        )
    )
  );

-- ============================================================================
-- 4. HARDENED GOVERNED TRAINING OPERATIONAL RPCS
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
  v_target_org_id uuid;
  v_version record;
  v_sop_detail record;
  v_formal_training_required boolean := true;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then
    raise exception 'PATCH29_TRAINING_SERVICE_ROLE_REQUIRED';
  end if;

  select * into v_assign
  from public.training_assignments
  where id = p_assignment_id;

  if not found then
    raise exception 'PATCH29_ASSIGNMENT_NOT_FOUND: Specified training assignment does not exist';
  end if;

  if v_assign.assigned_to_user_id is distinct from p_actor_id then
    raise exception 'UNAUTHORIZED_TRAINING_STARTER: Only assignment owner may start training';
  end if;

  if v_assign.status not in ('assigned', 'overdue') then
    raise exception 'PATCH29_ASSIGNMENT_NOT_STARTABLE: Assignment status is not in startable state';
  end if;

  select is_active, organization_id into v_actor_is_active, v_actor_org_id
  from public.profiles
  where id = p_actor_id;

  if v_actor_is_active is null or not v_actor_is_active then
    raise exception 'ACTOR_INACTIVE: Actor profile is not active or does not exist';
  end if;

  select organization_id into v_target_org_id
  from public.profiles
  where id = v_assign.assigned_to_user_id;

  if v_actor_org_id is null or v_target_org_id is null or v_actor_org_id <> v_target_org_id then
    raise exception 'CROSS_ORGANIZATION_DENIED';
  end if;

  -- Governed Start Eligibility: Verify formal training is actually required
  if v_assign.document_version_id is not null then
    select * into v_version
    from public.document_versions
    where id = v_assign.document_version_id;

    select * into v_sop_detail
    from public.governed_sop_details
    where version_id = v_assign.document_version_id;

    if v_version.supersedes_version_id is null and coalesce(v_version.version_number, 1) = 1 then
      v_formal_training_required := coalesce(v_sop_detail.training_required, false);
    else
      v_formal_training_required := coalesce(v_sop_detail.retraining_required, false);
    end if;

    if not v_formal_training_required then
      raise exception 'TRAINING_NOT_REQUIRED_FOR_ASSIGNMENT: Assignment is competency-only; formal training is not required';
    end if;
  end if;

  update public.training_assignments
  set status = 'in_progress'
  where id = p_assignment_id;

  perform public.log_training_event(
    'training_assignments', p_assignment_id, 'started',
    'Training started by assigned employee',
    p_actor_id
  );
end;
$$;

revoke all on function public.start_training_assignment(uuid, uuid) from public, anon, authenticated;
grant execute on function public.start_training_assignment(uuid, uuid) to service_role;

-- 4B. complete_training_assignment
create or replace function public.complete_training_assignment(
  p_assignment_id uuid,
  p_actor_id uuid,
  p_completion_evidence_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_assign record;
  v_prog record;
  v_version record;
  v_sop_detail record;
  v_actor_is_active boolean;
  v_actor_org_id uuid;
  v_target_is_active boolean;
  v_target_org_id uuid;
  v_target_dept_id uuid;
  v_target_div_id uuid;
  v_formal_training_required boolean := false;
  v_has_auth boolean := false;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then
    raise exception 'PATCH29_TRAINING_SERVICE_ROLE_REQUIRED';
  end if;

  select * into v_assign
  from public.training_assignments
  where id = p_assignment_id;

  if not found then
    raise exception 'PATCH29_ASSIGNMENT_NOT_FOUND: Specified training assignment does not exist';
  end if;

  if v_assign.status not in ('assigned', 'in_progress', 'overdue') then
    raise exception 'PATCH29_ASSIGNMENT_NOT_COMPLETABLE: Only active training assignments can be completed';
  end if;

  select * into v_prog
  from public.training_programs
  where id = v_assign.program_id;

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

  -- Governed Version-Bound SOP Assessment of Formal Training
  if v_assign.document_version_id is not null then
    select * into v_version
    from public.document_versions
    where id = v_assign.document_version_id;

    select * into v_sop_detail
    from public.governed_sop_details
    where version_id = v_assign.document_version_id;

    if v_version.supersedes_version_id is null and coalesce(v_version.version_number, 1) = 1 then
      v_formal_training_required := coalesce(v_sop_detail.training_required, false);
    else
      v_formal_training_required := coalesce(v_sop_detail.retraining_required, false);
    end if;
  end if;

  -- Authorization Evaluation:
  -- If formal training is required, employee self-completion is STRICTLY FORBIDDEN.
  -- Only non-formal/legacy unversioned acknowledgment assignments allow self-completion.
  if not v_formal_training_required and v_assign.document_version_id is null and v_prog.training_type = 'sop_acknowledgment' then
    if v_assign.assigned_to_user_id = p_actor_id then
      v_has_auth := true;
    end if;
  end if;

  if not v_has_auth then
    -- Check controlled certifier authority (Program Owner, Scoped Managers, Global Governance)
    if v_prog.owner_user_id = p_actor_id then
      v_has_auth := true;
    else
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
    end if;
  end if;

  if not v_has_auth then
    raise exception 'UNAUTHORIZED_TRAINING_COMPLETER: Caller lacks authority to certify training completion';
  end if;

  update public.training_assignments
  set status = 'completed',
      completed_at = now(),
      completion_evidence_id = coalesce(p_completion_evidence_id, completion_evidence_id)
  where id = p_assignment_id;

  perform public.log_training_event(
    'training_assignments', p_assignment_id, 'completed',
    'Training completion certified by actor ' || p_actor_id::text,
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
  p_score numeric default null,
  p_evidence_id uuid default null,
  p_notes text default null,
  p_actor_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_effective_actor_id uuid;
  v_assessment_id uuid;
  v_target_org_id uuid;
  v_target_dept_id uuid;
  v_target_div_id uuid;
  v_target_is_active boolean;
  v_actor_org_id uuid;
  v_actor_is_active boolean;
  v_actor_has_role boolean := false;
  v_assign record;
  v_prog record;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED';
  end if;

  v_effective_actor_id := coalesce(p_actor_id, auth.uid());

  if v_effective_actor_id is null then
    raise exception 'ACTOR_REQUIRED: Competency assessment requires authenticated actor identity';
  end if;

  if p_user_id = v_effective_actor_id then
    raise exception 'SOD_VIOLATION_SELF_ASSESSMENT: Employees cannot assess their own competency';
  end if;

  if p_result not in ('passed', 'failed', 'needs_retraining', 'pending') then
    raise exception 'INVALID_COMPETENCY_RESULT: Result must be passed, failed, needs_retraining, or pending';
  end if;

  select is_active, organization_id, department_id, division_id
  into v_target_is_active, v_target_org_id, v_target_dept_id, v_target_div_id
  from public.profiles
  where id = p_user_id;

  if v_target_is_active is null or not v_target_is_active then
    raise exception 'TARGET_INACTIVE: Target employee profile is not active or does not exist';
  end if;

  select is_active, organization_id into v_actor_is_active, v_actor_org_id
  from public.profiles
  where id = v_effective_actor_id;

  if v_actor_is_active is null or not v_actor_is_active then
    raise exception 'ACTOR_INACTIVE: Assessor profile is not active or does not exist';
  end if;

  if v_actor_org_id is null or v_target_org_id is null or v_actor_org_id <> v_target_org_id then
    raise exception 'CROSS_ORGANIZATION_DENIED';
  end if;

  if p_assignment_id is not null then
    select * into v_assign
    from public.training_assignments
    where id = p_assignment_id;

    if not found then
      raise exception 'PATCH29_ASSIGNMENT_NOT_FOUND: Specified training assignment does not exist';
    end if;

    select * into v_prog
    from public.training_programs
    where id = v_assign.program_id;

    if v_prog.owner_user_id = v_effective_actor_id then
      v_actor_has_role := true;
    end if;
  end if;

  if not v_actor_has_role then
    select exists (
      select 1 from public.user_roles ur
      where ur.user_id = v_effective_actor_id
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
    ) into v_actor_has_role;
  end if;

  if not v_actor_has_role then
    raise exception 'UNAUTHORIZED_ASSESSOR: Caller lacks authority to record competency assessment';
  end if;

  if p_assignment_id is not null and exists (select 1 from public.competency_assessments where assignment_id = p_assignment_id) then
    update public.competency_assessments
    set result = p_result,
        score = p_score,
        evidence_id = coalesce(p_evidence_id, evidence_id),
        notes = coalesce(p_notes, notes),
        assessor_user_id = v_effective_actor_id,
        assessed_at = now()
    where assignment_id = p_assignment_id
    returning id into v_assessment_id;
  else
    insert into public.competency_assessments (
      assignment_id, user_id, competency_area, result, score,
      evidence_id, notes, assessor_user_id, assessed_at
    ) values (
      p_assignment_id, p_user_id, coalesce(p_competency_area, 'SOP Standard Competency'),
      p_result, p_score, p_evidence_id, p_notes, v_effective_actor_id, now()
    ) returning id into v_assessment_id;
  end if;

  perform public.log_training_event(
    'competency_assessments', v_assessment_id, 'assessed',
    'Competency assessment recorded: ' || p_result || ' by assessor ' || v_effective_actor_id::text,
    v_effective_actor_id
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

  if p_reason is null or length(trim(p_reason)) < 3 or length(trim(p_reason)) > 1000 then
    raise exception 'REASON_REQUIRED: A valid waiver reason between 3 and 1000 characters is mandatory';
  end if;

  select * into v_assign
  from public.training_assignments
  where id = p_assignment_id;

  if not found then
    raise exception 'PATCH29_ASSIGNMENT_NOT_FOUND: Specified training assignment does not exist';
  end if;

  if v_assign.status not in ('assigned', 'in_progress', 'overdue') then
    raise exception 'PATCH29_ASSIGNMENT_NOT_WAIVABLE: Only open training assignments can be waived';
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

  if p_reason is null or length(trim(p_reason)) < 3 or length(trim(p_reason)) > 1000 then
    raise exception 'REASON_REQUIRED: A valid cancellation reason between 3 and 1000 characters is mandatory';
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

  if p_reason is null or length(trim(p_reason)) < 3 or length(trim(p_reason)) > 1000 then
    raise exception 'REASON_REQUIRED: A valid reopening reason between 3 and 1000 characters is mandatory';
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

-- 4G. record_document_acknowledgment
create or replace function public.record_document_acknowledgment(
  p_document_id uuid,
  p_version_id uuid,
  p_user_id uuid,
  p_acknowledgment_method text default 'manual',
  p_acknowledgment_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ack_id uuid;
  v_user_is_active boolean;
  v_user_org_id uuid;
  v_user_dept_id uuid;
  v_doc_org_id uuid;
  v_has_version boolean;
  v_has_reqs boolean;
  v_is_eligible boolean := false;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then
    raise exception 'PATCH26_DOCUMENT_SERVICE_ROLE_REQUIRED';
  end if;

  -- 1. Validate Document and Version Relationship
  select exists (
    select 1 from public.document_versions
    where id = p_version_id and document_id = p_document_id
  ) into v_has_version;

  if not v_has_version then
    raise exception 'VERSION_NOT_FOUND: Specified document version does not exist for this document';
  end if;

  -- 2. Validate User & Document Organization Tenancy
  select is_active, organization_id, department_id
  into v_user_is_active, v_user_org_id, v_user_dept_id
  from public.profiles
  where id = p_user_id;

  if v_user_is_active is null or not v_user_is_active then
    raise exception 'USER_INACTIVE: Target user profile is not active or does not exist';
  end if;

  select organization_id into v_doc_org_id
  from public.controlled_documents
  where id = p_document_id;

  if v_user_org_id is null or v_doc_org_id is null or v_user_org_id <> v_doc_org_id then
    raise exception 'CROSS_ORGANIZATION_DENIED';
  end if;

  -- 3. Check Target Eligibility if Version-Bound Requirements Exist
  select exists (
    select 1 from public.document_acknowledgment_requirements
    where document_id = p_document_id
      and version_id = p_version_id
      and required_flag = true
  ) into v_has_reqs;

  if v_has_reqs then
    select exists (
      select 1 from public.document_acknowledgment_requirements req
      where req.document_id = p_document_id
        and req.version_id = p_version_id
        and req.required_flag = true
        and (
          (req.requirement_scope = 'specific_users' and req.user_id = p_user_id)
          or (req.requirement_scope = 'all_employees')
          or (req.requirement_scope = 'department' and req.department_id = v_user_dept_id)
          or (
            req.requirement_scope = 'role'
            and req.role_name is not null
            and exists (
              select 1 from public.user_roles ur
              where ur.user_id = p_user_id
                and ur.is_active = true
                and ur.role::text = req.role_name
            )
          )
        )
    ) into v_is_eligible;

    if not v_is_eligible then
      raise exception 'USER_NOT_ELIGIBLE_FOR_ACKNOWLEDGMENT: User is not within the required target population for this version';
    end if;
  end if;

  -- 4. Idempotent Acknowledgment Upsert
  insert into public.document_acknowledgments (
    document_id,
    version_id,
    user_id,
    acknowledgment_method,
    acknowledgment_note
  )
  values (
    p_document_id,
    p_version_id,
    p_user_id,
    coalesce(p_acknowledgment_method, 'manual'),
    p_acknowledgment_note
  )
  on conflict (document_id, version_id, user_id) do update
    set acknowledged_at = now(),
        acknowledgment_method = excluded.acknowledgment_method,
        acknowledgment_note = excluded.acknowledgment_note
  returning id into v_ack_id;

  perform public.patch26_write_document_event(p_document_id, p_version_id, 'acknowledged', null, null, p_user_id, p_acknowledgment_note, null);
  return v_ack_id;
end;
$$;

revoke all on function public.record_document_acknowledgment(uuid, uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.record_document_acknowledgment(uuid, uuid, uuid, text, text) to service_role;

-- 4H. publish_sop_training_obligations (Canonical Step 7 algorithm, specific_users materialized acks, dual obligation support)
create or replace function public.publish_sop_training_obligations(
  p_actor_id uuid,
  p_version_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_version record;
  v_doc record;
  v_sop_detail record;
  v_prog_id uuid;
  v_due_date date;
  v_cycle integer := 1;
  v_cycle_type text := 'initial';
  v_assigned_count integer := 0;
  v_ack_req_count integer := 0;
  v_user record;
  v_has_target_dept boolean;
  v_has_app_dept boolean;
  v_has_target_role boolean;
  v_has_app_role boolean;
  v_actor_org_id uuid;
  v_actor_has_role boolean;
  v_is_initial boolean;
  v_training_req boolean;
  v_comp_req boolean;
  v_ack_req boolean;
  v_needs_assignment boolean;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED';
  end if;

  -- 1. Fetch version and document context
  select * into v_version
  from public.document_versions
  where id = p_version_id;

  if not found then
    raise exception 'VERSION_NOT_FOUND';
  end if;

  select * into v_doc
  from public.controlled_documents
  where id = v_version.document_id;

  if not found or v_doc.document_type <> 'sop' then
    raise exception 'INVALID_DOC_TYPE: Only SOP documents support training obligations publication';
  end if;

  -- 2. Verify Actor Organization & Authority
  select organization_id into v_actor_org_id
  from public.profiles
  where id = p_actor_id;

  if v_actor_org_id is null or v_actor_org_id <> v_doc.organization_id then
    raise exception 'CROSS_ORGANIZATION_DENIED';
  end if;

  select exists (
    select 1 from public.user_roles
    where user_id = p_actor_id
      and is_active = true
      and role in ('super_admin', 'governance_admin', 'compliance_officer')
      and scope = 'global'
      and organization_id = v_actor_org_id
  ) or (v_doc.document_owner_id = p_actor_id) into v_actor_has_role;

  if not v_actor_has_role then
    raise exception 'INSUFFICIENT_AUTHORITY: Only Governance administrators or Document Owner may publish training obligations';
  end if;

  select * into v_sop_detail
  from public.governed_sop_details
  where version_id = p_version_id;

  -- Determine cycle & requirement obligations
  v_is_initial := (v_version.supersedes_version_id is null and coalesce(v_version.version_number, 1) = 1);

  if not v_is_initial then
    if v_sop_detail.rollout_decided_at is null
       or v_sop_detail.rollout_decided_by is null
       or v_sop_detail.rollout_decision_rationale is null
       or length(trim(v_sop_detail.rollout_decision_rationale)) < 5
    then
      raise exception 'ROLLOUT_DECISION_REQUIRED: Governed rollout requirements must be decided prior to publishing revision obligations';
    end if;

    v_cycle_type := 'revision';
    v_training_req := coalesce(v_sop_detail.retraining_required, false);
    v_comp_req := coalesce(v_sop_detail.competency_reassessment_required, false);
    v_ack_req := coalesce(v_sop_detail.reacknowledgment_required, true);
  else
    v_cycle_type := 'initial';
    v_training_req := coalesce(v_sop_detail.training_required, false);
    v_comp_req := coalesce(v_sop_detail.competency_assessment_required, false);
    v_ack_req := coalesce(v_sop_detail.acknowledgment_required, true);
  end if;

  v_needs_assignment := (v_training_req or v_comp_req);

  -- 3. Calculate Due Date (effective date or now + SLA days)
  v_due_date := coalesce(v_doc.effective_date, current_date) + coalesce(v_sop_detail.acknowledgment_sla_days, 30);

  -- 4. Get or Create Persistent Authoritative Training Program
  select id into v_prog_id
  from public.training_programs
  where linked_sop_id = v_doc.id and training_type = 'sop_acknowledgment'
  order by created_at asc
  limit 1;

  if v_prog_id is null then
    insert into public.training_programs (
      title, title_ar, description, training_type,
      linked_document_id, linked_sop_id, owner_user_id, department_id, active, created_by
    ) values (
      v_doc.document_title || ' — Standard Training',
      v_doc.document_title || ' — التدريب الإجرائي المعتمد',
      'Governed training and acknowledgment program for SOP: ' || v_doc.document_title,
      'sop_acknowledgment',
      v_doc.id, v_doc.id, coalesce(v_sop_detail.process_owner_id, p_actor_id),
      v_doc.department_id, true, p_actor_id
    ) returning id into v_prog_id;
  end if;

  -- 5. Determine Target Scopes Override Status
  select exists (
    select 1 from public.sop_version_training_target_scopes
    where sop_version_id = p_version_id and scope_type = 'department'
  ) into v_has_target_dept;

  select exists (
    select 1 from public.document_version_department_scope
    where version_id = p_version_id
  ) into v_has_app_dept;

  select exists (
    select 1 from public.sop_version_training_target_scopes
    where sop_version_id = p_version_id and scope_type = 'role'
  ) into v_has_target_role;

  select exists (
    select 1 from public.document_version_role_scope
    where version_id = p_version_id
  ) into v_has_app_role;

  -- 6. Resolve Target Population (Step 7 Canonical Algorithm)
  for v_user in (
    select distinct p.id as user_id, p.department_id
    from public.profiles p
    where p.organization_id = v_doc.organization_id
      and p.is_active = true
      -- Department filtering: target override takes precedence over applicability
      and (
        case
          when v_has_target_dept then
            p.department_id in (
              select department_id from public.sop_version_training_target_scopes
              where sop_version_id = p_version_id and scope_type = 'department' and department_id is not null
            )
          when v_has_app_dept then
            p.department_id in (
              select department_id from public.document_version_department_scope
              where version_id = p_version_id and department_id is not null
            )
          else true
        end
      )
      -- Role filtering: target override takes precedence over applicability
      and (
        case
          when v_has_target_role then
            exists (
              select 1 from public.user_roles ur
              where ur.user_id = p.id
                and ur.is_active = true
                and ur.role::text in (
                  select role_name from public.sop_version_training_target_scopes
                  where sop_version_id = p_version_id and scope_type = 'role' and role_name is not null
                )
            )
          when v_has_app_role then
            exists (
              select 1 from public.user_roles ur
              where ur.user_id = p.id
                and ur.is_active = true
                and ur.role::text in (
                  select role_name from public.document_version_role_scope
                  where version_id = p_version_id and role_name is not null
                )
            )
          else true
        end
      )
  ) loop
    -- 6A. Materialize Version-Bound Training / Competency Assignment if needed
    if v_needs_assignment then
      if not exists (
        select 1 from public.training_assignments
        where program_id = v_prog_id
          and document_version_id = p_version_id
          and assigned_to_user_id = v_user.user_id
          and obligation_cycle = v_cycle
      ) then
        insert into public.training_assignments (
          program_id, document_version_id, assigned_to_user_id,
          assigned_to_department_id, due_date, status,
          obligation_cycle, cycle_type, assigned_by
        ) values (
          v_prog_id, p_version_id, v_user.user_id,
          v_user.department_id, v_due_date, 'assigned',
          v_cycle, v_cycle_type, p_actor_id
        );
        v_assigned_count := v_assigned_count + 1;
      end if;
    end if;

    -- 6B. Materialize Version-Bound Specific-User Acknowledgment Requirement if needed
    if v_ack_req then
      if not exists (
        select 1 from public.document_acknowledgment_requirements
        where document_id = v_doc.id
          and version_id = p_version_id
          and requirement_scope = 'specific_users'
          and user_id = v_user.user_id
      ) then
        insert into public.document_acknowledgment_requirements (
          document_id, version_id, requirement_scope, user_id, department_id,
          due_date, required_flag, created_by
        ) values (
          v_doc.id, p_version_id, 'specific_users', v_user.user_id, v_user.department_id,
          v_due_date, true, p_actor_id
        );
        v_ack_req_count := v_ack_req_count + 1;
      end if;
    end if;
  end loop;

  -- 7. Audit event
  perform public.log_training_event(
    'training_programs', v_prog_id, 'obligations_published',
    'Published training obligations for SOP ' || v_doc.document_code || ' ' || v_version.version_label ||
    ': ' || v_assigned_count || ' assignments, ' || v_ack_req_count || ' specific-user ack requirements created.',
    p_actor_id
  );

  return jsonb_build_object(
    'success', true,
    'version_id', p_version_id,
    'program_id', v_prog_id,
    'cycle', v_cycle,
    'cycle_type', v_cycle_type,
    'assignments_created', v_assigned_count,
    'acknowledgment_requirements_created', v_ack_req_count
  );
end;
$$;

revoke all on function public.publish_sop_training_obligations(uuid, uuid) from public, anon, authenticated;
grant execute on function public.publish_sop_training_obligations(uuid, uuid) to service_role;

-- ============================================================================
-- 5. CORRECTED REPORTING & ANALYTICAL READ VIEWS (SECURITY INVOKER)
-- ============================================================================

-- 5A. v_patch29_sop_acknowledgment_gap
create or replace view public.v_patch29_sop_acknowledgment_gap
with (security_invoker = true)
as
select
  tp.id as program_id,
  cd.document_title as sop_title,
  cd.document_title_ar as sop_title_ar,
  cd.id as linked_sop_id,
  p.id as user_id,
  p.full_name_en as user_name_en,
  p.full_name_ar as user_name_ar,
  p.department_id,
  d.name_en as department_name_en,
  d.name_ar as department_name_ar,
  req.version_id,
  req.due_date,
  cd.document_code,
  v.version_label
from public.document_acknowledgment_requirements req
join public.controlled_documents cd on cd.id = req.document_id
join public.document_versions v on v.id = req.version_id
join public.profiles p on p.id = req.user_id
left join public.departments d on d.id = p.department_id
left join public.training_programs tp on tp.linked_sop_id = cd.id and tp.training_type = 'sop_acknowledgment'
where req.required_flag = true
  and req.requirement_scope = 'specific_users'
  and req.user_id is not null
  and cd.document_type = 'sop'
  and not exists (
    select 1
    from public.document_acknowledgments ack
    where ack.document_id = req.document_id
      and ack.version_id = req.version_id
      and ack.user_id = req.user_id
  );

-- 5B. v_patch29_competency_gap_dashboard
create or replace view public.v_patch29_competency_gap_dashboard
with (security_invoker = true)
as
select
  p.id as user_id,
  p.full_name_en as user_name_en,
  p.full_name_ar as user_name_ar,
  coalesce(ca.competency_area, cd.document_title, 'SOP Standard Competency') as competency_area,
  coalesce(ca.result, 'pending') as result,
  ca.score,
  ca.assessed_at,
  ca.assessor_user_id,
  p_assess.full_name_en as assessor_name_en,
  p_assess.full_name_ar as assessor_name_ar,
  ta.id as assignment_id,
  ta.document_version_id,
  ta.due_date,
  cd.document_code,
  v.version_label
from public.training_assignments ta
join public.document_versions v on v.id = ta.document_version_id
join public.controlled_documents cd on cd.id = v.document_id
join public.governed_sop_details s on s.version_id = v.id
join public.profiles p on p.id = ta.assigned_to_user_id
left join lateral (
  select *
  from public.competency_assessments ca_sub
  where (ca_sub.assignment_id = ta.id or (ca_sub.assignment_id is null and ca_sub.user_id = ta.assigned_to_user_id))
  order by ca_sub.assessed_at desc nulls last
  limit 1
) ca on true
left join public.profiles p_assess on p_assess.id = ca.assessor_user_id
where ta.document_version_id is not null
  and ta.status <> 'cancelled'
  and (
    (v.supersedes_version_id is null and coalesce(v.version_number, 1) = 1 and coalesce(s.competency_assessment_required, false) = true)
    or
    ((v.supersedes_version_id is not null or coalesce(v.version_number, 1) > 1) and coalesce(s.competency_reassessment_required, false) = true)
  )
  and (ca.id is null or ca.result is null or ca.result in ('failed', 'needs_retraining', 'pending'));

-- 5C. v_sop_training_compliance_matrix
create or replace view public.v_sop_training_compliance_matrix
with (security_invoker = true)
as
with version_targets as (
  select
    v.id as sop_version_id,
    d.id as document_id,
    d.organization_id,
    d.document_code,
    d.document_title,
    v.version_number,
    v.version_label,
    d.document_status,
    case
      when v.supersedes_version_id is null and v.version_number = 1 then coalesce(s.training_required, false)
      else coalesce(s.retraining_required, false)
    end as training_required,
    case
      when v.supersedes_version_id is null and v.version_number = 1 then coalesce(s.acknowledgment_required, true)
      else coalesce(s.reacknowledgment_required, true)
    end as acknowledgment_required,
    case
      when v.supersedes_version_id is null and v.version_number = 1 then coalesce(s.competency_assessment_required, false)
      else coalesce(s.competency_reassessment_required, false)
    end as competency_assessment_required,
    s.training_renewal_months
  from public.document_versions v
  join public.controlled_documents d on d.id = v.document_id
  left join public.governed_sop_details s on s.version_id = v.id
  where d.document_type = 'sop'
),
ack_req_aggregates as (
  select
    req.version_id as sop_version_id,
    count(distinct req.user_id) filter (where req.requirement_scope = 'specific_users' and req.required_flag = true) as ack_target_count
  from public.document_acknowledgment_requirements req
  where req.version_id is not null
  group by req.version_id
),
ack_aggregates as (
  select
    da.version_id as sop_version_id,
    count(distinct da.user_id) as acknowledged_count
  from public.document_acknowledgments da
  group by da.version_id
),
assignment_aggregates as (
  select
    ta.document_version_id as sop_version_id,
    count(distinct ta.assigned_to_user_id) filter (where ta.status <> 'cancelled') as assigned_count,
    count(distinct ta.assigned_to_user_id) filter (where ta.status = 'in_progress') as in_progress_count,
    count(distinct ta.assigned_to_user_id) filter (where ta.status = 'completed') as completed_count,
    count(distinct ta.assigned_to_user_id) filter (where ta.status = 'overdue') as overdue_count,
    count(distinct ta.assigned_to_user_id) filter (where ta.status = 'waived') as waived_count,
    count(distinct ta.assigned_to_user_id) filter (where ta.status = 'cancelled') as cancelled_count,
    count(distinct ta.assigned_to_user_id) filter (
      where ta.status = 'completed'
        and vt.training_renewal_months is not null
        and ta.completed_at <= now() - (vt.training_renewal_months || ' months')::interval
    ) as renewal_due_count
  from public.training_assignments ta
  join version_targets vt on vt.sop_version_id = ta.document_version_id
  group by ta.document_version_id, vt.training_renewal_months
),
competency_aggregates as (
  select
    ta.document_version_id as sop_version_id,
    count(distinct ca.user_id) filter (where ca.result = 'passed') as competency_passed_count,
    count(distinct ca.user_id) filter (where ca.result in ('failed', 'needs_retraining')) as competency_failed_count,
    count(distinct ca.user_id) filter (where ca.result = 'pending') as competency_pending_count
  from public.training_assignments ta
  join public.competency_assessments ca on ca.assignment_id = ta.id or (ca.assignment_id is null and ca.user_id = ta.assigned_to_user_id)
  where ta.document_version_id is not null
  group by ta.document_version_id
),
distinct_targets as (
  select version_id as sop_version_id, count(distinct user_id) as total_distinct_target_count
  from (
    select req.version_id, req.user_id
    from public.document_acknowledgment_requirements req
    where req.version_id is not null and req.requirement_scope = 'specific_users' and req.required_flag = true and req.user_id is not null
    union
    select ta.document_version_id as version_id, ta.assigned_to_user_id as user_id
    from public.training_assignments ta
    where ta.document_version_id is not null and ta.assigned_to_user_id is not null and ta.status <> 'cancelled'
  ) all_u
  group by version_id
)
select
  vt.sop_version_id,
  vt.document_id,
  vt.organization_id,
  vt.document_code,
  vt.document_title,
  vt.version_number,
  vt.version_label,
  vt.document_status,
  vt.training_required,
  vt.acknowledgment_required,
  vt.competency_assessment_required,
  coalesce(dt.total_distinct_target_count, aa.assigned_count, ar.ack_target_count, 0) as target_population_count,
  coalesce(aa.assigned_count, 0) as assigned_count,
  coalesce(aa.in_progress_count, 0) as in_progress_count,
  coalesce(aa.completed_count, 0) as completed_count,
  coalesce(aa.overdue_count, 0) as overdue_count,
  coalesce(aa.waived_count, 0) as waived_count,
  coalesce(aa.cancelled_count, 0) as cancelled_count,
  coalesce(aka.acknowledged_count, 0) as acknowledged_count,
  case
    when vt.acknowledgment_required then greatest(0, coalesce(ar.ack_target_count, dt.total_distinct_target_count, 0) - coalesce(aka.acknowledged_count, 0))
    else 0
  end as acknowledgment_gap_count,
  coalesce(ca.competency_passed_count, 0) as competency_passed_count,
  coalesce(ca.competency_failed_count, 0) as competency_failed_count,
  coalesce(ca.competency_pending_count, 0) as competency_pending_count,
  coalesce(aa.renewal_due_count, 0) as renewal_due_count,
  coalesce(aa.assigned_count, 0) as training_target_count,
  coalesce(ar.ack_target_count, 0) as acknowledgment_target_count,
  case when vt.competency_assessment_required then coalesce(aa.assigned_count, 0) else 0 end as competency_target_count
from version_targets vt
left join distinct_targets dt on dt.sop_version_id = vt.sop_version_id
left join ack_req_aggregates ar on ar.sop_version_id = vt.sop_version_id
left join ack_aggregates aka on aka.sop_version_id = vt.sop_version_id
left join assignment_aggregates aa on aa.sop_version_id = vt.sop_version_id
left join competency_aggregates ca on ca.sop_version_id = vt.sop_version_id;

-- 5D. v_patch29_training_executive_summary
create or replace view public.v_patch29_training_executive_summary
with (security_invoker = true)
as
select
  (select count(*) from public.training_programs where active = true) as active_programs_count,
  (select count(*) from public.training_assignments where status in ('assigned', 'in_progress')) as pending_assignments_count,
  (select count(*) from public.training_assignments where status = 'completed') as completed_assignments_count,
  (select count(*) from public.v_patch29_overdue_training_assignments) as overdue_assignments_count,
  (select count(*) from public.v_patch29_sop_acknowledgment_gap) as total_sop_gaps_count,
  (select count(*) from public.v_patch29_competency_gap_dashboard where result is not null and result in ('failed', 'needs_retraining')) as competency_fails_count;
