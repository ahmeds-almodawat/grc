import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const releaseDir = path.join(root, 'release', 'patch23');

async function read(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

function findMissing(source, required) {
  return required.filter(item => !source.includes(item));
}

const migration = await read('supabase/migrations/085_patch23_evidence_bridge_governance.sql');
const domain = await read('src/types/domain.ts');
const api = await read('src/lib/grcApi.ts');
const evidencePage = await read('src/pages/Evidence.tsx');

const migrationChecks = [
  'evidence_code',
  'evidence_title',
  'sensitivity_level',
  'classification_reason',
  'review_status',
  'evidence_links',
  'evidence_requirements',
  'evidence_review_events',
  'evidence_gate_waivers',
  'v_patch23_evidence_review_queue',
  'v_patch23_evidence_gap_dashboard',
  'v_patch23_evidence_closure_gate_status',
  'v_patch23_evidence_chain_of_custody',
  'v_patch23_evidence_pack_index',
  'v_patch23_sensitive_evidence_register',
  'patch23_evidence_governance_bridge',
];

const typeChecks = [
  'EvidenceReviewStatus',
  'EvidenceSensitivityLevel',
  'EvidenceLinkedItemType',
  'EvidenceRequirementGate',
  'EvidenceFileGovernanceRow',
  'EvidenceLinkRow',
  'EvidenceRequirementRow',
  'EvidenceReviewEventRow',
  'EvidenceGateWaiverRow',
  'EvidenceReviewQueueRow',
  'EvidenceGapDashboardRow',
  'EvidenceClosureGateStatusRow',
  'EvidenceChainOfCustodyRow',
  'EvidencePackIndexRow',
  'SensitiveEvidenceRegisterRow',
];

const apiChecks = [
  'getEvidenceReviewQueue',
  'getEvidenceGapDashboard',
  'getEvidenceClosureGateStatus',
  'getEvidenceChainOfCustody',
  'getEvidencePackIndex',
  'getSensitiveEvidenceRegister',
  'createEvidenceRequirement',
  'linkEvidenceToItem',
  'submitEvidenceForReview',
  'acceptEvidence',
  'rejectEvidence',
  'requestEvidenceRevision',
  'supersedeEvidence',
  'lockEvidence',
  'requestEvidenceGateWaiver',
  'approveEvidenceGateWaiver',
  'rejectEvidenceGateWaiver',
  'checkEvidenceGateStatus',
  'generateEvidencePackIndex',
];

const uiChecks = [
  'Evidence Governance Center',
  'Evidence review queue',
  'Evidence gap dashboard',
  'Evidence closure gate status',
  'Sensitive evidence register',
  'Evidence pack index',
  'Chain of custody',
  'Submit',
  'Accept',
  'Reject',
  'Revision',
  'Supersede',
  'Lock',
];

const results = {
  generated_at: new Date().toISOString(),
  migration_missing: findMissing(migration, migrationChecks),
  type_missing: findMissing(domain, typeChecks),
  api_missing: findMissing(api, apiChecks),
  ui_missing: findMissing(evidencePage, uiChecks),
};

const blocking = [
  ...results.migration_missing,
  ...results.type_missing,
  ...results.api_missing,
  ...results.ui_missing,
];

const report = {
  ...results,
  status: blocking.length ? 'failed' : 'passed',
  blocking_count: blocking.length,
};

await mkdir(releaseDir, { recursive: true });
await writeFile(
  path.join(releaseDir, 'patch23-evidence-governance-audit.json'),
  `${JSON.stringify(report, null, 2)}\n`
);

if (blocking.length) {
  console.error(`Patch 23 evidence governance audit failed: ${blocking.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log('Patch 23 evidence governance audit passed.');
}
