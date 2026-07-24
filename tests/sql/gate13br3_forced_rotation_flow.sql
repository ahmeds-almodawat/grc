-- Gate 13B-R3 synthetic mandatory-rotation database flow.
-- Run only in the disposable bridge fixture after migrations 186 and 187.
-- No password value is present. The external Auth Admin password operation is
-- represented at its reviewed database boundary by the matching Auth metadata
-- version and global session removal before the protected atomic finalizer.

begin;

do $test$
declare
  v_actor constant uuid := '13000000-0000-4000-8000-000000000002'::uuid;
  v_session constant uuid := '13000000-0000-4000-8000-000000000007'::uuid;
  v_fresh_session constant uuid := '13000000-0000-4000-8000-000000000008'::uuid;
  v_request constant text := 'gate13br3-synthetic-required-rotation';
  v_email constant text := 'gate13b-admin@synthetic.invalid';
  v_state jsonb;
  v_prepare jsonb;
  v_begin jsonb;
  v_final jsonb;
  v_operation_id uuid;
begin
  perform pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);

  if public.patch83u_runtime_super_admin_eligible(
    v_actor, '13000000-0000-4000-8000-000000000001'::uuid
  ) then
    raise exception 'GATE13BR3_PENDING_ADMIN_MUST_NOT_BE_RUNTIME_ELIGIBLE';
  end if;

  insert into auth.sessions(id, user_id, created_at, updated_at)
  values (v_session, v_actor, pg_catalog.clock_timestamp(), pg_catalog.clock_timestamp());

  v_state := public.patch83u_get_credential_state(v_actor, 0, v_email, v_session::text);
  if v_state ->> 'credential_state' <> 'existing_password_change_required'
     or (v_state ->> 'change_required')::boolean is distinct from true
     or (v_state ->> 'access_allowed')::boolean is distinct from false then
    raise exception 'GATE13BR3_FORCED_CHANGE_GATE_NOT_ESTABLISHED';
  end if;

  v_prepare := public.patch83u_prepare_required_password_change(
    v_actor, v_session::text, 0, v_request
  );
  if (v_prepare ->> 'current_credential_version')::integer <> 0
     or (v_prepare ->> 'next_credential_version')::integer <> 1 then
    raise exception 'GATE13BR3_ROTATION_PREPARE_VERSION_INVALID';
  end if;

  v_begin := public.patch83u_begin_required_password_change(
    v_actor, v_session::text, 0, v_request
  );
  v_operation_id := (v_begin ->> 'operation_id')::uuid;
  if v_operation_id is null
     or (v_begin ->> 'next_credential_version')::integer <> 1 then
    raise exception 'GATE13BR3_ROTATION_BEGIN_INVALID';
  end if;

  -- Synthetic representation of the reviewed Edge/Auth Admin boundary. No
  -- encrypted_password or password field is read or written by this test.
  update auth.users
  set raw_app_meta_data = jsonb_set(
        coalesce(raw_app_meta_data, '{}'::jsonb),
        '{credential_version}', '1'::jsonb, true
      ),
      updated_at = pg_catalog.clock_timestamp()
  where id = v_actor;
  if not found then
    raise exception 'GATE13BR3_SYNTHETIC_AUTH_METADATA_UPDATE_FAILED';
  end if;

  delete from auth.sessions where user_id = v_actor;

  v_final := public.patch83u_finalize_password_change_after_revocation(
    v_actor, v_operation_id, v_request, 1, v_email
  );
  if v_final ->> 'credential_state' <> 'active'
     or (v_final ->> 'credential_version')::integer <> 1 then
    raise exception 'GATE13BR3_ROTATION_FINALIZER_FAILED';
  end if;

  if not exists (
    select 1
    from public.user_credential_states cs
    join auth.users au on au.id = cs.user_id
    where cs.user_id = v_actor
      and cs.credential_state = 'active'
      and cs.credential_version = 1
      and public.patch83u_auth_credential_version(au.raw_app_meta_data) = 1
      and cs.password_changed_at is not null
      and cs.sessions_revoked_at is not null
      and cs.pending_operation_id is null
      and cs.operation_source is null
      and cs.reconciliation_auth_changed = false
      and not exists (select 1 from auth.sessions s where s.user_id = v_actor)
      and not exists (
        select 1 from auth.refresh_tokens rt
        where rt.user_id = v_actor::text and rt.revoked = false
      )
  ) then
    raise exception 'GATE13BR3_FINAL_CREDENTIAL_STATE_INVALID';
  end if;

  if not public.patch83u_runtime_super_admin_eligible(
    v_actor, '13000000-0000-4000-8000-000000000001'::uuid
  ) then
    raise exception 'GATE13BR3_ACTIVE_ADMIN_ELIGIBILITY_NOT_RESTORED';
  end if;

  if public.patch83b_release_lineage_attestation()
       ->> 'mandatory_super_admin_password_rotation' <> 'completed'
     or (public.patch83b_release_lineage_attestation() ->> 'overall_pass')::boolean
          is distinct from true then
    raise exception 'GATE13BR3_COMPLETED_ROTATION_ATTESTATION_FAILED';
  end if;

  -- A distinct fresh session represents successful fresh authentication after
  -- the protected operation. It must regain access, then is removed so final
  -- fixture evidence remains at zero sessions and zero refresh tokens.
  insert into auth.sessions(id, user_id, created_at, updated_at)
  values (v_fresh_session, v_actor, pg_catalog.clock_timestamp(), pg_catalog.clock_timestamp());
  v_state := public.patch83u_get_credential_state(v_actor, 1, v_email, v_fresh_session::text);
  if (v_state ->> 'access_allowed')::boolean is distinct from true
     or v_state ->> 'credential_state' <> 'active' then
    raise exception 'GATE13BR3_FRESH_ACTIVE_LOGIN_GATE_FAILED';
  end if;
  delete from auth.sessions where id = v_fresh_session;

  if (public.patch83tu_catalog_contract_attestation() ->> 'overall_pass')::boolean
       is distinct from true
     or (select enforcement_state <> 'enforced' or state_version <> 5
         from public.patch83u_runtime_control where singleton) then
    raise exception 'GATE13BR3_RUNTIME_OR_CATALOG_CHANGED_BY_ROTATION';
  end if;
end;
$test$;

commit;
