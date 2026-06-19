import fs from 'node:fs';
import path from 'node:path';

const pkgPath = path.resolve('package.json');
if (!fs.existsSync(pkgPath)) {
  console.error('package.json not found. Run from project root.');
  process.exit(1);
}
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.scripts = pkg.scripts || {};
const scripts = {
  'v663:pin-test-deps': 'node scripts/v663-pin-test-dependencies.mjs',
  'v663:sql-pack-fix': 'node scripts/v662-staging-command-pack.mjs',
  'v663:progress-audit': 'node scripts/v663-progress-consistency-audit.mjs',
  'v663:all': 'npm run typecheck && npm run build && npm run v663:pin-test-deps && npm run v61:pin-strict && npm run v661:sql-pack && npm run v663:sql-pack-fix && npm run v663:progress-audit'
};
let changed = 0;
for (const [key, value] of Object.entries(scripts)) {
  if (pkg.scripts[key] !== value) {
    pkg.scripts[key] = value;
    changed++;
  }
}
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log('Added v6.6.3 progress consistency scripts to package.json');
console.log({ changed_scripts: changed });
console.log('Next: npm run v663:all');
