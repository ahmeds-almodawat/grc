import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  applyOvrAuthoritativePatches,
  canCompleteManagerReview,
  nextStageHint,
  reconcileOvrAuthoritativeState,
  retireConvergedOvrPatches,
  type OvrAuthoritativeStatePatch,
} from '../../src/pages/OVR';
import type { OvrReportRow, OvrStatus } from '../../src/types/domain';

const root = resolve(import.meta.dirname, '../..');
const source = (path: string) => readFileSync(resolve(root, path), 'utf8').replace(/\r\n/g, '\n');
const ovrSource = source('src/pages/OVR.tsx');

function report(status: OvrStatus, overrides: Partial<OvrReportRow> = {}): OvrReportRow {
  return {
    id: 'ovr-h1',
    organization_id: 'org-h1',
    ovr_number: 'OVR-H1',
    logging_number: 'H1',
    occurrence_date: '2026-08-15',
    occurrence_time: '15:00:00',
    occurrence_location: null,
    involved_person_type: 'other',
    person_involved_name: null,
    mrn_or_id_no: null,
    department_id: 'department-h1',
    brief_description: 'Synthetic H1 regression record',
    occurrence_category: 'other',
    severity_level: 'level_1',
    injury_type: null,
    evidence_required: true,
    status,
    corrective_action_required: true,
    linked_project_id: null,
    created_at: '2026-08-15T12:00:00.000Z',
    ...overrides,
  };
}

function section(startMarker: string, endMarker: string) {
  const start = ovrSource.indexOf(startMarker);
  const end = ovrSource.indexOf(endMarker, start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return ovrSource.slice(start, end);
}

describe('F4 H1 OVR open-modal authoritative state synchronization', () => {
  it('keeps manager review authoritative across an immediate stale read and a later fresh read', async () => {
    const initial = report('submitted');
    const stale = report('submitted');
    const fresh = report('manager_review', { supervisor_investigation: 'Governed review complete' });
    const mutate = vi.fn().mockResolvedValue({
      id: initial.id,
      status: 'manager_review',
      supervisor_due_date: null,
      quality_validated_at: null,
      cross_department_notified_at: null,
      final_verdict: null,
      reporter_response: null,
      closed_at: null,
    } satisfies OvrAuthoritativeStatePatch);

    const transition = await mutate();
    let selected = reconcileOvrAuthoritativeState(initial, transition);
    const renderedStatuses = [selected.status];
    selected = reconcileOvrAuthoritativeState(selected, transition, stale);
    renderedStatuses.push(selected.status);
    selected = reconcileOvrAuthoritativeState(selected, transition, fresh);
    renderedStatuses.push(selected.status);

    expect(renderedStatuses).toEqual(['manager_review', 'manager_review', 'manager_review']);
    expect(nextStageHint(selected.status)).toBe(2);
    expect(canCompleteManagerReview(selected.status)).toBe(false);
    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it('keeps the list authoritative through repeated stale reads and retires the patch after convergence', () => {
    const initial = report('submitted');
    const transition: OvrAuthoritativeStatePatch = { id: initial.id, status: 'manager_review' };
    const staleOne = report('submitted');
    const staleTwo = report('submitted');
    const fresh = report('manager_review');
    let patches: ReadonlyMap<string, OvrAuthoritativeStatePatch> = new Map([[initial.id, transition]]);

    expect(applyOvrAuthoritativePatches([staleOne], patches)[0]?.status).toBe('manager_review');
    patches = retireConvergedOvrPatches(patches, [staleOne]);
    expect(patches.has(initial.id)).toBe(true);

    expect(applyOvrAuthoritativePatches([staleTwo], patches)[0]?.status).toBe('manager_review');
    patches = retireConvergedOvrPatches(patches, [staleTwo]);
    expect(patches.has(initial.id)).toBe(true);

    patches = retireConvergedOvrPatches(patches, [fresh]);
    expect(patches.has(initial.id)).toBe(false);
    expect(applyOvrAuthoritativePatches([fresh], patches)[0]?.status).toBe('manager_review');
    expect(applyOvrAuthoritativePatches([report('quality_validation')], patches)[0]?.status).toBe('quality_validation');
  });

  it('protects a quality-validation transition from a stale manager-review read', () => {
    const initial = report('manager_review');
    const transition: OvrAuthoritativeStatePatch = {
      id: initial.id,
      status: 'quality_validation',
      quality_validated_at: '2026-08-15T12:30:00.000Z',
    };
    const stale = report('manager_review', { quality_validated_at: null });

    const selected = reconcileOvrAuthoritativeState(initial, transition, stale);

    expect(selected.status).toBe('quality_validation');
    expect(selected.quality_validated_at).toBe('2026-08-15T12:30:00.000Z');
    expect(nextStageHint(selected.status)).toBe(3);

    const patches = new Map([[initial.id, transition]]);
    const renderedList = applyOvrAuthoritativePatches([stale], patches);
    expect(renderedList[0]?.status).toBe('quality_validation');
    expect(retireConvergedOvrPatches(patches, [stale]).has(initial.id)).toBe(true);
  });

  it('protects the corrective finalizer result and immediately enables reporter-decision state', async () => {
    const initial = report('corrective_action_in_progress', { final_verdict: null });
    const transition: OvrAuthoritativeStatePatch = {
      id: initial.id,
      status: 'quality_final_review',
      final_verdict: 'Accepted synthetic verdict',
      final_verdict_at: '2026-08-15T12:45:00.000Z',
      closed_at: null,
    };
    const stale = report('corrective_action_in_progress', { final_verdict: null });
    const finalize = vi.fn().mockResolvedValue(transition);

    const mutationResult = await finalize();
    const selected = reconcileOvrAuthoritativeState(initial, mutationResult, stale);

    expect(selected.status).toBe('quality_final_review');
    expect(selected.final_verdict).toBe('Accepted synthetic verdict');
    expect(selected.status === 'quality_final_review').toBe(true);
    expect(finalize).toHaveBeenCalledTimes(1);
  });

  it('does not fabricate advancement or success when the mutation rejects', async () => {
    const initial = report('submitted');
    const mutate = vi.fn().mockRejectedValue(new Error('Synthetic governed failure'));
    let selected = initial;
    let success = false;
    let errorMessage = '';
    const patches = new Map<string, OvrAuthoritativeStatePatch>();

    try {
      const transition = await mutate();
      selected = reconcileOvrAuthoritativeState(selected, transition);
      success = true;
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Unknown failure';
    }

    expect(selected).toBe(initial);
    expect(selected.status).toBe('submitted');
    expect(success).toBe(false);
    expect(errorMessage).toBe('Synthetic governed failure');
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(patches.size).toBe(0);
    expect(applyOvrAuthoritativePatches([initial], patches)[0]?.status).toBe('submitted');
  });

  it('consumes every mutation result before reconciliation and preserves open-modal form/message state', () => {
    const workflow = section('const runWorkflowAction', 'const createLinkedProject');
    const linkedProject = section('const submitLinkedProject', 'const finalizeCorrectiveClosure');
    const finalizer = section('const finalizeCorrectiveClosure', 'const isManagerFor');
    const reconciliation = section('const synchronizeOpenOvr', 'const openReport');

    expect(workflow).toContain('const transition = await updateOvrWorkflow');
    expect(workflow).not.toMatch(/^\s*await updateOvrWorkflow\(/m);
    expect(workflow.indexOf('recordAuthoritativeOvrPatch(transition)')).toBeLessThan(workflow.indexOf('reconcileOvrAfterMutation(transition)'));
    expect(workflow).not.toContain('openReport(');
    expect(workflow).not.toContain('setWorkflowForm(');
    expect(workflow).toContain("setWorkflowMessage(t('ovr.workflowUpdated'))");

    expect(linkedProject).toContain('const projectId = await createOvrCorrectiveActionProject');
    expect(linkedProject).toContain("linked_project_id: projectId");
    expect(linkedProject).toContain("status: 'corrective_action_in_progress'");
    expect(linkedProject).toContain('recordAuthoritativeOvrPatch(transition)');
    expect(linkedProject).not.toContain('openReport(');

    expect(finalizer).toContain('const transition = await finalizeCorrectiveOvr');
    expect(finalizer).toContain('recordAuthoritativeOvrPatch(transition)');
    expect(finalizer).not.toContain('openReport(');

    expect(reconciliation).toContain('setSelectedReport(current =>');
    expect(reconciliation).toContain('setSelectedDashboardReport(current =>');
    expect(ovrSource).toContain('const effectiveReports = useMemo(');
    expect(ovrSource).toContain('return effectiveReports.filter(row =>');
    expect(ovrSource).toContain('setAuthoritativeOvrPatches(current => retireConvergedOvrPatches(current, reports.data || []))');
    expect(ovrSource).toContain('scheduleConvergenceRefresh(mutation.id)');
    expect(reconciliation).not.toContain('setWorkflowMessage(');
    expect(reconciliation).not.toContain('setWorkflowForm(');
  });

  it('keeps the existing Arabic workflow labels and responsive workspace modal contract', () => {
    const i18n = source('src/i18n/I18nContext.tsx');
    const modal = source('src/components/Modal.tsx');
    const styles = source('src/styles.css');

    expect(i18n).toContain("'ovr.completeManagerReview': { en: 'Complete manager review', ar: 'إكمال مراجعة المدير' }");
    expect(ovrSource).toContain('<Modal size="workspace"');
    expect(modal).toContain("size?: 'small' | 'medium' | 'large' | 'xl' | 'workspace'");
    expect(styles).toMatch(/@media\s*\(max-width:\s*720px\)[\s\S]*?\.modal-card--workspace\s*\{[^}]*width:\s*100%/);
  });
});
