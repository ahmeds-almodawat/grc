#!/usr/bin/env node
import { readText, writeMd } from './v75-common.mjs';

const generatedAt = new Date().toISOString();

const sections = [
  ['Controlled-Pilot Readiness Dashboard', 'release/v75/controlled-pilot-readiness-dashboard.md'],
  ['Human Approval Checklist', 'release/v75/human-approval-checklist.md'],
  ['Executive Controlled-Pilot Readout', 'release/v75/executive-controlled-pilot-readout.md'],
  ['Pilot Runbook', 'docs/PILOT_RUNBOOK.md'],
  ['Pilot Approval SOP', 'docs/PILOT_APPROVAL_SOP.md'],
  ['OVR Confidentiality SOP', 'docs/OVR_CONFIDENTIALITY_SOP.md'],
  ['Data Handling Policy', 'docs/DATA_HANDLING_POLICY.md'],
  ['UAT Plan', 'docs/UAT_PLAN.md'],
  ['Operations Support Model', 'docs/OPERATIONS_SUPPORT_MODEL.md'],
  ['Incident Response Playbook', 'docs/INCIDENT_RESPONSE_PLAYBOOK.md'],
  ['Post-Pilot Exit Criteria', 'docs/POST_PILOT_EXIT_CRITERIA.md']
];

let md = `# v7.5 Controlled-Pilot Review Pack\n\nGenerated: ${generatedAt}\n\nThis pack consolidates v7.5 pilot-readiness evidence and operating guidance. It does not approve the pilot, does not fake human signoff, and does not mark the platform production ready.\n\n`;

for (const [title, relPath] of sections) {
  const content = readText(relPath, '').trim();
  md += `\n---\n\n## ${title}\n\n`;
  if (content) {
    md += content.replace(/^# .+$/m, '').trimStart();
  } else {
    md += `_Missing section source: ${relPath}_\n`;
  }
  md += '\n';
}

md += `\n---\n\n## Final non-production statement\n\nThe platform remains not production ready until a separate production-readiness phase is completed, including staging/live validation, environment deployment proof, operational support approval, and formal go-live signoff.\n`;

writeMd('release/v75/v75-controlled-pilot-review-pack.md', md);

console.log('v7.5 controlled-pilot review pack generated.');
console.log(JSON.stringify({ report: 'release/v75/v75-controlled-pilot-review-pack.md' }, null, 2));
