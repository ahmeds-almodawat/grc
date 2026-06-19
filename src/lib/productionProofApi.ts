import { supabase } from './supabase';
import { emptyLiveObject, emptyLiveArray } from './liveData';
import { requireServerBridge } from './privilegedAction';

type DbRow = Record<string, any>;
const toCamelKey = (key: string) => key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
function camel<T>(row: DbRow): T {
  const mapped: DbRow = {};
  Object.entries(row).forEach(([key, value]) => { mapped[toCamelKey(key)] = value; });
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

export type ProofScorecard = {
  organizationId: string;
  releaseTag: string;
  proofScore: number;
  goLiveSignal: 'go' | 'conditional' | 'blocked';
  totalGates: number;
  passedGates: number;
  blockedGates: number;
  warningGates: number;
  pendingGates: number;
  hardGates: number;
  consolidatedArtifacts: number;
  pilotWaveReady: number;
  unsafeToLaunch: number;
};

export type ProofGate = {
  id: string;
  gateCode: string;
  gateGroup: string;
  title: string;
  description: string | null;
  status: 'pending' | 'in_progress' | 'passed' | 'warning' | 'blocked' | 'accepted_risk' | 'not_applicable';
  severity: 'hard_gate' | 'critical' | 'high' | 'medium' | 'low';
  ownerLabel: string | null;
  proofRequired: string | null;
  fastAction: string | null;
  sequenceNo: number;
};

export type ProofArtifact = {
  id: string;
  artifactCode: string;
  title: string;
  artifactType: string;
  status: 'missing' | 'draft' | 'generated' | 'verified' | 'approved' | 'archived';
  targetPath: string | null;
  ownerLabel: string | null;
  requiredForPilot: boolean;
  sequenceNo: number;
};

export type PilotWave = {
  id: string;
  waveCode: string;
  title: string;
  participantScope: string | null;
  status: 'not_started' | 'ready' | 'in_progress' | 'accepted' | 'blocked';
  acceptanceOwner: string | null;
  successCriteria: string | null;
  sequenceNo: number;
};

export type ProofData = {
  scorecard: ProofScorecard;
  gates: ProofGate[];
  artifacts: ProofArtifact[];
  pilotWaves: PilotWave[];
};

const liveEmptyScorecard: ProofScorecard = emptyLiveObject<ProofScorecard>('liveEmptyScorecard');

const liveEmptyGates: ProofGate[] = emptyLiveArray<ProofGate>();

const liveEmptyArtifacts: ProofArtifact[] = emptyLiveArray<ProofArtifact>();

const liveEmptyPilotWaves: PilotWave[] = emptyLiveArray<PilotWave>();

export async function getProductionProofData(): Promise<ProofData> {
  const [scoreRows, gates, artifacts, pilotWaves] = await Promise.all([
    selectView<ProofScorecard>('v_v33_production_proof_scorecard', [liveEmptyScorecard], { limit: 1 }),
    selectView<ProofGate>('v_v33_production_proof_gates', liveEmptyGates, { order: 'sequence_no', ascending: true }),
    selectView<ProofArtifact>('v_v33_production_artifacts', liveEmptyArtifacts, { order: 'sequence_no', ascending: true }),
    selectView<PilotWave>('v_v33_pilot_waves', liveEmptyPilotWaves, { order: 'sequence_no', ascending: true }),
  ]);

  return { scorecard: scoreRows[0] ?? liveEmptyScorecard, gates, artifacts, pilotWaves };
}

export async function seedProductionProofDefaults() {
  if (!supabase) return { seeded: false, message: 'Supabase is not configured. Live data is unavailable.' };
  return requireServerBridge(
    'Production proof default seeding',
    'seed_v33_production_proof_defaults',
  );
}
