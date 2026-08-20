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

  it('02: global governance users can reach Team Compliance assignment administration candidates', async () => {
    const { getTrainingCompliancePersona } = await import('../../src/lib/trainingComplianceModel');

    for (const role of ['super_admin', 'governance_admin', 'compliance_officer'] as const) {
      const persona = getTrainingCompliancePersona([{ role, scope: 'global' }]);
      expect(persona.canViewTeamCompliance).toBe(true);
      expect(persona.canCertifyCompletionCandidate).toBe(true);
      expect(persona.canRecordCompetencyCandidate).toBe(true);
      expect(persona.canAdministerAssignmentCandidate).toBe(true);
      expect(persona.canPublishObligations).toBe(true);
    }
  });

  it('03: executive and auditor remain read-only and cannot reach Team Compliance mutation candidates', async () => {
    const { getTrainingCompliancePersona } = await import('../../src/lib/trainingComplianceModel');

    for (const role of ['executive', 'auditor'] as const) {
      const persona = getTrainingCompliancePersona([{ role, scope: 'global' }]);
      expect(persona.isReadOnlyGlobal).toBe(true);
      expect(persona.canViewGovernanceCompliance).toBe(true);
      expect(persona.canViewTeamCompliance).toBe(false);
      expect(persona.canCertifyCompletionCandidate).toBe(false);
      expect(persona.canRecordCompetencyCandidate).toBe(false);
      expect(persona.canAdministerAssignmentCandidate).toBe(false);
      expect(persona.canPublishObligations).toBe(false);
    }
  });

  it('04: self-assignment guard suppresses all admin actions for manager and global actors', async () => {
    const { getAssignmentRowActionEligibility, getTrainingCompliancePersona } = await import('../../src/lib/trainingComplianceModel');

    for (const role of ['department_manager', 'division_head', 'super_admin', 'governance_admin', 'compliance_officer'] as const) {
      const persona = getTrainingCompliancePersona([{ role, scope: role === 'division_head' ? 'division' : role === 'department_manager' ? 'department' : 'global' }]);
      for (const status of ['assigned', 'in_progress', 'overdue', 'completed', 'waived', 'cancelled'] as const) {
        expect(getAssignmentRowActionEligibility({
          persona,
          actorUserId: 'user-1',
          subjectUserId: 'user-1',
          status,
        })).toEqual({
          canCertifyCompletion: false,
          canRecordCompetency: false,
          canWaive: false,
          canCancel: false,
          canReopen: false,
        });
      }
    }
  });

  it('05: non-self scoped manager/global rows remain candidates where persona and lifecycle permit', async () => {
    const { getAssignmentRowActionEligibility, getTrainingCompliancePersona } = await import('../../src/lib/trainingComplianceModel');
    const manager = getTrainingCompliancePersona([{ role: 'department_manager', scope: 'department' }]);
    const governance = getTrainingCompliancePersona([{ role: 'governance_admin', scope: 'global' }]);

    for (const persona of [manager, governance]) {
      expect(getAssignmentRowActionEligibility({
        persona,
        actorUserId: 'manager-1',
        subjectUserId: 'employee-1',
        status: 'in_progress',
      })).toMatchObject({
        canCertifyCompletion: true,
        canRecordCompetency: true,
        canWaive: true,
        canCancel: true,
        canReopen: false,
      });
      expect(getAssignmentRowActionEligibility({
        persona,
        actorUserId: 'manager-1',
        subjectUserId: 'employee-1',
        status: 'completed',
      })).toMatchObject({
        canCertifyCompletion: false,
        canRecordCompetency: true,
        canWaive: false,
        canCancel: false,
        canReopen: true,
      });
    }
  });

  it('06: Team Compliance includes assignments, acknowledgment gaps, and competency gaps', async () => {
    const { isTeamComplianceEmpty, isTeamComplianceLoading } = await import('../../src/lib/trainingComplianceModel');

    expect(centerSource).toContain('getE2B2TrainingAssignmentQueueStrict');
    expect(centerSource).toContain('getE2B2SopAcknowledgmentGapsStrict');
    expect(centerSource).toContain('getE2B2CompetencyGapsStrict');
    expect(centerSource).toContain('sopAcknowledgmentGaps');
    expect(centerSource).toContain('competencyGapsStatus');
    expect(isTeamComplianceEmpty({ assignmentCount: 0, acknowledgmentGapCount: 1, competencyGapCount: 0 })).toBe(false);
    expect(isTeamComplianceEmpty({ assignmentCount: 0, acknowledgmentGapCount: 0, competencyGapCount: 1 })).toBe(false);
    expect(isTeamComplianceEmpty({ assignmentCount: 0, acknowledgmentGapCount: 0, competencyGapCount: 0 })).toBe(true);
    expect(isTeamComplianceLoading({ assignmentsLoading: false, acknowledgmentGapsLoading: true, competencyGapsLoading: false })).toBe(true);
  });

  it('07: competency payload forwards optional evidence_id exactly or null', async () => {
    const { buildRecordCompetencyAssessmentPayload } = await import('../../src/lib/trainingComplianceModel');

    expect(buildRecordCompetencyAssessmentPayload({
      assignment_id: 'assignment-1',
      user_id: 'employee-1',
      competency_area: 'Clinical safety',
      result: 'passed',
      score: 8.25,
      evidence_id: 'evidence-1',
      notes: 'Recorded evidence',
    })).toMatchObject({
      assignment_id: 'assignment-1',
      user_id: 'employee-1',
      competency_area: 'Clinical safety',
      result: 'passed',
      score: 8.25,
      evidence_id: 'evidence-1',
      notes: 'Recorded evidence',
    });

    expect(buildRecordCompetencyAssessmentPayload({
      assignment_id: 'assignment-1',
      user_id: 'employee-1',
      competency_area: 'Clinical safety',
      result: 'pending',
    }).evidence_id).toBeNull();
    expect(centerSource).toContain('evidence_id: evidenceId.trim() || null');
    expect(centerSource).toContain('Evidence ID (optional)');
  });

  it('08: assignment queue type matches the exact DB208 18-column read model and removes phantom SOP metadata', () => {
    const assignmentInterface = apiSource.match(/export interface TrainingAssignmentQueueRow \{[\s\S]*?\n\}/)?.[0] ?? '';
    const expectedFields = [
      'id',
      'program_id',
      'assigned_to_user_id',
      'assigned_to_role',
      'assigned_to_department_id',
      'due_date',
      'status',
      'assigned_at',
      'assigned_by',
      'completed_at',
      'completion_evidence_id',
      'program_title',
      'program_title_ar',
      'training_type',
      'assigned_user_name_en',
      'assigned_user_name_ar',
      'department_name_en',
      'department_name_ar',
    ];
    for (const field of expectedFields) expect(assignmentInterface).toContain(field);
    expect(assignmentInterface).not.toContain('document_version_id');
    expect(assignmentInterface).not.toContain('document_code');
    expect(assignmentInterface).not.toContain('version_label');
    expect(centerSource).toContain('localizedName(language, row.program_title, row.program_title_ar)');
  });

  it('09: strict E2B2 read failures throw while successful empty reads remain []', async () => {
    const { E2B2LiveReadError, runStrictE2B2Read } = await import('../../src/lib/trainingGovernanceApi');

    await expect(runStrictE2B2Read('Matrix', async () => ({
      data: null,
      error: { message: 'raw database error' },
    }))).rejects.toBeInstanceOf(E2B2LiveReadError);

    await expect(runStrictE2B2Read('Matrix', async () => ({
      data: [],
      error: null,
    }))).resolves.toEqual([]);
  });

  it('10: KPI display and combined loading do not fabricate zero before a successful live read', async () => {
    const { formatLiveMetric, isMyObligationsLoading } = await import('../../src/lib/trainingComplianceModel');

    expect(formatLiveMetric(0, 'loading')).toBe('-');
    expect(formatLiveMetric(0, 'error')).toBe('-');
    expect(formatLiveMetric(0, 'success')).toBe('0');
    expect(isMyObligationsLoading({
      assignmentsLoading: false,
      acknowledgmentGapsLoading: true,
      competencyGapsLoading: false,
    })).toBe(true);
    expect(centerSource).toContain('matrixStatus');
    expect(trainingTabSource).toContain('matrixStatus');
  });

  it('11: score formatting is raw and never implies a fixed scale', async () => {
    const { formatCompetencyScore } = await import('../../src/lib/trainingComplianceModel');
    expect(formatCompetencyScore(7.5)).toBe('7.5');
    expect(formatCompetencyScore(null)).toBe('-');
    expect(centerSource).not.toContain('/100');
    expect(centerSource).not.toMatch(/\bscore\b[\s\S]{0,80}%/i);
  });

  it('12: acknowledgment and start payloads omit user and actor identity overrides', async () => {
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

  it('13: E2B3 reconciliation stays unreleased in the E2B2 UI', async () => {
    const { E2B2_RELEASED_MUTATION_ACTIONS, isE2B3ReconcileReleasedInUi } = await import('../../src/lib/trainingComplianceModel');
    expect(isE2B3ReconcileReleasedInUi()).toBe(false);
    expect(E2B2_RELEASED_MUTATION_ACTIONS).not.toContain('reconcile_sop_training_population');
    expect(centerSource).not.toContain('Reconcile Population');
    expect(trainingTabSource).not.toContain('Reconcile Population');
  });

  it('14: TrainingAckTab fake values are absent and live DB208 matrix data is used strictly', () => {
    expect(trainingTabSource).toContain('getE2B2SopTrainingComplianceMatrixStrict');
    expect(trainingTabSource).toContain('v_sop_training_compliance_matrix');
    expect(trainingTabSource).not.toContain('100% compliant');
    expect(trainingTabSource).not.toContain('4.2 days');
    expect(trainingTabSource).not.toContain('Within 30-day SLA');
    expect(trainingTabSource).not.toContain('Active Policy Curricula');
  });

  it('15: DB208 compliance matrix type includes corrected separate target counts', () => {
    for (const column of ['training_target_count', 'acknowledgment_target_count', 'competency_target_count']) {
      expect(apiSource).toContain(column);
      expect(trainingTabSource).toContain(column);
      expect(centerSource).toContain(column);
    }
  });

  it('16: governed E2B2 frontend mutations route through privileged-action, not direct browser RPC', () => {
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

  it('17: legacy unsupported actions are isolated and not used by the new E2B2 UI', async () => {
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

  it('18: bilingual UX, empty states, and controlled errors are present', () => {
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
    expect(centerSource).toContain('The backend rejected this operation for the current authenticated user.');
    expect(centerSource).toContain('رفض الخادم هذا الإجراء للمستخدم المصادق الحالي.');
    expect(trainingTabSource).toContain('بيانات امتثال التدريب الحية غير متاحة');
    expect(modelSource).not.toContain('quality_director');
    expect(modelSource).not.toContain('training_coordinator');
  });
});
