import fs from 'fs';
import path from 'path';

const releaseDir = path.join(process.cwd(), 'release', 'patch83l');
if (!fs.existsSync(releaseDir)) {
  fs.mkdirSync(releaseDir, { recursive: true });
}

fs.writeFileSync(path.join(releaseDir, 'patch83l-department-import-backup-center.md'),
`# Patch 83L: Department Import & Backup Center Proof
- Backup Center location: \`src/pages/ScaleBackupRestoreCenter.tsx\`
- Navigation path: Admin Hub -> System Control Pages -> Backup & Restore Center
- Route key: \`scaleBackupRestoreCenter\`
- Exact permission required: \`admin\` PageGroup
- Authorized roles: \`super_admin\`, \`governance_admin\`
- Department Import location: \`src/pages/Departments.tsx\`
- Supported file types: \`csv\`
- No XLSX support: true
- Import modes: Staging / Prepare Import Batch Only
- Maximum rows: 5000
- Maximum file size: 5MB
- Composite matching key: \`organization_code + division_code + department_code\`
- Backend execution: \`saveBulkImportBatch\` (Staging only. Execution is blocked.)
- Transaction behavior: Loop-based (partial) if executed.
- execution_available: false
- backend_processor_available: false
- staging_batch_created: false
- departments_modified: false
- audit_event_generated: false
- Migrations applied: false
- db_push_executed: false
- migration_repair_executed: false
- Production-readiness claim: None.
`);

fs.writeFileSync(path.join(releaseDir, 'patch83l-department-import-backup-center.json'),
JSON.stringify({
  "patch": "83L",
  "backupCenter": "ScaleBackupRestoreCenter",
  "importMode": "staging_only",
  "executionBlocked": true,
  "staging_batch_created": false,
  "execution_available": false,
  "backend_processor_available": false,
  "departments_modified": false,
  "audit_event_generated": false
}, null, 2));

fs.writeFileSync(path.join(releaseDir, 'patch83l-backup-center-audit.md'),
`# Patch 83L: Backup Center Audit
- The component \`ScaleBackupRestoreCenter\` is registered to the \`admin\` group.
- Exact valid roles that receive it: \`super_admin\`, \`governance_admin\`.
- Frontend navigation guard: dynamically filters tabs based on access.
- Route/page guard: Attempting manual navigation redirects to \`UnauthorizedPage\` for missing roles via \`canAccessPage\`.
- Backend authorization: Each backup action uses privileged server bridge.
`);

fs.writeFileSync(path.join(releaseDir, 'patch83l-department-import-validation-matrix.md'),
`# Patch 83L: Department Import Validation Matrix
- [x] Download template (CSV only)
- [x] Accepted columns explicitly checked
- [x] Create-only staging default
- [x] Dry-run preview table
- [x] Duplicate detection (file) via composite key
- [x] Duplicate detection (database) via composite key
- [x] Invalid organization validation
- [x] Invalid division validation
- [x] Mismatch validation
- [x] Unknown manager validation
- [x] Inactive manager validation
- [x] Manager outside organization validation
- [x] Invalid status validation
- [x] File size / row limits
- [x] Blank row handling
- [x] Duplicate-header rejection
- [x] Formula-injection sanitization
`);

console.log('Evidence files generated.');
