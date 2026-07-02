export type RiskLevel = 'critical' | 'high' | 'medium' | 'low';

export type AppRole =
  | 'super_admin'
  | 'executive'
  | 'governance_admin'
  | 'division_head'
  | 'department_manager'
  | 'project_owner'
  | 'milestone_owner'
  | 'task_owner'
  | 'auditor'
  | 'compliance_officer'
  | 'viewer'
  | 'employee';

export type AccessScope = 'global' | 'division' | 'department' | 'unit' | 'assigned_only';

export interface UserRoleAssignment {
  user_role_id: string;
  role: AppRole;
  scope: AccessScope;
  organization_id: string | null;
  division_id: string | null;
  department_id: string | null;
  unit_id: string | null;
  is_active: boolean;
  assigned_at: string | null;
}

export interface AccessControlUserRow {
  organization_id: string | null;
  user_id: string;
  employee_no: string | null;
  full_name_en: string;
  full_name_ar: string | null;
  email: string;
  job_title: string | null;
  user_active: boolean;
  division_name: string | null;
  department_name: string | null;
  unit_name: string | null;
  active_role_count: number;
  roles: UserRoleAssignment[];
  owned_open_projects: number;
  open_tasks: number;
  pending_approvals: number;
}

export interface AccessControlWarningRow {
  id: string;
  organization_id: string | null;
  user_id: string;
  full_name_en: string;
  email: string;
  warning_type: string;
  warning_message: string;
  severity: RiskLevel;
}

export interface AccessControlSummary {
  organization_id: string;
  active_users: number;
  inactive_users: number;
  active_role_assignments: number;
  global_role_assignments: number;
  access_warnings: number;
  active_users_without_roles: number;
}

export type PriorityLevel = 'critical' | 'high' | 'medium' | 'low';

export type ProjectStatus =
  | 'draft'
  | 'pending_approval'
  | 'active'
  | 'at_risk'
  | 'delayed'
  | 'completed_pending_evidence'
  | 'completed_pending_approval'
  | 'closed'
  | 'cancelled';

export type WorkStatus =
  | 'not_started'
  | 'in_progress'
  | 'at_risk'
  | 'delayed'
  | 'evidence_submitted'
  | 'approved'
  | 'rejected'
  | 'closed'
  | 'cancelled';

export type SourceType =
  | 'manual'
  | 'ceo_decision'
  | 'committee_decision'
  | 'risk'
  | 'audit_finding'
  | 'compliance_requirement'
  | 'policy_gap'
  | 'department_kpi'
  | 'incident_ovr'
  | 'strategic_goal';

export type EvidenceStatus = 'submitted' | 'accepted' | 'rejected' | 'needs_revision';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type EscalationLevel = 'reminder' | 'manager' | 'division' | 'executive';
export type EscalationStatus = 'open' | 'acknowledged' | 'resolved' | 'cancelled';

export interface ExecutiveSummary {
  activeProjects: number;
  overdueProjects: number;
  overdueMilestones: number;
  overdueTasks: number;
  criticalOpenRisks: number;
  complianceExpiring30Days: number;
  overdueAuditFindings: number;
  pendingApprovals: number;
  pendingEvidenceReviews: number;
}

export interface CriticalAttentionItem {
  id: string;
  itemType: string;
  title: string;
  department: string;
  owner: string;
  dueDate: string | null;
  status: string;
  riskLevel: RiskLevel;
  progress: number | null;
}


export interface EscalationRow {
  id: string;
  organization_id: string;
  item_type: string;
  item_id: string;
  title: string;
  escalation_level: EscalationLevel;
  reason: string;
  status: EscalationStatus;
  due_date: string | null;
  risk_level: RiskLevel;
  triggered_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  department_name: string | null;
  owner_name: string | null;
  acknowledged_by_name: string | null;
  resolved_by_name: string | null;
}

export interface DelayReasonQueueRow {
  organization_id: string;
  item_type: string;
  item_id: string;
  title: string;
  department_name: string | null;
  owner_name: string | null;
  due_date: string | null;
  risk_level: RiskLevel;
  status: string;
  missing_reason: string;
}

export interface ManagementControlSummary {
  organization_id: string;
  open_escalations: number;
  acknowledged_escalations: number;
  executive_escalations: number;
  critical_escalations: number;
  missing_delay_reasons: number;
}

export interface ProjectRow {
  id: string;
  organization_id?: string;
  title: string;
  description: string | null;
  category: string;
  source_type: SourceType;
  owner_id: string | null;
  sponsor_id: string | null;
  start_date: string | null;
  target_end_date: string | null;
  priority: PriorityLevel;
  risk_level: RiskLevel;
  status: ProjectStatus;
  progress_percent: number;
  evidence_required: boolean;
  closure_approval_required: boolean;
  delay_reason: string | null;
  departments?: { name_en: string | null; name_ar: string | null } | null;
  owner?: { full_name_en: string | null; full_name_ar: string | null } | null;
}

export interface MilestoneRow {
  id: string;
  organization_id: string;
  project_id: string;
  title: string;
  description: string | null;
  owner_id: string | null;
  start_date: string | null;
  due_date: string | null;
  status: WorkStatus;
  progress_percent: number;
  evidence_required: boolean;
  delay_reason: string | null;
  owner?: { full_name_en: string | null; full_name_ar: string | null } | null;
}

export interface TaskRow {
  id: string;
  organization_id: string;
  project_id: string;
  milestone_id: string | null;
  title: string;
  description: string | null;
  owner_id: string | null;
  assigned_to: string | null;
  start_date: string | null;
  due_date: string | null;
  status: WorkStatus;
  progress_percent: number;
  evidence_required: boolean;
  delay_reason: string | null;
  owner?: { full_name_en: string | null; full_name_ar: string | null } | null;
  assignee?: { full_name_en: string | null; full_name_ar: string | null } | null;
}

export interface RiskRow {
  id: string;
  organization_id?: string;
  risk_code: string | null;
  title: string;
  description: string | null;
  category: string;
  owner_id: string | null;
  likelihood: number;
  impact: number;
  inherent_score: number;
  residual_score: number;
  risk_level: RiskLevel;
  response_type: string;
  status: string;
  next_review_date: string | null;
  lifecycle_status?: RiskLifecycleStatus;
  risk_owner_id?: string | null;
  control_owner_id?: string | null;
  treatment_owner_id?: string | null;
  executive_sponsor_id?: string | null;
  inherent_likelihood?: number | null;
  inherent_impact?: number | null;
  residual_likelihood?: number | null;
  residual_impact?: number | null;
  scoring_method?: string | null;
  score_last_changed_at?: string | null;
  appetite_level?: string | null;
  appetite_threshold?: number | null;
  appetite_breached?: boolean | null;
  appetite_breach_reason?: string | null;
  treatment_required?: boolean | null;
  treatment_status?: string | null;
  treatment_plan_summary?: string | null;
  treatment_due_date?: string | null;
  treatment_completed_at?: string | null;
  acceptance_required?: boolean | null;
  acceptance_status?: string | null;
  acceptance_requested_at?: string | null;
  accepted_at?: string | null;
  acceptance_expiry_date?: string | null;
  acceptance_reason?: string | null;
  review_frequency?: string | null;
  last_reviewed_at?: string | null;
  review_overdue?: boolean | null;
  closure_requested_at?: string | null;
  closure_approved_at?: string | null;
  closure_reason?: string | null;
  closure_evidence_required?: boolean | null;
  closure_blocker?: string | null;
  escalation_required?: boolean | null;
  escalation_level?: string | null;
  escalated_at?: string | null;
  executive_visible?: boolean | null;
  duplicate_of_risk_id?: string | null;
  related_risk_ids?: string[] | null;
  repeat_signal_flag?: boolean | null;
  source_ovr_id?: string | null;
  source_audit_finding_id?: string | null;
  source_compliance_id?: string | null;
  source_project_id?: string | null;
  departments?: { name_en: string | null; name_ar: string | null } | null;
  owner?: { full_name_en: string | null; full_name_ar: string | null } | null;
  risk_owner?: { full_name_en: string | null; full_name_ar: string | null } | null;
  control_owner?: { full_name_en: string | null; full_name_ar: string | null } | null;
  treatment_owner?: { full_name_en: string | null; full_name_ar: string | null } | null;
  executive_sponsor?: { full_name_en: string | null; full_name_ar: string | null } | null;
}

export type RiskLifecycleStatus =
  | 'identified'
  | 'assessed'
  | 'treatment_required'
  | 'treatment_in_progress'
  | 'acceptance_requested'
  | 'accepted'
  | 'monitoring'
  | 'closure_requested'
  | 'closed'
  | 'reopened'
  | 'cancelled';

export interface RiskWorkflowQueueRow {
  organization_id: string;
  risk_id: string;
  risk_code: string | null;
  title: string;
  risk_level: RiskLevel;
  status: string;
  lifecycle_status: RiskLifecycleStatus;
  residual_score: number;
  appetite_breached: boolean;
  treatment_required: boolean;
  treatment_status: string;
  treatment_due_date: string | null;
  acceptance_required: boolean;
  acceptance_status: string;
  next_review_date: string | null;
  review_overdue: boolean;
  closure_requested_at: string | null;
  escalation_required: boolean;
  escalation_level: string;
  executive_visible: boolean;
  department_name: string | null;
  risk_owner_name: string | null;
  treatment_owner_name: string | null;
  queue_reason: string;
  due_date: string | null;
  is_overdue: boolean;
}

export interface RiskAppetiteBreachRow {
  organization_id: string;
  risk_id: string;
  risk_code: string | null;
  title: string;
  risk_level: RiskLevel;
  residual_score: number;
  appetite_level: string;
  appetite_threshold: number;
  appetite_breached: boolean;
  appetite_breach_reason: string | null;
  acceptance_status: string;
  acceptance_expiry_date: string | null;
  department_name: string | null;
  risk_owner_name: string | null;
}

export interface RiskTreatmentQueueRow {
  organization_id: string;
  risk_id: string;
  risk_code: string | null;
  title: string;
  risk_level: RiskLevel;
  residual_score: number;
  treatment_required: boolean;
  treatment_status: string;
  treatment_plan_summary: string | null;
  treatment_due_date: string | null;
  treatment_owner_id: string | null;
  treatment_owner_name: string | null;
  treatment_overdue: boolean;
}

export interface RiskKriAlertRow {
  organization_id: string;
  kri_id: string;
  risk_id: string;
  risk_code: string | null;
  risk_title: string;
  kri_code: string | null;
  name_en: string;
  name_ar: string | null;
  current_value: number | null;
  threshold_warning: number | null;
  threshold_critical: number | null;
  direction: string;
  status: 'normal' | 'warning' | 'critical' | string;
  measured_at: string;
  owner_id: string | null;
  owner_name: string | null;
  risk_level: RiskLevel;
  residual_score: number;
}

export interface ExecutiveRiskEscalationRow {
  organization_id: string;
  risk_id: string;
  risk_code: string | null;
  title: string;
  risk_level: RiskLevel;
  residual_score: number;
  escalation_required: boolean;
  escalation_level: string;
  escalated_at: string | null;
  executive_visible: boolean;
  appetite_breached: boolean;
  treatment_status: string;
  acceptance_status: string;
  next_review_date: string | null;
  department_name: string | null;
  executive_owner_name: string | null;
}

export interface RiskClosureBlockerRow {
  organization_id: string;
  risk_id: string;
  risk_code: string | null;
  title: string;
  risk_level: RiskLevel;
  status: string;
  closure_requested_at: string | null;
  closure_reason: string | null;
  closure_evidence_required: boolean;
  blocker_reason: string | null;
}

export interface RiskReassessmentHistoryRow {
  id: string;
  organization_id: string;
  risk_id: string;
  previous_likelihood: number | null;
  previous_impact: number | null;
  previous_score: number | null;
  new_likelihood: number | null;
  new_impact: number | null;
  new_score: number | null;
  previous_residual_likelihood: number | null;
  previous_residual_impact: number | null;
  previous_residual_score: number | null;
  new_residual_likelihood: number | null;
  new_residual_impact: number | null;
  new_residual_score: number | null;
  change_reason: string | null;
  changed_by: string | null;
  changed_at: string;
}

export interface RiskWorkflowEventRow {
  id: string;
  organization_id: string;
  risk_id: string;
  from_status: string | null;
  to_status: string | null;
  action: string;
  note: string | null;
  actor_id: string | null;
  created_at: string;
}

export interface ComplianceRow {
  id: string;
  organization_id?: string;
  compliance_code: string | null;
  title: string;
  description?: string | null;
  regulatory_body: string | null;
  owner_id: string | null;
  due_date: string | null;
  expiry_date: string | null;
  risk_level: RiskLevel;
  status: string;
  departments?: { name_en: string | null; name_ar: string | null } | null;
  owner?: { full_name_en: string | null; full_name_ar: string | null } | null;
}

export interface AuditFindingRow {
  id: string;
  organization_id?: string;
  finding_code: string | null;
  audit_title: string | null;
  title: string;
  description: string;
  risk_level: RiskLevel;
  due_date: string | null;
  status: string;
  finding_status?: AuditFindingWorkflowStatus | null;
  workflow_stage?: AuditFindingWorkflowStage | null;
  severity_level?: AuditFindingSeverityLevel | null;
  finding_owner_id?: string | null;
  audit_manager_id?: string | null;
  responsible_department_id?: string | null;
  responsible_owner_id?: string | null;
  corrective_action_owner_id?: string | null;
  executive_sponsor_id?: string | null;
  original_due_date?: string | null;
  revised_due_date?: string | null;
  closed_at?: string | null;
  closed_by?: string | null;
  reopened_at?: string | null;
  reopened_by?: string | null;
  reopen_reason?: string | null;
  management_response_required?: boolean | null;
  management_response?: string | null;
  management_response_due_date?: string | null;
  management_response_submitted_by?: string | null;
  management_response_submitted_at?: string | null;
  management_response_status?: AuditFindingManagementResponseStatus | null;
  management_response_rejection_reason?: string | null;
  corrective_action_required?: boolean | null;
  corrective_action_plan?: string | null;
  corrective_action_due_date?: string | null;
  corrective_action_status?: AuditFindingCorrectiveActionStatus | null;
  corrective_action_completed_at?: string | null;
  corrective_action_completed_by?: string | null;
  corrective_action_rejection_reason?: string | null;
  root_cause?: string | null;
  root_cause_category?: string | null;
  root_cause_summary?: string | null;
  repeat_finding_flag?: boolean | null;
  repeat_of_finding_id?: string | null;
  recurrence_count?: number | null;
  recurrence_window_days?: number | null;
  systemic_issue_flag?: boolean | null;
  related_risk_id?: string | null;
  related_compliance_id?: string | null;
  related_project_id?: string | null;
  source_ovr_id?: string | null;
  evidence_required?: boolean | null;
  minimum_accepted_evidence_count?: number | null;
  evidence_gate_status?: string | null;
  closure_requested_at?: string | null;
  closure_requested_by?: string | null;
  closure_validation_status?: AuditFindingClosureValidationStatus | null;
  closure_validation_note?: string | null;
  closure_validated_by?: string | null;
  closure_validated_at?: string | null;
  closure_blocker?: string | null;
  closure_pack_generated_at?: string | null;
  closure_pack_reference?: string | null;
  escalation_required?: boolean | null;
  escalation_level?: string | null;
  escalated_at?: string | null;
  escalated_to?: string | null;
  escalation_reason?: string | null;
  executive_visible?: boolean | null;
  committee_review_required?: boolean | null;
  committee_review_status?: string | null;
  committee_review_note?: string | null;
  departments?: { name_en: string | null; name_ar: string | null } | null;
  owner?: { full_name_en: string | null; full_name_ar: string | null } | null;
}

export type AuditFindingWorkflowStatus =
  | 'draft'
  | 'issued'
  | 'management_response_required'
  | 'management_response_submitted'
  | 'action_plan_required'
  | 'action_plan_in_progress'
  | 'evidence_required'
  | 'closure_requested'
  | 'auditor_validation'
  | 'returned_for_correction'
  | 'escalated'
  | 'closed'
  | 'rejected'
  | 'cancelled'
  | 'reopened';

export type AuditFindingWorkflowStage =
  | 'draft'
  | 'management_response'
  | 'management_response_review'
  | 'action_plan'
  | 'action_plan_review'
  | 'evidence'
  | 'closure_request'
  | 'auditor_validation'
  | 'correction'
  | 'escalation'
  | 'closed'
  | 'cancelled'
  | 'reopened';

export type AuditFindingSeverityLevel = 'low' | 'medium' | 'high' | 'critical';
export type AuditFindingManagementResponseStatus = 'not_required' | 'required' | 'submitted' | 'accepted' | 'rejected' | 'overdue' | 'waived';
export type AuditFindingCorrectiveActionStatus = 'not_required' | 'required' | 'submitted' | 'accepted' | 'in_progress' | 'completed' | 'rejected' | 'overdue';
export type AuditFindingClosureValidationStatus = 'not_requested' | 'requested' | 'in_validation' | 'accepted' | 'rejected' | 'blocked';

export interface AuditFindingWorkflowQueueRow {
  organization_id: string;
  audit_finding_id: string;
  finding_code: string | null;
  audit_title: string | null;
  title: string;
  finding_status: AuditFindingWorkflowStatus;
  workflow_stage: AuditFindingWorkflowStage;
  severity_level: AuditFindingSeverityLevel;
  management_response_status: AuditFindingManagementResponseStatus;
  corrective_action_status: AuditFindingCorrectiveActionStatus;
  evidence_gate_status: string;
  closure_validation_status: AuditFindingClosureValidationStatus;
  due_date: string | null;
  management_response_due_date: string | null;
  corrective_action_due_date: string | null;
  responsible_department_id: string | null;
  department_name: string | null;
  responsible_owner_name: string | null;
  corrective_action_owner_name: string | null;
  audit_manager_name: string | null;
  accepted_evidence_count: number;
  minimum_accepted_evidence_count: number;
  can_close: boolean;
  closure_blocker: string | null;
  queue_reason: string;
  is_overdue: boolean;
}

export interface OverdueAuditFindingRow {
  organization_id: string;
  audit_finding_id: string;
  finding_code: string | null;
  title: string;
  finding_status: AuditFindingWorkflowStatus;
  severity_level: AuditFindingSeverityLevel;
  due_date: string | null;
  management_response_due_date: string | null;
  corrective_action_due_date: string | null;
  closure_requested_at: string | null;
  department_name: string | null;
  responsible_owner_name: string | null;
  overdue_reason: string;
  days_overdue: number;
}

export interface RepeatAuditFindingRow {
  organization_id: string;
  audit_finding_id: string;
  finding_code: string | null;
  title: string;
  severity_level: AuditFindingSeverityLevel;
  root_cause_category: string | null;
  root_cause_summary: string | null;
  repeat_finding_flag: boolean;
  repeat_of_finding_id: string | null;
  repeat_of_finding_code: string | null;
  recurrence_count: number;
  recurrence_window_days: number;
  systemic_issue_flag: boolean;
  responsible_department_id: string | null;
  department_name: string | null;
  detected_repeat_count: number;
}

export interface AuditClosureGateStatusRow {
  organization_id: string;
  audit_finding_id: string;
  finding_code: string | null;
  title: string;
  finding_status: AuditFindingWorkflowStatus;
  workflow_stage: AuditFindingWorkflowStage;
  severity_level: AuditFindingSeverityLevel;
  evidence_required: boolean;
  minimum_accepted_evidence_count: number;
  accepted_evidence_count: number;
  approved_waiver_count: number;
  waiver_approved_at: string | null;
  evidence_gate_status: string;
  can_close: boolean;
  closure_blocker: string | null;
  closure_requested_at: string | null;
  closure_validation_status: AuditFindingClosureValidationStatus;
}

export interface AuditExecutiveEscalationRow {
  organization_id: string;
  audit_finding_id: string;
  finding_code: string | null;
  title: string;
  finding_status: AuditFindingWorkflowStatus;
  severity_level: AuditFindingSeverityLevel;
  escalation_required: boolean;
  escalation_level: string | null;
  escalated_at: string | null;
  escalated_to: string | null;
  escalated_to_name: string | null;
  escalation_reason: string | null;
  executive_visible: boolean;
  committee_review_required: boolean;
  committee_review_status: string;
  committee_review_note: string | null;
  repeat_finding_flag: boolean;
  systemic_issue_flag: boolean;
  due_date: string | null;
  department_name: string | null;
  escalation_reason_code: string;
}

export interface AuditClosurePackIndexRow {
  organization_id: string;
  audit_finding_id: string;
  finding_code: string | null;
  title: string;
  audit_title: string | null;
  finding_status: AuditFindingWorkflowStatus;
  severity_level: AuditFindingSeverityLevel;
  management_response_status: AuditFindingManagementResponseStatus;
  corrective_action_status: AuditFindingCorrectiveActionStatus;
  closure_validation_status: AuditFindingClosureValidationStatus;
  closure_pack_reference: string | null;
  closure_pack_generated_at: string | null;
  evidence_required: boolean;
  accepted_evidence_count: number;
  minimum_accepted_evidence_count: number;
  approved_waiver_count: number;
  evidence_gate_status: string;
  can_close: boolean;
  closure_blocker: string | null;
  closure_validated_by: string | null;
  closure_validator_name: string | null;
  closure_validated_at: string | null;
  linked_evidence_count: number;
}

export interface AuditFindingValidationEventRow {
  id: string;
  organization_id: string;
  audit_finding_id: string;
  validation_type: string;
  from_status: string | null;
  to_status: string | null;
  actor_id: string | null;
  note: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AuditFindingDueDateExtensionRow {
  id: string;
  organization_id: string;
  audit_finding_id: string;
  previous_due_date: string | null;
  requested_due_date: string;
  extension_reason: string;
  requested_by: string | null;
  requested_at: string;
  approved_by: string | null;
  approved_at: string | null;
  status: 'requested' | 'approved' | 'rejected' | 'cancelled';
  rejection_reason: string | null;
  created_at: string;
}

export interface GovernanceDecisionRow {
  id: string;
  organization_id?: string;
  decision_code: string | null;
  title: string;
  decision_text: string;
  due_date: string | null;
  priority: PriorityLevel;
  risk_level: RiskLevel;
  status: string;
  departments?: { name_en: string | null; name_ar: string | null } | null;
  owner?: { full_name_en: string | null; full_name_ar: string | null } | null;
}

export interface MyWorkRow {
  id: string;
  organization_id: string;
  item_type: 'task' | 'milestone';
  title: string;
  due_date: string | null;
  status: WorkStatus;
  progress_percent: number;
  project_id: string | null;
  milestone_id: string | null;
  project_title?: string | null;
  department_name?: string | null;
}

export interface ApprovalRow {
  id: string;
  organization_id: string;
  item_type: string;
  item_title: string;
  requested_by_name: string | null;
  approver_name: string | null;
  status: ApprovalStatus;
  request_note: string | null;
  decision_note: string | null;
  requested_at: string;
  decided_at: string | null;
}

export interface EvidenceRow {
  id: string;
  organization_id: string;
  item_type: string;
  item_title: string;
  file_name: string;
  file_path: string;
  description: string | null;
  status: EvidenceStatus;
  evidence_code?: string | null;
  evidence_title?: string | null;
  evidence_description?: string | null;
  evidence_type?: string | null;
  sensitivity_level?: EvidenceSensitivityLevel | null;
  classification_reason?: string | null;
  evidence_source?: string | null;
  evidence_owner_id?: string | null;
  reviewer_id?: string | null;
  review_status?: EvidenceReviewStatus | null;
  review_required?: boolean | null;
  review_due_date?: string | null;
  review_note?: string | null;
  revision_required?: boolean | null;
  revision_due_date?: string | null;
  superseded_by_evidence_id?: string | null;
  version_number?: number | null;
  is_current_version?: boolean | null;
  locked_at?: string | null;
  locked_by?: string | null;
  expiry_date?: string | null;
  renewal_required?: boolean | null;
  renewal_due_date?: string | null;
  chain_of_custody_hash?: string | null;
  uploaded_by_name: string | null;
  reviewed_by_name: string | null;
  created_at: string;
}

export type EvidenceReviewStatus =
  | 'submitted'
  | 'pending_review'
  | 'accepted'
  | 'rejected'
  | 'needs_revision'
  | 'superseded'
  | 'locked'
  | 'expired'
  | 'renewed'
  | 'waived';

export type EvidenceSensitivityLevel =
  | 'public'
  | 'internal'
  | 'confidential'
  | 'highly_sensitive'
  | 'restricted';

export type EvidenceLinkedItemType =
  | 'risk'
  | 'ovr'
  | 'audit_finding'
  | 'compliance'
  | 'project'
  | 'milestone'
  | 'task'
  | 'approval'
  | 'capa'
  | 'control'
  | 'policy'
  | 'department';

export type EvidenceRequirementGate =
  | 'closure'
  | 'approval'
  | 'acceptance'
  | 'treatment'
  | 'review'
  | 'audit'
  | 'regulatory'
  | 'board_pack';

export interface EvidenceFileGovernanceRow extends EvidenceRow {
  evidence_file_id?: string;
  owner_name?: string | null;
  reviewer_name?: string | null;
  queue_reason?: string | null;
}

export interface EvidenceLinkRow {
  id: string;
  organization_id: string;
  evidence_file_id: string;
  linked_item_type: EvidenceLinkedItemType;
  linked_item_id: string;
  linked_item_title: string | null;
  link_reason: string | null;
  is_primary: boolean;
  required_for_closure: boolean;
  required_for_acceptance: boolean;
  required_for_approval: boolean;
  required_for_treatment: boolean;
  linked_by: string | null;
  linked_at: string;
  is_active: boolean;
}

export interface EvidenceRequirementRow {
  id: string;
  organization_id: string;
  requirement_code: string | null;
  linked_item_type: EvidenceLinkedItemType;
  linked_item_id: string;
  requirement_title: string;
  requirement_description: string | null;
  evidence_type_required: string | null;
  minimum_accepted_files: number;
  sensitivity_required: EvidenceSensitivityLevel | null;
  due_date: string | null;
  required_for_gate: EvidenceRequirementGate;
  gate_status: 'pending' | 'partially_satisfied' | 'satisfied' | 'overdue' | 'waived';
  owner_id: string | null;
  reviewer_role: string | null;
  reviewer_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export interface EvidenceReviewEventRow {
  id?: string;
  event_id?: string;
  organization_id: string;
  evidence_file_id: string | null;
  evidence_code?: string | null;
  evidence_title?: string | null;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  actor_id: string | null;
  actor_name?: string | null;
  note: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

export interface EvidenceGateWaiverRow {
  id: string;
  organization_id: string;
  requirement_id: string;
  linked_item_type: EvidenceLinkedItemType;
  linked_item_id: string;
  waiver_reason: string;
  requested_by: string | null;
  requested_at: string;
  approved_by: string | null;
  approved_at: string | null;
  status: 'requested' | 'approved' | 'rejected' | 'expired';
  expiry_date: string | null;
  audit_note: string | null;
}

export interface EvidenceReviewQueueRow {
  organization_id: string;
  evidence_file_id: string;
  evidence_code: string;
  evidence_title: string;
  file_name: string;
  evidence_type: string;
  sensitivity_level: EvidenceSensitivityLevel;
  review_status: EvidenceReviewStatus;
  legacy_status: EvidenceStatus;
  review_required: boolean;
  review_due_date: string | null;
  revision_required: boolean;
  revision_due_date: string | null;
  expiry_date: string | null;
  renewal_required: boolean;
  is_current_version: boolean;
  locked_at: string | null;
  uploaded_by: string | null;
  uploaded_by_name: string | null;
  evidence_owner_id: string | null;
  owner_name: string | null;
  reviewer_id: string | null;
  reviewer_name: string | null;
  created_at: string;
  queue_reason: string;
}

export interface EvidenceClosureGateStatusRow {
  organization_id: string;
  requirement_id: string;
  requirement_code: string | null;
  linked_item_type: EvidenceLinkedItemType;
  linked_item_id: string;
  requirement_title: string;
  required_for_gate: EvidenceRequirementGate;
  minimum_accepted_files: number;
  accepted_evidence_count: number;
  waiver_active: boolean;
  waiver_approved_at: string | null;
  due_date: string | null;
  gate_status: 'pending' | 'partially_satisfied' | 'satisfied' | 'overdue' | 'waived';
  can_close: boolean;
}

export interface EvidenceGapDashboardRow extends EvidenceClosureGateStatusRow {
  gap_reason: string;
}

export interface EvidenceChainOfCustodyRow extends EvidenceReviewEventRow {
  event_id: string;
  evidence_code: string | null;
  evidence_title: string | null;
}

export interface EvidencePackIndexRow {
  organization_id: string;
  linked_item_type: EvidenceLinkedItemType;
  linked_item_id: string;
  linked_item_title: string | null;
  evidence_file_id: string;
  evidence_code: string;
  evidence_title: string;
  file_name: string;
  evidence_type: string;
  sensitivity_level: EvidenceSensitivityLevel;
  review_status: EvidenceReviewStatus;
  reviewer_id: string | null;
  reviewer_name: string | null;
  reviewed_at: string | null;
  is_primary: boolean;
  required_for_closure: boolean;
  required_for_acceptance: boolean;
  required_for_approval: boolean;
  required_for_treatment: boolean;
  linked_at: string;
}

export interface SensitiveEvidenceRegisterRow {
  organization_id: string;
  evidence_file_id: string;
  evidence_code: string;
  evidence_title: string;
  file_name: string;
  sensitivity_level: EvidenceSensitivityLevel;
  classification_reason: string | null;
  review_status: EvidenceReviewStatus;
  evidence_owner_id: string | null;
  owner_name: string | null;
  reviewer_id: string | null;
  reviewer_name: string | null;
  expiry_date: string | null;
  renewal_required: boolean;
  renewal_due_date: string | null;
  locked_at: string | null;
  locked_by: string | null;
  locked_by_name: string | null;
  created_at: string;
}

export interface OrganizationOption {
  id: string;
  name_en: string;
  name_ar: string | null;
}

export interface DepartmentOption {
  id: string;
  name_en: string;
  name_ar: string | null;
}

export interface ProfileOption {
  id: string;
  full_name_en: string;
  full_name_ar: string | null;
  email: string;
  department_id?: string | null;
}


export interface DepartmentExecutionSummary {
  organization_id: string;
  department_id: string;
  department_name: string;
  active_projects: number;
  overdue_projects: number;
  overdue_milestones: number;
  overdue_tasks: number;
  critical_risks: number;
  overdue_audit_findings: number;
  compliance_expiring_30_days: number;
}

export type OvrStatus =
  | 'draft'
  | 'submitted'
  | 'manager_review'
  | 'quality_validation'
  | 'referred_party_response'
  | 'quality_final_review'
  | 'disputed'
  | 'reopened'
  | 'escalated'
  | 'under_supervisor_review'
  | 'under_quality_review'
  | 'returned_for_clarification'
  | 'action_plan_required'
  | 'corrective_action_in_progress'
  | 'evidence_submitted'
  | 'quality_closure_review'
  | 'closed'
  | 'rejected'
  | 'cancelled'
  | 'major_escalation'
  | 'rca_required';

export type OvrSeverityLevel = 'level_1' | 'level_2' | 'level_3' | 'level_4' | 'sentinel';
export type OvrInvolvedPersonType = 'patient' | 'visitor' | 'employee' | 'company_representative' | 'other';

export interface OvrSummary {
  organization_id: string;
  total_reports: number;
  open_reports: number;
  under_quality_review: number;
  corrective_actions_required: number;
  sentinel_events: number;
  near_miss_level_1: number;
}

export interface OvrReportRow {
  id: string;
  organization_id: string;
  ovr_number: string | null;
  logging_number: string | null;
  occurrence_date: string | null;
  occurrence_time: string | null;
  occurrence_location: string | null;
  involved_person_type: OvrInvolvedPersonType;
  person_involved_name: string | null;
  mrn_or_id_no: string | null;
  department_id: string | null;
  brief_description: string;
  occurrence_category: string;
  severity_level: OvrSeverityLevel | null;
  injury_type: string | null;
  supervisor_investigation?: string | null;
  corrective_action?: string | null;
  quality_manager_comments?: string | null;
  referred_to_person?: string | null;
  referred_to_department?: string | null;
  referred_department_id?: string | null;
  referred_user_id?: string | null;
  referred_response?: string | null;
  reported_by?: string | null;
  supervisor_id?: string | null;
  quality_reviewer_id?: string | null;
  quality_validated_at?: string | null;
  cross_department_notified_at?: string | null;
  final_verdict?: string | null;
  final_verdict_at?: string | null;
  reporter_response?: string | null;
  dispute_reason?: string | null;
  evidence_required?: boolean;
  status: OvrStatus;
  corrective_action_required: boolean;
  linked_project_id: string | null;
  created_at: string;
  departments?: { name_en: string | null; name_ar: string | null } | null;
  reporter?: { full_name_en: string | null; full_name_ar: string | null } | null;
  owner?: { full_name_en: string | null; full_name_ar: string | null } | null;
}

export interface OvrWorkflowQueueRow {
  id: string;
  organization_id: string;
  ovr_number: string | null;
  title: string;
  department_name: string | null;
  owner_name: string | null;
  occurrence_date: string | null;
  status: OvrStatus;
  severity_level: OvrSeverityLevel | null;
  workflow_stage: string;
  due_date: string | null;
  is_overdue: boolean;
  risk_level: RiskLevel;
}

export interface OvrWorkflowControlSummary {
  organization_id: string;
  pending_supervisor_review: number;
  pending_quality_review: number;
  returned_for_clarification: number;
  pending_evidence_review: number;
  major_open_ovrs: number;
  overdue_ovr_workflow_items: number;
}

export interface OvrRiskIndicatorSummary {
  organization_id: string;
  total_ovrs_30d: number;
  total_ovrs_90d: number;
  open_ovrs: number;
  weighted_score_30d: number;
  major_or_sentinel_ovrs_90d: number;
  repeated_category_alerts_30d: number;
  overdue_corrective_actions: number;
  avg_closure_days: number | null;
  overall_signal_level: RiskLevel;
}

export interface OvrRiskDepartmentIndicator {
  organization_id: string;
  department_id: string | null;
  department_name: string;
  ovr_count_30d: number;
  ovr_count_90d: number;
  weighted_score_30d: number;
  major_or_sentinel_ovrs_90d: number;
  repeated_category_alerts_30d: number;
  repeated_categories: string | null;
  overdue_corrective_actions: number;
  avg_closure_days: number | null;
  risk_signal_level: RiskLevel;
}

export interface OvrRepeatedCategoryAlert {
  organization_id: string;
  department_id: string | null;
  department_name: string;
  occurrence_category: string;
  category_count_30d: number;
  max_severity_weight: number;
  max_severity_level: string;
  alert_level: RiskLevel;
}
export interface GrcKpiScorecard {
  organization_id: string;
  execution_health_score: number;
  risk_exposure_score: number;
  compliance_pressure_score: number;
  ovr_safety_signal_score: number;
  evidence_discipline_score: number;
  approval_bottleneck_score: number;
}

export interface DepartmentRiskHeatmapRow {
  organization_id: string;
  department_id: string | null;
  department_name: string;
  active_projects: number;
  overdue_projects: number;
  overdue_milestones: number;
  overdue_tasks: number;
  critical_risks: number;
  compliance_expiring_30_days: number;
  overdue_audit_findings: number;
  ovr_weighted_score_30d: number;
  execution_pressure_score: number;
  risk_pressure_score: number;
  compliance_pressure_score: number;
  ovr_pressure_score: number;
  overall_pressure_score: number;
  signal_level: RiskLevel;
}

export interface MonthlyGrcTrendRow {
  organization_id: string;
  month_start: string;
  month_label: string;
  new_projects: number;
  closed_projects: number;
  new_risks: number;
  new_audit_findings: number;
  ovr_reports: number;
  major_ovrs: number;
}

export interface RadarControlProfileRow {
  organization_id: string;
  dimension_key: string;
  dimension_label_en: string;
  dimension_label_ar: string;
  score: number;
}


export type ExportDatasetKey =
  | 'projects'
  | 'milestones'
  | 'tasks'
  | 'risks'
  | 'compliance'
  | 'audit_findings'
  | 'ovr_reports'
  | 'approvals'
  | 'evidence'
  | 'escalations'
  | 'departments'
  | 'users'
  | 'kpi_scorecard'
  | 'department_heatmap'
  | 'ovr_risk_indicators';

export type ExportFormat = 'csv' | 'json' | 'backup_json' | 'report_json';

export interface ExportDatasetDefinition {
  key: ExportDatasetKey;
  label_en: string;
  label_ar: string;
  description_en: string;
  description_ar: string;
  sensitivity: RiskLevel;
  recommended_frequency: 'daily' | 'weekly' | 'monthly' | 'ad_hoc';
}

export interface ExportDatasetPayload {
  datasetKey: ExportDatasetKey;
  label: string;
  generatedAt: string;
  rowCount: number;
  rows: Record<string, unknown>[];
}

export interface ExportCenterSummary {
  organization_id: string;
  custom_reports: number;
  exports_30d: number;
  backups_30d: number;
  available_datasets: number;
  last_export_at: string | null;
  last_backup_at: string | null;
}

export interface CustomReportDefinition {
  id: string;
  organization_id: string;
  report_key: string;
  name_en: string;
  name_ar: string | null;
  description: string | null;
  datasets: ExportDatasetKey[];
  filters: Record<string, unknown> | null;
  columns: Record<string, unknown> | null;
  is_active: boolean;
  created_at: string;
}

export interface DataExportJobRow {
  id: string;
  organization_id: string;
  export_type: string;
  dataset_key: string | null;
  export_format: ExportFormat;
  file_name: string | null;
  row_count: number;
  status: string;
  generated_by_name: string | null;
  created_at: string;
}
