import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'release', 'v65');
fs.mkdirSync(outDir, { recursive: true });

const required = [
  ['unit test asset', 'tests/unit/v65-live-result.test.ts'],
  ['browser auth smoke asset', 'tests/e2e/v65-auth-navigation.spec.ts'],
  ['browser workflow smoke asset', 'tests/e2e/v65-core-workflows.spec.ts'],
  ['SQL staging workflow asset', 'tests/sql/v65_workflow_smoke_tests.sql'],
  ['Supabase persona asset', 'supabase/tests/v64_persona_security_tests.sql'],
  ['v6.4 proof summary', 'release/v64/v64-database-security-proof-summary.json']
];

const checks = required.map(([label, rel]) => {
  const file = path.join(root, rel);
  return { label, path: rel, exists: fs.existsSync(file), size: fs.existsSync(file) ? fs.statSync(file).size : 0 };
});

const missing = checks.filter((c) => !c.exists);
const summary = {
  generated_at: new Date().toISOString(),
  checks_total: checks.length,
  missing_count: missing.length,
  strict_passed: missing.length === 0,
  note: 'This verifies test assets and proof artifacts exist. It does not replace running Vitest, Playwright, or Supabase SQL tests.'
};

fs.writeFileSync(path.join(outDir, 'v65-test-assets-audit.json'), JSON.stringify({ summary, checks }, null, 2));
fs.writeFileSync(path.join(outDir, 'V65_TEST_ASSETS_AUDIT.md'), `# v6.5 Test Assets Audit\n\n\`\`\`json\n${JSON.stringify(summary, null, 2)}\n\`\`\`\n\n## Checks\n\n${checks.map((c) => `- ${c.exists ? '✅' : '❌'} ${c.label}: \`${c.path}\`${c.exists ? ` (${c.size} bytes)` : ''}`).join('\n')}\n`);

console.log('v6.5 test assets audit complete.');
console.log(JSON.stringify(summary, null, 2));
if (!summary.strict_passed) process.exit(1);
