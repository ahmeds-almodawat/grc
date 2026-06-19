import fs from 'node:fs';
import path from 'node:path';

const strict = process.argv.includes('--strict');
const packagePath = path.resolve('package.json');
const releaseDir = path.resolve('release', 'v61');
fs.mkdirSync(releaseDir, { recursive: true });

if (!fs.existsSync(packagePath)) {
  console.error('package.json not found. Run this from the project root.');
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const sections = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];
const unstable = [];

function isUnpinned(version) {
  if (!version || typeof version !== 'string') return true;
  const v = version.trim();
  if (v === 'latest' || v === '*' || /x/i.test(v)) return true;
  if (/^[\^~<>]/.test(v)) return true;
  if (/\s+[-|]{1,2}\s+/.test(v)) return true;
  return false;
}

for (const section of sections) {
  const deps = pkg[section] || {};
  for (const [name, version] of Object.entries(deps)) {
    if (isUnpinned(version)) {
      unstable.push({ section, name, version });
    }
  }
}

const report = {
  generated_at: new Date().toISOString(),
  package_name: pkg.name || null,
  package_version: pkg.version || null,
  unstable_dependency_count: unstable.length,
  strict_passed: unstable.length === 0,
  policy: 'Production releases should pin dependency versions. Use npm run v61:pin-from-lock only after reviewing package-lock.json.',
  unstable
};

fs.writeFileSync(path.join(releaseDir, 'v61-package-pin-audit.json'), JSON.stringify(report, null, 2) + '\n');
const md = [
  '# v6.1 Package Pin Audit',
  '',
  `Generated: ${report.generated_at}`,
  '',
  `Unstable dependency specs: **${unstable.length}**`,
  '',
  unstable.length ? '| Section | Package | Version spec |\n|---|---|---|\n' + unstable.map((d) => `| ${d.section} | \`${d.name}\` | \`${d.version}\` |`).join('\n') : 'All checked dependency specs are pinned.',
  '',
  'Recommended: run `npm run v61:pin-from-lock`, then `npm install`, then `npm run v61:all` after reviewing the package.json diff.',
  ''
].join('\n');
fs.writeFileSync(path.join(releaseDir, 'v61-package-pin-audit.md'), md);

console.log('v6.1 package pin audit complete.');
console.log(JSON.stringify({ unstable_dependency_count: unstable.length, strict_passed: report.strict_passed }, null, 2));

if (strict && unstable.length) {
  console.error(`v6.1 pin strict failed: ${unstable.length} unstable dependency specs remain.`);
  process.exit(1);
}
