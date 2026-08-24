import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  governedPolicySopLifecycleActions,
  optionalIsoDate,
  validateActivateDocumentProof,
  validateCompleteReviewProof,
  validateCreatePolicyDraftProof,
  validatePolicyRequirements,
  validateRequestExceptionProof,
  validateRetireDocumentProof,
  validateRoleScopes,
  validateSavePolicyDraftProof,
  validateTriggerReviewProof,
} from '../../supabase/functions/_shared/v14e1rGovernedDocumentBridge.ts';

describe('P3 governed Policy and SOP Edge bridge closure', () => {
  const root = process.cwd();
  const edge = fs.readFileSync(path.join(root, 'supabase/functions/privileged-action/index.ts'), 'utf8');
  const registry = fs.readFileSync(path.join(root, 'src/lib/runtimeActionRegistry.ts'), 'utf8');
  const uuidA = '11111111-1111-4111-8111-111111111111';
  const uuidB = '22222222-2222-4222-8222-222222222222';

  it('allowlists and dispatches every canonical frontend lifecycle action', () => {
    const actions = [
      'create_governed_policy_draft',
      'save_governed_policy_draft',
      'create_governed_sop_draft',
      'save_governed_sop_draft',
      'start_governed_document_revision',
      'submit_governed_document_for_review',
      'activate_governed_document_version',
      'retire_governed_document',
      'request_policy_sop_exception',
      'trigger_governed_document_review',
      'complete_governed_document_review',
    ];
    expect([...governedPolicySopLifecycleActions]).toEqual(actions);
    for (const action of actions) {
      expect(edge).toContain(`action === '${action}'`);
      expect(registry).toContain(`actionName: '${action}'`);
    }
    expect(edge).toContain('...governedPolicySopLifecycleActions');
  });

  it('normalizes Policy requirements and rejects unknown or malformed fields', () => {
    expect(validatePolicyRequirements([{
      sequence_number: 1,
      requirement_statement_en: 'Retain approval evidence.',
      is_mandatory: true,
      mapped_control_id: uuidA,
    }])).toEqual([{
      sequence_number: 1,
      requirement_statement_en: 'Retain approval evidence.',
      is_mandatory: true,
      mapped_control_id: uuidA,
    }]);
    expect(() => validatePolicyRequirements([{
      requirement_statement_en: 'Invalid extra field.',
      is_mandatory: true,
      actor_id: uuidA,
    }])).toThrow(/UNKNOWN_FIELD_ACTOR_ID/);
    expect(() => validatePolicyRequirements([{
      requirement_statement_en: 'Invalid control.',
      is_mandatory: true,
      mapped_control_id: 'not-a-uuid',
    }])).toThrow(/INVALID_UUID/);
  });

  it('accepts loaded role-scope IDs but sends only the governed role fields', () => {
    expect(validateRoleScopes([{
      id: uuidA,
      role_name: 'governance_admin',
      job_title: 'Governance Lead',
    }])).toEqual([{
      role_name: 'governance_admin',
      job_title: 'Governance Lead',
    }]);
  });

  it('validates real calendar dates without coercion', () => {
    expect(optionalIsoDate('2026-08-24', 'due_date', true)).toBe('2026-08-24');
    expect(() => optionalIsoDate('2026-02-30', 'due_date', true)).toThrow('INVALID_DATE_DUE_DATE');
    expect(() => optionalIsoDate('24/08/2026', 'due_date', true)).toThrow('INVALID_DATE_DUE_DATE');
  });

  it('fails closed unless canonical RPC response proofs match the requested resource', () => {
    expect(validateCreatePolicyDraftProof({
      document_id: uuidA,
      version_id: uuidB,
      document_code: 'POL-2026-001',
      document_status: 'draft',
      version_number: 1,
    })).toBe(true);
    expect(validateSavePolicyDraftProof({ success: true, version_id: uuidB }, uuidB)).toBe(true);
    expect(validateActivateDocumentProof({
      document_id: uuidA,
      version_id: uuidB,
      status: 'active',
      effective_date: '2026-08-24',
    }, uuidB)).toBe(true);
    expect(validateRetireDocumentProof({ document_id: uuidA, status: 'retired' }, uuidA)).toBe(true);
    expect(validateRequestExceptionProof({
      exception_id: uuidA,
      approval_request_id: uuidB,
      exception_code: 'EXC-2026-001',
      status: 'requested',
    })).toBe(true);
    expect(validateTriggerReviewProof({ trigger_id: uuidB, document_id: uuidA, status: 'open' }, uuidA)).toBe(true);
    expect(validateCompleteReviewProof({
      trigger_id: uuidB,
      document_id: uuidA,
      outcome: 'no_change',
      status: 'completed',
    }, uuidB, 'no_change')).toBe(true);
    expect(validateSavePolicyDraftProof({ success: true, version_id: uuidA }, uuidB)).toBe(false);
  });

  it('derives actor and organization identity exclusively on the server', () => {
    expect(edge).toContain('p_actor_id: userData.user.id');
    expect(edge).toContain('p_organization_id: actorProfile.organization_id');
    expect(edge).toContain("assertNoIdentityOverrides(payload, ['actor_id', 'p_actor_id', 'organization_id', 'p_organization_id'])");
  });
});
