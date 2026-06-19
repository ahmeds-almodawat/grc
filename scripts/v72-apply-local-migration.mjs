import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const migrationVersion = '047';
const migrationName = 'v72_runtime_bridge_and_persona_security';
const migrationFile = path.join(
  root,
  'supabase',
  'migrations',
  `${migrationVersion}_${migrationName}.sql`,
);
const configFile = path.join(root, 'supabase', 'config.toml');

function runDocker(args, options = {}) {
  return spawnSync('docker', args, {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
    ...options,
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
const detection = runDocker([
  'ps',
  '--filter', `label=com.supabase.cli.project=${project}`,
  '--filter', 'name=supabase_db_',
  '--format', '{{.Names}}',
]);
const containers = (detection.stdout || '')
  .split(/\r?\n/)
  .map((value) => value.trim())
  .filter(Boolean);

if (detection.status !== 0 || containers.length !== 1) {
  console.error(
    containers.length
      ? `Expected one Supabase DB container for "${project}", found: ${containers.join(', ')}`
      : `No running Supabase DB container found for "${project}". Run: npx supabase start`,
  );
  process.exit(1);
}

const container = containers[0];
const sql = fs.readFileSync(migrationFile, 'utf8');
const apply = runDocker([
  'exec', '-i', container,
  'psql', '-U', 'postgres', '-d', 'postgres',
  '-v', 'ON_ERROR_STOP=1',
], { input: sql });

if (apply.status !== 0) {
  console.error(`${apply.stdout || ''}${apply.stderr || ''}`);
  console.error('v7.2 migration failed and was rolled back. Fix the SQL error, then rerun.');
  process.exit(1);
}

const record = runDocker([
  'exec', container,
  'psql', '-U', 'postgres', '-d', 'postgres',
  '-v', 'ON_ERROR_STOP=1',
  '-c',
  `insert into supabase_migrations.schema_migrations(version, statements, name)
   values ('${migrationVersion}', array[]::text[], '${migrationName}')
   on conflict (version) do update set name = excluded.name;`,
]);
if (record.status !== 0) {
  console.error(record.stderr || record.stdout || 'Migration ledger recording failed.');
  process.exit(1);
}

console.log(`Migration ${migrationVersion} applied idempotently to ${container}.`);
