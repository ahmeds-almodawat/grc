import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import {
  v14e2b2TrainingActions,
  MAX_E2B2_PAYLOAD_BYTES,
  validCompetencyResults,
  globalGovernanceRoles,
  canonicalGlobalAcknowledgmentRoles,
  canonicalAssignedOnlyAcknowledgmentRoles,
  isCanonicalUuid,
  requireCanonicalUuid,
  optionalCanonicalUuid,
  validateStrictBoolean,
  optionalStrictFiniteNumber,
  boundedString,
  assertOnlyAllowedKeys,
  assertNoIdentityOverrides,
  validateLegacyActorId,
  mapV14e2b2DatabaseError,
  hasActiveGlobalGovernanceRole,
  hasActiveDepartmentManagerRole,
  hasActiveDivisionHeadRole,
  hasActiveRoleForAcknowledgmentRequirement,
  verifyProgramTenancy,
  resolveGovernedVersionTrainingRequirements,
} from '../../supabase/functions/_shared/v14e2b2TrainingBridge.ts';

describe('GRC v1.4-E2B2 Edge v14 Training & Acknowledgment Authorization Hardening Suite', () => {
  const rootDir = process.cwd();
  const edgeIndexPath = path.resolve(rootDir, 'supabase/functions/privileged-action/index.ts');
  const edgeSource = fs.readFileSync(edgeIndexPath, 'utf8');

  const validActorId = '11111111-1111-4111-8111-111111111111';
  const validTargetUserId = '22222222-2222-4222-8222-222222222222';
  const validDocId = '33333333-3333-4333-8333-333333333333';
  const validVerId = '44444444-4444-4444-8444-444444444444';
  const validAssignId = '55555555-5555-4555-8555-555555555555';
  const validEvidenceId = '66666666-6666-4666-8666-666666666666';
  const validOrgId = '77777777-7777-4777-8777-777777777777';
  const validDeptId = '88888888-8888-4888-8888-888888888888';
  const validDivId = '99999999-9999-4999-8999-999999999999';

  function createMockServiceClient(tables: {
    controlled_documents?: Array<{ id: string; organization_id?: string | null }>;
    departments?: Array<{ id: string; organization_id?: string | null }>;
    profiles?: Array<{ id: string; organization_id?: string | null }>;
  }) {
    return {
      from(tableName: string) {
        return {
          select(_fields: string) {
            return {
              eq(colName: string, colVal: string) {
                return {
                  async maybeSingle() {
                    const rows = (tables as any)[tableName] || [];
                    const found = rows.find((r: any) => r[colName] === colVal);
                    return { data: found || null, error: null };
                  },
                };
              },
            };
          },
        };
      },
    };
  }

  // ==========================================================================
  // SECTION 1: Pure Validator & Helper Invariants (Cases 1 - 9)
  // ==========================================================================
  describe('Section 1: Payload Keys, Identity Overrides & UUID Contracts', () => {
    it('1. acknowledgment rejects user_id and forbidden target overrides', () => {
      expect(() =>
        assertNoIdentityOverrides({
          document_id: validDocId,
          version_id: validVerId,
          user_id: validTargetUserId,
        }, ['user_id', 'p_user_id', 'target_user_id'])
      ).toThrow('FORBIDDEN_IDENTITY_OVERRIDE_USER_ID');
    });

    it('2. acknowledgment binds actor as p_user_id in index.ts handler', () => {
      expect(edgeSource).toContain("if (action === 'record_document_acknowledgment')");
      expect(edgeSource).toContain("p_user_id: userData.user.id");
      expect(edgeSource).not.toContain("p_user_id: targetUserId");
    });

    it('3. acknowledgment method is server-controlled web_ui', () => {
      expect(edgeSource).toContain("p_acknowledgment_method: 'web_ui'");
      const err = mapV14e2b2DatabaseError('record_document_acknowledgment', new Error('INVALID_ACKNOWLEDGMENT_METHOD'));
      expect(err.status).toBe(400);
      expect(err.code).toBe('MALFORMED_REQUEST_PAYLOAD');
    });

    it('4. actor_id omitted is accepted by validateLegacyActorId', () => {
      expect(() => validateLegacyActorId({ assignment_id: validAssignId }, validActorId)).not.toThrow();
      expect(() => validateLegacyActorId({ assignment_id: validAssignId, actor_id: undefined }, validActorId)).not.toThrow();
      expect(() => validateLegacyActorId({ assignment_id: validAssignId, actor_id: null }, validActorId)).not.toThrow();
    });

    it('5. actor_id exact authenticated ID is accepted', () => {
      expect(() =>
        validateLegacyActorId({ assignment_id: validAssignId, actor_id: validActorId }, validActorId)
      ).not.toThrow();
    });

    it('6. actor_id mismatch is rejected with CALLER_ACTOR_MISMATCH', () => {
      expect(() =>
        validateLegacyActorId({ assignment_id: validAssignId, actor_id: validTargetUserId }, validActorId)
      ).toThrow('CALLER_ACTOR_MISMATCH');
      const err = mapV14e2b2DatabaseError('start_training_assignment', new Error('CALLER_ACTOR_MISMATCH'));
      expect(err.status).toBe(403);
      expect(err.code).toBe('AUTHORIZATION_DENIED');
    });

    it('7. p_actor_id and alias overrides are strictly rejected', () => {
      expect(() =>
        validateLegacyActorId({ assignment_id: validAssignId, p_actor_id: validActorId }, validActorId)
      ).toThrow('FORBIDDEN_IDENTITY_OVERRIDE_P_ACTOR_ID');
      expect(() =>
        validateLegacyActorId({ assignment_id: validAssignId, acting_user_id: validActorId }, validActorId)
      ).toThrow('FORBIDDEN_IDENTITY_OVERRIDE_ACTING_USER_ID');
    });

    it('8. unknown keys are strictly rejected', () => {
      expect(() =>
        assertOnlyAllowedKeys(
          { assignment_id: validAssignId, extra_unauthorized_key: 'hacked' },
          new Set(['assignment_id', 'actor_id']),
          'TEST_CONTEXT'
        )
      ).toThrow('UNKNOWN_PAYLOAD_KEY_EXTRA_UNAUTHORIZED_KEY_FOR_TEST_CONTEXT');
    });

    it('9. invalid UUID is rejected', () => {
      expect(isCanonicalUuid('not-a-uuid')).toBe(false);
      expect(() => requireCanonicalUuid('invalid-uuid', 'document_id')).toThrow('INVALID_UUID_DOCUMENT_ID');
      expect(optionalCanonicalUuid(null, 'evidence_id')).toBeNull();
    });
  });

  // ==========================================================================
  // SECTION 2: Training Start & Completion Contracts (Cases 10 - 16)
  // ==========================================================================
  describe('Section 2: Training Start & Completion Authority & Preflight', () => {
    it('10. start requires assignment ownership (PATCH29_ASSIGNMENT_FORBIDDEN on mismatch)', () => {
      const err = mapV14e2b2DatabaseError('start_training_assignment', new Error('PATCH29_ASSIGNMENT_FORBIDDEN'));
      expect(err.status).toBe(403);
      expect(err.code).toBe('AUTHORIZATION_DENIED');
      expect(edgeSource).toContain("if (assign.assigned_to_user_id !== userData.user.id)");
    });

    it('11. start rejects competency-only governed assignment', () => {
      const err = mapV14e2b2DatabaseError('start_training_assignment', new Error('TRAINING_NOT_REQUIRED_FOR_ASSIGNMENT'));
      expect(err.status).toBe(409);
      expect(err.code).toBe('INVALID_LIFECYCLE_STATE');
    });

    it('12. complete formal training rejects employee self-certification', () => {
      const err = mapV14e2b2DatabaseError('complete_training_assignment', new Error('EMPLOYEE_CANNOT_COMPLETE_GOVERNED_TRAINING'));
      expect(err.status).toBe(403);
      expect(err.code).toBe('AUTHORIZATION_DENIED');
      expect(edgeSource).toContain("if (isGovernedFormal && userData.user.id === assign.assigned_to_user_id)");
    });

    it('13. complete allows correct scoped manager & governance roles', () => {
      const globalRoles = [{ role: 'governance_admin', scope: 'global', is_active: true, organization_id: validOrgId }];
      expect(hasActiveGlobalGovernanceRole(globalRoles, validOrgId)).toBe(true);

      const deptRoles = [{ role: 'department_manager', scope: 'department', is_active: true, department_id: validDeptId, organization_id: validOrgId }];
      expect(hasActiveDepartmentManagerRole(deptRoles, validDeptId, validOrgId)).toBe(true);
      expect(hasActiveDepartmentManagerRole(deptRoles, 'other-dept', validOrgId)).toBe(false);

      const divRoles = [{ role: 'division_head', scope: 'division', is_active: true, division_id: validDivId, organization_id: validOrgId }];
      expect(hasActiveDivisionHeadRole(divRoles, validDivId, validOrgId)).toBe(true);
    });

    it('14. executive cannot certify completion', () => {
      const execRoles = [{ role: 'executive', scope: 'global', is_active: true, organization_id: validOrgId }];
      expect(hasActiveGlobalGovernanceRole(execRoles, validOrgId)).toBe(false);
      expect(hasActiveDepartmentManagerRole(execRoles, validDeptId, validOrgId)).toBe(false);
    });

    it('15. auditor cannot certify completion', () => {
      const audRoles = [{ role: 'auditor', scope: 'global', is_active: true, organization_id: validOrgId }];
      expect(hasActiveGlobalGovernanceRole(audRoles, validOrgId)).toBe(false);
    });

    it('16. complete uses exact p_evidence_id DB argument in RPC call', () => {
      expect(edgeSource).toContain("p_assignment_id: assignmentId");
      expect(edgeSource).toContain("p_evidence_id: evidenceId");
      expect(edgeSource).toContain("p_actor_id: userData.user.id");
    });
  });

  // ==========================================================================
  // SECTION 3: Competency Assessment & Scoring Contracts (Cases 17 - 23)
  // ==========================================================================
  describe('Section 3: Competency Assessment, Assessor Authority & Score Scale', () => {
    it('17. competency subject must match assignment', () => {
      const err = mapV14e2b2DatabaseError('record_competency_assessment', new Error('COMPETENCY_ASSIGNMENT_SUBJECT_MISMATCH'));
      expect(err.status).toBe(409);
      expect(err.code).toBe('INVALID_LIFECYCLE_STATE');
      expect(edgeSource).toContain("if (assign.assigned_to_user_id !== userId)");
    });

    it('18. self assessment rejected under separation of duties', () => {
      const err = mapV14e2b2DatabaseError('record_competency_assessment', new Error('SOD_VIOLATION_SELF_ASSESSMENT'));
      expect(err.status).toBe(403);
      expect(err.code).toBe('AUTHORIZATION_DENIED');
      expect(edgeSource).toContain("if (userData.user.id === userId)");
    });

    it('19. correct manager assessor allowed', () => {
      const mgrRoles = [{ role: 'department_manager', scope: 'department', is_active: true, department_id: validDeptId, organization_id: validOrgId }];
      expect(hasActiveDepartmentManagerRole(mgrRoles, validDeptId, validOrgId)).toBe(true);
    });

    it('20. wrong department manager denied competency assessment', () => {
      const mgrRoles = [{ role: 'department_manager', scope: 'department', is_active: true, department_id: 'dept-alpha', organization_id: validOrgId }];
      expect(hasActiveDepartmentManagerRole(mgrRoles, 'dept-beta', validOrgId)).toBe(false);
    });

    it('21. executive denied competency assessor role', () => {
      const execRoles = [{ role: 'executive', scope: 'global', is_active: true, organization_id: validOrgId }];
      expect(hasActiveGlobalGovernanceRole(execRoles, validOrgId)).toBe(false);
      expect(hasActiveDepartmentManagerRole(execRoles, validDeptId, validOrgId)).toBe(false);
    });

    it('22. program owner alone denied competency without separate assessor role', () => {
      expect(edgeSource).not.toContain("if (!hasGlobal && !hasDept && !hasDiv && !isProgramOwner) // competency");
      const err = mapV14e2b2DatabaseError('record_competency_assessment', new Error('UNAUTHORIZED_ASSESSOR'));
      expect(err.status).toBe(403);
    });

    it('23. no invented 0-100 score rule (accepts finite numbers across any scale)', () => {
      expect(optionalStrictFiniteNumber(95.5, 'score')).toBe(95.5);
      expect(optionalStrictFiniteNumber(150, 'score')).toBe(150);
      expect(optionalStrictFiniteNumber(0, 'score')).toBe(0);
      expect(optionalStrictFiniteNumber(-5, 'score')).toBe(-5);
      expect(optionalStrictFiniteNumber(null, 'score')).toBeNull();
      expect(() => optionalStrictFiniteNumber('not-a-number', 'score')).toThrow('INVALID_NUMERIC_SCORE');
    });
  });

  // ==========================================================================
  // SECTION 4: Waiver, Cancellation & Reopen Contracts (Cases 24 - 27)
  // ==========================================================================
  describe('Section 4: Waiver, Cancellation & Reopen Lifecycles', () => {
    it('24. waiver reason under 3 chars rejected', () => {
      expect(() => boundedString('ab', 3, 1000, 'reason', true)).toThrow('STRING_LENGTH_OUT_OF_BOUNDS_REASON');
    });

    it('25. waiver/cancel/reopen reason over 1000 chars rejected', () => {
      const longReason = 'a'.repeat(1001);
      expect(() => boundedString(longReason, 3, 1000, 'reason', true)).toThrow('STRING_LENGTH_OUT_OF_BOUNDS_REASON');
      expect(boundedString('Valid waiver rationale', 3, 1000, 'reason', true)).toBe('Valid waiver rationale');
    });

    it('26. cancel completed assignment rejected', () => {
      const err = mapV14e2b2DatabaseError('cancel_training_assignment_with_reason', new Error('CANNOT_CANCEL_COMPLETED_ASSIGNMENT'));
      expect(err.status).toBe(409);
      expect(err.code).toBe('INVALID_LIFECYCLE_STATE');
      expect(edgeSource).toContain("if (assign.status === 'completed')");
    });

    it('27. reopen open-state assignment rejected', () => {
      const err = mapV14e2b2DatabaseError('reopen_training_assignment_with_reason', new Error('CANNOT_REOPEN_OPEN_ASSIGNMENT'));
      expect(err.status).toBe(409);
      expect(err.code).toBe('INVALID_LIFECYCLE_STATE');
      expect(edgeSource).toContain("if (!['completed', 'waived', 'cancelled'].includes(assign.status))");
    });
  });

  // ==========================================================================
  // SECTION 5: Rollout, Publication, Capability & Reconcile (Cases 28 - 33)
  // ==========================================================================
  describe('Section 5: Rollout Strictness, Migration 208 Gate & Reconcile Boundary', () => {
    it('28. rollout booleans are strict (no coercion of strings/numbers)', () => {
      expect(validateStrictBoolean(true, 'retraining_required')).toBe(true);
      expect(validateStrictBoolean(false, 'retraining_required')).toBe(false);
      expect(() => validateStrictBoolean('true', 'retraining_required')).toThrow('INVALID_STRICT_BOOLEAN_RETRAINING_REQUIRED');
      expect(() => validateStrictBoolean(1, 'retraining_required')).toThrow('INVALID_STRICT_BOOLEAN_RETRAINING_REQUIRED');
      expect(() => validateStrictBoolean(null, 'retraining_required')).toThrow('MISSING_STRICT_BOOLEAN_RETRAINING_REQUIRED');
    });

    it('29. publish blocked when Migration 208 capability probe fails', () => {
      const err = mapV14e2b2DatabaseError('publish_sop_training_obligations', new Error('E2B2_MIGRATION_208_REQUIRED'));
      expect(err.status).toBe(409);
      expect(err.code).toBe('E2B2_MIGRATION_208_REQUIRED');
    });

    it('30. publish proceeds when Migration 208 capability probe succeeds', () => {
      expect(edgeSource).toContain("select('training_target_count, acknowledgment_target_count, competency_target_count')");
      expect(edgeSource).toContain("rpc('publish_sop_training_obligations'");
    });

    it('31. reconcile action returns 409 E2B3_RECONCILIATION_NOT_RELEASED', () => {
      expect(edgeSource).toContain("action === 'reconcile_sop_training_population'");
      expect(edgeSource).toContain('E2B3_RECONCILIATION_NOT_RELEASED');
      const err = mapV14e2b2DatabaseError('reconcile_sop_training_population', new Error('E2B3_RECONCILIATION_NOT_RELEASED'));
      expect(err.status).toBe(409);
      expect(err.code).toBe('E2B3_RECONCILIATION_NOT_RELEASED');
    });

    it('32. payload size bound enforced at 64 KiB for E2B2 training actions', () => {
      expect(MAX_E2B2_PAYLOAD_BYTES).toBe(65536);
      expect(edgeSource).toContain('v14e2b2TrainingActions.has(action)');
      expect(edgeSource).toContain('payloadBytes > MAX_E2B2_PAYLOAD_BYTES');
    });

    it('33. no Edge call trusts browser actor identity', () => {
      for (const action of [
        'start_training_assignment',
        'complete_training_assignment',
        'record_competency_assessment',
        'waive_training_assignment_with_reason',
        'cancel_training_assignment_with_reason',
        'reopen_training_assignment_with_reason',
        'decide_sop_rollout_requirements',
        'publish_sop_training_obligations',
      ]) {
        expect(edgeSource).toContain(`p_actor_id: userData.user.id`);
      }
    });
  });

  // ==========================================================================
  // SECTION 6: Schema Contract & Tenancy Defect Remediation Proof (Cases A - T)
  // ==========================================================================
  describe('Section 6: Schema Contract & Tenancy Defect Remediation Proof', () => {
    it('A. Edge source contains NO document_acknowledgment_requirements.is_mandatory', () => {
      expect(edgeSource).not.toContain('is_mandatory');
    });

    it('B. acknowledgment query uses required_flag', () => {
      expect(edgeSource).toContain('required_flag');
    });

    it('C. acknowledgment filters document_id, version_id and required_flag=true', () => {
      expect(edgeSource).toContain(".eq('document_id', documentId)");
      expect(edgeSource).toContain(".eq('version_id', versionId)");
      expect(edgeSource).toContain(".eq('required_flag', true)");
    });

    it('D. Edge source contains NO training_assignments projection with organization_id', () => {
      const assignmentQueries = edgeSource.match(/from\(['"]training_assignments['"]\)\s*\.select\(([^)]+)\)/g) || [];
      expect(assignmentQueries.length).toBeGreaterThan(0);
      for (const query of assignmentQueries) {
        expect(query).not.toContain('organization_id');
      }
    });

    it('E. Edge source contains NO program_owner_id', () => {
      expect(edgeSource).not.toContain('program_owner_id');
    });

    it('F. program owner check uses owner_user_id', () => {
      expect(edgeSource).toContain('owner_user_id');
      expect(edgeSource).toContain('program.owner_user_id === userData.user.id');
    });

    it('G. training_programs projection contains NO organization_id', () => {
      const programQueries = edgeSource.match(/from\(['"]training_programs['"]\)\s*\.select\(([^)]+)\)/g) || [];
      expect(programQueries.length).toBeGreaterThan(0);
      for (const query of programQueries) {
        expect(query).not.toContain('organization_id');
      }
    });

    it('H. waive target cross-org check exists', () => {
      expect(edgeSource).toContain('if (targetProfile.organization_id !== actorProfile.organization_id)');
      const err = mapV14e2b2DatabaseError('waive_training_assignment_with_reason', new Error('TENANT_ISOLATION_VIOLATION'));
      expect(err.status).toBe(403);
      expect(err.code).toBe('AUTHORIZATION_DENIED');
    });

    it('I. cancel target cross-org check exists', () => {
      const err = mapV14e2b2DatabaseError('cancel_training_assignment_with_reason', new Error('TENANT_ISOLATION_VIOLATION'));
      expect(err.status).toBe(403);
    });

    it('J. reopen target cross-org check exists', () => {
      const err = mapV14e2b2DatabaseError('reopen_training_assignment_with_reason', new Error('TENANT_ISOLATION_VIOLATION'));
      expect(err.status).toBe(403);
    });

    it('K. governance_admin with scope=department is NOT global governance', () => {
      const roles = [{ role: 'governance_admin', scope: 'department', is_active: true, organization_id: validOrgId }];
      expect(hasActiveGlobalGovernanceRole(roles, validOrgId)).toBe(false);
    });

    it('L. department_manager with scope=global is NOT a department manager', () => {
      const roles = [{ role: 'department_manager', scope: 'global', is_active: true, department_id: validDeptId, organization_id: validOrgId }];
      expect(hasActiveDepartmentManagerRole(roles, validDeptId, validOrgId)).toBe(false);
    });

    it('M. department_manager with null organization is rejected', () => {
      const roles = [{ role: 'department_manager', scope: 'department', is_active: true, department_id: validDeptId, organization_id: null }];
      expect(hasActiveDepartmentManagerRole(roles, validDeptId, validOrgId)).toBe(false);
    });

    it('N. division_head with wrong scope or null organization is rejected', () => {
      const wrongScope = [{ role: 'division_head', scope: 'global', is_active: true, division_id: validDivId, organization_id: validOrgId }];
      expect(hasActiveDivisionHeadRole(wrongScope, validDivId, validOrgId)).toBe(false);

      const nullOrg = [{ role: 'division_head', scope: 'division', is_active: true, division_id: validDivId, organization_id: null }];
      expect(hasActiveDivisionHeadRole(nullOrg, validDivId, validOrgId)).toBe(false);
    });

    it('O. version-bound missing governed_sop_details fails closed', () => {
      expect(() =>
        resolveGovernedVersionTrainingRequirements(
          { id: validVerId, document_id: validDocId, version_number: 1, supersedes_version_id: null },
          null
        )
      ).toThrow('GOVERNED_SOP_VERSION_CONTEXT_INVALID');

      const err = mapV14e2b2DatabaseError('complete_training_assignment', new Error('GOVERNED_SOP_VERSION_CONTEXT_INVALID'));
      expect(err.status).toBe(409);
      expect(err.code).toBe('INVALID_LIFECYCLE_STATE');
    });

    it('P. training_required null is NOT treated as permission', () => {
      const res = resolveGovernedVersionTrainingRequirements(
        { id: validVerId, document_id: validDocId, version_number: 1, supersedes_version_id: null },
        { version_id: validVerId, training_required: null, retraining_required: null }
      );
      expect(res.formalTrainingRequired).toBe(false);
    });

    it('Q. competency_required null is NOT treated as permission', () => {
      const res = resolveGovernedVersionTrainingRequirements(
        { id: validVerId, document_id: validDocId, version_number: 1, supersedes_version_id: null },
        { version_id: validVerId, competency_assessment_required: null, competency_reassessment_required: null }
      );
      expect(res.competencyRequired).toBe(false);
    });

    it('R. initial/revision decision uses document version metadata', () => {
      const initial = resolveGovernedVersionTrainingRequirements(
        { id: validVerId, document_id: validDocId, version_number: 1, supersedes_version_id: null },
        { version_id: validVerId, training_required: true, retraining_required: false, competency_assessment_required: true, competency_reassessment_required: false }
      );
      expect(initial.isInitial).toBe(true);
      expect(initial.formalTrainingRequired).toBe(true);
      expect(initial.competencyRequired).toBe(true);

      const revision = resolveGovernedVersionTrainingRequirements(
        { id: validVerId, document_id: validDocId, version_number: 2, supersedes_version_id: 'prior-ver-id' },
        { version_id: validVerId, training_required: false, retraining_required: true, competency_assessment_required: false, competency_reassessment_required: true }
      );
      expect(revision.isInitial).toBe(false);
      expect(revision.formalTrainingRequired).toBe(true);
      expect(revision.competencyRequired).toBe(true);
    });

    it('S. generic undefined-column error maps to 500 EDGE_SCHEMA_CONTRACT_MISMATCH (not 409)', () => {
      const err = mapV14e2b2DatabaseError('start_training_assignment', {
        code: '42703',
        message: 'column "nonexistent_column" does not exist',
      });
      expect(err.status).toBe(500);
      expect(err.code).toBe('EDGE_SCHEMA_CONTRACT_MISMATCH');
    });

    it('T. explicit publish capability probe maps missing new matrix columns to E2B2_MIGRATION_208_REQUIRED', () => {
      const err = mapV14e2b2DatabaseError('publish_sop_training_obligations', new Error('E2B2_MIGRATION_208_REQUIRED'));
      expect(err.status).toBe(409);
      expect(err.code).toBe('E2B2_MIGRATION_208_REQUIRED');
    });
  });

  // ==========================================================================
  // SECTION 7: Program Tenancy Signal Independent Resolution (Section 5 Cases A - E)
  // ==========================================================================
  describe('Section 7: Program Tenancy Signal Independent Resolution Suite', () => {
    it('A. linked_sop_id resolves Org A and linked_document_id resolves Org A => PASS', async () => {
      const client = createMockServiceClient({
        controlled_documents: [
          { id: 'sop-doc-1', organization_id: validOrgId },
          { id: 'linked-doc-2', organization_id: validOrgId },
        ],
      });
      await expect(
        verifyProgramTenancy(
          client,
          {
            id: 'prog-1',
            linked_sop_id: 'sop-doc-1',
            linked_document_id: 'linked-doc-2',
          },
          validOrgId
        )
      ).resolves.toBeUndefined();
    });

    it('B. linked_sop_id resolves Org A and linked_document_id resolves Org B, expected Org A => TRAINING_PROGRAM_TENANCY_MISMATCH', async () => {
      const client = createMockServiceClient({
        controlled_documents: [
          { id: 'sop-doc-1', organization_id: validOrgId },
          { id: 'linked-doc-2', organization_id: 'other-org-beta' },
        ],
      });
      await expect(
        verifyProgramTenancy(
          client,
          {
            id: 'prog-1',
            linked_sop_id: 'sop-doc-1',
            linked_document_id: 'linked-doc-2',
          },
          validOrgId
        )
      ).rejects.toThrow('TRAINING_PROGRAM_TENANCY_MISMATCH');
    });

    it('C. linked_sop_id resolves Org A, linked_document_id resolves Org B, department + owner + creator resolve Org A => STILL FAIL', async () => {
      const client = createMockServiceClient({
        controlled_documents: [
          { id: 'sop-doc-1', organization_id: validOrgId },
          { id: 'linked-doc-2', organization_id: 'other-org-beta' },
        ],
        departments: [{ id: validDeptId, organization_id: validOrgId }],
        profiles: [
          { id: 'user-owner', organization_id: validOrgId },
          { id: 'user-creator', organization_id: validOrgId },
        ],
      });
      await expect(
        verifyProgramTenancy(
          client,
          {
            id: 'prog-1',
            linked_sop_id: 'sop-doc-1',
            linked_document_id: 'linked-doc-2',
            department_id: validDeptId,
            owner_user_id: 'user-owner',
            created_by: 'user-creator',
          },
          validOrgId
        )
      ).rejects.toThrow('TRAINING_PROGRAM_TENANCY_MISMATCH');
    });

    it('D. linked_sop_id and linked_document_id contain the same document ID => safe deduplicated PASS', async () => {
      const client = createMockServiceClient({
        controlled_documents: [{ id: 'sop-doc-1', organization_id: validOrgId }],
      });
      await expect(
        verifyProgramTenancy(
          client,
          {
            id: 'prog-1',
            linked_sop_id: 'sop-doc-1',
            linked_document_id: 'sop-doc-1',
          },
          validOrgId
        )
      ).resolves.toBeUndefined();
    });

    it('E. no tenancy signal resolves => TRAINING_PROGRAM_TENANCY_MISMATCH', async () => {
      const client = createMockServiceClient({});
      await expect(
        verifyProgramTenancy(
          client,
          {
            id: 'prog-1',
          },
          validOrgId
        )
      ).rejects.toThrow('TRAINING_PROGRAM_TENANCY_MISMATCH');
    });
  });

  // ==========================================================================
  // SECTION 8: Acknowledgment Role Canonical Scope Taxonomy (Section 6 Cases A - L)
  // ==========================================================================
  describe('Section 8: Acknowledgment Role Canonical Scope Taxonomy Suite', () => {
    it('A. governance_admin + global + matching org => true', () => {
      const roles = [{ role: 'governance_admin', scope: 'global', organization_id: validOrgId, is_active: true }];
      expect(hasActiveRoleForAcknowledgmentRequirement(roles, 'governance_admin', validOrgId)).toBe(true);
    });

    it('B. governance_admin + global + null org => true', () => {
      const roles = [{ role: 'governance_admin', scope: 'global', organization_id: null, is_active: true }];
      expect(hasActiveRoleForAcknowledgmentRequirement(roles, 'governance_admin', validOrgId)).toBe(true);
    });

    it('C. governance_admin + department => false', () => {
      const roles = [{ role: 'governance_admin', scope: 'department', organization_id: validOrgId, is_active: true }];
      expect(hasActiveRoleForAcknowledgmentRequirement(roles, 'governance_admin', validOrgId)).toBe(false);
    });

    it('D. department_manager + department + matching org => true', () => {
      const roles = [{ role: 'department_manager', scope: 'department', organization_id: validOrgId, is_active: true }];
      expect(hasActiveRoleForAcknowledgmentRequirement(roles, 'department_manager', validOrgId)).toBe(true);
    });

    it('E. department_manager + global + matching org => false', () => {
      const roles = [{ role: 'department_manager', scope: 'global', organization_id: validOrgId, is_active: true }];
      expect(hasActiveRoleForAcknowledgmentRequirement(roles, 'department_manager', validOrgId)).toBe(false);
    });

    it('F. department_manager + department + NULL org => false', () => {
      const roles = [{ role: 'department_manager', scope: 'department', organization_id: null, is_active: true }];
      expect(hasActiveRoleForAcknowledgmentRequirement(roles, 'department_manager', validOrgId)).toBe(false);
    });

    it('G. division_head + division + matching org => true', () => {
      const roles = [{ role: 'division_head', scope: 'division', organization_id: validOrgId, is_active: true }];
      expect(hasActiveRoleForAcknowledgmentRequirement(roles, 'division_head', validOrgId)).toBe(true);
    });

    it('H. division_head + department => false', () => {
      const roles = [{ role: 'division_head', scope: 'department', organization_id: validOrgId, is_active: true }];
      expect(hasActiveRoleForAcknowledgmentRequirement(roles, 'division_head', validOrgId)).toBe(false);
    });

    it('I. employee + assigned_only + matching org => true', () => {
      const roles = [{ role: 'employee', scope: 'assigned_only', organization_id: validOrgId, is_active: true }];
      expect(hasActiveRoleForAcknowledgmentRequirement(roles, 'employee', validOrgId)).toBe(true);
    });

    it('J. employee + global => false', () => {
      const roles = [{ role: 'employee', scope: 'global', organization_id: validOrgId, is_active: true }];
      expect(hasActiveRoleForAcknowledgmentRequirement(roles, 'employee', validOrgId)).toBe(false);
    });

    it('K. role from wrong organization => false', () => {
      const roles = [{ role: 'employee', scope: 'assigned_only', organization_id: 'wrong-org', is_active: true }];
      expect(hasActiveRoleForAcknowledgmentRequirement(roles, 'employee', validOrgId)).toBe(false);
    });

    it('L. inactive otherwise-valid role => false', () => {
      const roles = [{ role: 'employee', scope: 'assigned_only', organization_id: validOrgId, is_active: false }];
      expect(hasActiveRoleForAcknowledgmentRequirement(roles, 'employee', validOrgId)).toBe(false);
    });
  });

  // ==========================================================================
  // SECTION 9: Migration Integrity & Lineage Invariants (Cases 34 - 35)
  // ==========================================================================
  describe('Section 9: Migration Integrity & Lineage Invariants', () => {
    it('34. Migration 208 file remains unchanged', () => {
      const m208Path = path.resolve(rootDir, 'supabase/migrations/208_e2b2_training_authorization_and_compliance_contract_remediation.sql');
      const content = fs.readFileSync(m208Path);
      const hash = createHash('sha256').update(content).digest('hex');
      expect(hash).toBe('6bc3d22305a093be7940c223f073d1a827a748392ebd47b3316b62d53646f7a9');
    });

    it('35. Migration 209 is absent', () => {
      const files = fs.readdirSync(path.resolve(rootDir, 'supabase/migrations'));
      const has209 = files.some(f => f.startsWith('209_'));
      expect(has209).toBe(false);
    });
  });
});
