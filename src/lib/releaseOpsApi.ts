import { supabase } from './supabase';
import { emptyLiveObject, emptyLiveArray } from './liveData';
import { requireServerBridge } from './privilegedAction';

export type UltraReleaseSummary = {
  releaseScore: number;
  blockerCount: number;
  warningCount: number;
  lastBackupAt: string | null;
  lastRestoreDryRunAt: string | null;
  migrationsExpected: number;
  migrationsVerified: number;
  translationCoverage: number;
  adminLocksActive: number;
};

export type ProductionChecklistItem = {
  id: string;
  phase: string;
  item: string;
  status: 'pass' | 'warning' | 'blocked' | 'pending';
  owner: string;
  evidence: string;
  notes: string;
  sortOrder: number;
};

export type MigrationVerificationItem = {
  sequenceNo: number;
  migrationFile: string;
  purpose: string;
  expected: boolean;
  verified: boolean;
  status: 'verified' | 'missing' | 'warning' | 'pending';
  verificationNote: string;
};

export type RestoreDryRunItem = {
  id: string;
  backupPackageId: string;
  scenarioName: string;
  status: 'planned' | 'running' | 'passed' | 'failed' | 'cancelled';
  startedAt: string | null;
  finishedAt: string | null;
  resultSummary: string;
  evidenceFile: string | null;
};

export type AdminSafetyFinding = {
  id: string;
  area: string;
  finding: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'reviewed' | 'accepted' | 'closed';
  recommendation: string;
  owner: string;
};

export type TranslationDictionaryRow = {
  key: string;
  englishLabel: string;
  arabicLabel: string;
  category: string;
  isCore: boolean;
  status: 'complete' | 'missing_ar' | 'missing_en' | 'needs_review';
};

const liveEmptySummary: UltraReleaseSummary = emptyLiveObject<UltraReleaseSummary>('liveEmptySummary');

const liveEmptyChecklist: ProductionChecklistItem[] = emptyLiveArray<ProductionChecklistItem>();

const liveEmptyMigrations: MigrationVerificationItem[] = emptyLiveArray<MigrationVerificationItem>();

const liveEmptyRestore: RestoreDryRunItem[] = emptyLiveArray<RestoreDryRunItem>();

const liveEmptySafety: AdminSafetyFinding[] = emptyLiveArray<AdminSafetyFinding>();

export const liveEmptyDictionary: TranslationDictionaryRow[] = emptyLiveArray<TranslationDictionaryRow>();

function warnFallback(context: string, error: unknown) {
  console.warn(`[GRC] returning empty live data ${context}`, error);
}

export async function getUltraReleaseSummary(): Promise<UltraReleaseSummary> {
  if (!supabase) return emptyLiveObject<UltraReleaseSummary>('getUltraReleaseSummary');
  try {
    const { data, error } = await supabase.from('v_ultra_release_summary').select('*').limit(1);
    if (error) throw error;
    const row = data?.[0] as any;
    if (!row) return emptyLiveObject<UltraReleaseSummary>('getUltraReleaseSummary');
    return {
      releaseScore: row.release_score ?? 0,
      blockerCount: row.blocker_count ?? 0,
      warningCount: row.warning_count ?? 0,
      lastBackupAt: row.last_backup_at,
      lastRestoreDryRunAt: row.last_restore_dry_run_at,
      migrationsExpected: row.migrations_expected ?? 0,
      migrationsVerified: row.migrations_verified ?? 0,
      translationCoverage: row.translation_coverage ?? 0,
      adminLocksActive: row.admin_locks_active ?? 0
    };
  } catch (error) {
    warnFallback('ultra release summary', error);
    return emptyLiveObject<UltraReleaseSummary>('getUltraReleaseSummary');
  }
}

export async function getProductionChecklist(): Promise<ProductionChecklistItem[]> {
  if (!supabase) return emptyLiveArray<any>();
  try {
    const { data, error } = await supabase.from('v_production_cutover_checklist').select('*').order('sort_order');
    if (error) throw error;
    if (!data?.length) return emptyLiveArray<any>();
    return (data as any[]).map(row => ({
      id: row.id,
      phase: row.phase,
      item: row.item,
      status: row.status,
      owner: row.owner || 'Unassigned',
      evidence: row.evidence || '—',
      notes: row.notes || '',
      sortOrder: row.sort_order ?? 99
    }));
  } catch (error) {
    warnFallback('production checklist', error);
    return emptyLiveArray<any>();
  }
}

export async function getMigrationVerification(): Promise<MigrationVerificationItem[]> {
  if (!supabase) return emptyLiveArray<any>();
  try {
    const { data, error } = await supabase.from('v_migration_verification_matrix').select('*').order('sequence_no');
    if (error) throw error;
    if (!data?.length) return emptyLiveArray<any>();
    return (data as any[]).map(row => ({
      sequenceNo: row.sequence_no,
      migrationFile: row.migration_file,
      purpose: row.purpose || '',
      expected: Boolean(row.expected),
      verified: Boolean(row.verified),
      status: row.status || 'pending',
      verificationNote: row.verification_note || ''
    }));
  } catch (error) {
    warnFallback('migration verification', error);
    return emptyLiveArray<any>();
  }
}

export async function getRestoreDryRuns(): Promise<RestoreDryRunItem[]> {
  if (!supabase) return emptyLiveArray<any>();
  try {
    const { data, error } = await supabase.from('v_backup_restore_drillboard').select('*').order('started_at', { ascending: false, nullsFirst: false }).limit(100);
    if (error) throw error;
    if (!data?.length) return emptyLiveArray<any>();
    return (data as any[]).map(row => ({
      id: row.id,
      backupPackageId: row.backup_package_id || '—',
      scenarioName: row.scenario_name || 'Restore dry-run',
      status: row.status || 'planned',
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      resultSummary: row.result_summary || '',
      evidenceFile: row.evidence_file || null
    }));
  } catch (error) {
    warnFallback('restore dry-runs', error);
    return emptyLiveArray<any>();
  }
}

export async function getAdminSafetyFindings(): Promise<AdminSafetyFinding[]> {
  if (!supabase) return emptyLiveArray<any>();
  try {
    const { data, error } = await supabase.from('v_admin_safety_console').select('*').order('severity_rank');
    if (error) throw error;
    if (!data?.length) return emptyLiveArray<any>();
    return (data as any[]).map(row => ({
      id: row.id,
      area: row.area,
      finding: row.finding,
      severity: row.severity || 'medium',
      status: row.status || 'open',
      recommendation: row.recommendation || '',
      owner: row.owner || 'Unassigned'
    }));
  } catch (error) {
    warnFallback('admin safety findings', error);
    return emptyLiveArray<any>();
  }
}

export async function getTranslationDictionary(): Promise<TranslationDictionaryRow[]> {
  if (!supabase) return emptyLiveArray<any>();
  try {
    const { data, error } = await supabase.from('v_bilingual_dictionary_status').select('*').order('category').order('key');
    if (error) throw error;
    if (!data?.length) return emptyLiveArray<any>();
    return (data as any[]).map(row => ({
      key: row.key,
      englishLabel: row.english_label || '',
      arabicLabel: row.arabic_label || '',
      category: row.category || 'general',
      isCore: Boolean(row.is_core),
      status: row.status || 'needs_review'
    }));
  } catch (error) {
    warnFallback('translation dictionary', error);
    return emptyLiveArray<any>();
  }
}

export async function startRestoreDryRun(scenarioName: string): Promise<void> {
  if (!supabase) return;
  void scenarioName;
  requireServerBridge('Restore dry-run start', 'start_restore_dry_run');
}

export async function runReleasePreflight(): Promise<void> {
  if (!supabase) return;
  requireServerBridge('Ultra release preflight', 'run_ultra_release_preflight');
}
