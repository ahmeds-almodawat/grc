import { invokePrivilegedAction } from './privilegedAction';
import { requireSupabase } from './supabase';

export interface Ui4AuditCriteriaContract {
  organization_id: string;
  audit_finding_id: string;
  finding_code: string | null;
  finding_classification: 'formal_finding' | 'advisory_observation';
  finding_date: string;
  audit_period_end_date: string | null;
  criteria_resolution_date: string;
  confirmed_criterion_count: number;
  dispute_count: number;
  criterion_gate_satisfied: boolean;
}

export interface Ui4AuditCriteriaDispute {
  id: string;
  organization_id: string;
  audit_finding_id: string;
  governance_link_id: string | null;
  dispute_type: 'criterion_dispute' | 'scope_correction' | 'version_correction' | 'applicability_correction' | 'evidence_response';
  dispute_statement: string;
  proposed_correction: string | null;
  evidence_reference: string | null;
  created_by: string;
  created_at: string;
}

export interface Ui4CapaRecord {
  id: string;
  organization_id: string;
  capa_code: string | null;
  capa_title: string;
  capa_description: string | null;
  capa_type: string;
  source_type: string;
  source_id: string | null;
  source_reference: string | null;
  department_id: string | null;
  department_name: string | null;
  capa_owner_id: string | null;
  capa_owner_name: string | null;
  action_owner_id: string | null;
  action_owner_name: string | null;
  reviewer_id: string | null;
  reviewer_name: string | null;
  approver_id: string | null;
  approver_name: string | null;
  validator_id: string | null;
  effectiveness_reviewer_id: string | null;
  severity_level: string | null;
  risk_level: string | null;
  priority_level: string | null;
  root_cause_category: string | null;
  root_cause_summary: string | null;
  containment_summary: string | null;
  correction_summary: string | null;
  corrective_action_summary: string | null;
  preventive_action_summary: string | null;
  capa_status: string;
  workflow_stage: string | null;
  due_date: string | null;
  revised_due_date: string | null;
  completion_due_date: string | null;
  started_at: string | null;
  completed_at: string | null;
  completion_submitted_at: string | null;
  validation_required: boolean;
  validation_status: string | null;
  validation_note: string | null;
  validation_rejection_reason: string | null;
  effectiveness_review_required: boolean;
  effectiveness_review_due_date: string | null;
  effectiveness_review_status: string | null;
  effectiveness_review_completed_at: string | null;
  evidence_required: boolean;
  minimum_accepted_evidence_count: number;
  evidence_gate_status: string | null;
  action_item_count: number;
  completed_action_item_count: number;
  closure_requested_at: string | null;
  closed_at: string | null;
  closure_rejection_reason: string | null;
  closure_blocker: string | null;
  overdue_flag: boolean;
  overdue_days: number;
  escalation_required: boolean;
  executive_visible: boolean;
  repeat_issue_flag: boolean;
  reopen_reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Ui4CapaActionItem {
  id: string;
  capa_id: string;
  action_item_code: string | null;
  action_item_title: string;
  action_item_description: string | null;
  action_owner_id: string | null;
  department_id: string | null;
  priority_level: string | null;
  due_date: string | null;
  status: string;
  progress_percent: number;
  completion_note: string | null;
  completed_at: string | null;
  evidence_required: boolean;
  evidence_gate_status: string | null;
  created_at: string;
  updated_at: string;
}

export interface Ui4CapaEvent {
  id: string;
  capa_id: string;
  action_item_id: string | null;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  actor_id: string | null;
  event_note: string | null;
  rejection_reason: string | null;
  created_at: string;
}

export interface Ui4CapaEffectivenessReview {
  id: string;
  capa_id: string;
  review_due_date: string | null;
  reviewer_id: string | null;
  review_method: string | null;
  review_result: string;
  review_note: string | null;
  evidence_required: boolean;
  completed_at: string | null;
  created_at: string;
}

export interface Ui4CapaClosureBlocker {
  organization_id: string;
  capa_id: string;
  capa_code: string | null;
  capa_title: string;
  capa_status: string;
  has_incomplete_action_items: boolean;
  has_evidence_blocker: boolean;
  has_validation_blocker: boolean;
  has_effectiveness_blocker: boolean;
  blocker_reason: string | null;
  can_close: boolean;
}

export interface Ui4CapaLink {
  link_id: string;
  organization_id: string;
  capa_id: string;
  capa_code: string | null;
  capa_title: string;
  linked_item_type: string;
  linked_item_id: string | null;
  link_type: string | null;
  required_flag: boolean;
  created_by: string | null;
  created_at: string;
}

export interface Ui4CapaDetail {
  actions: Ui4CapaActionItem[];
  events: Ui4CapaEvent[];
  effectivenessReviews: Ui4CapaEffectivenessReview[];
  blocker: Ui4CapaClosureBlocker | null;
  links: Ui4CapaLink[];
}

export async function getUi4AuditCriteriaContracts(): Promise<Ui4AuditCriteriaContract[]> {
  const { data, error } = await requireSupabase()
    .from('v_ui4_audit_criteria_contract')
    .select('*')
    .order('finding_date', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Ui4AuditCriteriaContract[];
}

export async function getUi4AuditCriteriaDisputes(auditFindingId: string): Promise<Ui4AuditCriteriaDispute[]> {
  const { data, error } = await requireSupabase()
    .from('audit_finding_criteria_disputes')
    .select('*')
    .eq('audit_finding_id', auditFindingId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Ui4AuditCriteriaDispute[];
}

export async function getUi4CapaRegister(): Promise<Ui4CapaRecord[]> {
  const { data, error } = await requireSupabase()
    .from('v_patch28_capa_register')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(250);
  if (error) throw new Error(error.message);
  return (data ?? []) as Ui4CapaRecord[];
}

export async function getUi4CapaDetail(capaId: string): Promise<Ui4CapaDetail> {
  const client = requireSupabase();
  const [actions, events, reviews, blockers, links] = await Promise.all([
    client.from('capa_action_items').select('*').eq('capa_id', capaId).order('created_at', { ascending: true }),
    client.from('capa_events').select('*').eq('capa_id', capaId).order('created_at', { ascending: false }),
    client.from('capa_effectiveness_reviews').select('*').eq('capa_id', capaId).order('created_at', { ascending: false }),
    client.from('v_patch28_capa_closure_blockers').select('*').eq('capa_id', capaId).maybeSingle(),
    client.from('v_patch28_capa_link_index').select('*').eq('capa_id', capaId).order('created_at', { ascending: true }),
  ]);
  const error = actions.error || events.error || reviews.error || blockers.error || links.error;
  if (error) throw new Error(error.message);
  return {
    actions: (actions.data ?? []) as Ui4CapaActionItem[],
    events: (events.data ?? []) as Ui4CapaEvent[],
    effectivenessReviews: (reviews.data ?? []) as Ui4CapaEffectivenessReview[],
    blocker: (blockers.data ?? null) as Ui4CapaClosureBlocker | null,
    links: (links.data ?? []) as Ui4CapaLink[],
  };
}

async function runUi4Action<T>(action: string, payload: Record<string, unknown>): Promise<T> {
  return invokePrivilegedAction<T>(action, payload);
}

export function recordUi4AuditCriteriaDispute(input: {
  auditFindingId: string;
  governanceLinkId?: string | null;
  disputeType?: Ui4AuditCriteriaDispute['dispute_type'];
  disputeStatement: string;
  proposedCorrection?: string | null;
  evidenceReference?: string | null;
}) {
  return runUi4Action<{ dispute_id: string; status: string }>('ui4_record_audit_criteria_dispute', {
    audit_finding_id: input.auditFindingId,
    governance_link_id: input.governanceLinkId ?? null,
    dispute_type: input.disputeType ?? 'criterion_dispute',
    dispute_statement: input.disputeStatement,
    proposed_correction: input.proposedCorrection ?? null,
    evidence_reference: input.evidenceReference ?? null,
  });
}

export function createUi4Capa(payload: Record<string, unknown>) {
  return runUi4Action<{ capa_id: string; status: string; inheritance: Record<string, unknown> }>('ui4_create_capa', payload);
}

export function runUi4CapaWorkflowAction(action: string, capaId: string, payload: Record<string, unknown> = {}) {
  return runUi4Action<Record<string, unknown>>(action, { capa_id: capaId, ...payload });
}

export function createUi4CapaActionItem(capaId: string, payload: Record<string, unknown>) {
  return runUi4Action<{ action_item_id: string; status: string }>('ui4_create_capa_action_item', { capa_id: capaId, ...payload });
}

export function updateUi4CapaActionItem(actionItemId: string, status: string, note?: string) {
  return runUi4Action<Record<string, unknown>>('ui4_update_capa_action_item', {
    action_item_id: actionItemId,
    status,
    note: note ?? null,
  });
}

