import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const requiredFiles = [
  'src/lib/v250LiveGrcOperatingModel.ts',
  'src/components/v250/LiveOperatingCyclePanel.tsx',
  'src/components/v250/DataBridgeGovernancePanel.tsx',
  'src/components/v250/AccessReviewOperatingPanel.tsx',
  'src/styles/v250-live-grc-operating.css',
  'supabase/migrations/062_v250_live_grc_operating_workspace.sql'
];

const requiredTerms = [
  'Operating Cycle → Data Intake → Edge Bridge Review → Access Review → Evidence Snapshot → Production Exception → Management Sign-off',
  'Bridge-gated',
  'Data bridge governance',
  'Access review and SoD operation',
  'production reliance',
  'v250_operating_cycles',
  'v250_data_intake_requests',
  'v250_live_bridge_registry',
  'v250_access_review_items',
  'v250_framework_evidence_snapshots',
  'v250_production_exception_register'
];

const requiredScripts = [
  'v250:live-operating-audit',
  'v250:live-operating-report',
  'v250:final-proof',
  'pilot:v250-live-operating'
];

const tables = [
  'v250_operating_cycles',
  'v250_data_intake_requests',
  'v250_live_bridge_registry',
  'v250_access_review_items',
  'v250_framework_evidence_snapshots',
  'v250_production_exception_register'
];

const findings = [];
for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) findings.push({ severity: 'critical', file, message: 'Required v25 file is missing.' });
}

const corpus = requiredFiles
  .filter(file => fs.existsSync(path.join(root, file)))
  .map(file => fs.readFileSync(path.join(root, file), 'utf8'))
  .join('\n');
for (const term of requiredTerms) {
  if (!corpus.includes(term)) findings.push({ severity: 'high', term, message: 'Required live operating concept is missing.' });
}

const migrationPath = path.join(root, 'supabase/migrations/062_v250_live_grc_operating_workspace.sql');
const migration = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, 'utf8') : '';
for (const table of tables) {
  if (!migration.includes(`alter table public.${table} enable row level security`)) {
    findings.push({ severity: 'critical', table, message: 'RLS enable statement missing.' });
  }
  for (const action of ['select', 'insert', 'update']) {
    if (!migration.includes(`${table} authenticated ${action} blocked pending bridge`)) {
      findings.push({ severity: 'high', table, action, message: 'Deny-by-default policy missing.' });
    }
  }
}

if (/grant\s+delete\s+on/i.test(migration) || /for\s+delete\s+to\s+authenticated/i.test(migration)) {
  findings.push({ severity: 'critical', message: 'Authenticated delete access must not be introduced in v25.' });
}
if (/using\s*\(\s*true\s*\)/i.test(migration) || /with\s+check\s*\(\s*true\s*\)/i.test(migration)) {
  findings.push({ severity: 'critical', message: 'Broad true RLS policy detected in v25 migration.' });
}

const pkgPath = path.join(root, 'package.json');
if (fs.existsSync(pkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  for (const script of requiredScripts) {
    if (!pkg.scripts?.[script]) findings.push({ severity: 'high', script, message: 'Required v25 package script is missing.' });
  }
}

const critical = findings.filter(f => f.severity === 'critical').length;
const high = findings.filter(f => f.severity === 'high').length;
const medium = findings.filter(f => f.severity === 'medium').length;
const report = { generated_at: new Date().toISOString(), status: critical || high ? 'failed' : 'passed', critical, high, medium, findings };
fs.mkdirSync(path.join(root, 'release/v250'), { recursive: true });
fs.writeFileSync(path.join(root, 'release/v250/v250-static-audit.json'), JSON.stringify(report, null, 2));
console.log('v25.0 live GRC operating static audit complete.');
console.log({ status: report.status, critical, high, medium });
if (critical || high) process.exit(1);
