import fs from 'node:fs';
import path from 'node:path';

const cleanupPath = path.resolve('release/v67/v67-real-data-cleanup-report.json');
const auditPath = path.resolve('release/v62/v62-real-data-static-audit.json');
const progressPath = path.resolve('release/v663/v663-progress-consistency-audit.json');

const readJson = (file) => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
const cleanup = readJson(cleanupPath);
const audit = readJson(auditPath);
const progress = readJson(progressPath);

const report = {
  generated_at: new Date().toISOString(),
  cleanup_changed_files: cleanup?.changed_files ?? null,
  v62_production_blocking_findings: audit?.production_blocking_findings ?? null,
  v62_medium_findings: audit?.medium ?? null,
  manual_evidence_missing: progress?.manual_evidence_missing ?? null,
  status: (audit && audit.production_blocking_findings === 0) ? 'real_data_static_blockers_clear_pending_manual_evidence' : 'needs_real_data_static_cleanup'
};
fs.mkdirSync('release/v67', { recursive: true });
fs.writeFileSync('release/v67/v67-cleanup-status.json', JSON.stringify(report, null, 2) + '\n');
console.log('v6.7 cleanup status generated.');
console.log(report);
