import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  analyzePatch83uAuthSurface,
  analyzeRepository,
} from '../../scripts/patch83u-auth-surface-proof.mjs';

const credentialGateSql = `
create or replace function public.patch83u_credential_access_allowed()
returns boolean language sql stable as $$ select true $$;
do $patch83u_rls$
begin
  perform 1 from pg_catalog.pg_class where relrowsecurity = true;
  execute 'create policy patch83u_credential_gate on public.items as restrictive for all to authenticated using (public.patch83u_credential_access_allowed()) with check (public.patch83u_credential_access_allowed())';
end;
$patch83u_rls$;
create policy patch83u_profile_credential_read_gate
on public.profiles as restrictive for select to authenticated
using (public.patch83u_credential_access_allowed());
`;

describe('Patch 83U authenticated surface release proof', () => {
  const expectedLegacyBrowserBaseTables = [
    'automation_rules',
    'automation_run_log',
    'consolidation_defect_log',
    'consolidation_defects',
    'consolidation_patch_manifest',
    'cutover_freeze_windows',
    'executive_exception_rules',
    'final_handover_signoffs',
    'go_live_rehearsals',
    'go_live_sop_steps',
    'kri_observations',
    'load_test_seed_batches',
    'migration_runbook_entries',
    'pilot_fix_sprints',
    'pilot_issues',
    'pilot_participants',
    'pilot_rollout_acceptance',
    'pilot_signoffs',
    'pilot_waves',
    'production_operator_daily_log',
    'production_pilot_waves',
    'production_proof_gates',
    'production_support_handover',
    'real_data_repair_queue',
    'recurring_reviews',
    'staging_validation_check_results',
    'staging_validation_cycles',
    'v50_query_optimization_items',
    'v50_scale_test_plans',
  ].sort();

  it('fails closed for direct RPCs, SECURITY DEFINER functions, owner views, and materialized views', () => {
    const report = analyzePatch83uAuthSurface({
      migrationFiles: [{
        path: 'supabase/migrations/001_fixture.sql',
        text: `
          create table public.items(id uuid);
          alter table public.items enable row level security;
          create view public.v_owner as select * from public.items;
          grant select on public.v_owner to authenticated;
          create materialized view public.mv_rollup as select count(*) from public.items;
          grant select on public.mv_rollup to authenticated;
          create function public.danger() returns integer language sql security definer as $$ select 1 $$;
          ${credentialGateSql}
        `,
      }],
      sourceFiles: [{
        path: 'src/fixture.ts',
        text: `
          supabase.rpc('danger');
          supabase.from('v_owner').select('*');
        `,
      }],
      registrySource: `
        { actionName: 'danger', actionTransport: 'direct_browser_rpc', reviewStatus: 'pending_review', directBrowserException: true }
      `,
      deployedFunctionInventory: {
        functions: [{
          schema: 'public',
          function_name: 'catalog_danger',
          function_signature: 'public.catalog_danger()',
          security_definer: true,
          public_execute: true,
          anon_execute: true,
          authenticated_execute: true,
          final_category: 'unsafe_privileged_write',
        }],
      },
    });

    expect(report.status).toBe('fail');
    expect(report.findings.map((finding: { code: string }) => finding.code)).toEqual(expect.arrayContaining([
      'EXPOSED_SECURITY_DEFINER_RPC',
      'DIRECT_BROWSER_RPC_EXCEPTION_REMAINS',
      'OWNER_EXECUTED_VIEW',
      'UNAPPROVED_BROAD_SECURITY_DEFINER_RPC',
      'AUTHENTICATED_MATERIALIZED_VIEW_EXPOSURE',
    ]));
  });

  it('passes a SECURITY INVOKER, RLS-gated view surface with search behind the caller-JWT Edge bridge', () => {
    const report = analyzePatch83uAuthSurface({
      migrationFiles: [{
        path: 'supabase/migrations/001_fixture.sql',
        text: `
          create table public.items(id uuid);
          alter table public.items enable row level security;
          create table public.profiles(id uuid);
          alter table public.profiles enable row level security;
          create view public.v_document_center_items with (security_invoker = true) as select * from public.items;
          grant select on public.v_document_center_items to authenticated;
          create view public.v_global_search_index with (security_invoker = true) as select * from public.v_document_center_items;
          grant select on public.v_global_search_index to authenticated;
          create view public.v_safe with (security_invoker = true) as select * from public.items;
          grant select on public.v_safe to authenticated;
          create function public.search_grc_global(p_query text, p_limit integer default 50)
          returns setof public.items language sql security invoker as $$ select * from public.v_global_search_index $$;
          ${credentialGateSql}
        `,
      }],
      sourceFiles: [{
        path: 'src/fixture.ts',
        text: `
          invokePrivilegedAction('search_grc_global', { query: 'risk' });
          supabase.from('v_safe').select('*');
        `,
      }],
      registrySource: `
        { actionName: 'search_grc_global', actionTransport: 'authenticated_edge_bridge', reviewStatus: 'approved', directBrowserException: false }
      `,
      edgeSource: `
        const allowedActions = new Set(['search_grc_global']);
        if (action !== 'patch83u_change_required_password' && credentialState.access_allowed !== true) throw new Error('denied');
        if (action === 'search_grc_global') {
          const rlsClient = createClient(supabaseUrl, anonKey, {
            global: { headers: { Authorization: \`Bearer \${token}\` } },
          });
          return rlsClient.rpc('search_grc_global', {});
        }
      `,
    });

    expect(report.status).toBe('pass');
    expect(report.summary.direct_browser_rpc_count).toBe(0);
    expect(report.summary.direct_browser_materialized_view_count).toBe(0);
    expect(report.search_grc_global.disposition).toBe('authenticated_edge_bridge_with_caller_jwt_rls');
    expect(report.direct_browser_views[0]).toMatchObject({
      security_invoker: true,
      owner_bypass_prevented: true,
      authenticated_grant_intentional: true,
      disposition: 'approved_browser_read_view',
    });
  });

  it('fails closed when a future migration introduces an unaudited SECURITY DEFINER routine', () => {
    const report = analyzePatch83uAuthSurface({
      migrationFiles: [{
        path: 'supabase/migrations/175_future_fixture.sql',
        text: `
          create function public.future_browser_helper()
          returns integer language sql security definer as $$ select 1 $$;
        `,
      }],
      sourceFiles: [],
    });

    expect(report.acl_reachable_security_definer_rpcs.target_migrations_171_plus)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          name: 'future_browser_helper',
          source: 'future_migration_requires_review',
          allowed: false,
        }),
      ]));
    expect(report.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'UNAPPROVED_BROAD_SECURITY_DEFINER_RPC',
        object: 'future_browser_helper',
      }),
    ]));
    expect(report.status).toBe('fail');
  });

  it('proves the target repository leaves no direct RPC exception and credential-locks global search through RLS', () => {
    const report = analyzeRepository(path.resolve(process.cwd()));

    expect(report.summary.direct_browser_rpc_count).toBe(0);
    expect(report.summary.direct_browser_materialized_view_count).toBe(0);
    expect(report.search_grc_global.registry).toMatchObject({
      transport: 'authenticated_edge_bridge',
      direct_browser_exception: false,
    });
    expect(report.search_grc_global.rpc_security_modes).toEqual(['security_invoker']);
    expect(Object.values(report.search_grc_global.caller_jwt_rls_proof).every(Boolean)).toBe(true);
    expect(report.search_grc_global.dependency_view.base_tables.length).toBeGreaterThan(0);
    expect(report.search_grc_global.dependency_view.base_tables.every(
      (table: { rls_enabled: boolean; credential_gate_targeted: boolean }) => table.rls_enabled && table.credential_gate_targeted,
    )).toBe(true);
    expect(report.search_grc_global.disposition).toBe('authenticated_edge_bridge_with_caller_jwt_rls');
    expect(report.summary.retained_live_broad_security_definer_count).toBe(2);
    expect(report.summary.target_broad_security_definer_count).toBe(3);
    expect(report.acl_reachable_security_definer_rpcs.retained_live.every(
      (rpc: { allowed: boolean }) => rpc.allowed,
    )).toBe(true);
    expect(report.acl_reachable_security_definer_rpcs.target_migrations_171_plus.every(
      (rpc: { allowed: boolean }) => rpc.allowed,
    )).toBe(true);
    expect(report.summary.acl_reachable_materialized_view_count).toBe(0);
    expect(report.summary.authenticated_materialized_view_fail_closed_present).toBe(true);
    expect(report.summary.authenticated_view_catalog_hardening_present).toBe(true);
    expect(report.summary.legacy_browser_base_table_hardening_count).toBe(29);
    expect(report.legacy_browser_base_table_hardening.map(
      (table: { name: string }) => table.name,
    )).toEqual(expectedLegacyBrowserBaseTables);
    expect(report.legacy_browser_base_table_hardening.every(
      (table: { rls_enabled: boolean; authenticated_select_grant: boolean; credential_policy: string }) =>
        table.rls_enabled
        && table.authenticated_select_grant
        && table.credential_policy.startsWith('credential_active'),
    )).toBe(true);
    expect(report.summary.non_rls_base_table_count).toBe(0);
    expect(report.status).toBe('pass');
  });
});
