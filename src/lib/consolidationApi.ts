import { supabase } from './supabase';
import { emptyLiveObject, emptyLiveArray } from './liveData';
import { requireServerBridge } from './privilegedAction';

export type ReleaseFactoryScorecard = {
  organizationId: string;
  releaseTag: string;
  finalScore: number;
  readySignal: 'go' | 'conditional' | 'blocked';
  totalChecks: number;
  passedChecks: number;
  blockedChecks: number;
  warningChecks: number;
  pendingChecks: number;
  migrationChecks: number;
  rlsChecks: number;
  backupChecks: number;
  bilingualChecks: number;
  uiChecks: number;
  handoverChecks: number;
};

export type ReleaseFactoryCheck = {
  id: string;
  checkCode: string;
  checkGroup: string;
  title: string;
  description: string | null;
  ownerLabel: string | null;
  status: 'pending' | 'in_progress' | 'passed' | 'warning' | 'blocked' | 'accepted_risk' | 'not_applicable';
  severity: 'critical' | 'high' | 'medium' | 'low';
  evidenceRequired: boolean;
  evidenceNote: string | null;
  sequenceNo: number;
};

export type ConsolidatedPackage = {
  id: string;
  packageCode: string;
  title: string;
  packageType: string;
  status: 'draft' | 'generated' | 'verified' | 'approved' | 'blocked';
  filePath: string | null;
  checksumNote: string | null;
  ownerLabel: string | null;
  generatedAt: string | null;
  verifiedAt: string | null;
};

export type HandoverSignoff = {
  id: string;
  signoffArea: string;
  ownerLabel: string;
  status: 'not_started' | 'in_progress' | 'signed_off' | 'blocked' | 'accepted_risk';
  evidenceNote: string | null;
  signedAt: string | null;
  sequenceNo: number;
};

export type ReleaseFactoryData = {
  scorecard: ReleaseFactoryScorecard;
  checks: ReleaseFactoryCheck[];
  packages: ConsolidatedPackage[];
  signoffs: HandoverSignoff[];
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
  if (options?.order) query = query.order(options.order, { ascending: options.ascending ?? true });
  if (options?.limit) query = query.limit(options.limit);
  const { data, error } = await query;
  if (error) {
    console.warn(`[${viewName}] returning empty live data`, error.message);
    return emptyRows;
  }
  return (data ?? []).map(row => camel<T>(row));
}

const liveEmptyScorecard: ReleaseFactoryScorecard = emptyLiveObject<ReleaseFactoryScorecard>('liveEmptyScorecard');

const liveEmptyChecks: ReleaseFactoryCheck[] = emptyLiveArray<ReleaseFactoryCheck>();

const liveEmptyPackages: ConsolidatedPackage[] = emptyLiveArray<ConsolidatedPackage>();

const liveEmptySignoffs: HandoverSignoff[] = emptyLiveArray<HandoverSignoff>();

export async function getReleaseFactoryData(): Promise<ReleaseFactoryData> {
  const [scoreRows, checks, packages, signoffs] = await Promise.all([
    selectView<ReleaseFactoryScorecard>('v_release_factory_scorecard', [liveEmptyScorecard], { limit: 1 }),
    selectView<ReleaseFactoryCheck>('v_release_factory_checks', liveEmptyChecks, { order: 'sequence_no', ascending: true }),
    selectView<ConsolidatedPackage>('v_consolidated_release_packages', liveEmptyPackages, { order: 'package_code', ascending: true }),
    selectView<HandoverSignoff>('v_final_handover_signoffs', liveEmptySignoffs, { order: 'sequence_no', ascending: true })
  ]);

  return {
    scorecard: scoreRows[0] ?? liveEmptyScorecard,
    checks,
    packages,
    signoffs,
  };
}

export async function seedReleaseFactoryDefaults() {
  if (!supabase) return { seeded: false, message: 'Supabase is not configured. Live data is unavailable.' };
  return requireServerBridge(
    'Release factory default seeding',
    'seed_release_factory_defaults',
  );
}
