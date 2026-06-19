import fs from 'fs';
import path from 'path';

const root = process.cwd();
const rel = (p) => path.join(root, p);
const exists = (p) => fs.existsSync(rel(p));
const readJson = (p, fallback = null) => {
  try { return JSON.parse(fs.readFileSync(rel(p), 'utf8')); } catch { return fallback; }
};
const fileSize = (p) => {
  try { return fs.statSync(p).size; } catch { return 0; }
};
const listFiles = (dir, predicate = () => true) => {
  const full = rel(dir);
  if (!fs.existsSync(full)) return [];
  const out = [];
  const walk = (d) => {
    for (const item of fs.readdirSync(d, { withFileTypes: true })) {
      const fp = path.join(d, item.name);
      if (item.isDirectory()) walk(fp);
      else if (predicate(fp)) out.push(fp);
    }
  };
  walk(full);
  return out;
};

const pkg = readJson('package.json', {});
const srcFiles = listFiles('src', (fp) => /\.(ts|tsx|js|jsx)$/.test(fp));
const pageFiles = listFiles('src/pages', (fp) => /\.(tsx|ts)$/.test(fp));
const migrationFiles = listFiles('supabase/migrations', (fp) => fp.endsWith('.sql'));
const jsAssets = listFiles('dist/assets', (fp) => fp.endsWith('.js'));
const cssAssets = listFiles('dist/assets', (fp) => fp.endsWith('.css'));
const totalJsBytes = jsAssets.reduce((sum, fp) => sum + fileSize(fp), 0);
const totalCssBytes = cssAssets.reduce((sum, fp) => sum + fileSize(fp), 0);

const checks = [
  { id: 'package_json', label: 'package.json exists', ok: exists('package.json') },
  { id: 'src_app', label: 'src/App.tsx exists', ok: exists('src/App.tsx') },
  { id: 'src_styles', label: 'src/styles.css exists', ok: exists('src/styles.css') },
  { id: 'supabase_migrations', label: 'Supabase migrations folder exists', ok: exists('supabase/migrations') },
  { id: 'dist_exists', label: 'dist folder exists after build', ok: exists('dist') },
  { id: 'typescript_sources', label: 'TypeScript source files detected', ok: srcFiles.length > 0 },
  { id: 'pages_detected', label: 'Pages detected', ok: pageFiles.length > 0 },
  { id: 'migrations_detected', label: 'SQL migrations detected', ok: migrationFiles.length > 0 },
  { id: 'bundle_generated', label: 'Production JS assets generated', ok: jsAssets.length > 0 }
];

const warnings = [];
if (totalJsBytes > 1_500_000) warnings.push('Total JS bundle size is high. Keep route lazy loading enabled and consider deeper code splitting.');
if (migrationFiles.length < 30) warnings.push('Migration count is lower than expected after v3.x patches. Verify all patch migrations were copied.');
if (!pkg?.scripts?.typecheck) warnings.push('Missing npm script: typecheck.');
if (!pkg?.scripts?.build) warnings.push('Missing npm script: build.');

const passed = checks.filter((c) => c.ok).length;
const score = Math.round((passed / checks.length) * 100);
const report = {
  generated_at: new Date().toISOString(),
  project: pkg?.name || 'unknown',
  version: pkg?.version || 'unknown',
  score,
  counts: {
    source_files: srcFiles.length,
    page_files: pageFiles.length,
    migration_files: migrationFiles.length,
    js_assets: jsAssets.length,
    css_assets: cssAssets.length,
    total_js_kb: Math.round(totalJsBytes / 1024),
    total_css_kb: Math.round(totalCssBytes / 1024)
  },
  checks,
  warnings
};

fs.mkdirSync(rel('release'), { recursive: true });
fs.writeFileSync(rel('release/v38-local-doctor-report.json'), JSON.stringify(report, null, 2));

console.log('\nGRC v3.8 Local Doctor');
console.log('---------------------');
console.log(`Score: ${score}%`);
console.log(`Source files: ${report.counts.source_files}`);
console.log(`Page files: ${report.counts.page_files}`);
console.log(`Migration files: ${report.counts.migration_files}`);
console.log(`JS bundle: ${report.counts.total_js_kb} KB`);
console.log(`CSS bundle: ${report.counts.total_css_kb} KB`);
for (const c of checks) console.log(`${c.ok ? 'OK ' : 'BAD'} ${c.label}`);
if (warnings.length) {
  console.log('\nWarnings:');
  for (const w of warnings) console.log(`- ${w}`);
}
console.log('\nReport written: release/v38-local-doctor-report.json');
process.exit(checks.some((c) => !c.ok && ['package_json', 'src_app'].includes(c.id)) ? 1 : 0);
