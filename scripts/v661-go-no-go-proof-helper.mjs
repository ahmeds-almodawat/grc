import fs from 'node:fs';
import path from 'node:path';

const strict = process.argv.includes('--strict');
const releaseDir = path.resolve('release', 'v661');
fs.mkdirSync(releaseDir, { recursive: true });

const evidenceCheckPath = path.join(releaseDir, 'v661-evidence-attachment-check.json');
const v66GatePath = path.resolve('release', 'v66', 'v66-go-no-go-gate.json');
let evidence = null;
if (fs.existsSync(evidenceCheckPath)) {
  evidence = JSON.parse(fs.readFileSync(evidenceCheckPath, 'utf8'));
}
let v66Gate = null;
if (fs.existsSync(v66GatePath)) {
  v66Gate = JSON.parse(fs.readFileSync(v66GatePath, 'utf8'));
}

const blockers = [];
if (!evidence) blockers.push('Run npm run v661:evidence first.');
if (evidence && evidence.missing_count > 0) blockers.push(`${evidence.missing_count} required manual evidence attachments are missing.`);
if (
  !fs.existsSync(path.resolve('release', 'v64', 'v64-database-security-proof-report.json'))
  && !fs.existsSync(path.resolve('release', 'v64', 'v64-database-security-proof-summary.json'))
) blockers.push('v64 database security proof report is missing.');
if (!fs.existsSync(path.resolve('test-results')) && !fs.existsSync(path.resolve('playwright-report'))) blockers.push('No Playwright test-results/playwright-report folder found. Run npm run test:real.');

const status = blockers.length === 0 ? 'ready_for_controlled_pilot_review' : 'not_ready_manual_evidence_required';
const report = {
  generated_at: new Date().toISOString(),
  status,
  blocker_count: blockers.length,
  blockers,
  evidence_summary: evidence ? {
    required_total: evidence.required_total,
    attached_count: evidence.attached_count,
    missing_count: evidence.missing_count
  } : null,
  previous_v66_gate: v66Gate || null,
  controlled_pilot_rule: 'Only 5-15 trusted users; no real patient identifiers or confidential OVR data until staging proof is complete and signed off.'
};

fs.writeFileSync(path.join(releaseDir, 'v661-go-no-go-proof.json'), JSON.stringify(report, null, 2));
const md = `# v6.6.1 Go/No-Go Proof Helper\n\nGenerated: ${report.generated_at}\n\nStatus: **${report.status}**\n\nBlockers: **${report.blocker_count}**\n\n${blockers.length ? blockers.map((b) => `- ❌ ${b}`).join('\n') : '- ✅ No helper-detected blockers.'}\n\n## Controlled pilot rule\n\n${report.controlled_pilot_rule}\n`;
fs.writeFileSync(path.join(releaseDir, 'V661_GO_NO_GO_PROOF_HELPER.md'), md);

console.log('v6.6.1 go/no-go proof helper generated.');
console.log({ status: report.status, blocker_count: report.blocker_count });

if (strict && blockers.length > 0) {
  console.error('v6.6.1 strict proof failed. Complete evidence attachments and rerun.');
  process.exit(1);
}
