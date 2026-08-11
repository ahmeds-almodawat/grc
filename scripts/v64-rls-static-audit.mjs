import fs from 'node:fs';
import path from 'node:path';
import {
  analyzeMigrationFiles,
  loadMigrationFilesFromDirectory,
} from './lib/v64-rls-analyzer.mjs';

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

const strict = process.argv.includes('--strict');
const root = path.resolve(argument('--root') || process.cwd());
const outDir = path.resolve(argument('--output-dir') || path.join(root, 'release', 'v64'));
fs.mkdirSync(outDir, { recursive: true });

const report = analyzeMigrationFiles(loadMigrationFilesFromDirectory(root));
report.summary.generated_at = new Date().toISOString();

fs.writeFileSync(
  path.join(outDir, 'v64-rls-static-audit.json'),
  `${JSON.stringify(report, null, 2)}\n`,
  'utf8',
);
fs.writeFileSync(
  path.join(outDir, 'V64_RLS_STATIC_AUDIT.md'),
  `# v6.4 RLS Static Audit

\`\`\`json
${JSON.stringify(report.summary, null, 2)}
\`\`\`

## Unresolved findings

${report.findings.slice(0, 250).map((finding) =>
    `- **${finding.severity}** ${finding.code} on \`${finding.table}\` (${finding.created_in}) — ${finding.message}`,
  ).join('\n') || 'No unresolved findings.'}

## Controlled deny-all observations

${report.observations.map((observation) =>
    `- **${observation.code}** \`${observation.table}\` (${observation.created_in}) — RLS enabled and forced; no policy; an ordered complete PUBLIC, anon, authenticated, and service_role ACL lockdown follows the final RLS enable/force state; final browser ACLs remain revoked.`,
  ).join('\n') || 'None.'}
`,
  'utf8',
);

console.log('v6.4 RLS static audit complete.');
console.log(JSON.stringify(report.summary, null, 2));
if (strict && !report.summary.strict_passed) {
  console.error('v6.4 strict RLS audit failed. Unresolved critical/high findings remain.');
  process.exit(1);
}
