import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const migrationPath = path.join(repoRoot, 'supabase/migrations/104_patch44_production_ux_readiness_pilot_hardening.sql');
const outDir = path.join(repoRoot, 'release/patch44');
const outPath = path.join(outDir, 'patch44-schema-proof.json');

const requiredTables = [
  'pilot_go_no_go_reviews',
  'pilot_go_no_go_events',
];

const requiredViews = [
  'v_patch44_role_landing_matrix',
  'v_patch44_navigation_readiness_map',
  'v_patch44_production_readiness_summary',
  'v_patch44_backup_restore_readiness_summary',
  'v_patch44_known_limitations_summary',
  'v_patch44_bilingual_readiness_summary',
  'v_patch44_pilot_blocker_register',
  'v_patch44_pilot_go_no_go_dashboard',
  'v_patch44_executive_readiness_summary',
  'v_patch44_daily_operations_landing_summary',
];

const requiredFunctions = [
  'create_pilot_go_no_go_review',
  'update_pilot_go_no_go_review_status',
  'record_pilot_go_no_go_event',
  'get_pilot_go_no_go_dashboard',
  'get_executive_readiness_summary',
  'get_daily_operations_landing_summary',
];

const migration = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, 'utf8') : '';
const lower = migration.toLowerCase();

function has(pattern) {
  return pattern.test(migration);
}

const checks = [
  { name: 'migration exists', passed: fs.existsSync(migrationPath) },
  ...requiredTables.map(table => ({
    name: `table or extension present: ${table}`,
    passed: lower.includes(`create table if not exists public.${table}`) || lower.includes(`create table public.${table}`),
  })),
  ...requiredTables.map(table => ({
    name: `RLS enabled: ${table}`,
    passed: lower.includes(`alter table public.${table} enable row level security`),
  })),
  ...requiredViews.map(view => ({
    name: `view exists: ${view}`,
    passed: lower.includes(`create or replace view public.${view}`),
  })),
  ...requiredViews.map(view => ({
    name: `security_invoker set: ${view}`,
    passed: lower.includes(`alter view public.${view} set (security_invoker = true)`) || 
            lower.includes(`alter view if exists public.${view} set (security_invoker = true)`) ||
            (lower.includes(`create or replace view public.${view}`) && lower.includes(`with (security_invoker = true)`)),
  })),
  ...requiredFunctions.map(fn => ({
    name: `function exists: ${fn}`,
    passed: lower.includes(`function public.${fn}`),
  })),
];

const failed = checks.filter(check => !check.passed);
const result = {
  patch: '44',
  migration: path.relative(repoRoot, migrationPath),
  checked_at: new Date().toISOString(),
  strict_passed: failed.length === 0,
  check_count: checks.length,
  failed_count: failed.length,
  failed,
  required_tables: requiredTables,
  required_views: requiredViews,
  required_functions: requiredFunctions,
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));

if (!result.strict_passed) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(result, null, 2));
