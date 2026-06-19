import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'release', 'v65');
fs.mkdirSync(outDir, { recursive: true });

function read(rel) {
  const file = path.join(root, rel);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

const app = read('src/App.tsx');
const layout = read('src/components/Layout.tsx');
const authProvider = read('src/auth/AuthProvider.tsx');
const authAccess = read('src/auth/authAccess.ts');
const login = read('src/pages/LoginPage.tsx');
const unauthorized = read('src/pages/UnauthorizedPage.tsx');
const envProd = read('.env.production.example');

const checks = [
  { code: 'AUTH_PROVIDER_FILE', passed: Boolean(authProvider), message: 'AuthProvider.tsx exists.' },
  { code: 'AUTH_PROVIDER_USED', passed: /AuthProvider/.test(app) || /useAuth\(/.test(app), message: 'App uses AuthProvider or auth context.' },
  { code: 'LOGIN_PAGE_FILE', passed: Boolean(login), message: 'LoginPage.tsx exists.' },
  { code: 'UNAUTHORIZED_PAGE_FILE', passed: Boolean(unauthorized), message: 'UnauthorizedPage.tsx exists.' },
  { code: 'ROLE_ACCESS_HELPER', passed: /canAccess|hasRouteAccess|allowedRoles|role/i.test(authAccess), message: 'Role/route access helper exists.' },
  { code: 'LAYOUT_AUTH_AWARE', passed: /useAuth|logout|signOut|currentRole|profile|role/i.test(layout), message: 'Layout appears auth-aware.' },
  { code: 'PROD_BYPASS_DISABLED', passed: /VITE_AUTH_BYPASS_LOCAL\s*=\s*false/.test(envProd), message: 'Production auth bypass is disabled in env example.' }
];

const failed = checks.filter((c) => !c.passed);
const summary = {
  generated_at: new Date().toISOString(),
  checks_total: checks.length,
  failed_count: failed.length,
  strict_passed: failed.length === 0,
  note: 'Static auth smoke only. Full proof still requires browser tests with real session/personas.'
};

fs.writeFileSync(path.join(outDir, 'v65-auth-security-smoke.json'), JSON.stringify({ summary, checks }, null, 2));
fs.writeFileSync(path.join(outDir, 'V65_AUTH_SECURITY_SMOKE.md'), `# v6.5 Auth Security Smoke\n\n\`\`\`json\n${JSON.stringify(summary, null, 2)}\n\`\`\`\n\n## Checks\n\n${checks.map((c) => `- ${c.passed ? '✅' : '❌'} ${c.code}: ${c.message}`).join('\n')}\n`);

console.log('v6.5 auth security smoke complete.');
console.log(JSON.stringify(summary, null, 2));
if (!summary.strict_passed) process.exit(1);
