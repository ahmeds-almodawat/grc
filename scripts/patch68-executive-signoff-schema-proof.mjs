import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const migrationPath = path.join(root, 'supabase/migrations/114_patch68_executive_signoff_gateway.sql');
const outDir = path.join(root, 'release/patch68');
const outPath = path.join(outDir, 'patch68-schema-proof.json');
const sql = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, 'utf8') : '';
const lower = sql.toLowerCase();
const grantExecuteLines = sql.split(/\r?\n/).filter(line => /^\s*grant\s+execute\s+on\s+function/i.test(line));

const tables = ['executive_production_signoffs'];
const functions = ['record_executive_production_signoff'];

const checks = [
  { name: 'migration exists', passed: fs.existsSync(migrationPath) },
  ...tables.map(table => ({ name: `table exists: ${table}`, passed: lower.includes(`create table if not exists public.${table}`) })),
  ...tables.map(table => ({ name: `RLS enabled: ${table}`, passed: lower.includes(`alter table public.${table} enable row level security`) })),
  { name: 'read policies exist', passed: lower.includes('executive signoffs are readable by authenticated users') },
  ...functions.map(fn => ({ name: `function exists: ${fn}`, passed: lower.includes(`function public.${fn}`) })),
  { name: 'execute grant exists for authenticated', passed: grantExecuteLines.some(line => /public\.record_executive_production_signoff/i.test(line) && /authenticated/i.test(line)) },
  { name: 'no destructive data operations', passed: !/\b(drop\s+table|truncate\s+table|delete\s+from)\b/i.test(sql) },
];

const failed = checks.filter(check => !check.passed);
const result = {
  patch: '68',
  checked_at: new Date().toISOString(),
  strict_passed: failed.length === 0,
  failed_count: failed.length,
  checks,
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));

if (failed.length > 0) {
  console.error('\n❌ patch68 schema proof failed:');
  failed.forEach(f => console.error(`  - ${f.name}`));
  process.exit(1);
}

console.log(`\n✅ patch68 schema proof passed. (${checks.length} checks)`);
