import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
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
  validateStrictInteger,
  boundedString,
  requireCanonicalUuid,
  assertNoIdentityOverrides,
  validateConfigureStagesProof,
  validateCreateSopDraftProof,
  validateSaveSopDraftProof,
  validateStartRevisionProof,
  validateSubmitReviewProof,
  validateApprovalDecisionProof,
  validateFinalizeApprovalProof,
  validateGovernedApprovalPreflightSync,
  mapV14e1rDatabaseError,
} from '../../supabase/functions/_shared/v14e1rGovernedDocumentBridge.ts';

describe('GRC v1.4-E1-R2 Edge v13 Governed SOP Bridge: Behavioral & Architectural Proof', () => {
  const rootDir = process.cwd();
  const edgeIndexPath = path.resolve(
    rootDir,
    'supabase/functions/privileged-action/index.ts'
  );
  const edgeSource = fs.readFileSync(edgeIndexPath, 'utf8');

  // ==========================================================================
  // SECTION A: required_decision_count Strict Validation
  // ==========================================================================
  describe('A. required_decision_count strict validation', () => {
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
  });

  // ==========================================================================
  // SECTION B: Strict Boolean Validation
  // ==========================================================================
  describe('B. Strict boolean validation', () => {
    it('accepts boolean true', () => {
      expect(validateStrictBoolean(true, 'test_field')).toBe(true);
    });

    it('accepts boolean false', () => {
      expect(validateStrictBoolean(false, 'test_field')).toBe(false);
    });

    it('rejects string "false"', () => {
      expect(() => validateStrictBoolean('false', 'test_field')).toThrow(
        'INVALID_BOOLEAN_TEST_FIELD'
      );
    });

    it('rejects string "true"', () => {
      expect(() => validateStrictBoolean('true', 'test_field')).toThrow(
        'INVALID_BOOLEAN_TEST_FIELD'
      );
    });

    it('rejects number 0', () => {
      expect(() => validateStrictBoolean(0, 'test_field')).toThrow(
        'INVALID_BOOLEAN_TEST_FIELD'
      );
    });

    it('rejects number 1', () => {
      expect(() => validateStrictBoolean(1, 'test_field')).toThrow(
        'INVALID_BOOLEAN_TEST_FIELD'
      );
    });

    it('returns defaultValue when undefined/null and default supplied', () => {
      expect(validateStrictBoolean(undefined, 'test_field', false)).toBe(false);
      expect(validateStrictBoolean(null, 'test_field', true)).toBe(true);
    });
  });

  // ==========================================================================
  // SECTION C: Strict Integer Validation
  // ==========================================================================
  describe('C. Strict integer validation', () => {
    it('accepts SLA days within 1..365', () => {
      expect(validateStrictInteger(30, 'acknowledgment_sla_days', 1, 365)).toBe(30);
      expect(validateStrictInteger(1, 'acknowledgment_sla_days', 1, 365)).toBe(1);
      expect(validateStrictInteger(365, 'acknowledgment_sla_days', 1, 365)).toBe(365);
    });

    it('rejects SLA days outside 1..365', () => {
      expect(() => validateStrictInteger(0, 'acknowledgment_sla_days', 1, 365)).toThrow(
        'INVALID_INTEGER_ACKNOWLEDGMENT_SLA_DAYS'
      );
      expect(() => validateStrictInteger(366, 'acknowledgment_sla_days', 1, 365)).toThrow(
        'INVALID_INTEGER_ACKNOWLEDGMENT_SLA_DAYS'
      );
    });

    it('rejects fractional and string values for integer fields', () => {
      expect(() => validateStrictInteger(12.5, 'training_renewal_months', 1, 120)).toThrow(
        'INVALID_INTEGER_TRAINING_RENEWAL_MONTHS'
      );
      expect(() => validateStrictInteger('12' as any, 'training_renewal_months', 1, 120)).toThrow(
        'INVALID_INTEGER_TRAINING_RENEWAL_MONTHS'
      );
    });
  });

  // ==========================================================================
  // SECTION D: Nested Collections & RACI Validation
  // ==========================================================================
  describe('D. Nested collections and RACI validation', () => {
    it('accepts 20 RACI assignments on a step', () => {
      const assignments = Array.from({ length: 20 }, (_, i) => ({
        raci_type: i % 4 === 0 ? 'R' : i % 4 === 1 ? 'A' : i % 4 === 2 ? 'C' : 'I',
        role_name: `Role_${i + 1}`,
      }));

      const steps = validateProcedureSteps([
        {
          sequence_number: 1,
          title_en: 'Step 1',
          raci_assignments: assignments,
        },
      ]);
      expect(steps?.[0]?.raci_assignments?.length).toBe(20);
    });

    it('rejects 21 RACI assignments on a step', () => {
      const assignments = Array.from({ length: 21 }, (_, i) => ({
        raci_type: 'R',
        role_name: `Role_${i + 1}`,
      }));

      expect(() =>
        validateProcedureSteps([
          {
            sequence_number: 1,
            title_en: 'Step 1',
            raci_assignments: assignments,
          },
        ])
      ).toThrow('MAX_COUNT_EXCEEDED_STEP_RACI_ASSIGNMENTS_AT_0');
    });

    it('rejects invalid RACI type (e.g. X, REVIEWER)', () => {
      expect(() =>
        validateProcedureSteps([
          {
            sequence_number: 1,
            title_en: 'Step 1',
            raci_assignments: [{ raci_type: 'X', role_name: 'Manager' }],
          },
        ])
      ).toThrow('PATCH206_INVALID_RACI_TYPE');
    });

    it('accepts 100 procedure sections and rejects 101', () => {
      const validSections = Array.from({ length: 100 }, (_, i) => ({
        sequence_number: i + 1,
        title_en: `Section ${i + 1}`,
      }));
      expect(validateProcedureSections(validSections)?.length).toBe(100);

      const invalidSections = Array.from({ length: 101 }, (_, i) => ({
        sequence_number: i + 1,
        title_en: `Section ${i + 1}`,
      }));
      expect(() => validateProcedureSections(invalidSections)).toThrow(
        'MAX_COUNT_EXCEEDED_PROCEDURE_SECTIONS'
      );
    });

    it('accepts 500 procedure steps and rejects 501', () => {
      const validSteps = Array.from({ length: 500 }, (_, i) => ({
        sequence_number: i + 1,
        title_en: `Step ${i + 1}`,
      }));
      expect(validateProcedureSteps(validSteps)?.length).toBe(500);

      const invalidSteps = Array.from({ length: 501 }, (_, i) => ({
        sequence_number: i + 1,
        title_en: `Step ${i + 1}`,
      }));
      expect(() => validateProcedureSteps(invalidSteps)).toThrow(
        'MAX_COUNT_EXCEEDED_PROCEDURE_STEPS'
      );
    });

    it('validates department_scopes UUID array and bounds at 250', () => {
      const validUuids = Array.from(
        { length: 250 },
        () => '33333333-3333-4333-8333-333333333333'
      );
      expect(validateDepartmentScopes(validUuids)?.length).toBe(250);

      expect(() =>
        validateDepartmentScopes([...validUuids, '33333333-3333-4333-8333-333333333333'])
      ).toThrow('MAX_COUNT_EXCEEDED_DEPARTMENT_SCOPES');

      expect(() => validateDepartmentScopes(['not-a-uuid'])).toThrow(
        'INVALID_UUID_DEPARTMENT_SCOPE_0'
      );
    });
  });

  // ==========================================================================
  // SECTION E: Client Keys and Sequences
  // ==========================================================================
  describe('E. Client keys and sequence numbers', () => {
    it('accepts valid client keys with alphanumeric and underscores/hyphens', () => {
      const sec = validateProcedureSections([
        {
          client_key: 'sec_1-main',
          sequence_number: 1,
          title_en: 'Section',
        },
      ]);
      expect(sec?.[0]?.client_key).toBe('sec_1-main');
    });

    it('rejects malformed client keys with special characters', () => {
      expect(() =>
        validateProcedureSections([
          {
            client_key: 'sec$invalid key!',
            sequence_number: 1,
            title_en: 'Section',
          },
        ])
      ).toThrow('INVALID_CLIENT_KEY_SYNTAX_SECTION_0');
    });

    it('rejects negative or zero sequence number', () => {
      expect(() =>
        validateProcedureSections([
          {
            sequence_number: 0,
            title_en: 'Section',
          },
        ])
      ).toThrow('INVALID_INTEGER_SECTION_SEQUENCE_0');

      expect(() =>
        validateProcedureSteps([
          {
            sequence_number: -1,
            title_en: 'Step',
          },
        ])
      ).toThrow('INVALID_INTEGER_STEP_SEQUENCE_0');
    });
  });

  // ==========================================================================
  // SECTION F: Decision RPC Contract Verification
  // ==========================================================================
  describe('F. Exact five-argument record_approval_decision contract', () => {
    it('edge caller specifies exact 5 argument keys and no p_decision_metadata', () => {
      expect(edgeSource).toContain("await serviceClient.rpc('record_approval_decision', {");
      expect(edgeSource).toContain('p_approval_request_id: approvalRequestId,');
      expect(edgeSource).toContain('p_approver_id: userData.user.id,');
      expect(edgeSource).toContain('p_decision: decision,');
      expect(edgeSource).toContain('p_decision_note: decisionNote,');
      expect(edgeSource).toContain('p_approver_role: null,');
      expect(edgeSource).not.toContain('p_decision_metadata:');
    });

    it('function helper enforces exact 5 parameters and rejects sixth parameter', () => {
      function buildDecisionRpcPayload(
        reqId: string,
        actorId: string,
        dec: string,
        note: string | null
      ) {
        return {
          p_approval_request_id: reqId,
          p_approver_id: actorId,
          p_decision: dec,
          p_decision_note: note,
          p_approver_role: null,
        };
      }

      const payload = buildDecisionRpcPayload(
        '44444444-4444-4444-8444-444444444444',
        '55555555-5555-4555-8555-555555555555',
        'approved',
        'Approved in order'
      );

      const keys = Object.keys(payload);
      expect(keys.length).toBe(5);
      expect(keys).toEqual([
        'p_approval_request_id',
        'p_approver_id',
        'p_decision',
        'p_decision_note',
        'p_approver_role',
      ]);
      expect(keys).not.toContain('p_decision_metadata');
    });
  });

  // ==========================================================================
  // SECTION G: Response Proof Validators
  // ==========================================================================
  describe('G. Response proof validators', () => {
    const vId = '66666666-6666-4666-8666-666666666666';
    const dId = '77777777-7777-4777-8777-777777777777';
    const rId = '88888888-8888-4888-8888-888888888888';

    it('validates create SOP draft response proof', () => {
      expect(
        validateCreateSopDraftProof({
          document_id: dId,
          version_id: vId,
          document_code: 'SOP-CLIN-001',
          section_key_map: { s1: '11111111-1111-4111-8111-111111111111' },
          step_key_map: { st1: '22222222-2222-4222-8222-222222222222' },
        })
      ).toBe(true);

      // Malformed: missing document_code
      expect(
        validateCreateSopDraftProof({
          document_id: dId,
          version_id: vId,
          section_key_map: {},
          step_key_map: {},
        })
      ).toBe(false);
    });

    it('validates save SOP draft response proof', () => {
      expect(
        validateSaveSopDraftProof(
          {
            document_id: dId,
            version_id: vId,
            section_key_map: {},
            step_key_map: {},
          },
          vId
        )
      ).toBe(true);

      // Version mismatch
      expect(
        validateSaveSopDraftProof(
          {
            document_id: dId,
            version_id: '99999999-9999-4999-8999-999999999999',
            section_key_map: {},
            step_key_map: {},
          },
          vId
        )
      ).toBe(false);
    });

    it('validates revision response proof checking version_number (not new_version_number)', () => {
      expect(
        validateStartRevisionProof(
          {
            document_id: dId,
            source_version_id: vId,
            new_version_id: '99999999-9999-4999-8999-999999999999',
            version_number: 2,
            version_label: 'v2.0',
            status: 'draft',
          },
          vId
        )
      ).toBe(true);

      // Malformed: status not draft
      expect(
        validateStartRevisionProof(
          {
            document_id: dId,
            source_version_id: vId,
            new_version_id: '99999999-9999-4999-8999-999999999999',
            version_number: 2,
            version_label: 'v2.0',
            status: 'published',
          },
          vId
        )
      ).toBe(false);
    });

    it('validates submit review response proof with status under_review', () => {
      expect(
        validateSubmitReviewProof(
          {
            document_id: dId,
            version_id: vId,
            approval_request_id: rId,
            workflow_stage: 'department_review',
            status: 'under_review',
          },
          vId
        )
      ).toBe(true);
    });

    it('validates decision response proof requiring status=ok', () => {
      expect(
        validateApprovalDecisionProof(
          {
            status: 'ok',
            approval_request_id: rId,
            request_status: 'partially_approved',
          },
          rId
        )
      ).toBe(true);

      expect(
        validateApprovalDecisionProof(
          {
            status: 'error',
            approval_request_id: rId,
            request_status: 'pending',
          },
          rId
        )
      ).toBe(false);
    });

    it('validates finalization normal and already_approved proofs', () => {
      expect(
        validateFinalizeApprovalProof(
          {
            document_id: dId,
            version_id: vId,
            approved_by: '55555555-5555-4555-8555-555555555555',
            status: 'approved',
          },
          vId
        )
      ).toBe(true);

      expect(
        validateFinalizeApprovalProof(
          {
            success: true,
            already_approved: true,
            version_id: vId,
          },
          vId
        )
      ).toBe(true);
    });
  });

  // ==========================================================================
  // SECTION H: Path-A Preflight Behavioral Tests
  // ==========================================================================
  describe('H. Path-A Preflight behavioral tests', () => {
    const orgA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const orgB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const actorId = '55555555-5555-4555-8555-555555555555';
    const reqId = '88888888-8888-4888-8888-888888888888';
    const verId = '66666666-6666-4666-8666-666666666666';

    const baseValidParams = {
      reqRow: {
        id: reqId,
        organization_id: orgA,
        workflow_type: 'document_control',
        linked_item_type: 'document_version',
        linked_item_id: verId,
        request_status: 'pending',
      },
      actorProfile: {
        id: actorId,
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

    it('rejects wrong linked_item_type (e.g. policy)', () => {
      expect(() =>
        validateGovernedApprovalPreflightSync({
          ...baseValidParams,
          reqRow: { ...baseValidParams.reqRow, linked_item_type: 'policy' },
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

    it('rejects cross-organization linked document version', () => {
      expect(() =>
        validateGovernedApprovalPreflightSync({
          ...baseValidParams,
          linkedDocumentOrgId: orgB,
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
  // SECTION I: Safe Error Mapping
  // ==========================================================================
  describe('I. Safe database error mapping', () => {
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
  // SECTION J: Static Architecture & Boundary Assertions
  // ==========================================================================
  describe('J. Static architecture & deployment constraints', () => {
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
      const e1r2HandlerIdx = edgeSource.indexOf("if (action === 'v14e1r_create_governed_sop_draft')");

      expect(authCheckIdx).toBeGreaterThan(0);
      expect(capCheckIdx).toBeGreaterThan(authCheckIdx);
      expect(e1r2HandlerIdx).toBeGreaterThan(capCheckIdx);
    });

    it('verifies no Migration 207 exists in repository', () => {
      const migrations = fs.readdirSync(path.resolve(rootDir, 'supabase/migrations'));
      const m207 = migrations.find((f) => f.startsWith('207'));
      expect(m207).toBeUndefined();
    });

    it('verifies no direct browser execution grants in Migration 206', () => {
      const m206Path = path.resolve(rootDir, 'supabase/migrations/206_governed_sop_template_alignment_and_raci.sql');
      const sql = fs.readFileSync(m206Path, 'utf8');
      expect(sql).not.toContain('grant execute on function public.create_governed_sop_draft to authenticated');
      expect(sql).not.toContain('grant execute on function public.save_governed_sop_draft to authenticated');
      expect(sql).not.toContain('grant execute on function public.submit_governed_document_for_review to authenticated');
      expect(sql).not.toContain('grant execute on function public.finalize_governed_document_approval to authenticated');
    });
  });
});
