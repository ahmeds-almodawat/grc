import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();

const allowlistedPaths = [
  'release/v62',
  'release/v64',
  'release/v66',
  'release/v661',
  'release/v662',
  'release/v663',
  'release/v672',
  'release/v673',
  'release/v674',
  'release/v700',
  'release/v72',
  'release/patch43',
  'release/patch44',
  'release/patch45',
  'release/patch46',
  'release/patch47',
  'release/patch48',
  'release/patch49',
  'release/patch50',
  'release/patch51',
  'release/patch52',
  'release/patch53',
  'release/patch54',
  'release/patch55',
  'release/patch56/patch56-proof-release-script-consolidation-proof.json',
  'release/patch57/patch57-production-operator-console-proof.json',
  'release/patch58/patch58-production-evidence-closure-proof.json',
  'release/patch58-1/patch58-1-validation-runtime-optimization-proof.json',
  'release/patch58-2/patch58-2-repo-hygiene-release-noise-proof.json',
  'release/patch61/patch61-evidence-ownership-due-date-readiness-proof.json',
  'release/patch62/patch62-executive-closure-recommendation-readiness-proof.json',
  'release/patch63/patch63-department-evidence-coverage-readiness-proof.json',
  'release/patch64/patch64-policy-sop-attestation-evidence-readiness-proof.json',
  'release/patch65/patch65-backup-restore-dr-evidence-readiness-proof.json',
  'release/patch66/patch66-access-review-security-evidence-readiness-proof.json',
  'release/patch67/patch67-training-adoption-support-evidence-readiness-proof.json',
  'release/patch68/patch68-controlled-evidence-closure-actions-proof.json',
  'release/patch69/patch69-executive-go-no-go-decision-pack-proof.json',
  'release/patch70/patch70-department-launch-final-readiness-workflow-proof.json',
  'release/patch71/patch71-live-data-quality-role-integrity-proof.json',
  'release/patch72/patch72-uat-pack-hospital-pilot-acceptance-proof.json',
  'release/patch73/patch73-live-support-incident-readiness-proof.json',
  'release/patch74/patch74-final-security-access-review-pack-proof.json',
  'release/patch75/patch75-clinical-ux-navigation-simplification-proof.json',
  'release/patch76/patch76-controlled-production-authority-cutover-gate-proof.json',
  'release/patch77/patch77-live-pilot-execution-issue-burndown-proof.json',
  'release/patch78/patch78-identity-role-data-integrity-hardening-proof.json',
  'release/patch79/patch79-production-operations-hypercare-board-pack-proof.json',
  'release/patch80a/patch80a-performance-smoothness-optimization-proof.json',
  'release/patch82/patch82-staging-migration-rehearsal-evidence-proof.json',
  'release/patch82b/patch82b-interactive-dashboard-ui-polish-proof.json',
  'release/patch82c/patch82c-operational-dashboard-interactivity-proof.json',
  'release/patch82e/patch82e-record-level-dashboard-drilldown-proof.json',
  'release/patch82f/patch82f-employee-id-login-alias-proof.json',
];

const existing = [];
const skipped = [];

for (const relPath of allowlistedPaths) {
  const fullPath = path.join(root, relPath);
  const tracked = spawnSync('git', ['ls-files', '--', relPath], {
    cwd: root,
    encoding: 'utf8',
    shell: false,
  }).stdout.trim();
  if (fs.existsSync(fullPath) && tracked) {
    existing.push(relPath);
  } else {
    skipped.push(relPath);
  }
}

if (existing.length) {
  const result = spawnSync('git', ['restore', '--', ...existing], {
    cwd: root,
    encoding: 'utf8',
    shell: false,
  });

  if (result.status !== 0) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    console.error('Failed to restore generated release noise.');
    process.exit(result.status || 1);
  }
}

console.log(JSON.stringify({
  status: 'completed',
  restored_paths: existing,
  skipped_missing_paths: skipped,
}, null, 2));
