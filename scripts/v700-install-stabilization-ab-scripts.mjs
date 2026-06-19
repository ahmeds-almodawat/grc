import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pkgPath = path.join(root, 'package.json');
if (!fs.existsSync(pkgPath)) {
  console.error('package.json not found. Run from the project root.');
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.scripts = pkg.scripts || {};

const additions = {
  'v700:install': 'node scripts/v700-install-stabilization-ab-scripts.mjs',
  'v700:rpc-inventory': 'node scripts/v700-rpc-inventory.mjs',
  'v700:runtime-security': 'node scripts/v700-runtime-security-bridge-audit.mjs',
  'v700:v65-audit': 'node scripts/v700-v65-strength-audit.mjs',
  'v700:v65-repair-copy': 'node scripts/v700-v65-strength-audit.mjs --repair-copy',
  'v700:persona-gap': 'node scripts/v700-persona-test-gap-report.mjs',
  'v700:proof-suite': 'node scripts/v700-proof-suite.mjs all',
  'v700:all': 'npm run v700:rpc-inventory && npm run v700:runtime-security && npm run v700:v65-audit && npm run v700:persona-gap && npm run v700:proof-suite',
  'proof:technical': 'node scripts/v700-proof-suite.mjs technical',
  'proof:runtime-security': 'node scripts/v700-proof-suite.mjs runtime-security',
  'proof:personas': 'node scripts/v700-persona-test-gap-report.mjs --strict',
  'proof:restore': 'node scripts/v700-proof-suite.mjs restore',
  'proof:pilot': 'node scripts/v700-proof-suite.mjs pilot',
  'proof:all': 'node scripts/v700-proof-suite.mjs all'
};

const changed = [];
const preserved = [];
for (const [key, value] of Object.entries(additions)) {
  if (pkg.scripts[key] === value) {
    preserved.push(key);
    continue;
  }
  if (pkg.scripts[key] && pkg.scripts[key] !== value) {
    pkg.scripts[`archived:${key}:before-v700`] = pkg.scripts[key];
  }
  pkg.scripts[key] = value;
  changed.push(key);
}

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
fs.mkdirSync(path.join(root, 'release', 'v700'), { recursive: true });
fs.writeFileSync(
  path.join(root, 'release', 'v700', 'v700-install-report.json'),
  JSON.stringify({ generated_at: new Date().toISOString(), changed, preserved }, null, 2) + '\n'
);

console.log('v7.0 stabilization A+B script installer complete.');
console.log(JSON.stringify({ changed_count: changed.length, changed, archived_existing_keys_prefix: 'archived:<key>:before-v700' }, null, 2));
