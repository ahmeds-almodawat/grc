import fs from 'node:fs';
import path from 'node:path';

const releaseDir = path.resolve('release', 'v661');
fs.mkdirSync(releaseDir, { recursive: true });

const migrationsDir = path.resolve('supabase', 'migrations');
const migrations = fs.existsSync(migrationsDir)
  ? fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()
  : [];

const latest = migrations.at(-1) || null;
const requiredTestFiles = [
  'supabase/tests/v64_persona_security_tests.sql',
  'supabase/tests/v65_workflow_smoke_tests.sql',
  'supabase/tests/v66_controlled_pilot_evidence_tests.sql'
];

const testStatus = requiredTestFiles.map((file) => ({ file, exists: fs.existsSync(path.resolve(file)) }));

const report = {
  generated_at: new Date().toISOString(),
  migration_count: migrations.length,
  latest_migration: latest,
  required_latest_migration: '045_v66_controlled_pilot_evidence.sql',
  has_required_latest_migration: migrations.includes('045_v66_controlled_pilot_evidence.sql'),
  migrations,
  staging_sql_tests: testStatus,
  recommended_order: [
    'Create or reset a staging Supabase project.',
    'Apply all migrations in supabase/migrations in filename order.',
    'Run seed functions only if the migration/runbook explicitly requires them for non-production staging setup.',
    'Run v64 persona SQL tests.',
    'Run v65 workflow smoke SQL tests.',
    'Run v66 controlled pilot evidence SQL tests.',
    'Attach screenshots/log exports under release/v66/evidence-attachments/.',
    'Run npm run v661:strict-proof.'
  ]
};

fs.writeFileSync(path.join(releaseDir, 'v661-staging-run-order.json'), JSON.stringify(report, null, 2));

const md = `# v6.6.1 Staging Run Order\n\nGenerated: ${report.generated_at}\n\n## Migration status\n\n- Migration count: **${report.migration_count}**\n- Latest migration: **${report.latest_migration || 'not found'}**\n- Required latest migration present: **${report.has_required_latest_migration ? 'yes' : 'no'}**\n\n## Required SQL proof files\n\n${testStatus.map((t) => `- ${t.exists ? '✅' : '❌'} \`${t.file}\``).join('\n')}\n\n## Staging execution order\n\n${report.recommended_order.map((step, index) => `${index + 1}. ${step}`).join('\n')}\n\n## Evidence capture rule\n\nDo not mark controlled pilot ready until the SQL output, restore dry-run evidence, and named signoff files are attached in \`release/v66/evidence-attachments/\`.\n`;
fs.writeFileSync(path.join(releaseDir, 'V661_STAGING_RUN_ORDER.md'), md);

console.log('v6.6.1 staging run order generated.');
console.log({ migration_count: report.migration_count, latest_migration: report.latest_migration, has_required_latest_migration: report.has_required_latest_migration });
