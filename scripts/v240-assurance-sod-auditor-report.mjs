import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const releaseDir = path.join(root, 'release/v240');
fs.mkdirSync(releaseDir, { recursive: true });

const report = `# v24.0 Assurance, SoD, Immutable Log + Auditor Evidence Pack\n\n## Purpose\n\nThis pack closes the final professional external-review gap by defining a minimal assurance layer across framework coverage, segregation of duties, immutable logging, evidence integrity and auditor workspaces.\n\n## Professional assurance chain\n\nFramework Requirement → Control → Test → Evidence Integrity → SoD Check → Immutable Log → Auditor Pack → Assurance Opinion\n\n## Added schema contract\n\n- v240_sod_rules\n- v240_sod_violations\n- v240_immutable_audit_events\n- v240_evidence_integrity_index\n- v240_auditor_workspaces\n- v240_auditor_export_manifests\n\n## Security posture\n\n- RLS explicitly enabled on all v24 tables.\n- Authenticated SELECT/INSERT/UPDATE is deny-by-default pending reviewed org-scoped policies or Edge bridges.\n- No authenticated DELETE policy is added.\n- No broad true RLS policy is introduced.\n\n## What this does not claim\n\nThis pack does not certify the organization, does not replace an external auditor, and does not claim accreditation. It creates the platform evidence structure needed for external review readiness.\n`;

fs.writeFileSync(path.join(releaseDir, 'v240-assurance-sod-auditor-report.md'), report);
console.log('v24.0 assurance report written.');
