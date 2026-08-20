import { supabase } from './supabase';
import { emptyLiveObject, emptyLiveArray } from './liveData';
import { invokePrivilegedAction, throwRpcActionError } from './privilegedAction';
import {
  buildRecordDocumentAcknowledgmentPayload,
  buildStartTrainingPayload,
  type CompetencyAssessmentResult,
} from './trainingComplianceModel';

const logApiWarning = (label: string, error: unknown) => {
  // eslint-disable-next-line no-console
  console.warn(`[Training Governance live-data unavailable] ${label}`, error);
};

function stripUndefined<T extends Record<string, unknown>>(payload: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
}

export interface TrainingProgramRow {
  id: string;
  title: string;
  title_ar?: string | null;
  training_type: string;
  department_name_en?: string | null;
  department_name_ar?: string | null;
  owner_name_en?: string | null;
  owner_name_ar?: string | null;
  active?: boolean | null;
}

export interface TrainingAssignmentQueueRow {
  id: string;
  program_id: string;
  assigned_to_user_id: string | null;
  assigned_to_department_id?: string | null;
  document_version_id?: string | null;
  due_date: string | null;
  status: 'assigned' | 'in_progress' | 'completed' | 'overdue' | 'waived' | 'cancelled' | string;
  assigned_at?: string | null;
  completed_at?: string | null;
  completion_evidence_id?: string | null;
  program_title: string | null;
  program_title_ar?: string | null;
  training_type?: string | null;
  assigned_user_name_en?: string | null;
  assigned_user_name_ar?: string | null;
  department_name_en?: string | null;
  department_name_ar?: string | null;
  document_code?: string | null;
  version_label?: string | null;
}

export interface SopAcknowledgmentGapRow {
  program_id?: string | null;
  sop_title: string | null;
  sop_title_ar?: string | null;
  linked_sop_id?: string | null;
  user_id: string;
  user_name_en?: string | null;
  user_name_ar?: string | null;
  department_id?: string | null;
  department_name_en?: string | null;
  department_name_ar?: string | null;
  version_id: string;
  due_date?: string | null;
  document_code?: string | null;
  version_label?: string | null;
}

export interface CompetencyGapRow {
  user_id: string;
  user_name_en?: string | null;
  user_name_ar?: string | null;
  competency_area: string | null;
  result: CompetencyAssessmentResult | string | null;
  score: number | null;
  assessed_at?: string | null;
  assessor_user_id?: string | null;
  assessor_name_en?: string | null;
  assessor_name_ar?: string | null;
  assignment_id?: string | null;
  document_version_id?: string | null;
  due_date?: string | null;
  document_code?: string | null;
  version_label?: string | null;
}

export interface TrainingEvidenceRow {
  evidence_id: string;
  file_name: string;
  file_path?: string | null;
  uploaded_at: string;
  assignment_id?: string | null;
  program_title?: string | null;
  training_type?: string | null;
  user_name_en?: string | null;
  user_name_ar?: string | null;
}

export interface TrainingExecutiveSummaryRow {
  active_programs_count: number;
  pending_assignments_count: number;
  completed_assignments_count: number;
  overdue_assignments_count: number;
  total_sop_gaps_count: number;
  competency_fails_count: number;
}

export interface AccreditationTrainingReadinessRow {
  program_id: string;
  program_title: string;
  program_title_ar?: string | null;
  department_name_en?: string | null;
  department_name_ar?: string | null;
  total_assigned: number;
  total_completed: number;
  total_overdue: number;
  completion_rate: number;
}

export interface SopTrainingComplianceMatrixRow {
  sop_version_id: string;
  document_id: string;
  organization_id: string;
  document_code: string | null;
  document_title: string;
  version_number: number;
  version_label: string;
  document_status: string;
  training_required: boolean;
  acknowledgment_required: boolean;
  competency_assessment_required: boolean;
  target_population_count: number;
  training_target_count: number;
  acknowledgment_target_count: number;
  competency_target_count: number;
  assigned_count: number;
  in_progress_count: number;
  completed_count: number;
  overdue_count: number;
  waived_count: number;
  cancelled_count: number;
  acknowledged_count: number;
  acknowledgment_gap_count: number;
  competency_passed_count: number;
  competency_failed_count: number;
  competency_pending_count: number;
  renewal_due_count: number;
}

export async function getTrainingPrograms(): Promise<TrainingProgramRow[]> {
  if (!supabase) return emptyLiveArray();
  try {
    const { data, error } = await supabase
      .from('v_patch29_training_program_register')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data as unknown as TrainingProgramRow[]) || [];
  } catch (error) {
    logApiWarning('getTrainingPrograms', error);
    return emptyLiveArray();
  }
}

export async function getTrainingAssignmentQueue(): Promise<TrainingAssignmentQueueRow[]> {
  if (!supabase) return emptyLiveArray();
  try {
    const { data, error } = await supabase
      .from('v_patch29_training_assignment_queue')
      .select('*')
      .order('assigned_at', { ascending: false });
    if (error) throw error;
    return (data as unknown as TrainingAssignmentQueueRow[]) || [];
  } catch (error) {
    logApiWarning('getTrainingAssignmentQueue', error);
    return emptyLiveArray();
  }
}

export async function getOverdueTrainingAssignments(): Promise<TrainingAssignmentQueueRow[]> {
  if (!supabase) return emptyLiveArray();
  try {
    const { data, error } = await supabase
      .from('v_patch29_overdue_training_assignments')
      .select('*')
      .order('due_date', { ascending: true });
    if (error) throw error;
    return (data as unknown as TrainingAssignmentQueueRow[]) || [];
  } catch (error) {
    logApiWarning('getOverdueTrainingAssignments', error);
    return emptyLiveArray();
  }
}

export async function getSopAcknowledgmentGaps(): Promise<SopAcknowledgmentGapRow[]> {
  if (!supabase) return emptyLiveArray();
  try {
    const { data, error } = await supabase
      .from('v_patch29_sop_acknowledgment_gap')
      .select('*');
    if (error) throw error;
    return (data as unknown as SopAcknowledgmentGapRow[]) || [];
  } catch (error) {
    logApiWarning('getSopAcknowledgmentGaps', error);
    return emptyLiveArray();
  }
}

export async function getCompetencyGaps(): Promise<CompetencyGapRow[]> {
  if (!supabase) return emptyLiveArray();
  try {
    const { data, error } = await supabase
      .from('v_patch29_competency_gap_dashboard')
      .select('*');
    if (error) throw error;
    return (data as unknown as CompetencyGapRow[]) || [];
  } catch (error) {
    logApiWarning('getCompetencyGaps', error);
    return emptyLiveArray();
  }
}

export async function getTrainingEvidenceIndex(): Promise<TrainingEvidenceRow[]> {
  if (!supabase) return emptyLiveArray();
  try {
    const { data, error } = await supabase
      .from('v_patch29_training_evidence_index')
      .select('*')
      .order('uploaded_at', { ascending: false });
    if (error) throw error;
    return (data as unknown as TrainingEvidenceRow[]) || [];
  } catch (error) {
    logApiWarning('getTrainingEvidenceIndex', error);
    return emptyLiveArray();
  }
}

export async function getTrainingExecutiveSummary(): Promise<TrainingExecutiveSummaryRow> {
  if (!supabase) return emptyLiveObject('getTrainingExecutiveSummary') as TrainingExecutiveSummaryRow;
  try {
    const { data, error } = await supabase
      .from('v_patch29_training_executive_summary')
      .select('*')
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return (data as unknown as TrainingExecutiveSummaryRow)
      || (emptyLiveObject('getTrainingExecutiveSummary') as TrainingExecutiveSummaryRow);
  } catch (error) {
    logApiWarning('getTrainingExecutiveSummary', error);
    return emptyLiveObject('getTrainingExecutiveSummary') as TrainingExecutiveSummaryRow;
  }
}

export async function getAccreditationTrainingReadiness(): Promise<AccreditationTrainingReadinessRow[]> {
  if (!supabase) return emptyLiveArray();
  try {
    const { data, error } = await supabase
      .from('v_patch29_accreditation_training_readiness')
      .select('*');
    if (error) throw error;
    return (data as unknown as AccreditationTrainingReadinessRow[]) || [];
  } catch (error) {
    logApiWarning('getAccreditationTrainingReadiness', error);
    return emptyLiveArray();
  }
}

export async function getSopTrainingComplianceMatrix(): Promise<SopTrainingComplianceMatrixRow[]> {
  if (!supabase) return emptyLiveArray();
  try {
    const { data, error } = await supabase
      .from('v_sop_training_compliance_matrix')
      .select('*')
      .order('document_code', { ascending: true });
    if (error) throw error;
    return (data as unknown as SopTrainingComplianceMatrixRow[]) || [];
  } catch (error) {
    logApiWarning('getSopTrainingComplianceMatrix', error);
    return emptyLiveArray();
  }
}

// Legacy/unreleased Patch29-era wrappers are retained only for historical callers.
export async function createTrainingProgram(payload: {
  title: string;
  title_ar?: string;
  description?: string;
  training_type: string;
  linked_document_id?: string | null;
  linked_sop_id?: string | null;
  linked_compliance_obligation_id?: string | null;
  linked_capa_id?: string | null;
  linked_risk_id?: string | null;
  linked_audit_finding_id?: string | null;
  owner_user_id?: string | null;
  department_id?: string | null;
  actor_id: string;
}): Promise<string> {
  try {
    return await invokePrivilegedAction<string>('create_training_program', payload);
  } catch (error) {
    return throwRpcActionError(error, 'Create Training Program', 'create_training_program');
  }
}

export async function assignTrainingProgramToUser(payload: {
  program_id: string;
  user_id: string;
  due_date: string | null;
  actor_id: string;
}): Promise<string> {
  try {
    return await invokePrivilegedAction<string>('assign_training_program_to_user', payload);
  } catch (error) {
    return throwRpcActionError(error, 'Assign Training to User', 'assign_training_program_to_user');
  }
}

export async function assignTrainingProgramToDepartment(payload: {
  program_id: string;
  department_id: string;
  due_date: string | null;
  actor_id: string;
}): Promise<{ status: string; assigned_count: number }> {
  try {
    return await invokePrivilegedAction<{ status: string; assigned_count: number }>(
      'assign_training_program_to_department',
      payload
    );
  } catch (error) {
    return throwRpcActionError(
      error,
      'Assign Training to Department',
      'assign_training_program_to_department'
    );
  }
}

export async function startTrainingAssignment(payload: {
  assignment_id: string;
  actor_id?: string;
}): Promise<void> {
  try {
    await invokePrivilegedAction<void>(
      'start_training_assignment',
      stripUndefined(payload)
    );
  } catch (error) {
    return throwRpcActionError(error, 'Start Training', 'start_training_assignment');
  }
}

export async function startOwnTrainingAssignment(assignmentId: string): Promise<void> {
  return startTrainingAssignment(buildStartTrainingPayload(assignmentId));
}

export async function completeTrainingAssignment(payload: {
  assignment_id: string;
  evidence_id?: string | null;
  actor_id?: string;
}): Promise<void> {
  try {
    await invokePrivilegedAction<void>(
      'complete_training_assignment',
      stripUndefined({
        assignment_id: payload.assignment_id,
        evidence_id: payload.evidence_id ?? null,
        actor_id: payload.actor_id,
      })
    );
  } catch (error) {
    return throwRpcActionError(error, 'Certify Completion', 'complete_training_assignment');
  }
}

export async function acknowledgeTrainingAssignment(payload: {
  assignment_id: string;
  acknowledgment_text: string;
  ip_address: string | null;
  user_agent: string | null;
  evidence_id: string | null;
  actor_id: string;
}): Promise<string> {
  try {
    return await invokePrivilegedAction<string>('acknowledge_training_assignment', payload);
  } catch (error) {
    return throwRpcActionError(error, 'Acknowledge SOP/Training', 'acknowledge_training_assignment');
  }
}

export async function recordDocumentAcknowledgment(payload: {
  document_id: string;
  version_id: string;
  acknowledgment_note?: string | null;
}): Promise<string> {
  try {
    return await invokePrivilegedAction<string>(
      'record_document_acknowledgment',
      buildRecordDocumentAcknowledgmentPayload(payload)
    );
  } catch (error) {
    return throwRpcActionError(error, 'Acknowledge SOP Version', 'record_document_acknowledgment');
  }
}

export async function waiveTrainingAssignment(payload: {
  assignment_id: string;
  reason: string;
  actor_id?: string;
}): Promise<void> {
  try {
    await invokePrivilegedAction<void>(
      'waive_training_assignment_with_reason',
      stripUndefined(payload)
    );
  } catch (error) {
    return throwRpcActionError(error, 'Waive Training', 'waive_training_assignment_with_reason');
  }
}

export async function cancelTrainingAssignment(payload: {
  assignment_id: string;
  reason: string;
  actor_id?: string;
}): Promise<void> {
  try {
    await invokePrivilegedAction<void>(
      'cancel_training_assignment_with_reason',
      stripUndefined(payload)
    );
  } catch (error) {
    return throwRpcActionError(error, 'Cancel Training', 'cancel_training_assignment_with_reason');
  }
}

export async function recordCompetencyAssessment(payload: {
  assignment_id?: string | null;
  user_id: string;
  competency_area: string;
  result: CompetencyAssessmentResult;
  score?: number | null;
  evidence_id?: string | null;
  notes?: string | null;
  actor_id?: string;
}): Promise<string> {
  try {
    return await invokePrivilegedAction<string>(
      'record_competency_assessment',
      stripUndefined({
        assignment_id: payload.assignment_id ?? null,
        user_id: payload.user_id,
        competency_area: payload.competency_area,
        result: payload.result,
        score: payload.score ?? null,
        evidence_id: payload.evidence_id ?? null,
        notes: payload.notes ?? null,
        actor_id: payload.actor_id,
      })
    );
  } catch (error) {
    return throwRpcActionError(error, 'Record Competency Assessment', 'record_competency_assessment');
  }
}

export async function reopenTrainingAssignment(payload: {
  assignment_id: string;
  reason: string;
  actor_id?: string;
}): Promise<void> {
  try {
    await invokePrivilegedAction<void>(
      'reopen_training_assignment_with_reason',
      stripUndefined(payload)
    );
  } catch (error) {
    return throwRpcActionError(error, 'Reopen Assignment', 'reopen_training_assignment_with_reason');
  }
}

export async function decideSopRolloutRequirements(payload: {
  version_id: string;
  retraining_required: boolean;
  reacknowledgment_required: boolean;
  competency_reassessment_required: boolean;
  rationale: string;
  actor_id?: string;
}): Promise<{
  success: boolean;
  version_id: string;
  retraining_required: boolean;
  reacknowledgment_required: boolean;
  competency_reassessment_required: boolean;
  decided_at: string;
}> {
  try {
    return await invokePrivilegedAction(
      'decide_sop_rollout_requirements',
      stripUndefined(payload)
    );
  } catch (error) {
    return throwRpcActionError(error, 'Decide SOP Rollout Requirements', 'decide_sop_rollout_requirements');
  }
}

export async function publishSopTrainingObligations(versionId: string): Promise<{
  success: boolean;
  version_id: string;
  program_id: string;
  cycle: number;
  cycle_type: string;
  assignments_created: number;
  acknowledgment_requirements_created: number;
}> {
  try {
    return await invokePrivilegedAction(
      'publish_sop_training_obligations',
      { version_id: versionId }
    );
  } catch (error) {
    return throwRpcActionError(error, 'Publish Training Obligations', 'publish_sop_training_obligations');
  }
}

export async function linkTrainingEvidence(payload: {
  assignment_id: string;
  evidence_id: string;
  actor_id: string;
}): Promise<void> {
  try {
    await invokePrivilegedAction<void>('link_training_evidence', payload);
  } catch (error) {
    return throwRpcActionError(error, 'Link Training Evidence', 'link_training_evidence');
  }
}
