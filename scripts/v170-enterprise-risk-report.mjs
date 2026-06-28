import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const releaseDir = path.join(root, 'release', 'v170');
fs.mkdirSync(releaseDir, { recursive: true });

const auditPath = path.join(releaseDir, 'v170-static-audit.json');
const audit = fs.existsSync(auditPath)
  ? JSON.parse(fs.readFileSync(auditPath, 'utf8'))
  : { status: 'not_run', checks: [] };

const report = `# v17.0 Enterprise Risk Management Execution Pack

## Purpose

This pack strengthens the Risks module into a practical ERM execution layer. It focuses on the professional chain:

**Risk Identification → Assessment → Appetite / KRI → Treatment → Control Linkage → Monitoring → Escalation → Executive Risk Reporting**

## What changed

- Added an enterprise risk execution workflow map.
- Added risk appetite and KRI monitoring examples.
- Added risk treatment plan discipline.
- Added risk-control-test-evidence traceability.
- Enhanced the Risks page with an ERM closure rule and executive reporting context.

## Scope discipline

- No database migration added.
- No approval evidence changed.
- No UAT or risk results fabricated.
- No proof gate weakened.
- Uses static/sample workflow panels for controlled pilot maturity only.

## Static audit status

- Status: ${audit.status}
- Checks: ${Array.isArray(audit.checks) ? audit.checks.length : 0}

## Controlled pilot note

This is a controlled ERM workflow maturity layer. It should be validated with synthetic or non-confidential risk scenarios before broad operational use.
`;

fs.writeFileSync(path.join(releaseDir, 'v170-enterprise-risk-report.md'), report, 'utf8');
console.log('v17.0 enterprise risk report generated.');
