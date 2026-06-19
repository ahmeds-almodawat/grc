import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const evidenceDir = path.join(root, 'release', 'v66', 'evidence-attachments');
const reportDir = path.join(root, 'release', 'v674');
const manualEvidencePath = path.join(root, 'release', 'v66', 'v66-manual-evidence.json');
const configPath = path.join(root, 'supabase', 'config.toml');
const verificationDb = 'grc_v674_restore_verify';
const dumpPath = '/tmp/grc_v674_restore_integrity.dump';

fs.mkdirSync(evidenceDir, { recursive: true });
fs.mkdirSync(reportDir, { recursive: true });

function run(args, options = {}) {
  return spawnSync('docker', args, {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024,
    ...options
  });
}

function projectId() {
  const config = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf8') : '';
  return config.match(/^\s*project_id\s*=\s*"([^"]+)"/m)?.[1] || path.basename(root);
}

function detectContainer(project) {
  const result = run([
    'ps',
    '--filter', `label=com.supabase.cli.project=${project}`,
    '--filter', 'name=supabase_db_',
    '--format', '{{.Names}}'
  ]);
  const containers = (result.stdout || '').split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
  if (result.error || result.status !== 0) {
    throw new Error(`Docker is unavailable: ${result.error?.message || result.stderr || 'docker ps failed'}`);
  }
  if (containers.length !== 1) {
    throw new Error(
      containers.length
        ? `Expected one Supabase DB container for "${project}", found: ${containers.join(', ')}`
        : `No running Supabase DB container found for "${project}". Run: npm run supabase:local:start`
    );
  }
  return containers[0];
}

function executeStep(steps, name, args, options = {}) {
  const startedAt = new Date().toISOString();
  const result = run(args, options);
  const step = {
    name,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    exit_code: result.status ?? 1,
    passed: result.status === 0,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim()
  };
  steps.push(step);
  return { result, step };
}

function queryJson(steps, container, database, name, sql) {
  const { result, step } = executeStep(steps, name, [
    'exec', container,
    'psql', '-U', 'postgres', '-d', database,
    '-v', 'ON_ERROR_STOP=1',
    '-At', '-c', sql
  ]);
  if (result.status !== 0) return null;
  try {
    return JSON.parse((result.stdout || '').trim());
  } catch {
    step.passed = false;
    step.parse_error = 'query_did_not_return_valid_json';
    return null;
  }
}

function updateRestoreEvidence(passed, reportPath) {
  if (!passed || !fs.existsSync(manualEvidencePath)) return false;
  const data = JSON.parse(fs.readFileSync(manualEvidencePath, 'utf8'));
  const item = (data.items || []).find((entry) => entry.id === 'backup_restore_dryrun');
  if (!item) return false;
  item.status = 'verified';
  item.automation_note = `Verified by the v6.7.4 isolated local database dump/restore integrity dry-run. Report: ${reportPath}`;
  item.last_checked_at = new Date().toISOString();
  data.generated_at = new Date().toISOString();
  fs.writeFileSync(manualEvidencePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  return true;
}

const countSql = `
select json_build_object(
  'public.organizations', (select count(*) from public.organizations),
  'public.profiles', (select count(*) from public.profiles),
  'public.user_roles', (select count(*) from public.user_roles),
  'public.projects', (select count(*) from public.projects),
  'public.milestones', (select count(*) from public.milestones),
  'public.tasks', (select count(*) from public.tasks),
  'public.ovr_reports', (select count(*) from public.ovr_reports),
  'public.evidence_files', (select count(*) from public.evidence_files),
  'public.approvals', (select count(*) from public.approvals),
  'public.controlled_pilot_runs', (select count(*) from public.controlled_pilot_runs),
  'public.controlled_pilot_evidence_items', (select count(*) from public.controlled_pilot_evidence_items),
  'public.controlled_pilot_issues', (select count(*) from public.controlled_pilot_issues),
  'public.controlled_pilot_signoffs', (select count(*) from public.controlled_pilot_signoffs),
  'storage.buckets', (select count(*) from storage.buckets),
  'storage.objects', (select count(*) from storage.objects),
  'supabase_migrations.schema_migrations', (select count(*) from supabase_migrations.schema_migrations)
)::text;
`;

const evidenceExistenceSql = `
select json_build_object(
  'public.evidence_files', to_regclass('public.evidence_files') is not null,
  'public.v64_security_evidence', to_regclass('public.v64_security_evidence') is not null,
  'public.controlled_pilot_evidence_items', to_regclass('public.controlled_pilot_evidence_items') is not null,
  'storage.buckets', to_regclass('storage.buckets') is not null,
  'storage.objects', to_regclass('storage.objects') is not null
)::text;
`;

const smokeSql = `
select json_build_object(
  'database', current_database(),
  'latest_migration', (
    select version || '_' || name
    from supabase_migrations.schema_migrations
    order by version desc
    limit 1
  ),
  'organization_count', (select count(*) from public.organizations),
  'evidence_file_count', (select count(*) from public.evidence_files),
  'pilot_evidence_count', (select count(*) from public.controlled_pilot_evidence_items),
  'storage_object_count', (select count(*) from storage.objects)
)::text;
`;

const steps = [];
const generatedAt = new Date().toISOString();
const project = projectId();
let container = null;
let sourceCounts = null;
let restoredCounts = null;
let evidenceTables = null;
let smoke = null;
let dumpBytes = 0;
let failure = null;

try {
  container = detectContainer(project);
  console.log(`Using local Supabase DB container: ${container}`);

  const source = queryJson(steps, container, 'postgres', 'capture_source_counts', countSql);
  if (!source) throw new Error('Unable to capture source table counts.');
  sourceCounts = source;

  let step = executeStep(steps, 'dump_application_schemas', [
    'exec', container,
    'pg_dump', '-U', 'postgres', '-d', 'postgres',
    '-Fc', '--no-owner', '--no-privileges',
    '--schema=auth',
    '--schema=public',
    '--schema=storage',
    '--schema=supabase_migrations',
    '-f', dumpPath
  ]).step;
  if (!step.passed) throw new Error('pg_dump failed.');

  const size = executeStep(steps, 'verify_dump_file', [
    'exec', container, 'stat', '-c', '%s', dumpPath
  ]);
  dumpBytes = Number.parseInt((size.result.stdout || '').trim(), 10);
  if (!size.step.passed || !Number.isFinite(dumpBytes) || dumpBytes <= 0) {
    throw new Error('Dump file is missing or empty.');
  }

  step = executeStep(steps, 'drop_previous_verification_database', [
    'exec', container, 'dropdb', '-U', 'postgres', '--if-exists', '--force', verificationDb
  ]).step;
  if (!step.passed) throw new Error('Unable to remove the previous verification database.');

  step = executeStep(steps, 'create_verification_database', [
    'exec', container, 'createdb', '-U', 'postgres', '-T', 'template0', verificationDb
  ]).step;
  if (!step.passed) throw new Error('Unable to create the verification database.');

  step = executeStep(steps, 'prepare_verification_database', [
    'exec', container,
    'psql', '-U', 'postgres', '-d', verificationDb,
    '-v', 'ON_ERROR_STOP=1',
    '-c', 'drop schema public cascade;'
  ]).step;
  if (!step.passed) throw new Error('Unable to prepare the verification database.');

  step = executeStep(steps, 'restore_dump', [
    'exec', container,
    'pg_restore', '-U', 'postgres', '-d', verificationDb,
    '--exit-on-error', '--no-owner', '--no-privileges',
    dumpPath
  ]).step;
  if (!step.passed) throw new Error('pg_restore failed.');

  restoredCounts = queryJson(steps, container, verificationDb, 'capture_restored_counts', countSql);
  if (!restoredCounts) throw new Error('Unable to capture restored table counts.');

  evidenceTables = queryJson(steps, container, verificationDb, 'verify_evidence_tables', evidenceExistenceSql);
  if (!evidenceTables) throw new Error('Unable to verify evidence tables.');

  smoke = queryJson(steps, container, verificationDb, 'run_post_restore_smoke_query', smokeSql);
  if (!smoke) throw new Error('Post-restore smoke query failed.');
} catch (error) {
  failure = error instanceof Error ? error.message : String(error);
} finally {
  if (container) {
    executeStep(steps, 'cleanup_verification_database', [
      'exec', container, 'dropdb', '-U', 'postgres', '--if-exists', '--force', verificationDb
    ]);
    executeStep(steps, 'cleanup_dump_file', [
      'exec', container, 'rm', '-f', dumpPath
    ]);
  }
}

const countComparisons = sourceCounts && restoredCounts
  ? Object.keys(sourceCounts).map((table) => ({
      table,
      source_count: sourceCounts[table],
      restored_count: restoredCounts[table],
      matched: sourceCounts[table] === restoredCounts[table]
    }))
  : [];
const countsMatched = countComparisons.length > 0 && countComparisons.every((item) => item.matched);
const evidenceVerified = Boolean(evidenceTables) && Object.values(evidenceTables).every(Boolean);
const restoredMigrationVersion = Number.parseInt(
  String(smoke?.latest_migration || '').split('_')[0],
  10
);
const smokePassed = Boolean(smoke)
  && smoke.database === verificationDb
  && Number.isFinite(restoredMigrationVersion)
  && restoredMigrationVersion >= 46;
const cleanupPassed = steps
  .filter((step) => step.name.startsWith('cleanup_'))
  .every((step) => step.passed);
const strictPassed = !failure
  && dumpBytes > 0
  && countsMatched
  && evidenceVerified
  && smokePassed
  && cleanupPassed;

const report = {
  generated_at: generatedAt,
  environment: 'Local Supabase Docker staging',
  project_id: project,
  db_container: container,
  source_database: 'postgres',
  verification_database: verificationDb,
  dump_scope: ['auth', 'public', 'storage', 'supabase_migrations'],
  excluded_managed_schemas: ['realtime and other Supabase service internals'],
  dump_bytes: dumpBytes,
  source_counts: sourceCounts,
  restored_counts: restoredCounts,
  count_comparisons: countComparisons,
  counts_matched: countsMatched,
  evidence_tables: evidenceTables,
  evidence_tables_verified: evidenceVerified,
  smoke_query: smoke,
  smoke_passed: smokePassed,
  cleanup_passed: cleanupPassed,
  strict_passed: strictPassed,
  failure,
  steps
};

const reportPath = 'release/v674/v674-restore-integrity-dryrun.json';
fs.writeFileSync(
  path.join(root, reportPath),
  `${JSON.stringify(report, null, 2)}\n`,
  'utf8'
);

const evidenceLines = [
  'v6.7.4 Restore Integrity Dry-Run Evidence',
  'Environment: Local Supabase Docker staging',
  `Generated UTC: ${generatedAt}`,
  `Source database: postgres in ${container || 'not detected'}`,
  `Temporary verification database: ${verificationDb}`,
  'Dump scope: auth, public, storage, supabase_migrations',
  'Managed service scope limitation: realtime and other Supabase service internals are not claimed by this application-data restore proof.',
  `Dump size bytes: ${dumpBytes}`,
  '',
  'Key table count comparison:',
  ...countComparisons.map((item) =>
    `- ${item.table}: source=${item.source_count}, restored=${item.restored_count}, ${item.matched ? 'MATCHED' : 'MISMATCH'}`
  ),
  '',
  'Evidence-related table verification:',
  ...Object.entries(evidenceTables || {}).map(([table, exists]) => `- ${table}: ${exists ? 'VERIFIED' : 'MISSING'}`),
  '',
  `Post-restore smoke query: ${smokePassed ? 'PASSED' : 'FAILED'}`,
  smoke ? JSON.stringify(smoke, null, 2) : 'No smoke-query result.',
  '',
  `Temporary database cleanup: ${cleanupPassed ? 'PASSED' : 'FAILED'}`,
  `Final status: ${strictPassed ? 'RESTORE VERIFIED / PASSED' : 'RESTORE FAILED'}`,
  strictPassed ? 'V674_RESTORE_INTEGRITY_VERIFIED' : 'V674_RESTORE_INTEGRITY_FAILED',
  failure ? `Failure: ${failure}` : 'Failure: none',
  '',
  `Detailed machine-readable report: ${reportPath}`
];
fs.writeFileSync(
  path.join(evidenceDir, 'restore-dryrun-evidence.txt'),
  `${evidenceLines.join('\n')}\n`,
  'utf8'
);

const updated = updateRestoreEvidence(strictPassed, reportPath);
console.log('v6.7.4 restore integrity dry-run complete.');
console.log({
  strict_passed: strictPassed,
  dump_bytes: dumpBytes,
  counts_matched: countsMatched,
  evidence_tables_verified: evidenceVerified,
  smoke_passed: smokePassed,
  manual_evidence_updated: updated
});

if (!strictPassed) process.exit(1);
