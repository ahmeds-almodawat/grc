import type {
  AccessControlWarningRow,
  AccessControlUserRow,
  AccessControlSummary,
  ApprovalRow,
  AuditFindingRow,
  ComplianceRow,
  CriticalAttentionItem,
  CustomReportDefinition,
  ExportCenterSummary,
  DelayReasonQueueRow,
  DepartmentOption,
  EvidenceRow,
  EscalationRow,
  ExecutiveSummary,
  GovernanceDecisionRow,
  GrcKpiScorecard,
  DepartmentRiskHeatmapRow,
  MonthlyGrcTrendRow,
  RadarControlProfileRow,
  ManagementControlSummary,
  MilestoneRow,
  MyWorkRow,
  OrganizationOption,
  OvrReportRow,
  OvrSummary,
  OvrRiskDepartmentIndicator,
  OvrRepeatedCategoryAlert,
  OvrRiskIndicatorSummary,
  ProfileOption,
  ProjectRow,
  RiskRow,
  TaskRow
} from '../types/domain';

export const fallbackOrganization: OrganizationOption = {
  id: 'demo-org',
  name_en: 'Al Modawat Specialized Medical Company',
  name_ar: 'شركة المداواة التخصصية الطبية'
};

export const fallbackDepartments: DepartmentOption[] = [
  { id: 'finance', name_en: 'Finance', name_ar: 'المالية' },
  { id: 'governance', name_en: 'Governance & Compliance', name_ar: 'الحوكمة والالتزام' },
  { id: 'quality', name_en: 'Quality', name_ar: 'الجودة' },
  { id: 'engineering', name_en: 'Engineering & Projects', name_ar: 'الهندسة والمشاريع' },
  { id: 'hr', name_en: 'Human Resources', name_ar: 'الموارد البشرية' },
  { id: 'it', name_en: 'Information Technology', name_ar: 'تقنية المعلومات' },
  { id: 'nursing', name_en: 'Nursing', name_ar: 'التمريض' }
];

export const fallbackProfiles: ProfileOption[] = [
  { id: 'finance-manager', full_name_en: 'Finance Manager', full_name_ar: null, email: 'finance.manager@almodawat.sa' },
  { id: 'governance-manager', full_name_en: 'Governance Manager', full_name_ar: null, email: 'governance.manager@almodawat.sa' },
  { id: 'quality-manager', full_name_en: 'Quality Manager', full_name_ar: null, email: 'quality.manager@almodawat.sa' },
  { id: 'engineering-manager', full_name_en: 'Engineering Manager', full_name_ar: null, email: 'engineering.manager@almodawat.sa' },
  { id: 'audit-manager', full_name_en: 'Internal Audit Manager', full_name_ar: null, email: 'audit.manager@almodawat.sa' },
  { id: 'it-manager', full_name_en: 'IT Manager', full_name_ar: null, email: 'it.manager@almodawat.sa' }
];

export const fallbackExecutiveSummary: ExecutiveSummary = {
  activeProjects: 18,
  overdueProjects: 3,
  overdueMilestones: 7,
  overdueTasks: 22,
  criticalOpenRisks: 5,
  complianceExpiring30Days: 9,
  overdueAuditFindings: 4,
  pendingApprovals: 12,
  pendingEvidenceReviews: 16
};

export const fallbackCriticalItems: CriticalAttentionItem[] = [
  {
    id: '1',
    itemType: 'Project',
    title: 'Weekly cash forecast and government collection escalation',
    owner: 'Finance Manager',
    department: 'Finance',
    dueDate: '2026-07-30',
    status: 'At Risk',
    riskLevel: 'critical',
    progress: 45
  },
  {
    id: '2',
    itemType: 'Project',
    title: 'Authority matrix implementation',
    owner: 'Governance Manager',
    department: 'Governance & Compliance',
    dueDate: '2026-08-15',
    status: 'Active',
    riskLevel: 'high',
    progress: 25
  },
  {
    id: '3',
    itemType: 'Compliance',
    title: 'Civil Defense compliance evidence renewal',
    owner: 'Engineering Manager',
    department: 'Engineering & Projects',
    dueDate: '2026-07-05',
    status: 'Delayed',
    riskLevel: 'critical',
    progress: 70
  },
  {
    id: '4',
    itemType: 'Audit Finding',
    title: 'Payment approval documentation missing in sample review',
    owner: 'CFO Office',
    department: 'Finance',
    dueDate: '2026-07-20',
    status: 'Evidence Submitted',
    riskLevel: 'high',
    progress: 90
  }
];

export const fallbackProjects: ProjectRow[] = fallbackCriticalItems.slice(0, 2).map(item => ({
  id: item.id,
  organization_id: 'demo-org',
  title: item.title,
  description: 'Demo controlled action plan. Connect Supabase to display live data.',
  category: item.itemType,
  source_type: item.id === '2' ? 'ceo_decision' : 'risk',
  owner_id: null,
  sponsor_id: null,
  start_date: '2026-07-01',
  target_end_date: item.dueDate,
  priority: item.riskLevel === 'critical' ? 'critical' : 'high',
  risk_level: item.riskLevel,
  status: item.status.toLowerCase().replaceAll(' ', '_') as ProjectRow['status'],
  progress_percent: item.progress || 0,
  evidence_required: true,
  closure_approval_required: true,
  delay_reason: null,
  departments: { name_en: item.department, name_ar: null },
  owner: { full_name_en: item.owner, full_name_ar: null }
}));

export const fallbackMilestones: MilestoneRow[] = [
  {
    id: 'milestone-1',
    organization_id: 'demo-org',
    project_id: '1',
    title: 'Define weekly cash forecast template and owners',
    description: 'Create the official template, submission cycle and ownership.',
    owner_id: 'finance-manager',
    start_date: '2026-07-01',
    due_date: '2026-07-10',
    status: 'in_progress',
    progress_percent: 60,
    evidence_required: true,
    delay_reason: null,
    owner: { full_name_en: 'Finance Manager', full_name_ar: null }
  },
  {
    id: 'milestone-2',
    organization_id: 'demo-org',
    project_id: '1',
    title: 'Build payer escalation dashboard',
    description: 'Connect aging report and government collection follow-up.',
    owner_id: 'finance-manager',
    start_date: '2026-07-11',
    due_date: '2026-07-30',
    status: 'not_started',
    progress_percent: 0,
    evidence_required: true,
    delay_reason: null,
    owner: { full_name_en: 'Finance Manager', full_name_ar: null }
  }
];

export const fallbackTasks: TaskRow[] = [
  {
    id: 'task-1',
    organization_id: 'demo-org',
    project_id: '1',
    milestone_id: 'milestone-1',
    title: 'Upload draft forecast template',
    description: 'Attach the first weekly forecast file for review.',
    owner_id: 'finance-manager',
    assigned_to: 'finance-manager',
    start_date: '2026-07-01',
    due_date: '2026-07-08',
    status: 'in_progress',
    progress_percent: 50,
    evidence_required: true,
    delay_reason: null,
    owner: { full_name_en: 'Finance Manager', full_name_ar: null },
    assignee: { full_name_en: 'Finance Manager', full_name_ar: null }
  },
  {
    id: 'task-2',
    organization_id: 'demo-org',
    project_id: '2',
    milestone_id: null,
    title: 'Collect department approval limits',
    description: 'Governance team to collect current approval practice from major departments.',
    owner_id: 'governance-manager',
    assigned_to: 'governance-manager',
    start_date: '2026-07-05',
    due_date: '2026-07-20',
    status: 'not_started',
    progress_percent: 0,
    evidence_required: true,
    delay_reason: null,
    owner: { full_name_en: 'Governance Manager', full_name_ar: null },
    assignee: { full_name_en: 'Governance Manager', full_name_ar: null }
  }
];

export const fallbackRisks: RiskRow[] = [
  {
    id: 'risk-1',
    organization_id: 'demo-org',
    risk_code: 'FIN-001',
    title: 'Government payer collection delay affecting cash flow',
    description: 'Large payer collection cycle may pressure salary and supplier commitments.',
    category: 'financial',
    owner_id: null,
    likelihood: 5,
    impact: 5,
    inherent_score: 25,
    residual_score: 15,
    risk_level: 'critical',
    response_type: 'reduce',
    status: 'mitigating',
    next_review_date: '2026-07-15',
    departments: { name_en: 'Finance', name_ar: 'المالية' },
    owner: { full_name_en: 'Finance Manager', full_name_ar: null }
  },
  {
    id: 'risk-2',
    organization_id: 'demo-org',
    risk_code: 'STR-001',
    title: 'New 200-bed competitor opening in the region',
    description: 'Potential impact on occupancy, specialist retention and pricing pressure.',
    category: 'strategic',
    owner_id: null,
    likelihood: 4,
    impact: 4,
    inherent_score: 16,
    residual_score: 12,
    risk_level: 'high',
    response_type: 'monitor',
    status: 'monitoring',
    next_review_date: '2026-08-01',
    departments: { name_en: 'Executive', name_ar: null },
    owner: { full_name_en: 'Executive Sponsor', full_name_ar: null }
  }
];

export const fallbackCompliance: ComplianceRow[] = [
  {
    id: 'compliance-1',
    organization_id: 'demo-org',
    compliance_code: 'COMP-001',
    title: 'Civil Defense certificate renewal and evidence upload',
    description: 'Renew and upload the valid certificate before expiry.',
    regulatory_body: 'Civil Defense',
    owner_id: null,
    due_date: '2026-07-05',
    expiry_date: '2026-07-10',
    risk_level: 'critical',
    status: 'due_soon',
    departments: { name_en: 'Engineering & Projects', name_ar: null },
    owner: { full_name_en: 'Engineering Manager', full_name_ar: null }
  }
];

export const fallbackAuditFindings: AuditFindingRow[] = [
  {
    id: 'audit-1',
    organization_id: 'demo-org',
    finding_code: 'IA-2026-001',
    audit_title: 'Payment Controls Review',
    title: 'Approval evidence missing for selected payment samples',
    description: 'Some payment samples did not include documented authority approval evidence.',
    risk_level: 'high',
    due_date: '2026-07-20',
    status: 'evidence_submitted',
    departments: { name_en: 'Finance', name_ar: 'المالية' },
    owner: { full_name_en: 'CFO Office', full_name_ar: null }
  }
];

export const fallbackDecisions: GovernanceDecisionRow[] = [
  {
    id: 'decision-1',
    organization_id: 'demo-org',
    decision_code: 'CEO-2026-001',
    title: 'Implement authority matrix across all departments',
    decision_text: 'All departments must operate under a documented authority matrix with evidence-based approval workflow.',
    due_date: '2026-08-15',
    priority: 'critical',
    risk_level: 'high',
    status: 'in_progress',
    departments: { name_en: 'Governance & Compliance', name_ar: null },
    owner: { full_name_en: 'Governance Manager', full_name_ar: null }
  }
];

export const fallbackMyWork: MyWorkRow[] = [
  {
    id: 'task-1',
    organization_id: 'demo-org',
    item_type: 'task',
    title: 'Upload draft forecast template',
    due_date: '2026-07-08',
    status: 'in_progress',
    progress_percent: 50,
    project_id: '1',
    milestone_id: 'milestone-1',
    project_title: 'Weekly cash forecast and government collection escalation',
    department_name: 'Finance'
  },
  {
    id: 'milestone-1',
    organization_id: 'demo-org',
    item_type: 'milestone',
    title: 'Define weekly cash forecast template and owners',
    due_date: '2026-07-10',
    status: 'in_progress',
    progress_percent: 60,
    project_id: '1',
    milestone_id: null,
    project_title: 'Weekly cash forecast and government collection escalation',
    department_name: 'Finance'
  }
];

export const fallbackApprovals: ApprovalRow[] = [
  {
    id: 'approval-1',
    organization_id: 'demo-org',
    item_type: 'project',
    item_title: 'Authority matrix implementation',
    requested_by_name: 'Governance Manager',
    approver_name: 'Executive Sponsor',
    status: 'pending',
    request_note: 'Request to approve project activation and timeline.',
    decision_note: null,
    requested_at: '2026-07-01T09:00:00+03:00',
    decided_at: null
  }
];

export const fallbackEvidence: EvidenceRow[] = [
  {
    id: 'evidence-1',
    organization_id: 'demo-org',
    item_type: 'audit_finding',
    item_title: 'Approval evidence missing for selected payment samples',
    file_name: 'payment-control-sample-review.pdf',
    file_path: 'demo/audit/payment-control-sample-review.pdf',
    description: 'Corrective action evidence uploaded for audit review.',
    status: 'submitted',
    uploaded_by_name: 'Finance Manager',
    reviewed_by_name: null,
    created_at: '2026-07-10T10:00:00+03:00'
  }
];


export const fallbackEscalations: EscalationRow[] = [
  {
    id: 'esc-1',
    organization_id: 'demo-org',
    item_type: 'project',
    item_id: '1',
    title: 'Weekly cash forecast and government collection escalation',
    escalation_level: 'executive',
    reason: 'Project is overdue and requires management action.',
    status: 'open',
    due_date: '2026-07-30',
    risk_level: 'critical',
    triggered_at: '2026-08-01T09:00:00+03:00',
    acknowledged_at: null,
    resolved_at: null,
    resolution_note: null,
    department_name: 'Finance',
    owner_name: 'Finance Manager',
    acknowledged_by_name: null,
    resolved_by_name: null
  },
  {
    id: 'esc-2',
    organization_id: 'demo-org',
    item_type: 'compliance_item',
    item_id: 'compliance-1',
    title: 'Civil Defense certificate renewal and evidence upload',
    escalation_level: 'manager',
    reason: 'Compliance item is approaching expiry.',
    status: 'acknowledged',
    due_date: '2026-07-10',
    risk_level: 'critical',
    triggered_at: '2026-06-20T09:00:00+03:00',
    acknowledged_at: '2026-06-20T10:30:00+03:00',
    resolved_at: null,
    resolution_note: 'Engineering manager acknowledged and started evidence collection.',
    department_name: 'Engineering & Projects',
    owner_name: 'Engineering Manager',
    acknowledged_by_name: 'Engineering Manager',
    resolved_by_name: null
  }
];

export const fallbackDelayReasonQueue: DelayReasonQueueRow[] = [
  {
    organization_id: 'demo-org',
    item_type: 'task',
    item_id: 'delay-1',
    title: 'Upload corrective action evidence for payment approval samples',
    department_name: 'Finance',
    owner_name: 'Finance Manager',
    due_date: '2026-07-08',
    risk_level: 'high',
    status: 'in_progress',
    missing_reason: 'Overdue task missing mandatory delay reason.'
  }
];

export const fallbackManagementControlSummary: ManagementControlSummary = {
  organization_id: 'demo-org',
  open_escalations: 1,
  acknowledged_escalations: 1,
  executive_escalations: 1,
  critical_escalations: 2,
  missing_delay_reasons: 1
};


export const fallbackAccessControlSummary: AccessControlSummary = {
  organization_id: 'demo-org',
  active_users: 1000,
  inactive_users: 0,
  active_role_assignments: 1180,
  global_role_assignments: 8,
  access_warnings: 3,
  active_users_without_roles: 24
};

export const fallbackAccessControlUsers: AccessControlUserRow[] = [
  {
    organization_id: 'demo-org',
    user_id: 'governance-manager',
    employee_no: '10010',
    full_name_en: 'Governance Manager',
    full_name_ar: null,
    email: 'governance.manager@almodawat.sa',
    job_title: 'Governance Manager',
    user_active: true,
    division_name: 'Administration',
    department_name: 'Governance & Compliance',
    unit_name: null,
    active_role_count: 2,
    roles: [
      { user_role_id: 'role-gov-1', role: 'governance_admin', scope: 'global', organization_id: 'demo-org', division_id: null, department_id: null, unit_id: null, is_active: true, assigned_at: '2026-07-01T09:00:00+03:00' },
      { user_role_id: 'role-gov-2', role: 'department_manager', scope: 'department', organization_id: 'demo-org', division_id: null, department_id: 'governance', unit_id: null, is_active: true, assigned_at: '2026-07-01T09:00:00+03:00' }
    ],
    owned_open_projects: 3,
    open_tasks: 5,
    pending_approvals: 2
  },
  {
    organization_id: 'demo-org',
    user_id: 'finance-manager',
    employee_no: '10001',
    full_name_en: 'Finance Manager',
    full_name_ar: null,
    email: 'finance.manager@almodawat.sa',
    job_title: 'Finance Manager',
    user_active: true,
    division_name: 'Administration',
    department_name: 'Finance',
    unit_name: null,
    active_role_count: 1,
    roles: [
      { user_role_id: 'role-fin-1', role: 'department_manager', scope: 'department', organization_id: 'demo-org', division_id: null, department_id: 'finance', unit_id: null, is_active: true, assigned_at: '2026-07-01T09:00:00+03:00' }
    ],
    owned_open_projects: 4,
    open_tasks: 8,
    pending_approvals: 1
  },
  {
    organization_id: 'demo-org',
    user_id: 'nurse-employee',
    employee_no: '20440',
    full_name_en: 'Nursing Employee Demo',
    full_name_ar: null,
    email: '20440@almodawat.sa',
    job_title: 'Staff Nurse',
    user_active: true,
    division_name: 'Medical',
    department_name: 'Nursing',
    unit_name: 'ICU',
    active_role_count: 1,
    roles: [
      { user_role_id: 'role-nurse-1', role: 'employee', scope: 'assigned_only', organization_id: 'demo-org', division_id: null, department_id: null, unit_id: null, is_active: true, assigned_at: '2026-07-01T09:00:00+03:00' }
    ],
    owned_open_projects: 0,
    open_tasks: 2,
    pending_approvals: 0
  }
];

export const fallbackAccessControlWarnings: AccessControlWarningRow[] = [
  {
    id: 'warning-1',
    organization_id: 'demo-org',
    user_id: 'governance-manager',
    full_name_en: 'Governance Manager',
    email: 'governance.manager@almodawat.sa',
    warning_type: 'global_sensitive_role',
    warning_message: 'Global role granted. Confirm this user really needs company-wide access.',
    severity: 'high'
  },
  {
    id: 'warning-2',
    organization_id: 'demo-org',
    user_id: 'demo-viewer',
    full_name_en: 'Demo Viewer',
    email: 'viewer@almodawat.sa',
    warning_type: 'employee_with_broad_scope',
    warning_message: 'Employee/viewer role has broad scope. Use assigned_only unless intentionally expanded.',
    severity: 'medium'
  }
];

export const fallbackOvrSummary: OvrSummary = {
  organization_id: 'demo-org',
  total_reports: 14,
  open_reports: 9,
  under_quality_review: 3,
  corrective_actions_required: 4,
  sentinel_events: 1,
  near_miss_level_1: 5
};

export const fallbackOvrReports: OvrReportRow[] = [
  {
    id: 'ovr-1',
    organization_id: 'demo-org',
    ovr_number: 'OVR-2026-0001',
    logging_number: 'QMD-001',
    occurrence_date: '2026-07-03',
    occurrence_time: '10:20',
    occurrence_location: 'Emergency Department',
    involved_person_type: 'patient',
    person_involved_name: 'Confidential Patient',
    mrn_or_id_no: 'MR-XXXX',
    department_id: 'nursing',
    brief_description: 'Near-miss medication administration issue discovered before administration.',
    occurrence_category: 'medications',
    severity_level: 'level_1',
    injury_type: 'none_observed',
    status: 'under_quality_review',
    corrective_action_required: true,
    linked_project_id: null,
    created_at: '2026-07-03T10:45:00+03:00',
    departments: { name_en: 'Nursing', name_ar: 'التمريض' },
    reporter: { full_name_en: 'Staff Nurse', full_name_ar: null },
    owner: { full_name_en: 'Quality Manager', full_name_ar: null }
  },
  {
    id: 'ovr-2',
    organization_id: 'demo-org',
    ovr_number: 'OVR-2026-0002',
    logging_number: 'QMD-002',
    occurrence_date: '2026-07-05',
    occurrence_time: '16:10',
    occurrence_location: 'Ward A',
    involved_person_type: 'patient',
    person_involved_name: 'Confidential Patient',
    mrn_or_id_no: 'MR-XXXX',
    department_id: 'quality',
    brief_description: 'Patient fall reported and referred for supervisor/HOD investigation.',
    occurrence_category: 'falls_injury',
    severity_level: 'level_3',
    injury_type: 'abrasion',
    status: 'under_supervisor_review',
    corrective_action_required: true,
    linked_project_id: null,
    created_at: '2026-07-05T16:30:00+03:00',
    departments: { name_en: 'Quality', name_ar: 'الجودة' },
    reporter: { full_name_en: 'Ward Supervisor', full_name_ar: null },
    owner: { full_name_en: 'Quality Manager', full_name_ar: null }
  }
];


export const fallbackOvrRiskIndicatorSummary: OvrRiskIndicatorSummary = {
  organization_id: 'demo-org',
  total_ovrs_30d: 14,
  total_ovrs_90d: 38,
  open_ovrs: 9,
  weighted_score_30d: 31,
  major_or_sentinel_ovrs_90d: 2,
  repeated_category_alerts_30d: 3,
  overdue_corrective_actions: 2,
  avg_closure_days: 6,
  overall_signal_level: 'high'
};

export const fallbackOvrRiskDepartmentIndicators: OvrRiskDepartmentIndicator[] = [
  {
    organization_id: 'demo-org',
    department_id: 'nursing',
    department_name: 'Nursing',
    ovr_count_30d: 8,
    ovr_count_90d: 21,
    weighted_score_30d: 17,
    major_or_sentinel_ovrs_90d: 1,
    repeated_category_alerts_30d: 2,
    repeated_categories: 'falls_injury, medications',
    overdue_corrective_actions: 1,
    avg_closure_days: 7,
    risk_signal_level: 'high'
  },
  {
    organization_id: 'demo-org',
    department_id: 'pharmacy',
    department_name: 'Pharmacy',
    ovr_count_30d: 4,
    ovr_count_90d: 11,
    weighted_score_30d: 9,
    major_or_sentinel_ovrs_90d: 0,
    repeated_category_alerts_30d: 1,
    repeated_categories: 'medications',
    overdue_corrective_actions: 1,
    avg_closure_days: 5,
    risk_signal_level: 'medium'
  },
  {
    organization_id: 'demo-org',
    department_id: 'engineering',
    department_name: 'Engineering & Projects',
    ovr_count_30d: 2,
    ovr_count_90d: 6,
    weighted_score_30d: 5,
    major_or_sentinel_ovrs_90d: 1,
    repeated_category_alerts_30d: 0,
    repeated_categories: null,
    overdue_corrective_actions: 0,
    avg_closure_days: 4,
    risk_signal_level: 'medium'
  }
];

export const fallbackOvrRepeatedCategoryAlerts: OvrRepeatedCategoryAlert[] = [
  {
    organization_id: 'demo-org',
    department_id: 'nursing',
    department_name: 'Nursing',
    occurrence_category: 'falls_injury',
    category_count_30d: 3,
    max_severity_weight: 3,
    max_severity_level: 'level_3',
    alert_level: 'high'
  },
  {
    organization_id: 'demo-org',
    department_id: 'nursing',
    department_name: 'Nursing',
    occurrence_category: 'medications',
    category_count_30d: 3,
    max_severity_weight: 2,
    max_severity_level: 'level_2',
    alert_level: 'medium'
  },
  {
    organization_id: 'demo-org',
    department_id: 'pharmacy',
    department_name: 'Pharmacy',
    occurrence_category: 'medications',
    category_count_30d: 4,
    max_severity_weight: 3,
    max_severity_level: 'level_3',
    alert_level: 'high'
  }
];

export const fallbackGrcKpiScorecard: GrcKpiScorecard = {
  organization_id: 'demo-org',
  execution_health_score: 72,
  risk_exposure_score: 68,
  compliance_pressure_score: 54,
  ovr_safety_signal_score: 62,
  evidence_discipline_score: 76,
  approval_bottleneck_score: 48
};

export const fallbackDepartmentRiskHeatmap: DepartmentRiskHeatmapRow[] = [
  {
    organization_id: 'demo-org',
    department_id: 'nursing',
    department_name: 'Nursing',
    active_projects: 5,
    overdue_projects: 1,
    overdue_milestones: 4,
    overdue_tasks: 9,
    critical_risks: 2,
    compliance_expiring_30_days: 1,
    overdue_audit_findings: 1,
    ovr_weighted_score_30d: 17,
    execution_pressure_score: 62,
    risk_pressure_score: 85,
    compliance_pressure_score: 34,
    ovr_pressure_score: 76,
    overall_pressure_score: 70,
    signal_level: 'high'
  },
  {
    organization_id: 'demo-org',
    department_id: 'finance',
    department_name: 'Finance',
    active_projects: 4,
    overdue_projects: 1,
    overdue_milestones: 2,
    overdue_tasks: 7,
    critical_risks: 2,
    compliance_expiring_30_days: 2,
    overdue_audit_findings: 2,
    ovr_weighted_score_30d: 0,
    execution_pressure_score: 55,
    risk_pressure_score: 78,
    compliance_pressure_score: 64,
    ovr_pressure_score: 0,
    overall_pressure_score: 58,
    signal_level: 'high'
  },
  {
    organization_id: 'demo-org',
    department_id: 'quality',
    department_name: 'Quality',
    active_projects: 3,
    overdue_projects: 0,
    overdue_milestones: 1,
    overdue_tasks: 3,
    critical_risks: 1,
    compliance_expiring_30_days: 3,
    overdue_audit_findings: 0,
    ovr_weighted_score_30d: 11,
    execution_pressure_score: 24,
    risk_pressure_score: 45,
    compliance_pressure_score: 60,
    ovr_pressure_score: 50,
    overall_pressure_score: 45,
    signal_level: 'medium'
  },
  {
    organization_id: 'demo-org',
    department_id: 'engineering',
    department_name: 'Engineering & Projects',
    active_projects: 3,
    overdue_projects: 1,
    overdue_milestones: 2,
    overdue_tasks: 4,
    critical_risks: 1,
    compliance_expiring_30_days: 2,
    overdue_audit_findings: 1,
    ovr_weighted_score_30d: 5,
    execution_pressure_score: 48,
    risk_pressure_score: 48,
    compliance_pressure_score: 56,
    ovr_pressure_score: 35,
    overall_pressure_score: 47,
    signal_level: 'medium'
  },
  {
    organization_id: 'demo-org',
    department_id: 'it',
    department_name: 'Information Technology',
    active_projects: 2,
    overdue_projects: 0,
    overdue_milestones: 1,
    overdue_tasks: 2,
    critical_risks: 1,
    compliance_expiring_30_days: 1,
    overdue_audit_findings: 0,
    ovr_weighted_score_30d: 0,
    execution_pressure_score: 18,
    risk_pressure_score: 42,
    compliance_pressure_score: 20,
    ovr_pressure_score: 0,
    overall_pressure_score: 22,
    signal_level: 'low'
  }
];

export const fallbackMonthlyGrcTrend: MonthlyGrcTrendRow[] = [
  { organization_id: 'demo-org', month_start: '2026-02-01', month_label: 'Feb', new_projects: 5, closed_projects: 2, new_risks: 3, new_audit_findings: 2, ovr_reports: 8, major_ovrs: 0 },
  { organization_id: 'demo-org', month_start: '2026-03-01', month_label: 'Mar', new_projects: 6, closed_projects: 3, new_risks: 4, new_audit_findings: 3, ovr_reports: 10, major_ovrs: 1 },
  { organization_id: 'demo-org', month_start: '2026-04-01', month_label: 'Apr', new_projects: 7, closed_projects: 4, new_risks: 3, new_audit_findings: 4, ovr_reports: 12, major_ovrs: 0 },
  { organization_id: 'demo-org', month_start: '2026-05-01', month_label: 'May', new_projects: 8, closed_projects: 4, new_risks: 5, new_audit_findings: 2, ovr_reports: 14, major_ovrs: 1 },
  { organization_id: 'demo-org', month_start: '2026-06-01', month_label: 'Jun', new_projects: 10, closed_projects: 6, new_risks: 6, new_audit_findings: 4, ovr_reports: 17, major_ovrs: 2 },
  { organization_id: 'demo-org', month_start: '2026-07-01', month_label: 'Jul', new_projects: 9, closed_projects: 5, new_risks: 4, new_audit_findings: 3, ovr_reports: 14, major_ovrs: 1 }
];

export const fallbackRadarControlProfile: RadarControlProfileRow[] = [
  { organization_id: 'demo-org', dimension_key: 'execution', dimension_label_en: 'Execution', dimension_label_ar: 'التنفيذ', score: 72 },
  { organization_id: 'demo-org', dimension_key: 'risk', dimension_label_en: 'Risk control', dimension_label_ar: 'ضبط المخاطر', score: 58 },
  { organization_id: 'demo-org', dimension_key: 'compliance', dimension_label_en: 'Compliance', dimension_label_ar: 'الالتزام', score: 64 },
  { organization_id: 'demo-org', dimension_key: 'audit', dimension_label_en: 'Audit closure', dimension_label_ar: 'إغلاق المراجعة', score: 66 },
  { organization_id: 'demo-org', dimension_key: 'ovr', dimension_label_en: 'OVR safety', dimension_label_ar: 'سلامة OVR', score: 60 },
  { organization_id: 'demo-org', dimension_key: 'evidence', dimension_label_en: 'Evidence discipline', dimension_label_ar: 'انضباط الأدلة', score: 76 }
];


export const fallbackExportCenterSummary: ExportCenterSummary = {
  organization_id: 'demo-org',
  custom_reports: 4,
  exports_30d: 12,
  backups_30d: 3,
  available_datasets: 15,
  last_export_at: '2026-07-15T09:30:00+03:00',
  last_backup_at: '2026-07-14T23:00:00+03:00'
};

export const fallbackCustomReports: CustomReportDefinition[] = [
  {
    id: 'report-exec-pack',
    organization_id: 'demo-org',
    report_key: 'executive_grc_pack',
    name_en: 'Executive GRC pack',
    name_ar: 'حزمة الحوكمة التنفيذية',
    description: 'Projects, risks, compliance, audit, OVR and dashboard KPIs for weekly executive review.',
    datasets: ['kpi_scorecard', 'department_heatmap', 'projects', 'risks', 'compliance', 'audit_findings', 'ovr_risk_indicators'],
    filters: { scope: 'executive', include_closed: false },
    columns: null,
    is_active: true,
    created_at: '2026-07-01T10:00:00+03:00'
  },
  {
    id: 'report-ovr-quality',
    organization_id: 'demo-org',
    report_key: 'ovr_quality_pack',
    name_en: 'OVR and patient safety pack',
    name_ar: 'حزمة OVR وسلامة المرضى',
    description: 'OVR reports, repeated categories, department OVR indicators and corrective action follow-up.',
    datasets: ['ovr_reports', 'ovr_risk_indicators', 'evidence'],
    filters: { scope: 'quality', period_days: 90 },
    columns: null,
    is_active: true,
    created_at: '2026-07-01T10:00:00+03:00'
  }
];
