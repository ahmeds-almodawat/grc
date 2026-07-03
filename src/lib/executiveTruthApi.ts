import { supabase } from './supabase';
import { emptyLiveObject, emptyLiveArray } from './liveData';
import { invokePrivilegedAction, throwRpcActionError } from './privilegedAction';

const logApiWarning = (label: string, error: unknown) => {
  // eslint-disable-next-line no-console
  console.warn(`[Executive Truth live-data unavailable] ${label}`, error);
};

export async function getExecutiveTruthSummary(): Promise<any> {
  if (!supabase) return emptyLiveObject('getExecutiveTruthSummary');
  try {
    const { data, error } = await supabase
      .from('v_patch30_executive_truth_summary')
      .select('*')
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data || emptyLiveObject('getExecutiveTruthSummary');
  } catch (error) {
    logApiWarning('getExecutiveTruthSummary', error);
    return emptyLiveObject('getExecutiveTruthSummary');
  }
}

export async function getModuleHealthScorecard(): Promise<any[]> {
  if (!supabase) return emptyLiveArray();
  try {
    const { data, error } = await supabase
      .from('v_patch30_module_health_scorecard')
      .select('*');
    if (error) throw error;
    return data || [];
  } catch (error) {
    logApiWarning('getModuleHealthScorecard', error);
    return emptyLiveArray();
  }
}

export async function getOpenExecutiveRisks(): Promise<any[]> {
  if (!supabase) return emptyLiveArray();
  try {
    const { data, error } = await supabase
      .from('v_patch30_open_executive_risk_register')
      .select('*');
    if (error) throw error;
    return data || [];
  } catch (error) {
    logApiWarning('getOpenExecutiveRisks', error);
    return emptyLiveArray();
  }
}

export async function getOverdueGovernanceItems(): Promise<any[]> {
  if (!supabase) return emptyLiveArray();
  try {
    const { data, error } = await supabase
      .from('v_patch30_overdue_governance_items')
      .select('*')
      .order('days_overdue', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (error) {
    logApiWarning('getOverdueGovernanceItems', error);
    return emptyLiveArray();
  }
}

export async function getEvidenceGapSummary(): Promise<any[]> {
  if (!supabase) return emptyLiveArray();
  try {
    const { data, error } = await supabase
      .from('v_patch30_evidence_gap_summary')
      .select('*');
    if (error) throw error;
    return data || [];
  } catch (error) {
    logApiWarning('getEvidenceGapSummary', error);
    return emptyLiveArray();
  }
}

export async function getWorkflowBottleneckSummary(): Promise<any[]> {
  if (!supabase) return emptyLiveArray();
  try {
    const { data, error } = await supabase
      .from('v_patch30_workflow_bottleneck_summary')
      .select('*')
      .order('pending_days', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (error) {
    logApiWarning('getWorkflowBottleneckSummary', error);
    return emptyLiveArray();
  }
}

export async function getAccreditationReadinessSummary(): Promise<any> {
  if (!supabase) return emptyLiveObject('getAccreditationReadinessSummary');
  try {
    const { data, error } = await supabase
      .from('v_patch30_accreditation_readiness_summary')
      .select('*')
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data || emptyLiveObject('getAccreditationReadinessSummary');
  } catch (error) {
    logApiWarning('getAccreditationReadinessSummary', error);
    return emptyLiveObject('getAccreditationReadinessSummary');
  }
}

export async function getDepartmentGrcScorecards(): Promise<any[]> {
  if (!supabase) return emptyLiveArray();
  try {
    const { data, error } = await supabase
      .from('v_patch30_department_grc_scorecard')
      .select('*');
    if (error) throw error;
    return data || [];
  } catch (error) {
    logApiWarning('getDepartmentGrcScorecards', error);
    return emptyLiveArray();
  }
}

export async function getGovernanceExceptionRegister(): Promise<any[]> {
  if (!supabase) return emptyLiveArray();
  try {
    const { data, error } = await supabase
      .from('v_patch30_governance_exception_register')
      .select('*')
      .order('logged_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (error) {
    logApiWarning('getGovernanceExceptionRegister', error);
    return emptyLiveArray();
  }
}

export async function getBoardPackTruthSnapshots(): Promise<any[]> {
  if (!supabase) return emptyLiveArray();
  try {
    const { data, error } = await supabase
      .from('v_patch30_board_pack_truth_snapshot')
      .select('*')
      .order('captured_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (error) {
    logApiWarning('getBoardPackTruthSnapshots', error);
    return emptyLiveArray();
  }
}

// Mutative edge action callers
export async function createExecutiveTruthSnapshot(payload: {
  title: string;
  notes: string;
  actor_id: string;
}): Promise<string> {
  try {
    return await invokePrivilegedAction<string>('create_executive_truth_snapshot', payload);
  } catch (error) {
    return throwRpcActionError(error, 'Create Truth Snapshot', 'create_executive_truth_snapshot');
  }
}

export async function refreshExecutiveTruthSnapshot(payload: {
  snapshot_id: string;
  actor_id: string;
}): Promise<void> {
  try {
    await invokePrivilegedAction<void>('refresh_executive_truth_snapshot', payload);
  } catch (error) {
    return throwRpcActionError(error, 'Refresh Truth Snapshot', 'refresh_executive_truth_snapshot');
  }
}

export async function recordExecutiveTruthEvent(payload: {
  event_type: string;
  event_summary: string;
  snapshot_id: string;
  actor_id: string;
}): Promise<string> {
  try {
    return await invokePrivilegedAction<string>('record_executive_truth_event', payload);
  } catch (error) {
    return throwRpcActionError(error, 'Record Truth Event', 'record_executive_truth_event');
  }
}
