-- P3 hosted approval authority service-role guard compatibility.
--
-- Patch27 predates hosted PostgREST's canonical JSON claims contract and reads
-- request.jwt.claim.role directly. Replace only that exact guard in the named
-- authority functions with the auth.role() contract used by later migrations.

do $$
declare
  v_oid oid;
  v_definition text;
  v_old_guard constant text :=
    'coalesce(current_setting(''request.jwt.claim.role'', true), current_user) <> ''service_role''
     and current_user <> ''service_role''';
  v_new_guard constant text :=
    'auth.role() is distinct from ''service_role''
     and current_user <> ''service_role''';
  v_functions constant regprocedure[] := array[
    'public.cancel_approval_request(uuid,uuid,text)'::regprocedure,
    'public.configure_approval_authority_rule_stages(uuid,uuid,jsonb)'::regprocedure,
    'public.create_approval_authority_rule(uuid,text,text,text,text,jsonb,uuid)'::regprocedure,
    'public.create_approval_delegation(uuid,uuid,uuid,timestamptz,timestamptz,uuid,jsonb)'::regprocedure,
    'public.disable_approval_authority_rule(uuid,uuid,text)'::regprocedure,
    'public.escalate_approval_request(uuid,uuid,text,uuid,text)'::regprocedure,
    'public.override_approval_request_with_reason(uuid,uuid,text,text)'::regprocedure,
    'public.record_approval_decision(uuid,uuid,text,text,text)'::regprocedure,
    'public.request_workflow_approval(uuid,text,text,uuid,text,uuid,jsonb)'::regprocedure,
    'public.revoke_approval_delegation(uuid,uuid,text)'::regprocedure,
    'public.update_approval_authority_rule(uuid,jsonb,uuid)'::regprocedure
  ];
begin
  foreach v_oid in array v_functions loop
    v_definition := pg_get_functiondef(v_oid);
    if strpos(v_definition, v_old_guard) = 0 then
      raise exception 'PATCH226_EXPECTED_SERVICE_ROLE_GUARD_NOT_FOUND: %', v_oid::regprocedure;
    end if;

    execute replace(v_definition, v_old_guard, v_new_guard);
  end loop;
end;
$$;

do $$
declare
  v_remaining integer;
begin
  select count(*) into v_remaining
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosrc like '%PATCH27_AUTHORITY_SERVICE_ROLE_REQUIRED%'
    and p.prosrc like '%request.jwt.claim.role%';

  if v_remaining <> 0 then
    raise exception 'PATCH226_STALE_PATCH27_SERVICE_ROLE_GUARDS_REMAIN: %', v_remaining;
  end if;
end;
$$;
