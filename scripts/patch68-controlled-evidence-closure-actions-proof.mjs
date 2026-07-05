import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));

const checks = [];
const addCheck = (name, passed, details = '') => checks.push({ name, passed: Boolean(passed), details });

const pagePath = 'src/pages/ProductionEvidenceClosureCenter.tsx';
const apiPath = 'src/lib/productionEvidenceClosureApi.ts';
const bridgePath = 'supabase/functions/privileged-action/index.ts';
const registryPath = 'src/lib/runtimeActionRegistry.ts';
const migrationPath = 'supabase/migrations/117_patch68_controlled_evidence_closure_actions.sql';
const restorePath = 'scripts/restore-generated-release-noise.mjs';
const packagePath = 'package.json';
const statusPath = 'release/current-platform-status.md';
const proofIndexPath = 'release/current-proof-command-index.md';
const runbookPath = 'release/current-validation-runbook.md';

const page = read(pagePath);
const api = read(apiPath);
const bridge = read(bridgePath);
const registry = read(registryPath);
const migration = read(migrationPath);
const app = read('src/App.tsx');
const layout = read('src/components/Layout.tsx');
const restore = read(restorePath);
const pkg = JSON.parse(read(packagePath));
const status = read(statusPath);
const proofIndex = read(proofIndexPath);
const runbook = read(runbookPath);

const actionTypes = [
  'add_note',
  'ready_for_review',
  'request_more_evidence',
  'accept_with_limitation',
  'close_as_verified',
  'reopen_with_reason',
];

addCheck('migration exists', exists(migrationPath));
addCheck('action history table exists', migration.includes('production_evidence_closure_actions'));
addCheck('RLS enabled', /alter table public\.production_evidence_closure_actions enable row level security/i.test(migration));
addCheck('direct browser inserts blocked', migration.includes('patch68_evidence_closure_actions_no_direct_insert') && migration.includes('with check (false)'));
addCheck('service-role bridge required', migration.includes('patch68_service_role_required') && migration.includes("request.jwt.claim.role"));
addCheck('reason validation exists', migration.includes('production_evidence_closure_actions_reason_required') && migration.includes('Reason is required'));
addCheck('close blocker guard exists', migration.includes("p_action_type = 'close_as_verified'") && migration.includes('blockers remain'));
addCheck('audit/history is append-only', migration.includes('created_at timestamptz not null default now()') && !/update public\.production_evidence_closure_actions/i.test(migration));
addCheck('all controlled action types in migration', actionTypes.every(action => migration.includes(action)));
addCheck('bridge allowlist includes actions', actionTypes.every(action => api.includes(action)) && bridge.includes('patch68EvidenceClosureActions'));
addCheck('bridge calls Patch 68 RPCs', bridge.includes('record_production_evidence_closure_action') && bridge.includes('get_production_evidence_closure_action_history'));
addCheck('runtime registry classifies actions', registry.includes('record_production_evidence_closure_action') && registry.includes('get_production_evidence_closure_action_history'));
addCheck('API exposes action availability', api.includes('getControlledEvidenceClosureActionAvailability'));
addCheck('API exposes reason validation', api.includes('validateControlledEvidenceClosureActionRequest') && api.includes('Reason required.'));
addCheck('API uses authenticated bridge', api.includes("invokePrivilegedAction<ControlledEvidenceClosureActionResult>('record_production_evidence_closure_action'"));
addCheck('no direct browser RPC added in API', !/supabase\.rpc\s*\(/.test(api));
addCheck('page exists', exists(pagePath));
addCheck('route/page still references Production Evidence Closure', page.includes('Production Evidence Closure'));
addCheck('route exists', app.includes("'/production-evidence-closure': 'productionEvidenceClosure'"));
addCheck('navigation label exists', layout.includes("'productionEvidenceClosure'") && read('src/i18n/I18nContext.tsx').includes('Production Evidence Closure'));
addCheck('controlled action UI exists', page.includes('Controlled evidence action') && page.includes('Action options'));
addCheck('action history UI exists', page.includes('Action history') && page.includes('getControlledEvidenceClosureHistoryDisplay'));
addCheck('reason required UI exists', page.includes('Reason required.'));
addCheck('blocker warning UI exists', page.includes('Blocker warning'));
addCheck('limitation caveat visible', page.includes('Executive review is still required for accepted limitations.'));
addCheck('evidence-level caveat visible', page.includes('Evidence closure does not approve production launch.'));
addCheck('no production launch button', !page.includes('Authorize Production Launch'));
addCheck('no transition_to_live_operations', ![page, api, bridge, migration].some(source => source.includes('transition_to_live_operations')));
addCheck('no production-ready claim in page', !/production-ready/i.test(page));
addCheck('no executive launch signoff call in page/API', !page.includes('recordExecutiveProductionSignoff') && !api.includes('recordExecutiveProductionSignoff'));
addCheck('operator console link updated', read('src/pages/ProductionOperatorConsole.tsx').includes('Production Evidence Closure actions'));
addCheck('package scripts exist', pkg.scripts?.['patch68:proof'] === 'node scripts/patch68-controlled-evidence-closure-actions-proof.mjs' && pkg.scripts?.['patch68:all'] === 'npm run validate:build && npm run patch68:proof');
addCheck('validation scripts still exist', ['validate:fast', 'validate:build', 'validate:security', 'proof:all', 'v700:runtime-security', 'release:restore-noise'].every(script => pkg.scripts?.[script]));
addCheck('restore helper covers Patch 67 JSON', restore.includes('release/patch67/patch67-training-adoption-support-evidence-readiness-proof.json'));
addCheck('current status mentions Patch 68', status.includes('Current patch level: Patch 68') && status.includes('controlled evidence closure actions'));
addCheck('production caveat remains', status.includes('Real hospital-wide production still requires live department launch evidence'));
addCheck('proof index mentions Patch 68', proofIndex.includes('npm run patch68:proof'));
addCheck('runbook mentions Patch 68 restore coverage', runbook.includes('Patch 68 extends restore coverage'));

const operationalUiSources = [page, read('src/pages/ProductionOperatorConsole.tsx')].join('\n');
const bannedOperationalWords = ['patch', 'proof', 'RPC', 'schema', 'migration', 'scaffold', 'mock', 'demo', 'fake', 'unknown_requires_review'];
const bannedHits = bannedOperationalWords.filter(word => new RegExp(`\\b${word}\\b`, word === word.toUpperCase() ? '' : 'i').test(operationalUiSources));
addCheck('operational UI avoids banned technical wording', bannedHits.length === 0, bannedHits.join(', '));

const sourceFiles = [
  pagePath,
  apiPath,
  bridgePath,
  registryPath,
  migrationPath,
  'src/App.tsx',
  'src/components/Layout.tsx',
  restorePath,
  packagePath,
  statusPath,
  proofIndexPath,
  runbookPath,
].map(file => read(file));
addCheck('no conflict markers', !sourceFiles.some(source => /^(<<<<<<<|=======|>>>>>>>)$/m.test(source)));
addCheck('no fake/demo records added', ![page, api, migration].some(source => /fake|demo|mock/i.test(source)));
addCheck('no browser service-role exposure', ![page, api].some(source => /SERVICE_ROLE|service_role|SUPABASE_SERVICE_ROLE/i.test(source)));

const result = {
  patch: 'Patch 68',
  name: 'Controlled Evidence Closure Actions',
  passed: checks.every(check => check.passed),
  checks,
  generated_at: new Date().toISOString(),
};

const outputPath = path.join(root, 'release/patch68/patch68-controlled-evidence-closure-actions-proof.json');
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);

if (!result.passed) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(result, null, 2));
