import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'release/patch45');
const outPath = path.join(outDir, 'patch45-frontend-proof.json');
const files = {
  registry: 'src/lib/runtimeActionRegistry.ts',
  api: 'src/lib/productionReadinessApi.ts',
  page: 'src/pages/ProductionReadinessCenter.tsx',
  packageJson: 'package.json',
};

function read(file) {
  const full = path.join(root, file);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : '';
}

const content = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, read(file)]));
const combined = Object.values(content).join('\n');

const checks = [
  ...Object.values(files).map(file => ({ name: `${file} exists`, passed: fs.existsSync(path.join(root, file)) })),
  { name: 'ProductionReadinessCenter displays runtime action overlay', passed: content.page.includes('runtimeActionReviewTitle') && content.page.includes('getRuntimeActionAuthorizationOverlay') },
  { name: 'ProductionReadinessCenter displays direct browser exceptions', passed: content.page.includes('directBrowserExceptionTitle') && content.page.includes('getRuntimeDirectBrowserRpcExceptions') },
  { name: 'ProductionReadinessCenter displays runtime action register', passed: content.page.includes('runtimeActionRegisterTitle') && content.page.includes('getRuntimeActionReviewRegister') },
  { name: 'productionReadinessApi exposes Patch 45 getters', passed: ['getRuntimeActionAuthorizationOverlay','getRuntimeActionReviewRegister','getRuntimeDirectBrowserRpcExceptions'].every(name => content.api.includes(name)) },
  { name: 'direct browser exception remains visible', passed: content.registry.includes("actionName: 'search_grc_global'") && content.registry.includes('directBrowserException: true') },
  { name: 'patch45 package scripts exist', passed: ['patch45:schema-proof','patch45:workflow-proof','patch45:frontend-proof','patch45:all'].every(script => content.packageJson.includes(script)) },
  { name: 'no service-role secret or direct client exposure', passed: !/(service[_-]?role[_-]?key|VITE_SUPABASE_SERVICE|createClient\([^)]*service[_-]?role)/i.test(`${content.registry}\n${content.api}\n${content.page}`) },
  { name: 'no conflict markers', passed: !/^(<<<<<<<|=======|>>>>>>>)$/m.test(combined) },
  { name: 'no seeded UI rows introduced', passed: !/\b(sampleRows|seedRows|staticRows)\b/.test(`${content.api}\n${content.page}`) },
];

const failed = checks.filter(check => !check.passed);
const result = {
  patch: '45',
  checked_at: new Date().toISOString(),
  strict_passed: failed.length === 0,
  check_count: checks.length,
  failed_count: failed.length,
  failed,
  files,
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
if (!result.strict_passed) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}
console.log(JSON.stringify(result, null, 2));
