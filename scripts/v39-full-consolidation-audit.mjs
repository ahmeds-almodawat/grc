import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const releaseDir = path.join(root, 'release');
fs.mkdirSync(releaseDir, { recursive: true });

const exists = (p) => fs.existsSync(path.join(root, p));
const walk = (dir, filter = () => true) => {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) return [];
  const out = [];
  const visit = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (filter(full)) out.push(path.relative(root, full).replaceAll('\\\\', '/').replaceAll('\\', '/'));
    }
  };
  visit(abs);
  return out.sort();
};

const migrations = walk('supabase/migrations', (f) => f.endsWith('.sql'));
const scripts = walk('scripts', (f) => f.endsWith('.mjs') || f.endsWith('.js'));
const docs = walk('docs', (f) => f.endsWith('.md'));
const pages = walk('src/pages', (f) => f.endsWith('.tsx') || f.endsWith('.ts'));
const libs = walk('src/lib', (f) => f.endsWith('.ts') || f.endsWith('.tsx'));

const requiredFiles = [
  'package.json', 'src/App.tsx', 'src/components/Layout.tsx', 'src/i18n/I18nContext.tsx',
  'src/lib/supabase.ts', 'src/lib/supabaseClient.ts', 'vite.config.ts'
];

const missingRequiredFiles = requiredFiles.filter((file) => !exists(file));

const duplicateMigrationNumbers = (() => {
  const byPrefix = new Map();
  for (const file of migrations) {
    const base = path.basename(file);
    const match = base.match(/^(\d{3})/);
    if (!match) continue;
    const arr = byPrefix.get(match[1]) || [];
    arr.push(file);
    byPrefix.set(match[1], arr);
  }
  return [...byPrefix.entries()].filter(([, files]) => files.length > 1).map(([prefix, files]) => ({ prefix, files }));
})();

const routeAudit = (() => {
  const appPath = path.join(root, 'src/App.tsx');
  if (!fs.existsSync(appPath)) return { routes: [], duplicateRoutes: [], note: 'src/App.tsx not found' };
  const text = fs.readFileSync(appPath, 'utf8');
  const routeMatches = [...text.matchAll(/case\s+['"]([^'"]+)['"]|path\s*[:=]\s*['"]([^'"]+)['"]|id\s*[:=]\s*['"]([^'"]+)['"]/g)]
    .map((m) => m[1] || m[2] || m[3])
    .filter(Boolean)
    .filter((v) => v.includes('/') || /^[a-z0-9-]+$/i.test(v));
  const seen = new Map();
  for (const r of routeMatches) seen.set(r, (seen.get(r) || 0) + 1);
  return {
    routes: [...seen.keys()].sort(),
    duplicateRoutes: [...seen.entries()].filter(([, count]) => count > 1).map(([route, count]) => ({ route, count }))
  };
})();

const deadRiskSignals = [];
if (!exists('src/lib/pilotOpsApi.ts')) deadRiskSignals.push('Pilot operations API missing.');
if (!exists('src/pages/PilotOperationsCenter.tsx')) deadRiskSignals.push('Pilot Operations Center page missing.');
if (!exists('scripts/v38-local-doctor.mjs')) deadRiskSignals.push('v3.8 local doctor missing.');
if (!exists('scripts/v35-consolidation-audit.mjs')) deadRiskSignals.push('v3.5 consolidation audit missing.');

const report = {
  generated_at: new Date().toISOString(),
  status: missingRequiredFiles.length || duplicateMigrationNumbers.length ? 'needs_attention' : 'pass_with_observations',
  counts: {
    migrations: migrations.length,
    scripts: scripts.length,
    docs: docs.length,
    pages: pages.length,
    lib_files: libs.length
  },
  missing_required_files: missingRequiredFiles,
  duplicate_migration_numbers: duplicateMigrationNumbers,
  route_audit: routeAudit,
  dead_risk_signals: deadRiskSignals,
  next_actions: [
    'Fix missing required files before staging.',
    'Resolve duplicate migration prefixes if any exist.',
    'Keep old routes hidden rather than deleted until pilot is complete.',
    'Run npm run typecheck and npm run build after applying each patch.'
  ]
};

const jsonPath = path.join(releaseDir, 'v39-consolidation-audit.json');
const mdPath = path.join(releaseDir, 'v39-consolidation-audit.md');
fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
fs.writeFileSync(mdPath, `# v3.9 Full Consolidation Audit\n\nGenerated: ${report.generated_at}\n\nStatus: **${report.status}**\n\n## Counts\n\n- Migrations: ${report.counts.migrations}\n- Scripts: ${report.counts.scripts}\n- Docs: ${report.counts.docs}\n- Pages: ${report.counts.pages}\n- Lib files: ${report.counts.lib_files}\n\n## Missing Required Files\n\n${report.missing_required_files.length ? report.missing_required_files.map((x) => `- ${x}`).join('\n') : 'None'}\n\n## Duplicate Migration Prefixes\n\n${report.duplicate_migration_numbers.length ? report.duplicate_migration_numbers.map((x) => `- ${x.prefix}: ${x.files.join(', ')}`).join('\n') : 'None'}\n\n## Dead Risk Signals\n\n${report.dead_risk_signals.length ? report.dead_risk_signals.map((x) => `- ${x}`).join('\n') : 'None'}\n\n## Next Actions\n\n${report.next_actions.map((x) => `- ${x}`).join('\n')}\n`);
console.log(`v3.9 consolidation audit generated: ${path.relative(root, jsonPath)}`);
if (report.status === 'needs_attention') process.exitCode = 1;
