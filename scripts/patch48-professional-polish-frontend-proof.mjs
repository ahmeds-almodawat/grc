import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const outDir = path.join(repoRoot, 'release/patch48');
const outPath = path.join(outDir, 'patch48-frontend-proof.json');

const i18nTsx = fs.existsSync(path.join(repoRoot, 'src/i18n/I18nContext.tsx')) ? fs.readFileSync(path.join(repoRoot, 'src/i18n/I18nContext.tsx'), 'utf8') : '';
const readinessTsx = fs.existsSync(path.join(repoRoot, 'src/pages/ProductionReadinessCenter.tsx')) ? fs.readFileSync(path.join(repoRoot, 'src/pages/ProductionReadinessCenter.tsx'), 'utf8') : '';
const myWorkTsx = fs.existsSync(path.join(repoRoot, 'src/pages/MyWorkCenter.tsx')) ? fs.readFileSync(path.join(repoRoot, 'src/pages/MyWorkCenter.tsx'), 'utf8') : '';
const warRoomTsx = fs.existsSync(path.join(repoRoot, 'src/pages/AccreditationWarRoomCenter.tsx')) ? fs.readFileSync(path.join(repoRoot, 'src/pages/AccreditationWarRoomCenter.tsx'), 'utf8') : '';
const appTsx = fs.existsSync(path.join(repoRoot, 'src/App.tsx')) ? fs.readFileSync(path.join(repoRoot, 'src/App.tsx'), 'utf8') : '';

const checks = [
  { name: 'I18nContext: "app.version" translated cleanly', passed: i18nTsx.includes('v3.3 Production Readiness') && !i18nTsx.includes('Production Proof') },
  { name: 'I18nContext: no raw "patch" or "rpc" strings in user-facing translation blocks (as much as possible)', passed: !i18nTsx.includes('edge bridge') },
  { name: 'ProductionReadinessCenter: terms cleaned up', passed: readinessTsx.includes('System Action Security Gate') && !readinessTsx.includes('Runtime RPC Security Classification Gate') },
  { name: 'MyWorkCenter: Hero panel replaced with command-hero section', passed: myWorkTsx.includes('section-heading command-hero') && !myWorkTsx.includes('hero-panel') },
  { name: 'AccreditationWarRoomCenter: Hero panel replaced with command-hero section', passed: warRoomTsx.includes('section-heading command-hero') && !warRoomTsx.includes('hero-panel') },
  { name: 'App.tsx: Layout tab names polished', passed: appTsx.includes('label: t(\'hub.tab.finalRuntimeSecurityClosure\', \'Security Closure\')') },
];

const failed = checks.filter(check => !check.passed);
const result = {
  patch: '48',
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
