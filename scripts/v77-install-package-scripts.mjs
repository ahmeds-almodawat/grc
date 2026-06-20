import fs from 'node:fs';
const p='package.json'; const pkg=JSON.parse(fs.readFileSync(p,'utf8')); pkg.scripts=pkg.scripts||{};
const desired={
 'ci:static':'npm run typecheck && npm run build',
 'v77:staging-audit':'node scripts/v77-staging-validation-audit.mjs',
 'v77:pr-quality':'node scripts/v77-pr-quality-audit.mjs',
 'v77:uat-scenarios':'node scripts/v77-uat-scenario-pack.mjs',
 'v77:risk-register':'node scripts/v77-risk-register-generator.mjs',
 'v77:release-candidate':'node scripts/v77-release-candidate-readiness.mjs',
 'v77:board-pack':'node scripts/v77-board-pack-generator.mjs',
 'v77:review-pack':'node scripts/v77-generate-review-pack.mjs',
 'v77:all':'npm run v77:staging-audit && npm run v77:pr-quality && npm run v77:uat-scenarios && npm run v77:risk-register && npm run v77:release-candidate && npm run v77:board-pack && npm run v77:review-pack',
 'pilot:staging-readiness':'npm run ci:static && npm run v77:all'
};
const added=[],preserved=[]; for(const[k,v] of Object.entries(desired)){if(pkg.scripts[k]) preserved.push(k); else {pkg.scripts[k]=v; added.push(k)}}
fs.writeFileSync(p,JSON.stringify(pkg,null,2)+'\n');
console.log('v7.7 package script installation complete.'); console.log(JSON.stringify({changed:added.length>0,added,preserved},null,2));
