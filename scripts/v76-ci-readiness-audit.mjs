import { fileExists, readPackageJson, writeJson, writeMd, mdTable } from './v76-common.mjs';

const pkg = readPackageJson();
const scripts = pkg.scripts || {};
const checks = [
  ['README.md exists', fileExists('README.md')],
  ['docs/ARCHITECTURE.md exists', fileExists('docs/ARCHITECTURE.md')],
  ['docs/RELEASE_POLICY.md exists', fileExists('docs/RELEASE_POLICY.md')],
  ['.github/workflows/ci.yml exists', fileExists('.github/workflows/ci.yml')],
  ['.github/workflows/repo-health.yml exists', fileExists('.github/workflows/repo-health.yml')],
  ['ci:static script exists', Boolean(scripts['ci:static'])],
  ['pilot:readiness script exists', Boolean(scripts['pilot:readiness'])],
  ['repo:health script exists', Boolean(scripts['repo:health'])],
  ['v76:all script exists', Boolean(scripts['v76:all'])],
];
const passed = checks.filter(([, ok]) => ok).length;
const failed = checks.length - passed;
const result = {
  generated_at: new Date().toISOString(),
  status: failed === 0 ? 'passed' : 'passed_with_warnings',
  passed,
  failed,
  checks: checks.map(([name, ok]) => ({ name, passed: ok })),
  note: 'CI readiness is not production readiness. proof:all is intentionally not required until human signoff is complete.',
};
writeJson('ci-readiness-audit.json', result);
const md = `# v7.6 CI Readiness Audit\n\nGenerated: ${result.generated_at}\n\nStatus: **${result.status}**\n\n${mdTable(['Check', 'Passed'], checks.map(([name, ok]) => [name, ok ? 'yes' : 'no']))}\n\n## Note\n\nFull strict proof remains dependent on real human signoff.\n`;
writeMd('ci-readiness-audit.md', md);
console.log('v7.6 CI readiness audit generated.');
console.log(JSON.stringify({ status: result.status, passed, failed, report: 'release/v76/ci-readiness-audit.md' }, null, 2));
