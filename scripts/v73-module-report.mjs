import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
function readJson(relPath, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(path.join(root, relPath), 'utf8')); }
  catch { return fallback; }
}
function writeText(relPath, text) {
  const target = path.join(root, relPath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, text);
}

const results = readJson('release/v73/module-acceptance-results.json', null);
if (!results) {
  console.error('Missing release/v73/module-acceptance-results.json. Run npm run v73:module-acceptance first.');
  process.exit(1);
}
const modules = Array.isArray(results.modules) ? results.modules : [];
const blocking = modules.filter((m) => m.blocking);
const warningModules = modules.filter((m) => m.acceptance_status === 'warning');
const priority1 = modules.filter((m) => m.acceptance_scope === 'priority_1_controlled_pilot');

const lines = [];
lines.push('# v7.3 Module Acceptance Summary');
lines.push('');
lines.push(`Generated: ${results.generated_at}`);
lines.push(`Status: **${results.status}**`);
lines.push(`Strict passed: **${results.strict_passed}**`);
lines.push('');
lines.push('## Summary');
lines.push('');
lines.push('| Metric | Count |');
lines.push('|---|---:|');
for (const [key, value] of Object.entries(results.summary || {})) lines.push(`| ${key} | ${value} |`);
lines.push('');
lines.push('## Priority 1 controlled-pilot modules');
lines.push('');
lines.push('| Module | Status | Checks | Warnings |');
lines.push('|---|---|---:|---:|');
for (const module of priority1) lines.push(`| ${module.id} | ${module.acceptance_status} | ${module.checks?.length ?? 0} | ${module.warnings?.length ?? 0} |`);
lines.push('');
lines.push('## Blocking failures');
lines.push('');
if (blocking.length === 0) lines.push('No blocking Priority 1 module failures were detected.');
else for (const module of blocking) lines.push(`- **${module.id}**: ${module.checks.filter((check) => !check.passed).map((check) => check.id).join(', ')}`);
lines.push('');
lines.push('## Warnings requiring review');
lines.push('');
if (warningModules.length === 0) lines.push('No warnings.');
else for (const module of warningModules) lines.push(`- **${module.id}**: ${(module.warnings || []).join(' | ') || 'Non-blocking evidence warning.'}`);
lines.push('');
lines.push('## Human approval note');
lines.push('');
lines.push(results.human_approval_note || 'Human approval remains manual.');
lines.push('');
writeText('release/v73/module-acceptance-summary.md', `${lines.join('\n')}\n`);

const pack = [];
pack.push('# v7.3 Module Signoff Review Pack');
pack.push('');
pack.push('This pack is for Management/Admin, IT, and Quality review before controlled-pilot signoff.');
pack.push('');
pack.push('## Evidence reviewed');
pack.push('');
pack.push('- v7.2 runtime bridge and authenticated persona proof');
pack.push('- v7.3 module acceptance results');
pack.push('- v6.7.4 restore dry-run evidence');
pack.push('- v6.6 SQL evidence capture');
pack.push('');
pack.push('## Controlled pilot restrictions');
pack.push('');
pack.push('- Synthetic/non-confidential data only');
pack.push('- No real patient identifiers');
pack.push('- No confidential OVR details');
pack.push('- Final approval must still be entered in release/v674 approval JSON files');
pack.push('');
pack.push('## Current status');
pack.push('');
pack.push(`Module acceptance status: **${results.status}**`);
pack.push(`Blocking module failures: **${results.summary?.blocking_failures ?? 'unknown'}**`);
pack.push('');
writeText('release/v73/module-signoff-review-pack.md', `${pack.join('\n')}\n`);

console.log('v7.3 module acceptance reports generated.');
console.log(JSON.stringify({
  status: results.status,
  strict_passed: results.strict_passed,
  summary: 'release/v73/module-acceptance-summary.md',
  review_pack: 'release/v73/module-signoff-review-pack.md'
}, null, 2));
if (!results.strict_passed) process.exit(1);
