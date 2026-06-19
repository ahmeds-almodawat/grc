import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, copyFileSync } from 'fs';
import path from 'path';

const root = process.cwd();
const releaseDir = path.join(root, 'release', 'v60');
mkdirSync(releaseDir, { recursive: true });

const sourceDirs = ['src/lib', 'src/pages'];
const exts = new Set(['.ts', '.tsx']);
const changedFiles = [];
const backups = [];

function walk(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (exts.has(path.extname(p))) out.push(p);
  }
  return out;
}

function backup(file) {
  const rel = path.relative(root, file);
  const dest = path.join(releaseDir, 'backups', rel);
  mkdirSync(path.dirname(dest), { recursive: true });
  copyFileSync(file, dest);
  backups.push(path.relative(root, dest));
}

function replaceAll(text, pattern, replacement) {
  return text.replace(pattern, replacement);
}

function remediateText(text) {
  let next = text;
  // Replace runtime use of known fallback/mock/demo/sample variables in Supabase helper calls.
  // This preserves compile safety by passing empty arrays/nulls instead of hard-coded fallback objects.
  next = replaceAll(
    next,
    /(safeQuery\s*<[^>]+>\s*\([^,]+(?:,[^,()]+|\([^)]*\))*?,\s*)(fallback\w+|mock\w+|demo\w+|sample\w+|dummy\w+)(\s*\))/g,
    '$1[]$3'
  );
  next = replaceAll(
    next,
    /(safeMaybeSingle\s*<[^>]+>\s*\([^,]+(?:,[^,()]+|\([^)]*\))*?,\s*)(fallback\w+|mock\w+|demo\w+|sample\w+|dummy\w+)(\s*\))/g,
    '$1null$3'
  );

  // Common direct state/data initializers that silently pre-load fake data.
  next = replaceAll(
    next,
    /(useState\s*<[^>]+>\s*\(\s*)(fallback\w+|mock\w+|demo\w+|sample\w+|dummy\w+)(\s*\))/g,
    '$1[]$3'
  );
  next = replaceAll(
    next,
    /(useState\s*\(\s*)(fallback\w+|mock\w+|demo\w+|sample\w+|dummy\w+)(\s*\))/g,
    '$1[]$3'
  );

  // Common catch-block returns of fake data.
  next = replaceAll(
    next,
    /return\s+(fallback\w+|mock\w+|demo\w+|sample\w+|dummy\w+)\s*;/g,
    'return [];'
  );

  // Make common safeQuery helper implementations production-strict when they still accept fallback.
  // This is intentionally conservative: it only modifies files that already mention VITE_ALLOW_DEMO_DATA or safeQuery.
  if (next.includes('safeQuery') && /fallback\s*[:=]/.test(next)) {
    next = next.replace(
      /const\s+allowDemoData\s*=\s*[^;]+;/g,
      "const allowDemoData = import.meta.env.VITE_ALLOW_DEMO_DATA === 'true' && import.meta.env.MODE !== 'production';"
    );
  }

  return next;
}

for (const dir of sourceDirs) {
  for (const file of walk(path.join(root, dir))) {
    const before = readFileSync(file, 'utf8');
    const after = remediateText(before);
    if (after !== before) {
      backup(file);
      writeFileSync(file, after);
      changedFiles.push(path.relative(root, file));
    }
  }
}

const envProdExample = path.join(root, '.env.production.example');
if (!existsSync(envProdExample)) {
  writeFileSync(envProdExample, [
    '# Production environment example',
    'VITE_SUPABASE_URL=',
    'VITE_SUPABASE_ANON_KEY=',
    'VITE_ALLOW_DEMO_DATA=false',
    ''
  ].join('\n'));
} else {
  const content = readFileSync(envProdExample, 'utf8');
  if (!content.includes('VITE_ALLOW_DEMO_DATA')) {
    writeFileSync(envProdExample, content.trimEnd() + '\nVITE_ALLOW_DEMO_DATA=false\n');
  }
}

const report = {
  generated_at: new Date().toISOString(),
  changed_files: changedFiles,
  backups_written: backups,
  env_guard: 'VITE_ALLOW_DEMO_DATA=false is the production default',
  note: 'This remediation removes runtime use of fallback/mock/demo/sample variables in common API/state paths. It does not delete every historical variable name; v60 audit checks runtime blockers.'
};
writeFileSync(path.join(releaseDir, 'v60-remediation-report.json'), JSON.stringify(report, null, 2));
writeFileSync(path.join(releaseDir, 'v60-remediation-report.md'), [
  '# v6.0 No-Mock Runtime Remediation Report',
  '',
  `Generated: ${report.generated_at}`,
  '',
  `Changed files: ${changedFiles.length}`,
  '',
  ...changedFiles.map((f) => `- ${f}`),
  '',
  'Backups were written under `release/v60/backups/`.',
  '',
  'Production default: `VITE_ALLOW_DEMO_DATA=false`.'
].join('\n'));

console.log('v6.0 runtime no-mock remediation complete.');
console.log(JSON.stringify({ changed_files: changedFiles.length, report: 'release/v60/v60-remediation-report.json' }, null, 2));
