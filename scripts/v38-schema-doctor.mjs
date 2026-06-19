import fs from 'fs';
import path from 'path';

const root = process.cwd();
const migrationsDir = path.join(root, 'supabase', 'migrations');
const releaseDir = path.join(root, 'release');
fs.mkdirSync(releaseDir, { recursive: true });

const files = fs.existsSync(migrationsDir)
  ? fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()
  : [];

const requiredSignals = [
  'profiles', 'projects', 'milestones', 'tasks', 'evidence_files', 'approvals',
  'risks', 'compliance_items', 'audit_findings', 'ovr_reports', 'export',
  'release', 'pilot', 'consolidation'
];

const combined = files.map((f) => fs.readFileSync(path.join(migrationsDir, f), 'utf8')).join('\n').toLowerCase();
const signals = requiredSignals.map((signal) => ({ signal, found: combined.includes(signal.toLowerCase()) }));
const duplicateNames = files.filter((f, i) => files.indexOf(f) !== i);
const report = {
  generated_at: new Date().toISOString(),
  migration_count: files.length,
  first_migration: files[0] || null,
  latest_migration: files[files.length - 1] || null,
  duplicate_file_names: duplicateNames,
  expected_signals: signals,
  missing_signals: signals.filter((s) => !s.found).map((s) => s.signal),
  files
};

fs.writeFileSync(path.join(releaseDir, 'v38-schema-doctor-report.json'), JSON.stringify(report, null, 2));
console.log('\nGRC v3.8 Schema Doctor');
console.log('----------------------');
console.log(`Migrations: ${files.length}`);
console.log(`Latest: ${report.latest_migration || 'none'}`);
if (report.missing_signals.length) console.log(`Missing signals: ${report.missing_signals.join(', ')}`);
else console.log('Expected schema signals found.');
console.log('Report written: release/v38-schema-doctor-report.json');
process.exit(files.length === 0 ? 1 : 0);
