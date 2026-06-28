#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const releaseDir = path.resolve('release/v100');
fs.mkdirSync(releaseDir, { recursive: true });

const checks = [];
function check(name, condition, detail) {
  checks.push({ name, passed: Boolean(condition), detail });
}

const migrationPath = path.resolve('supabase/migrations/052_v100_unified_capa_risk_control_foundation.sql');
const auditPath = path.resolve('release/v100/v100-foundation-static-audit.json');
const reportPath = path.resolve('release/v100/v100-foundation-report.md');

check('migration_file_exists', fs.existsSync(migrationPath), migrationPath);
check('static_audit_exists', fs.existsSync(auditPath), auditPath);
check('foundation_report_exists', fs.existsSync(reportPath), reportPath);

let audit = null;
if (fs.existsSync(auditPath)) {
  audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
  check('static_audit_passed', audit.status === 'passed', audit.status);
  check('no_static_findings', Array.isArray(audit.findings) && audit.findings.length === 0, `${audit.findings?.length ?? 'unknown'} findings`);
}

if (fs.existsSync(migrationPath)) {
  const sql = fs.readFileSync(migrationPath, 'utf8').toLowerCase();
  check('no_approval_json_references', !sql.includes('pilot-signoff.json') && !sql.includes('ovr-confidentiality-confirmation.json'), 'Approval files not touched');
  check('no_service_role_browser_pattern', !sql.includes('service_role'), 'No service_role string in v10.0 migration');
  check('no_delete_grants', !sql.includes('grant delete on'), 'No delete grants');
  check('security_invoker_views', (sql.match(/security_invoker = true/g) || []).length >= 3, 'Expected at least 3 security-invoker views');
}

const failed = checks.filter((item) => !item.passed);
const proof = {
  generated_at: new Date().toISOString(),
  status: failed.length === 0 ? 'passed' : 'failed',
  checks,
  failed_count: failed.length,
  note: 'Static/pack proof only. Database migration must still be applied and tested on local/staging Supabase before pilot use.',
};

fs.writeFileSync(path.join(releaseDir, 'v100-final-proof.json'), `${JSON.stringify(proof, null, 2)}\n`);
fs.writeFileSync(path.join(releaseDir, 'v100-final-proof.md'), `# v10.0 Final Proof\n\n- Generated: ${proof.generated_at}\n- Status: **${proof.status}**\n- Failed checks: ${proof.failed_count}\n\n## Checks\n\n${checks.map((item) => `- [${item.passed ? 'x' : ' '}] ${item.name}: ${item.detail}`).join('\n')}\n\n## Note\n\n${proof.note}\n`);

console.log('v10.0 final proof complete.');
console.log(JSON.stringify({ status: proof.status, failed_count: failed.length, report: 'release/v100/v100-final-proof.json' }, null, 2));
process.exit(failed.length === 0 ? 0 : 1);
