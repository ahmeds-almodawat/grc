import fs from 'fs';
import path from 'path';

const packagePath = path.resolve('package.json');
if (!fs.existsSync(packagePath)) {
  console.error('package.json not found. Run this script from the project root.');
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
pkg.scripts = pkg.scripts || {};

const scripts = {
  'v59:plan': 'node scripts/v59-generate-test-plan.mjs',
  'no-mock:audit': 'node scripts/v59-audit-mock-data.mjs',
  'no-mock:fail': 'node scripts/v59-audit-mock-data.mjs --fail-on-unapproved',
  'no-mock:plan': 'node scripts/v59-clean-mock-suggestions.mjs',
  'test:phase1': 'node scripts/v59-phase-runner.mjs --phase=1',
  'test:phase2': 'node scripts/v59-phase-runner.mjs --phase=2',
  'test:phase3': 'node scripts/v59-phase-runner.mjs --phase=3',
  'test:phase4': 'node scripts/v59-phase-runner.mjs --phase=4',
  'test:phase5': 'node scripts/v59-phase-runner.mjs --phase=5',
  'test:phase6': 'node scripts/v59-phase-runner.mjs --phase=6',
  'test:phases': 'node scripts/v59-phase-runner.mjs --all',
  'v59:all': 'npm run v59:plan && npm run test:phases && npm run no-mock:audit && npm run no-mock:plan'
};

for (const [key, value] of Object.entries(scripts)) {
  pkg.scripts[key] = value;
}

fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');
console.log('Added v5.9 no-mock and phased auto-test scripts to package.json');
