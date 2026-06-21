import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const configPath = path.join(root, 'supabase', 'config.toml');
const reportDir = path.join(root, 'release', 'v98');
const reportPath = path.join(reportDir, 'first-run-bootstrap-verification.md');

const requiredDepartments = [
  { code: 'IT', nameEn: 'Information Technology' },
  { code: 'QUALITY', nameEn: 'Quality & Patient Safety' },
  { code: 'GOVCOMP', nameEn: 'Governance & Compliance' },
  { code: 'AUDIT', nameEn: 'Internal Audit' },
  { code: 'FIN', nameEn: 'Finance' },
  { code: 'HR', nameEn: 'Human Resources' },
  { code: 'ENG', nameEn: 'Engineering & Projects' },
  { code: 'NURS', nameEn: 'Nursing' },
];

function parseArgs(argv) {
  const result = {
    email: 'pilot.admin@almodawat.test',
    allowLocalBootstrap: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--allow-local-bootstrap') {
      result.allowLocalBootstrap = true;
      continue;
    }
    if (arg === '--email') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error('Missing value for --email.');
      result.email = value.trim().toLowerCase();
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email)) {
    throw new Error(`Invalid email address: ${result.email}`);
  }
  return result;
}

function enforceLocalOnly(options) {
  const nodeEnv = String(process.env.NODE_ENV || 'development').toLowerCase();
  if (nodeEnv === 'production' && !options.allowLocalBootstrap) {
    throw new Error(
      'Refusing to run with NODE_ENV=production. Verification is limited to the local Supabase Docker stack.'
    );
  }
}

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
  const config = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf8') : '';
  return config.match(/^\s*project_id\s*=\s*"([^"]+)"/m)?.[1] || path.basename(root);
}

function detectLocalDatabaseContainer(project) {
  const result = runDocker([
    'ps',
    '--filter', `label=com.supabase.cli.project=${project}`,
    '--filter', 'name=supabase_db_',
    '--format', '{{.Names}}',
  ]);

  if (result.error || result.status !== 0) {
    throw new Error(`Docker is unavailable: ${result.error?.message || result.stderr || 'docker ps failed'}`);
  }

  const containers = (result.stdout || '')
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);

  if (containers.length === 0) {
    throw new Error(
      `No running local Supabase database was found for project "${project}". Run "npx supabase start" and retry.`
    );
  }
  if (containers.length !== 1 || !containers[0].startsWith('supabase_db_')) {
    throw new Error(`Refusing ambiguous or unexpected local database target: ${containers.join(', ')}`);
  }
  return containers[0];
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function queryJson(container, sql) {
  const result = runDocker([
    'exec', '-i', container,
    'psql', '-X', '-U', 'postgres', '-d', 'postgres',
    '-v', 'ON_ERROR_STOP=1',
    '-qAt',
  ], { input: sql });

  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || 'Local verification SQL failed.').trim());
  }

  const output = (result.stdout || '').trim();
  try {
    return JSON.parse(output);
  } catch {
    throw new Error(`Database result was not valid JSON: ${output || '(empty output)'}`);
  }
}

function escapeMarkdown(value) {
  return String(value ?? '').replaceAll('|', '\\|').replace(/\r?\n/g, ' ');
}

function writeReport({ generatedAt, project, container, email, checks, passed, error }) {
  fs.mkdirSync(reportDir, { recursive: true });
  const departmentRows = (checks?.departments || [])
    .map((department) => (
      `| ${escapeMarkdown(department.code)} | ${escapeMarkdown(department.expected_name)} | ` +
      `${department.exists ? 'PASS' : 'FAIL'} | ${escapeMarkdown(department.actual_name || 'missing')} |`
    ))
    .join('\n');

  const lines = [
    '# v9.8 First-Run Pilot Bootstrap Verification',
    '',
    `- Generated: ${generatedAt}`,
    `- Status: **${passed ? 'PASSED' : 'FAILED'}**`,
    '- Environment: Local Supabase Docker staging/pilot only',
    `- Supabase project: ${escapeMarkdown(project)}`,
    `- Database container: ${escapeMarkdown(container || 'not detected')}`,
    `- Target email: ${escapeMarkdown(email)}`,
    '- Production readiness: **Not asserted**',
    '',
  ];

  if (checks) {
    lines.push(
      '## Required checks',
      '',
      `- Auth user exists: **${checks.auth_user_exists ? 'PASS' : 'FAIL'}**`,
      `- Profile exists: **${checks.profile_exists ? 'PASS' : 'FAIL'}**`,
      `- Profile active: **${checks.profile_active ? 'PASS' : 'FAIL'}**`,
      `- Active organization selected: **${checks.active_organization_exists ? 'PASS' : 'FAIL'}**`,
      `- Active global super-admin role: **${checks.super_admin_global_active ? 'PASS' : 'FAIL'}**`,
      `- Exactly one active matching role: **${checks.active_matching_role_count === 1 ? 'PASS' : 'FAIL'}** (${checks.active_matching_role_count})`,
      `- All required departments active: **${checks.missing_departments.length === 0 ? 'PASS' : 'FAIL'}**`,
      '',
      '| Code | Expected department | Result | Actual name |',
      '|---|---|---|---|',
      departmentRows,
      '',
      `Missing departments: ${checks.missing_departments.length ? checks.missing_departments.join(', ') : 'none'}`,
      '',
      'This verification confirms local bootstrap integrity only. It does not constitute production approval.',
      ''
    );
  }

  if (error) {
    lines.push(
      '## Verification error',
      '',
      '```text',
      error.message,
      '```',
      ''
    );
  }

  fs.writeFileSync(reportPath, `${lines.join('\n')}\n`, 'utf8');
}

const generatedAt = new Date().toISOString();
let options = { email: 'pilot.admin@almodawat.test', allowLocalBootstrap: false };
let project = 'unknown';
let container = null;

try {
  options = parseArgs(process.argv.slice(2));
  enforceLocalOnly(options);
  project = projectId();
  container = detectLocalDatabaseContainer(project);

  const departmentValues = requiredDepartments
    .map(({ code, nameEn }) => `(${sqlLiteral(code)}, ${sqlLiteral(nameEn)})`)
    .join(',\n      ');

  const checks = queryJson(container, `
with target_user as (
  select id
  from auth.users
  where lower(email) = lower(${sqlLiteral(options.email)})
  order by created_at
  limit 1
),
target_profile as (
  select p.*
  from public.profiles p
  join target_user u on u.id = p.id
),
required_departments(code, expected_name) as (
  values
      ${departmentValues}
),
department_checks as (
  select
    required.code,
    required.expected_name,
    department.id is not null as exists,
    department.name_en as actual_name
  from required_departments required
  left join lateral (
    select d.id, d.name_en
    from public.departments d
    join target_profile p on p.organization_id = d.organization_id
    where upper(trim(d.code)) = required.code
      and lower(trim(d.name_en)) = lower(required.expected_name)
      and d.is_active = true
    order by d.created_at, d.id
    limit 1
  ) department on true
)
select json_build_object(
  'auth_user_exists', exists(select 1 from target_user),
  'profile_exists', exists(select 1 from target_profile),
  'profile_active', coalesce((select is_active from target_profile), false),
  'active_organization_exists', exists(
    select 1
    from public.organizations o
    join target_profile p on p.organization_id = o.id
    where o.is_active = true
  ),
  'super_admin_global_active', exists(
    select 1
    from public.user_roles ur
    join target_profile p on p.id = ur.user_id
    where ur.role = 'super_admin'
      and ur.scope = 'global'
      and ur.organization_id = p.organization_id
      and ur.division_id is null
      and ur.department_id is null
      and ur.unit_id is null
      and ur.is_active = true
  ),
  'active_matching_role_count', (
    select count(*)
    from public.user_roles ur
    join target_profile p on p.id = ur.user_id
    where ur.role = 'super_admin'
      and ur.scope = 'global'
      and ur.organization_id = p.organization_id
      and ur.division_id is null
      and ur.department_id is null
      and ur.unit_id is null
      and ur.is_active = true
  ),
  'departments', (
    select json_agg(
      json_build_object(
        'code', code,
        'expected_name', expected_name,
        'exists', exists,
        'actual_name', actual_name
      )
      order by code
    )
    from department_checks
  ),
  'missing_departments', (
    select coalesce(json_agg(code order by code) filter (where not exists), '[]'::json)
    from department_checks
  )
)::text;
`);

  const passed = Boolean(
    checks.auth_user_exists
    && checks.profile_exists
    && checks.profile_active
    && checks.active_organization_exists
    && checks.super_admin_global_active
    && checks.active_matching_role_count === 1
    && Array.isArray(checks.missing_departments)
    && checks.missing_departments.length === 0
  );

  writeReport({
    generatedAt,
    project,
    container,
    email: options.email,
    checks,
    passed,
    error: null,
  });

  if (!passed) {
    console.error('v9.8 first-run bootstrap verification: FAILED');
    console.error(`Missing departments: ${checks.missing_departments.join(', ') || 'none'}`);
    console.error(`Report: ${path.relative(root, reportPath)}`);
    process.exitCode = 1;
  } else {
    console.log('v9.8 first-run bootstrap verification: PASSED');
    console.log(`Auth user: ${options.email}`);
    console.log('Profile: active');
    console.log('Role: super_admin/global (active)');
    console.log('Required departments: 8/8');
    console.log(`Report: ${path.relative(root, reportPath)}`);
  }
} catch (error) {
  writeReport({
    generatedAt,
    project,
    container,
    email: options.email,
    checks: null,
    passed: false,
    error,
  });
  console.error('v9.8 first-run bootstrap verification: FAILED');
  console.error(error.message);
  console.error('Run "npx supabase start", then "npm run v98:bootstrap-admin", and retry.');
  process.exitCode = 1;
}
