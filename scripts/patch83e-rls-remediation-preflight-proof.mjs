import fs from 'fs';
import path from 'path';

function assert(condition, message) {
  if (!condition) {
    console.error('❌ ' + message);
    process.exit(1);
  }
}

const mdPath = 'release/patch83e/patch83e-rls-remediation-preflight-matrix.md';
const jsonPath = 'release/patch83e/patch83e-rls-remediation-preflight-matrix.json';

assert(fs.existsSync(mdPath), 'Markdown report exists');
assert(fs.existsSync(jsonPath), 'JSON report exists');

const mdContent = fs.readFileSync(mdPath, 'utf8');
const jsonContent = fs.readFileSync(jsonPath, 'utf8');

assert(mdContent.includes('Patch 82V') && mdContent.includes('Patch 82W'), 'Report references Patch 82V and Patch 82W');
assert(mdContent.includes('documentation-only') && mdContent.includes('no migrations') && mdContent.includes('no policy changes'), 'Report says documentation-only / no migrations / no policy changes');

const requiredSections = [
  'Scope',
  'Non-Scope',
  'RLS Remediation Matrix',
  'Pre-Migration Checks',
  'Test Evidence Required',
  'Rollback Strategy',
  'Stop/Go Gates',
  'Future Implementation Sequence',
  'Known Limitations'
];

requiredSections.forEach(section => {
  assert(mdContent.toLowerCase().includes(section.toLowerCase()), `Report includes required section: ${section}`);
});

const parsedJson = JSON.parse(jsonContent);
assert(parsedJson.matrix && parsedJson.matrix.length > 0, 'JSON includes matrix entries');
const entry = parsedJson.matrix[0];
assert('affected_area' in entry, 'JSON entry has affected_area');
assert('current_risk_pattern' in entry, 'JSON entry has current_risk_pattern');
assert('proposed_future_control' in entry, 'JSON entry has proposed_future_control');
assert('required_precheck' in entry, 'JSON entry has required_precheck');
assert('test_evidence' in entry, 'JSON entry has test_evidence');
assert('rollback_note' in entry, 'JSON entry has rollback_note');
assert('implementation_priority' in entry, 'JSON entry has implementation_priority');

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
assert(pkg.scripts['patch83e:proof'], 'package.json contains patch83e:proof');

console.log('✅ Patch 83E proof passed. RLS remediation preflight matrix verified.');
