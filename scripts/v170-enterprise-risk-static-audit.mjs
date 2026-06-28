import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const releaseDir = path.join(root, 'release', 'v170');
fs.mkdirSync(releaseDir, { recursive: true });

const checks = [
  {
    id: 'v170-model-present',
    severity: 'critical',
    file: 'src/lib/v170EnterpriseRiskModel.ts',
    tokens: [
      'v170RiskExecutionChain',
      'Risk Identification → Assessment → Appetite / KRI → Treatment → Control Linkage → Monitoring → Escalation → Executive Risk Reporting',
      'Risk Identification',
      'Risk Assessment and Scoring',
      'Risk Appetite and KRI Monitoring',
      'Risk Treatment Plan',
      'Control Linkage and Testing',
      'Executive Risk Reporting',
    ],
  },
  {
    id: 'v170-workflow-map-present',
    severity: 'critical',
    file: 'src/components/v170/RiskExecutionWorkflowMap.tsx',
    tokens: ['RiskExecutionWorkflowMap', 'v170RiskExecutionChain', 'v170RiskLifecycleSteps'],
  },
  {
    id: 'v170-appetite-treatment-panel-present',
    severity: 'critical',
    file: 'src/components/v170/RiskAppetiteTreatmentPanel.tsx',
    tokens: ['RiskAppetiteTreatmentPanel', 'v170RiskAppetiteMetrics', 'v170RiskTreatmentItems'],
  },
  {
    id: 'v170-traceability-panel-present',
    severity: 'critical',
    file: 'src/components/v170/RiskControlTraceabilityPanel.tsx',
    tokens: ['RiskControlTraceabilityPanel', 'v170RiskTraceabilityItems', 'Risk-control-test-evidence traceability'],
  },
  {
    id: 'v170-risks-page-integrated',
    severity: 'high',
    file: 'src/pages/Risks.tsx',
    tokens: [
      'Enterprise risk execution cockpit',
      'RiskExecutionWorkflowMap',
      'RiskAppetiteTreatmentPanel',
      'RiskControlTraceabilityPanel',
      'Risk closure rule',
      'Professional ERM workflow',
    ],
  },
  {
    id: 'v170-css-present',
    severity: 'medium',
    file: 'src/styles/v170-enterprise-risk.css',
    tokens: ['v170-risk-workflow-grid', 'v170-risk-capability-grid', 'v170-traceability-row'],
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
  version: 'v17.0',
  pack: 'Enterprise Risk Management Execution Pack',
  status: failed.length === 0 ? 'passed' : 'failed',
  generated_at: new Date().toISOString(),
  critical: failed.filter(result => result.severity === 'critical').length,
  high: failed.filter(result => result.severity === 'high').length,
  medium: failed.filter(result => result.severity === 'medium').length,
  checks: results,
};

fs.writeFileSync(path.join(releaseDir, 'v170-static-audit.json'), `${JSON.stringify(summary, null, 2)}\n`);

console.log('v17.0 enterprise risk static audit complete.');
console.log({ status: summary.status, critical: summary.critical, high: summary.high, medium: summary.medium });

if (summary.status !== 'passed') {
  process.exit(1);
}
