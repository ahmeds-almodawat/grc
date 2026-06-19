import fs from 'node:fs';

const packageJsonPath = 'package.json';
const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
pkg.scripts = pkg.scripts || {};
pkg.scripts['v63:auth'] = 'node scripts/v63-auth-route-audit.mjs';
pkg.scripts['v63:all'] = 'npm run typecheck && npm run build && npm run v60:strict && npm run v63:auth';
fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n');
console.log('Added v6.3 production security foundation scripts to package.json');
console.log('Next: npm run v63:all');
