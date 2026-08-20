import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  E2B3_TRAINING_RECONCILIATION_CONTRACT,
  hasExactE2B3GlobalGovernanceRole,
  hasExactE2B3TrainingReconciliationCapability,
  isE2B3Migration209CapabilityUnavailable,
} from '../../supabase/functions/_shared/v14e2b3TrainingReconciliationBridge.ts';
import {
  mapV14e2b2DatabaseError,
  validateStrictBoolean,
} from '../../supabase/functions/_shared/v14e2b2TrainingBridge.ts';

const root = process.cwd();
const edgeSource = fs.readFileSync(
  path.join(root, 'supabase/functions/privileged-action/index.ts'),
  'utf8',
);
const configSource = fs.readFileSync(path.join(root, 'supabase/config.toml'), 'utf8');
const reconcileRoute = edgeSource.match(
  /if \(action === 'reconcile_sop_training_population'\) \{[\s\S]*?\n  if \(action === 'record_document_acknowledgment'\)/,
)?.[0] ?? '';

describe('GRC v1.4-E2B3 privileged-action Edge v15 reconciliation', () => {
  it('01: DB208 missing capability maps to 409 E2B3_MIGRATION_209_REQUIRED', () => {
    expect(isE2B3Migration209CapabilityUnavailable({
      code: 'PGRST202',
      message: 'Could not find the function public.get_e2b3_training_reconciliation_capabilities',
    })).toBe(true);
    expect(reconcileRoute).toContain('E2B3_MIGRATION_209_REQUIRED');
    expect(reconcileRoute).toContain('409');
  });

  it('02: failed capability probe returns before the reconciliation RPC', () => {
    const probeIndex = reconcileRoute.indexOf("rpc(\n        'get_e2b3_training_reconciliation_capabilities'");
    const failedProbeReturnIndex = reconcileRoute.indexOf('if (capabilityProbe.error)');
    const reconciliationRpcIndex = reconcileRoute.indexOf("rpc('reconcile_sop_training_population'");
    expect(probeIndex).toBeGreaterThan(-1);
    expect(failedProbeReturnIndex).toBeGreaterThan(probeIndex);
    expect(reconciliationRpcIndex).toBeGreaterThan(failedProbeReturnIndex);
    expect(reconcileRoute.slice(failedProbeReturnIndex, reconciliationRpcIndex)).toContain('return errorResponse');
  });

  it('03: exact DB209 capability allows the route contract to proceed', () => {
    expect(hasExactE2B3TrainingReconciliationCapability(
      E2B3_TRAINING_RECONCILIATION_CONTRACT,
    )).toBe(true);
    expect(hasExactE2B3TrainingReconciliationCapability({
      ...E2B3_TRAINING_RECONCILIATION_CONTRACT,
      unexpected: true,
    })).toBe(false);
    expect(hasExactE2B3TrainingReconciliationCapability({
      ...E2B3_TRAINING_RECONCILIATION_CONTRACT,
      schema_version: 208,
    })).toBe(false);
  });

  it('04: confirm_reconciliation must be strict boolean true', () => {
    expect(validateStrictBoolean(true, 'confirm_reconciliation')).toBe(true);
    expect(validateStrictBoolean(false, 'confirm_reconciliation')).toBe(false);
    expect(() => validateStrictBoolean('true', 'confirm_reconciliation')).toThrow();
    expect(reconcileRoute).toContain("throw new Error('RECONCILIATION_CONFIRMATION_REQUIRED')");
  });

  it('05: actor identity is always bound from the authenticated user', () => {
    expect(reconcileRoute).toContain('p_actor_id: userData.user.id');
    expect(reconcileRoute).toContain('validateLegacyActorId(payload, userData.user.id)');
  });

  it('06: actor aliases, target identity, and unknown keys are rejected', () => {
    for (const alias of [
      'p_actor_id',
      'acting_user_id',
      'authenticated_user_id',
      'target_user_id',
    ]) expect(reconcileRoute).toContain(`'${alias}'`);
    expect(reconcileRoute).toContain("new Set(['version_id', 'confirm_reconciliation', 'actor_id'])");
  });

  it('07: E2B3 canonical governance roles require active global exact-org assignments', () => {
    const org = 'org-a';
    for (const role of ['super_admin', 'governance_admin', 'compliance_officer']) {
      expect(hasExactE2B3GlobalGovernanceRole([
        { role, scope: 'global', is_active: true, organization_id: org },
      ], org)).toBe(true);
    }
  });

  it('08: null, undefined, wrong-org, wrong-scope, inactive, and noncanonical assignments are denied', () => {
    const org = 'org-a';
    for (const organization_id of [null, undefined, 'org-b']) {
      expect(hasExactE2B3GlobalGovernanceRole([
        { role: 'governance_admin', scope: 'global', is_active: true, organization_id },
      ], org)).toBe(false);
    }
    for (const scope of ['assigned_only', 'department', 'division', 'unit']) {
      expect(hasExactE2B3GlobalGovernanceRole([
        { role: 'governance_admin', scope, is_active: true, organization_id: org },
      ], org)).toBe(false);
    }
    expect(hasExactE2B3GlobalGovernanceRole([
      { role: 'governance_admin', scope: 'global', is_active: false, organization_id: org },
    ], org)).toBe(false);
    for (const role of ['executive', 'auditor', 'department_manager', 'division_head']) {
      expect(hasExactE2B3GlobalGovernanceRole([
        { role, scope: 'global', is_active: true, organization_id: org },
      ], org)).toBe(false);
    }
    expect(reconcileRoute).toContain('hasExactE2B3GlobalGovernanceRole');
  });

  it('09: document-owner authority is same-org and follows active actor preflight', () => {
    expect(reconcileRoute).toContain('doc.organization_id !== actorProfile.organization_id');
    expect(reconcileRoute).toContain('doc.document_owner_id === userData.user.id');
    expect(edgeSource).toContain("actorProfile.user_status !== 'active'");
  });

  it('10: version and SOP document context are verified before reconciliation', () => {
    expect(reconcileRoute).toContain(".from('document_versions')");
    expect(reconcileRoute).toContain(".from('controlled_documents')");
    expect(reconcileRoute).toContain("doc.document_type !== 'sop'");
  });

  it('R1-01: DB209 marker preflight follows capability and blocks before reconciliation RPC', () => {
    const capabilityIndex = reconcileRoute.indexOf("'get_e2b3_training_reconciliation_capabilities'");
    const markerReadIndex = reconcileRoute.indexOf(".select('version_id, training_obligations_published_at')");
    const markerBlockIndex = reconcileRoute.indexOf("'TRAINING_OBLIGATIONS_NOT_PUBLISHED'");
    const reconciliationRpcIndex = reconcileRoute.indexOf("rpc('reconcile_sop_training_population'");
    expect(markerReadIndex).toBeGreaterThan(capabilityIndex);
    expect(markerBlockIndex).toBeGreaterThan(markerReadIndex);
    expect(reconciliationRpcIndex).toBeGreaterThan(markerBlockIndex);
  });

  it('R1-02: DB208 capability failure returns before any DB209 publication-column read', () => {
    const capabilityErrorIndex = reconcileRoute.indexOf('if (capabilityProbe.error)');
    const markerReadIndex = reconcileRoute.indexOf('training_obligations_published_at');
    expect(capabilityErrorIndex).toBeGreaterThan(-1);
    expect(markerReadIndex).toBeGreaterThan(capabilityErrorIndex);
    expect(reconcileRoute.slice(capabilityErrorIndex, markerReadIndex)).toContain('return errorResponse');
  });

  it('11: E2B2 actions and guards remain present', () => {
    for (const action of [
      'start_training_assignment',
      'complete_training_assignment',
      'record_competency_assessment',
      'waive_training_assignment_with_reason',
      'cancel_training_assignment_with_reason',
      'reopen_training_assignment_with_reason',
      'decide_sop_rollout_requirements',
      'publish_sop_training_obligations',
      'record_document_acknowledgment',
    ]) expect(edgeSource).toContain(action);
    expect(edgeSource).toContain('MAX_E2B2_PAYLOAD_BYTES');
  });

  it('12: verify_jwt remains true', () => {
    expect(configSource).toMatch(/\[functions\.privileged-action\][\s\S]*?verify_jwt\s*=\s*true/);
  });

  it('13: database migration-state error maps to a stable conflict response', () => {
    expect(mapV14e2b2DatabaseError(
      'reconcile_sop_training_population',
      new Error('E2B3_MIGRATION_209_REQUIRED'),
    )).toMatchObject({ status: 409, code: 'E2B3_MIGRATION_209_REQUIRED' });
  });

  it('R1-03: unpublished exact-version state maps to a stable lifecycle conflict', () => {
    expect(mapV14e2b2DatabaseError(
      'reconcile_sop_training_population',
      new Error('TRAINING_OBLIGATIONS_NOT_PUBLISHED'),
    )).toMatchObject({ status: 409, code: 'TRAINING_OBLIGATIONS_NOT_PUBLISHED' });
  });
});
