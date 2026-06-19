import fs from 'node:fs';
import path from 'node:path';

const pkgPath = path.resolve('package.json');
const lockPath = path.resolve('package-lock.json');
if (!fs.existsSync(pkgPath)) {
  console.error('package.json not found. Run from project root.');
  process.exit(1);
}
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const lock = fs.existsSync(lockPath) ? JSON.parse(fs.readFileSync(lockPath, 'utf8')) : null;

const testDeps = [
  '@playwright/test',
  '@testing-library/jest-dom',
  '@testing-library/react',
  'jsdom',
  'vitest'
];

pkg.devDependencies = pkg.devDependencies || {};
let changed = 0;
const pinned = [];
for (const name of testDeps) {
  if (!(name in pkg.devDependencies)) continue;
  const lockedVersion = lock?.packages?.[`node_modules/${name}`]?.version;
  const current = pkg.devDependencies[name];
  const next = lockedVersion || String(current).replace(/^[~^]/, '');
  if (current !== next) {
    pkg.devDependencies[name] = next;
    changed++;
  }
  pinned.push({ name, version: pkg.devDependencies[name] });
}

if (lock?.packages?.['']) {
  const root = lock.packages[''];
  root.devDependencies = root.devDependencies || {};
  for (const { name, version } of pinned) {
    if (root.devDependencies[name] && root.devDependencies[name] !== version) {
      root.devDependencies[name] = version;
      changed++;
    }
  }
}

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
if (lock) fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');

const reportDir = path.resolve('release/v663');
fs.mkdirSync(reportDir, { recursive: true });
fs.writeFileSync(path.join(reportDir, 'v663-pinned-test-dependencies.json'), JSON.stringify({
  generated_at: new Date().toISOString(),
  changed_count: changed,
  pinned
}, null, 2));
console.log('v6.6.3 test dependency pinning complete.');
console.log({ changed_count: changed, pinned });
