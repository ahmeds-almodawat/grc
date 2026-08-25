import { invokePrivilegedAction } from './privilegedAction';
import { requireSupabase } from './supabase';
import type { Ui3ComplianceResult } from './ui3RiskComplianceModel';

export interface Ui3RiskControl {
  id: string;
  risk_id: string;
  control_code: string | null;
  title: string;
  description: string | null;
  control_type: string;
  frequency: string;
  effectiveness: string;
  design_effectiveness: string | null;
  operating_effectiveness: string | null;
  key_control: boolean | null;
  owner_id: string | null;
  evidence_required: boolean;
  last_tested_at: string | null;
  next_test_date: string | null;
  is_active: boolean;
}

export interface Ui3RiskTreatmentAction {
  id: string;
  risk_id: string;
  title: string;
  description: string | null;
  owner_id: string | null;
  due_date: string | null;
  status: string;
  progress_percent: number;
  evidence_required: boolean;
  delay_reason: string | null;
}

export interface Ui3RiskKri {
  id: string;
  risk_id: string;
  kri_code: string | null;
  name_en: string;
  name_ar: string | null;
  current_value: number | null;
  threshold_warning: number | null;
  threshold_critical: number | null;
  direction: string;
  status: string;
  measured_at: string | null;
  owner_id: string | null;
}

export interface Ui3ComplianceObligation {
  id: string;
  organization_id: string;
  obligation_code: string | null;
  regulatory_body: string | null;
  framework: string | null;
  clause_reference: string | null;
  title: string;
  requirement_text: string;
  applicability: string;
  owner_id: string | null;
  department_id: string | null;
  risk_level: string;
  status: string;
  review_frequency: string;
  last_reviewed_at: string | null;
  next_review_date: string | null;
  evidence_required: boolean;
  notes: string | null;
  latest_assessment_id: string | null;
  latest_assessment_code: string | null;
  latest_assessment_date: string | null;
  latest_assessment_result: Ui3ComplianceResult | null;
  latest_assessment_status: string | null;
  open_finding_count: number;
  open_remediation_count: number;
  has_overdue_remediation: boolean;
}

export interface Ui3ComplianceAssessment {
  id: string;
  organization_id: string;
  obligation_id: string;
  assessment_code: string;
  assessment_title: string;
  assessment_period_start: string | null;
  assessment_period_end: string | null;
  assessment_date: string;
  assessment_method: string | null;
  scope_description: string | null;
  department_id: string | null;
  responsible_owner_id: string | null;
  reviewer_id: string | null;
  result: Ui3ComplianceResult;
  workflow_status: string;
  conclusion_summary: string | null;
  evidence_reference: string | null;
  evidence_file_id: string | null;
  governance_review_id: string | null;
  created_by: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Ui3ComplianceFinding {
  id: string;
  organization_id: string;
  assessment_id: string;
  obligation_id: string;
  finding_code: string;
  finding_description: string;
  severity: string;
  materiality: string | null;
  finding_status: string;
  responsible_owner_id: string | null;
  department_id: string | null;
  due_date: string | null;
  evidence_reference: string | null;
  evidence_file_id: string | null;
  root_cause_category: string | null;
  root_cause_description: string | null;
  created_by: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  closed_at: string | null;
  created_at: string;
}

export interface Ui3ComplianceRemediation {
  id: string;
  organization_id: string;
  finding_id: string;
  action_code: string;
  action_description: string;
  owner_id: string | null;
  due_date: string | null;
  action_status: string;
  evidence_reference: string | null;
  evidence_file_id: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface Ui3ComplianceEvent {
  id: string;
  organization_id: string;
  assessment_id: string | null;
  finding_id: string | null;
  remediation_action_id: string | null;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  actor_id: string;
  event_note: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Ui3GovernanceCriterionOption {
  id: string;
  code: string;
  title: string;
  subtitle?: string | null;
  active?: boolean;
}

export interface Ui3EvidenceOption {
  id: string;
  file_name: string;
  file_type: string | null;
  description: string | null;
}

async function selectRows<T>(table: string, order: string, filters: Record<string, string> = {}): Promise<T[]> {
  let query = requireSupabase().from(table).select('*');
  Object.entries(filters).forEach(([column, value]) => {
    query = query.eq(column, value);
  });
  const { data, error } = await query.order(order, { ascending: false, nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as T[];
}

export function getUi3RiskControls(riskId: string) {
  return selectRows<Ui3RiskControl>('risk_controls', 'created_at', { risk_id: riskId });
}

export function getUi3RiskTreatments(riskId: string) {
  return selectRows<Ui3RiskTreatmentAction>('risk_mitigation_actions', 'created_at', { risk_id: riskId });
}

export function getUi3RiskKris(riskId: string) {
  return selectRows<Ui3RiskKri>('risk_kri_indicators', 'measured_at', { risk_id: riskId });
}

export function getUi3ComplianceObligations() {
  return selectRows<Ui3ComplianceObligation>('v_ui3_compliance_obligation_register', 'next_review_date');
}

export function getUi3ComplianceAssessments(obligationId?: string) {
  return selectRows<Ui3ComplianceAssessment>('compliance_assessments', 'assessment_date', obligationId ? { obligation_id: obligationId } : {});
}

export function getUi3ComplianceFindings(obligationId?: string) {
  return selectRows<Ui3ComplianceFinding>('compliance_findings', 'created_at', obligationId ? { obligation_id: obligationId } : {});
}

export function getUi3ComplianceRemediations() {
  return selectRows<Ui3ComplianceRemediation>('compliance_remediation_actions', 'created_at');
}

export function getUi3ComplianceEvents(assessmentId: string) {
  return selectRows<Ui3ComplianceEvent>('compliance_workflow_events', 'created_at', { assessment_id: assessmentId });
}

export async function getUi3ComplianceObligationOptions(): Promise<Ui3GovernanceCriterionOption[]> {
  const { data, error } = await requireSupabase()
    .from('compliance_obligations')
    .select('id, obligation_code, title, regulatory_body, applicability')
    .order('obligation_code', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    code: row.obligation_code ?? 'OBL',
    title: row.title,
    subtitle: row.regulatory_body,
    active: row.applicability !== 'not_applicable',
  }));
}

export async function getUi3ControlOptions(): Promise<Ui3GovernanceCriterionOption[]> {
  const { data, error } = await requireSupabase()
    .from('control_library_items')
    .select('id, control_code, title, control_type, is_active')
    .eq('is_active', true)
    .order('control_code', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({ id: row.id, code: row.control_code ?? 'CTRL', title: row.title, subtitle: row.control_type, active: row.is_active }));
}

export async function getUi3AccreditationClauseOptions(): Promise<Ui3GovernanceCriterionOption[]> {
  const { data, error } = await requireSupabase()
    .from('accreditation_clauses')
    .select('id, clause_code, clause_title, active')
    .eq('active', true)
    .order('clause_code', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    code: row.clause_code ?? 'CLAUSE',
    title: row.clause_title ?? 'Accreditation clause',
    active: row.active,
  }));
}

export async function getUi3EvidenceOptions(): Promise<Ui3EvidenceOption[]> {
  const { data, error } = await requireSupabase()
    .from('evidence_files')
    .select('id, file_name, file_type, description')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []) as Ui3EvidenceOption[];
}

export async function updateUi3RiskRecord(riskId: string, input: {
  title: string;
  description?: string | null;
  category: string;
  department_id?: string | null;
  owner_id?: string | null;
  response_type: string;
  next_review_date?: string | null;
}) {
  const client = requireSupabase();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) throw new Error('An authenticated user is required.');
  const { data, error } = await client.from('risks').update({
    ...input,
    updated_by: authData.user.id,
  }).eq('id', riskId).select('id').single();
  if (error) throw new Error(error.message);
  return data;
}

export function createUi3ComplianceObligation(payload: Record<string, unknown>) {
  return invokePrivilegedAction<{ id: string; obligation_code: string; status: string }>('create_compliance_obligation', payload);
}

export function createUi3ComplianceAssessment(payload: Record<string, unknown>) {
  return invokePrivilegedAction<{ id: string; assessment_code: string; status: string }>('create_compliance_assessment', payload);
}

export function submitUi3ComplianceAssessment(payload: Record<string, unknown>) {
  return invokePrivilegedAction<{ id: string; status: string }>('submit_compliance_assessment', payload);
}

export function decideUi3ComplianceAssessment(assessmentId: string, approved: boolean, rationale: string) {
  return invokePrivilegedAction<{ id: string; status: string }>(
    approved ? 'approve_compliance_assessment' : 'reject_compliance_assessment',
    { assessment_id: assessmentId, rationale },
  );
}

export function recordUi3ComplianceFinding(payload: Record<string, unknown>) {
  return invokePrivilegedAction<{ id: string; finding_code: string; status: string }>('record_compliance_finding', payload);
}

export function createUi3ComplianceRemediation(payload: Record<string, unknown>) {
  return invokePrivilegedAction<{ id: string; action_code: string; status: string }>('create_compliance_remediation', payload);
}

export function updateUi3ComplianceRemediation(payload: Record<string, unknown>) {
  return invokePrivilegedAction<{ id: string; status: string }>('update_compliance_remediation', payload);
}

export function decideUi3RiskReassessment(input: {
  reassessmentId: string;
  approved: boolean;
  governanceReviewId?: string | null;
  rationale: string;
}) {
  return invokePrivilegedAction<{ id: string; status: string }>(
    input.approved ? 'approve_risk_reassessment' : 'reject_risk_reassessment',
    {
      reassessment_id: input.reassessmentId,
      governance_review_id: input.governanceReviewId ?? undefined,
      rationale: input.rationale,
    },
  );
}
