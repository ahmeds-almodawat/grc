import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const requiredFiles = [
  'src/lib/v230ComplianceHardeningModel.ts',
  'src/components/v230/ComplianceHardeningOverview.tsx',
  'src/components/v230/PolicyAttestationTracker.tsx',
  'src/components/v230/VendorIncidentHardeningPanel.tsx',
  'src/styles/v230-compliance-hardening.css',
  'supabase/migrations/060_v230_compliance_policy_vendor_incident_hardening.sql',
  'scripts/v230-compliance-hardening-report.mjs',
  'scripts/v230-final-proof.mjs'
];

const requiredTerms = [
  'Policy → Attestation → Regulatory Change → Vendor Risk → Incident → Evidence → CAPA → Management Reporting',
  'v230_policy_documents',
  'v230_policy_versions',
  'v230_policy_attestations',
  'v230_regulatory_changes',
  'v230_vendors',
  'v230_vendor_due_diligence',
  'v230_compliance_incidents',
  'enable row level security',
  'authenticated read blocked pending bridge',
  'authenticated insert blocked pending bridge',
  'authenticated update blocked pending bridge'
];

const findings = [];
for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) {
    findings.push({ severity: 'critical', file, message: 'Required v23 file is missing.' });
  }
}

const combined = requiredFiles
  .filter(file => fs.existsSync(path.join(root, file)))
  .map(file => fs.readFileSync(path.join(root, file), 'utf8'))
  .join('\n');

for (const term of requiredTerms) {
  if (!combined.includes(term)) {
    findings.push({ severity: 'high', term, message: 'Required v23 hardening term or security phrase is missing.' });
  }
}

const pkgPath = path.join(root, 'package.json');
if (fs.existsSync(pkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const scripts = pkg.scripts ?? {};
  for (const scriptName of ['v230:compliance-hardening-audit', 'v230:compliance-hardening-report', 'v230:final-proof', 'pilot:v230-compliance-hardening']) {
    if (!scripts[scriptName]) {
      findings.push({ severity: 'high', scriptName, message: 'Expected v23 package script is missing.' });
    }
  }
} else {
  findings.push({ severity: 'critical', file: 'package.json', message: 'package.json is missing.' });
}

const migrationPath = path.join(root, 'supabase/migrations/060_v230_compliance_policy_vendor_incident_hardening.sql');
if (fs.existsSync(migrationPath)) {
  const migration = fs.readFileSync(migrationPath, 'utf8');
  const tables = [
    'v230_policy_documents',
    'v230_policy_versions',
    'v230_policy_attestations',
    'v230_regulatory_changes',
    'v230_vendors',
    'v230_vendor_due_diligence',
    'v230_compliance_incidents'
  ];
  for (const table of tables) {
    if (!migration.includes(`alter table public.${table} enable row level security`)) {
      findings.push({ severity: 'high', table, message: 'RLS enablement is missing for v23 table.' });
    }
    if (!migration.includes(`${table} authenticated read blocked pending bridge`)) {
      findings.push({ severity: 'high', table, message: 'Deny-by-default select policy is missing for v23 table.' });
    }
    if (!migration.includes(`${table} authenticated insert blocked pending bridge`)) {
      findings.push({ severity: 'high', table, message: 'Deny-by-default insert policy is missing for v23 table.' });
    }
    if (!migration.includes(`${table} authenticated update blocked pending bridge`)) {
      findings.push({ severity: 'high', table, message: 'Deny-by-default update policy is missing for v23 table.' });
    }
  }
  if (/for delete to authenticated/i.test(migration)) {
    findings.push({ severity: 'critical', message: 'v23 migration must not add authenticated delete policies.' });
  }
}

const summary = {
  generated_at: new Date().toISOString(),
  status: findings.some(f => f.severity === 'critical' || f.severity === 'high') ? 'failed' : 'passed',
  critical: findings.filter(f => f.severity === 'critical').length,
  high: findings.filter(f => f.severity === 'high').length,
  medium: findings.filter(f => f.severity === 'medium').length,
  findings
};

const outDir = path.join(root, 'release/v230');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'v230-static-audit.json'), `${JSON.stringify(summary, null, 2)}\n`);
console.log('v23.0 compliance hardening static audit complete.');
console.log({ status: summary.status, critical: summary.critical, high: summary.high, medium: summary.medium });
if (summary.status !== 'passed') {
  process.exitCode = 1;
}
