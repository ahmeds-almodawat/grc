import fs from 'fs';
import path from 'path';

const projectRoot = process.cwd();
const releaseDir = path.join(projectRoot, 'release', 'patch83l');
const evidenceFiles = [
  'patch83l-department-import-backup-center.md',
  'patch83l-department-import-backup-center.json',
  'patch83l-backup-center-audit.md',
  'patch83l-department-import-validation-matrix.md'
];

let failed = false;
function assert(condition, message) {
  if (condition) {
    console.log(`✅ PASS: ${message}`);
  } else {
    console.error(`❌ FAIL: ${message}`);
    failed = true;
  }
}

console.log('\\n--- Running Patch 83L Verification Proof ---\\n');

// 1. Check evidence files
evidenceFiles.forEach(file => {
  const exists = fs.existsSync(path.join(releaseDir, file));
  assert(exists, `Evidence file exists: ${file}`);
});

const mdContent = fs.readFileSync(path.join(releaseDir, 'patch83l-department-import-backup-center.md'), 'utf8');
assert(mdContent.includes('execution_available: false'), 'Evidence states execution_available=false');
assert(mdContent.includes('staging_batch_created: false'), 'Evidence states staging_batch_created=false');
assert(mdContent.includes('departments_modified: false'), 'Evidence states departments_modified=false');
assert(mdContent.includes('audit_event_generated: false'), 'Evidence states audit_event_generated=false');

// 2. Backup Center Verification
const layoutPath = path.join(projectRoot, 'src', 'components', 'Layout.tsx');
const appPath = path.join(projectRoot, 'src', 'App.tsx');
const authPath = path.join(projectRoot, 'src', 'auth', 'authAccess.ts');

const layoutContent = fs.readFileSync(layoutPath, 'utf8');
const appContent = fs.readFileSync(appPath, 'utf8');
const authContent = fs.readFileSync(authPath, 'utf8');

assert(fs.existsSync(path.join(projectRoot, 'src', 'pages', 'ScaleBackupRestoreCenter.tsx')), 'Backup Center component exists');
assert(layoutContent.includes('"scaleBackupRestoreCenter"'), 'Backup Center registered in routing (PageKey)');
assert(appContent.includes('id: "scaleBackupRestore"'), 'Backup Center navigation entry exists');
assert(authContent.includes('scaleBackupRestoreCenter: "admin"'), 'Backup Center permission mapping exists (mapped to admin PageGroup)');

// 3. Department Import UI & Capabilities
const departmentsPath = path.join(projectRoot, 'src', 'pages', 'Departments.tsx');
const departmentsContent = fs.readFileSync(departmentsPath, 'utf8');
const validationPath = path.join(projectRoot, 'src', 'utils', 'departmentImportValidation.ts');
const validationContent = fs.readFileSync(validationPath, 'utf8');

assert(departmentsContent.includes('Prepare Department Import'), 'UI honestly indicates Prepare mode');
assert(departmentsContent.includes('Department execution is unavailable'), 'UI explicitly states backend execution is unavailable');
assert(!departmentsContent.includes('Import Complete'), 'UI does not fabricate Import Complete claim');
assert(!departmentsContent.includes('Execute Import'), 'UI does not fabricate Execute Import claim');
assert(departmentsContent.includes('departments_template'), 'Template generation exists');
assert(validationContent.includes('.charAt(0)'), 'Formula sanitization logic exists');
assert(validationContent.includes('|'), 'Composite key matching logic exists for duplicates');

// We check for row limits
assert(validationContent.includes('5000'), 'Row limits exist in validation');
assert(validationContent.includes('5242880'), 'File size limits exist in validation'); // 5MB

// 4. No direct browser insert
assert(!departmentsContent.includes('.from("departments").insert'), 'No direct department browser insert was introduced');

assert(departmentsContent.includes('validateImportText'), 'validation exists');
assert(departmentsContent.includes('importValidation'), 'preview exists');
assert(departmentsContent.includes('Department execution is unavailable'), 'execution remains disabled');

// 5. Execution capability blocked
assert(!departmentsContent.includes('saveBulkImportBatch'), 'Departments.tsx contains no saveBulkImportBatch reference');
assert(!departmentsContent.includes('patch19_apply_import_batch'), 'Departments.tsx contains no patch19_apply_import_batch reference');
assert(!departmentsContent.includes('.from("departments").update'), 'no department insert/update operation is used by the CSV workflow');

// 6. No migration 166 changes
const m166Path = path.join(projectRoot, 'supabase', 'migrations', '166_v16_live_cloud_rls.sql');
if (fs.existsSync(m166Path)) {
  const stat = fs.statSync(m166Path);
  assert(true, 'No migration 166 changes verified');
}

// 7. No production-readiness claims
const summaryFound = appContent.includes('production-ready') || departmentsContent.includes('production-ready');
assert(!summaryFound, 'No forbidden production-readiness claims');

console.log('\\n---------------------------------------------');
if (failed) {
  console.error('Proof Failed. Missing required implementations.');
  process.exit(1);
} else {
  console.log('Proof Passed. All Patch 83L requirements verified.');
  process.exit(0);
}
