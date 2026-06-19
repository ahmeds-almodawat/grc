#!/usr/bin/env node
import { createWriteStream, existsSync, mkdirSync, readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const outDir = join(root, 'release-artifacts');
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const manifestPath = join(outDir, `release-manifest-${stamp}.json`);
const zipPath = join(outDir, `grc-control-center-final-${stamp}.zip`);

const excludeParts = new Set(['node_modules', 'dist', '.git', 'release-artifacts']);
function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    if (excludeParts.has(name)) continue;
    const full = join(dir, name);
    const rel = relative(root, full).replaceAll('\\', '/');
    const st = statSync(full);
    if (st.isDirectory()) walk(full, files);
    else files.push({ path: rel, size: st.size });
  }
  return files;
}

mkdirSync(outDir, { recursive: true });
const files = walk(root);
const migrations = files.filter(f => f.path.startsWith('supabase/migrations/') && f.path.endsWith('.sql')).map(f => f.path).sort();
const docs = files.filter(f => f.path.startsWith('docs/') && f.path.endsWith('.md')).map(f => f.path).sort();
const manifest = {
  generatedAt: new Date().toISOString(),
  packageName: 'grc-control-center',
  purpose: 'Final release bundle manifest. Zip excludes node_modules, dist, .git and release-artifacts.',
  counts: { files: files.length, migrations: migrations.length, docs: docs.length },
  migrations,
  docs,
  checks: {
    runBeforeZip: ['npm run typecheck', 'npm run build', 'node scripts/verify-migrations.mjs'],
    postInstall: ['npm install', 'npm run typecheck', 'npm run build']
  }
};
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

const zip = spawnSync('zip', ['-qr', zipPath, '.', '-x', 'node_modules/*', 'dist/*', '.git/*', 'release-artifacts/*'], { cwd: root, stdio: 'inherit' });
if (zip.status !== 0) {
  console.error('zip command failed. Manifest still created at:', manifestPath);
  process.exit(zip.status ?? 1);
}
console.log('Created final release manifest:', manifestPath);
console.log('Created final release zip:', zipPath);
