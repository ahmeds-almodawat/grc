import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const outDir = path.join(root, 'release', 'v673');
const configPath = path.join(root, 'supabase', 'config.toml');
fs.mkdirSync(outDir, { recursive: true });

function run(args) {
  return spawnSync('docker', args, {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024
  });
}

function projectId() {
  if (fs.existsSync(configPath)) {
    const config = fs.readFileSync(configPath, 'utf8');
    const match = config.match(/^\s*project_id\s*=\s*"([^"]+)"/m);
    if (match) return match[1];
  }
  return path.basename(root);
}

const project = projectId();
const detection = run([
  'ps',
  '--filter', `label=com.supabase.cli.project=${project}`,
  '--filter', 'name=supabase_db_',
  '--format', '{{.Names}}'
]);
const containers = (detection.stdout || '').split(/\r?\n/).map((value) => value.trim()).filter(Boolean);

if (detection.error || detection.status !== 0) {
  console.error(`Docker is unavailable: ${detection.error?.message || detection.stderr || 'docker ps failed'}`);
  process.exit(1);
}
if (containers.length !== 1) {
  console.error(
    containers.length
      ? `Expected one Supabase DB container for "${project}", found: ${containers.join(', ')}`
      : `No running Supabase DB container found for "${project}". Run: npm run supabase:local:start`
  );
  process.exit(1);
}

const container = containers[0];
const query = `
select json_build_object(
  'schema_name', n.nspname,
  'function_signature', p.oid::regprocedure::text,
  'grantee', roles.rolname
)::text
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
cross join (values ('public'), ('anon'), ('authenticated')) as roles(rolname)
where n.nspname = 'public'
  and p.prosecdef = true
  and has_function_privilege(roles.rolname, p.oid, 'EXECUTE')
order by p.oid::regprocedure::text, roles.rolname;
`;
const audit = run([
  'exec', container,
  'psql', '-U', 'postgres', '-d', 'postgres',
  '-v', 'ON_ERROR_STOP=1',
  '-At', '-c', query
]);

if (audit.status !== 0) {
  console.error(audit.stderr || audit.stdout || 'Security definer audit query failed.');
  process.exit(1);
}

const findings = (audit.stdout || '')
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => JSON.parse(line));

const inventoryQuery = `
select json_build_object(
  'function_signature', p.oid::regprocedure::text,
  'security_mode', case when p.prosecdef then 'definer' else 'invoker' end,
  'authenticated_execute', has_function_privilege('authenticated', p.oid, 'EXECUTE'),
  'anon_execute', has_function_privilege('anon', p.oid, 'EXECUTE'),
  'service_role_execute', has_function_privilege('service_role', p.oid, 'EXECUTE')
)::text
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and (
    p.prosecdef = true
    or p.proname in (
      'current_user_org_id', 'has_any_role', 'has_global_role',
      'can_access_org', 'can_access_scope', 'can_manage_grc',
      'has_role', 'can_read_organization'
    )
  )
order by p.prosecdef desc, p.oid::regprocedure::text;
`;
const inventoryResult = run([
  'exec', container,
  'psql', '-U', 'postgres', '-d', 'postgres',
  '-v', 'ON_ERROR_STOP=1',
  '-At', '-c', inventoryQuery
]);
if (inventoryResult.status !== 0) {
  console.error(inventoryResult.stderr || inventoryResult.stdout || 'Function inventory query failed.');
  process.exit(1);
}
const inventory = (inventoryResult.stdout || '')
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => JSON.parse(line));

const report = {
  generated_at: new Date().toISOString(),
  environment: 'Local Supabase Docker staging',
  project_id: project,
  db_container: container,
  security_definer_functions: inventory.filter((item) => item.security_mode === 'definer').length,
  remaining_broad_execute_grants: findings.length,
  strict_passed: findings.length === 0,
  findings,
  inventory,
  policy: 'No public SECURITY DEFINER function may be executable by public, anon, or authenticated. Trusted owner-level execution is service_role-only.'
};

fs.writeFileSync(
  path.join(outDir, 'v673-security-definer-execute-audit.json'),
  `${JSON.stringify(report, null, 2)}\n`,
  'utf8'
);
fs.writeFileSync(
  path.join(outDir, 'V673_SECURITY_DEFINER_EXECUTE_AUDIT.md'),
  `# v6.7.3 Security Definer Execute Audit

Generated: ${report.generated_at}

- SECURITY DEFINER functions: **${report.security_definer_functions}**
- Remaining broad execute grants: **${report.remaining_broad_execute_grants}**
- Strict passed: **${report.strict_passed ? 'yes' : 'no'}**

## Findings

${findings.length ? findings.map((item) => `- \`${item.function_signature}\` is executable by \`${item.grantee}\`.`).join('\n') : '- None.'}

## Policy

${report.policy}
`,
  'utf8'
);

console.log('v6.7.3 security definer execute audit complete.');
console.log({
  security_definer_functions: report.security_definer_functions,
  remaining_broad_execute_grants: report.remaining_broad_execute_grants,
  strict_passed: report.strict_passed
});

if (!report.strict_passed) process.exit(1);
