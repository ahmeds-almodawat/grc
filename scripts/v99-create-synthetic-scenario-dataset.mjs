import fs from 'node:fs';
import path from 'node:path';
import {
  createScenario,
  defaultEmail,
  detectDatabaseContainer,
  ensureLocalOnly,
  ensureReleaseDir,
  escapeMarkdown,
  findActor,
  parseEmailArg,
  releaseDir,
  root,
  scenarioStatus,
  tag,
} from './v99-local-scenario-utils.mjs';

const validScenarios = new Set([
  'ovr_same_department',
  'ovr_cross_department',
  'ovr_high_severity',
  'ovr_returned_clarification',
  'ovr_disputed_reopened',
  'risk',
  'control',
  'evidence',
  'project',
  'full',
]);

function scenarioArg(argv) {
  const index = argv.indexOf('--scenario');
  if (index === -1) return 'full';
  const value = argv[index + 1];
  if (!value || !validScenarios.has(value)) {
    throw new Error(`Invalid --scenario. Use one of: ${[...validScenarios].join(', ')}`);
  }
  return value;
}

const generatedAt = new Date().toISOString();
const reportPath = path.join(releaseDir, 'synthetic-scenario-dataset-report.md');
const argv = process.argv.slice(2);
const email = parseEmailArg(argv) || defaultEmail;
const scenario = scenarioArg(argv);
const forceNew = argv.includes('--force-new');

let context = { project: 'unknown', container: 'not detected' };
let result = null;
let status = null;
let reused = false;
let error = null;

try {
  ensureLocalOnly();
  ensureReleaseDir();
  context = detectDatabaseContainer();
  const actor = findActor(context.container, email);
  const before = scenarioStatus(context.container, actor.id);

  if (scenario === 'full' && Number(before.total_records) > 0 && !forceNew) {
    reused = true;
    result = {
      scenario: 'full',
      record_count: 0,
      note: 'Existing exact-tag dataset reused. Pass --force-new to add another set.',
      test_dataset_tag: tag,
    };
  } else {
    result = createScenario(context.container, actor.id, scenario);
  }
  status = scenarioStatus(context.container, actor.id);
} catch (caught) {
  error = caught;
}

const passed = !error && result?.test_dataset_tag === tag;
const tableRows = Object.entries(status?.by_table || {})
  .map(([table, count]) => `| ${escapeMarkdown(table)} | ${count} |`)
  .join('\n');

ensureReleaseDir();
fs.writeFileSync(reportPath, `# v9.9 Synthetic Scenario Dataset Report

- Generated: ${generatedAt}
- Status: **${passed ? 'PASSED' : 'FAILED'}**
- Requested scenario: \`${scenario}\`
- Existing dataset reused: **${reused ? 'yes' : 'no'}**
- Exact marker: \`${tag}\`
- Project: ${escapeMarkdown(context.project)}
- Container: ${escapeMarkdown(context.container)}
- Production readiness: **Not asserted**

## Result

\`\`\`json
${JSON.stringify(result, null, 2)}
\`\`\`

## Current registered dataset

- Total registered records: **${status?.total_records ?? 0}**

| Table | Registered records |
|---|---:|
${tableRows || '| none | 0 |'}

All records are synthetic, non-confidential, and intended only for local/controlled-pilot testing.
Cleanup uses the private exact-ID registry; normal records are not selected by title or fuzzy text matching.
${error ? `
## Error and next steps

\`\`\`text
${error.message}
\`\`\`

Run \`npx supabase start\`, apply migration 050, run \`npm run pilot:first-run-bootstrap\`, and retry.
` : ''}
`, 'utf8');

console.log(`v9.9 synthetic scenario dataset: ${passed ? 'PASSED' : 'FAILED'}`);
console.log(`Registered records: ${status?.total_records ?? 0}`);
console.log(`Report: ${path.relative(root, reportPath)}`);
if (!passed) {
  if (error) console.error(error.message);
  process.exitCode = 1;
}
