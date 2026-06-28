-- v13.1 Security + Persona Proof Hotfix
-- Purpose:
-- - Make v12.0 critical RLS coverage explicit for the static v64 audit.
-- - Keep least-privilege org-scoped access and no delete grants.
-- - Do not alter approval evidence or production readiness state.

alter table if exists public.v120_data_quality_findings enable row level security;
alter table if exists public.v120_release_readiness_checks enable row level security;
alter table if exists public.v120_user_feedback enable row level security;

drop policy if exists v131_v120_data_quality_findings_org_select on public.v120_data_quality_findings;
create policy v131_v120_data_quality_findings_org_select
  on public.v120_data_quality_findings
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.is_active = true
        and p.organization_id = v120_data_quality_findings.organization_id
    )
  );

drop policy if exists v131_v120_data_quality_findings_org_insert on public.v120_data_quality_findings;
create policy v131_v120_data_quality_findings_org_insert
  on public.v120_data_quality_findings
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles p
      join public.user_roles ur on ur.user_id = p.id
      where p.id = auth.uid()
        and p.is_active = true
        and p.organization_id = v120_data_quality_findings.organization_id
        and ur.is_active = true
        and ur.role::text in ('super_admin','governance_admin','compliance_officer','auditor','executive','department_manager')
    )
  );

drop policy if exists v131_v120_data_quality_findings_org_update on public.v120_data_quality_findings;
create policy v131_v120_data_quality_findings_org_update
  on public.v120_data_quality_findings
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      join public.user_roles ur on ur.user_id = p.id
      where p.id = auth.uid()
        and p.is_active = true
        and p.organization_id = v120_data_quality_findings.organization_id
        and ur.is_active = true
        and ur.role::text in ('super_admin','governance_admin','compliance_officer','auditor','executive','department_manager')
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      join public.user_roles ur on ur.user_id = p.id
      where p.id = auth.uid()
        and p.is_active = true
        and p.organization_id = v120_data_quality_findings.organization_id
        and ur.is_active = true
        and ur.role::text in ('super_admin','governance_admin','compliance_officer','auditor','executive','department_manager')
    )
  );

drop policy if exists v131_v120_release_readiness_checks_org_select on public.v120_release_readiness_checks;
create policy v131_v120_release_readiness_checks_org_select
  on public.v120_release_readiness_checks
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.is_active = true
        and p.organization_id = v120_release_readiness_checks.organization_id
    )
  );

drop policy if exists v131_v120_release_readiness_checks_org_insert on public.v120_release_readiness_checks;
create policy v131_v120_release_readiness_checks_org_insert
  on public.v120_release_readiness_checks
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles p
      join public.user_roles ur on ur.user_id = p.id
      where p.id = auth.uid()
        and p.is_active = true
        and p.organization_id = v120_release_readiness_checks.organization_id
        and ur.is_active = true
        and ur.role::text in ('super_admin','governance_admin','compliance_officer','auditor','executive','department_manager')
    )
  );

drop policy if exists v131_v120_release_readiness_checks_org_update on public.v120_release_readiness_checks;
create policy v131_v120_release_readiness_checks_org_update
  on public.v120_release_readiness_checks
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      join public.user_roles ur on ur.user_id = p.id
      where p.id = auth.uid()
        and p.is_active = true
        and p.organization_id = v120_release_readiness_checks.organization_id
        and ur.is_active = true
        and ur.role::text in ('super_admin','governance_admin','compliance_officer','auditor','executive','department_manager')
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      join public.user_roles ur on ur.user_id = p.id
      where p.id = auth.uid()
        and p.is_active = true
        and p.organization_id = v120_release_readiness_checks.organization_id
        and ur.is_active = true
        and ur.role::text in ('super_admin','governance_admin','compliance_officer','auditor','executive','department_manager')
    )
  );

drop policy if exists v131_v120_user_feedback_org_select on public.v120_user_feedback;
create policy v131_v120_user_feedback_org_select
  on public.v120_user_feedback
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.is_active = true
        and p.organization_id = v120_user_feedback.organization_id
    )
  );

drop policy if exists v131_v120_user_feedback_org_insert on public.v120_user_feedback;
create policy v131_v120_user_feedback_org_insert
  on public.v120_user_feedback
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.is_active = true
        and p.organization_id = v120_user_feedback.organization_id
    )
    and (
      submitted_by is null
      or submitted_by = auth.uid()
      or exists (
        select 1
        from public.profiles p
        join public.user_roles ur on ur.user_id = p.id
        where p.id = auth.uid()
          and p.is_active = true
          and p.organization_id = v120_user_feedback.organization_id
          and ur.is_active = true
          and ur.role::text in ('super_admin','governance_admin','compliance_officer','auditor','executive','department_manager')
      )
    )
  );

drop policy if exists v131_v120_user_feedback_org_update on public.v120_user_feedback;
create policy v131_v120_user_feedback_org_update
  on public.v120_user_feedback
  for update
  to authenticated
  using (
    submitted_by = auth.uid()
    or exists (
      select 1
      from public.profiles p
      join public.user_roles ur on ur.user_id = p.id
      where p.id = auth.uid()
        and p.is_active = true
        and p.organization_id = v120_user_feedback.organization_id
        and ur.is_active = true
        and ur.role::text in ('super_admin','governance_admin','compliance_officer','auditor','executive','department_manager')
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.is_active = true
        and p.organization_id = v120_user_feedback.organization_id
    )
  );

grant select, insert, update on public.v120_data_quality_findings to authenticated;
grant select, insert, update on public.v120_release_readiness_checks to authenticated;
grant select, insert, update on public.v120_user_feedback to authenticated;
