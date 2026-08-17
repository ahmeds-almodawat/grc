import { supabase } from './supabase';

export interface GovernedPolicyCatalogRow {
  document_id: string;
  organization_id: string;
  document_code: string | null;
  document_title: string;
  document_description: string | null;
  document_status: string;
  workflow_stage: string | null;
  department_id: string | null;
  department_name: string | null;
  document_owner_id: string | null;
  document_owner_name: string | null;
  effective_date: string | null;
  next_review_date: string | null;
  expiry_date: string | null;
  criticality_level: string | null;
  confidentiality_level: string | null;
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
  document_status: string;
  workflow_stage: string | null;
  department_id: string | null;
  department_name: string | null;
  document_owner_id: string | null;
  document_owner_name: string | null;
  effective_date: string | null;
  next_review_date: string | null;
  expiry_date: string | null;
  criticality_level: string | null;
  confidentiality_level: string | null;
  version_id: string | null;
  version_number: number | null;
  version_label: string | null;
  is_current_version: boolean | null;
  approved_at: string | null;
  locked_at: string | null;
  version_title_en: string | null;
  version_title_ar: string | null;
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
  step_count: number;
  created_at: string;
  updated_at: string;
}

export interface SopProcedureStepMatrixRow {
  step_id: string;
  sop_version_id: string;
  sop_version_number: number;
  document_id: string;
  organization_id: string;
  document_code: string | null;
  document_title: string;
  sequence_number: number;
  responsible_role: string;
  action_instruction_en: string;
  action_instruction_ar: string | null;
  required_control_id: string | null;
  required_control_code: string | null;
  required_control_title: string | null;
  expected_evidence_record_en: string | null;
  expected_evidence_record_ar: string | null;
  timing_sla_en: string | null;
  timing_sla_ar: string | null;
  is_decision_point: boolean;
  decision_criteria_en: string | null;
  decision_criteria_ar: string | null;
  criticality: 'low' | 'medium' | 'high' | 'critical';
  escalation_trigger_en: string | null;
  escalation_trigger_ar: string | null;
  escalation_destination_role: string | null;
  created_at: string;
  updated_at: string;
}

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

export async function getSopProcedureSteps(sopVersionId?: string): Promise<SopProcedureStepMatrixRow[]> {
  if (!supabase) return [];
  try {
    let query = supabase
      .from('v_sop_procedure_step_matrix')
      .select('*')
      .order('sequence_number', { ascending: true });
    if (sopVersionId) {
      query = query.eq('sop_version_id', sopVersionId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data as unknown as SopProcedureStepMatrixRow[]) || [];
  } catch (error) {
    console.warn('[PolicySopApi] getSopProcedureSteps fallback:', error);
    return [];
  }
}
