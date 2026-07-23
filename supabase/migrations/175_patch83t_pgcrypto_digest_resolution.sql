-- Patch 83T.1: resolve pgcrypto digest from the managed extensions schema.
-- Database-only compatibility correction after hosted staging proof.

do $$
begin
  if pg_catalog.to_regprocedure(
       'extensions.digest(bytea,text)'
     ) is null then
    raise exception 'PATCH83T_PGCRYPTO_DIGEST_REQUIRED';
  end if;

  if pg_catalog.has_schema_privilege(
       'anon',
       'extensions',
       'CREATE'
     )
     or pg_catalog.has_schema_privilege(
       'authenticated',
       'extensions',
       'CREATE'
     )
  then
    raise exception 'PATCH83T_EXTENSIONS_SCHEMA_NOT_TRUSTED';
  end if;
end
$$;

alter function public.patch83t_apply_user_excel_import(
  uuid,
  jsonb
)
set search_path = pg_catalog, extensions, public, pg_temp;

comment on function public.patch83t_apply_user_excel_import(
  uuid,
  jsonb
) is
'Patch 83T atomic organization-scoped User Excel Import. Patch 83T.1 adds the trusted extensions schema so the pgcrypto SHA-256 digest resolves in hosted Supabase.';