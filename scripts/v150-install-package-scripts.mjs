import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const packagePath = path.join(root, 'package.json');

if (!fs.existsSync(packagePath)) {
  throw new Error('package.json not found. Run this from the repository root.');
}

const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
packageJson.scripts = packageJson.scripts || {};

const scriptsToAdd = {
  'v150:audit-program-audit': 'node scripts/v150-audit-program-static-audit.mjs',
  'v150:audit-program-report': 'node scripts/v150-audit-program-report.mjs',
  'v150:final-proof': 'node scripts/v150-final-proof.mjs',
  'pilot:v150-audit-program': 'npm run v150:audit-program-audit && npm run v150:audit-program-report && npm run v150:final-proof',
};

for (const [name, command] of Object.entries(scriptsToAdd)) {
  packageJson.scripts[name] = command;
}

fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

const workflowPath = path.join(root, '.github', 'workflows', 'ci.yml');
if (fs.existsSync(workflowPath)) {
  let workflow = fs.readFileSync(workflowPath, 'utf8');
  if (!workflow.includes('pilot:v150-audit-program')) {
    const v15Step = `\n      - name: v15 audit program proof\n        run: npm run pilot:v150-audit-program\n`;
    if (workflow.includes('run: npm run pilot:v140-professional-grc')) {
      workflow = workflow.replace(
        /      - name: v14 professional GRC proof\n        run: npm run pilot:v140-professional-grc\n/,
        (match) => `${match}${v15Step}`,
      );
    } else if (workflow.includes('run: npm run pilot:uat-readiness')) {
      workflow = workflow.replace(
        /      - name: UAT readiness static proof\n        run: npm run pilot:uat-readiness\n/,
        (match) => `${match}${v15Step}`,
      );
    } else {
      workflow += v15Step;
    }
    fs.writeFileSync(workflowPath, workflow);
  }
}

console.log('v15 package scripts installed and GitHub Actions workflow updated if present.');
