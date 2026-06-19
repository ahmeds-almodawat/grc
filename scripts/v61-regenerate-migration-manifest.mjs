import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const migrationsDir = path.resolve('supabase', 'migrations');
const consolidatedDir = path.resolve('supabase', '_consolidated');
const releaseDir = path.resolve('release', 'v61');
fs.mkdirSync(consolidatedDir, { recursive: true });
fs.mkdirSync(releaseDir, { recursive: true });

if (!fs.existsSync(migrationsDir)) {
  console.error('supabase/migrations not found.');
  process.exit(1);
}

const files = fs.readdirSync(migrationsDir)
  .filter((file) => file.endsWith('.sql'))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

const migrations = files.map((file, index) => {
  const fullPath = path.join(migrationsDir, file);
  const sql = fs.readFileSync(fullPath, 'utf8');
  const stat = fs.statSync(fullPath);
  const match = file.match(/^(\d+)_?(.*)\.sql$/);
  return {
    order: index + 1,
    file,
    numeric_prefix: match ? Number(match[1]) : null,
    label: match ? match[2] : file.replace(/\.sql$/, ''),
    bytes: stat.size,
    lines: sql.split(/\r?\n/).length,
    sha256: crypto.createHash('sha256').update(sql).digest('hex')
  };
});

const duplicatePrefixes = Object.entries(
  migrations.reduce((acc, item) => {
    if (item.numeric_prefix !== null) {
      acc[item.numeric_prefix] = acc[item.numeric_prefix] || [];
      acc[item.numeric_prefix].push(item.file);
    }
    return acc;
  }, {})
).filter(([, list]) => list.length > 1).map(([prefix, list]) => ({ prefix: Number(prefix), files: list }));

const gaps = [];
const numeric = migrations.map((m) => m.numeric_prefix).filter((n) => Number.isInteger(n)).sort((a, b) => a - b);
if (numeric.length) {
  for (let n = numeric[0]; n <= numeric[numeric.length - 1]; n += 1) {
    if (!numeric.includes(n)) gaps.push(n);
  }
}

const manifest = {
  generated_at: new Date().toISOString(),
  generator: 'v61-regenerate-migration-manifest.mjs',
  project: 'grc-control-center',
  migration_count: migrations.length,
  latest_migration: migrations.length ? migrations[migrations.length - 1].file : null,
  numeric_prefix_range: numeric.length ? { first: numeric[0], last: numeric[numeric.length - 1] } : null,
  prefix_gaps: gaps,
  duplicate_prefixes: duplicatePrefixes,
  production_note: 'This manifest is generated from the current supabase/migrations directory. It is a file inventory, not proof that migrations run successfully in a fresh Supabase project.',
  migrations
};

fs.writeFileSync(path.join(consolidatedDir, 'migration-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
fs.writeFileSync(path.join(releaseDir, 'v61-migration-manifest-summary.json'), JSON.stringify({
  generated_at: manifest.generated_at,
  migration_count: manifest.migration_count,
  latest_migration: manifest.latest_migration,
  prefix_gaps: manifest.prefix_gaps,
  duplicate_prefixes: manifest.duplicate_prefixes,
  note: manifest.production_note
}, null, 2) + '\n');

const md = [
  '# v6.1 Migration Manifest',
  '',
  `Generated: ${manifest.generated_at}`,
  '',
  `Migration count: **${manifest.migration_count}**`,
  `Latest migration: **${manifest.latest_migration || 'none'}**`,
  '',
  'This manifest is an inventory. Production proof still requires applying all migrations to a fresh Supabase staging project.',
  '',
  '## Warnings',
  '',
  `- Prefix gaps: ${gaps.length ? gaps.join(', ') : 'none detected'}`,
  `- Duplicate prefixes: ${duplicatePrefixes.length ? duplicatePrefixes.map((d) => `${d.prefix} (${d.files.join(', ')})`).join('; ') : 'none detected'}`,
  '',
  '## Files',
  '',
  '| # | File | Lines | SHA-256 |',
  '|---:|---|---:|---|',
  ...migrations.map((m) => `| ${m.order} | \`${m.file}\` | ${m.lines} | \`${m.sha256.slice(0, 16)}…\` |`),
  ''
].join('\n');
fs.writeFileSync(path.join(consolidatedDir, 'MIGRATION_MANIFEST.md'), md);

console.log('v6.1 migration manifest regenerated.');
console.log(JSON.stringify({
  migration_count: manifest.migration_count,
  latest_migration: manifest.latest_migration,
  prefix_gaps: manifest.prefix_gaps,
  duplicate_prefixes: manifest.duplicate_prefixes.length
}, null, 2));
