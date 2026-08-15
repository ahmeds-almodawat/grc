import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  applyOvrAuthoritativePatches,
  canCompleteManagerReview,
  classifyFetchedOvrAgainstPatch,
  createOvrAuthoritativePatchRecord,
  nextStageHint,
  reconcileOvrAuthoritativeRecord,
  retireResolvedOvrPatches,
  type OvrAuthoritativePatchRecord,
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
    const record = createOvrAuthoritativePatchRecord(initial, transition);
    let selected = reconcileOvrAuthoritativeRecord(initial, record);
    const renderedStatuses = [selected.status];
    selected = reconcileOvrAuthoritativeRecord(selected, record, stale);
    renderedStatuses.push(selected.status);
    selected = reconcileOvrAuthoritativeRecord(selected, record, fresh);
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
    const record = createOvrAuthoritativePatchRecord(initial, transition);
    let patches: ReadonlyMap<string, OvrAuthoritativePatchRecord> = new Map([[initial.id, record]]);

    expect(applyOvrAuthoritativePatches([staleOne], patches)[0]?.status).toBe('manager_review');
    patches = retireResolvedOvrPatches(patches, [staleOne]);
    expect(patches.has(initial.id)).toBe(true);

    expect(applyOvrAuthoritativePatches([staleTwo], patches)[0]?.status).toBe('manager_review');
    patches = retireResolvedOvrPatches(patches, [staleTwo]);
    expect(patches.has(initial.id)).toBe(true);

    patches = retireResolvedOvrPatches(patches, [fresh]);
    expect(patches.has(initial.id)).toBe(false);
    expect(applyOvrAuthoritativePatches([fresh], patches)[0]?.status).toBe('manager_review');
    expect(applyOvrAuthoritativePatches([report('quality_validation')], patches)[0]?.status).toBe('quality_validation');
  });

  it('retires the obsolete local patch when the server legitimately advances beyond it', () => {
    const initial = report('submitted');
    const transition: OvrAuthoritativeStatePatch = { id: initial.id, status: 'manager_review' };
    const stale = report('submitted');
    const laterServer = report('quality_validation', { quality_validated_at: '2026-08-15T13:00:00.000Z' });
    const record = createOvrAuthoritativePatchRecord(initial, transition);
    let patches: ReadonlyMap<string, OvrAuthoritativePatchRecord> = new Map([[initial.id, record]]);

    expect(classifyFetchedOvrAgainstPatch(stale, record)).toBe('stale_baseline');
    expect(applyOvrAuthoritativePatches([stale], patches)[0]?.status).toBe('manager_review');
    expect(reconcileOvrAuthoritativeRecord(initial, record, stale).status).toBe('manager_review');

    expect(classifyFetchedOvrAgainstPatch(laterServer, record)).toBe('server_moved_beyond_patch');
    const selected = reconcileOvrAuthoritativeRecord(report('manager_review'), record, laterServer);
    expect(selected.status).toBe('quality_validation');
    patches = retireResolvedOvrPatches(patches, [laterServer]);
    expect(patches.has(initial.id)).toBe(false);
    expect(applyOvrAuthoritativePatches([laterServer], patches)[0]?.status).toBe('quality_validation');
    expect(canCompleteManagerReview(selected.status)).toBe(false);
  });

  it('uses mutation-relevant baseline fields for same-status server advancement', () => {
    const initial = report('quality_final_review', { final_verdict: 'OLD' });
    const transition: OvrAuthoritativeStatePatch = {
      id: initial.id,
      status: 'quality_final_review',
      final_verdict: 'LOCAL-NEW',
    };
    const stale = report('quality_final_review', { final_verdict: 'OLD' });
    const laterServer = report('quality_final_review', { final_verdict: 'SERVER-NEWER' });
    const record = createOvrAuthoritativePatchRecord(initial, transition);
    let patches: ReadonlyMap<string, OvrAuthoritativePatchRecord> = new Map([[initial.id, record]]);

    expect(classifyFetchedOvrAgainstPatch(stale, record)).toBe('stale_baseline');
    expect(applyOvrAuthoritativePatches([stale], patches)[0]?.final_verdict).toBe('LOCAL-NEW');
    expect(classifyFetchedOvrAgainstPatch(laterServer, record)).toBe('server_moved_beyond_patch');
    expect(reconcileOvrAuthoritativeRecord(report('quality_final_review', { final_verdict: 'LOCAL-NEW' }), record, laterServer).final_verdict).toBe('SERVER-NEWER');
    patches = retireResolvedOvrPatches(patches, [laterServer]);
    expect(patches.has(initial.id)).toBe(false);
    expect(applyOvrAuthoritativePatches([laterServer], patches)[0]?.final_verdict).toBe('SERVER-NEWER');
  });

  it('protects a quality-validation transition from a stale manager-review read', () => {
    const initial = report('manager_review', { quality_validated_at: null });
    const transition: OvrAuthoritativeStatePatch = {
      id: initial.id,
      status: 'quality_validation',
      quality_validated_at: '2026-08-15T12:30:00.000Z',
    };
    const stale = report('manager_review', { quality_validated_at: null });

    const record = createOvrAuthoritativePatchRecord(initial, transition);
    const selected = reconcileOvrAuthoritativeRecord(initial, record, stale);

    expect(selected.status).toBe('quality_validation');
    expect(selected.quality_validated_at).toBe('2026-08-15T12:30:00.000Z');
    expect(nextStageHint(selected.status)).toBe(3);

    const patches = new Map([[initial.id, record]]);
    const renderedList = applyOvrAuthoritativePatches([stale], patches);
    expect(renderedList[0]?.status).toBe('quality_validation');
    expect(retireResolvedOvrPatches(patches, [stale]).has(initial.id)).toBe(true);
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
    const record = createOvrAuthoritativePatchRecord(initial, mutationResult);
    const selected = reconcileOvrAuthoritativeRecord(initial, record, stale);

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
    const patches = new Map<string, OvrAuthoritativePatchRecord>();

    try {
      const transition = await mutate();
      selected = reconcileOvrAuthoritativeRecord(selected, createOvrAuthoritativePatchRecord(selected, transition));
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
    expect(workflow.indexOf('recordAuthoritativeOvrPatch(selectedReport, transition)')).toBeLessThan(workflow.indexOf('reconcileOvrAfterMutation(authoritativeRecord)'));
    expect(workflow).not.toContain('openReport(');
    expect(workflow).not.toContain('setWorkflowForm(');
    expect(workflow).toContain("setWorkflowMessage(t('ovr.workflowUpdated'))");

    expect(linkedProject).toContain('const projectId = await createOvrCorrectiveActionProject');
    expect(linkedProject).toContain("linked_project_id: projectId");
    expect(linkedProject).toContain("status: 'corrective_action_in_progress'");
    expect(linkedProject).toContain('recordAuthoritativeOvrPatch(correctiveProjectReport, transition)');
    expect(linkedProject).not.toContain('openReport(');

    expect(finalizer).toContain('const transition = await finalizeCorrectiveOvr');
    expect(finalizer).toContain('recordAuthoritativeOvrPatch(selectedReport, transition)');
    expect(finalizer).not.toContain('openReport(');

    expect(reconciliation).toContain('setSelectedReport(current =>');
    expect(reconciliation).toContain('setSelectedDashboardReport(current =>');
    expect(ovrSource).toContain('const effectiveReports = useMemo(');
    expect(ovrSource).toContain('return effectiveReports.filter(row =>');
    expect(ovrSource).toContain('setAuthoritativeOvrPatches(current => retireResolvedOvrPatches(current, reports.data || []))');
    expect(ovrSource).toContain('scheduleConvergenceRefresh(record.mutation.id)');
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
