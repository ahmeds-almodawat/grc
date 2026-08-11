import fs from 'node:fs';
import path from 'node:path';
import {
  analyzeMigrationFiles,
  compareRlsReports,
  currentGitHead,
  loadMigrationFilesFromDirectory,
  loadMigrationFilesFromGitRef,
} from './lib/v64-rls-analyzer.mjs';

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

const root = path.resolve(argument('--root') || process.cwd());
const outDir = path.resolve(argument('--output-dir') || path.join(root, 'release', 'v64'));
const baseRef = argument('--base') || process.env.GRC_RLS_BASE_REF;
fs.mkdirSync(outDir, { recursive: true });

let report;
try {
  const base = loadMigrationFilesFromGitRef(root, baseRef);
  const baseReport = analyzeMigrationFiles(base.files);
  const headReport = analyzeMigrationFiles(loadMigrationFilesFromDirectory(root));
  report = compareRlsReports(baseReport, headReport, {
    base_ref_requested: baseRef,
    base_ref_resolved: base.resolvedRef,
    head_ref: currentGitHead(root),
    head_source: 'current_working_tree',
  });
} catch (error) {
  report = {
    generated_at: new Date().toISOString(),
    base_ref_requested: baseRef || null,
    status: 'failed_base_unavailable',
    summary: {
      new_critical: null,
      new_high: null,
      strict_regression_passed: false,
    },
    error: error instanceof Error ? error.message : String(error),
    inherited_unresolved: [],
    resolved: [],
    introduced: [],
    controlled_deny_all: [],
  };
}

fs.writeFileSync(
  path.join(outDir, 'v64-rls-regression-audit.json'),
  `${JSON.stringify(report, null, 2)}\n`,
  'utf8',
);
fs.writeFileSync(
  path.join(outDir, 'V64_RLS_REGRESSION_AUDIT.md'),
  `# v6.4 RLS PR Regression Audit

Status: **${report.status}**

\`\`\`json
${JSON.stringify(report.summary, null, 2)}
\`\`\`

## Inherited unresolved blockers

${report.inherited_unresolved.map((finding) => `- **INHERITED UNRESOLVED** ${finding.severity} ${finding.code}: \`${finding.table}\` (${finding.created_in})`).join('\n') || 'None.'}

## Resolved blockers

${report.resolved.map((finding) => `- **RESOLVED** ${finding.severity} ${finding.code}: \`${finding.table}\` (${finding.created_in})`).join('\n') || 'None.'}

## Newly introduced blockers

${report.introduced.map((finding) => `- **NEW BLOCKER** ${finding.severity} ${finding.code}: \`${finding.table}\` (${finding.created_in})`).join('\n') || 'None.'}

## Controlled deny-all observations at HEAD

${report.controlled_deny_all.map((item) => `- **CONTROLLED_DENY_ALL** \`${item.table}\` (${item.created_in})`).join('\n') || 'None.'}
`,
  'utf8',
);

console.log('v6.4 RLS regression audit complete.');
console.log(JSON.stringify({ status: report.status, ...report.summary }, null, 2));
if (report.status !== 'passed') process.exit(1);
