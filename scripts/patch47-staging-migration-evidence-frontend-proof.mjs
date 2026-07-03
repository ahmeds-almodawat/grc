import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pagePath = path.join(root, 'src/pages/ProductionReadinessCenter.tsx');
const apiPath = path.join(root, 'src/lib/productionReadinessApi.ts');
const packagePath = path.join(root, 'package.json');
const outDir = path.join(root, 'release/patch47');
const outPath = path.join(outDir, 'patch47-frontend-proof.json');
const page = fs.existsSync(pagePath) ? fs.readFileSync(pagePath, 'utf8') : '';
const api = fs.existsSync(apiPath) ? fs.readFileSync(apiPath, 'utf8') : '';
const pkg = fs.existsSync(packagePath) ? fs.readFileSync(packagePath, 'utf8') : '';

const checks = [
  { name: 'ProductionReadinessCenter displays staging/persona evidence overlay', passed: page.includes('stagingEvidenceTitle') && page.includes('stagingEvidenceReadiness') },
  { name: 'migration/persona/security/restore statuses visible', passed: ['migrationsReplayed', 'personaSqlStatus', 'securityProofStatus', 'restoreDryRun'].every(token => page.includes(token)) },
  { name: 'blockers and evidence required visible', passed: page.includes('stagingBlockersTitle') && page.includes('evidenceRequired') },
  { name: 'API reads Patch 47 views', passed: ['v_patch47_production_readiness_staging_overlay', 'v_patch47_staging_security_blockers'].every(token => api.includes(token)) },
  { name: 'API treats missing staging evidence as evidence_required', passed: api.includes("staging_evidence_readiness_status: 'evidence_required'") && api.includes("latest_run_status: 'evidence_required'") },
  { name: 'package scripts exist', passed: ['patch47:schema-proof', 'patch47:workflow-proof', 'patch47:frontend-proof', 'patch47:evidence-runner', 'patch47:all'].every(token => pkg.includes(token)) },
  { name: 'patch46:all remains in patch47:all', passed: pkg.includes('npm run patch46:all') },
  { name: 'v700 runtime security remains in patch47:all', passed: pkg.includes('npm run v700:runtime-security') },
  { name: 'no service-role-only frontend exposure introduced', passed: !/service[_-]?role[_-]?key|supabase_service_role|service_role_secret/i.test(`${page}\n${api}`) },
  { name: 'no fake/demo data strings introduced in Patch 47 frontend/API', passed: !/\b(fake|demo|mock)\b/i.test(`${page}\n${api}`) },
  { name: 'no conflict markers', passed: !/^(<<<<<<<|=======|>>>>>>>)$/m.test(`${page}\n${api}\n${pkg}`) },
];

const failed = checks.filter(check => !check.passed);
const result = { patch: '47', checked_at: new Date().toISOString(), strict_passed: failed.length === 0, check_count: checks.length, failed_count: failed.length, failed };
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
if (!result.strict_passed) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}
console.log(JSON.stringify(result, null, 2));
