import fs from 'node:fs';
import path from 'node:path';

const packagePath = path.resolve('package.json');
if (!fs.existsSync(packagePath)) {
  throw new Error('package.json not found. Run from the repository root.');
}

const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
pkg.scripts = pkg.scripts || {};
const desired = {
  'v110:enterprise-audit': 'node scripts/v110-enterprise-static-audit.mjs',
  'v110:enterprise-report': 'node scripts/v110-generate-enterprise-report.mjs',
  'v110:uat-matrix': 'node scripts/v110-uat-scenario-matrix.mjs',
  'v110:final-proof': 'node scripts/v110-final-proof.mjs',
  'pilot:v110-enterprise': 'npm run v110:enterprise-audit && npm run v110:enterprise-report && npm run v110:uat-matrix && npm run v110:final-proof'
};

const changed = [];
for (const [name, command] of Object.entries(desired)) {
  if (pkg.scripts[name] !== command) {
    pkg.scripts[name] = command;
    changed.push(name);
  }
}

fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');
console.log('v11.0 package scripts installed.');
console.log(JSON.stringify({ changed, scripts: Object.keys(desired) }, null, 2));
