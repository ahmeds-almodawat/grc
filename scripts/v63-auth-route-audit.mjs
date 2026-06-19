import fs from 'node:fs';
import path from 'node:path';

const requiredFiles = [
  'src/auth/AuthProvider.tsx',
  'src/auth/authAccess.ts',
  'src/auth/authTypes.ts',
  'src/pages/LoginPage.tsx',
  'src/pages/UnauthorizedPage.tsx',
  'supabase/migrations/041_v63_auth_route_protection.sql',
];

const checks = requiredFiles.map(file => ({
  file,
  exists: fs.existsSync(file),
}));

const app = fs.existsSync('src/App.tsx') ? fs.readFileSync('src/App.tsx', 'utf8') : '';
const layout = fs.existsSync('src/components/Layout.tsx') ? fs.readFileSync('src/components/Layout.tsx', 'utf8') : '';
const main = fs.existsSync('src/main.tsx') ? fs.readFileSync('src/main.tsx', 'utf8') : '';

const signals = [
  { code: 'AUTH_PROVIDER_WRAPPED', passed: main.includes('<AuthProvider>') },
  { code: 'LOGIN_PAGE_GATE', passed: app.includes('<LoginPage />') && app.includes("auth.status !== 'authenticated'") },
  { code: 'PAGE_ACCESS_GUARD', passed: app.includes('canAccessPage(page, auth.roles)') },
  { code: 'ROLE_NAV_FILTER', passed: layout.includes('allowedPrimaryNav') && layout.includes('canAccessPage') },
  { code: 'SIGN_OUT_VISIBLE', passed: layout.includes('auth.signOut') },
  { code: 'LOCAL_BYPASS_DEV_ONLY', passed: fs.readFileSync('src/auth/AuthProvider.tsx', 'utf8').includes('import.meta.env.DEV') },
];

const failed = [...checks.filter(check => !check.exists), ...signals.filter(signal => !signal.passed)];

fs.mkdirSync(path.join('release', 'v63'), { recursive: true });
fs.writeFileSync(path.join('release', 'v63', 'v63-auth-route-audit.json'), JSON.stringify({
  generated_at: new Date().toISOString(),
  required_files: checks,
  signals,
  passed: failed.length === 0,
}, null, 2));

console.log('v6.3 auth and route protection audit complete.');
console.table(signals);
if (failed.length > 0) {
  console.error(`v6.3 audit failed: ${failed.length} issue(s).`);
  process.exit(1);
}
