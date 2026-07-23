-- Production Gate 5 / migration 182
-- Close legacy operational evidence tables to browser roles. Repository searches
-- found no frontend or Edge dependency; approved access model is protected
-- service-role/RPC access only. No row data is changed.

begin;
set local lock_timeout = '10s';
set local statement_timeout = '120s';

do $migration$
declare
  v_table text;
  v_view text;
  v_tables constant text[] := array[
    'company_rollout_waves',
    'final_go_live_stop_rules',
    'final_pilot_signoff_matrix',
    'final_validation_runs',
    'i18n_translation_coverage_items',
    'mock_data_allowlist',
    'phased_auto_test_cases',
    'phased_auto_test_phases',
    'phased_auto_test_results',
    'phased_auto_test_runs',
    'pilot_execution_runs',
    'pilot_feedback_items',
    'pilot_fix_sprint_items',
    'production_data_switchovers',
    'production_empty_state_checks',
    'production_exception_register_v58',
    'rtl_visual_qa_items',
    'v50_scale_test_results'
  ];
  v_views constant text[] := array[
    'v_v38_final_readiness_scorecard',
    'v_v46_language_rtl_readiness',
    'v_v46_production_hardening_scorecard',
    'v_v58_overall_production_readiness',
    'v_v58_pilot_readiness_scorecard',
    'v_v58_rollout_readiness_scorecard',
    'v_v59_latest_phase_results',
    'v_v59_phase_test_scorecard',
    'v_v59_production_data_readiness',
    'v_v60_empty_state_readiness'
  ];
begin
  foreach v_table in array v_tables loop
    if not exists (
      select 1 from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = v_table and c.relkind in ('r','p')
    ) then
      raise exception using errcode = 'P0001',
        message = 'PATCH182_REQUIRED_TABLE_MISSING', detail = v_table;
    end if;

    if exists (
      select 1 from pg_catalog.pg_policy p
      join pg_catalog.pg_class c on c.oid = p.polrelid
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = v_table
    ) then
      raise exception using errcode = 'P0001',
        message = 'PATCH182_UNEXPECTED_EXISTING_POLICY', detail = v_table;
    end if;
  end loop;

  foreach v_view in array v_views loop
    if not exists (
      select 1 from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = v_view and c.relkind = 'v'
    ) then
      raise exception using errcode = 'P0001',
        message = 'PATCH182_DEPENDENT_VIEW_MISSING', detail = v_view;
    end if;
  end loop;

  foreach v_table in array v_tables loop
    execute format('alter table public.%I enable row level security', v_table);
    execute format('alter table public.%I force row level security', v_table);
    execute format('revoke all privileges on table public.%I from public, anon, authenticated', v_table);
    execute format('revoke all privileges on table public.%I from service_role', v_table);
    execute format('grant select, insert, update, delete on table public.%I to service_role', v_table);
    execute format(
      'comment on table public.%I is %L',
      v_table,
      'Patch 182 legacy-table hardening: FORCE RLS; no direct browser access; service-role/protected-RPC CRUD only. Gate 4 remediation.'
    );
  end loop;

  -- These owner-rights legacy views can transitively expose the remediated tables.
  -- Close browser ACLs instead of depending on view-owner RLS behavior.
  foreach v_view in array v_views loop
    execute format('revoke all privileges on table public.%I from public, anon, authenticated', v_view);
    execute format('revoke all privileges on table public.%I from service_role', v_view);
    execute format('grant select on table public.%I to service_role', v_view);
    execute format(
      'comment on view public.%I is %L',
      v_view,
      'Patch 182 protected legacy evidence view: service-role/protected-RPC read only; browser access revoked.'
    );
  end loop;
end;
$migration$;

commit;
