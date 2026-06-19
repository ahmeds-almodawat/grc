import fs from 'node:fs';
import path from 'node:path';

const releaseDir = path.resolve('release', 'v611');
fs.mkdirSync(releaseDir, { recursive: true });

function readJson(relPath) {
  const fullPath = path.resolve(relPath);
  if (!fs.existsSync(fullPath)) return null;
  try { return JSON.parse(fs.readFileSync(fullPath, 'utf8')); } catch { return null; }
}

const registry = readJson('release/v611/v611-registry-sanitize-report.json');
const migration = readJson('release/v611/v611-migration-prefix-cleanup-plan.json');
const version = readJson('release/v611/v611-version-truth-report.json');
const v61Migration = readJson('release/v61/v61-migration-manifest-summary.json');
const capability = readJson('release/v61/v61-capability-register.json') || readJson('release/v61/v61-capability-register-summary.json');
const evidence = readJson('release/v61/v61-generated-evidence-audit.json') || readJson('release/v61/v61-generated-evidence-summary.json');

const summary = {
  generated_at: new Date().toISOString(),
  typecheck_and_build: 'must be confirmed by npm run v611:all output',
  package_lock_registry_cleaned: registry ? registry.lock_resolved_url_replacements : null,
  npmrc_registry_set: registry ? Boolean(registry.npmrc_changed || registry.npmrc_created) : null,
  migration_count: v61Migration?.migration_count ?? migration?.migration_count ?? null,
  latest_migration: v61Migration?.latest_migration ?? null,
  migration_prefix_gaps: migration?.prefix_gaps ?? v61Migration?.prefix_gaps ?? null,
  migration_duplicate_prefixes: migration?.duplicate_prefixes?.length ?? (Array.isArray(v61Migration?.duplicate_prefixes) ? v61Migration.duplicate_prefixes.length : null),
  proposed_migration_renames: migration?.proposed_renames?.length ?? null,
  canonical_version: version?.canonical?.baselineVersion ?? null,
  historical_version_labels_found: version?.unique_version_labels_found ?? null,
  capability_status: capability ? { total: capability.total, unverified: capability.unverified, partially_verified: capability.partially_verified } : null,
  evidence_status: evidence ? { files_scanned: evidence.files_scanned, generated_or_unverified_files: evidence.generated_or_unverified_files } : null,
  production_note: 'This is a truthful baseline cleanup report. It is not proof of auth, RLS, restore, or workflow execution.'
};

const md = [
  '# v6.1.1 Production Baseline Cleanup Report',
  '',
  `Generated: ${summary.generated_at}`,
  '',
  '## Confirmed by this baseline',
  '',
  `- Package pin strict: expected to be confirmed by \`npm run v61:pin-strict\`.`,
  `- Internal registry lock replacements: **${summary.package_lock_registry_cleaned ?? 'not run'}**`,
  `- Migration count: **${summary.migration_count ?? 'unknown'}**`,
  `- Latest migration: **${summary.latest_migration ?? 'unknown'}**`,
  `- Migration prefix gaps: **${Array.isArray(summary.migration_prefix_gaps) ? (summary.migration_prefix_gaps.join(', ') || 'none') : 'unknown'}**`,
  `- Duplicate migration prefixes: **${summary.migration_duplicate_prefixes ?? 'unknown'}**`,
  `- Proposed migration renames: **${summary.proposed_migration_renames ?? 'unknown'}**`,
  `- Canonical baseline version: **${summary.canonical_version ?? 'unknown'}**`,
  `- Historical version labels still present: **${summary.historical_version_labels_found ?? 'unknown'}**`,
  '',
  '## Still not production proof',
  '',
  '- Authentication shell is not yet implemented/proven.',
  '- RLS is not yet rewritten/proven by executable persona tests.',
  '- Restore dry-run remains manual/not verified until executed in staging.',
  '- Workflow tests are still artifact/script checks, not browser/API E2E tests.',
  '- Historical version labels are reported, not removed automatically.',
  '',
  '## Next recommended patch',
  '',
  'Move to **v6.2 Real No-Mock Data Layer**: replace raw arrays/object fallback behavior with typed `live | empty | unauthorized | configuration_error | query_error` results and AST-based production data checks.',
  ''
].join('\n');

fs.writeFileSync(path.join(releaseDir, 'v611-baseline-cleanup-summary.json'), JSON.stringify(summary, null, 2) + '\n');
fs.writeFileSync(path.join(releaseDir, 'V611_BASELINE_CLEANUP_REPORT.md'), md);
console.log('v6.1.1 baseline cleanup report generated.');
console.log(JSON.stringify(summary, null, 2));
