import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = path.resolve(__dirname, '../..');

function readProjectFile(relativePath: string): string {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const modelSource = readProjectFile('src/lib/trainingComplianceModel.ts');
const apiSource = readProjectFile('src/lib/trainingGovernanceApi.ts');
const centerSource = readProjectFile('src/pages/TrainingGovernanceCenter.tsx');
const trainingTabSource = readProjectFile('src/components/policy-sop/TrainingAckTab.tsx');

describe('GRC v1.4-E2B2 frontend training compliance contract', () => {
  it('01: employee persona can start and acknowledge but cannot certify, assess, administer, or publish', async () => {
    const { getTrainingCompliancePersona } = await import('../../src/lib/trainingComplianceModel');
    const persona = getTrainingCompliancePersona([{ role: 'employee', scope: 'assigned_only' }]);

    expect(persona.canViewMyObligations).toBe(true);
    expect(persona.canStartOwnTraining).toBe(true);
    expect(persona.canAcknowledgeOwnVersion).toBe(true);
    expect(persona.canCertifyCompletionCandidate).toBe(false);
    expect(persona.canRecordCompetencyCandidate).toBe(false);
    expect(persona.canAdministerAssignmentCandidate).toBe(false);
    expect(persona.canPublishObligations).toBe(false);
  });

  it('02: manager and governance personas expose only candidate controls while executive and auditor remain read-only', async () => {
    const { getTrainingCompliancePersona } = await import('../../src/lib/trainingComplianceModel');

    for (const role of ['department_manager', 'division_head'] as const) {
      const persona = getTrainingCompliancePersona([{ role, scope: role === 'department_manager' ? 'department' : 'division' }]);
      expect(persona.canViewTeamCompliance).toBe(true);
      expect(persona.canAdministerAssignmentCandidate).toBe(true);
      expect(persona.canPublishObligations).toBe(false);
    }

    for (const role of ['governance_admin', 'compliance_officer', 'super_admin'] as const) {
      const persona = getTrainingCompliancePersona([{ role, scope: 'global' }]);
      expect(persona.canViewGovernanceCompliance).toBe(true);
      expect(persona.canPublishObligations).toBe(true);
      expect(persona.canDecideRollout).toBe(true);
      expect(persona.canCertifyCompletionCandidate).toBe(true);
      expect(persona.canRecordCompetencyCandidate).toBe(true);
    }

    for (const role of ['executive', 'auditor'] as const) {
      const persona = getTrainingCompliancePersona([{ role, scope: 'global' }]);
      expect(persona.isReadOnlyGlobal).toBe(true);
      expect(persona.canViewGovernanceCompliance).toBe(true);
      expect(persona.canCertifyCompletionCandidate).toBe(false);
      expect(persona.canRecordCompetencyCandidate).toBe(false);
      expect(persona.canAdministerAssignmentCandidate).toBe(false);
      expect(persona.canPublishObligations).toBe(false);
    }
  });

  it('03: score formatting is raw and never implies a fixed scale', async () => {
    const { formatCompetencyScore } = await import('../../src/lib/trainingComplianceModel');
    expect(formatCompetencyScore(7.5)).toBe('7.5');
    expect(formatCompetencyScore(null)).toBe('-');
    expect(centerSource).not.toContain('/100');
    expect(centerSource).not.toMatch(/\bscore\b[\s\S]{0,80}%/i);
  });

  it('04: acknowledgment and start payloads omit user and actor identity overrides', async () => {
    const {
      buildRecordDocumentAcknowledgmentPayload,
      buildStartTrainingPayload,
    } = await import('../../src/lib/trainingComplianceModel');

    const ackPayload = buildRecordDocumentAcknowledgmentPayload({
      document_id: '11111111-1111-4111-8111-111111111111',
      version_id: '22222222-2222-4222-8222-222222222222',
      acknowledgment_note: 'Read in web UI',
    });
    expect(ackPayload).toEqual({
      document_id: '11111111-1111-4111-8111-111111111111',
      version_id: '22222222-2222-4222-8222-222222222222',
      acknowledgment_method: 'web_ui',
      acknowledgment_note: 'Read in web UI',
    });
    expect(ackPayload).not.toHaveProperty('user_id');
    expect(ackPayload).not.toHaveProperty('target_user_id');
    expect(ackPayload).not.toHaveProperty('p_actor_id');

    expect(buildStartTrainingPayload('33333333-3333-4333-8333-333333333333')).toEqual({
      assignment_id: '33333333-3333-4333-8333-333333333333',
    });
  });

  it('05: E2B3 reconciliation stays unreleased in the E2B2 UI', async () => {
    const { E2B2_RELEASED_MUTATION_ACTIONS, isE2B3ReconcileReleasedInUi } = await import('../../src/lib/trainingComplianceModel');
    expect(isE2B3ReconcileReleasedInUi()).toBe(false);
    expect(E2B2_RELEASED_MUTATION_ACTIONS).not.toContain('reconcile_sop_training_population');
    expect(centerSource).not.toContain('Reconcile Population');
    expect(trainingTabSource).not.toContain('Reconcile Population');
  });

  it('06: TrainingAckTab fake values are removed and live DB208 matrix data is used', () => {
    expect(trainingTabSource).toContain('getSopTrainingComplianceMatrix');
    expect(trainingTabSource).toContain('v_sop_training_compliance_matrix');
    expect(trainingTabSource).not.toContain('100% compliant');
    expect(trainingTabSource).not.toContain('4.2 days');
    expect(trainingTabSource).not.toContain('Within 30-day SLA');
    expect(trainingTabSource).not.toContain('Active Policy Curricula');
  });

  it('07: DB208 compliance matrix type includes corrected separate target counts', () => {
    for (const column of ['training_target_count', 'acknowledgment_target_count', 'competency_target_count']) {
      expect(apiSource).toContain(column);
      expect(trainingTabSource).toContain(column);
      expect(centerSource).toContain(column);
    }
  });

  it('08: governed E2B2 frontend mutations route through privileged-action, not direct browser RPC', () => {
    const governedWrappers = [
      'recordDocumentAcknowledgment',
      'startTrainingAssignment',
      'completeTrainingAssignment',
      'recordCompetencyAssessment',
      'waiveTrainingAssignment',
      'cancelTrainingAssignment',
      'reopenTrainingAssignment',
      'decideSopRolloutRequirements',
      'publishSopTrainingObligations',
    ];
    for (const wrapper of governedWrappers) {
      const wrapperIdx = apiSource.indexOf(`function ${wrapper}`);
      expect(wrapperIdx).toBeGreaterThan(-1);
      const nextFunctionIdx = apiSource.indexOf('\nexport async function ', wrapperIdx + 1);
      const block = apiSource.slice(wrapperIdx, nextFunctionIdx === -1 ? undefined : nextFunctionIdx);
      expect(block).toContain('invokePrivilegedAction');
      expect(block).not.toContain('.rpc(');
    }
    expect(centerSource).not.toContain('.rpc(');
    expect(trainingTabSource).not.toContain('.rpc(');
  });

  it('09: legacy unsupported actions are isolated and not used by the new E2B2 UI', async () => {
    const { E2B2_LEGACY_UNSUPPORTED_ACTIONS } = await import('../../src/lib/trainingComplianceModel');
    expect(E2B2_LEGACY_UNSUPPORTED_ACTIONS).toEqual([
      'create_training_program',
      'assign_training_program_to_user',
      'assign_training_program_to_department',
      'acknowledge_training_assignment',
      'link_training_evidence',
    ]);
    for (const action of E2B2_LEGACY_UNSUPPORTED_ACTIONS) {
      expect(centerSource).not.toContain(action);
      expect(trainingTabSource).not.toContain(action);
    }
  });

  it('10: bilingual UX, empty states, and exact acknowledgment attestation are present', () => {
    expect(centerSource).toContain('My Obligations');
    expect(centerSource).toContain('التزاماتي');
    expect(centerSource).toContain('Team Compliance');
    expect(centerSource).toContain('امتثال الفريق');
    expect(centerSource).toContain('Training & Compliance');
    expect(centerSource).toContain('التدريب والامتثال');
    expect(centerSource).toContain('I confirm that I have read and understood this governed SOP version.');
    expect(centerSource).toContain('أؤكد أنني قرأت وفهمت هذه النسخة المحكومة من إجراء التشغيل.');
    expect(centerSource).toContain('No training or acknowledgment obligations are currently assigned.');
    expect(centerSource).toContain('No scoped team training obligations are currently visible.');
    expect(centerSource).toContain('No governed SOP training obligations have been published yet.');
  });
});
