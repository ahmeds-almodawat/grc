import { invokePrivilegedAction } from './privilegedAction';
import { requireSupabase } from './supabase';

export type GovernanceSourceType = 'ovr' | 'risk' | 'audit_finding' | 'capa' | 'compliance_assessment' | 'compliance_finding';
export type GovernanceCriterionType =
  | 'policy'
  | 'policy_requirement'
  | 'sop'
  | 'sop_step'
  | 'compliance_obligation'
  | 'accreditation_clause'
  | 'control';
export type GovernanceReviewStatus = 'draft' | 'under_review' | 'completed';
export type GovernanceReviewOutcome =
  | 'confirmed_relationship'
  | 'related_not_violated'
  | 'no_applicable_document'
  | 'document_gap'
  | 'insufficient_evidence';
export type GovernanceDecisionType = 'suggested' | 'under_review' | 'confirmed' | 'rejected' | 'superseded';
export type GovernanceSignificance = 'primary' | 'contributing' | 'context_only';
export type GovernanceAdherenceStatus =
  | 'complied'
  | 'partial_adherence'
  | 'noncompliance'
  | 'procedure_not_followed'
  | 'authorized_exception'
  | 'emergency_justified_deviation'
  | 'insufficient_evidence'
  | 'not_applicable'
  | 'unknown';
export type GovernanceAdequacyStatus =
  | 'adequate'
  | 'unclear'
  | 'incomplete'
  | 'conflicting'
  | 'obsolete_version_used'
  | 'missing_policy'
  | 'missing_sop'
  | 'implementation_gap'
  | 'training_competency_gap'
  | 'control_failed_despite_compliance'
  | 'related_context_only'
  | 'not_applicable'
  | 'not_assessed';
export type GovernanceRelationshipOrigin =
  | 'reporter_suggested'
  | 'direct'
  | 'investigator_confirmed'
  | 'inherited'
  | 'system_recommended'
  | 'legacy_f1';
export type GovernanceResolutionMethod =
  | 'resolver_exact'
  | 'reviewer_override'
  | 'direct_selection'
  | 'persistent_context'
  | 'inherited'
  | 'legacy_f1';

export interface GovernanceLinkageReview {
  id: string;
  organization_id: string;
  source_entity_type: GovernanceSourceType;
  source_entity_id: string;
  source_revision_id: string | null;
  source_date: string | null;
  applicability_date: string | null;
  review_status: GovernanceReviewStatus;
  review_outcome: GovernanceReviewOutcome | null;
  uncertainty_recorded: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_rationale: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface GovernanceCriteriaLink {
  link_id: string;
  organization_id: string;
  review_id: string;
  source_entity_type: GovernanceSourceType;
  source_entity_id: string;
  source_revision_id: string | null;
  root_source_entity_type: GovernanceSourceType;
  root_source_entity_id: string;
  target_criterion_type: GovernanceCriterionType;
  target_document_id: string | null;
  target_version_id: string | null;
  target_policy_requirement_id: string | null;
  target_sop_step_id: string | null;
  target_compliance_obligation_id: string | null;
  target_accreditation_clause_id: string | null;
  target_control_id: string | null;
  target_display_label: string | null;
  target_confidentiality_level: string | null;
  relationship_origin: GovernanceRelationshipOrigin;
  resolution_date: string | null;
  resolution_method: GovernanceResolutionMethod;
  resolution_snapshot: Record<string, unknown>;
  current_decision_id: string | null;
  decision_type: GovernanceDecisionType | null;
  significance: GovernanceSignificance | null;
  adherence_status: GovernanceAdherenceStatus | null;
  adequacy_status: GovernanceAdequacyStatus | null;
  inherited: boolean;
  root_event_key: string;
  created_at: string;
}

export interface GovernanceCriteriaDecision {
  id: string;
  organization_id: string;
  link_id: string;
  decision_type: GovernanceDecisionType;
  significance: GovernanceSignificance | null;
  adherence_status: GovernanceAdherenceStatus | null;
  adequacy_status: GovernanceAdequacyStatus | null;
  actor_id: string;
  decided_at: string;
  rationale: string | null;
  correction_reason: string | null;
  supersedes_decision_id: string | null;
}

export interface GovernanceVersionResolverCandidate {
  candidate_version_id: string | null;
  candidate_count: number;
  resolution_status:
    | 'missing_source_date'
    | 'zero_candidates'
    | 'expired_version'
    | 'superseded_or_obsolete_version'
    | 'department_not_applicable'
    | 'exactly_one'
    | 'exactly_one_with_approved_exception'
    | 'overlapping_candidates';
  exception_id: string | null;
  department_applicable: boolean | null;
  facility_scope_status: 'facility_scope_unavailable';
  diagnostic_detail: string;
}

export interface GovernanceLinkLineage {
  parent_link_id: string;
  child_link_id: string;
  lineage_type: 'inherited_from' | 'derived_from' | 'supersedes';
  created_at: string;
}

export interface GovernanceLinkEvidence {
  decision_id: string;
  evidence_file_id: string;
  organization_id: string;
  evidence_role: 'primary' | 'supporting' | 'contradicting';
  added_by: string;
  created_at: string;
}

export interface ConfirmedGovernanceCriteriaTruth extends GovernanceCriteriaLink {
  confirmed_noncompliance: boolean;
  confirmed_procedure_failure: boolean;
  document_inadequacy: boolean;
  training_gap: boolean;
  control_failure: boolean;
  counts_as_violation: boolean;
}

export async function getCurrentGovernanceCriteriaLinks(source: {
  type: GovernanceSourceType;
  id: string;
}): Promise<GovernanceCriteriaLink[]> {
  const { data, error } = await requireSupabase()
    .from('v_current_governance_criteria_links')
    .select('*')
    .eq('source_entity_type', source.type)
    .eq('source_entity_id', source.id)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as GovernanceCriteriaLink[];
}

export async function getGovernanceLinkageReviews(source: {
  type: GovernanceSourceType;
  id: string;
  revisionId?: string | null;
}): Promise<GovernanceLinkageReview[]> {
  let query = requireSupabase()
    .from('governance_linkage_reviews')
    .select('*')
    .eq('source_entity_type', source.type)
    .eq('source_entity_id', source.id);
  query = source.revisionId
    ? query.eq('source_revision_id', source.revisionId)
    : query.is('source_revision_id', null);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as GovernanceLinkageReview[];
}

export async function getGovernanceCriteriaDecisionHistory(linkIds: string[]): Promise<GovernanceCriteriaDecision[]> {
  if (!linkIds.length) return [];
  const { data, error } = await requireSupabase()
    .from('governance_criteria_link_decisions')
    .select('*')
    .in('link_id', linkIds)
    .order('decided_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as GovernanceCriteriaDecision[];
}

export async function getGovernanceCriteriaLineage(linkIds: string[]): Promise<GovernanceLinkLineage[]> {
  if (!linkIds.length) return [];
  const client = requireSupabase();
  const [parents, children] = await Promise.all([
    client.from('governance_criteria_link_lineage').select('*').in('parent_link_id', linkIds),
    client.from('governance_criteria_link_lineage').select('*').in('child_link_id', linkIds),
  ]);
  if (parents.error) throw new Error(parents.error.message);
  if (children.error) throw new Error(children.error.message);
  const byKey = new Map<string, GovernanceLinkLineage>();
  [...(parents.data ?? []), ...(children.data ?? [])].forEach((row) => {
    const typed = row as GovernanceLinkLineage;
    byKey.set(`${typed.parent_link_id}:${typed.child_link_id}:${typed.lineage_type}`, typed);
  });
  return [...byKey.values()];
}

export async function getGovernanceCriteriaEvidence(decisionIds: string[]): Promise<GovernanceLinkEvidence[]> {
  if (!decisionIds.length) return [];
  const { data, error } = await requireSupabase()
    .from('governance_criteria_link_evidence')
    .select('*')
    .in('decision_id', decisionIds)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as GovernanceLinkEvidence[];
}

export async function getGovernanceLinkageReviewQueue(): Promise<GovernanceLinkageReview[]> {
  const { data, error } = await requireSupabase()
    .from('v_governance_linkage_review_queue')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as GovernanceLinkageReview[];
}

export async function getConfirmedGovernanceCriteriaTruth(source: {
  type: GovernanceSourceType;
  id: string;
}): Promise<ConfirmedGovernanceCriteriaTruth[]> {
  const { data, error } = await requireSupabase()
    .from('v_confirmed_governance_criteria_truth')
    .select('*')
    .eq('source_entity_type', source.type)
    .eq('source_entity_id', source.id)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ConfirmedGovernanceCriteriaTruth[];
}

export async function resolveGovernanceDocumentVersionCandidates(input: {
  organizationId: string;
  documentId: string;
  sourceDate: string | null;
  departmentId?: string | null;
}): Promise<GovernanceVersionResolverCandidate[]> {
  return invokePrivilegedAction<GovernanceVersionResolverCandidate[]>('resolve_governance_document_version_candidates', {
    document_id: input.documentId,
    source_date: input.sourceDate,
    department_id: input.departmentId ?? null,
  });
}

export function startGovernanceLinkageReview(input: {
  sourceEntityType: GovernanceSourceType;
  sourceEntityId: string;
  sourceRevisionId?: string | null;
  sourceDate?: string | null;
  reviewRationale?: string | null;
}): Promise<{ review_id: string; status: GovernanceReviewStatus }> {
  return invokePrivilegedAction('start_governance_linkage_review', {
    source_entity_type: input.sourceEntityType,
    source_entity_id: input.sourceEntityId,
    source_revision_id: input.sourceRevisionId ?? null,
    source_date: input.sourceDate ?? null,
    review_rationale: input.reviewRationale ?? null,
  });
}

export function suggestGovernanceCriterionLink(input: {
  reviewId: string;
  targetCriterionType: GovernanceCriterionType;
  targetDocumentId?: string | null;
  targetVersionId?: string | null;
  targetPolicyRequirementId?: string | null;
  targetSopStepId?: string | null;
  targetComplianceObligationId?: string | null;
  targetAccreditationClauseId?: string | null;
  targetControlId?: string | null;
  relationshipOrigin?: GovernanceRelationshipOrigin;
  resolutionMethod?: GovernanceResolutionMethod;
  resolutionDate?: string | null;
  overrideRationale?: string | null;
  rootSourceEntityType?: GovernanceSourceType | null;
  rootSourceEntityId?: string | null;
  parentLinkId?: string | null;
  rationale?: string | null;
}): Promise<{ link_id: string; decision_id: string; decision_type: 'suggested' }> {
  return invokePrivilegedAction('suggest_governance_criterion_link', {
    review_id: input.reviewId,
    target_criterion_type: input.targetCriterionType,
    target_document_id: input.targetDocumentId ?? null,
    target_version_id: input.targetVersionId ?? null,
    target_policy_requirement_id: input.targetPolicyRequirementId ?? null,
    target_sop_step_id: input.targetSopStepId ?? null,
    target_compliance_obligation_id: input.targetComplianceObligationId ?? null,
    target_accreditation_clause_id: input.targetAccreditationClauseId ?? null,
    target_control_id: input.targetControlId ?? null,
    relationship_origin: input.relationshipOrigin ?? 'direct',
    resolution_method: input.resolutionMethod ?? 'direct_selection',
    resolution_date: input.resolutionDate ?? null,
    override_rationale: input.overrideRationale ?? null,
    root_source_entity_type: input.rootSourceEntityType ?? null,
    root_source_entity_id: input.rootSourceEntityId ?? null,
    parent_link_id: input.parentLinkId ?? null,
    rationale: input.rationale ?? null,
  });
}

export function appendGovernanceCriterionDecision(input: {
  linkId: string;
  decisionType: Exclude<GovernanceDecisionType, 'suggested'>;
  significance?: GovernanceSignificance | null;
  adherenceStatus?: GovernanceAdherenceStatus | null;
  adequacyStatus?: GovernanceAdequacyStatus | null;
  rationale?: string | null;
  correctionReason?: string | null;
  supersedesDecisionId?: string | null;
  evidenceFileIds?: string[];
}): Promise<{ decision_id: string; link_id: string; decision_type: GovernanceDecisionType }> {
  return invokePrivilegedAction('append_governance_criterion_decision', {
    link_id: input.linkId,
    decision_type: input.decisionType,
    significance: input.significance ?? null,
    adherence_status: input.adherenceStatus ?? null,
    adequacy_status: input.adequacyStatus ?? null,
    rationale: input.rationale ?? null,
    correction_reason: input.correctionReason ?? null,
    supersedes_decision_id: input.supersedesDecisionId ?? null,
    evidence_file_ids: input.evidenceFileIds ?? [],
  });
}

export function supersedeGovernanceCriterionLink(input: {
  linkId: string;
  replacementLinkId: string;
  reason: string;
}): Promise<{ link_id: string; replacement_link_id: string; decision_id: string }> {
  return invokePrivilegedAction('supersede_governance_criterion_link', {
    link_id: input.linkId,
    replacement_link_id: input.replacementLinkId,
    reason: input.reason,
  });
}

export function completeGovernanceLinkageReview(input: {
  reviewId: string;
  reviewOutcome: GovernanceReviewOutcome;
  reviewRationale: string;
  uncertaintyRecorded?: boolean;
}): Promise<{ review_id: string; status: 'completed'; outcome: GovernanceReviewOutcome; confirmed_link_count: number }> {
  return invokePrivilegedAction('complete_governance_linkage_review', {
    review_id: input.reviewId,
    review_outcome: input.reviewOutcome,
    review_rationale: input.reviewRationale,
    uncertainty_recorded: input.uncertaintyRecorded ?? false,
  });
}

export function evaluateGovernanceDocumentReviewTrigger(input: {
  documentId: string;
  dueDate?: string | null;
}): Promise<{
  document_id: string;
  trigger_id?: string;
  triggered: boolean;
  status?: 'open';
  reason?: 'pattern_threshold_not_met' | 'review_already_open';
  confirmed_event_count?: number;
}> {
  return invokePrivilegedAction('evaluate_governance_document_review_trigger', {
    document_id: input.documentId,
    due_date: input.dueDate ?? null,
  });
}
