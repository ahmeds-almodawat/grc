import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const outDir = path.join(root, 'release/patch47');
const outPath = path.join(outDir, 'patch47-staging-persona-evidence-runner.json');

function exists(relPath) {
  return fs.existsSync(path.join(root, relPath));
}

function readJson(relPath) {
  const fullPath = path.join(root, relPath);
  if (!fs.existsSync(fullPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  } catch (error) {
    return { parse_error: error instanceof Error ? error.message : String(error) };
  }
}

function commandAvailable(command, args = ['--version']) {
  try {
    execFileSync(command, args, { stdio: 'ignore', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

function dockerContainerReachable() {
  if (!commandAvailable('docker', ['--version'])) return false;
  try {
    const output = execFileSync('docker', ['ps', '--format', '{{.Names}}'], { encoding: 'utf8', timeout: 10000 });
    return output.split(/\r?\n/).some(name => name.trim() === 'supabase_db_grc-control-center');
  } catch {
    return false;
  }
}

const sqlFiles = [
  'supabase/tests/v64_persona_security_tests.sql',
  'supabase/tests/v65_workflow_smoke_tests.sql',
  'supabase/tests/v66_controlled_pilot_evidence_tests.sql',
];

const v64Summary = readJson('release/v64/v64-database-security-proof-summary.json');
const v672Capture = readJson('release/v672/v672-local-evidence-capture.json');
const v674Restore = readJson('release/v674/v674-restore-integrity-dryrun.json');

const sqlFilesAvailable = sqlFiles.every(exists);
const localContainerReachable = dockerContainerReachable();
const v64StaticReady = Boolean(v64Summary?.rls_static_strict_passed && v64Summary?.function_static_strict_passed && v64Summary?.view_static_strict_passed);
const v672SqlPassed = (
  (Number(v672Capture?.sql_passed ?? 0) >= 3)
  || (Array.isArray(v672Capture?.sql_results) && v672Capture.sql_results.length >= 3 && v672Capture.sql_results.every(result => result?.passed === true))
) && Number(v672Capture?.blocking_count ?? 1) === 0;
const v672MigrationEvidence = Boolean(
  v672Capture?.migration?.passed
  || v672Capture?.migration_result?.passed
  || v672Capture?.migration_evidence?.passed
  || v672Capture?.local_evidence_ready
  || v672Capture?.capture_status === 'captured_pending_human_approval'
);
const v674RestorePassed = Boolean(v674Restore?.strict_passed || v674Restore?.counts_matched);

const blockers = [];
if (!sqlFilesAvailable) blockers.push('Required v64/v65/v66 SQL evidence files are missing.');
if (!v64StaticReady) blockers.push('v64 static database security proof summary is missing or not passing.');
if (!v672SqlPassed) blockers.push('v672 local persona/workflow/evidence SQL capture is missing or not passing.');
if (!v672MigrationEvidence) blockers.push('Local/staging migration replay evidence is missing or not verifiable.');
if (!v674RestorePassed) blockers.push('v674 restore dry-run evidence is missing or not passing.');

const allEvidenceVerified = blockers.length === 0;
const status = allEvidenceVerified ? 'passed' : (localContainerReachable ? 'evidence_required' : 'blocked');

const report = {
  patch: '47',
  generated_at: new Date().toISOString(),
  status,
  execution_mode: allEvidenceVerified ? 'verified_existing_local_evidence' : 'evidence_required_no_new_execution',
  local_supabase_container_reachable: localContainerReachable,
  sql_files_available: sqlFilesAvailable,
  sql_files: sqlFiles.map(file => ({ file, exists: exists(file) })),
  migration_count: Array.isArray(v672Capture?.migrations) ? v672Capture.migrations.length : null,
  migrations_replayed: allEvidenceVerified && v672MigrationEvidence,
  persona_sql_executed: allEvidenceVerified && v672SqlPassed,
  rls_check_passed: Boolean(v64Summary?.rls_static_strict_passed),
  function_check_passed: Boolean(v64Summary?.function_static_strict_passed),
  view_check_passed: Boolean(v64Summary?.view_static_strict_passed),
  restore_dryrun_passed: v674RestorePassed,
  failure_count: blockers.length,
  blockers,
  evidence_paths: {
    v64_database_security_summary: exists('release/v64/v64-database-security-proof-summary.json') ? 'release/v64/v64-database-security-proof-summary.json' : null,
    v672_local_evidence_capture: exists('release/v672/v672-local-evidence-capture.json') ? 'release/v672/v672-local-evidence-capture.json' : null,
    v674_restore_dryrun: exists('release/v674/v674-restore-integrity-dryrun.json') ? 'release/v674/v674-restore-integrity-dryrun.json' : null,
  },
  run_notes: allEvidenceVerified
    ? 'Verified existing local/staging evidence artifacts. No new staging execution was started by this runner.'
    : 'Staging/local-clean evidence is not complete. This runner did not fake execution or mark proof as passed.',
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
