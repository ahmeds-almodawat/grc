import { supabase } from './supabase';
import { invokePrivilegedAction } from './privilegedAction';

// ----------------------------------------------------------------------------
// Catalog & Read Types
// ----------------------------------------------------------------------------

export interface GovernedPolicyCatalogRow {
  document_id: string;
  organization_id: string;
  document_code: string | null;
  document_title: string;
  document_description: string | null;
  document_status: 'draft' | 'under_review' | 'pending_approval' | 'approved' | 'active' | 'under_revision' | 'expired' | 'superseded' | 'retired' | 'rejected' | 'cancelled';
  workflow_stage: string | null;
  department_id: string | null;
  department_name: string | null;
  document_owner_id: string | null;
  document_owner_name: string | null;
  effective_date: string | null;
  next_review_date: string | null;
  expiry_date: string | null;
  criticality_level: 'low' | 'medium' | 'high' | 'critical' | null;
  confidentiality_level: 'public' | 'internal' | 'confidential' | 'restricted' | null;
  version_id: string | null;
  version_number: number | null;
  version_label: string | null;
  is_current_version: boolean | null;
  approved_at: string | null;
  locked_at: string | null;
  version_title_en: string | null;
  version_title_ar: string | null;
  purpose_en: string | null;
  purpose_ar: string | null;
  policy_statement_en: string | null;
  policy_statement_ar: string | null;
  scope_en: string | null;
  scope_ar: string | null;
  principles_en: string | null;
  principles_ar: string | null;
  exceptions_summary_en: string | null;
  exceptions_summary_ar: string | null;
  non_compliance_escalation_en: string | null;
  non_compliance_escalation_ar: string | null;
  content_mode: 'structured' | 'legacy_controlled_document' | null;
  transcription_status: 'not_required' | 'pending' | 'complete' | null;
  requirement_count: number;
  created_at: string;
  updated_at: string;
}

export interface GovernedSopCatalogRow {
  document_id: string;
  organization_id: string;
  document_code: string | null;
  document_title: string;
  document_description: string | null;
  document_status: 'draft' | 'under_review' | 'pending_approval' | 'approved' | 'active' | 'under_revision' | 'expired' | 'superseded' | 'retired' | 'rejected' | 'cancelled';
  workflow_stage: string | null;
  department_id: string | null;
  department_name: string | null;
  document_owner_id: string | null;
  document_owner_name: string | null;
  effective_date: string | null;
  next_review_date: string | null;
  expiry_date: string | null;
  criticality_level: 'low' | 'medium' | 'high' | 'critical' | null;
  confidentiality_level: 'public' | 'internal' | 'confidential' | 'restricted' | null;
  version_id: string | null;
  version_number: number | null;
  version_label: string | null;
  is_current_version: boolean | null;
  approved_at: string | null;
  locked_at: string | null;
  version_title_en: string | null;
  version_title_ar: string | null;
  title_en?: string | null;
  title_ar?: string | null;
  process_name_en: string | null;
  process_name_ar: string | null;
  process_owner_id: string | null;
  process_owner_name: string | null;
  purpose_en: string | null;
  purpose_ar: string | null;
  scope_en: string | null;
  scope_ar: string | null;
  primary_policy_version_id: string | null;
  primary_policy_document_code: string | null;
  primary_policy_document_title: string | null;
  primary_policy_version_number: number | null;
  governance_link_state: 'linked' | 'legacy_pending' | 'not_applicable' | null;
  training_required: boolean;
  acknowledgment_required: boolean;
  competency_assessment_required: boolean;
  acknowledgment_sla_days: number | null;
  training_renewal_months: number | null;
  content_mode: 'structured' | 'legacy_controlled_document' | null;
  transcription_status: 'not_required' | 'pending' | 'complete' | null;
  step_count: number;
  created_at: string;
  updated_at: string;
}

export interface PolicyRequirement {
  id?: string;
  sequence_number: number;
  requirement_statement_en: string;
  requirement_statement_ar?: string | null;
  responsible_role?: string | null;
  is_mandatory: boolean;
  expected_evidence_en?: string | null;
  expected_evidence_ar?: string | null;
  mapped_control_id?: string | null;
  mapped_control_code?: string | null;
  mapped_control_title?: string | null;
  linked_accreditation_clause_id?: string | null;
  linked_accreditation_clause_code?: string | null;
  monitoring_frequency?: string | null;
  monitoring_owner_id?: string | null;
}

export interface DepartmentScope {
  department_id: string;
  department_name?: string;
  department_code?: string;
}

export interface RoleScope {
  id?: string;
  role_name: string;
  job_title?: string | null;
}

export interface DocumentReviewEvent {
  id: string;
  document_id: string;
  version_id: string | null;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  actor_id: string | null;
  actor_name?: string | null;
  event_note: string | null;
  created_at: string;
}

export interface PolicySopException {
  id: string;
  document_id: string;
  document_version_id: string;
  exception_code: string;
  exception_reason: string;
  scope_description: string;
  effective_start_date: string;
  effective_end_date: string;
  risk_assessment_summary?: string | null;
  compensating_controls?: string | null;
  requested_by: string;
  requested_by_name?: string | null;
  requested_at: string;
  status: 'requested' | 'approved' | 'rejected' | 'expired' | 'revoked';
  decision_by?: string | null;
  decision_by_name?: string | null;
  decision_at?: string | null;
  decision_note?: string | null;
}

export interface GovernedDocumentReviewTrigger {
  id: string;
  document_id: string;
  version_id?: string | null;
  trigger_type: 'scheduled' | 'regulatory_change' | 'audit_finding' | 'ovr' | 'capa' | 'management_decision' | 'accreditation_finding';
  source_entity_type?: string | null;
  source_entity_id?: string | null;
  triggered_by?: string | null;
  triggered_at: string;
  review_owner_id?: string | null;
  due_date: string;
  status: 'open' | 'in_progress' | 'completed' | 'cancelled';
  outcome?: 'no_change' | 'minor_revision' | 'major_revision' | 'retire' | null;
  outcome_note?: string | null;
  completed_at?: string | null;
}

export interface DetailedPolicyRecord {
  document_id: string;
  organization_id: string;
  document_code: string;
  document_title: string;
  document_description: string | null;
  document_status: 'draft' | 'under_review' | 'pending_approval' | 'approved' | 'active' | 'under_revision' | 'expired' | 'superseded' | 'retired' | 'rejected' | 'cancelled';
  workflow_stage: string | null;
  department_id: string | null;
  department_name: string | null;
  document_owner_id: string | null;
  document_owner_name: string | null;
  effective_date: string | null;
  next_review_date: string | null;
  expiry_date: string | null;
  criticality_level: 'low' | 'medium' | 'high' | 'critical';
  confidentiality_level: 'public' | 'internal' | 'confidential' | 'restricted';
  active_flag: boolean;
  version_id: string;
  version_number: number;
  version_label: string;
  is_current_version: boolean;
  approved_by: string | null;
  approved_at: string | null;
  locked_by: string | null;
  locked_at: string | null;
  revision_reason: string | null;
  supersedes_version_id: string | null;
  title_en: string;
  title_ar: string | null;
  purpose_en: string;
  purpose_ar: string | null;
  policy_statement_en: string;
  policy_statement_ar: string | null;
  scope_en: string | null;
  scope_ar: string | null;
  principles_en: string | null;
  principles_ar: string | null;
  exceptions_summary_en: string | null;
  exceptions_summary_ar: string | null;
  non_compliance_escalation_en: string | null;
  non_compliance_escalation_ar: string | null;
  content_mode: 'structured' | 'legacy_controlled_document';
  transcription_status: 'not_required' | 'pending' | 'complete';
  requirements: PolicyRequirement[];
  department_scopes: string[];
  role_scopes: RoleScope[];
  review_events: DocumentReviewEvent[];
  exceptions: PolicySopException[];
  review_triggers: GovernedDocumentReviewTrigger[];
  all_versions: Array<{
    id: string;
    version_number: number;
    version_label: string;
    is_current_version: boolean;
    effective_date: string | null;
    expiry_date: string | null;
    approved_at: string | null;
    locked_at: string | null;
    prepared_by: string | null;
    revision_reason: string | null;
  }>;
}

export interface SopProcedureStep {
  id?: string;
  sequence_number: number;
  responsible_role: string;
  action_instruction_en: string;
  action_instruction_ar?: string | null;
  required_control_id?: string | null;
  required_control_code?: string | null;
  required_control_title?: string | null;
  expected_evidence_record_en?: string | null;
  expected_evidence_record_ar?: string | null;
  timing_sla_en?: string | null;
  timing_sla_ar?: string | null;
  is_decision_point: boolean;
  decision_criteria_en?: string | null;
  decision_criteria_ar?: string | null;
  criticality: 'low' | 'medium' | 'high' | 'critical';
  escalation_trigger_en?: string | null;
  escalation_trigger_ar?: string | null;
  escalation_destination_role?: string | null;
}

export interface SopDefinition {
  id?: string;
  sequence_number: number;
  term_en?: string | null;
  term_ar?: string | null;
  abbreviation?: string | null;
  definition_en: string;
  definition_ar?: string | null;
}

export interface SopRoleResponsibility {
  id?: string;
  sequence_number: number;
  role_name?: string | null;
  job_title?: string | null;
  responsibility_en: string;
  responsibility_ar?: string | null;
  accountable_for_en?: string | null;
  accountable_for_ar?: string | null;
}

export interface SopMonitoringKpi {
  id?: string;
  sequence_number: number;
  kpi_name_en: string;
  kpi_name_ar?: string | null;
  target_value: string;
  measurement_frequency: string;
  owner_id?: string | null;
  owner_name?: string | null;
  description_en?: string | null;
  description_ar?: string | null;
}

export interface EligibleGoverningPolicy {
  version_id: string;
  document_id: string;
  document_code: string;
  title_en: string;
  title_ar: string | null;
  version_label: string;
  document_status: string;
  effective_date: string | null;
}

export interface SopRiskLink {
  id?: string;
  sequence_number: number;
  risk_id: string;
  risk_code?: string | null;
  risk_title?: string | null;
  risk_status?: string | null;
  risk_level?: string | null;
  relationship_type: 'mitigates' | 'risk_if_not_followed' | 'operational_context';
  context_note_en?: string | null;
  context_note_ar?: string | null;
}

export interface SopAccreditationLink {
  id?: string;
  sequence_number: number;
  clause_id: string;
  clause_code?: string | null;
  clause_title?: string | null;
  clause_title_ar?: string | null;
  framework?: string | null;
  standard_code?: string | null;
  criticality?: string | null;
  link_strength: 'primary' | 'supporting' | 'reference' | 'gap';
  context_note_en?: string | null;
  context_note_ar?: string | null;
}

export interface SopDerivedControl {
  control_id: string;
  control_code: string | null;
  control_title: string;
  control_type: string;
  key_control: boolean;
  step_sequences: number[];
}

export interface SopInheritedAccreditation {
  clause_id: string;
  clause_code: string;
  clause_title: string;
  clause_title_ar?: string | null;
  standard_code: string;
  framework: string;
  criticality: string;
  policy_requirement_en?: string | null;
  policy_requirement_ar?: string | null;
}

export interface SopTraceabilityMatrixRow {
  sop_version_id: string;
  document_id: string;
  organization_id: string;
  document_code: string;
  document_title: string;
  version_number: number;
  version_label: string;
  item_type: 'risk' | 'control' | 'accreditation_clause';
  provenance: 'direct_sop' | 'derived_step_control' | 'inherited_policy';
  link_semantic: string;
  link_id: string | null;
  sequence_number: number;
  target_id: string;
  target_code: string;
  target_title: string;
  target_description: string | null;
  target_status: string;
  target_criticality: string | null;
  framework_or_standard: string | null;
  context_note_en: string | null;
  context_note_ar: string | null;
  step_sequences: number[] | null;
}

export interface DetailedSopRecord {
  document_id: string;
  organization_id: string;
  document_code: string;
  document_title: string;
  document_description: string | null;
  document_status: 'draft' | 'under_review' | 'pending_approval' | 'approved' | 'active' | 'under_revision' | 'expired' | 'superseded' | 'retired' | 'rejected' | 'cancelled';
  workflow_stage: string | null;
  department_id: string | null;
  department_name: string | null;
  document_owner_id: string | null;
  document_owner_name: string | null;
  effective_date: string | null;
  next_review_date: string | null;
  expiry_date: string | null;
  criticality_level: 'low' | 'medium' | 'high' | 'critical';
  confidentiality_level: 'public' | 'internal' | 'confidential' | 'restricted';
  active_flag: boolean;
  version_id: string;
  version_number: number;
  version_label: string;
  is_current_version: boolean;
  approved_by: string | null;
  approved_at: string | null;
  locked_by: string | null;
  locked_at: string | null;
  revision_reason: string | null;
  supersedes_version_id: string | null;
  title_en: string;
  title_ar: string | null;
  process_name_en: string;
  process_name_ar: string | null;
  process_owner_id: string | null;
  process_owner_name: string | null;
  purpose_en: string;
  purpose_ar: string | null;
  scope_en: string | null;
  scope_ar: string | null;
  primary_policy_version_id: string | null;
  primary_policy_document_code: string | null;
  primary_policy_document_title: string | null;
  primary_policy_version_label: string | null;
  governance_link_state: 'linked' | 'legacy_pending' | 'not_applicable';
  training_required: boolean;
  acknowledgment_required: boolean;
  competency_assessment_required: boolean;
  acknowledgment_sla_days: number | null;
  training_renewal_months: number | null;
  content_mode: 'structured' | 'legacy_controlled_document';
  transcription_status: 'not_required' | 'pending' | 'complete';
  procedure_steps: SopProcedureStep[];
  definitions: SopDefinition[];
  role_responsibilities: SopRoleResponsibility[];
  monitoring_kpis: SopMonitoringKpi[];
  risk_links: SopRiskLink[];
  accreditation_links: SopAccreditationLink[];
  derived_controls: SopDerivedControl[];
  inherited_accreditations: SopInheritedAccreditation[];
  department_scopes: string[];
  role_scopes: RoleScope[];
  review_events: DocumentReviewEvent[];
  exceptions: PolicySopException[];
  review_triggers: GovernedDocumentReviewTrigger[];
  all_versions: Array<{
    id: string;
    version_number: number;
    version_label: string;
    is_current_version: boolean;
    effective_date: string | null;
    expiry_date: string | null;
    approved_at: string | null;
    locked_at: string | null;
    prepared_by: string | null;
    revision_reason: string | null;
  }>;
}

// ----------------------------------------------------------------------------
// Read Queries
// ----------------------------------------------------------------------------

export async function listGovernedPolicies(): Promise<GovernedPolicyCatalogRow[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('v_governed_policy_catalog')
      .select('*')
      .order('document_code', { ascending: true });
    if (error) throw error;
    return (data as unknown as GovernedPolicyCatalogRow[]) || [];
  } catch (error) {
    console.warn('[PolicySopApi] listGovernedPolicies fallback:', error);
    return [];
  }
}

export async function listGovernedSops(): Promise<GovernedSopCatalogRow[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('v_governed_sop_catalog')
      .select('*')
      .order('document_code', { ascending: true });
    if (error) throw error;
    return (data as unknown as GovernedSopCatalogRow[]) || [];
  } catch (error) {
    console.warn('[PolicySopApi] listGovernedSops fallback:', error);
    return [];
  }
}

export async function getSopProcedureSteps(sopVersionId: string): Promise<any[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('v_sop_procedure_step_matrix')
      .select('*')
      .eq('sop_version_id', sopVersionId)
      .order('sequence_number', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.warn('[PolicySopApi] getSopProcedureSteps fallback:', error);
    return [];
  }
}

export async function getGovernedPolicyDetail(documentId: string, versionId?: string): Promise<DetailedPolicyRecord | null> {
  if (!supabase) return null;
  try {
    // 1. Fetch document root
    const { data: doc, error: docErr } = await supabase
      .from('controlled_documents')
      .select('*, departments(id, name, code), profiles!controlled_documents_document_owner_id_fkey(id, full_name)')
      .eq('id', documentId)
      .single();
    if (docErr || !doc) throw docErr || new Error('DOCUMENT_NOT_FOUND');

    const targetVerId = versionId || doc.current_version_id;

    // 2. Fetch target version
    let verQuery = supabase.from('document_versions').select('*');
    if (targetVerId) {
      verQuery = verQuery.eq('id', targetVerId);
    } else {
      verQuery = verQuery.eq('document_id', documentId).order('version_number', { ascending: false }).limit(1);
    }
    const { data: verRows, error: verErr } = await verQuery;
    if (verErr || !verRows || verRows.length === 0) throw verErr || new Error('VERSION_NOT_FOUND');
    const ver = verRows[0];

    // 3. Fetch policy details
    const { data: details } = await supabase
      .from('governed_policy_details')
      .select('*')
      .eq('version_id', ver.id)
      .maybeSingle();

    // 4. Fetch policy requirements
    const { data: reqs } = await supabase
      .from('policy_requirements')
      .select('*')
      .eq('policy_version_id', ver.id)
      .order('sequence_number', { ascending: true });

    // 5. Fetch department scopes
    const { data: deptScopes } = await supabase
      .from('document_version_department_scope')
      .select('department_id')
      .eq('version_id', ver.id);

    // 6. Fetch role scopes
    const { data: roleScopes } = await supabase
      .from('document_version_role_scope')
      .select('id, role_name, job_title')
      .eq('version_id', ver.id);

    // 7. Fetch review events
    const { data: events } = await supabase
      .from('document_review_events')
      .select('*, profiles(full_name)')
      .eq('document_id', documentId)
      .order('created_at', { ascending: false });

    // 8. Fetch exceptions
    const { data: exceptions } = await supabase
      .from('policy_sop_exceptions')
      .select('*, profiles!policy_sop_exceptions_requested_by_fkey(full_name)')
      .eq('document_id', documentId)
      .order('created_at', { ascending: false });

    // 9. Fetch review triggers
    const { data: triggers } = await supabase
      .from('governed_document_review_triggers')
      .select('*')
      .eq('document_id', documentId)
      .order('created_at', { ascending: false });

    // 10. Fetch all versions for timeline
    const { data: allVers } = await supabase
      .from('document_versions')
      .select('id, version_number, version_label, is_current_version, effective_date, expiry_date, approved_at, locked_at, prepared_by, revision_reason')
      .eq('document_id', documentId)
      .order('version_number', { ascending: false });

    return {
      document_id: doc.id,
      organization_id: doc.organization_id,
      document_code: doc.document_code || 'UNASSIGNED',
      document_title: doc.document_title,
      document_description: doc.document_description,
      document_status: doc.document_status,
      workflow_stage: doc.workflow_stage,
      department_id: doc.department_id,
      department_name: doc.departments?.name || null,
      document_owner_id: doc.document_owner_id,
      document_owner_name: doc.profiles?.full_name || null,
      effective_date: doc.effective_date,
      next_review_date: doc.next_review_date,
      expiry_date: doc.expiry_date,
      criticality_level: doc.criticality_level || 'medium',
      confidentiality_level: doc.confidentiality_level || 'internal',
      active_flag: doc.active_flag ?? true,
      version_id: ver.id,
      version_number: ver.version_number,
      version_label: ver.version_label || `${ver.version_number}.0`,
      is_current_version: ver.is_current_version ?? false,
      approved_by: ver.approved_by,
      approved_at: ver.approved_at,
      locked_by: ver.locked_by,
      locked_at: ver.locked_at,
      revision_reason: ver.revision_reason,
      supersedes_version_id: ver.supersedes_version_id,
      title_en: details?.title_en || doc.document_title,
      title_ar: details?.title_ar || null,
      purpose_en: details?.purpose_en || '',
      purpose_ar: details?.purpose_ar || null,
      policy_statement_en: details?.policy_statement_en || '',
      policy_statement_ar: details?.policy_statement_ar || null,
      scope_en: details?.scope_en || null,
      scope_ar: details?.scope_ar || null,
      principles_en: details?.principles_en || null,
      principles_ar: details?.principles_ar || null,
      exceptions_summary_en: details?.exceptions_summary_en || null,
      exceptions_summary_ar: details?.exceptions_summary_ar || null,
      non_compliance_escalation_en: details?.non_compliance_escalation_en || null,
      non_compliance_escalation_ar: details?.non_compliance_escalation_ar || null,
      content_mode: details?.content_mode || 'structured',
      transcription_status: details?.transcription_status || 'not_required',
      requirements: (reqs || []).map(r => ({
        id: r.id,
        sequence_number: r.sequence_number,
        requirement_statement_en: r.requirement_statement_en,
        requirement_statement_ar: r.requirement_statement_ar,
        responsible_role: r.responsible_role,
        is_mandatory: r.is_mandatory,
        expected_evidence_en: r.expected_evidence_en,
        expected_evidence_ar: r.expected_evidence_ar,
        mapped_control_id: r.mapped_control_id,
        linked_accreditation_clause_id: r.linked_accreditation_clause_id,
        monitoring_frequency: r.monitoring_frequency,
        monitoring_owner_id: r.monitoring_owner_id
      })),
      department_scopes: (deptScopes || []).map(ds => ds.department_id),
      role_scopes: (roleScopes || []).map(rs => ({ id: rs.id, role_name: rs.role_name, job_title: rs.job_title })),
      review_events: (events || []).map(ev => ({
        id: ev.id,
        document_id: ev.document_id,
        version_id: ev.version_id,
        event_type: ev.event_type,
        from_status: ev.from_status,
        to_status: ev.to_status,
        actor_id: ev.actor_id,
        actor_name: ev.profiles?.full_name || null,
        event_note: ev.event_note,
        created_at: ev.created_at
      })),
      exceptions: (exceptions || []).map(ex => ({
        id: ex.id,
        document_id: ex.document_id,
        document_version_id: ex.document_version_id,
        exception_code: ex.exception_code,
        exception_reason: ex.exception_reason,
        scope_description: ex.scope_description,
        effective_start_date: ex.effective_start_date,
        effective_end_date: ex.effective_end_date,
        risk_assessment_summary: ex.risk_assessment_summary,
        compensating_controls: ex.compensating_controls,
        requested_by: ex.requested_by,
        requested_by_name: ex.profiles?.full_name || null,
        requested_at: ex.requested_at,
        status: ex.status,
        decision_by: ex.decision_by,
        decision_at: ex.decision_at,
        decision_note: ex.decision_note
      })),
      review_triggers: (triggers || []).map(tr => ({
        id: tr.id,
        document_id: tr.document_id,
        version_id: tr.version_id,
        trigger_type: tr.trigger_type,
        source_entity_type: tr.source_entity_type,
        source_entity_id: tr.source_entity_id,
        triggered_by: tr.triggered_by,
        triggered_at: tr.triggered_at,
        review_owner_id: tr.review_owner_id,
        due_date: tr.due_date,
        status: tr.status,
        outcome: tr.outcome,
        outcome_note: tr.outcome_note,
        completed_at: tr.completed_at
      })),
      all_versions: allVers || []
    };
  } catch (error) {
    console.error('[PolicySopApi] getGovernedPolicyDetail error:', error);
    return null;
  }
}

export async function listEligibleGoverningPolicies(): Promise<EligibleGoverningPolicy[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('v_governed_policy_catalog')
      .select('version_id, document_id, document_code, title_en, title_ar, version_label, document_status, effective_date')
      .order('document_code', { ascending: true });
    if (error) throw error;
    return (data as unknown as EligibleGoverningPolicy[]) || [];
  } catch (error) {
    console.warn('[PolicySopApi] listEligibleGoverningPolicies fallback:', error);
    return [];
  }
}

export async function getGovernedSopDetail(documentId: string, versionId?: string): Promise<DetailedSopRecord | null> {
  if (!supabase) return null;
  try {
    // 1. Fetch document root
    const { data: doc, error: docErr } = await supabase
      .from('controlled_documents')
      .select('*, departments(id, name, code), profiles!controlled_documents_document_owner_id_fkey(id, full_name)')
      .eq('id', documentId)
      .single();
    if (docErr || !doc) throw docErr || new Error('DOCUMENT_NOT_FOUND');

    const targetVerId = versionId || doc.current_version_id;

    // 2. Fetch target version
    let verQuery = supabase.from('document_versions').select('*');
    if (targetVerId) {
      verQuery = verQuery.eq('id', targetVerId);
    } else {
      verQuery = verQuery.eq('document_id', documentId).order('version_number', { ascending: false }).limit(1);
    }
    const { data: verRows, error: verErr } = await verQuery;
    if (verErr || !verRows || verRows.length === 0) throw verErr || new Error('VERSION_NOT_FOUND');
    const ver = verRows[0];

    // 3. Fetch SOP details
    const { data: details } = await supabase
      .from('governed_sop_details')
      .select('*, profiles!governed_sop_details_process_owner_id_fkey(id, full_name)')
      .eq('version_id', ver.id)
      .maybeSingle();

    // 4. Fetch procedure steps with mapped control code/title
    const { data: steps } = await supabase
      .from('sop_procedure_steps')
      .select('*, control_library_items(code, title)')
      .eq('sop_version_id', ver.id)
      .order('sequence_number', { ascending: true });

    // 5. Fetch definitions
    const { data: defs } = await supabase
      .from('sop_definitions')
      .select('*')
      .eq('sop_version_id', ver.id)
      .order('sequence_number', { ascending: true });

    // 6. Fetch role responsibilities
    const { data: resps } = await supabase
      .from('sop_role_responsibilities')
      .select('*')
      .eq('sop_version_id', ver.id)
      .order('sequence_number', { ascending: true });

    // 7. Fetch monitoring KPIs
    const { data: kpis } = await supabase
      .from('sop_monitoring_kpis')
      .select('*, profiles!sop_monitoring_kpis_owner_id_fkey(full_name)')
      .eq('sop_version_id', ver.id)
      .order('sequence_number', { ascending: true });

    // 8. Fetch linked governing policy metadata if linked
    let primaryPolicyDocCode: string | null = null;
    let primaryPolicyDocTitle: string | null = null;
    let primaryPolicyVerLabel: string | null = null;

    if (details?.primary_policy_version_id) {
      const { data: polVer } = await supabase
        .from('document_versions')
        .select('version_label, controlled_documents(document_code, document_title)')
        .eq('id', details.primary_policy_version_id)
        .maybeSingle();
      if (polVer) {
        primaryPolicyVerLabel = polVer.version_label;
        const polDoc = polVer.controlled_documents as unknown as { document_code?: string; document_title?: string };
        primaryPolicyDocCode = polDoc?.document_code || null;
        primaryPolicyDocTitle = polDoc?.document_title || null;
      }
    }

    // 9. Fetch department scopes
    const { data: deptScopes } = await supabase
      .from('document_version_department_scope')
      .select('department_id')
      .eq('version_id', ver.id);

    // 10. Fetch role scopes
    const { data: roleScopes } = await supabase
      .from('document_version_role_scope')
      .select('id, role_name, job_title')
      .eq('version_id', ver.id);

    // 11. Fetch review events
    const { data: events } = await supabase
      .from('document_review_events')
      .select('*, profiles(full_name)')
      .eq('document_id', documentId)
      .order('created_at', { ascending: false });

    // 12. Fetch exceptions
    const { data: exceptions } = await supabase
      .from('policy_sop_exceptions')
      .select('*, profiles!policy_sop_exceptions_requested_by_fkey(full_name)')
      .eq('document_id', documentId)
      .order('created_at', { ascending: false });

    // 13. Fetch review triggers
    const { data: triggers } = await supabase
      .from('governed_document_review_triggers')
      .select('*')
      .eq('document_id', documentId)
      .order('created_at', { ascending: false });

    // 14. Fetch all versions for timeline
    const { data: allVers } = await supabase
      .from('document_versions')
      .select('id, version_number, version_label, is_current_version, effective_date, expiry_date, approved_at, locked_at, prepared_by, revision_reason')
      .eq('document_id', documentId)
      .order('version_number', { ascending: false });

    // 15. Fetch direct risk links
    const { data: riskLinks } = await supabase
      .from('sop_version_risk_links')
      .select('*, risks(id, risk_code, title, status, risk_level)')
      .eq('sop_version_id', ver.id)
      .order('sequence_number', { ascending: true });

    // 16. Fetch direct accreditation links
    const { data: accLinks } = await supabase
      .from('sop_version_accreditation_links')
      .select('*, accreditation_clauses(id, clause_code, clause_title, clause_title_ar, criticality, accreditation_standards(standard_code, framework))')
      .eq('sop_version_id', ver.id)
      .order('sequence_number', { ascending: true });

    // 17. Derive controls from procedure steps
    const derivedControlsMap = new Map<string, SopDerivedControl>();
    (steps || []).forEach(s => {
      if (s.required_control_id && s.control_library_items) {
        const ctrl = s.control_library_items as unknown as { code?: string; title?: string; control_type?: string; key_control?: boolean };
        if (!derivedControlsMap.has(s.required_control_id)) {
          derivedControlsMap.set(s.required_control_id, {
            control_id: s.required_control_id,
            control_code: ctrl?.code || null,
            control_title: ctrl?.title || 'Untitled Control',
            control_type: ctrl?.control_type || 'preventive',
            key_control: ctrl?.key_control ?? false,
            step_sequences: [s.sequence_number]
          });
        } else {
          derivedControlsMap.get(s.required_control_id)!.step_sequences.push(s.sequence_number);
        }
      }
    });
    const derived_controls = Array.from(derivedControlsMap.values());

    // 18. Derive inherited policy accreditations if primary policy is linked
    let inherited_accreditations: SopInheritedAccreditation[] = [];
    if (details?.primary_policy_version_id) {
      const { data: policyReqs } = await supabase
        .from('policy_requirements')
        .select('requirement_statement_en, requirement_statement_ar, linked_accreditation_clause_id, accreditation_clauses(id, clause_code, clause_title, clause_title_ar, criticality, accreditation_standards(standard_code, framework))')
        .eq('policy_version_id', details.primary_policy_version_id)
        .not('linked_accreditation_clause_id', 'is', null);

      if (policyReqs) {
        inherited_accreditations = policyReqs.map(pr => {
          const cl = pr.accreditation_clauses as unknown as {
            id: string;
            clause_code: string;
            clause_title: string;
            clause_title_ar?: string;
            criticality: string;
            accreditation_standards?: { standard_code?: string; framework?: string };
          };
          return {
            clause_id: cl?.id || pr.linked_accreditation_clause_id || '',
            clause_code: cl?.clause_code || 'CLAUSE',
            clause_title: cl?.clause_title || 'Untitled Clause',
            clause_title_ar: cl?.clause_title_ar || null,
            standard_code: cl?.accreditation_standards?.standard_code || 'STANDARD',
            framework: cl?.accreditation_standards?.framework || 'CBAHI',
            criticality: cl?.criticality || 'medium',
            policy_requirement_en: pr.requirement_statement_en,
            policy_requirement_ar: pr.requirement_statement_ar
          };
        });
      }
    }

    return {
      document_id: doc.id,
      organization_id: doc.organization_id,
      document_code: doc.document_code || 'UNASSIGNED',
      document_title: doc.document_title,
      document_description: doc.document_description,
      document_status: doc.document_status,
      workflow_stage: doc.workflow_stage,
      department_id: doc.department_id,
      department_name: doc.departments?.name || null,
      document_owner_id: doc.document_owner_id,
      document_owner_name: doc.profiles?.full_name || null,
      effective_date: doc.effective_date,
      next_review_date: doc.next_review_date,
      expiry_date: doc.expiry_date,
      criticality_level: doc.criticality_level || 'medium',
      confidentiality_level: doc.confidentiality_level || 'internal',
      active_flag: doc.active_flag ?? true,
      version_id: ver.id,
      version_number: ver.version_number,
      version_label: ver.version_label || `${ver.version_number}.0`,
      is_current_version: ver.is_current_version ?? false,
      approved_by: ver.approved_by,
      approved_at: ver.approved_at,
      locked_by: ver.locked_by,
      locked_at: ver.locked_at,
      revision_reason: ver.revision_reason,
      supersedes_version_id: ver.supersedes_version_id,
      title_en: details?.title_en || doc.document_title,
      title_ar: details?.title_ar || null,
      process_name_en: details?.process_name_en || '',
      process_name_ar: details?.process_name_ar || null,
      process_owner_id: details?.process_owner_id || null,
      process_owner_name: details?.profiles?.full_name || null,
      purpose_en: details?.purpose_en || '',
      purpose_ar: details?.purpose_ar || null,
      scope_en: details?.scope_en || null,
      scope_ar: details?.scope_ar || null,
      primary_policy_version_id: details?.primary_policy_version_id || null,
      primary_policy_document_code: primaryPolicyDocCode,
      primary_policy_document_title: primaryPolicyDocTitle,
      primary_policy_version_label: primaryPolicyVerLabel,
      governance_link_state: details?.governance_link_state || 'linked',
      training_required: details?.training_required ?? false,
      acknowledgment_required: details?.acknowledgment_required ?? false,
      competency_assessment_required: details?.competency_assessment_required ?? false,
      acknowledgment_sla_days: details?.acknowledgment_sla_days ?? 30,
      training_renewal_months: details?.training_renewal_months ?? 12,
      content_mode: details?.content_mode || 'structured',
      transcription_status: details?.transcription_status || 'not_required',
      procedure_steps: (steps || []).map(s => {
        const ctrl = s.control_library_items as unknown as { code?: string; title?: string } | undefined;
        return {
          id: s.id,
          sequence_number: s.sequence_number,
          responsible_role: s.responsible_role,
          action_instruction_en: s.action_instruction_en,
          action_instruction_ar: s.action_instruction_ar,
          required_control_id: s.required_control_id,
          required_control_code: ctrl?.code || null,
          required_control_title: ctrl?.title || null,
          expected_evidence_record_en: s.expected_evidence_record_en,
          expected_evidence_record_ar: s.expected_evidence_record_ar,
          timing_sla_en: s.timing_sla_en,
          timing_sla_ar: s.timing_sla_ar,
          is_decision_point: s.is_decision_point,
          decision_criteria_en: s.decision_criteria_en,
          decision_criteria_ar: s.decision_criteria_ar,
          criticality: s.criticality,
          escalation_trigger_en: s.escalation_trigger_en,
          escalation_trigger_ar: s.escalation_trigger_ar,
          escalation_destination_role: s.escalation_destination_role
        };
      }),
      definitions: (defs || []).map(d => ({
        id: d.id,
        sequence_number: d.sequence_number,
        term_en: d.term_en,
        term_ar: d.term_ar,
        abbreviation: d.abbreviation,
        definition_en: d.definition_en,
        definition_ar: d.definition_ar
      })),
      role_responsibilities: (resps || []).map(r => ({
        id: r.id,
        sequence_number: r.sequence_number,
        role_name: r.role_name,
        job_title: r.job_title,
        responsibility_en: r.responsibility_en,
        responsibility_ar: r.responsibility_ar,
        accountable_for_en: r.accountable_for_en,
        accountable_for_ar: r.accountable_for_ar
      })),
      monitoring_kpis: (kpis || []).map(k => {
        const prof = k.profiles as unknown as { full_name?: string } | undefined;
        return {
          id: k.id,
          sequence_number: k.sequence_number,
          kpi_name_en: k.kpi_name_en,
          kpi_name_ar: k.kpi_name_ar,
          target_value: k.target_value,
          measurement_frequency: k.measurement_frequency,
          owner_id: k.owner_id,
          owner_name: prof?.full_name || null,
          description_en: k.description_en,
          description_ar: k.description_ar
        };
      }),
      risk_links: (riskLinks || []).map(rl => {
        const r = rl.risks as unknown as { id: string; risk_code?: string; title?: string; status?: string; risk_level?: string } | undefined;
        return {
          id: rl.id,
          sequence_number: rl.sequence_number,
          risk_id: rl.risk_id,
          risk_code: r?.risk_code || null,
          risk_title: r?.title || null,
          risk_status: r?.status || null,
          risk_level: r?.risk_level || null,
          relationship_type: rl.relationship_type,
          context_note_en: rl.context_note_en,
          context_note_ar: rl.context_note_ar
        };
      }),
      accreditation_links: (accLinks || []).map(al => {
        const c = al.accreditation_clauses as unknown as {
          id: string;
          clause_code?: string;
          clause_title?: string;
          clause_title_ar?: string;
          criticality?: string;
          accreditation_standards?: { standard_code?: string; framework?: string };
        } | undefined;
        return {
          id: al.id,
          sequence_number: al.sequence_number,
          clause_id: al.clause_id,
          clause_code: c?.clause_code || null,
          clause_title: c?.clause_title || null,
          clause_title_ar: c?.clause_title_ar || null,
          framework: c?.accreditation_standards?.framework || null,
          standard_code: c?.accreditation_standards?.standard_code || null,
          criticality: c?.criticality || null,
          link_strength: al.link_strength,
          context_note_en: al.context_note_en,
          context_note_ar: al.context_note_ar
        };
      }),
      derived_controls,
      inherited_accreditations,
      department_scopes: (deptScopes || []).map(ds => ds.department_id),
      role_scopes: (roleScopes || []).map(rs => ({ id: rs.id, role_name: rs.role_name, job_title: rs.job_title })),
      review_events: (events || []).map(ev => ({
        id: ev.id,
        document_id: ev.document_id,
        version_id: ev.version_id,
        event_type: ev.event_type,
        from_status: ev.from_status,
        to_status: ev.to_status,
        actor_id: ev.actor_id,
        actor_name: ev.profiles?.full_name || null,
        event_note: ev.event_note,
        created_at: ev.created_at
      })),
      exceptions: (exceptions || []).map(ex => ({
        id: ex.id,
        document_id: ex.document_id,
        document_version_id: ex.document_version_id,
        exception_code: ex.exception_code,
        exception_reason: ex.exception_reason,
        scope_description: ex.scope_description,
        effective_start_date: ex.effective_start_date,
        effective_end_date: ex.effective_end_date,
        risk_assessment_summary: ex.risk_assessment_summary,
        compensating_controls: ex.compensating_controls,
        requested_by: ex.requested_by,
        requested_by_name: ex.profiles?.full_name || null,
        requested_at: ex.requested_at,
        status: ex.status,
        decision_by: ex.decision_by,
        decision_by_name: ex.decision_profiles?.full_name || null,
        decision_at: ex.decision_at,
        decision_note: ex.decision_note
      })),
      review_triggers: (triggers || []).map(tr => ({
        id: tr.id,
        document_id: tr.document_id,
        version_id: tr.version_id,
        trigger_type: tr.trigger_type,
        source_entity_type: tr.source_entity_type,
        source_entity_id: tr.source_entity_id,
        triggered_by: tr.triggered_by,
        triggered_at: tr.triggered_at,
        review_owner_id: tr.review_owner_id,
        due_date: tr.due_date,
        status: tr.status,
        outcome: tr.outcome,
        outcome_note: tr.outcome_note,
        completed_at: tr.completed_at
      })),
      all_versions: (allVers || []).map(av => ({
        id: av.id,
        version_number: av.version_number,
        version_label: av.version_label,
        is_current_version: av.is_current_version,
        effective_date: av.effective_date,
        expiry_date: av.expiry_date,
        approved_at: av.approved_at,
        locked_at: av.locked_at,
        prepared_by: av.prepared_by,
        revision_reason: av.revision_reason
      }))
    };
  } catch (error) {
    console.error('[PolicySopApi] fetchGovernedSopWorkspace failed:', error);
    return null;
  }
}

export async function listDepartments(): Promise<Array<{ id: string; name: string; code: string }>> {
  if (!supabase) return [];
  try {
    const { data } = await supabase.from('departments').select('id, name, code').order('name');
    return data || [];
  } catch {
    return [];
  }
}

export async function listProfiles(): Promise<Array<{ id: string; full_name: string; email: string; job_title: string | null }>> {
  if (!supabase) return [];
  try {
    const { data } = await supabase.from('profiles').select('id, full_name, email, job_title').eq('is_active', true).order('full_name');
    return data || [];
  } catch {
    return [];
  }
}

export async function listControls(): Promise<Array<{ id: string; code: string; title: string }>> {
  if (!supabase) return [];
  try {
    const { data } = await supabase.from('controls').select('id, code, title').order('code');
    return data || [];
  } catch {
    return [];
  }
}

export async function listAccreditationClauses(): Promise<Array<{ id: string; clause_number: string; title: string }>> {
  if (!supabase) return [];
  try {
    const { data } = await supabase.from('accreditation_clauses').select('id, clause_number, title').order('clause_number');
    return data || [];
  } catch {
    return [];
  }
}

export async function fetchActiveRisks(organizationId: string): Promise<Array<{
  id: string;
  risk_code: string;
  title: string;
  status: string;
  risk_level: string;
  department_id?: string | null;
  department_name?: string | null;
}>> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('risks')
      .select('id, risk_code, title, status, risk_level, department_id, departments(name)')
      .eq('organization_id', organizationId)
      .not('status', 'in', '("closed","cancelled")')
      .order('risk_code', { ascending: true });

    if (error) throw error;
    return (data || []).map(r => ({
      id: r.id,
      risk_code: r.risk_code || 'UNASSIGNED',
      title: r.title,
      status: r.status,
      risk_level: r.risk_level,
      department_id: r.department_id,
      department_name: (r.departments as unknown as { name?: string })?.name || null
    }));
  } catch (error) {
    console.warn('[PolicySopApi] fetchActiveRisks fallback:', error);
    return [];
  }
}

export async function fetchAccreditationClauses(): Promise<Array<{
  id: string;
  clause_code: string;
  clause_title: string;
  clause_title_ar?: string | null;
  framework: string;
  standard_code: string;
  criticality: string;
}>> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('accreditation_clauses')
      .select('id, clause_code, clause_title, clause_title_ar, criticality, accreditation_standards(standard_code, framework)')
      .eq('active', true)
      .order('clause_code', { ascending: true });

    if (error) throw error;
    return (data || []).map(c => {
      const std = c.accreditation_standards as unknown as { standard_code?: string; framework?: string };
      return {
        id: c.id,
        clause_code: c.clause_code,
        clause_title: c.clause_title,
        clause_title_ar: c.clause_title_ar || null,
        framework: std?.framework || 'CBAHI',
        standard_code: std?.standard_code || 'STD',
        criticality: c.criticality || 'medium'
      };
    });
  } catch (error) {
    console.warn('[PolicySopApi] fetchAccreditationClauses fallback:', error);
    return [];
  }
}

export async function getSopTraceabilityMatrix(sopVersionId: string): Promise<SopTraceabilityMatrixRow[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('v_sop_traceability_matrix')
      .select('*')
      .eq('sop_version_id', sopVersionId)
      .order('sequence_number', { ascending: true });
    if (error) throw error;
    return (data as unknown as SopTraceabilityMatrixRow[]) || [];
  } catch (error) {
    console.warn('[PolicySopApi] getSopTraceabilityMatrix fallback:', error);
    return [];
  }
}

// ----------------------------------------------------------------------------
// Privileged Mutation APIs (Routed via Edge privileged-action)
// ----------------------------------------------------------------------------

export interface CreatePolicyDraftInput {
  title_en: string;
  title_ar?: string;
  purpose_en: string;
  purpose_ar?: string;
  policy_statement_en: string;
  policy_statement_ar?: string;
  scope_en?: string;
  scope_ar?: string;
  principles_en?: string;
  principles_ar?: string;
  exceptions_summary_en?: string;
  exceptions_summary_ar?: string;
  non_compliance_escalation_en?: string;
  non_compliance_escalation_ar?: string;
  department_id?: string | null;
  criticality_level?: 'low' | 'medium' | 'high' | 'critical';
  confidentiality_level?: 'public' | 'internal' | 'confidential' | 'restricted';
  requirements?: PolicyRequirement[];
  department_scopes?: string[];
  role_scopes?: RoleScope[];
}

export async function createGovernedPolicyDraft(input: CreatePolicyDraftInput): Promise<{ document_id: string; version_id: string; document_code: string }> {
  return invokePrivilegedAction<{ document_id: string; version_id: string; document_code: string }>(
    'create_governed_policy_draft',
    input as unknown as Record<string, unknown>
  );
}

export interface SavePolicyDraftInput {
  version_id: string;
  title_en: string;
  title_ar?: string;
  purpose_en: string;
  purpose_ar?: string;
  policy_statement_en: string;
  policy_statement_ar?: string;
  scope_en?: string;
  scope_ar?: string;
  principles_en?: string;
  principles_ar?: string;
  exceptions_summary_en?: string;
  exceptions_summary_ar?: string;
  non_compliance_escalation_en?: string;
  non_compliance_escalation_ar?: string;
  requirements?: PolicyRequirement[];
  department_scopes?: string[];
  role_scopes?: RoleScope[];
}

export async function saveGovernedPolicyDraft(input: SavePolicyDraftInput): Promise<{ success: boolean; version_id: string }> {
  return invokePrivilegedAction<{ success: boolean; version_id: string }>(
    'save_governed_policy_draft',
    input as unknown as Record<string, unknown>
  );
}

export interface CreateSopDraftInput {
  title_en: string;
  title_ar?: string;
  process_name_en: string;
  process_name_ar?: string;
  purpose_en: string;
  purpose_ar?: string;
  process_owner_id?: string | null;
  primary_policy_version_id?: string | null;
  governance_link_state?: 'linked' | 'legacy_pending' | 'not_applicable';
  scope_en?: string;
  scope_ar?: string;
  department_id?: string | null;
  criticality_level?: 'low' | 'medium' | 'high' | 'critical';
  confidentiality_level?: 'public' | 'internal' | 'confidential' | 'restricted';
  training_required?: boolean;
  acknowledgment_required?: boolean;
  competency_assessment_required?: boolean;
  acknowledgment_sla_days?: number;
  training_renewal_months?: number;
  content_mode?: 'structured' | 'legacy_controlled_document';
  procedure_steps?: SopProcedureStep[];
  department_scopes?: string[];
  role_scopes?: RoleScope[];
  definitions?: SopDefinition[];
  role_responsibilities?: SopRoleResponsibility[];
  monitoring_kpis?: SopMonitoringKpi[];
}

export async function createGovernedSopDraft(input: CreateSopDraftInput): Promise<{ document_id: string; version_id: string; document_code: string }> {
  return invokePrivilegedAction<{ document_id: string; version_id: string; document_code: string }>(
    'create_governed_sop_draft',
    input as unknown as Record<string, unknown>
  );
}

export interface SaveSopDraftInput {
  version_id: string;
  title_en: string;
  title_ar?: string;
  process_name_en: string;
  process_name_ar?: string;
  purpose_en: string;
  purpose_ar?: string;
  process_owner_id?: string | null;
  primary_policy_version_id?: string | null;
  governance_link_state?: 'linked' | 'legacy_pending' | 'not_applicable';
  scope_en?: string;
  scope_ar?: string;
  training_required?: boolean;
  acknowledgment_required?: boolean;
  competency_assessment_required?: boolean;
  acknowledgment_sla_days?: number;
  training_renewal_months?: number;
  procedure_steps?: SopProcedureStep[];
  department_scopes?: string[];
  role_scopes?: RoleScope[];
  definitions?: SopDefinition[];
  role_responsibilities?: SopRoleResponsibility[];
  monitoring_kpis?: SopMonitoringKpi[];
  risk_links?: SopRiskLink[];
  accreditation_links?: SopAccreditationLink[];
}

export async function saveGovernedSopDraft(input: SaveSopDraftInput): Promise<{ success: boolean; version_id: string }> {
  return invokePrivilegedAction<{ success: boolean; version_id: string }>(
    'save_governed_sop_draft',
    input as unknown as Record<string, unknown>
  );
}

export async function startGovernedDocumentRevision(
  sourceVersionId: string,
  revisionType: 'minor' | 'major',
  revisionReason?: string
): Promise<{ document_id: string; version_id: string; version_number: number; version_label: string }> {
  return invokePrivilegedAction<{ document_id: string; version_id: string; version_number: number; version_label: string }>(
    'start_governed_document_revision',
    {
      source_version_id: sourceVersionId,
      revision_type: revisionType,
      revision_reason: revisionReason
    }
  );
}

export async function submitGovernedDocumentForReview(versionId: string, submissionNote?: string): Promise<{ document_id: string; version_id: string; approval_request_id: string; status: string }> {
  return invokePrivilegedAction<{ document_id: string; version_id: string; approval_request_id: string; status: string }>(
    'submit_governed_document_for_review',
    {
      version_id: versionId,
      submission_note: submissionNote
    }
  );
}

export async function activateGovernedDocumentVersion(versionId: string, effectiveDate?: string): Promise<{ document_id: string; version_id: string; status: string; effective_date: string }> {
  return invokePrivilegedAction<{ document_id: string; version_id: string; status: string; effective_date: string }>(
    'activate_governed_document_version',
    {
      version_id: versionId,
      effective_date: effectiveDate
    }
  );
}

export async function retireGovernedDocument(documentId: string, retirementReason: string): Promise<{ document_id: string; status: string }> {
  return invokePrivilegedAction<{ document_id: string; status: string }>(
    'retire_governed_document',
    {
      document_id: documentId,
      retirement_reason: retirementReason
    }
  );
}

export interface RequestPolicyExceptionInput {
  version_id: string;
  reason: string;
  scope_description: string;
  start_date: string;
  end_date: string;
  risk_summary?: string;
  compensating_controls?: string;
}

export async function requestPolicySopException(input: RequestPolicyExceptionInput): Promise<{ exception_id: string; exception_code: string; status: string }> {
  return invokePrivilegedAction<{ exception_id: string; exception_code: string; status: string }>(
    'request_policy_sop_exception',
    input as unknown as Record<string, unknown>
  );
}

export interface TriggerReviewInput {
  document_id: string;
  trigger_type: 'scheduled' | 'regulatory_change' | 'audit_finding' | 'ovr' | 'capa' | 'management_decision' | 'accreditation_finding';
  source_entity_type?: string;
  source_entity_id?: string;
  due_date?: string;
  trigger_note?: string;
}

export async function triggerGovernedDocumentReview(input: TriggerReviewInput): Promise<{ trigger_id: string; document_id: string; status: string }> {
  return invokePrivilegedAction<{ trigger_id: string; document_id: string; status: string }>(
    'trigger_governed_document_review',
    input as unknown as Record<string, unknown>
  );
}

export async function completeGovernedDocumentReview(
  triggerId: string,
  outcome: 'no_change' | 'minor_revision' | 'major_revision' | 'retire',
  outcomeNote?: string
): Promise<{ trigger_id: string; outcome: string; status: string }> {
  return invokePrivilegedAction<{ trigger_id: string; outcome: string; status: string }>(
    'complete_governed_document_review',
    {
      trigger_id: triggerId,
      outcome,
      outcome_note: outcomeNote
    }
  );
}

// ----------------------------------------------------------------------------
// E2B1 Governed SOP Training, Acknowledgment & Competency Lifecycle APIs
// ----------------------------------------------------------------------------

export interface DecideSopRolloutInput {
  version_id: string;
  retraining_required?: boolean;
  reacknowledgment_required?: boolean;
  competency_reassessment_required?: boolean;
  rationale: string;
}

export async function decideSopRolloutRequirements(input: DecideSopRolloutInput): Promise<{
  success: boolean;
  version_id: string;
  retraining_required: boolean;
  reacknowledgment_required: boolean;
  competency_reassessment_required: boolean;
  decided_at: string;
}> {
  return invokePrivilegedAction<{
    success: boolean;
    version_id: string;
    retraining_required: boolean;
    reacknowledgment_required: boolean;
    competency_reassessment_required: boolean;
    decided_at: string;
  }>(
    'decide_sop_rollout_requirements',
    input as unknown as Record<string, unknown>
  );
}

export async function publishSopTrainingObligations(versionId: string): Promise<{
  success: boolean;
  version_id: string;
  program_id: string;
  cycle: number;
  cycle_type: string;
  assignments_created: number;
  acknowledgment_requirements_created: number;
}> {
  return invokePrivilegedAction<{
    success: boolean;
    version_id: string;
    program_id: string;
    cycle: number;
    cycle_type: string;
    assignments_created: number;
    acknowledgment_requirements_created: number;
  }>(
    'publish_sop_training_obligations',
    { version_id: versionId }
  );
}

export async function reconcileSopTrainingPopulation(versionId: string): Promise<{
  success: boolean;
  version_id: string;
  program_id: string;
  cycle: number;
  cycle_type: string;
  target_population_count: number;
  newly_assigned_count: number;
  reactivated_assignment_count: number;
  cancelled_out_of_scope_count: number;
  acknowledgment_requirements_created: number;
  acknowledgment_requirements_reactivated: number;
  acknowledgment_requirements_deactivated: number;
}> {
  return invokePrivilegedAction<{
    success: boolean;
    version_id: string;
    program_id: string;
    cycle: number;
    cycle_type: string;
    target_population_count: number;
    newly_assigned_count: number;
    reactivated_assignment_count: number;
    cancelled_out_of_scope_count: number;
    acknowledgment_requirements_created: number;
    acknowledgment_requirements_reactivated: number;
    acknowledgment_requirements_deactivated: number;
  }>(
    'reconcile_sop_training_population',
    { version_id: versionId, confirm_reconciliation: true }
  );
}

export interface RecordDocumentAcknowledgmentInput {
  document_id: string;
  version_id: string;
  acknowledgment_method?: string;
  acknowledgment_note?: string;
}

export async function recordDocumentAcknowledgment(input: RecordDocumentAcknowledgmentInput): Promise<string> {
  return invokePrivilegedAction<string>(
    'record_document_acknowledgment',
    input as unknown as Record<string, unknown>
  );
}

export interface SopTrainingComplianceMatrixRow {
  sop_version_id: string;
  document_id: string;
  organization_id: string;
  document_code: string | null;
  document_title: string;
  version_number: number;
  version_label: string;
  document_status: string;
  training_required: boolean;
  acknowledgment_required: boolean;
  competency_assessment_required: boolean;
  target_population_count: number;
  training_target_count: number;
  acknowledgment_target_count: number;
  competency_target_count: number;
  assigned_count: number;
  in_progress_count: number;
  completed_count: number;
  overdue_count: number;
  waived_count: number;
  cancelled_count: number;
  acknowledged_count: number;
  acknowledgment_gap_count: number;
  competency_passed_count: number;
  competency_failed_count: number;
  competency_pending_count: number;
  renewal_due_count: number;
}

export async function getSopTrainingComplianceMatrix(sopVersionId?: string): Promise<SopTrainingComplianceMatrixRow[]> {
  if (!supabase) return [];
  try {
    let query = supabase.from('v_sop_training_compliance_matrix').select('*');
    if (sopVersionId) {
      query = query.eq('sop_version_id', sopVersionId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as SopTrainingComplianceMatrixRow[];
  } catch (error) {
    console.warn('[PolicySopApi] getSopTrainingComplianceMatrix fallback:', error);
    return [];
  }
}
