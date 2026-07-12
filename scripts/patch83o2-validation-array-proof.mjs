import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

let exitCode = 0;

function check(name, condition) {
  if (condition) {
    console.log(`PASS: ${name}`);
  } else {
    console.log(`FAIL: ${name}`);
    exitCode = 1;
  }
}

const root = process.cwd();
const releaseDir = path.join(root, 'release', 'patch83o2');
const migration167Path = path.join(root, 'supabase', 'migrations', '167_patch83m_secure_department_import_backend.sql');
const migration168Path = path.join(root, 'supabase', 'migrations', '168_patch83o_department_import_schema_compatibility.sql');
const migration169Path = path.join(root, 'supabase', 'migrations', '169_patch83o_validation_error_array_fix.sql');
const expectedEvidence = [
  'patch83o2-root-cause.md',
  'patch83o2-corrective-migration.md',
  'patch83o2-security-review.md',
  'patch83o2-deployment-result.md',
  'patch83o2-activation-decision.md'
];

console.log('\n--- Running Patch 83O.2 Validation Array Proof ---\n');

for (const file of expectedEvidence) {
  check(`Evidence exists: ${file}`, fs.existsSync(path.join(releaseDir, file)));
}

check('Migration 169 exists', fs.existsSync(migration169Path));

const migration167Bytes = fs.readFileSync(migration167Path);
const migration168 = fs.readFileSync(migration168Path, 'utf8').replace(/\r\n/g, '\n');
const migration169 = fs.readFileSync(migration169Path, 'utf8').replace(/\r\n/g, '\n');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const departmentsPage = fs.readFileSync(path.join(root, 'src', 'pages', 'Departments.tsx'), 'utf8');
const featureFlags = fs.readFileSync(path.join(root, 'src', 'config', 'featureFlags.ts'), 'utf8');
const deploymentEvidence = fs.readFileSync(path.join(releaseDir, 'patch83o2-deployment-result.md'), 'utf8');
const patch83oRuntimeEvidence = fs.readFileSync(
  path.join(root, 'release', 'patch83o', 'patch83o-authenticated-runtime-verification.md'),
  'utf8'
);

check(
  'Migration 167 remains byte-for-byte unchanged',
  crypto.createHash('sha256').update(migration167Bytes).digest('hex') ===
    '5f4648c6a133fb77d311501713b89167dcb4e845c69b2fc075db51369dfac81b'
);
check(
  'Migration 168 remains byte-for-byte unchanged',
  crypto.createHash('sha256').update(migration168).digest('hex') ===
    'b3658dc70519f2b70ccfb0f6d9f9f5a016417e5ec45783e72a47157ce945b017'
);

const expected169 = migration168
  .replace(
    '-- Patch 83O.1: align department import execution with the deployed core schema.\n-- Migration 167 remains historical; this migration replaces only the RPC body.',
    '-- Patch 83O.2: correct validation-array appends without changing the import contract.\n-- Migrations 167 and 168 remain historical; this migration replaces only the RPC body.'
  )
  .replace(
    /v_errors := v_errors \|\| ('[^'\r\n]*');/g,
    'v_errors := pg_catalog.array_append(v_errors, $1);'
  )
  .replace(
    'v_seen_codes := v_seen_codes || v_code;',
    'v_seen_codes := pg_catalog.array_append(v_seen_codes, v_code);'
  )
  .replace(
    'v_affected_ids := v_affected_ids || v_existing_department_id;',
    'v_affected_ids := pg_catalog.array_append(v_affected_ids, v_existing_department_id);'
  );

check('Migration 169 changes only array appends and migration comments', migration169 === expected169);
check('Migration 169 keeps the exact RPC signature', migration169.includes('public.apply_department_import_batch(\n  p_actor_id uuid,\n  p_organization_id uuid,\n  p_source_filename text,\n  p_import_mode text,\n  p_rows jsonb\n) returns jsonb'));
check('RPC remains SECURITY DEFINER', /language plpgsql\s+security definer/i.test(migration169));
check('RPC keeps the exact safe search_path', migration169.includes('set search_path = pg_catalog, public, pg_temp'));
check('RPC still requires service_role', migration169.includes("if auth.role() <> 'service_role'"));
check('RPC keeps explicit active actor and role authorization', migration169.includes('p.is_active = true') && migration169.includes("p.user_status = 'active'") && migration169.includes("'super_admin'::public.app_role") && migration169.includes("'governance_admin'::public.app_role") && migration169.includes("ur.scope = 'global'::public.access_scope"));
check('RPC keeps organization scope enforcement', migration169.includes('p.organization_id = p_organization_id') && migration169.includes('d.organization_id = p_organization_id') && migration169.includes('v_manager_org_id is distinct from p_organization_id'));
check('RPC keeps enum-controlled create modes', migration169.includes('p_import_mode::public.department_import_mode') && migration169.includes("v_mode = 'create_only'"));
check('Manager validation and mapping remain department-scoped through user_roles', migration169.includes("ur.role = 'department_manager'::public.app_role") && migration169.includes("ur.scope = 'department'::public.access_scope") && migration169.includes('ur.department_id = v_existing_department_id'));

const declaredArrayVariables = [...migration169.matchAll(/^\s*(v_[a-z0-9_]+)\s+[a-z0-9_.]+\[\]/gim)].map((match) => match[1]);
check('All RPC array variables were inspected', JSON.stringify(declaredArrayVariables.sort()) === JSON.stringify(['v_affected_ids', 'v_errors', 'v_existing_department_ids', 'v_manager_ids', 'v_seen_codes']));
for (const variable of declaredArrayVariables) {
  const unsafeSelfConcat = new RegExp(`\\b${variable}\\s*:=\\s*${variable}\\s*\\|\\|`, 'i');
  check(`${variable} has no scalar-to-array concatenation`, !unsafeSelfConcat.test(migration169));
}
const validationAssignments = [...migration169.matchAll(/^\s*v_errors\s*:=\s*(.+);\s*$/gim)].map((match) => match[1]);
check(
  'Every validation-message append uses pg_catalog.array_append',
  validationAssignments.length === 16 &&
    validationAssignments.every((assignment) =>
      assignment === "'{}'::text[]" || assignment.startsWith('pg_catalog.array_append(v_errors, ')
    )
);
check('Invalid division uses a safe validation append', migration169.includes("v_errors := pg_catalog.array_append(v_errors, 'invalid division');"));
check('Missing manager uses a safe validation append', migration169.includes("v_errors := pg_catalog.array_append(v_errors, 'manager not found');"));
check('Validation failures return a structured rejection', migration169.includes("'status', 'rejected'") && migration169.includes("'row_errors', v_row_errors") && migration169.includes("'created_count', 0") && migration169.includes("'updated_count', 0"));

const validationPosition = migration169.indexOf('-- Phase A:');
const rejectionPosition = migration169.indexOf('if v_failed_count > 0 then');
const firstWritePosition = migration169.indexOf('insert into public.department_import_batches');
check('All-row validation still precedes persistent DML', validationPosition >= 0 && rejectionPosition > validationPosition && firstWritePosition > rejectionPosition);
check('No table or column DDL is introduced', !/\b(?:create|alter|drop)\s+table\b/i.test(migration169));
check('No raw department import rows are stored', !migration169.includes('insert into public.department_import_rows'));
check('Canonical audit mappings remain', migration169.includes('table_name,\n      record_id') && !migration169.includes('entity_type,') && !migration169.includes('entity_id,'));
check('PUBLIC, anon, and authenticated remain revoked', /revoke all on function public\.apply_department_import_batch[\s\S]*from public, anon, authenticated;/i.test(migration169));
check('Execute remains granted only to service_role', /grant execute on function public\.apply_department_import_batch[\s\S]*to service_role;/i.test(migration169));
check(
  'Centralized frontend execution gate remains disabled by default',
  departmentsPage.includes('isDepartmentImportExecutionEnabled()')
    && !departmentsPage.includes('import.meta.env.VITE_DEPARTMENT_IMPORT_EXECUTION_ENABLED')
    && featureFlags.includes('value: unknown = import.meta.env.VITE_DEPARTMENT_IMPORT_EXECUTION_ENABLED')
    && featureFlags.includes('return value === "true"'),
);
check('Live mutation approval is absent', process.env.PATCH83O_APPROVE_LIVE_MUTATION !== 'YES');
check('Package exposes patch83o2:proof', packageJson.scripts?.['patch83o2:proof'] === 'node scripts/patch83o2-validation-array-proof.mjs');
check('Deployment evidence records migration 169 alignment', deploymentEvidence.includes('Database push executed: true') && deploymentEvidence.includes('Local/remote migration 169 aligned: true'));
check('Deployment evidence records service-role-only execution', deploymentEvidence.includes('RPC execute granted to service_role: true') && deploymentEvidence.includes('RPC execute granted to PUBLIC: false') && deploymentEvidence.includes('RPC execute granted to anon: false') && deploymentEvidence.includes('RPC execute granted to authenticated: false'));
check('Deployment evidence records unchanged non-RPC schema', deploymentEvidence.includes('Entire non-RPC public schema unchanged from predeployment dump: true') && deploymentEvidence.includes('Department table definition, constraints, indexes, triggers, and policies unchanged: true'));
check(
  'Patch 83O evidence records deployed migration and completed non-mutating retest',
  patch83oRuntimeEvidence.includes('Migration 169 Deployed: true') &&
    patch83oRuntimeEvidence.includes('Runtime Retesting After Migration 169: authenticated non-mutating matrix completed')
);

console.log('\n---------------------------------------------');
console.log(exitCode === 0 ? 'Proof Passed.' : 'Proof Failed.');
process.exit(exitCode);
