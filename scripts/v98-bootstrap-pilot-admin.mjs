import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const configPath = path.join(root, 'supabase', 'config.toml');
const reportDir = path.join(root, 'release', 'v98');
const reportPath = path.join(reportDir, 'first-run-bootstrap-report.md');

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
    fullNameEn: null,
    fullNameAr: null,
    allowLocalBootstrap: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--allow-local-bootstrap') {
      result.allowLocalBootstrap = true;
      continue;
    }

    if (['--email', '--full-name-en', '--full-name-ar'].includes(arg)) {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`Missing value for ${arg}.`);
      }
      index += 1;
      if (arg === '--email') result.email = value.trim().toLowerCase();
      if (arg === '--full-name-en') result.fullNameEn = value.trim();
      if (arg === '--full-name-ar') result.fullNameAr = value.trim();
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email)) {
    throw new Error(`Invalid email address: ${result.email}`);
  }

  if (!result.fullNameEn) {
    result.fullNameEn = result.email
      .split('@')[0]
      .split(/[._-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ') || 'Pilot Administrator';
  }

  return result;
}

function enforceLocalOnly(options) {
  const nodeEnv = String(process.env.NODE_ENV || 'development').toLowerCase();
  if (nodeEnv === 'production' && !options.allowLocalBootstrap) {
    throw new Error(
      'Refusing to run with NODE_ENV=production. This helper is local/dev/pilot only. ' +
      'Use --allow-local-bootstrap only when the target is the local Supabase Docker stack.'
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
      `No running local Supabase database was found for project "${project}". ` +
      'Run "npx supabase start" and retry.'
    );
  }
  if (containers.length > 1) {
    throw new Error(`Expected one local Supabase database container, found: ${containers.join(', ')}`);
  }
  if (!containers[0].startsWith('supabase_db_')) {
    throw new Error(`Refusing unexpected database container: ${containers[0]}`);
  }

  return containers[0];
}

function sqlLiteral(value) {
  if (value === null || value === undefined || value === '') return 'null';
  return `'${String(value).replaceAll("'", "''")}'`;
}

function executeSql(container, sql) {
  const result = runDocker([
    'exec', '-i', container,
    'psql', '-X', '-U', 'postgres', '-d', 'postgres',
    '-v', 'ON_ERROR_STOP=1',
    '-q',
  ], { input: sql });

  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || 'Local bootstrap SQL failed.').trim());
  }
}

function queryJson(container, sql) {
  const result = runDocker([
    'exec', '-i', container,
    'psql', '-X', '-U', 'postgres', '-d', 'postgres',
    '-v', 'ON_ERROR_STOP=1',
    '-qAt',
  ], { input: sql });

  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || 'Local verification query failed.').trim());
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

function writeReport({ generatedAt, project, container, options, result, error }) {
  fs.mkdirSync(reportDir, { recursive: true });
  const passed = !error && result?.status === 'passed';
  const departmentRows = (result?.departments || [])
    .map((department) => `| ${escapeMarkdown(department.code)} | ${escapeMarkdown(department.name_en)} | ${department.is_active ? 'active' : 'inactive'} |`)
    .join('\n');

  const lines = [
    '# v9.8 First-Run Pilot Bootstrap Report',
    '',
    `- Generated: ${generatedAt}`,
    `- Status: **${passed ? 'PASSED' : 'FAILED'}**`,
    '- Environment: Local Supabase Docker staging/pilot only',
    `- Supabase project: ${escapeMarkdown(project)}`,
    `- Database container: ${escapeMarkdown(container || 'not detected')}`,
    `- Target email: ${escapeMarkdown(options.email)}`,
    '- Production readiness: **Not asserted**',
    '',
    '## Safety controls',
    '',
    '- The helper did not insert into `auth.users`; the auth user had to exist first.',
    '- The helper connected only to the running local Supabase Docker database container.',
    '- Running this bootstrap helper does not modify RLS policies, migrations, approval records, or frontend runtime source files.',
    '- Re-running the helper reuses the profile, organization, departments, and role assignment.',
    '',
  ];

  if (passed) {
    lines.push(
      '## Bootstrap result',
      '',
      `- Auth user ID: \`${escapeMarkdown(result.auth_user_id)}\``,
      `- Profile ID: \`${escapeMarkdown(result.profile_id)}\``,
      `- Organization: ${escapeMarkdown(result.organization_name)} (\`${escapeMarkdown(result.organization_id)}\`)`,
      `- Role: \`${escapeMarkdown(result.role)}\` / \`${escapeMarkdown(result.scope)}\``,
      `- Active matching role rows: ${result.active_matching_role_count}`,
      '',
      '| Code | Department | State |',
      '|---|---|---|',
      departmentRows,
      '',
      'The database bootstrap completed. This report is local technical evidence only and is not a human approval or production-readiness declaration.',
      ''
    );
  } else {
    lines.push(
      '## Failure',
      '',
      '```text',
      String(error?.message || 'Unknown failure'),
      '```',
      '',
      'Start local Supabase with `npx supabase start`, create the auth user in Supabase Studio, and rerun the command.',
      ''
    );
  }

  fs.writeFileSync(reportPath, `${lines.join('\n')}\n`, 'utf8');
}

const generatedAt = new Date().toISOString();
let options = {
  email: 'pilot.admin@almodawat.test',
  fullNameEn: 'Pilot Admin',
  fullNameAr: null,
  allowLocalBootstrap: false,
};
let project = 'unknown';
let container = null;

try {
  options = parseArgs(process.argv.slice(2));
  enforceLocalOnly(options);
  project = projectId();
  container = detectLocalDatabaseContainer(project);

  const departmentValues = requiredDepartments
    .map(({ code, nameEn }) => `(${sqlLiteral(code)}, ${sqlLiteral(nameEn)})`)
    .join(',\n        ');

  const bootstrapSql = `
begin;
select pg_advisory_xact_lock(hashtext('grc-v98-first-run-pilot-bootstrap'));

do $v98$
declare
  v_user_id uuid;
  v_conflicting_profile_id uuid;
  v_organization_id uuid;
  v_department_id uuid;
  v_role_id uuid;
  v_department record;
begin
  select id
    into v_user_id
  from auth.users
  where lower(email) = lower(${sqlLiteral(options.email)})
  order by created_at
  limit 1;

  if v_user_id is null then
    raise exception 'V98_AUTH_USER_NOT_FOUND: Create % in local Supabase Studio before running the bootstrap.', ${sqlLiteral(options.email)};
  end if;

  select id
    into v_conflicting_profile_id
  from public.profiles
  where lower(email) = lower(${sqlLiteral(options.email)})
    and id <> v_user_id
  limit 1;

  if v_conflicting_profile_id is not null then
    raise exception 'V98_PROFILE_EMAIL_CONFLICT: profile % already uses the target email.', v_conflicting_profile_id;
  end if;

  select id
    into v_organization_id
  from public.organizations
  order by
    case
      when is_active and lower(trim(name_en)) = lower('Al Modawat Specialized Medical Company') then 0
      when is_active then 1
      when lower(trim(name_en)) = lower('Al Modawat Specialized Medical Company') then 2
      else 3
    end,
    created_at,
    id
  limit 1;

  if v_organization_id is null then
    insert into public.organizations (name_en, is_active)
    values ('Al Modawat Specialized Medical Company', true)
    returning id into v_organization_id;
  else
    update public.organizations
    set is_active = true,
        updated_at = now()
    where id = v_organization_id;
  end if;

  for v_department in
    select department_code, department_name
    from (
      values
        ${departmentValues}
    ) as required_department(department_code, department_name)
  loop
    v_department_id := null;

    select id
      into v_department_id
    from public.departments
    where organization_id = v_organization_id
      and (
        upper(trim(code)) = v_department.department_code
        or lower(trim(name_en)) = lower(v_department.department_name)
      )
    order by
      case when upper(trim(code)) = v_department.department_code then 0 else 1 end,
      is_active desc,
      created_at,
      id
    limit 1;

    if v_department_id is null then
      insert into public.departments (
        organization_id,
        name_en,
        code,
        is_active
      )
      values (
        v_organization_id,
        v_department.department_name,
        v_department.department_code,
        true
      )
      returning id into v_department_id;
    else
      update public.departments
      set code = v_department.department_code,
          name_en = v_department.department_name,
          is_active = true,
          updated_at = now()
      where id = v_department_id;
    end if;
  end loop;

  insert into public.profiles (
    id,
    organization_id,
    full_name_en,
    full_name_ar,
    email,
    job_title,
    is_active
  )
  values (
    v_user_id,
    v_organization_id,
    ${sqlLiteral(options.fullNameEn)},
    ${sqlLiteral(options.fullNameAr)},
    ${sqlLiteral(options.email)},
    'Pilot Administrator',
    true
  )
  on conflict (id) do update
  set organization_id = excluded.organization_id,
      full_name_en = excluded.full_name_en,
      full_name_ar = coalesce(excluded.full_name_ar, public.profiles.full_name_ar),
      email = excluded.email,
      job_title = coalesce(public.profiles.job_title, excluded.job_title),
      is_active = true,
      updated_at = now();

  select id
    into v_role_id
  from public.user_roles
  where user_id = v_user_id
    and role = 'super_admin'
    and scope = 'global'
    and organization_id = v_organization_id
    and division_id is null
    and department_id is null
    and unit_id is null
  order by is_active desc, assigned_at, id
  limit 1;

  if v_role_id is null then
    insert into public.user_roles (
      user_id,
      role,
      scope,
      organization_id,
      division_id,
      department_id,
      unit_id,
      is_active,
      assigned_by
    )
    values (
      v_user_id,
      'super_admin',
      'global',
      v_organization_id,
      null,
      null,
      null,
      true,
      v_user_id
    )
    returning id into v_role_id;
  else
    update public.user_roles
    set is_active = true,
        assigned_by = coalesce(assigned_by, v_user_id)
    where id = v_role_id;
  end if;

  update public.user_roles
  set is_active = false
  where user_id = v_user_id
    and role = 'super_admin'
    and scope = 'global'
    and organization_id = v_organization_id
    and division_id is null
    and department_id is null
    and unit_id is null
    and id <> v_role_id
    and is_active = true;
end
$v98$;

commit;
`;

  executeSql(container, bootstrapSql);

  const result = queryJson(container, `
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
target_role as (
  select ur.*
  from public.user_roles ur
  join target_user u on u.id = ur.user_id
  join target_profile p on p.id = ur.user_id
  where ur.role = 'super_admin'
    and ur.scope = 'global'
    and ur.organization_id = p.organization_id
    and ur.division_id is null
    and ur.department_id is null
    and ur.unit_id is null
    and ur.is_active = true
  order by ur.assigned_at, ur.id
  limit 1
)
select json_build_object(
  'status', 'passed',
  'auth_user_id', (select id from target_user),
  'profile_id', (select id from target_profile),
  'organization_id', (select organization_id from target_profile),
  'organization_name', (
    select o.name_en
    from public.organizations o
    join target_profile p on p.organization_id = o.id
  ),
  'role_id', (select id from target_role),
  'role', (select role from target_role),
  'scope', (select scope from target_role),
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
    select coalesce(json_agg(
      json_build_object(
        'code', d.code,
        'name_en', d.name_en,
        'is_active', d.is_active
      )
      order by d.code
    ), '[]'::json)
    from public.departments d
    join target_profile p on p.organization_id = d.organization_id
    where upper(trim(d.code)) in ('IT', 'QUALITY', 'GOVCOMP', 'AUDIT', 'FIN', 'HR', 'ENG', 'NURS')
      and d.is_active = true
  )
)::text;
`);

  writeReport({ generatedAt, project, container, options, result, error: null });
  console.log('v9.8 first-run pilot bootstrap: PASSED');
  console.log(`Auth user: ${options.email}`);
  console.log(`Organization: ${result.organization_name} (${result.organization_id})`);
  console.log(`Role: ${result.role}/${result.scope}`);
  console.log(`Report: ${path.relative(root, reportPath)}`);
} catch (error) {
  writeReport({ generatedAt, project, container, options, result: null, error });
  console.error('v9.8 first-run pilot bootstrap: FAILED');
  console.error(error.message);
  console.error('Next steps:');
  console.error('1. Run: npx supabase start');
  console.error(`2. Confirm ${options.email} exists under Authentication > Users in local Supabase Studio.`);
  console.error('3. Rerun: npm run v98:bootstrap-admin');
  process.exitCode = 1;
}
