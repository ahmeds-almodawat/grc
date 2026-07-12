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
const releaseDir = path.join(root, 'release', 'patch83o1');
const migration167Path = path.join(root, 'supabase', 'migrations', '167_patch83m_secure_department_import_backend.sql');
const migration168Path = path.join(root, 'supabase', 'migrations', '168_patch83o_department_import_schema_compatibility.sql');
const expectedEvidence = [
  'patch83o1-schema-audit.md',
  'patch83o1-schema-audit.json',
  'patch83o1-canonical-field-mapping.md',
  'patch83o1-corrective-migration.md',
  'patch83o1-security-review.md',
  'patch83o1-deployment-result.md',
  'patch83o1-activation-decision.md'
];

console.log('\n--- Running Patch 83O.1 Schema Compatibility Proof ---\n');

for (const file of expectedEvidence) {
  check(`Evidence exists: ${file}`, fs.existsSync(path.join(releaseDir, file)));
}

check('Migration 168 exists', fs.existsSync(migration168Path));

const migration167 = fs.readFileSync(migration167Path, 'utf8');
const migration168 = fs.readFileSync(migration168Path, 'utf8');
const sha167 = crypto.createHash('sha256').update(fs.readFileSync(migration167Path)).digest('hex');
const edgeFunction = fs.readFileSync(path.join(root, 'supabase', 'functions', 'privileged-action', 'index.ts'), 'utf8');
const departmentsPage = fs.readFileSync(path.join(root, 'src', 'pages', 'Departments.tsx'), 'utf8');
const deploymentEvidence = fs.readFileSync(path.join(releaseDir, 'patch83o1-deployment-result.md'), 'utf8');

check('Migration 167 remains byte-for-byte unchanged', sha167 === '5f4648c6a133fb77d311501713b89167dcb4e845c69b2fc075db51369dfac81b');
check('Migration 168 keeps the existing RPC signature', migration168.includes('public.apply_department_import_batch(\n  p_actor_id uuid,\n  p_organization_id uuid,\n  p_source_filename text,\n  p_import_mode text,\n  p_rows jsonb'));
check('Migration 168 uses SECURITY DEFINER', /language plpgsql\s+security definer/i.test(migration168));
check('Migration 168 sets an exact safe search_path', migration168.includes('set search_path = pg_catalog, public, pg_temp'));
check('RPC requires service_role', migration168.includes("if auth.role() <> 'service_role'"));
check('RPC explicitly authorizes actor profile and roles', migration168.includes('from public.profiles p') && migration168.includes('join public.user_roles ur') && migration168.includes("'super_admin'::public.app_role") && migration168.includes("'governance_admin'::public.app_role") && migration168.includes("ur.scope = 'global'::public.access_scope"));
check('RPC enforces active actor and organization scope', migration168.includes('p.is_active = true') && migration168.includes("p.user_status = 'active'") && migration168.includes('p.organization_id = p_organization_id'));
check('RPC explicitly revokes PUBLIC, anon, and authenticated', /revoke all on function public\.apply_department_import_batch[\s\S]*from public, anon, authenticated;/i.test(migration168));
check('RPC grants execute only to service_role', /grant execute on function public\.apply_department_import_batch[\s\S]*to service_role;/i.test(migration168));

const departmentUpdate = migration168.match(/update public\.departments[\s\S]*?where id = v_existing_department_id;/i)?.[0] ?? '';
const departmentInsert = migration168.match(/insert into public\.departments \([\s\S]*?\) returning id into v_existing_department_id;/i)?.[0] ?? '';
check('Department update contains no nonexistent type or manager column', !/\btype\s*=|\bmanager_id\s*=/i.test(departmentUpdate));
check('Department insert contains no nonexistent type or manager column', !/\btype\b|\bmanager_id\b/i.test(departmentInsert));
check('Department type input is rejected explicitly', migration168.includes('department_type unsupported by canonical departments schema'));
check('Manager mapping uses the verified user_roles relation', migration168.includes("ur.role = 'department_manager'::public.app_role") && migration168.includes("'department'::public.access_scope"));
check('Manager mapping does not update profile affiliation', !/update public\.profiles/i.test(migration168));
check('Department update does not change code, organization, or division identity', !/\bcode\s*=|\borganization_id\s*=|\bdivision_id\s*=/i.test(departmentUpdate));
check('Normalized organization/code identity is explicit', migration168.includes('d.organization_id = p_organization_id') && migration168.includes('pg_catalog.lower(pg_catalog.btrim(d.code)) = v_code'));
check('Allowed import modes remain enum-controlled', migration168.includes('p_import_mode::public.department_import_mode'));

const validationPosition = migration168.indexOf('-- Phase A:');
const rejectionPosition = migration168.indexOf('if v_failed_count > 0 then');
const firstBatchWritePosition = migration168.indexOf('insert into public.department_import_batches');
check('All row validation precedes all persistent writes', validationPosition >= 0 && rejectionPosition > validationPosition && firstBatchWritePosition > rejectionPosition);
check('Invalid rows return structured rejection with zero writes', migration168.includes("'status', 'rejected'") && migration168.includes("'created_count', 0") && migration168.includes("'updated_count', 0"));
check('Batch storage contains summaries, not raw rows', migration168.includes('affected_department_ids = v_affected_ids') && !migration168.includes('insert into public.department_import_rows'));
check('Audit writes use canonical table_name and record_id', migration168.includes('table_name,\n      record_id') && !migration168.includes('entity_type,') && !migration168.includes('entity_id,'));
check('User import action remains registered', edgeFunction.includes("'patch19_apply_import_batch'"));
check('Department browser action remains indirect', edgeFunction.includes("'department_import_execute'") && !edgeFunction.includes("patch83mDepartmentImportActions = new Set([\n  'apply_department_import_batch'"));
check('Frontend execution gate remains present', departmentsPage.includes('import.meta.env.VITE_DEPARTMENT_IMPORT_EXECUTION_ENABLED === "true"'));
check('Live mutation approval is absent', process.env.PATCH83O_APPROVE_LIVE_MUTATION !== 'YES');

const audit = JSON.parse(fs.readFileSync(path.join(releaseDir, 'patch83o1-schema-audit.json'), 'utf8'));
check('Schema evidence is sanitized and data-free', audit.sanitized === true && audit.contains_business_rows === false && audit.contains_credentials === false);
check('Schema evidence records no direct type or manager column', audit.departments.type_column === null && audit.departments.manager_column === null);
check('Deployment evidence records migration 168 alignment', deploymentEvidence.includes('Database push executed: true') && deploymentEvidence.includes('Local/remote aligned through: 168'));
check('Deployment evidence records service-role-only RPC execution', deploymentEvidence.includes('RPC execute granted to service_role: true') && deploymentEvidence.includes('RPC execute denied to PUBLIC, anon, and authenticated: true'));
check('Deployment evidence records unchanged department schema', deploymentEvidence.includes('Department table definition unchanged: true'));
check('Deployment evidence records no Edge Function redeploy', deploymentEvidence.includes('Edge Function redeployed: false') && deploymentEvidence.includes('Edge Function version: 4'));
check('Deployment evidence records no live import mutation', deploymentEvidence.includes('Live import mutations executed: false'));

console.log('\n---------------------------------------------');
console.log(exitCode === 0 ? 'Proof Passed.' : 'Proof Failed.');
process.exit(exitCode);
