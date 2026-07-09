import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

let passed = 0;
let failed = 0;
const results = [];

function check(name, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`✅ ${name}`);
    results.push({ name, pass: true, detail });
  } else {
    failed++;
    console.error(`❌ ${name}`);
    if (detail) console.error(`   ${detail}`);
    results.push({ name, pass: false, detail });
  }
}

const ovr = fs.readFileSync(path.join(rootDir, 'src/pages/OVR.tsx'), 'utf8');
check('OVR.tsx has no ScenarioFillButton', !ovr.includes('<ScenarioFillButton'));
check('OVR.tsx has no fillSyntheticOvr', !ovr.includes('fillSyntheticOvr'));
check('OVR.tsx has no "synthetic"', !/synthetic/i.test(ovr));

const risks = fs.readFileSync(path.join(rootDir, 'src/pages/Risks.tsx'), 'utf8');
check('Risks.tsx has no "Patch 22 workflow queues"', !risks.includes('Patch 22 workflow queues'));
check('Risks.tsx has no "scenario"', !/scenario/i.test(risks));

const audit = fs.readFileSync(path.join(rootDir, 'src/pages/Audit.tsx'), 'utf8');
check('Audit.tsx has no "Patch 24"', !audit.includes('Patch 24'));
check('Audit.tsx has no "Patch 23 evidence waiver"', !audit.includes('Patch 23 evidence waiver'));
check('Audit.tsx has no "scenario"', !/scenario/i.test(audit));

const evidence = fs.readFileSync(path.join(rootDir, 'src/pages/Evidence.tsx'), 'utf8');
check('Evidence.tsx has no "Scenario Lab"', !/scenario lab/i.test(evidence));
check('Evidence.tsx has no "synthetic"', !/synthetic/i.test(evidence));

const projects = fs.readFileSync(path.join(rootDir, 'src/pages/Projects.tsx'), 'utf8');
check('Projects.tsx has no "Scenario Lab"', !/scenario lab/i.test(projects));

const warroom = fs.readFileSync(path.join(rootDir, 'src/pages/AccreditationWarRoomCenter.tsx'), 'utf8');
check('AccreditationWarRoomCenter.tsx has no "mock"', !warroom.includes('No mock survey') && !warroom.includes('Mock Survey Finding Register'));

const app = fs.readFileSync(path.join(rootDir, 'src/App.tsx'), 'utf8');
check('App.tsx protects AssuranceGoLiveCenter', app.includes('assuranceGoLive') && app.includes('super_admin'));
check('App.tsx protects AuditEvidenceGovernanceCenter', app.includes('auditEvidenceGovernance') && app.includes('super_admin'));
check('App.tsx protects ProductionGoNoGoCenter', app.includes('realProductionGoNoGo') && app.includes('super_admin'));
check('App.tsx protects RealDataActivationCenter', app.includes('realDataActivation') && app.includes('super_admin'));
check('App.tsx protects RealDataImportCenter', app.includes('realDataImportCenter') && app.includes('super_admin'));
check('App.tsx protects RealDataUatReadinessCenter', app.includes('realDataUatReadiness') && app.includes('super_admin'));

const authAccess = fs.readFileSync(path.join(rootDir, 'src/auth/authAccess.ts'), 'utf8');
check('authAccess.ts SUPER_ADMIN_ONLY_PAGES includes productionOperatorConsole', authAccess.includes('"productionOperatorConsole"'));

const layout = fs.readFileSync(path.join(rootDir, 'src/components/Layout.tsx'), 'utf8');
check('Layout.tsx productionEvidenceClosure label is "Production Evidence Closure"', !layout.match(/label:\s*["']Final Runtime Security Closure["'].*?productionEvidenceClosure/s));
check('Layout.tsx productionReadiness label is "Production Readiness"', !layout.match(/label:\s*["']Production Hardening Launch["'].*?productionReadiness/s));

if (failed > 0) {
  process.exit(1);
} else {
  console.log('All tests passed.');
}
