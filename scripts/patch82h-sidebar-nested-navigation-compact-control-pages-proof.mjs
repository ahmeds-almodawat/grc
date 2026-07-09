import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const exists = file => fs.existsSync(path.join(root, file));
const checks = [];
function check(name, pass, detail = '') { checks.push({ name, pass: Boolean(pass), detail }); }

const pkg = JSON.parse(read('package.json'));
const main = read('src/main.tsx');
const app = read('src/App.tsx');
const layout = read('src/components/Layout.tsx');
const userCenter = read('src/pages/UserManagementCenter.tsx');
const styles = exists('src/styles.css') ? read('src/styles.css') : '';
const status = read('release/current-platform-status.md');
const proofIndex = read('release/current-proof-command-index.md');
const runbook = read('release/current-validation-runbook.md');
const restoreNoise = read('scripts/restore-generated-release-noise.mjs');
const diffFiles = spawnSync('git', ['diff', '--name-only'], { cwd: root, encoding: 'utf8', shell: false }).stdout
  .split(/\r?\n/)
  .map(item => item.trim())
  .filter(Boolean);
const diffText = spawnSync('git', ['diff', '--', 'supabase/migrations', 'src/auth', 'src/lib/privilegedAction.ts', 'src/pages/LoginPage.tsx', 'supabase/functions'], { cwd: root, encoding: 'utf8', shell: false }).stdout;

check('package.json contains patch82h:proof', pkg.scripts?.['patch82h:proof'] === 'node scripts/patch82h-sidebar-nested-navigation-compact-control-pages-proof.mjs');
check('package.json contains patch82h:all', typeof pkg.scripts?.['patch82h:all'] === 'string' && pkg.scripts['patch82h:all'].includes('validate:build') && pkg.scripts['patch82h:all'].includes('validate:security') && pkg.scripts['patch82h:all'].includes('patch82h:proof'));
check('validate:build exists', Boolean(pkg.scripts?.['validate:build']));
check('validate:security exists', Boolean(pkg.scripts?.['validate:security']));
check('release:restore-noise exists', Boolean(pkg.scripts?.['release:restore-noise']));

check('no Patch 82H migration was added', !fs.existsSync(path.join(root, 'supabase/migrations/122_patch82h_sidebar_nested_navigation_compact_control_pages.sql')));
check('no Supabase migrations added or modified', !diffFiles.some(file => file.startsWith('supabase/migrations/')), diffFiles.filter(file => file.startsWith('supabase/migrations/')).join(', '));
check('forbidden auth/backend files are not modified', !diffFiles.some(file => [
  'src/lib/privilegedAction.ts',
  'src/pages/LoginPage.tsx',
  'supabase/functions/privileged-action/index.ts',
].includes(file)) && !diffFiles.some(file => file.startsWith('src/auth/') && file !== 'src/auth/authAccess.ts'), diffFiles.join(', '));
check('no auth/backend/RLS diff present', diffText.trim().length === 0 || diffText.includes('authAccess.ts'), diffText.slice(0, 500));
check('Layout has nested sidebar navigation tree', layout.includes('navTree') && layout.includes('sidebar-nav-tree') && layout.includes('nav-group-trigger') && layout.includes('nav-child-list'));
check('Layout uses direct clean sidebar labels', (layout.includes("label: 'Workspace'") || layout.includes('label: "Workspace"')) && (layout.includes("label: 'Admin & Organization'") || layout.includes('label: "Admin & Organization"')) && (layout.includes("label: 'User Management'") || layout.includes('label: "User Management"')));
check('Layout no longer renders old primary/quick link sections in sidebar', !layout.includes('allowedPrimaryNav.map') && !layout.includes('allowedQuickLinks.map'));
check('Layout keeps role gating through canAccessPageForUser', layout.includes('canAccessPageForUser') && layout.includes('canOpen'));
const adminNavGroup = /id:\s*['"]admin['"][\s\S]*?children:\s*\[[\s\S]*?\],\s*}/.exec(layout)?.[0] ?? '';
check('Admin sidebar parent opens User Management directly', (adminNavGroup.includes("page: 'admin'") || adminNavGroup.includes('page: "admin"')) && !adminNavGroup.includes("page: 'adminHub'") && !adminNavGroup.includes('page: "adminHub"'), adminNavGroup.slice(0, 500));
check('User Management direct route no longer renders old Control Pages hub wrapper', /case ['"]admin['"]:\s*return <UserManagementCenter \/>;/.test(app));

check('User Management has compact control page header', userCenter.includes('compact-control-page') && userCenter.includes('compact-page-header') && userCenter.includes('compact-breadcrumb'));
check('User Management has compact KPI row', userCenter.includes('compact-kpi-row') && userCenter.includes('reference-kpi-card') && userCenter.includes('kpi-blue') && userCenter.includes('kpi-green') && userCenter.includes('kpi-orange') && userCenter.includes('kpi-purple') && userCenter.includes('kpi-red'));
check('User Management has collapsible compact filters', userCenter.includes('filtersOpen') && userCenter.includes('compact-filters-container') && userCenter.includes('compact-filters-toggle') && userCenter.includes('compact-filters-grid'));
check('User roster keeps View and Edit visible', userCenter.includes('row-primary-action') && />\s*View\s*<\/button>/.test(userCenter) && />\s*Edit\s*<\/button>/.test(userCenter));
check('User roster moves secondary actions into More menu', userCenter.includes('actionMenuUser') && userCenter.includes('Actions for') && userCenter.includes('Assign department') && userCenter.includes('Assign role'));
check('User Management does not render old Control Pages hub elements', ![
  'TabbedHub',
  'hub-page',
  'hub-tab-layout',
  'hub-tab-rail',
  'hub-tab-button',
  'System Control Pages',
  'Control Pages',
].some(token => userCenter.includes(token)));
check('User Management has expanded full-width treatment', userCenter.includes('user-management-center') && styles.includes('PATCH82H2_EXPANDED_USER_MANAGEMENT') && styles.includes('.modern-main-content .user-management-center.compact-control-page'));
check('User Management KPI readability was increased', styles.includes('min-height: 126px') && styles.includes('width: 42px') && styles.includes('font-size: 1.95rem'));
check('User Management table and filters use expanded width', styles.includes('min-width: 1360px') && styles.includes('minmax(260px, 1.7fr)') && styles.includes('width: 218px'));

check('loaded CSS file is imported by app entry', main.includes("import './styles.css';"));
check('loaded CSS file contains Patch 82H marker', styles.includes('PATCH82H_SIDEBAR_COMPACT_CONTROL_PAGES'));
check('sidebar nested classes exist in loaded CSS', ['sidebar-nav-tree', 'nav-group-trigger', 'nav-child-item', 'nav-child-list'].every(token => styles.includes(token)));
check('default white-button sidebar styling is overridden', styles.includes('.sidebar-nav-tree button') && styles.includes('appearance: none') && styles.includes('background: transparent'));
check('unused Patch 82H root CSS drop-in removed', !exists('PATCH82H_STYLES_APPEND.css'));
check('Patch 82H docs exist', exists('release/patch82h/patch82h-sidebar-nested-navigation-compact-control-pages-summary.md') && exists('release/patch82h/patch82h-validation-report.md'));
check('current platform status mentions Patch 82H', status.includes('Patch 82H'));
check('proof command index mentions Patch 82H', proofIndex.includes('patch82h:all') && proofIndex.includes('patch82h:proof'));
check('validation runbook mentions Patch 82H', runbook.includes('Patch 82H') && runbook.includes('patch82h:proof'));
check('restore-noise covers previous Patch 82G proof JSON', restoreNoise.includes('release/patch82g/patch82g-privileged-action-jwt-compatibility-proof.json'));

const forbiddenPhrases = [
  'system is production ready',
  'go-live complete',
  'production launched',
  'transition_to_live_operations',
];
const combined = [layout, userCenter, status, proofIndex, runbook].join('\n').toLowerCase();
for (const phrase of forbiddenPhrases) {
  check(`forbidden phrase absent: ${phrase}`, !combined.includes(phrase));
}

const conflictFiles = [
  'src/components/Layout.tsx',
  'src/pages/UserManagementCenter.tsx',
  'src/styles.css',
  'package.json',
  'release/current-platform-status.md',
  'release/current-proof-command-index.md',
  'release/current-validation-runbook.md',
];
for (const file of conflictFiles) {
  if (exists(file)) check(`no conflict markers in ${file}`, !/^(<<<<<<<|=======|>>>>>>>)$/m.test(read(file)));
}

const passed = checks.filter(item => item.pass).length;
const failed = checks.filter(item => !item.pass);
const output = {
  patch: '82H',
  title: 'Sidebar Nested Navigation and Compact Control Pages',
  generated_at: new Date().toISOString(),
  passed,
  failed: failed.length,
  checks,
};

const outFile = path.join(root, 'release/patch82h/patch82h-sidebar-nested-navigation-compact-control-pages-proof.json');
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(output, null, 2) + '\n');

if (failed.length) {
  console.error(JSON.stringify(output, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(output, null, 2));
