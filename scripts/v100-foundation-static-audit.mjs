#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.resolve('supabase/migrations/052_v100_unified_capa_risk_control_foundation.sql');
const releaseDir = path.resolve('release/v100');
fs.mkdirSync(releaseDir, { recursive: true });

const result = {
  generated_at: new Date().toISOString(),
  status: 'passed',
  migration: 'supabase/migrations/052_v100_unified_capa_risk_control_foundation.sql',
  required_tables: [],
  required_views: [],
  rls_tables: [],
  grants_checked: [],
  forbidden_patterns: [],
  findings: [],
};

function fail(message) {
  result.status = 'failed';
  result.findings.push(message);
}

if (!fs.existsSync(migrationPath)) {
  fail(`Missing migration file: ${migrationPath}`);
} else {
  const sql = fs.readFileSync(migrationPath, 'utf8');
  const normalized = sql.toLowerCase();
  const requiredTables = [
    'control_library_items',
    'risk_control_mappings',
    'control_tests',
    'capa_cases',
    'capa_action_items',
    'grc_issue_register',
    'compliance_obligations',
    'compliance_obligation_mappings',
    'audit_universe_items',
    'audit_engagements',
    'audit_workpapers',
  ];
  const requiredViews = [
    'v100_risk_control_capa_dashboard',
    'v100_overdue_capa_actions',
    'v100_control_test_effectiveness_summary',
  ];

  for (const table of requiredTables) {
    const createFound = normalized.includes(`create table if not exists public.${table}`);
    const rlsFound = normalized.includes(`alter table public.${table} enable row level security`);
    const grantFound = normalized.includes(`grant select, insert, update on public.${table} to authenticated`);
    result.required_tables.push({ table, create_found: createFound });
    result.rls_tables.push({ table, rls_found: rlsFound });
    result.grants_checked.push({ table, grant_found: grantFound });
    if (!createFound) fail(`Missing create table statement for ${table}`);
    if (!rlsFound) fail(`Missing RLS enable statement for ${table}`);
    if (!grantFound) fail(`Missing authenticated select/insert/update grant for ${table}`);
  }

  for (const view of requiredViews) {
    const found = normalized.includes(`create or replace view public.${view}`);
    const invoker = normalized.includes(`view public.${view}\nwith (security_invoker = true)`);
    result.required_views.push({ view, create_found: found, security_invoker_found: invoker });
    if (!found) fail(`Missing view ${view}`);
    if (!invoker) fail(`View ${view} is missing security_invoker=true`);
  }

  const forbiddenPatterns = [
    'service_role',
    'release/v674/approvals',
    'pilot-signoff.json',
    'ovr-confidentiality-confirmation.json',
    'disable row level security',
    'grant delete on',
    'grant all on',
  ];
  for (const pattern of forbiddenPatterns) {
    const present = normalized.includes(pattern);
    result.forbidden_patterns.push({ pattern, present });
    if (present) fail(`Forbidden pattern detected: ${pattern}`);
  }

  const expectedAlteredTables = ['public.risks', 'public.risk_controls', 'public.compliance_items', 'public.audit_findings'];
  for (const table of expectedAlteredTables) {
    if (!normalized.includes(`alter table if exists ${table}`)) {
      fail(`Expected safe ALTER TABLE extension missing for ${table}`);
    }
  }
}

const jsonPath = path.join(releaseDir, 'v100-foundation-static-audit.json');
const mdPath = path.join(releaseDir, 'v100-foundation-static-audit.md');
fs.writeFileSync(jsonPath, `${JSON.stringify(result, null, 2)}\n`);
fs.writeFileSync(mdPath, `# v10.0 Foundation Static Audit\n\n- Generated: ${result.generated_at}\n- Status: **${result.status}**\n- Migration: \`${result.migration}\`\n- Required tables checked: ${result.required_tables.length}\n- Required views checked: ${result.required_views.length}\n- Findings: ${result.findings.length}\n\n## Findings\n\n${result.findings.length ? result.findings.map((f) => `- ${f}`).join('\n') : '- None'}\n`);

console.log('v10.0 foundation static audit complete.');
console.log(JSON.stringify({ status: result.status, findings_count: result.findings.length, report: 'release/v100/v100-foundation-static-audit.json' }, null, 2));
process.exit(result.status === 'passed' ? 0 : 1);
