import fs from 'fs';

const packagePath = 'package.json';
if (!fs.existsSync(packagePath)) {
  console.error('package.json not found. Run this from the project root.');
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
pkg.scripts = pkg.scripts || {};
const scripts = {
  'doctor:local': 'node scripts/v38-local-doctor.mjs',
  'doctor:schema': 'node scripts/v38-schema-doctor.mjs',
  'simulate:production': 'node scripts/v38-production-simulator.mjs',
  'report:final': 'node scripts/v38-final-report.mjs',
  'v38:all': 'node scripts/v38-local-doctor.mjs && node scripts/v38-schema-doctor.mjs && node scripts/v38-production-simulator.mjs && node scripts/v38-final-report.mjs'
};

for (const [key, value] of Object.entries(scripts)) {
  pkg.scripts[key] = value;
}

fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');
console.log('Added v3.8 npm scripts to package.json');
