import fs from 'node:fs';
import path from 'node:path';

const pkgPath = path.resolve('package.json');
if (!fs.existsSync(pkgPath)) {
  console.error('package.json not found. Run from the project root.');
  process.exit(1);
}
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.scripts = pkg.scripts || {};
const scripts = {
  'v64:rls-audit': 'node scripts/v64-rls-static-audit.mjs',
  'v64:rls-strict': 'node scripts/v64-rls-static-audit.mjs --strict',
  'v64:functions': 'node scripts/v64-security-function-audit.mjs',
  'v64:functions-strict': 'node scripts/v64-security-function-audit.mjs --strict',
  'v64:views': 'node scripts/v64-view-security-audit.mjs',
  'v64:views-strict': 'node scripts/v64-view-security-audit.mjs --strict',
  'v64:persona-sql': 'node scripts/v64-generate-persona-test-sql.mjs',
  'v64:proof': 'node scripts/v64-database-security-proof-report.mjs',
  'v64:all': 'npm run typecheck && npm run build && npm run v64:rls-audit && npm run v64:functions && npm run v64:views && npm run v64:persona-sql && npm run v64:proof',
  'v64:strict-all': 'npm run typecheck && npm run build && npm run v64:rls-strict && npm run v64:functions-strict && npm run v64:views-strict && npm run v64:persona-sql && npm run v64:proof'
};
Object.assign(pkg.scripts, scripts);
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log('Added v6.4 database security proof scripts to package.json');
console.log('Next: npm run v64:all');
console.log('Strict proof after RLS fixes: npm run v64:strict-all');
