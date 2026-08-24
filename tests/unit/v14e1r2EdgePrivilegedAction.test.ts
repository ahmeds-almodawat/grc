import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import {
  v14e1rGovernedDocumentActions,
  validateStageConfigInput,
  validateProcedureSections,
  validateProcedureSteps,
  validateDepartmentScopes,
  validateRoleScopes,
  validateDefinitions,
  validateRoleResponsibilities,
  validateMonitoringKpis,
  validateRiskLinks,
  validateAccreditationLinks,
  validateVersionLinks,
  validateStrictBoolean,
  optionalStrictBoolean,
  validateStrictInteger,
  optionalStrictInteger,
  boundedString,
  requireCanonicalUuid,
  optionalCanonicalUuid,
  assertNoIdentityOverrides,
  assertOnlyAllowedKeys,
  validateConfigureStagesProof,
  validateCreateSopDraftProof,
  validateSaveSopDraftProof,
  validateStartRevisionProof,
  validateSubmitReviewProof,
  validateApprovalDecisionProof,
  validateFinalizeApprovalProof,
  validateGovernedApprovalPreflightSync,
  mapV14e1rDatabaseError,
  validTranscriptionStatuses,
  validGovernanceLinkStates,
  resolveCreateGovernanceLinkState,
  validRiskRelationshipTypes,
  validAccreditationLinkStrengths,
  validVersionRelationshipTypes,
} from '../../supabase/functions/_shared/v14e1rGovernedDocumentBridge.ts';

describe('GRC v1.4-E1-R2 Edge v13 Governed SOP Bridge: Behavioral & Architectural Proof', () => {
  const rootDir = process.cwd();
  const edgeIndexPath = path.resolve(
    rootDir,
    'supabase/functions/privileged-action/index.ts'
  );
  const edgeSource = fs.readFileSync(edgeIndexPath, 'utf8');

  // ==========================================================================
  // SECTION A: Stage Configuration Validator
  // ==========================================================================
  describe('A. Stage configuration validation & required_decision_count', () => {
    const validAuthId = '11111111-1111-4111-8111-111111111111';

    it('accepts valid integer decision count 1 for role stage', () => {
      const res = validateStageConfigInput({
        authority_rule_id: validAuthId,
        stages: [
          {
            stage_key: 'peer_review',
            stage_name_en: 'Peer Review',
            reviewer_role: 'department_manager',
            required_decision_count: 1,
          },
        ],
      });
      expect(res.stages[0].required_decision_count).toBe(1);
    });

    it('accepts valid integer decision count 10 for role stage', () => {
      const res = validateStageConfigInput({
        authority_rule_id: validAuthId,
        stages: [
          {
            stage_key: 'board_review',
            stage_name_en: 'Board Review',
            reviewer_role: 'executive',
            required_decision_count: 10,
          },
        ],
      });
      expect(res.stages[0].required_decision_count).toBe(10);
    });

    it('rejects decision count 0 (out of bounds)', () => {
      expect(() =>
        validateStageConfigInput({
          authority_rule_id: validAuthId,
          stages: [
            {
              stage_key: 'stage_zero',
              stage_name_en: 'Stage Zero',
              reviewer_role: 'executive',
              required_decision_count: 0,
            },
          ],
        })
      ).toThrow('PATCH206_INVALID_REQUIRED_DECISION_COUNT');
    });

    it('rejects decision count 11 (out of bounds)', () => {
      expect(() =>
        validateStageConfigInput({
          authority_rule_id: validAuthId,
          stages: [
            {
              stage_key: 'stage_eleven',
              stage_name_en: 'Stage Eleven',
              reviewer_role: 'executive',
              required_decision_count: 11,
            },
          ],
        })
      ).toThrow('PATCH206_INVALID_REQUIRED_DECISION_COUNT');
    });

    it('rejects fractional decision count', () => {
      expect(() =>
        validateStageConfigInput({
          authority_rule_id: validAuthId,
          stages: [
            {
              stage_key: 'stage_frac',
              stage_name_en: 'Stage Frac',
              reviewer_role: 'executive',
              required_decision_count: 1.5,
            },
          ],
        })
      ).toThrow('PATCH206_INVALID_REQUIRED_DECISION_COUNT');
    });

    it('rejects string decision count (no coercion)', () => {
      expect(() =>
        validateStageConfigInput({
          authority_rule_id: validAuthId,
          stages: [
            {
              stage_key: 'stage_str',
              stage_name_en: 'Stage Str',
              reviewer_role: 'executive',
              required_decision_count: '2' as any,
            },
          ],
        })
      ).toThrow('PATCH206_INVALID_REQUIRED_DECISION_COUNT');
    });

    it('rejects user stage with decision count other than 1', () => {
      expect(() =>
        validateStageConfigInput({
          authority_rule_id: validAuthId,
          stages: [
            {
              stage_key: 'user_stage',
              stage_name_en: 'User Stage',
              reviewer_user_id: '22222222-2222-4222-8222-222222222222',
              required_decision_count: 2,
            },
          ],
        })
      ).toThrow('PATCH206_USER_STAGE_REQUIRES_COUNT_ONE');
    });

    it('rejects stage with unknown keys (fail-closed)', () => {
      expect(() =>
        validateStageConfigInput({
          authority_rule_id: validAuthId,
          stages: [
            {
              stage_key: 'peer_review',
              stage_name_en: 'Peer Review',
              reviewer_role: 'department_manager',
              unknown_extra: 'not_allowed',
            },
          ],
        })
      ).toThrow(/UNKNOWN_FIELD_UNKNOWN_EXTRA/);
    });
  });

  // ==========================================================================
  // SECTION B: Strict Boolean and Integer Validation
  // ==========================================================================
  describe('B. Strict boolean and integer validation', () => {
    it('accepts boolean true and false', () => {
      expect(validateStrictBoolean(true, 'test_field')).toBe(true);
      expect(validateStrictBoolean(false, 'test_field')).toBe(false);
      expect(optionalStrictBoolean(true, 'test_field')).toBe(true);
      expect(optionalStrictBoolean(false, 'test_field')).toBe(false);
      expect(optionalStrictBoolean(null, 'test_field')).toBeNull();
    });

    it('rejects string and numeric coercion for booleans', () => {
      expect(() => validateStrictBoolean('false', 'test_field')).toThrow('INVALID_BOOLEAN_TEST_FIELD');
      expect(() => validateStrictBoolean('true', 'test_field')).toThrow('INVALID_BOOLEAN_TEST_FIELD');
      expect(() => validateStrictBoolean(0, 'test_field')).toThrow('INVALID_BOOLEAN_TEST_FIELD');
      expect(() => validateStrictBoolean(1, 'test_field')).toThrow('INVALID_BOOLEAN_TEST_FIELD');
    });

    it('accepts valid integers and rejects invalid/coerced ones', () => {
      expect(validateStrictInteger(30, 'acknowledgment_sla_days', 1, 365)).toBe(30);
      expect(optionalStrictInteger(12, 'training_renewal_months', 1, 120)).toBe(12);
      expect(optionalStrictInteger(null, 'training_renewal_months', 1, 120)).toBeNull();

      expect(() => validateStrictInteger(0, 'acknowledgment_sla_days', 1, 365)).toThrow('INVALID_INTEGER_ACKNOWLEDGMENT_SLA_DAYS');
      expect(() => validateStrictInteger(366, 'acknowledgment_sla_days', 1, 365)).toThrow('INVALID_INTEGER_ACKNOWLEDGMENT_SLA_DAYS');
      expect(() => validateStrictInteger(12.5, 'training_renewal_months', 1, 120)).toThrow('INVALID_INTEGER_TRAINING_RENEWAL_MONTHS');
      expect(() => validateStrictInteger('12' as any, 'training_renewal_months', 1, 120)).toThrow('INVALID_INTEGER_TRAINING_RENEWAL_MONTHS');
    });
  });

  // ==========================================================================
  // SECTION C: Transcription Status Enum
  // ==========================================================================
  describe('C. Transcription status enum validation', () => {
    it('accepts exact 3 authoritative transcription statuses', () => {
      expect(validTranscriptionStatuses.has('not_required')).toBe(true);
      expect(validTranscriptionStatuses.has('pending')).toBe(true);
      expect(validTranscriptionStatuses.has('complete')).toBe(true);
      expect(validTranscriptionStatuses.size).toBe(3);
    });

    it('rejects obsolete transcription statuses', () => {
      const obsolete = ['not_applicable', 'in_progress', 'transcribed', 'failed', 'verified'];
      for (const st of obsolete) {
        expect(validTranscriptionStatuses.has(st)).toBe(false);
      }
    });
  });

  // ==========================================================================
  // SECTION D: Governance Link State Validation & Pure Creation Resolver
  // ==========================================================================
  describe('D. Governance link state validation & pure creation resolver', () => {
    const validPolicyId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

    it('accepts exact 3 authoritative governance link states in enum set', () => {
      expect(validGovernanceLinkStates.has('linked')).toBe(true);
      expect(validGovernanceLinkStates.has('legacy_pending')).toBe(true);
      expect(validGovernanceLinkStates.has('not_applicable')).toBe(true);
      expect(validGovernanceLinkStates.size).toBe(3);
    });

    it('1. omitted state + no policy => not_applicable', () => {
      expect(resolveCreateGovernanceLinkState(undefined, null)).toBe('not_applicable');
      expect(resolveCreateGovernanceLinkState(null, null)).toBe('not_applicable');
      expect(resolveCreateGovernanceLinkState(undefined, undefined)).toBe('not_applicable');
      expect(resolveCreateGovernanceLinkState('', null)).toBe('not_applicable');
    });

    it('2. omitted state + valid policy UUID => linked', () => {
      expect(resolveCreateGovernanceLinkState(undefined, validPolicyId)).toBe('linked');
      expect(resolveCreateGovernanceLinkState(null, validPolicyId)).toBe('linked');
      expect(resolveCreateGovernanceLinkState('', validPolicyId)).toBe('linked');
    });

    it('3. explicit linked + valid policy => linked', () => {
      expect(resolveCreateGovernanceLinkState('linked', validPolicyId)).toBe('linked');
      expect(resolveCreateGovernanceLinkState(' linked ', validPolicyId)).toBe('linked');
    });

    it('4. explicit linked + no policy => PATCH206_LINKED_STATE_REQUIRES_POLICY', () => {
      expect(() => resolveCreateGovernanceLinkState('linked', null)).toThrow(
        'PATCH206_LINKED_STATE_REQUIRES_POLICY'
      );
      expect(() => resolveCreateGovernanceLinkState('linked', undefined)).toThrow(
        'PATCH206_LINKED_STATE_REQUIRES_POLICY'
      );
      expect(() => resolveCreateGovernanceLinkState('linked', '')).toThrow(
        'PATCH206_LINKED_STATE_REQUIRES_POLICY'
      );
    });

    it('5. explicit not_applicable + no policy => not_applicable', () => {
      expect(resolveCreateGovernanceLinkState('not_applicable', null)).toBe('not_applicable');
      expect(resolveCreateGovernanceLinkState('not_applicable', undefined)).toBe('not_applicable');
      expect(resolveCreateGovernanceLinkState(' not_applicable ', null)).toBe('not_applicable');
    });

    it('6. explicit not_applicable + policy => PATCH206_NOT_APPLICABLE_FORBIDS_POLICY', () => {
      expect(() => resolveCreateGovernanceLinkState('not_applicable', validPolicyId)).toThrow(
        'PATCH206_NOT_APPLICABLE_FORBIDS_POLICY'
      );
    });

    it('7. explicit legacy_pending is accepted with or without policy', () => {
      expect(resolveCreateGovernanceLinkState('legacy_pending', null)).toBe('legacy_pending');
      expect(resolveCreateGovernanceLinkState('legacy_pending', validPolicyId)).toBe('legacy_pending');
    });

    it('8. invalid state => INVALID_GOVERNANCE_LINK_STATE', () => {
      expect(() => resolveCreateGovernanceLinkState('unlinked', null)).toThrow(
        'INVALID_GOVERNANCE_LINK_STATE'
      );
      expect(() => resolveCreateGovernanceLinkState('pending', null)).toThrow(
        'INVALID_GOVERNANCE_LINK_STATE'
      );
      expect(() => resolveCreateGovernanceLinkState('optional', validPolicyId)).toThrow(
        'INVALID_GOVERNANCE_LINK_STATE'
      );
    });

    it('9. non-string state => INVALID_GOVERNANCE_LINK_STATE', () => {
      expect(() => resolveCreateGovernanceLinkState(123 as any, null)).toThrow(
        'INVALID_GOVERNANCE_LINK_STATE'
      );
      expect(() => resolveCreateGovernanceLinkState(true as any, null)).toThrow(
        'INVALID_GOVERNANCE_LINK_STATE'
      );
      expect(() => resolveCreateGovernanceLinkState({} as any, null)).toThrow(
        'INVALID_GOVERNANCE_LINK_STATE'
      );
    });
  });

  // ==========================================================================
  // SECTION E: Procedure Sections Canonical Normalization
  // ==========================================================================
  describe('E. Procedure sections canonical normalization', () => {
    it('accepts and normalizes valid procedure sections', () => {
      const input = [
        {
          id: '11111111-1111-4111-8111-111111111111',
          client_key: 'sec_intro',
          sequence_number: 1,
          title_en: 'Introduction',
          title_ar: 'مقدمة',
          description_en: 'Section intro',
          description_ar: 'وصف القسم',
        },
      ];
      const result = validateProcedureSections(input);
      expect(result).toEqual([
        {
          id: '11111111-1111-4111-8111-111111111111',
          client_key: 'sec_intro',
          sequence_number: 1,
          title_en: 'Introduction',
          title_ar: 'مقدمة',
          description_en: 'Section intro',
          description_ar: 'وصف القسم',
        },
      ]);
    });

    it('rejects procedure section missing required sequence_number', () => {
      expect(() =>
        validateProcedureSections([
          {
            title_en: 'Intro',
          },
        ])
      ).toThrow(/REQUIRED_INTEGER_SECTION_SEQUENCE/);
    });

    it('rejects procedure section missing required title_en', () => {
      expect(() =>
        validateProcedureSections([
          {
            sequence_number: 1,
          },
        ])
      ).toThrow(/REQUIRED_SECTION_TITLE_EN/);
    });

    it('rejects obsolete section_code and unknown keys (fail-closed)', () => {
      expect(() =>
        validateProcedureSections([
          {
            sequence_number: 1,
            title_en: 'Intro',
            section_code: 'SEC-01',
          },
        ])
      ).toThrow(/UNKNOWN_FIELD_SECTION_CODE/);
    });
  });

  // ==========================================================================
  // SECTION F: Procedure Steps Migration 207 Alignment
  // ==========================================================================
  describe('F. Procedure steps Migration 207 alignment', () => {
    const validStep = {
      id: '22222222-2222-4222-8222-222222222222',
      client_key: 'step_1',
      section_id: '11111111-1111-4111-8111-111111111111',
      section_client_key: 'sec_intro',
      sequence_number: 1,
      responsible_role: 'compliance_officer',
      action_instruction_en: 'Verify identity of applicant',
      action_instruction_ar: 'التحقق من هوية مقدم الطلب',
      required_control_id: '33333333-3333-4333-8333-333333333333',
      expected_evidence_record_en: 'ID copy uploaded',
      expected_evidence_record_ar: 'نسخة الهوية المرفوعة',
      timing_sla_en: '24 hours',
      timing_sla_ar: '24 ساعة',
      is_decision_point: true,
      decision_criteria_en: 'Valid government ID present',
      decision_criteria_ar: 'وجود هوية حكومية سارية',
      criticality: 'high',
      escalation_trigger_en: 'ID expired',
      escalation_trigger_ar: 'انتهاء صلاحية الهوية',
      escalation_destination_role: 'department_manager',
      raci_assignments: [
        {
          raci_type: 'R',
          role_name: 'compliance_officer',
          job_title: 'Officer',
          sequence_number: 1,
        },
      ],
    };

    it('accepts and normalizes complete Migration 207 procedure step', () => {
      const result = validateProcedureSteps([validStep]);
      expect(result).toEqual([validStep]);
    });

    it('rejects step missing required sequence_number', () => {
      expect(() =>
        validateProcedureSteps([
          {
            action_instruction_en: 'Some action',
          },
        ])
      ).toThrow(/REQUIRED_INTEGER_STEP_SEQUENCE/);
    });

    it('rejects step missing required action_instruction_en', () => {
      expect(() =>
        validateProcedureSteps([
          {
            sequence_number: 1,
          },
        ])
      ).toThrow(/REQUIRED_STEP_ACTION_INSTRUCTION_EN/);
    });

    it('rejects obsolete step keys: step_number, title_en, title_ar, instruction_en, policy_reference, criticality_flag', () => {
      const obsoleteKeys = [
        'step_number',
        'title_en',
        'title_ar',
        'instruction_en',
        'instruction_ar',
        'policy_reference',
        'criticality_flag',
      ];
      for (const key of obsoleteKeys) {
        expect(() =>
          validateProcedureSteps([
            {
              sequence_number: 1,
              action_instruction_en: 'Action',
              [key]: 'obsolete_value',
            },
          ])
        ).toThrow(new RegExp(`UNKNOWN_FIELD_${key.toUpperCase()}`));
      }
    });

    it('rejects invalid criticality level', () => {
      expect(() =>
        validateProcedureSteps([
          {
            sequence_number: 1,
            action_instruction_en: 'Action',
            criticality: 'urgent',
          },
        ])
      ).toThrow('INVALID_CRITICALITY_LEVEL');
    });

    it('rejects invalid UUID in required_control_id', () => {
      expect(() =>
        validateProcedureSteps([
          {
            sequence_number: 1,
            action_instruction_en: 'Action',
            required_control_id: 'not-a-valid-uuid',
          },
        ])
      ).toThrow(/INVALID_UUID_STEP_REQUIRED_CONTROL_ID/);
    });
  });

  // ==========================================================================
  // SECTION G: RACI Assignments
  // ==========================================================================
  describe('G. RACI assignments validation', () => {
    it('accepts 20 RACI assignments per step', () => {
      const assignments = Array.from({ length: 20 }, (_, i) => ({
        raci_type: i % 4 === 0 ? 'R' : i % 4 === 1 ? 'A' : i % 4 === 2 ? 'C' : 'I',
        role_name: `Role_${i + 1}`,
      }));

      const steps = validateProcedureSteps([
        {
          sequence_number: 1,
          action_instruction_en: 'Step action',
          raci_assignments: assignments,
        },
      ]);
      expect(steps?.[0]?.raci_assignments?.length).toBe(20);
    });

    it('rejects 21 RACI assignments per step', () => {
      const assignments = Array.from({ length: 21 }, (_, i) => ({
        raci_type: 'R',
        role_name: `Role_${i + 1}`,
      }));

      expect(() =>
        validateProcedureSteps([
          {
            sequence_number: 1,
            action_instruction_en: 'Step action',
            raci_assignments: assignments,
          },
        ])
      ).toThrow(/MAX_COUNT_EXCEEDED_STEP_RACI_ASSIGNMENTS/);
    });

    it('rejects invalid raci_type', () => {
      expect(() =>
        validateProcedureSteps([
          {
            sequence_number: 1,
            action_instruction_en: 'Step action',
            raci_assignments: [
              {
                raci_type: 'X',
                role_name: 'Lead',
              },
            ],
          },
        ])
      ).toThrow('PATCH206_INVALID_RACI_TYPE');
    });

    it('rejects RACI with unknown keys (e.g. step_id authority override)', () => {
      expect(() =>
        validateProcedureSteps([
          {
            sequence_number: 1,
            action_instruction_en: 'Step action',
            raci_assignments: [
              {
                raci_type: 'R',
                role_name: 'Lead',
                step_id: '11111111-1111-4111-8111-111111111111',
              },
            ],
          },
        ])
      ).toThrow(/UNKNOWN_FIELD_STEP_ID/);
    });
  });

  // ==========================================================================
  // SECTION H: Role Scopes
  // ==========================================================================
  describe('H. Role scopes validation', () => {
    it('accepts role scope with role_name or job_title', () => {
      const res = validateRoleScopes([
        { role_name: 'governance_admin' },
        { job_title: 'Compliance Specialist' },
        { role_name: 'auditor', job_title: 'Lead Auditor' },
      ]);
      expect(res).toEqual([
        { role_name: 'governance_admin' },
        { job_title: 'Compliance Specialist' },
        { role_name: 'auditor', job_title: 'Lead Auditor' },
      ]);
    });

    it('rejects empty role scope (neither role_name nor job_title)', () => {
      expect(() => validateRoleScopes([{}])).toThrow(/PATCH206_ROLE_SCOPE_REQUIRES_ROLE_OR_TITLE/);
    });

    it('rejects obsolete role_label_ar and is_mandatory keys (fail-closed)', () => {
      expect(() =>
        validateRoleScopes([
          {
            role_name: 'admin',
            role_label_ar: 'مدير',
          },
        ])
      ).toThrow(/UNKNOWN_FIELD_ROLE_LABEL_AR/);

      expect(() =>
        validateRoleScopes([
          {
            role_name: 'admin',
            is_mandatory: true,
          },
        ])
      ).toThrow(/UNKNOWN_FIELD_IS_MANDATORY/);
    });
  });

  // ==========================================================================
  // SECTION I: Role Responsibilities
  // ==========================================================================
  describe('I. Role responsibilities validation', () => {
    it('accepts and normalizes complete responsibilities with accountable_for', () => {
      const res = validateRoleResponsibilities([
        {
          id: '11111111-1111-4111-8111-111111111111',
          role_name: 'compliance_officer',
          job_title: 'Compliance Officer',
          responsibility_en: 'Review all evidence',
          responsibility_ar: 'مراجعة جميع الأدلة',
          accountable_for_en: 'Audit compliance score',
          accountable_for_ar: 'نتيجة الامتثال للتدقيق',
          sequence_number: 1,
        },
      ]);
      expect(res).toEqual([
        {
          id: '11111111-1111-4111-8111-111111111111',
          role_name: 'compliance_officer',
          job_title: 'Compliance Officer',
          responsibility_en: 'Review all evidence',
          responsibility_ar: 'مراجعة جميع الأدلة',
          accountable_for_en: 'Audit compliance score',
          accountable_for_ar: 'نتيجة الامتثال للتدقيق',
          sequence_number: 1,
        },
      ]);
    });

    it('rejects responsibility without responsibility_en', () => {
      expect(() =>
        validateRoleResponsibilities([
          {
            role_name: 'officer',
          },
        ])
      ).toThrow(/REQUIRED_RESPONSIBILITY_RESP_EN/);
    });

    it('rejects responsibility without role_name or job_title', () => {
      expect(() =>
        validateRoleResponsibilities([
          {
            responsibility_en: 'Do something',
          },
        ])
      ).toThrow(/PATCH206_RESPONSIBILITY_REQUIRES_ROLE_OR_TITLE/);
    });

    it('rejects obsolete role_label_ar key', () => {
      expect(() =>
        validateRoleResponsibilities([
          {
            role_name: 'officer',
            responsibility_en: 'Do something',
            role_label_ar: 'مسؤول',
          },
        ])
      ).toThrow(/UNKNOWN_FIELD_ROLE_LABEL_AR/);
    });
  });

  // ==========================================================================
  // SECTION J: Monitoring KPIs
  // ==========================================================================
  describe('J. Monitoring KPIs validation', () => {
    it('accepts and normalizes complete KPI with target_value and owner_id', () => {
      const res = validateMonitoringKpis([
        {
          id: '11111111-1111-4111-8111-111111111111',
          kpi_name_en: 'Turnaround Time',
          kpi_name_ar: 'وقت الاستجابة',
          target_value: '< 24 hours',
          measurement_frequency: 'monthly',
          owner_id: '22222222-2222-4222-8222-222222222222',
          description_en: 'Time to process review',
          description_ar: 'الوقت اللازم لمعالجة المراجعة',
          sequence_number: 1,
        },
      ]);
      expect(res).toEqual([
        {
          id: '11111111-1111-4111-8111-111111111111',
          kpi_name_en: 'Turnaround Time',
          kpi_name_ar: 'وقت الاستجابة',
          target_value: '< 24 hours',
          measurement_frequency: 'monthly',
          owner_id: '22222222-2222-4222-8222-222222222222',
          description_en: 'Time to process review',
          description_ar: 'الوقت اللازم لمعالجة المراجعة',
          sequence_number: 1,
        },
      ]);
    });

    it('rejects KPI missing required target_value', () => {
      expect(() =>
        validateMonitoringKpis([
          {
            kpi_name_en: 'Turnaround Time',
          },
        ])
      ).toThrow(/REQUIRED_KPI_TARGET_VALUE/);
    });

    it('rejects obsolete KPI keys: metric_description, target_threshold, target_metric_en', () => {
      const obsoleteKeys = [
        'metric_description',
        'target_threshold',
        'target_metric_en',
        'target_metric_ar',
        'reporting_responsible_role',
      ];
      for (const k of obsoleteKeys) {
        expect(() =>
          validateMonitoringKpis([
            {
              kpi_name_en: 'Turnaround Time',
              target_value: '99%',
              [k]: 'obsolete',
            },
          ])
        ).toThrow(new RegExp(`UNKNOWN_FIELD_${k.toUpperCase()}`));
      }
    });
  });

  // ==========================================================================
  // SECTION K: Risk Links
  // ==========================================================================
  describe('K. Risk links validation', () => {
    it('accepts and normalizes valid risk links with relationship_type enum', () => {
      const res = validateRiskLinks([
        {
          risk_id: '11111111-1111-4111-8111-111111111111',
          relationship_type: 'mitigates',
          context_note_en: 'Mitigates operational risk',
          sequence_number: 1,
        },
        {
          risk_id: '22222222-2222-4222-8222-222222222222',
          relationship_type: 'risk_if_not_followed',
        },
        {
          risk_id: '33333333-3333-4333-8333-333333333333',
          relationship_type: 'operational_context',
        },
      ]);
      expect(res?.[0].relationship_type).toBe('mitigates');
      expect(res?.[1].relationship_type).toBe('risk_if_not_followed');
      expect(res?.[2].relationship_type).toBe('operational_context');
    });

    it('rejects invalid relationship_type enum', () => {
      expect(() =>
        validateRiskLinks([
          {
            risk_id: '11111111-1111-4111-8111-111111111111',
            relationship_type: 'invalid_rel',
          },
        ])
      ).toThrow('PATCH206_INVALID_RISK_RELATIONSHIP_TYPE');
    });

    it('rejects obsolete risk keys: mitigation_type, notes', () => {
      expect(() =>
        validateRiskLinks([
          {
            risk_id: '11111111-1111-4111-8111-111111111111',
            mitigation_type: 'preventive',
          },
        ])
      ).toThrow(/UNKNOWN_FIELD_MITIGATION_TYPE/);

      expect(() =>
        validateRiskLinks([
          {
            risk_id: '11111111-1111-4111-8111-111111111111',
            notes: 'Some notes',
          },
        ])
      ).toThrow(/UNKNOWN_FIELD_NOTES/);
    });
  });

  // ==========================================================================
  // SECTION L: Accreditation Links
  // ==========================================================================
  describe('L. Accreditation links validation', () => {
    it('accepts and normalizes valid accreditation links with link_strength enum', () => {
      const res = validateAccreditationLinks([
        {
          clause_id: '11111111-1111-4111-8111-111111111111',
          link_strength: 'primary',
          context_note_en: 'Primary accreditation clause',
          sequence_number: 1,
        },
        {
          clause_id: '22222222-2222-4222-8222-222222222222',
          link_strength: 'supporting',
        },
        {
          clause_id: '33333333-3333-4333-8333-333333333333',
          link_strength: 'reference',
        },
        {
          clause_id: '44444444-4444-4444-8444-444444444444',
          link_strength: 'gap',
        },
      ]);
      expect(res?.[0].link_strength).toBe('primary');
      expect(res?.[1].link_strength).toBe('supporting');
      expect(res?.[2].link_strength).toBe('reference');
      expect(res?.[3].link_strength).toBe('gap');
    });

    it('rejects invalid link_strength enum', () => {
      expect(() =>
        validateAccreditationLinks([
          {
            clause_id: '11111111-1111-4111-8111-111111111111',
            link_strength: 'strong',
          },
        ])
      ).toThrow('PATCH206_INVALID_ACCREDITATION_LINK_STRENGTH');
    });

    it('rejects obsolete accreditation keys: requirement_id, compliance_type, notes', () => {
      expect(() =>
        validateAccreditationLinks([
          {
            requirement_id: '11111111-1111-4111-8111-111111111111',
          },
        ])
      ).toThrow(/UNKNOWN_FIELD_REQUIREMENT_ID/);

      expect(() =>
        validateAccreditationLinks([
          {
            clause_id: '11111111-1111-4111-8111-111111111111',
            compliance_type: 'mandatory',
          },
        ])
      ).toThrow(/UNKNOWN_FIELD_COMPLIANCE_TYPE/);

      expect(() =>
        validateAccreditationLinks([
          {
            clause_id: '11111111-1111-4111-8111-111111111111',
            notes: 'Some notes',
          },
        ])
      ).toThrow(/UNKNOWN_FIELD_NOTES/);
    });
  });

  // ==========================================================================
  // SECTION M: Governed Version Links
  // ==========================================================================
  describe('M. Governed version links validation', () => {
    it('accepts and normalizes valid version links with relationship_type enum', () => {
      const validTypes = [
        'implements_policy',
        'references_sop',
        'supersedes_version',
        'supported_by_sop',
        'related_governance',
      ];
      for (const t of validTypes) {
        const res = validateVersionLinks([
          {
            target_version_id: '11111111-1111-4111-8111-111111111111',
            relationship_type: t,
            context_note_en: `Context for ${t}`,
            sequence_number: 1,
          },
        ]);
        expect(res?.[0].relationship_type).toBe(t);
      }
    });

    it('rejects invalid relationship_type enum', () => {
      expect(() =>
        validateVersionLinks([
          {
            target_version_id: '11111111-1111-4111-8111-111111111111',
            relationship_type: 'depends_on',
          },
        ])
      ).toThrow('PATCH206_INVALID_VERSION_RELATIONSHIP_TYPE');
    });

    it('rejects generic notes key', () => {
      expect(() =>
        validateVersionLinks([
          {
            target_version_id: '11111111-1111-4111-8111-111111111111',
            notes: 'Some notes',
          },
        ])
      ).toThrow(/UNKNOWN_FIELD_NOTES/);
    });
  });

  // ==========================================================================
  // SECTION N: Definitions
  // ==========================================================================
  describe('N. Definitions validation', () => {
    it('accepts and normalizes valid definitions', () => {
      const res = validateDefinitions([
        {
          id: '11111111-1111-4111-8111-111111111111',
          term_en: 'Good Clinical Practice',
          term_ar: 'الممارسة السريرية الجيدة',
          abbreviation: 'GCP',
          definition_en: 'Standard for clinical trials',
          definition_ar: 'معيار التجارب السريرية',
          sequence_number: 1,
        },
      ]);
      expect(res).toEqual([
        {
          id: '11111111-1111-4111-8111-111111111111',
          term_en: 'Good Clinical Practice',
          term_ar: 'الممارسة السريرية الجيدة',
          abbreviation: 'GCP',
          definition_en: 'Standard for clinical trials',
          definition_ar: 'معيار التجارب السريرية',
          sequence_number: 1,
        },
      ]);
    });

    it('rejects definition missing definition_en', () => {
      expect(() =>
        validateDefinitions([
          {
            term_en: 'Term',
          },
        ])
      ).toThrow(/REQUIRED_DEFINITION_DEF_EN/);
    });

    it('rejects definition without term_en, term_ar, or abbreviation', () => {
      expect(() =>
        validateDefinitions([
          {
            definition_en: 'A definition without term',
          },
        ])
      ).toThrow(/PATCH206_DEFINITION_REQUIRES_TERM_OR_ABBREVIATION/);
    });

    it('rejects obsolete acronym key (fail-closed)', () => {
      expect(() =>
        validateDefinitions([
          {
            term_en: 'Term',
            definition_en: 'Definition',
            acronym: 'TRM',
          },
        ])
      ).toThrow(/UNKNOWN_FIELD_ACRONYM/);
    });
  });

  // ==========================================================================
  // SECTION O: Response Proof Contracts Validation
  // ==========================================================================
  describe('O. Response proof contracts validation', () => {
    const validVerId = '11111111-1111-4111-8111-111111111111';
    const validDocId = '22222222-2222-4222-8222-222222222222';
    const validAuthId = '33333333-3333-4333-8333-333333333333';
    const validReqId = '44444444-4444-4444-8444-444444444444';
    const validUserId = '55555555-5555-4555-8555-555555555555';

    it('validates configure stages proof', () => {
      expect(
        validateConfigureStagesProof(
          { success: true, authority_rule_id: validAuthId, stage_count: 2 },
          validAuthId
        )
      ).toBe(true);
      expect(
        validateConfigureStagesProof(
          { success: false, authority_rule_id: validAuthId, stage_count: 2 },
          validAuthId
        )
      ).toBe(false);
    });

    it('validates create SOP draft proof', () => {
      expect(
        validateCreateSopDraftProof({
          document_id: validDocId,
          version_id: validVerId,
          document_code: 'SOP-001',
          section_key_map: { sec_1: validDocId },
          step_key_map: { step_1: validDocId },
        })
      ).toBe(true);
      expect(
        validateCreateSopDraftProof({
          document_id: 'invalid-id',
          version_id: validVerId,
          document_code: 'SOP-001',
          section_key_map: {},
          step_key_map: {},
        })
      ).toBe(false);
    });

    it('validates save SOP draft proof', () => {
      expect(
        validateSaveSopDraftProof(
          {
            document_id: validDocId,
            version_id: validVerId,
            section_key_map: {},
            step_key_map: {},
          },
          validVerId
        )
      ).toBe(true);
      expect(
        validateSaveSopDraftProof(
          {
            document_id: validDocId,
            version_id: 'wrong-ver-id',
            section_key_map: {},
            step_key_map: {},
          },
          validVerId
        )
      ).toBe(false);
    });

    it('validates start revision proof', () => {
      expect(
        validateStartRevisionProof(
          {
            document_id: validDocId,
            source_version_id: validVerId,
            new_version_id: '66666666-6666-4666-8666-666666666666',
            version_number: 2,
            version_label: 'v1.1',
            status: 'draft',
          },
          validVerId
        )
      ).toBe(true);
    });

    it('validates submit review proof', () => {
      expect(
        validateSubmitReviewProof(
          {
            document_id: validDocId,
            version_id: validVerId,
            approval_request_id: validReqId,
            workflow_stage: 'peer_review',
            status: 'under_review',
          },
          validVerId
        )
      ).toBe(true);
    });

    it('validates approval decision proof', () => {
      expect(
        validateApprovalDecisionProof(
          {
            status: 'ok',
            approval_request_id: validReqId,
            request_status: 'partially_approved',
          },
          validReqId
        )
      ).toBe(true);
    });

    it('validates finalize approval proof (both standard and idempotent)', () => {
      expect(
        validateFinalizeApprovalProof(
          {
            document_id: validDocId,
            version_id: validVerId,
            approved_by: validUserId,
            status: 'approved',
          },
          validVerId
        )
      ).toBe(true);

      expect(
        validateFinalizeApprovalProof(
          {
            success: true,
            version_id: validVerId,
            already_approved: true,
          },
          validVerId
        )
      ).toBe(true);
    });
  });

  // ==========================================================================
  // SECTION P: Edge Path-A Preflight Validation
  // ==========================================================================
  describe('P. Mandatory Edge Path-A preflight validation', () => {
    const orgA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const orgB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

    const baseValidParams = {
      reqRow: {
        id: 'req-1',
        organization_id: orgA,
        workflow_type: 'document_control',
        linked_item_type: 'document_version',
        linked_item_id: 'ver-1',
        request_status: 'pending',
      },
      actorProfile: {
        id: 'actor-1',
        organization_id: orgA,
        is_active: true,
      },
      linkedDocumentOrgId: orgA,
      stageRows: [
        {
          id: 'stage-1',
          stage_order: 1,
          stage_status: 'in_progress',
        },
      ],
    };

    it('accepts valid pending staged request with 1 in-progress stage', () => {
      expect(() => validateGovernedApprovalPreflightSync(baseValidParams)).not.toThrow();
    });

    it('accepts valid partially_approved request at stage 2 with 1 in-progress stage', () => {
      expect(() =>
        validateGovernedApprovalPreflightSync({
          ...baseValidParams,
          reqRow: { ...baseValidParams.reqRow, request_status: 'partially_approved' },
          stageRows: [
            { id: 'stage-1', stage_order: 1, stage_status: 'approved' },
            { id: 'stage-2', stage_order: 2, stage_status: 'in_progress' },
          ],
        })
      ).not.toThrow();
    });

    it('rejects unstaged request (0 stages)', () => {
      expect(() =>
        validateGovernedApprovalPreflightSync({
          ...baseValidParams,
          stageRows: [],
        })
      ).toThrow('PATCH206_NO_STAGES_INSTANTIATED');
    });

    it('rejects closed request (approved/rejected/returned)', () => {
      expect(() =>
        validateGovernedApprovalPreflightSync({
          ...baseValidParams,
          reqRow: { ...baseValidParams.reqRow, request_status: 'approved' },
        })
      ).toThrow('PATCH206_REQUEST_NOT_OPEN');
    });

    it('rejects wrong workflow_type (e.g. ovr_incident)', () => {
      expect(() =>
        validateGovernedApprovalPreflightSync({
          ...baseValidParams,
          reqRow: { ...baseValidParams.reqRow, workflow_type: 'ovr_incident' },
        })
      ).toThrow('PATCH206_INVALID_WORKFLOW_TYPE');
    });

    it('rejects cross-organization actor profile', () => {
      expect(() =>
        validateGovernedApprovalPreflightSync({
          ...baseValidParams,
          actorProfile: { ...baseValidParams.actorProfile, organization_id: orgB },
        })
      ).toThrow('PATCH202_ACTOR_CROSS_ORG_FORBIDDEN');
    });

    it('rejects zero in-progress stages', () => {
      expect(() =>
        validateGovernedApprovalPreflightSync({
          ...baseValidParams,
          stageRows: [
            { id: 'stage-1', stage_order: 1, stage_status: 'pending' },
          ],
        })
      ).toThrow('PATCH206_INVALID_STAGE_STATE');
    });

    it('rejects multiple in-progress stages', () => {
      expect(() =>
        validateGovernedApprovalPreflightSync({
          ...baseValidParams,
          stageRows: [
            { id: 'stage-1', stage_order: 1, stage_status: 'in_progress' },
            { id: 'stage-2', stage_order: 2, stage_status: 'in_progress' },
          ],
        })
      ).toThrow('PATCH206_INVALID_STAGE_STATE');
    });
  });

  // ==========================================================================
  // SECTION Q: Safe Error Mapping
  // ==========================================================================
  describe('Q. Safe database error mapping', () => {
    it('maps authorization errors to HTTP 403 without raw sql detail leakage', () => {
      const rawError = {
        message: 'ERROR: PATCH202_ACTOR_NOT_AUTHORIZED: Actor profile is not active in the organization',
        details: 'Key (id)=(...) failed check constraint',
      };
      const res = mapV14e1rDatabaseError('v14e1r_create_governed_sop_draft', rawError);
      expect(res.status).toBe(403);
      expect(res.code).toBe('PATCH202_ACTOR_NOT_AUTHORIZED');
      expect(res.detail).toBe('Actor is not authorized for this governed document operation.');
      expect(res.detail).not.toContain('Key (id)=');
      expect(res.detail).not.toContain('constraint');
    });

    it('maps not found errors to HTTP 404', () => {
      const res = mapV14e1rDatabaseError('v14e1r_save_governed_sop_draft', 'PATCH202_VERSION_NOT_FOUND');
      expect(res.status).toBe(404);
      expect(res.code).toBe('PATCH202_VERSION_NOT_FOUND');
    });

    it('maps validation errors to HTTP 400', () => {
      const res = mapV14e1rDatabaseError('v14e1r_configure_approval_authority_rule_stages', 'PATCH206_INVALID_REQUIRED_DECISION_COUNT');
      expect(res.status).toBe(400);
      expect(res.code).toBe('PATCH206_INVALID_REQUIRED_DECISION_COUNT');
    });

    it('maps lifecycle state lock errors to HTTP 409', () => {
      const res = mapV14e1rDatabaseError('v14e1r_record_governed_document_approval_decision', 'PATCH206_REQUEST_NOT_OPEN');
      expect(res.status).toBe(409);
      expect(res.code).toBe('PATCH206_REQUEST_NOT_OPEN');
    });
  });

  // ==========================================================================
  // SECTION R: Static Architecture & Boundary Assertions
  // ==========================================================================
  describe('R. Static architecture & deployment constraints', () => {
    it('defines exact seven-action family in v14e1rGovernedDocumentActions', () => {
      const expectedActions = [
        'v14e1r_configure_approval_authority_rule_stages',
        'v14e1r_create_governed_sop_draft',
        'v14e1r_save_governed_sop_draft',
        'v14e1r_start_governed_document_revision',
        'v14e1r_submit_governed_document_for_review',
        'v14e1r_record_governed_document_approval_decision',
        'v14e1r_finalize_governed_document_approval',
      ];
      expect(v14e1rGovernedDocumentActions.size).toBe(7);
      for (const a of expectedActions) {
        expect(v14e1rGovernedDocumentActions.has(a)).toBe(true);
      }
    });

    it('includes v14e1rGovernedDocumentActions in allowedActions', () => {
      expect(edgeSource).toContain('...v14e1rGovernedDocumentActions,');
    });

    it('contains no generic RPC dispatcher forwarding', () => {
      expect(edgeSource).not.toMatch(/serviceClient\.rpc\(action,/);
      expect(edgeSource).not.toMatch(/serviceClient\.rpc\(requestBody\.action,/);
      expect(edgeSource).not.toMatch(/serviceClient\.rpc\(payload\.rpc_name,/);
    });

    it('places credential-state verification strictly before E1-R2 dispatchers', () => {
      const authCheckIdx = edgeSource.indexOf('authClient.auth.getUser');
      const capCheckIdx = edgeSource.indexOf("serviceClient.rpc('patch83u_get_capabilities'");
      const e1r2HandlerIdx = edgeSource.indexOf("if (action === 'v14e1r_create_governed_sop_draft'");

      expect(authCheckIdx).toBeGreaterThan(0);
      expect(capCheckIdx).toBeGreaterThan(authCheckIdx);
      expect(e1r2HandlerIdx).toBeGreaterThan(capCheckIdx);
    });

    it('verifies Migration 207 exists exactly once with exact filename and SHA256', () => {
      const migrationsDir = path.resolve(rootDir, 'supabase/migrations');
      const files = fs.readdirSync(migrationsDir);
      const m207Files = files.filter((f) => f.startsWith('207_'));
      expect(m207Files.length).toBe(1);
      expect(m207Files[0]).toBe('207_governed_sop_runtime_contract_remediation.sql');

      const content = fs.readFileSync(path.join(migrationsDir, m207Files[0]));
      const hash = createHash('sha256').update(content).digest('hex');
      expect(hash).toBe('8a8fd669be55e110cc0b4948df71787ab2fce33d76d50912f6ca0043af8ebd51');
    });

    it('verifies Migration 209 exists exactly once with the E2B3 filename', () => {
      const migrationsDir = path.resolve(rootDir, 'supabase/migrations');
      const files = fs.readdirSync(migrationsDir);
      const m209Files = files.filter((f) => f.startsWith('209_'));
      expect(m209Files).toEqual(['209_e2b3_training_population_reconciliation.sql']);
    });

    it('verifies no direct browser execution grants in Migration 206 or Migration 207', () => {
      const m206Path = path.resolve(rootDir, 'supabase/migrations/206_governed_sop_template_alignment_and_raci.sql');
      const sql206 = fs.readFileSync(m206Path, 'utf8');
      expect(sql206).not.toContain('grant execute on function public.create_governed_sop_draft to authenticated');
      expect(sql206).not.toContain('grant execute on function public.save_governed_sop_draft to authenticated');
      expect(sql206).not.toContain('grant execute on function public.submit_governed_document_for_review to authenticated');
      expect(sql206).not.toContain('grant execute on function public.finalize_governed_document_approval to authenticated');

      const m207Path = path.resolve(rootDir, 'supabase/migrations/207_governed_sop_runtime_contract_remediation.sql');
      const sql207 = fs.readFileSync(m207Path, 'utf8');
      expect(sql207).not.toContain('grant execute on function public.save_governed_sop_draft to authenticated');
      expect(sql207).not.toContain('grant execute on function public.save_governed_sop_draft to anon');
      expect(sql207).not.toContain('grant execute on function public.save_governed_sop_draft to public');
    });
  });
});
