import fs from 'fs';
import path from 'path';

const root = process.cwd();
const releaseDir = path.join(root, 'release');
const auditPath = path.join(releaseDir, 'v59-no-mock-audit.json');
fs.mkdirSync(releaseDir, { recursive: true });

let audit = null;
if (fs.existsSync(auditPath)) audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
else {
  console.warn('No audit file found. Run npm run no-mock:audit first.');
  audit = { summary: {}, findings: [] };
}

const blocking = audit.findings.filter(f => f.production_blocking);
const byFile = new Map();
for (const f of blocking) {
  if (!byFile.has(f.file)) byFile.set(f.file, []);
  byFile.get(f.file).push(f);
}

const lines = [
  '# v5.9 Mock Data Removal Plan',
  '',
  'This plan is generated automatically. Review each item before changing production behavior.',
  '',
  '## Recommended replacement patterns',
  '',
  '1. Replace silent fallback arrays with empty state UI.',
  '2. Replace demo dashboard values with Supabase-backed views.',
  '3. If demo data is needed for training, protect it behind `VITE_ALLOW_DEMO_DATA=true` and show a visible demo banner.',
  '4. Never show fake OVR/risk/compliance records in production mode.',
  '',
  '## Blocking files',
  ''
];

if (!byFile.size) lines.push('No production-blocking files detected by the scanner.');
else {
  for (const [file, items] of byFile.entries()) {
    lines.push(`### ${file}`);
    lines.push('');
    lines.push(`Findings: ${items.length}`);
    lines.push('');
    lines.push('Suggested action:');
    lines.push('- Inspect fallback/demo/mock constants and remove them from production-visible paths.');
    lines.push('- Change data loaders to return explicit `{ data: [], error, source: "real" }` empty/error states.');
    lines.push('- If the file is truly test-only, add a clear development guard and document it.');
    lines.push('');
  }
}

fs.writeFileSync(path.join(releaseDir, 'v59-mock-removal-plan.md'), lines.join('\n'));
console.log('v5.9 mock removal plan generated: release/v59-mock-removal-plan.md');
