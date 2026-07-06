-- Patch 79: Production Operations, Hypercare, and Board Pack Closure
-- Records operations governance, hypercare, operating visibility, and board pack readiness.
-- Board closure does not approve production launch.
-- Controlled production authority remains separate.
-- Live transition requires separate operational execution.

create table if not exists public.production_hypercare_windows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null default public.current_user_org_id(),
  hypercare_title text not null,
  hypercare_scope text not null default 'controlled_operations',
  hypercare_status text not null default 'planned' check (
    hypercare_status in ('planned', 'active', 'monitoring', 'exit_review_required', 'blocked', 'deferred', 'closed_with_limitations')
  ),
  day_30_status text not null default 'not_started' check (day_30_status in ('not_started', 'in_progress', 'review_required', 'accepted', 'blocked', 'deferred')),
  day_60_status text not null default 'not_started' check (day_60_status in ('not_started', 'in_progress', 'review_required', 'accepted', 'blocked', 'deferred')),
  day_90_status text not null default 'not_started' check (day_90_status in ('not_started', 'in_progress', 'review_required', 'accepted', 'blocked', 'deferred')),
  open_support_issue_count integer not null default 0 check (open_support_issue_count >= 0),
  critical_incident_count integer not null default 0 check (critical_incident_count >= 0),
  unresolved_limitation_count integer not null default 0 check (unresolved_limitation_count >= 0),
  corrective_action_open_count integer not null default 0 check (corrective_action_open_count >= 0),
  department_launch_gap_count integer not null default 0 check (department_launch_gap_count >= 0),
  evidence_pack_status text not null default 'incomplete' check (evidence_pack_status in ('incomplete', 'collecting', 'ready_for_review', 'accepted_with_limitations', 'blocked')),
  board_pack_status text not null default 'draft' check (board_pack_status in ('draft', 'review_required', 'ready_for_board_review', 'accepted_with_limitations', 'blocked', 'deferred')),
  hypercare_exit_ready boolean not null default false,
  exit_review_notes text null,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  reviewed_by uuid null references auth.users(id) on delete set null,
  reviewed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint patch79_hypercare_title_required check (nullif(btrim(hypercare_title), '') is not null),
  constraint patch79_hypercare_exit_guard check (
    hypercare_status <> 'exit_review_required'
    or (
      critical_incident_count = 0
      and evidence_pack_status not in ('incomplete', 'blocked')
      and board_pack_status not in ('draft', 'blocked')
      and (open_support_issue_count = 0 or unresolved_limitation_count > 0 or evidence_pack_status = 'accepted_with_limitations' or board_pack_status = 'accepted_with_limitations')
    )
  ),
  constraint patch79_hypercare_close_guard check (
    hypercare_status <> 'closed_with_limitations'
    or (reviewed_by is not null and reviewed_at is not null)
  )
);

create table if not exists public.production_hypercare_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null default public.current_user_org_id(),
  hypercare_window_id uuid not null references public.production_hypercare_windows(id) on delete cascade,
  item_type text not null check (
    item_type in (
      'support_issue',
      'incident_trend',
      'department_launch_health',
      'known_limitation',
      'corrective_action',
      'evidence_pack_gap',
      'board_pack_gap',
      'training_gap',
      'dr_restore_gap',
      'access_review_gap'
    )
  ),
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  item_status text not null default 'open' check (
    item_status in ('open', 'in_progress', 'evidence_required', 'review_required', 'closed', 'accepted_limitation', 'deferred', 'blocked')
  ),
  department_id uuid null,
  owner_id uuid null references auth.users(id) on delete set null,
  item_title text not null,
  item_summary text null,
  due_date date null,
  evidence_summary text null,
  closure_summary text null,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint patch79_item_title_required check (nullif(btrim(item_title), '') is not null),
  constraint patch79_high_critical_closure_guard check (
    item_status <> 'closed'
    or severity not in ('high', 'critical')
    or nullif(btrim(coalesce(closure_summary, '')), '') is not null
  ),
  constraint patch79_evidence_gap_closure_guard check (
    item_status <> 'closed'
    or item_type <> 'evidence_pack_gap'
    or nullif(btrim(coalesce(evidence_summary, '')), '') is not null
  )
);

create table if not exists public.executive_governance_board_packs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null default public.current_user_org_id(),
  hypercare_window_id uuid null references public.production_hypercare_windows(id) on delete set null,
  pack_title text not null,
  reporting_period text not null,
  pack_status text not null default 'draft' check (
    pack_status in ('draft', 'review_required', 'ready_for_board_review', 'accepted_with_limitations', 'blocked', 'deferred')
  ),
  executive_summary text null,
  support_trend_summary text null,
  incident_trend_summary text null,
  department_health_summary text null,
  limitation_summary text null,
  corrective_action_summary text null,
  accreditation_evidence_summary text null,
  dr_support_access_training_summary text null,
  board_review_notes text null,
  prepared_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  reviewed_by uuid null references auth.users(id) on delete set null,
  reviewed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint patch79_pack_title_required check (nullif(btrim(pack_title), '') is not null),
  constraint patch79_reporting_period_required check (nullif(btrim(reporting_period), '') is not null),
  constraint patch79_board_limitation_guard check (
    pack_status <> 'accepted_with_limitations'
    or nullif(btrim(coalesce(board_review_notes, '')), '') is not null
  )
);

create index if not exists idx_patch79_hypercare_org_status on public.production_hypercare_windows(organization_id, hypercare_status, created_at desc);
create index if not exists idx_patch79_items_window_status on public.production_hypercare_items(hypercare_window_id, item_status, severity);
create index if not exists idx_patch79_items_type on public.production_hypercare_items(item_type, severity);
create index if not exists idx_patch79_board_packs_org_status on public.executive_governance_board_packs(organization_id, pack_status, created_at desc);

alter table public.production_hypercare_windows enable row level security;
alter table public.production_hypercare_items enable row level security;
alter table public.executive_governance_board_packs enable row level security;

drop policy if exists patch79_hypercare_windows_read on public.production_hypercare_windows;
create policy patch79_hypercare_windows_read on public.production_hypercare_windows
  for select to authenticated
  using (
    public.has_any_role(array['super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer']::public.app_role[])
    and (organization_id is null or organization_id = public.current_user_org_id())
  );

drop policy if exists patch79_hypercare_items_read on public.production_hypercare_items;
create policy patch79_hypercare_items_read on public.production_hypercare_items
  for select to authenticated
  using (
    public.has_any_role(array['super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer']::public.app_role[])
    and (organization_id is null or organization_id = public.current_user_org_id())
  );

drop policy if exists patch79_board_packs_read on public.executive_governance_board_packs;
create policy patch79_board_packs_read on public.executive_governance_board_packs
  for select to authenticated
  using (
    public.has_any_role(array['super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer']::public.app_role[])
    and (organization_id is null or organization_id = public.current_user_org_id())
  );

drop policy if exists patch79_hypercare_windows_no_direct_insert on public.production_hypercare_windows;
create policy patch79_hypercare_windows_no_direct_insert on public.production_hypercare_windows for insert to authenticated with check (false);
drop policy if exists patch79_hypercare_windows_no_direct_update on public.production_hypercare_windows;
create policy patch79_hypercare_windows_no_direct_update on public.production_hypercare_windows for update to authenticated using (false) with check (false);
drop policy if exists patch79_hypercare_windows_no_direct_delete on public.production_hypercare_windows;
create policy patch79_hypercare_windows_no_direct_delete on public.production_hypercare_windows for delete to authenticated using (false);

drop policy if exists patch79_hypercare_items_no_direct_insert on public.production_hypercare_items;
create policy patch79_hypercare_items_no_direct_insert on public.production_hypercare_items for insert to authenticated with check (false);
drop policy if exists patch79_hypercare_items_no_direct_update on public.production_hypercare_items;
create policy patch79_hypercare_items_no_direct_update on public.production_hypercare_items for update to authenticated using (false) with check (false);
drop policy if exists patch79_hypercare_items_no_direct_delete on public.production_hypercare_items;
create policy patch79_hypercare_items_no_direct_delete on public.production_hypercare_items for delete to authenticated using (false);

drop policy if exists patch79_board_packs_no_direct_insert on public.executive_governance_board_packs;
create policy patch79_board_packs_no_direct_insert on public.executive_governance_board_packs for insert to authenticated with check (false);
drop policy if exists patch79_board_packs_no_direct_update on public.executive_governance_board_packs;
create policy patch79_board_packs_no_direct_update on public.executive_governance_board_packs for update to authenticated using (false) with check (false);
drop policy if exists patch79_board_packs_no_direct_delete on public.executive_governance_board_packs;
create policy patch79_board_packs_no_direct_delete on public.executive_governance_board_packs for delete to authenticated using (false);

create or replace function public.patch79_service_role_required()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('request.jwt.claim.role', true) <> 'service_role' then
    raise exception 'Patch 79 production operations governance actions require the authenticated service-role bridge.';
  end if;
end;
$$;

create or replace function public.patch79_actor_authorized(p_actor_id uuid)
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
    raise exception 'Production operations governance requires an authorized governance, executive, audit, compliance, or admin role.';
  end if;

  return v_org_id;
end;
$$;

create or replace function public.patch79_refresh_window_counts(p_window_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.production_hypercare_windows w
  set
    open_support_issue_count = (
      select count(*)::integer from public.production_hypercare_items i
      where i.hypercare_window_id = p_window_id
        and i.item_type = 'support_issue'
        and i.item_status in ('open', 'in_progress', 'evidence_required', 'review_required', 'blocked')
    ),
    critical_incident_count = (
      select count(*)::integer from public.production_hypercare_items i
      where i.hypercare_window_id = p_window_id
        and i.item_type = 'incident_trend'
        and i.severity = 'critical'
        and i.item_status in ('open', 'in_progress', 'evidence_required', 'review_required', 'blocked')
    ),
    unresolved_limitation_count = (
      select count(*)::integer from public.production_hypercare_items i
      where i.hypercare_window_id = p_window_id
        and i.item_type = 'known_limitation'
        and i.item_status in ('open', 'in_progress', 'evidence_required', 'review_required', 'accepted_limitation', 'blocked')
    ),
    corrective_action_open_count = (
      select count(*)::integer from public.production_hypercare_items i
      where i.hypercare_window_id = p_window_id
        and i.item_type = 'corrective_action'
        and i.item_status in ('open', 'in_progress', 'evidence_required', 'review_required', 'blocked')
    ),
    department_launch_gap_count = (
      select count(*)::integer from public.production_hypercare_items i
      where i.hypercare_window_id = p_window_id
        and i.item_type = 'department_launch_health'
        and i.item_status in ('open', 'in_progress', 'evidence_required', 'review_required', 'blocked')
    ),
    updated_at = now()
  where w.id = p_window_id;
end;
$$;

create or replace function public.create_production_hypercare_window(
  p_actor_id uuid,
  p_hypercare_title text,
  p_exit_review_notes text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_window_id uuid;
begin
  perform public.patch79_service_role_required();
  v_org_id := public.patch79_actor_authorized(p_actor_id);

  if nullif(btrim(coalesce(p_hypercare_title, '')), '') is null then
    raise exception 'Hypercare command center title is required.';
  end if;

  insert into public.production_hypercare_windows (
    organization_id,
    hypercare_title,
    exit_review_notes,
    created_by
  ) values (
    v_org_id,
    btrim(p_hypercare_title),
    nullif(btrim(coalesce(p_exit_review_notes, '')), ''),
    p_actor_id
  ) returning id into v_window_id;

  return jsonb_build_object('id', v_window_id, 'message', 'Production operations governance hypercare window recorded.');
end;
$$;

create or replace function public.update_production_hypercare_window_status(
  p_actor_id uuid,
  p_hypercare_window_id uuid,
  p_hypercare_status text,
  p_day_30_status text default null,
  p_day_60_status text default null,
  p_day_90_status text default null,
  p_evidence_pack_status text default null,
  p_board_pack_status text default null,
  p_exit_review_notes text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_window record;
  v_day_30 text;
  v_day_60 text;
  v_day_90 text;
  v_evidence_status text;
  v_board_status text;
  v_notes text;
begin
  perform public.patch79_service_role_required();
  v_org_id := public.patch79_actor_authorized(p_actor_id);

  if p_hypercare_status not in ('planned', 'active', 'monitoring', 'exit_review_required', 'blocked', 'deferred', 'closed_with_limitations') then
    raise exception 'Unsupported hypercare status.';
  end if;

  perform public.patch79_refresh_window_counts(p_hypercare_window_id);
  select * into v_window
  from public.production_hypercare_windows
  where id = p_hypercare_window_id
    and organization_id = v_org_id;

  if v_window.id is null then
    raise exception 'Hypercare command center record is not available for this organization.';
  end if;

  v_day_30 := coalesce(p_day_30_status, v_window.day_30_status);
  v_day_60 := coalesce(p_day_60_status, v_window.day_60_status);
  v_day_90 := coalesce(p_day_90_status, v_window.day_90_status);
  v_evidence_status := coalesce(p_evidence_pack_status, v_window.evidence_pack_status);
  v_board_status := coalesce(p_board_pack_status, v_window.board_pack_status);
  v_notes := nullif(btrim(coalesce(p_exit_review_notes, v_window.exit_review_notes, '')), '');

  if v_day_30 not in ('not_started', 'in_progress', 'review_required', 'accepted', 'blocked', 'deferred')
    or v_day_60 not in ('not_started', 'in_progress', 'review_required', 'accepted', 'blocked', 'deferred')
    or v_day_90 not in ('not_started', 'in_progress', 'review_required', 'accepted', 'blocked', 'deferred') then
    raise exception 'Unsupported 30/60/90 operating view status.';
  end if;
  if v_evidence_status not in ('incomplete', 'collecting', 'ready_for_review', 'accepted_with_limitations', 'blocked') then
    raise exception 'Unsupported accreditation/evidence pack tracking status.';
  end if;
  if v_board_status not in ('draft', 'review_required', 'ready_for_board_review', 'accepted_with_limitations', 'blocked', 'deferred') then
    raise exception 'Unsupported board closure pack status.';
  end if;

  if p_hypercare_status = 'exit_review_required' then
    if coalesce(v_window.critical_incident_count, 0) > 0 then
      raise exception 'Critical incidents block hypercare exit review.';
    end if;
    if coalesce(v_window.open_support_issue_count, 0) > 0 and coalesce(v_window.unresolved_limitation_count, 0) = 0 and v_evidence_status <> 'accepted_with_limitations' and v_board_status <> 'accepted_with_limitations' then
      raise exception 'Open support issues block hypercare exit review unless limitations are accepted.';
    end if;
    if v_evidence_status in ('incomplete', 'blocked') then
      raise exception 'Incomplete or blocked evidence pack blocks hypercare exit review.';
    end if;
    if v_board_status in ('draft', 'blocked') then
      raise exception 'Board pack draft or blocked status blocks hypercare exit review.';
    end if;
  end if;

  if p_hypercare_status = 'closed_with_limitations' and v_notes is null then
    raise exception 'Hypercare closure requires exit review notes.';
  end if;

  update public.production_hypercare_windows
  set
    hypercare_status = p_hypercare_status,
    day_30_status = v_day_30,
    day_60_status = v_day_60,
    day_90_status = v_day_90,
    evidence_pack_status = v_evidence_status,
    board_pack_status = v_board_status,
    hypercare_exit_ready = p_hypercare_status = 'exit_review_required',
    exit_review_notes = v_notes,
    reviewed_by = case when p_hypercare_status in ('exit_review_required', 'closed_with_limitations', 'blocked', 'deferred') then p_actor_id else reviewed_by end,
    reviewed_at = case when p_hypercare_status in ('exit_review_required', 'closed_with_limitations', 'blocked', 'deferred') then now() else reviewed_at end,
    updated_at = now()
  where id = p_hypercare_window_id;

  return jsonb_build_object('id', p_hypercare_window_id, 'hypercare_status', p_hypercare_status, 'message', 'Production operations governance hypercare status updated.');
end;
$$;

create or replace function public.record_production_hypercare_item(
  p_actor_id uuid,
  p_hypercare_window_id uuid,
  p_item_type text,
  p_item_title text,
  p_severity text default 'medium',
  p_item_summary text default null,
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
  v_item_id uuid;
begin
  perform public.patch79_service_role_required();
  v_org_id := public.patch79_actor_authorized(p_actor_id);

  if not exists (select 1 from public.production_hypercare_windows where id = p_hypercare_window_id and organization_id = v_org_id) then
    raise exception 'Hypercare command center record is not available for this organization.';
  end if;
  if p_item_type not in ('support_issue', 'incident_trend', 'department_launch_health', 'known_limitation', 'corrective_action', 'evidence_pack_gap', 'board_pack_gap', 'training_gap', 'dr_restore_gap', 'access_review_gap') then
    raise exception 'Unsupported hypercare governance item type.';
  end if;
  if p_severity not in ('low', 'medium', 'high', 'critical') then
    raise exception 'Unsupported hypercare governance item severity.';
  end if;
  if nullif(btrim(coalesce(p_item_title, '')), '') is null then
    raise exception 'Hypercare governance item title is required.';
  end if;

  insert into public.production_hypercare_items (
    organization_id,
    hypercare_window_id,
    item_type,
    item_title,
    severity,
    item_summary,
    department_id,
    owner_id,
    due_date,
    created_by
  ) values (
    v_org_id,
    p_hypercare_window_id,
    p_item_type,
    btrim(p_item_title),
    p_severity,
    nullif(btrim(coalesce(p_item_summary, '')), ''),
    p_department_id,
    p_owner_id,
    p_due_date,
    p_actor_id
  ) returning id into v_item_id;

  perform public.patch79_refresh_window_counts(p_hypercare_window_id);

  return jsonb_build_object('id', v_item_id, 'message', 'Production operations governance item recorded.');
end;
$$;

create or replace function public.update_production_hypercare_item_status(
  p_actor_id uuid,
  p_item_id uuid,
  p_item_status text,
  p_evidence_summary text default null,
  p_closure_summary text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_item record;
  v_evidence text;
  v_closure text;
begin
  perform public.patch79_service_role_required();
  v_org_id := public.patch79_actor_authorized(p_actor_id);

  select * into v_item
  from public.production_hypercare_items
  where id = p_item_id
    and organization_id = v_org_id;

  if v_item.id is null then
    raise exception 'Hypercare governance item is not available for this organization.';
  end if;
  if p_item_status not in ('open', 'in_progress', 'evidence_required', 'review_required', 'closed', 'accepted_limitation', 'deferred', 'blocked') then
    raise exception 'Unsupported hypercare governance item status.';
  end if;

  v_evidence := nullif(btrim(coalesce(p_evidence_summary, v_item.evidence_summary, '')), '');
  v_closure := nullif(btrim(coalesce(p_closure_summary, v_item.closure_summary, '')), '');

  if p_item_status = 'closed' and v_item.severity in ('high', 'critical') and v_closure is null then
    raise exception 'High/critical hypercare governance items cannot close without closure summary.';
  end if;
  if p_item_status = 'closed' and v_item.item_type = 'evidence_pack_gap' and v_evidence is null then
    raise exception 'Evidence pack gaps cannot close without evidence summary.';
  end if;

  update public.production_hypercare_items
  set
    item_status = p_item_status,
    evidence_summary = v_evidence,
    closure_summary = v_closure,
    updated_at = now()
  where id = p_item_id;

  perform public.patch79_refresh_window_counts(v_item.hypercare_window_id);

  return jsonb_build_object('id', p_item_id, 'item_status', p_item_status, 'message', 'Production operations governance item status updated.');
end;
$$;

create or replace function public.create_executive_governance_board_pack(
  p_actor_id uuid,
  p_pack_title text,
  p_reporting_period text,
  p_hypercare_window_id uuid default null,
  p_executive_summary text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_pack_id uuid;
begin
  perform public.patch79_service_role_required();
  v_org_id := public.patch79_actor_authorized(p_actor_id);

  if p_hypercare_window_id is not null and not exists (select 1 from public.production_hypercare_windows where id = p_hypercare_window_id and organization_id = v_org_id) then
    raise exception 'Hypercare command center record is not available for this organization.';
  end if;
  if nullif(btrim(coalesce(p_pack_title, '')), '') is null then
    raise exception 'Board closure pack title is required.';
  end if;
  if nullif(btrim(coalesce(p_reporting_period, '')), '') is null then
    raise exception 'Executive monthly governance report period is required.';
  end if;

  insert into public.executive_governance_board_packs (
    organization_id,
    hypercare_window_id,
    pack_title,
    reporting_period,
    executive_summary,
    prepared_by
  ) values (
    v_org_id,
    p_hypercare_window_id,
    btrim(p_pack_title),
    btrim(p_reporting_period),
    nullif(btrim(coalesce(p_executive_summary, '')), ''),
    p_actor_id
  ) returning id into v_pack_id;

  return jsonb_build_object('id', v_pack_id, 'message', 'Executive monthly governance report and board closure pack recorded.');
end;
$$;

create or replace function public.update_executive_governance_board_pack_status(
  p_actor_id uuid,
  p_board_pack_id uuid,
  p_pack_status text,
  p_board_review_notes text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_pack record;
  v_open_blockers integer;
  v_notes text;
begin
  perform public.patch79_service_role_required();
  v_org_id := public.patch79_actor_authorized(p_actor_id);

  select * into v_pack
  from public.executive_governance_board_packs
  where id = p_board_pack_id
    and organization_id = v_org_id;

  if v_pack.id is null then
    raise exception 'Board closure pack is not available for this organization.';
  end if;
  if p_pack_status not in ('draft', 'review_required', 'ready_for_board_review', 'accepted_with_limitations', 'blocked', 'deferred') then
    raise exception 'Unsupported board closure pack status.';
  end if;

  v_notes := nullif(btrim(coalesce(p_board_review_notes, v_pack.board_review_notes, '')), '');

  if p_pack_status = 'ready_for_board_review' then
    select count(*)::integer into v_open_blockers
    from public.production_hypercare_items i
    where i.hypercare_window_id = v_pack.hypercare_window_id
      and i.severity in ('high', 'critical')
      and i.item_status in ('open', 'in_progress', 'evidence_required', 'review_required', 'blocked');

    if coalesce(v_open_blockers, 0) > 0 then
      raise exception 'High/critical open items block board pack ready for board review.';
    end if;
  end if;

  if p_pack_status = 'accepted_with_limitations' and v_notes is null then
    raise exception 'Board pack accepted with limitations requires board review notes.';
  end if;

  update public.executive_governance_board_packs
  set
    pack_status = p_pack_status,
    board_review_notes = v_notes,
    reviewed_by = case when p_pack_status in ('ready_for_board_review', 'accepted_with_limitations', 'blocked', 'deferred') then p_actor_id else reviewed_by end,
    reviewed_at = case when p_pack_status in ('ready_for_board_review', 'accepted_with_limitations', 'blocked', 'deferred') then now() else reviewed_at end,
    updated_at = now()
  where id = p_board_pack_id;

  if v_pack.hypercare_window_id is not null then
    update public.production_hypercare_windows
    set board_pack_status = p_pack_status,
        updated_at = now()
    where id = v_pack.hypercare_window_id;
  end if;

  return jsonb_build_object('id', p_board_pack_id, 'pack_status', p_pack_status, 'message', 'Executive monthly governance report and board closure pack status updated.');
end;
$$;

revoke all on function public.patch79_service_role_required() from public, anon, authenticated;
revoke all on function public.patch79_actor_authorized(uuid) from public, anon, authenticated;
revoke all on function public.patch79_refresh_window_counts(uuid) from public, anon, authenticated;
revoke all on function public.create_production_hypercare_window(uuid, text, text) from public, anon, authenticated;
revoke all on function public.update_production_hypercare_window_status(uuid, uuid, text, text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.record_production_hypercare_item(uuid, uuid, text, text, text, text, uuid, uuid, date) from public, anon, authenticated;
revoke all on function public.update_production_hypercare_item_status(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.create_executive_governance_board_pack(uuid, text, text, uuid, text) from public, anon, authenticated;
revoke all on function public.update_executive_governance_board_pack_status(uuid, uuid, text, text) from public, anon, authenticated;

grant execute on function public.patch79_service_role_required() to service_role;
grant execute on function public.patch79_actor_authorized(uuid) to service_role;
grant execute on function public.patch79_refresh_window_counts(uuid) to service_role;
grant execute on function public.create_production_hypercare_window(uuid, text, text) to service_role;
grant execute on function public.update_production_hypercare_window_status(uuid, uuid, text, text, text, text, text, text, text) to service_role;
grant execute on function public.record_production_hypercare_item(uuid, uuid, text, text, text, text, uuid, uuid, date) to service_role;
grant execute on function public.update_production_hypercare_item_status(uuid, uuid, text, text, text) to service_role;
grant execute on function public.create_executive_governance_board_pack(uuid, text, text, uuid, text) to service_role;
grant execute on function public.update_executive_governance_board_pack_status(uuid, uuid, text, text) to service_role;
