import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.resolve('supabase/migrations/053_v110_enterprise_grc_program_suite.sql');
const releaseDir = path.resolve('release/v110');
fs.mkdirSync(releaseDir, { recursive: true });

if (!fs.existsSync(migrationPath)) {
  throw new Error(`Missing migration: ${migrationPath}`);
}

const sql = fs.readFileSync(migrationPath, 'utf8');
const requiredTables = [
  'v110_policy_documents',
  'v110_policy_versions',
  'v110_policy_attestations',
  'v110_training_courses',
  'v110_training_assignments',
  'v110_vendor_profiles',
  'v110_vendor_risk_assessments',
  'v110_kri_definitions',
  'v110_kri_measurements',
  'v110_regulatory_change_events',
  'v110_exception_acceptances',
  'v110_business_processes',
  'v110_business_continuity_plans',
  'v110_continuity_exercises',
  'v110_audit_followup_reviews',
  'v110_board_report_snapshots',
  'v110_program_maturity_assessments'
];
const requiredViews = [
  'v110_enterprise_grc_maturity_dashboard',
  'v110_due_diligence_calendar',
  'v110_board_pack_readiness_view'
];
const requiredEnums = [
  'v110_policy_status',
  'v110_attestation_status',
  'v110_training_status',
  'v110_vendor_risk_rating',
  'v110_bcp_status',
  'v110_kri_trend',
  'v110_exception_status',
  'v110_reg_change_status',
  'v110_report_status'
];

const findings = [];
for (const table of requiredTables) {
  if (!sql.includes(`create table if not exists public.${table}`)) {
    findings.push({ severity: 'high', type: 'missing_table', table });
  }
  if (!sql.includes(`alter table public.${table} enable row level security`)) {
    findings.push({ severity: 'high', type: 'missing_rls_enable', table });
  }
  if (!sql.includes(`grant select, insert, update on public.${table} to authenticated`)) {
    findings.push({ severity: 'medium', type: 'missing_expected_grant', table });
  }
}
for (const view of requiredViews) {
  if (!sql.includes(`view public.${view}`)) {
    findings.push({ severity: 'high', type: 'missing_view', view });
  }
}
for (const enumName of requiredEnums) {
  if (!sql.includes(enumName)) {
    findings.push({ severity: 'medium', type: 'missing_enum', enumName });
  }
}

const forbidden = [
  { needle: 'grant delete', reason: 'No authenticated delete grants should be introduced in v11.0.' },
  { needle: 'service_role', reason: 'No service-role references should be introduced in v11.0 migration.' },
  { needle: 'disable row level security', reason: 'RLS must not be disabled.' }
];
for (const item of forbidden) {
  if (sql.toLowerCase().includes(item.needle)) {
    findings.push({ severity: 'critical', type: 'forbidden_sql', needle: item.needle, reason: item.reason });
  }
}

const securityInvokerCount = (sql.match(/with \(security_invoker = true\)/gi) || []).length;
if (securityInvokerCount < requiredViews.length) {
  findings.push({ severity: 'medium', type: 'missing_security_invoker_views', securityInvokerCount });
}

const report = {
  generated_at: new Date().toISOString(),
  status: findings.some(f => f.severity === 'critical' || f.severity === 'high') ? 'failed' : 'passed',
  migration: 'supabase/migrations/053_v110_enterprise_grc_program_suite.sql',
  required_tables: requiredTables.length,
  required_views: requiredViews.length,
  required_enums: requiredEnums.length,
  security_invoker_views_detected: securityInvokerCount,
  findings_count: findings.length,
  findings
};

fs.writeFileSync(path.join(releaseDir, 'v110-enterprise-static-audit.json'), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(releaseDir, 'v110-enterprise-static-audit.md'), `# v11.0 Enterprise Static Audit\n\n- Generated: ${report.generated_at}\n- Status: **${report.status}**\n- Required tables: ${report.required_tables}\n- Required views: ${report.required_views}\n- Security-invoker views detected: ${report.security_invoker_views_detected}\n- Findings: ${report.findings_count}\n\n${findings.length ? '## Findings\n\n' + findings.map(f => `- ${f.severity}: ${f.type} ${f.table || f.view || f.enumName || f.needle || ''}`).join('\n') : 'No blocking findings.'}\n`);

console.log('v11.0 enterprise static audit complete.');
console.log(JSON.stringify({ status: report.status, findings_count: report.findings_count, report: 'release/v110/v110-enterprise-static-audit.json' }, null, 2));
if (report.status !== 'passed') process.exit(1);
