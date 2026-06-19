import fs from 'node:fs';
import path from 'node:path';

const releaseDir = path.resolve('release', 'v61');
fs.mkdirSync(releaseDir, { recursive: true });
const packagePath = path.resolve('package.json');
const pkg = fs.existsSync(packagePath) ? JSON.parse(fs.readFileSync(packagePath, 'utf8')) : {};

const scanRoots = ['src', 'README.md', 'docs', 'package.json'];
const ignoreDirs = new Set(['node_modules', 'dist', 'release', '.git', '.next', 'coverage']);
const versionPattern = /\b(v\d+(?:\.\d+){0,2}(?:[-_a-z0-9]*)?|version\s*[:=]\s*["']?\d+\.\d+\.\d+["']?)/gi;
const labels = [];

function walk(target) {
  if (!fs.existsSync(target)) return;
  const stat = fs.statSync(target);
  if (stat.isDirectory()) {
    const base = path.basename(target);
    if (ignoreDirs.has(base)) return;
    for (const entry of fs.readdirSync(target)) walk(path.join(target, entry));
    return;
  }
  if (!/\.(tsx?|jsx?|json|md|html|css|sql|mjs)$/i.test(target)) return;
  let text = '';
  try { text = fs.readFileSync(target, 'utf8'); } catch { return; }
  let match;
  const seenInFile = new Set();
  while ((match = versionPattern.exec(text)) !== null) {
    const value = match[0];
    if (seenInFile.has(value.toLowerCase())) continue;
    seenInFile.add(value.toLowerCase());
    labels.push({ file: path.relative(process.cwd(), target), label: value });
  }
}

for (const root of scanRoots) walk(path.resolve(root));

const grouped = labels.reduce((acc, item) => {
  const key = item.label.toLowerCase();
  acc[key] = acc[key] || { label: item.label, count: 0, files: [] };
  acc[key].count += 1;
  if (!acc[key].files.includes(item.file)) acc[key].files.push(item.file);
  return acc;
}, {});

const report = {
  generated_at: new Date().toISOString(),
  package_name: pkg.name || null,
  package_version: pkg.version || null,
  recommended_runtime_version_label: 'v6.1-production-baseline',
  policy: 'Runtime UI should show one release label. Historical patch labels may remain only in docs/release notes, not as current production truth.',
  unique_version_labels_found: Object.keys(grouped).length,
  labels: Object.values(grouped).sort((a, b) => b.count - a.count)
};

fs.writeFileSync(path.join(releaseDir, 'v61-version-baseline-audit.json'), JSON.stringify(report, null, 2) + '\n');
const md = [
  '# v6.1 Version Baseline Audit',
  '',
  `Generated: ${report.generated_at}`,
  '',
  `Package: **${report.package_name || 'unknown'}**`,
  `Package version: **${report.package_version || 'unknown'}**`,
  `Recommended runtime label: **${report.recommended_runtime_version_label}**`,
  '',
  `Unique version-like labels found: **${report.unique_version_labels_found}**`,
  '',
  '## Version labels found',
  '',
  '| Label | Count | Files |',
  '|---|---:|---|',
  ...report.labels.slice(0, 80).map((item) => `| \`${item.label}\` | ${item.count} | ${item.files.slice(0, 6).map((f) => `\`${f}\``).join('<br>')}${item.files.length > 6 ? '<br>…' : ''} |`),
  '',
  '## Required decision',
  '',
  'Choose one runtime version and remove/confine historical labels from the live UI. Documentation may keep history, but dashboards should not show conflicting current versions.',
  ''
].join('\n');
fs.writeFileSync(path.join(releaseDir, 'v61-version-baseline-audit.md'), md);

console.log('v6.1 version baseline audit complete.');
console.log(JSON.stringify({ package_version: report.package_version, unique_version_labels_found: report.unique_version_labels_found }, null, 2));
