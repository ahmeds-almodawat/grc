import fs from 'fs';
import path from 'path';

const root = process.cwd();
const releaseDir = path.join(root, 'release');
fs.mkdirSync(releaseDir, { recursive: true });
const read = (name) => {
  try { return JSON.parse(fs.readFileSync(path.join(releaseDir, name), 'utf8')); } catch { return null; }
};

const local = read('v38-local-doctor-report.json');
const schema = read('v38-schema-doctor-report.json');
const simulator = read('v38-production-simulator-report.json');

const lines = [];
lines.push('# GRC Control Center v3.8 Final Local Readiness Report');
lines.push('');
lines.push(`Generated: ${new Date().toISOString()}`);
lines.push('');
lines.push('## Automated Summary');
lines.push('');
lines.push(`- Local doctor score: ${local?.score ?? 'not available'}%`);
lines.push(`- Migration files: ${schema?.migration_count ?? 'not available'}`);
lines.push(`- Latest migration: ${schema?.latest_migration ?? 'not available'}`);
lines.push(`- Production simulator automated score: ${simulator?.score ?? 'not available'}%`);
lines.push('');
lines.push('## Mandatory Manual Proof Before Production');
lines.push('');
lines.push('1. Fresh Supabase migration run from first to latest.');
lines.push('2. RLS persona tests for CEO, department manager, employee, Quality, Audit.');
lines.push('3. OVR workflow end-to-end test.');
lines.push('4. Export/backup and restore dry-run evidence.');
lines.push('5. Arabic/RTL visual QA.');
lines.push('6. Pilot acceptance with 1–2 departments before full rollout.');
lines.push('');
lines.push('## Generated JSON Reports');
lines.push('');
lines.push('- release/v38-local-doctor-report.json');
lines.push('- release/v38-schema-doctor-report.json');
lines.push('- release/v38-production-simulator-report.json');

fs.writeFileSync(path.join(releaseDir, 'V38_FINAL_LOCAL_READINESS_REPORT.md'), lines.join('\n'));
console.log('\nFinal report written: release/V38_FINAL_LOCAL_READINESS_REPORT.md');
