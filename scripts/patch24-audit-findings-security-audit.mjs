import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const releaseDir = path.join(root, 'release', 'patch24');

async function read(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

const migration = await read('supabase/migrations/086_patch24_audit_findings_workflow_hardening.sql');
const api = await read('src/lib/grcApi.ts');
const privilegedAction = await read('supabase/functions/privileged-action/index.ts');
const findings = [];

for (const table of ['audit_finding_due_date_extensions', 'audit_finding_validation_events']) {
  if (!migration.includes(`alter table public.${table} enable row level security`)) {
    findings.push(`${table} RLS is not enabled`);
  }
}

for (const view of [
  'v_patch24_audit_finding_workflow_queue',
  'v_patch24_overdue_audit_findings',
  'v_patch24_repeat_audit_findings',
  'v_patch24_audit_closure_gate_status',
  'v_patch24_audit_executive_escalations',
  'v_patch24_audit_closure_pack_index',
]) {
  if (!migration.includes(`alter view public.${view} set (security_invoker = true)`)) {
    findings.push(`${view} is missing security_invoker`);
  }
}

for (const fn of ['patch24_write_audit_event', 'patch24_audit_finding_workflow_bridge']) {
  const fnStart = migration.indexOf(`function public.${fn}`);
  const fnSlice = fnStart >= 0 ? migration.slice(fnStart, fnStart + 3000) : '';
  if (!fnSlice.includes('security definer')) findings.push(`${fn} is not marked security definer`);
  if (!fnSlice.includes('set search_path = public, pg_temp')) findings.push(`${fn} is missing safe search_path`);
  if (!migration.includes(`revoke all on function public.${fn}`)) findings.push(`${fn} execute is not revoked before grant`);
  if (!migration.includes(`grant execute on function public.${fn}`) || !migration.includes('to service_role')) {
    findings.push(`${fn} is not granted through service_role bridge`);
  }
}

if (api.includes('.rpc(\'patch24_audit_finding_workflow_bridge') || api.includes('.rpc("patch24_audit_finding_workflow_bridge')) {
  findings.push('Browser API calls Patch 24 SQL bridge directly instead of privileged action edge bridge');
}
if (!api.includes('invokePrivilegedAction')) {
  findings.push('Patch 24 API does not use privileged action bridge');
}
if (!privilegedAction.includes('patch24AuditActions') || !privilegedAction.includes('patch24_audit_finding_workflow_bridge')) {
  findings.push('Privileged action edge function does not expose Patch 24 action bridge');
}
if (/SERVICE_ROLE|service_role/i.test(api)) {
  findings.push('Browser API contains a service-role string');
}

const report = {
  generated_at: new Date().toISOString(),
  status: findings.length ? 'failed' : 'passed',
  finding_count: findings.length,
  findings,
};

await mkdir(releaseDir, { recursive: true });
await writeFile(path.join(releaseDir, 'patch24-audit-findings-security-audit.json'), `${JSON.stringify(report, null, 2)}\n`);

if (findings.length) {
  console.error(`Patch 24 audit findings security audit failed: ${findings.join('; ')}`);
  process.exitCode = 1;
} else {
  console.log('Patch 24 audit findings security audit passed.');
}
