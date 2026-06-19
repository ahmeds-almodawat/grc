import fs from 'node:fs';
import path from 'node:path';

const packagePath = path.resolve('package.json');
const lockPath = path.resolve('package-lock.json');
const releaseDir = path.resolve('release', 'v61');
const backupDir = path.join(releaseDir, 'backups');
fs.mkdirSync(backupDir, { recursive: true });

if (!fs.existsSync(packagePath)) {
  console.error('package.json not found. Run this from the project root.');
  process.exit(1);
}
if (!fs.existsSync(lockPath)) {
  console.error('package-lock.json not found. Run npm install first, then retry.');
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
const sections = ['dependencies', 'devDependencies', 'optionalDependencies'];
const changes = [];

function lockVersionFor(name) {
  const nodeModuleKey = `node_modules/${name}`;
  const item = lock.packages?.[nodeModuleKey];
  return item?.version || null;
}

function shouldSkip(version) {
  return typeof version !== 'string' || /^(file:|link:|workspace:|git\+|https?:)/.test(version);
}

for (const section of sections) {
  const deps = pkg[section] || {};
  for (const [name, current] of Object.entries(deps)) {
    if (shouldSkip(current)) continue;
    const locked = lockVersionFor(name);
    if (!locked) continue;
    if (current !== locked) {
      deps[name] = locked;
      changes.push({ section, name, from: current, to: locked });
    }
  }
}

if (changes.length) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.copyFileSync(packagePath, path.join(backupDir, `package.before-v61-pin.${stamp}.json`));
  fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');
}

const report = {
  generated_at: new Date().toISOString(),
  changed_count: changes.length,
  changes,
  next_steps: [
    'Review package.json diff.',
    'Run npm install to refresh package-lock.json if needed.',
    'Run npm run typecheck && npm run build && npm run v61:pin-strict.'
  ]
};
fs.writeFileSync(path.join(releaseDir, 'v61-pin-from-lock-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log('v6.1 package pin-from-lock complete.');
console.log(JSON.stringify({ changed_count: changes.length }, null, 2));
