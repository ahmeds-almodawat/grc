import fs from 'node:fs';
import path from 'node:path';

const args = new Set(process.argv.slice(2));
const shouldApply = args.has('--apply');
const confirmed = args.has('--i-understand-rename-migrations');
const migrationsDir = path.resolve('supabase', 'migrations');
const releaseDir = path.resolve('release', 'v611');
const backupDir = path.join(releaseDir, 'migration-name-backups');
fs.mkdirSync(releaseDir, { recursive: true });
fs.mkdirSync(backupDir, { recursive: true });

if (!fs.existsSync(migrationsDir)) {
  console.error('supabase/migrations not found.');
  process.exit(1);
}

const files = fs.readdirSync(migrationsDir).filter((file) => file.endsWith('.sql')).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
const parsed = files.map((file, index) => {
  const match = file.match(/^(\d+)_?(.*)\.sql$/);
  return {
    order: index + 1,
    file,
    prefixText: match ? match[1] : null,
    prefix: match ? Number(match[1]) : null,
    label: match ? match[2] : file.replace(/\.sql$/, '')
  };
});

const numeric = parsed.map((item) => item.prefix).filter(Number.isInteger).sort((a, b) => a - b);
const gaps = [];
if (numeric.length) {
  for (let n = numeric[0]; n <= numeric[numeric.length - 1]; n += 1) {
    if (!numeric.includes(n)) gaps.push(n);
  }
}

const byPrefix = new Map();
for (const item of parsed) {
  if (Number.isInteger(item.prefix)) {
    const list = byPrefix.get(item.prefix) || [];
    list.push(item);
    byPrefix.set(item.prefix, list);
  }
}
const duplicates = [...byPrefix.entries()]
  .filter(([, list]) => list.length > 1)
  .map(([prefix, list]) => ({ prefix, files: list.map((item) => item.file) }));

let available = [...gaps];
let nextPrefix = numeric.length ? Math.max(...numeric) + 1 : 1;
const proposedRenames = [];
for (const [prefix, list] of byPrefix.entries()) {
  if (list.length <= 1) continue;
  const sorted = [...list].sort((a, b) => a.file.localeCompare(b.file, undefined, { numeric: true }));
  // Keep the first occurrence stable. Propose renaming later duplicate files into known gaps first.
  for (const item of sorted.slice(1)) {
    const targetPrefix = available.length ? available.shift() : nextPrefix++;
    const targetName = `${String(targetPrefix).padStart(item.prefixText?.length || 3, '0')}_${item.label}.sql`;
    proposedRenames.push({ from: item.file, to: targetName, from_prefix: prefix, to_prefix: targetPrefix });
  }
}

const plan = {
  generated_at: new Date().toISOString(),
  migration_count: parsed.length,
  prefix_gaps: gaps,
  duplicate_prefixes: duplicates,
  proposed_renames: proposedRenames,
  safe_default: 'Plan only. No files are renamed unless --apply --i-understand-rename-migrations is passed.',
  warning: 'Do not rename migrations that have already been applied to a live/staging Supabase database without a deliberate migration-history decision.'
};

const md = [
  '# v6.1.1 Migration Prefix Cleanup Plan',
  '',
  `Generated: ${plan.generated_at}`,
  '',
  `Migration count: **${plan.migration_count}**`,
  `Prefix gaps: **${gaps.length ? gaps.join(', ') : 'none'}**`,
  `Duplicate prefixes: **${duplicates.length ? duplicates.map((d) => `${d.prefix}: ${d.files.join(', ')}`).join('; ') : 'none'}**`,
  '',
  '## Proposed renames',
  '',
  proposedRenames.length ? '| From | To | Reason |\n|---|---|---|\n' + proposedRenames.map((r) => `| \`${r.from}\` | \`${r.to}\` | Duplicate prefix ${r.from_prefix}; fill prefix ${r.to_prefix} |`).join('\n') : 'No renames required.',
  '',
  '## Safety rule',
  '',
  'This script does not rename files by default. Renaming historical migrations can break migration history if those migrations were already applied in Supabase.',
  '',
  'To apply only in a local/unapplied migration set:',
  '',
  '```bash',
  'npm run v611:migration-apply',
  'npm run v61:migrations',
  '```',
  ''
].join('\n');

fs.writeFileSync(path.join(releaseDir, 'v611-migration-prefix-cleanup-plan.json'), JSON.stringify(plan, null, 2) + '\n');
fs.writeFileSync(path.join(releaseDir, 'V611_MIGRATION_PREFIX_CLEANUP_PLAN.md'), md);

if (shouldApply) {
  if (!confirmed) {
    console.error('Refusing to rename migrations without --i-understand-rename-migrations.');
    process.exit(2);
  }
  if (!proposedRenames.length) {
    console.log('No migration renames required.');
  } else {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    for (const rename of proposedRenames) {
      const fromPath = path.join(migrationsDir, rename.from);
      const toPath = path.join(migrationsDir, rename.to);
      if (!fs.existsSync(fromPath)) throw new Error(`Missing migration file: ${rename.from}`);
      if (fs.existsSync(toPath)) throw new Error(`Target already exists: ${rename.to}`);
      fs.copyFileSync(fromPath, path.join(backupDir, `${timestamp}.${rename.from}`));
      fs.renameSync(fromPath, toPath);
    }
    fs.writeFileSync(path.join(releaseDir, 'v611-migration-prefix-applied.json'), JSON.stringify({ applied_at: new Date().toISOString(), proposedRenames }, null, 2) + '\n');
    console.log(`Applied ${proposedRenames.length} migration rename(s).`);
  }
}

console.log('v6.1.1 migration prefix cleanup plan generated.');
console.log(JSON.stringify({ prefix_gaps: gaps, duplicate_prefixes: duplicates.length, proposed_renames: proposedRenames.length, applied: shouldApply && confirmed }, null, 2));
