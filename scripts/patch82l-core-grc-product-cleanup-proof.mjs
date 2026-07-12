import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const checks = [];
function check(name, testFn) {
  try {
    const passed = testFn();
    checks.push({ name, pass: Boolean(passed) });
    if (!passed) console.error(`❌ ${name}`);
    else console.log(`✅ ${name}`);
  } catch (error) {
    checks.push({ name, pass: false });
    console.error(`❌ ${name} (${error.message})`);
  }
}

const risks = read('src/pages/Risks.tsx');
const audit = read('src/pages/Audit.tsx');
const compliance = read('src/pages/Compliance.tsx');
const governance = read('src/pages/Governance.tsx');

check('Risks.tsx no longer imports/renders illustrative panels', () => {
  const forbidden = [
    'ProfessionalGrcMaturityPanel',
    'ProfessionalGrcWorkflowMap',
    'RiskAppetiteTreatmentPanel',
    'RiskControlTraceabilityPanel',
    'RiskExecutionWorkflowMap',
    'FrameworkCrosswalkBackbonePanel',
    'ControlTestingWorkflowPanel',
    'ControlAssuranceReadinessPanel',
    'ScenarioFillButton',
    'Test-fill Control'
  ];
  const violations = forbidden.filter(panel => risks.includes(panel));
  if (violations.length > 0) throw new Error(violations.join(', '));
  return true;
});

check('Audit.tsx no longer imports/renders illustrative panels', () => {
  const forbidden = [
    'ProfessionalGrcMaturityPanel',
    'ProfessionalGrcWorkflowMap',
    'AuditAssuranceCoveragePanel',
    'AuditProgramWorkflowMap',
    'FrameworkCrosswalkBackbonePanel',
    'CapaExecutionPanel',
    'ControlAssuranceReadinessPanel',
    'AuditExecutionCenter'
  ];
  const violations = forbidden.filter(panel => audit.includes(panel));
  if (violations.length > 0) throw new Error(violations.join(', '));
  return true;
});

check('Compliance.tsx no longer imports/renders illustrative panels', () => {
  const forbidden = [
    'ComplianceExecutionWorkflowMap',
    'ComplianceObligationMaturityPanel',
    'ComplianceTestingCalendar',
    'FrameworkCrosswalkBackbonePanel',
    'ComplianceHardeningOverview',
    'PolicyAttestationTracker',
    'VendorIncidentHardeningPanel'
  ];
  const violations = forbidden.filter(panel => compliance.includes(panel));
  if (violations.length > 0) throw new Error(violations.join(', '));
  return true;
});

check('Governance.tsx no longer imports/renders illustrative panels', () => {
  const forbidden = [
    'ProfessionalGrcMaturityPanel',
    'ProfessionalGrcWorkflowMap',
    'AssuranceMapPanel',
    'GrcTraceabilityMap',
    'TraceabilityGapPanel',
    'FrameworkCrosswalkBackbonePanel',
    'ControlAssuranceReadinessPanel',
    'AssuranceReadinessPanel',
    'SodImmutableAuditPanel',
    'AuditorEvidencePackPanel',
    'LiveOperatingCyclePanel',
    'DataBridgeGovernancePanel',
    'AccessReviewOperatingPanel'
  ];
  const violations = forbidden.filter(panel => governance.includes(panel));
  if (violations.length > 0) throw new Error(violations.join(', '));
  return true;
});

check('Each page still contains its main operational register/table and create button text', () => {
  if (!risks.includes('Enterprise risk register') || !risks.includes('New Risk')) throw new Error('Risks missing main elements');
  if (!audit.includes('Audit findings register') || !audit.includes('New Finding')) throw new Error('Audit missing main elements');
  if (!compliance.includes('Compliance obligations register') || !compliance.includes('New Obligation')) throw new Error('Compliance missing main elements');
  if (!governance.includes('Governance decisions register') || !governance.includes('New Decision')) throw new Error('Governance missing main elements');
  return true;
});

check('No migrations/functions/auth/RLS/service-role/privileged-action/backend security files changed', () => {
  const diff = execSync('git diff --name-only', { encoding: 'utf8' });
  const forbidden = ['migrations', 'auth', 'functions', 'RLS', 'service-role', 'privileged-action'];
  const diffFiles = diff.split('\n').map(l => l.trim()).filter(Boolean); // fixed split
  const violations = diffFiles.filter(file => {
    if (file === 'src/auth/authAccess.ts') return false; // Allowed from previous 82K patch
    return forbidden.some(f => file.toLowerCase().includes(f.toLowerCase()));
  });
  if (violations.length > 0) {
    throw new Error(violations.join(', '));
  }
  return true;
});

const failed = checks.filter(c => !c.pass);
if (failed.length > 0) {
  process.exit(1);
}
