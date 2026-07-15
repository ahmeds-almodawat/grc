import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function source(relativePath: string) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

function executableStatements(sql: string) {
  const withoutComments = sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\r\n]*/g, ' ');
  const withoutQuotedValues = withoutComments.replace(/'(?:''|[^'])*'/g, "''");
  return withoutQuotedValues
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);
}

describe('Patch 83T/83U release preflight and governance contracts', () => {
  it('keeps the release preflight strictly read-only', () => {
    const sql = source('supabase/tests/patch83tu_release_preflight.sql');
    const statements = executableStatements(sql);
    const mutationOrControlKeyword = /\b(?:insert|update|delete|merge|create|alter|drop|truncate|grant|revoke|comment|lock|call|do|copy|vacuum|analyze|refresh|reindex|cluster|set|reset|begin|commit|rollback)\b/i;

    expect(statements.length).toBeGreaterThan(10);
    for (const statement of statements) {
      expect(statement, statement.slice(0, 120)).toMatch(/^(?:select|with)\b/i);
      expect(statement, statement.slice(0, 120)).not.toMatch(mutationOrControlKeyword);
    }
    expect(sql).not.toMatch(/\bpg_(?:advisory|try_advisory)_lock\s*\(/i);
    expect(sql).not.toMatch(/\bfor\s+(?:no\s+key\s+)?update\b/i);
  });

  it('reports every mandatory migration and access-governance field', () => {
    const sql = source('supabase/tests/patch83tu_release_preflight.sql');
    const migration = source('supabase/migrations/174_patch83u_employee_id_auth_and_credential_governance.sql');
    const mandatoryFields = [
      'total_profiles',
      'total_auth_users',
      'total_auth_identities',
      'profiles_without_matching_auth_users',
      'auth_identities_with_missing_email',
      'auth_identities_with_unconfirmed_email',
      'predicted_legacy_verified_count',
      'predicted_employee_id_managed_count',
      'predicted_unverified_count',
      'active_users_predicted_reconciliation_required',
      'active_roles_with_invalid_tenant_or_hierarchy_shape',
      'active_roles_without_valid_credential_identity',
      'predicted_eligible_global_super_admin_count',
      'would_lose_last_eligible_super_admin',
      'case_insensitive_employee_id_collisions',
      'synthetic_auth_email_collisions',
      'rls_enabled_public_tables',
      'authenticated_executable_rpcs',
      'authenticated_selectable_views',
      'estimated_total_rows_touched',
    ];

    for (const field of mandatoryFields) expect(sql).toContain(field);
    expect(migration).toContain('create or replace function public.patch83u_role_assignment_valid');
    expect(sql).toContain("when ur.scope = 'global'");
    expect(sql).toContain("when ur.scope = 'division'");
    expect(sql).toContain("when ur.scope = 'department'");
    expect(sql).toContain("when ur.scope = 'unit'");
    expect(sql).toContain("when ur.scope = 'assigned_only'");
    expect(sql).toContain("u.email_confirmed_at is not null");
    expect(sql).toContain("u.raw_app_meta_data ->> 'credential_version'");
  });

  it('covers every required operating procedure and coordinated release boundary', () => {
    const runbook = source('release/patch83u/patch83u-operational-runbook.md');
    for (const heading of [
      '## Provisioning',
      '## Login instructions',
      '## First password change',
      '## Unclaimed accounts',
      '## Suspected takeover',
      '## Failed login',
      '## Super Admin reset',
      '## Session revocation',
      '## Reconciliation',
      '## Monitoring',
      '## Emergency disablement',
      '## Coordinated migration, Edge, and frontend deployment order',
    ]) {
      expect(runbook).toContain(heading);
    }
    expect(runbook).toMatch(/migration 173[\s\S]*migration 174[\s\S]*Edge[\s\S]*frontend/i);
    expect(runbook).toContain('Do not work around a credential lock');
    expect(runbook).toContain('no target `auth.sessions` rows remain');
  });

  it('states the initial-password risk, compensating controls, and mandatory decision fields', () => {
    const risk = source('release/patch83u/patch83u-risk-acceptance.md');

    expect(risk).toContain('Employee ID is the initial password');
    expect(risk).toMatch(/Five-digit Employee IDs may be accepted[\s\S]*only if the hosted Supabase password policy allows them/i);
    expect(risk).toContain('First-login takeover is possible');
    expect(risk).toMatch(/Forced first-login password change reduces but does not eliminate the risk/i);
    expect(risk).toContain('No National ID or Iqama is used');
    expect(risk).toContain('## Required compensating controls');

    for (const field of [
      '| Approver |',
      '| Decision |',
      '| Scope |',
      '| Review date |',
      '| Expiry date |',
      '| Rollback trigger |',
    ]) {
      expect(risk).toContain(field);
    }
    expect(risk).toContain('This record is **not approved**');
  });
});
