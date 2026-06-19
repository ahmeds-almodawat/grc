#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const strict = process.argv.includes('--strict');
const migrationsDir = path.resolve('supabase/migrations');
const files = fs.existsSync(migrationsDir)
  ? fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()
  : [];

const invalidNameFiles = files.filter((f) => !/^\d+_[A-Za-z0-9_]+\.sql$/.test(f));
const has004 = files.includes('004_seed_reference_data.sql');
const has012 = files.includes('012_ovr_workflow_enum_values.sql');
const has012a = files.includes('012a_ovr_workflow_enum_values.sql');
const seed = has004 ? fs.readFileSync(path.join(migrationsDir, '004_seed_reference_data.sql'), 'utf8') : '';
const requiredCasts = [
  "'financial'::public.risk_category",
  "'critical'::public.risk_level",
  "'open'::public.risk_status",
  "'risk'::public.source_type",
  "'active'::public.project_status",
  "'in_progress'::public.compliance_status",
  "'due_soon'::public.compliance_status"
];
const missingSeedCasts = requiredCasts.filter((s) => !seed.includes(s));

const report = {
  generated_at: new Date().toISOString(),
  migration_count: files.length,
  invalid_name_files: invalidNameFiles,
  has_fixed_012_migration: has012,
  has_invalid_012a_migration: has012a,
  seed_004_enum_casts_missing: missingSeedCasts,
  local_supabase_ready_for_reset:
    invalidNameFiles.length === 0 && has004 && has012 && !has012a && missingSeedCasts.length === 0
};

fs.mkdirSync(path.resolve('release/v671'), { recursive: true });
fs.writeFileSync(path.resolve('release/v671/v671-local-supabase-migration-audit.json'), `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(path.resolve('release/v671/V671_LOCAL_SUPABASE_RESET_NEXT_STEPS.md'), `# v6.7.1 Local Supabase reset next steps\n\nStatus: ${report.local_supabase_ready_for_reset ? 'READY' : 'NOT READY'}\n\n## Commands\n\n\`\`\`powershell\nsupabase stop --no-backup\nsupabase start\n\`\`\`\n\nAfter start succeeds, continue with the staging SQL/evidence workflow.\n\n## Report\n\n\`\`\`json\n${JSON.stringify(report, null, 2)}\n\`\`\`\n`);
console.log('v6.7.1 local Supabase migration audit complete.');
console.log(report);
if (strict && !report.local_supabase_ready_for_reset) process.exit(1);
