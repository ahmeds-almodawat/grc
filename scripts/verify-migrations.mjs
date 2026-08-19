import fs from 'node:fs';
import path from 'node:path';

const migrationsDir = path.resolve('supabase/migrations');
if (!fs.existsSync(migrationsDir)) {
  console.error('Missing supabase/migrations directory.');
  process.exit(1);
}

const files = fs.readdirSync(migrationsDir).filter(file => file.endsWith('.sql')).sort();
const seen = new Set();
let ok = true;

for (const file of files) {
  const prefix = file.match(/^(\d{3}[a-z]?)/)?.[1];
  if (!prefix) {
    console.warn(`WARN: migration has no numeric prefix: ${file}`);
    continue;
  }
  if (seen.has(prefix)) {
    console.error(`ERROR: duplicate migration prefix: ${prefix}`);
    ok = false;
  }
  seen.add(prefix);
}

const last = files.at(-1);
console.log(`Found ${files.length} migration files.`);
console.log(`Last migration: ${last ?? 'none'}`);

if (!files.includes('026_finish_fast_release_sprint.sql')) {
  console.error('ERROR: final v3.0 migration 026_finish_fast_release_sprint.sql is missing.');
  ok = false;
}

if (!ok) process.exit(1);
console.log('Migration filename verification passed. Still run migrations in Supabase for real validation.');
