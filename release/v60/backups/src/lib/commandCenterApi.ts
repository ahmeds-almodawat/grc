import { supabase } from './supabase';

export type CommandSummary = {
  criticalNow: number;
  pendingExecutiveDecisions: number;
  departmentPressure: number;
  policyReviewDue: number;
  searchIndexedRecords: number;
  releaseReadinessScore: number;
  backupHealth: 'healthy' | 'warning' | 'critical';
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

const fallbackSummary: CommandSummary = {
  criticalNow: 14,
  pendingExecutiveDecisions: 7,
  departmentPressure: 5,
  policyReviewDue: 11,
  searchIndexedRecords: 438,
  releaseReadinessScore: 82,
  backupHealth: 'warning'
};

const fallbackStream: CommandStreamItem[] = [
  {
    id: 'cmd-1',
    itemType: 'Major OVR',
    title: 'Repeated medication delay incidents in inpatient units',
    department: 'Nursing / Pharmacy',
    owner: 'Quality Manager',
    status: 'under_quality_review',
    riskLevel: 'critical',
    dueDate: '2026-06-20',
    reason: '3 same-category OVRs in 30 days with one overdue corrective action',
    actionPath: '/ovr-risk',
    sortRank: 1
  },
  {
    id: 'cmd-2',
    itemType: 'Compliance',
    title: 'Civil Defense certificate renewal evidence missing',
    department: 'Engineering',
    owner: 'Facility Manager',
    status: 'pending_evidence',
    riskLevel: 'high',
    dueDate: '2026-06-28',
    reason: 'Expiry within 30 days without accepted evidence',
    actionPath: '/compliance',
    sortRank: 2
  },
  {
    id: 'cmd-3',
    itemType: 'Audit finding',
    title: 'Payment approval trail not consistently attached',
    department: 'Finance',
    owner: 'Finance Manager',
    status: 'in_progress',
    riskLevel: 'high',
    dueDate: '2026-07-05',
    reason: 'Corrective-action evidence required before closure',
    actionPath: '/audit',
    sortRank: 3
  }
];

const fallbackSearch: GlobalSearchResult[] = [
  {
    id: 'search-1',
    sourceTable: 'ovr_reports',
    sourceType: 'OVR',
    title: 'Medication delay - stat order delivered late',
    subtitle: 'Quality review pending; corrective action required',
    department: 'Pharmacy',
    owner: 'Quality Manager',
    status: 'under_quality_review',
    riskLevel: 'high',
    searchText: 'medication delay stat order pharmacy quality corrective action',
    actionPath: '/ovr',
    updatedAt: '2026-06-15'
  },
  {
    id: 'search-2',
    sourceTable: 'risks',
    sourceType: 'Risk',
    title: 'Medication safety process variation',
    subtitle: 'Residual score is high; linked to OVR signals',
    department: 'Quality',
    owner: 'Risk Officer',
    status: 'mitigating',
    riskLevel: 'high',
    searchText: 'medication safety pharmacy nursing ovr risk mitigation',
    actionPath: '/risks',
    updatedAt: '2026-06-12'
  },
  {
    id: 'search-3',
    sourceTable: 'projects',
    sourceType: 'Action plan',
    title: 'Improve stat medication delivery workflow',
    subtitle: 'Milestones include review, training and audit evidence',
    department: 'Pharmacy',
    owner: 'Pharmacy Manager',
    status: 'active',
    riskLevel: 'high',
    searchText: 'stat medication delivery workflow pharmacy action plan',
    actionPath: '/projects',
    updatedAt: '2026-06-14'
  }
];

const fallbackDocuments: DocumentItem[] = [
  {
    id: 'doc-1',
    documentCode: 'POL-QM-OVR-001',
    title: 'Occurrence Variance Reporting Policy',
    documentType: 'policy',
    department: 'Quality',
    owner: 'Quality Manager',
    status: 'active',
    version: '1.0',
    reviewDueDate: '2026-08-31',
    expiryDate: null,
    fileName: 'OVR Policy.pdf',
    filePath: null,
    riskLevel: 'high'
  },
  {
    id: 'doc-2',
    documentCode: 'AUTH-FIN-001',
    title: 'Finance Authority Matrix',
    documentType: 'authority_matrix',
    department: 'Finance',
    owner: 'CFO',
    status: 'under_review',
    version: '2.1',
    reviewDueDate: '2026-07-15',
    expiryDate: null,
    fileName: null,
    filePath: null,
    riskLevel: 'critical'
  },
  {
    id: 'doc-3',
    documentCode: 'PROC-HR-LEAVE-004',
    title: 'Leave and Vacation Procedure',
    documentType: 'procedure',
    department: 'HR',
    owner: 'HR Manager',
    status: 'active',
    version: '1.4',
    reviewDueDate: '2026-09-20',
    expiryDate: null,
    fileName: 'Leave Procedure.pdf',
    filePath: null,
    riskLevel: 'medium'
  }
];

const fallbackDocSummary: DocumentSummary = {
  totalDocuments: 38,
  activeDocuments: 26,
  reviewDue30Days: 8,
  expiredDocuments: 1,
  missingOwner: 3,
  missingFile: 6
};

const fallbackRelationships: RelationshipItem[] = [
  {
    id: 'rel-1',
    sourceType: 'OVR',
    sourceId: 'ovr-demo-1',
    sourceTitle: 'Medication delay OVR',
    relationshipType: 'creates_or_updates',
    targetType: 'Risk',
    targetId: 'risk-demo-1',
    targetTitle: 'Medication safety process variation',
    status: 'mitigating',
    riskLevel: 'high',
    department: 'Quality'
  },
  {
    id: 'rel-2',
    sourceType: 'Risk',
    sourceId: 'risk-demo-1',
    sourceTitle: 'Medication safety process variation',
    relationshipType: 'mitigated_by',
    targetType: 'Action plan',
    targetId: 'project-demo-1',
    targetTitle: 'Improve stat medication delivery workflow',
    status: 'active',
    riskLevel: 'high',
    department: 'Pharmacy'
  },
  {
    id: 'rel-3',
    sourceType: 'Audit finding',
    sourceId: 'audit-demo-1',
    sourceTitle: 'Payment approval evidence gap',
    relationshipType: 'requires',
    targetType: 'Evidence',
    targetId: 'evidence-demo-1',
    targetTitle: 'Signed authority matrix and approval samples',
    status: 'submitted',
    riskLevel: 'high',
    department: 'Finance'
  }
];

const fallbackReleaseGates: ReleaseGate[] = [
  { id: 'gate-1', gateArea: 'Database', gateName: 'All migrations applied in sequence', severity: 'blocker', status: 'warning', owner: 'System Admin', evidenceRequired: true, notes: 'Confirm 001 through 021 in Supabase.' },
  { id: 'gate-2', gateArea: 'Access', gateName: 'Sensitive global roles reviewed', severity: 'blocker', status: 'blocked', owner: 'Governance Admin', evidenceRequired: true, notes: 'Run Access Control Center before adding all employees.' },
  { id: 'gate-3', gateArea: 'Backup', gateName: 'Backup package exported and restore dry-run documented', severity: 'blocker', status: 'warning', owner: 'IT / Governance', evidenceRequired: true, notes: 'Use Export Center then Setup Center restore dry-run.' },
  { id: 'gate-4', gateArea: 'OVR', gateName: 'Quality workflow tested end-to-end', severity: 'warning', status: 'warning', owner: 'Quality Manager', evidenceRequired: true, notes: 'Submit, review, return, evidence, close.' }
];

const fallbackMigrations: MigrationStep[] = Array.from({ length: 21 }, (_, index) => {
  const sequenceNo = index + 1;
  const files = [
    '001_core_foundation.sql',
    '002_grc_layer.sql',
    '003_rls_permissions_and_controls.sql',
    '004_seed_reference_data.sql',
    '005_operational_views_and_storage.sql',
    '006_workflow_queues_and_project_controls.sql',
    '007_escalation_and_governance_controls.sql',
    '008_import_export_rollout_tools.sql',
    '009_access_control_and_role_governance.sql',
    '010_bilingual_and_ovr_module.sql',
    '011_ovr_risk_indicators.sql',
    '012a_ovr_workflow_enum_values.sql',
    '012b_ovr_workflow_controls.sql',
    '013_kpi_analytics_heatmap_radar.sql',
    '014_export_center_backups_custom_reports.sql',
    '015_production_hardening_health_print_controls.sql',
    '016_rollout_onboarding_user_guides.sql',
    '017_notifications_activity_timelines.sql',
    '018_qa_permission_deployment_readiness.sql',
    '019_performance_responsive_usability.sql',
    '020_security_audit_retention_controls.sql',
    '021_command_search_documents_release.sql'
  ];
  return {
    versionLabel: `v${sequenceNo.toString().padStart(2, '0')}`,
    migrationFile: files[index],
    sequenceNo,
    purpose: sequenceNo === 21 ? 'Command Center, global search, document center and release candidate readiness' : 'Required previous platform migration',
    required: true
  };
});

function warnFallback(label: string, error: unknown) {
  // eslint-disable-next-line no-console
  console.warn(`[GRC command fallback] ${label}`, error);
}

export async function getCommandSummary(): Promise<CommandSummary> {
  if (!supabase) return fallbackSummary;
  try {
    const { data, error } = await supabase.from('v_executive_command_summary').select('*').limit(1);
    if (error) throw error;
    const row = data?.[0] as any;
    if (!row) return fallbackSummary;
    return {
      criticalNow: row.critical_now ?? 0,
      pendingExecutiveDecisions: row.pending_executive_decisions ?? 0,
      departmentPressure: row.department_pressure_count ?? 0,
      policyReviewDue: row.policy_review_due_30_days ?? 0,
      searchIndexedRecords: row.search_indexed_records ?? 0,
      releaseReadinessScore: row.release_readiness_score ?? 0,
      backupHealth: row.backup_health ?? 'warning'
    };
  } catch (error) {
    warnFallback('command summary', error);
    return fallbackSummary;
  }
}

export async function getCommandStream(): Promise<CommandStreamItem[]> {
  if (!supabase) return fallbackStream;
  try {
    const { data, error } = await supabase
      .from('v_executive_command_stream')
      .select('*')
      .order('sort_rank', { ascending: true })
      .limit(50);
    if (error) throw error;
    if (!data?.length) return fallbackStream;
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
    return fallbackStream;
  }
}

export async function searchGlobal(query: string): Promise<GlobalSearchResult[]> {
  if (!query.trim()) return [];
  if (!supabase) {
    const q = query.toLowerCase();
    return fallbackSearch.filter(row => row.searchText.toLowerCase().includes(q) || row.title.toLowerCase().includes(q));
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
    return fallbackSearch;
  }
}

export async function getDocumentSummary(): Promise<DocumentSummary> {
  if (!supabase) return fallbackDocSummary;
  try {
    const { data, error } = await supabase.from('v_document_center_summary').select('*').limit(1);
    if (error) throw error;
    const row = data?.[0] as any;
    if (!row) return fallbackDocSummary;
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
    return fallbackDocSummary;
  }
}

export async function getDocuments(): Promise<DocumentItem[]> {
  if (!supabase) return fallbackDocuments;
  try {
    const { data, error } = await supabase
      .from('v_document_center_items')
      .select('*')
      .order('review_due_date', { ascending: true, nullsFirst: false })
      .limit(150);
    if (error) throw error;
    if (!data?.length) return fallbackDocuments;
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
    return fallbackDocuments;
  }
}

export async function getRelationshipMap(): Promise<RelationshipItem[]> {
  if (!supabase) return fallbackRelationships;
  try {
    const { data, error } = await supabase.from('v_cross_module_relationship_map').select('*').limit(200);
    if (error) throw error;
    if (!data?.length) return fallbackRelationships;
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
    return fallbackRelationships;
  }
}

export async function getReleaseGates(): Promise<ReleaseGate[]> {
  if (!supabase) return fallbackReleaseGates;
  try {
    const { data, error } = await supabase.from('v_release_candidate_gates').select('*').order('severity_rank', { ascending: true });
    if (error) throw error;
    if (!data?.length) return fallbackReleaseGates;
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
    return fallbackReleaseGates;
  }
}

export async function getMigrationSteps(): Promise<MigrationStep[]> {
  if (!supabase) return fallbackMigrations;
  try {
    const { data, error } = await supabase.from('v_release_migration_order').select('*').order('sequence_no', { ascending: true });
    if (error) throw error;
    if (!data?.length) return fallbackMigrations;
    return (data as any[]).map(row => ({
      versionLabel: row.version_label,
      migrationFile: row.migration_file,
      sequenceNo: row.sequence_no,
      purpose: row.purpose,
      required: Boolean(row.required)
    }));
  } catch (error) {
    warnFallback('migration steps', error);
    return fallbackMigrations;
  }
}
