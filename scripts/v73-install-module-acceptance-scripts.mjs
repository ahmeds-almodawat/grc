import fs from 'node:fs';
import path from 'node:path';

const pkgPath = path.join(process.cwd(), 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.scripts = pkg.scripts || {};
const additions = {
  'v73:module-acceptance': 'node scripts/v73-module-acceptance.mjs',
  'v73:module-report': 'node scripts/v73-module-report.mjs',
  'v73:all': 'npm run v73:module-acceptance && npm run v73:module-report'
};
let changed = false;
for (const [name, command] of Object.entries(additions)) {
  if (pkg.scripts[name] !== command) {
    pkg.scripts[name] = command;
    changed = true;
  }
}
if (changed) fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
console.log('v7.3 module acceptance package scripts installed.');
console.log(JSON.stringify({ changed, scripts: additions }, null, 2));
