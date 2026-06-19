-- =========================================================
-- GRC Control Center - Migration 041
-- v6.3 Auth and route-protection readiness controls
-- =========================================================

create table if not exists public.auth_route_protection_controls (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  required_status text not null default 'required',
  evidence_status text not null default 'unverified',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.seed_v63_auth_route_protection_defaults()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.auth_route_protection_controls(code, title, required_status, evidence_status, notes)
  values
    ('AUTH_LOGIN_REQUIRED', 'Anonymous users cannot enter the application shell', 'required', 'unverified', 'Validate with a signed-out browser session.'),
    ('AUTH_INACTIVE_BLOCKED', 'Inactive profiles are blocked before navigation', 'required', 'unverified', 'Validate with a disabled profile.'),
    ('AUTH_ROLE_NAVIGATION', 'Navigation is filtered by active role assignment', 'required', 'unverified', 'Validate with employee, manager, auditor and admin personas.'),
    ('AUTH_ADMIN_HIDDEN', 'Admin/release/security pages are hidden from non-admin users', 'required', 'unverified', 'Validate with employee and department manager personas.'),
    ('AUTH_NO_PROD_BYPASS', 'Development bypass cannot run in production mode', 'required', 'unverified', 'Confirm VITE_AUTH_BYPASS_LOCAL is not set in production.')
  on conflict (code) do update set
    title = excluded.title,
    required_status = excluded.required_status,
    notes = excluded.notes,
    updated_at = now();
end;
$$;

create or replace view public.v_v63_auth_route_protection_scorecard as
select
  count(*)::int as total_controls,
  count(*) filter (where evidence_status = 'verified')::int as verified_controls,
  count(*) filter (where evidence_status = 'unverified')::int as unverified_controls,
  case
    when count(*) = 0 then 0
    else round((count(*) filter (where evidence_status = 'verified')::numeric / count(*)::numeric) * 100, 1)
  end as verified_percent
from public.auth_route_protection_controls;
