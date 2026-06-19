import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'release');
fs.mkdirSync(outDir, { recursive: true });

const required = [
  'supabase/_consolidated/ALL_MIGRATIONS_ORDERED.sql',
  'supabase/_consolidated/migration-manifest.json',
  'docs/FINAL_SECURITY_RLS_SCRIPT.md',
  'docs/FINAL_SUPABASE_EVIDENCE_CHECKLIST.md',
  'docs/OPERATOR_DAY_1_RUNBOOK.md',
  'docs/FINAL_PATCH_APPLICATION_ORDER.md',
];

const inventory = required.map(file => ({ file, exists: fs.existsSync(path.join(root, file)) }));
const missing = inventory.filter(item => !item.exists);

const markdown = `# GRC Production Proof Bundle\n\nGenerated: ${new Date().toISOString()}\n\n## Required artifacts\n\n${inventory.map(item => `- ${item.exists ? '✅' : '❌'} ${item.file}`).join('\n')}\n\n## Go-live rule\n\nDo not launch to all staff until fresh Supabase install, RLS persona testing, OVR workflow, backup/restore dry-run and pilot acceptance are evidenced.\n`;

fs.writeFileSync(path.join(outDir, 'PRODUCTION_PROOF_BUNDLE.md'), markdown);
fs.writeFileSync(path.join(outDir, 'production-proof-inventory.json'), JSON.stringify({ generatedAt: new Date().toISOString(), missingCount: missing.length, inventory }, null, 2));

if (missing.length) {
  console.warn(`Production proof bundle generated with ${missing.length} missing artifacts.`);
} else {
  console.log('Production proof bundle generated with all required artifacts present.');
}
