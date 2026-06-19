import fs from 'node:fs';
import path from 'node:path';

const outDir = path.resolve('release/v662');
const sqlOutDir = path.join(outDir, 'staging-sql');
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(sqlOutDir, { recursive: true });

const requiredEvidence = [
  'staging-migration-log.txt',
  '01-v64-persona-sql-output.txt',
  '02-v65-workflow-sql-output.txt',
  '03-v66-pilot-evidence-sql-output.txt',
  'restore-dryrun-evidence.txt',
  'pilot-signoff.md'
];

const sqlDefinitions = [
  {
    canonical: '01-v64-persona-security-tests.sql',
    sources: [
      'release/v661/staging-sql/01_v64_persona_security_tests.sql',
      'release/v661/staging-sql/v64_persona_security_tests.sql',
      'supabase/tests/v64_persona_security_tests.sql'
    ]
  },
  {
    canonical: '02-v65-workflow-smoke-tests.sql',
    sources: [
      'release/v661/staging-sql/02_v65_workflow_smoke_tests.sql',
      'release/v661/staging-sql/v65_workflow_smoke_tests.sql',
      'supabase/tests/v65_workflow_smoke_tests.sql'
    ]
  },
  {
    canonical: '03-v66-pilot-evidence-tests.sql',
    sources: [
      'release/v661/staging-sql/03_v66_controlled_pilot_evidence_tests.sql',
      'release/v661/staging-sql/v66_controlled_pilot_evidence_tests.sql',
      'supabase/tests/v66_controlled_pilot_evidence_tests.sql'
    ]
  }
];

const sqlStatus = sqlDefinitions.map((item) => {
  const source = item.sources.map((s) => path.resolve(s)).find((p) => fs.existsSync(p));
  const destination = path.join(sqlOutDir, item.canonical);
  if (source) fs.copyFileSync(source, destination);
  return {
    name: item.canonical,
    exists: Boolean(source) && fs.existsSync(destination),
    source: source ? path.relative(process.cwd(), source).replaceAll('\\', '/') : null,
    destination: path.relative(process.cwd(), destination).replaceAll('\\', '/')
  };
});

const runOrderPath = path.resolve('release/v661/V661_STAGING_RUN_ORDER.md');
const runOrderNote = fs.existsSync(runOrderPath)
  ? `\nA v6.6.1 run-order file is also available at \`${path.relative(process.cwd(), runOrderPath).replaceAll('\\', '/')}\`.\n`
  : '';

const md = `# v6.6.2 / v6.6.3 Staging Command Pack\n\nThis file is for staging evidence capture only. Do not run these steps against production.\n\n## Current purpose\n\nConvert the local technical readiness into real staging proof by applying migrations in a fresh staging Supabase project, running persona/workflow SQL tests, and saving the outputs as evidence.\n\n## Safety rule\n\nUse a fresh staging Supabase project or a disposable staging branch. Do not use live patient, MRN, national ID, or confidential OVR data.\n${runOrderNote}\n## Required evidence folder\n\nSave final evidence files here:\n\n\`\`\`text\nrelease/v66/evidence-attachments/\n\`\`\`\n\n## Required evidence files\n\n${requiredEvidence.map((f, i) => `${i + 1}. \`${f}\``).join('\n')}\n\n## SQL files prepared for staging\n\n${sqlStatus.map(s => `- ${s.exists ? '✅' : '❌'} \`${s.destination}\`${s.source ? ` from \`${s.source}\`` : ''}`).join('\n')}\n\n## Staging run order\n\n1. Create or reset a staging Supabase project.\n2. Apply all migrations from \`supabase/migrations\` in order through \`045_v66_controlled_pilot_evidence.sql\`.\n3. Save the migration output/log as:\n\n\`\`\`text\nrelease/v66/evidence-attachments/staging-migration-log.txt\n\`\`\`\n\n4. Run this SQL in staging and save the output as \`01-v64-persona-sql-output.txt\`:\n\n\`\`\`text\nrelease/v662/staging-sql/01-v64-persona-security-tests.sql\n\`\`\`\n\n5. Run this SQL in staging and save the output as \`02-v65-workflow-sql-output.txt\`:\n\n\`\`\`text\nrelease/v662/staging-sql/02-v65-workflow-smoke-tests.sql\n\`\`\`\n\n6. Run this SQL in staging and save the output as \`03-v66-pilot-evidence-sql-output.txt\`:\n\n\`\`\`text\nrelease/v662/staging-sql/03-v66-pilot-evidence-tests.sql\n\`\`\`\n\n7. Perform the restore dry-run and save the proof as:\n\n\`\`\`text\nrelease/v66/evidence-attachments/restore-dryrun-evidence.txt\n\`\`\`\n\n8. Complete IT / Quality / Admin approval and save as:\n\n\`\`\`text\nrelease/v66/evidence-attachments/pilot-signoff.md\n\`\`\`\n\n9. Run:\n\n\`\`\`powershell\nnpm run v662:strict-proof\n\`\`\`\n\n## Expected final status\n\n\`\`\`text\nquality_status: ready_for_controlled_pilot_evidence_review\nstrict_passed: true\n\`\`\`\n`;

fs.writeFileSync(path.join(outDir, 'V662_STAGING_COMMAND_PACK.md'), md);
fs.writeFileSync(path.join(outDir, 'v662-staging-command-pack.json'), JSON.stringify({
  generated_at: new Date().toISOString(),
  required_evidence: requiredEvidence,
  sql_files: sqlStatus,
  warning: 'Generated command pack only. Real proof must come from staging outputs.'
}, null, 2));

console.log('v6.6.2/v6.6.3 staging command pack generated.');
console.log({ required_evidence: requiredEvidence.length, sql_files_present: sqlStatus.filter(s => s.exists).length, sql_files_expected: sqlStatus.length });
if (sqlStatus.some(s => !s.exists)) {
  process.exitCode = 1;
}
