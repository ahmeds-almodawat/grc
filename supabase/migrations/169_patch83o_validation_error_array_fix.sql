-- Patch 83O.2: correct validation-array appends without changing the import contract.
-- Migrations 167 and 168 remain historical; this migration replaces only the RPC body.

create or replace function public.apply_department_import_batch(
  p_actor_id uuid,
  p_organization_id uuid,
  p_source_filename text,
  p_import_mode text,
  p_rows jsonb
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_has_access boolean := false;
  v_mode public.department_import_mode;
  v_row jsonb;
  v_row_index integer;
  v_row_number integer;
  v_code text;
  v_name_en text;
  v_name_ar text;
  v_department_type text;
  v_status text;
  v_manager_email text;
  v_division_code text;
  v_division_id uuid;
  v_manager_id uuid;
  v_manager_ids uuid[];
  v_manager_org_id uuid;
  v_manager_status text;
  v_manager_is_active boolean;
  v_existing_department_id uuid;
  v_existing_department_ids uuid[];
  v_department_created boolean;
  v_manager_role_id uuid;
  v_manager_role_changed boolean;
  v_total_rows integer := 0;
  v_created_count integer := 0;
  v_updated_count integer := 0;
  v_failed_count integer := 0;
  v_affected_ids uuid[] := '{}'::uuid[];
  v_errors text[];
  v_row_errors jsonb := '[]'::jsonb;
  v_batch_id uuid;
  v_seen_codes text[] := '{}'::text[];
begin
  -- The Edge Function is the only supported caller and supplies the validated actor id.
  if auth.role() <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED';
  end if;

  if p_actor_id is null then
    raise exception 'ACTIVE_ACTOR_REQUIRED';
  end if;

  if p_organization_id is null then
    raise exception 'ORGANIZATION_SCOPE_DENIED';
  end if;

  select exists (
    select 1
    from public.profiles p
    join public.user_roles ur
      on ur.user_id = p.id
     and ur.is_active = true
    where p.id = p_actor_id
      and p.is_active = true
      and p.user_status = 'active'
      and p.organization_id = p_organization_id
      and ur.role in (
        'super_admin'::public.app_role,
        'governance_admin'::public.app_role
      )
      and ur.scope = 'global'::public.access_scope
      and (
        ur.organization_id is null
        or ur.organization_id = p_organization_id
      )
  ) into v_has_access;

  if not v_has_access then
    raise exception 'UNAUTHORIZED_DEPARTMENT_IMPORT';
  end if;

  if p_source_filename is null or pg_catalog.btrim(p_source_filename) = '' then
    raise exception 'SOURCE_FILENAME_REQUIRED';
  end if;

  if p_rows is null or pg_catalog.jsonb_typeof(p_rows) <> 'array' then
    raise exception 'INVALID_ROWS_PAYLOAD';
  end if;

  v_total_rows := pg_catalog.jsonb_array_length(p_rows);
  if v_total_rows = 0 then
    raise exception 'BATCH_EMPTY';
  end if;
  if v_total_rows > 5000 then
    raise exception 'BATCH_EXCEEDS_MAX_ROWS';
  end if;

  begin
    v_mode := p_import_mode::public.department_import_mode;
  exception when others then
    raise exception 'INVALID_IMPORT_MODE';
  end;

  -- Phase A: validate every row without persisting raw input or changing data.
  for v_row, v_row_index in
    select item.value, item.ordinality::integer
    from pg_catalog.jsonb_array_elements(p_rows) with ordinality as item(value, ordinality)
  loop
    v_errors := '{}'::text[];
    v_division_id := null;
    v_manager_id := null;
    v_manager_ids := null;
    v_existing_department_id := null;
    v_existing_department_ids := null;

    if pg_catalog.jsonb_typeof(v_row) is distinct from 'object' then
      v_row_number := v_row_index;
      v_errors := pg_catalog.array_append(v_errors, 'row must be an object');
      v_code := null;
      v_name_en := null;
      v_name_ar := null;
      v_department_type := null;
      v_status := null;
      v_manager_email := null;
      v_division_code := null;
    else
      if coalesce(v_row->>'row_number', '') ~ '^[1-9][0-9]*$' then
        v_row_number := (v_row->>'row_number')::integer;
      else
        v_row_number := v_row_index;
        v_errors := pg_catalog.array_append(v_errors, 'row_number must be a positive integer');
      end if;

      if pg_catalog.jsonb_typeof(v_row->'raw_data') is distinct from 'object' then
        v_errors := pg_catalog.array_append(v_errors, 'raw_data must be an object');
      end if;

      v_code := pg_catalog.lower(pg_catalog.btrim(v_row->'raw_data'->>'department_code'));
      v_name_en := pg_catalog.btrim(v_row->'raw_data'->>'department_name_en');
      v_name_ar := pg_catalog.btrim(v_row->'raw_data'->>'department_name_ar');
      v_department_type := pg_catalog.lower(pg_catalog.btrim(v_row->'raw_data'->>'department_type'));
      v_status := pg_catalog.lower(pg_catalog.btrim(v_row->'raw_data'->>'status'));
      v_manager_email := pg_catalog.lower(pg_catalog.btrim(v_row->'raw_data'->>'manager_email'));
      v_division_code := pg_catalog.btrim(v_row->'raw_data'->>'division_code');
    end if;

    if v_code is null or v_code = '' then
      v_errors := pg_catalog.array_append(v_errors, 'department_code required');
    end if;
    if v_name_en is null or v_name_en = '' then
      v_errors := pg_catalog.array_append(v_errors, 'department_name_en required');
    end if;
    if v_status is not null and v_status <> '' and v_status not in ('active', 'inactive') then
      v_errors := pg_catalog.array_append(v_errors, 'invalid status');
    end if;

    -- Core departments has no type column or verified type relation.
    if v_department_type is not null and v_department_type <> '' then
      v_errors := pg_catalog.array_append(v_errors, 'department_type unsupported by canonical departments schema');
    end if;

    if v_code is not null and v_code <> '' then
      if v_code = any(v_seen_codes) then
        v_errors := pg_catalog.array_append(v_errors, 'duplicate code in batch');
      else
        v_seen_codes := pg_catalog.array_append(v_seen_codes, v_code);
      end if;

      select pg_catalog.array_agg(d.id order by d.is_active desc, d.created_at, d.id)
      into v_existing_department_ids
      from public.departments d
      where d.organization_id = p_organization_id
        and pg_catalog.lower(pg_catalog.btrim(d.code)) = v_code;

      if coalesce(pg_catalog.cardinality(v_existing_department_ids), 0) > 1 then
        v_errors := pg_catalog.array_append(v_errors, 'ambiguous department identity');
      elsif pg_catalog.cardinality(v_existing_department_ids) = 1 then
        v_existing_department_id := v_existing_department_ids[1];
        if v_mode = 'create_only' then
          v_errors := pg_catalog.array_append(v_errors, 'department already exists (create_only mode)');
        end if;
      end if;
    end if;

    if v_division_code is not null and v_division_code <> '' then
      select d.id
      into v_division_id
      from public.divisions d
      where d.organization_id = p_organization_id
        and pg_catalog.lower(pg_catalog.btrim(d.code)) = pg_catalog.lower(v_division_code)
        and d.is_active = true
      limit 1;

      if v_division_id is null then
        v_errors := pg_catalog.array_append(v_errors, 'invalid division');
      end if;
    end if;

    -- Manager authority is represented by a department-scoped user_roles row.
    if v_manager_email is not null and v_manager_email <> '' then
      select pg_catalog.array_agg(p.id order by p.id)
      into v_manager_ids
      from public.profiles p
      where pg_catalog.lower(p.email) = v_manager_email;

      if coalesce(pg_catalog.cardinality(v_manager_ids), 0) = 0 then
        v_errors := pg_catalog.array_append(v_errors, 'manager not found');
      elsif pg_catalog.cardinality(v_manager_ids) > 1 then
        v_errors := pg_catalog.array_append(v_errors, 'manager email ambiguous');
      else
        v_manager_id := v_manager_ids[1];
        select p.organization_id, p.user_status, p.is_active
        into v_manager_org_id, v_manager_status, v_manager_is_active
        from public.profiles p
        where p.id = v_manager_id;

        if v_manager_org_id is distinct from p_organization_id then
          v_errors := pg_catalog.array_append(v_errors, 'manager outside organization');
        elsif v_manager_status <> 'active' or v_manager_is_active <> true then
          v_errors := pg_catalog.array_append(v_errors, 'manager inactive');
        end if;
      end if;
    end if;

    if pg_catalog.cardinality(v_errors) > 0 then
      v_row_errors := v_row_errors || pg_catalog.jsonb_build_object(
        'row_number', v_row_number,
        'errors', pg_catalog.to_jsonb(v_errors)
      );
      v_failed_count := v_failed_count + 1;
    end if;
  end loop;

  if v_failed_count > 0 then
    return pg_catalog.jsonb_build_object(
      'status', 'rejected',
      'total_rows', v_total_rows,
      'failed_count', v_failed_count,
      'created_count', 0,
      'updated_count', 0,
      'row_errors', v_row_errors
    );
  end if;

  -- Phase B: all rows are valid; subsequent errors roll back the whole function call.
  insert into public.department_import_batches (
    organization_id,
    initiated_by,
    source_filename,
    import_mode,
    status,
    total_rows
  ) values (
    p_organization_id,
    p_actor_id,
    pg_catalog.left(pg_catalog.btrim(p_source_filename), 255),
    v_mode,
    'processing',
    v_total_rows
  ) returning id into v_batch_id;

  for v_row in select item.value from pg_catalog.jsonb_array_elements(p_rows) as item(value)
  loop
    v_code := pg_catalog.lower(pg_catalog.btrim(v_row->'raw_data'->>'department_code'));
    v_name_en := pg_catalog.btrim(v_row->'raw_data'->>'department_name_en');
    v_name_ar := pg_catalog.btrim(v_row->'raw_data'->>'department_name_ar');
    v_status := pg_catalog.lower(pg_catalog.btrim(v_row->'raw_data'->>'status'));
    v_manager_email := pg_catalog.lower(pg_catalog.btrim(v_row->'raw_data'->>'manager_email'));
    v_division_code := pg_catalog.btrim(v_row->'raw_data'->>'division_code');
    v_division_id := null;
    v_manager_id := null;
    v_existing_department_id := null;
    v_department_created := false;
    v_manager_role_id := null;
    v_manager_role_changed := false;

    select d.id
    into v_existing_department_id
    from public.departments d
    where d.organization_id = p_organization_id
      and pg_catalog.lower(pg_catalog.btrim(d.code)) = v_code
    order by d.is_active desc, d.created_at, d.id
    limit 1
    for update;

    if v_existing_department_id is not null then
      update public.departments
      set name_en = coalesce(nullif(v_name_en, ''), name_en),
          name_ar = coalesce(nullif(v_name_ar, ''), name_ar),
          is_active = case
            when v_status = 'active' then true
            when v_status = 'inactive' then false
            else is_active
          end,
          updated_at = pg_catalog.now()
      where id = v_existing_department_id;

      v_updated_count := v_updated_count + 1;
    else
      if v_division_code is not null and v_division_code <> '' then
        select d.id
        into v_division_id
        from public.divisions d
        where d.organization_id = p_organization_id
          and pg_catalog.lower(pg_catalog.btrim(d.code)) = pg_catalog.lower(v_division_code)
          and d.is_active = true
        limit 1;
      end if;

      insert into public.departments (
        organization_id,
        division_id,
        code,
        name_en,
        name_ar,
        is_active
      ) values (
        p_organization_id,
        v_division_id,
        v_code,
        v_name_en,
        nullif(v_name_ar, ''),
        v_status is distinct from 'inactive'
      ) returning id into v_existing_department_id;

      v_created_count := v_created_count + 1;
      v_department_created := true;
    end if;

    v_affected_ids := pg_catalog.array_append(v_affected_ids, v_existing_department_id);

    if v_manager_email is not null and v_manager_email <> '' then
      select p.id
      into v_manager_id
      from public.profiles p
      where pg_catalog.lower(p.email) = v_manager_email;

      select ur.id
      into v_manager_role_id
      from public.user_roles ur
      where ur.user_id = v_manager_id
        and ur.role = 'department_manager'::public.app_role
        and ur.department_id = v_existing_department_id
        and ur.is_active = true
        and (ur.organization_id is null or ur.organization_id = p_organization_id)
      order by ur.assigned_at desc, ur.id
      limit 1;

      if v_manager_role_id is null then
        select ur.id
        into v_manager_role_id
        from public.user_roles ur
        where ur.user_id = v_manager_id
          and ur.role = 'department_manager'::public.app_role
          and ur.scope = 'department'::public.access_scope
          and ur.organization_id = p_organization_id
          and ur.department_id = v_existing_department_id
          and ur.division_id is null
          and ur.unit_id is null
          and ur.is_active = false
        order by ur.assigned_at desc, ur.id
        limit 1
        for update;

        if v_manager_role_id is not null then
          update public.user_roles
          set is_active = true,
              assigned_by = p_actor_id,
              assigned_at = pg_catalog.now()
          where id = v_manager_role_id;
        else
          insert into public.user_roles (
            user_id,
            role,
            scope,
            organization_id,
            division_id,
            department_id,
            unit_id,
            is_active,
            assigned_by
          ) values (
            v_manager_id,
            'department_manager'::public.app_role,
            'department'::public.access_scope,
            p_organization_id,
            null,
            v_existing_department_id,
            null,
            true,
            p_actor_id
          ) returning id into v_manager_role_id;
        end if;

        v_manager_role_changed := true;
      end if;
    end if;

    insert into public.audit_logs (
      action,
      table_name,
      record_id,
      actor_id,
      organization_id,
      new_data
    ) values (
      case
        when v_department_created then 'DEPARTMENT_IMPORTED_CREATE'
        else 'DEPARTMENT_IMPORTED_UPDATE'
      end,
      'departments',
      v_existing_department_id,
      p_actor_id,
      p_organization_id,
      pg_catalog.jsonb_build_object(
        'batch_id', v_batch_id,
        'source', 'department_import',
        'code', v_code
      )
    );

    if v_manager_role_changed then
      insert into public.audit_logs (
        action,
        table_name,
        record_id,
        actor_id,
        organization_id,
        new_data
      ) values (
        'DEPARTMENT_MANAGER_ROLE_ASSIGNED',
        'user_roles',
        v_manager_role_id,
        p_actor_id,
        p_organization_id,
        pg_catalog.jsonb_build_object(
          'batch_id', v_batch_id,
          'department_id', v_existing_department_id,
          'manager_user_id', v_manager_id
        )
      );
    end if;
  end loop;

  update public.department_import_batches
  set status = 'completed',
      created_count = v_created_count,
      updated_count = v_updated_count,
      failed_count = 0,
      affected_department_ids = v_affected_ids,
      completed_at = pg_catalog.now()
  where id = v_batch_id;

  return pg_catalog.jsonb_build_object(
    'status', 'success',
    'batch_id', v_batch_id,
    'total_rows', v_total_rows,
    'created_count', v_created_count,
    'updated_count', v_updated_count,
    'failed_count', 0,
    'affected_department_ids', v_affected_ids
  );
end;
$$;

revoke all on function public.apply_department_import_batch(uuid, uuid, text, text, jsonb)
from public, anon, authenticated;
grant execute on function public.apply_department_import_batch(uuid, uuid, text, text, jsonb)
to service_role;
