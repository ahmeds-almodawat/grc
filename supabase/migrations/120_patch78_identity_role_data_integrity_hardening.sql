-- Patch 78: Identity, Role, and Data Integrity Hardening
-- Records access integrity reviews, findings, and privileged role recertification evidence.
-- Access integrity review does not approve production launch.
-- Controlled production authority remains separate.

create table if not exists public.identity_role_integrity_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null default public.current_user_org_id(),
  review_title text not null,
  review_scope text not null default 'hospital_access_integrity',
  review_status text not null default 'in_review' check (
    review_status in ('in_review', 'remediation_required', 'ready_for_access_integrity_review', 'accepted_with_limitations', 'blocked', 'deferred')
  ),
  duplicate_role_count integer not null default 0 check (duplicate_role_count >= 0),
  privileged_user_count integer not null default 0 check (privileged_user_count >= 0),
  privileged_pending_recertification_count integer not null default 0 check (privileged_pending_recertification_count >= 0),
  dormant_account_count integer not null default 0 check (dormant_account_count >= 0),
  inactive_account_count integer not null default 0 check (inactive_account_count >= 0),
  archived_user_access_count integer not null default 0 check (archived_user_access_count >= 0),
  missing_owner_count integer not null default 0 check (missing_owner_count >= 0),
  missing_reviewer_count integer not null default 0 check (missing_reviewer_count >= 0),
  department_accountability_gap_count integer not null default 0 check (department_accountability_gap_count >= 0),
  station_accountability_gap_count integer not null default 0 check (station_accountability_gap_count >= 0),
  open_high_risk_finding_count integer not null default 0 check (open_high_risk_finding_count >= 0),
  sso_mfa_readiness_status text not null default 'review_required' check (
    sso_mfa_readiness_status in ('review_required', 'ready_for_it_review', 'blocked', 'not_applicable')
  ),
  access_export_status text not null default 'not_ready' check (
    access_export_status in ('not_ready', 'ready_for_export', 'exported_for_review', 'blocked')
  ),
  review_notes text null,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  reviewed_by uuid null references auth.users(id) on delete set null,
  reviewed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint patch78_review_title_required check (nullif(btrim(review_title), '') is not null),
  constraint patch78_ready_review_guard check (
    review_status <> 'ready_for_access_integrity_review'
    or (
      open_high_risk_finding_count = 0
      and privileged_pending_recertification_count = 0
      and missing_owner_count = 0
      and missing_reviewer_count = 0
      and access_export_status in ('ready_for_export', 'exported_for_review')
    )
  ),
  constraint patch78_accepted_limitation_guard check (
    review_status <> 'accepted_with_limitations'
    or (
      nullif(btrim(coalesce(review_notes, '')), '') is not null
      and reviewed_by is not null
      and reviewed_at is not null
    )
  )
);

create table if not exists public.identity_role_integrity_findings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null default public.current_user_org_id(),
  review_id uuid not null references public.identity_role_integrity_reviews(id) on delete cascade,
  finding_type text not null check (
    finding_type in (
      'duplicate_role',
      'privileged_role_review',
      'dormant_account',
      'inactive_account',
      'archived_user_access',
      'missing_owner',
      'missing_reviewer',
      'department_accountability_gap',
      'station_accountability_gap',
      'sso_mfa_readiness_gap',
      'access_export_required',
      'data_integrity_gap'
    )
  ),
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  entity_type text not null,
  entity_id uuid null,
  department_id uuid null,
  finding_title text not null,
  finding_summary text null,
  owner_id uuid null references auth.users(id) on delete set null,
  due_date date null,
  finding_status text not null default 'open' check (
    finding_status in ('open', 'in_progress', 'resolved', 'accepted_limitation', 'deferred', 'blocked')
  ),
  resolution_summary text null,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint patch78_finding_title_required check (nullif(btrim(finding_title), '') is not null),
  constraint patch78_high_risk_deferred_guard check (
    finding_status <> 'deferred'
    or severity not in ('high', 'critical')
    or nullif(btrim(coalesce(resolution_summary, '')), '') is not null
  )
);

create table if not exists public.privileged_role_recertifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null default public.current_user_org_id(),
  review_id uuid not null references public.identity_role_integrity_reviews(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  role_name text not null,
  department_id uuid null,
  recertification_status text not null default 'pending' check (
    recertification_status in ('pending', 'recertified', 'revocation_required', 'deferred', 'blocked')
  ),
  recertification_rationale text null,
  recertified_by uuid null references auth.users(id) on delete set null,
  recertified_at timestamptz null,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint patch78_role_name_required check (nullif(btrim(role_name), '') is not null),
  constraint patch78_recertified_rationale_guard check (
    recertification_status <> 'recertified'
    or nullif(btrim(coalesce(recertification_rationale, '')), '') is not null
  )
);

create index if not exists idx_patch78_reviews_org_status on public.identity_role_integrity_reviews(organization_id, review_status, created_at desc);
create index if not exists idx_patch78_findings_review_status on public.identity_role_integrity_findings(review_id, finding_status, severity);
create index if not exists idx_patch78_findings_type on public.identity_role_integrity_findings(finding_type, severity);
create index if not exists idx_patch78_recert_review_status on public.privileged_role_recertifications(review_id, recertification_status);
create index if not exists idx_patch78_recert_user on public.privileged_role_recertifications(user_id, role_name);

alter table public.identity_role_integrity_reviews enable row level security;
alter table public.identity_role_integrity_findings enable row level security;
alter table public.privileged_role_recertifications enable row level security;

drop policy if exists patch78_reviews_read on public.identity_role_integrity_reviews;
create policy patch78_reviews_read on public.identity_role_integrity_reviews
  for select to authenticated
  using (
    public.has_any_role(array['super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer']::public.app_role[])
    and (organization_id is null or organization_id = public.current_user_org_id())
  );

drop policy if exists patch78_findings_read on public.identity_role_integrity_findings;
create policy patch78_findings_read on public.identity_role_integrity_findings
  for select to authenticated
  using (
    public.has_any_role(array['super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer']::public.app_role[])
    and (organization_id is null or organization_id = public.current_user_org_id())
  );

drop policy if exists patch78_recertifications_read on public.privileged_role_recertifications;
create policy patch78_recertifications_read on public.privileged_role_recertifications
  for select to authenticated
  using (
    public.has_any_role(array['super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer']::public.app_role[])
    and (organization_id is null or organization_id = public.current_user_org_id())
  );

drop policy if exists patch78_reviews_no_direct_insert on public.identity_role_integrity_reviews;
create policy patch78_reviews_no_direct_insert on public.identity_role_integrity_reviews for insert to authenticated with check (false);
drop policy if exists patch78_reviews_no_direct_update on public.identity_role_integrity_reviews;
create policy patch78_reviews_no_direct_update on public.identity_role_integrity_reviews for update to authenticated using (false) with check (false);
drop policy if exists patch78_reviews_no_direct_delete on public.identity_role_integrity_reviews;
create policy patch78_reviews_no_direct_delete on public.identity_role_integrity_reviews for delete to authenticated using (false);

drop policy if exists patch78_findings_no_direct_insert on public.identity_role_integrity_findings;
create policy patch78_findings_no_direct_insert on public.identity_role_integrity_findings for insert to authenticated with check (false);
drop policy if exists patch78_findings_no_direct_update on public.identity_role_integrity_findings;
create policy patch78_findings_no_direct_update on public.identity_role_integrity_findings for update to authenticated using (false) with check (false);
drop policy if exists patch78_findings_no_direct_delete on public.identity_role_integrity_findings;
create policy patch78_findings_no_direct_delete on public.identity_role_integrity_findings for delete to authenticated using (false);

drop policy if exists patch78_recert_no_direct_insert on public.privileged_role_recertifications;
create policy patch78_recert_no_direct_insert on public.privileged_role_recertifications for insert to authenticated with check (false);
drop policy if exists patch78_recert_no_direct_update on public.privileged_role_recertifications;
create policy patch78_recert_no_direct_update on public.privileged_role_recertifications for update to authenticated using (false) with check (false);
drop policy if exists patch78_recert_no_direct_delete on public.privileged_role_recertifications;
create policy patch78_recert_no_direct_delete on public.privileged_role_recertifications for delete to authenticated using (false);

create or replace function public.patch78_service_role_required()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('request.jwt.claim.role', true) <> 'service_role' then
    raise exception 'Patch 78 identity, role, and data integrity actions require the authenticated service-role bridge.';
  end if;
end;
$$;

create or replace function public.patch78_actor_authorized(p_actor_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_authorized boolean;
begin
  select p.organization_id into v_org_id
  from public.profiles p
  where p.id = p_actor_id
    and coalesce(p.is_active, true) = true;

  if v_org_id is null then
    raise exception 'An active actor profile and organization are required.';
  end if;

  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p_actor_id
      and coalesce(ur.is_active, true) = true
      and (ur.organization_id is null or ur.organization_id = v_org_id)
      and ur.role in ('super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer')
  ) into v_authorized;

  if not coalesce(v_authorized, false) then
    raise exception 'Access integrity review requires an authorized governance, executive, audit, compliance, or admin role.';
  end if;

  return v_org_id;
end;
$$;

create or replace function public.patch78_refresh_review_counts(p_review_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.identity_role_integrity_reviews r
  set
    duplicate_role_count = (
      select count(*)::integer from public.identity_role_integrity_findings f
      where f.review_id = p_review_id and f.finding_type = 'duplicate_role' and f.finding_status in ('open', 'in_progress', 'blocked')
    ),
    privileged_pending_recertification_count = (
      select count(*)::integer from public.privileged_role_recertifications c
      where c.review_id = p_review_id and c.recertification_status in ('pending', 'blocked')
    ),
    dormant_account_count = (
      select count(*)::integer from public.identity_role_integrity_findings f
      where f.review_id = p_review_id and f.finding_type = 'dormant_account' and f.finding_status in ('open', 'in_progress', 'blocked')
    ),
    inactive_account_count = (
      select count(*)::integer from public.identity_role_integrity_findings f
      where f.review_id = p_review_id and f.finding_type = 'inactive_account' and f.finding_status in ('open', 'in_progress', 'blocked')
    ),
    archived_user_access_count = (
      select count(*)::integer from public.identity_role_integrity_findings f
      where f.review_id = p_review_id and f.finding_type = 'archived_user_access' and f.finding_status in ('open', 'in_progress', 'blocked')
    ),
    missing_owner_count = (
      select count(*)::integer from public.identity_role_integrity_findings f
      where f.review_id = p_review_id and f.finding_type = 'missing_owner' and f.finding_status in ('open', 'in_progress', 'blocked')
    ),
    missing_reviewer_count = (
      select count(*)::integer from public.identity_role_integrity_findings f
      where f.review_id = p_review_id and f.finding_type = 'missing_reviewer' and f.finding_status in ('open', 'in_progress', 'blocked')
    ),
    department_accountability_gap_count = (
      select count(*)::integer from public.identity_role_integrity_findings f
      where f.review_id = p_review_id and f.finding_type = 'department_accountability_gap' and f.finding_status in ('open', 'in_progress', 'blocked')
    ),
    station_accountability_gap_count = (
      select count(*)::integer from public.identity_role_integrity_findings f
      where f.review_id = p_review_id and f.finding_type = 'station_accountability_gap' and f.finding_status in ('open', 'in_progress', 'blocked')
    ),
    open_high_risk_finding_count = (
      select count(*)::integer from public.identity_role_integrity_findings f
      where f.review_id = p_review_id and f.severity in ('high', 'critical') and f.finding_status in ('open', 'in_progress', 'blocked')
    ),
    updated_at = now()
  where r.id = p_review_id;
end;
$$;

create or replace function public.create_identity_role_integrity_review(
  p_actor_id uuid,
  p_review_title text,
  p_review_notes text default null,
  p_sso_mfa_readiness_status text default 'review_required',
  p_access_export_status text default 'not_ready'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_review_id uuid;
begin
  perform public.patch78_service_role_required();
  v_org_id := public.patch78_actor_authorized(p_actor_id);

  if nullif(btrim(coalesce(p_review_title, '')), '') is null then
    raise exception 'Access integrity review title is required.';
  end if;
  if p_sso_mfa_readiness_status not in ('review_required', 'ready_for_it_review', 'blocked', 'not_applicable') then
    raise exception 'Unsupported SSO/MFA readiness status.';
  end if;
  if p_access_export_status not in ('not_ready', 'ready_for_export', 'exported_for_review', 'blocked') then
    raise exception 'Unsupported access export status.';
  end if;

  insert into public.identity_role_integrity_reviews (
    organization_id,
    review_title,
    review_notes,
    sso_mfa_readiness_status,
    access_export_status,
    created_by
  ) values (
    v_org_id,
    btrim(p_review_title),
    nullif(btrim(coalesce(p_review_notes, '')), ''),
    p_sso_mfa_readiness_status,
    p_access_export_status,
    p_actor_id
  ) returning id into v_review_id;

  return jsonb_build_object('id', v_review_id, 'message', 'Access integrity review recorded.');
end;
$$;

create or replace function public.update_identity_role_integrity_review_status(
  p_actor_id uuid,
  p_review_id uuid,
  p_review_status text,
  p_review_notes text default null,
  p_sso_mfa_readiness_status text default null,
  p_access_export_status text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_review record;
  v_notes text;
  v_sso_status text;
  v_export_status text;
begin
  perform public.patch78_service_role_required();
  v_org_id := public.patch78_actor_authorized(p_actor_id);

  select * into v_review
  from public.identity_role_integrity_reviews
  where id = p_review_id
    and organization_id = v_org_id;

  if v_review.id is null then
    raise exception 'Access integrity review is not available for this organization.';
  end if;
  if p_review_status not in ('in_review', 'remediation_required', 'ready_for_access_integrity_review', 'accepted_with_limitations', 'blocked', 'deferred') then
    raise exception 'Unsupported access integrity review status.';
  end if;

  perform public.patch78_refresh_review_counts(p_review_id);
  select * into v_review
  from public.identity_role_integrity_reviews
  where id = p_review_id;

  v_notes := nullif(btrim(coalesce(p_review_notes, v_review.review_notes, '')), '');
  v_sso_status := coalesce(p_sso_mfa_readiness_status, v_review.sso_mfa_readiness_status);
  v_export_status := coalesce(p_access_export_status, v_review.access_export_status);

  if v_sso_status not in ('review_required', 'ready_for_it_review', 'blocked', 'not_applicable') then
    raise exception 'Unsupported SSO/MFA readiness status.';
  end if;
  if v_export_status not in ('not_ready', 'ready_for_export', 'exported_for_review', 'blocked') then
    raise exception 'Unsupported access export status.';
  end if;

  if p_review_status = 'ready_for_access_integrity_review' then
    if coalesce(v_review.open_high_risk_finding_count, 0) > 0 then
      raise exception 'High-risk identity or data integrity findings remain open.';
    end if;
    if coalesce(v_review.privileged_pending_recertification_count, 0) > 0 then
      raise exception 'Privileged role recertification remains pending.';
    end if;
    if coalesce(v_review.missing_owner_count, 0) > 0 or coalesce(v_review.missing_reviewer_count, 0) > 0 then
      raise exception 'Missing owner/reviewer repair required.';
    end if;
    if v_export_status not in ('ready_for_export', 'exported_for_review') then
      raise exception 'Access export for IT/security review is required.';
    end if;
  end if;

  if p_review_status = 'accepted_with_limitations' and v_notes is null then
    raise exception 'Accepted limitations require review notes.';
  end if;

  update public.identity_role_integrity_reviews
  set
    review_status = p_review_status,
    review_notes = v_notes,
    sso_mfa_readiness_status = v_sso_status,
    access_export_status = v_export_status,
    reviewed_by = case when p_review_status in ('ready_for_access_integrity_review', 'accepted_with_limitations', 'blocked', 'deferred') then p_actor_id else reviewed_by end,
    reviewed_at = case when p_review_status in ('ready_for_access_integrity_review', 'accepted_with_limitations', 'blocked', 'deferred') then now() else reviewed_at end,
    updated_at = now()
  where id = p_review_id;

  return jsonb_build_object('id', p_review_id, 'review_status', p_review_status, 'message', 'Access integrity review status updated.');
end;
$$;

create or replace function public.record_identity_role_integrity_finding(
  p_actor_id uuid,
  p_review_id uuid,
  p_finding_type text,
  p_severity text,
  p_entity_type text,
  p_finding_title text,
  p_finding_summary text default null,
  p_entity_id uuid default null,
  p_department_id uuid default null,
  p_owner_id uuid default null,
  p_due_date date default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_finding_id uuid;
begin
  perform public.patch78_service_role_required();
  v_org_id := public.patch78_actor_authorized(p_actor_id);

  if not exists (select 1 from public.identity_role_integrity_reviews where id = p_review_id and organization_id = v_org_id) then
    raise exception 'Access integrity review is not available for this organization.';
  end if;
  if p_finding_type not in ('duplicate_role', 'privileged_role_review', 'dormant_account', 'inactive_account', 'archived_user_access', 'missing_owner', 'missing_reviewer', 'department_accountability_gap', 'station_accountability_gap', 'sso_mfa_readiness_gap', 'access_export_required', 'data_integrity_gap') then
    raise exception 'Unsupported identity, role, or data finding type.';
  end if;
  if p_severity not in ('low', 'medium', 'high', 'critical') then
    raise exception 'Unsupported finding severity.';
  end if;
  if nullif(btrim(coalesce(p_finding_title, '')), '') is null then
    raise exception 'Finding title is required.';
  end if;

  insert into public.identity_role_integrity_findings (
    organization_id,
    review_id,
    finding_type,
    severity,
    entity_type,
    entity_id,
    department_id,
    finding_title,
    finding_summary,
    owner_id,
    due_date,
    created_by
  ) values (
    v_org_id,
    p_review_id,
    p_finding_type,
    p_severity,
    nullif(btrim(coalesce(p_entity_type, '')), ''),
    p_entity_id,
    p_department_id,
    btrim(p_finding_title),
    nullif(btrim(coalesce(p_finding_summary, '')), ''),
    p_owner_id,
    p_due_date,
    p_actor_id
  ) returning id into v_finding_id;

  perform public.patch78_refresh_review_counts(p_review_id);

  return jsonb_build_object('id', v_finding_id, 'message', 'Identity, role, or data integrity finding recorded.');
end;
$$;

create or replace function public.update_identity_role_integrity_finding_status(
  p_actor_id uuid,
  p_finding_id uuid,
  p_finding_status text,
  p_resolution_summary text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_finding record;
  v_summary text;
begin
  perform public.patch78_service_role_required();
  v_org_id := public.patch78_actor_authorized(p_actor_id);

  select * into v_finding
  from public.identity_role_integrity_findings
  where id = p_finding_id
    and organization_id = v_org_id;

  if v_finding.id is null then
    raise exception 'Identity integrity finding is not available for this organization.';
  end if;
  if p_finding_status not in ('open', 'in_progress', 'resolved', 'accepted_limitation', 'deferred', 'blocked') then
    raise exception 'Unsupported finding status.';
  end if;

  v_summary := nullif(btrim(coalesce(p_resolution_summary, v_finding.resolution_summary, '')), '');
  if p_finding_status = 'deferred' and v_finding.severity in ('high', 'critical') and v_summary is null then
    raise exception 'High-risk findings cannot be deferred without resolution summary.';
  end if;

  update public.identity_role_integrity_findings
  set
    finding_status = p_finding_status,
    resolution_summary = v_summary,
    updated_at = now()
  where id = p_finding_id;

  perform public.patch78_refresh_review_counts(v_finding.review_id);

  return jsonb_build_object('id', p_finding_id, 'finding_status', p_finding_status, 'message', 'Identity integrity finding status updated.');
end;
$$;

create or replace function public.record_privileged_role_recertification(
  p_actor_id uuid,
  p_review_id uuid,
  p_user_id uuid,
  p_role_name text,
  p_recertification_status text,
  p_recertification_rationale text default null,
  p_department_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_recert_id uuid;
  v_rationale text;
begin
  perform public.patch78_service_role_required();
  v_org_id := public.patch78_actor_authorized(p_actor_id);

  if not exists (select 1 from public.identity_role_integrity_reviews where id = p_review_id and organization_id = v_org_id) then
    raise exception 'Access integrity review is not available for this organization.';
  end if;
  if nullif(btrim(coalesce(p_role_name, '')), '') is null then
    raise exception 'Privileged role name is required.';
  end if;
  if p_recertification_status not in ('pending', 'recertified', 'revocation_required', 'deferred', 'blocked') then
    raise exception 'Unsupported privileged role recertification status.';
  end if;

  v_rationale := nullif(btrim(coalesce(p_recertification_rationale, '')), '');
  if p_recertification_status = 'recertified' and v_rationale is null then
    raise exception 'Recertified privileged role requires rationale.';
  end if;

  insert into public.privileged_role_recertifications (
    organization_id,
    review_id,
    user_id,
    role_name,
    department_id,
    recertification_status,
    recertification_rationale,
    recertified_by,
    recertified_at,
    created_by
  ) values (
    v_org_id,
    p_review_id,
    p_user_id,
    btrim(p_role_name),
    p_department_id,
    p_recertification_status,
    v_rationale,
    case when p_recertification_status = 'recertified' then p_actor_id else null end,
    case when p_recertification_status = 'recertified' then now() else null end,
    p_actor_id
  ) returning id into v_recert_id;

  perform public.patch78_refresh_review_counts(p_review_id);

  return jsonb_build_object('id', v_recert_id, 'recertification_status', p_recertification_status, 'message', 'Privileged role recertification evidence recorded.');
end;
$$;

revoke all on function public.patch78_service_role_required() from public, anon, authenticated;
revoke all on function public.patch78_actor_authorized(uuid) from public, anon, authenticated;
revoke all on function public.patch78_refresh_review_counts(uuid) from public, anon, authenticated;
revoke all on function public.create_identity_role_integrity_review(uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.update_identity_role_integrity_review_status(uuid, uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.record_identity_role_integrity_finding(uuid, uuid, text, text, text, text, text, uuid, uuid, uuid, date) from public, anon, authenticated;
revoke all on function public.update_identity_role_integrity_finding_status(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.record_privileged_role_recertification(uuid, uuid, uuid, text, text, text, uuid) from public, anon, authenticated;

grant execute on function public.patch78_service_role_required() to service_role;
grant execute on function public.patch78_actor_authorized(uuid) to service_role;
grant execute on function public.patch78_refresh_review_counts(uuid) to service_role;
grant execute on function public.create_identity_role_integrity_review(uuid, text, text, text, text) to service_role;
grant execute on function public.update_identity_role_integrity_review_status(uuid, uuid, text, text, text, text) to service_role;
grant execute on function public.record_identity_role_integrity_finding(uuid, uuid, text, text, text, text, text, uuid, uuid, uuid, date) to service_role;
grant execute on function public.update_identity_role_integrity_finding_status(uuid, uuid, text, text) to service_role;
grant execute on function public.record_privileged_role_recertification(uuid, uuid, uuid, text, text, text, uuid) to service_role;
