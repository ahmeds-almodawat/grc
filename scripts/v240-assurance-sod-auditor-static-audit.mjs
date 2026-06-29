import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const requiredFiles = [
  'src/lib/v240AssuranceSodAuditorModel.ts',
  'src/components/v240/AssuranceReadinessPanel.tsx',
  'src/components/v240/SodImmutableAuditPanel.tsx',
  'src/components/v240/AuditorEvidencePackPanel.tsx',
  'src/styles/v240-assurance-sod-auditor.css',
  'supabase/migrations/061_v240_assurance_sod_immutable_auditor_pack.sql'
];

const requiredTerms = [
  'Framework Requirement → Control → Test → Evidence Integrity → SoD Check → Immutable Log → Auditor Pack → Assurance Opinion',
  'Segregation-of-duties',
  'Immutable audit',
  'Evidence integrity',
  'Auditor evidence workspace',
  'read-only auditor packs',
  'v240_sod_rules',
  'v240_sod_violations',
  'v240_immutable_audit_events',
  'v240_evidence_integrity_index',
  'v240_auditor_workspaces',
  'v240_auditor_export_manifests'
];

const requiredScripts = [
  'v240:assurance-audit',
  'v240:assurance-report',
  'v240:final-proof',
  'pilot:v240-assurance'
];

const findings = [];

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) {
    findings.push({ severity: 'critical', file, message: 'Required v24 file is missing.' });
  }
}

const corpus = requiredFiles
  .filter(file => fs.existsSync(path.join(root, file)))
  .map(file => fs.readFileSync(path.join(root, file), 'utf8'))
  .join('\n');

for (const term of requiredTerms) {
  if (!corpus.includes(term)) {
    findings.push({ severity: 'high', term, message: 'Required assurance/auditor concept is missing.' });
  }
}

const migration = fs.existsSync(path.join(root, 'supabase/migrations/061_v240_assurance_sod_immutable_auditor_pack.sql'))
  ? fs.readFileSync(path.join(root, 'supabase/migrations/061_v240_assurance_sod_immutable_auditor_pack.sql'), 'utf8')
  : '';

for (const table of [
  'v240_sod_rules',
  'v240_sod_violations',
  'v240_immutable_audit_events',
  'v240_evidence_integrity_index',
  'v240_auditor_workspaces',
  'v240_auditor_export_manifests'
]) {
  if (!migration.includes(`alter table public.${table} enable row level security`)) {
    findings.push({ severity: 'critical', table, message: 'RLS enable statement missing.' });
  }
  if (!migration.includes(`${table} authenticated select blocked pending bridge`)) {
    findings.push({ severity: 'high', table, message: 'Deny-by-default SELECT policy missing.' });
  }
  if (!migration.includes(`${table} authenticated insert blocked pending bridge`)) {
    findings.push({ severity: 'high', table, message: 'Deny-by-default INSERT policy missing.' });
  }
  if (!migration.includes(`${table} authenticated update blocked pending bridge`)) {
    findings.push({ severity: 'high', table, message: 'Deny-by-default UPDATE policy missing.' });
  }
}

if (/grant\s+delete\s+on/i.test(migration) || /for\s+delete\s+to\s+authenticated/i.test(migration)) {
  findings.push({ severity: 'critical', message: 'Authenticated delete access must not be introduced in v24.' });
}

if (/using\s*\(\s*true\s*\)/i.test(migration) || /with\s+check\s*\(\s*true\s*\)/i.test(migration)) {
  findings.push({ severity: 'critical', message: 'Broad true RLS policy detected in v24 migration.' });
}

const pkgPath = path.join(root, 'package.json');
if (fs.existsSync(pkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  for (const script of requiredScripts) {
    if (!pkg.scripts?.[script]) {
      findings.push({ severity: 'high', script, message: 'Required v24 package script is missing.' });
    }
  }
}

const critical = findings.filter(f => f.severity === 'critical').length;
const high = findings.filter(f => f.severity === 'high').length;
const medium = findings.filter(f => f.severity === 'medium').length;
const report = {
  generated_at: new Date().toISOString(),
  status: critical || high ? 'failed' : 'passed',
  critical,
  high,
  medium,
  findings
};

fs.mkdirSync(path.join(root, 'release/v240'), { recursive: true });
fs.writeFileSync(path.join(root, 'release/v240/v240-static-audit.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log('v24.0 assurance, SoD and auditor pack static audit complete.');
console.log({ status: report.status, critical, high, medium });

if (critical || high) process.exit(1);
