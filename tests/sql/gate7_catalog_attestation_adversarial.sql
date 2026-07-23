-- Run only in a disposable post-182 validation database.
-- Every drift case is rolled back and must make the attestation fail closed.

begin;
revoke execute on function public.patch83u_get_capabilities(uuid,text,text) from service_role;
do $test$
begin
  if (public.patch83tu_catalog_contract_attestation() ->> 'overall_pass')::boolean then
    raise exception 'GATE7_ATTESTATION_ACCEPTED_UNSAFE_ACL';
  end if;
end;
$test$;
rollback;

begin;
alter function public.patch83u_get_capabilities(uuid,text,text) security invoker;
do $test$
begin
  if (public.patch83tu_catalog_contract_attestation() ->> 'overall_pass')::boolean then
    raise exception 'GATE7R_ATTESTATION_ACCEPTED_UNSAFE_SECURITY_INVOKER';
  end if;
end;
$test$;
rollback;

begin;
grant execute on function public.patch83u_get_capabilities(uuid,text,text) to public, anon, authenticated;
do $test$
begin
  if (public.patch83tu_catalog_contract_attestation() ->> 'overall_pass')::boolean then
    raise exception 'GATE7R_ATTESTATION_ACCEPTED_BROWSER_EXECUTE_ACL';
  end if;
end;
$test$;
rollback;

begin;
drop function public.patch83u_get_capabilities(uuid,text,text);
create function public.patch83u_get_capabilities(uuid,text)
returns jsonb language sql stable security definer
set search_path = pg_catalog, public, pg_temp
as $$ select '{}'::jsonb $$;
revoke all on function public.patch83u_get_capabilities(uuid,text) from public, anon, authenticated;
grant execute on function public.patch83u_get_capabilities(uuid,text) to service_role;
do $test$
begin
  if (public.patch83tu_catalog_contract_attestation() ->> 'overall_pass')::boolean then
    raise exception 'GATE7R_ATTESTATION_ACCEPTED_WRONG_FUNCTION_SIGNATURE';
  end if;
end;
$test$;
rollback;

begin;
grant execute on function public.patch83u_reconcile_last_super_admin_recovery(
  uuid,uuid,text,text
) to service_role;
do $test$
begin
  if (public.patch83tu_catalog_contract_attestation() ->> 'overall_pass')::boolean then
    raise exception 'GATE7R_ATTESTATION_ACCEPTED_CALLABLE_OWNER_ONLY_RECOVERY';
  end if;
end;
$test$;
rollback;

begin;
set local role authenticated;
do $test$
begin
  perform public.patch83tu_catalog_contract_attestation();
  raise exception 'GATE7R_AUTHENTICATED_ATTESTATION_EXECUTION_ALLOWED';
exception
  when insufficient_privilege then null;
end;
$test$;
rollback;

begin;
set local role service_role;
do $test$
begin
  if (public.patch83tu_catalog_contract_attestation() ->> 'overall_pass')::boolean is not true then
    raise exception 'GATE7R_SERVICE_ROLE_ATTESTATION_FAILED';
  end if;
end;
$test$;
rollback;

begin;
set local role authenticated;
do $test$
begin
  execute 'select 1 from public.company_rollout_waves limit 1';
  raise exception 'GATE7R_AUTHENTICATED_LEGACY_TABLE_ACCESS_ALLOWED';
exception
  when insufficient_privilege then null;
end;
$test$;
rollback;

begin;
alter function public.patch83u_reconcile_last_super_admin_recovery(
  uuid,uuid,text,text
) set search_path = public;
do $test$
begin
  if (public.patch83tu_catalog_contract_attestation() ->> 'overall_pass')::boolean then
    raise exception 'GATE7R_ATTESTATION_ACCEPTED_UNSAFE_RECOVERY_SEARCH_PATH';
  end if;
end;
$test$;
rollback;

begin;
alter function public.patch83u_get_capabilities(uuid,text,text) set search_path = public;
do $test$
begin
  if (public.patch83tu_catalog_contract_attestation() ->> 'overall_pass')::boolean then
    raise exception 'GATE7_ATTESTATION_ACCEPTED_UNSAFE_SEARCH_PATH';
  end if;
end;
$test$;
rollback;

begin;
drop function public.patch83u_get_capabilities(uuid,text,text);
do $test$
begin
  if (public.patch83tu_catalog_contract_attestation() ->> 'overall_pass')::boolean then
    raise exception 'GATE7_ATTESTATION_ACCEPTED_MISSING_RPC';
  end if;
end;
$test$;
rollback;

begin;
alter table public.user_credential_states disable row level security;
do $test$
begin
  if (public.patch83tu_catalog_contract_attestation() ->> 'overall_pass')::boolean then
    raise exception 'GATE7_ATTESTATION_ACCEPTED_MISSING_RLS';
  end if;
end;
$test$;
rollback;
