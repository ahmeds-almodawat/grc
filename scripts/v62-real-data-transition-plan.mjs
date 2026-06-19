import fs from 'node:fs';
import path from 'node:path';

const releaseDir = path.resolve('release', 'v62');
fs.mkdirSync(releaseDir, { recursive: true });

function readJson(name) {
  const file = path.join(releaseDir, name);
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

const staticAudit = readJson('v62-real-data-static-audit.json');
const demoAudit = readJson('v62-demo-boundary-audit.json');
const contractAudit = readJson('v62-live-result-contract-audit.json');
const v60Audit = fs.existsSync(path.resolve('release', 'v60', 'v60-production-data-audit.json'))
  ? JSON.parse(fs.readFileSync(path.resolve('release', 'v60', 'v60-production-data-audit.json'), 'utf8'))
  : null;

const plan = {
  generated_at: new Date().toISOString(),
  v60_blockers: v60Audit?.production_blocking_findings ?? null,
  v62_static_blockers: staticAudit?.production_blocking_findings ?? null,
  demo_boundary_blockers: demoAudit?.production_blocking_findings ?? null,
  live_result_contract_blockers: contractAudit?.production_blocking_findings ?? null,
  next_manual_steps: [
    'Convert high-risk summary APIs to LiveResult<T> one domain at a time.',
    'Separate real data pages from any local demo fixtures.',
    'Replace query catch blocks that return empty objects with query_error states.',
    'Add React empty/error/unauthorized rendering paths for each major hub.',
    'Do not start auth/RLS hardening until typecheck/build/v62 audits pass.'
  ]
};

const md = [
  '# v6.2 Real No-Mock Data Layer Transition Plan',
  '',
  `Generated: ${plan.generated_at}`,
  '',
  '## Current automated checks',
  '',
  `- v6.0 production blockers: **${plan.v60_blockers ?? 'not run'}**`,
  `- v6.2 static blockers: **${plan.v62_static_blockers ?? 'not run'}**`,
  `- Demo boundary blockers: **${plan.demo_boundary_blockers ?? 'not run'}**`,
  `- Live result contract blockers: **${plan.live_result_contract_blockers ?? 'not run'}**`,
  '',
  '## Data-result contract',
  '',
  'Every live-data read should eventually return one of:',
  '',
  '- `live` — real Supabase/Edge data loaded.',
  '- `empty` — query succeeded but no rows exist.',
  '- `unauthorized` — user/session/role is not allowed.',
  '- `configuration_error` — Supabase/Auth/env is not configured.',
  '- `query_error` — query failed and must be visible, not hidden as fake data.',
  '',
  '## Next manual conversion order',
  '',
  '1. Executive summaries and dashboards.',
  '2. OVR and Quality APIs.',
  '3. Risk, compliance and audit APIs.',
  '4. Access control and release/admin APIs.',
  '5. Reports/export/backup APIs.',
  '',
  '## Exit criteria before v6.3 Auth',
  '',
  '- `npm run typecheck` passes.',
  '- `npm run build` passes.',
  '- `npm run v60:strict` reports 0 blockers.',
  '- `npm run v62:all` passes.',
  '- Demo data exists only in `src/demo` and is disabled in production.',
  ''
].join('\n');

fs.writeFileSync(path.join(releaseDir, 'v62-real-data-transition-plan.json'), JSON.stringify(plan, null, 2) + '\n');
fs.writeFileSync(path.join(releaseDir, 'V62_REAL_DATA_TRANSITION_PLAN.md'), md);
console.log('v6.2 real data transition plan generated.');
console.log(JSON.stringify(plan, null, 2));
