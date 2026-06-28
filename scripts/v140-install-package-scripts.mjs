import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const packagePath = path.join(root, 'package.json');
const workflowPath = path.join(root, '.github', 'workflows', 'ci.yml');

const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
pkg.scripts = {
  ...pkg.scripts,
  'v140:grc-audit': 'node scripts/v140-professional-grc-static-audit.mjs',
  'v140:grc-report': 'node scripts/v140-professional-grc-report.mjs',
  'v140:final-proof': 'node scripts/v140-final-proof.mjs',
  'pilot:v140-professional-grc': 'npm run v140:grc-audit && npm run v140:grc-report && npm run v140:final-proof',
};
fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);

if (fs.existsSync(workflowPath)) {
  let workflow = fs.readFileSync(workflowPath, 'utf8');
  if (!workflow.includes('npm run pilot:v140-professional-grc')) {
    const marker = '      - name: UAT readiness static proof\n        run: npm run pilot:uat-readiness';
    const insert = '      - name: v14 professional GRC proof\n        run: npm run pilot:v140-professional-grc\n\n';
    if (workflow.includes(marker)) {
      workflow = workflow.replace(marker, insert + marker);
    } else {
      workflow = workflow.trimEnd() + '\n\n' + insert;
    }
    fs.writeFileSync(workflowPath, workflow);
  }
}

console.log('v14 package scripts installed and GitHub Actions workflow updated if present.');
