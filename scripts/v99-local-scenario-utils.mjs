import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const root = process.cwd();
export const tag = 'V99_SCENARIO_LAB';
export const defaultEmail = 'pilot.admin@almodawat.test';
export const releaseDir = path.join(root, 'release', 'v99');

const configPath = path.join(root, 'supabase', 'config.toml');

export function ensureLocalOnly() {
  if (String(process.env.NODE_ENV || 'development').toLowerCase() === 'production') {
    throw new Error('V99_REFUSED_PRODUCTION: Scenario Lab scripts are local/controlled-pilot only.');
  }
}

function runDocker(args, options = {}) {
  return spawnSync('docker', args, {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024,
    ...options,
  });
}

function projectId() {
  const config = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf8') : '';
  return config.match(/^\s*project_id\s*=\s*"([^"]+)"/m)?.[1] || path.basename(root);
}

export function detectDatabaseContainer() {
  const project = projectId();
  const result = runDocker([
    'ps',
    '--filter', `label=com.supabase.cli.project=${project}`,
    '--filter', 'name=supabase_db_',
    '--format', '{{.Names}}',
  ]);
  const containers = (result.stdout || '')
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);

  if (result.status !== 0) {
    throw new Error(`Docker is unavailable: ${(result.stderr || result.error?.message || '').trim()}`);
  }
  if (containers.length === 0) {
    throw new Error(`No local Supabase DB found for "${project}". Run: npx supabase start`);
  }
  if (containers.length !== 1 || !containers[0].startsWith('supabase_db_')) {
    throw new Error(`Refusing ambiguous database target: ${containers.join(', ')}`);
  }

  return { project, container: containers[0] };
}

export function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

export function queryText(container, sql) {
  const result = runDocker([
    'exec', '-i', container,
    'psql', '-X', '-U', 'postgres', '-d', 'postgres',
    '-v', 'ON_ERROR_STOP=1',
    '-qAt',
  ], { input: sql });

  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || 'Local SQL command failed.').trim());
  }
  return (result.stdout || '').trim();
}

export function queryJson(container, sql) {
  const output = queryText(container, sql);
  try {
    return JSON.parse(output);
  } catch {
    throw new Error(`Database result was not valid JSON: ${output || '(empty output)'}`);
  }
}

export function findActor(container, email = defaultEmail) {
  const actor = queryJson(container, `
select coalesce((
  select json_build_object(
    'id', p.id,
    'email', p.email,
    'organization_id', p.organization_id
  )
  from public.profiles p
  where lower(p.email) = lower(${sqlLiteral(email)})
    and p.is_active = true
    and exists (
      select 1
      from public.user_roles ur
      where ur.user_id = p.id
        and ur.is_active = true
        and ur.role in ('super_admin', 'governance_admin')
        and (
          ur.organization_id is null
          or ur.organization_id is not distinct from p.organization_id
        )
    )
  limit 1
), 'null'::json)::text;
`);

  if (!actor?.id) {
    throw new Error(
      `No active super_admin/governance_admin profile found for ${email}. `
      + 'Run: npm run pilot:first-run-bootstrap',
    );
  }
  return actor;
}

export function callServiceRoleRpc(container, functionName, argsSql) {
  return queryJson(container, `
set "request.jwt.claim.role" = 'service_role';
select public.${functionName}(${argsSql})::text;
`);
}

export function scenarioStatus(container, actorId) {
  return callServiceRoleRpc(
    container,
    'v99_scenario_status',
    `${sqlLiteral(actorId)}::uuid, ${sqlLiteral(tag)}`,
  );
}

export function createScenario(container, actorId, scenario) {
  return callServiceRoleRpc(
    container,
    'v99_create_scenario',
    `${sqlLiteral(actorId)}::uuid, ${sqlLiteral(scenario)}, ${sqlLiteral(tag)}`,
  );
}

export function cleanupScenarios(container, actorId) {
  return callServiceRoleRpc(
    container,
    'v99_cleanup_scenarios',
    `${sqlLiteral(actorId)}::uuid, ${sqlLiteral(tag)}`,
  );
}

export function ensureReleaseDir() {
  fs.mkdirSync(releaseDir, { recursive: true });
}

export function escapeMarkdown(value) {
  return String(value ?? '')
    .replaceAll('|', '\\|')
    .replace(/\r?\n/g, ' ');
}

export function parseEmailArg(argv) {
  let email = defaultEmail;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--email') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error('Missing value for --email.');
      email = value.trim().toLowerCase();
      index += 1;
    }
  }
  return email;
}
