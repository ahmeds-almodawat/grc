-- v9.10 Final UAT Readiness
-- Purpose: extend the existing controlled-pilot issue log with structured manual UAT fields.
-- Safety: keeps existing RLS policies on public.controlled_pilot_issues; no service-role/browser exposure.

alter table public.controlled_pilot_issues
  add column if not exists title text,
  add column if not exists role_account_used text,
  add column if not exists steps_to_reproduce text,
  add column if not exists expected_result text,
  add column if not exists actual_result text,
  add column if not exists screenshot_note text;

update public.controlled_pilot_issues
set title = coalesce(title, issue_code, left(description, 120), 'Controlled pilot UAT issue')
where title is null;

alter table public.controlled_pilot_issues
  alter column title set default 'Controlled pilot UAT issue',
  alter column title set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'controlled_pilot_issues_v910_severity_check'
      and conrelid = 'public.controlled_pilot_issues'::regclass
  ) then
    alter table public.controlled_pilot_issues
      add constraint controlled_pilot_issues_v910_severity_check
      check (severity in ('low', 'medium', 'high', 'blocker', 'critical'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'controlled_pilot_issues_v910_status_check'
      and conrelid = 'public.controlled_pilot_issues'::regclass
  ) then
    alter table public.controlled_pilot_issues
      add constraint controlled_pilot_issues_v910_status_check
      check (status in ('open', 'reviewing', 'fixed', 'deferred', 'triaged', 'in_progress', 'blocked', 'resolved', 'accepted_risk', 'closed'));
  end if;
end $$;

create index if not exists idx_controlled_pilot_issues_v910_status
  on public.controlled_pilot_issues(status, severity, created_at desc);

grant select, insert, update on public.controlled_pilot_issues to authenticated;
