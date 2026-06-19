#!/usr/bin/env node
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const required = [
  'package.json',
  'src/App.tsx',
  'src/components/Layout.tsx',
  'src/i18n/I18nContext.tsx',
  'src/pages/ProductionFinishCenter.tsx',
  'src/lib/productionReadinessApi.ts',
  'supabase/migrations/027_final_production_leap.sql',
  'docs/FINAL_PRODUCTION_HANDOVER.md',
  'docs/OPERATOR_DAY_1_RUNBOOK.md'
];

const missing = required.filter(file => !existsSync(join(process.cwd(), file)));
const migrationsDir = join(process.cwd(), 'supabase/migrations');
const migrations = existsSync(migrationsDir) ? readdirSync(migrationsDir).filter(name => name.endsWith('.sql')).sort() : [];
const numericPrefixes = migrations.map(name => Number(name.slice(0, 3))).filter(n => Number.isFinite(n));
const uniquePrefixes = [...new Set(numericPrefixes)].sort((a, b) => a - b);
const missingPrefixes = [];
for (let n = 1; n <= Math.max(...uniquePrefixes, 0); n += 1) {
  if (!uniquePrefixes.includes(n)) missingPrefixes.push(String(n).padStart(3, '0'));
}

const result = {
  missing,
  migrationCount: migrations.length,
  uniqueMigrationPrefixes: uniquePrefixes.length,
  firstMigration: migrations[0] ?? null,
  lastMigration: migrations.at(-1) ?? null,
  missingMigrationPrefixes: missingPrefixes,
  note: 'Lettered migrations such as 012a/012b are allowed; apply files in filename sort order.',
  pass: missing.length === 0 && missingPrefixes.length === 0
};
console.log(JSON.stringify(result, null, 2));
if (!result.pass) process.exit(1);
