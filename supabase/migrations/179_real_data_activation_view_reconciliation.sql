-- Production Gate 5 / migration 179
-- Restore the canonical organization-scoped real-data activation summary.

begin;
set local lock_timeout = '10s';
set local statement_timeout = '120s';

do $migration$
declare
  v_relation text;
begin
  foreach v_relation in array array[
    'real_data_activation_programs', 'real_data_dataset_catalog',
    'real_data_source_files', 'real_data_validation_results',
    'real_data_load_approvals', 'real_data_readiness_signoffs'
  ] loop
    if to_regclass(format('public.%I', v_relation)) is null then
      raise exception using errcode = 'P0001',
        message = 'PATCH179_REQUIRED_RELATION_MISSING', detail = v_relation;
    end if;
  end loop;

  if to_regclass('public.v_real_data_activation_summary') is not null
     and not exists (
       select 1 from pg_catalog.pg_class c
       join pg_catalog.pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relname = 'v_real_data_activation_summary'
         and c.relkind = 'v'
     ) then
    raise exception using errcode = 'P0001',
      message = 'PATCH179_DESTINATION_IS_NOT_A_VIEW';
  end if;
end;
$migration$;

create or replace view public.v_real_data_activation_summary
with (security_invoker = true, security_barrier = true)
as
select
  p.organization_id,
  count(distinct p.id)::integer as program_count,
  count(distinct p.id) filter (
    where p.activation_stage = any (array['validation','mapping','approval'])
  )::integer as active_program_count,
  count(distinct d.id)::integer as dataset_count,
  count(distinct d.id) filter (
    where d.dataset_status = any (array['approved','loaded','reconciled','signed_off'])
  )::integer as ready_dataset_count,
  count(distinct f.id)::integer as source_file_count,
  count(distinct f.id) filter (
    where f.license_status = 'blocked'
       or f.validation_status = any (array['failed','rejected'])
  )::integer as blocked_source_count,
  count(distinct vr.id) filter (
    where vr.result_status = 'open'
      and vr.severity = any (array['critical','high'])
  )::integer as high_open_validation_count,
  count(distinct a.id) filter (where a.approval_status = 'pending')::integer
    as pending_approval_count,
  count(distinct s.id) filter (
    where s.signoff_status = any (array['pending','conditional_approval'])
  )::integer as pending_signoff_count
from public.real_data_activation_programs p
left join public.real_data_dataset_catalog d on d.program_id = p.id
left join public.real_data_source_files f on f.program_id = p.id
left join public.real_data_validation_results vr
  on vr.organization_id = p.organization_id and vr.dataset_id = d.id
left join public.real_data_load_approvals a on a.program_id = p.id
left join public.real_data_readiness_signoffs s on s.program_id = p.id
group by p.organization_id;

revoke all on public.v_real_data_activation_summary from public, anon, authenticated;
revoke all on public.v_real_data_activation_summary from service_role;
grant select on public.v_real_data_activation_summary to authenticated, service_role;

comment on view public.v_real_data_activation_summary is
  'Patch 179 canonical security-invoker/barrier organization summary. Underlying RLS controls lifecycle and organization visibility.';

commit;
