import { supabase } from './supabase';
import { emptyLiveObject, emptyLiveArray } from './liveData';
import { requireServerBridge } from './privilegedAction';

export type FinalScorecard = {
  organizationId: string;
  releaseTag: string;
  goLiveScore: number;
  blockers: number;
  warnings: number;
  passed: number;
  pending: number;
  migrationBlocked: number;
  rlsBlocked: number;
  backupBlocked: number;
  bilingualWarnings: number;
  openCriticalIssues: number;
  openHighIssues: number;
  readySignal: 'ready' | 'conditional' | 'blocked';
};

export type FinalGate = {
  id: string;
  gateCode: string;
  gateGroup: string;
  title: string;
  description: string | null;
  ownerLabel: string | null;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'pass' | 'warning' | 'blocked' | 'accepted_risk' | 'not_applicable';
  evidenceRequired: boolean;
  evidenceNote: string | null;
  targetDate: string | null;
  sequenceNo: number;
  goLiveBlocking: boolean;
  gateWeight: number;
};

export type FinalCutoverTask = {
  id: string;
  phaseName: string;
  sequenceNo: number;
  title: string;
  ownerLabel: string | null;
  plannedWindow: string | null;
  rollbackNote: string | null;
  status: 'not_started' | 'ready' | 'in_progress' | 'done' | 'blocked' | 'cancelled';
  isCritical: boolean;
  evidenceNote: string | null;
};

export type FinalAcceptanceTest = {
  id: string;
  testCode: string;
  testArea: string;
  title: string;
  persona: string | null;
  expectedResult: string;
  status: 'not_run' | 'pass' | 'fail' | 'warning' | 'blocked';
  isCritical: boolean;
  evidenceNote: string | null;
  failureNote: string | null;
};

export type FinalOwnerClearance = {
  ownerLabel: string;
  totalItems: number;
  blockedItems: number;
  warningItems: number;
  passedItems: number;
  pendingItems: number;
  clearanceSignal: 'clear' | 'watch' | 'blocked';
};

export type FinalConsolidationArtifact = {
  id: string;
  artifactCode: string;
  title: string;
  artifactType: string;
  status: 'draft' | 'ready' | 'verified' | 'blocked' | 'archived';
  ownerLabel: string | null;
  filePath: string | null;
  verificationNote: string | null;
};

export type FinalizationData = {
  scorecard: FinalScorecard;
  gates: FinalGate[];
  cutover: FinalCutoverTask[];
  tests: FinalAcceptanceTest[];
  ownerClearance: FinalOwnerClearance[];
  artifacts: FinalConsolidationArtifact[];
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

const liveEmptyScorecard: FinalScorecard = emptyLiveObject<FinalScorecard>('liveEmptyScorecard');

const liveEmptyGates: FinalGate[] = emptyLiveArray<FinalGate>();

const liveEmptyCutover: FinalCutoverTask[] = emptyLiveArray<FinalCutoverTask>();

const liveEmptyTests: FinalAcceptanceTest[] = emptyLiveArray<FinalAcceptanceTest>();

const liveEmptyOwnerClearance: FinalOwnerClearance[] = emptyLiveArray<FinalOwnerClearance>();

const liveEmptyArtifacts: FinalConsolidationArtifact[] = emptyLiveArray<FinalConsolidationArtifact>();

export async function getFinalizationData(): Promise<FinalizationData> {
  const [scoreRows, gates, cutover, tests, ownerClearance, artifacts] = await Promise.all([
    selectView<FinalScorecard>('v_final_finish_fast_scorecard', [liveEmptyScorecard], { limit: 1 }),
    selectView<FinalGate>('v_final_go_live_gateboard', liveEmptyGates, { order: 'sequence_no', ascending: true }),
    selectView<FinalCutoverTask>('v_final_cutover_plan', liveEmptyCutover, { order: 'sequence_no', ascending: true }),
    selectView<FinalAcceptanceTest>('v_final_acceptance_tests', liveEmptyTests, { order: 'test_code', ascending: true }),
    selectView<FinalOwnerClearance>('v_final_owner_clearance', liveEmptyOwnerClearance, { order: 'blocked_items', ascending: false }),
    selectView<FinalConsolidationArtifact>('v_final_consolidation_artifacts', liveEmptyArtifacts, { order: 'artifact_code', ascending: true })
  ]);

  return {
    scorecard: scoreRows[0] ?? liveEmptyScorecard,
    gates,
    cutover,
    tests,
    ownerClearance,
    artifacts
  };
}

export async function seedFinalReleaseDefaults() {
  if (!supabase) return { seeded: false, message: 'Supabase is not configured. Live data is unavailable.' };
  return requireServerBridge(
    'Final release default seeding',
    'seed_final_release_defaults',
  );
}
