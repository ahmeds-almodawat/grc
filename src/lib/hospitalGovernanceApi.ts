import { supabase } from './supabase';
import { invokePrivilegedAction, throwRpcActionError } from './privilegedAction';
import {
  configurationErrorResult,
  emptyResult,
  liveResult,
  queryErrorResult,
  type LiveResult,
} from './liveResult';

type HospitalGovernancePayload = Record<string, unknown>;

export interface HospitalGovernanceRow {
  id?: string;
  work_id?: string;
  event_title?: string | null;
  indicator_name?: string | null;
  meeting_title?: string | null;
  action_title?: string | null;
  credential_title?: string | null;
  safety_item_title?: string | null;
  work_title?: string | null;
  status?: string | null;
  performance_status?: string | null;
  credential_status?: string | null;
  meeting_status?: string | null;
  severity?: string | null;
  priority?: string | null;
  department_name_en?: string | null;
  department_name?: string | null;
  owner_name_en?: string | null;
  assigned_to_name?: string | null;
  due_date?: string | null;
  created_at?: string | null;
  [key: string]: unknown;
}

export interface HospitalQualitySummaryRow {
  open_infection_control_count?: number | null;
  off_target_indicator_count?: number | null;
  overdue_committee_action_count?: number | null;
  credentialing_due_or_expired_count?: number | null;
  facility_safety_gap_count?: number | null;
  accreditation_blocked_clause_count?: number | null;
  executive_signal?: string | null;
  [key: string]: unknown;
}

async function selectPatch39View<T>(viewName: string, options: { order?: string; ascending?: boolean; limit?: number } = {}): Promise<LiveResult<T[]>> {
  if (!supabase) {
    return configurationErrorResult<T[]>('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to load live hospital governance data.');
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

async function runHospitalGovernanceAction(action: string, rpcName: string, payload: HospitalGovernancePayload) {
  try {
    return await invokePrivilegedAction(rpcName, payload);
  } catch (error) {
    return throwRpcActionError(error, action, rpcName);
  }
}

export function getInfectionControlRegister(): Promise<LiveResult<HospitalGovernanceRow[]>> {
  return selectPatch39View('v_patch39_infection_control_register', { order: 'created_at', ascending: false, limit: 300 });
}
export function getInfectionControlOpenActions(): Promise<LiveResult<HospitalGovernanceRow[]>> {
  return selectPatch39View('v_patch39_infection_control_open_actions', { order: 'due_date', ascending: true, limit: 300 });
}
export function getQualityIndicatorPerformance(): Promise<LiveResult<HospitalGovernanceRow[]>> {
  return selectPatch39View('v_patch39_quality_indicator_performance', { order: 'period_end', ascending: false, limit: 300 });
}
export function getQualityIndicatorOffTargetRegister(): Promise<LiveResult<HospitalGovernanceRow[]>> {
  return selectPatch39View('v_patch39_quality_indicator_off_target_register', { order: 'period_end', ascending: false, limit: 300 });
}
export function getCommitteeMeetingRegister(): Promise<LiveResult<HospitalGovernanceRow[]>> {
  return selectPatch39View('v_patch39_committee_meeting_register', { order: 'meeting_date', ascending: false, limit: 300 });
}
export function getCommitteeActionQueue(): Promise<LiveResult<HospitalGovernanceRow[]>> {
  return selectPatch39View('v_patch39_committee_action_queue', { order: 'due_date', ascending: true, limit: 300 });
}
export function getOverdueCommitteeActions(): Promise<LiveResult<HospitalGovernanceRow[]>> {
  return selectPatch39View('v_patch39_overdue_committee_actions', { order: 'due_date', ascending: true, limit: 300 });
}
export function getCredentialingExpiryRegister(): Promise<LiveResult<HospitalGovernanceRow[]>> {
  return selectPatch39View('v_patch39_credentialing_expiry_register', { order: 'expires_on', ascending: true, limit: 300 });
}
export function getPrivilegingCompetencyGapRegister(): Promise<LiveResult<HospitalGovernanceRow[]>> {
  return selectPatch39View('v_patch39_privileging_competency_gap_register', { order: 'due_date', ascending: true, limit: 300 });
}
export function getFacilityBiomedicalSafetyRegister(): Promise<LiveResult<HospitalGovernanceRow[]>> {
  return selectPatch39View('v_patch39_facility_biomedical_safety_register', { order: 'created_at', ascending: false, limit: 300 });
}
export function getFacilitySafetyEvidenceGapRegister(): Promise<LiveResult<HospitalGovernanceRow[]>> {
  return selectPatch39View('v_patch39_facility_safety_evidence_gap_register', { order: 'due_date', ascending: true, limit: 300 });
}
export function getHospitalGovernanceWorkQueue(): Promise<LiveResult<HospitalGovernanceRow[]>> {
  return selectPatch39View('v_patch39_hospital_governance_work_queue', { order: 'due_date', ascending: true, limit: 300 });
}
export function getAccreditationBlockerSummary(): Promise<LiveResult<HospitalGovernanceRow[]>> {
  return selectPatch39View('v_patch39_accreditation_blocker_summary', { order: 'blocker_count', ascending: false, limit: 300 });
}
export function getDepartmentHospitalGovernanceScorecard(): Promise<LiveResult<HospitalGovernanceRow[]>> {
  return selectPatch39View('v_patch39_department_hospital_governance_scorecard', { order: 'overdue_item_count', ascending: false, limit: 300 });
}
export function getExecutiveHospitalQualitySummary(): Promise<LiveResult<HospitalQualitySummaryRow[]>> {
  return selectPatch39View('v_patch39_executive_hospital_quality_summary', { limit: 1 });
}

export function createInfectionControlSurveillanceEvent(payload: HospitalGovernancePayload) { return runHospitalGovernanceAction('Create Infection Control Surveillance Event', 'create_infection_control_surveillance_event', payload); }
export function updateInfectionControlEventStatus(payload: HospitalGovernancePayload) { return runHospitalGovernanceAction('Update Infection Control Event Status', 'update_infection_control_event_status', payload); }
export function closeInfectionControlEvent(payload: HospitalGovernancePayload) { return runHospitalGovernanceAction('Close Infection Control Event', 'close_infection_control_event', payload); }
export function recordClinicalQualityIndicatorResult(payload: HospitalGovernancePayload) { return runHospitalGovernanceAction('Record Clinical Quality Indicator Result', 'record_clinical_quality_indicator_result', payload); }
export function updateClinicalQualityIndicatorStatus(payload: HospitalGovernancePayload) { return runHospitalGovernanceAction('Update Clinical Quality Indicator Status', 'update_clinical_quality_indicator_status', payload); }
export function createHospitalCommitteeMeeting(payload: HospitalGovernancePayload) { return runHospitalGovernanceAction('Create Hospital Committee Meeting', 'create_hospital_committee_meeting', payload); }
export function updateCommitteeMeetingStatus(payload: HospitalGovernancePayload) { return runHospitalGovernanceAction('Update Committee Meeting Status', 'update_committee_meeting_status', payload); }
export function createHospitalCommitteeAction(payload: HospitalGovernancePayload) { return runHospitalGovernanceAction('Create Hospital Committee Action', 'create_hospital_committee_action', payload); }
export function updateCommitteeActionStatus(payload: HospitalGovernancePayload) { return runHospitalGovernanceAction('Update Committee Action Status', 'update_committee_action_status', payload); }
export function completeCommitteeAction(payload: HospitalGovernancePayload) { return runHospitalGovernanceAction('Complete Committee Action', 'complete_committee_action', payload); }
export function createClinicalCredentialingRecord(payload: HospitalGovernancePayload) { return runHospitalGovernanceAction('Create Clinical Credentialing Record', 'create_clinical_credentialing_record', payload); }
export function updateCredentialingRecordStatus(payload: HospitalGovernancePayload) { return runHospitalGovernanceAction('Update Credentialing Record Status', 'update_credentialing_record_status', payload); }
export function markCredentialingRecordReviewed(payload: HospitalGovernancePayload) { return runHospitalGovernanceAction('Mark Credentialing Record Reviewed', 'mark_credentialing_record_reviewed', payload); }
export function createFacilityBiomedicalSafetyEvidence(payload: HospitalGovernancePayload) { return runHospitalGovernanceAction('Create Facility Biomedical Safety Evidence', 'create_facility_biomedical_safety_evidence', payload); }
export function updateFacilityBiomedicalSafetyStatus(payload: HospitalGovernancePayload) { return runHospitalGovernanceAction('Update Facility Biomedical Safety Status', 'update_facility_biomedical_safety_status', payload); }
export function markFacilityBiomedicalSafetyChecked(payload: HospitalGovernancePayload) { return runHospitalGovernanceAction('Mark Facility Biomedical Safety Checked', 'mark_facility_biomedical_safety_checked', payload); }
export function linkHospitalGovernanceItemToEvidenceBridge(payload: HospitalGovernancePayload) { return runHospitalGovernanceAction('Link Hospital Governance Item To Evidence Bridge', 'link_hospital_governance_item_to_evidence_bridge', payload); }
export function linkHospitalGovernanceItemToAccreditationClause(payload: HospitalGovernancePayload) { return runHospitalGovernanceAction('Link Hospital Governance Item To Accreditation Clause', 'link_hospital_governance_item_to_accreditation_clause', payload); }
export function recordHospitalGovernanceEvent(payload: HospitalGovernancePayload) { return runHospitalGovernanceAction('Record Hospital Governance Event', 'record_hospital_governance_event', payload); }
export function requestHospitalQualitySummary(payload: HospitalGovernancePayload) { return runHospitalGovernanceAction('Get Hospital Quality Summary', 'get_hospital_quality_summary', payload); }
export function requestDepartmentHospitalGovernanceScorecard(payload: HospitalGovernancePayload) { return runHospitalGovernanceAction('Get Department Hospital Governance Scorecard', 'get_department_hospital_governance_scorecard', payload); }
