-- =========================================================
-- v9.8 OVR Workflow Gap Closure
-- Controlled-pilot lifecycle, role gates, referral visibility,
-- notifications, reporter dispute/acceptance, and closure guards.
-- =========================================================

begin;

do $$
declare
  value text;
begin
  foreach value in array array[
    'manager_review',
    'quality_validation',
    'referred_party_response',
    'quality_final_review',
    'disputed',
    'reopened',
    'escalated'
  ]
  loop
    if not exists (
      select 1
      from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'public'
        and t.typname = 'ovr_status'
        and e.enumlabel = value
    ) then
      execute format('alter type public.ovr_status add value %L', value);
    end if;
  end loop;
end
$$;

commit;

begin;

grant all on table public.notifications to service_role;
grant select on public.v_ovr_summary to authenticated;
grant select on public.v_ovr_quality_queue to authenticated;
alter view public.v_ovr_summary set (security_invoker = true);
alter view public.v_ovr_quality_queue set (security_invoker = true);

alter table public.ovr_reports
  add column if not exists referred_department_id uuid references public.departments(id) on delete set null,
  add column if not exists referred_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists manager_reviewed_at timestamptz,
  add column if not exists quality_validated_at timestamptz,
  add column if not exists referred_response text,
  add column if not exists referred_responded_at timestamptz,
  add column if not exists final_verdict text,
  add column if not exists final_verdict_at timestamptz,
  add column if not exists reporter_response text,
  add column if not exists reporter_response_at timestamptz,
  add column if not exists dispute_reason text,
  add column if not exists reopened_at timestamptz,
  add column if not exists cross_department_notified_at timestamptz,
  add column if not exists escalated_at timestamptz;

create index if not exists idx_ovr_reports_referred_department
  on public.ovr_reports(referred_department_id);
create index if not exists idx_ovr_reports_referred_user
  on public.ovr_reports(referred_user_id);

create or replace function public.v98_initialize_ovr_submission()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status = 'submitted' and new.supervisor_due_date is null then
    new.supervisor_due_date := current_date + 1;
  end if;

  -- Browser-authenticated reporters submit facts only. Workflow decisions,
  -- referrals, verdicts, and closure fields are server-bridge controlled.
  if auth.role() = 'authenticated' then
    new.evidence_required := true;
    new.corrective_action_required := false;
    new.linked_project_id := null;
    new.supervisor_investigation := null;
    new.quality_manager_comments := null;
    new.referred_to_person := null;
    new.referred_to_department := null;
    new.referred_to_date := null;
    new.referred_department_id := null;
    new.referred_user_id := null;
    new.final_verdict := null;
    new.final_verdict_at := null;
    new.final_severity_level := null;
    new.occurrence_confirmed_by_quality := false;
    new.reporter_response := null;
    new.reporter_response_at := null;
    new.dispute_reason := null;
    new.cross_department_notified_at := null;
    new.closed_by := null;
    new.closed_at := null;
    new.quality_closed_by := null;
    new.quality_closed_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_v98_initialize_ovr_submission on public.ovr_reports;
create trigger trg_v98_initialize_ovr_submission
before insert on public.ovr_reports
for each row execute function public.v98_initialize_ovr_submission();

create or replace function public.v98_notify_ovr_submission()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status <> 'submitted' then
    return new;
  end if;

  insert into public.notifications (
    organization_id,
    user_id,
    title,
    body,
    link_path
  )
  select
    new.organization_id,
    ur.user_id,
    'OVR manager review required',
    coalesce(new.ovr_number, 'OVR') || ' requires manager review within 24 hours.',
    '/ovr'
  from public.user_roles ur
  where ur.organization_id is not distinct from new.organization_id
    and ur.role = 'department_manager'
    and ur.is_active = true
    and (
      ur.scope = 'global'
      or (
        ur.scope = 'department'
        and ur.department_id is not distinct from new.department_id
      )
    )
    and not exists (
      select 1
      from public.notifications n
      where n.user_id = ur.user_id
        and n.title = 'OVR manager review required'
        and n.body like coalesce(new.ovr_number, 'OVR') || '%'
    );

  return new;
end;
$$;

revoke all on function public.v98_notify_ovr_submission()
from public, anon, authenticated;
grant execute on function public.v98_notify_ovr_submission()
to service_role;

drop trigger if exists trg_v98_notify_ovr_submission on public.ovr_reports;
create trigger trg_v98_notify_ovr_submission
after insert on public.ovr_reports
for each row execute function public.v98_notify_ovr_submission();

create or replace function public.grc_guard_ovr_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status::text = 'returned_for_clarification'
     and coalesce(
       nullif(trim(new.returned_reason), ''),
       nullif(trim(new.returned_for_clarification_reason), ''),
       nullif(trim(new.rejection_reason), '')
     ) is null then
    raise exception 'Return reason is required before returning an OVR for clarification.';
  end if;

  if new.status::text = 'closed' then
    if coalesce(trim(new.final_verdict), '') = '' then
      raise exception 'Final Quality verdict is required before closing this OVR.';
    end if;

    if not public.can_close_ovr(new.id) then
      raise exception 'Accepted evidence or a closed linked corrective-action project is required before closing this OVR.';
    end if;

    if new.quality_closed_by is null then
      raise exception 'Quality final-review user is required before closing this OVR.';
    end if;

    if new.quality_closed_at is null then
      new.quality_closed_at := now();
    end if;
  end if;

  return new;
end;
$$;

drop policy if exists ovr_reports_read_related on public.ovr_reports;
create policy ovr_reports_read_related on public.ovr_reports
for select to authenticated
using (
  reported_by = auth.uid()
  or owner_id = auth.uid()
  or supervisor_id = auth.uid()
  or quality_reviewer_id = auth.uid()
  or quality_manager_id = auth.uid()
  or referred_user_id = auth.uid()
  or exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.is_active = true
      and ur.role = 'department_manager'
      and ur.organization_id is not distinct from ovr_reports.organization_id
      and (
        ur.scope = 'global'
        or (
          ur.scope = 'department'
          and (
            ur.department_id is not distinct from ovr_reports.department_id
            or ur.department_id is not distinct from ovr_reports.referred_department_id
          )
        )
      )
  )
  or exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.is_active = true
      and ur.role in (
        'super_admin',
        'executive',
        'governance_admin',
        'auditor',
        'compliance_officer'
      )
      and (
        ur.organization_id is null
        or ur.organization_id is not distinct from ovr_reports.organization_id
      )
  )
);

drop policy if exists ovr_reports_insert_authenticated on public.ovr_reports;
create policy ovr_reports_insert_authenticated on public.ovr_reports
for insert to authenticated
with check (
  reported_by = auth.uid()
  and created_by = auth.uid()
  and organization_id = public.current_user_org_id()
  and status in ('draft', 'submitted')
);

drop policy if exists ovr_reports_update_related on public.ovr_reports;
create policy ovr_reports_update_reporter_draft on public.ovr_reports
for update to authenticated
using (
  reported_by = auth.uid()
  and status = 'draft'
)
with check (
  reported_by = auth.uid()
  and created_by = auth.uid()
  and organization_id = public.current_user_org_id()
  and status = 'draft'
);

create or replace function public.v98_update_ovr_workflow(
  p_actor_id uuid,
  p_ovr_report_id uuid,
  p_next_status text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ovr public.ovr_reports%rowtype;
  v_actor_org uuid;
  v_actor_department uuid;
  v_actor_is_quality boolean := false;
  v_actor_is_auditor boolean := false;
  v_actor_is_manager boolean := false;
  v_actor_is_referred_manager boolean := false;
  v_actor_is_reporter boolean := false;
  v_actor_is_referred boolean := false;
  v_note text := nullif(trim(p_payload->>'note'), '');
  v_supervisor_investigation text := nullif(trim(p_payload->>'supervisor_investigation'), '');
  v_corrective_action text := nullif(trim(p_payload->>'corrective_action'), '');
  v_quality_comments text := nullif(trim(p_payload->>'quality_manager_comments'), '');
  v_referred_response text := nullif(trim(p_payload->>'referred_response'), '');
  v_final_verdict text := nullif(trim(p_payload->>'final_verdict'), '');
  v_referred_department_id uuid := nullif(p_payload->>'referred_department_id', '')::uuid;
  v_referred_user_id uuid := nullif(p_payload->>'referred_user_id', '')::uuid;
  v_confirmed_severity public.ovr_severity_level :=
    nullif(p_payload->>'confirmed_severity_level', '')::public.ovr_severity_level;
  v_corrective_due date := nullif(p_payload->>'corrective_action_due_date', '')::date;
begin
  if auth.role() <> 'service_role' then
    raise exception 'V98_OVR_SERVICE_ROLE_REQUIRED';
  end if;

  select *
    into v_ovr
  from public.ovr_reports
  where id = p_ovr_report_id
  for update;

  if not found then
    raise exception 'V98_OVR_NOT_FOUND';
  end if;

  select organization_id, department_id
    into v_actor_org, v_actor_department
  from public.profiles
  where id = p_actor_id
    and is_active = true;

  if v_actor_org is null then
    raise exception 'V98_OVR_ACTIVE_ACTOR_REQUIRED';
  end if;

  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p_actor_id
      and ur.is_active = true
      and ur.role in ('super_admin', 'governance_admin', 'compliance_officer')
      and (
        ur.organization_id is null
        or ur.organization_id is not distinct from v_ovr.organization_id
      )
  ) into v_actor_is_quality;

  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p_actor_id
      and ur.is_active = true
      and ur.role = 'auditor'
      and (
        ur.organization_id is null
        or ur.organization_id is not distinct from v_ovr.organization_id
      )
  ) into v_actor_is_auditor;

  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p_actor_id
      and ur.is_active = true
      and ur.role = 'department_manager'
      and ur.organization_id is not distinct from v_ovr.organization_id
      and (
        ur.scope = 'global'
        or (
          ur.scope = 'department'
          and ur.department_id is not distinct from v_ovr.department_id
        )
      )
  ) into v_actor_is_manager;

  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p_actor_id
      and ur.is_active = true
      and ur.role = 'department_manager'
      and ur.organization_id is not distinct from v_ovr.organization_id
      and (
        ur.scope = 'global'
        or (
          ur.scope = 'department'
          and ur.department_id is not distinct from v_ovr.referred_department_id
        )
      )
  ) into v_actor_is_referred_manager;

  v_actor_is_reporter := v_ovr.reported_by = p_actor_id;
  v_actor_is_referred := v_ovr.referred_user_id = p_actor_id or v_actor_is_referred_manager;

  if v_actor_org is distinct from v_ovr.organization_id and not v_actor_is_quality then
    raise exception 'V98_OVR_CROSS_ORGANIZATION_DENIED';
  end if;

  if v_actor_is_auditor and not v_actor_is_quality then
    raise exception 'V98_OVR_AUDITOR_READ_ONLY';
  end if;

  if p_next_status = 'manager_review' then
    if v_ovr.status not in ('submitted', 'reopened') then
      raise exception 'V98_OVR_INVALID_TRANSITION: % -> manager_review', v_ovr.status;
    end if;
    if not (v_actor_is_manager or v_actor_is_quality) then
      raise exception 'V98_OVR_MANAGER_REVIEW_NOT_AUTHORIZED';
    end if;
    if coalesce(v_supervisor_investigation, nullif(trim(v_ovr.supervisor_investigation), '')) is null then
      raise exception 'V98_OVR_MANAGER_INVESTIGATION_REQUIRED';
    end if;

    update public.ovr_reports
    set status = 'manager_review',
        supervisor_id = p_actor_id,
        supervisor_investigation = coalesce(v_supervisor_investigation, supervisor_investigation),
        supervisor_action_taken = coalesce(v_corrective_action, supervisor_action_taken),
        manager_reviewed_at = now(),
        reviewed_at = now(),
        updated_by = p_actor_id,
        updated_at = now()
    where id = p_ovr_report_id;

    insert into public.notifications (organization_id, user_id, title, body, link_path)
    select
      v_ovr.organization_id,
      ur.user_id,
      'OVR Quality validation required',
      coalesce(v_ovr.ovr_number, 'OVR') || ' completed manager review and requires Quality validation.',
      '/ovr'
    from public.user_roles ur
    where ur.is_active = true
      and ur.role in ('super_admin', 'governance_admin', 'compliance_officer')
      and (
        ur.organization_id is null
        or ur.organization_id is not distinct from v_ovr.organization_id
      );

  elsif p_next_status = 'quality_validation' then
    if v_ovr.status <> 'manager_review' then
      raise exception 'V98_OVR_INVALID_TRANSITION: % -> quality_validation', v_ovr.status;
    end if;
    if not v_actor_is_quality then
      raise exception 'V98_OVR_QUALITY_VALIDATION_NOT_AUTHORIZED';
    end if;
    if v_quality_comments is null then
      raise exception 'V98_OVR_QUALITY_VALIDATION_NOTE_REQUIRED';
    end if;

    update public.ovr_reports
    set status = 'quality_validation',
        quality_reviewer_id = p_actor_id,
        quality_manager_id = p_actor_id,
        quality_manager_comments = v_quality_comments,
        quality_review_notes = v_quality_comments,
        occurrence_confirmed_by_quality = true,
        severity_level = coalesce(v_confirmed_severity, severity_level),
        final_severity_level = coalesce(v_confirmed_severity, final_severity_level),
        quality_validated_at = now(),
        reviewed_at = now(),
        quality_due_date = current_date + 2,
        updated_by = p_actor_id,
        updated_at = now()
    where id = p_ovr_report_id;

  elsif p_next_status = 'referred_party_response' then
    if v_ovr.status <> 'quality_validation' then
      raise exception 'V98_OVR_INVALID_TRANSITION: % -> referred_party_response', v_ovr.status;
    end if;
    if not v_actor_is_quality then
      raise exception 'V98_OVR_REFERRAL_NOT_AUTHORIZED';
    end if;
    if v_ovr.quality_validated_at is null then
      raise exception 'V98_OVR_QUALITY_VALIDATION_REQUIRED_BEFORE_REFERRAL';
    end if;
    if v_referred_department_id is null and v_referred_user_id is null then
      raise exception 'V98_OVR_REFERRAL_TARGET_REQUIRED';
    end if;
    if v_referred_department_id is not null and not exists (
      select 1
      from public.departments d
      where d.id = v_referred_department_id
        and d.organization_id = v_ovr.organization_id
        and d.is_active = true
    ) then
      raise exception 'V98_OVR_REFERRAL_DEPARTMENT_INVALID';
    end if;
    if v_referred_user_id is not null and not exists (
      select 1
      from public.profiles p
      where p.id = v_referred_user_id
        and p.organization_id = v_ovr.organization_id
        and p.is_active = true
        and (
          v_referred_department_id is null
          or p.department_id is not distinct from v_referred_department_id
        )
    ) then
      raise exception 'V98_OVR_REFERRAL_USER_INVALID';
    end if;

    update public.ovr_reports
    set status = 'referred_party_response',
        referred_department_id = v_referred_department_id,
        referred_user_id = v_referred_user_id,
        referred_to_department = (
          select d.name_en from public.departments d where d.id = v_referred_department_id
        ),
        referred_to_person = (
          select p.full_name_en from public.profiles p where p.id = v_referred_user_id
        ),
        referred_to_date = current_date,
        cross_department_notified_at = now(),
        updated_by = p_actor_id,
        updated_at = now()
    where id = p_ovr_report_id;

    insert into public.notifications (organization_id, user_id, title, body, link_path)
    select distinct
      v_ovr.organization_id,
      target.user_id,
      'OVR referral requires response',
      coalesce(v_ovr.ovr_number, 'OVR') || ' was validated by Quality and referred for a controlled response.',
      '/ovr'
    from (
      select v_referred_user_id as user_id
      where v_referred_user_id is not null
      union
      select ur.user_id
      from public.user_roles ur
      where ur.is_active = true
        and ur.role = 'department_manager'
        and ur.organization_id is not distinct from v_ovr.organization_id
        and ur.department_id is not distinct from v_referred_department_id
    ) target
    where target.user_id is not null;

  elsif p_next_status = 'quality_final_review' then
    if v_ovr.status = 'referred_party_response' and v_actor_is_referred then
      if coalesce(v_referred_response, v_corrective_action) is null then
        raise exception 'V98_OVR_REFERRED_RESPONSE_REQUIRED';
      end if;

      update public.ovr_reports
      set status = 'quality_final_review',
          referred_response = coalesce(v_referred_response, v_corrective_action),
          corrective_action = coalesce(v_corrective_action, corrective_action),
          referred_responded_at = now(),
          corrective_action_due_date = coalesce(v_corrective_due, corrective_action_due_date),
          updated_by = p_actor_id,
          updated_at = now()
      where id = p_ovr_report_id;

    elsif v_ovr.status in ('quality_validation', 'quality_final_review', 'reopened', 'escalated')
          and v_actor_is_quality then
      if v_final_verdict is null then
        raise exception 'V98_OVR_FINAL_VERDICT_REQUIRED';
      end if;
      if v_quality_comments is null
         and coalesce(nullif(trim(v_ovr.quality_manager_comments), ''), '') = '' then
        raise exception 'V98_OVR_FINAL_QUALITY_COMMENT_REQUIRED';
      end if;

      update public.ovr_reports
      set status = 'quality_final_review',
          quality_reviewer_id = p_actor_id,
          quality_manager_id = p_actor_id,
          quality_manager_comments = coalesce(v_quality_comments, quality_manager_comments),
          final_verdict = v_final_verdict,
          final_quality_classification = v_final_verdict,
          final_verdict_at = now(),
          quality_closed_by = p_actor_id,
          severity_level = coalesce(v_confirmed_severity, severity_level),
          final_severity_level = coalesce(v_confirmed_severity, final_severity_level, severity_level),
          corrective_action = coalesce(v_corrective_action, corrective_action),
          corrective_action_due_date = coalesce(v_corrective_due, corrective_action_due_date),
          closure_ready_at = now(),
          updated_by = p_actor_id,
          updated_at = now()
      where id = p_ovr_report_id;

      insert into public.notifications (organization_id, user_id, title, body, link_path)
      values (
        v_ovr.organization_id,
        v_ovr.reported_by,
        'OVR final verdict ready',
        coalesce(v_ovr.ovr_number, 'OVR') || ' has a final Quality verdict. Accept or dispute the outcome.',
        '/ovr'
      );
    else
      raise exception 'V98_OVR_FINAL_REVIEW_NOT_AUTHORIZED_OR_INVALID';
    end if;

  elsif p_next_status = 'disputed' then
    if v_ovr.status <> 'quality_final_review' or not v_actor_is_reporter then
      raise exception 'V98_OVR_DISPUTE_NOT_AUTHORIZED_OR_INVALID';
    end if;
    if coalesce(trim(v_ovr.final_verdict), '') = '' then
      raise exception 'V98_OVR_FINAL_VERDICT_REQUIRED_BEFORE_DISPUTE';
    end if;
    if v_note is null then
      raise exception 'V98_OVR_DISPUTE_REASON_REQUIRED';
    end if;

    update public.ovr_reports
    set status = 'disputed',
        reporter_response = 'disputed',
        reporter_response_at = now(),
        dispute_reason = v_note,
        updated_by = p_actor_id,
        updated_at = now()
    where id = p_ovr_report_id;

  elsif p_next_status = 'reopened' then
    if v_ovr.status <> 'disputed' or not v_actor_is_quality then
      raise exception 'V98_OVR_REOPEN_NOT_AUTHORIZED_OR_INVALID';
    end if;

    update public.ovr_reports
    set status = 'reopened',
        reopened_at = now(),
        final_verdict = null,
        final_verdict_at = null,
        reporter_response = null,
        reporter_response_at = null,
        closure_ready_at = null,
        quality_closed_by = null,
        quality_closed_at = null,
        updated_by = p_actor_id,
        updated_at = now()
    where id = p_ovr_report_id;

  elsif p_next_status = 'escalated' then
    if v_ovr.status in ('closed', 'cancelled', 'rejected') then
      raise exception 'V98_OVR_CANNOT_ESCALATE_FINAL_STATUS';
    end if;
    if not (v_actor_is_quality or v_actor_is_manager or v_actor_is_referred_manager) then
      raise exception 'V98_OVR_ESCALATION_NOT_AUTHORIZED';
    end if;
    if v_note is null then
      raise exception 'V98_OVR_ESCALATION_REASON_REQUIRED';
    end if;

    update public.ovr_reports
    set status = 'escalated',
        delay_reason = v_note,
        escalated_at = now(),
        executive_visible = true,
        updated_by = p_actor_id,
        updated_at = now()
    where id = p_ovr_report_id;

  elsif p_next_status = 'rejected' then
    if not v_actor_is_quality then
      raise exception 'V98_OVR_REJECTION_NOT_AUTHORIZED';
    end if;
    if v_note is null then
      raise exception 'V98_OVR_REJECTION_REASON_REQUIRED';
    end if;

    update public.ovr_reports
    set status = 'rejected',
        rejection_reason = v_note,
        updated_by = p_actor_id,
        updated_at = now()
    where id = p_ovr_report_id;

  elsif p_next_status = 'closed' then
    if v_ovr.status <> 'quality_final_review' or not v_actor_is_reporter then
      raise exception 'V98_OVR_REPORTER_ACCEPTANCE_REQUIRED';
    end if;
    if coalesce(trim(v_ovr.final_verdict), '') = '' or v_ovr.final_verdict_at is null then
      raise exception 'V98_OVR_FINAL_VERDICT_REQUIRED_BEFORE_CLOSURE';
    end if;
    if not public.can_close_ovr(p_ovr_report_id) then
      raise exception 'V98_OVR_ACCEPTED_EVIDENCE_OR_CLOSED_ACTION_REQUIRED';
    end if;

    update public.ovr_reports
    set status = 'closed',
        reporter_response = 'accepted',
        reporter_response_at = now(),
        closure_summary = coalesce(v_note, final_verdict),
        quality_closed_at = now(),
        closed_by = p_actor_id,
        closed_at = now(),
        updated_by = p_actor_id,
        updated_at = now()
    where id = p_ovr_report_id;

  else
    raise exception 'V98_OVR_UNSUPPORTED_STATUS: %', p_next_status;
  end if;

  insert into public.comments (
    organization_id,
    ovr_report_id,
    body,
    created_by
  )
  values (
    v_ovr.organization_id,
    p_ovr_report_id,
    concat(
      'OVR workflow changed from ',
      v_ovr.status::text,
      ' to ',
      p_next_status,
      case when v_note is not null then ': ' || v_note else '' end
    ),
    p_actor_id
  );

  return (
    select jsonb_build_object(
      'id', o.id,
      'status', o.status,
      'supervisor_due_date', o.supervisor_due_date,
      'quality_validated_at', o.quality_validated_at,
      'cross_department_notified_at', o.cross_department_notified_at,
      'final_verdict', o.final_verdict,
      'reporter_response', o.reporter_response,
      'closed_at', o.closed_at
    )
    from public.ovr_reports o
    where o.id = p_ovr_report_id
  );
end;
$$;

revoke all on function public.v98_update_ovr_workflow(uuid, uuid, text, jsonb)
from public, anon, authenticated;
grant execute on function public.v98_update_ovr_workflow(uuid, uuid, text, jsonb)
to service_role;

create or replace view public.v_ovr_workflow_queue as
select
  o.id,
  o.organization_id,
  o.ovr_number,
  left(o.brief_description, 160) as title,
  d.name_en as department_name,
  pr.full_name_en as owner_name,
  o.occurrence_date,
  o.status,
  o.severity_level,
  case
    when o.status in ('submitted', 'manager_review', 'under_supervisor_review') then 'manager_review'
    when o.status in ('quality_validation', 'under_quality_review') then 'quality_validation'
    when o.status = 'referred_party_response' then 'referred_party_response'
    when o.status in ('quality_final_review', 'evidence_submitted', 'quality_closure_review') then 'quality_final_review'
    when o.status in ('disputed', 'reopened') then 'dispute_resolution'
    when o.status in ('escalated', 'major_escalation') then 'escalation'
    else o.status::text
  end as workflow_stage,
  case
    when o.status in ('submitted', 'manager_review', 'under_supervisor_review')
      then coalesce(o.supervisor_due_date, o.occurrence_date + 1)
    when o.status in ('quality_validation', 'under_quality_review')
      then coalesce(o.quality_due_date, o.occurrence_date + 3)
    when o.status = 'referred_party_response'
      then coalesce(o.corrective_action_due_date, current_date + 2)
    when o.status in ('quality_final_review', 'evidence_submitted', 'quality_closure_review')
      then coalesce(o.quality_due_date, o.occurrence_date + 5)
    else null::date
  end as due_date,
  case
    when o.status in ('submitted', 'manager_review', 'under_supervisor_review')
      then coalesce(o.supervisor_due_date, o.occurrence_date + 1) < current_date
    when o.status in ('quality_validation', 'under_quality_review')
      then coalesce(o.quality_due_date, o.occurrence_date + 3) < current_date
    when o.status = 'referred_party_response'
      then coalesce(o.corrective_action_due_date, current_date + 2) < current_date
    when o.status in ('quality_final_review', 'evidence_submitted', 'quality_closure_review')
      then coalesce(o.quality_due_date, o.occurrence_date + 5) < current_date
    else false
  end as is_overdue,
  case
    when o.severity_level in ('level_4', 'sentinel') then 'critical'::public.risk_level
    when o.status in ('disputed', 'reopened', 'escalated', 'rejected') then 'high'::public.risk_level
    when o.status in ('referred_party_response', 'quality_final_review') then 'high'::public.risk_level
    else 'medium'::public.risk_level
  end as risk_level
from public.ovr_reports o
left join public.departments d on d.id = o.department_id
left join public.profiles pr on pr.id = o.owner_id
where o.status not in ('draft', 'closed', 'cancelled', 'rejected')
order by is_overdue desc, due_date asc nulls last;

alter view public.v_ovr_workflow_queue set (security_invoker = true);

create or replace view public.v_ovr_workflow_control_summary as
select
  o.organization_id,
  count(*) filter (where o.status in ('submitted', 'manager_review', 'under_supervisor_review')) as pending_supervisor_review,
  count(*) filter (where o.status in ('quality_validation', 'under_quality_review')) as pending_quality_review,
  count(*) filter (where o.status in ('returned_for_clarification', 'disputed', 'reopened')) as returned_for_clarification,
  count(*) filter (where o.status in ('referred_party_response', 'quality_final_review', 'evidence_submitted', 'quality_closure_review')) as pending_evidence_review,
  count(*) filter (
    where o.status not in ('closed', 'cancelled', 'rejected')
      and o.severity_level in ('level_4', 'sentinel')
  ) as major_open_ovrs,
  count(*) filter (where q.is_overdue = true) as overdue_ovr_workflow_items
from public.ovr_reports o
left join public.v_ovr_workflow_queue q on q.id = o.id
group by o.organization_id;

alter view public.v_ovr_workflow_control_summary set (security_invoker = true);

grant select on public.v_ovr_workflow_queue to authenticated;
grant select on public.v_ovr_workflow_control_summary to authenticated;

commit;
