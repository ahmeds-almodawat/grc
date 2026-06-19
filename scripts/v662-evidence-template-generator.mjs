import fs from 'node:fs';
import path from 'node:path';

const templateDir = path.resolve('release/v662/evidence-templates');
const attachmentDir = path.resolve('release/v66/evidence-attachments');
fs.mkdirSync(templateDir, { recursive: true });
fs.mkdirSync(attachmentDir, { recursive: true });

const templates = {
  'staging-migration-log.txt': `TEMPLATE - replace with real staging migration log\n\nRequired content:\n- staging project name or identifier\n- migration start/end date-time\n- migration files applied through 045_v66_controlled_pilot_evidence.sql\n- final status: PASSED / SUCCESS\n- errors, if any\n\nDo not move this template into evidence-attachments without replacing it with real output.\n`,
  '01-v64-persona-sql-output.txt': `TEMPLATE - replace with real v64 persona SQL output\n\nRequired content:\n- output from v64_persona_security_tests.sql\n- Admin / Super User / Audit / Manager / Employee checks\n- negative access checks\n- final status: PASSED / VERIFIED / SUCCESS\n\nDo not move this template into evidence-attachments without replacing it with real output.\n`,
  '02-v65-workflow-sql-output.txt': `TEMPLATE - replace with real v65 workflow SQL output\n\nRequired content:\n- output from v65_workflow_smoke_tests.sql\n- project / evidence / approval / OVR workflow checks\n- final status: PASSED / VERIFIED / SUCCESS\n\nDo not move this template into evidence-attachments without replacing it with real output.\n`,
  '03-v66-pilot-evidence-sql-output.txt': `TEMPLATE - replace with real v66 pilot evidence SQL output\n\nRequired content:\n- output from v66_controlled_pilot_evidence_tests.sql\n- evidence register checks\n- go/no-go evidence checks\n- final status: PASSED / VERIFIED / SUCCESS\n\nDo not move this template into evidence-attachments without replacing it with real output.\n`,
  'restore-dryrun-evidence.txt': `TEMPLATE - replace with real restore dry-run evidence\n\nRequired content:\n- backup source identified\n- database restored to staging\n- critical table counts verified\n- evidence storage samples verified\n- application smoke test after restore\n- final status: RESTORE VERIFIED / PASSED\n\nDo not move this template into evidence-attachments without replacing it with real output.\n`,
  'pilot-signoff.md': `# TEMPLATE - replace with real pilot signoff\n\nDo not move this template into evidence-attachments without completing real signatures/approvals.\n\n## Signoff\n\n- IT owner: TODO\n- Quality owner: TODO\n- Admin/GRC owner: TODO\n- Date: TODO\n\n## Decision\n\nStatus: TODO - Approved / Go / Not approved\n\n## Scope\n\n5-15 trusted users only. No real patient identifiers or confidential OVR data until staging proof is accepted.\n`
};

for (const [name, content] of Object.entries(templates)) {
  fs.writeFileSync(path.join(templateDir, name), content);
}

const readme = `# v6.6.2 Evidence Templates\n\nThese are templates only. They are intentionally generated outside the required evidence folder.\n\nDo not copy a template into \`release/v66/evidence-attachments/\` unless you replace the content with real staging output. The quality gate rejects files containing TEMPLATE, TODO, or placeholder wording.\n\nRequired final folder:\n\n\`\`\`text\nrelease/v66/evidence-attachments/\n\`\`\`\n`;
fs.writeFileSync(path.join(templateDir, 'README.md'), readme);

console.log('v6.6.2 evidence templates generated.');
console.log({ template_dir: 'release/v662/evidence-templates', attachment_dir: 'release/v66/evidence-attachments', templates: Object.keys(templates).length });
