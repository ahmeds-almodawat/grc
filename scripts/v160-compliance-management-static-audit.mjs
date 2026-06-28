import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const releaseDir = path.join(root, 'release', 'v160');
fs.mkdirSync(releaseDir, { recursive: true });

const checks = [
  {
    id: 'v160-model-present',
    severity: 'critical',
    file: 'src/lib/v160ComplianceManagementModel.ts',
    tokens: [
      'v160ComplianceExecutionChain',
      'Obligation → Regulatory Change → Policy / Control → Compliance Test → Evidence → Issue → CAPA → Management Reporting',
      'Compliance Obligations Register',
      'Regulatory Change Management',
      'Compliance Testing Program',
      'Policy and Attestation Link',
      'Non-compliance Issue Workflow',
    ],
  },
  {
    id: 'v160-components-present',
    severity: 'critical',
    file: 'src/components/v160/ComplianceExecutionWorkflowMap.tsx',
    tokens: ['ComplianceExecutionWorkflowMap', 'v160ComplianceExecutionSteps'],
  },
  {
    id: 'v160-maturity-panel-present',
    severity: 'critical',
    file: 'src/components/v160/ComplianceObligationMaturityPanel.tsx',
    tokens: ['ComplianceObligationMaturityPanel', 'getV160ComplianceReadiness'],
  },
  {
    id: 'v160-testing-calendar-present',
    severity: 'critical',
    file: 'src/components/v160/ComplianceTestingCalendar.tsx',
    tokens: ['ComplianceTestingCalendar', 'v160RegulatoryChangePipeline', 'v160PolicyAttestationItems'],
  },
  {
    id: 'v160-compliance-page-integrated',
    severity: 'high',
    file: 'src/pages/Compliance.tsx',
    tokens: [
      'ComplianceExecutionWorkflowMap',
      'ComplianceObligationMaturityPanel',
      'ComplianceTestingCalendar',
      'Compliance closure rule',
      'Professional CMS workflow',
    ],
  },
  {
    id: 'v160-css-present',
    severity: 'medium',
    file: 'src/styles/v160-compliance-management.css',
    tokens: ['v160-workflow-grid', 'v160-capability-grid', 'v160-three-panel-grid'],
  },
];

const results = checks.map(check => {
  const filePath = path.join(root, check.file);
  const exists = fs.existsSync(filePath);
  const content = exists ? fs.readFileSync(filePath, 'utf8') : '';
  const missingTokens = check.tokens.filter(token => !content.includes(token));
  return {
    ...check,
    exists,
    missing_tokens: missingTokens,
    passed: exists && missingTokens.length === 0,
  };
});

const failed = results.filter(result => !result.passed);
const summary = {
  version: 'v16.0',
  pack: 'Compliance Management System Execution Pack',
  status: failed.length === 0 ? 'passed' : 'failed',
  generated_at: new Date().toISOString(),
  critical: failed.filter(result => result.severity === 'critical').length,
  high: failed.filter(result => result.severity === 'high').length,
  medium: failed.filter(result => result.severity === 'medium').length,
  checks: results,
};

fs.writeFileSync(
  path.join(releaseDir, 'v160-static-audit.json'),
  `${JSON.stringify(summary, null, 2)}\n`,
);

console.log('v16.0 compliance management static audit complete.');
console.log({ status: summary.status, critical: summary.critical, high: summary.high, medium: summary.medium });

if (summary.status !== 'passed') {
  process.exit(1);
}
