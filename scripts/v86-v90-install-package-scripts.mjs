import fs from 'node:fs';

const packagePath = 'package.json';
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
pkg.scripts = pkg.scripts || {};

const desiredScripts = {
  'v86:execution-evidence': 'node scripts/v86-pilot-execution-evidence.mjs',
  'v87:control-testing': 'node scripts/v87-control-testing-effectiveness.mjs',
  'v88:resilience-third-party': 'node scripts/v88-resilience-third-party-readiness.mjs',
  'v89:remediation-scale': 'node scripts/v89-remediation-scale-readiness.mjs',
  'v90:final-dossier': 'node scripts/v90-final-decision-dossier.mjs',
  'v86-v90:review-pack': 'node scripts/v86-v90-generate-review-pack.mjs',
  'v86-v90:all': 'npm run v86:execution-evidence && npm run v87:control-testing && npm run v88:resilience-third-party && npm run v89:remediation-scale && npm run v90:final-dossier && npm run v86-v90:review-pack',
  'pilot:execution-evidence': 'npm run ci:static && npm run v86-v90:all'
};

const added = [];
const preserved = [];
for (const [name, command] of Object.entries(desiredScripts)) {
  if (pkg.scripts[name] === command) {
    preserved.push(name);
  } else {
    pkg.scripts[name] = command;
    added.push(name);
  }
}

fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');
console.log('v8.6-v9.0 package script installation complete.');
console.log(JSON.stringify({ changed: added.length > 0, added, preserved }, null, 2));
