import fs from 'fs';
const pkgPath='package.json';
const pkg=JSON.parse(fs.readFileSync(pkgPath,'utf8'));
pkg.scripts ||= {};
const scripts={
 'v79:operator-console':'node scripts/v79-pilot-operator-console.mjs',
 'v79:user-roster':'node scripts/v79-pilot-user-roster-template.mjs',
 'v79:daily-monitoring':'node scripts/v79-daily-monitoring-generator.mjs',
 'v79:issue-log':'node scripts/v79-issue-log-template.mjs',
 'v79:access-review':'node scripts/v79-access-review-generator.mjs',
 'v79:feedback-pack':'node scripts/v79-feedback-pack-generator.mjs',
 'v79:closeout-dashboard':'node scripts/v79-closeout-dashboard.mjs',
 'v79:review-pack':'node scripts/v79-generate-review-pack.mjs',
 'v79:all':'npm run v79:operator-console && npm run v79:user-roster && npm run v79:daily-monitoring && npm run v79:issue-log && npm run v79:access-review && npm run v79:feedback-pack && npm run v79:closeout-dashboard && npm run v79:review-pack',
 'pilot:ops-readiness':'npm run ci:static && npm run v79:all'
};
const added=[], preserved=[];
for (const [k,v] of Object.entries(scripts)) { if (pkg.scripts[k]===v) preserved.push(k); else { pkg.scripts[k]=v; added.push(k); } }
fs.writeFileSync(pkgPath, JSON.stringify(pkg,null,2)+'\n');
console.log('v7.9 package script installation complete.');
console.log(JSON.stringify({changed:added.length>0, added, preserved}, null, 2));
