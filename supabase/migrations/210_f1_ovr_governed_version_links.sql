-- GRC v1.4-F1: durable OVR links to exact governed Policy/SOP versions.

-- Fail closed if an environment already contains noncanonical OVR links. This
-- migration never rewrites historical relationship data.
do $$
begin
  if exists (
    select 1
    from public.document_links l
    left join public.ovr_reports o on o.id = l.linked_item_id
    left join public.document_versions v on v.id = l.version_id
    left join public.controlled_documents d on d.id = l.document_id
    where l.linked_item_type = 'ovr'
      and (
        l.link_type is distinct from 'governed_version'
        or l.linked_item_id is null
        or l.version_id is null
        or o.id is null
        or v.id is null
        or d.id is null
        or v.document_id is distinct from l.document_id
        or o.organization_id is distinct from d.organization_id
        or d.document_type not in ('policy', 'sop')
        or v.approved_at is null
        or v.locked_at is null
      )
  ) then
    raise exception 'F1_EXISTING_OVR_LINK_DRIFT_DETECTED';
  end if;
end;
$$;

alter table public.document_links
  drop constraint if exists document_links_f1_ovr_shape_check;
alter table public.document_links
  add constraint document_links_f1_ovr_shape_check check (
    linked_item_type <> 'ovr'
    or (
      link_type = 'governed_version'
      and linked_item_id is not null
      and version_id is not null
      and document_id is not null
    )
  );

create unique index if not exists document_links_f1_ovr_exact_version_uniq
  on public.document_links (linked_item_id, version_id)
  where linked_item_type = 'ovr' and link_type = 'governed_version';

create or replace function public.validate_f1_ovr_governed_version_link()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_ovr_organization_id uuid;
  v_version_document_id uuid;
  v_approved_at timestamptz;
  v_locked_at timestamptz;
  v_document_organization_id uuid;
  v_document_type text;
begin
  if new.linked_item_type <> 'ovr' then
    return new;
  end if;

  if new.link_type is distinct from 'governed_version'
     or new.linked_item_id is null
     or new.version_id is null
     or new.document_id is null then
    raise exception 'F1_CANONICAL_LINK_SHAPE_REQUIRED';
  end if;

  select o.organization_id
    into v_ovr_organization_id
  from public.ovr_reports o
  where o.id = new.linked_item_id;
  if not found then
    raise exception 'F1_OVR_NOT_FOUND';
  end if;

  select v.document_id, v.approved_at, v.locked_at
    into v_version_document_id, v_approved_at, v_locked_at
  from public.document_versions v
  where v.id = new.version_id;
  if not found then
    raise exception 'F1_DOCUMENT_VERSION_NOT_FOUND';
  end if;

  select d.organization_id, d.document_type
    into v_document_organization_id, v_document_type
  from public.controlled_documents d
  where d.id = new.document_id;
  if not found then
    raise exception 'F1_DOCUMENT_NOT_FOUND';
  end if;

  if v_version_document_id is distinct from new.document_id then
    raise exception 'F1_DOCUMENT_VERSION_MISMATCH';
  end if;
  if v_ovr_organization_id is distinct from v_document_organization_id then
    raise exception 'F1_CROSS_ORGANIZATION_LINK_DENIED';
  end if;
  if v_document_type not in ('policy', 'sop') then
    raise exception 'F1_POLICY_OR_SOP_REQUIRED';
  end if;
  if v_approved_at is null then
    raise exception 'F1_APPROVED_VERSION_REQUIRED';
  end if;
  if v_locked_at is null then
    raise exception 'F1_IMMUTABLE_VERSION_REQUIRED';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_f1_ovr_governed_version_link on public.document_links;
create trigger trg_validate_f1_ovr_governed_version_link
before insert or update of document_id, version_id, linked_item_type, linked_item_id, link_type
on public.document_links
for each row
execute function public.validate_f1_ovr_governed_version_link();

-- Keep legacy non-OVR browser writes unchanged while making every OVR row,
-- including alternate/null link_type bypass attempts, service-path only.
drop policy if exists document_links_f1_ovr_insert_guard on public.document_links;
create policy document_links_f1_ovr_insert_guard on public.document_links
as restrictive for insert to authenticated
with check (linked_item_type <> 'ovr');

drop policy if exists document_links_f1_ovr_update_guard on public.document_links;
create policy document_links_f1_ovr_update_guard on public.document_links
as restrictive for update to authenticated
using (linked_item_type <> 'ovr')
with check (linked_item_type <> 'ovr');

drop policy if exists document_links_f1_ovr_delete_guard on public.document_links;
create policy document_links_f1_ovr_delete_guard on public.document_links
as restrictive for delete to authenticated
using (linked_item_type <> 'ovr');

drop policy if exists document_links_f1_ovr_select_guard on public.document_links;
create policy document_links_f1_ovr_select_guard on public.document_links
as restrictive for select to authenticated
using (
  linked_item_type <> 'ovr'
  or exists (
    select 1
    from public.ovr_reports o
    where o.id = document_links.linked_item_id
  )
);

create or replace view public.v_f1_ovr_governed_version_links
with (security_invoker = true)
as
select
  l.id as link_id,
  l.linked_item_id as ovr_id,
  o.organization_id,
  l.document_id,
  d.document_type,
  d.document_code,
  d.document_title,
  l.version_id,
  v.version_number,
  v.version_label,
  v.approved_at,
  v.approved_by,
  v.effective_date,
  v.expiry_date,
  v.locked_at,
  v.is_current_version,
  v.superseded_by_version_id,
  l.created_by,
  l.created_at,
  (not coalesce(v.is_current_version, false) or v.superseded_by_version_id is not null) as is_historical_version
from public.document_links l
join public.ovr_reports o on o.id = l.linked_item_id
join public.controlled_documents d on d.id = l.document_id
join public.document_versions v on v.id = l.version_id and v.document_id = l.document_id
where l.linked_item_type = 'ovr'
  and l.link_type = 'governed_version';

create or replace view public.v_f1_linkable_governed_document_versions
with (security_invoker = true)
as
select
  d.organization_id,
  d.id as document_id,
  d.document_type,
  d.document_code,
  d.document_title,
  v.id as version_id,
  v.version_number,
  v.version_label,
  v.approved_at,
  v.approved_by,
  v.effective_date,
  v.expiry_date,
  v.locked_at,
  v.is_current_version,
  v.superseded_by_version_id,
  (not coalesce(v.is_current_version, false) or v.superseded_by_version_id is not null) as is_historical_version
from public.controlled_documents d
join public.document_versions v on v.document_id = d.id
where d.document_type in ('policy', 'sop')
  and v.approved_at is not null
  and v.locked_at is not null;

revoke all on public.v_f1_ovr_governed_version_links from public, anon;
revoke all on public.v_f1_linkable_governed_document_versions from public, anon;
-- Security-invoker views require caller-level SELECT on their base relations.
-- Existing RLS (including Patch83U and the F1 OVR visibility guard) remains in force.
grant select on public.document_links to authenticated, service_role;
grant select on public.controlled_documents to authenticated, service_role;
grant select on public.document_versions to authenticated, service_role;
grant select on public.v_f1_ovr_governed_version_links to authenticated, service_role;
grant select on public.v_f1_linkable_governed_document_versions to authenticated, service_role;

-- Extend the existing governed-document event vocabulary without deleting any
-- historical event rows.
alter table public.document_review_events
  drop constraint if exists document_review_events_event_type_check;
alter table public.document_review_events
  add constraint document_review_events_event_type_check check (
    event_type in (
      'created','submitted_for_review','review_started','review_accepted','review_rejected',
      'submitted_for_approval','approved','rejected','activated','revision_started',
      'superseded','retired','expired','reopened','cancelled','linked','acknowledged',
      'rollout_decided','obligations_published',
      'ovr_governed_version_linked','ovr_governed_version_link_removed'
    )
  );

create or replace function public.f1_require_exact_governance_authority(
  p_actor_id uuid,
  p_organization_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor public.profiles%rowtype;
begin
  select * into v_actor
  from public.profiles
  where id = p_actor_id;

  if not found or not coalesce(v_actor.is_active, false)
     or v_actor.user_status::text <> 'active' then
    raise exception 'F1_ACTIVE_ACTOR_REQUIRED';
  end if;
  if v_actor.organization_id is null
     or v_actor.organization_id is distinct from p_organization_id then
    raise exception 'F1_ACTOR_ORGANIZATION_DENIED';
  end if;
  if not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p_actor_id
      and ur.is_active = true
      and ur.role::text in ('super_admin', 'governance_admin', 'compliance_officer')
      and ur.scope::text = 'global'
      and ur.organization_id = p_organization_id
  ) then
    raise exception 'F1_EXACT_GLOBAL_GOVERNANCE_ROLE_REQUIRED';
  end if;
end;
$$;

create or replace function public.link_ovr_governed_document_version(
  p_actor_id uuid,
  p_ovr_id uuid,
  p_version_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ovr_organization_id uuid;
  v_document_id uuid;
  v_document_organization_id uuid;
  v_document_type text;
  v_approved_at timestamptz;
  v_locked_at timestamptz;
  v_link_id uuid;
  v_created boolean := false;
  v_note text := nullif(btrim(p_note), '');
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then
    raise exception 'F1_SERVICE_ROLE_REQUIRED';
  end if;
  if v_note is not null and char_length(v_note) > 1000 then
    raise exception 'F1_NOTE_TOO_LONG';
  end if;

  select o.organization_id into v_ovr_organization_id
  from public.ovr_reports o
  where o.id = p_ovr_id
  for share;
  if not found then raise exception 'F1_OVR_NOT_FOUND'; end if;

  select v.document_id, d.organization_id, d.document_type, v.approved_at, v.locked_at
    into v_document_id, v_document_organization_id, v_document_type, v_approved_at, v_locked_at
  from public.document_versions v
  join public.controlled_documents d on d.id = v.document_id
  where v.id = p_version_id
  for share of v, d;
  if not found then raise exception 'F1_DOCUMENT_VERSION_NOT_FOUND'; end if;
  if v_document_organization_id is distinct from v_ovr_organization_id then
    raise exception 'F1_CROSS_ORGANIZATION_LINK_DENIED';
  end if;
  if v_document_type not in ('policy', 'sop') then
    raise exception 'F1_POLICY_OR_SOP_REQUIRED';
  end if;
  if v_approved_at is null then raise exception 'F1_APPROVED_VERSION_REQUIRED'; end if;
  if v_locked_at is null then raise exception 'F1_IMMUTABLE_VERSION_REQUIRED'; end if;

  perform public.f1_require_exact_governance_authority(p_actor_id, v_ovr_organization_id);

  insert into public.document_links (
    document_id, version_id, linked_item_type, linked_item_id,
    link_type, required_flag, created_by
  ) values (
    v_document_id, p_version_id, 'ovr', p_ovr_id,
    'governed_version', false, p_actor_id
  )
  on conflict (linked_item_id, version_id)
    where linked_item_type = 'ovr' and link_type = 'governed_version'
  do nothing
  returning id into v_link_id;

  if v_link_id is null then
    select l.id into v_link_id
    from public.document_links l
    where l.linked_item_type = 'ovr'
      and l.link_type = 'governed_version'
      and l.linked_item_id = p_ovr_id
      and l.version_id = p_version_id;
  else
    v_created := true;
    perform public.patch26_write_document_event(
      v_document_id,
      p_version_id,
      'ovr_governed_version_linked',
      null,
      'linked',
      p_actor_id,
      jsonb_build_object(
        'ovr_id', p_ovr_id,
        'link_id', v_link_id,
        'document_id', v_document_id,
        'version_id', p_version_id,
        'context', v_note
      )::text,
      null
    );
  end if;

  return jsonb_build_object(
    'link_id', v_link_id,
    'ovr_id', p_ovr_id,
    'document_id', v_document_id,
    'version_id', p_version_id,
    'created', v_created
  );
end;
$$;

create or replace function public.unlink_ovr_governed_document_version(
  p_actor_id uuid,
  p_link_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_reason text := btrim(coalesce(p_reason, ''));
  v_ovr_id uuid;
  v_ovr_organization_id uuid;
  v_document_id uuid;
  v_version_id uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then
    raise exception 'F1_SERVICE_ROLE_REQUIRED';
  end if;
  if char_length(v_reason) < 3 or char_length(v_reason) > 1000 then
    raise exception 'F1_UNLINK_REASON_LENGTH_REQUIRED';
  end if;

  select l.linked_item_id, o.organization_id, l.document_id, l.version_id
    into v_ovr_id, v_ovr_organization_id, v_document_id, v_version_id
  from public.document_links l
  join public.ovr_reports o on o.id = l.linked_item_id
  where l.id = p_link_id
    and l.linked_item_type = 'ovr'
    and l.link_type = 'governed_version'
    and l.version_id is not null
  for update of l;
  if not found then raise exception 'F1_CANONICAL_LINK_NOT_FOUND'; end if;

  perform public.f1_require_exact_governance_authority(p_actor_id, v_ovr_organization_id);

  perform public.patch26_write_document_event(
    v_document_id,
    v_version_id,
    'ovr_governed_version_link_removed',
    'linked',
    'removed',
    p_actor_id,
    jsonb_build_object(
      'ovr_id', v_ovr_id,
      'link_id', p_link_id,
      'document_id', v_document_id,
      'version_id', v_version_id,
      'reason', v_reason
    )::text,
    v_reason
  );

  delete from public.document_links where id = p_link_id;

  return jsonb_build_object(
    'link_id', p_link_id,
    'ovr_id', v_ovr_id,
    'document_id', v_document_id,
    'version_id', v_version_id,
    'removed', true
  );
end;
$$;

create or replace function public.get_f1_ovr_governed_version_link_capabilities()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'contract_version', 'f1-ovr-governed-version-links-v1',
    'schema_version', 210,
    'link_available', true,
    'unlink_available', true
  );
$$;

revoke all on function public.validate_f1_ovr_governed_version_link() from public, anon, authenticated, service_role;
revoke all on function public.f1_require_exact_governance_authority(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.link_ovr_governed_document_version(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.unlink_ovr_governed_document_version(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.get_f1_ovr_governed_version_link_capabilities() from public, anon, authenticated;
grant execute on function public.link_ovr_governed_document_version(uuid, uuid, uuid, text) to service_role;
grant execute on function public.unlink_ovr_governed_document_version(uuid, uuid, text) to service_role;
grant execute on function public.get_f1_ovr_governed_version_link_capabilities() to service_role;

comment on view public.v_f1_ovr_governed_version_links is
  'F1 security-invoker OVR read model preserving the persisted exact governed Policy/SOP version.';
comment on function public.link_ovr_governed_document_version(uuid, uuid, uuid, text) is
  'F1 service-only exact-version link mutation with exact-org global governance authority and idempotent audit.';
comment on function public.unlink_ovr_governed_document_version(uuid, uuid, text) is
  'F1 service-only correction path that records immutable governance audit before removing the live relationship.';
