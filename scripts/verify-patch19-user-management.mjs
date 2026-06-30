import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = process.cwd();

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function exists(relPath) {
  const absolute = path.join(root, relPath);
  if (!fs.existsSync(absolute)) {
    throw new Error(`Missing required Patch 19 file: ${relPath}`);
  }
  console.log(`OK: ${relPath}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`OK: ${message}`);
}

const migrationPath = 'supabase/migrations/080_patch19_professional_user_management_center.sql';
const pagePath = 'src/pages/UserManagementCenter.tsx';
const apiPath = 'src/lib/userManagementApi.ts';
const appPath = 'src/App.tsx';
const authProviderPath = 'src/auth/AuthProvider.tsx';

exists(migrationPath);
exists(pagePath);
exists(apiPath);
exists(authProviderPath);

const migration = read(migrationPath);
const page = read(pagePath);
const api = read(apiPath);
const app = read(appPath);
const authProvider = read(authProviderPath);

assert(app.includes("import { UserManagementCenter } from './pages/UserManagementCenter';"), 'App.tsx imports UserManagementCenter');
assert(app.includes("id: 'userManagement'") && app.includes('User Management') && app.includes('<UserManagementCenter />'), 'Admin Hub has User Management tab');

assert(authProvider.includes('PROFILE_SELECT_LEGACY') && authProvider.includes('isMissingPatch19StatusColumn'), 'AuthProvider retries legacy profile query when Patch 19 status column is missing');
assert(authProvider.includes('normalizePatch19UserStatus') && /return\s+isKnownAuthUserStatus\(value\)\s*\?\s*value\s*:\s*'active'/s.test(authProvider), 'AuthProvider defaults missing/null/unknown Patch 19 status to active');
assert(authProvider.includes('Recovery note: Patch 19 status is additive'), 'AuthProvider documents Patch 19 status recovery default');
assert(!/status:\s*'inactive'/.test(authProvider), 'AuthProvider does not deny login with inactive auth status for Patch 19 lifecycle state');
assert(/set\s+user_status\s*=\s*'active'[\s\S]+where\s+user_status\s+is\s+null/i.test(migration), 'Patch 19 migration backfills null user_status to active');
assert(!/case\s+when\s+is_active\s+then\s+user_status\s+else\s+'inactive'\s+end/i.test(migration), 'Patch 19 migration does not infer inactive status from legacy is_active during backfill');
assert(page.includes('Patch 19 keeps login recovery separate from lifecycle status'), 'User Management Center warns about inactive/archive lifecycle review without breaking login');
assert(api.includes('PATCH19_PROFILE_FALLBACK_MESSAGE'), 'User management API defines a visible legacy People/profile fallback message');
assert(api.includes("from('v_access_control_matrix')") && api.includes("from('profiles')"), 'User management API falls back to existing access matrix and profiles when Patch 19 views are unavailable');
assert(api.includes('readProfileRowsForFallback') && api.includes('isMissingPatch19ProfileColumn'), 'User management API retries legacy profile columns when Patch 19 profile columns are missing');
assert(api.includes('isPatch19UnavailableError') && api.includes("invokePrivilegedAction<{ id: string }>('assign_user_role'"), 'User management API falls back to existing profile RLS and role bridge writes when Patch 19 bridge is unavailable');
assert(page.includes('fallbackMode') && page.includes('compatibility mode'), 'User Management Center shows compatibility mode when using legacy People/profile records');
assert(page.includes('toggleAllVisible') && page.includes('Select all visible users'), 'User Management Center has a select-all control for visible roster rows');

assert(!/insert\s+into\s+(?:public\.)?profiles\b/i.test(migration), 'Patch 19 migration does not seed profiles');
assert(!/insert\s+into\s+(?:public\.)?user_roles\b/i.test(migration), 'Patch 19 migration does not seed user roles');
assert(!/createUser|admin\.createUser|auth\.users/i.test(migration), 'Patch 19 migration does not create auth users');

const patch19BrowserSurface = `${page}\n${api}`;
assert(!/from\s*\([^)]*profiles[^)]*\)[\s\S]{0,160}\.delete\s*\(/i.test(patch19BrowserSurface), 'Patch 19 browser code exposes no hard profile delete action');
assert(!/from\s*\([^)]*user_roles[^)]*\)[\s\S]{0,160}\.delete\s*\(/i.test(patch19BrowserSurface), 'Patch 19 browser code exposes no hard role delete action');
assert(!/deleteUser|removeUser|hardDelete/i.test(patch19BrowserSurface), 'Patch 19 browser code exposes no user deletion command');

for (const tableName of [
  'user_management_audit_history',
  'user_management_import_batches',
  'user_management_import_rows',
]) {
  assert(
    new RegExp(`alter\\s+table\\s+public\\.${tableName}\\s+enable\\s+row\\s+level\\s+security`, 'i').test(migration),
    `${tableName} has RLS enabled`,
  );
  assert(
    new RegExp(`create\\s+policy[\\s\\S]+on\\s+public\\.${tableName}`, 'i').test(migration),
    `${tableName} has explicit RLS policies`,
  );
}

for (const viewName of [
  'v_user_management_roster',
  'v_user_management_summary',
  'v_user_profile_completeness',
]) {
  assert(
    new RegExp(`create\\s+or\\s+replace\\s+view\\s+public\\.${viewName}[\\s\\S]+security_invoker\\s*=\\s*true`, 'i').test(migration),
    `${viewName} uses security_invoker`,
  );
}

console.log('\nRunning npm run typecheck...');
execSync('npm run typecheck', { cwd: root, stdio: 'inherit' });

console.log('\nRunning npm run build...');
execSync('npm run build', { cwd: root, stdio: 'inherit' });

console.log('\nPatch 19 user management verification passed.');
