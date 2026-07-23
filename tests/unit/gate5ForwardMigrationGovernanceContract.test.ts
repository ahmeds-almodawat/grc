import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../..');
const read = (file: string) => readFileSync(resolve(root, file), 'utf8');
const normalize = (value: string) => value.replace(/\s+/g, ' ').toLowerCase();

const migrations = {
  178: 'supabase/migrations/178_expression_uniqueness_reconciliation.sql',
  179: 'supabase/migrations/179_real_data_activation_view_reconciliation.sql',
  180: 'supabase/migrations/180_runtime_action_authorization_reconciliation.sql',
  181: 'supabase/migrations/181_patch83tu_catalog_contract_attestation.sql',
  182: 'supabase/migrations/182_legacy_public_table_rls_and_privilege_hardening.sql',
} as const;

const migrationHashes = {
  178: 'fecadb52184f9924a1bdb9daccf705df628fd761eab95f8ee70273e844b39ef8',
  179: '79a9d466f5f747a18574806e5bcb05c6931c725df795bb6d1635a184a4099633',
  180: '20c70be3138d1ccc65605a48e255c60c08c7ab24bd81727ff788f0496f821349',
  181: '7339da35ad00a1f23fe776fa7d0c4505812c93e597acbc9a0ce28705a886effb',
  182: '8dd8eaa3e6a6841069d84942e4c0d817f85e94a35541bf45b408a1eb21eb9588',
} as const;

const legacyTables = [
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
  'v50_scale_test_results',
] as const;

describe('Gate 5 forward migration governance contract', () => {
  it('binds exact migration numbers, filenames, and nonempty SHA-256 values', () => {
    expect(Object.keys(migrations)).toEqual(['178', '179', '180', '181', '182']);
    for (const [number, file] of Object.entries(migrations)) {
      expect(createHash('sha256').update(read(file)).digest('hex'))
        .toBe(migrationHashes[Number(number) as keyof typeof migrationHashes]);
    }
  });

  it('migration 178 rejects duplicates and reconciles exact expression indexes', () => {
    const sql = normalize(read(migrations[178]));
    expect(sql).toContain('patch178_v210_duplicate_expression_key');
    expect(sql).toContain('patch178_patch15_duplicate_expression_key');
    expect(sql).toContain('create unique index if not exists idx_v210_grc_relationships_unique_codes');
    expect(sql).toContain('create unique index if not exists idx_patch15_rpc_classification_reviews_unique_source');
    expect(sql).not.toMatch(/delete\s+from|update\s+public\./);
  });

  it('migration 179 uses the canonical security-invoker organization summary', () => {
    const sql = normalize(read(migrations[179]));
    expect(sql).toContain('view public.v_real_data_activation_summary');
    expect(sql).toContain('security_invoker = true');
    expect(sql).toContain('security_barrier = true');
    expect(sql).toContain('group by p.organization_id');
    expect(sql).toContain('grant select on public.v_real_data_activation_summary to authenticated, service_role');
  });

  it('migration 180 preserves credential gates and denies unknown actions', () => {
    const sql = normalize(read(migrations[180]));
    expect(sql.match(/patch83u_credential_gate/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(sql).toContain("r.classification <> 'unknown_requires_review'");
    expect(sql).toContain("r.review_status in ('approved', 'approved_with_limitation')");
    expect(sql).toContain("message = 'patch180_service_role_required'");
    expect(sql).toContain("s.signoff_status in ('approved', 'approved_with_limitation')");
    expect(sql).toContain("nullif(btrim(s.evidence_reference), '') is not null");
    expect(sql).toContain('force row level security');
    expect(sql).toContain('revoke all on table public.runtime_action_reviews from public, anon, authenticated');
    expect(sql).toContain('grant select on table public.runtime_action_reviews to authenticated');
    expect(sql).not.toMatch(/create\s+policy\s+patch45_runtime_action_(?:reviews|events)_write/);
    expect(sql).toContain('set search_path = pg_catalog, public, pg_temp');
    expect(sql).toContain('grant execute on function public.patch83v_runtime_action_authorized(text, text) to service_role');
  });

  it('migration 181 emits safe service-role-only catalog metadata', () => {
    const sql = normalize(read(migrations[181]));
    expect(sql).toContain('patch83tu_catalog_contract_attestation()');
    expect(sql).toContain("'safe_metadata_only', true");
    expect(sql).toContain('definition_sha256');
    expect(sql).toContain("'edge_service_rpc_count'");
    expect(sql).toContain("'overall_pass'");
    const requiredFunctionCte = sql.slice(
      sql.indexOf('with required_functions'),
      sql.indexOf('), function_contracts'),
    );
    expect(requiredFunctionCte.match(/'edge_service_rpc'/g)?.length ?? 0).toBe(24);
    expect(sql).toContain("('department_import_batches'::text, false)");
    expect(sql).toContain("('patch83u_runtime_control'::text, true)");
    expect(sql).not.toContain('patch83t_user_import_batches');
    expect(sql).toContain('revoke all on function public.patch83tu_catalog_contract_attestation() from public, anon, authenticated');
    expect(sql).toContain('grant execute on function public.patch83tu_catalog_contract_attestation() to service_role');
    expect(sql).toContain('public.patch83u_reconcile_last_super_admin_recovery(uuid,uuid,text,text)');
    expect(sql).toContain("'last_super_admin_recovery', 'owner_only'");
    expect(sql).toContain("'wrapper_calls_owner_only_implementation'");
    expect(sql).toContain('patch181_last_super_admin_recovery_security_mismatch');
    expect(sql).not.toContain('patch83u_last_eligible_super_admin_count');
    expect(sql).not.toMatch(/auth\.users|refresh_tokens|auth\.sessions|email\s*,|encrypted_password|password_hash/);
  });

  it('the faithful pre-178 fixture models only source-lined recovery objects', () => {
    const fixture = normalize(read('tests/sql/gate5_pre178_structural_fixture.sql'));
    const migration176 = normalize(read('supabase/migrations/176_patch83u_last_super_admin_recovery.sql'));
    expect(fixture).not.toMatch(/create\s+function\s+public\.patch83u_last_eligible_super_admin_count/);
    expect(fixture).toContain('public.patch83u_reconcile_last_super_admin_recovery');
    expect(fixture).toContain('public.patch83u_reconcile_credential_state');
    expect(migration176).toContain('public.patch83u_reconcile_last_super_admin_recovery');
    expect(migration176).toContain('public.patch83u_reconcile_credential_state');
  });

  it('binds the exact 24 Patch 83T/U RPC names invoked by the Edge service client', () => {
    const edge = read('supabase/functions/privileged-action/index.ts');
    const names = [...edge.matchAll(/serviceClient\.rpc(?:<[^>]*>)?\s*\(\s*['"](patch83[tu]_[^'"]+)['"]/g)]
      .map((match) => match[1]);
    expect(new Set(names).size).toBe(24);

    const sql = normalize(read(migrations[181]));
    for (const name of names) expect(sql).toContain(`public.${name}(`);
  });

  it('migration 182 binds all 18 tables to FORCE RLS and no-browser model A', () => {
    const sql = normalize(read(migrations[182]));
    expect(legacyTables).toHaveLength(18);
    for (const table of legacyTables) expect(sql).toContain(`'${table}'`);
    expect(sql).toContain('enable row level security');
    expect(sql).toContain('force row level security');
    expect(sql).toContain('from public, anon, authenticated');
    expect(sql).toContain('grant select, insert, update, delete on table public.%i to service_role');
    expect(sql).not.toMatch(/using\s*\(\s*true\s*\)|with check\s*\(\s*true\s*\)/);
    expect(sql).not.toMatch(/create\s+policy/i);
  });
});
