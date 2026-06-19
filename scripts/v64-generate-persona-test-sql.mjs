import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'release', 'v64');
fs.mkdirSync(outDir, { recursive: true });
const sourcePath = path.join(root, 'supabase', 'tests', 'v64_persona_security_tests.sql');
const destPath = path.join(outDir, 'v64_persona_security_tests.sql');
if (!fs.existsSync(sourcePath)) {
  console.error('Missing supabase/tests/v64_persona_security_tests.sql. Copy the v6.4 patch first.');
  process.exit(1);
}
fs.copyFileSync(sourcePath, destPath);
const runbook = `# v6.4 Persona SQL Test Runbook\n\n1. Apply all migrations to a fresh Supabase staging database.\n2. Open Supabase SQL editor.\n3. Run \`release/v64/v64_persona_security_tests.sql\` or \`supabase/tests/v64_persona_security_tests.sql\`.\n4. Any raised exception is a failed production-security proof.\n5. Attach the query result and errors to the release evidence folder.\n\nThis script is intentionally stricter than the UI checklist. It is not a replacement for browser persona tests; it proves the database layer first.\n`;
fs.writeFileSync(path.join(outDir, 'V64_PERSONA_SQL_TEST_RUNBOOK.md'), runbook);
console.log('v6.4 persona SQL tests generated.');
console.log({ source: sourcePath, output: destPath });
