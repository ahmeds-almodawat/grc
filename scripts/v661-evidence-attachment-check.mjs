import fs from 'node:fs';
import path from 'node:path';

const strict = process.argv.includes('--strict');
const releaseDir = path.resolve('release', 'v661');
const evidenceDir = path.resolve('release', 'v66', 'evidence-attachments');
fs.mkdirSync(releaseDir, { recursive: true });
fs.mkdirSync(evidenceDir, { recursive: true });

const requiredEvidence = [
  {
    id: 'staging-migration-log',
    title: 'Fresh staging migrations applied through 045',
    acceptedPatterns: [/migration.*045/i, /045_.*\.sql/i, /supabase.*migration/i],
    examples: ['staging-migration-log.txt', 'staging-migration-screenshot.png']
  },
  {
    id: 'v64-persona-sql-output',
    title: 'v64 persona SQL tests passed',
    acceptedPatterns: [/v64.*persona/i, /persona.*sql/i, /rls.*persona/i],
    examples: ['01-v64-persona-sql-output.txt']
  },
  {
    id: 'v65-workflow-sql-output',
    title: 'v65 workflow SQL smoke tests passed',
    acceptedPatterns: [/v65.*workflow/i, /workflow.*smoke/i],
    examples: ['02-v65-workflow-sql-output.txt']
  },
  {
    id: 'v66-pilot-evidence-sql-output',
    title: 'v66 controlled pilot evidence SQL tests passed',
    acceptedPatterns: [/v66.*pilot/i, /controlled.*pilot/i, /pilot.*evidence/i],
    examples: ['03-v66-pilot-evidence-sql-output.txt']
  },
  {
    id: 'restore-dryrun-evidence',
    title: 'Restore dry-run evidence completed',
    acceptedPatterns: [/restore.*dry/i, /dryrun/i, /restore/i],
    examples: ['restore-dryrun-evidence.txt', 'restore-dryrun-screenshot.png']
  },
  {
    id: 'pilot-signoff',
    title: 'IT / Quality / Admin signoff attached',
    acceptedPatterns: [/signoff/i, /sign-off/i, /quality/i, /admin/i, /it/i],
    examples: ['pilot-signoff.md', 'quality-it-admin-signoff.pdf']
  }
];

const files = fs.readdirSync(evidenceDir, { withFileTypes: true })
  .filter((d) => d.isFile())
  .map((d) => d.name);

function matchesRequirement(requirement, filename) {
  const normalized = filename.toLowerCase();
  return requirement.examples.some((example) => example.toLowerCase() === normalized)
    || requirement.acceptedPatterns.some((pattern) => pattern.test(normalized));
}

const checks = requiredEvidence.map((requirement) => {
  const matchedFiles = files.filter((file) => matchesRequirement(requirement, file));
  return {
    id: requirement.id,
    title: requirement.title,
    status: matchedFiles.length > 0 ? 'attached' : 'missing',
    matched_files: matchedFiles,
    examples: requirement.examples
  };
});

const missing = checks.filter((c) => c.status !== 'attached');
const report = {
  generated_at: new Date().toISOString(),
  evidence_dir: path.relative(process.cwd(), evidenceDir),
  required_total: checks.length,
  attached_count: checks.length - missing.length,
  missing_count: missing.length,
  strict_passed: missing.length === 0,
  checks
};

fs.writeFileSync(path.join(releaseDir, 'v661-evidence-attachment-check.json'), JSON.stringify(report, null, 2));

const md = `# v6.6.1 Evidence Attachment Check\n\nGenerated: ${report.generated_at}\n\nEvidence folder: \`${report.evidence_dir}\`\n\n- Required: **${report.required_total}**\n- Attached: **${report.attached_count}**\n- Missing: **${report.missing_count}**\n\n## Checklist\n\n${checks.map((check) => `### ${check.status === 'attached' ? '✅' : '❌'} ${check.title}\n\n- ID: \`${check.id}\`\n- Status: **${check.status}**\n- Matched files: ${check.matched_files.length ? check.matched_files.map((f) => `\`${f}\``).join(', ') : 'none'}\n- Example filenames: ${check.examples.map((f) => `\`${f}\``).join(', ')}\n`).join('\n')}\n`;
fs.writeFileSync(path.join(releaseDir, 'V661_EVIDENCE_ATTACHMENT_CHECK.md'), md);

console.log('v6.6.1 evidence attachment check complete.');
console.log({ required_total: report.required_total, attached_count: report.attached_count, missing_count: report.missing_count, strict_passed: report.strict_passed });

if (strict && !report.strict_passed) {
  console.error('v6.6.1 strict evidence check failed. Attach missing staging evidence files under release/v66/evidence-attachments/.');
  process.exit(1);
}
