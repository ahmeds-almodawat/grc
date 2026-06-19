#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const invalid = path.resolve('supabase/migrations/012a_ovr_workflow_enum_values.sql');
const valid = path.resolve('supabase/migrations/012_ovr_workflow_enum_values.sql');
const backupDir = path.resolve('release/v671/disabled-invalid-migrations');
const backup = path.join(backupDir, '012a_ovr_workflow_enum_values.sql.disabled');

fs.mkdirSync(backupDir, { recursive: true });

let moved = false;
if (fs.existsSync(invalid)) {
  if (fs.existsSync(backup)) fs.rmSync(backup, { force: true });
  fs.renameSync(invalid, backup);
  moved = true;
}

const ok = fs.existsSync(valid) && !fs.existsSync(invalid);
const report = {
  generated_at: new Date().toISOString(),
  moved_invalid_012a_out_of_migrations: moved,
  valid_012_migration_present: fs.existsSync(valid),
  invalid_012a_still_present: fs.existsSync(invalid),
  backup_location: fs.existsSync(backup) ? path.relative(process.cwd(), backup) : null,
  strict_passed: ok
};
fs.writeFileSync(path.resolve('release/v671/v671-disable-invalid-012a-report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log('v6.7.1 invalid 012a migration cleanup complete.');
console.log(report);
if (!ok) process.exit(1);
