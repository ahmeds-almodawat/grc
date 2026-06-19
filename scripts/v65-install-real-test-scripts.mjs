import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pkgPath = path.join(root, 'package.json');
if (!fs.existsSync(pkgPath)) {
  console.error('package.json not found. Run this from the project root.');
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.scripts = pkg.scripts || {};

const scriptsToAdd = {
  'v65:assets': 'node scripts/v65-test-assets-audit.mjs',
  'v65:workflow': 'node scripts/v65-workflow-contract-tests.mjs',
  'v65:auth': 'node scripts/v65-auth-security-smoke.mjs',
  'v65:pilot': 'node scripts/v65-pilot-readiness-gate.mjs',
  'v65:phases': 'node scripts/v65-phase-runner.mjs --all',
  'v65:all': 'npm run typecheck && npm run build && npm run v60:strict && npm run v64:strict-all && npm run v65:phases',
  'v65:install-test-deps': 'npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom @playwright/test --registry=https://registry.npmjs.org/',
  'test:unit': 'vitest run',
  'test:e2e': 'playwright test',
  'test:real': 'npm run test:unit && npm run test:e2e'
};

for (const [name, command] of Object.entries(scriptsToAdd)) {
  pkg.scripts[name] = command;
}

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log('Added v6.5 real test and pilot readiness scripts to package.json');
console.log('Next: npm run v65:all');
console.log('Optional real browser/unit deps: npm run v65:install-test-deps && npm run test:real');
