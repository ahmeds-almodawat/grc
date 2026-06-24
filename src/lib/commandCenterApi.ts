import { supabase } from './supabase';
import { emptyLiveObject, emptyLiveArray } from './liveData';

export type CommandSummary = {
  criticalNow: number;
  pendingExecutiveDecisions: number;
  departmentPressure: number;
  policyReviewDue: number;
  searchIndexedRecords: number;
  releaseReadinessScore: number | null;
  backupHealth: 'healthy' | 'warning' | 'critical' | null;
};

export type CommandStreamItem = {
  id: string;
  itemType: string;
  title: string;
  department: string;
  owner: string;
  status: string;
  riskLevel: string;
  dueDate: string | null;
  reason: string;
  actionPath: string;
  sortRank: number;
};

export type GlobalSearchResult = {
  id: string;
  sourceTable: string;
  sourceType: string;
  title: string;
  subtitle: string;
  department: string;
  owner: string;
  status: string;
  riskLevel: string;
  searchText: string;
  actionPath: string;
  updatedAt: string | null;
};

export type DocumentItem = {
  id: string;
  documentCode: string;
  title: string;
  documentType: string;
  department: string;
  owner: string;
  status: string;
  version: string;
  reviewDueDate: string | null;
  expiryDate: string | null;
  fileName: string | null;
  filePath: string | null;
  riskLevel: string;
};

export type DocumentSummary = {
  totalDocuments: number;
  activeDocuments: number;
  reviewDue30Days: number;
  expiredDocuments: number;
  missingOwner: number;
  missingFile: number;
};

export type RelationshipItem = {
  id: string;
  sourceType: string;
  sourceId: string;
  sourceTitle: string;
  relationshipType: string;
  targetType: string;
  targetId: string;
  targetTitle: string;
  status: string;
  riskLevel: string;
  department: string;
};

export type ReleaseGate = {
  id: string;
  gateArea: string;
  gateName: string;
  severity: 'blocker' | 'warning' | 'pass';
  status: 'pass' | 'warning' | 'blocked';
  owner: string;
  evidenceRequired: boolean;
  notes: string;
};

export type MigrationStep = {
  versionLabel: string;
  migrationFile: string;
  sequenceNo: number;
  purpose: string;
  required: boolean;
};

const liveEmptySummary: CommandSummary = emptyLiveObject<CommandSummary>('liveEmptySummary');

const liveEmptyStream: CommandStreamItem[] = emptyLiveArray<CommandStreamItem>();

const liveEmptySearch: GlobalSearchResult[] = emptyLiveArray<GlobalSearchResult>();

const liveEmptyDocuments: DocumentItem[] = emptyLiveArray<DocumentItem>();

const liveEmptyDocSummary: DocumentSummary = emptyLiveObject<DocumentSummary>('liveEmptyDocSummary');

const liveEmptyRelationships: RelationshipItem[] = emptyLiveArray<RelationshipItem>();

const liveEmptyReleaseGates: ReleaseGate[] = emptyLiveArray<ReleaseGate>();

const liveEmptyMigrations: MigrationStep[] = emptyLiveArray<MigrationStep>();

function warnFallback(label: string, error: unknown) {
  // eslint-disable-next-line no-console
  console.warn(`[GRC command emptyRows] ${label}`, error);
}

export async function getCommandSummary(): Promise<CommandSummary> {
  if (!supabase) return emptyLiveObject<CommandSummary>('getCommandSummary');
  try {
    const { data, error } = await supabase.from('v_executive_command_summary').select('*').limit(1);
    if (error) throw error;
    const row = data?.[0] as any;
    if (!row) return emptyLiveObject<CommandSummary>('getCommandSummary');
    return {
      criticalNow: row.critical_now ?? 0,
      pendingExecutiveDecisions: row.pending_executive_decisions ?? 0,
      departmentPressure: row.department_pressure_count ?? 0,
      policyReviewDue: row.policy_review_due_30_days ?? 0,
      searchIndexedRecords: row.search_indexed_records ?? 0,
      releaseReadinessScore: typeof row.release_readiness_score === 'number' ? row.release_readiness_score : null,
      backupHealth: row.backup_health ?? null
    };
  } catch (error) {
    warnFallback('command summary', error);
    return emptyLiveObject<CommandSummary>('getCommandSummary');
  }
}

export async function getCommandStream(): Promise<CommandStreamItem[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('v_executive_command_stream')
      .select('*')
      .order('sort_rank', { ascending: true })
      .limit(50);
    if (error) throw error;
    if (!data?.length) return [];
    return (data as any[]).map(row => ({
      id: row.id,
      itemType: row.item_type,
      title: row.title,
      department: row.department_name || 'Company-wide',
      owner: row.owner_name || 'Unassigned',
      status: row.status || 'open',
      riskLevel: row.risk_level || 'medium',
      dueDate: row.due_date,
      reason: row.reason || 'Requires executive attention',
      actionPath: row.action_path || '/',
      sortRank: row.sort_rank ?? 99
    }));
  } catch (error) {
    warnFallback('command stream', error);
    return [];
  }
}

export async function searchGlobal(query: string): Promise<GlobalSearchResult[]> {
  if (!query.trim()) return [];
  if (!supabase) {
    const q = query.toLowerCase();
    return liveEmptySearch.filter(row => row.searchText.toLowerCase().includes(q) || row.title.toLowerCase().includes(q));
  }
  try {
    const { data, error } = await supabase.rpc('search_grc_global', { p_query: query, p_limit: 60 });
    if (error) throw error;
    return ((data as any[]) || []).map(row => ({
      id: row.id,
      sourceTable: row.source_table,
      sourceType: row.source_type,
      title: row.title,
      subtitle: row.subtitle || '',
      department: row.department_name || 'Company-wide',
      owner: row.owner_name || 'Unassigned',
      status: row.status || 'open',
      riskLevel: row.risk_level || 'medium',
      searchText: row.search_text || '',
      actionPath: row.action_path || '/',
      updatedAt: row.updated_at
    }));
  } catch (error) {
    warnFallback('global search', error);
    return [];
  }
}

export async function getDocumentSummary(): Promise<DocumentSummary> {
  if (!supabase) return emptyLiveObject<DocumentSummary>('getDocumentSummary');
  try {
    const { data, error } = await supabase.from('v_document_center_summary').select('*').limit(1);
    if (error) throw error;
    const row = data?.[0] as any;
    if (!row) return emptyLiveObject<DocumentSummary>('getDocumentSummary');
    return {
      totalDocuments: row.total_documents ?? 0,
      activeDocuments: row.active_documents ?? 0,
      reviewDue30Days: row.review_due_30_days ?? 0,
      expiredDocuments: row.expired_documents ?? 0,
      missingOwner: row.missing_owner ?? 0,
      missingFile: row.missing_file ?? 0
    };
  } catch (error) {
    warnFallback('document summary', error);
    return emptyLiveObject<DocumentSummary>('getDocumentSummary');
  }
}

export async function getDocuments(): Promise<DocumentItem[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('v_document_center_items')
      .select('*')
      .order('review_due_date', { ascending: true, nullsFirst: false })
      .limit(150);
    if (error) throw error;
    if (!data?.length) return [];
    return (data as any[]).map(row => ({
      id: row.id,
      documentCode: row.document_code || '—',
      title: row.title,
      documentType: row.document_type || 'document',
      department: row.department_name || 'Company-wide',
      owner: row.owner_name || 'Unassigned',
      status: row.status || 'draft',
      version: row.version || '1.0',
      reviewDueDate: row.review_due_date,
      expiryDate: row.expiry_date,
      fileName: row.file_name,
      filePath: row.file_path,
      riskLevel: row.risk_level || 'medium'
    }));
  } catch (error) {
    warnFallback('documents', error);
    return [];
  }
}

export async function getRelationshipMap(): Promise<RelationshipItem[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase.from('v_cross_module_relationship_map').select('*').limit(200);
    if (error) throw error;
    if (!data?.length) return [];
    return (data as any[]).map(row => ({
      id: row.id,
      sourceType: row.source_type,
      sourceId: row.source_id,
      sourceTitle: row.source_title,
      relationshipType: row.relationship_type,
      targetType: row.target_type,
      targetId: row.target_id,
      targetTitle: row.target_title,
      status: row.status || 'open',
      riskLevel: row.risk_level || 'medium',
      department: row.department_name || 'Company-wide'
    }));
  } catch (error) {
    warnFallback('relationship map', error);
    return [];
  }
}

export async function getReleaseGates(): Promise<ReleaseGate[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase.from('v_release_candidate_gates').select('*').order('severity_rank', { ascending: true });
    if (error) throw error;
    if (!data?.length) return [];
    return (data as any[]).map(row => ({
      id: row.id,
      gateArea: row.gate_area,
      gateName: row.gate_name,
      severity: row.severity,
      status: row.status,
      owner: row.owner_name || row.owner || 'Unassigned',
      evidenceRequired: Boolean(row.evidence_required),
      notes: row.notes || ''
    }));
  } catch (error) {
    warnFallback('release gates', error);
    return [];
  }
}

export async function getMigrationSteps(): Promise<MigrationStep[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase.from('v_release_migration_order').select('*').order('sequence_no', { ascending: true });
    if (error) throw error;
    if (!data?.length) return [];
    return (data as any[]).map(row => ({
      versionLabel: row.version_label,
      migrationFile: row.migration_file,
      sequenceNo: row.sequence_no,
      purpose: row.purpose,
      required: Boolean(row.required)
    }));
  } catch (error) {
    warnFallback('migration steps', error);
    return [];
  }
}
