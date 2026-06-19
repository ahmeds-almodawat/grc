import fs from 'node:fs';
import path from 'node:path';

const packagePath = path.resolve('package.json');
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
pkg.scripts = pkg.scripts || {};
const additions = {
  'v50:scale': 'node scripts/v50-generate-scale-seed.mjs --dry-run',
  'v50:performance': 'node scripts/v50-performance-audit.mjs',
  'v50:backup': 'node scripts/v50-backup-strategy-check.mjs',
  'v50:restore': 'node scripts/v50-restore-dryrun-audit.mjs',
  'v50:all': 'npm run typecheck && npm run build && npm run v50:scale && npm run v50:performance && npm run v50:backup && npm run v50:restore'
};
let changed = false;
for (const [key, value] of Object.entries(additions)) {
  if (pkg.scripts[key] !== value) {
    pkg.scripts[key] = value;
    changed = true;
  }
}
if (changed) {
  fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');
  console.log('Added v5.0 npm scripts to package.json');
} else {
  console.log('v5.0 npm scripts already installed');
}
