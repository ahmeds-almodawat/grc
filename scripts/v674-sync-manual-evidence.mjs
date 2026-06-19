import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const manualPath = path.join(root, 'release', 'v66', 'v66-manual-evidence.json');
const restoreReportPath = path.join(root, 'release', 'v674', 'v674-restore-integrity-dryrun.json');
const signoffReportPath = path.join(root, 'release', 'v674', 'v674-signoff-check.json');
const outDir = path.join(root, 'release', 'v674');
fs.mkdirSync(outDir, { recursive: true });

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function sha256(file) {
  return fs.existsSync(file)
    ? crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
    : null;
}

const manual = readJson(manualPath);
if (!manual || !Array.isArray(manual.items)) {
  console.error('release/v66/v66-manual-evidence.json is missing or invalid.');
  process.exit(1);
}

const restore = readJson(restoreReportPath);
const approvals = readJson(signoffReportPath);
const signoffInputPath = path.join(root, 'release', 'v674', 'approvals', 'pilot-signoff.json');
const confidentialityInputPath = path.join(root, 'release', 'v674', 'approvals', 'ovr-confidentiality-confirmation.json');
const approvalHashesMatch = approvals?.file_hashes?.pilot_signoff_sha256 === sha256(signoffInputPath)
  && approvals?.file_hashes?.confidentiality_confirmation_sha256 === sha256(confidentialityInputPath);
const byId = new Map(manual.items.map((item) => [item.id, item]));
const updates = [];

function sync(id, verified, note) {
  const item = byId.get(id);
  if (!item) {
    updates.push({ id, updated: false, reason: 'item_missing' });
    return;
  }
  item.status = verified ? 'verified' : 'manual_required';
  item.automation_note = note;
  item.last_checked_at = new Date().toISOString();
  updates.push({ id, updated: true, status: item.status });
}

sync(
  'backup_restore_dryrun',
  restore?.strict_passed === true,
  restore?.strict_passed
    ? 'Verified by v6.7.4 isolated local dump/restore integrity evidence.'
    : 'v6.7.4 restore integrity proof is missing or failed.'
);
sync(
  'ovr_confidentiality_no_real_patient_data',
  approvalHashesMatch && approvals?.confidentiality?.valid === true,
  approvalHashesMatch && approvals?.confidentiality?.valid
    ? 'Verified from completed IT and Quality confidentiality confirmation fields.'
    : 'Confidentiality confirmation remains incomplete, stale, or contains invalid fields.'
);
sync(
  'pilot_signoff_it_quality_admin',
  approvalHashesMatch && approvals?.signoff?.valid === true,
  approvalHashesMatch && approvals?.signoff?.valid
    ? 'Verified from completed Management/Admin, IT, and Quality approval fields.'
    : 'Human pilot signoff remains incomplete, stale, or contains invalid fields.'
);

manual.generated_at = new Date().toISOString();
manual.v674_sync = {
  restore_report: path.relative(root, restoreReportPath).replaceAll('\\', '/'),
  signoff_report: path.relative(root, signoffReportPath).replaceAll('\\', '/')
};
fs.writeFileSync(manualPath, `${JSON.stringify(manual, null, 2)}\n`, 'utf8');

const remaining = manual.items.filter((item) => item.required && item.status !== 'verified');
const report = {
  generated_at: new Date().toISOString(),
  updates,
  approval_hashes_match: approvalHashesMatch,
  required_total: manual.items.filter((item) => item.required).length,
  verified_count: manual.items.filter((item) => item.required && item.status === 'verified').length,
  missing_count: remaining.length,
  missing: remaining.map((item) => item.id),
  strict_passed: remaining.length === 0
};
fs.writeFileSync(
  path.join(outDir, 'v674-manual-evidence-sync.json'),
  `${JSON.stringify(report, null, 2)}\n`,
  'utf8'
);

console.log('v6.7.4 manual evidence synchronization complete.');
console.log({
  verified_count: report.verified_count,
  required_total: report.required_total,
  missing_count: report.missing_count,
  missing: report.missing
});
