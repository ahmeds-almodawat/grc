import fs from 'node:fs';
import path from 'node:path';
import { releaseDir, statusFromApprovals, writeJson, writeMd } from './v78-common.mjs';

const sections = [
  ['Environment Template Audit', 'env-template-audit.md'],
  ['Live Staging Execution Plan', 'staging-execution-plan.md'],
  ['Smoke Test Plan', 'smoke-test-plan.md'],
  ['Rollback Readiness', 'rollback-readiness.md'],
  ['Access Control Plan', 'access-control-plan.md'],
  ['Observability Plan', 'observability-plan.md'],
  ['Go/No-Go Pack', 'go-no-go-pack.md'],
];
const content = sections.map(([title, file]) => {
  const full = path.join(releaseDir, file);
  const body = fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : `Missing ${file}`;
  return `## ${title}\n\n${body}`;
}).join('\n\n---\n\n');
const result = { generated_at: new Date().toISOString(), status: statusFromApprovals(), sections: sections.length };
writeJson('v78-review-pack.json', result);
writeMd('v78-review-pack.md', `# v7.8 Live Staging Execution Review Pack\n\nGenerated: ${result.generated_at}\n\nStatus: **${result.status}**\n\n${content}`);
console.log('v7.8 review pack generated.');
console.log(JSON.stringify({ status: result.status, sections: sections.length, report: 'release/v78/v78-review-pack.md' }, null, 2));
