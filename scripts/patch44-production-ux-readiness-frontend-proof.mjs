import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const repoRoot = process.cwd();
const outDir = path.join(repoRoot, 'release/patch44');
const outPath = path.join(outDir, 'patch44-frontend-proof.json');

const appTsx = fs.existsSync(path.join(repoRoot, 'src/App.tsx')) ? fs.readFileSync(path.join(repoRoot, 'src/App.tsx'), 'utf8') : '';
const layoutTsx = fs.existsSync(path.join(repoRoot, 'src/components/Layout.tsx')) ? fs.readFileSync(path.join(repoRoot, 'src/components/Layout.tsx'), 'utf8') : '';
const authAccessTs = fs.existsSync(path.join(repoRoot, 'src/auth/authAccess.ts')) ? fs.readFileSync(path.join(repoRoot, 'src/auth/authAccess.ts'), 'utf8') : '';
const readinessCenterTsx = fs.existsSync(path.join(repoRoot, 'src/pages/ProductionReadinessCenter.tsx')) ? fs.readFileSync(path.join(repoRoot, 'src/pages/ProductionReadinessCenter.tsx'), 'utf8') : '';

const checks = [
  { name: 'DailyOperationsHub present in App.tsx', passed: appTsx.includes('DailyOperationsHub') },
  { name: 'AccreditationHub present in App.tsx', passed: appTsx.includes('AccreditationHub') },
  { name: 'EvidenceDocumentsHub present in App.tsx', passed: appTsx.includes('EvidenceDocumentsHub') },
  { name: 'Hub navigation in Layout.tsx updated', passed: layoutTsx.includes('dailyOperationsHub') && layoutTsx.includes('accreditationHub') },
  { name: 'authAccess.ts uses PageGroup mapping', passed: authAccessTs.includes('dailyOperationsHub: \'work\'') },
  { name: 'authAccess.ts firstAllowedPage logic updated', passed: authAccessTs.includes('canAccessPageForUser(\'dailyOperationsHub\'') },
  { name: 'ProductionReadinessCenter.tsx renders approved_reviews', passed: readinessCenterTsx.includes('gonogoData.approved_reviews') },
  { name: 'ProductionReadinessCenter.tsx renders blocking_issues', passed: readinessCenterTsx.includes('gonogoData.blocking_issues') },
];

const failed = checks.filter(check => !check.passed);
const result = {
  patch: '44',
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
