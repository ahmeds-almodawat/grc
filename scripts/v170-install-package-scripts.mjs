import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const packagePath = path.join(root, 'package.json');

if (!fs.existsSync(packagePath)) {
  throw new Error('package.json not found. Run this script from the repository root.');
}

const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
pkg.scripts = pkg.scripts || {};
Object.assign(pkg.scripts, {
  'v170:enterprise-risk-audit': 'node scripts/v170-enterprise-risk-static-audit.mjs',
  'v170:enterprise-risk-report': 'node scripts/v170-enterprise-risk-report.mjs',
  'v170:final-proof': 'node scripts/v170-final-proof.mjs',
  'pilot:v170-enterprise-risk': 'npm run v170:enterprise-risk-audit && npm run v170:enterprise-risk-report && npm run v170:final-proof',
});
fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');

const workflowPath = path.join(root, '.github', 'workflows', 'ci.yml');
if (fs.existsSync(workflowPath)) {
  let workflow = fs.readFileSync(workflowPath, 'utf8');
  const step = '      - name: v17 enterprise risk proof\n        run: npm run pilot:v170-enterprise-risk';
  if (!workflow.includes('pilot:v170-enterprise-risk')) {
    const anchors = [
      '      - name: v16 compliance management proof\n        run: npm run pilot:v160-compliance-management',
      '      - name: v15 audit program proof\n        run: npm run pilot:v150-audit-program',
      '      - name: v14 professional GRC proof\n        run: npm run pilot:v140-professional-grc',
      '      - name: UAT readiness static proof\n        run: npm run pilot:uat-readiness',
    ];
    const anchor = anchors.find(candidate => workflow.includes(candidate));
    if (anchor) {
      workflow = workflow.replace(anchor, `${anchor}\n${step}`);
    } else {
      workflow = `${workflow.trimEnd()}\n${step}\n`;
    }
    fs.writeFileSync(workflowPath, workflow, 'utf8');
  }
}

console.log('v17 package scripts installed and GitHub Actions workflow updated if present.');
