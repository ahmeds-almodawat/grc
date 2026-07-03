import { supabase } from './supabase';
import { emptyLiveObject, emptyLiveArray } from './liveData';
import { invokePrivilegedAction, throwRpcActionError } from './privilegedAction';

const logApiWarning = (label: string, error: unknown) => {
  // eslint-disable-next-line no-console
  console.warn(`[Training Governance live-data unavailable] ${label}`, error);
};

export async function getTrainingPrograms(): Promise<any[]> {
  if (!supabase) return emptyLiveArray();
  try {
    const { data, error } = await supabase
      .from('v_patch29_training_program_register')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (error) {
    logApiWarning('getTrainingPrograms', error);
    return emptyLiveArray();
  }
}

export async function getTrainingAssignmentQueue(): Promise<any[]> {
  if (!supabase) return emptyLiveArray();
  try {
    const { data, error } = await supabase
      .from('v_patch29_training_assignment_queue')
      .select('*')
      .order('assigned_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (error) {
    logApiWarning('getTrainingAssignmentQueue', error);
    return emptyLiveArray();
  }
}

export async function getOverdueTrainingAssignments(): Promise<any[]> {
  if (!supabase) return emptyLiveArray();
  try {
    const { data, error } = await supabase
      .from('v_patch29_overdue_training_assignments')
      .select('*')
      .order('due_date', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (error) {
    logApiWarning('getOverdueTrainingAssignments', error);
    return emptyLiveArray();
  }
}

export async function getSopAcknowledgmentGaps(): Promise<any[]> {
  if (!supabase) return emptyLiveArray();
  try {
    const { data, error } = await supabase
      .from('v_patch29_sop_acknowledgment_gap')
      .select('*');
    if (error) throw error;
    return data || [];
  } catch (error) {
    logApiWarning('getSopAcknowledgmentGaps', error);
    return emptyLiveArray();
  }
}

export async function getCompetencyGaps(): Promise<any[]> {
  if (!supabase) return emptyLiveArray();
  try {
    const { data, error } = await supabase
      .from('v_patch29_competency_gap_dashboard')
      .select('*');
    if (error) throw error;
    return data || [];
  } catch (error) {
    logApiWarning('getCompetencyGaps', error);
    return emptyLiveArray();
  }
}

export async function getTrainingEvidenceIndex(): Promise<any[]> {
  if (!supabase) return emptyLiveArray();
  try {
    const { data, error } = await supabase
      .from('v_patch29_training_evidence_index')
      .select('*')
      .order('uploaded_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (error) {
    logApiWarning('getTrainingEvidenceIndex', error);
    return emptyLiveArray();
  }
}

export async function getTrainingExecutiveSummary(): Promise<any> {
  if (!supabase) return emptyLiveObject('getTrainingExecutiveSummary');
  try {
    const { data, error } = await supabase
      .from('v_patch29_training_executive_summary')
      .select('*')
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data || emptyLiveObject('getTrainingExecutiveSummary');
  } catch (error) {
    logApiWarning('getTrainingExecutiveSummary', error);
    return emptyLiveObject('getTrainingExecutiveSummary');
  }
}

export async function getAccreditationTrainingReadiness(): Promise<any[]> {
  if (!supabase) return emptyLiveArray();
  try {
    const { data, error } = await supabase
      .from('v_patch29_accreditation_training_readiness')
      .select('*');
    if (error) throw error;
    return data || [];
  } catch (error) {
    logApiWarning('getAccreditationTrainingReadiness', error);
    return emptyLiveArray();
  }
}

// Mutative RPC callers
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
  actor_id: string;
}): Promise<void> {
  try {
    await invokePrivilegedAction<void>('start_training_assignment', payload);
  } catch (error) {
    return throwRpcActionError(error, 'Start Training', 'start_training_assignment');
  }
}

export async function completeTrainingAssignment(payload: {
  assignment_id: string;
  evidence_id: string | null;
  actor_id: string;
}): Promise<void> {
  try {
    await invokePrivilegedAction<void>('complete_training_assignment', payload);
  } catch (error) {
    return throwRpcActionError(error, 'Complete Training', 'complete_training_assignment');
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

export async function waiveTrainingAssignment(payload: {
  assignment_id: string;
  reason: string;
  actor_id: string;
}): Promise<void> {
  try {
    await invokePrivilegedAction<void>('waive_training_assignment_with_reason', payload);
  } catch (error) {
    return throwRpcActionError(error, 'Waive Training', 'waive_training_assignment_with_reason');
  }
}

export async function cancelTrainingAssignment(payload: {
  assignment_id: string;
  reason: string;
  actor_id: string;
}): Promise<void> {
  try {
    await invokePrivilegedAction<void>('cancel_training_assignment_with_reason', payload);
  } catch (error) {
    return throwRpcActionError(error, 'Cancel Training', 'cancel_training_assignment_with_reason');
  }
}

export async function recordCompetencyAssessment(payload: {
  assignment_id?: string | null;
  user_id: string;
  competency_area: string;
  result: string;
  score?: number | null;
  evidence_id?: string | null;
  notes?: string | null;
  actor_id: string;
}): Promise<string> {
  try {
    return await invokePrivilegedAction<string>('record_competency_assessment', payload);
  } catch (error) {
    return throwRpcActionError(error, 'Record Competency Assessment', 'record_competency_assessment');
  }
}

export async function reopenTrainingAssignment(payload: {
  assignment_id: string;
  reason: string;
  actor_id: string;
}): Promise<void> {
  try {
    await invokePrivilegedAction<void>('reopen_training_assignment_with_reason', payload);
  } catch (error) {
    return throwRpcActionError(error, 'Reopen/Retrain Assignment', 'reopen_training_assignment_with_reason');
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
