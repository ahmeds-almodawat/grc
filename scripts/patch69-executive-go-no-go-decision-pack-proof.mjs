import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));

const checks = [];
const addCheck = (name, passed, details = '') => checks.push({ name, passed: Boolean(passed), details });

const apiPath = 'src/lib/productionEvidenceClosureApi.ts';
const pagePath = 'src/pages/ProductionEvidenceClosureCenter.tsx';
const operatorPath = 'src/pages/ProductionOperatorConsole.tsx';
const appPath = 'src/App.tsx';
const restorePath = 'scripts/restore-generated-release-noise.mjs';
const packagePath = 'package.json';
const statusPath = 'release/current-platform-status.md';
const proofIndexPath = 'release/current-proof-command-index.md';
const runbookPath = 'release/current-validation-runbook.md';

const api = read(apiPath);
const page = read(pagePath);
const operator = read(operatorPath);
const app = read(appPath);
const restore = read(restorePath);
const pkg = JSON.parse(read(packagePath));
const status = read(statusPath);
const proofIndex = read(proofIndexPath);
const runbook = read(runbookPath);

const relevantOperationalSources = [page, operator].join('\n');
const relevantImplementationSources = [api, page, operator, restore, JSON.stringify(pkg), status, proofIndex, runbook].join('\n');

addCheck('Patch 69 executive decision pack helper exists', api.includes('getExecutiveGoNoGoDecisionPack') && api.includes('getExecutiveGoNoGoRecommendation'));
addCheck('blocker summary helper exists', api.includes('getExecutiveGoNoGoBlockerSummary'));
addCheck('limitation summary helper exists', api.includes('getExecutiveGoNoGoLimitationSummary'));
addCheck('required actions helper exists', api.includes('getExecutiveGoNoGoRequiredActions'));
addCheck('controlled evidence closure summary helper exists', api.includes('getExecutiveGoNoGoEvidenceClosureSummary'));
addCheck('executive go/no-go decision pack wording exists', page.includes('Executive go/no-go decision pack.'));
for (const state of [
  'No-go: blockers unresolved',
  'Conditional go review',
  'Review required',
  'Ready for executive decision review',
]) {
  addCheck(`safe state exists: ${state}`, api.includes(state) && page.includes(state));
}
addCheck('controlled evidence action history wording exists', page.includes('Controlled evidence action history'));
addCheck('accepted limitations require executive review wording exists', api.includes('Accepted limitations require executive review.') && page.includes('Accepted limitation summary'));
addCheck('required actions before executive decision wording exists', page.includes('Required actions before executive decision'));
addCheck('evidence-level closure caveat remains', page.includes('Evidence-level closure does not approve production launch.') && api.includes('Evidence-level closure does not approve production launch.'));
addCheck('production launch separate authority wording exists', page.includes('Production launch requires separate executive authority.') && api.includes('Production launch requires separate executive authority.'));
addCheck('no production launch action added to page', !page.includes('Authorize Production Launch') && !page.includes('Live operations authorized'));
addCheck('no transition_to_live_operations in active files', !relevantImplementationSources.includes('transition_to_live_operations'));
addCheck('no executive production signoff RPC in active page/API/bridge call path', ![api, page, operator].some(source => source.includes('record_executive_production_signoff') || source.includes('recordExecutiveProductionSignoff')));
addCheck('no production-ready claim in operational UI', !/production-ready/i.test(relevantOperationalSources));
addCheck('no browser service-role exposure exists', ![api, page, operator].some(source => /SERVICE_ROLE|service_role|SUPABASE_SERVICE_ROLE/i.test(source)));
addCheck('/production-evidence-closure still exists', app.includes("'/production-evidence-closure': 'productionEvidenceClosure'"));
addCheck('Production Evidence Closure page exists', exists(pagePath) && page.includes('Production Evidence Closure'));
addCheck('Production Readiness Center link remains', page.includes('Production Readiness Center'));
addCheck('Production Operator Console link remains', page.includes('Production Operator Console'));
addCheck('operator console mentions decision pack readiness', operator.includes('executive go/no-go decision pack readiness') || operator.includes('Evidence closure decision pack'));
addCheck('no fake/demo records added', ![api, page, operator].some(source => /fake|demo|mock/i.test(source)));

const bannedOperationalWords = ['patch', 'proof', 'RPC', 'schema', 'migration', 'scaffold', 'mock', 'demo', 'fake', 'unknown_requires_review'];
const bannedHits = bannedOperationalWords.filter(word => new RegExp(`\\b${word}\\b`, word === word.toUpperCase() ? '' : 'i').test(relevantOperationalSources));
addCheck('operational UI avoids banned technical wording', bannedHits.length === 0, bannedHits.join(', '));

addCheck('restore-noise covers Patch 68 generated proof JSON', restore.includes('release/patch68/patch68-controlled-evidence-closure-actions-proof.json'));
addCheck('package patch69:proof exists', pkg.scripts?.['patch69:proof'] === 'node scripts/patch69-executive-go-no-go-decision-pack-proof.mjs');
addCheck('package patch69:all exists', pkg.scripts?.['patch69:all'] === 'npm run validate:build && npm run validate:security && npm run patch69:proof');
for (const scriptName of ['validate:fast', 'validate:build', 'validate:security', 'validate:release', 'proof:all', 'v700:runtime-security', 'release:restore-noise']) {
  addCheck(`${scriptName} exists`, Boolean(pkg.scripts?.[scriptName]));
}
addCheck('current platform status mentions Patch 69', status.includes('Current patch level: Patch 69') && status.includes('executive go/no-go decision pack readiness'));
addCheck('production caveat remains', status.includes('Real hospital-wide production still requires live department launch evidence'));
addCheck('proof index mentions Patch 69', proofIndex.includes('npm run patch69:proof'));
addCheck('runbook mentions Patch 68 proof JSON restore coverage', runbook.includes('Patch 69 extends restore coverage to the Patch 68 generated proof JSON'));

const sourceFiles = [
  apiPath,
  pagePath,
  operatorPath,
  appPath,
  restorePath,
  packagePath,
  statusPath,
  proofIndexPath,
  runbookPath,
].map(read);
addCheck('no conflict markers', !sourceFiles.some(source => /^(<<<<<<<|=======|>>>>>>>)$/m.test(source)));

const result = {
  patch: 'Patch 69',
  name: 'Executive Go/No-Go Decision Pack',
  passed: checks.every(check => check.passed),
  checks,
  generated_at: new Date().toISOString(),
};

const outputPath = path.join(root, 'release/patch69/patch69-executive-go-no-go-decision-pack-proof.json');
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);

if (!result.passed) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(result, null, 2));
