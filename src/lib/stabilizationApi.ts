import { supabase } from './supabase';
import { emptyLiveObject, emptyLiveArray } from './liveData';
import { requireServerBridge } from './privilegedAction';

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

const liveEmptySummary: StagingSummary = emptyLiveObject<StagingSummary>('liveEmptySummary');

const liveEmptyChecks: StagingCheck[] = emptyLiveArray<StagingCheck>();

const liveEmptyPersonas: RlsPersonaScenario[] = emptyLiveArray<RlsPersonaScenario>();

const liveEmptyTranslations: TranslationCoverageRow[] = emptyLiveArray<TranslationCoverageRow>();

const liveEmptyLoad: LoadTestSeedBatch[] = emptyLiveArray<LoadTestSeedBatch>();

const liveEmptyBackups: BackupStrategy[] = emptyLiveArray<BackupStrategy>();

const liveEmptyRestore: RestoreVerification[] = emptyLiveArray<RestoreVerification>();

const liveEmptyMigrations: MigrationRunbookItem[] = emptyLiveArray<MigrationRunbookItem>();

const liveEmptyDefects: ConsolidationDefect[] = emptyLiveArray<ConsolidationDefect>();

export async function seedStagingValidationDefaults() {
  if (!supabase) return { status: 'empty', message: 'Supabase is not configured; returning empty live data.' };
  return requireServerBridge(
    'Staging validation default seeding',
    'seed_staging_validation_defaults',
  );
}

export async function getStagingSummary() {
  const rows = await selectView<StagingSummary>('v_staging_validation_summary', [liveEmptySummary], { limit: 1 });
  return rows[0] ?? liveEmptySummary;
}

export async function getStagingChecks() {
  return selectView<StagingCheck>('v_staging_validation_checks', liveEmptyChecks, { order: 'attention_weight', ascending: false, limit: 100 });
}

export async function getRlsPersonaLab() {
  return selectView<RlsPersonaScenario>('v_rls_persona_lab', liveEmptyPersonas, { order: 'sort_order', ascending: true, limit: 100 });
}

export async function getTranslationCoverage() {
  return selectView<TranslationCoverageRow>('v_i18n_translation_coverage', liveEmptyTranslations, { order: 'coverage_percent', ascending: true, limit: 100 });
}

export async function getLoadTestSeedStatus() {
  return selectView<LoadTestSeedBatch>('v_load_test_seed_status', liveEmptyLoad, { order: 'target_total_rows', ascending: false, limit: 100 });
}

export async function getBackupStrategies() {
  return selectView<BackupStrategy>('v_production_backup_strategy_status', liveEmptyBackups, { order: 'backup_signal', ascending: true, limit: 100 });
}

export async function getRestoreVerifications() {
  return selectView<RestoreVerification>('v_restore_verification_status', liveEmptyRestore, { order: 'created_at', ascending: false, limit: 100 });
}

export async function getMigrationRunbook() {
  return selectView<MigrationRunbookItem>('v_migration_runbook_status', liveEmptyMigrations, { order: 'sequence_no', ascending: true, limit: 100 });
}

export async function getConsolidationDefects() {
  return selectView<ConsolidationDefect>('v_consolidation_defect_dashboard', liveEmptyDefects, { order: 'defect_weight', ascending: false, limit: 100 });
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
