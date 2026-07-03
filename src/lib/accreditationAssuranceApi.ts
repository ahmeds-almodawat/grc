import { supabase } from './supabase';
import { invokePrivilegedAction } from './privilegedAction';
import {
  configurationErrorResult,
  emptyResult,
  liveResult,
  queryErrorResult,
  type LiveResult,
} from './liveResult';

type AssurancePayload = Record<string, unknown>;

export type EvidenceGateStatus =
  | 'pass'
  | 'fail_missing_evidence'
  | 'fail_rejected_evidence'
  | 'fail_expired_evidence'
  | 'fail_superseded_evidence'
  | 'waived'
  | 'not_required'
  | 'requires_review'
  | string;

export interface AccreditationWarRoomRow {
  clause_count?: number | null;
  ready_clause_count?: number | null;
  evidence_gap_count?: number | null;
  gate_failure_count?: number | null;
  active_waiver_count?: number | null;
  total_blocker_count?: number | null;
  mock_survey_finding_count?: number | null;
  department_readiness_score?: number | null;
  readiness_signal?: string | null;
  overall_readiness_score?: number | null;
  latest_snapshot_at?: string | null;
  [key: string]: unknown;
}

export interface ClauseReadinessRow {
  clause_id?: string | null;
  framework?: string | null;
  standard_code?: string | null;
  clause_code?: string | null;
  clause_title?: string | null;
  bridge_link_count?: number | null;
  accepted_current_count?: number | null;
  evidence_gap_count?: number | null;
  readiness_status?: string | null;
  workflow_blocker_count?: number | null;
  workflow_evidence_blocker_count?: number | null;
  dependency_link_count?: number | null;
  open_escalation_count?: number | null;
  gate_status?: EvidenceGateStatus | null;
  missing_evidence_count?: number | null;
  evaluated_at?: string | null;
  [key: string]: unknown;
}

export interface DepartmentReadinessRow {
  department_id?: string | null;
  department_name?: string | null;
  bridge_link_count?: number | null;
  ready_evidence_count?: number | null;
  evidence_gap_count?: number | null;
  evidence_readiness_score?: number | null;
  open_task_count?: number | null;
  overdue_task_count?: number | null;
  high_priority_task_count?: number | null;
  pending_review_count?: number | null;
  readiness_signal?: string | null;
  [key: string]: unknown;
}

export interface EvidenceGapRow {
  bridge_link_id?: string | null;
  clause_id?: string | null;
  clause_code?: string | null;
  clause_title?: string | null;
  linked_entity_type?: string | null;
  linked_entity_id?: string | null;
  evidence_status?: string | null;
  freshness_status?: string | null;
  owner_name?: string | null;
  department_name?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
}

export interface EvidenceGateFailureRow {
  id?: string;
  entity_type?: string | null;
  entity_id?: string | null;
  gate_status?: EvidenceGateStatus | null;
  gate_name?: string | null;
  required_evidence_type?: string | null;
  severity?: string | null;
  accepted_evidence_count?: number | null;
  missing_evidence_count?: number | null;
  rejected_evidence_count?: number | null;
  expired_evidence_count?: number | null;
  superseded_evidence_count?: number | null;
  evaluated_at?: string | null;
  [key: string]: unknown;
}

export interface EvidenceWaiverRow {
  waiver_id?: string;
  entity_type?: string | null;
  entity_id?: string | null;
  waiver_reason?: string | null;
  waiver_status?: string | null;
  requested_by_name?: string | null;
  requested_at?: string | null;
  approved_by_name?: string | null;
  approved_at?: string | null;
  expires_on?: string | null;
  audit_note?: string | null;
  [key: string]: unknown;
}

export interface SurveyBlockerRow {
  blocker_type?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  blocker_status?: string | null;
  blocker_summary?: string | null;
  created_at?: string | null;
  [key: string]: unknown;
}

export interface EvidenceChainRow {
  bridge_link_id?: string | null;
  linked_entity_type?: string | null;
  linked_entity_id?: string | null;
  evidence_id?: string | null;
  evidence_status?: string | null;
  freshness_status?: string | null;
  owner_name?: string | null;
  department_name?: string | null;
  valid_until?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
}

export interface QueueEvidenceGateOverlayRow {
  queue_item_id?: string;
  source_module?: string | null;
  source_entity_type?: string | null;
  source_entity_id?: string | null;
  title?: string | null;
  work_status?: string | null;
  priority?: string | null;
  severity?: string | null;
  due_date?: string | null;
  gate_status?: EvidenceGateStatus | null;
  accepted_evidence_count?: number | null;
  missing_evidence_count?: number | null;
  active_waiver_id?: string | null;
  evaluated_at?: string | null;
  evidence_gate_next_action?: string | null;
  [key: string]: unknown;
}

async function selectPatch43View<T>(
  viewName: string,
  options: { order?: string; ascending?: boolean; limit?: number } = {},
): Promise<LiveResult<T[]>> {
  if (!supabase) {
    return configurationErrorResult<T[]>('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to load live accreditation assurance data.');
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

export const accreditationAssuranceApi = {
  getAccreditationWarRoom(): Promise<LiveResult<AccreditationWarRoomRow[]>> {
    return selectPatch43View<AccreditationWarRoomRow>('v_patch43_accreditation_war_room', { limit: 1 });
  },

  getClauseReadinessRegister(): Promise<LiveResult<ClauseReadinessRow[]>> {
    return selectPatch43View<ClauseReadinessRow>('v_patch43_clause_readiness_register', { order: 'clause_code', limit: 250 });
  },

  getDepartmentReadinessRegister(): Promise<LiveResult<DepartmentReadinessRow[]>> {
    return selectPatch43View<DepartmentReadinessRow>('v_patch43_department_readiness_register', { order: 'department_name', limit: 250 });
  },

  getEvidenceGapRegister(): Promise<LiveResult<EvidenceGapRow[]>> {
    return selectPatch43View<EvidenceGapRow>('v_patch43_evidence_gap_register', { order: 'updated_at', ascending: false, limit: 250 });
  },

  getEvidenceGateFailureRegister(): Promise<LiveResult<EvidenceGateFailureRow[]>> {
    return selectPatch43View<EvidenceGateFailureRow>('v_patch43_evidence_gate_failure_register', { order: 'evaluated_at', ascending: false, limit: 250 });
  },

  getEvidenceWaiverRegister(): Promise<LiveResult<EvidenceWaiverRow[]>> {
    return selectPatch43View<EvidenceWaiverRow>('v_patch43_evidence_waiver_register', { order: 'requested_at', ascending: false, limit: 250 });
  },

  getMockSurveyFindingRegister(): Promise<LiveResult<SurveyBlockerRow[]>> {
    return selectPatch43View<SurveyBlockerRow>('v_patch43_mock_survey_finding_register', { order: 'due_date', limit: 250 });
  },

  getIncidentEvidenceChain(): Promise<LiveResult<EvidenceChainRow[]>> {
    return selectPatch43View<EvidenceChainRow>('v_patch43_incident_evidence_chain', { order: 'updated_at', ascending: false, limit: 250 });
  },

  getAuditEvidenceChain(): Promise<LiveResult<EvidenceChainRow[]>> {
    return selectPatch43View<EvidenceChainRow>('v_patch43_audit_evidence_chain', { order: 'updated_at', ascending: false, limit: 250 });
  },

  getCapaEvidenceChain(): Promise<LiveResult<EvidenceChainRow[]>> {
    return selectPatch43View<EvidenceChainRow>('v_patch43_capa_evidence_chain', { order: 'updated_at', ascending: false, limit: 250 });
  },

  getTrainingDocumentEvidenceChain(): Promise<LiveResult<EvidenceChainRow[]>> {
    return selectPatch43View<EvidenceChainRow>('v_patch43_training_document_evidence_chain', { order: 'updated_at', ascending: false, limit: 250 });
  },

  getSurveyBlockerSummary(): Promise<LiveResult<SurveyBlockerRow[]>> {
    return selectPatch43View<SurveyBlockerRow>('v_patch43_survey_blocker_summary', { order: 'created_at', ascending: false, limit: 250 });
  },

  getExecutiveSurveyReadinessSummary(): Promise<LiveResult<AccreditationWarRoomRow[]>> {
    return selectPatch43View<AccreditationWarRoomRow>('v_patch43_executive_survey_readiness_summary', { limit: 1 });
  },

  getQueueEvidenceGateOverlay(): Promise<LiveResult<QueueEvidenceGateOverlayRow[]>> {
    return selectPatch43View<QueueEvidenceGateOverlayRow>('v_patch43_queue_evidence_gate_overlay', { order: 'due_date', limit: 250 });
  },

  evaluateEvidenceGate(payload: AssurancePayload): Promise<unknown> {
    return invokePrivilegedAction('evaluate_evidence_gate', payload);
  },

  evaluateEvidenceGateForEntity(payload: AssurancePayload): Promise<unknown> {
    return invokePrivilegedAction('evaluate_evidence_gate_for_entity', payload);
  },

  requestEvidenceGateWaiver(payload: AssurancePayload): Promise<unknown> {
    return invokePrivilegedAction('request_evidence_gate_waiver', payload);
  },

  approveEvidenceGateWaiver(payload: AssurancePayload): Promise<unknown> {
    return invokePrivilegedAction('approve_evidence_gate_waiver', payload);
  },

  rejectEvidenceGateWaiver(payload: AssurancePayload): Promise<unknown> {
    return invokePrivilegedAction('reject_evidence_gate_waiver', payload);
  },

  revokeEvidenceGateWaiver(payload: AssurancePayload): Promise<unknown> {
    return invokePrivilegedAction('revoke_evidence_gate_waiver', payload);
  },

  recordSurveyReadinessEvent(payload: AssurancePayload): Promise<unknown> {
    return invokePrivilegedAction('record_survey_readiness_event', payload);
  },

  createAccreditationWarRoomSnapshot(payload: AssurancePayload): Promise<unknown> {
    return invokePrivilegedAction('create_accreditation_war_room_snapshot', payload);
  },
};
