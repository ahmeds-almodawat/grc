import { status, productionReady, writeMarkdown, markdownTable, finalBoundary, generatedAt } from './v95-common.mjs';

const rows = [
  ['Management/Admin', 'Review controlled-pilot scope and decision. Enter real name, role, date, decision, and scope.'],
  ['IT', 'Review technical evidence, restore proof, security definer audit, runtime bridge audit, and controlled-pilot limits.'],
  ['Quality', 'Review OVR confidentiality limits, pilot boundaries, and quality acceptance responsibilities.'],
  ['IT Confidentiality Reviewer', 'Confirm no real patient identifiers, no confidential OVR details, and controlled-pilot users only.'],
  ['Quality Confidentiality Reviewer', 'Confirm confidentiality boundaries and controlled-pilot scope.']
];

const md = `# v9.5 Approver Action Drafts

Generated: ${generatedAt()}

These are working notes for approvers. They are not approval values and must not be copied as fake signoff.

${markdownTable(['Approver', 'Action'], rows)}

## Boundary

${finalBoundary()}
`;

const report = writeMarkdown('approver-action-drafts.md', md);
console.log('v9.5 approver action drafts generated.');
console.log(JSON.stringify({ status, production_ready: productionReady, approvers: rows.length, report }, null, 2));
