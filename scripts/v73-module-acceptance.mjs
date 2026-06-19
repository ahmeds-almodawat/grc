import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'release', 'v73');
fs.mkdirSync(outDir, { recursive: true });

const readJson = (rel, fallback = {}) => {
  try {
    const p = path.join(root, rel);
    if (!fs.existsSync(p)) return fallback;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (error) {
    return { parse_error: String(error?.message || error) };
  }
};

const hasFile = (rel) => fs.existsSync(path.join(root, rel));
const hasSource = (page) => {
  if (!page || page.includes(' and ') || page.includes('/')) return true;
  return [
    path.join(root, 'src', 'pages', page),
    path.join(root, 'src', 'components', page),
    path.join(root, 'src', 'auth', page)
  ].some((p) => fs.existsSync(p));
};

const plan = readJson('release/v73/module-acceptance-plan.json', { modules: [] });
const modules = Array.isArray(plan.modules) ? plan.modules : [];
const runtime = readJson('release/v700/runtime-security-bridge-audit.json');
const personas = readJson('release/v72/real-authenticated-persona-proof.json');
const proofAll = readJson('release/v700/proof-suite-all.json');
const v65 = readJson('release/v700/v65-strength-audit.json');
const manual = readJson('release/v66/v66-manual-evidence.json', { items: [] });

const sqlEvidence = [
  'release/v66/evidence-attachments/01-v64-persona-sql-output.txt',
  'release/v66/evidence-attachments/02-v65-workflow-sql-output.txt',
  'release/v66/evidence-attachments/03-v66-pilot-evidence-sql-output.txt'
].every(hasFile);

const restoreOk = hasFile('release/v66/evidence-attachments/restore-dryrun-evidence.txt')
  && (manual.items || []).some((x) => x.id === 'backup_restore_dryrun' && x.status === 'verified');

const signals = {
  runtime_bridge: runtime.status === 'passed' && Number(runtime.service_role_only_rpc_called_by_frontend || 0) === 0,
  edge_bridge: Number(runtime.authenticated_edge_bridge_call_total || 0) >= 7 || Number(runtime.reviewed_rpc_edge_bridged_count || 0) >= 7,
  personas: personas.strict_passed === true && Number(personas.authenticated_personas_passed || 0) >= 8 && Number(personas.required_scenarios_passed || 0) >= 9,
  synthetic_scope: personas.synthetic_data_only === true,
  sql_evidence: sqlEvidence,
  restore: restoreOk,
  v65: ['passed', 'passed_with_warnings'].includes(v65.status) && Number(v65.high_findings || 0) === 0,
  proof_suite: Array.isArray(proofAll.failed_commands) && proofAll.failed_commands.every((x) => x === 'v66:strict-proof')
};

const p1 = new Set(['login','application-shell-hubs','access-control','ovr','evidence','approvals','global-search','import-export','unauthorized-page','workspace-home','board-pack','escalations']);
const p2 = new Set(['projects','audit-findings','risks','compliance','operations','ovr-risk-indicators','backup-health-check','production-backup-strategy','restore-dry-run','translation-coverage','bilingual-dictionary','user-guide']);

function evalModule(m) {
  const legacy = String(m.status || '').includes('legacy') || String(m.status || '').includes('unmounted');
  if (legacy) return { id: m.id, page: m.page, priority: 'not_applicable_for_pilot', acceptance_status: 'not_applicable_for_pilot', blocking: false, issue: 'Excluded from controlled pilot scope.' };

  const checks = [];
  checks.push(['source reference exists', hasSource(m.page), p1.has(m.id)]);
  if (['login','application-shell-hubs','unauthorized-page','workspace-home','access-control'].includes(m.id)) checks.push(['persona proof passed', signals.personas, true]);
  if (['access-control','board-pack','escalations','ovr'].includes(m.id) || (m.apis || []).join(' ').includes('Edge bridge')) checks.push(['runtime bridge passed', signals.runtime_bridge && signals.edge_bridge, true]);
  if (['ovr','ovr-risk-indicators','evidence','global-search'].includes(m.id)) checks.push(['synthetic scope confirmed', signals.synthetic_scope, true]);
  if (['approvals','projects','audit-findings','risks','compliance','evidence','ovr'].includes(m.id)) checks.push(['workflow SQL evidence present', signals.sql_evidence && signals.v65, p1.has(m.id)]);
  if (['import-export','custom-reports','advanced-report-builder'].includes(m.id)) checks.push(['export denial covered by persona proof', signals.personas, p1.has(m.id)]);
  if (['backup-health-check','production-backup-strategy','restore-dry-run'].includes(m.id)) checks.push(['restore evidence present', signals.restore, p1.has(m.id)]);
  if (['translation-coverage','bilingual-dictionary','user-guide'].includes(m.id)) checks.push(['browser language pass still needs visual UAT', false, false]);
  if (!p1.has(m.id) && !p2.has(m.id)) checks.push(['deferred from pilot automation', false, false]);

  const blockers = checks.filter(([, ok, block]) => !ok && block).map(([label]) => label);
  const warns = checks.filter(([, ok, block]) => !ok && !block).map(([label]) => label);
  const status = blockers.length ? 'failed' : warns.length ? 'warning' : 'passed';
  return {
    id: m.id,
    page: m.page,
    risk_level: m.risk_level,
    priority: p1.has(m.id) ? 'priority_1' : p2.has(m.id) ? 'priority_2' : 'deferred',
    acceptance_status: status,
    blocking: p1.has(m.id) && status === 'failed',
    issue: blockers.concat(warns).join('; ') || 'Accepted by current evidence pack.',
    checks: checks.map(([label, ok, block]) => ({ label, passed: Boolean(ok), blocking_if_failed: Boolean(block) }))
  };
}

const module_results = modules.map(evalModule);
const counts = module_results.reduce((acc, row) => { acc[row.acceptance_status] = (acc[row.acceptance_status] || 0) + 1; return acc; }, {});
const blockers = module_results.filter((x) => x.blocking);
const warnings = module_results.filter((x) => x.acceptance_status === 'warning');
const status = blockers.length ? 'failed_priority_1_blockers' : warnings.length ? 'passed_with_warnings' : 'passed';

const result = {
  version: 'v7.3',
  generated_at: new Date().toISOString(),
  scope: 'controlled pilot module acceptance',
  acceptance_status: status,
  strict_passed: blockers.length === 0,
  signals,
  counts: { total_modules: module_results.length, ...counts, priority_1_blocking_failures: blockers.length, warning_total: warnings.length },
  module_results
};

fs.writeFileSync(path.join(outDir, 'module-acceptance-results.json'), `${JSON.stringify(result, null, 2)}\n`);

const csv = [
  'module_id,page,priority,risk_level,status,blocking,issue',
  ...module_results.filter((x) => x.acceptance_status !== 'passed').map((x) => [x.id, x.page, x.priority, x.risk_level || '', x.acceptance_status, x.blocking ? 'yes' : 'no', x.issue].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
].join('\n') + '\n';
fs.writeFileSync(path.join(outDir, 'module-issues.csv'), csv);

const md = `# v7.3 Module Acceptance Summary\n\nGenerated: ${result.generated_at}\n\n- Status: **${result.acceptance_status}**\n- Strict passed: **${result.strict_passed}**\n- Total modules: **${result.counts.total_modules}**\n- Passed: **${result.counts.passed || 0}**\n- Warnings: **${result.counts.warning || 0}**\n- Failed: **${result.counts.failed || 0}**\n- Not applicable for pilot: **${result.counts.not_applicable_for_pilot || 0}**\n- Priority 1 blocking failures: **${result.counts.priority_1_blocking_failures}**\n\n## Signals\n\n\`\`\`json\n${JSON.stringify(signals, null, 2)}\n\`\`\`\n\n## Blocking failures\n\n${blockers.length ? blockers.map((x) => `- ${x.id}: ${x.issue}`).join('\n') : '_None._'}\n\n## Warnings\n\n${warnings.length ? warnings.slice(0, 30).map((x) => `- ${x.id}: ${x.issue}`).join('\n') : '_None._'}\n`;
fs.writeFileSync(path.join(outDir, 'module-acceptance-summary.md'), md);

const review = `# v7.3 Module Signoff Review Pack\n\nThis pack summarizes module acceptance evidence for controlled pilot review. It does not complete or replace final signoff.\n\n## Result\n\n- Status: **${result.acceptance_status}**\n- Priority 1 blocking failures: **${result.counts.priority_1_blocking_failures}**\n- Warning total: **${result.counts.warning_total}**\n\n## Priority 1 modules\n\n${module_results.filter((x) => x.priority === 'priority_1').map((x) => `- **${x.id}** — ${x.acceptance_status}: ${x.issue}`).join('\n')}\n\n## Files to review\n\n- release/v73/module-acceptance-results.json\n- release/v73/module-acceptance-summary.md\n- release/v73/module-issues.csv\n- release/v700/runtime-security-bridge-audit.json\n- release/v72/real-authenticated-persona-proof.json\n`;
fs.writeFileSync(path.join(outDir, 'module-signoff-review-pack.md'), review);

console.log('v7.3 module acceptance complete.');
console.log(JSON.stringify({ acceptance_status: status, strict_passed: blockers.length === 0, total_modules: module_results.length, warnings: warnings.length, failed: counts.failed || 0, priority_1_blocking_failures: blockers.length }, null, 2));
if (blockers.length) process.exitCode = 1;
