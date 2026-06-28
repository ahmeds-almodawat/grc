import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const releaseDir = path.join(root, 'release', 'v210');
const reportPath = path.join(releaseDir, 'v210-framework-crosswalk-report.md');

const auditPath = path.join(releaseDir, 'v210-static-audit.json');
const audit = fs.existsSync(auditPath)
  ? JSON.parse(fs.readFileSync(auditPath, 'utf8'))
  : { status: 'not_run', critical: null, high: null, medium: null, injected_pages: [] };

const markdown = `# v21.0 Framework Crosswalk + Live GRC Backbone Report

Generated: ${new Date().toISOString()}

## Purpose

v21 adds the professional crosswalk backbone required to connect the platform to general international GRC, compliance, risk and audit expectations.

## Professional chain

\`\`\`text
Requirement → Risk → Control → Test → Evidence → Issue → CAPA → Closure → Report
\`\`\`

## Framework coverage model

- ISO 31000 risk management alignment
- COSO ERM strategy, performance and board reporting alignment
- ISO 37301 compliance management system alignment
- IIA Global Internal Audit Standards alignment
- Optional extensions for ISO 27001, NIST CSF, SOC 2 and CBAHI

## Add-only database contract

- v210_frameworks
- v210_framework_requirements
- v210_framework_mappings
- v210_grc_relationships
- v210_scope_assets

The migration enables RLS and intentionally avoids broad authenticated policies. Live UI writes should be added only through reviewed organization-scoped policies or authenticated Edge bridges.

## UI injection result

Injected pages:

${(audit.injected_pages ?? []).map(page => `- ${page}`).join('\n') || '- Not available; run npm run v210:framework-crosswalk-audit first.'}

## Static audit

- Status: ${audit.status}
- Critical: ${audit.critical}
- High: ${audit.high}
- Medium: ${audit.medium}

## Recommendation

Use v21 as the backbone for v22 control testing/CAPA execution, v23 compliance-policy-vendor-incident hardening, and v24 external-auditor evidence pack.
`;

fs.mkdirSync(releaseDir, { recursive: true });
fs.writeFileSync(reportPath, markdown, 'utf8');

console.log('v21.0 framework crosswalk report written.');
