import fs from 'node:fs';
import path from 'node:path';

const packagePath = path.resolve('package.json');
if (!fs.existsSync(packagePath)) {
  throw new Error('package.json not found. Run this script from the repo root.');
}
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
pkg.scripts ??= {};
const additions = {
  'v120:polish-audit': 'node scripts/v120-polish-static-audit.mjs',
  'v120:polish-report': 'node scripts/v120-generate-polish-report.mjs',
  'v120:uat-matrix': 'node scripts/v120-generate-uat-matrix.mjs',
  'v120:final-proof': 'node scripts/v120-final-proof.mjs',
  'pilot:v120-polish': 'npm run v120:polish-audit && npm run v120:polish-report && npm run v120:uat-matrix && npm run v120:final-proof'
};
let changed = false;
for (const [key, value] of Object.entries(additions)) {
  if (pkg.scripts[key] !== value) {
    pkg.scripts[key] = value;
    changed = true;
  }
}
if (changed) fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
console.log('v12.0 package scripts installed.');
console.log(JSON.stringify({ changed, scripts: Object.keys(additions) }, null, 2));
