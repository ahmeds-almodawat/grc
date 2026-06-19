-- =========================================================
-- GRC Control Center - OVR workflow prerequisites
--
-- The original workflow migration was assigned version 036 during a
-- filename cleanup. Migration 017 already depends on these columns, so
-- create the prerequisite schema here without changing existing migration
-- history. Migration 036 remains idempotent and installs the full workflow
-- functions and views later.
-- =========================================================

alter table public.ovr_reports
add column if not exists supervisor_due_date date;

alter table public.ovr_reports
add column if not exists quality_due_date date;

alter table public.ovr_reports
add column if not exists corrective_action_due_date date;

alter table public.ovr_reports
add column if not exists quality_closure_note text;

alter table public.ovr_reports
add column if not exists final_classification text;

alter table public.ovr_reports
add column if not exists final_severity_level public.ovr_severity_level;

create index if not exists idx_ovr_reports_supervisor_due
on public.ovr_reports(supervisor_due_date);

create index if not exists idx_ovr_reports_quality_due
on public.ovr_reports(quality_due_date);

create index if not exists idx_ovr_reports_corrective_due
on public.ovr_reports(corrective_action_due_date);

-- Compatibility helpers used by migrations 017 and 020. Earlier migrations
-- provide has_any_role(), but these later policies call has_role() directly.
create or replace function public.has_role(required_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = required_role
      and ur.is_active = true
  );
$$;

create or replace function public.has_role(
  target_user_id uuid,
  required_role public.app_role
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = target_user_id
      and ur.role = required_role
      and ur.is_active = true
  );
$$;

-- Later release migrations use this name for organization-scoped RLS checks,
-- while the foundation migration exposes the equivalent can_access_org helper.
create or replace function public.can_read_organization(target_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_access_org(target_org_id);
$$;
