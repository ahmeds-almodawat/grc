import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'release', 'v700');
fs.mkdirSync(outDir, { recursive: true });

const source = 'supabase/tests/v65_workflow_smoke_tests.sql';
const copies = [
  'release/v661/staging-sql/02_v65_workflow_smoke_tests.sql',
  'release/v662/staging-sql/02-v65-workflow-smoke-tests.sql',
  'release/v662/staging-sql/v65_workflow_smoke_tests.sql',
];
const findings = [];
const sourcePath = path.join(root, source);
const sourceSql = fs.existsSync(sourcePath) ? fs.readFileSync(sourcePath, 'utf8') : '';

if (!sourceSql) {
  findings.push({ severity: 'high', file: source, issue: 'missing_v65_sql_file' });
}

const requiredSignals = [
  ['public.evidence_files', 'missing_expected_relation_reference'],
  ['public.auth_route_protection_controls', 'missing_security_control_relation_reference'],
  ['public.v64_security_control_catalog', 'missing_security_control_catalog_reference'],
  ['V65_FAIL_MISSING_CRITICAL_RELATIONS', 'missing_relation_failure_guard'],
  ['V65_FAIL_RLS_DISABLED', 'missing_rls_failure_guard'],
  ['V65_FAIL_BROAD_SECURITY_DEFINER_EXECUTE', 'missing_security_definer_failure_guard'],
  ['V65_PASS_CRITICAL_RELATIONS', 'missing_relation_success_signal'],
  ['V65_PASS_RLS_SECURITY', 'missing_rls_success_signal'],
  ['V65_PASS_SECURITY_DEFINER_EXECUTE', 'missing_security_definer_success_signal'],
];

for (const [signal, issue] of requiredSignals) {
  if (!sourceSql.includes(signal)) {
    findings.push({ severity: 'high', file: source, issue, expected: signal });
  }
}

if (/\bpublic\.evidence\b/.test(sourceSql)) {
  findings.push({
    severity: 'high',
    file: source,
    issue: 'wrong_relation_reference',
    found: 'public.evidence',
    expected: 'public.evidence_files',
  });
}
if (/public\.database_security_proof_controls/.test(sourceSql)) {
  findings.push({
    severity: 'high',
    file: source,
    issue: 'nonexistent_security_control_relation_reference',
    relation: 'public.database_security_proof_controls',
  });
}
if (!/\braise\s+exception\b/i.test(sourceSql)) {
  findings.push({ severity: 'high', file: source, issue: 'missing_raise_exception_guard' });
}
if (!/and\s+not\s+c\.relrowsecurity/i.test(sourceSql)) {
  findings.push({ severity: 'high', file: source, issue: 'rls_values_are_not_required_true' });
}

for (const copy of copies) {
  const copyPath = path.join(root, copy);
  if (!fs.existsSync(copyPath)) {
    findings.push({ severity: 'medium', file: copy, issue: 'missing_generated_v65_copy' });
    continue;
  }
  if (sourceSql && fs.readFileSync(copyPath, 'utf8') !== sourceSql) {
    findings.push({
      severity: 'medium',
      file: copy,
      issue: 'stale_generated_v65_copy',
      recommendation: 'Run npm run v672:capture or synchronize the staging SQL copy.',
    });
  }
}

const summary = {
  generated_at: new Date().toISOString(),
  status: findings.some((finding) => finding.severity === 'high')
    ? 'failed'
    : findings.length > 0
      ? 'passed_with_warnings'
      : 'passed',
  canonical_file: source,
  generated_copies_checked: copies.length,
  high_findings: findings.filter((finding) => finding.severity === 'high').length,
  medium_findings: findings.filter((finding) => finding.severity === 'medium').length,
  findings,
};

fs.writeFileSync(
  path.join(outDir, 'v65-strength-audit.json'),
  `${JSON.stringify(summary, null, 2)}\n`,
);
fs.writeFileSync(
  path.join(outDir, 'V65_STRENGTH_AUDIT.md'),
  `# v7.1 v65 Strength Audit

\`\`\`json
${JSON.stringify(summary, null, 2)}
\`\`\`
`,
);

console.log('v7.1 v65 strength audit complete.');
console.log(JSON.stringify({
  status: summary.status,
  high_findings: summary.high_findings,
  medium_findings: summary.medium_findings,
  report: 'release/v700/v65-strength-audit.json',
}, null, 2));

if (process.argv.includes('--strict') && summary.high_findings > 0) {
  process.exit(1);
}
