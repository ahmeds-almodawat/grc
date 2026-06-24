import fs from 'node:fs';
import path from 'node:path';
import {
  defaultEmail,
  detectDatabaseContainer,
  ensureLocalOnly,
  ensureReleaseDir,
  findActor,
  releaseDir,
  root,
  scenarioStatus,
  tag,
} from './v99-local-scenario-utils.mjs';

const generatedAt = new Date().toISOString();
const reportPath = path.join(releaseDir, 'final-testing-report.md');
const checklistPath = path.join(releaseDir, 'manual-testing-checklist.md');
const personaPath = path.join(root, 'release', 'v72', 'real-authenticated-persona-proof.json');

let status = null;
let persona = null;
let error = null;

try {
  ensureLocalOnly();
  ensureReleaseDir();
  const { container } = detectDatabaseContainer();
  const actor = findActor(container, defaultEmail);
  status = scenarioStatus(container, actor.id);
  persona = fs.existsSync(personaPath)
    ? JSON.parse(fs.readFileSync(personaPath, 'utf8'))
    : null;
} catch (caught) {
  error = caught;
}

const personaTechnicalPass = Boolean(
  persona?.authenticated_personas_passed === persona?.required_persona_count
  && persona?.required_scenarios_passed === persona?.required_scenario_count
  && persona?.failed_count === 0
  && persona?.cleanup_status === 'passed'
  && persona?.strict_passed,
);
const scenarioReady = Number(status?.total_records) > 0;
const technicalStatus = !error && scenarioReady && personaTechnicalPass ? 'READY FOR MANUAL PILOT TESTING' : 'NEEDS ATTENTION';

ensureReleaseDir();
fs.writeFileSync(checklistPath, `# v9.9 Manual Testing Checklist

This checklist is for a controlled internal pilot using synthetic data only.
It is not production approval and must not contain real patient identifiers or confidential OVR details.

## Access and setup

- [ ] Login as super admin
- [ ] Create user
- [ ] Create department
- [ ] Confirm Scenario Lab is hidden from normal users

## OVR workflow

- [ ] OVR same-department scenario
- [ ] OVR cross-department scenario
- [ ] OVR Quality validation
- [ ] OVR referral response
- [ ] OVR dispute/reopen
- [ ] Confirm cross-department notification occurs only after Quality validation

## GRC and evidence

- [ ] Evidence upload metadata
- [ ] Risk/control/project visibility
- [ ] Audit read-only access
- [ ] Normal user denial
- [ ] Export/backup denial for normal user

## UX

- [ ] Arabic/English layout check
- [ ] Responsive screen check

## Closeout

- [ ] Capture defects without patient identifiers or confidential OVR narratives
- [ ] Run \`npm run v99:cleanup-scenarios\`
- [ ] Confirm Scenario Lab registered record count is zero
`, 'utf8');

fs.writeFileSync(reportPath, `# v9.9 Final Pilot Testing Console Report

- Generated: ${generatedAt}
- Technical status: **${technicalStatus}**
- Production readiness: **Not asserted**
- Human approvals: **Not changed**
- v66 strict approval gate: **Not bypassed**

## Scenario Lab

- Exact dataset tag: \`${tag}\`
- Registered synthetic records: **${status?.total_records ?? 0}**
- Dataset available for manual testing: **${scenarioReady ? 'yes' : 'no'}**
- Cleanup boundary: private exact table/UUID registry

## v7.2 persona proof

- Authenticated personas: **${persona ? `${persona.authenticated_personas_passed}/${persona.required_persona_count}` : 'not available'}**
- Required scenarios: **${persona ? `${persona.required_scenarios_passed}/${persona.required_scenario_count}` : 'not available'}**
- Failed checks: **${persona?.failed_count ?? 'not available'}**
- Strict passed: **${persona?.strict_passed ? 'yes' : 'no'}**
- Assessment: **${personaTechnicalPass ? 'technical persona proof is internally consistent' : 'persona proof requires attention'}**

The previous avoidable mismatch was an obsolete v7.2 test transition
(\`under_quality_review\`) after the v9.8 workflow correctly moved to
\`manager_review\`. The proof now exercises the supported transition and still
fails strictly if any real authorization or cleanup check fails.

## Manual work still required

Use [manual-testing-checklist.md](./manual-testing-checklist.md).
Human governance approvals remain real manual requirements. This report does
not verify, infer, or fabricate those approvals.
${error ? `
## Error

\`\`\`text
${error.message}
\`\`\`
` : ''}
`, 'utf8');

console.log(`v9.9 final testing report: ${technicalStatus}`);
console.log(`Report: ${path.relative(root, reportPath)}`);
console.log(`Checklist: ${path.relative(root, checklistPath)}`);
if (error || !scenarioReady || !personaTechnicalPass) process.exitCode = 1;
