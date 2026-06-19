import { supabase } from './supabase';

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

const fallbackScorecard: ReleaseFactoryScorecard = {
  organizationId: 'demo-org',
  releaseTag: 'v3.2-final-release-factory',
  finalScore: 82,
  readySignal: 'conditional',
  totalChecks: 16,
  passedChecks: 9,
  blockedChecks: 2,
  warningChecks: 3,
  pendingChecks: 2,
  migrationChecks: 3,
  rlsChecks: 3,
  backupChecks: 2,
  bilingualChecks: 2,
  uiChecks: 3,
  handoverChecks: 3,
};

const fallbackChecks: ReleaseFactoryCheck[] = [
  { id: 'rf-1', checkCode: 'CODEBASE-CONSOLIDATED', checkGroup: 'consolidation', title: 'Single clean codebase created from all patches', description: 'Apply patches in order and remove obsolete duplicate files before pilot.', ownerLabel: 'System Admin', status: 'pending', severity: 'critical', evidenceRequired: true, evidenceNote: 'Final repository commit hash and build output.', sequenceNo: 10 },
  { id: 'rf-2', checkCode: 'MIGRATIONS-BUNDLED', checkGroup: 'migration', title: 'Migrations bundled and verified in order', description: 'Generate migration manifest and run in a fresh Supabase staging project.', ownerLabel: 'System Admin', status: 'blocked', severity: 'critical', evidenceRequired: true, evidenceNote: 'Run npm run migrations:bundle then verify in Supabase.', sequenceNo: 20 },
  { id: 'rf-3', checkCode: 'RLS-PERSONA-PASS', checkGroup: 'security', title: 'RLS personas passed', description: 'Employee, Department Manager, Quality, Auditor and Executive scopes must be tested.', ownerLabel: 'Access Admin', status: 'blocked', severity: 'critical', evidenceRequired: true, evidenceNote: 'Persona lab export and screenshots.', sequenceNo: 30 },
  { id: 'rf-4', checkCode: 'OVR-END-TO-END-PASS', checkGroup: 'quality', title: 'OVR workflow end-to-end passed', description: 'Reporter → HOD → Quality → action project → evidence → Quality closure.', ownerLabel: 'Quality Manager', status: 'warning', severity: 'critical', evidenceRequired: true, evidenceNote: 'One real test OVR closure package.', sequenceNo: 40 },
  { id: 'rf-5', checkCode: 'BACKUP-RESTORE-PROVED', checkGroup: 'backup', title: 'Backup and restore proved', description: 'Browser export plus database and storage backup dry-run.', ownerLabel: 'IT / Governance', status: 'warning', severity: 'critical', evidenceRequired: true, evidenceNote: 'Restore dry-run record.', sequenceNo: 50 },
  { id: 'rf-6', checkCode: 'AR-RTL-QA-PASS', checkGroup: 'bilingual', title: 'Arabic/RTL critical pages reviewed', description: 'Home, OVR, reports, command center, export and admin screens verified.', ownerLabel: 'Governance Admin', status: 'warning', severity: 'high', evidenceRequired: true, evidenceNote: 'Translation audit report.', sequenceNo: 60 },
  { id: 'rf-7', checkCode: 'UI-HUBS-CLEAN', checkGroup: 'ui', title: 'Navigation is clean and hub-based', description: 'No unnecessary sidebar page overload; legacy routes stay available but hidden.', ownerLabel: 'Product Owner', status: 'passed', severity: 'medium', evidenceRequired: false, evidenceNote: 'v2.4/v2.6 hub cleanup applied.', sequenceNo: 70 },
  { id: 'rf-8', checkCode: 'PILOT-WAVE-APPROVED', checkGroup: 'handover', title: 'Pilot wave approved', description: 'Start with leadership, Governance, Quality, Audit, Finance and selected department managers.', ownerLabel: 'Executive Sponsor', status: 'pending', severity: 'high', evidenceRequired: true, evidenceNote: 'Pilot user list.', sequenceNo: 80 },
];

const fallbackPackages: ConsolidatedPackage[] = [
  { id: 'pkg-1', packageCode: 'FINAL-CODEBASE', title: 'Final consolidated application source', packageType: 'source_bundle', status: 'draft', filePath: 'release/grc-control-center-final-source.zip', checksumNote: null, ownerLabel: 'System Admin', generatedAt: null, verifiedAt: null },
  { id: 'pkg-2', packageCode: 'MIGRATION-BUNDLE', title: 'Ordered migration bundle and manifest', packageType: 'sql_bundle', status: 'generated', filePath: 'supabase/_consolidated/ALL_MIGRATIONS_ORDERED.sql', checksumNote: 'Generated by npm run migrations:bundle', ownerLabel: 'System Admin', generatedAt: null, verifiedAt: null },
  { id: 'pkg-3', packageCode: 'HANDOVER-PACK', title: 'Operations handover and Day-1 runbook', packageType: 'documentation', status: 'generated', filePath: 'docs/PRODUCTION_OPERATOR_HANDOVER_BUNDLE.md', checksumNote: null, ownerLabel: 'Governance Admin', generatedAt: null, verifiedAt: null },
  { id: 'pkg-4', packageCode: 'ACCEPTANCE-EVIDENCE', title: 'Acceptance evidence package', packageType: 'qa_evidence', status: 'draft', filePath: null, checksumNote: 'Attach after pilot acceptance.', ownerLabel: 'QA Owner', generatedAt: null, verifiedAt: null },
];

const fallbackSignoffs: HandoverSignoff[] = [
  { id: 'sig-1', signoffArea: 'Executive sponsor approval', ownerLabel: 'Executive Sponsor', status: 'not_started', evidenceNote: 'Signed go-live decision.', signedAt: null, sequenceNo: 10 },
  { id: 'sig-2', signoffArea: 'Quality / OVR workflow approval', ownerLabel: 'Quality Manager', status: 'not_started', evidenceNote: 'OVR scenario accepted.', signedAt: null, sequenceNo: 20 },
  { id: 'sig-3', signoffArea: 'Access control approval', ownerLabel: 'Access Admin', status: 'not_started', evidenceNote: 'RLS persona matrix accepted.', signedAt: null, sequenceNo: 30 },
  { id: 'sig-4', signoffArea: 'Backup and restore approval', ownerLabel: 'IT / Governance', status: 'not_started', evidenceNote: 'Restore dry-run passed.', signedAt: null, sequenceNo: 40 },
];

export async function getReleaseFactoryData(): Promise<ReleaseFactoryData> {
  const [scoreRows, checks, packages, signoffs] = await Promise.all([
    selectView<ReleaseFactoryScorecard>('v_release_factory_scorecard', [fallbackScorecard], { limit: 1 }),
    selectView<ReleaseFactoryCheck>('v_release_factory_checks', fallbackChecks, { order: 'sequence_no', ascending: true }),
    selectView<ConsolidatedPackage>('v_consolidated_release_packages', fallbackPackages, { order: 'package_code', ascending: true }),
    selectView<HandoverSignoff>('v_final_handover_signoffs', fallbackSignoffs, { order: 'sequence_no', ascending: true })
  ]);

  return {
    scorecard: scoreRows[0] ?? fallbackScorecard,
    checks,
    packages,
    signoffs,
  };
}

export async function seedReleaseFactoryDefaults() {
  if (!supabase) return { seeded: false, message: 'Supabase is not configured. Demo fallback data is shown.' };
  const { data, error } = await supabase.rpc('seed_release_factory_defaults');
  if (error) throw new Error(error.message);
  return { seeded: true, message: typeof data === 'string' ? data : 'Release factory defaults seeded.' };
}
