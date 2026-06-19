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
const gates = [
  { gate: 'Local build artifacts', status: local?.counts?.js_assets > 0 ? 'pass' : 'warning', note: 'Run npm run build before final review.' },
  { gate: 'Migration inventory', status: (schema?.migration_count || 0) >= 30 ? 'pass' : 'warning', note: 'Verify all migrations were copied.' },
  { gate: 'Core files', status: (local?.checks || []).filter((c) => c.ok).length >= 7 ? 'pass' : 'warning', note: 'Local doctor found missing structure.' },
  { gate: 'Supabase proof', status: 'manual', note: 'Must be proven in fresh Supabase project.' },
  { gate: 'RLS persona proof', status: 'manual', note: 'Must test CEO, manager, employee, quality, auditor personas.' },
  { gate: 'OVR workflow proof', status: 'manual', note: 'Submit, HOD review, Quality review, evidence, closure.' },
  { gate: 'Backup restore proof', status: 'manual', note: 'Export and restore dry-run must be documented.' }
];

const passCount = gates.filter((g) => g.status === 'pass').length;
const score = Math.round((passCount / gates.length) * 100);
const report = { generated_at: new Date().toISOString(), score, gates };
fs.writeFileSync(path.join(releaseDir, 'v38-production-simulator-report.json'), JSON.stringify(report, null, 2));
console.log('\nGRC v3.8 Production Simulator');
console.log('-----------------------------');
console.log(`Automated score: ${score}%`);
for (const g of gates) console.log(`${g.status.toUpperCase()} - ${g.gate}: ${g.note}`);
console.log('Report written: release/v38-production-simulator-report.json');
