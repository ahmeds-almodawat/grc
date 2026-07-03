import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pagePath = path.join(root, 'src/pages/ProductionReadinessCenter.tsx');
const apiPath = path.join(root, 'src/lib/productionReadinessApi.ts');
const packagePath = path.join(root, 'package.json');
const outDir = path.join(root, 'release/patch46');
const outPath = path.join(outDir, 'patch46-frontend-proof.json');
const page = fs.existsSync(pagePath) ? fs.readFileSync(pagePath, 'utf8') : '';
const api = fs.existsSync(apiPath) ? fs.readFileSync(apiPath, 'utf8') : '';
const pkg = fs.existsSync(packagePath) ? fs.readFileSync(packagePath, 'utf8') : '';
const combined = `${page}\n${api}\n${pkg}`;
const lower = combined.toLowerCase();

const checks = [
  { name: 'ProductionReadinessCenter displays access-review closure overlay', passed: page.includes('runtimeAccessReviewTitle') && page.includes('accessReviewReadinessStatus') },
  { name: 'pending/overdue/rejected/approved-with-limitation states visible', passed: ['pendingSignoffs', 'overdueSignoffs', 'rejectedSignoffs', 'approvedWithLimitationSignoffs'].every(token => page.includes(token)) },
  { name: 'direct browser RPC exception remains visible', passed: page.includes('directBrowserExceptionTitle') && page.includes('directBrowserExceptionReview') },
  { name: 'API reads Patch 46 views', passed: ['v_patch46_production_readiness_access_review_overlay', 'v_patch46_runtime_access_review_register', 'v_patch46_runtime_access_review_blockers'].every(token => api.includes(token)) },
  { name: 'API treats missing signoffs as pending review', passed: api.includes("signoff_status: 'pending'") && api.includes("access_review_readiness_status: 'pending_review'") },
  { name: 'package scripts exist', passed: ['patch46:schema-proof', 'patch46:workflow-proof', 'patch46:frontend-proof', 'patch46:all'].every(token => pkg.includes(token)) },
  { name: 'patch45:all remains in patch46:all', passed: pkg.includes('npm run patch45:all') },
  { name: 'v700 runtime security remains in patch46:all', passed: pkg.includes('npm run v700:runtime-security') },
  { name: 'no service-role-only frontend exposure introduced', passed: !/service[_-]?role[_-]?key|supabase_service_role|service_role_secret/i.test(combined) },
  { name: 'no fake/demo data strings introduced in Patch 46 frontend/API', passed: !/\b(fake|demo|mock)\b/i.test(`${page}\n${api}`) },
  { name: 'no conflict markers', passed: !/^(<<<<<<<|=======|>>>>>>>)$/m.test(combined) },
];

const failed = checks.filter(check => !check.passed);
const result = {
  patch: '46',
  checked_at: new Date().toISOString(),
  strict_passed: failed.length === 0,
  check_count: checks.length,
  failed_count: failed.length,
  failed,
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
if (!result.strict_passed) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}
console.log(JSON.stringify(result, null, 2));
