import { invokePrivilegedAction } from './privilegedAction';
import { requireSupabase } from './supabase';
import type { MyWorkRow } from '../types/domain';
import type {
  Ui7ApprovalDecision,
  Ui7ApprovalDelegation,
  Ui7ApprovalRequest,
  Ui7ApprovalRule,
  Ui7ApprovalStage,
  Ui7GovernanceTruthRow,
  Ui7SourceResult,
  Ui7WorkItem,
} from './ui7ApprovalsReportsModel';

interface Patch38WorkRow {
  source_module: string;
  work_type: string;
  work_id: string;
  work_title: string;
  work_description: string | null;
  work_status: string;
  priority: string | null;
  assigned_to_user_id: string | null;
  department_name: string | null;
  due_date: string | null;
  created_at: string | null;
  is_overdue: boolean;
  waiting_for_review: boolean;
  is_escalated: boolean;
  linked_entity_id: string | null;
  linked_entity_type: string;
}

export interface Ui7ApprovalWorkspace {
  requests: Ui7ApprovalRequest[];
  decisions: Ui7ApprovalDecision[];
  delegations: Ui7ApprovalDelegation[];
  rules: Ui7ApprovalRule[];
  stages: Ui7ApprovalStage[];
}

export interface Ui7ReportRow {
  id?: string;
  organization_id?: string;
  department_id?: string | null;
  department_name?: string | null;
  department_name_en?: string | null;
  title?: string | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  due_date?: string | null;
  next_review_date?: string | null;
  [key: string]: unknown;
}

export interface Ui7ReportDataset {
  governance: Ui7SourceResult<Ui7GovernanceTruthRow>;
  risks: Ui7SourceResult<Ui7ReportRow>;
  compliance: Ui7SourceResult<Ui7ReportRow>;
  complianceRemediation: Ui7SourceResult<Ui7ReportRow>;
  audit: Ui7SourceResult<Ui7ReportRow>;
  capa: Ui7SourceResult<Ui7ReportRow>;
  capaEffectiveness: Ui7SourceResult<Ui7ReportRow>;
  training: Ui7SourceResult<Ui7ReportRow>;
  competency: Ui7SourceResult<Ui7ReportRow>;
  ovr: Ui7SourceResult<Ui7ReportRow>;
  projects: Ui7SourceResult<Ui7ReportRow>;
  milestones: Ui7SourceResult<Ui7ReportRow>;
  tasks: Ui7SourceResult<Ui7ReportRow>;
  evidence: Ui7SourceResult<Ui7ReportRow>;
  approvals: Ui7SourceResult<Ui7ApprovalRequest>;
  approvalHistory: Ui7SourceResult<Ui7ApprovalDecision>;
  loadedAt: string;
}

const COMPLETED_WORK = new Set(['approved', 'cancelled', 'closed', 'completed', 'rejected', 'resolved', 'waived']);

function workRoute(sourceModule: string, sourceType: string): string | null {
  if (sourceModule === 'approval') return 'approvals';
  if (sourceModule === 'training') return 'trainingGovernance';
  if (sourceModule === 'evidence_bridge' || sourceType.includes('evidence')) return 'evidence';
  if (sourceModule === 'audit') return 'audit';
  if (sourceModule === 'capa') return 'capa';
  if (sourceModule === 'ovr') return 'ovr';
  if (sourceModule === 'document') return 'documents';
  if (sourceModule === 'risk') return 'risks';
  if (sourceModule === 'compliance') return 'compliance';
  if (sourceModule === 'project') return 'projects';
  return null;
}

function workAction(sourceModule: string, sourceType: string, waitingForReview: boolean): string {
  if (sourceModule === 'approval') return 'Review approval';
  if (sourceModule === 'training') return 'Complete training';
  if (sourceModule === 'evidence_bridge' || sourceType.includes('evidence')) return waitingForReview ? 'Verify evidence' : 'Provide evidence';
  if (sourceModule === 'audit') return waitingForReview ? 'Review response' : 'Respond to audit';
  if (sourceModule === 'capa') return 'Complete assigned action';
  if (sourceModule === 'document') return 'Acknowledge document';
  if (sourceModule === 'ovr') return 'Open investigation';
  if (sourceModule === 'risk') return 'Open risk action';
  if (sourceModule === 'compliance') return 'Open remediation';
  if (sourceModule === 'project') return 'Open task';
  return 'Open source record';
}

function normalizeWorkRow(row: Patch38WorkRow): Ui7WorkItem {
  const status = String(row.work_status || 'pending').toLowerCase();
  const completed = COMPLETED_WORK.has(status);
  const blocked = status === 'blocked';
  const route = workRoute(row.source_module, row.work_type);
  return {
    id: `${row.source_module}:${row.work_id}`,
    sourceModule: row.source_module,
    sourceType: row.work_type,
    sourceId: row.linked_entity_id ?? row.work_id,
    title: row.work_title,
    description: row.work_description,
    owner: row.department_name,
    requester: null,
    dueDate: row.due_date,
    status,
    priority: row.priority,
    severity: row.priority,
    requiredAction: workAction(row.source_module, row.work_type, row.waiting_for_review),
    route,
    createdAt: row.created_at,
    updatedAt: null,
    actionability: completed ? 'completed' : blocked ? 'blocked' : route ? 'actionable' : 'read_only',
    blockedReason: blocked ? row.work_description || 'The source workflow is blocked.' : null,
    delegated: row.source_module === 'approval' && row.is_escalated,
  };
}

function normalizeProjectWorkRow(row: MyWorkRow): Ui7WorkItem {
  const status = String(row.status || row.assignment_status || 'pending').toLowerCase();
  const completed = COMPLETED_WORK.has(status) || ['declined', 'superseded', 'cancelled'].includes(row.assignment_status);
  return {
    id: `project_assignment:${row.assignment_id}`,
    sourceModule: 'project',
    sourceType: row.item_type,
    sourceId: row.id,
    title: row.title,
    description: row.project_title || null,
    owner: row.department_name || row.departments?.name_en || row.departments?.name_ar || null,
    requester: row.assigned_by_name,
    dueDate: row.due_date,
    status,
    priority: null,
    severity: null,
    requiredAction: row.item_type === 'task' ? 'Open task' : row.item_type === 'milestone' ? 'Open milestone' : 'Open project',
    route: 'projects',
    createdAt: row.assigned_at,
    updatedAt: row.responded_at,
    actionability: completed ? 'completed' : 'actionable',
    blockedReason: null,
    delegated: false,
    assignment_id: row.assignment_id,
    assignment_status: row.assignment_status,
  };
}

export async function getUi7MyWorkQueue(): Promise<Ui7WorkItem[]> {
  const queueRequest = requireSupabase()
    .from('v_patch38_my_work_queue')
    .select('*')
    .order('due_date', { ascending: true, nullsFirst: false })
    .limit(250);
  const projectRequest = invokePrivilegedAction<MyWorkRow[]>('f1r2_list_my_work', {}).catch(() => []);
  const [{ data, error }, projectRows] = await Promise.all([queueRequest, projectRequest]);
  if (error) throw new Error(error.message);
  const normalized = [
    ...((data ?? []) as Patch38WorkRow[]).map(normalizeWorkRow),
    ...projectRows.map(normalizeProjectWorkRow),
  ];
  return [...new Map(normalized.map((row) => [`${row.sourceModule}:${row.sourceType}:${row.sourceId}`, row])).values()];
}

async function profileNames(profileIds: string[]) {
  if (!profileIds.length) return new Map<string, string>();
  const { data, error } = await requireSupabase()
    .from('profiles')
    .select('id,full_name_en,full_name_ar')
    .in('id', [...new Set(profileIds)])
    .limit(250);
  if (error) throw new Error(error.message);
  return new Map((data ?? []).map((row) => [row.id, row.full_name_en || row.full_name_ar || 'Authorized user']));
}

export async function getUi7ApprovalWorkspace(): Promise<Ui7ApprovalWorkspace> {
  const client = requireSupabase();
  const [requestsResult, decisionsResult, delegationsResult, rulesResult, stagesResult] = await Promise.all([
    client.from('approval_requests').select('*').order('requested_at', { ascending: false }).limit(250),
    client.from('v_patch27_approval_decision_history').select('*').order('decided_at', { ascending: false }).limit(500),
    client.from('v_patch27_active_approval_delegations').select('*').order('effective_to', { ascending: true }).limit(200),
    client.from('v_patch27_active_authority_rules').select('*').order('rule_name', { ascending: true }).limit(250),
    client.from('approval_request_stages').select('*').order('stage_order', { ascending: true }).limit(500),
  ]);
  const error = requestsResult.error || decisionsResult.error || delegationsResult.error || rulesResult.error || stagesResult.error;
  if (error) throw new Error(error.message);

  const requests = (requestsResult.data ?? []) as Ui7ApprovalRequest[];
  const names = await profileNames(requests.map((row) => row.requested_by).filter((id): id is string => Boolean(id)));
  requests.forEach((row) => { row.requester_name = row.requested_by ? names.get(row.requested_by) ?? null : null; });
  return {
    requests,
    decisions: (decisionsResult.data ?? []) as Ui7ApprovalDecision[],
    delegations: (delegationsResult.data ?? []) as Ui7ApprovalDelegation[],
    rules: (rulesResult.data ?? []) as Ui7ApprovalRule[],
    stages: (stagesResult.data ?? []) as Ui7ApprovalStage[],
  };
}

export function decideUi7Approval(input: {
  approvalRequestId: string;
  decision: 'approved' | 'rejected' | 'returned';
  note: string;
}) {
  return invokePrivilegedAction<{ approval_request_id: string; request_status: string }>('ui7_record_approval_decision', {
    approval_request_id: input.approvalRequestId,
    decision: input.decision,
    decision_note: input.note,
  });
}

export function finalizeUi7GovernedDocumentApproval(input: {
  versionId: string;
  note: string;
}) {
  return invokePrivilegedAction<{ document_id: string; version_id: string; status: string }>(
    'v14e1r_finalize_governed_document_approval',
    {
      version_id: input.versionId,
      approval_note: input.note.trim() || null,
    },
  );
}

async function reportSource<T extends Ui7ReportRow | Ui7GovernanceTruthRow | Ui7ApprovalRequest | Ui7ApprovalDecision>(
  table: string,
  order: string,
  limit: number,
): Promise<Ui7SourceResult<T>> {
  try {
    const { data, error } = await requireSupabase()
      .from(table)
      .select('*')
      .order(order, { ascending: false, nullsFirst: false })
      .limit(limit);
    if (error) throw error;
    return { rows: (data ?? []) as T[], available: true, message: null };
  } catch (error) {
    return {
      rows: [],
      available: false,
      message: error instanceof Error ? error.message : `Unable to read ${table}.`,
    };
  }
}

export async function getUi7ReportDataset(): Promise<Ui7ReportDataset> {
  const [
    governance, risks, compliance, complianceRemediation, audit, capa, capaEffectiveness,
    training, competency, ovr, projects, milestones, tasks, evidence, approvals, approvalHistory,
  ] = await Promise.all([
    reportSource<Ui7GovernanceTruthRow>('v_confirmed_governance_criteria_truth', 'created_at', 500),
    reportSource<Ui7ReportRow>('risks', 'updated_at', 250),
    reportSource<Ui7ReportRow>('v_ui3_compliance_obligation_register', 'next_review_date', 250),
    reportSource<Ui7ReportRow>('compliance_remediation_actions', 'created_at', 250),
    reportSource<Ui7ReportRow>('audit_findings', 'created_at', 250),
    reportSource<Ui7ReportRow>('v_patch28_capa_register', 'updated_at', 250),
    reportSource<Ui7ReportRow>('capa_effectiveness_reviews', 'created_at', 250),
    reportSource<Ui7ReportRow>('v_patch29_training_assignment_queue', 'assigned_at', 250),
    reportSource<Ui7ReportRow>('v_patch29_competency_gap_dashboard', 'assessed_at', 250),
    reportSource<Ui7ReportRow>('ovr_reports', 'created_at', 250),
    reportSource<Ui7ReportRow>('projects', 'updated_at', 250),
    reportSource<Ui7ReportRow>('milestones', 'updated_at', 250),
    reportSource<Ui7ReportRow>('tasks', 'updated_at', 250),
    reportSource<Ui7ReportRow>('v_patch23_evidence_review_queue', 'created_at', 250),
    reportSource<Ui7ApprovalRequest>('approval_requests', 'requested_at', 250),
    reportSource<Ui7ApprovalDecision>('v_patch27_approval_decision_history', 'decided_at', 500),
  ]);
  return {
    governance, risks, compliance, complianceRemediation, audit, capa, capaEffectiveness,
    training, competency, ovr, projects, milestones, tasks, evidence, approvals, approvalHistory,
    loadedAt: new Date().toISOString(),
  };
}
