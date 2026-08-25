-- P3 staging certification: reconcile the shared v100 / Patch 28 CAPA action-item contract.

alter type public.work_status add value if not exists 'open';
alter type public.work_status add value if not exists 'assigned';
alter type public.work_status add value if not exists 'blocked';
alter type public.work_status add value if not exists 'evidence_required';
alter type public.work_status add value if not exists 'completed';
alter type public.work_status add value if not exists 'overdue';

alter table public.capa_action_items
  alter column capa_case_id drop not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.capa_action_items'::regclass
      and conname = 'capa_action_items_capa_id_fkey'
  ) then
    alter table public.capa_action_items
      add constraint capa_action_items_capa_id_fkey
      foreign key (capa_id) references public.capa_action_plans(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.capa_action_items'::regclass
      and conname = 'capa_action_items_action_owner_id_fkey'
  ) then
    alter table public.capa_action_items
      add constraint capa_action_items_action_owner_id_fkey
      foreign key (action_owner_id) references public.profiles(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.capa_action_items'::regclass
      and conname = 'capa_action_items_department_id_fkey'
  ) then
    alter table public.capa_action_items
      add constraint capa_action_items_department_id_fkey
      foreign key (department_id) references public.departments(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.capa_action_items'::regclass
      and conname = 'capa_action_items_exactly_one_parent_check'
  ) then
    alter table public.capa_action_items
      add constraint capa_action_items_exactly_one_parent_check
      check (num_nonnulls(capa_case_id, capa_id) = 1) not valid;
    alter table public.capa_action_items
      validate constraint capa_action_items_exactly_one_parent_check;
  end if;
end;
$$;

create or replace function public.create_capa_action_item(
  p_capa_id uuid,
  p_action_item_title text,
  p_actor_id uuid,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_capa public.capa_action_plans%rowtype;
  v_item_id uuid;
begin
  if auth.role() is distinct from 'service_role' and current_user <> 'service_role' then
    raise exception 'PATCH28_CAPA_SERVICE_ROLE_REQUIRED';
  end if;

  select * into v_capa
  from public.capa_action_plans
  where id = p_capa_id;
  if not found then raise exception 'PATCH28_CAPA_NOT_FOUND'; end if;
  if length(btrim(coalesce(p_action_item_title, ''))) < 3 then
    raise exception 'PATCH28_ACTION_ITEM_TITLE_REQUIRED';
  end if;

  insert into public.capa_action_items (
    organization_id,
    capa_case_id,
    capa_id,
    action_type,
    title,
    action_item_code,
    action_item_title,
    description,
    action_item_description,
    owner_id,
    action_owner_id,
    department_id,
    priority_level,
    due_date,
    status,
    evidence_required,
    created_by,
    updated_by
  ) values (
    v_capa.organization_id,
    null,
    v_capa.id,
    'corrective'::public.v100_capa_action_type,
    btrim(p_action_item_title),
    nullif(p_payload->>'action_item_code', ''),
    btrim(p_action_item_title),
    nullif(p_payload->>'action_item_description', ''),
    nullif(p_payload->>'action_item_description', ''),
    nullif(p_payload->>'action_owner_id', '')::uuid,
    nullif(p_payload->>'action_owner_id', '')::uuid,
    nullif(p_payload->>'department_id', '')::uuid,
    nullif(p_payload->>'priority_level', ''),
    nullif(p_payload->>'due_date', '')::date,
    ('open'::text)::public.work_status,
    coalesce(nullif(p_payload->>'evidence_required', '')::boolean, false),
    p_actor_id,
    p_actor_id
  ) returning id into v_item_id;

  update public.capa_action_plans
  set action_item_count = action_item_count + 1,
      updated_by = p_actor_id,
      updated_at = now()
  where id = v_capa.id;

  perform public.patch28_write_capa_event(
    v_capa.id,
    v_item_id,
    'action_item_created',
    null,
    'open',
    p_actor_id,
    p_action_item_title,
    null
  );
  return v_item_id;
end;
$$;

create or replace function public.update_capa_action_item_status(
  p_action_item_id uuid,
  p_status text,
  p_actor_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_capa_id uuid;
  v_old text;
begin
  if auth.role() is distinct from 'service_role' and current_user <> 'service_role' then
    raise exception 'PATCH28_CAPA_SERVICE_ROLE_REQUIRED';
  end if;
  if p_status not in (
    'open', 'assigned', 'in_progress', 'blocked', 'evidence_required',
    'completed', 'rejected', 'overdue', 'cancelled'
  ) then
    raise exception 'PATCH28_ACTION_ITEM_STATUS_INVALID';
  end if;

  select capa_id, status::text into v_capa_id, v_old
  from public.capa_action_items
  where id = p_action_item_id
  for update;
  if not found or v_capa_id is null then raise exception 'PATCH28_ACTION_ITEM_NOT_FOUND'; end if;

  update public.capa_action_items
  set status = p_status::public.work_status,
      progress_percent = case when p_status = 'completed' then 100 else progress_percent end,
      completed_at = case when p_status = 'completed' then now() else completed_at end,
      completed_by = case when p_status = 'completed' then p_actor_id else completed_by end,
      completion_note = coalesce(p_note, completion_note),
      updated_by = p_actor_id,
      updated_at = now()
  where id = p_action_item_id;

  update public.capa_action_plans
  set completed_action_item_count = (
        select count(*) from public.capa_action_items
        where capa_id = v_capa_id and status::text = 'completed'
      ),
      updated_by = p_actor_id,
      updated_at = now()
  where id = v_capa_id;

  perform public.patch28_write_capa_event(
    v_capa_id,
    p_action_item_id,
    'action_item_updated',
    v_old,
    p_status,
    p_actor_id,
    p_note,
    null
  );
  return jsonb_build_object('status', 'ok', 'action_item_id', p_action_item_id, 'item_status', p_status);
end;
$$;

revoke all on function public.create_capa_action_item(uuid, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.create_capa_action_item(uuid, text, uuid, jsonb) to service_role;
revoke all on function public.update_capa_action_item_status(uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.update_capa_action_item_status(uuid, text, uuid, text) to service_role;

comment on function public.create_capa_action_item(uuid, text, uuid, jsonb) is
  'P3 reconciliation: creates Patch 28 action items in the shared v100/Patch 28 table with exact tenant and parent provenance.';
