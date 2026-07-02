import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const releaseDir = path.join(root, 'release', 'patch23');

async function read(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

const migration = await read('supabase/migrations/085_patch23_evidence_bridge_governance.sql');
const api = await read('src/lib/grcApi.ts');
const evidencePage = await read('src/pages/Evidence.tsx');

const supportedItemTypes = [
  'risk',
  'ovr',
  'audit_finding',
  'compliance',
  'project',
  'milestone',
  'task',
  'approval',
  'capa',
  'control',
  'policy',
  'department',
];

const bridgeActions = [
  'create_evidence_requirement',
  'link_evidence_to_item',
  'submit_evidence_for_review',
  'accept_evidence',
  'reject_evidence',
  'request_evidence_revision',
  'supersede_evidence',
  'lock_evidence',
  'request_evidence_gate_waiver',
  'approve_evidence_gate_waiver',
  'reject_evidence_gate_waiver',
  'check_evidence_gate_status',
  'generate_evidence_pack_index',
];

const missing = [];
for (const itemType of supportedItemTypes) {
  if (!migration.includes(`'${itemType}'`)) missing.push(`linked item type ${itemType}`);
}
for (const action of bridgeActions) {
  if (!migration.includes(`'${action}'`) || !api.includes(`'${action}'`)) {
    missing.push(`bridge action ${action}`);
  }
}

for (const label of ['Risk', 'OVR', 'audit findings', 'compliance', 'projects', 'tasks', 'approvals', 'CAPA']) {
  if (!evidencePage.toLowerCase().includes(label.toLowerCase())) {
    missing.push(`UI bridge mention ${label}`);
  }
}

const report = {
  generated_at: new Date().toISOString(),
  status: missing.length ? 'failed' : 'passed',
  missing_count: missing.length,
  missing,
  supported_item_types: supportedItemTypes,
  bridge_actions: bridgeActions,
};

await mkdir(releaseDir, { recursive: true });
await writeFile(
  path.join(releaseDir, 'patch23-evidence-bridge-audit.json'),
  `${JSON.stringify(report, null, 2)}\n`
);

if (missing.length) {
  console.error(`Patch 23 evidence bridge audit failed: ${missing.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log('Patch 23 evidence bridge audit passed.');
}
