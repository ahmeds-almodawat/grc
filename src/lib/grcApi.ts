import { supabase } from './supabase';
import { emptyLiveObject, emptyLiveArray } from './liveData';
import { invokePrivilegedAction, requireServerBridge } from './privilegedAction';
const liveEmptyAccessControlSummary: any = emptyLiveObject<any>('src/lib/grcApi.ts.liveEmptyAccessControlSummary');
const liveEmptyExecutiveSummary: any = emptyLiveObject<any>('src/lib/grcApi.ts.liveEmptyExecutiveSummary');
const liveEmptyExportCenterSummary: any = emptyLiveObject<any>('src/lib/grcApi.ts.liveEmptyExportCenterSummary');
const liveEmptyGrcKpiScorecard: any = emptyLiveObject<any>('src/lib/grcApi.ts.liveEmptyGrcKpiScorecard');
const liveEmptyManagementControlSummary: any = emptyLiveObject<any>('src/lib/grcApi.ts.liveEmptyManagementControlSummary');
const liveEmptyOvrSummary: any = emptyLiveObject<any>('src/lib/grcApi.ts.liveEmptyOvrSummary');
const liveEmptyOvrRiskIndicatorSummary: any = emptyLiveObject<any>('src/lib/grcApi.ts.liveEmptyOvrRiskIndicatorSummary');
const liveEmptyAccessControlWarnings: any[] = emptyLiveArray<any>();
const liveEmptyAccessControlUsers: any[] = emptyLiveArray<any>();
const liveEmptyApprovals: any[] = emptyLiveArray<any>();
const liveEmptyAuditFindings: any[] = emptyLiveArray<any>();
const liveEmptyAuditFindingWorkflowQueue: any[] = emptyLiveArray<any>();
const liveEmptyOverdueAuditFindings: any[] = emptyLiveArray<any>();
const liveEmptyRepeatAuditFindings: any[] = emptyLiveArray<any>();
const liveEmptyAuditClosureGateStatus: any[] = emptyLiveArray<any>();
const liveEmptyAuditExecutiveEscalations: any[] = emptyLiveArray<any>();
const liveEmptyAuditClosurePackIndex: any[] = emptyLiveArray<any>();
const liveEmptyAuditFindingValidationEvents: any[] = emptyLiveArray<any>();
const liveEmptyCompliance: any[] = emptyLiveArray<any>();
const liveEmptyCriticalItems: any[] = emptyLiveArray<any>();
const liveEmptyCustomReports: any[] = emptyLiveArray<any>();
const liveEmptyDecisions: any[] = emptyLiveArray<any>();
const liveEmptyDelayReasonQueue: any[] = emptyLiveArray<any>();
const liveEmptyDepartments: any[] = emptyLiveArray<any>();
const liveEmptyEvidence: any[] = emptyLiveArray<any>();
const liveEmptyEvidenceReviewQueue: any[] = emptyLiveArray<any>();
const liveEmptyEvidenceGapDashboard: any[] = emptyLiveArray<any>();
const liveEmptyEvidenceClosureGateStatus: any[] = emptyLiveArray<any>();
const liveEmptyEvidenceChainOfCustody: any[] = emptyLiveArray<any>();
const liveEmptyEvidencePackIndex: any[] = emptyLiveArray<any>();
const liveEmptySensitiveEvidenceRegister: any[] = emptyLiveArray<any>();
const liveEmptyEscalations: any[] = emptyLiveArray<any>();
const liveEmptyDepartmentRiskHeatmap: any[] = emptyLiveArray<any>();
const liveEmptyMonthlyGrcTrend: any[] = emptyLiveArray<any>();
const liveEmptyRadarControlProfile: any[] = emptyLiveArray<any>();
const liveEmptyMilestones: any[] = emptyLiveArray<any>();
const liveEmptyMyWork: any[] = emptyLiveArray<any>();
const liveEmptyOvrReports: any[] = emptyLiveArray<any>();
const liveEmptyOvrRiskDepartmentIndicators: any[] = emptyLiveArray<any>();
const liveEmptyOvrRepeatedCategoryAlerts: any[] = emptyLiveArray<any>();
const liveEmptyProfiles: any[] = emptyLiveArray<any>();
const liveEmptyProjects: any[] = emptyLiveArray<any>();
const liveEmptyRisks: any[] = emptyLiveArray<any>();
const liveEmptyRiskWorkflowQueue: any[] = emptyLiveArray<any>();
const liveEmptyRiskAppetiteBreaches: any[] = emptyLiveArray<any>();
const liveEmptyRiskTreatmentQueue: any[] = emptyLiveArray<any>();
const liveEmptyRiskKriAlerts: any[] = emptyLiveArray<any>();
const liveEmptyExecutiveRiskEscalations: any[] = emptyLiveArray<any>();
const liveEmptyRiskClosureBlockers: any[] = emptyLiveArray<any>();
const liveEmptyRiskReassessmentHistory: any[] = emptyLiveArray<any>();
const liveEmptyRiskWorkflowEvents: any[] = emptyLiveArray<any>();
const liveEmptyTasks: any[] = emptyLiveArray<any>();

import type {
  AccessControlSummary,
  AppRole,
  AccessScope,
  AccessControlWarningRow,
  AccessControlUserRow,
  ApprovalRow,
  AuditFindingRow,
  AuditClosureGateStatusRow,
  AuditClosurePackIndexRow,
  AuditExecutiveEscalationRow,
  AuditFindingValidationEventRow,
  AuditFindingWorkflowQueueRow,
  OverdueAuditFindingRow,
  RepeatAuditFindingRow,
  ComplianceRow,
  DelayReasonQueueRow,
  CriticalAttentionItem,
  CustomReportDefinition,
  DepartmentOption,
  DepartmentExecutionSummary,
  EvidenceChainOfCustodyRow,
  EvidenceClosureGateStatusRow,
  EvidenceGapDashboardRow,
  EvidenceGateWaiverRow,
  EvidenceLinkedItemType,
  EvidencePackIndexRow,
  EvidenceRequirementRow,
  EvidenceRequirementGate,
  EvidenceReviewEventRow,
  EvidenceReviewQueueRow,
  EvidenceRow,
  SensitiveEvidenceRegisterRow,
  EscalationRow,
  ExecutiveSummary,
  ExportCenterSummary,
  ExportDatasetKey,
  ExportDatasetPayload,
  ExportFormat,
  GovernanceDecisionRow,
  GrcKpiScorecard,
  DepartmentRiskHeatmapRow,
  MonthlyGrcTrendRow,
  RadarControlProfileRow,
  ManagementControlSummary,
  MilestoneRow,
  MyWorkRow,
  OrganizationOption,
  OvrReportRow,
  OvrSeverityLevel,
  OvrStatus,
  OvrSummary,
  OvrRiskDepartmentIndicator,
  OvrRepeatedCategoryAlert,
  OvrRiskIndicatorSummary,
  OvrWorkflowControlSummary,
  OvrWorkflowQueueRow,
  PriorityLevel,
  ProfileOption,
  ProjectRow,
  ProjectStatus,
  ExecutiveRiskEscalationRow,
  RiskAppetiteBreachRow,
  RiskClosureBlockerRow,
  RiskKriAlertRow,
  RiskLevel,
  RiskReassessmentHistoryRow,
  RiskRow,
  RiskTreatmentQueueRow,
  RiskWorkflowEventRow,
  RiskWorkflowQueueRow,
  SourceType,
  TaskRow,
  WorkStatus
} from '../types/domain';

function logFallback(label: string, error: unknown) {
  // eslint-disable-next-line no-console
  console.warn(`[GRC live-data unavailable] ${label}`, error);
}

function unavailableLiveCount(): number | null {
  return null;
}

function unavailableExportJob() {
  return null;
}

function requireLiveSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not configured. Add the local or staging credentials to .env before using this action.');
  }
  return supabase;
}

async function currentUserId() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export interface PilotUiCounts {
  activeProfiles: number | null;
  activeDepartments: number | null;
  ovrReports: number | null;
  openOvrReports: number | null;
  risks: number | null;
  activeControls: number | null;
  evidenceItems: number | null;
  projects: number | null;
}

async function readExactCount(query: any, label: string): Promise<number | null> {
  try {
    const { count, error } = await query;
    if (error) throw error;
    return typeof count === 'number' ? count : 0;
  } catch (error) {
    logFallback(`${label} count`, error);
    return unavailableLiveCount();
  }
}

async function readVisibleRowCount(query: any, label: string): Promise<number | null> {
  try {
    const { data, error } = await query;
    if (error) throw error;
    return Array.isArray(data) ? data.length : null;
  } catch (error) {
    logFallback(`${label} visible row count`, error);
    return unavailableLiveCount();
  }
}

async function readCountWithVisibleFallback(exactQuery: any, rowQuery: any, label: string) {
  const exact = await readExactCount(exactQuery, label);
  if (exact !== null) return exact;
  return readVisibleRowCount(rowQuery, label);
}

export async function getPilotUiCounts(): Promise<PilotUiCounts> {
  if (!supabase) {
    return {
      activeProfiles: null,
      activeDepartments: null,
      ovrReports: null,
      openOvrReports: null,
      risks: null,
      activeControls: null,
      evidenceItems: null,
      projects: null,
    };
  }

  const [
    activeProfiles,
    activeDepartments,
    ovrReports,
    openOvrReports,
    risks,
    activeControls,
    evidenceItems,
    projects,
  ] = await Promise.all([
    readExactCount(supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_active', true), 'active profiles'),
    readExactCount(supabase.from('departments').select('id', { count: 'exact', head: true }).eq('is_active', true), 'active departments'),
    readExactCount(supabase.from('ovr_reports').select('id', { count: 'exact', head: true }), 'OVR reports'),
    readExactCount(
      supabase
        .from('ovr_reports')
        .select('id', { count: 'exact', head: true })
        .neq('status', 'closed')
        .neq('status', 'rejected')
        .neq('status', 'cancelled'),
      'open OVR reports'
    ),
    readCountWithVisibleFallback(
      supabase.from('risks').select('id', { count: 'exact', head: true }),
      supabase.from('risks').select('id').limit(5000),
      'risks'
    ),
    readCountWithVisibleFallback(
      supabase.from('risk_controls').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('risk_controls').select('id').eq('is_active', true).limit(5000),
      'active controls'
    ),
    readExactCount(supabase.from('evidence_files').select('id', { count: 'exact', head: true }), 'evidence items'),
    readExactCount(supabase.from('projects').select('id', { count: 'exact', head: true }), 'projects'),
  ]);

  return {
    activeProfiles,
    activeDepartments,
    ovrReports,
    openOvrReports,
    risks,
    activeControls,
    evidenceItems,
    projects,
  };
}

export async function getExecutiveSummary(): Promise<ExecutiveSummary> {
  if (!supabase) return emptyLiveObject<ExecutiveSummary>('getExecutiveSummary');

  try {
    const { data, error } = await supabase.from('v_executive_grc_summary').select('*').limit(1);
    if (error) throw error;
    const row = data?.[0] as any;
    if (!row) return emptyLiveObject<ExecutiveSummary>('getExecutiveSummary');

    return {
      activeProjects: row.active_projects ?? 0,
      overdueProjects: row.overdue_projects ?? 0,
      overdueMilestones: row.overdue_milestones ?? 0,
      overdueTasks: row.overdue_tasks ?? 0,
      criticalOpenRisks: row.critical_open_risks ?? 0,
      complianceExpiring30Days: row.compliance_expiring_30_days ?? 0,
      overdueAuditFindings: row.overdue_audit_findings ?? 0,
      pendingApprovals: row.pending_approvals ?? 0,
      pendingEvidenceReviews: row.pending_evidence_reviews ?? 0
    };
  } catch (error) {
    logFallback('executive summary', error);
    return emptyLiveObject<ExecutiveSummary>('getExecutiveSummary');
  }
}

export async function getCriticalAttentionItems(): Promise<CriticalAttentionItem[]> {
  if (!supabase) return emptyLiveArray<any>();

  try {
    const { data, error } = await supabase
      .from('v_critical_attention_items')
      .select('*')
      .order('sort_rank', { ascending: true })
      .limit(25);
    if (error) throw error;
    if (!data || data.length === 0) return emptyLiveArray<any>();

    return (data as any[]).map(row => ({
      id: row.id,
      itemType: row.item_type,
      title: row.title,
      department: row.department_name || 'Company-wide',
      owner: row.owner_name || 'Unassigned',
      dueDate: row.due_date,
      status: row.status,
      riskLevel: row.risk_level,
      progress: row.progress_percent
    }));
  } catch (error) {
    logFallback('critical attention items', error);
    return emptyLiveArray<any>();
  }
}

export async function getProjects(): Promise<ProjectRow[]> {
  if (!supabase) return emptyLiveArray<any>();

  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*, departments(name_en,name_ar), owner:profiles!projects_owner_id_fkey(full_name_en,full_name_ar)')
      .order('target_end_date', { ascending: true, nullsFirst: false })
      .limit(100);
    if (error) throw error;
    return (data as unknown as ProjectRow[])?.length ? (data as unknown as ProjectRow[]) : liveEmptyProjects;
  } catch (error) {
    logFallback('projects', error);
    return emptyLiveArray<any>();
  }
}

export async function getProjectMilestones(projectId: string): Promise<MilestoneRow[]> {
  if (!supabase) return liveEmptyMilestones.filter(item => item.project_id === projectId);

  try {
    const { data, error } = await supabase
      .from('milestones')
      .select('*, owner:profiles!milestones_owner_id_fkey(full_name_en,full_name_ar)')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true })
      .order('due_date', { ascending: true, nullsFirst: false });
    if (error) throw error;
    return (data as unknown as MilestoneRow[]) || [];
  } catch (error) {
    logFallback('project milestones', error);
    return liveEmptyMilestones.filter(item => item.project_id === projectId);
  }
}

export async function getProjectTasks(projectId: string): Promise<TaskRow[]> {
  if (!supabase) return liveEmptyTasks.filter(item => item.project_id === projectId);

  try {
    const { data, error } = await supabase
      .from('tasks')
      .select('*, owner:profiles!tasks_owner_id_fkey(full_name_en,full_name_ar), assignee:profiles!tasks_assigned_to_fkey(full_name_en,full_name_ar)')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true })
      .order('due_date', { ascending: true, nullsFirst: false });
    if (error) throw error;
    return (data as unknown as TaskRow[]) || [];
  } catch (error) {
    logFallback('project tasks', error);
    return liveEmptyTasks.filter(item => item.project_id === projectId);
  }
}

export async function getRisks(): Promise<RiskRow[]> {
  if (!supabase) return emptyLiveArray<any>();

  try {
    const patch22Select = '*, departments(name_en,name_ar), owner:profiles!risks_owner_id_fkey(full_name_en,full_name_ar), risk_owner:profiles!risks_risk_owner_id_fkey(full_name_en,full_name_ar), control_owner:profiles!risks_control_owner_id_fkey(full_name_en,full_name_ar), treatment_owner:profiles!risks_treatment_owner_id_fkey(full_name_en,full_name_ar), executive_sponsor:profiles!risks_executive_sponsor_id_fkey(full_name_en,full_name_ar)';
    const legacySelect = '*, departments(name_en,name_ar), owner:profiles!risks_owner_id_fkey(full_name_en,full_name_ar)';
    let result = await supabase
      .from('risks')
      .select(patch22Select)
      .order('risk_level', { ascending: true })
      .limit(100);
    if (result.error) {
      result = await supabase
        .from('risks')
        .select(legacySelect)
        .order('risk_level', { ascending: true })
        .limit(100);
    }
    const { data, error } = result;
    if (error) throw error;
    return (data as unknown as RiskRow[])?.length ? (data as unknown as RiskRow[]) : liveEmptyRisks;
  } catch (error) {
    logFallback('risks', error);
    return emptyLiveArray<any>();
  }
}

async function readPatch22View<T>(view: string, label: string, orderColumn = 'risk_level'): Promise<T[]> {
  if (!supabase) return emptyLiveArray<any>();
  try {
    const { data, error } = await supabase
      .from(view)
      .select('*')
      .order(orderColumn, { ascending: true, nullsFirst: false })
      .limit(250);
    if (error) throw error;
    return (data as unknown as T[]) || [];
  } catch (error) {
    logFallback(label, error);
    return emptyLiveArray<any>();
  }
}

export async function getRiskWorkflowQueue(): Promise<RiskWorkflowQueueRow[]> {
  const rows = await readPatch22View<RiskWorkflowQueueRow>('v_patch22_risk_workflow_queue', 'risk workflow queue', 'due_date');
  return rows.length ? rows : liveEmptyRiskWorkflowQueue;
}

export async function getRiskAppetiteBreaches(): Promise<RiskAppetiteBreachRow[]> {
  const rows = await readPatch22View<RiskAppetiteBreachRow>('v_patch22_risk_appetite_breaches', 'risk appetite breaches', 'residual_score');
  return rows.length ? rows : liveEmptyRiskAppetiteBreaches;
}

export async function getRiskTreatmentQueue(): Promise<RiskTreatmentQueueRow[]> {
  const rows = await readPatch22View<RiskTreatmentQueueRow>('v_patch22_risk_treatment_queue', 'risk treatment queue', 'treatment_due_date');
  return rows.length ? rows : liveEmptyRiskTreatmentQueue;
}

export async function getRiskKriAlerts(): Promise<RiskKriAlertRow[]> {
  const rows = await readPatch22View<RiskKriAlertRow>('v_patch22_risk_kri_alerts', 'risk KRI alerts', 'measured_at');
  return rows.length ? rows : liveEmptyRiskKriAlerts;
}

export async function getExecutiveRiskEscalations(): Promise<ExecutiveRiskEscalationRow[]> {
  const rows = await readPatch22View<ExecutiveRiskEscalationRow>('v_patch22_executive_risk_escalations', 'executive risk escalations', 'residual_score');
  return rows.length ? rows : liveEmptyExecutiveRiskEscalations;
}

export async function getRiskClosureBlockers(): Promise<RiskClosureBlockerRow[]> {
  const rows = await readPatch22View<RiskClosureBlockerRow>('v_patch22_risk_closure_blockers', 'risk closure blockers', 'risk_level');
  return rows.length ? rows : liveEmptyRiskClosureBlockers;
}

export async function getRiskReassessmentHistory(riskId: string): Promise<RiskReassessmentHistoryRow[]> {
  if (!supabase || !riskId) return liveEmptyRiskReassessmentHistory;
  try {
    const { data, error } = await supabase
      .from('risk_reassessment_history')
      .select('*')
      .eq('risk_id', riskId)
      .order('changed_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return (data as unknown as RiskReassessmentHistoryRow[]) || [];
  } catch (error) {
    logFallback('risk reassessment history', error);
    return liveEmptyRiskReassessmentHistory;
  }
}

export async function getRiskWorkflowEvents(riskId: string): Promise<RiskWorkflowEventRow[]> {
  if (!supabase || !riskId) return liveEmptyRiskWorkflowEvents;
  try {
    const { data, error } = await supabase
      .from('risk_workflow_events')
      .select('*')
      .eq('risk_id', riskId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return (data as unknown as RiskWorkflowEventRow[]) || [];
  } catch (error) {
    logFallback('risk workflow events', error);
    return liveEmptyRiskWorkflowEvents;
  }
}

export async function getComplianceItems(): Promise<ComplianceRow[]> {
  if (!supabase) return emptyLiveArray<any>();

  try {
    const { data, error } = await supabase
      .from('compliance_items')
      .select('*, departments(name_en,name_ar), owner:profiles!compliance_items_owner_id_fkey(full_name_en,full_name_ar)')
      .order('expiry_date', { ascending: true, nullsFirst: false })
      .limit(100);
    if (error) throw error;
    return (data as unknown as ComplianceRow[])?.length ? (data as unknown as ComplianceRow[]) : liveEmptyCompliance;
  } catch (error) {
    logFallback('compliance items', error);
    return emptyLiveArray<any>();
  }
}

export async function getAuditFindings(): Promise<AuditFindingRow[]> {
  if (!supabase) return emptyLiveArray<any>();

  try {
    const { data, error } = await supabase
      .from('audit_findings')
      .select('*, departments(name_en,name_ar), owner:profiles!audit_findings_owner_id_fkey(full_name_en,full_name_ar)')
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(100);
    if (error) throw error;
    return (data as unknown as AuditFindingRow[])?.length ? (data as unknown as AuditFindingRow[]) : liveEmptyAuditFindings;
  } catch (error) {
    logFallback('audit findings', error);
    return emptyLiveArray<any>();
  }
}

async function readPatch24View<T>(view: string, label: string, orderColumn = 'due_date'): Promise<T[]> {
  if (!supabase) return emptyLiveArray<any>();
  try {
    const { data, error } = await supabase
      .from(view)
      .select('*')
      .order(orderColumn, { ascending: true, nullsFirst: false })
      .limit(250);
    if (error) throw error;
    return (data as unknown as T[]) || [];
  } catch (error) {
    logFallback(label, error);
    return emptyLiveArray<any>();
  }
}

export async function getAuditFindingWorkflowQueue(): Promise<AuditFindingWorkflowQueueRow[]> {
  const rows = await readPatch24View<AuditFindingWorkflowQueueRow>('v_patch24_audit_finding_workflow_queue', 'Patch 24 audit finding workflow queue', 'due_date');
  return rows.length ? rows : liveEmptyAuditFindingWorkflowQueue;
}

export async function getOverdueAuditFindings(): Promise<OverdueAuditFindingRow[]> {
  const rows = await readPatch24View<OverdueAuditFindingRow>('v_patch24_overdue_audit_findings', 'Patch 24 overdue audit findings', 'days_overdue');
  return rows.length ? rows : liveEmptyOverdueAuditFindings;
}

export async function getRepeatAuditFindings(): Promise<RepeatAuditFindingRow[]> {
  const rows = await readPatch24View<RepeatAuditFindingRow>('v_patch24_repeat_audit_findings', 'Patch 24 repeat audit findings', 'detected_repeat_count');
  return rows.length ? rows : liveEmptyRepeatAuditFindings;
}

export async function getAuditClosureGateStatus(): Promise<AuditClosureGateStatusRow[]> {
  const rows = await readPatch24View<AuditClosureGateStatusRow>('v_patch24_audit_closure_gate_status', 'Patch 24 audit closure gate status', 'finding_code');
  return rows.length ? rows : liveEmptyAuditClosureGateStatus;
}

export async function getAuditExecutiveEscalations(): Promise<AuditExecutiveEscalationRow[]> {
  const rows = await readPatch24View<AuditExecutiveEscalationRow>('v_patch24_audit_executive_escalations', 'Patch 24 audit executive escalations', 'due_date');
  return rows.length ? rows : liveEmptyAuditExecutiveEscalations;
}

export async function getAuditClosurePackIndex(): Promise<AuditClosurePackIndexRow[]> {
  const rows = await readPatch24View<AuditClosurePackIndexRow>('v_patch24_audit_closure_pack_index', 'Patch 24 audit closure pack index', 'closure_pack_generated_at');
  return rows.length ? rows : liveEmptyAuditClosurePackIndex;
}

export async function getAuditFindingValidationEvents(auditFindingId?: string): Promise<AuditFindingValidationEventRow[]> {
  if (!supabase) return liveEmptyAuditFindingValidationEvents;
  try {
    let query = supabase
      .from('audit_finding_validation_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (auditFindingId) query = query.eq('audit_finding_id', auditFindingId);
    const { data, error } = await query;
    if (error) throw error;
    return (data as unknown as AuditFindingValidationEventRow[]) || [];
  } catch (error) {
    logFallback('Patch 24 audit finding validation events', error);
    return liveEmptyAuditFindingValidationEvents;
  }
}

export async function getGovernanceDecisions(): Promise<GovernanceDecisionRow[]> {
  if (!supabase) return emptyLiveArray<any>();

  try {
    const { data, error } = await supabase
      .from('committee_decisions')
      .select('*, departments(name_en,name_ar), owner:profiles!committee_decisions_owner_id_fkey(full_name_en,full_name_ar)')
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(100);
    if (error) throw error;
    return (data as unknown as GovernanceDecisionRow[])?.length ? (data as unknown as GovernanceDecisionRow[]) : liveEmptyDecisions;
  } catch (error) {
    logFallback('governance decisions', error);
    return emptyLiveArray<any>();
  }
}

export async function getMyWork(): Promise<MyWorkRow[]> {
  if (!supabase) return emptyLiveArray<any>();

  try {
    const { data, error } = await supabase.from('v_my_open_work_expanded').select('*').order('due_date', { ascending: true, nullsFirst: false }).limit(100);
    if (error) throw error;
    return (data as unknown as MyWorkRow[])?.length ? (data as unknown as MyWorkRow[]) : liveEmptyMyWork;
  } catch (error) {
    logFallback('my work', error);
    return emptyLiveArray<any>();
  }
}

export async function getApprovals(): Promise<ApprovalRow[]> {
  if (!supabase) return emptyLiveArray<any>();

  try {
    const { data, error } = await supabase.from('v_pending_approvals_expanded').select('*').order('requested_at', { ascending: true }).limit(100);
    if (error) throw error;
    return (data as unknown as ApprovalRow[])?.length ? (data as unknown as ApprovalRow[]) : liveEmptyApprovals;
  } catch (error) {
    logFallback('approvals', error);
    return emptyLiveArray<any>();
  }
}

export async function getEvidenceQueue(): Promise<EvidenceRow[]> {
  if (!supabase) return emptyLiveArray<any>();

  try {
    const { data, error } = await supabase.from('v_evidence_review_queue').select('*').order('created_at', { ascending: true }).limit(100);
    if (error) throw error;
    return (data as unknown as EvidenceRow[])?.length ? (data as unknown as EvidenceRow[]) : liveEmptyEvidence;
  } catch (error) {
    logFallback('evidence review queue', error);
    return emptyLiveArray<any>();
  }
}

async function readPatch23View<T>(view: string, label: string, orderColumn = 'created_at'): Promise<T[]> {
  if (!supabase) return emptyLiveArray<any>();
  try {
    const { data, error } = await supabase
      .from(view)
      .select('*')
      .order(orderColumn, { ascending: true, nullsFirst: false })
      .limit(250);
    if (error) throw error;
    return (data as unknown as T[]) || [];
  } catch (error) {
    logFallback(label, error);
    return emptyLiveArray<any>();
  }
}

export async function getEvidenceReviewQueue(): Promise<EvidenceReviewQueueRow[]> {
  const rows = await readPatch23View<EvidenceReviewQueueRow>('v_patch23_evidence_review_queue', 'Patch 23 evidence review queue', 'review_due_date');
  return rows.length ? rows : liveEmptyEvidenceReviewQueue;
}

export async function getEvidenceGapDashboard(): Promise<EvidenceGapDashboardRow[]> {
  const rows = await readPatch23View<EvidenceGapDashboardRow>('v_patch23_evidence_gap_dashboard', 'Patch 23 evidence gap dashboard', 'due_date');
  return rows.length ? rows : liveEmptyEvidenceGapDashboard;
}

export async function getEvidenceClosureGateStatus(): Promise<EvidenceClosureGateStatusRow[]> {
  const rows = await readPatch23View<EvidenceClosureGateStatusRow>('v_patch23_evidence_closure_gate_status', 'Patch 23 evidence closure gate status', 'due_date');
  return rows.length ? rows : liveEmptyEvidenceClosureGateStatus;
}

export async function getEvidenceChainOfCustody(evidenceFileId?: string): Promise<EvidenceChainOfCustodyRow[]> {
  if (!supabase) return liveEmptyEvidenceChainOfCustody;
  try {
    let query = supabase
      .from('v_patch23_evidence_chain_of_custody')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (evidenceFileId) query = query.eq('evidence_file_id', evidenceFileId);
    const { data, error } = await query;
    if (error) throw error;
    return (data as unknown as EvidenceChainOfCustodyRow[]) || [];
  } catch (error) {
    logFallback('Patch 23 evidence chain of custody', error);
    return liveEmptyEvidenceChainOfCustody;
  }
}

export async function getEvidencePackIndex(): Promise<EvidencePackIndexRow[]> {
  const rows = await readPatch23View<EvidencePackIndexRow>('v_patch23_evidence_pack_index', 'Patch 23 evidence pack index', 'linked_at');
  return rows.length ? rows : liveEmptyEvidencePackIndex;
}

export async function getSensitiveEvidenceRegister(): Promise<SensitiveEvidenceRegisterRow[]> {
  const rows = await readPatch23View<SensitiveEvidenceRegisterRow>('v_patch23_sensitive_evidence_register', 'Patch 23 sensitive evidence register', 'expiry_date');
  return rows.length ? rows : liveEmptySensitiveEvidenceRegister;
}


export async function getEscalations(): Promise<EscalationRow[]> {
  if (!supabase) return emptyLiveArray<any>();

  try {
    const { data, error } = await supabase
      .from('v_escalation_center')
      .select('*')
      .order('escalation_level', { ascending: true })
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(100);
    if (error) throw error;
    return (data as unknown as EscalationRow[])?.length ? (data as unknown as EscalationRow[]) : liveEmptyEscalations;
  } catch (error) {
    logFallback('escalation center', error);
    return emptyLiveArray<any>();
  }
}

export async function getDelayReasonQueue(): Promise<DelayReasonQueueRow[]> {
  if (!supabase) return emptyLiveArray<any>();

  try {
    const { data, error } = await supabase
      .from('v_delay_reason_queue')
      .select('*')
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(100);
    if (error) throw error;
    return (data as unknown as DelayReasonQueueRow[]) || [];
  } catch (error) {
    logFallback('delay reason queue', error);
    return emptyLiveArray<any>();
  }
}

export async function getManagementControlSummary(): Promise<ManagementControlSummary> {
  if (!supabase) return emptyLiveObject<ManagementControlSummary>('getManagementControlSummary');

  try {
    const { data, error } = await supabase.from('v_management_control_summary').select('*').limit(1);
    if (error) throw error;
    const row = data?.[0] as ManagementControlSummary | undefined;
    return row || liveEmptyManagementControlSummary;
  } catch (error) {
    logFallback('management control summary', error);
    return emptyLiveObject<ManagementControlSummary>('getManagementControlSummary');
  }
}

export async function refreshEscalations() {
  requireLiveSupabase();
  requireServerBridge('Escalation event refresh', 'refresh_escalation_events');
}

export async function acknowledgeEscalation(eventId: string, note?: string) {
  requireLiveSupabase();
  await invokePrivilegedAction('acknowledge_escalation_event', {
    event_id: eventId,
    note: note || null,
  });
}

export async function resolveEscalation(eventId: string, note?: string) {
  requireLiveSupabase();
  await invokePrivilegedAction('resolve_escalation_event', {
    event_id: eventId,
    note: note || 'Resolved from Escalation Center.',
  });
}

export async function getOrganizations(): Promise<OrganizationOption[]> {
  if (!supabase) return emptyLiveArray<any>();

  try {
    const { data, error } = await supabase.from('organizations').select('id,name_en,name_ar').eq('is_active', true).limit(20);
    if (error) throw error;
    return data?.length ? (data as OrganizationOption[]) : [];
  } catch (error) {
    logFallback('organizations', error);
    return emptyLiveArray<any>();
  }
}

export async function getDepartments(): Promise<DepartmentOption[]> {
  if (!supabase) return emptyLiveArray<any>();

  try {
    const { data, error } = await supabase.from('departments').select('id,name_en,name_ar').eq('is_active', true).order('name_en');
    if (error) throw error;
    return data?.length ? (data as DepartmentOption[]) : liveEmptyDepartments;
  } catch (error) {
    logFallback('departments', error);
    return emptyLiveArray<any>();
  }
}

export async function getProfiles(): Promise<ProfileOption[]> {
  if (!supabase) return emptyLiveArray<any>();

  try {
    const { data, error } = await supabase.from('profiles').select('id,full_name_en,full_name_ar,email,department_id').eq('is_active', true).order('full_name_en').limit(1000);
    if (error) throw error;
    return data?.length ? (data as ProfileOption[]) : liveEmptyProfiles;
  } catch (error) {
    logFallback('profiles', error);
    return emptyLiveArray<any>();
  }
}

export interface CreateProjectInput {
  organization_id: string;
  title: string;
  description?: string;
  category: string;
  source_type: SourceType;
  department_id?: string;
  owner_id?: string;
  sponsor_id?: string;
  start_date?: string;
  target_end_date?: string;
  priority: PriorityLevel;
  risk_level: RiskLevel;
  evidence_required: boolean;
  closure_approval_required: boolean;
}

export async function createProject(input: CreateProjectInput) {
  const client = requireLiveSupabase();
  const userId = await currentUserId();
  const payload = {
    ...input,
    department_id: input.department_id || null,
    owner_id: input.owner_id || null,
    sponsor_id: input.sponsor_id || null,
    start_date: input.start_date || null,
    target_end_date: input.target_end_date || null,
    status: 'draft',
    progress_percent: 0,
    created_by: userId,
    updated_by: userId
  };
  const { data, error } = await client.from('projects').insert(payload).select('id,title').single();
  if (error) throw error;
  return data;
}

export interface CreateRiskInput {
  organization_id: string;
  risk_code?: string;
  title: string;
  description?: string;
  category: string;
  department_id?: string;
  owner_id?: string;
  likelihood: number;
  impact: number;
  residual_likelihood: number;
  residual_impact: number;
  risk_level: RiskLevel;
  response_type: string;
  next_review_date?: string;
}

export async function createRisk(input: CreateRiskInput) {
  const client = requireLiveSupabase();
  const userId = await currentUserId();
  const { data, error } = await client
    .from('risks')
    .insert({
      ...input,
      risk_code: input.risk_code || null,
      department_id: input.department_id || null,
      owner_id: input.owner_id || null,
      next_review_date: input.next_review_date || null,
      status: 'open',
      created_by: userId,
      updated_by: userId
    })
    .select('id,title')
    .single();
  if (error) throw error;
  return data;
}

export interface RiskWorkflowActionResult {
  status: string;
  action: string;
  risk_id: string;
}

export interface UpdateRiskAssessmentInput {
  risk_id: string;
  likelihood?: number;
  impact?: number;
  inherent_likelihood?: number;
  inherent_impact?: number;
  residual_likelihood?: number;
  residual_impact?: number;
  appetite_threshold?: number;
  appetite_breach_reason?: string;
  scoring_method?: string;
  change_reason: string;
}

export interface RiskAcceptanceInput {
  risk_id: string;
  reason?: string;
  acceptance_expiry_date?: string;
}

export interface RiskTreatmentInput {
  risk_id: string;
  treatment_status?: string;
  treatment_plan_summary?: string;
  treatment_due_date?: string;
  treatment_owner_id?: string;
  note?: string;
}

export interface RiskClosureInput {
  risk_id: string;
  reason?: string;
}

export interface RiskSourceLinkInput {
  risk_id: string;
  source_ovr_id?: string;
  source_audit_finding_id?: string;
  source_compliance_id?: string;
  source_project_id?: string;
  note?: string;
}

export interface MarkDuplicateRiskInput {
  risk_id: string;
  duplicate_of_risk_id: string;
  reason?: string;
}

function patch22RiskAction(action: string, payload: Record<string, unknown>) {
  return invokePrivilegedAction<RiskWorkflowActionResult>(action, payload);
}

export async function updateRiskAssessment(input: UpdateRiskAssessmentInput) {
  return patch22RiskAction('update_risk_assessment', input as unknown as Record<string, unknown>);
}

export async function requestRiskAcceptance(input: RiskAcceptanceInput) {
  return patch22RiskAction('request_risk_acceptance', input as unknown as Record<string, unknown>);
}

export async function approveRiskAcceptance(input: RiskAcceptanceInput) {
  return patch22RiskAction('approve_risk_acceptance', input as unknown as Record<string, unknown>);
}

export async function rejectRiskAcceptance(input: RiskAcceptanceInput) {
  return patch22RiskAction('reject_risk_acceptance', input as unknown as Record<string, unknown>);
}

export async function updateRiskTreatment(input: RiskTreatmentInput) {
  return patch22RiskAction('update_risk_treatment', input as unknown as Record<string, unknown>);
}

export async function completeRiskTreatment(input: RiskClosureInput) {
  return patch22RiskAction('complete_risk_treatment', input as unknown as Record<string, unknown>);
}

export async function requestRiskClosure(input: RiskClosureInput) {
  return patch22RiskAction('request_risk_closure', input as unknown as Record<string, unknown>);
}

export async function approveRiskClosure(input: RiskClosureInput) {
  return patch22RiskAction('approve_risk_closure', input as unknown as Record<string, unknown>);
}

export async function reopenRiskWithReason(input: RiskClosureInput) {
  return patch22RiskAction('reopen_risk_with_reason', input as unknown as Record<string, unknown>);
}

export async function linkRiskSource(input: RiskSourceLinkInput) {
  return patch22RiskAction('link_risk_source', input as unknown as Record<string, unknown>);
}

export async function markDuplicateRisk(input: MarkDuplicateRiskInput) {
  return patch22RiskAction('mark_duplicate_risk', input as unknown as Record<string, unknown>);
}

export interface CreateComplianceInput {
  organization_id: string;
  compliance_code?: string;
  title: string;
  description?: string;
  regulatory_body?: string;
  requirement_type?: string;
  department_id?: string;
  owner_id?: string;
  due_date?: string;
  expiry_date?: string;
  risk_level: RiskLevel;
  reminder_days_before: number;
}

export async function createComplianceItem(input: CreateComplianceInput) {
  const client = requireLiveSupabase();
  const userId = await currentUserId();
  const { data, error } = await client
    .from('compliance_items')
    .insert({
      ...input,
      compliance_code: input.compliance_code || null,
      description: input.description || null,
      regulatory_body: input.regulatory_body || null,
      requirement_type: input.requirement_type || null,
      department_id: input.department_id || null,
      owner_id: input.owner_id || null,
      due_date: input.due_date || null,
      expiry_date: input.expiry_date || null,
      status: 'not_started',
      evidence_required: true,
      created_by: userId,
      updated_by: userId
    })
    .select('id,title')
    .single();
  if (error) throw error;
  return data;
}

export interface CreateAuditFindingInput {
  organization_id: string;
  finding_code?: string;
  audit_title?: string;
  title: string;
  description: string;
  department_id?: string;
  owner_id?: string;
  auditor_id?: string;
  risk_level: RiskLevel;
  root_cause?: string;
  recommendation?: string;
  due_date?: string;
}

export async function createAuditFinding(input: CreateAuditFindingInput) {
  const client = requireLiveSupabase();
  const userId = await currentUserId();
  const { data, error } = await client
    .from('audit_findings')
    .insert({
      ...input,
      finding_code: input.finding_code || null,
      audit_title: input.audit_title || null,
      department_id: input.department_id || null,
      owner_id: input.owner_id || null,
      auditor_id: input.auditor_id || userId,
      root_cause: input.root_cause || null,
      recommendation: input.recommendation || null,
      due_date: input.due_date || null,
      status: 'open',
      evidence_required: true,
      created_by: userId,
      updated_by: userId
    })
    .select('id,title')
    .single();
  if (error) throw error;
  return data;
}

export interface AuditFindingWorkflowActionResult {
  status: string;
  action: string;
  audit_finding_id: string;
  result?: Record<string, unknown>;
}

export interface AuditFindingWorkflowActionInput {
  audit_finding_id: string;
  note?: string;
  reason?: string;
  finding_status?: string;
  workflow_stage?: string;
  severity_level?: string;
  due_date?: string;
  management_response_required?: boolean;
  management_response?: string;
  management_response_due_date?: string;
  corrective_action_plan?: string;
  corrective_action_owner_id?: string;
  corrective_action_due_date?: string;
  requested_due_date?: string;
  extension_id?: string;
  extension_reason?: string;
  rejection_reason?: string;
  reopen_reason?: string;
  escalation_level?: string;
  escalated_to?: string;
  repeat_finding_flag?: boolean;
  repeat_of_finding_id?: string;
  recurrence_count?: number;
  recurrence_window_days?: number;
  systemic_issue_flag?: boolean;
  related_risk_id?: string;
  related_compliance_id?: string;
  closure_pack_reference?: string;
  finding_owner_id?: string;
  audit_manager_id?: string;
  responsible_department_id?: string;
  responsible_owner_id?: string;
}

function patch24AuditAction(action: string, payload: Record<string, unknown>) {
  return invokePrivilegedAction<AuditFindingWorkflowActionResult>(action, payload);
}

export async function issueAuditFinding(input: AuditFindingWorkflowActionInput) {
  return patch24AuditAction('issue_audit_finding', input as unknown as Record<string, unknown>);
}

export async function submitManagementResponse(input: AuditFindingWorkflowActionInput) {
  return patch24AuditAction('submit_management_response', input as unknown as Record<string, unknown>);
}

export async function acceptManagementResponse(input: AuditFindingWorkflowActionInput) {
  return patch24AuditAction('accept_management_response', input as unknown as Record<string, unknown>);
}

export async function rejectManagementResponse(input: AuditFindingWorkflowActionInput) {
  return patch24AuditAction('reject_management_response', input as unknown as Record<string, unknown>);
}

export async function submitCorrectiveActionPlan(input: AuditFindingWorkflowActionInput) {
  return patch24AuditAction('submit_corrective_action_plan', input as unknown as Record<string, unknown>);
}

export async function acceptCorrectiveActionPlan(input: AuditFindingWorkflowActionInput) {
  return patch24AuditAction('accept_corrective_action_plan', input as unknown as Record<string, unknown>);
}

export async function rejectCorrectiveActionPlan(input: AuditFindingWorkflowActionInput) {
  return patch24AuditAction('reject_corrective_action_plan', input as unknown as Record<string, unknown>);
}

export async function requestAuditFindingExtension(input: AuditFindingWorkflowActionInput) {
  return patch24AuditAction('request_audit_finding_extension', input as unknown as Record<string, unknown>);
}

export async function approveAuditFindingExtension(input: AuditFindingWorkflowActionInput) {
  return patch24AuditAction('approve_audit_finding_extension', input as unknown as Record<string, unknown>);
}

export async function rejectAuditFindingExtension(input: AuditFindingWorkflowActionInput) {
  return patch24AuditAction('reject_audit_finding_extension', input as unknown as Record<string, unknown>);
}

export async function requestAuditFindingClosure(input: AuditFindingWorkflowActionInput) {
  return patch24AuditAction('request_audit_finding_closure', input as unknown as Record<string, unknown>);
}

export async function validateAuditFindingClosure(input: AuditFindingWorkflowActionInput) {
  return patch24AuditAction('validate_audit_finding_closure', input as unknown as Record<string, unknown>);
}

export async function rejectAuditFindingClosure(input: AuditFindingWorkflowActionInput) {
  return patch24AuditAction('reject_audit_finding_closure', input as unknown as Record<string, unknown>);
}

export async function reopenAuditFindingWithReason(input: AuditFindingWorkflowActionInput) {
  return patch24AuditAction('reopen_audit_finding_with_reason', input as unknown as Record<string, unknown>);
}

export async function escalateAuditFinding(input: AuditFindingWorkflowActionInput) {
  return patch24AuditAction('escalate_audit_finding', input as unknown as Record<string, unknown>);
}

export async function markRepeatAuditFinding(input: AuditFindingWorkflowActionInput) {
  return patch24AuditAction('mark_repeat_audit_finding', input as unknown as Record<string, unknown>);
}

export async function linkAuditFindingToRisk(input: AuditFindingWorkflowActionInput) {
  return patch24AuditAction('link_audit_finding_to_risk', input as unknown as Record<string, unknown>);
}

export async function linkAuditFindingToCompliance(input: AuditFindingWorkflowActionInput) {
  return patch24AuditAction('link_audit_finding_to_compliance', input as unknown as Record<string, unknown>);
}

export async function generateAuditClosurePackIndex(input: AuditFindingWorkflowActionInput) {
  return patch24AuditAction('generate_audit_closure_pack_index', input as unknown as Record<string, unknown>);
}

export interface CreateDecisionInput {
  organization_id: string;
  decision_code?: string;
  title: string;
  decision_text: string;
  department_id?: string;
  owner_id?: string;
  sponsor_id?: string;
  due_date?: string;
  priority: PriorityLevel;
  risk_level: RiskLevel;
  source_type: SourceType;
}

export async function createGovernanceDecision(input: CreateDecisionInput) {
  const client = requireLiveSupabase();
  const userId = await currentUserId();
  const { data, error } = await client
    .from('committee_decisions')
    .insert({
      ...input,
      decision_code: input.decision_code || null,
      department_id: input.department_id || null,
      owner_id: input.owner_id || null,
      sponsor_id: input.sponsor_id || null,
      due_date: input.due_date || null,
      status: 'open',
      evidence_required: true,
      created_by: userId,
      updated_by: userId
    })
    .select('id,title')
    .single();
  if (error) throw error;
  return data;
}

export interface CreateMilestoneInput {
  organization_id: string;
  project_id: string;
  title: string;
  description?: string;
  owner_id?: string;
  start_date?: string;
  due_date?: string;
  evidence_required: boolean;
}

export async function createMilestone(input: CreateMilestoneInput) {
  const client = requireLiveSupabase();
  const userId = await currentUserId();
  const { data, error } = await client
    .from('milestones')
    .insert({
      ...input,
      description: input.description || null,
      owner_id: input.owner_id || null,
      start_date: input.start_date || null,
      due_date: input.due_date || null,
      status: 'not_started',
      progress_percent: 0,
      created_by: userId,
      updated_by: userId
    })
    .select('id,title')
    .single();
  if (error) throw error;
  return data;
}

export interface CreateTaskInput {
  organization_id: string;
  project_id: string;
  milestone_id?: string;
  title: string;
  description?: string;
  owner_id?: string;
  assigned_to?: string;
  start_date?: string;
  due_date?: string;
  evidence_required: boolean;
}

export async function createTask(input: CreateTaskInput) {
  const client = requireLiveSupabase();
  const userId = await currentUserId();
  const { data, error } = await client
    .from('tasks')
    .insert({
      ...input,
      milestone_id: input.milestone_id || null,
      description: input.description || null,
      owner_id: input.owner_id || null,
      assigned_to: input.assigned_to || null,
      start_date: input.start_date || null,
      due_date: input.due_date || null,
      status: 'not_started',
      progress_percent: 0,
      created_by: userId,
      updated_by: userId
    })
    .select('id,title')
    .single();
  if (error) throw error;
  return data;
}

export async function updateTaskStatus(taskId: string, status: WorkStatus, progress_percent: number, delay_reason?: string) {
  const client = requireLiveSupabase();
  const userId = await currentUserId();
  const { error } = await client
    .from('tasks')
    .update({ status, progress_percent, delay_reason: delay_reason || null, updated_by: userId })
    .eq('id', taskId);
  if (error) throw error;
}

export async function decideApproval(approvalId: string, status: 'approved' | 'rejected', decision_note?: string) {
  const client = requireLiveSupabase();
  const { error } = await client
    .from('approvals')
    .update({ status, decision_note: decision_note || null, decided_at: new Date().toISOString() })
    .eq('id', approvalId);
  if (error) throw error;
}

export interface EvidenceGovernanceActionResult {
  status: string;
  action: string;
  result?: Record<string, unknown>;
}

export interface CreateEvidenceRequirementInput {
  linked_item_type: EvidenceLinkedItemType;
  linked_item_id: string;
  requirement_title: string;
  requirement_code?: string;
  requirement_description?: string;
  evidence_type_required?: string;
  minimum_accepted_files?: number;
  sensitivity_required?: string;
  due_date?: string;
  required_for_gate?: EvidenceRequirementGate;
  owner_id?: string;
  reviewer_role?: string;
  reviewer_id?: string;
}

export interface LinkEvidenceToItemInput {
  evidence_file_id: string;
  linked_item_type: EvidenceLinkedItemType;
  linked_item_id: string;
  linked_item_title?: string;
  link_reason?: string;
  is_primary?: boolean;
  required_for_closure?: boolean;
  required_for_acceptance?: boolean;
  required_for_approval?: boolean;
  required_for_treatment?: boolean;
}

export interface EvidenceReviewActionInput {
  evidence_file_id: string;
  note?: string;
  reason?: string;
  review_note?: string;
  review_due_date?: string;
  revision_due_date?: string;
  reviewer_id?: string;
}

export interface SupersedeEvidenceInput {
  evidence_file_id: string;
  superseded_by_evidence_id: string;
  note?: string;
}

export interface EvidenceWaiverInput {
  requirement_id?: string;
  waiver_id?: string;
  linked_item_type?: EvidenceLinkedItemType;
  linked_item_id?: string;
  reason?: string;
  waiver_reason?: string;
  audit_note?: string;
  expiry_date?: string;
}

export interface EvidenceGateStatusInput {
  requirement_id?: string;
  linked_item_type?: EvidenceLinkedItemType;
  linked_item_id?: string;
}

function patch23EvidenceAction(action: string, payload: Record<string, unknown>) {
  return invokePrivilegedAction<EvidenceGovernanceActionResult>(action, payload);
}

export async function createEvidenceRequirement(input: CreateEvidenceRequirementInput) {
  return patch23EvidenceAction('create_evidence_requirement', input as unknown as Record<string, unknown>);
}

export async function linkEvidenceToItem(input: LinkEvidenceToItemInput) {
  return patch23EvidenceAction('link_evidence_to_item', input as unknown as Record<string, unknown>);
}

export async function submitEvidenceForReview(input: EvidenceReviewActionInput) {
  return patch23EvidenceAction('submit_evidence_for_review', input as unknown as Record<string, unknown>);
}

export async function acceptEvidence(input: EvidenceReviewActionInput) {
  return patch23EvidenceAction('accept_evidence', input as unknown as Record<string, unknown>);
}

export async function rejectEvidence(input: EvidenceReviewActionInput) {
  return patch23EvidenceAction('reject_evidence', input as unknown as Record<string, unknown>);
}

export async function requestEvidenceRevision(input: EvidenceReviewActionInput) {
  return patch23EvidenceAction('request_evidence_revision', input as unknown as Record<string, unknown>);
}

export async function supersedeEvidence(input: SupersedeEvidenceInput) {
  return patch23EvidenceAction('supersede_evidence', input as unknown as Record<string, unknown>);
}

export async function lockEvidence(input: EvidenceReviewActionInput) {
  return patch23EvidenceAction('lock_evidence', input as unknown as Record<string, unknown>);
}

export async function requestEvidenceGateWaiver(input: EvidenceWaiverInput) {
  return patch23EvidenceAction('request_evidence_gate_waiver', input as unknown as Record<string, unknown>);
}

export async function approveEvidenceGateWaiver(input: EvidenceWaiverInput) {
  return patch23EvidenceAction('approve_evidence_gate_waiver', input as unknown as Record<string, unknown>);
}

export async function rejectEvidenceGateWaiver(input: EvidenceWaiverInput) {
  return patch23EvidenceAction('reject_evidence_gate_waiver', input as unknown as Record<string, unknown>);
}

export async function checkEvidenceGateStatus(input: EvidenceGateStatusInput) {
  return patch23EvidenceAction('check_evidence_gate_status', input as unknown as Record<string, unknown>);
}

export async function generateEvidencePackIndex(input: EvidenceGateStatusInput = {}) {
  return patch23EvidenceAction('generate_evidence_pack_index', input as unknown as Record<string, unknown>);
}

export async function reviewEvidence(evidenceId: string, status: 'accepted' | 'rejected' | 'needs_revision', rejection_reason?: string) {
  if (status === 'accepted') return acceptEvidence({ evidence_file_id: evidenceId, note: rejection_reason });
  if (status === 'rejected') return rejectEvidence({ evidence_file_id: evidenceId, reason: rejection_reason, note: rejection_reason });
  return requestEvidenceRevision({ evidence_file_id: evidenceId, reason: rejection_reason, note: rejection_reason });
}

export type ApprovalItemType = 'project' | 'milestone' | 'task' | 'risk' | 'compliance_item' | 'audit_finding' | 'policy' | 'committee_decision' | 'ovr_report';

function itemLinkColumn(itemType: ApprovalItemType) {
  const map: Record<ApprovalItemType, string> = {
    project: 'project_id',
    milestone: 'milestone_id',
    task: 'task_id',
    risk: 'risk_id',
    compliance_item: 'compliance_item_id',
    audit_finding: 'audit_finding_id',
    policy: 'policy_id',
    committee_decision: 'committee_decision_id',
    ovr_report: 'ovr_report_id'
  };
  return map[itemType];
}

function safeFileName(name: string) {
  return name
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 140) || 'evidence-file';
}

export async function updateProjectStatus(projectId: string, status: ProjectStatus, progress_percent: number, delay_reason?: string) {
  const client = requireLiveSupabase();
  const userId = await currentUserId();
  const { error } = await client
    .from('projects')
    .update({ status, progress_percent, delay_reason: delay_reason || null, updated_by: userId })
    .eq('id', projectId);
  if (error) throw error;
}

export async function updateMilestoneStatus(milestoneId: string, status: WorkStatus, progress_percent: number, delay_reason?: string) {
  const client = requireLiveSupabase();
  const userId = await currentUserId();
  const { error } = await client
    .from('milestones')
    .update({ status, progress_percent, delay_reason: delay_reason || null, updated_by: userId })
    .eq('id', milestoneId);
  if (error) throw error;
}

export interface UploadEvidenceInput {
  organization_id: string;
  item_type: ApprovalItemType;
  item_id: string;
  file: File;
  description?: string;
}

export async function uploadEvidenceForItem(input: UploadEvidenceInput) {
  const client = requireLiveSupabase();
  const userId = await currentUserId();
  const cleanName = safeFileName(input.file.name);
  const path = `${input.organization_id}/${input.item_type}/${input.item_id}/${Date.now()}-${cleanName}`;

  const { error: uploadError } = await client.storage
    .from('grc-evidence')
    .upload(path, input.file, { upsert: false });
  if (uploadError) throw uploadError;

  const linkColumn = itemLinkColumn(input.item_type);
  const payload = {
    organization_id: input.organization_id,
    [linkColumn]: input.item_id,
    file_name: input.file.name,
    file_path: path,
    file_type: input.file.type || null,
    file_size: input.file.size,
    description: input.description || null,
    status: 'submitted',
    uploaded_by: userId
  };

  const { data, error } = await client.from('evidence_files').insert(payload).select('id,file_name').single();
  if (error) throw error;
  return data;
}

export interface RequestApprovalInput {
  organization_id: string;
  item_type: ApprovalItemType;
  item_id: string;
  approver_id: string;
  request_note?: string;
}

export async function requestApproval(input: RequestApprovalInput) {
  const client = requireLiveSupabase();
  const userId = await currentUserId();
  const linkColumn = itemLinkColumn(input.item_type);
  const payload = {
    organization_id: input.organization_id,
    [linkColumn]: input.item_id,
    requested_by: userId,
    approver_id: input.approver_id,
    status: 'pending',
    request_note: input.request_note || null
  };

  const { data, error } = await client.from('approvals').insert(payload).select('id,status').single();
  if (error) throw error;
  return data;
}

export async function getDepartmentExecutionSummary(): Promise<DepartmentExecutionSummary[]> {
  if (!supabase) return emptyLiveArray<any>();

  try {
    const { data, error } = await supabase
      .from('v_department_execution_summary')
      .select('*')
      .order('overdue_projects', { ascending: false })
      .order('overdue_tasks', { ascending: false });
    if (error) throw error;
    return (data as unknown as DepartmentExecutionSummary[]) || [];
  } catch (error) {
    logFallback('department execution summary', error);
    return emptyLiveArray<any>();
  }
}

export interface BulkImportRowInput {
  row_number: number;
  raw_data: Record<string, string>;
  validation_status: 'valid' | 'invalid';
  validation_errors: string[];
  validation_warnings: string[];
}

export interface SaveBulkImportBatchInput {
  organization_id: string;
  batch_type: string;
  source_file_name?: string;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  rows: BulkImportRowInput[];
}

export async function saveBulkImportBatch(input: SaveBulkImportBatchInput) {
  const client = requireLiveSupabase();
  const userId = await currentUserId();
  const { data: batch, error: batchError } = await client
    .from('bulk_import_batches')
    .insert({
      organization_id: input.organization_id,
      batch_type: input.batch_type,
      source_file_name: input.source_file_name || null,
      status: input.invalid_rows > 0 ? 'validated_with_errors' : 'validated',
      total_rows: input.total_rows,
      valid_rows: input.valid_rows,
      invalid_rows: input.invalid_rows,
      created_by: userId
    })
    .select('id')
    .single();

  if (batchError) throw batchError;

  if (input.rows.length) {
    const { error: rowsError } = await client.from('bulk_import_rows').insert(
      input.rows.map(row => ({
        batch_id: batch.id,
        organization_id: input.organization_id,
        row_number: row.row_number,
        raw_data: row.raw_data,
        validation_status: row.validation_status,
        validation_errors: row.validation_errors,
        validation_warnings: row.validation_warnings,
        import_status: 'not_imported'
      }))
    );
    if (rowsError) throw rowsError;
  }

  return batch;
}


export async function getAccessControlSummary(): Promise<AccessControlSummary> {
  if (!supabase) return emptyLiveObject<AccessControlSummary>('getAccessControlSummary');

  try {
    const { data, error } = await supabase.from('v_access_control_summary').select('*').limit(1);
    if (error) throw error;
    const row = data?.[0] as AccessControlSummary | undefined;
    return row || liveEmptyAccessControlSummary;
  } catch (error) {
    logFallback('access control summary', error);
    return emptyLiveObject<AccessControlSummary>('getAccessControlSummary');
  }
}

export async function getAccessControlUsers(): Promise<AccessControlUserRow[]> {
  if (!supabase) return emptyLiveArray<any>();

  try {
    const { data, error } = await supabase
      .from('v_access_control_matrix')
      .select('*')
      .order('full_name_en', { ascending: true })
      .limit(1000);
    if (error) throw error;
    return (data as unknown as AccessControlUserRow[])?.length ? (data as unknown as AccessControlUserRow[]) : liveEmptyAccessControlUsers;
  } catch (error) {
    logFallback('access control users', error);
    return emptyLiveArray<any>();
  }
}

export async function getAccessControlWarnings(): Promise<AccessControlWarningRow[]> {
  if (!supabase) return emptyLiveArray<any>();

  try {
    const { data, error } = await supabase
      .from('v_access_control_warnings')
      .select('*')
      .order('severity', { ascending: true })
      .limit(200);
    if (error) throw error;
    return (data as unknown as AccessControlWarningRow[]) || [];
  } catch (error) {
    logFallback('access control warnings', error);
    return emptyLiveArray<any>();
  }
}

export interface AssignUserRoleInput {
  user_id: string;
  role: AppRole;
  scope: AccessScope;
  organization_id?: string | null;
  division_id?: string | null;
  department_id?: string | null;
  unit_id?: string | null;
  reason?: string;
}

export async function assignUserRole(input: AssignUserRoleInput) {
  requireLiveSupabase();
  const result = await invokePrivilegedAction<{ id: string }>('assign_user_role', {
    user_id: input.user_id,
    role: input.role,
    scope: input.scope,
    organization_id: input.organization_id || null,
    division_id: input.division_id || null,
    department_id: input.department_id || null,
    unit_id: input.unit_id || null,
    reason: input.reason || null
  });
  return result.id;
}

export async function deactivateUserRole(userRoleId: string, reason?: string) {
  requireLiveSupabase();
  await invokePrivilegedAction('deactivate_user_role', {
    user_role_id: userRoleId,
    reason: reason || null
  });
}

export interface CreateDepartmentInput {
  name_en: string;
  name_ar?: string | null;
  code: string;
}

export async function createDepartment(input: CreateDepartmentInput) {
  requireLiveSupabase();
  return invokePrivilegedAction<{
    id: string;
    organization_id: string;
    name_en: string;
    name_ar: string | null;
    code: string;
  }>('create_department', {
    name_en: input.name_en.trim(),
    name_ar: input.name_ar?.trim() || null,
    code: input.code.trim().toUpperCase()
  });
}

export interface CreateAdminUserInput {
  email: string;
  password: string;
  full_name_en: string;
  full_name_ar?: string | null;
  department_id?: string | null;
  role: AppRole;
  scope: AccessScope;
}

export async function createAdminUser(input: CreateAdminUserInput) {
  requireLiveSupabase();
  return invokePrivilegedAction<{
    id: string;
    profile_id: string;
    role_id: string;
    organization_id: string;
    department_id: string | null;
    role: AppRole;
    scope: AccessScope;
  }>('create_user', {
    email: input.email.trim().toLowerCase(),
    password: input.password,
    full_name_en: input.full_name_en.trim(),
    full_name_ar: input.full_name_ar?.trim() || null,
    department_id: input.department_id || null,
    role: input.role,
    scope: input.scope
  });
}

export async function getOvrSummary(): Promise<OvrSummary> {
  if (!supabase) return emptyLiveObject<OvrSummary>('getOvrSummary');

  try {
    const { data, error } = await supabase.from('v_ovr_summary').select('*').limit(1);
    if (error) throw error;
    const row = data?.[0] as OvrSummary | undefined;
    return row || liveEmptyOvrSummary;
  } catch (error) {
    logFallback('OVR summary', error);
    return emptyLiveObject<OvrSummary>('getOvrSummary');
  }
}

export async function getOvrReports(): Promise<OvrReportRow[]> {
  if (!supabase) return emptyLiveArray<any>();

  try {
    const { data, error } = await supabase
      .from('ovr_reports')
      .select('*, departments!ovr_reports_department_id_fkey(name_en,name_ar), reporter:profiles!ovr_reports_reported_by_fkey(full_name_en,full_name_ar), owner:profiles!ovr_reports_owner_id_fkey(full_name_en,full_name_ar)')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return (data as unknown as OvrReportRow[])?.length ? (data as unknown as OvrReportRow[]) : liveEmptyOvrReports;
  } catch (error) {
    logFallback('OVR reports', error);
    return emptyLiveArray<any>();
  }
}

export interface CreateOvrReportInput {
  organization_id: string;
  logging_number?: string;
  occurrence_date?: string;
  occurrence_time?: string;
  occurrence_location?: string;
  involved_person_type: string;
  person_involved_name?: string;
  mrn_or_id_no?: string;
  age?: number;
  sex?: string;
  department_id?: string;
  notification_at?: string;
  physical_condition?: string;
  mental_condition?: string;
  pre_occurrence_condition_flags: string[];
  brief_description: string;
  occurrence_category: string;
  severity_level?: OvrSeverityLevel;
  injury_type?: string;
  create_linked_action_plan: boolean;
  status: 'draft' | 'submitted';
}

export async function createOvrReport(input: CreateOvrReportInput) {
  const client = requireLiveSupabase();
  const userId = await currentUserId();
  const { data, error } = await client
    .from('ovr_reports')
    .insert({
      organization_id: input.organization_id,
      logging_number: input.logging_number || null,
      occurrence_date: input.occurrence_date || null,
      occurrence_time: input.occurrence_time || null,
      occurrence_location: input.occurrence_location || null,
      involved_person_type: input.involved_person_type,
      person_involved_name: input.person_involved_name || null,
      mrn_or_id_no: input.mrn_or_id_no || null,
      age: input.age || null,
      sex: input.sex || null,
      department_id: input.department_id || null,
      notification_at: input.notification_at || null,
      physical_condition: input.physical_condition || null,
      mental_condition: input.mental_condition || null,
      pre_occurrence_condition_flags: input.pre_occurrence_condition_flags,
      brief_description: input.brief_description,
      occurrence_category: input.occurrence_category,
      severity_level: input.severity_level || null,
      injury_type: input.injury_type || null,
      occurrence_details: {
        linked_action_plan_requested: input.create_linked_action_plan,
        synthetic_or_deidentified_expected_for_pilot: true
      },
      status: input.status,
      corrective_action_required: false,
      evidence_required: true,
      reported_by: userId,
      owner_id: userId,
      created_by: userId,
      updated_by: userId
    })
    .select('id,ovr_number,logging_number')
    .single();
  if (error) throw error;

  return data;
}


export async function getOvrWorkflowControlSummary(): Promise<OvrWorkflowControlSummary> {
  if (!supabase) return emptyLiveObject<OvrWorkflowControlSummary>('getOvrWorkflowControlSummary');

  try {
    const { data, error } = await supabase.from('v_ovr_workflow_control_summary').select('*').limit(1);
    if (error) throw error;
    const row = data?.[0] as OvrWorkflowControlSummary | undefined;
    return row || emptyLiveObject<OvrWorkflowControlSummary>('getOvrWorkflowControlSummary');
  } catch (error) {
    logFallback('OVR workflow control summary', error);
    return emptyLiveObject<OvrWorkflowControlSummary>('getOvrWorkflowControlSummary');
  }
}

export async function getOvrWorkflowQueue(): Promise<OvrWorkflowQueueRow[]> {
  if (!supabase) return emptyLiveArray<any>();

  try {
    const { data, error } = await supabase
      .from('v_ovr_workflow_queue')
      .select('*')
      .order('is_overdue', { ascending: false })
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(100);
    if (error) throw error;
    return (data as unknown as OvrWorkflowQueueRow[]) || [];
  } catch (error) {
    logFallback('OVR workflow queue', error);
    return emptyLiveArray<any>();
  }
}

export interface UpdateOvrWorkflowInput {
  ovr_report_id: string;
  next_status: string;
  note?: string;
  supervisor_investigation?: string;
  corrective_action?: string;
  quality_manager_comments?: string;
  referred_department_id?: string;
  referred_user_id?: string;
  referred_response?: string;
  final_verdict?: string;
  confirmed_severity_level?: OvrSeverityLevel;
  corrective_action_due_date?: string;
}

export async function updateOvrWorkflow(input: UpdateOvrWorkflowInput) {
  requireLiveSupabase();
  return invokePrivilegedAction<{
    id: string;
    status: OvrStatus;
    supervisor_due_date: string | null;
    quality_validated_at: string | null;
    cross_department_notified_at: string | null;
    final_verdict: string | null;
    reporter_response: string | null;
    closed_at: string | null;
  }>('update_ovr_workflow', {
    ovr_report_id: input.ovr_report_id,
    next_status: input.next_status,
    note: input.note || null,
    supervisor_investigation: input.supervisor_investigation || null,
    corrective_action: input.corrective_action || null,
    quality_manager_comments: input.quality_manager_comments || null,
    referred_department_id: input.referred_department_id || null,
    referred_user_id: input.referred_user_id || null,
    referred_response: input.referred_response || null,
    final_verdict: input.final_verdict || null,
    confirmed_severity_level: input.confirmed_severity_level || null,
    corrective_action_due_date: input.corrective_action_due_date || null
  });
}

export async function createOvrCorrectiveActionProject(ovrReportId: string) {
  requireLiveSupabase();
  const result = await invokePrivilegedAction<{ id: string }>(
    'create_ovr_corrective_action_project',
    { ovr_report_id: ovrReportId },
  );
  return result.id;
}

export async function getOvrRiskIndicatorSummary(): Promise<OvrRiskIndicatorSummary> {
  if (!supabase) return emptyLiveObject<OvrRiskIndicatorSummary>('getOvrRiskIndicatorSummary');

  try {
    const { data, error } = await supabase.from('v_ovr_risk_indicator_summary').select('*').limit(1);
    if (error) throw error;
    const row = data?.[0] as OvrRiskIndicatorSummary | undefined;
    return row || liveEmptyOvrRiskIndicatorSummary;
  } catch (error) {
    logFallback('OVR risk indicator summary', error);
    return emptyLiveObject<OvrRiskIndicatorSummary>('getOvrRiskIndicatorSummary');
  }
}

export async function getOvrRiskIndicatorsByDepartment(): Promise<OvrRiskDepartmentIndicator[]> {
  if (!supabase) return emptyLiveArray<any>();

  try {
    const { data, error } = await supabase
      .from('v_ovr_risk_indicators_by_department')
      .select('*')
      .order('weighted_score_30d', { ascending: false })
      .order('major_or_sentinel_ovrs_90d', { ascending: false });
    if (error) throw error;
    return (data as unknown as OvrRiskDepartmentIndicator[])?.length
      ? (data as unknown as OvrRiskDepartmentIndicator[])
      : liveEmptyOvrRiskDepartmentIndicators;
  } catch (error) {
    logFallback('OVR risk indicators by department', error);
    return emptyLiveArray<any>();
  }
}

export async function getOvrRepeatedCategoryAlerts(): Promise<OvrRepeatedCategoryAlert[]> {
  if (!supabase) return emptyLiveArray<any>();

  try {
    const { data, error } = await supabase
      .from('v_ovr_repeated_category_alerts')
      .select('*')
      .order('category_count_30d', { ascending: false });
    if (error) throw error;
    return (data as unknown as OvrRepeatedCategoryAlert[])?.length
      ? (data as unknown as OvrRepeatedCategoryAlert[])
      : liveEmptyOvrRepeatedCategoryAlerts;
  } catch (error) {
    logFallback('OVR repeated category alerts', error);
    return emptyLiveArray<any>();
  }
}

export async function getGrcKpiScorecard(): Promise<GrcKpiScorecard> {
  if (!supabase) return emptyLiveObject<GrcKpiScorecard>('getGrcKpiScorecard');

  try {
    const { data, error } = await supabase.from('v_grc_kpi_scorecard').select('*').limit(1);
    if (error) throw error;
    const row = data?.[0] as GrcKpiScorecard | undefined;
    return row || liveEmptyGrcKpiScorecard;
  } catch (error) {
    logFallback('GRC KPI scorecard', error);
    return emptyLiveObject<GrcKpiScorecard>('getGrcKpiScorecard');
  }
}

export async function getDepartmentRiskHeatmap(): Promise<DepartmentRiskHeatmapRow[]> {
  if (!supabase) return emptyLiveArray<any>();

  try {
    const { data, error } = await supabase
      .from('v_department_risk_heatmap')
      .select('*')
      .order('overall_pressure_score', { ascending: false })
      .limit(50);
    if (error) throw error;
    return (data as unknown as DepartmentRiskHeatmapRow[])?.length
      ? (data as unknown as DepartmentRiskHeatmapRow[])
      : liveEmptyDepartmentRiskHeatmap;
  } catch (error) {
    logFallback('department risk heatmap', error);
    return emptyLiveArray<any>();
  }
}

export async function getMonthlyGrcTrend(): Promise<MonthlyGrcTrendRow[]> {
  if (!supabase) return emptyLiveArray<any>();

  try {
    const { data, error } = await supabase
      .from('v_monthly_grc_trend')
      .select('*')
      .order('month_start', { ascending: true });
    if (error) throw error;
    return (data as unknown as MonthlyGrcTrendRow[])?.length
      ? (data as unknown as MonthlyGrcTrendRow[])
      : liveEmptyMonthlyGrcTrend;
  } catch (error) {
    logFallback('monthly GRC trend', error);
    return emptyLiveArray<any>();
  }
}

export async function getRadarControlProfile(): Promise<RadarControlProfileRow[]> {
  if (!supabase) return emptyLiveArray<any>();

  try {
    const { data, error } = await supabase
      .from('v_radar_control_profile')
      .select('*')
      .order('dimension_key', { ascending: true });
    if (error) throw error;
    return (data as unknown as RadarControlProfileRow[])?.length
      ? (data as unknown as RadarControlProfileRow[])
      : liveEmptyRadarControlProfile;
  } catch (error) {
    logFallback('radar control profile', error);
    return emptyLiveArray<any>();
  }
}


export async function getExportCenterSummary(): Promise<ExportCenterSummary> {
  if (!supabase) return emptyLiveObject<ExportCenterSummary>('getExportCenterSummary');

  try {
    const { data, error } = await supabase.from('v_export_center_summary').select('*').limit(1);
    if (error) throw error;
    const row = data?.[0] as any;
    if (!row) return emptyLiveObject<ExportCenterSummary>('getExportCenterSummary');
    return {
      organization_id: row.organization_id,
      custom_reports: row.custom_reports ?? 0,
      exports_30d: row.exports_30d ?? 0,
      backups_30d: row.backups_30d ?? 0,
      available_datasets: row.available_datasets ?? 0,
      last_export_at: row.last_export_at ?? null,
      last_backup_at: row.last_backup_at ?? null
    };
  } catch (error) {
    logFallback('export center summary', error);
    return emptyLiveObject<ExportCenterSummary>('getExportCenterSummary');
  }
}

export async function getCustomReportDefinitions(): Promise<CustomReportDefinition[]> {
  if (!supabase) return emptyLiveArray<any>();

  try {
    const { data, error } = await supabase
      .from('custom_report_definitions')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return (data as unknown as CustomReportDefinition[])?.length ? (data as unknown as CustomReportDefinition[]) : liveEmptyCustomReports;
  } catch (error) {
    logFallback('custom report definitions', error);
    return emptyLiveArray<any>();
  }
}

export async function saveCustomReportDefinition(input: {
  organization_id: string;
  report_key: string;
  name_en: string;
  name_ar?: string | null;
  description?: string | null;
  datasets: ExportDatasetKey[];
  filters?: Record<string, unknown> | null;
  columns?: Record<string, unknown> | null;
}) {
  const client = requireLiveSupabase();
  const actorId = await currentUserId();
  const { data, error } = await client
    .from('custom_report_definitions')
    .insert({
      organization_id: input.organization_id,
      report_key: input.report_key,
      name_en: input.name_en,
      name_ar: input.name_ar ?? null,
      description: input.description ?? null,
      datasets: input.datasets,
      filters: input.filters ?? {},
      columns: input.columns ?? {},
      created_by: actorId,
      updated_by: actorId
    })
    .select('id')
    .single();
  if (error) throw error;
  return data;
}

export async function logDataExport(input: {
  organization_id: string;
  export_type: 'dataset' | 'report' | 'backup';
  dataset_key?: string | null;
  export_format: ExportFormat;
  file_name: string;
  row_count: number;
  filters?: Record<string, unknown> | null;
  report_definition_id?: string | null;
}) {
  if (!supabase) return null;

  try {
    const actorId = await currentUserId();
    const { data, error } = await supabase
      .from('data_export_jobs')
      .insert({
        organization_id: input.organization_id,
        export_type: input.export_type,
        dataset_key: input.dataset_key ?? null,
        export_format: input.export_format,
        file_name: input.file_name,
        row_count: input.row_count,
        filters: input.filters ?? {},
        report_definition_id: input.report_definition_id ?? null,
        generated_by: actorId,
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .select('id')
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    logFallback('log data export', error);
    return unavailableExportJob();
  }
}

function rowsFromObject(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value as Record<string, unknown>[];
  if (value && typeof value === 'object') return [value as Record<string, unknown>];
  return emptyLiveArray<any>();
}

export async function getExportDataset(datasetKey: ExportDatasetKey): Promise<ExportDatasetPayload> {
  const generatedAt = new Date().toISOString();
  let rows: Record<string, unknown>[] = [];
  let label: string = datasetKey;

  switch (datasetKey) {
    case 'projects':
      label = 'Projects and action plans';
      rows = rowsFromObject(await getProjects());
      break;
    case 'milestones':
      label = 'Milestones';
      rows = rowsFromObject(supabase ? (await supabase.from('milestones').select('*').limit(5000)).data ?? liveEmptyMilestones : liveEmptyMilestones);
      break;
    case 'tasks':
      label = 'Tasks';
      rows = rowsFromObject(supabase ? (await supabase.from('tasks').select('*').limit(5000)).data ?? liveEmptyTasks : liveEmptyTasks);
      break;
    case 'risks':
      label = 'Risk register';
      rows = rowsFromObject(await getRisks());
      break;
    case 'compliance':
      label = 'Compliance calendar';
      rows = rowsFromObject(await getComplianceItems());
      break;
    case 'audit_findings':
      label = 'Audit findings';
      rows = rowsFromObject(await getAuditFindings());
      break;
    case 'ovr_reports':
      label = 'OVR reports';
      rows = rowsFromObject(await getOvrReports());
      break;
    case 'approvals':
      label = 'Approvals';
      rows = rowsFromObject(await getApprovals());
      break;
    case 'evidence':
      label = 'Evidence review queue';
      rows = rowsFromObject(await getEvidenceQueue());
      break;
    case 'escalations':
      label = 'Escalations';
      rows = rowsFromObject(await getEscalations());
      break;
    case 'departments':
      label = 'Departments';
      rows = rowsFromObject(await getDepartments());
      break;
    case 'users':
      label = 'User access matrix';
      rows = rowsFromObject(await getAccessControlUsers());
      break;
    case 'kpi_scorecard':
      label = 'KPI scorecard';
      rows = rowsFromObject(await getGrcKpiScorecard());
      break;
    case 'department_heatmap':
      label = 'Department risk heatmap';
      rows = rowsFromObject(await getDepartmentRiskHeatmap());
      break;
    case 'ovr_risk_indicators':
      label = 'OVR risk indicators';
      rows = rowsFromObject(await getOvrRiskIndicatorsByDepartment());
      break;
    default:
      rows = [];
  }

  return { datasetKey, label, generatedAt, rowCount: rows.length, rows };
}

export async function buildBackupPackage(datasetKeys: ExportDatasetKey[]) {
  const generatedAt = new Date().toISOString();
  const datasets: Record<string, ExportDatasetPayload> = {};
  let totalRows = 0;

  for (const key of datasetKeys) {
    const payload = await getExportDataset(key);
    datasets[key] = payload;
    totalRows += payload.rowCount;
  }

  return {
    manifest: {
      product: 'GRC Control Center',
      version: 'v1.2 export-center patch',
      generatedAt,
      datasetCount: datasetKeys.length,
      totalRows,
      note: 'Client-side external backup package. It is not a Supabase full database dump and does not include storage file binary contents.'
    },
    datasets
  };
}
