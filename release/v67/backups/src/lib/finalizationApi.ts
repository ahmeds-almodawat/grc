import { supabase } from './supabase';

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

const fallbackScorecard: FinalScorecard = {
  organizationId: 'demo-org',
  releaseTag: 'v3.0-rc-final-sprint',
  goLiveScore: 78,
  blockers: 2,
  warnings: 5,
  passed: 18,
  pending: 7,
  migrationBlocked: 1,
  rlsBlocked: 1,
  backupBlocked: 1,
  bilingualWarnings: 2,
  openCriticalIssues: 1,
  openHighIssues: 3,
  readySignal: 'conditional'
};

const fallbackGates: FinalGate[] = [
  { id: 'gate-1', gateCode: 'MIG-FRESH-001-026', gateGroup: 'migration', title: 'Fresh Supabase migration run from 001 to 026', description: 'Run every migration in a clean staging project and record evidence.', ownerLabel: 'System Admin', severity: 'critical', status: 'blocked', evidenceRequired: true, evidenceNote: 'Migration verifier screenshot required.', targetDate: '2026-07-01', sequenceNo: 10, goLiveBlocking: true, gateWeight: 100 },
  { id: 'gate-2', gateCode: 'RLS-PERSONA-MATRIX', gateGroup: 'security', title: 'RLS persona matrix completed', description: 'CEO, Governance, Department Manager, Quality, Auditor, Employee personas tested.', ownerLabel: 'Access Control Admin', severity: 'critical', status: 'blocked', evidenceRequired: true, evidenceNote: 'Persona lab export required.', targetDate: '2026-07-02', sequenceNo: 20, goLiveBlocking: true, gateWeight: 100 },
  { id: 'gate-3', gateCode: 'BACKUP-RESTORE-DRYRUN', gateGroup: 'backup', title: 'Backup and restore dry-run completed', description: 'Browser export is not enough; database and storage restore evidence required.', ownerLabel: 'IT / Governance', severity: 'critical', status: 'warning', evidenceRequired: true, evidenceNote: 'Restore dry-run record required.', targetDate: '2026-07-03', sequenceNo: 30, goLiveBlocking: true, gateWeight: 80 },
  { id: 'gate-4', gateCode: 'AR-RTL-FINAL-QA', gateGroup: 'bilingual', title: 'Arabic/RTL final QA completed', description: 'Review high-traffic pages, OVR, reports and print layouts.', ownerLabel: 'Governance Admin', severity: 'high', status: 'warning', evidenceRequired: true, evidenceNote: 'Translation coverage export.', targetDate: '2026-07-04', sequenceNo: 40, goLiveBlocking: false, gateWeight: 60 },
  { id: 'gate-5', gateCode: 'OVR-END-TO-END', gateGroup: 'quality', title: 'OVR end-to-end scenario passed', description: 'Reporter to Supervisor/HOD to Quality to corrective action to evidence closure.', ownerLabel: 'Quality Manager', severity: 'critical', status: 'pending', evidenceRequired: true, evidenceNote: 'OVR workflow screenshot required.', targetDate: '2026-07-05', sequenceNo: 50, goLiveBlocking: true, gateWeight: 70 }
];

const fallbackCutover: FinalCutoverTask[] = [
  { id: 'cut-1', phaseName: 'T-7 days', sequenceNo: 10, title: 'Freeze migrations and create final consolidated release ZIP', ownerLabel: 'System Admin', plannedWindow: 'One week before go-live', rollbackNote: 'Rollback to last validated patch set.', status: 'not_started', isCritical: true, evidenceNote: 'Final ZIP checksum and migration list.' },
  { id: 'cut-2', phaseName: 'T-3 days', sequenceNo: 20, title: 'Run backup/export package and database/storage backup', ownerLabel: 'IT / Governance', plannedWindow: 'Three days before go-live', rollbackNote: 'Restore staging from backup to confirm viability.', status: 'not_started', isCritical: true, evidenceNote: 'Backup run IDs and restore dry-run.' },
  { id: 'cut-3', phaseName: 'T-1 day', sequenceNo: 30, title: 'Run acceptance test script with five key personas', ownerLabel: 'Governance Admin', plannedWindow: 'One day before go-live', rollbackNote: 'Delay rollout if any critical persona fails.', status: 'not_started', isCritical: true, evidenceNote: 'QA export signed off.' },
  { id: 'cut-4', phaseName: 'Go-live day', sequenceNo: 40, title: 'Enable production access for pilot departments only', ownerLabel: 'Super Admin', plannedWindow: 'Morning go-live window', rollbackNote: 'Disable invitations and restore previous access list.', status: 'not_started', isCritical: true, evidenceNote: 'Pilot access list.' },
  { id: 'cut-5', phaseName: 'T+7 days', sequenceNo: 50, title: 'Review incidents, performance, access warnings and user feedback', ownerLabel: 'Executive Sponsor', plannedWindow: 'First week review', rollbackNote: 'Pause rollout wave 2 if blockers remain.', status: 'not_started', isCritical: false, evidenceNote: 'Week-one executive report.' }
];

const fallbackTests: FinalAcceptanceTest[] = [
  { id: 'test-1', testCode: 'EMP-MYWORK-ONLY', testArea: 'rls', title: 'Employee sees only assigned tasks and own submitted OVRs', persona: 'employee', expectedResult: 'No executive, other department or confidential OVR data is visible.', status: 'not_run', isCritical: true, evidenceNote: null, failureNote: null },
  { id: 'test-2', testCode: 'DEPT-SCOPE', testArea: 'rls', title: 'Department Manager sees department scope only', persona: 'department_manager', expectedResult: 'Own department data visible; unrelated department data hidden.', status: 'not_run', isCritical: true, evidenceNote: null, failureNote: null },
  { id: 'test-3', testCode: 'OVR-QUALITY-CLOSE', testArea: 'ovr', title: 'Quality-only OVR closure with accepted evidence', persona: 'quality', expectedResult: 'Closure blocked until evidence and Quality closure comments exist.', status: 'not_run', isCritical: true, evidenceNote: null, failureNote: null },
  { id: 'test-4', testCode: 'NO-SELF-APPROVAL', testArea: 'workflow', title: 'Self-approval is blocked', persona: 'project_owner', expectedResult: 'Owner cannot approve own request.', status: 'not_run', isCritical: true, evidenceNote: null, failureNote: null },
  { id: 'test-5', testCode: 'EXPORT-BACKUP-HEALTH', testArea: 'backup', title: 'Export package and backup health snapshot created', persona: 'governance_admin', expectedResult: 'External package generated and restore dry-run plan documented.', status: 'warning', isCritical: true, evidenceNote: 'Demo export only.', failureNote: 'Production DB/storage backup still needed.' }
];

const fallbackOwnerClearance: FinalOwnerClearance[] = [
  { ownerLabel: 'System Admin', totalItems: 6, blockedItems: 1, warningItems: 1, passedItems: 2, pendingItems: 2, clearanceSignal: 'blocked' },
  { ownerLabel: 'Governance Admin', totalItems: 8, blockedItems: 0, warningItems: 2, passedItems: 3, pendingItems: 3, clearanceSignal: 'watch' },
  { ownerLabel: 'Quality Manager', totalItems: 4, blockedItems: 0, warningItems: 1, passedItems: 1, pendingItems: 2, clearanceSignal: 'watch' },
  { ownerLabel: 'IT / Governance', totalItems: 5, blockedItems: 1, warningItems: 1, passedItems: 1, pendingItems: 2, clearanceSignal: 'blocked' }
];

const fallbackArtifacts: FinalConsolidationArtifact[] = [
  { id: 'art-1', artifactCode: 'FINAL-ZIP', title: 'Final consolidated release ZIP', artifactType: 'release_package', status: 'draft', ownerLabel: 'System Admin', filePath: null, verificationNote: 'Create after migration run is verified.' },
  { id: 'art-2', artifactCode: 'MIGRATION-ORDER', title: 'Migration order and verification runbook', artifactType: 'runbook', status: 'ready', ownerLabel: 'System Admin', filePath: 'docs/FRESH_INSTALL_MIGRATION_ORDER.md', verificationNote: 'Included in patch.' },
  { id: 'art-3', artifactCode: 'ACCEPTANCE-SCRIPT', title: 'Final acceptance test script', artifactType: 'qa_script', status: 'ready', ownerLabel: 'Governance Admin', filePath: 'docs/ACCEPTANCE_TEST_SCRIPT.md', verificationNote: 'Included in patch.' },
  { id: 'art-4', artifactCode: 'CUTOVER-PLAYBOOK', title: 'Go-live cutover playbook', artifactType: 'playbook', status: 'ready', ownerLabel: 'Executive Sponsor', filePath: 'docs/FINAL_GO_LIVE_PLAYBOOK.md', verificationNote: 'Included in patch.' }
];

export async function getFinalizationData(): Promise<FinalizationData> {
  const [scoreRows, gates, cutover, tests, ownerClearance, artifacts] = await Promise.all([
    selectView<FinalScorecard>('v_final_finish_fast_scorecard', [fallbackScorecard], { limit: 1 }),
    selectView<FinalGate>('v_final_go_live_gateboard', fallbackGates, { order: 'sequence_no', ascending: true }),
    selectView<FinalCutoverTask>('v_final_cutover_plan', fallbackCutover, { order: 'sequence_no', ascending: true }),
    selectView<FinalAcceptanceTest>('v_final_acceptance_tests', fallbackTests, { order: 'test_code', ascending: true }),
    selectView<FinalOwnerClearance>('v_final_owner_clearance', fallbackOwnerClearance, { order: 'blocked_items', ascending: false }),
    selectView<FinalConsolidationArtifact>('v_final_consolidation_artifacts', fallbackArtifacts, { order: 'artifact_code', ascending: true })
  ]);

  return {
    scorecard: scoreRows[0] ?? fallbackScorecard,
    gates,
    cutover,
    tests,
    ownerClearance,
    artifacts
  };
}

export async function seedFinalReleaseDefaults() {
  if (!supabase) return { seeded: false, message: 'Supabase is not configured. Demo fallback data is shown.' };
  const { data, error } = await supabase.rpc('seed_final_release_defaults');
  if (error) throw new Error(error.message);
  return { seeded: true, message: typeof data === 'string' ? data : 'Final release defaults seeded.' };
}
