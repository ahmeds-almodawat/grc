import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const runProofs = process.argv.includes('--run-proofs');
const evidenceDir = path.join(root, 'release', 'v66', 'evidence-attachments');
const stagingSqlDir = path.join(root, 'release', 'v662', 'staging-sql');
const reportDir = path.join(root, 'release', 'v672');
const configPath = path.join(root, 'supabase', 'config.toml');

const sqlJobs = [
  {
    id: 'v64',
    source: 'supabase/tests/v64_persona_security_tests.sql',
    staged: 'release/v662/staging-sql/v64_persona_security_tests.sql',
    compatibilityStaged: 'release/v662/staging-sql/01-v64-persona-security-tests.sql',
    output: 'release/v66/evidence-attachments/01-v64-persona-sql-output.txt'
  },
  {
    id: 'v65',
    source: 'supabase/tests/v65_workflow_smoke_tests.sql',
    staged: 'release/v662/staging-sql/v65_workflow_smoke_tests.sql',
    compatibilityStaged: 'release/v662/staging-sql/02-v65-workflow-smoke-tests.sql',
    output: 'release/v66/evidence-attachments/02-v65-workflow-sql-output.txt'
  },
  {
    id: 'v66',
    source: 'supabase/tests/v66_controlled_pilot_evidence_tests.sql',
    staged: 'release/v662/staging-sql/v66_controlled_pilot_evidence_tests.sql',
    compatibilityStaged: 'release/v662/staging-sql/03-v66-pilot-evidence-tests.sql',
    output: 'release/v66/evidence-attachments/03-v66-pilot-evidence-sql-output.txt'
  }
];

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
    ...options
  });
}

function textOf(result) {
  return `${result.stdout || ''}${result.stderr || ''}`;
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content.endsWith('\n') ? content : `${content}\n`, 'utf8');
}

function relative(file) {
  return path.relative(root, file).replaceAll('\\', '/');
}

function projectId() {
  if (fs.existsSync(configPath)) {
    const config = fs.readFileSync(configPath, 'utf8');
    const match = config.match(/^\s*project_id\s*=\s*"([^"]+)"/m);
    if (match) return match[1];
  }
  return path.basename(root);
}

function detectDbContainer(project) {
  const scoped = run('docker', [
    'ps',
    '--filter', `label=com.supabase.cli.project=${project}`,
    '--filter', 'name=supabase_db_',
    '--format', '{{.Names}}'
  ]);

  if (scoped.error) {
    return { error: `Docker is unavailable: ${scoped.error.message}` };
  }
  if (scoped.status !== 0) {
    return { error: textOf(scoped).trim() || 'docker ps failed' };
  }

  let candidates = scoped.stdout.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
  if (!candidates.length) {
    const fallback = run('docker', ['ps', '--filter', 'name=supabase_db_', '--format', '{{.Names}}']);
    if (fallback.status === 0) {
      const all = fallback.stdout.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
      candidates = all.filter((name) => name === `supabase_db_${project}` || name.endsWith(`_${project}`));
      if (!candidates.length && all.length === 1) candidates = all;
    }
  }

  if (!candidates.length) {
    return {
      error: [
        `No running local Supabase DB container was found for project "${project}".`,
        'Start it first with: npm run supabase:local:start',
        'Equivalent CLI command: supabase start'
      ].join('\n')
    };
  }
  if (candidates.length > 1) {
    return {
      error: `Multiple Supabase DB containers matched this project: ${candidates.join(', ')}. Stop unrelated stacks and rerun.`
    };
  }
  return { container: candidates[0] };
}

function inspectContainer(container) {
  const result = run('docker', [
    'inspect',
    '--format',
    '{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}|{{.State.StartedAt}}',
    container
  ]);
  const [status = 'unknown', health = 'unknown', startedAt = 'unknown'] = (result.stdout || '').trim().split('|');
  return { status, health, started_at: startedAt, inspect_exit_code: result.status ?? 1 };
}

function captureMigrationLedger(container, project, capturedAt) {
  const outputFile = path.join(evidenceDir, 'staging-migration-log.txt');
  const query = [
    "select version, name",
    "from supabase_migrations.schema_migrations",
    "order by version;"
  ].join(' ');
  const result = run('docker', [
    'exec', container,
    'psql', '-U', 'postgres', '-d', 'postgres',
    '-v', 'ON_ERROR_STOP=1',
    '-P', 'pager=off',
    '-c', query
  ]);
  const raw = textOf(result);
  const hasLatest = /\b046\b[\s|]+v673_lockdown_security_definer_execute/i.test(raw);
  const passed = result.status === 0 && hasLatest;
  const content = [
    'GRC Control Center local staging migration evidence',
    `Environment: Local Supabase Docker staging`,
    `Project: ${project}`,
    `Database container: ${container}`,
    `Captured UTC: ${capturedAt}`,
    'Source: supabase_migrations.schema_migrations in the running local database',
    'Expected latest migration: 046_v673_lockdown_security_definer_execute.sql',
    '',
    raw.trim(),
    '',
    `Verification status: ${passed ? 'PASSED' : 'FAILED'}`,
    `psql exit code: ${result.status ?? 1}`,
    `Migration 046 verified: ${hasLatest ? 'yes' : 'no'}`
  ].join('\n');
  write(outputFile, content);
  return { passed, has_latest_migration: hasLatest, exit_code: result.status ?? 1, output: relative(outputFile) };
}

function runSqlJob(container, job, capturedAt) {
  const sourceFile = path.join(root, job.source);
  const stagedFile = path.join(root, job.staged);
  const outputFile = path.join(root, job.output);

  if (!fs.existsSync(sourceFile)) {
    write(outputFile, [
      `Environment: Local Supabase Docker staging`,
      `Source SQL: ${job.source}`,
      `Captured UTC: ${capturedAt}`,
      '',
      'Verification status: FAILED',
      'Reason: source SQL file is missing.'
    ].join('\n'));
    return { ...job, passed: false, exit_code: 1, reason: 'source_sql_missing' };
  }

  const marker = `V672_SQL_EXECUTION_PASSED_${job.id.toUpperCase()}`;
  const sql = `${fs.readFileSync(stagedFile, 'utf8')}\n\\echo ${marker}\n`;
  const result = run('docker', [
    'exec', '-i', container,
    'psql', '-U', 'postgres', '-d', 'postgres',
    '-v', 'ON_ERROR_STOP=1'
  ], { input: sql });
  const raw = textOf(result);
  const hasMarker = raw.includes(marker);
  const hasSqlError = /(^|\n)(ERROR|FATAL|PANIC):/m.test(raw) || /V\d+_FAIL_/i.test(raw);
  const hasFalseAssertion = job.id === 'v66' && /\|\s*f\s*(?:\r?\n|$)/i.test(raw);
  const passed = result.status === 0 && hasMarker && !hasSqlError && !hasFalseAssertion;
  let reason = '';
  if (result.status !== 0) reason = `psql_exit_${result.status ?? 1}`;
  else if (!hasMarker) reason = 'completion_marker_missing';
  else if (hasSqlError) reason = 'sql_error_or_failure_signal_detected';
  else if (hasFalseAssertion) reason = 'false_assertion_detected';

  const content = [
    'GRC Control Center SQL staging evidence',
    'Environment: Local Supabase Docker staging',
    `Source SQL: ${job.source}`,
    `Executed copy: ${job.staged}`,
    `Database container: ${container}`,
    `Captured UTC: ${capturedAt}`,
    `Command: docker exec -i ${container} psql -U postgres -d postgres -v ON_ERROR_STOP=1`,
    'Completion marker note: the helper sends a psql \\echo marker after the unmodified staged SQL; ON_ERROR_STOP prevents it from running after a SQL error.',
    '',
    '----- psql output -----',
    raw.trim(),
    '----- end psql output -----',
    '',
    `Verification status: ${passed ? 'PASSED' : 'FAILED'}`,
    `psql exit code: ${result.status ?? 1}`,
    `Completion marker observed: ${hasMarker ? 'yes' : 'no'}`,
    reason ? `Failure reason: ${reason}` : 'Failure reason: none'
  ].join('\n');
  write(outputFile, content);

  const bytes = fs.statSync(outputFile).size;
  return {
    ...job,
    passed,
    exit_code: result.status ?? 1,
    bytes,
    has_completion_marker: hasMarker,
    has_sql_error: hasSqlError,
    has_false_assertion: hasFalseAssertion,
    reason
  };
}

function captureRestoreStartProof(container, containerState, capturedAt, migrationPassed) {
  const outputFile = path.join(evidenceDir, 'restore-dryrun-evidence.txt');
  if (fs.existsSync(outputFile)) {
    const existing = fs.readFileSync(outputFile, 'utf8');
    if (/V674_RESTORE_INTEGRITY_VERIFIED/.test(existing)) {
      return { passed: true, reachable: true, output: relative(outputFile), preserved_v674_evidence: true };
    }
  }
  const dbCheck = run('docker', [
    'exec', container,
    'psql', '-U', 'postgres', '-d', 'postgres',
    '-v', 'ON_ERROR_STOP=1',
    '-Atc',
    "select current_database() || '|' || pg_postmaster_start_time() || '|' || now();"
  ]);
  const reachable = dbCheck.status === 0 && Boolean((dbCheck.stdout || '').trim());
  const proofPassed = reachable && containerState.status === 'running' && migrationPassed;
  const content = [
    'Local Supabase Docker staging — restore-start proof',
    `Captured UTC: ${capturedAt}`,
    `Database container: ${container}`,
    `Container status: ${containerState.status}`,
    `Container health: ${containerState.health}`,
    `Container started at: ${containerState.started_at}`,
    `Database reachability: ${reachable ? 'VERIFIED' : 'FAILED'}`,
    `Migration ledger through 046: ${migrationPassed ? 'VERIFIED' : 'FAILED'}`,
    '',
    'Database start probe:',
    (dbCheck.stdout || dbCheck.stderr || '').trim(),
    '',
    `Status: ${proofPassed ? 'RESTORE START VERIFIED' : 'RESTORE START FAILED'}`,
    '',
    'Scope limitation:',
    'This is only a Local Supabase Docker staging restore-start proof. It confirms that the local database container starts, is reachable, and exposes the expected migration ledger.',
    'It does not claim that a production backup was restored, that storage objects were recovered, or that a production disaster-recovery exercise was completed.'
  ].join('\n');
  write(outputFile, content);
  return { passed: proofPassed, reachable, output: relative(outputFile) };
}

function writeDraftSignoff(container, capturedAt, migrationResult, sqlResults, restoreResult) {
  const outputFile = path.join(evidenceDir, 'pilot-signoff.md');
  if (fs.existsSync(outputFile)) {
    const existing = fs.readFileSync(outputFile, 'utf8');
    if (/V674_HUMAN_SIGNOFF_VERIFIED/.test(existing)) {
      return { local_evidence_ready: true, output: relative(outputFile), preserved_v674_evidence: true };
    }
  }
  const allSqlPassed = sqlResults.every((result) => result.passed);
  const localEvidenceReady = migrationResult.passed && allSqlPassed && restoreResult.passed;
  const content = [
    '# Draft Signoff — Controlled Internal Pilot Only',
    '',
    `Generated UTC: ${capturedAt}`,
    '',
    `Local environment: **Local Supabase Docker staging**`,
    `Database container: \`${container}\``,
    `Evidence capture result: **${localEvidenceReady ? 'ACCEPTED FOR INTERNAL REVIEW' : 'BLOCKED — REVIEW FAILED EVIDENCE'}**`,
    `Approval status: **DRAFT ONLY — management, IT, and Quality approval has not been granted by this file.**`,
    '',
    '## Captured checks',
    '',
    `- Migration ledger through 046: ${migrationResult.passed ? 'PASSED' : 'FAILED'}`,
    ...sqlResults.map((result) => `- ${result.id.toUpperCase()} SQL execution: ${result.passed ? 'PASSED' : `FAILED (${result.reason || 'review output'})`}`),
    `- Local Docker restore-start proof: ${restoreResult.passed ? 'VERIFIED' : 'FAILED'}`,
    '',
    '## Pilot restriction',
    '',
    'This package is for a controlled internal pilot only.',
    'Do not use real patient identifiers, confidential OVR data, production credentials, or production exports until management, IT, and Quality have reviewed the evidence and explicitly approved the pilot.',
    '',
    '## Human approvals still required',
    '',
    '- Management approval: pending',
    '- IT approval: pending',
    '- Quality approval: pending',
    '',
    'This draft is evidence of local technical capture, not a production go-live authorization.'
  ].join('\n');
  write(outputFile, content);
  return { local_evidence_ready: localEvidenceReady, output: relative(outputFile) };
}

function updateManualEvidence(migrationResult, sqlResults) {
  const file = path.join(root, 'release', 'v66', 'v66-manual-evidence.json');
  if (!fs.existsSync(file)) return { updated: false, reason: 'manual_evidence_register_missing' };
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return { updated: false, reason: 'manual_evidence_register_invalid_json' };
  }
  const byId = new Map((data.items || []).map((item) => [item.id, item]));
  const v64 = sqlResults.find((result) => result.id === 'v64');
  const v65 = sqlResults.find((result) => result.id === 'v65');
  const updates = [
    ['fresh_staging_migrations_001_044', migrationResult.passed, 'Verified from the live Local Supabase Docker staging migration ledger through migration 046.'],
    ['staging_persona_sql_v64', Boolean(v64?.passed), `Captured in ${v64?.output || 'the v64 SQL evidence output'}.`],
    ['staging_workflow_sql_v65', Boolean(v65?.passed), `Captured in ${v65?.output || 'the v65 SQL evidence output'}.`]
  ];
  for (const [id, passed, note] of updates) {
    const item = byId.get(id);
    if (!item) continue;
    item.status = passed ? 'verified' : 'manual_required';
    item.automation_note = note;
    item.last_checked_at = new Date().toISOString();
  }

  const restore = byId.get('backup_restore_dryrun');
  if (restore && restore.status !== 'verified') {
    restore.status = 'manual_required';
    restore.automation_note = 'A Local Supabase Docker staging restore-start proof was captured, but a full backup restore and integrity comparison still requires human execution.';
  }
  const confidentiality = byId.get('ovr_confidentiality_no_real_patient_data');
  if (confidentiality && confidentiality.status !== 'verified') {
    confidentiality.status = 'manual_required';
    confidentiality.automation_note = 'The restriction is written into the draft signoff; management, IT, and Quality confirmation remains pending.';
  }
  const signoff = byId.get('pilot_signoff_it_quality_admin');
  if (signoff && signoff.status !== 'verified') {
    signoff.status = 'manual_required';
    signoff.automation_note = 'Draft signoff created. Human names, dates, and approvals remain pending.';
  }

  data.generated_at = new Date().toISOString();
  data.capture_scope = 'Local Supabase Docker staging';
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  return { updated: true };
}

function verifyOutputFiles(sqlResults) {
  return sqlResults.map((result) => {
    const file = path.join(root, result.output);
    const exists = fs.existsSync(file);
    const bytes = exists ? fs.statSync(file).size : 0;
    const text = exists ? fs.readFileSync(file, 'utf8') : '';
    const hasSignal = /(V672_SQL_EXECUTION_PASSED|Verification status:\s*PASSED)/i.test(text);
    return { file: result.output, exists, bytes, has_pass_signal: hasSignal, passed: exists && bytes > 0 && hasSignal && result.passed };
  });
}

fs.mkdirSync(evidenceDir, { recursive: true });
fs.mkdirSync(stagingSqlDir, { recursive: true });
fs.mkdirSync(reportDir, { recursive: true });

for (const job of sqlJobs) {
  const sourceFile = path.join(root, job.source);
  if (!fs.existsSync(sourceFile)) {
    console.error(`Required SQL source is missing: ${job.source}`);
    process.exit(1);
  }
  fs.copyFileSync(sourceFile, path.join(root, job.staged));
  fs.copyFileSync(sourceFile, path.join(root, job.compatibilityStaged));
}

const project = projectId();
const capturedAt = new Date().toISOString();
const detection = detectDbContainer(project);
if (!detection.container) {
  console.error(detection.error);
  process.exit(1);
}

const container = detection.container;
console.log(`Using local Supabase DB container: ${container}`);
const containerState = inspectContainer(container);
const migrationResult = captureMigrationLedger(container, project, capturedAt);
const sqlResults = sqlJobs.map((job) => {
  console.log(`Running ${job.source}...`);
  const result = runSqlJob(container, job, capturedAt);
  console.log(`  ${result.passed ? 'PASSED' : 'FAILED'} -> ${job.output}`);
  return result;
});
const outputChecks = verifyOutputFiles(sqlResults);
const restoreResult = captureRestoreStartProof(container, containerState, capturedAt, migrationResult.passed);
const signoffResult = writeDraftSignoff(container, capturedAt, migrationResult, sqlResults, restoreResult);
const manualEvidenceUpdate = updateManualEvidence(migrationResult, sqlResults);
let manualEvidence = null;
try {
  manualEvidence = JSON.parse(fs.readFileSync(path.join(root, 'release', 'v66', 'v66-manual-evidence.json'), 'utf8'));
} catch {}
const manualById = new Map((manualEvidence?.items || []).map((item) => [item.id, item]));

const blockers = [];
if (!migrationResult.passed) blockers.push('The live migration ledger does not verify migration 046.');
for (const result of sqlResults.filter((item) => !item.passed)) {
  blockers.push(`${result.id.toUpperCase()} SQL proof failed; review ${result.output}.`);
}
for (const check of outputChecks.filter((item) => !item.passed)) {
  blockers.push(`Evidence verification failed for ${check.file}.`);
}
if (!restoreResult.passed) blockers.push('The Local Supabase Docker staging restore-start proof failed.');
if (manualById.get('pilot_signoff_it_quality_admin')?.status !== 'verified') {
  blockers.push('Management, IT, and Quality approvals remain pending because pilot-signoff.md is intentionally draft-only.');
}
if (manualById.get('ovr_confidentiality_no_real_patient_data')?.status !== 'verified') {
  blockers.push('IT and Quality confidentiality confirmation remains pending.');
}
if (manualById.get('backup_restore_dryrun')?.status !== 'verified') {
  blockers.push('A full backup restore/integrity dry-run remains pending; this helper captures restore-start proof only.');
}

const report = {
  generated_at: capturedAt,
  environment: 'Local Supabase Docker staging',
  project_id: project,
  db_container: container,
  container_state: containerState,
  migration: migrationResult,
  sql_results: sqlResults,
  output_checks: outputChecks,
  restore_start_proof: restoreResult,
  draft_signoff: signoffResult,
  manual_evidence_register: manualEvidenceUpdate,
  blocking_count: blockers.length,
  blockers,
  capture_status: blockers.filter((item) => /SQL proof failed|verification failed|migration ledger|restore-start proof failed/i.test(item)).length
    ? 'failed_review_required'
    : 'captured_pending_human_approval'
};
write(path.join(reportDir, 'v672-local-evidence-capture.json'), JSON.stringify(report, null, 2));

console.log('');
console.log('v6.7.2 local evidence capture complete.');
console.log(JSON.stringify({
  capture_status: report.capture_status,
  db_container: container,
  sql_passed: sqlResults.filter((result) => result.passed).length,
  sql_total: sqlResults.length,
  blocking_count: report.blocking_count
}, null, 2));

if (blockers.length) {
  console.log('');
  console.log('Next steps:');
  blockers.forEach((blocker, index) => console.log(`${index + 1}. ${blocker}`));
  console.log(`${blockers.length + 1}. After remediation, rerun: npm run v672:capture`);
  console.log(`${blockers.length + 2}. Then run: npm run v672:proof`);
}

let proofExit = 0;
if (runProofs) {
  const proof = run(process.execPath, [path.join(root, 'scripts', 'v672-local-evidence-proof.mjs')], { stdio: 'inherit' });
  proofExit = proof.status ?? 1;
}

const technicalFailure = !migrationResult.passed || sqlResults.some((result) => !result.passed) || outputChecks.some((check) => !check.passed) || !restoreResult.passed;
if (technicalFailure || proofExit !== 0) process.exit(1);
