import fs from 'fs';
import path from 'path';

const pkgPath = path.resolve('package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.scripts = pkg.scripts || {};
Object.assign(pkg.scripts, {
  'v43:ovr': 'node scripts/v43-ovr-production-audit.mjs',
  'v44:ovr-risk': 'node scripts/v44-ovr-risk-calibration-audit.mjs',
  'v45:i18n': 'node scripts/v45-i18n-deep-audit.mjs',
  'v46:rtl': 'node scripts/v46-rtl-visual-qa.mjs',
  'v46:all': 'npm run v43:ovr && npm run v44:ovr-risk && npm run v45:i18n && npm run v46:rtl'
});
fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
console.log('Added v4.3-v4.6 validation scripts to package.json');
