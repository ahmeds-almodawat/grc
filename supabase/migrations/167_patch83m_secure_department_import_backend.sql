-- Patch 83M: Secure Department Import Backend
-- Scope: Dedicated import history table, secure RPC for atomic department execution
-- Uniqueness: Option A (Codes unique across the whole organization)

-- 1. Identity Verification
-- We rely on the existing uq_departments_active_code_norm for active code uniqueness across the organization.
-- (organization_id, lower(trim(code))) where is_active = true and code is not null

-- 2. Dedicated Batch History Table
do $$ begin
  create type public.department_import_mode as enum ('create_only', 'create_and_update');
exception when duplicate_object then null; end $$;

create table if not exists public.department_import_batches (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references public.organizations(id) on delete cascade,
    initiated_by uuid references public.profiles(id) on delete set null,
    source_filename varchar(255) not null,
    import_mode public.department_import_mode not null default 'create_only',
    status text not null check (status in ('processing', 'completed', 'failed', 'rejected')),
    total_rows integer not null default 0 check (total_rows between 1 and 5000),
    created_count integer not null default 0 check (created_count >= 0),
    updated_count integer not null default 0 check (updated_count >= 0),
    skipped_count integer not null default 0 check (skipped_count >= 0),
    warning_count integer not null default 0 check (warning_count >= 0),
    failed_count integer not null default 0 check (failed_count >= 0),
    error_summary jsonb,
    affected_department_ids uuid[] default '{}'::uuid[],
    initiated_at timestamptz not null default now(),
    completed_at timestamptz
);

alter table public.department_import_batches enable row level security;

create policy "department_import_batches_read" on public.department_import_batches
  for select
  to authenticated
  using (
    organization_id = (select organization_id from public.profiles where id = auth.uid())
    and public.has_any_role(array['super_admin','governance_admin']::public.app_role[])
  );

-- 3. Dedicated Import RPC
create or replace function public.apply_department_import_batch(
    p_actor_id uuid,
    p_organization_id uuid,
    p_source_filename text,
    p_import_mode text,
    p_rows jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_has_access boolean;
    v_mode public.department_import_mode;
    v_row jsonb;
    v_row_number integer;
    v_code text;
    v_name_en text;
    v_name_ar text;
    v_type text;
    v_status text;
    v_manager_email text;
    v_org_code text;
    v_div_code text;
    v_div_id uuid;
    v_manager_id uuid;
    v_manager_org_id uuid;
    v_manager_status text;
    v_existing_dept_id uuid;
    v_existing_dept_active boolean;

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
    -- Identity Propagation: Trust only service_role caller
    if auth.role() <> 'service_role' then
        raise exception 'SERVICE_ROLE_REQUIRED';
    end if;

    if p_actor_id is null then
        raise exception 'ACTIVE_ACTOR_REQUIRED';
    end if;

    if p_organization_id is null then
        raise exception 'ORGANIZATION_SCOPE_DENIED';
    end if;

    -- Phase 1: Explicit Actor Authorization Check
    select exists (
        select 1
        from public.profiles p
        join public.user_roles ur on ur.user_id = p.id and ur.is_active = true
        where p.id = p_actor_id
        and p.user_status = 'active'
        and p.organization_id = p_organization_id
        and ur.role in ('super_admin'::public.app_role, 'governance_admin'::public.app_role)
    ) into v_has_access;

    if not v_has_access then
        raise exception 'UNAUTHORIZED_DEPARTMENT_IMPORT';
    end if;

    -- Validate bounds
    v_total_rows := jsonb_array_length(p_rows);
    if v_total_rows = 0 or v_total_rows is null then
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

    -- Phase A: Two-phase validation - validate all rows without mutation
    for v_row in select * from jsonb_array_elements(p_rows) loop
        v_row_number := (v_row->>'row_number')::integer;
        v_code := lower(trim(v_row->'raw_data'->>'department_code'));
        v_name_en := trim(v_row->'raw_data'->>'department_name_en');
        v_name_ar := trim(v_row->'raw_data'->>'department_name_ar');
        v_type := lower(trim(v_row->'raw_data'->>'department_type'));
        v_status := lower(trim(v_row->'raw_data'->>'status'));
        v_manager_email := lower(trim(v_row->'raw_data'->>'manager_email'));
        v_div_code := trim(v_row->'raw_data'->>'division_code');

        v_errors := '{}'::text[];

        -- Basic validation
        if v_code is null or v_code = '' then v_errors := v_errors || 'department_code required'; end if;
        if v_name_en is null or v_name_en = '' then v_errors := v_errors || 'department_name_en required'; end if;

        if v_code = any(v_seen_codes) then
            v_errors := v_errors || 'duplicate code in batch';
        else
            v_seen_codes := v_seen_codes || v_code;
        end if;

        -- Resolve division
        if v_div_code is not null and v_div_code <> '' then
            v_div_id := null;
            select id into v_div_id from public.divisions
            where organization_id = p_organization_id and lower(trim(code)) = lower(v_div_code)
            and is_active = true limit 1;
            if v_div_id is null then v_errors := v_errors || 'invalid division'; end if;
        end if;

        -- Resolve manager
        if v_manager_email is not null and v_manager_email <> '' then
            v_manager_id := null;
            select id, organization_id, user_status into v_manager_id, v_manager_org_id, v_manager_status
            from public.profiles where lower(email) = v_manager_email limit 1;

            if v_manager_id is null then v_errors := v_errors || 'manager not found';
            elsif v_manager_org_id <> p_organization_id then v_errors := v_errors || 'manager outside organization';
            elsif v_manager_status <> 'active' then v_errors := v_errors || 'manager inactive';
            end if;
        end if;

        -- Check existence by Option A (organization_id + code)
        v_existing_dept_id := null;
        if v_code is not null and v_code <> '' then
            select id, is_active into v_existing_dept_id, v_existing_dept_active
            from public.departments
            where organization_id = p_organization_id and lower(trim(code)) = v_code
            and is_active = true
            limit 1;

            if v_existing_dept_id is not null and v_mode = 'create_only' then
                v_errors := v_errors || 'department already exists (create_only mode)';
            end if;
        end if;

        if array_length(v_errors, 1) > 0 then
            v_row_errors := v_row_errors || jsonb_build_object(
                'row_number', v_row_number,
                'errors', array_to_json(v_errors)
            );
            v_failed_count := v_failed_count + 1;
        end if;
    end loop;

    -- If any row fails validation, return structured error and DO NOT persist history or modifications
    if v_failed_count > 0 then
        return jsonb_build_object(
            'status', 'rejected',
            'total_rows', v_total_rows,
            'failed_count', v_failed_count,
            'created_count', 0,
            'updated_count', 0,
            'row_errors', v_row_errors
        );
    end if;

    -- Phase B: Create batch history and execute DML
    insert into public.department_import_batches (
        organization_id, initiated_by, source_filename, import_mode, status, total_rows
    ) values (
        p_organization_id, p_actor_id, left(p_source_filename, 255), v_mode, 'processing', v_total_rows
    ) returning id into v_batch_id;

    for v_row in select * from jsonb_array_elements(p_rows) loop
        v_code := lower(trim(v_row->'raw_data'->>'department_code'));
        v_name_en := trim(v_row->'raw_data'->>'department_name_en');
        v_name_ar := trim(v_row->'raw_data'->>'department_name_ar');
        v_type := lower(trim(v_row->'raw_data'->>'department_type'));
        v_status := lower(trim(v_row->'raw_data'->>'status'));
        v_manager_email := lower(trim(v_row->'raw_data'->>'manager_email'));
        v_div_code := trim(v_row->'raw_data'->>'division_code');

        -- Resolve manager and division safely (already validated in Phase A)
        v_div_id := null;
        if v_div_code is not null and v_div_code <> '' then
            select id into v_div_id from public.divisions
            where organization_id = p_organization_id and lower(trim(code)) = lower(v_div_code)
            and is_active = true limit 1;
        end if;

        v_manager_id := null;
        if v_manager_email is not null and v_manager_email <> '' then
            select id into v_manager_id from public.profiles where lower(email) = v_manager_email limit 1;
        end if;

        v_existing_dept_id := null;
        select id into v_existing_dept_id
        from public.departments
        where organization_id = p_organization_id and lower(trim(code)) = v_code
        and is_active = true
        limit 1;

        if v_existing_dept_id is not null then
            update public.departments set
                name_en = coalesce(nullif(v_name_en, ''), name_en),
                name_ar = coalesce(nullif(v_name_ar, ''), name_ar),
                type = coalesce(nullif(v_type, ''), type),
                manager_id = case when v_manager_email is not null then v_manager_id else manager_id end,
                is_active = case when v_status = 'inactive' then false else is_active end,
                updated_at = now()
            where id = v_existing_dept_id;

            v_updated_count := v_updated_count + 1;
            v_affected_ids := v_affected_ids || v_existing_dept_id;

            insert into public.audit_logs (
                action, entity_type, entity_id, actor_id, organization_id, new_data
            ) values (
                'DEPARTMENT_IMPORTED_UPDATE', 'department', v_existing_dept_id, p_actor_id, p_organization_id,
                jsonb_build_object('batch_id', v_batch_id, 'source', 'import', 'code', v_code)
            );
        else
            insert into public.departments (
                organization_id, division_id, code, name_en, name_ar, type, manager_id, is_active
            ) values (
                p_organization_id, v_div_id, v_code, v_name_en, v_name_ar, coalesce(nullif(v_type, ''), 'clinical'), v_manager_id, case when v_status = 'inactive' then false else true end
            ) returning id into v_existing_dept_id;

            v_created_count := v_created_count + 1;
            v_affected_ids := v_affected_ids || v_existing_dept_id;

            insert into public.audit_logs (
                action, entity_type, entity_id, actor_id, organization_id, new_data
            ) values (
                'DEPARTMENT_IMPORTED_CREATE', 'department', v_existing_dept_id, p_actor_id, p_organization_id,
                jsonb_build_object('batch_id', v_batch_id, 'source', 'import', 'code', v_code)
            );
        end if;
    end loop;

    -- Update batch summary
    update public.department_import_batches set
        status = 'completed',
        created_count = v_created_count,
        updated_count = v_updated_count,
        failed_count = 0,
        affected_department_ids = v_affected_ids,
        completed_at = now()
    where id = v_batch_id;

    return jsonb_build_object(
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

revoke all on function public.apply_department_import_batch from public, anon, authenticated;
grant execute on function public.apply_department_import_batch to service_role;
