import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const migrationPath = path.join(root, 'supabase/migrations/107_patch47_staging_migration_persona_evidence_closure.sql');
const runnerPath = path.join(root, 'scripts/patch47-staging-persona-evidence-runner.mjs');
const reportPath = path.join(root, 'release/patch47/patch47-staging-persona-evidence-runner.json');
const outDir = path.join(root, 'release/patch47');
const outPath = path.join(outDir, 'patch47-workflow-proof.json');
const sql = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, 'utf8') : '';
const runner = fs.existsSync(runnerPath) ? fs.readFileSync(runnerPath, 'utf8') : '';
const report = fs.existsSync(reportPath) ? JSON.parse(fs.readFileSync(reportPath, 'utf8')) : null;
const lower = `${sql}\n${runner}`.toLowerCase();

const statuses = ['pending', 'running', 'passed', 'failed', 'blocked', 'evidence_required'];
const tokens = ['migrations_replayed', 'persona_sql_executed', 'rls_check_passed', 'function_check_passed', 'view_check_passed', 'restore_dryrun_passed', 'failure_count', 'staging_evidence_readiness_status'];
const reportStatusHonest = Boolean(report && ['passed', 'blocked', 'evidence_required', 'failed'].includes(report.status));
const reportPassedHasEvidence = report?.status !== 'passed' || (
  report.migrations_replayed
  && report.persona_sql_executed
  && report.rls_check_passed
  && report.function_check_passed
  && report.view_check_passed
  && report.restore_dryrun_passed
  && Number(report.failure_count ?? 1) === 0
);

const checks = [
  { name: 'required statuses represented', passed: statuses.every(status => lower.includes(status)) },
  ...tokens.map(token => ({ name: `workflow token exists: ${token}`, passed: lower.includes(token) })),
  { name: 'passed run cannot be claimed without complete evidence', passed: lower.includes('passed staging evidence requires migration replay') },
  { name: 'runner exists', passed: fs.existsSync(runnerPath) },
  { name: 'runner writes Patch 47 report', passed: runner.includes('patch47-staging-persona-evidence-runner.json') },
  { name: 'runner does not fake execution', passed: runner.includes('did not fake execution') && runner.includes('evidence_required_no_new_execution') },
  { name: 'runner report exists', passed: Boolean(report) },
  { name: 'runner report status is honest', passed: reportStatusHonest },
  { name: 'passed runner report has complete evidence', passed: reportPassedHasEvidence },
  { name: 'missing env/evidence is not reported as passed', passed: report?.status === 'passed' || ['blocked', 'evidence_required'].includes(report?.status) },
];

const failed = checks.filter(check => !check.passed);
const result = {
  patch: '47',
  checked_at: new Date().toISOString(),
  strict_passed: failed.length === 0,
  check_count: checks.length,
  failed_count: failed.length,
  failed,
  runner_status: report?.status ?? 'missing',
  runner_execution_mode: report?.execution_mode ?? 'missing',
};
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
if (!result.strict_passed) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}
console.log(JSON.stringify(result, null, 2));
