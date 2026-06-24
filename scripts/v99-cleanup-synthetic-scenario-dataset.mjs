import fs from 'node:fs';
import path from 'node:path';
import {
  cleanupScenarios,
  defaultEmail,
  detectDatabaseContainer,
  ensureLocalOnly,
  ensureReleaseDir,
  findActor,
  parseEmailArg,
  releaseDir,
  root,
  scenarioStatus,
  tag,
} from './v99-local-scenario-utils.mjs';

const generatedAt = new Date().toISOString();
const reportPath = path.join(releaseDir, 'synthetic-scenario-dataset-report.md');
const email = parseEmailArg(process.argv.slice(2)) || defaultEmail;
let result = null;
let remaining = null;
let error = null;

try {
  ensureLocalOnly();
  ensureReleaseDir();
  const { container } = detectDatabaseContainer();
  const actor = findActor(container, email);
  result = cleanupScenarios(container, actor.id);
  remaining = scenarioStatus(container, actor.id);
  if (Number(remaining.total_records) !== 0) {
    throw new Error(`V99_CLEANUP_INCOMPLETE: ${remaining.total_records} registry rows remain.`);
  }
} catch (caught) {
  error = caught;
}

const passed = !error && result?.test_dataset_tag === tag && Number(remaining?.total_records) === 0;
ensureReleaseDir();
fs.writeFileSync(reportPath, `# v9.9 Synthetic Scenario Dataset Cleanup Report

- Generated: ${generatedAt}
- Status: **${passed ? 'PASSED' : 'FAILED'}**
- Exact marker: \`${tag}\`
- Remaining registered records: **${remaining?.total_records ?? 'unknown'}**
- Production readiness: **Not asserted**

## Exact-ID cleanup result

\`\`\`json
${JSON.stringify(result, null, 2)}
\`\`\`

Cleanup selected only UUIDs recorded in \`public.v99_scenario_lab_records\` with the exact marker.
No fuzzy title match, broad date range, or normal-record deletion was used.
${error ? `
## Error

\`\`\`text
${error.message}
\`\`\`
` : ''}
`, 'utf8');

console.log(`v9.9 synthetic scenario cleanup: ${passed ? 'PASSED' : 'FAILED'}`);
console.log(`Report: ${path.relative(root, reportPath)}`);
if (!passed) {
  if (error) console.error(error.message);
  process.exitCode = 1;
}
