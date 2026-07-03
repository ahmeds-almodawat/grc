import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const outDir = path.join(repoRoot, 'release/patch48');
const outPath = path.join(outDir, 'patch48-repo-hygiene-proof.json');

const checks = [
  { name: 'docs/INDEX.md exists', passed: fs.existsSync(path.join(repoRoot, 'docs/INDEX.md')) },
  { name: 'docs/architecture/README.md exists', passed: fs.existsSync(path.join(repoRoot, 'docs/architecture/README.md')) },
  { name: 'docs/runbooks/README.md exists', passed: fs.existsSync(path.join(repoRoot, 'docs/runbooks/README.md')) },
  { name: 'docs/release-evidence/README.md exists', passed: fs.existsSync(path.join(repoRoot, 'docs/release-evidence/README.md')) },
  { name: 'scripts/README.md exists', passed: fs.existsSync(path.join(repoRoot, 'scripts/README.md')) },
  { name: 'release/README.md exists', passed: fs.existsSync(path.join(repoRoot, 'release/README.md')) },
];

const failed = checks.filter(check => !check.passed);
const result = {
  patch: '48',
  checked_at: new Date().toISOString(),
  strict_passed: failed.length === 0,
  check_count: checks.length,
  failed_count: failed.length,
  failed,
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));

if (!result.strict_passed) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(result, null, 2));
