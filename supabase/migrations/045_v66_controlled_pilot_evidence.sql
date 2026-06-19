-- v6.6 Controlled Pilot Evidence Pack
-- Purpose: store controlled pilot proof/evidence metadata in staging without opening broad public access.

create table if not exists public.controlled_pilot_runs (
  id uuid primary key default gen_random_uuid(),
  pilot_name text not null,
  environment text not null default 'staging',
  planned_user_count integer not null default 0,
  status text not null default 'planned',
  start_date date,
  end_date date,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.controlled_pilot_evidence_items (
  id uuid primary key default gen_random_uuid(),
  pilot_run_id uuid references public.controlled_pilot_runs(id) on delete cascade,
  evidence_code text not null,
  evidence_title text not null,
  evidence_status text not null default 'manual_required',
  evidence_location text,
  evidence_notes text,
  verified_by uuid,
  verified_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pilot_run_id, evidence_code)
);

create table if not exists public.controlled_pilot_issues (
  id uuid primary key default gen_random_uuid(),
  pilot_run_id uuid references public.controlled_pilot_runs(id) on delete cascade,
  issue_code text,
  module text,
  severity text not null default 'medium',
  description text not null,
  owner_name text,
  target_date date,
  status text not null default 'open',
  resolution text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.controlled_pilot_signoffs (
  id uuid primary key default gen_random_uuid(),
  pilot_run_id uuid references public.controlled_pilot_runs(id) on delete cascade,
  signoff_role text not null,
  signer_name text,
  decision text not null default 'pending',
  signed_at timestamptz,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pilot_run_id, signoff_role)
);

alter table public.controlled_pilot_runs enable row level security;
alter table public.controlled_pilot_evidence_items enable row level security;
alter table public.controlled_pilot_issues enable row level security;
alter table public.controlled_pilot_signoffs enable row level security;

create policy controlled_pilot_runs_select_authenticated on public.controlled_pilot_runs
  for select to authenticated using (true);
create policy controlled_pilot_runs_insert_authenticated on public.controlled_pilot_runs
  for insert to authenticated with check (auth.uid() is not null);
create policy controlled_pilot_runs_update_creator on public.controlled_pilot_runs
  for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());

create policy controlled_pilot_evidence_select_authenticated on public.controlled_pilot_evidence_items
  for select to authenticated using (true);
create policy controlled_pilot_evidence_insert_authenticated on public.controlled_pilot_evidence_items
  for insert to authenticated with check (auth.uid() is not null);
create policy controlled_pilot_evidence_update_creator_or_verifier on public.controlled_pilot_evidence_items
  for update to authenticated using (created_by = auth.uid() or verified_by = auth.uid()) with check (created_by = auth.uid() or verified_by = auth.uid());

create policy controlled_pilot_issues_select_authenticated on public.controlled_pilot_issues
  for select to authenticated using (true);
create policy controlled_pilot_issues_insert_authenticated on public.controlled_pilot_issues
  for insert to authenticated with check (auth.uid() is not null);
create policy controlled_pilot_issues_update_creator on public.controlled_pilot_issues
  for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());

create policy controlled_pilot_signoffs_select_authenticated on public.controlled_pilot_signoffs
  for select to authenticated using (true);
create policy controlled_pilot_signoffs_insert_authenticated on public.controlled_pilot_signoffs
  for insert to authenticated with check (auth.uid() is not null);
create policy controlled_pilot_signoffs_update_creator on public.controlled_pilot_signoffs
  for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());

insert into public.controlled_pilot_runs (pilot_name, environment, planned_user_count, status)
values ('v6.6 controlled pilot readiness', 'staging', 15, 'planned')
on conflict do nothing;
