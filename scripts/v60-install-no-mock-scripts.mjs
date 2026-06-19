import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';

const root = process.cwd();
const pkgPath = path.join(root, 'package.json');
if (!existsSync(pkgPath)) {
  console.error('package.json not found. Run this from project root.');
  process.exit(1);
}
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
pkg.scripts = pkg.scripts || {};
Object.assign(pkg.scripts, {
  'v60:remediate': 'node scripts/v60-runtime-no-mock-remediation.mjs',
  'v60:audit': 'node scripts/v60-production-data-audit.mjs',
  'v60:strict': 'node scripts/v60-production-data-audit.mjs --strict',
  'v60:phases': 'node scripts/v60-phase-runner.mjs --all',
  'v60:all': 'npm run v60:remediate && npm run typecheck && npm run build && npm run v60:strict && npm run v60:phases',
  'no-mock:audit': 'node scripts/v60-production-data-audit.mjs',
  'no-mock:fail': 'node scripts/v60-production-data-audit.mjs --strict',
  'test:phases': 'node scripts/v60-phase-runner.mjs --all'
});
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log('Added v6.0 no-mock remediation scripts to package.json');
console.log('Next: npm run v60:remediate && npm run v60:all');
