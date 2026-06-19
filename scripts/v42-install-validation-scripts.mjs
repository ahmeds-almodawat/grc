import fs from 'node:fs';
import path from 'node:path';

const pkgPath = path.resolve('package.json');
if (!fs.existsSync(pkgPath)) {
  console.error('package.json not found. Run this from the project root.');
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.scripts = pkg.scripts || {};
const additions = {
  'doctor:consolidation': 'node scripts/v39-full-consolidation-audit.mjs',
  'rc:audit': 'node scripts/v40-release-candidate-audit.mjs',
  'supabase:verify': 'node scripts/v41-fresh-supabase-install-verifier.mjs',
  'rls:lab': 'node scripts/v42-rls-persona-test-lab.mjs',
  'rls:sql': 'node scripts/v42-generate-rls-persona-sql.mjs',
  'v42:all': 'npm run doctor:consolidation && npm run rc:audit && npm run supabase:verify && npm run rls:lab && npm run rls:sql'
};

let changed = false;
for (const [name, command] of Object.entries(additions)) {
  if (pkg.scripts[name] !== command) {
    pkg.scripts[name] = command;
    changed = true;
  }
}

if (changed) {
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  console.log('Added v4.2 validation scripts to package.json');
} else {
  console.log('v4.2 validation scripts already exist');
}
