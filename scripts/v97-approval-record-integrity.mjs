import fs from 'node:fs';
import path from 'node:path';

const outDir = path.join('release', 'v97');
fs.mkdirSync(outDir, { recursive: true });
const generatedAt = new Date().toISOString();
const status = 'technical_ready_pending_human_approval';
const productionReady = false;

const files = [
  'release/v674/approvals/pilot-signoff.json',
  'release/v674/approvals/ovr-confidentiality-confirmation.json'
];

function readJson(file) {
  if (!fs.existsSync(file)) return { file, exists: false, validJson: false, keys: [] };
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { file, exists: true, validJson: true, keys: Object.keys(parsed) };
  } catch (error) {
    return { file, exists: true, validJson: false, keys: [], error: error.message };
  }
}

const results = files.map(readJson);
const invalid = results.filter((r) => !r.exists || !r.validJson).length;
const rows = results.map((r) => [
  r.file,
  r.exists ? 'exists' : 'missing',
  r.validJson ? 'valid JSON' : 'not valid JSON',
  r.keys.length ? r.keys.join(', ') : 'no keys detected'
]);
const tableRows = rows.map((row) => '| ' + row.join(' | ') + ' |').join('\n');

const md = [
  '# v9.7 Approval Record Integrity Audit',
  '',
  'Generated: ' + generatedAt,
  '',
  '## Status',
  '',
  '| Item | Value |',
  '| --- | --- |',
  '| Status | ' + status + ' |',
  '| Production ready | ' + (productionReady ? 'Yes' : 'No') + ' |',
  '| Invalid or missing approval JSON files | ' + invalid + ' |',
  '| Approval values filled by this script | No |',
  '',
  '## Approval files',
  '',
  '| File | Exists | JSON status | Top-level keys |',
  '| --- | --- | --- | --- |',
  tableRows,
  '',
  '## Interpretation',
  '',
  'This audit only checks file presence and parseability. It does not certify approval validity. The authoritative strict check remains `npm run v674:signoff-check` followed by `npm run v66:strict-proof`.',
  '',
  '## Safety boundary',
  '',
  'No approval data is created, modified, inferred, or approved by this script.',
  ''
].join('\n');

fs.writeFileSync(path.join(outDir, 'approval-record-integrity-audit.md'), md);
console.log('v9.7 approval record integrity audit generated.');
console.log(JSON.stringify({ status, production_ready: productionReady, invalid_or_missing_json_files: invalid, report: 'release/v97/approval-record-integrity-audit.md' }, null, 2));
