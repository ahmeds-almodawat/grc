import fs from 'node:fs';
import path from 'node:path';
import { releaseDir, writeMd, fileExists } from './v76-common.mjs';

function read(rel) {
  const p = path.join(process.cwd(), rel);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8').trim() : `Missing: ${rel}`;
}

const sections = [
  ['Executive summary', 'docs/V76_CI_REPO_HYGIENE_EVIDENCE_OPS.md'],
  ['Script inventory', 'release/v76/script-inventory.md'],
  ['Repo hygiene audit', 'release/v76/repo-hygiene-audit.md'],
  ['CI readiness audit', 'release/v76/ci-readiness-audit.md'],
  ['Evidence operations dashboard', 'release/v76/evidence-ops-dashboard.md'],
  ['Technical debt register', 'docs/TECHNICAL_DEBT_REGISTER.md'],
  ['Next phase roadmap', 'docs/V76_NEXT_PHASE_ROADMAP.md'],
];

const body = [`# v7.6 CI / Repo Hygiene / Evidence Operations Review Pack`, `Generated: ${new Date().toISOString()}`, ``, `This pack is safe before human signoff. It does not mark production readiness and does not bypass approval gates.`];
for (const [title, rel] of sections) {
  body.push(`\n---\n\n## ${title}\n\n_Source: ${rel}_\n\n${read(rel)}`);
}

const out = writeMd('v76-review-pack.md', body.join('\n'));
console.log('v7.6 review pack generated.');
console.log(JSON.stringify({ report: 'release/v76/v76-review-pack.md' }, null, 2));
