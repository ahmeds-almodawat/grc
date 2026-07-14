-- Patch 83S.1: align controlled Department Import execution with the Excel contract.
-- Adds a constrained department_type field and wraps the verified Patch 83O.2 RPC
-- without weakening service-role, actor-role, organization-scope, or atomicity controls.

alter table public.departments
  add column if not exists department_type text;

comment on column public.departments.department_type is
  'Controlled high-level department classification imported from the approved Excel template.';

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.departments'::pg_catalog.regclass
      and conname = 'departments_department_type_check'
  ) then
    alter table public.departments
      add constraint departments_department_type_check
      check (
        department_type is null
        or department_type in ('clinical', 'administrative', 'support')
      );
  end if;
end
$$;

-- Preserve the fully verified Patch 83O.2 implementation as the internal atomic engine.
-- This migration is designed to be safe if re-run in a disposable validation environment.
do $$
begin
  if pg_catalog.to_regprocedure(
       'public.apply_department_import_batch_v169(uuid,uuid,text,text,jsonb)'
     ) is null then
    if pg_catalog.to_regprocedure(
         'public.apply_department_import_batch(uuid,uuid,text,text,jsonb)'
       ) is null then
      raise exception 'PATCH83S1_BASE_IMPORT_RPC_MISSING';
    end if;

    alter function public.apply_department_import_batch(
      uuid, uuid, text, text, jsonb
    ) rename to apply_department_import_batch_v169;
  end if;
end
$$;

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
  v_row jsonb;
  v_row_index integer;
  v_row_number integer;
  v_code text;
  v_department_type text;
  v_department_id uuid;
  v_type_errors jsonb := '[]'::jsonb;
  v_type_failed_count integer := 0;
  v_sanitized_rows jsonb;
  v_result jsonb;
begin
  -- The browser cannot call this RPC directly. The authenticated Edge bridge
  -- invokes it with the service-role client after verifying the user.
  if auth.role() <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED';
  end if;

  if p_rows is null or pg_catalog.jsonb_typeof(p_rows) <> 'array' then
    raise exception 'INVALID_ROWS_PAYLOAD';
  end if;

  -- Validate the Excel classification server-side before calling the existing
  -- all-row validation and mutation engine.
  for v_row, v_row_index in
    select item.value, item.ordinality::integer
    from pg_catalog.jsonb_array_elements(p_rows)
      with ordinality as item(value, ordinality)
  loop
    if pg_catalog.jsonb_typeof(v_row) = 'object'
       and pg_catalog.jsonb_typeof(v_row->'raw_data') = 'object' then
      if coalesce(v_row->>'row_number', '') ~ '^[1-9][0-9]*$' then
        v_row_number := (v_row->>'row_number')::integer;
      else
        v_row_number := v_row_index;
      end if;

      v_department_type := pg_catalog.lower(
        pg_catalog.btrim(v_row->'raw_data'->>'department_type')
      );

      if v_department_type is null or v_department_type = '' then
        v_type_errors := v_type_errors || pg_catalog.jsonb_build_object(
          'row_number', v_row_number,
          'errors', pg_catalog.jsonb_build_array('department_type required')
        );
        v_type_failed_count := v_type_failed_count + 1;
      elsif v_department_type not in ('clinical', 'administrative', 'support') then
        v_type_errors := v_type_errors || pg_catalog.jsonb_build_object(
          'row_number', v_row_number,
          'errors', pg_catalog.jsonb_build_array(
            'unsupported department_type: ' || v_department_type
          )
        );
        v_type_failed_count := v_type_failed_count + 1;
      end if;
    end if;
  end loop;

  if v_type_failed_count > 0 then
    return pg_catalog.jsonb_build_object(
      'status', 'rejected',
      'total_rows', pg_catalog.jsonb_array_length(p_rows),
      'failed_count', v_type_failed_count,
      'created_count', 0,
      'updated_count', 0,
      'row_errors', v_type_errors
    );
  end if;

  -- Migration 169 rejected every nonblank department_type because the original
  -- departments schema had no destination column. Remove only that field before
  -- invoking the verified engine; all other row validation remains unchanged.
  select pg_catalog.jsonb_agg(
    case
      when pg_catalog.jsonb_typeof(item.value) = 'object'
       and pg_catalog.jsonb_typeof(item.value->'raw_data') = 'object'
      then pg_catalog.jsonb_set(
        item.value,
        '{raw_data}',
        (item.value->'raw_data') - 'department_type',
        true
      )
      else item.value
    end
    order by item.ordinality
  )
  into v_sanitized_rows
  from pg_catalog.jsonb_array_elements(p_rows)
    with ordinality as item(value, ordinality);

  v_result := public.apply_department_import_batch_v169(
    p_actor_id,
    p_organization_id,
    p_source_filename,
    p_import_mode,
    v_sanitized_rows
  );

  -- A rejected result means the verified engine performed no persistent writes.
  if coalesce(v_result->>'status', '') <> 'success' then
    return v_result;
  end if;

  -- Persist the approved classification in the same transaction. Any error here
  -- rolls back the base import, batch history, role mapping, and audit writes.
  for v_row in
    select item.value
    from pg_catalog.jsonb_array_elements(p_rows) as item(value)
  loop
    v_code := pg_catalog.lower(
      pg_catalog.btrim(v_row->'raw_data'->>'department_code')
    );
    v_department_type := pg_catalog.lower(
      pg_catalog.btrim(v_row->'raw_data'->>'department_type')
    );
    v_department_id := null;

    update public.departments d
    set department_type = v_department_type,
        updated_at = pg_catalog.now()
    where d.organization_id = p_organization_id
      and pg_catalog.lower(pg_catalog.btrim(d.code)) = v_code
    returning d.id into v_department_id;

    if v_department_id is null then
      raise exception 'PATCH83S1_IMPORTED_DEPARTMENT_NOT_FOUND';
    end if;

    insert into public.audit_logs (
      action,
      table_name,
      record_id,
      actor_id,
      organization_id,
      new_data
    ) values (
      'DEPARTMENT_IMPORT_TYPE_SET',
      'departments',
      v_department_id,
      p_actor_id,
      p_organization_id,
      pg_catalog.jsonb_build_object(
        'batch_id', v_result->>'batch_id',
        'source', 'department_import',
        'department_type', v_department_type
      )
    );
  end loop;

  return v_result || pg_catalog.jsonb_build_object(
    'department_type_count',
    pg_catalog.jsonb_array_length(p_rows)
  );
end
$$;

revoke all on function public.apply_department_import_batch(
  uuid, uuid, text, text, jsonb
) from public, anon, authenticated;

grant execute on function public.apply_department_import_batch(
  uuid, uuid, text, text, jsonb
) to service_role;

revoke all on function public.apply_department_import_batch_v169(
  uuid, uuid, text, text, jsonb
) from public, anon, authenticated;

grant execute on function public.apply_department_import_batch_v169(
  uuid, uuid, text, text, jsonb
) to service_role;

notify pgrst, 'reload schema';
