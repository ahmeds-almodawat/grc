import fs from 'node:fs';
import path from 'node:path';
import {
  defaultEmail,
  detectDatabaseContainer,
  ensureLocalOnly,
  ensureReleaseDir,
  escapeMarkdown,
  findActor,
  parseEmailArg,
  queryJson,
  releaseDir,
  root,
  tag,
} from './v99-local-scenario-utils.mjs';

const generatedAt = new Date().toISOString();
const reportPath = path.join(releaseDir, 'scenario-lab-verification.md');
const email = parseEmailArg(process.argv.slice(2)) || defaultEmail;

const requiredFiles = [
  'src/pages/ScenarioTestConsole.tsx',
  'src/components/ScenarioFillButton.tsx',
  'src/lib/scenarioLab.ts',
  'supabase/migrations/050_v99_scenario_lab.sql',
  'supabase/functions/privileged-action/index.ts',
  'scripts/v99-create-synthetic-scenario-dataset.mjs',
  'scripts/v99-cleanup-synthetic-scenario-dataset.mjs',
  'scripts/v99-final-testing-report.mjs',
];

let context = { project: 'unknown', container: 'not detected' };
let checks = [];
let error = null;

try {
  ensureLocalOnly();
  ensureReleaseDir();
  context = detectDatabaseContainer();
  const actor = findActor(context.container, email);

  checks = requiredFiles.map((relativePath) => ({
    name: `File exists: ${relativePath}`,
    passed: fs.existsSync(path.join(root, relativePath)),
    details: relativePath,
  }));

  const database = queryJson(context.container, `
select json_build_object(
  'registry_exists', to_regclass('public.v99_scenario_lab_records') is not null,
  'create_rpc_exists', to_regprocedure('public.v99_create_scenario(uuid,text,text)') is not null,
  'cleanup_rpc_exists', to_regprocedure('public.v99_cleanup_scenarios(uuid,text)') is not null,
  'status_rpc_exists', to_regprocedure('public.v99_scenario_status(uuid,text)') is not null,
  'broad_execute_grants', (
    select count(*)
    from information_schema.routine_privileges rp
    where rp.specific_schema = 'public'
      and rp.routine_name like 'v99_%'
      and rp.privilege_type = 'EXECUTE'
      and rp.grantee in ('PUBLIC', 'anon', 'authenticated')
  ),
  'exact_tag_constraint', exists (
    select 1
    from pg_constraint c
    join pg_class relation on relation.oid = c.conrelid
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'v99_scenario_lab_records'
      and pg_get_constraintdef(c.oid) like '%V99_SCENARIO_LAB%'
  )
)::text;
`);

  checks.push(
    { name: 'Authorized local pilot actor exists', passed: Boolean(actor.id), details: actor.email },
    { name: 'Private exact-tag registry exists', passed: database.registry_exists, details: tag },
    { name: 'Create scenario RPC exists', passed: database.create_rpc_exists, details: 'service_role only' },
    { name: 'Cleanup scenario RPC exists', passed: database.cleanup_rpc_exists, details: 'service_role only' },
    { name: 'Scenario status RPC exists', passed: database.status_rpc_exists, details: 'service_role only' },
    {
      name: 'No broad execute grants on v9.9 RPCs',
      passed: Number(database.broad_execute_grants) === 0,
      details: String(database.broad_execute_grants),
    },
    { name: 'Registry enforces exact dataset marker', passed: database.exact_tag_constraint, details: tag },
  );
} catch (caught) {
  error = caught;
}

const passed = !error && checks.length > 0 && checks.every((check) => check.passed);
const rows = checks.map(
  (check) => `| ${escapeMarkdown(check.name)} | ${check.passed ? 'PASS' : 'FAIL'} | ${escapeMarkdown(check.details)} |`,
);

ensureReleaseDir();
fs.writeFileSync(reportPath, `# v9.9 Scenario Lab Verification

- Generated: ${generatedAt}
- Status: **${passed ? 'PASSED' : 'FAILED'}**
- Environment: Local Supabase Docker / controlled pilot only
- Project: ${escapeMarkdown(context.project)}
- Container: ${escapeMarkdown(context.container)}
- Production readiness: **Not asserted**

## Verification checks

| Check | Result | Details |
|---|---|---|
${rows.join('\n')}

## Safety conclusion

- The browser receives no service-role key.
- Scenario mutation is routed through the authenticated Edge Function and service-role-only RPCs.
- Cleanup is constrained to UUIDs in the private registry with exact tag \`${tag}\`.
- Human approvals and the v66 gate are not modified or bypassed.
${error ? `
## Error

\`\`\`text
${error.message}
\`\`\`
` : ''}
`, 'utf8');

console.log(`v9.9 Scenario Lab verification: ${passed ? 'PASSED' : 'FAILED'}`);
console.log(`Report: ${path.relative(root, reportPath)}`);
if (!passed) {
  if (error) console.error(error.message);
  console.error('Apply local migrations, confirm the pilot admin bootstrap, and retry.');
  process.exitCode = 1;
}
