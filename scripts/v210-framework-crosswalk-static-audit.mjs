import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const reportPath = path.join(root, 'release', 'v210', 'v210-static-audit.json');

const requiredFiles = [
  'src/lib/v210FrameworkCrosswalkModel.ts',
  'src/components/v210/FrameworkCrosswalkBackbonePanel.tsx',
  'src/components/v210/FrameworkCoverageDashboard.tsx',
  'src/styles/v210-framework-crosswalk.css',
  'supabase/migrations/057_v210_framework_crosswalk_backbone.sql',
  'scripts/v210-framework-crosswalk-static-audit.mjs',
  'scripts/v210-framework-crosswalk-report.mjs',
  'scripts/v210-final-proof.mjs',
];

const requiredTokens = [
  'v210ProfessionalTraceabilityChain',
  'Requirement → Risk → Control → Test → Evidence → Issue → CAPA → Closure → Report',
  'ISO_31000',
  'COSO_ERM',
  'ISO_37301',
  'IIA_GIAS',
  'v210_frameworks',
  'v210_framework_requirements',
  'v210_framework_mappings',
  'v210_grc_relationships',
  'v210_scope_assets',
];

const findings = [];

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) {
    findings.push({ severity: 'critical', file, message: 'Required v21 file missing.' });
  }
}

const modelText = fs.existsSync(path.join(root, 'src/lib/v210FrameworkCrosswalkModel.ts'))
  ? fs.readFileSync(path.join(root, 'src/lib/v210FrameworkCrosswalkModel.ts'), 'utf8')
  : '';
const migrationText = fs.existsSync(path.join(root, 'supabase/migrations/057_v210_framework_crosswalk_backbone.sql'))
  ? fs.readFileSync(path.join(root, 'supabase/migrations/057_v210_framework_crosswalk_backbone.sql'), 'utf8')
  : '';
const packageText = fs.existsSync(path.join(root, 'package.json'))
  ? fs.readFileSync(path.join(root, 'package.json'), 'utf8')
  : '';

for (const token of requiredTokens) {
  if (!modelText.includes(token) && !migrationText.includes(token)) {
    findings.push({ severity: 'high', token, message: `Missing expected v21 token: ${token}` });
  }
}

for (const table of ['v210_frameworks', 'v210_framework_requirements', 'v210_framework_mappings', 'v210_grc_relationships', 'v210_scope_assets']) {
  if (!migrationText.includes(`alter table public.${table} enable row level security`)) {
    findings.push({ severity: 'high', table, message: 'RLS enable statement missing for v21 table.' });
  }
}

if (/using\s*\(\s*true\s*\)/i.test(migrationText) || /grant\s+all/i.test(migrationText)) {
  findings.push({ severity: 'critical', message: 'Migration appears to include broad access policy/grant. Review required.' });
}

if (!packageText.includes('pilot:v210-framework-crosswalk')) {
  findings.push({ severity: 'high', message: 'package.json is missing pilot:v210-framework-crosswalk script.' });
}

const pages = [
  'src/pages/Governance.tsx',
  'src/pages/Risks.tsx',
  'src/pages/Compliance.tsx',
  'src/pages/Audit.tsx',
  'src/pages/Evidence.tsx',
  'src/pages/ExecutiveCommandCenter.tsx',
];

const injectedPages = pages.filter(file => fs.existsSync(path.join(root, file)) && fs.readFileSync(path.join(root, file), 'utf8').includes('FrameworkCrosswalkBackbonePanel'));

if (injectedPages.length < 3) {
  findings.push({
    severity: 'medium',
    message: 'Fewer than three pages contain the v21 FrameworkCrosswalkBackbonePanel. UI visibility may be limited.',
    injectedPages,
  });
}

const counts = findings.reduce((acc, finding) => {
  acc[finding.severity] = (acc[finding.severity] || 0) + 1;
  return acc;
}, { critical: 0, high: 0, medium: 0 });

const report = {
  generated_at: new Date().toISOString(),
  version: 'v21.0',
  status: counts.critical || counts.high ? 'failed' : 'passed',
  critical: counts.critical || 0,
  high: counts.high || 0,
  medium: counts.medium || 0,
  injected_pages: injectedPages,
  professional_chain: 'Requirement → Risk → Control → Test → Evidence → Issue → CAPA → Closure → Report',
  findings,
};

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

console.log('v21.0 framework crosswalk static audit complete.');
console.log({ status: report.status, critical: report.critical, high: report.high, medium: report.medium });

if (report.status !== 'passed') {
  process.exitCode = 1;
}
