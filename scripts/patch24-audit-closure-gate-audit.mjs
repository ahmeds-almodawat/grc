import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const releaseDir = path.join(root, 'release', 'patch24');

async function read(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

const migration = await read('supabase/migrations/086_patch24_audit_findings_workflow_hardening.sql');
const api = await read('src/lib/grcApi.ts');
const auditPage = await read('src/pages/Audit.tsx');

const required = [
  'v_patch24_audit_closure_gate_status',
  'patch24_audit_closure_satisfied',
  'management_response_status',
  'corrective_action_status',
  'accepted_evidence_count',
  'minimum_accepted_evidence_count',
  'approved_waiver_count',
  'evidence_gate_waivers',
  'validate_audit_finding_closure',
  'PATCH24_AUDIT_CLOSURE_BLOCKED',
  'closure_pack_reference',
];

const missing = required.filter(item => !migration.includes(item));

for (const item of ['getAuditClosureGateStatus', 'validateAuditFindingClosure', 'generateAuditClosurePackIndex']) {
  if (!api.includes(item)) missing.push(`api ${item}`);
}

for (const item of ['Closure gate status', 'Closure pack index', 'Validate closure', 'Reject closure']) {
  if (!auditPage.includes(item)) missing.push(`ui ${item}`);
}

const report = {
  generated_at: new Date().toISOString(),
  status: missing.length ? 'failed' : 'passed',
  missing_count: missing.length,
  missing,
};

await mkdir(releaseDir, { recursive: true });
await writeFile(path.join(releaseDir, 'patch24-audit-closure-gate-audit.json'), `${JSON.stringify(report, null, 2)}\n`);

if (missing.length) {
  console.error(`Patch 24 audit closure gate audit failed: ${missing.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log('Patch 24 audit closure gate audit passed.');
}
