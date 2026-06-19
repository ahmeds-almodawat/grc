import { supabase } from './supabase';

export type StagingSummary = {
  organizationId: string;
  cycles: number;
  blockedChecks: number;
  warningChecks: number;
  passedChecks: number;
  pendingChecks: number;
  stagingReadinessScore: number;
  criticalOpenDefects: number;
  highOpenDefects: number;
};

export type StagingCheck = {
  id: string;
  cycleCode: string | null;
  cycleTitle: string | null;
  environmentName: string | null;
  checkArea: string;
  checkCode: string;
  checkTitle: string;
  status: 'pass' | 'warning' | 'blocked' | 'pending' | 'not_applicable';
  severity: 'critical' | 'high' | 'medium' | 'low';
  ownerLabel: string | null;
  evidenceNote: string | null;
  resultNote: string | null;
  attentionWeight: number;
};

export type RlsPersonaScenario = {
  id: string;
  personaCode: string;
  personaNameEn: string;
  personaNameAr: string | null;
  roleName: string;
  accessScope: string;
  testArea: string;
  allowedExpectation: string;
  deniedExpectation: string;
  isCritical: boolean;
  isActive: boolean;
  latestResult: 'pass' | 'fail' | 'warning' | 'pending' | null;
  latestTestedAt: string | null;
  latestEvidenceNote: string | null;
  latestFailureNote: string | null;
  personaStatus: 'not_tested' | 'passed' | 'warning' | 'failed' | 'pending';
};

export type TranslationCoverageRow = {
  id: string;
  moduleKey: string;
  screenName: string;
  labelGroup: string;
  totalLabels: number;
  translatedAr: number;
  translatedEn: number;
  rtlChecked: boolean;
  status: string;
  reviewerNote: string | null;
  coveragePercent: number;
  missingArCount: number;
  missingEnCount: number;
  computedStatus: string;
};

export type LoadTestSeedBatch = {
  id: string;
  batchCode: string;
  title: string;
  targetDepartments: number;
  targetUsers: number;
  targetProjects: number;
  targetTasks: number;
  targetOvrReports: number;
  targetEvidenceFiles: number;
  targetTotalRows: number;
  status: string;
  lastRunAt: string | null;
  durationMs: number | null;
  performanceNote: string | null;
  performanceSignal: 'healthy' | 'watch' | 'blocked' | 'planned';
};

export type BackupStrategy = {
  id: string;
  strategyCode: string;
  title: string;
  backupType: string;
  frequency: string;
  ownerLabel: string | null;
  retentionDays: number;
  includesStorageFiles: boolean;
  includesAuthUsers: boolean;
  requiresRestoreDryRun: boolean;
  status: string;
  lastSuccessAt: string | null;
  nextDueDate: string | null;
  notes: string | null;
  backupSignal: 'not_active' | 'overdue' | 'restore_test_needed' | 'ok';
};

export type RestoreVerification = {
  id: string;
  verificationCode: string;
  strategyCode: string | null;
  strategyTitle: string | null;
  scenarioName: string;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  rowCountMatch: boolean | null;
  storageFilesChecked: boolean;
  authUsersChecked: boolean;
  evidenceNote: string | null;
  failureNote: string | null;
  verificationSignal: 'verified' | 'failed' | 'blocked' | 'needs_work';
};

export type MigrationRunbookItem = {
  id: string;
  sequenceNo: number;
  migrationFile: string;
  releaseTag: string;
  purpose: string;
  isRequired: boolean;
  verificationQuery: string | null;
  expectedResult: string | null;
  status: 'pending' | 'verified' | 'warning' | 'blocked' | 'skipped';
  verifiedAt: string | null;
  verificationNote: string | null;
  attentionWeight: number;
};

export type ConsolidationDefect = {
  id: string;
  defectCode: string;
  title: string;
  area: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'in_progress' | 'fixed' | 'accepted' | 'closed' | 'cancelled';
  ownerLabel: string | null;
  foundInVersion: string | null;
  targetFixVersion: string | null;
  description: string | null;
  resolutionNote: string | null;
  defectWeight: number;
};

type DbRow = Record<string, any>;

function toCamelKey(key: string) {
  return key.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
}

function camel<T>(row: DbRow): T {
  const mapped: DbRow = {};
  Object.entries(row).forEach(([key, value]) => {
    mapped[toCamelKey(key)] = value;
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

const fallbackSummary: StagingSummary = {
  organizationId: 'demo-org',
  cycles: 1,
  blockedChecks: 2,
  warningChecks: 4,
  passedChecks: 9,
  pendingChecks: 5,
  stagingReadinessScore: 62,
  criticalOpenDefects: 2,
  highOpenDefects: 3
};

const fallbackChecks: StagingCheck[] = [
  { id: 'check-1', cycleCode: 'STAGE-V23', cycleTitle: 'v2.3 staging validation cycle', environmentName: 'staging', checkArea: 'migrations', checkCode: 'MIG-ALL-FRESH', checkTitle: 'Apply migrations 001 to 025 in a fresh Supabase staging project', status: 'pending', severity: 'critical', ownerLabel: 'System Admin', evidenceNote: 'Screenshot or migration verifier export', resultNote: null, attentionWeight: 30 },
  { id: 'check-2', cycleCode: 'STAGE-V23', cycleTitle: 'v2.3 staging validation cycle', environmentName: 'staging', checkArea: 'security', checkCode: 'RLS-PERSONAS', checkTitle: 'Run RLS persona test matrix for all key user roles', status: 'blocked', severity: 'critical', ownerLabel: 'Access Control Admin', evidenceNote: 'Persona lab export', resultNote: 'Must be completed before employee rollout', attentionWeight: 100 },
  { id: 'check-3', cycleCode: 'STAGE-V23', cycleTitle: 'v2.3 staging validation cycle', environmentName: 'staging', checkArea: 'bilingual', checkCode: 'AR-RTL-SCREENS', checkTitle: 'Review Arabic/RTL on all active pages and key print reports', status: 'warning', severity: 'high', ownerLabel: 'Governance Admin', evidenceNote: 'Translation coverage export', resultNote: null, attentionWeight: 60 },
  { id: 'check-4', cycleCode: 'STAGE-V23', cycleTitle: 'v2.3 staging validation cycle', environmentName: 'staging', checkArea: 'backup', checkCode: 'RESTORE-DRY-RUN', checkTitle: 'Complete restore dry-run using latest backup/export strategy', status: 'blocked', severity: 'critical', ownerLabel: 'IT / Governance', evidenceNote: 'Restore verification record', resultNote: 'Production backup is not complete without restore proof', attentionWeight: 100 }
];

const fallbackPersonas: RlsPersonaScenario[] = [
  { id: 'p-1', personaCode: 'CEO-GLOBAL', personaNameEn: 'CEO / Executive global view', personaNameAr: 'الرئيس التنفيذي / العرض الشامل', roleName: 'executive', accessScope: 'global', testArea: 'command_center', allowedExpectation: 'Can view all critical risks, OVRs, approvals and escalations.', deniedExpectation: 'Cannot bypass workflow evidence controls by direct self-approval.', isCritical: true, isActive: true, latestResult: 'warning', latestTestedAt: null, latestEvidenceNote: null, latestFailureNote: 'Need live user test.', personaStatus: 'warning' },
  { id: 'p-2', personaCode: 'DEPT-MGR', personaNameEn: 'Department manager scoped view', personaNameAr: 'مدير إدارة بنطاق الإدارة', roleName: 'department_manager', accessScope: 'department', testArea: 'department_control', allowedExpectation: 'Can view own department projects, OVRs and tasks.', deniedExpectation: 'Cannot view unrelated department employee work queues.', isCritical: true, isActive: true, latestResult: null, latestTestedAt: null, latestEvidenceNote: null, latestFailureNote: null, personaStatus: 'not_tested' },
  { id: 'p-3', personaCode: 'EMPLOYEE-ASSIGNED', personaNameEn: 'Employee assigned-only workspace', personaNameAr: 'موظف - الأعمال المسندة فقط', roleName: 'employee', accessScope: 'assigned_only', testArea: 'my_work', allowedExpectation: 'Can view own assigned tasks and submitted OVRs.', deniedExpectation: 'Cannot view executive dashboards, other employees, or confidential OVRs.', isCritical: true, isActive: true, latestResult: null, latestTestedAt: null, latestEvidenceNote: null, latestFailureNote: null, personaStatus: 'not_tested' },
  { id: 'p-4', personaCode: 'QUALITY-OVR', personaNameEn: 'Quality OVR reviewer', personaNameAr: 'مراجع الجودة لبلاغات OVR', roleName: 'governance_admin', accessScope: 'global', testArea: 'ovr', allowedExpectation: 'Can classify, return, request evidence and close OVRs after evidence.', deniedExpectation: 'Cannot close without accepted evidence and closure user.', isCritical: true, isActive: true, latestResult: 'pass', latestTestedAt: '2026-06-17T10:00:00+03:00', latestEvidenceNote: 'Demo test passed.', latestFailureNote: null, personaStatus: 'passed' }
];

const fallbackTranslations: TranslationCoverageRow[] = [
  { id: 't-1', moduleKey: 'core', screenName: 'Navigation / Shell', labelGroup: 'nav', totalLabels: 45, translatedAr: 45, translatedEn: 45, rtlChecked: true, status: 'complete', reviewerNote: 'Core navigation reviewed.', coveragePercent: 100, missingArCount: 0, missingEnCount: 0, computedStatus: 'complete' },
  { id: 't-2', moduleKey: 'ovr', screenName: 'OVR Workflow', labelGroup: 'forms_and_status', totalLabels: 60, translatedAr: 54, translatedEn: 60, rtlChecked: false, status: 'needs_review', reviewerNote: 'Print and workflow labels need final Arabic QA.', coveragePercent: 90, missingArCount: 6, missingEnCount: 0, computedStatus: 'missing_ar' },
  { id: 't-3', moduleKey: 'reports', screenName: 'Reports / Export', labelGroup: 'buttons_and_filters', totalLabels: 48, translatedAr: 38, translatedEn: 48, rtlChecked: false, status: 'needs_review', reviewerNote: 'Report filters need cleanup.', coveragePercent: 79, missingArCount: 10, missingEnCount: 0, computedStatus: 'missing_ar' },
  { id: 't-4', moduleKey: 'admin', screenName: 'Access / Setup / Safety', labelGroup: 'warnings', totalLabels: 52, translatedAr: 42, translatedEn: 52, rtlChecked: false, status: 'needs_review', reviewerNote: 'Arabic warning wording should be reviewed.', coveragePercent: 81, missingArCount: 10, missingEnCount: 0, computedStatus: 'missing_ar' }
];

const fallbackLoad: LoadTestSeedBatch[] = [
  { id: 'load-1', batchCode: 'LOAD-1000-50', title: '1,000 users / 50 departments staging load plan', targetDepartments: 50, targetUsers: 1000, targetProjects: 250, targetTasks: 5000, targetOvrReports: 500, targetEvidenceFiles: 1500, targetTotalRows: 8250, status: 'planned', lastRunAt: null, durationMs: null, performanceNote: 'Use staging only. Do not run on production data.', performanceSignal: 'planned' },
  { id: 'load-2', batchCode: 'LOAD-DEMO-MEDIUM', title: 'Medium demo load for dashboard validation', targetDepartments: 20, targetUsers: 250, targetProjects: 80, targetTasks: 1200, targetOvrReports: 120, targetEvidenceFiles: 300, targetTotalRows: 1950, status: 'tested', lastRunAt: '2026-06-17T11:00:00+03:00', durationMs: 2400, performanceNote: 'Dashboard usable with medium demo load.', performanceSignal: 'healthy' }
];

const fallbackBackups: BackupStrategy[] = [
  { id: 'b-1', strategyCode: 'BROWSER-EXPORT', title: 'Browser export package before large changes', backupType: 'browser_export', frequency: 'before_major_change', ownerLabel: 'Governance Admin', retentionDays: 90, includesStorageFiles: false, includesAuthUsers: false, requiresRestoreDryRun: true, status: 'active', lastSuccessAt: '2026-06-17T15:30:00+03:00', nextDueDate: '2026-06-24', notes: 'Good for external analysis but not a full platform backup.', backupSignal: 'restore_test_needed' },
  { id: 'b-2', strategyCode: 'DB-DUMP', title: 'PostgreSQL database backup/dump', backupType: 'database_dump', frequency: 'daily', ownerLabel: 'IT / Supabase Admin', retentionDays: 180, includesStorageFiles: false, includesAuthUsers: false, requiresRestoreDryRun: true, status: 'draft', lastSuccessAt: null, nextDueDate: '2026-07-01', notes: 'Production-grade database backup must be configured outside the browser.', backupSignal: 'not_active' },
  { id: 'b-3', strategyCode: 'STORAGE-EXPORT', title: 'Evidence/document storage export', backupType: 'storage_export', frequency: 'weekly', ownerLabel: 'IT / Quality', retentionDays: 180, includesStorageFiles: true, includesAuthUsers: false, requiresRestoreDryRun: true, status: 'draft', lastSuccessAt: null, nextDueDate: '2026-07-01', notes: 'Required because evidence files are not inside CSV/JSON exports.', backupSignal: 'not_active' }
];

const fallbackRestore: RestoreVerification[] = [
  { id: 'r-1', verificationCode: 'RESTORE-V23-STAGING', strategyCode: 'BROWSER-EXPORT', strategyTitle: 'Browser export package before large changes', scenarioName: 'Restore latest export into clean staging project and compare row counts', status: 'planned', startedAt: null, finishedAt: null, rowCountMatch: null, storageFilesChecked: false, authUsersChecked: false, evidenceNote: 'Record migration state, row-count comparison and screenshot evidence.', failureNote: null, verificationSignal: 'needs_work' }
];

const fallbackMigrations: MigrationRunbookItem[] = [
  { id: 'm-23', sequenceNo: 23, migrationFile: '023_enterprise_intelligence_reporting.sql', releaseTag: 'v2.1', purpose: 'Board packs, advanced reports, evidence vault, scorecards and backup scheduler', isRequired: true, verificationQuery: 'select count(*) from board_pack_snapshots;', expectedResult: 'Query returns without relation error', status: 'pending', verifiedAt: null, verificationNote: null, attentionWeight: 60 },
  { id: 'm-24', sequenceNo: 24, migrationFile: '024_automation_intelligence_kri_reviews.sql', releaseTag: 'v2.2', purpose: 'Automation rules, KRIs, recurring reviews and executive exceptions', isRequired: true, verificationQuery: 'select count(*) from automation_rules;', expectedResult: 'Query returns without relation error', status: 'pending', verifiedAt: null, verificationNote: null, attentionWeight: 60 },
  { id: 'm-25', sequenceNo: 25, migrationFile: '025_staging_validation_consolidation.sql', releaseTag: 'v2.3', purpose: 'Staging validation, RLS persona lab, translation audit, load seed plan and backup strategy', isRequired: true, verificationQuery: 'select count(*) from staging_validation_cycles;', expectedResult: 'Query returns without relation error', status: 'pending', verifiedAt: null, verificationNote: null, attentionWeight: 60 }
];

const fallbackDefects: ConsolidationDefect[] = [
  { id: 'd-1', defectCode: 'DEF-I18N-001', title: 'Complete Arabic coverage audit for older pages', area: 'bilingual', severity: 'high', status: 'open', ownerLabel: 'Governance Admin', foundInVersion: 'v2.3', targetFixVersion: 'v2.4', description: 'Older pages may still have English-only labels or validation messages.', resolutionNote: null, defectWeight: 70 },
  { id: 'd-2', defectCode: 'DEF-RLS-001', title: 'Run real persona testing before employee rollout', area: 'security', severity: 'critical', status: 'open', ownerLabel: 'Access Control Admin', foundInVersion: 'v2.3', targetFixVersion: 'pre-production', description: 'Role/scope model must be verified with actual test users.', resolutionNote: null, defectWeight: 100 },
  { id: 'd-3', defectCode: 'DEF-BKP-001', title: 'Configure production server-side backup outside browser export', area: 'backup', severity: 'critical', status: 'open', ownerLabel: 'IT / Supabase Admin', foundInVersion: 'v2.3', targetFixVersion: 'pre-production', description: 'Browser export is useful but not equivalent to full database/storage/auth backup.', resolutionNote: null, defectWeight: 100 }
];

export async function seedStagingValidationDefaults() {
  if (!supabase) return { status: 'demo', message: 'Supabase is not configured; using fallback data.' };
  const { data, error } = await supabase.rpc('seed_staging_validation_defaults');
  if (error) throw error;
  return data as Record<string, unknown>;
}

export async function getStagingSummary() {
  const rows = await selectView<StagingSummary>('v_staging_validation_summary', [fallbackSummary], { limit: 1 });
  return rows[0] ?? fallbackSummary;
}

export async function getStagingChecks() {
  return selectView<StagingCheck>('v_staging_validation_checks', fallbackChecks, { order: 'attention_weight', ascending: false, limit: 100 });
}

export async function getRlsPersonaLab() {
  return selectView<RlsPersonaScenario>('v_rls_persona_lab', fallbackPersonas, { order: 'sort_order', ascending: true, limit: 100 });
}

export async function getTranslationCoverage() {
  return selectView<TranslationCoverageRow>('v_i18n_translation_coverage', fallbackTranslations, { order: 'coverage_percent', ascending: true, limit: 100 });
}

export async function getLoadTestSeedStatus() {
  return selectView<LoadTestSeedBatch>('v_load_test_seed_status', fallbackLoad, { order: 'target_total_rows', ascending: false, limit: 100 });
}

export async function getBackupStrategies() {
  return selectView<BackupStrategy>('v_production_backup_strategy_status', fallbackBackups, { order: 'backup_signal', ascending: true, limit: 100 });
}

export async function getRestoreVerifications() {
  return selectView<RestoreVerification>('v_restore_verification_status', fallbackRestore, { order: 'created_at', ascending: false, limit: 100 });
}

export async function getMigrationRunbook() {
  return selectView<MigrationRunbookItem>('v_migration_runbook_status', fallbackMigrations, { order: 'sequence_no', ascending: true, limit: 100 });
}

export async function getConsolidationDefects() {
  return selectView<ConsolidationDefect>('v_consolidation_defect_dashboard', fallbackDefects, { order: 'defect_weight', ascending: false, limit: 100 });
}

export async function getStabilizationCommandData() {
  const [summary, checks, personas, translations, load, backups, restore, migrations, defects] = await Promise.all([
    getStagingSummary(),
    getStagingChecks(),
    getRlsPersonaLab(),
    getTranslationCoverage(),
    getLoadTestSeedStatus(),
    getBackupStrategies(),
    getRestoreVerifications(),
    getMigrationRunbook(),
    getConsolidationDefects(),
  ]);
  return { summary, checks, personas, translations, load, backups, restore, migrations, defects };
}
