import fs from 'node:fs';
import path from 'node:path';

const releaseDir = path.resolve('release', 'v611');
fs.mkdirSync(releaseDir, { recursive: true });

const pkgPath = path.resolve('package.json');
const pkg = fs.existsSync(pkgPath) ? JSON.parse(fs.readFileSync(pkgPath, 'utf8')) : {};
const canonical = {
  appName: 'GRC Control Center',
  packageVersion: pkg.version || '0.0.0',
  baselineVersion: 'v6.1.1',
  baselineName: 'Production Baseline Cleanup',
  productionReadinessLabel: 'staging-baseline-unverified',
  generatedAt: new Date().toISOString()
};

const srcLibDir = path.resolve('src', 'lib');
fs.mkdirSync(srcLibDir, { recursive: true });
const appVersionTs = `export const APP_NAME = ${JSON.stringify(canonical.appName)};\nexport const APP_PACKAGE_VERSION = ${JSON.stringify(canonical.packageVersion)};\nexport const APP_BASELINE_VERSION = ${JSON.stringify(canonical.baselineVersion)};\nexport const APP_BASELINE_NAME = ${JSON.stringify(canonical.baselineName)};\nexport const APP_PRODUCTION_READINESS_LABEL = ${JSON.stringify(canonical.productionReadinessLabel)};\n\nexport const appVersion = {\n  name: APP_NAME,\n  packageVersion: APP_PACKAGE_VERSION,\n  baselineVersion: APP_BASELINE_VERSION,\n  baselineName: APP_BASELINE_NAME,\n  productionReadinessLabel: APP_PRODUCTION_READINESS_LABEL\n} as const;\n`;
fs.writeFileSync(path.join(srcLibDir, 'appVersion.ts'), appVersionTs);

const scanDirs = ['src', 'docs', 'README.md', 'PATCH_NOTES.md'].map((p) => path.resolve(p));
const versionRegex = /\bv\d+(?:\.\d+){0,2}(?:[-_][a-z0-9_.-]+)?\b/gi;
const labels = new Map();
function scanFile(file) {
  const text = fs.readFileSync(file, 'utf8');
  const matches = text.match(versionRegex) || [];
  for (const match of matches) {
    const list = labels.get(match) || [];
    if (list.length < 20) list.push(path.relative(process.cwd(), file));
    labels.set(match, list);
  }
}
function walk(target) {
  if (!fs.existsSync(target)) return;
  const stat = fs.statSync(target);
  if (stat.isFile()) {
    if (/\.(ts|tsx|js|jsx|mjs|md|json|sql)$/i.test(target)) scanFile(target);
    return;
  }
  for (const name of fs.readdirSync(target)) {
    if (['node_modules', 'dist', 'release', '.git'].includes(name)) continue;
    walk(path.join(target, name));
  }
}
scanDirs.forEach(walk);

const sortedLabels = [...labels.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
const report = {
  generated_at: new Date().toISOString(),
  canonical,
  unique_version_labels_found: sortedLabels.length,
  note: 'appVersion.ts is now the single new source of truth. Historical labels are reported, not automatically rewritten.',
  labels: sortedLabels.map(([label, files]) => ({ label, sample_files: files }))
};
fs.writeFileSync(path.join(releaseDir, 'v611-version-truth-report.json'), JSON.stringify(report, null, 2) + '\n');

const md = [
  '# v6.1.1 Version Truth Report',
  '',
  `Canonical baseline: **${canonical.baselineVersion} — ${canonical.baselineName}**`,
  `Package version: **${canonical.packageVersion}**`,
  `Production readiness label: **${canonical.productionReadinessLabel}**`,
  '',
  `Historical version labels found: **${sortedLabels.length}**`,
  '',
  'The new single source of truth is `src/lib/appVersion.ts`. Historical labels are not rewritten automatically because some are part of patch history and documentation.',
  ''
].join('\n');
fs.writeFileSync(path.join(releaseDir, 'V611_VERSION_TRUTH_REPORT.md'), md);
console.log('v6.1.1 version truth file/report generated.');
console.log(JSON.stringify({ canonical_version: canonical.baselineVersion, package_version: canonical.packageVersion, unique_version_labels_found: sortedLabels.length }, null, 2));
