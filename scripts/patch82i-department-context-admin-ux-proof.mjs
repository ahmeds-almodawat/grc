import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

let failed = false;

function read(path) {
  return fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';
}

function assert(pass, message) {
  if (pass) {
    console.log(`✅ ${message}`);
  } else {
    failed = true;
    console.log(`❌ ${message}`);
  }
}

const dept = read('src/pages/Departments.tsx');
const ops = read('src/pages/OperationsCenter.tsx');
const ovr = read('src/pages/OvrRiskIndicators.tsx');
const user = read('src/pages/UserManagementCenter.tsx');

const diffFiles = spawnSync('git', ['diff', '--name-only'], { encoding: 'utf8' })
  .stdout
  .split(/\r?\n/)
  .map(item => item.trim())
  .filter(Boolean);

const forbiddenChanged = diffFiles.filter(file =>
  file.startsWith('supabase/migrations/')
  || file.startsWith('supabase/functions/')
  || file === 'src/lib/privilegedAction.ts'
);

const activeProjectsClickable =
  dept.includes('row.active_projects')
  && /handleMetricClick\(\s*["']active["']\s*,\s*row\s*\)/.test(dept)
  && (
    /Active projects/i.test(dept)
    || /active projects/i.test(dept)
  );

assert(forbiddenChanged.length === 0, `No migrations/auth/backend security files changed${forbiddenChanged.length ? `: ${forbiddenChanged.join(', ')}` : ''}`);
assert(dept.includes('grc.departmentContext'), 'Departments writes grc.departmentContext');
assert(activeProjectsClickable, 'Active projects is clickable');
assert(dept.includes('setManageDepartment') || /Manage/i.test(dept), 'Departments has manage action');
assert(ops.includes('grc.departmentContext'), 'Operations reads context');
assert(ops.includes('department-context-banner'), 'Operations has context banner');
assert(ovr.includes('grc.departmentContext'), 'OVR reads context');
assert(ovr.includes('department-context-banner'), 'OVR has context banner');
assert(user.includes('actionMenuUser'), 'User Management uses actionMenuUser modal state');
assert(/Actions for \$\{actionMenuUser/.test(user), 'User Management action modal is titled Actions for <user name>');
assert(!user.includes('getBoundingClientRect'), 'User Management no longer positions the More menu with getBoundingClientRect');
assert(!user.includes('row-more-actions-menu--overlay'), 'User Management no longer renders the floating overlay menu');

if (failed) process.exit(1);
