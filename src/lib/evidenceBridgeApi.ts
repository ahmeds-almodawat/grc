import { supabase } from './supabase';
import { invokePrivilegedAction, throwRpcActionError } from './privilegedAction';
import {
  configurationErrorResult,
  emptyResult,
  liveResult,
  queryErrorResult,
  type LiveResult,
} from './liveResult';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type EvidenceBridgeStatus =
  | 'missing'
  | 'pending_collection'
  | 'pending_review'
  | 'accepted'
  | 'rejected'
  | 'stale'
  | 'expired'
  | 'not_applicable'
  | string;

export type EvidenceBridgePriority = 'low' | 'medium' | 'high' | 'critical' | string;
export type EvidenceBridgeReadiness =
  | 'ready'
  | 'partial_gap'
  | 'major_gap'
  | 'pending_evidence'
  | 'pending_owner_review'
  | string;

export interface EvidenceBridgeRow {
  bridge_link_id?: string;
  id?: string;
  clause_id?: string | null;
  clause_code?: string | null;
  clause_title?: string | null;
  framework?: string | null;
  standard_code?: string | null;
  control_id?: string | null;
  evidence_id?: string | null;
  document_id?: string | null;
  sop_id?: string | null;
  linked_entity_type?: string | null;
  linked_entity_id?: string | null;
  bridge_role?: string | null;
  evidence_status?: EvidenceBridgeStatus | null;
  freshness_status?: string | null;
  valid_from?: string | null;
  valid_until?: string | null;
  owner_user_id?: string | null;
  owner_name?: string | null;
  department_id?: string | null;
  department_name?: string | null;
  active?: boolean | null;
  updated_at?: string | null;
  [key: string]: unknown;
}

export interface EvidenceCollectionQueueRow extends EvidenceBridgeRow {
  request_title?: string | null;
  request_description?: string | null;
  status?: string | null;
  priority?: EvidenceBridgePriority | null;
  due_date?: string | null;
  assigned_department_name?: string | null;
  assigned_user_name?: string | null;
  is_overdue?: boolean | null;
}

export interface EvidenceReadinessRow extends EvidenceBridgeRow {
  bridge_link_count?: number | null;
  ready_evidence_count?: number | null;
  accepted_current_count?: number | null;
  gap_count?: number | null;
  evidence_gap_count?: number | null;
  evidence_readiness_score?: number | null;
  live_evidence_readiness_score?: number | null;
  readiness_status?: EvidenceBridgeReadiness | null;
}

export interface ExecutiveEvidenceBridgeSummaryRow {
  total_bridge_links?: number | null;
  clauses_with_bridge_links?: number | null;
  ready_links?: number | null;
  gap_links?: number | null;
  stale_or_expired_links?: number | null;
  dependency_links?: number | null;
  overall_evidence_readiness_score?: number | null;
  [key: string]: unknown;
}

export interface EvidenceBridgeActionResult {
  id?: string;
  status?: string;
  result?: JsonValue;
  [key: string]: unknown;
}

type EvidenceBridgeActionPayload = Record<string, unknown>;

async function selectPatch33View<T>(
  viewName: string,
  options: { order?: string; ascending?: boolean; limit?: number } = {},
): Promise<LiveResult<T[]>> {
  if (!supabase) {
    return configurationErrorResult<T[]>(
      'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to load live evidence bridge data.',
    );
  }

  try {
    let query = supabase.from(viewName).select('*');

    if (options.order) {
      query = query.order(options.order, { ascending: options.ascending ?? true });
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      return queryErrorResult<T[]>(error, `Unable to load ${viewName}.`);
    }

    if (!data || data.length === 0) {
      return emptyResult<T[]>(`No records returned from ${viewName}.`);
    }

    return liveResult(data as T[], 'supabase');
  } catch (error) {
    return queryErrorResult<T[]>(error, `Unexpected error while loading ${viewName}.`);
  }
}

async function runEvidenceBridgeAction(
  action: string,
  rpcName: string,
  payload: EvidenceBridgeActionPayload,
): Promise<EvidenceBridgeActionResult> {
  try {
    return await invokePrivilegedAction<EvidenceBridgeActionResult>(rpcName, payload);
  } catch (error) {
    return throwRpcActionError(error, action, rpcName);
  }
}

export function getClauseControlEvidenceBridge(): Promise<LiveResult<EvidenceBridgeRow[]>> {
  return selectPatch33View<EvidenceBridgeRow>('v_patch33_clause_control_evidence_bridge', {
    order: 'updated_at',
    ascending: false,
    limit: 250,
  });
}

export function getLiveEvidenceGapRegister(): Promise<LiveResult<EvidenceBridgeRow[]>> {
  return selectPatch33View<EvidenceBridgeRow>('v_patch33_live_evidence_gap_register', {
    order: 'updated_at',
    ascending: false,
    limit: 250,
  });
}

export function getEvidenceCollectionQueue(): Promise<LiveResult<EvidenceCollectionQueueRow[]>> {
  return selectPatch33View<EvidenceCollectionQueueRow>('v_patch33_evidence_collection_queue', {
    order: 'due_date',
    ascending: true,
    limit: 250,
  });
}

export function getOverdueEvidenceRequests(): Promise<LiveResult<EvidenceCollectionQueueRow[]>> {
  return selectPatch33View<EvidenceCollectionQueueRow>('v_patch33_overdue_evidence_requests', {
    order: 'due_date',
    ascending: true,
    limit: 250,
  });
}

export function getStaleExpiredEvidenceRegister(): Promise<LiveResult<EvidenceBridgeRow[]>> {
  return selectPatch33View<EvidenceBridgeRow>('v_patch33_stale_expired_evidence_register', {
    order: 'valid_until',
    ascending: true,
    limit: 250,
  });
}

export function getEvidenceReviewQueue(): Promise<LiveResult<EvidenceCollectionQueueRow[]>> {
  return selectPatch33View<EvidenceCollectionQueueRow>('v_patch33_evidence_review_queue', {
    order: 'created_at',
    ascending: true,
    limit: 250,
  });
}

export function getDepartmentEvidenceReadiness(): Promise<LiveResult<EvidenceReadinessRow[]>> {
  return selectPatch33View<EvidenceReadinessRow>('v_patch33_department_evidence_readiness', {
    order: 'evidence_readiness_score',
    ascending: true,
    limit: 250,
  });
}

export function getClauseEvidenceReadiness(): Promise<LiveResult<EvidenceReadinessRow[]>> {
  return selectPatch33View<EvidenceReadinessRow>('v_patch33_clause_evidence_readiness', {
    order: 'evidence_gap_count',
    ascending: false,
    limit: 250,
  });
}

export function getEvidenceDependencies(): Promise<LiveResult<EvidenceBridgeRow[]>> {
  return selectPatch33View<EvidenceBridgeRow>('v_patch33_capa_training_sop_evidence_dependencies', {
    order: 'updated_at',
    ascending: false,
    limit: 250,
  });
}

export function getAccreditationLiveReadinessSummary(): Promise<LiveResult<EvidenceReadinessRow[]>> {
  return selectPatch33View<EvidenceReadinessRow>('v_patch33_accreditation_live_readiness_summary', {
    order: 'live_evidence_readiness_score',
    ascending: true,
    limit: 100,
  });
}

export function getEvidenceExceptionRegister(): Promise<LiveResult<EvidenceBridgeRow[]>> {
  return selectPatch33View<EvidenceBridgeRow>('v_patch33_evidence_exception_register', {
    order: 'updated_at',
    ascending: false,
    limit: 250,
  });
}

export function getExecutiveEvidenceBridgeSummary(): Promise<LiveResult<ExecutiveEvidenceBridgeSummaryRow[]>> {
  return selectPatch33View<ExecutiveEvidenceBridgeSummaryRow>('v_patch33_executive_evidence_bridge_summary', {
    limit: 1,
  });
}

export function createEvidenceBridgeLink(payload: EvidenceBridgeActionPayload): Promise<EvidenceBridgeActionResult> {
  return runEvidenceBridgeAction('Create Evidence Bridge Link', 'create_evidence_bridge_link', payload);
}

export function updateEvidenceBridgeStatus(payload: EvidenceBridgeActionPayload): Promise<EvidenceBridgeActionResult> {
  return runEvidenceBridgeAction('Update Evidence Bridge Status', 'update_evidence_bridge_status', payload);
}

export function createEvidenceCollectionRequest(payload: EvidenceBridgeActionPayload): Promise<EvidenceBridgeActionResult> {
  return runEvidenceBridgeAction('Create Evidence Collection Request', 'create_evidence_collection_request', payload);
}

export function submitEvidenceCollectionRequest(payload: EvidenceBridgeActionPayload): Promise<EvidenceBridgeActionResult> {
  return runEvidenceBridgeAction('Submit Evidence Collection Request', 'submit_evidence_collection_request', payload);
}

export function reviewEvidenceBridgeSubmission(payload: EvidenceBridgeActionPayload): Promise<EvidenceBridgeActionResult> {
  return runEvidenceBridgeAction('Review Evidence Bridge Submission', 'review_evidence_bridge_submission', payload);
}

export function acceptEvidenceBridgeSubmission(payload: EvidenceBridgeActionPayload): Promise<EvidenceBridgeActionResult> {
  return runEvidenceBridgeAction('Accept Evidence Bridge Submission', 'accept_evidence_bridge_submission', payload);
}

export function rejectEvidenceBridgeSubmission(payload: EvidenceBridgeActionPayload): Promise<EvidenceBridgeActionResult> {
  return runEvidenceBridgeAction('Reject Evidence Bridge Submission', 'reject_evidence_bridge_submission', payload);
}

export function waiveEvidenceCollectionRequest(payload: EvidenceBridgeActionPayload): Promise<EvidenceBridgeActionResult> {
  return runEvidenceBridgeAction('Waive Evidence Collection Request', 'waive_evidence_collection_request', payload);
}

export function reopenEvidenceCollectionRequest(payload: EvidenceBridgeActionPayload): Promise<EvidenceBridgeActionResult> {
  return runEvidenceBridgeAction('Reopen Evidence Collection Request', 'reopen_evidence_collection_request', payload);
}

export function markEvidenceBridgeNotApplicable(payload: EvidenceBridgeActionPayload): Promise<EvidenceBridgeActionResult> {
  return runEvidenceBridgeAction('Mark Evidence Bridge Not Applicable', 'mark_evidence_bridge_not_applicable', payload);
}

export function refreshEvidenceFreshnessStatus(payload: EvidenceBridgeActionPayload): Promise<EvidenceBridgeActionResult> {
  return runEvidenceBridgeAction('Refresh Evidence Freshness Status', 'refresh_evidence_freshness_status', payload);
}
