import { mkdirSync, readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

mkdirSync('release', { recursive: true });
const docs = readdirSync('docs').filter(file => file.endsWith('.md')).sort();
const migrations = readdirSync('supabase/migrations').filter(file => file.endsWith('.sql')).sort((a,b)=>a.localeCompare(b, undefined, { numeric: true }));
const auditFiles = [];
try {
  for (const file of readdirSync('release/audits')) auditFiles.push(`release/audits/${file}`);
} catch {}

let md = '# GRC Control Center - Production Operator Handover Bundle\n\n';
md += `Generated at: ${new Date().toISOString()}\n\n`;
md += '## Final command\n\nDo not expand features until the migration, RLS, backup/restore, OVR and Arabic/RTL checks are evidenced.\n\n';
md += '## Migration files\n\n';
for (const file of migrations) md += `- ${file}\n`;
md += '\n## Documentation files\n\n';
for (const file of docs) md += `- docs/${file}\n`;
md += '\n## Audit outputs\n\n';
for (const file of auditFiles) {
  const size = statSync(file).size;
  md += `- ${file} (${size} bytes)\n`;
}
md += '\n## Day-1 checklist\n\n';
md += '- Confirm Supabase environment variables are production/staging correct.\n';
md += '- Run fresh migration verification in staging.\n';
md += '- Run RLS persona tests with real test accounts.\n';
md += '- Run OVR end-to-end test.\n';
md += '- Create export package and confirm restore dry-run.\n';
md += '- Complete Arabic/RTL visual QA for critical pages.\n';
md += '- Start pilot users only.\n';

writeFileSync('release/PRODUCTION_OPERATOR_HANDOVER_BUNDLE.md', md);
writeFileSync('release/release-inventory.json', JSON.stringify({ generatedAt: new Date().toISOString(), docs, migrations, auditFiles }, null, 2));
console.log('Created release/PRODUCTION_OPERATOR_HANDOVER_BUNDLE.md and release/release-inventory.json');
