import fs from 'node:fs';
import path from 'node:path';

const releaseDir = path.resolve('release', 'v661');
const sqlDir = path.join(releaseDir, 'staging-sql');
fs.mkdirSync(sqlDir, { recursive: true });

const files = [
  { order: '01', source: 'supabase/tests/v64_persona_security_tests.sql', target: '01_v64_persona_security_tests.sql', purpose: 'Persona/RLS isolation proof' },
  { order: '02', source: 'supabase/tests/v65_workflow_smoke_tests.sql', target: '02_v65_workflow_smoke_tests.sql', purpose: 'Workflow smoke proof' },
  { order: '03', source: 'supabase/tests/v66_controlled_pilot_evidence_tests.sql', target: '03_v66_controlled_pilot_evidence_tests.sql', purpose: 'Controlled pilot evidence proof' }
];

const copied = [];
for (const file of files) {
  const sourcePath = path.resolve(file.source);
  const targetPath = path.join(sqlDir, file.target);
  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, targetPath);
    copied.push({ ...file, exists: true, copied_to: path.relative(process.cwd(), targetPath).replaceAll('\\\\', '/') });
  } else {
    copied.push({ ...file, exists: false, copied_to: null });
  }
}

const sequence = `-- v6.6.1 staging SQL execution sequence\n-- Run these files in staging Supabase SQL editor in this order.\n-- Do not run against production.\n\n-- 1) ${files[0].purpose}\n-- File: release/v661/staging-sql/${files[0].target}\n\n-- 2) ${files[1].purpose}\n-- File: release/v661/staging-sql/${files[1].target}\n\n-- 3) ${files[2].purpose}\n-- File: release/v661/staging-sql/${files[2].target}\n\n-- After each run, export/copy the successful SQL output into:\n-- release/v66/evidence-attachments/\n`;
fs.writeFileSync(path.join(sqlDir, '00_READ_ME_RUN_ORDER.sql'), sequence);

const md = `# v6.6.1 Staging SQL Pack\n\nRun in a **fresh staging Supabase project only**.\n\n${copied.map((file) => `- ${file.exists ? '✅' : '❌'} ${file.order}. ${file.purpose}: \`${file.copied_to || file.source}\``).join('\n')}\n\nAttach the SQL outputs under:\n\n\`release/v66/evidence-attachments/\`\n\nRecommended filenames:\n\n- \`01-v64-persona-sql-output.txt\`\n- \`02-v65-workflow-sql-output.txt\`\n- \`03-v66-pilot-evidence-sql-output.txt\`\n`;
fs.writeFileSync(path.join(releaseDir, 'V661_STAGING_SQL_PACK.md'), md);
fs.writeFileSync(path.join(releaseDir, 'v661-staging-sql-pack.json'), JSON.stringify({ generated_at: new Date().toISOString(), files: copied }, null, 2));

console.log('v6.6.1 staging SQL pack generated.');
console.log({ copied_count: copied.filter((f) => f.exists).length, missing_count: copied.filter((f) => !f.exists).length });
