import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const releaseDir = path.join(root, 'release', 'v160');
fs.mkdirSync(releaseDir, { recursive: true });

const auditPath = path.join(releaseDir, 'v160-static-audit.json');
const audit = fs.existsSync(auditPath)
  ? JSON.parse(fs.readFileSync(auditPath, 'utf8'))
  : { status: 'not_run', checks: [] };

const report = `# v16.0 Compliance Management System Execution Pack

## Purpose

This pack strengthens the Compliance module into a practical compliance management system execution layer. It focuses on the professional chain:

**Obligation → Regulatory Change → Policy / Control → Compliance Test → Evidence → Issue → CAPA → Management Reporting**

## What changed

- Added a compliance execution workflow map.
- Added compliance program maturity capabilities.
- Added regulatory change pipeline examples.
- Added compliance testing calendar examples.
- Added policy attestation tracker examples.
- Enhanced the Compliance page with evidence-based closure guidance.

## Scope discipline

- No database migration added.
- No approval evidence changed.
- No UAT results fabricated.
- No proof gate weakened.
- Uses static/sample workflow panels for controlled pilot maturity only.

## Static audit status

- Status: ${audit.status}
- Checks: ${Array.isArray(audit.checks) ? audit.checks.length : 0}

## Controlled pilot note

This is a controlled compliance workflow maturity layer. It should be validated with synthetic or non-confidential compliance examples before broad operational use.
`;

fs.writeFileSync(path.join(releaseDir, 'v160-compliance-management-report.md'), report, 'utf8');
console.log('v16.0 compliance management report generated.');
