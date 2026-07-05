import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'release/patch68');
const outPath = path.join(outDir, 'patch68-frontend-proof.json');

const pagePath = path.join(root, 'src/pages/ProductionEvidenceClosureCenter.tsx');
const apiPath = path.join(root, 'src/lib/productionEvidenceClosureApi.ts');
const registryPath = path.join(root, 'src/lib/runtimeActionRegistry.ts');

const pageSource = fs.existsSync(pagePath) ? fs.readFileSync(pagePath, 'utf8') : '';
const apiSource = fs.existsSync(apiPath) ? fs.readFileSync(apiPath, 'utf8') : '';
const registrySource = fs.existsSync(registryPath) ? fs.readFileSync(registryPath, 'utf8') : '';

const checks = [
  { name: 'UI: ProductionEvidenceClosureCenter exists', passed: fs.existsSync(pagePath) },
  { name: 'UI: API import exists', passed: pageSource.includes('recordExecutiveProductionSignoff') },
  { name: 'UI: Button text exists', passed: pageSource.includes('Authorize Production Launch') },
  { name: 'UI: Success alert state exists', passed: pageSource.includes('Production Launch Authorized') },
  { name: 'UI: Input notes area exists', passed: pageSource.includes('Enter executive authorization notes') },
  { name: 'API: function exported', passed: apiSource.includes('export async function recordExecutiveProductionSignoff') },
  { name: 'API: uses privilege action', passed: apiSource.includes("invokePrivilegedAction<any>('record_executive_production_signoff'") },
  { name: 'API: currentSignoffState returned', passed: apiSource.includes('currentSignoffState = \'Approved\'') || apiSource.includes('currentSignoffState: string') },
  { name: 'Registry: action mapped', passed: registrySource.includes("actionName: 'record_executive_production_signoff'") },
];

const failed = checks.filter(check => !check.passed);
const result = {
  patch: '68',
  checked_at: new Date().toISOString(),
  strict_passed: failed.length === 0,
  failed_count: failed.length,
  checks,
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));

if (failed.length > 0) {
  console.error('\n❌ patch68 frontend proof failed:');
  failed.forEach(f => console.error(`  - ${f.name}`));
  process.exit(1);
}

console.log(`\n✅ patch68 frontend proof passed. (${checks.length} checks)`);
