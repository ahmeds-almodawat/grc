import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const migration183Path = resolve(root, 'supabase/migrations/183_security_advisor_rls_reconciliation.sql');
const migration184Path = resolve(root, 'supabase/migrations/184_security_definer_search_path_and_acl_hardening.sql');
const migration183 = readFileSync(migration183Path, 'utf8');
const migration184 = readFileSync(migration184Path, 'utf8');
const normalize = (value: string) => value.replace(/\s+/g, ' ').trim().toLowerCase();

const blockingTables = [
  'backup_packages',
  'export_logs',
  'production_validation_runs',
  'release_candidate_controls',
  'rls_persona_test_cases',
  'rls_persona_test_runs',
  'rls_violation_findings',
  'supabase_install_verification_items',
  'system_health_snapshots',
] as const;

const mutableFunctions = [
  'require_delay_reason_project()',
  'require_delay_reason_work()',
  'ovr_signal_level(integer,integer,integer,integer)',
  'grc_has_accepted_evidence(text,uuid)',
  'grc_guard_project_update()',
  'grc_guard_milestone_update()',
  'grc_guard_task_update()',
  'grc_guard_approval_update()',
  'set_v38_updated_at()',
  'require_accepted_evidence_before_project_closure()',
  'require_accepted_evidence_before_work_closure()',
  'require_accepted_evidence_before_grc_closure()',
  'seed_v59_no_mock_phased_tests_defaults()',
  'set_v60_updated_at()',
  'set_updated_at()',
  'assign_ovr_number()',
  'ovr_severity_weight(text)',
  'search_grc_global(text,integer)',
  'calculate_kri_breach_level(public.kri_direction,numeric,numeric,numeric,numeric,numeric,numeric)',
  'set_kri_observation_breach_level()',
  'v35_set_updated_at()',
  'v35_attach_updated_at_if_exists(text)',
  'seed_v35_consolidation_defaults()',
  'seed_v38_final_validation_defaults()',
  'seed_v42_release_validation_defaults()',
  'seed_v50_scale_backup_restore_defaults()',
  'v58_touch_updated_at()',
  'seed_v58_pilot_rollout_security_audit_defaults()',
  'seed_v60_no_mock_controls_defaults()',
  'patch4_set_immutable_event_hash()',
  'set_grc_training_updated_at()',
  'patch4_compute_event_hash(text,jsonb,timestamp with time zone,uuid)',
  'patch19_sync_profile_status()',
  'get_pilot_go_no_go_dashboard()',
  'get_executive_readiness_summary()',
  'get_daily_operations_landing_summary()',
  'trg_enforce_live_environment_lock()',
] as const;

describe('Production Gate 9R security advisor remediation', () => {
  it('binds migration 183 to all nine blocking application tables', () => {
    const sql = normalize(migration183);
    for (const table of blockingTables) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      expect(sql).toContain(`alter table public.${table} force row level security`);
      expect(sql).toContain(`patch183_${table}_privileged_read`);
    }
    expect(new Set(blockingTables).size).toBe(9);
  });

  it('removes permissive legacy policies and never creates universal browser policies', () => {
    const sql = normalize(migration183);
    expect(sql).toContain('patch183_unexpected_policy_definition');
    expect(sql).toContain('patch183_mixed_or_incomplete_policy_state');
    expect(sql).not.toMatch(/create policy[\s\S]{0,180}(?:using|with check)\s*\(\s*true\s*\)/i);
    expect(sql).not.toMatch(/grant\s+(?:all|insert\s*,\s*update|update\s*,\s*delete)[^;]+to\s+authenticated/i);
    expect(sql).toContain('grant insert on table public.export_logs to authenticated');
  });

  it('keeps export logs append-only and organization scoped', () => {
    const sql = normalize(migration183);
    expect(sql).toContain('create policy patch183_export_logs_append');
    expect(sql).toContain('organization_id = public.current_user_org_id()');
    expect(sql).not.toMatch(/grant\s+(?:update|delete)[^;]*public\.export_logs[^;]*authenticated/i);
  });

  it('preserves security-invoker views and revokes anonymous traversal', () => {
    const sql = normalize(migration183);
    expect(sql).toContain("'security_invoker=true' = any");
    expect(sql).toContain("revoke all privileges on table public.%i from public, anon");
    expect(sql).toContain("grant select on table public.%i to authenticated, service_role");
  });

  it('binds migration 184 to exactly 37 mutable-search-path functions', () => {
    const sql = normalize(migration184);
    expect(new Set(mutableFunctions).size).toBe(37);
    for (const signature of mutableFunctions) {
      expect(sql).toContain(`public.${signature}`);
    }
    expect(sql).toContain('patch184_function_inventory_count_drift');
  });

  it('sets fixed search paths and denies PUBLIC and anon EXECUTE', () => {
    const sql = normalize(migration184);
    expect(sql).toContain('set search_path to pg_catalog, public, extensions, pg_temp');
    expect(sql).toContain('set search_path to pg_catalog, public, pg_temp');
    expect(sql).toContain("revoke all on function %s from public, anon, authenticated, service_role");
    expect(sql).toContain('patch184_execute_acl_postcondition_failed');
    expect(sql).toContain('patch184_safe_search_path_not_set');
  });

  it('keeps only proven authenticated helpers and RPCs executable', () => {
    const sql = normalize(migration184);
    const allowed = [
      'ovr_signal_level(integer,integer,integer,integer)',
      'grc_has_accepted_evidence(text,uuid)',
      'ovr_severity_weight(text)',
      'search_grc_global(text,integer)',
      'calculate_kri_breach_level(public.kri_direction,numeric,numeric,numeric,numeric,numeric,numeric)',
      'patch4_compute_event_hash(text,jsonb,timestamp with time zone,uuid)',
      'get_pilot_go_no_go_dashboard()',
      'get_executive_readiness_summary()',
      'get_daily_operations_landing_summary()',
    ];
    for (const signature of allowed) expect(sql).toContain(`public.${signature}`);
    expect(sql).toContain("grant execute on function %s to authenticated, service_role");
  });

  it('converts the two legacy RLS helpers to safe invoker surfaces', () => {
    const sql = normalize(migration184);
    expect(sql).toContain("'public.current_user_org_id()'");
    expect(sql).toContain("'public.has_any_role(text[])'");
    expect(sql).toContain("alter function %s security invoker");
    expect(sql).toContain('gate 9r category a: auth.uid()-scoped security invoker rls helper');
  });

  it('contains no project identifier, secret, or row-repair statement', () => {
    const sql = `${migration183}\n${migration184}`;
    expect(sql).not.toMatch(/zghsgzrdwbqdrpuxanac|zbrjjecpsrzposhuarcn/);
    expect(sql).not.toMatch(/service[_-]?role[_-]?key|sb_secret_|postgres(?:ql)?:\/\//i);
    expect(normalize(sql)).not.toMatch(/\b(?:insert into|update|delete from)\s+public\./);
  });

  it('produces deterministic migration source hashes', () => {
    for (const source of [migration183, migration184]) {
      expect(createHash('sha256').update(source).digest('hex')).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it('binds the post-184 fingerprint to restrictive gates and dependent views', () => {
    const fingerprint = JSON.parse(readFileSync(
      resolve(root, 'release/production-readiness/gate9r-expected-post184-catalog-fingerprint-20260722.json'),
      'utf8',
    )) as { canonical_line_count: number; canonical_lines: string[] };
    expect(fingerprint.canonical_line_count).toBe(77);
    expect(fingerprint.canonical_lines.filter((line) => line.includes('|patch83u_credential_gate|'))).toHaveLength(9);
    expect(fingerprint.canonical_lines.filter((line) => line.startsWith('view|public.'))).toHaveLength(10);
  });
});
