#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const outDir = path.join(process.cwd(), 'release');
fs.mkdirSync(outDir, { recursive: true });
const checklist = {
  version: 'v3.5',
  generated_at: new Date().toISOString(),
  hard_stop_rules: [
    'No pilot if fresh migration proof failed.',
    'No pilot if RLS persona proof failed.',
    'No pilot if OVR end-to-end proof failed.',
    'No pilot if backup/restore evidence is missing.',
    'No pilot if critical consolidation defects remain open.',
  ],
  final_checks: [
    'Apply all patch files in order.',
    'Run migrations 001 through 031 on fresh Supabase staging.',
    'Run RLS tests for CEO, department manager, employee, Quality, and Auditor.',
    'Run OVR report -> HOD investigation -> Quality closure -> risk indicator update.',
    'Create backup export and Supabase database/storage backup evidence.',
    'Import pilot users/departments and run real-data quality repair queue.',
    'Complete go-live SOP steps and executive go/no-go signoff.',
  ],
};
const outPath = path.join(outDir, 'V35_FINAL_PILOT_CHECKLIST.json');
fs.writeFileSync(outPath, JSON.stringify(checklist, null, 2));
console.log(`Generated ${outPath}`);
