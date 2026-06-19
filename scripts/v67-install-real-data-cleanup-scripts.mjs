import fs from 'node:fs';

const packagePath = 'package.json';
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
pkg.scripts = pkg.scripts || {};
const scripts = {
  'v67:cleanup': 'node scripts/v67-real-data-static-blocker-cleanup.mjs',
  'v67:audit': 'npm run v62:static-strict',
  'v67:all': 'npm run v67:cleanup && npm run typecheck && npm run build && npm run test:real && npm run v62:static-strict && npm run v663:progress-audit',
  'v67:rollback-note': 'node -e "console.log(\'Backups are under release/v67/backups. Restore manually only if v67 cleanup causes a local issue.\')"'
};
let changed = 0;
for (const [key, value] of Object.entries(scripts)) {
  if (pkg.scripts[key] !== value) {
    pkg.scripts[key] = value;
    changed += 1;
  }
}
fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');
console.log('Added v6.7 real-data cleanup scripts to package.json');
console.log({ changed_scripts: changed });
console.log('Next: npm run v67:all');
