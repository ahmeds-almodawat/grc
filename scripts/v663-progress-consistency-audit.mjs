import fs from 'node:fs';
import path from 'node:path';

const outDir = path.resolve('release/v663');
fs.mkdirSync(outDir, { recursive: true });

function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

const pkg = readJson('package.json', {});
const scripts = pkg.scripts || {};
const devDeps = pkg.devDependencies || {};
const deps = { ...(pkg.dependencies || {}), ...devDeps };
const unstableDeps = Object.entries(deps)
  .filter(([, version]) => typeof version === 'string' && /^(\^|~|latest|\*)/.test(version))
  .map(([name, version]) => ({ name, version }));

const migrationsDir = path.resolve('supabase/migrations');
const migrationFiles = fs.existsSync(migrationsDir)
  ? fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort()
  : [];
const prefixes = migrationFiles.map(f => Number((f.match(/^(\d+)/) || [])[1])).filter(Number.isFinite);
const duplicatePrefixes = [...new Set(prefixes.filter((p, idx) => prefixes.indexOf(p) !== idx))];
const prefixGaps = [];
if (prefixes.length) {
  for (let i = Math.min(...prefixes); i <= Math.max(...prefixes); i++) {
    if (!prefixes.includes(i)) prefixGaps.push(i);
  }
}

const requiredScripts = [
  'v60:strict', 'v64:strict-all', 'test:real', 'v66:all', 'v661:all', 'v662:all', 'v662:strict-proof'
];
const missingScripts = requiredScripts.filter(name => !scripts[name]);

const requiredSql = [
  'release/v662/staging-sql/01-v64-persona-security-tests.sql',
  'release/v662/staging-sql/02-v65-workflow-smoke-tests.sql',
  'release/v662/staging-sql/03-v66-pilot-evidence-tests.sql'
];
const missingSql = requiredSql.filter(f => !fs.existsSync(path.resolve(f)));

const requiredEvidence = [
  'release/v66/evidence-attachments/staging-migration-log.txt',
  'release/v66/evidence-attachments/01-v64-persona-sql-output.txt',
  'release/v66/evidence-attachments/02-v65-workflow-sql-output.txt',
  'release/v66/evidence-attachments/03-v66-pilot-evidence-sql-output.txt',
  'release/v66/evidence-attachments/restore-dryrun-evidence.txt',
  'release/v66/evidence-attachments/pilot-signoff.md'
];
const attachedEvidence = requiredEvidence.filter(f => fs.existsSync(path.resolve(f)) && fs.statSync(path.resolve(f)).size > 40);
const missingEvidence = requiredEvidence.filter(f => !attachedEvidence.includes(f));

const v62Report = readJson('release/v62/v62-real-data-static-audit.json', {});
const v60Report = readJson('release/v60/v60-production-data-audit.json', {});
const v64Report = readJson(
  'release/v64/v64-database-security-proof-report.json',
  readJson('release/v64/v64-database-security-proof-summary.json', {})
);
const v662Quality = readJson('release/v662/v662-evidence-quality-gate.json', {});

const blockers = [];
if (unstableDeps.length) blockers.push(`${unstableDeps.length} unstable package version range(s) remain`);
if (prefixGaps.length || duplicatePrefixes.length) blockers.push('Migration prefix gaps or duplicate prefixes remain');
if (missingScripts.length) blockers.push(`${missingScripts.length} expected package script(s) missing`);
if (missingSql.length) blockers.push(`${missingSql.length} staging SQL command pack file(s) missing`);
if ((v62Report.production_blocking_findings || 0) > 0) blockers.push(`v6.2 real-data static audit still reports ${v62Report.production_blocking_findings} production-blocking finding(s)`);
if (missingEvidence.length) blockers.push(`${missingEvidence.length} manual staging evidence attachment(s) missing`);

const report = {
  generated_at: new Date().toISOString(),
  package: {
    version: pkg.version,
    unstable_dependency_count: unstableDeps.length,
    unstable_dependencies: unstableDeps
  },
  migrations: {
    migration_count: migrationFiles.length,
    latest_migration: migrationFiles.at(-1) || null,
    prefix_gaps: prefixGaps,
    duplicate_prefixes: duplicatePrefixes
  },
  scripts: { required: requiredScripts, missing: missingScripts },
  staging_sql_pack: { required: requiredSql, missing: missingSql },
  audits: {
    v60_no_mock_blockers: v60Report.production_blocking_findings ?? null,
    v62_real_data_static_blockers: v62Report.production_blocking_findings ?? null,
    v64_database_security_status: v64Report.database_security_status ?? null,
    v662_quality_status: v662Quality.quality_status ?? null
  },
  manual_evidence: {
    required_total: requiredEvidence.length,
    attached_count: attachedEvidence.length,
    missing: missingEvidence
  },
  blockers,
  progress_status: blockers.length ? 'needs_cleanup_or_manual_evidence' : 'local_consistency_ready_pending_human_review'
};

fs.writeFileSync(path.join(outDir, 'v663-progress-consistency-audit.json'), JSON.stringify(report, null, 2));
const md = `# v6.6.3 Progress Consistency Audit\n\nGenerated: ${report.generated_at}\n\nStatus: **${report.progress_status}**\n\n## Summary\n\n| Check | Result |\n|---|---:|\n| Unstable dependency ranges | ${report.package.unstable_dependency_count} |\n| Migration files | ${report.migrations.migration_count} |\n| Prefix gaps | ${report.migrations.prefix_gaps.length} |\n| Duplicate prefixes | ${report.migrations.duplicate_prefixes.length} |\n| Missing package scripts | ${report.scripts.missing.length} |\n| Missing staging SQL files | ${report.staging_sql_pack.missing.length} |\n| v6.0 no-mock blockers | ${report.audits.v60_no_mock_blockers ?? 'unknown'} |\n| v6.2 real-data static blockers | ${report.audits.v62_real_data_static_blockers ?? 'unknown'} |\n| Manual evidence attached | ${report.manual_evidence.attached_count}/${report.manual_evidence.required_total} |\n\n## Blockers / warnings\n\n${blockers.length ? blockers.map(b => `- ${b}`).join('\n') : '- None detected by this audit.'}\n\n## Important interpretation\n\nThe v6.2 real-data static audit is stricter than the v6.0 no-mock audit. If it still reports blockers, do not treat the platform as production data complete. Use controlled internal testing only until those runtime fallback paths are removed or explicitly fenced behind non-production demo mode.\n`;
fs.writeFileSync(path.join(outDir, 'V663_PROGRESS_CONSISTENCY_AUDIT.md'), md);
console.log('v6.6.3 progress consistency audit complete.');
console.log({
  progress_status: report.progress_status,
  unstable_dependency_count: report.package.unstable_dependency_count,
  missing_staging_sql_files: report.staging_sql_pack.missing.length,
  v62_real_data_static_blockers: report.audits.v62_real_data_static_blockers,
  manual_evidence_missing: report.manual_evidence.missing.length
});
