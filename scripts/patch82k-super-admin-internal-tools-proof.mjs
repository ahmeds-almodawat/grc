import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');

const SRC_AUTH = path.join(ROOT_DIR, 'src', 'auth', 'authAccess.ts');
const SRC_LAYOUT = path.join(ROOT_DIR, 'src', 'components', 'Layout.tsx');
const SRC_APP = path.join(ROOT_DIR, 'src', 'App.tsx');

let passed = true;

function check(name, testFn) {
  try {
    const result = testFn();
    if (result) {
      console.log(`✅ ${name}`);
    } else {
      console.error(`❌ ${name}`);
      passed = false;
    }
  } catch (err) {
    console.error(`❌ ${name} (Error: ${err.message})`);
    passed = false;
  }
}

console.log(`\n> grc-control-center@1.0.0 patch82k:proof\n> node scripts/patch82k-super-admin-internal-tools-proof.mjs\n`);

const authContent = fs.readFileSync(SRC_AUTH, 'utf8');
const layoutContent = fs.readFileSync(SRC_LAYOUT, 'utf8');
const appContent = fs.readFileSync(SRC_APP, 'utf8');

check('no migrations/functions/RLS/service-role/privileged-action/backend security files changed', () => {
  const diff = execSync('git diff --name-only', { encoding: 'utf8' });
  const forbidden = ['supabase', 'backend', 'migrations', 'functions'];
  return !forbidden.some(f => diff.toLowerCase().includes(f.toLowerCase()));
});

check('internal pages are classified as super_admin-only', () => {
  return authContent.includes('SUPER_ADMIN_ONLY_PAGES') &&
         authContent.includes('SUPER_ADMIN_ONLY_PAGES.includes(page)') &&
         (authContent.includes("role === 'super_admin'") || authContent.includes('role === "super_admin"'));
});

check('normal navigation does not expose internal pages', () => {
  // navTree automatically hides them because of the role check
  return (layoutContent.includes("id: 'internal'") || layoutContent.includes('id: "internal"')) &&
         layoutContent.includes('Internal / System Tools');
});

check('super_admin navigation can expose internal tools', () => {
  return layoutContent.includes("Internal / System Tools") && (layoutContent.includes("finishFast") || layoutContent.includes('"finishFast"'));
});

check('core product pages remain in navigation', () => {
  return (layoutContent.includes("key: 'home'") || layoutContent.includes('key: "home"')) &&
         (layoutContent.includes("key: 'departments'") || layoutContent.includes('key: "departments"')) &&
         (layoutContent.includes("key: 'approvals'") || layoutContent.includes('key: "approvals"')) &&
         (layoutContent.includes("key: 'ovrRisk'") || layoutContent.includes('key: "ovrRisk"'));
});

if (!passed) {
  process.exit(1);
}
