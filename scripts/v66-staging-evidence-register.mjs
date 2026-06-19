import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'release', 'v66');
fs.mkdirSync(outDir, { recursive: true });

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function readJson(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

const v64Proof = readJson('release/v64/v64-database-security-proof-report.json');
const automated = [
  {
    id: 'typecheck_build_recent',
    title: 'Local typecheck/build pipeline is runnable',
    category: 'automated',
    status: exists('dist/index.html') ? 'verified' : 'not_verified',
    evidence: exists('dist/index.html') ? 'dist/index.html exists after build' : 'Run npm run build'
  },
  {
    id: 'no_mock_strict_recent',
    title: 'No-mock strict audit has zero production blockers',
    category: 'automated',
    status: exists('release/v60/v60-production-data-audit.json') ? 'evidence_file_present' : 'not_verified',
    evidence: 'release/v60/v60-production-data-audit.json'
  },
  {
    id: 'database_security_static_ready',
    title: 'Database security static proof has no high-risk findings',
    category: 'automated',
    status: v64Proof?.summary?.database_security_status === 'static_ready_pending_staging_persona_sql' || v64Proof?.database_security_status === 'static_ready_pending_staging_persona_sql' ? 'verified' : (v64Proof ? 'review_required' : 'not_verified'),
    evidence: 'release/v64/v64-database-security-proof-report.json'
  },
  {
    id: 'real_browser_tests_passed',
    title: 'Vitest and Playwright real smoke tests passed locally',
    category: 'automated',
    status: exists('test-results') || exists('playwright-report') ? 'evidence_file_present' : 'not_verified',
    evidence: 'Console output / playwright-report / test-results. Attach latest npm run test:real result.'
  }
];

const manual = [
  {
    id: 'fresh_staging_migrations_001_044',
    title: 'Fresh staging Supabase migrations applied through 044',
    category: 'manual',
    required: true,
    status: 'manual_required',
    evidence_needed: 'Screenshot/log showing migrations 001 through 044 applied successfully in staging.'
  },
  {
    id: 'staging_persona_sql_v64',
    title: 'v64 persona SQL tests passed in staging',
    category: 'manual',
    required: true,
    status: 'manual_required',
    evidence_needed: 'Result/output from supabase/tests/v64_persona_security_tests.sql.'
  },
  {
    id: 'staging_workflow_sql_v65',
    title: 'v65 workflow SQL smoke tests passed in staging',
    category: 'manual',
    required: true,
    status: 'manual_required',
    evidence_needed: 'Result/output from supabase/tests/v65_workflow_smoke_tests.sql.'
  },
  {
    id: 'backup_restore_dryrun',
    title: 'Backup and restore dry-run completed in staging',
    category: 'manual',
    required: true,
    status: 'manual_required',
    evidence_needed: 'Restore source, restore target, table counts, evidence-storage sample, smoke-test result, issue/signoff.'
  },
  {
    id: 'ovr_confidentiality_no_real_patient_data',
    title: 'OVR confidentiality rule confirmed for pilot',
    category: 'manual',
    required: true,
    status: 'manual_required',
    evidence_needed: 'Quality/IT confirmation that pilot will not include real patient identifiers or confidential OVR details until persona proof passes.'
  },
  {
    id: 'pilot_signoff_it_quality_admin',
    title: 'IT, Quality, and Admin pilot signoff completed',
    category: 'manual',
    required: true,
    status: 'manual_required',
    evidence_needed: 'Signed v66 pilot signoff file with names/dates.'
  }
];

const existingManualPath = path.join(outDir, 'v66-manual-evidence.json');
if (!fs.existsSync(existingManualPath)) {
  fs.writeFileSync(existingManualPath, JSON.stringify({ generated_at: new Date().toISOString(), items: manual }, null, 2));
}

let manualItems = manual;
try {
  const existing = JSON.parse(fs.readFileSync(existingManualPath, 'utf8'));
  if (Array.isArray(existing.items)) manualItems = existing.items;
} catch {}

const all = [...automated, ...manualItems];
const summary = {
  generated_at: new Date().toISOString(),
  automated_total: automated.length,
  automated_verified_or_present: automated.filter((x) => ['verified', 'evidence_file_present'].includes(x.status)).length,
  manual_total: manualItems.length,
  manual_verified: manualItems.filter((x) => x.status === 'verified').length,
  manual_required_remaining: manualItems.filter((x) => x.required && x.status !== 'verified').length,
  pilot_evidence_status: manualItems.some((x) => x.required && x.status !== 'verified') ? 'manual_evidence_required' : 'manual_evidence_complete'
};

const report = { summary, items: all };
fs.writeFileSync(path.join(outDir, 'v66-evidence-register.json'), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(outDir, 'V66_EVIDENCE_REGISTER.md'), `# v6.6 Controlled Pilot Evidence Register\n\n\`\`\`json\n${JSON.stringify(summary, null, 2)}\n\`\`\`\n\n## Manual evidence items\n\n${manualItems.map((x) => `- [${x.status === 'verified' ? 'x' : ' '}] **${x.id}** — ${x.title} — status: \`${x.status}\``).join('\n')}\n\nEdit \`release/v66/v66-manual-evidence.json\` and set required items to \`verified\` only after real staging evidence is attached.\n`);

console.log('v6.6 staging evidence register generated.');
console.log(JSON.stringify(summary, null, 2));
