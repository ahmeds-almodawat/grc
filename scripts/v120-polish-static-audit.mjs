import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.join('supabase', 'migrations', '054_v120_operational_polish_data_quality_suite.sql');
const cssPath = path.join('src', 'styles', 'v120-polish.css');
const configPath = path.join('src', 'lib', 'v120EnterprisePolish.ts');
const releaseDir = path.join('release', 'v120');
fs.mkdirSync(releaseDir, { recursive: true });

const findings = [];
function requireFile(file, label = file) {
  if (!fs.existsSync(file)) findings.push({ severity: 'high', code: 'missing_file', message: `${label} is missing.` });
}
requireFile(migrationPath, 'v12.0 migration');
requireFile(cssPath, 'v12.0 polish css');
requireFile(configPath, 'v12.0 polish config');

const sql = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, 'utf8') : '';
const css = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : '';
const cfg = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf8') : '';

const requiredTables = [
  'v120_program_workspaces',
  'v120_workspace_modules',
  'v120_saved_views',
  'v120_dashboard_tiles',
  'v120_data_quality_rules',
  'v120_data_quality_findings',
  'v120_workflow_sla_policies',
  'v120_workflow_sla_events',
  'v120_user_feedback',
  'v120_polish_backlog',
  'v120_help_articles',
  'v120_glossary_terms',
  'v120_release_readiness_checks',
  'v120_executive_narratives',
  'v120_action_decision_log',
  'v120_adoption_metrics'
];
const requiredViews = [
  'v120_workspace_health_summary',
  'v120_data_quality_board',
  'v120_polish_backlog_board',
  'v120_executive_readiness_overview',
  'v120_due_diligence_calendar'
];
const requiredEnums = ['v120_record_status', 'v120_health', 'v120_feedback_status', 'v120_sla_status'];
for (const table of requiredTables) {
  if (!new RegExp(`create\\s+table\\s+if\\s+not\\s+exists\\s+public\\.${table}\\b`, 'i').test(sql)) {
    findings.push({ severity: 'high', code: 'missing_table', table, message: `Missing table ${table}.` });
  }
  if (!new RegExp(`alter\\s+table\\s+public\\.%I\\s+enable\\s+row\\s+level\\s+security|alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`, 'i').test(sql) && !sql.includes(`'${table}'`)) {
    findings.push({ severity: 'medium', code: 'rls_not_detected', table, message: `RLS enable not detected for ${table}.` });
  }
}
for (const view of requiredViews) {
  if (!new RegExp(`create\\s+or\\s+replace\\s+view\\s+public\\.${view}\\b`, 'i').test(sql)) {
    findings.push({ severity: 'high', code: 'missing_view', view, message: `Missing view ${view}.` });
  }
}
for (const enumName of requiredEnums) {
  if (!sql.includes(enumName)) findings.push({ severity: 'medium', code: 'missing_enum', enumName, message: `Missing enum ${enumName}.` });
}

const forbiddenPatterns = [
  /evidence_items/i,
  /grant\s+delete/i,
  /service_role/i,
  /patient_identifier/i,
  /patient_id/i,
  /confidential_ovr_detail/i
];
for (const pattern of forbiddenPatterns) {
  if (pattern.test(sql)) findings.push({ severity: 'critical', code: 'forbidden_sql_pattern', pattern: String(pattern), message: `Forbidden SQL pattern detected: ${pattern}` });
}

const securityInvokerCount = (sql.match(/security_invoker\s*=\s*true/gi) ?? []).length;
if (securityInvokerCount < requiredViews.length) {
  findings.push({ severity: 'medium', code: 'security_invoker_missing', message: `Expected at least ${requiredViews.length} security_invoker views; detected ${securityInvokerCount}.` });
}
if (!/grant\s+select,\s*insert,\s*update/i.test(sql)) {
  findings.push({ severity: 'medium', code: 'grant_pattern_missing', message: 'Expected select/insert/update grant pattern was not detected.' });
}

for (const token of ['v120-shell', 'v120-card', 'v120-kpi-grid', 'v120-status-pill', 'v120-arabic']) {
  if (!css.includes(token)) findings.push({ severity: 'medium', code: 'css_token_missing', token, message: `Polish CSS token ${token} missing.` });
}
for (const token of ['V120_ENTERPRISE_MODULES', 'V120_POLISH_GUARDRAILS', 'v120ScoreToHealth']) {
  if (!cfg.includes(token)) findings.push({ severity: 'medium', code: 'config_token_missing', token, message: `Polish config token ${token} missing.` });
}

const blocking = findings.filter(f => ['critical', 'high'].includes(f.severity));
const report = {
  generated_at: new Date().toISOString(),
  status: blocking.length === 0 ? 'passed' : 'failed',
  migration: migrationPath,
  tables_expected: requiredTables.length,
  views_expected: requiredViews.length,
  enums_expected: requiredEnums.length,
  security_invoker_views_detected: securityInvokerCount,
  css_polish_file: fs.existsSync(cssPath),
  config_file: fs.existsSync(configPath),
  findings_count: findings.length,
  blocking_findings: blocking.length,
  findings
};
fs.writeFileSync(path.join(releaseDir, 'v120-polish-static-audit.json'), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(releaseDir, 'v120-polish-static-audit.md'), `# v12.0 Polish Static Audit\n\n- Generated: ${report.generated_at}\n- Status: **${report.status}**\n- Tables expected: ${report.tables_expected}\n- Views expected: ${report.views_expected}\n- Security-invoker views detected: ${report.security_invoker_views_detected}\n- Findings: ${report.findings_count}\n- Blocking findings: ${report.blocking_findings}\n\n${findings.length ? findings.map(f => `- **${f.severity}** ${f.code}: ${f.message}`).join('\n') : 'No blocking findings.'}\n`);
console.log('v12.0 polish static audit complete.');
console.log(JSON.stringify({ status: report.status, findings_count: report.findings_count, blocking_findings: report.blocking_findings, report: 'release/v120/v120-polish-static-audit.json' }, null, 2));
if (report.status !== 'passed') process.exit(1);
