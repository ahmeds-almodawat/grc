export type V240AssuranceStatus = 'ready' | 'review_required' | 'blocked' | 'monitoring' | 'evidence_required';
export type V240SodSeverity = 'low' | 'medium' | 'high' | 'critical';
export type V240EvidenceIntegrityStatus = 'indexed' | 'missing_hash' | 'stale' | 'rejected' | 'review_required';
export type V240AuditorAccessMode = 'read_only' | 'export_only' | 'restricted' | 'not_enabled';

export interface V240AssuranceMetric {
  label: string;
  value: string;
  status: V240AssuranceStatus;
  note: string;
}

export interface V240SodRule {
  id: string;
  ruleCode: string;
  title: string;
  restrictedCombination: string;
  severity: V240SodSeverity;
  enforcement: string;
}

export interface V240ImmutableAuditControl {
  id: string;
  control: string;
  evidence: string;
  status: V240AssuranceStatus;
  closureRule: string;
}

export interface V240EvidenceIntegrityItem {
  id: string;
  evidenceType: string;
  sourceModule: string;
  integrityStatus: V240EvidenceIntegrityStatus;
  requiredMetadata: string[];
  auditorNote: string;
}

export interface V240AuditorPackItem {
  id: string;
  packName: string;
  framework: string;
  contents: string[];
  accessMode: V240AuditorAccessMode;
  readiness: V240AssuranceStatus;
}

export const v240ProfessionalAssuranceChain =
  'Framework Requirement → Control → Test → Evidence Integrity → SoD Check → Immutable Log → Auditor Pack → Assurance Opinion';

export const v240AssuranceMetrics: V240AssuranceMetric[] = [
  {
    label: 'Framework coverage',
    value: 'Traceable',
    status: 'monitoring',
    note: 'Coverage must be proven through requirement-control-test-evidence relationships, not narrative statements only.'
  },
  {
    label: 'Segregation of duties',
    value: 'Rule-based',
    status: 'review_required',
    note: 'Conflicting ownership, testing and approval roles must be flagged before closure or external review.'
  },
  {
    label: 'Evidence integrity',
    value: 'Indexed',
    status: 'evidence_required',
    note: 'Evidence should have source, owner, timestamp, hash/checksum and review status before assurance reliance.'
  },
  {
    label: 'Auditor workspace',
    value: 'Read-only',
    status: 'review_required',
    note: 'External and internal auditors need controlled read-only evidence packs with export logs.'
  }
];

export const v240SodRules: V240SodRule[] = [
  {
    id: 'sod-risk-control-test',
    ruleCode: 'SOD-001',
    title: 'Control owner cannot independently pass own control test',
    restrictedCombination: 'control_owner + tester + approver on same control',
    severity: 'high',
    enforcement: 'Require independent reviewer before closure.'
  },
  {
    id: 'sod-audit-finding-owner',
    ruleCode: 'SOD-002',
    title: 'Auditor cannot approve management response for own finding',
    restrictedCombination: 'finding_author + management_response_approver',
    severity: 'high',
    enforcement: 'Route approval to audit lead or governance administrator.'
  },
  {
    id: 'sod-evidence-reviewer',
    ruleCode: 'SOD-003',
    title: 'Evidence uploader cannot be sole evidence reviewer',
    restrictedCombination: 'evidence_uploader + evidence_reviewer',
    severity: 'medium',
    enforcement: 'Require second reviewer for high-risk evidence.'
  }
];

export const v240ImmutableAuditControls: V240ImmutableAuditControl[] = [
  {
    id: 'audit-log-append-only',
    control: 'Append-only audit log',
    evidence: 'Trigger or bridge event with before/after JSON metadata',
    status: 'review_required',
    closureRule: 'No update/delete path for audit records; exceptions require security review.'
  },
  {
    id: 'evidence-integrity-index',
    control: 'Evidence integrity index',
    evidence: 'File hash, source module, linked item, reviewer and timestamp',
    status: 'evidence_required',
    closureRule: 'Evidence cannot support final assurance until accepted and indexed.'
  },
  {
    id: 'auditor-export-log',
    control: 'Auditor export log',
    evidence: 'Read-only/export-only access history and export manifest',
    status: 'monitoring',
    closureRule: 'All auditor evidence exports must be recorded with purpose and scope.'
  }
];

export const v240EvidenceIntegrityItems: V240EvidenceIntegrityItem[] = [
  {
    id: 'ev-risk-control-test',
    evidenceType: 'Control test evidence',
    sourceModule: 'Control Testing',
    integrityStatus: 'indexed',
    requiredMetadata: ['control id', 'test result id', 'reviewer', 'hash/checksum'],
    auditorNote: 'Can be relied on only when the test result and CAPA closure are linked.'
  },
  {
    id: 'ev-policy-attestation',
    evidenceType: 'Policy attestation evidence',
    sourceModule: 'Compliance',
    integrityStatus: 'review_required',
    requiredMetadata: ['policy version', 'audience', 'attestation date', 'exceptions'],
    auditorNote: 'Review overdue or exception attestations before final compliance opinion.'
  },
  {
    id: 'ev-uat-production',
    evidenceType: 'UAT and production readiness proof',
    sourceModule: 'Production Readiness',
    integrityStatus: 'indexed',
    requiredMetadata: ['proof run', 'approver', 'date', 'scope'],
    auditorNote: 'Supports controlled go/no-go decision, not broad production certification.'
  }
];

export const v240AuditorPackItems: V240AuditorPackItem[] = [
  {
    id: 'pack-iso-37301',
    packName: 'Compliance management evidence pack',
    framework: 'ISO 37301',
    contents: ['obligation register', 'policy versions', 'attestations', 'incidents', 'CAPA status'],
    accessMode: 'read_only',
    readiness: 'review_required'
  },
  {
    id: 'pack-iso-31000-coso',
    packName: 'Risk and ERM assurance pack',
    framework: 'ISO 31000 / COSO ERM',
    contents: ['risk register', 'appetite/KRI status', 'control linkage', 'treatment plans'],
    accessMode: 'read_only',
    readiness: 'monitoring'
  },
  {
    id: 'pack-iia',
    packName: 'Internal audit engagement pack',
    framework: 'IIA Standards',
    contents: ['audit universe', 'engagement plan', 'workpapers', 'findings', 'follow-up'],
    accessMode: 'export_only',
    readiness: 'evidence_required'
  }
];
