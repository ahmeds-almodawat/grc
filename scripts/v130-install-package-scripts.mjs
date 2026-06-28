import fs from 'node:fs';
import path from 'node:path';

const packagePath = path.resolve('package.json');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
packageJson.scripts = packageJson.scripts || {};

const scripts = {
  'v130:ux-audit': 'node scripts/v130-ux-static-audit.mjs',
  'v130:polish-report': 'node scripts/v130-generate-executive-polish-report.mjs',
  'v130:guided-uat': 'node scripts/v130-generate-guided-uat-script.mjs',
  'v130:final-proof': 'node scripts/v130-final-proof.mjs',
  'pilot:v130-polish': 'npm run v130:ux-audit && npm run v130:polish-report && npm run v130:guided-uat && npm run v130:final-proof'
};

let changed = false;
for (const [name, command] of Object.entries(scripts)) {
  if (packageJson.scripts[name] !== command) {
    packageJson.scripts[name] = command;
    changed = true;
  }
}

if (changed) {
  fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
}

console.log('v13.0 package scripts installed.');
console.log(JSON.stringify({ changed, scripts: Object.keys(scripts) }, null, 2));
