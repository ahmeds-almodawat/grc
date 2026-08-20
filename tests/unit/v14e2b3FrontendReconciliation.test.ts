import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildReconcilePopulationPayload,
  getTrainingCompliancePersona,
} from '../../src/lib/trainingComplianceModel';

const root = process.cwd();
const centerSource = fs.readFileSync(
  path.join(root, 'src/pages/TrainingGovernanceCenter.tsx'),
  'utf8',
);
const apiSource = fs.readFileSync(
  path.join(root, 'src/lib/trainingGovernanceApi.ts'),
  'utf8',
);

describe('GRC v1.4-E2B3 frontend population reconciliation contract', () => {
  it('01: canonical governance roles see reconciliation', () => {
    for (const role of ['super_admin', 'governance_admin', 'compliance_officer'] as const) {
      expect(getTrainingCompliancePersona([{ role, scope: 'global' }]).canReconcilePopulation).toBe(true);
    }
  });

  it.each([
    'executive',
    'auditor',
    'department_manager',
    'division_head',
    'employee',
    'viewer',
    'project_owner',
    'milestone_owner',
    'task_owner',
  ] as const)('%s does not see reconciliation', (role) => {
    expect(getTrainingCompliancePersona([{ role, scope: 'global' }]).canReconcilePopulation).toBe(false);
  });

  it('02: explicit checked confirmation describes all lifecycle effects', () => {
    expect(centerSource).toContain('reconcileConfirmed');
    expect(centerSource).toContain('disabled={!reconcileConfirmed || Boolean(busy)}');
    expect(centerSource).toContain('Newly eligible employees may receive training, competency, or acknowledgment obligations.');
    expect(centerSource).toContain('Open obligations for employees leaving the target scope may be cancelled.');
    expect(centerSource).toContain('Historical completion and acknowledgment evidence is preserved.');
  });

  it('03: payload contains only version_id and strict confirmation', () => {
    const payload = buildReconcilePopulationPayload('22222222-2222-4222-8222-222222222222');
    expect(payload).toEqual({
      version_id: '22222222-2222-4222-8222-222222222222',
      confirm_reconciliation: true,
    });
    expect(payload).not.toHaveProperty('actor_id');
    expect(payload).not.toHaveProperty('p_actor_id');
    expect(payload).not.toHaveProperty('user_id');
  });

  it('04: reconciliation uses privileged-action and never a direct browser RPC', () => {
    const start = apiSource.indexOf('function reconcileSopTrainingPopulation');
    expect(start).toBeGreaterThan(-1);
    const block = apiSource.slice(start, apiSource.indexOf('\nexport async function ', start + 1));
    expect(block).toContain('invokePrivilegedAction');
    expect(block).toContain('buildReconcilePopulationPayload');
    expect(block).not.toContain('.rpc(');
    expect(centerSource).not.toContain('.rpc(');
  });

  it('05: success counts are rendered and all live readers refresh', () => {
    for (const field of [
      'target_population_count',
      'newly_assigned_count',
      'reactivated_assignment_count',
      'cancelled_out_of_scope_count',
      'acknowledgment_requirements_created',
      'acknowledgment_requirements_reactivated',
      'acknowledgment_requirements_deactivated',
    ]) expect(centerSource).toContain(`reconciliationResult.${field}`);
    for (const reader of ['assignments.refresh()', 'ackGaps.refresh()', 'competencyGaps.refresh()', 'matrix.refresh()']) {
      expect(centerSource).toContain(reader);
    }
    expect(centerSource).toContain('await refreshLiveData()');
  });

  it('06: English and Arabic labels and impact messages are present', () => {
    expect(centerSource).toContain('Reconcile Population');
    expect(centerSource).toContain('Confirm and Reconcile');
    expect(centerSource).toContain('تسوية الفئة المستهدفة');
    expect(centerSource).toContain('تأكيد وتنفيذ التسوية');
    expect(centerSource).toContain('يتم الحفاظ على أدلة الإكمال والإقرار التاريخية.');
  });

  it('07: reconciliation never runs automatically on page load', () => {
    expect(centerSource).toContain('onClick={submitReconciliation}');
    expect(centerSource).not.toMatch(/useEffect\([\s\S]{0,300}reconcileSopTrainingPopulation/);
  });
});
