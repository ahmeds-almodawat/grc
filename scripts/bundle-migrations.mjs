import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const migrationsDir = 'supabase/migrations';
const outDir = 'supabase/_consolidated';
mkdirSync(outDir, { recursive: true });

const files = readdirSync(migrationsDir)
  .filter(file => file.endsWith('.sql'))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

const manifest = [];
let bundle = '-- GRC Control Center consolidated migration reference bundle\n';
bundle += `-- Generated at ${new Date().toISOString()}\n`;
bundle += '-- Use this as a review artifact. For Supabase migrations, still apply ordered migration files unless your DBA approves a consolidated install.\n\n';

for (const file of files) {
  const path = join(migrationsDir, file);
  const sql = readFileSync(path, 'utf8');
  const hash = createHash('sha256').update(sql).digest('hex');
  manifest.push({ file, bytes: Buffer.byteLength(sql), sha256: hash });
  bundle += `\n-- =========================================================\n`;
  bundle += `-- BEGIN ${file}\n`;
  bundle += `-- sha256: ${hash}\n`;
  bundle += `-- =========================================================\n\n`;
  bundle += sql.trimEnd() + '\n';
  bundle += `\n-- =========================================================\n`;
  bundle += `-- END ${file}\n`;
  bundle += `-- =========================================================\n`;
}

writeFileSync(join(outDir, 'ALL_MIGRATIONS_ORDERED.sql'), bundle);
writeFileSync(join(outDir, 'migration-manifest.json'), JSON.stringify({ generatedAt: new Date().toISOString(), count: files.length, files: manifest }, null, 2));
console.log(`Bundled ${files.length} migrations into ${outDir}/ALL_MIGRATIONS_ORDERED.sql`);
