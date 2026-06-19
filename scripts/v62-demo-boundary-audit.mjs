import fs from 'node:fs';
import path from 'node:path';

const args = new Set(process.argv.slice(2));
const strict = args.has('--strict');
const releaseDir = path.resolve('release', 'v62');
fs.mkdirSync(releaseDir, { recursive: true });

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'dist', 'release', '.git'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|js|jsx|mjs|md|json|env|example)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const sourceFiles = walk(path.resolve('src'));
const findings = [];
for (const file of sourceFiles) {
  const rel = path.relative(process.cwd(), file).replaceAll('\\', '/');
  const text = fs.readFileSync(file, 'utf8');
  if (!rel.startsWith('src/demo/') && /from\s+['\"][^'\"]*demo[\/]/.test(text)) {
    findings.push({ severity: 'critical', code: 'DEMO_IMPORT_OUTSIDE_SRC_DEMO', file: rel });
  }
  if (!rel.startsWith('src/demo/') && /VITE_ALLOW_DEMO_DATA/.test(text) && !/demoMode\.ts$/.test(rel)) {
    findings.push({ severity: 'high', code: 'DEMO_ENV_USED_OUTSIDE_DEMO_MODE_HELPER', file: rel });
  }
}

const productionEnvPath = path.resolve('.env.production.example');
let productionEnvSafe = false;
if (fs.existsSync(productionEnvPath)) {
  const text = fs.readFileSync(productionEnvPath, 'utf8');
  productionEnvSafe = /VITE_ALLOW_DEMO_DATA\s*=\s*false/.test(text);
} else {
  findings.push({ severity: 'medium', code: 'MISSING_ENV_PRODUCTION_EXAMPLE', file: '.env.production.example' });
}

const blocking = findings.filter((f) => ['critical', 'high'].includes(f.severity));
const summary = {
  generated_at: new Date().toISOString(),
  demo_folder_exists: fs.existsSync(path.resolve('src', 'demo')),
  production_env_example_safe: productionEnvSafe,
  total_findings: findings.length,
  production_blocking_findings: blocking.length,
  policy: 'Demo fixtures must be isolated to src/demo and cannot be imported into production runtime modules.'
};
fs.writeFileSync(path.join(releaseDir, 'v62-demo-boundary-audit.json'), JSON.stringify({ ...summary, findings }, null, 2) + '\n');
console.log('v6.2 demo boundary audit complete.');
console.log(JSON.stringify(summary, null, 2));
if (strict && blocking.length > 0) process.exit(2);
