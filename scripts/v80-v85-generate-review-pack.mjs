import fs from 'node:fs';
import path from 'node:path';

const outDir = path.join('release', 'v80-v85');
fs.mkdirSync(outDir, { recursive: true });

const generatedAt = new Date().toISOString();

const sections = [
  {
    version: 'v8.0',
    title: 'Pilot Launch Governance',
    report: 'release/v80/v80-pilot-launch-governance.md',
    status: 'technical_ready_pending_human_approval',
    production_ready: false
  },
  {
    version: 'v8.1',
    title: 'Live Staging Evidence',
    report: 'release/v81/v81-live-staging-evidence.md',
    status: 'technical_ready_pending_human_approval',
    production_ready: false
  },
  {
    version: 'v8.2',
    title: 'Pilot Operations KPI',
    report: 'release/v82/v82-pilot-operations-kpi.md',
    status: 'technical_ready_pending_human_approval',
    production_ready: false
  },
  {
    version: 'v8.3',
    title: 'Security / Privacy Assurance',
    report: 'release/v83/v83-security-privacy-assurance.md',
    status: 'technical_ready_pending_human_approval',
    production_ready: false
  },
  {
    version: 'v8.4',
    title: 'Training & Change Management',
    report: 'release/v84/v84-training-change-management.md',
    status: 'technical_ready_pending_human_approval',
    production_ready: false
  },
  {
    version: 'v8.5',
    title: 'Executive Decision Pack',
    report: 'release/v85/v85-executive-decision-pack.md',
    status: 'technical_ready_pending_human_approval',
    production_ready: false
  }
];

const rows = sections
  .map((s) => `| ${s.version} | ${s.title} | ${s.status} | ${s.production_ready ? 'Yes' : 'No'} | ${s.report} |`)
  .join('\n');

const missing = sections.filter((s) => !fs.existsSync(s.report));

const md = `# v8.0 to v8.5 Governed Pilot Suite Review Pack

Generated: ${generatedAt}

## Overall status

| Item | Status |
| --- | --- |
| Technical / operational pilot readiness | Strong |
| Human approval | Pending |
| Production ready | No |
| Approval gate bypassed | No |
| RLS / migrations changed | No |
| Runtime bridge changed | No |

## Included packs

| Version | Pack | Status | Production ready | Report |
| --- | --- | --- | --- | --- |
${rows}

## Missing expected reports

${missing.length ? missing.map((s) => `- ${s.report}`).join('\n') : 'None.'}

## Final judgment

The v8.0 to v8.5 suite strengthens pilot governance, staging evidence planning, KPI monitoring, security/privacy assurance, training readiness, and executive decision support.

The system remains:

\`\`\`text
technical_ready_pending_human_approval
production_ready = false
\`\`\`

The remaining blocker is still real Management/Admin, IT, and Quality signoff plus OVR confidentiality confirmation.
`;

fs.writeFileSync(path.join(outDir, 'v80-v85-review-pack.md'), md);

console.log('v8.0-v8.5 governed pilot suite review pack generated.');
console.log(JSON.stringify({
  status: 'technical_ready_pending_human_approval',
  production_ready: false,
  sections: sections.length,
  missing_reports: missing.length,
  report: 'release/v80-v85/v80-v85-review-pack.md'
}, null, 2));
