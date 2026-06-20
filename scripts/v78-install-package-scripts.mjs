import fs from 'node:fs';

const path = 'package.json';
const pkg = JSON.parse(fs.readFileSync(path, 'utf8'));
pkg.scripts ||= {};

const scripts = {
  'v78:env-audit': 'node scripts/v78-env-template-audit.mjs',
  'v78:staging-plan': 'node scripts/v78-staging-execution-plan.mjs',
  'v78:smoke-plan': 'node scripts/v78-smoke-test-plan.mjs',
  'v78:rollback-readiness': 'node scripts/v78-rollback-readiness.mjs',
  'v78:access-control': 'node scripts/v78-access-control-plan.mjs',
  'v78:observability': 'node scripts/v78-observability-plan.mjs',
  'v78:go-no-go': 'node scripts/v78-go-no-go-pack.mjs',
  'v78:review-pack': 'node scripts/v78-generate-review-pack.mjs',
  'v78:all': 'npm run v78:env-audit && npm run v78:staging-plan && npm run v78:smoke-plan && npm run v78:rollback-readiness && npm run v78:access-control && npm run v78:observability && npm run v78:go-no-go && npm run v78:review-pack',
  'pilot:live-staging-plan': 'npm run ci:static && npm run v78:all',
};

const added = [];
const preserved = [];
for (const [name, command] of Object.entries(scripts)) {
  if (pkg.scripts[name] === command) {
    preserved.push(name);
    continue;
  }
  pkg.scripts[name] = command;
  added.push(name);
}

fs.writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
console.log('v7.8 package script installation complete.');
console.log(JSON.stringify({ changed: added.length > 0, added, preserved }, null, 2));
