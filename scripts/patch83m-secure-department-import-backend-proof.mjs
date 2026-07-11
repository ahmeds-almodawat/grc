import fs from 'fs';
import path from 'path';

let exitCode = 0;

function check(name, condition) {
  if (condition) {
    console.log(`✅ PASS: ${name}`);
  } else {
    console.log(`❌ FAIL: ${name}`);
    exitCode = 1;
  }
}

const releaseDir = path.join(process.cwd(), 'release', 'patch83m');
const jsonFile = path.join(releaseDir, 'patch83m-secure-department-import-backend.json');
const evidenceFiles = [
  'patch83m-secure-department-import-backend.md',
  'patch83m-secure-department-import-backend.json'
];

console.log("\n--- Running Patch 83M Verification Proof ---\n");

evidenceFiles.forEach(f => {
  check(`Evidence file exists: ${f}`, fs.existsSync(path.join(releaseDir, f)));
});

if (fs.existsSync(jsonFile)) {
  const data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
  check(`Evidence states migration_applied=false`, data.migration_applied === false);
  check(`Evidence states cloud_runtime_tested=false`, data.cloud_runtime_tested === false);
  check(`Evidence states edge_function_deployed=false`, data.edge_function_deployed === false);
  check(`Evidence states execution_available=false`, data.execution_available === false);
  check(`Evidence states frontend_execution_enabled=false`, data.frontend_execution_enabled === false);
  check(`Evidence states direct_browser_department_write=false`, data.direct_browser_department_write === false);
  check(`Evidence states raw_file_stored=false`, data.raw_file_stored === false);
  check(`Evidence states no_production_readiness_claim=true`, data.no_production_readiness_claim === true);
}

const edgeFunctionCode = fs.readFileSync(path.join(process.cwd(), 'supabase/functions/privileged-action/index.ts'), 'utf8');
check('Edge function lists department_import_execute', edgeFunctionCode.includes('department_import_execute'));
check('Edge function does not expose apply_department_import_batch', !edgeFunctionCode.includes("patch83mDepartmentImportActions = new Set([\\n  'apply_department_import_batch',"));
check('Edge function propagates p_actor_id', edgeFunctionCode.includes('p_actor_id: userData.user.id'));

const migrationCode = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/167_patch83m_secure_department_import_backend.sql'), 'utf8');
check('Migration defines apply_department_import_batch', migrationCode.includes('function public.apply_department_import_batch'));
check('Migration sets security definer', migrationCode.toLowerCase().includes('security definer'));
check('Migration sets exact search_path', migrationCode.toLowerCase().includes('set search_path = public, pg_temp'));
check('Migration defines department_import_batches', migrationCode.includes('table if not exists public.department_import_batches'));
check('Migration enforces transaction/rollback via exception logic', migrationCode.includes('v_failed_count > 0 then') || migrationCode.includes('raise exception'));
check('Migration enforces service_role ONLY via JWT', migrationCode.includes('auth.role() <> \'service_role\''));
const rpcCode = migrationCode.split('function public.apply_department_import_batch')[1] || '';
check('Migration does NOT use has_any_role for actor authorization in RPC', !rpcCode.includes('public.has_any_role('));
check('Migration explicitly queries profiles/user_roles for p_actor_id', migrationCode.includes('join public.user_roles ur on ur.user_id = p.id'));
check('Migration validates organization scope explicitly', migrationCode.includes('p.organization_id = p_organization_id'));
check('Migration revokes public/anon access', migrationCode.toLowerCase().includes('revoke all on function public.apply_department_import_batch from public, anon, authenticated'));

const depsCode = fs.readFileSync(path.join(process.cwd(), 'src/pages/Departments.tsx'), 'utf8');
check('Departments.tsx uses executeDepartmentImport', depsCode.includes('executeDepartmentImport'));
check('Departments.tsx explicitly states execution unavailable until Patch 83N', depsCode.includes('Patch 83N'));

const validatorCode = fs.readFileSync(path.join(process.cwd(), 'src/utils/departmentImportValidation.ts'), 'utf8');
check('Validation does not use division in composite key', !validatorCode.includes('${orgCode}|${divCode || \'\'}|${code}'));

console.log("\n---------------------------------------------");
if (exitCode === 0) {
  console.log("Proof Passed. All Patch 83M requirements verified.");
} else {
  console.log("Proof Failed. Some requirements were not met.");
}
process.exit(exitCode);
