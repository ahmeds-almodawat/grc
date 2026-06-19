#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const checks = [
  ['Migration 030 exists', fs.existsSync('supabase/migrations/030_pilot_real_data_operations.sql')],
  ['Pilot operations page exists', fs.existsSync('src/pages/PilotOperationsCenter.tsx')],
  ['Pilot API exists', fs.existsSync('src/lib/pilotOpsApi.ts')],
  ['Pilot dictionary exists', fs.existsSync('src/data/v34PilotDictionary.ts')],
  ['Patch notes exist', fs.existsSync('PATCH_NOTES.md')]
];

let failed = 0;
console.log('v3.4 Pilot Preflight');
for (const [name, ok] of checks) {
  console.log(`${ok ? '✓' : '✗'} ${name}`);
  if (!ok) failed++;
}

const migrationDir = 'supabase/migrations';
if (fs.existsSync(migrationDir)) {
  const migrations = fs.readdirSync(migrationDir).filter(f => f.endsWith('.sql')).sort();
  console.log(`Detected migrations: ${migrations.length}`);
  console.log(`Latest migration: ${migrations[migrations.length - 1] || 'none'}`);
}

process.exit(failed ? 1 : 0);
