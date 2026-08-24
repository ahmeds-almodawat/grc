begin;

do $proof$
declare
  v_create_definition text;
  v_save_definition text;
begin
  select pg_get_functiondef(
    'public.create_governed_policy_draft(uuid,uuid,text,text,text,text,text,text,text,text,text,text,text,text,text,text,uuid,text,text,text,jsonb,uuid[],jsonb)'::regprocedure
  ) into v_create_definition;

  select pg_get_functiondef(
    'public.save_governed_policy_draft(uuid,uuid,text,text,text,text,text,text,text,text,text,text,text,text,text,text,jsonb,uuid[],jsonb)'::regprocedure
  ) into v_save_definition;

  if v_create_definition !~* 'profiles[\s\S]*is_active\s*=\s*true' then
    raise exception 'P3_225_CREATE_POLICY_CANONICAL_PROFILE_ACTIVITY_MISSING';
  end if;
  if v_create_definition ~* 'profiles[\s\S]{0,180}active_flag' then
    raise exception 'P3_225_CREATE_POLICY_LEGACY_PROFILE_ACTIVITY_PRESENT';
  end if;

  if v_save_definition !~* 'document_type\s*=\s*''policy''' then
    raise exception 'P3_225_SAVE_POLICY_TYPE_BOUNDARY_MISSING';
  end if;
  if v_save_definition !~* 'PATCH202_ACTOR_CROSS_ORG_FORBIDDEN' then
    raise exception 'P3_225_SAVE_POLICY_TENANCY_BOUNDARY_MISSING';
  end if;
  if v_save_definition !~* 'super_admin[\s\S]*governance_admin' then
    raise exception 'P3_225_SAVE_POLICY_GOVERNANCE_AUTHORITY_MISSING';
  end if;
  if v_save_definition !~* 'PATCH201_VERSION_IMMUTABLE_LOCKED' then
    raise exception 'P3_225_SAVE_POLICY_IMMUTABILITY_MISSING';
  end if;
  if v_save_definition !~* 'controlled_documents[\s\S]*document_title\s*=\s*p_title_en' then
    raise exception 'P3_225_POLICY_ROOT_TITLE_SYNC_MISSING';
  end if;

  if has_function_privilege(
    'anon',
    'public.create_governed_policy_draft(uuid,uuid,text,text,text,text,text,text,text,text,text,text,text,text,text,text,uuid,text,text,text,jsonb,uuid[],jsonb)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.save_governed_policy_draft(uuid,uuid,text,text,text,text,text,text,text,text,text,text,text,text,text,text,jsonb,uuid[],jsonb)',
    'EXECUTE'
  ) then
    raise exception 'P3_225_POLICY_RPC_PUBLIC_EXECUTION_PRESENT';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.create_governed_policy_draft(uuid,uuid,text,text,text,text,text,text,text,text,text,text,text,text,text,text,uuid,text,text,text,jsonb,uuid[],jsonb)',
    'EXECUTE'
  ) or not has_function_privilege(
    'service_role',
    'public.save_governed_policy_draft(uuid,uuid,text,text,text,text,text,text,text,text,text,text,text,text,text,text,jsonb,uuid[],jsonb)',
    'EXECUTE'
  ) then
    raise exception 'P3_225_POLICY_RPC_SERVICE_EXECUTION_MISSING';
  end if;

  raise notice 'P3 MIGRATION 225 GOVERNED POLICY AUTHORITY PROOF PASSED';
end;
$proof$;

rollback;
