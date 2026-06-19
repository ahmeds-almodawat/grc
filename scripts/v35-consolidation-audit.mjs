#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const migrationsDir = path.join(root, 'supabase', 'migrations');
const requiredDocs = [
  'FINAL_GO_LIVE_PLAYBOOK.md',
  'FINAL_PRODUCTION_HANDOVER.md',
  'V33_PRODUCTION_PROOF.md',
  'V34_PILOT_ROLLOUT_RUNBOOK.md',
];

function exists(file) {
  return fs.existsSync(path.join(root, file));
}

function listMigrations() {
  if (!fs.existsSync(migrationsDir)) return [];
  return fs.readdirSync(migrationsDir).filter(file => file.endsWith('.sql')).sort();
}

const migrations = listMigrations();
const missingDocs = requiredDocs.filter(doc => !exists(path.join('docs', doc)) && !exists(doc));
const latest = migrations.at(-1) ?? 'none';

const result = {
  generated_at: new Date().toISOString(),
  migration_count: migrations.length,
  latest_migration: latest,
  has_031: migrations.some(file => file.includes('031_consolidation_pilot_fix_kit')),
  missing_reference_docs: missingDocs,
  recommendation: migrations.length >= 31 && missingDocs.length === 0
    ? 'Ready for fresh Supabase migration proof.'
    : 'Not ready. Complete missing migration/docs before pilot proof.',
};

console.log(JSON.stringify(result, null, 2));
if (!result.has_031) process.exitCode = 1;
