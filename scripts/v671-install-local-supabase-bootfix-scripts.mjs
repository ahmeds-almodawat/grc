#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const pkgPath = path.resolve('package.json');
if (!fs.existsSync(pkgPath)) {
  console.error('package.json not found. Run this from the project root.');
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.scripts = pkg.scripts || {};
const desired = {
  'v671:disable-invalid-migration': 'node scripts/v671-disable-invalid-012a-migration.mjs',
  'v671:migration-audit': 'node scripts/v671-local-supabase-migration-audit.mjs --strict',
  'v671:all': 'npm run v671:disable-invalid-migration && npm run v671:migration-audit && npm run typecheck && npm run build',
  'v671:local-reset-guide': 'node scripts/v671-local-supabase-migration-audit.mjs'
};

let changed = 0;
for (const [name, cmd] of Object.entries(desired)) {
  if (pkg.scripts[name] !== cmd) {
    pkg.scripts[name] = cmd;
    changed += 1;
  }
}

fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
console.log('Added v6.7.1 local Supabase bootfix scripts to package.json');
console.log({ changed_scripts: changed });
console.log('Next: npm run v671:all');
console.log('Then run: supabase stop --no-backup; supabase start');
