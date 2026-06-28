import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const releaseDir = path.join(root, 'release', 'v180');
fs.mkdirSync(releaseDir, { recursive: true });

const auditPath = path.join(releaseDir, 'v180-static-audit.json');
const audit = fs.existsSync(auditPath) ? JSON.parse(fs.readFileSync(auditPath, 'utf8')) : null;
const status = audit?.status ?? 'not_run';

const report = `# v18.0 GRC Traceability + Assurance Map Report

## Status

${status === 'passed' ? 'PASSED' : 'NOT PASSED'}

## Purpose

v18.0 connects the professional GRC execution packs into one assurance view instead of leaving risk, compliance, audit, evidence and governance as separate screens.

## Professional chain

Risk → Control → Test → Evidence → Issue → CAPA → Audit → Compliance → Board Reporting

## What this pack adds

- Cross-module traceability model.
- Visual GRC traceability chain.
- Three-line assurance map.
- Traceability gap and go/no-go warnings.
- Executive visibility over evidence-based closure requirements.

## Important limitation

This pack does not create fake UAT results and does not claim production readiness. It creates the structure needed to review real pilot evidence.

## Static audit summary

- Status: ${status}
- Critical failures: ${audit?.summary?.critical ?? 'not run'}
- High failures: ${audit?.summary?.high ?? 'not run'}
- Medium warnings: ${audit?.summary?.medium ?? 'not run'}
`;

fs.writeFileSync(path.join(releaseDir, 'v180-grc-traceability-report.md'), report);
console.log('v18.0 traceability report written.');
