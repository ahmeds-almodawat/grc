import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'release/v250');
fs.mkdirSync(outDir, { recursive: true });

const report = `# v25.0 Live GRC Operating Workspace Report

## Purpose

v25.0 defines the controlled operating model needed before the professional GRC platform is relied on for live accreditation, executive assurance, external auditor evidence packs or production reporting.

## Professional chain

Operating Cycle → Data Intake → Edge Bridge Review → Access Review → Evidence Snapshot → Production Exception → Management Sign-off

## What this closes

- Live data intake governance
- Edge bridge / org-scoped policy review discipline
- Access review and segregation-of-duties operation
- Framework evidence snapshot expectation
- Production exception register before go-live reliance

## Security posture

The new v25 tables are RLS-enabled and authenticated access is blocked pending bridge. This pack does not introduce broad authenticated writes, delete policies or automatic production reliance.

## Next requirement

Before real production reliance, select approved data bridges, create org-scoped policies or Edge Functions, and collect reviewer evidence for access, data classification and exception handling.
`;

fs.writeFileSync(path.join(outDir, 'v250-live-grc-operating-report.md'), report);
console.log('v25.0 live GRC operating report written.');
