import { supabase } from './supabase';
import { emptyLiveObject, emptyLiveArray } from './liveData';
import { invokePrivilegedAction, requireServerBridge } from './privilegedAction';

export type BoardPackSummary = {
  organizationId: string;
  organizationNameEn: string;
  organizationNameAr: string;
  asOfDate: string;
  activeProjects: number;
  highOpenRisks: number;
  complianceDue30Days: number;
  openAuditFindings: number;
  openOvrs: number;
  pendingApprovals: number;
  evidenceReviews: number;
  avgDepartmentControlScore: number;
  departmentsAtRisk: number;
};

export type DepartmentScorecard = {
  departmentId: string;
  organizationId: string;
  departmentNameEn: string;
  departmentNameAr: string;
  activeProjects: number;
  overdueProjects: number;
  overdueTasks: number;
  criticalRisks: number;
  expiringCompliance: number;
  overdueAuditFindings: number;
  majorOvrs: number;
  openOvrs: number;
  controlScore: number;
  signal: 'excellent' | 'healthy' | 'watch' | 'at_risk' | 'critical';
  latestExecutiveNote: string;
  latestNoteAt: string | null;
};

export type ReportTemplate = {
  id: string;
  organizationId: string | null;
  templateCode: string;
  titleEn: string;
  titleAr: string;
  descriptionEn: string | null;
  descriptionAr: string | null;
  sourceView: string;
  defaultColumns: string[];
  outputFormats: string[];
  isSystem: boolean;
  runCount: number;
  lastGeneratedAt: string | null;
};

export type EvidenceVaultItem = {
  id: string;
  organizationId: string;
  fileName: string;
  filePath: string;
  fileType: string | null;
  fileSize: number | null;
  status: string;
  createdAt: string;
  reviewedAt: string | null;
  uploadedByName: string;
  versionCount: number;
  latestVersionAt: string | null;
  vaultStatus: string;
  linkedArea: string;
};

export type BackupSchedulePlan = {
  id: string;
  organizationId: string | null;
  planCode: string;
  titleEn: string;
  titleAr: string;
  frequency: string;
  nextDueAt: string | null;
  lastRunAt: string | null;
  lastStatus: string | null;
  retentionDays: number;
  requireRestoreDryRun: boolean;
  readinessStatus: string;
  runCount: number;
  lastCompletedAt: string | null;
};

export type ScenarioItem = {
  id: string;
  organizationId: string | null;
  scenarioCode: string;
  titleEn: string;
  titleAr: string;
  category: string;
  probability: number;
  impact: number;
  exposureScore: number;
  estimatedFinancialImpact: number | null;
  mitigationSummary: string | null;
  triggerIndicators: string[];
  ownerName: string;
  status: string;
  exposureLevel: string;
  updatedAt: string;
};

type DbRow = Record<string, any>;

function camel<T>(row: DbRow): T {
  const mapped: DbRow = {};
  Object.entries(row).forEach(([key, value]) => {
    mapped[key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())] = value;
  });
  return mapped as T;
}

async function selectView<T>(viewName: string, emptyRows: T[], options?: { order?: string; ascending?: boolean; limit?: number }) {
  if (!supabase) return emptyRows;
  let query = supabase.from(viewName).select('*');
  if (options?.order) query = query.order(options.order, { ascending: options.ascending ?? false });
  if (options?.limit) query = query.limit(options.limit);
  const { data, error } = await query;
  if (error) {
    console.warn(`[${viewName}] returning empty live data`, error.message);
    return emptyRows;
  }
  return (data ?? []).map(row => camel<T>(row));
}

const liveEmptyBoardSummary: BoardPackSummary = emptyLiveObject<BoardPackSummary>('liveEmptyBoardSummary');

const liveEmptyDepartmentScorecards: DepartmentScorecard[] = emptyLiveArray<DepartmentScorecard>();

const liveEmptyReportTemplates: ReportTemplate[] = emptyLiveArray<ReportTemplate>();

const liveEmptyEvidenceVault: EvidenceVaultItem[] = emptyLiveArray<EvidenceVaultItem>();

const liveEmptyBackupPlans: BackupSchedulePlan[] = emptyLiveArray<BackupSchedulePlan>();

const liveEmptyScenarios: ScenarioItem[] = emptyLiveArray<ScenarioItem>();

export async function getBoardPackSummary() {
  const rows = await selectView<BoardPackSummary>('v_board_pack_summary', [liveEmptyBoardSummary], { limit: 1 });
  return rows[0] ?? liveEmptyBoardSummary;
}

export async function getDepartmentScorecards() {
  return selectView<DepartmentScorecard>('v_department_scorecard_v2', liveEmptyDepartmentScorecards, { order: 'control_score', ascending: true, limit: 50 });
}

export async function getReportTemplates() {
  return selectView<ReportTemplate>('v_report_builder_catalog', liveEmptyReportTemplates, { order: 'template_code', ascending: true, limit: 100 });
}

export async function getEvidenceVaultInventory() {
  return selectView<EvidenceVaultItem>('v_evidence_vault_inventory', liveEmptyEvidenceVault, { order: 'created_at', ascending: false, limit: 200 });
}

export async function getBackupScheduleReadiness() {
  return selectView<BackupSchedulePlan>('v_backup_schedule_readiness', liveEmptyBackupPlans, { order: 'next_due_at', ascending: true, limit: 50 });
}

export async function getScenarioMatrix() {
  return selectView<ScenarioItem>('v_scenario_matrix', liveEmptyScenarios, { order: 'exposure_score', ascending: false, limit: 50 });
}

export async function createBoardPackSnapshot(title: string) {
  if (!supabase) return 'demo-board-pack-snapshot';
  const { data: org } = await supabase.from('organizations').select('id').limit(1).maybeSingle();
  const orgId = org?.id;
  if (!orgId) return 'demo-board-pack-snapshot';
  const result = await invokePrivilegedAction<{ id: string }>('create_board_pack_snapshot', {
    organization_id: orgId,
    title,
    period_start: null,
    period_end: null,
    sections: ['summary','department_scorecards','risks','ovr','audit','compliance','backup']
  });
  return result.id;
}

export async function recordReportRun(template: ReportTemplate, rowCount: number, format: 'csv' | 'json' | 'print') {
  if (!supabase) return;
  const { data: org } = await supabase.from('organizations').select('id').limit(1).maybeSingle();
  const organizationId = org?.id ?? template.organizationId;
  await supabase.from('report_runs').insert({
    organization_id: organizationId,
    template_id: template.id,
    report_title: template.titleEn,
    source_view: template.sourceView,
    selected_columns: template.defaultColumns,
    output_format: format,
    row_count: rowCount,
    status: 'generated'
  });
}

export async function recordBackupPlanRun(planId: string, status: string = 'completed') {
  if (!supabase) return 'demo-backup-run';
  void planId;
  void status;
  return requireServerBridge(
    'Backup schedule run recording',
    'record_backup_schedule_run',
  );
}

export async function fetchTemplateRows(template: ReportTemplate) {
  if (!supabase) {
    if (template.sourceView === 'v_department_scorecard_v2') return liveEmptyDepartmentScorecards as unknown as Record<string, unknown>[];
    if (template.sourceView === 'v_evidence_vault_inventory') return liveEmptyEvidenceVault as unknown as Record<string, unknown>[];
    return [liveEmptyBoardSummary] as unknown as Record<string, unknown>[];
  }
  const { data, error } = await supabase.from(template.sourceView).select('*').limit(1000);
  if (error) throw new Error(error.message);
  return (data ?? []) as Record<string, unknown>[];
}
