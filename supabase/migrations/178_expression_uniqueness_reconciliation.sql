-- Production Gate 5 / migration 178
-- Reconcile expression-based uniqueness without rewriting or deleting data.

begin;

set local lock_timeout = '10s';
set local statement_timeout = '120s';

lock table public.v210_grc_relationships in share row exclusive mode;
lock table public.patch15_rpc_classification_reviews in share row exclusive mode;

do $migration$
begin
  if to_regclass('public.v210_grc_relationships') is null
     or to_regclass('public.patch15_rpc_classification_reviews') is null then
    raise exception using errcode = 'P0001',
      message = 'PATCH178_REQUIRED_TABLE_MISSING';
  end if;

  if exists (
    select 1
    from public.v210_grc_relationships
    group by source_type, coalesce(source_code, ''), relationship_type,
             target_type, coalesce(target_code, '')
    having count(*) > 1
  ) then
    raise exception using errcode = '23505',
      message = 'PATCH178_V210_DUPLICATE_EXPRESSION_KEY';
  end if;

  if exists (
    select 1
    from public.patch15_rpc_classification_reviews
    group by organization_id, rpc_name, coalesce(source_file, ''),
             coalesce(source_line, -1)
    having count(*) > 1
  ) then
    raise exception using errcode = '23505',
      message = 'PATCH178_PATCH15_DUPLICATE_EXPRESSION_KEY';
  end if;

  if to_regclass('public.idx_v210_grc_relationships_unique_codes') is not null
     and not exists (
       select 1
       from pg_catalog.pg_index i
       where i.indexrelid = to_regclass('public.idx_v210_grc_relationships_unique_codes')
         and i.indrelid = 'public.v210_grc_relationships'::regclass
         and i.indisunique and i.indisvalid and i.indisready
         and pg_catalog.pg_get_indexdef(i.indexrelid) =
           'CREATE UNIQUE INDEX idx_v210_grc_relationships_unique_codes ON public.v210_grc_relationships USING btree (source_type, COALESCE(source_code, ''''::text), relationship_type, target_type, COALESCE(target_code, ''''::text))'
     ) then
    raise exception using errcode = 'P0001',
      message = 'PATCH178_V210_CONFLICTING_INDEX';
  end if;

  if to_regclass('public.idx_patch15_rpc_classification_reviews_unique_source') is not null
     and not exists (
       select 1
       from pg_catalog.pg_index i
       where i.indexrelid = to_regclass('public.idx_patch15_rpc_classification_reviews_unique_source')
         and i.indrelid = 'public.patch15_rpc_classification_reviews'::regclass
         and i.indisunique and i.indisvalid and i.indisready
         and pg_catalog.pg_get_indexdef(i.indexrelid) =
           'CREATE UNIQUE INDEX idx_patch15_rpc_classification_reviews_unique_source ON public.patch15_rpc_classification_reviews USING btree (organization_id, rpc_name, COALESCE(source_file, ''''::text), COALESCE(source_line, ''-1''::integer))'
     ) then
    raise exception using errcode = 'P0001',
      message = 'PATCH178_PATCH15_CONFLICTING_INDEX';
  end if;
end;
$migration$;

create unique index if not exists idx_v210_grc_relationships_unique_codes
  on public.v210_grc_relationships
  using btree (
    source_type,
    coalesce(source_code, ''::text),
    relationship_type,
    target_type,
    coalesce(target_code, ''::text)
  );

create unique index if not exists idx_patch15_rpc_classification_reviews_unique_source
  on public.patch15_rpc_classification_reviews
  using btree (
    organization_id,
    rpc_name,
    coalesce(source_file, ''::text),
    coalesce(source_line, '-1'::integer)
  );

comment on index public.idx_v210_grc_relationships_unique_codes is
  'Patch 178 canonical expression uniqueness for framework relationship codes; duplicate rows fail closed.';
comment on index public.idx_patch15_rpc_classification_reviews_unique_source is
  'Patch 178 canonical expression uniqueness for RPC classification source locations; duplicate rows fail closed.';

commit;
