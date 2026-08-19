/**
 * GRC v1.4 E1-R2 Governed Document & SOP Privileged-Action Bridge Helpers
 *
 * Provides strict validation, response proof validation, Edge Path-A preflight,
 * and safe error mapping for governed SOP and document control operations.
 * Aligned with Migration 207 authoritative database contract.
 */

export const canonicalUuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const MAX_E1R2_PAYLOAD_BYTES = 1024 * 1024; // 1 MiB

export const v14e1rGovernedDocumentActions = new Set([
  'v14e1r_configure_approval_authority_rule_stages',
  'v14e1r_create_governed_sop_draft',
  'v14e1r_save_governed_sop_draft',
  'v14e1r_start_governed_document_revision',
  'v14e1r_submit_governed_document_for_review',
  'v14e1r_record_governed_document_approval_decision',
  'v14e1r_finalize_governed_document_approval',
]);

export const canonicalAppRoles = new Set([
  'super_admin',
  'executive',
  'governance_admin',
  'division_head',
  'department_manager',
  'project_owner',
  'milestone_owner',
  'task_owner',
  'auditor',
  'compliance_officer',
  'viewer',
  'employee',
]);

export const validCriticalityLevels = new Set(['low', 'medium', 'high', 'critical']);
export const validConfidentialityLevels = new Set(['public', 'internal', 'confidential', 'restricted']);
export const validContentModes = new Set(['structured', 'legacy_controlled_document']);
export const validTranscriptionStatuses = new Set([
  'not_required',
  'pending',
  'complete',
]);
export const validGovernanceLinkStates = new Set([
  'linked',
  'legacy_pending',
  'not_applicable',
]);
export const validRevisionTypes = new Set(['minor', 'major']);
export const validApprovalDecisions = new Set(['approved', 'rejected', 'returned', 'abstained']);
export const validRaciTypes = new Set(['R', 'A', 'C', 'I']);
export const validRiskRelationshipTypes = new Set([
  'mitigates',
  'risk_if_not_followed',
  'operational_context',
]);
export const validAccreditationLinkStrengths = new Set([
  'primary',
  'supporting',
  'reference',
  'gap',
]);
export const validVersionRelationshipTypes = new Set([
  'implements_policy',
  'references_sop',
  'supersedes_version',
  'supported_by_sop',
  'related_governance',
]);

export function asPlainObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function isCanonicalUuid(value: unknown): value is string {
  return typeof value === 'string' && canonicalUuidPattern.test(value.trim());
}

export function requireCanonicalUuid(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || !canonicalUuidPattern.test(value.trim())) {
    throw new Error(`INVALID_UUID_${fieldName.toUpperCase()}`);
  }
  return value.trim();
}

export function optionalCanonicalUuid(value: unknown, fieldName: string): string | null {
  if (value === null || value === undefined || value === '') return null;
  return requireCanonicalUuid(value, fieldName);
}

export function validateStrictBoolean(
  value: unknown,
  fieldName: string,
  defaultValue?: boolean
): boolean {
  if (value === null || value === undefined) {
    if (defaultValue !== undefined) return defaultValue;
    throw new Error(`REQUIRED_BOOLEAN_${fieldName.toUpperCase()}`);
  }
  if (typeof value !== 'boolean') {
    throw new Error(`INVALID_BOOLEAN_${fieldName.toUpperCase()}`);
  }
  return value;
}

export function optionalStrictBoolean(
  value: unknown,
  fieldName: string
): boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'boolean') {
    throw new Error(`INVALID_BOOLEAN_${fieldName.toUpperCase()}`);
  }
  return value;
}

export function validateStrictInteger(
  value: unknown,
  fieldName: string,
  min: number,
  max: number,
  defaultValue?: number
): number {
  if (value === null || value === undefined) {
    if (defaultValue !== undefined) return defaultValue;
    throw new Error(`REQUIRED_INTEGER_${fieldName.toUpperCase()}`);
  }
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new Error(`INVALID_INTEGER_${fieldName.toUpperCase()}`);
  }
  return value;
}

export function optionalStrictInteger(
  value: unknown,
  fieldName: string,
  min: number,
  max: number
): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new Error(`INVALID_INTEGER_${fieldName.toUpperCase()}`);
  }
  return value;
}

export function boundedString(
  value: unknown,
  maxLen: number,
  fieldName: string,
  required = false
): string | null {
  if (value === null || value === undefined) {
    if (required) throw new Error(`REQUIRED_${fieldName.toUpperCase()}`);
    return null;
  }
  if (typeof value !== 'string') {
    throw new Error(`INVALID_STRING_${fieldName.toUpperCase()}`);
  }
  const s = value.trim();
  if (!s && required) throw new Error(`REQUIRED_${fieldName.toUpperCase()}`);
  if (s.length > maxLen) throw new Error(`MAX_LENGTH_EXCEEDED_${fieldName.toUpperCase()}`);
  return s || null;
}

export function assertNoIdentityOverrides(
  payload: Record<string, unknown>,
  prohibitedFields: string[]
): void {
  for (const field of prohibitedFields) {
    if (field in payload && payload[field] !== undefined && payload[field] !== null) {
      throw new Error(`PROHIBITED_IDENTITY_OVERRIDE_${field.toUpperCase()}`);
    }
  }
}

export function assertOnlyAllowedKeys(
  obj: Record<string, unknown>,
  allowedKeys: Set<string>,
  entityName: string,
  index?: number
): void {
  const prefix = index !== undefined ? `${entityName}_AT_${index}` : entityName;
  for (const key of Object.keys(obj)) {
    if (!allowedKeys.has(key)) {
      throw new Error(`UNKNOWN_FIELD_${key.toUpperCase()}_IN_${prefix.toUpperCase()}`);
    }
  }
}

export function resolveCreateGovernanceLinkState(
  rawState: unknown,
  primaryPolicyVersionId: string | null | undefined
): string {
  const hasPolicy =
    primaryPolicyVersionId !== null &&
    primaryPolicyVersionId !== undefined &&
    primaryPolicyVersionId !== '';

  if (rawState === undefined || rawState === null || rawState === '') {
    return hasPolicy ? 'linked' : 'not_applicable';
  }

  if (typeof rawState !== 'string') {
    throw new Error('INVALID_GOVERNANCE_LINK_STATE');
  }

  const trimmed = rawState.trim();
  if (!validGovernanceLinkStates.has(trimmed)) {
    throw new Error('INVALID_GOVERNANCE_LINK_STATE');
  }

  if (trimmed === 'linked' && !hasPolicy) {
    throw new Error('PATCH206_LINKED_STATE_REQUIRES_POLICY');
  }

  if (trimmed === 'not_applicable' && hasPolicy) {
    throw new Error('PATCH206_NOT_APPLICABLE_FORBIDS_POLICY');
  }

  return trimmed;
}

// ----------------------------------------------------------------------------
// 1. Stage Configuration Validator
// ----------------------------------------------------------------------------
export interface NormalizedStage {
  stage_key: string;
  stage_name_en: string;
  stage_name_ar: string | null;
  reviewer_user_id: string | null;
  reviewer_role: string | null;
  required_decision_count: number;
  allow_self_approval: boolean;
}

const allowedStageKeys = new Set([
  'stage_key',
  'stage_name_en',
  'stage_name_ar',
  'reviewer_user_id',
  'reviewer_role',
  'required_decision_count',
  'allow_self_approval',
]);

export function validateStageConfigInput(payload: Record<string, unknown>): {
  authorityRuleId: string;
  stages: NormalizedStage[];
} {
  assertNoIdentityOverrides(payload, [
    'actor_id',
    'p_actor_id',
    'organization_id',
    'p_organization_id',
    'stage_order',
  ]);

  const authorityRuleId = requireCanonicalUuid(payload.authority_rule_id, 'authority_rule_id');

  if (!Array.isArray(payload.stages) || payload.stages.length === 0 || payload.stages.length > 20) {
    throw new Error('PATCH206_EMPTY_STAGE_CONFIGURATION');
  }

  const normalizedStages: NormalizedStage[] = [];
  for (let idx = 0; idx < payload.stages.length; idx++) {
    const stage = payload.stages[idx];
    if (!stage || typeof stage !== 'object' || Array.isArray(stage)) {
      throw new Error('PATCH206_INVALID_STAGE_STRUCTURE');
    }
    const s = stage as Record<string, unknown>;
    assertOnlyAllowedKeys(s, allowedStageKeys, 'STAGE_CONFIG', idx);

    const stageKey = boundedString(s.stage_key, 50, 'stage_key', true)!;
    if (!/^[a-z][a-z0-9_]{1,49}$/.test(stageKey)) {
      throw new Error('PATCH206_INVALID_STAGE_KEY_SYNTAX');
    }

    const stageNameEn = boundedString(s.stage_name_en, 255, 'stage_name_en', true)!;
    const stageNameAr = boundedString(s.stage_name_ar, 255, 'stage_name_ar', false);

    const reviewerUserId = optionalCanonicalUuid(s.reviewer_user_id, 'reviewer_user_id');

    let reviewerRole: string | null = null;
    if (s.reviewer_role !== undefined && s.reviewer_role !== null && String(s.reviewer_role).trim() !== '') {
      const r = String(s.reviewer_role).trim();
      if (!canonicalAppRoles.has(r)) {
        throw new Error('PATCH206_INVALID_STAGE_REVIEWER_ROLE');
      }
      reviewerRole = r;
    }

    if ((reviewerUserId && reviewerRole) || (!reviewerUserId && !reviewerRole)) {
      throw new Error('PATCH206_INVALID_STAGE_AUTH_SELECTOR');
    }

    let reqCount = 1;
    if (s.required_decision_count !== undefined && s.required_decision_count !== null) {
      if (
        typeof s.required_decision_count !== 'number' ||
        !Number.isInteger(s.required_decision_count) ||
        s.required_decision_count < 1 ||
        s.required_decision_count > 10
      ) {
        throw new Error('PATCH206_INVALID_REQUIRED_DECISION_COUNT');
      }
      reqCount = s.required_decision_count;
    }

    if (reviewerUserId && reqCount !== 1) {
      throw new Error('PATCH206_USER_STAGE_REQUIRES_COUNT_ONE');
    }

    const allowSelfApproval = validateStrictBoolean(s.allow_self_approval, 'allow_self_approval', false);

    normalizedStages.push({
      stage_key: stageKey,
      stage_name_en: stageNameEn,
      stage_name_ar: stageNameAr,
      reviewer_user_id: reviewerUserId,
      reviewer_role: reviewerRole,
      required_decision_count: reqCount,
      allow_self_approval: allowSelfApproval,
    });
  }

  return { authorityRuleId, stages: normalizedStages };
}

// ----------------------------------------------------------------------------
// 2. Nested Collections SOP Validator (Sections, Steps, RACI, Links, etc.)
// ----------------------------------------------------------------------------
const allowedProcedureSectionKeys = new Set([
  'id',
  'client_key',
  'sequence_number',
  'title_en',
  'title_ar',
  'description_en',
  'description_ar',
]);

export function validateProcedureSections(sections: unknown): Record<string, unknown>[] | null {
  if (sections === null || sections === undefined) return null;
  if (!Array.isArray(sections)) throw new Error('INVALID_PROCEDURE_SECTIONS_ARRAY');
  if (sections.length > 100) throw new Error('MAX_COUNT_EXCEEDED_PROCEDURE_SECTIONS');

  return sections.map((sec, idx) => {
    if (!sec || typeof sec !== 'object' || Array.isArray(sec)) {
      throw new Error(`INVALID_PROCEDURE_SECTION_OBJECT_AT_${idx}`);
    }
    const s = sec as Record<string, unknown>;
    assertOnlyAllowedKeys(s, allowedProcedureSectionKeys, 'PROCEDURE_SECTION', idx);

    const id = optionalCanonicalUuid(s.id, `procedure_section_id_${idx}`);
    const clientKey = boundedString(s.client_key, 100, `section_client_key_${idx}`);
    if (clientKey && !/^[a-zA-Z0-9_-]{1,100}$/.test(clientKey)) {
      throw new Error(`INVALID_CLIENT_KEY_SYNTAX_SECTION_${idx}`);
    }
    const seqNum = validateStrictInteger(s.sequence_number, `section_sequence_${idx}`, 1, 10000);
    const titleEn = boundedString(s.title_en, 500, `section_title_en_${idx}`, true)!;
    const titleAr = boundedString(s.title_ar, 500, `section_title_ar_${idx}`);
    const descEn = boundedString(s.description_en, 5000, `section_description_en_${idx}`);
    const descAr = boundedString(s.description_ar, 5000, `section_description_ar_${idx}`);

    return {
      ...(id ? { id } : {}),
      ...(clientKey ? { client_key: clientKey } : {}),
      sequence_number: seqNum,
      title_en: titleEn,
      ...(titleAr ? { title_ar: titleAr } : {}),
      ...(descEn ? { description_en: descEn } : {}),
      ...(descAr ? { description_ar: descAr } : {}),
    };
  });
}

const allowedRaciAssignmentKeys = new Set([
  'raci_type',
  'role_name',
  'role_label_ar',
  'job_title',
  'sequence_number',
]);

const allowedProcedureStepKeys = new Set([
  'id',
  'client_key',
  'section_id',
  'section_client_key',
  'sequence_number',
  'responsible_role',
  'action_instruction_en',
  'action_instruction_ar',
  'required_control_id',
  'expected_evidence_record_en',
  'expected_evidence_record_ar',
  'timing_sla_en',
  'timing_sla_ar',
  'is_decision_point',
  'decision_criteria_en',
  'decision_criteria_ar',
  'criticality',
  'escalation_trigger_en',
  'escalation_trigger_ar',
  'escalation_destination_role',
  'raci_assignments',
]);

export function validateProcedureSteps(steps: unknown): Record<string, unknown>[] | null {
  if (steps === null || steps === undefined) return null;
  if (!Array.isArray(steps)) throw new Error('INVALID_PROCEDURE_STEPS_ARRAY');
  if (steps.length > 500) throw new Error('MAX_COUNT_EXCEEDED_PROCEDURE_STEPS');

  return steps.map((step, idx) => {
    if (!step || typeof step !== 'object' || Array.isArray(step)) {
      throw new Error(`INVALID_PROCEDURE_STEP_OBJECT_AT_${idx}`);
    }
    const st = step as Record<string, unknown>;
    assertOnlyAllowedKeys(st, allowedProcedureStepKeys, 'PROCEDURE_STEP', idx);

    const id = optionalCanonicalUuid(st.id, `procedure_step_id_${idx}`);
    const clientKey = boundedString(st.client_key, 100, `step_client_key_${idx}`);
    if (clientKey && !/^[a-zA-Z0-9_-]{1,100}$/.test(clientKey)) {
      throw new Error(`INVALID_CLIENT_KEY_SYNTAX_STEP_${idx}`);
    }
    const sectionId = optionalCanonicalUuid(st.section_id, `step_section_id_${idx}`);
    const sectionClientKey = boundedString(st.section_client_key, 100, `step_section_client_key_${idx}`);
    if (sectionClientKey && !/^[a-zA-Z0-9_-]{1,100}$/.test(sectionClientKey)) {
      throw new Error(`INVALID_CLIENT_KEY_SYNTAX_STEP_SECTION_${idx}`);
    }
    const seqNum = validateStrictInteger(st.sequence_number, `step_sequence_${idx}`, 1, 10000);
    const responsibleRole = boundedString(st.responsible_role, 100, `step_responsible_role_${idx}`);
    const actionInstructionEn = boundedString(st.action_instruction_en, 10000, `step_action_instruction_en_${idx}`, true)!;
    const actionInstructionAr = boundedString(st.action_instruction_ar, 10000, `step_action_instruction_ar_${idx}`);
    const requiredControlId = optionalCanonicalUuid(st.required_control_id, `step_required_control_id_${idx}`);
    const expectedEvidenceRecordEn = boundedString(st.expected_evidence_record_en, 5000, `step_expected_evidence_record_en_${idx}`);
    const expectedEvidenceRecordAr = boundedString(st.expected_evidence_record_ar, 5000, `step_expected_evidence_record_ar_${idx}`);
    const timingSlaEn = boundedString(st.timing_sla_en, 255, `step_timing_sla_en_${idx}`);
    const timingSlaAr = boundedString(st.timing_sla_ar, 255, `step_timing_sla_ar_${idx}`);
    const isDecisionPoint = validateStrictBoolean(st.is_decision_point, `step_is_decision_point_${idx}`, false);
    const decisionCriteriaEn = boundedString(st.decision_criteria_en, 5000, `step_decision_criteria_en_${idx}`);
    const decisionCriteriaAr = boundedString(st.decision_criteria_ar, 5000, `step_decision_criteria_ar_${idx}`);

    let criticality = 'medium';
    if (st.criticality !== undefined && st.criticality !== null) {
      if (typeof st.criticality !== 'string') {
        throw new Error('INVALID_CRITICALITY_LEVEL');
      }
      const c = st.criticality.trim();
      if (!validCriticalityLevels.has(c)) {
        throw new Error('INVALID_CRITICALITY_LEVEL');
      }
      criticality = c;
    }

    const escalationTriggerEn = boundedString(st.escalation_trigger_en, 5000, `step_escalation_trigger_en_${idx}`);
    const escalationTriggerAr = boundedString(st.escalation_trigger_ar, 5000, `step_escalation_trigger_ar_${idx}`);
    const escalationDestRole = boundedString(st.escalation_destination_role, 100, `step_escalation_destination_role_${idx}`);

    let raciAssignments: Record<string, unknown>[] | null = null;
    if (st.raci_assignments !== undefined && st.raci_assignments !== null) {
      if (!Array.isArray(st.raci_assignments)) {
        throw new Error(`INVALID_RACI_ASSIGNMENTS_ARRAY_AT_STEP_${idx}`);
      }
      if (st.raci_assignments.length > 20) {
        throw new Error(`MAX_COUNT_EXCEEDED_STEP_RACI_ASSIGNMENTS_AT_${idx}`);
      }
      raciAssignments = st.raci_assignments.map((raci, rIdx) => {
        if (!raci || typeof raci !== 'object' || Array.isArray(raci)) {
          throw new Error(`INVALID_RACI_OBJECT_AT_STEP_${idx}_RACI_${rIdx}`);
        }
        const r = raci as Record<string, unknown>;
        assertOnlyAllowedKeys(r, allowedRaciAssignmentKeys, `STEP_${idx}_RACI`, rIdx);

        if (typeof r.raci_type !== 'string') {
          throw new Error('PATCH206_INVALID_RACI_TYPE');
        }
        const raciType = boundedString(r.raci_type, 1, `raci_type_${idx}_${rIdx}`, true)!.toUpperCase();
        if (!validRaciTypes.has(raciType)) {
          throw new Error('PATCH206_INVALID_RACI_TYPE');
        }
        const roleName = boundedString(r.role_name, 100, `raci_role_name_${idx}_${rIdx}`, true)!;
        const roleLabelAr = boundedString(r.role_label_ar, 100, `raci_role_label_ar_${idx}_${rIdx}`);
        const jobTitle = boundedString(r.job_title, 150, `raci_job_title_${idx}_${rIdx}`);
        const raciSeq = optionalStrictInteger(r.sequence_number, `raci_sequence_${idx}_${rIdx}`, 1, 10000);

        return {
          raci_type: raciType,
          role_name: roleName,
          ...(roleLabelAr ? { role_label_ar: roleLabelAr } : {}),
          ...(jobTitle ? { job_title: jobTitle } : {}),
          ...(raciSeq !== null ? { sequence_number: raciSeq } : {}),
        };
      });
    }

    return {
      ...(id ? { id } : {}),
      ...(clientKey ? { client_key: clientKey } : {}),
      ...(sectionId ? { section_id: sectionId } : {}),
      ...(sectionClientKey ? { section_client_key: sectionClientKey } : {}),
      sequence_number: seqNum,
      ...(responsibleRole ? { responsible_role: responsibleRole } : {}),
      action_instruction_en: actionInstructionEn,
      ...(actionInstructionAr ? { action_instruction_ar: actionInstructionAr } : {}),
      ...(requiredControlId ? { required_control_id: requiredControlId } : {}),
      ...(expectedEvidenceRecordEn ? { expected_evidence_record_en: expectedEvidenceRecordEn } : {}),
      ...(expectedEvidenceRecordAr ? { expected_evidence_record_ar: expectedEvidenceRecordAr } : {}),
      ...(timingSlaEn ? { timing_sla_en: timingSlaEn } : {}),
      ...(timingSlaAr ? { timing_sla_ar: timingSlaAr } : {}),
      is_decision_point: isDecisionPoint,
      ...(decisionCriteriaEn ? { decision_criteria_en: decisionCriteriaEn } : {}),
      ...(decisionCriteriaAr ? { decision_criteria_ar: decisionCriteriaAr } : {}),
      criticality,
      ...(escalationTriggerEn ? { escalation_trigger_en: escalationTriggerEn } : {}),
      ...(escalationTriggerAr ? { escalation_trigger_ar: escalationTriggerAr } : {}),
      ...(escalationDestRole ? { escalation_destination_role: escalationDestRole } : {}),
      ...(raciAssignments ? { raci_assignments: raciAssignments } : {}),
    };
  });
}

export function validateDepartmentScopes(scopes: unknown): string[] | null {
  if (scopes === null || scopes === undefined) return null;
  if (!Array.isArray(scopes)) throw new Error('INVALID_DEPARTMENT_SCOPES_ARRAY');
  if (scopes.length > 250) throw new Error('MAX_COUNT_EXCEEDED_DEPARTMENT_SCOPES');
  return scopes.map((d, idx) => requireCanonicalUuid(d, `department_scope_${idx}`));
}

const allowedRoleScopeKeys = new Set(['role_name', 'job_title']);

export function validateRoleScopes(roles: unknown): Record<string, unknown>[] | null {
  if (roles === null || roles === undefined) return null;
  if (!Array.isArray(roles)) throw new Error('INVALID_ROLE_SCOPES_ARRAY');
  if (roles.length > 250) throw new Error('MAX_COUNT_EXCEEDED_ROLE_SCOPES');
  return roles.map((r, idx) => {
    if (!r || typeof r !== 'object' || Array.isArray(r)) throw new Error(`INVALID_ROLE_SCOPE_OBJECT_AT_${idx}`);
    const obj = r as Record<string, unknown>;
    assertOnlyAllowedKeys(obj, allowedRoleScopeKeys, 'ROLE_SCOPE', idx);

    const roleName = boundedString(obj.role_name, 100, `role_scope_name_${idx}`);
    const jobTitle = boundedString(obj.job_title, 150, `role_scope_job_title_${idx}`);

    if (!roleName && !jobTitle) {
      throw new Error(`PATCH206_ROLE_SCOPE_REQUIRES_ROLE_OR_TITLE_AT_${idx}`);
    }

    return {
      ...(roleName ? { role_name: roleName } : {}),
      ...(jobTitle ? { job_title: jobTitle } : {}),
    };
  });
}

const allowedDefinitionKeys = new Set([
  'id',
  'term_en',
  'term_ar',
  'abbreviation',
  'definition_en',
  'definition_ar',
  'sequence_number',
]);

export function validateDefinitions(definitions: unknown): Record<string, unknown>[] | null {
  if (definitions === null || definitions === undefined) return null;
  if (!Array.isArray(definitions)) throw new Error('INVALID_DEFINITIONS_ARRAY');
  if (definitions.length > 250) throw new Error('MAX_COUNT_EXCEEDED_DEFINITIONS');
  return definitions.map((def, idx) => {
    if (!def || typeof def !== 'object' || Array.isArray(def)) throw new Error(`INVALID_DEFINITION_OBJECT_AT_${idx}`);
    const d = def as Record<string, unknown>;
    assertOnlyAllowedKeys(d, allowedDefinitionKeys, 'DEFINITION', idx);

    const id = optionalCanonicalUuid(d.id, `definition_id_${idx}`);
    const termEn = boundedString(d.term_en, 255, `definition_term_en_${idx}`);
    const termAr = boundedString(d.term_ar, 255, `definition_term_ar_${idx}`);
    const abbrev = boundedString(d.abbreviation, 50, `definition_abbreviation_${idx}`);
    const defEn = boundedString(d.definition_en, 5000, `definition_def_en_${idx}`, true)!;
    const defAr = boundedString(d.definition_ar, 5000, `definition_def_ar_${idx}`);
    const seq = optionalStrictInteger(d.sequence_number, `definition_seq_${idx}`, 1, 10000);

    if (!termEn && !termAr && !abbrev) {
      throw new Error(`PATCH206_DEFINITION_REQUIRES_TERM_OR_ABBREVIATION_AT_${idx}`);
    }

    return {
      ...(id ? { id } : {}),
      ...(termEn ? { term_en: termEn } : {}),
      ...(termAr ? { term_ar: termAr } : {}),
      ...(abbrev ? { abbreviation: abbrev } : {}),
      definition_en: defEn,
      ...(defAr ? { definition_ar: defAr } : {}),
      ...(seq !== null ? { sequence_number: seq } : {}),
    };
  });
}

const allowedRoleResponsibilityKeys = new Set([
  'id',
  'sequence_number',
  'role_name',
  'job_title',
  'responsibility_en',
  'responsibility_ar',
  'accountable_for_en',
  'accountable_for_ar',
]);

export function validateRoleResponsibilities(responsibilities: unknown): Record<string, unknown>[] | null {
  if (responsibilities === null || responsibilities === undefined) return null;
  if (!Array.isArray(responsibilities)) throw new Error('INVALID_ROLE_RESPONSIBILITIES_ARRAY');
  if (responsibilities.length > 250) throw new Error('MAX_COUNT_EXCEEDED_ROLE_RESPONSIBILITIES');
  return responsibilities.map((resp, idx) => {
    if (!resp || typeof resp !== 'object' || Array.isArray(resp)) throw new Error(`INVALID_RESPONSIBILITY_OBJECT_AT_${idx}`);
    const r = resp as Record<string, unknown>;
    assertOnlyAllowedKeys(r, allowedRoleResponsibilityKeys, 'ROLE_RESPONSIBILITY', idx);

    const id = optionalCanonicalUuid(r.id, `responsibility_id_${idx}`);
    const roleName = boundedString(r.role_name, 100, `responsibility_role_name_${idx}`);
    const jobTitle = boundedString(r.job_title, 150, `responsibility_job_title_${idx}`);

    if (!roleName && !jobTitle) {
      throw new Error(`PATCH206_RESPONSIBILITY_REQUIRES_ROLE_OR_TITLE_AT_${idx}`);
    }

    const respEn = boundedString(r.responsibility_en, 5000, `responsibility_resp_en_${idx}`, true)!;
    const respAr = boundedString(r.responsibility_ar, 5000, `responsibility_resp_ar_${idx}`);
    const accEn = boundedString(r.accountable_for_en, 5000, `responsibility_acc_en_${idx}`);
    const accAr = boundedString(r.accountable_for_ar, 5000, `responsibility_acc_ar_${idx}`);
    const seq = optionalStrictInteger(r.sequence_number, `responsibility_seq_${idx}`, 1, 10000);

    return {
      ...(id ? { id } : {}),
      ...(roleName ? { role_name: roleName } : {}),
      ...(jobTitle ? { job_title: jobTitle } : {}),
      responsibility_en: respEn,
      ...(respAr ? { responsibility_ar: respAr } : {}),
      ...(accEn ? { accountable_for_en: accEn } : {}),
      ...(accAr ? { accountable_for_ar: accAr } : {}),
      ...(seq !== null ? { sequence_number: seq } : {}),
    };
  });
}

const allowedMonitoringKpiKeys = new Set([
  'id',
  'sequence_number',
  'kpi_name_en',
  'kpi_name_ar',
  'target_value',
  'measurement_frequency',
  'owner_id',
  'description_en',
  'description_ar',
]);

export function validateMonitoringKpis(kpis: unknown): Record<string, unknown>[] | null {
  if (kpis === null || kpis === undefined) return null;
  if (!Array.isArray(kpis)) throw new Error('INVALID_MONITORING_KPIS_ARRAY');
  if (kpis.length > 250) throw new Error('MAX_COUNT_EXCEEDED_MONITORING_KPIS');
  return kpis.map((kpi, idx) => {
    if (!kpi || typeof kpi !== 'object' || Array.isArray(kpi)) throw new Error(`INVALID_KPI_OBJECT_AT_${idx}`);
    const k = kpi as Record<string, unknown>;
    assertOnlyAllowedKeys(k, allowedMonitoringKpiKeys, 'MONITORING_KPI', idx);

    const id = optionalCanonicalUuid(k.id, `kpi_id_${idx}`);
    const kpiNameEn = boundedString(k.kpi_name_en, 255, `kpi_name_en_${idx}`, true)!;
    const kpiNameAr = boundedString(k.kpi_name_ar, 255, `kpi_name_ar_${idx}`);
    const targetValue = boundedString(k.target_value, 255, `kpi_target_value_${idx}`, true)!;
    const freq = boundedString(k.measurement_frequency, 50, `kpi_measurement_freq_${idx}`);
    const ownerId = optionalCanonicalUuid(k.owner_id, `kpi_owner_id_${idx}`);
    const descEn = boundedString(k.description_en, 5000, `kpi_description_en_${idx}`);
    const descAr = boundedString(k.description_ar, 5000, `kpi_description_ar_${idx}`);
    const seq = optionalStrictInteger(k.sequence_number, `kpi_seq_${idx}`, 1, 10000);

    return {
      ...(id ? { id } : {}),
      kpi_name_en: kpiNameEn,
      ...(kpiNameAr ? { kpi_name_ar: kpiNameAr } : {}),
      target_value: targetValue,
      ...(freq ? { measurement_frequency: freq } : {}),
      ...(ownerId ? { owner_id: ownerId } : {}),
      ...(descEn ? { description_en: descEn } : {}),
      ...(descAr ? { description_ar: descAr } : {}),
      ...(seq !== null ? { sequence_number: seq } : {}),
    };
  });
}

const allowedRiskLinkKeys = new Set([
  'id',
  'risk_id',
  'relationship_type',
  'context_note_en',
  'context_note_ar',
  'sequence_number',
]);

export function validateRiskLinks(links: unknown): Record<string, unknown>[] | null {
  if (links === null || links === undefined) return null;
  if (!Array.isArray(links)) throw new Error('INVALID_RISK_LINKS_ARRAY');
  if (links.length > 250) throw new Error('MAX_COUNT_EXCEEDED_RISK_LINKS');
  return links.map((link, idx) => {
    if (!link || typeof link !== 'object' || Array.isArray(link)) throw new Error(`INVALID_RISK_LINK_OBJECT_AT_${idx}`);
    const l = link as Record<string, unknown>;
    assertOnlyAllowedKeys(l, allowedRiskLinkKeys, 'RISK_LINK', idx);

    const id = optionalCanonicalUuid(l.id, `risk_link_id_${idx}`);
    const riskId = requireCanonicalUuid(l.risk_id, `risk_link_risk_id_${idx}`);

    let relType = 'mitigates';
    if (l.relationship_type !== undefined && l.relationship_type !== null) {
      if (typeof l.relationship_type !== 'string') throw new Error('PATCH206_INVALID_RISK_RELATIONSHIP_TYPE');
      const rt = l.relationship_type.trim();
      if (!validRiskRelationshipTypes.has(rt)) {
        throw new Error('PATCH206_INVALID_RISK_RELATIONSHIP_TYPE');
      }
      relType = rt;
    }

    const contextNoteEn = boundedString(l.context_note_en, 5000, `risk_link_context_note_en_${idx}`);
    const contextNoteAr = boundedString(l.context_note_ar, 5000, `risk_link_context_note_ar_${idx}`);
    const seq = optionalStrictInteger(l.sequence_number, `risk_link_seq_${idx}`, 1, 10000);

    return {
      ...(id ? { id } : {}),
      risk_id: riskId,
      relationship_type: relType,
      ...(contextNoteEn ? { context_note_en: contextNoteEn } : {}),
      ...(contextNoteAr ? { context_note_ar: contextNoteAr } : {}),
      ...(seq !== null ? { sequence_number: seq } : {}),
    };
  });
}

const allowedAccreditationLinkKeys = new Set([
  'id',
  'clause_id',
  'link_strength',
  'context_note_en',
  'context_note_ar',
  'sequence_number',
]);

export function validateAccreditationLinks(links: unknown): Record<string, unknown>[] | null {
  if (links === null || links === undefined) return null;
  if (!Array.isArray(links)) throw new Error('INVALID_ACCREDITATION_LINKS_ARRAY');
  if (links.length > 250) throw new Error('MAX_COUNT_EXCEEDED_ACCREDITATION_LINKS');
  return links.map((link, idx) => {
    if (!link || typeof link !== 'object' || Array.isArray(link)) throw new Error(`INVALID_ACCREDITATION_LINK_OBJECT_AT_${idx}`);
    const l = link as Record<string, unknown>;
    assertOnlyAllowedKeys(l, allowedAccreditationLinkKeys, 'ACCREDITATION_LINK', idx);

    const id = optionalCanonicalUuid(l.id, `accreditation_link_id_${idx}`);
    const clauseId = requireCanonicalUuid(l.clause_id, `accreditation_link_clause_id_${idx}`);

    let linkStrength = 'primary';
    if (l.link_strength !== undefined && l.link_strength !== null) {
      if (typeof l.link_strength !== 'string') throw new Error('PATCH206_INVALID_ACCREDITATION_LINK_STRENGTH');
      const ls = l.link_strength.trim();
      if (!validAccreditationLinkStrengths.has(ls)) {
        throw new Error('PATCH206_INVALID_ACCREDITATION_LINK_STRENGTH');
      }
      linkStrength = ls;
    }

    const contextNoteEn = boundedString(l.context_note_en, 5000, `accreditation_context_note_en_${idx}`);
    const contextNoteAr = boundedString(l.context_note_ar, 5000, `accreditation_context_note_ar_${idx}`);
    const seq = optionalStrictInteger(l.sequence_number, `accreditation_seq_${idx}`, 1, 10000);

    return {
      ...(id ? { id } : {}),
      clause_id: clauseId,
      link_strength: linkStrength,
      ...(contextNoteEn ? { context_note_en: contextNoteEn } : {}),
      ...(contextNoteAr ? { context_note_ar: contextNoteAr } : {}),
      ...(seq !== null ? { sequence_number: seq } : {}),
    };
  });
}

const allowedVersionLinkKeys = new Set([
  'id',
  'target_version_id',
  'relationship_type',
  'context_note_en',
  'context_note_ar',
  'sequence_number',
]);

export function validateVersionLinks(links: unknown): Record<string, unknown>[] | null {
  if (links === null || links === undefined) return null;
  if (!Array.isArray(links)) throw new Error('INVALID_VERSION_LINKS_ARRAY');
  if (links.length > 250) throw new Error('MAX_COUNT_EXCEEDED_VERSION_LINKS');
  return links.map((link, idx) => {
    if (!link || typeof link !== 'object' || Array.isArray(link)) throw new Error(`INVALID_VERSION_LINK_OBJECT_AT_${idx}`);
    const l = link as Record<string, unknown>;
    assertOnlyAllowedKeys(l, allowedVersionLinkKeys, 'VERSION_LINK', idx);

    const id = optionalCanonicalUuid(l.id, `version_link_id_${idx}`);
    const targetVerId = requireCanonicalUuid(l.target_version_id, `version_link_target_ver_id_${idx}`);

    let relType = 'related_governance';
    if (l.relationship_type !== undefined && l.relationship_type !== null) {
      if (typeof l.relationship_type !== 'string') throw new Error('PATCH206_INVALID_VERSION_RELATIONSHIP_TYPE');
      const rt = l.relationship_type.trim();
      if (!validVersionRelationshipTypes.has(rt)) {
        throw new Error('PATCH206_INVALID_VERSION_RELATIONSHIP_TYPE');
      }
      relType = rt;
    }

    const contextNoteEn = boundedString(l.context_note_en, 5000, `version_link_context_note_en_${idx}`);
    const contextNoteAr = boundedString(l.context_note_ar, 5000, `version_link_context_note_ar_${idx}`);
    const seq = optionalStrictInteger(l.sequence_number, `version_link_seq_${idx}`, 1, 10000);

    return {
      ...(id ? { id } : {}),
      target_version_id: targetVerId,
      relationship_type: relType,
      ...(contextNoteEn ? { context_note_en: contextNoteEn } : {}),
      ...(contextNoteAr ? { context_note_ar: contextNoteAr } : {}),
      ...(seq !== null ? { sequence_number: seq } : {}),
    };
  });
}

// ----------------------------------------------------------------------------
// 3. Response Proof Validators
// ----------------------------------------------------------------------------
export function validateConfigureStagesProof(data: unknown, expectedAuthorityRuleId: string): boolean {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    d.success === true &&
    d.authority_rule_id === expectedAuthorityRuleId &&
    typeof d.stage_count === 'number' &&
    Number.isInteger(d.stage_count) &&
    d.stage_count >= 1
  );
}

export function validateCreateSopDraftProof(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    isCanonicalUuid(d.document_id) &&
    isCanonicalUuid(d.version_id) &&
    typeof d.document_code === 'string' &&
    d.document_code.trim().length > 0 &&
    d.document_code.trim().length <= 100 &&
    Boolean(d.section_key_map) &&
    typeof d.section_key_map === 'object' &&
    !Array.isArray(d.section_key_map) &&
    Boolean(d.step_key_map) &&
    typeof d.step_key_map === 'object' &&
    !Array.isArray(d.step_key_map)
  );
}

export function validateSaveSopDraftProof(data: unknown, expectedVersionId: string): boolean {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    isCanonicalUuid(d.document_id) &&
    d.version_id === expectedVersionId &&
    Boolean(d.section_key_map) &&
    typeof d.section_key_map === 'object' &&
    !Array.isArray(d.section_key_map) &&
    Boolean(d.step_key_map) &&
    typeof d.step_key_map === 'object' &&
    !Array.isArray(d.step_key_map)
  );
}

export function validateStartRevisionProof(data: unknown, expectedSourceVersionId: string): boolean {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    isCanonicalUuid(d.document_id) &&
    d.source_version_id === expectedSourceVersionId &&
    isCanonicalUuid(d.new_version_id) &&
    typeof d.version_number === 'number' &&
    Number.isInteger(d.version_number) &&
    d.version_number >= 1 &&
    typeof d.version_label === 'string' &&
    d.version_label.trim().length > 0 &&
    d.status === 'draft'
  );
}

export function validateSubmitReviewProof(data: unknown, expectedVersionId: string): boolean {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    isCanonicalUuid(d.document_id) &&
    d.version_id === expectedVersionId &&
    isCanonicalUuid(d.approval_request_id) &&
    typeof d.workflow_stage === 'string' &&
    d.workflow_stage.trim().length > 0 &&
    d.status === 'under_review'
  );
}

export function validateApprovalDecisionProof(data: unknown, expectedApprovalRequestId: string): boolean {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    d.status === 'ok' &&
    d.approval_request_id === expectedApprovalRequestId &&
    typeof d.request_status === 'string' &&
    ['pending', 'partially_approved', 'approved', 'rejected', 'returned'].includes(d.request_status)
  );
}

export function validateFinalizeApprovalProof(data: unknown, expectedVersionId: string): boolean {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  if (d.already_approved === true) {
    return d.success === true && d.version_id === expectedVersionId;
  }
  return (
    isCanonicalUuid(d.document_id) &&
    d.version_id === expectedVersionId &&
    isCanonicalUuid(d.approved_by) &&
    d.status === 'approved'
  );
}

// ----------------------------------------------------------------------------
// 4. Path-A Preflight Validation Helper
// ----------------------------------------------------------------------------
export interface PreflightCheckParams {
  reqRow: {
    id: string;
    organization_id: string;
    workflow_type: string;
    linked_item_type: string;
    linked_item_id: string;
    request_status: string;
  } | null;
  actorProfile: {
    id: string;
    organization_id: string;
    is_active: boolean;
  } | null;
  linkedDocumentOrgId: string | null;
  stageRows: {
    id: string;
    stage_order: number;
    stage_status: string;
  }[] | null;
}

export function validateGovernedApprovalPreflightSync(params: PreflightCheckParams): void {
  const { reqRow, actorProfile, linkedDocumentOrgId, stageRows } = params;

  if (!reqRow) {
    throw new Error('PATCH202_APPROVAL_REQUEST_NOT_FOUND');
  }

  if (!actorProfile || !actorProfile.organization_id || actorProfile.is_active === false) {
    throw new Error('PATCH202_ACTOR_NOT_AUTHORIZED');
  }

  if (reqRow.organization_id !== actorProfile.organization_id) {
    throw new Error('PATCH202_ACTOR_CROSS_ORG_FORBIDDEN');
  }

  if (reqRow.workflow_type !== 'document_control' || reqRow.linked_item_type !== 'document_version') {
    throw new Error('PATCH206_INVALID_WORKFLOW_TYPE');
  }

  if (!linkedDocumentOrgId) {
    throw new Error('PATCH202_VERSION_NOT_FOUND');
  }

  if (linkedDocumentOrgId !== actorProfile.organization_id) {
    throw new Error('PATCH202_ACTOR_CROSS_ORG_FORBIDDEN');
  }

  if (!['pending', 'partially_approved'].includes(reqRow.request_status)) {
    throw new Error('PATCH206_REQUEST_NOT_OPEN');
  }

  if (!stageRows || stageRows.length === 0) {
    throw new Error('PATCH206_NO_STAGES_INSTANTIATED');
  }

  const inProgressStages = stageRows.filter((s) => s.stage_status === 'in_progress');
  if (inProgressStages.length !== 1) {
    throw new Error('PATCH206_INVALID_STAGE_STATE');
  }
}

// ----------------------------------------------------------------------------
// 5. Safe Error Mapper
// ----------------------------------------------------------------------------
export interface SafeErrorResult {
  error: string;
  status: number;
  code: string;
  detail: string;
  extra: Record<string, unknown>;
}

export function mapV14e1rDatabaseError(action: string, error: unknown): SafeErrorResult {
  const row = asPlainObject(error);
  const rawMessage = String(row.message ?? row.details ?? error ?? '');
  const knownMatch = rawMessage.match(
    /(PATCH\w+|UNKNOWN_FIELD_\w+|INVALID_UUID_\w+|PROHIBITED_IDENTITY_OVERRIDE_\w+|REQUIRED_\w+|MAX_LENGTH_EXCEEDED_\w+|MAX_COUNT_EXCEEDED_\w+|INVALID_INTEGER_\w+|INVALID_BOOLEAN_\w+|INVALID_STRING_\w+|INVALID_CRITICALITY_LEVEL|INVALID_CONFIDENTIALITY_LEVEL|INVALID_CONTENT_MODE|INVALID_TRANSCRIPTION_STATUS|INVALID_GOVERNANCE_LINK_STATE|INVALID_DECISION|INVALID_REVISION_TYPE|PAYLOAD_BYTE_BOUND_EXCEEDED)/
  );
  const code = knownMatch ? knownMatch[1] : 'E1R2_OPERATION_FAILED';

  let status = 409;
  let safeDetail = 'The governed document operation could not be completed.';

  if (
    /PATCH202_ACTOR_NOT_AUTHORIZED|PATCH202_ACTOR_CROSS_ORG_FORBIDDEN|PATCH206_ACTOR_UNAUTHORIZED_FOR_STAGE_CONFIG|PATCH27_APPROVER_ORGANIZATION_MISMATCH|PATCH27_APPROVER_ROLE_MISMATCH|PATCH27_APPROVER_USER_MISMATCH|PATCH27_SELF_APPROVAL_BLOCKED|PATCH206_CROSS_ORGANIZATION_LINK_DENIED/i.test(
      code
    )
  ) {
    status = 403;
    safeDetail = 'Actor is not authorized for this governed document operation.';
  } else if (
    /PATCH202_VERSION_NOT_FOUND|PATCH202_SOP_VERSION_NOT_FOUND|PATCH202_SOURCE_VERSION_NOT_FOUND|PATCH202_APPROVAL_REQUEST_NOT_FOUND|PATCH206_RULE_NOT_FOUND/i.test(
      code
    )
  ) {
    status = 404;
    safeDetail = 'The requested governed document resource was not found.';
  } else if (
    /PATCH206_EMPTY_STAGE_CONFIGURATION|PATCH206_INVALID_STAGE_AUTH_SELECTOR|PATCH206_INVALID_STAGE_REVIEWER_ROLE|PATCH206_INVALID_STAGE_REVIEWER_USER|PATCH206_INSUFFICIENT_STAGE_REVIEWERS|PATCH206_USER_STAGE_REQUIRES_COUNT_ONE|PATCH206_INVALID_STAGE_KEY_SYNTAX|PATCH206_INVALID_REQUIRED_DECISION_COUNT|PATCH206_INVALID_STAGE_STRUCTURE|PATCH206_SOP_STEP_RACI_INCOMPLETE|PATCH206_INVALID_RACI_TYPE|PATCH206_UNRESOLVED_SECTION_KEY|PATCH206_INVALID_WORKFLOW_TYPE|PATCH206_ROLE_SCOPE_REQUIRES_ROLE_OR_TITLE|PATCH206_DEFINITION_REQUIRES_TERM_OR_ABBREVIATION|PATCH206_RESPONSIBILITY_REQUIRES_ROLE_OR_TITLE|PATCH206_INVALID_RISK_RELATIONSHIP_TYPE|PATCH206_INVALID_ACCREDITATION_LINK_STRENGTH|PATCH206_INVALID_VERSION_RELATIONSHIP_TYPE|PATCH206_LINKED_STATE_REQUIRES_POLICY|PATCH206_NOT_APPLICABLE_FORBIDS_POLICY|UNKNOWN_FIELD_|INVALID_UUID|PROHIBITED_IDENTITY_OVERRIDE|REQUIRED_|MAX_LENGTH_EXCEEDED|MAX_COUNT_EXCEEDED|INVALID_INTEGER_|INVALID_BOOLEAN_|INVALID_STRING_|INVALID_PROCEDURE_|INVALID_RACI_|INVALID_CLIENT_KEY_|INVALID_CRITICALITY|INVALID_CONFIDENTIALITY|INVALID_CONTENT_MODE|INVALID_TRANSCRIPTION_STATUS|INVALID_GOVERNANCE_LINK_STATE|INVALID_DECISION|INVALID_REVISION_TYPE|PAYLOAD_BYTE_BOUND_EXCEEDED/i.test(
      code
    )
  ) {
    status = 400;
    safeDetail = 'The submitted payload contains invalid parameters or constraints.';
  } else if (
    /PATCH201_VERSION_IMMUTABLE_LOCKED|PATCH202_APPROVAL_NOT_FINALIZED|PATCH206_APPROVAL_STAGES_INCOMPLETE|PATCH27_DUPLICATE_STAGE_DECISION|PATCH202_VERSION_NOT_EDITABLE_FOR_SUBMISSION|PATCH206_ORDERED_STAGES_REQUIRED|PATCH206_NO_STAGES_INSTANTIATED|PATCH206_REQUEST_NOT_OPEN|PATCH206_INVALID_STAGE_STATE|PROOF_VALIDATION_FAILED/i.test(
      code
    )
  ) {
    status = 409;
    safeDetail = 'The operation conflicts with the current lifecycle state of the document.';
  }

  return {
    error: 'Governed document operation failed.',
    status,
    code,
    detail: safeDetail,
    extra: { action },
  };
}
