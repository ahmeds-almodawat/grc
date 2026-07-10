import fs from 'fs';
import path from 'path';

function assert(condition, message) {
  if (!condition) {
    console.error('❌ ' + message);
    process.exit(1);
  }
}

const mdPath = 'release/patch83d/patch83d-sidebar-hub-navigation-qa.md';
const jsonPath = 'release/patch83d/patch83d-sidebar-hub-navigation-qa.json';

assert(fs.existsSync(mdPath), 'QA markdown exists');
assert(fs.existsSync(jsonPath), 'QA JSON exists');

const mdContent = fs.readFileSync(mdPath, 'utf8');
const jsonContent = fs.readFileSync(jsonPath, 'utf8');

assert(mdContent.includes('Patch 83B') && mdContent.includes('Patch 83C'), 'QA pack mentions Patch 83B and Patch 83C');
assert(mdContent.includes('all fine'), 'QA pack includes user acceptance phrase "all fine"');
assert(mdContent.includes('Workplace') && mdContent.includes('Quality & Safety') && mdContent.includes('GRC') && mdContent.includes('Evidence & Documents') && mdContent.includes('Reports') && mdContent.includes('Admin/Internal'), 'QA pack includes all checked areas');
assert(mdContent.includes('not production readiness evidence') && mdContent.includes('not a security/RLS remediation'), 'QA pack includes known limitation regarding production readiness and security/RLS');

const forbiddenClaims = [
  'system is production ready',
  'go-live complete',
  'production launched',
  'transition_to_live_operations'
];

forbiddenClaims.forEach(claim => {
  assert(!mdContent.includes(claim), `Forbidden claim "${claim}" must be absent from Markdown`);
  assert(!jsonContent.includes(claim), `Forbidden claim "${claim}" must be absent from JSON`);
});

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
assert(pkg.scripts['patch83d:proof'], 'package.json contains patch83d:proof');

console.log('✅ Patch 83D proof passed. Sidebar and hub navigation manual QA evidence verified.');
