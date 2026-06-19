import fs from 'fs';
import path from 'path';

const packagePath = path.resolve('package.json');
if (!fs.existsSync(packagePath)) {
  console.error('package.json not found. Run this from the project root.');
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
pkg.scripts = pkg.scripts || {};
const scripts = {
  'v58:pilot': 'node scripts/v58-pilot-readiness.mjs',
  'v58:rollout': 'node scripts/v58-rollout-readiness.mjs',
  'v58:security': 'node scripts/v58-security-review.mjs',
  'v58:audit': 'node scripts/v58-audit-trail-check.mjs',
  'v58:all': 'npm run typecheck && npm run build && npm run v58:pilot && npm run v58:rollout && npm run v58:security && npm run v58:audit'
};
Object.assign(pkg.scripts, scripts);
fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');
console.log('Added v5.8 npm scripts to package.json');
console.table(Object.keys(scripts).map((script) => ({ script })));
