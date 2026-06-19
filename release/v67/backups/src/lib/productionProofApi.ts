import { supabase } from './supabase';

type DbRow = Record<string, any>;
const toCamelKey = (key: string) => key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
function camel<T>(row: DbRow): T {
  const mapped: DbRow = {};
  Object.entries(row).forEach(([key, value]) => { mapped[toCamelKey(key)] = value; });
  return mapped as T;
}

async function selectView<T>(viewName: string, fallback: T[], options?: { order?: string; ascending?: boolean; limit?: number }) {
  if (!supabase) return fallback;
  let query = supabase.from(viewName).select('*');
  if (options?.order) query = query.order(options.order, { ascending: options.ascending ?? true });
  if (options?.limit) query = query.limit(options.limit);
  const { data, error } = await query;
  if (error) {
    console.warn(`[${viewName}] using fallback`, error.message);
    return fallback;
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

const fallbackScorecard: ProofScorecard = {
  organizationId: 'demo-org',
  releaseTag: 'v3.3-production-proof',
  proofScore: 86,
  goLiveSignal: 'conditional',
  totalGates: 14,
  passedGates: 8,
  blockedGates: 1,
  warningGates: 3,
  pendingGates: 2,
  hardGates: 6,
  consolidatedArtifacts: 7,
  pilotWaveReady: 2,
  unsafeToLaunch: 1,
};

const fallbackGates: ProofGate[] = [
  { id: 'pg-1', gateCode: 'CLEAN-REPO', gateGroup: 'consolidation', title: 'Clean local repository prepared', description: 'All patches applied in one working tree and no duplicate/obsolete pages are left in the primary navigation.', status: 'passed', severity: 'hard_gate', ownerLabel: 'System Admin', proofRequired: 'Git commit hash, build output and route audit.', fastAction: 'Apply patches in order, run npm run final:all, commit the clean tree.', sequenceNo: 10 },
  { id: 'pg-2', gateCode: 'FRESH-SUPABASE', gateGroup: 'database', title: 'Fresh Supabase install verified', description: 'The consolidated migration bundle runs cleanly in a new Supabase project.', status: 'blocked', severity: 'hard_gate', ownerLabel: 'IT / Supabase Admin', proofRequired: 'Screenshot/export of successful SQL execution and seed RPC.', fastAction: 'Run supabase/_consolidated/ALL_MIGRATIONS_ORDERED.sql in staging.', sequenceNo: 20 },
  { id: 'pg-3', gateCode: 'RLS-PERSONAS', gateGroup: 'security', title: 'RLS personas proven with real accounts', description: 'Executive, department manager, quality, auditor and employee accounts see only their allowed scope.', status: 'warning', severity: 'hard_gate', ownerLabel: 'Access Admin', proofRequired: 'Persona test evidence and sign-off.', fastAction: 'Run RLS Persona Lab scenarios with real test users.', sequenceNo: 30 },
  { id: 'pg-4', gateCode: 'OVR-PILOT', gateGroup: 'quality', title: 'OVR workflow pilot accepted', description: 'One OVR passes from reporter to HOD investigation, Quality review, corrective action, evidence and closure.', status: 'warning', severity: 'hard_gate', ownerLabel: 'Quality Manager', proofRequired: 'Closed test OVR and evidence review.', fastAction: 'Run the OVR acceptance script with Nursing/Pharmacy/Quality.', sequenceNo: 40 },
  { id: 'pg-5', gateCode: 'BACKUP-RESTORE', gateGroup: 'backup', title: 'Backup and restore dry-run completed', description: 'Export package, database backup strategy, and restore dry-run are documented.', status: 'warning', severity: 'hard_gate', ownerLabel: 'IT / Governance', proofRequired: 'Restore dry-run log and backup location.', fastAction: 'Run export center, document Supabase backup plan, perform restore dry-run.', sequenceNo: 50 },
  { id: 'pg-6', gateCode: 'PILOT-WAVE', gateGroup: 'rollout', title: 'Pilot wave approved before all-staff rollout', description: 'First pilot group is limited and named before scaling to 1,000 users.', status: 'pending', severity: 'hard_gate', ownerLabel: 'Executive Sponsor', proofRequired: 'Pilot list and go/no-go approval.', fastAction: 'Approve 20–50 pilot users first, not the full company.', sequenceNo: 60 },
  { id: 'pg-7', gateCode: 'AR-RTL-VISIBLE', gateGroup: 'bilingual', title: 'Arabic/RTL critical screens checked', description: 'Home, OVR, dashboards, export, reports and admin screens are reviewed visually in Arabic.', status: 'pending', severity: 'critical', ownerLabel: 'Governance Admin', proofRequired: 'Translation coverage and screenshots.', fastAction: 'Use Translation Coverage Center and Arabic walkthrough.', sequenceNo: 70 },
];

const fallbackArtifacts: ProofArtifact[] = [
  { id: 'pa-1', artifactCode: 'SOURCE-ZIP', title: 'Final source repository bundle', artifactType: 'source', status: 'draft', targetPath: 'release/grc-control-center-final-source.zip', ownerLabel: 'System Admin', requiredForPilot: true, sequenceNo: 10 },
  { id: 'pa-2', artifactCode: 'MIGRATION-BUNDLE', title: 'Ordered SQL migration bundle', artifactType: 'database', status: 'generated', targetPath: 'supabase/_consolidated/ALL_MIGRATIONS_ORDERED.sql', ownerLabel: 'System Admin', requiredForPilot: true, sequenceNo: 20 },
  { id: 'pa-3', artifactCode: 'RLS-EVIDENCE', title: 'RLS persona evidence pack', artifactType: 'security', status: 'draft', targetPath: 'release/evidence/rls-persona-pack', ownerLabel: 'Access Admin', requiredForPilot: true, sequenceNo: 30 },
  { id: 'pa-4', artifactCode: 'OVR-EVIDENCE', title: 'OVR end-to-end acceptance evidence', artifactType: 'quality', status: 'draft', targetPath: 'release/evidence/ovr-workflow-pack', ownerLabel: 'Quality Manager', requiredForPilot: true, sequenceNo: 40 },
  { id: 'pa-5', artifactCode: 'BACKUP-PROOF', title: 'Backup and restore proof package', artifactType: 'backup', status: 'draft', targetPath: 'release/evidence/backup-restore-pack', ownerLabel: 'IT / Governance', requiredForPilot: true, sequenceNo: 50 },
];

const fallbackPilotWaves: PilotWave[] = [
  { id: 'pw-1', waveCode: 'WAVE-0', title: 'Core admin smoke test', participantScope: 'System admin, Governance admin, Quality manager, IT', status: 'ready', acceptanceOwner: 'System Admin', successCriteria: 'Login, dashboard, OVR form, export, RLS smoke and backup export pass.', sequenceNo: 10 },
  { id: 'pw-2', waveCode: 'WAVE-1', title: 'Leadership and control owners', participantScope: 'Executive, Finance, HR, Quality, Audit, selected managers', status: 'ready', acceptanceOwner: 'Executive Sponsor', successCriteria: 'No hard blocker for one working week.', sequenceNo: 20 },
  { id: 'pw-3', waveCode: 'WAVE-2', title: 'Department manager pilot', participantScope: '10 departments / 50–100 users', status: 'not_started', acceptanceOwner: 'Governance Admin', successCriteria: 'Department scope and task/evidence flow accepted.', sequenceNo: 30 },
  { id: 'pw-4', waveCode: 'WAVE-3', title: 'All-staff limited actions', participantScope: 'All employees with assigned-only access', status: 'not_started', acceptanceOwner: 'Executive Sponsor', successCriteria: 'Employee workspace and OVR reporting are stable.', sequenceNo: 40 },
];

export async function getProductionProofData(): Promise<ProofData> {
  const [scoreRows, gates, artifacts, pilotWaves] = await Promise.all([
    selectView<ProofScorecard>('v_v33_production_proof_scorecard', [fallbackScorecard], { limit: 1 }),
    selectView<ProofGate>('v_v33_production_proof_gates', fallbackGates, { order: 'sequence_no', ascending: true }),
    selectView<ProofArtifact>('v_v33_production_artifacts', fallbackArtifacts, { order: 'sequence_no', ascending: true }),
    selectView<PilotWave>('v_v33_pilot_waves', fallbackPilotWaves, { order: 'sequence_no', ascending: true }),
  ]);

  return { scorecard: scoreRows[0] ?? fallbackScorecard, gates, artifacts, pilotWaves };
}

export async function seedProductionProofDefaults() {
  if (!supabase) return { seeded: false, message: 'Supabase is not configured. Demo fallback data is shown.' };
  const { data, error } = await supabase.rpc('seed_v33_production_proof_defaults');
  if (error) throw new Error(error.message);
  return { seeded: true, message: typeof data === 'string' ? data : 'Production proof defaults seeded.' };
}
