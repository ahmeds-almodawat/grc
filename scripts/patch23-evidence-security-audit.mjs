import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const releaseDir = path.join(root, 'release', 'patch23');

async function read(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

const migration = await read('supabase/migrations/085_patch23_evidence_bridge_governance.sql');
const api = await read('src/lib/grcApi.ts');
const privilegedAction = await read('supabase/functions/privileged-action/index.ts');

const findings = [];

for (const table of ['evidence_links', 'evidence_requirements', 'evidence_review_events', 'evidence_gate_waivers']) {
  if (!migration.includes(`alter table public.${table} enable row level security`)) {
    findings.push(`${table} RLS is not enabled`);
  }
}

for (const view of [
  'v_patch23_evidence_review_queue',
  'v_patch23_evidence_gap_dashboard',
  'v_patch23_evidence_closure_gate_status',
  'v_patch23_evidence_chain_of_custody',
  'v_patch23_evidence_pack_index',
  'v_patch23_sensitive_evidence_register',
]) {
  if (!migration.includes(`alter view public.${view} set (security_invoker = true)`)) {
    findings.push(`${view} is missing security_invoker`);
  }
}

for (const fn of ['patch23_write_evidence_event', 'patch23_evidence_governance_bridge']) {
  const fnStart = migration.indexOf(`function public.${fn}`);
  const fnSlice = fnStart >= 0 ? migration.slice(fnStart, fnStart + 3000) : '';
  if (!fnSlice.includes('security definer')) findings.push(`${fn} is not marked security definer`);
  if (!fnSlice.includes('set search_path = public, pg_temp')) findings.push(`${fn} is missing safe search_path`);
  if (!migration.includes(`revoke all on function public.${fn}`)) findings.push(`${fn} execute is not revoked before grant`);
  if (!migration.includes(`grant execute on function public.${fn}`) || !migration.includes('to service_role')) {
    findings.push(`${fn} is not granted only through service_role bridge`);
  }
}

if (api.includes('.rpc(\'patch23_evidence_governance_bridge') || api.includes('.rpc("patch23_evidence_governance_bridge')) {
  findings.push('Browser API calls Patch 23 SQL bridge directly instead of privileged action edge bridge');
}

if (!api.includes('invokePrivilegedAction')) {
  findings.push('Patch 23 API does not use privileged action bridge');
}

if (!privilegedAction.includes('patch23EvidenceActions') || !privilegedAction.includes('patch23_evidence_governance_bridge')) {
  findings.push('Privileged action edge function does not expose Patch 23 action bridge');
}

const sourceFiles = [api, privilegedAction].join('\n');
if (/SERVICE_ROLE|service_role/i.test(api)) {
  findings.push('Browser API contains a service-role string');
}
if (/VITE_.*SERVICE|SERVICE.*VITE/i.test(sourceFiles)) {
  findings.push('Frontend-visible service-role environment pattern found');
}

const report = {
  generated_at: new Date().toISOString(),
  status: findings.length ? 'failed' : 'passed',
  finding_count: findings.length,
  findings,
};

await mkdir(releaseDir, { recursive: true });
await writeFile(
  path.join(releaseDir, 'patch23-evidence-security-audit.json'),
  `${JSON.stringify(report, null, 2)}\n`
);

if (findings.length) {
  console.error(`Patch 23 evidence security audit failed: ${findings.join('; ')}`);
  process.exitCode = 1;
} else {
  console.log('Patch 23 evidence security audit passed.');
}
