import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const migrationVersion = '046';
const migrationName = 'v673_lockdown_security_definer_execute';
const migrationFile = path.join(root, 'supabase', 'migrations', `${migrationVersion}_${migrationName}.sql`);
const configFile = path.join(root, 'supabase', 'config.toml');

function run(args, options = {}) {
  return spawnSync('docker', args, {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
    ...options
  });
}

function projectId() {
  const config = fs.existsSync(configFile) ? fs.readFileSync(configFile, 'utf8') : '';
  return config.match(/^\s*project_id\s*=\s*"([^"]+)"/m)?.[1] || path.basename(root);
}

if (!fs.existsSync(migrationFile)) {
  console.error(`Migration file not found: ${path.relative(root, migrationFile)}`);
  process.exit(1);
}

const project = projectId();
const detection = run([
  'ps',
  '--filter', `label=com.supabase.cli.project=${project}`,
  '--filter', 'name=supabase_db_',
  '--format', '{{.Names}}'
]);
const containers = (detection.stdout || '').split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
if (detection.error || detection.status !== 0 || containers.length !== 1) {
  console.error(
    containers.length
      ? `Expected one Supabase DB container for "${project}", found: ${containers.join(', ')}`
      : `No running Supabase DB container found for "${project}". Run: npm run supabase:local:start`
  );
  process.exit(1);
}

const container = containers[0];
const ledgerCheck = run([
  'exec', container,
  'psql', '-U', 'postgres', '-d', 'postgres',
  '-At', '-v', 'ON_ERROR_STOP=1',
  '-c', `select count(*) from supabase_migrations.schema_migrations where version = '${migrationVersion}';`
]);
if (ledgerCheck.status !== 0) {
  console.error(ledgerCheck.stderr || ledgerCheck.stdout || 'Unable to read migration ledger.');
  process.exit(1);
}

if ((ledgerCheck.stdout || '').trim() === '1') {
  console.log(`Migration ${migrationVersion} is already applied to ${container}.`);
  process.exit(0);
}

console.log(`Applying migration ${migrationVersion} to ${container}...`);
const sql = fs.readFileSync(migrationFile, 'utf8');
const apply = run([
  'exec', '-i', container,
  'psql', '-U', 'postgres', '-d', 'postgres',
  '-v', 'ON_ERROR_STOP=1'
], { input: sql });
if (apply.status !== 0) {
  console.error(`${apply.stdout || ''}${apply.stderr || ''}`);
  console.error('Migration failed. The migration transaction was rolled back; review the SQL error and rerun.');
  process.exit(1);
}

const record = run([
  'exec', container,
  'psql', '-U', 'postgres', '-d', 'postgres',
  '-v', 'ON_ERROR_STOP=1',
  '-c',
  `insert into supabase_migrations.schema_migrations(version, statements, name)
   values ('${migrationVersion}', array[]::text[], '${migrationName}')
   on conflict (version) do update set name = excluded.name;`
]);
if (record.status !== 0) {
  console.error(record.stderr || record.stdout || 'Migration applied but ledger recording failed.');
  console.error('Rerun this helper; migration 046 is idempotent and the ledger step will be retried.');
  process.exit(1);
}

console.log(`Migration ${migrationVersion} applied and recorded successfully.`);
