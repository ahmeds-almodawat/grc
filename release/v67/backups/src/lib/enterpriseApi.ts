import { supabase } from './supabase';

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

async function selectView<T>(viewName: string, fallback: T[], options?: { order?: string; ascending?: boolean; limit?: number }) {
  if (!supabase) return fallback;
  let query = supabase.from(viewName).select('*');
  if (options?.order) query = query.order(options.order, { ascending: options.ascending ?? false });
  if (options?.limit) query = query.limit(options.limit);
  const { data, error } = await query;
  if (error) {
    console.warn(`[${viewName}] using fallback`, error.message);
    return fallback;
  }
  return (data ?? []).map(row => camel<T>(row));
}

const fallbackBoardSummary: BoardPackSummary = {
  organizationId: 'demo-org',
  organizationNameEn: 'Al Modawat Specialized Medical Company',
  organizationNameAr: 'شركة المداواة التخصصية الطبية',
  asOfDate: new Date().toISOString().slice(0, 10),
  activeProjects: 34,
  highOpenRisks: 12,
  complianceDue30Days: 8,
  openAuditFindings: 15,
  openOvrs: 21,
  pendingApprovals: 11,
  evidenceReviews: 17,
  avgDepartmentControlScore: 78,
  departmentsAtRisk: 6
};

const fallbackDepartmentScorecards: DepartmentScorecard[] = [
  { departmentId: 'dept-1', organizationId: 'demo-org', departmentNameEn: 'Nursing', departmentNameAr: 'التمريض', activeProjects: 8, overdueProjects: 2, overdueTasks: 9, criticalRisks: 2, expiringCompliance: 1, overdueAuditFindings: 2, majorOvrs: 2, openOvrs: 13, controlScore: 54, signal: 'critical', latestExecutiveNote: 'Repeated OVR patterns require Quality-led corrective action.', latestNoteAt: '2026-06-16' },
  { departmentId: 'dept-2', organizationId: 'demo-org', departmentNameEn: 'Finance', departmentNameAr: 'المالية', activeProjects: 6, overdueProjects: 1, overdueTasks: 3, criticalRisks: 1, expiringCompliance: 0, overdueAuditFindings: 3, majorOvrs: 0, openOvrs: 1, controlScore: 71, signal: 'watch', latestExecutiveNote: 'Payment approval evidence and cash forecast controls are key focus areas.', latestNoteAt: '2026-06-15' },
  { departmentId: 'dept-3', organizationId: 'demo-org', departmentNameEn: 'Quality', departmentNameAr: 'الجودة', activeProjects: 5, overdueProjects: 0, overdueTasks: 2, criticalRisks: 1, expiringCompliance: 2, overdueAuditFindings: 1, majorOvrs: 1, openOvrs: 5, controlScore: 76, signal: 'watch', latestExecutiveNote: 'OVR closure aging should be reduced before rollout.', latestNoteAt: '2026-06-14' },
  { departmentId: 'dept-4', organizationId: 'demo-org', departmentNameEn: 'IT', departmentNameAr: 'تقنية المعلومات', activeProjects: 4, overdueProjects: 0, overdueTasks: 1, criticalRisks: 0, expiringCompliance: 0, overdueAuditFindings: 0, majorOvrs: 0, openOvrs: 0, controlScore: 92, signal: 'healthy', latestExecutiveNote: 'Continue quarterly access review and backup verification.', latestNoteAt: '2026-06-10' }
];

const fallbackReportTemplates: ReportTemplate[] = [
  { id: 'tpl-board', organizationId: 'demo-org', templateCode: 'EXEC_BOARD_PACK', titleEn: 'Executive board pack', titleAr: 'حزمة مجلس الإدارة التنفيذية', descriptionEn: 'Executive summary across GRC, OVR, audit and compliance.', descriptionAr: 'ملخص تنفيذي للحوكمة والمخاطر وOVR والمراجعة والامتثال.', sourceView: 'v_board_pack_summary', defaultColumns: ['active_projects','high_open_risks','open_ovrs','pending_approvals'], outputFormats: ['csv','json','print'], isSystem: true, runCount: 4, lastGeneratedAt: '2026-06-16' },
  { id: 'tpl-dept', organizationId: 'demo-org', templateCode: 'DEPT_SCORECARD', titleEn: 'Department scorecards', titleAr: 'بطاقات أداء الإدارات', descriptionEn: 'Department pressure and control score.', descriptionAr: 'ضغط الإدارة ودرجة الضبط.', sourceView: 'v_department_scorecard_v2', defaultColumns: ['department_name_en','control_score','signal','critical_risks'], outputFormats: ['csv','json','print'], isSystem: true, runCount: 8, lastGeneratedAt: '2026-06-15' },
  { id: 'tpl-evidence', organizationId: 'demo-org', templateCode: 'EVIDENCE_VAULT', titleEn: 'Evidence vault inventory', titleAr: 'مخزون خزنة الأدلة', descriptionEn: 'Evidence metadata and version health.', descriptionAr: 'بيانات الأدلة وصحة الإصدارات.', sourceView: 'v_evidence_vault_inventory', defaultColumns: ['file_name','linked_area','status','vault_status'], outputFormats: ['csv','json'], isSystem: true, runCount: 2, lastGeneratedAt: '2026-06-12' }
];

const fallbackEvidenceVault: EvidenceVaultItem[] = [
  { id: 'ev-1', organizationId: 'demo-org', fileName: 'OVR corrective action evidence.pdf', filePath: '/grc-evidence/ovr-demo.pdf', fileType: 'application/pdf', fileSize: 782120, status: 'submitted', createdAt: '2026-06-14', reviewedAt: null, uploadedByName: 'Quality Officer', versionCount: 2, latestVersionAt: '2026-06-16', vaultStatus: 'review_overdue', linkedArea: 'OVR' },
  { id: 'ev-2', organizationId: 'demo-org', fileName: 'Finance authority matrix signed.pdf', filePath: '/grc-evidence/authority.pdf', fileType: 'application/pdf', fileSize: 445810, status: 'accepted', createdAt: '2026-06-10', reviewedAt: '2026-06-11', uploadedByName: 'Finance Manager', versionCount: 1, latestVersionAt: '2026-06-10', vaultStatus: 'healthy', linkedArea: 'Policy' },
  { id: 'ev-3', organizationId: 'demo-org', fileName: 'Civil defense renewal receipt.jpg', filePath: '/grc-evidence/cd.jpg', fileType: 'image/jpeg', fileSize: 328800, status: 'needs_revision', createdAt: '2026-06-08', reviewedAt: '2026-06-09', uploadedByName: 'Facility Manager', versionCount: 0, latestVersionAt: null, vaultStatus: 'no_version_record', linkedArea: 'Compliance' }
];

const fallbackBackupPlans: BackupSchedulePlan[] = [
  { id: 'backup-1', organizationId: 'demo-org', planCode: 'WEEKLY_GRC_EXPORT', titleEn: 'Weekly GRC export package', titleAr: 'حزمة تصدير GRC الأسبوعية', frequency: 'weekly', nextDueAt: '2026-06-24', lastRunAt: '2026-06-17', lastStatus: 'completed', retentionDays: 90, requireRestoreDryRun: true, readinessStatus: 'healthy', runCount: 6, lastCompletedAt: '2026-06-17' },
  { id: 'backup-2', organizationId: 'demo-org', planCode: 'MONTHLY_RESTORE_TEST', titleEn: 'Monthly restore dry-run control', titleAr: 'اختبار استعادة شهري تجريبي', frequency: 'monthly', nextDueAt: '2026-06-30', lastRunAt: null, lastStatus: null, retentionDays: 180, requireRestoreDryRun: true, readinessStatus: 'restore_test_due', runCount: 0, lastCompletedAt: null }
];

const fallbackScenarios: ScenarioItem[] = [
  { id: 'scn-1', organizationId: 'demo-org', scenarioCode: 'SCN-CASH-001', titleEn: 'Government payer collection delay', titleAr: 'تأخر تحصيل الجهات الحكومية', category: 'financial', probability: 4, impact: 5, exposureScore: 20, estimatedFinancialImpact: 0, mitigationSummary: 'Weekly cash forecast and payer escalation dashboard.', triggerIndicators: ['DSO increase','cash runway below threshold'], ownerName: 'Finance Manager', status: 'active', exposureLevel: 'critical', updatedAt: '2026-06-17' },
  { id: 'scn-2', organizationId: 'demo-org', scenarioCode: 'SCN-QUALITY-001', titleEn: 'Repeated major OVR pattern', titleAr: 'تكرار بلاغات OVR جسيمة', category: 'clinical', probability: 3, impact: 5, exposureScore: 15, estimatedFinancialImpact: 0, mitigationSummary: 'RCA, corrective action project and executive escalation.', triggerIndicators: ['two level 4 OVRs','sentinel event'], ownerName: 'Quality Manager', status: 'active', exposureLevel: 'high', updatedAt: '2026-06-17' },
  { id: 'scn-3', organizationId: 'demo-org', scenarioCode: 'SCN-CYBER-001', titleEn: 'Unauthorized sensitive role exposure', titleAr: 'تعرض صلاحيات حساسة غير مبرر', category: 'cybersecurity', probability: 2, impact: 5, exposureScore: 10, estimatedFinancialImpact: null, mitigationSummary: 'Quarterly access review, least privilege and audit trail review.', triggerIndicators: ['global roles without expiry','inactive user with active role'], ownerName: 'IT Manager', status: 'under_review', exposureLevel: 'medium', updatedAt: '2026-06-15' }
];

export async function getBoardPackSummary() {
  const rows = await selectView<BoardPackSummary>('v_board_pack_summary', [fallbackBoardSummary], { limit: 1 });
  return rows[0] ?? fallbackBoardSummary;
}

export async function getDepartmentScorecards() {
  return selectView<DepartmentScorecard>('v_department_scorecard_v2', fallbackDepartmentScorecards, { order: 'control_score', ascending: true, limit: 50 });
}

export async function getReportTemplates() {
  return selectView<ReportTemplate>('v_report_builder_catalog', fallbackReportTemplates, { order: 'template_code', ascending: true, limit: 100 });
}

export async function getEvidenceVaultInventory() {
  return selectView<EvidenceVaultItem>('v_evidence_vault_inventory', fallbackEvidenceVault, { order: 'created_at', ascending: false, limit: 200 });
}

export async function getBackupScheduleReadiness() {
  return selectView<BackupSchedulePlan>('v_backup_schedule_readiness', fallbackBackupPlans, { order: 'next_due_at', ascending: true, limit: 50 });
}

export async function getScenarioMatrix() {
  return selectView<ScenarioItem>('v_scenario_matrix', fallbackScenarios, { order: 'exposure_score', ascending: false, limit: 50 });
}

export async function createBoardPackSnapshot(title: string) {
  if (!supabase) return 'demo-board-pack-snapshot';
  const { data: org } = await supabase.from('organizations').select('id').limit(1).maybeSingle();
  const orgId = org?.id;
  if (!orgId) return 'demo-board-pack-snapshot';
  const { data, error } = await supabase.rpc('create_board_pack_snapshot', {
    p_organization_id: orgId,
    p_title: title,
    p_period_start: null,
    p_period_end: null,
    p_sections: ['summary','department_scorecards','risks','ovr','audit','compliance','backup']
  });
  if (error) throw new Error(error.message);
  return String(data);
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
  const { data, error } = await supabase.rpc('record_backup_schedule_run', {
    p_plan_id: planId,
    p_status: status,
    p_package_name: `browser-backup-${new Date().toISOString().slice(0,10)}.json`,
    p_row_count: 0,
    p_storage_manifest_count: 0,
    p_checksum: null,
    p_error_message: null
  });
  if (error) throw new Error(error.message);
  return String(data);
}

export async function fetchTemplateRows(template: ReportTemplate) {
  if (!supabase) {
    if (template.sourceView === 'v_department_scorecard_v2') return fallbackDepartmentScorecards as unknown as Record<string, unknown>[];
    if (template.sourceView === 'v_evidence_vault_inventory') return fallbackEvidenceVault as unknown as Record<string, unknown>[];
    return [fallbackBoardSummary] as unknown as Record<string, unknown>[];
  }
  const { data, error } = await supabase.from(template.sourceView).select('*').limit(1000);
  if (error) throw new Error(error.message);
  return (data ?? []) as Record<string, unknown>[];
}
