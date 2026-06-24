import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const outDir = path.join(root, 'release', 'v910');
fs.mkdirSync(outDir, { recursive: true });

function readJson(relativePath) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
  } catch (error) {
    return { __read_error: error instanceof Error ? error.message : String(error) };
  }
}

function fileExists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function runNodeScript(scriptName, scriptPath) {
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: root,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
    maxBuffer: 8 * 1024 * 1024,
  });
  return {
    script: scriptName,
    passed: result.status === 0,
    exit_code: result.status,
    error: result.error?.message,
    stdout_tail: (result.stdout || '').slice(-2000),
    stderr_tail: (result.stderr || '').slice(-2000),
  };
}

const generatedAt = new Date().toISOString();
const packageJson = readJson('package.json');
const scripts = packageJson.scripts || {};
const requiredScripts = [
  'v910:ui-polish-check',
  'v910:uat-readiness-report',
  'v910:final-smoke',
  'pilot:uat-readiness',
];
const requiredReports = [
  'release/v910/ui-polish-report.md',
  'release/v910/uat-readiness-checklist.md',
  'release/v910/uat-issue-log-template.md',
  'release/v910/final-uat-readiness-report.md',
];

const uiCheck = runNodeScript('v910:ui-polish-check', 'scripts/v910-ui-polish-check.mjs');
const v72Proof = readJson('release/v72/real-authenticated-persona-proof.json');
const v66Gate = readJson('release/v66/v66-go-no-go-gate.json');
const issueMigration = fileExists('supabase/migrations/051_v910_controlled_pilot_uat_issues.sql')
  ? fs.readFileSync(path.join(root, 'supabase/migrations/051_v910_controlled_pilot_uat_issues.sql'), 'utf8')
  : '';
const requiredIssueMigrationSignals = [
  'title',
  'role_account_used',
  'steps_to_reproduce',
  'expected_result',
  'actual_result',
  'screenshot_note',
  'grant select, insert, update on public.controlled_pilot_issues to authenticated',
];

const failures = [];
if (!uiCheck.passed) failures.push('v910:ui-polish-check failed');
for (const scriptName of requiredScripts) {
  if (!scripts[scriptName]) failures.push(`missing package script: ${scriptName}`);
}
for (const reportPath of requiredReports) {
  if (!fileExists(reportPath)) failures.push(`missing report: ${reportPath}`);
}
if (!fileExists('src/pages/UatIssueCapture.tsx')) failures.push('missing UAT issue capture page');
if (!fileExists('supabase/migrations/051_v910_controlled_pilot_uat_issues.sql')) {
  failures.push('missing v9.10 controlled-pilot issue migration');
}
for (const signal of requiredIssueMigrationSignals) {
  if (!issueMigration.toLowerCase().includes(signal)) {
    failures.push(`v9.10 issue migration missing signal: ${signal}`);
  }
}
if (!v72Proof.strict_passed) {
  failures.push('v72 persona proof report is not strict-passed; inspect release/v72/real-authenticated-persona-proof.json');
}

const report = {
  generated_at: generatedAt,
  status: failures.length ? 'failed_review_required' : 'passed',
  production_ready: false,
  ui_check: uiCheck,
  required_scripts: requiredScripts.map(script => ({ script, exists: Boolean(scripts[script]) })),
  required_reports: requiredReports.map(reportPath => ({ report: reportPath, exists: fileExists(reportPath) })),
  v72_persona_proof: {
    strict_passed: Boolean(v72Proof.strict_passed),
    authenticated_personas_passed: v72Proof.authenticated_personas_passed ?? null,
    required_persona_count: v72Proof.required_persona_count ?? null,
    required_scenarios_passed: v72Proof.required_scenarios_passed ?? null,
    required_scenario_count: v72Proof.required_scenario_count ?? null,
    failed_count: v72Proof.failed_count ?? null,
    cleanup_status: v72Proof.cleanup_status ?? null,
  },
  v66_gate_status: {
    status: v66Gate.controlled_pilot_status ?? v66Gate.status ?? v66Gate.quality_status ?? 'not_read',
    blocking_count: v66Gate.blocking_count ?? v66Gate.production_blocking_findings ?? (Array.isArray(v66Gate.missing_manual_evidence) ? 1 : null),
    missing_manual_evidence: Array.isArray(v66Gate.missing_manual_evidence)
      ? v66Gate.missing_manual_evidence.map(item => item.id || item.title).filter(Boolean)
      : [],
    expected_manual_approval_failure_allowed: true,
  },
  failures,
};

fs.writeFileSync(path.join(outDir, 'final-smoke.json'), `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(path.join(outDir, 'final-smoke.md'), `# v9.10 Final Smoke

\`\`\`json
${JSON.stringify(report, null, 2)}
\`\`\`
`);

console.log('v9.10 final smoke complete.');
console.log(JSON.stringify({
  status: report.status,
  failures,
  report: 'release/v910/final-smoke.json',
}, null, 2));

if (failures.length) process.exit(1);
