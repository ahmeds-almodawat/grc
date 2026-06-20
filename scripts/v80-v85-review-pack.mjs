import fs from 'fs';
import path from 'path';
import { ROOT, currentGateStatus, writeJson, writeText, mdTable, safetyBlock } from './v80-v85-common.mjs';

const packs = [
  ['v80', 'Pilot launch governance', 'release/v80/v80-pilot-launch-governance.md'],
  ['v81', 'Live staging evidence', 'release/v81/v81-live-staging-evidence.md'],
  ['v82', 'Pilot operations KPI', 'release/v82/v82-pilot-operations-kpi.md'],
  ['v83', 'Security/privacy assurance', 'release/v83/v83-security-privacy-assurance.md'],
  ['v84', 'Training/change management', 'release/v84/v84-training-change-management.md'],
  ['v85', 'Executive decision pack', 'release/v85/v85-executive-decision-pack.md'],
];

const status = currentGateStatus();
const generated_at = new Date().toISOString();
const rows = packs.map(([version, title, file]) => [version, title, fs.existsSync(path.join(ROOT, file)) ? 'generated' : 'missing', file]);
const data = { generated_at, status, production_ready: false, packs: rows.map(([version, title, state, file]) => ({ version, title, state, file })) };
writeJson('release/v80-v85/v80-v85-governed-pilot-suite.json', data);
const md = `# v8.0 to v8.5 Governed Pilot Suite Review Pack\n\nGenerated: ${generated_at}\n\nStatus: **${status}**\n\nProduction ready: **false**\n\n${mdTable(['Version', 'Pack', 'State', 'File'], rows)}\n\n## Summary\n\nThis suite adds governance, evidence, KPI, security/privacy, training, and executive decision artifacts for controlled pilot launch planning. It intentionally keeps the real approval gate in place.\n\n${safetyBlock()}\n`;
writeText('release/v80-v85/v80-v85-review-pack.md', md);
console.log('v8.0-to-v8.5 governed pilot suite review pack generated.');
console.log(JSON.stringify({ status, production_ready: false, report: 'release/v80-v85/v80-v85-review-pack.md' }, null, 2));
