import { evaluateApprovals, mdTable, writeText, writeJson, status, productionReady } from './v94-common.mjs';

const result = evaluateApprovals();
const rows = result.rows.map((row) => [row.file, row.field, row.description, row.status]);
const md = [
  '# v9.4 Approval JSON Shape Audit',
  '',
  '## Summary',
  '',
  mdTable(['Metric', 'Value'], [
    ['Required fields', result.required],
    ['Passed fields', result.passed],
    ['Missing or invalid fields', result.failed],
    ['Approval lint status', result.status],
    ['Production ready', productionReady ? 'Yes' : 'No']
  ]),
  '',
  '## Required field map',
  '',
  mdTable(['File', 'Field', 'Required evidence', 'Status'], rows),
  '',
  '## Safety boundary',
  '',
  'This audit only reads approval files. It does not fill, infer, or fake approval values.'
].join('\n');

writeText('approval-json-shape-audit.md', md);
writeJson('approval-json-shape-audit.json', { status, production_ready: productionReady, ...result });
console.log('v9.4 approval JSON shape audit generated.');
console.log(JSON.stringify({ status, production_ready: productionReady, required_fields: result.required, missing_or_invalid: result.failed, report: 'release/v94/approval-json-shape-audit.md' }, null, 2));
