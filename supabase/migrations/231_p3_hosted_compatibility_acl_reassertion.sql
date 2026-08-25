-- P3 hosted compatibility ACL proof closure.
--
-- Migrations 227 and 228 replaced these SECURITY DEFINER routines while
-- preserving their existing ACLs. Reassert the intended service-role-only
-- and owner-only contracts explicitly so the ordered release proof does not
-- depend on inherited catalog state.

revoke all on function public.patch27_write_authority_event(
  uuid,
  uuid,
  text,
  text,
  text,
  uuid,
  text
) from public, anon, authenticated;
grant execute on function public.patch27_write_authority_event(
  uuid,
  uuid,
  text,
  text,
  text,
  uuid,
  text
) to service_role;

revoke all on function public.guard_staged_approval_mutations()
  from public, anon, authenticated, service_role;

do $$
begin
  if has_function_privilege('anon', 'public.patch27_write_authority_event(uuid,uuid,text,text,text,uuid,text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.patch27_write_authority_event(uuid,uuid,text,text,text,uuid,text)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.patch27_write_authority_event(uuid,uuid,text,text,text,uuid,text)', 'EXECUTE') then
    raise exception 'PATCH231_AUTHORITY_EVENT_ACL_REASSERTION_FAILED';
  end if;

  if has_function_privilege('anon', 'public.guard_staged_approval_mutations()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.guard_staged_approval_mutations()', 'EXECUTE')
     or has_function_privilege('service_role', 'public.guard_staged_approval_mutations()', 'EXECUTE') then
    raise exception 'PATCH231_STAGED_MUTATION_GUARD_ACL_REASSERTION_FAILED';
  end if;
end;
$$;
