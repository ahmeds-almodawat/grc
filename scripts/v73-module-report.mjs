import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'release', 'v73');
const resultsPath = path.join(outDir, 'module-acceptance-results.json');

if (!fs.existsSync(resultsPath)) {
  console.error('Missing release/v73/module-acceptance-results.json. Run npm run v73:module-acceptance first.');
  process.exit(1);
}

const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
const rows = Array.isArray(results.module_results) ? results.module_results : [];
const p1 = rows.filter((x) => x.priority === 'priority_1');
const p2 = rows.filter((x) => x.priority === 'priority_2');
const deferred = rows.filter((x) => x.priority === 'deferred');
const notApplicable = rows.filter((x) => x.acceptance_status === 'not_applicable_for_pilot');
const blockers = rows.filter((x) => x.blocking);
const warnings = rows.filter((x) => x.acceptance_status === 'warning');

const lines = [];
lines.push('# v7.3 Module Report');
lines.push('');
lines.push(`Generated from: release/v73/module-acceptance-results.json`);
lines.push('');
lines.push('## Summary');
lines.push('');
lines.push(`- Status: **${results.acceptance_status}**`);
lines.push(`- Strict passed: **${results.strict_passed}**`);
lines.push(`- Total modules: **${rows.length}**`);
lines.push(`- Priority 1 modules: **${p1.length}**`);
lines.push(`- Priority 2 modules: **${p2.length}**`);
lines.push(`- Deferred modules: **${deferred.length}**`);
lines.push(`- Not applicable for pilot: **${notApplicable.length}**`);
lines.push(`- Blocking failures: **${blockers.length}**`);
lines.push(`- Warnings: **${warnings.length}**`);
lines.push('');
lines.push('## Priority 1 modules');
lines.push('');
for (const row of p1) lines.push(`- **${row.id}** — ${row.acceptance_status}: ${row.issue}`);
lines.push('');
lines.push('## Blocking failures');
lines.push('');
if (!blockers.length) lines.push('_None._');
for (const row of blockers) lines.push(`- **${row.id}** — ${row.issue}`);
lines.push('');
lines.push('## Warning modules');
lines.push('');
if (!warnings.length) lines.push('_None._');
for (const row of warnings) lines.push(`- **${row.id}** — ${row.issue}`);
lines.push('');
lines.push('## Final note');
lines.push('');
lines.push('This report is module acceptance evidence. It does not replace the final controlled pilot signoff gate.');

fs.writeFileSync(path.join(outDir, 'module-acceptance-summary.md'), `${lines.join('\n')}\n`);
console.log('v7.3 module report generated.');
console.log(JSON.stringify({ status: results.acceptance_status, strict_passed: results.strict_passed, priority_1_modules: p1.length, blocking_failures: blockers.length, warnings: warnings.length }, null, 2));
if (blockers.length) process.exitCode = 1;
