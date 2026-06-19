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
  'v66:evidence': 'node scripts/v66-staging-evidence-register.mjs',
  'v66:restore': 'node scripts/v66-restore-dryrun-evidence.mjs',
  'v66:pilot-package': 'node scripts/v66-controlled-pilot-package.mjs',
  'v66:go-no-go': 'node scripts/v66-go-no-go-gate.mjs',
  'v66:strict-proof': 'node scripts/v66-go-no-go-gate.mjs --strict',
  'v66:phases': 'node scripts/v66-phase-runner.mjs --all',
  'v66:all': 'node scripts/v66-phase-runner.mjs --all'
};

for (const [name, command] of Object.entries(scriptsToAdd)) {
  pkg.scripts[name] = command;
}

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log('Added v6.6 controlled pilot evidence scripts to package.json');
console.log('Next: npm run v66:all');
console.log('Strict go/no-go after manual evidence is attached: npm run v66:strict-proof');
