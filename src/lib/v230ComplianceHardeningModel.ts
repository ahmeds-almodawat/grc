export type V230AssuranceStatus = 'implemented' | 'in_progress' | 'overdue' | 'blocked' | 'review_required';
export type V230Criticality = 'low' | 'medium' | 'high' | 'critical';
export type V230AttestationStatus = 'acknowledged' | 'pending' | 'overdue' | 'exception';
export type V230VendorTier = 'strategic' | 'critical' | 'standard' | 'low_risk';
export type V230IncidentStatus = 'triage' | 'contained' | 'root_cause_review' | 'notification_review' | 'closed';

export interface V230HardeningMetric {
  label: string;
  value: string;
  status: V230AssuranceStatus;
  note: string;
}

export interface V230PolicyDocument {
  id: string;
  policyCode: string;
  title: string;
  owner: string;
  frameworkLinks: string[];
  version: string;
  nextReviewDate: string;
  attestationStatus: V230AttestationStatus;
  requiredAudience: string;
}

export interface V230RegulatoryChange {
  id: string;
  source: string;
  requirement: string;
  impactArea: string;
  owner: string;
  dueDate: string;
  status: V230AssuranceStatus;
  linkedControl: string;
}

export interface V230VendorRiskItem {
  id: string;
  vendorName: string;
  tier: V230VendorTier;
  serviceScope: string;
  inherentRisk: V230Criticality;
  dueDiligenceStatus: V230AssuranceStatus;
  contractExpiry: string;
  evidenceRequired: string;
}

export interface V230IncidentRegisterItem {
  id: string;
  incidentType: string;
  severity: V230Criticality;
  status: V230IncidentStatus;
  regulatoryClock: string;
  owner: string;
  closureRequirement: string;
}

export const v230ProfessionalHardeningChain =
  'Policy → Attestation → Regulatory Change → Vendor Risk → Incident → Evidence → CAPA → Management Reporting';

export const v230HardeningMetrics: V230HardeningMetric[] = [
  {
    label: 'Policy lifecycle',
    value: 'Versioned',
    status: 'in_progress',
    note: 'Policies must have owner, version, review date, approval evidence and staff attestation.'
  },
  {
    label: 'Regulatory change',
    value: 'Tracked',
    status: 'review_required',
    note: 'New or changed requirements must be assessed, mapped to controls and reviewed by compliance.'
  },
  {
    label: 'Vendor risk',
    value: 'Lite register',
    status: 'in_progress',
    note: 'Critical vendors must have due diligence, contract expiry, risk tier and evidence status.'
  },
  {
    label: 'Incident readiness',
    value: 'Escalation-ready',
    status: 'review_required',
    note: 'Security and compliance incidents require triage, root cause, notification review and closure evidence.'
  }
];

export const v230PolicyDocuments: V230PolicyDocument[] = [
  {
    id: 'POL-CMP-001',
    policyCode: 'CMP-001',
    title: 'Compliance Management Policy',
    owner: 'Compliance Officer',
    frameworkLinks: ['ISO 37301', 'COSO ERM'],
    version: '1.0',
    nextReviewDate: 'Quarterly review required',
    attestationStatus: 'pending',
    requiredAudience: 'Managers and control owners'
  },
  {
    id: 'POL-RSK-001',
    policyCode: 'RSK-001',
    title: 'Enterprise Risk Management Policy',
    owner: 'Risk Owner',
    frameworkLinks: ['ISO 31000', 'COSO ERM'],
    version: '1.0',
    nextReviewDate: 'Annual review required',
    attestationStatus: 'pending',
    requiredAudience: 'Executives and risk owners'
  },
  {
    id: 'POL-SEC-001',
    policyCode: 'SEC-001',
    title: 'Information Security and Evidence Handling Policy',
    owner: 'IT / Security',
    frameworkLinks: ['ISO 27001', 'SOC 2'],
    version: '1.0',
    nextReviewDate: 'Annual review required',
    attestationStatus: 'exception',
    requiredAudience: 'System administrators and evidence reviewers'
  }
];

export const v230RegulatoryChanges: V230RegulatoryChange[] = [
  {
    id: 'REG-CHG-001',
    source: 'Internal compliance monitoring',
    requirement: 'Any new regulatory obligation must be linked to a control, evidence requirement and accountable owner.',
    impactArea: 'Compliance obligations',
    owner: 'Compliance Officer',
    dueDate: 'Before live production use',
    status: 'review_required',
    linkedControl: 'Framework crosswalk control mapping'
  },
  {
    id: 'REG-CHG-002',
    source: 'Audit readiness',
    requirement: 'Policy changes must preserve version history and require attestation where applicable.',
    impactArea: 'Policy governance',
    owner: 'Governance Admin',
    dueDate: 'Before external audit review',
    status: 'in_progress',
    linkedControl: 'Policy lifecycle control'
  }
];

export const v230VendorRisks: V230VendorRiskItem[] = [
  {
    id: 'VEN-001',
    vendorName: 'Cloud hosting / Supabase services',
    tier: 'critical',
    serviceScope: 'Database, authentication and evidence metadata runtime',
    inherentRisk: 'high',
    dueDiligenceStatus: 'review_required',
    contractExpiry: 'Track before production',
    evidenceRequired: 'Security review, access model review and backup/restore dependency review'
  },
  {
    id: 'VEN-002',
    vendorName: 'External auditor / reviewer',
    tier: 'standard',
    serviceScope: 'Read-only evidence review and assurance reporting',
    inherentRisk: 'medium',
    dueDiligenceStatus: 'in_progress',
    contractExpiry: 'Track if engaged',
    evidenceRequired: 'NDA, scope approval and read-only role confirmation'
  }
];

export const v230Incidents: V230IncidentRegisterItem[] = [
  {
    id: 'INC-001',
    incidentType: 'Evidence confidentiality exception',
    severity: 'high',
    status: 'notification_review',
    regulatoryClock: 'Manual review required before external disclosure',
    owner: 'Quality / Compliance',
    closureRequirement: 'Root cause, containment action, evidence correction and management sign-off'
  },
  {
    id: 'INC-002',
    incidentType: 'Unauthorized role or access exception',
    severity: 'critical',
    status: 'triage',
    regulatoryClock: 'Immediate security review',
    owner: 'IT / Security',
    closureRequirement: 'Access removal, audit log review, RLS verification and CAPA'
  }
];
