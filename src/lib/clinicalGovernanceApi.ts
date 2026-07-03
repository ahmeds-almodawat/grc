import { supabase } from './supabase';
import { invokePrivilegedAction, throwRpcActionError } from './privilegedAction';
import {
  configurationErrorResult,
  emptyResult,
  liveResult,
  queryErrorResult,
  type LiveResult,
} from './liveResult';

type ClinicalGovernancePayload = Record<string, unknown>;
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type ClinicalGovernanceStatus =
  | 'planned'
  | 'active'
  | 'fieldwork'
  | 'reporting'
  | 'closed'
  | 'cancelled'
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'not_applicable'
  | 'waived'
  | 'pending'
  | 'passed'
  | 'exception'
  | 'open'
  | 'under_review'
  | 'capa_required'
  | 'evidence_required'
  | 'accepted'
  | 'signed_off'
  | 'rejected'
  | 'reopened'
  | 'awaiting_review'
  | 'action_required'
  | 'acknowledged'
  | 'resolved'
  | string;

export type ClinicalGovernanceSeverity = 'low' | 'medium' | 'high' | 'critical' | 'sentinel' | string;

export interface ClinicalGovernanceActionResult {
  id?: string;
  status?: string;
  result?: JsonValue;
  [key: string]: unknown;
}

export interface AuditEngagementRegisterRow {
  id?: string;
  engagement_title?: string | null;
  engagement_type?: string | null;
  scope_summary?: string | null;
  department_name?: string | null;
  lead_auditor_name?: string | null;
  status?: ClinicalGovernanceStatus | null;
  starts_on?: string | null;
  ends_on?: string | null;
  program_count?: number | null;
  test_step_count?: number | null;
  completed_step_count?: number | null;
  open_finding_count?: number | null;
  pending_signoff_count?: number | null;
  [key: string]: unknown;
}

export interface AuditTestStepQueueRow {
  id?: string;
  engagement_id?: string;
  engagement_title?: string | null;
  program_title?: string | null;
  step_code?: string | null;
  step_title?: string | null;
  test_type?: string | null;
  expected_evidence?: string | null;
  status?: ClinicalGovernanceStatus | null;
  assigned_to_name?: string | null;
  due_date?: string | null;
  clause_code?: string | null;
  clause_title?: string | null;
  is_overdue?: boolean | null;
  [key: string]: unknown;
}

export interface AuditFindingRegisterRow {
  id?: string;
  engagement_title?: string | null;
  step_code?: string | null;
  step_title?: string | null;
  finding_title?: string | null;
  finding_description?: string | null;
  severity?: ClinicalGovernanceSeverity | null;
  finding_status?: ClinicalGovernanceStatus | null;
  linked_capa_id?: string | null;
  linked_evidence_bridge_link_id?: string | null;
  clause_code?: string | null;
  clause_title?: string | null;
  owner_name?: string | null;
  department_name?: string | null;
  due_date?: string | null;
  is_overdue?: boolean | null;
  [key: string]: unknown;
}

export interface AuditSignoffQueueRow {
  id?: string;
  engagement_title?: string | null;
  engagement_status?: string | null;
  signoff_type?: string | null;
  signoff_status?: ClinicalGovernanceStatus | null;
  signed_by_name?: string | null;
  signed_at?: string | null;
  signoff_notes?: string | null;
  [key: string]: unknown;
}

export interface OvrRcaCaseRegisterRow {
  id?: string;
  ovr_id?: string | null;
  incident_reference?: string | null;
  rca_title?: string | null;
  rca_status?: ClinicalGovernanceStatus | null;
  severity?: ClinicalGovernanceSeverity | null;
  department_name?: string | null;
  owner_name?: string | null;
  due_date?: string | null;
  root_cause_summary?: string | null;
  active_link_count?: number | null;
  capa_link_count?: number | null;
  evidence_bridge_link_count?: number | null;
  accreditation_clause_link_count?: number | null;
  is_overdue?: boolean | null;
  [key: string]: unknown;
}

export interface OvrCapaEvidenceBridgeRow {
  id?: string;
  incident_reference?: string | null;
  rca_title?: string | null;
  rca_status?: ClinicalGovernanceStatus | null;
  severity?: ClinicalGovernanceSeverity | null;
  linked_entity_type?: string | null;
  linked_entity_id?: string | null;
  link_role?: string | null;
  link_status?: ClinicalGovernanceStatus | null;
  evidence_status?: string | null;
  freshness_status?: string | null;
  clause_code?: string | null;
  clause_title?: string | null;
  [key: string]: unknown;
}

export interface ClinicalGovernanceEscalationRow {
  id?: string;
  incident_reference?: string | null;
  rca_title?: string | null;
  finding_title?: string | null;
  escalation_level?: ClinicalGovernanceSeverity | null;
  escalation_reason?: string | null;
  escalation_status?: ClinicalGovernanceStatus | null;
  escalated_to_name?: string | null;
  escalated_to_department_name?: string | null;
  escalated_at?: string | null;
  acknowledged_at?: string | null;
  resolved_at?: string | null;
  resolution_notes?: string | null;
  [key: string]: unknown;
}

export interface OverdueGovernanceItemRow {
  item_type?: string;
  item_id?: string;
  item_title?: string | null;
  item_status?: ClinicalGovernanceStatus | null;
  due_date?: string | null;
  owner_user_id?: string | null;
  department_id?: string | null;
  [key: string]: unknown;
}

export interface DepartmentClinicalGovernanceWorkloadRow {
  department_id?: string;
  department_name?: string | null;
  active_audit_engagement_count?: number | null;
  open_audit_finding_count?: number | null;
  open_rca_case_count?: number | null;
  open_escalation_count?: number | null;
  overdue_item_count?: number | null;
  [key: string]: unknown;
}

export interface ExecutiveClinicalGovernanceSummaryRow {
  active_audit_engagement_count?: number | null;
  open_audit_test_step_count?: number | null;
  open_audit_finding_count?: number | null;
  audit_finding_action_required_count?: number | null;
  open_rca_case_count?: number | null;
  severe_rca_case_count?: number | null;
  open_escalation_count?: number | null;
  overdue_governance_item_count?: number | null;
  executive_signal?: string | null;
  [key: string]: unknown;
}

async function selectPatch37View<T>(
  viewName: string,
  options: { order?: string; ascending?: boolean; limit?: number } = {},
): Promise<LiveResult<T[]>> {
  if (!supabase) {
    return configurationErrorResult<T[]>(
      'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to load live clinical governance data.',
    );
  }

  try {
    let query = supabase.from(viewName).select('*');
    if (options.order) query = query.order(options.order, { ascending: options.ascending ?? true });
    if (options.limit) query = query.limit(options.limit);

    const { data, error } = await query;
    if (error) return queryErrorResult<T[]>(error, `Unable to load ${viewName}.`);
    if (!data || data.length === 0) return emptyResult<T[]>(`No records returned from ${viewName}.`);
    return liveResult(data as T[], 'supabase');
  } catch (error) {
    return queryErrorResult<T[]>(error, `Unexpected error while loading ${viewName}.`);
  }
}

async function runClinicalGovernanceAction(
  action: string,
  rpcName: string,
  payload: ClinicalGovernancePayload,
): Promise<ClinicalGovernanceActionResult> {
  try {
    return await invokePrivilegedAction<ClinicalGovernanceActionResult>(rpcName, payload);
  } catch (error) {
    return throwRpcActionError(error, action, rpcName);
  }
}

export function getAuditEngagementRegister(): Promise<LiveResult<AuditEngagementRegisterRow[]>> {
  return selectPatch37View<AuditEngagementRegisterRow>('v_patch37_audit_engagement_register', { order: 'created_at', ascending: false, limit: 250 });
}

export function getAuditTestStepQueue(): Promise<LiveResult<AuditTestStepQueueRow[]>> {
  return selectPatch37View<AuditTestStepQueueRow>('v_patch37_audit_test_step_queue', { order: 'due_date', ascending: true, limit: 250 });
}

export function getAuditSampleResultRegister(): Promise<LiveResult<Record<string, unknown>[]>> {
  return selectPatch37View<Record<string, unknown>>('v_patch37_audit_sample_result_register', { order: 'tested_at', ascending: false, limit: 250 });
}

export function getAuditFindingRegister(): Promise<LiveResult<AuditFindingRegisterRow[]>> {
  return selectPatch37View<AuditFindingRegisterRow>('v_patch37_audit_finding_register', { order: 'due_date', ascending: true, limit: 250 });
}

export function getAuditFindingsRequiringCapaOrEvidence(): Promise<LiveResult<AuditFindingRegisterRow[]>> {
  return selectPatch37View<AuditFindingRegisterRow>('v_patch37_audit_findings_requiring_capa_or_evidence', { order: 'due_date', ascending: true, limit: 250 });
}

export function getAuditSignoffQueue(): Promise<LiveResult<AuditSignoffQueueRow[]>> {
  return selectPatch37View<AuditSignoffQueueRow>('v_patch37_audit_signoff_queue', { order: 'created_at', ascending: false, limit: 250 });
}

export function getOvrRcaCaseRegister(): Promise<LiveResult<OvrRcaCaseRegisterRow[]>> {
  return selectPatch37View<OvrRcaCaseRegisterRow>('v_patch37_ovr_rca_case_register', { order: 'due_date', ascending: true, limit: 250 });
}

export function getOvrCapaEvidenceBridge(): Promise<LiveResult<OvrCapaEvidenceBridgeRow[]>> {
  return selectPatch37View<OvrCapaEvidenceBridgeRow>('v_patch37_ovr_capa_evidence_bridge', { order: 'created_at', ascending: false, limit: 250 });
}

export function getClinicalGovernanceEscalationRegister(): Promise<LiveResult<ClinicalGovernanceEscalationRow[]>> {
  return selectPatch37View<ClinicalGovernanceEscalationRow>('v_patch37_clinical_governance_escalation_register', { order: 'escalated_at', ascending: false, limit: 250 });
}

export function getOverdueAuditOvrGovernanceItems(): Promise<LiveResult<OverdueGovernanceItemRow[]>> {
  return selectPatch37View<OverdueGovernanceItemRow>('v_patch37_overdue_audit_ovr_governance_items', { order: 'due_date', ascending: true, limit: 250 });
}

export function getDepartmentClinicalGovernanceWorkload(): Promise<LiveResult<DepartmentClinicalGovernanceWorkloadRow[]>> {
  return selectPatch37View<DepartmentClinicalGovernanceWorkloadRow>('v_patch37_department_clinical_governance_workload', { order: 'overdue_item_count', ascending: false, limit: 250 });
}

export function getExecutiveClinicalGovernanceSummary(): Promise<LiveResult<ExecutiveClinicalGovernanceSummaryRow[]>> {
  return selectPatch37View<ExecutiveClinicalGovernanceSummaryRow>('v_patch37_executive_clinical_governance_summary', { limit: 1 });
}

export function createAuditExecutionEngagement(payload: ClinicalGovernancePayload) {
  return runClinicalGovernanceAction('Create Audit Execution Engagement', 'create_audit_execution_engagement', payload);
}
export function startAuditExecutionEngagement(payload: ClinicalGovernancePayload) {
  return runClinicalGovernanceAction('Start Audit Execution Engagement', 'start_audit_execution_engagement', payload);
}
export function closeAuditExecutionEngagement(payload: ClinicalGovernancePayload) {
  return runClinicalGovernanceAction('Close Audit Execution Engagement', 'close_audit_execution_engagement', payload);
}
export function createAuditExecutionProgram(payload: ClinicalGovernancePayload) {
  return runClinicalGovernanceAction('Create Audit Execution Program', 'create_audit_execution_program', payload);
}
export function createAuditExecutionTestStep(payload: ClinicalGovernancePayload) {
  return runClinicalGovernanceAction('Create Audit Execution Test Step', 'create_audit_execution_test_step', payload);
}
export function updateAuditExecutionTestStepStatus(payload: ClinicalGovernancePayload) {
  return runClinicalGovernanceAction('Update Audit Execution Test Step Status', 'update_audit_execution_test_step_status', payload);
}
export function createAuditExecutionSample(payload: ClinicalGovernancePayload) {
  return runClinicalGovernanceAction('Create Audit Execution Sample', 'create_audit_execution_sample', payload);
}
export function recordAuditExecutionResult(payload: ClinicalGovernancePayload) {
  return runClinicalGovernanceAction('Record Audit Execution Result', 'record_audit_execution_result', payload);
}
export function createAuditExecutionFinding(payload: ClinicalGovernancePayload) {
  return runClinicalGovernanceAction('Create Audit Execution Finding', 'create_audit_execution_finding', payload);
}
export function linkAuditFindingToCapa(payload: ClinicalGovernancePayload) {
  return runClinicalGovernanceAction('Link Audit Finding To CAPA', 'link_audit_finding_to_capa', payload);
}
export function linkAuditFindingToEvidenceBridge(payload: ClinicalGovernancePayload) {
  return runClinicalGovernanceAction('Link Audit Finding To Evidence Bridge', 'link_audit_finding_to_evidence_bridge', payload);
}
export function signoffAuditExecutionEngagement(payload: ClinicalGovernancePayload) {
  return runClinicalGovernanceAction('Signoff Audit Execution Engagement', 'signoff_audit_execution_engagement', payload);
}
export function rejectAuditExecutionSignoff(payload: ClinicalGovernancePayload) {
  return runClinicalGovernanceAction('Reject Audit Execution Signoff', 'reject_audit_execution_signoff', payload);
}
export function reopenAuditExecutionEngagement(payload: ClinicalGovernancePayload) {
  return runClinicalGovernanceAction('Reopen Audit Execution Engagement', 'reopen_audit_execution_engagement', payload);
}
export function createOvrRcaCase(payload: ClinicalGovernancePayload) {
  return runClinicalGovernanceAction('Create OVR RCA Case', 'create_ovr_rca_case', payload);
}
export function updateOvrRcaStatus(payload: ClinicalGovernancePayload) {
  return runClinicalGovernanceAction('Update OVR RCA Status', 'update_ovr_rca_status', payload);
}
export function closeOvrRcaCase(payload: ClinicalGovernancePayload) {
  return runClinicalGovernanceAction('Close OVR RCA Case', 'close_ovr_rca_case', payload);
}
export function linkOvrToCapaEvidenceOrClause(payload: ClinicalGovernancePayload) {
  return runClinicalGovernanceAction('Link OVR To CAPA Evidence Or Clause', 'link_ovr_to_capa_evidence_or_clause', payload);
}
export function escalateClinicalGovernanceItem(payload: ClinicalGovernancePayload) {
  return runClinicalGovernanceAction('Escalate Clinical Governance Item', 'escalate_clinical_governance_item', payload);
}
export function acknowledgeClinicalGovernanceEscalation(payload: ClinicalGovernancePayload) {
  return runClinicalGovernanceAction('Acknowledge Clinical Governance Escalation', 'acknowledge_clinical_governance_escalation', payload);
}
export function resolveClinicalGovernanceEscalation(payload: ClinicalGovernancePayload) {
  return runClinicalGovernanceAction('Resolve Clinical Governance Escalation', 'resolve_clinical_governance_escalation', payload);
}
export function getClinicalGovernanceSummary(payload: ClinicalGovernancePayload) {
  return runClinicalGovernanceAction('Get Clinical Governance Summary', 'get_clinical_governance_summary', payload);
}
export function getAuditExecutionSummary(payload: ClinicalGovernancePayload) {
  return runClinicalGovernanceAction('Get Audit Execution Summary', 'get_audit_execution_summary', payload);
}
