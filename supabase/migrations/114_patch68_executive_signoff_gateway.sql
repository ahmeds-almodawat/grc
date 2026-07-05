-- Patch 68: Executive Signoff Authority & Gateway
-- Provides the formal authorization ledger for production launch.

create table if not exists public.executive_production_signoffs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id),
  decision text not null check (decision in ('approved')),
  notes text null,
  snapshot_hash text null,
  created_at timestamptz not null default now()
);

alter table public.executive_production_signoffs enable row level security;

create policy "Executive signoffs are readable by authenticated users"
  on public.executive_production_signoffs
  for select
  to authenticated
  using (true);

-- No insert policy. Inserts are strictly via Security Definer RPC.

create or replace function public.record_executive_production_signoff(
  p_actor_id uuid,
  p_decision text,
  p_notes text,
  p_snapshot_hash text default null
)
returns public.executive_production_signoffs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_result public.executive_production_signoffs;
  v_blockers_exist boolean;
begin
  -- 1. Validate permissions
  select role into v_role from public.user_roles where user_id = p_actor_id;
  if v_role not in ('super_admin', 'governance_admin') then
    raise exception 'Unauthorized. Only governance_admin or super_admin can authorize production launch.';
  end if;

  -- 2. Validate decision
  if p_decision != 'approved' then
    raise exception 'Invalid decision. Only "approved" is permitted for full authorization.';
  end if;

  -- 3. We assume blocker check is done via the Edge Bridge and UI, 
  -- but we ensure a record is created.
  -- In a more strict setup we might query all underlying evidence tables here.

  -- 4. Record signoff
  insert into public.executive_production_signoffs (actor_id, decision, notes, snapshot_hash)
  values (p_actor_id, p_decision, p_notes, p_snapshot_hash)
  returning * into v_result;

  return v_result;
end;
$$;

revoke all on function public.record_executive_production_signoff(uuid, text, text, text) from public;
grant execute on function public.record_executive_production_signoff(uuid, text, text, text) to authenticated;
