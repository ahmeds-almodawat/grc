import { useState, type ReactNode } from 'react';
import { ArrowLeft, ClipboardCheck, ExternalLink, FileCheck2, ShieldAlert } from 'lucide-react';
import { DataState } from '../components/DataState';
import { ModernCard, StatusPill } from '../components/ModernCard';
import { useAsyncData } from '../hooks/useAsyncData';
import type { PageKey } from '../components/Layout';
import {
  getEvidenceClosureHandoff,
  getEvidenceOwnershipDueDateReadiness,
  getDepartmentEvidenceCoverage,
  getDepartmentLaunchFinalReadinessWorkflow,
  getExecutiveClosureRecommendation,
  getExecutiveGoNoGoDecisionPack,
  getLiveDataQualityRoleIntegrityReadiness,
  getLiveSupportIncidentReadiness,
  getUatPackHospitalPilotAcceptanceReadiness,
  getAccessReviewSecurityEvidenceReadiness,
  getBackupRestoreDrEvidenceReadiness,
  getPolicySopAttestationReadiness,
  getTrainingAdoptionSupportEvidenceReadiness,
  getProductionEvidenceClosureData,
  getReviewerDecisionReadiness,
  getAvailableControlledEvidenceClosureActions,
  getControlledEvidenceClosureActionAvailability,
  getControlledEvidenceClosureHistoryDisplay,
  recordControlledEvidenceClosureAction,
  validateControlledEvidenceClosureActionRequest,
  type ControlledEvidenceClosureActionResult,
  type ControlledEvidenceClosureActionType,
  type EvidenceClosureStatus,
  type ProductionEvidenceClosureItem,
} from '../lib/productionEvidenceClosureApi';

const evidenceMissing = 'Evidence has not been recorded.';
const reviewRequired = 'Review required.';
const ownerAction = 'Awaiting owner action.';
const noBlocker = 'No blocker currently recorded.';
const noAction = 'No closure action is available from this screen.';

function statusTone(status?: string) {
  const normalized = String(status ?? '').toLowerCase();
  if (['closed', 'ready', 'recorded', 'ready for executive review', 'ready for executive decision review', 'coverage complete in source data', 'monitor'].includes(normalized)) return 'good';
  if (['blocked', 'launch blocked', 'data blocked', 'uat blocked', 'support blocked', 'incident readiness blocked', 'overdue', 'rejected', 'no-go: blockers unresolved'].includes(normalized)) return 'danger';
  return 'warning';
}

function evidenceStateLabel(status: EvidenceClosureStatus) {
  return status.replaceAll('_', ' ');
}

function MetricTile({ label, value, tone = 'neutral' }: { label: string; value: string | number; tone?: 'good' | 'warning' | 'danger' | 'neutral' }) {
  return (
    <div className={`stat-card ${tone === 'good' ? 'success' : tone === 'danger' ? 'danger' : tone === 'warning' ? 'warning' : ''}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function EmptyState({ message = evidenceMissing }: { message?: string }) {
  return <div className="alert alert-info">{message}</div>;
}

function ActionButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button className="secondary-action" type="button" onClick={onClick}>
      {children}
    </button>
  );
}

function itemSortScore(item: ProductionEvidenceClosureItem) {
  const order: Record<EvidenceClosureStatus, number> = {
    blocked: 0,
    overdue: 1,
    evidence_required: 2,
    open: 3,
    under_review: 4,
    accepted_with_limitation: 5,
    closed: 6,
  };
  return order[item.evidenceState] ?? 99;
}

export function ProductionEvidenceClosureCenter({ setPage }: { setPage?: (page: PageKey) => void }) {
  const closure = useAsyncData(getProductionEvidenceClosureData);
  const data = closure.data;
  const [selectedAction, setSelectedAction] = useState<ControlledEvidenceClosureActionType>('add_note');
  const [actionReason, setActionReason] = useState('');
  const [actionNote, setActionNote] = useState('');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [actionError, setActionError] = useState('');
  const [recentActions, setRecentActions] = useState<ControlledEvidenceClosureActionResult[]>([]);
  const items = [...(data?.intakeQueue ?? [])].sort((a, b) => itemSortScore(a) - itemSortScore(b));
  const selectedItem = items[0];
  const selectedHandoff = getEvidenceClosureHandoff(selectedItem);
  const reviewerReadiness = getReviewerDecisionReadiness(selectedItem);
  const ownershipReadiness = getEvidenceOwnershipDueDateReadiness(selectedItem);
  const ownershipStates = items.map(getEvidenceOwnershipDueDateReadiness);
  const ownerMissingCount = ownershipStates.filter(item => item.ownerState === 'Owner missing').length;
  const reviewerMissingCount = ownershipStates.filter(item => item.reviewerState === 'Reviewer missing').length;
  const dueDateMissingCount = ownershipStates.filter(item => item.dueDateState === 'Due date missing').length;
  const escalationReadyCount = ownershipStates.filter(item => item.escalationReadinessState === 'Escalation may be required.').length;
  const executiveRecommendation = getExecutiveClosureRecommendation(data ?? undefined, { ownerMissingCount, reviewerMissingCount });
  const departmentLaunchWorkflow = getDepartmentLaunchFinalReadinessWorkflow(data ?? undefined, recentActions);
  const liveDataQualityRoleIntegrity = getLiveDataQualityRoleIntegrityReadiness(data ?? undefined, recentActions);
  const uatPilotAcceptance = getUatPackHospitalPilotAcceptanceReadiness(data ?? undefined, recentActions);
  const liveSupportIncidentReadiness = getLiveSupportIncidentReadiness(data ?? undefined, recentActions);
  const policySopReadiness = getPolicySopAttestationReadiness(selectedItem, data ?? undefined);
  const executivePolicySopImpact = getPolicySopAttestationReadiness(undefined, data ?? undefined).executiveImpact;
  const recoveryReadiness = getBackupRestoreDrEvidenceReadiness(selectedItem, data ?? undefined);
  const executiveRecoveryImpact = getBackupRestoreDrEvidenceReadiness(undefined, data ?? undefined).executiveImpact;
  const securityReadiness = getAccessReviewSecurityEvidenceReadiness(selectedItem, data ?? undefined);
  const executiveSecurityImpact = getAccessReviewSecurityEvidenceReadiness(undefined, data ?? undefined).executiveImpact;
  const adoptionReadiness = getTrainingAdoptionSupportEvidenceReadiness(selectedItem, data ?? undefined);
  const executiveAdoptionImpact = getTrainingAdoptionSupportEvidenceReadiness(undefined, data ?? undefined).executiveImpact;
  const availableActions = getAvailableControlledEvidenceClosureActions(selectedItem);
  const selectedActionAvailability = getControlledEvidenceClosureActionAvailability(selectedItem, selectedAction);
  const executiveGoNoGoDecisionPack = getExecutiveGoNoGoDecisionPack(data ?? undefined, { ownerMissingCount, reviewerMissingCount }, recentActions);

  async function submitControlledAction() {
    if (!selectedItem) return;
    const validationError = validateControlledEvidenceClosureActionRequest({
      evidenceId: selectedItem.id,
      actionType: selectedAction,
      actionReason,
      actionNote,
      previousState: selectedItem.evidenceState,
      hasBlocker: selectedItem.evidenceState === 'blocked' || selectedItem.blockerState !== noBlocker,
    }, selectedItem);
    if (validationError) {
      setActionError(validationError);
      return;
    }
    setActionError('');
    setIsSubmittingAction(true);
    try {
      const result = await recordControlledEvidenceClosureAction({
        evidenceId: selectedItem.id,
        actionType: selectedAction,
        actionReason,
        actionNote,
        previousState: selectedItem.evidenceState,
        hasBlocker: selectedItem.evidenceState === 'blocked' || selectedItem.blockerState !== noBlocker,
        metadata: {
          category: selectedItem.category,
          title: selectedItem.title,
          department_or_scope: selectedItem.departmentOrScope,
        },
      });
      setRecentActions(previous => [result, ...previous].slice(0, 5));
      setActionReason('');
      setActionNote('');
      await closure.refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Controlled evidence action could not be recorded.');
    } finally {
      setIsSubmittingAction(false);
    }
  }

  return (
    <section className="page-section production-readiness-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Production evidence operations</p>
          <h1>Production Evidence Closure</h1>
          <p className="subtitle">Capture and close live evidence required for hospital production readiness, recovery assurance, adoption, policy acknowledgement, support readiness, and executive decision-making.</p>
        </div>
        {setPage ? (
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <ActionButton onClick={() => setPage('productionOperatorConsole')}>
              <ArrowLeft size={16} />
              Back to operator console
            </ActionButton>
            <ActionButton onClick={() => setPage('productionReadiness')}>
              <ExternalLink size={16} />
              Manage in Production Readiness Center
            </ActionButton>
          </div>
        ) : null}
      </div>

      <DataState loading={closure.loading} error={closure.error} empty={!data}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <ModernCard title="Evidence Closure Overview" subtitle="Current closure position across live hospital readiness evidence.">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, minmax(0, 1fr))', gap: '12px' }}>
              <MetricTile label="Total evidence gaps" value={data?.overview.totalEvidenceGaps ?? 0} />
              <MetricTile label="Open gaps" value={data?.overview.openGaps ?? 0} tone="warning" />
              <MetricTile label="Under review" value={data?.overview.underReview ?? 0} tone="warning" />
              <MetricTile label="Accepted with limitation" value={data?.overview.acceptedWithLimitation ?? 0} tone="warning" />
              <MetricTile label="Closed" value={data?.overview.closed ?? 0} tone="good" />
              <MetricTile label="Overdue" value={data?.overview.overdue ?? 0} tone="danger" />
              <MetricTile label="Blocked" value={data?.overview.blocked ?? 0} tone="danger" />
              <MetricTile label="Evidence required" value={data?.overview.evidenceRequired ?? 0} tone="warning" />
            </div>
            <div className="alert alert-info" style={{ marginTop: '14px' }}>
              <strong>Next required action: </strong>{data?.overview.nextRequiredAction ?? reviewRequired}<br />
              <strong>Owner: </strong>{data?.overview.owner ?? ownerAction}<br />
              <strong>Owner not assigned: </strong>{ownerMissingCount}<br />
              <strong>Reviewer not assigned: </strong>{reviewerMissingCount}<br />
              <strong>Due date not recorded: </strong>{dueDateMissingCount}<br />
              <strong>Escalation may be required: </strong>{escalationReadyCount}
            </div>
          </ModernCard>

          <ModernCard title="Evidence Intake Queue" subtitle="Live evidence items grouped by category and prioritized by closure risk.">
            {items.length ? (
              <div className="table-wrap">
                <table className="entity-table">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Title / summary</th>
                      <th>Department or scope</th>
                      <th>Owner</th>
                      <th>Due date</th>
                      <th>Due date state</th>
                      <th>Evidence state</th>
                      <th>Training/adoption/support evidence</th>
                      <th>Backup and restore evidence</th>
                      <th>Policy/SOP attestation evidence</th>
                      <th>Access review evidence</th>
                      <th>Owner state</th>
                      <th>Reviewer state</th>
                      <th>Blocker state</th>
                      <th>Escalation readiness</th>
                      <th>Next action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.slice(0, 40).map(item => {
                      const ownership = getEvidenceOwnershipDueDateReadiness(item);
                      const policySop = getPolicySopAttestationReadiness(item, data ?? undefined);
                      const recovery = getBackupRestoreDrEvidenceReadiness(item, data ?? undefined);
                      const security = getAccessReviewSecurityEvidenceReadiness(item, data ?? undefined);
                      const adoption = getTrainingAdoptionSupportEvidenceReadiness(item, data ?? undefined);
                      return (
                        <tr key={`${item.category}-${item.id}-${item.title}`}>
                          <td>{item.category}</td>
                          <td><strong>{item.title}</strong></td>
                          <td>{item.departmentOrScope}</td>
                          <td>{ownership.ownerDisplay}</td>
                          <td>{item.dueDate}</td>
                          <td>{ownership.dueDateState}</td>
                          <td><StatusPill tone={statusTone(item.evidenceState)}>{evidenceStateLabel(item.evidenceState)}</StatusPill></td>
                          <td>{adoption.readinessState}</td>
                          <td>{recovery.readinessState}</td>
                          <td>{policySop.readinessState}</td>
                          <td>{security.readinessState}</td>
                          <td>{ownership.ownerState}</td>
                          <td>{ownership.reviewerState}</td>
                          <td>{ownership.blockedStatus}</td>
                          <td>{ownership.escalationReadinessState}</td>
                          <td>{ownership.nextAccountableParty || item.nextAction}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : <EmptyState />}
          </ModernCard>

          <ModernCard title="Evidence Detail" subtitle="Action panel for the highest-priority evidence item.">
            {selectedItem ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '18px' }}>
                <div className="alert alert-info" style={{ margin: 0 }}>
                  <strong>Description: </strong>{selectedItem.description}<br />
                  <strong>Required evidence: </strong>{selectedItem.requiredEvidence}<br />
                  <strong>Current status: </strong>{evidenceStateLabel(selectedItem.evidenceState)}<br />
                  <strong>Owner: </strong>{selectedItem.owner}<br />
                  <strong>Reviewer: </strong>{selectedItem.reviewer}<br />
                  <strong>Due date: </strong>{selectedItem.dueDate}
                </div>
                <div className="alert alert-warning" style={{ margin: 0 }}>
                  <strong>Linked evidence references: </strong>{selectedItem.linkedEvidenceReferences.join(', ')}<br />
                  <strong>Comments / notes: </strong>{selectedItem.comments}<br />
                  <strong>Closure decision state: </strong>{selectedItem.closureDecisionState}<br />
                  <strong>Limitation / exception state: </strong>{selectedItem.limitationState}<br />
                  <strong>Available action: </strong>Controlled evidence action.
                </div>
              </div>
            ) : <EmptyState message={reviewRequired} />}
            <div className="alert alert-info" style={{ marginTop: '14px' }}>
              <strong>Recommended next action: </strong>{selectedHandoff.recommendedNextAction}<br />
              <strong>Safe management destination: </strong>{selectedHandoff.safeManagementDestination}<br />
              <strong>Closure availability: </strong>{selectedHandoff.directClosureAvailability}<br />
              <strong>Required evidence before closure: </strong>{selectedHandoff.requiredEvidenceBeforeClosure}<br />
              <strong>Reviewer decision: </strong>{selectedHandoff.reviewerDecisionNeeded}<br />
              <strong>Limitation / exception decision: </strong>{selectedHandoff.limitationDecisionNeeded}
            </div>
            <div className="alert alert-warning" style={{ marginTop: '14px' }}>
              <strong>Reviewer decision readiness: </strong>{reviewerReadiness.readiness}<br />
              <strong>Required reviewer action: </strong>{reviewerReadiness.requiredReviewerAction}<br />
              <strong>Closure blocker reason: </strong>{reviewerReadiness.closureBlockerReason}<br />
              <strong>Evidence needed before review: </strong>{reviewerReadiness.evidenceNeededBeforeReview}<br />
              <strong>Limitation / exception decision needed: </strong>{reviewerReadiness.limitationDecisionNeeded}<br />
              <strong>Safe source workflow destination: </strong>{reviewerReadiness.sourceWorkflowDestination}<br />
              <strong>Closure instruction: </strong>{reviewerReadiness.closureAvailability}
            </div>
            <div className="alert alert-info" style={{ marginTop: '14px' }}>
              <strong>Controlled evidence action: </strong>Evidence-level closure.<br />
              <strong>Safety caveat: </strong>Evidence closure does not approve production launch.<br />
              <strong>Limitation caveat: </strong>Executive review is still required for accepted limitations.
            </div>
            {selectedItem ? (
              <div style={{ marginTop: '14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="alert alert-warning" style={{ margin: 0 }}>
                  <strong>Action options</strong>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                    {availableActions.map(action => (
                      <button
                        key={action.actionType}
                        className={selectedAction === action.actionType ? 'primary-action' : 'secondary-action'}
                        type="button"
                        onClick={() => setSelectedAction(action.actionType)}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                  <div style={{ marginTop: '10px' }}>
                    <strong>Selected action: </strong>{selectedActionAvailability.label}<br />
                    <strong>Next state: </strong>{selectedActionAvailability.nextStateLabel}<br />
                    <strong>Reason required: </strong>{selectedActionAvailability.reasonRequired ? 'Reason required.' : 'Optional.'}<br />
                    <strong>Blocker warning: </strong>{selectedAction === 'close_as_verified' ? reviewerReadiness.closureBlockerReason : noBlocker}<br />
                    <strong>Action warning: </strong>{selectedActionAvailability.warning || noBlocker}
                  </div>
                </div>
                <div className="alert alert-info" style={{ margin: 0 }}>
                  <strong>Action history</strong>
                  {recentActions.length ? (
                    <ul style={{ margin: '10px 0 0 18px' }}>
                      {recentActions.map(action => (
                        <li key={action.id}>{getControlledEvidenceClosureHistoryDisplay(action)}</li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ margin: '10px 0 0 0' }}>Action history has not been recorded.</p>
                  )}
                </div>
                <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontWeight: 700 }}>
                    Reason
                    <textarea
                      value={actionReason}
                      onChange={(event) => setActionReason(event.target.value)}
                      placeholder={selectedActionAvailability.reasonRequired ? 'Reason required.' : 'Optional reason.'}
                      style={{ minHeight: '74px', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                      disabled={isSubmittingAction}
                    />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontWeight: 700 }}>
                    Note
                    <textarea
                      value={actionNote}
                      onChange={(event) => setActionNote(event.target.value)}
                      placeholder="Add operational note."
                      style={{ minHeight: '74px', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                      disabled={isSubmittingAction}
                    />
                  </label>
                </div>
                <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    className="primary-action"
                    type="button"
                    onClick={submitControlledAction}
                    disabled={isSubmittingAction || !selectedActionAvailability.available}
                  >
                    {isSubmittingAction ? 'Recording action...' : 'Record controlled evidence action'}
                  </button>
                  <span className="alert alert-info" style={{ margin: 0 }}>Evidence-level closure only.</span>
                  {actionError ? <span className="alert alert-danger" style={{ margin: 0 }}>{actionError}</span> : null}
                </div>
              </div>
            ) : null}
            <div className="alert alert-info" style={{ marginTop: '14px' }}>
              <strong>Owner state: </strong>{ownershipReadiness.ownerState}<br />
              <strong>Reviewer state: </strong>{ownershipReadiness.reviewerState}<br />
              <strong>Due date state: </strong>{ownershipReadiness.dueDateState}<br />
              <strong>Overdue status: </strong>{ownershipReadiness.overdueStatus}<br />
              <strong>Blocked status: </strong>{ownershipReadiness.blockedStatus}<br />
              <strong>Escalation readiness: </strong>{ownershipReadiness.escalationReadinessState}<br />
              <strong>Next accountable party: </strong>{ownershipReadiness.nextAccountableParty}<br />
              <strong>Missing assignment warnings: </strong>{ownershipReadiness.missingWarnings.length ? ownershipReadiness.missingWarnings.join(' ') : noBlocker}
            </div>
            <div className="alert alert-warning" style={{ marginTop: '14px' }}>
              <strong>Training evidence: </strong>{adoptionReadiness.readinessState}<br />
              <strong>Missing training/adoption/support evidence summary: </strong>{adoptionReadiness.missingAdoptionEvidenceSummary}<br />
              <strong>Owner/reviewer readiness: </strong>{adoptionReadiness.ownerReviewerReadiness}<br />
              <strong>Due date or overdue state: </strong>{adoptionReadiness.dueDateOrOverdueState}<br />
              <strong>Source workflow destination: </strong>{adoptionReadiness.sourceWorkflowDestination}<br />
              <strong>Executive impact: </strong>{adoptionReadiness.executiveImpact}<br />
              <strong>Adoption evidence rule: </strong>Training evidence required. Adoption evidence required. Support readiness evidence required.<br />
              <strong>Adoption caveat: </strong>{adoptionReadiness.caveat}
            </div>
            <div className="alert alert-warning" style={{ marginTop: '14px' }}>
              <strong>Backup and restore evidence: </strong>{recoveryReadiness.readinessState}<br />
              <strong>Missing recovery evidence summary: </strong>{recoveryReadiness.missingRecoveryEvidenceSummary}<br />
              <strong>Owner/reviewer readiness: </strong>{recoveryReadiness.ownerReviewerReadiness}<br />
              <strong>Due date or overdue state: </strong>{recoveryReadiness.dueDateOrOverdueState}<br />
              <strong>Source workflow destination: </strong>{recoveryReadiness.sourceWorkflowDestination}<br />
              <strong>Executive impact: </strong>{recoveryReadiness.executiveImpact}<br />
              <strong>Recovery evidence rule: </strong>Backup evidence required. Restore test evidence required. DR evidence required.<br />
              <strong>Recovery caveat: </strong>{recoveryReadiness.caveat}
            </div>
            <div className="alert alert-warning" style={{ marginTop: '14px' }}>
              <strong>Access review evidence: </strong>{securityReadiness.readinessState}<br />
              <strong>Missing security evidence summary: </strong>{securityReadiness.missingSecurityEvidenceSummary}<br />
              <strong>Owner/reviewer readiness: </strong>{securityReadiness.ownerReviewerReadiness}<br />
              <strong>Due date or overdue state: </strong>{securityReadiness.dueDateOrOverdueState}<br />
              <strong>Source workflow destination: </strong>{securityReadiness.sourceWorkflowDestination}<br />
              <strong>Executive impact: </strong>{securityReadiness.executiveImpact}<br />
              <strong>Security evidence rule: </strong>Access review evidence required. Security review evidence required.<br />
              <strong>Security caveat: </strong>{securityReadiness.caveat}
            </div>
            <div className="alert alert-warning" style={{ marginTop: '14px' }}>
              <strong>Policy/SOP attestation evidence: </strong>{policySopReadiness.readinessState}<br />
              <strong>Missing attestation evidence summary: </strong>{policySopReadiness.missingAttestationEvidenceSummary}<br />
              <strong>Owner/reviewer readiness: </strong>{policySopReadiness.ownerReviewerReadiness}<br />
              <strong>Due date or overdue state: </strong>{policySopReadiness.dueDateOrOverdueState}<br />
              <strong>Source workflow destination: </strong>{policySopReadiness.sourceWorkflowDestination}<br />
              <strong>Executive impact: </strong>{policySopReadiness.executiveImpact}<br />
              <strong>Missing evidence rule: </strong>Attestation evidence required when source evidence is not recorded.<br />
              <strong>Attestation caveat: </strong>{policySopReadiness.caveat}
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '14px', flexWrap: 'wrap' }}>
              {setPage ? (
                <ActionButton onClick={() => setPage(selectedHandoff.destinationPage)}>
                  <ClipboardCheck size={16} />
                  Manage this evidence in Production Readiness Center
                </ActionButton>
              ) : null}
              <span className="alert alert-info" style={{ margin: 0 }}>{noAction}</span>
            </div>
          </ModernCard>

          <ModernCard title="Department Evidence Register" subtitle="Department evidence coverage, missing categories, source readiness, and priority follow-up.">
            {(data?.departmentRegister ?? []).length ? (
              <div className="table-wrap">
                <table className="entity-table">
                  <thead>
                    <tr>
                      <th>Department</th>
                      <th>Coverage state</th>
                      <th>Missing evidence categories</th>
                      <th>Launch readiness</th>
                      <th>Training evidence</th>
                      <th>Training/adoption/support readiness</th>
                      <th>Policy/SOP evidence</th>
                      <th>Policy/SOP attestation evidence</th>
                      <th>Support evidence</th>
                      <th>Backup/restore/DR evidence</th>
                      <th>Access/security evidence</th>
                      <th>Adoption evidence</th>
                      <th>Owner</th>
                      <th>Owner/reviewer readiness</th>
                      <th>Due date / overdue</th>
                      <th>Blocker / escalation</th>
                      <th>Priority state</th>
                      <th>Next source workflow destination</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.departmentRegister ?? []).slice(0, 40).map(row => {
                      const coverage = getDepartmentEvidenceCoverage(row);
                      const policySop = getPolicySopAttestationReadiness(row, data ?? undefined);
                      const recovery = getBackupRestoreDrEvidenceReadiness(row, data ?? undefined);
                      const security = getAccessReviewSecurityEvidenceReadiness(row, data ?? undefined);
                      const adoption = getTrainingAdoptionSupportEvidenceReadiness(row, data ?? undefined);
                      return (
                        <tr key={row.department}>
                          <td><strong>{row.department}</strong></td>
                          <td><StatusPill tone={statusTone(coverage.coverageState)}>{coverage.coverageState}</StatusPill></td>
                          <td>{coverage.missingEvidenceCategories.join(', ')}</td>
                          <td><StatusPill tone={statusTone(row.launchReadiness)}>{row.launchReadiness}</StatusPill></td>
                          <td>{row.trainingEvidence}</td>
                          <td>{adoption.readinessState}<br />{adoption.missingAdoptionEvidenceSummary}</td>
                          <td>{row.policyEvidence}</td>
                          <td>{policySop.readinessState}<br />{policySop.missingAttestationEvidenceSummary}</td>
                          <td>{row.supportEvidence}</td>
                          <td>{recovery.readinessState}<br />{recovery.missingRecoveryEvidenceSummary}</td>
                          <td>{security.readinessState}<br />{security.missingSecurityEvidenceSummary}</td>
                          <td>{row.adoptionEvidence}</td>
                          <td>{row.owner}</td>
                          <td>{coverage.ownerReviewerReadinessSummary}</td>
                          <td>{coverage.dueDateOverdueSummary}</td>
                          <td>{coverage.blockerEscalationSummary}</td>
                          <td>{coverage.priorityState}</td>
                          <td>{coverage.nextSourceWorkflowDestination}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="alert alert-info" style={{ marginTop: '14px' }}>
                  <strong>Department evidence coverage: </strong>Coverage depends on recorded source evidence. Manage source evidence in Production Readiness Center.
                  <br /><strong>Training evidence: </strong>Operational adoption readiness depends on recorded source evidence. Manage adoption evidence in Production Readiness Center.
                  <br /><strong>Backup and restore evidence: </strong>Recovery readiness depends on recorded source evidence. Manage recovery evidence in Production Readiness Center.
                  <br /><strong>Policy/SOP attestation evidence: </strong>Attestation readiness depends on recorded source evidence. Manage attestation evidence in Production Readiness Center.
                  <br /><strong>Access review evidence: </strong>Security readiness depends on recorded source evidence. Manage security evidence in Production Readiness Center.
                </div>
              </div>
            ) : <EmptyState />}
          </ModernCard>

          <ModernCard title="Department Launch Final Readiness" subtitle="Department-level readiness before executive decision review.">
            <div className="alert alert-warning" style={{ marginBottom: '14px' }}>
              <strong>Department launch final readiness. </strong>
              Department readiness does not approve production launch. Production launch requires separate executive authority.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '12px', marginBottom: '14px' }}>
              <MetricTile label="Departments" value={departmentLaunchWorkflow.totalDepartments} />
              <MetricTile label="Launch blocked" value={departmentLaunchWorkflow.blockedCount} tone={departmentLaunchWorkflow.blockedCount ? 'danger' : 'good'} />
              <MetricTile label="Evidence required" value={departmentLaunchWorkflow.evidenceRequiredCount} tone={departmentLaunchWorkflow.evidenceRequiredCount ? 'warning' : 'good'} />
              <MetricTile label="Review required" value={departmentLaunchWorkflow.reviewRequiredCount} tone={departmentLaunchWorkflow.reviewRequiredCount ? 'warning' : 'good'} />
              <MetricTile label="Limitation review" value={departmentLaunchWorkflow.limitationReviewRequiredCount} tone={departmentLaunchWorkflow.limitationReviewRequiredCount ? 'warning' : 'good'} />
            </div>
            {departmentLaunchWorkflow.rows.length ? (
              <div className="table-wrap">
                <table className="entity-table">
                  <thead>
                    <tr>
                      <th>Department / scope</th>
                      <th>Launch readiness state</th>
                      <th>Blocker summary</th>
                      <th>Missing evidence summary</th>
                      <th>Controlled closure action summary</th>
                      <th>Training/adoption/support summary</th>
                      <th>Policy/SOP attestation summary</th>
                      <th>Backup/restore/DR summary</th>
                      <th>Access/security summary</th>
                      <th>Required actions before executive decision</th>
                    </tr>
                  </thead>
                  <tbody>
                    {departmentLaunchWorkflow.rows.slice(0, 40).map(row => (
                      <tr key={row.departmentOrScope}>
                        <td><strong>{row.departmentOrScope}</strong></td>
                        <td><StatusPill tone={statusTone(row.launchReadinessState)}>{row.launchReadinessState}</StatusPill></td>
                        <td>{row.blockerSummary}</td>
                        <td>{row.missingEvidenceSummary}</td>
                        <td>{row.controlledClosureActionSummary}</td>
                        <td>{row.trainingAdoptionSupportSummary}</td>
                        <td>{row.policySopAttestationSummary}</td>
                        <td>{row.backupRestoreDrSummary}</td>
                        <td>{row.accessSecuritySummary}</td>
                        <td>{row.requiredActionsBeforeExecutiveDecision.join(' ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="alert alert-info" style={{ marginTop: '14px' }}>
                  <strong>Decision states: </strong>Launch blocked. Evidence required. Review required. Limitation review required. Ready for executive decision review.
                  <br /><strong>Required actions before executive decision: </strong>Resolve blockers, complete missing evidence, review limitations, and finish source workflow review before an executive decision is prepared.
                  <br /><strong>Department readiness caveat: </strong>Department readiness does not approve production launch.
                  <br /><strong>Authority caveat: </strong>Production launch requires separate executive authority.
                </div>
              </div>
            ) : <EmptyState message="Evidence has not been recorded." />}
          </ModernCard>

          <ModernCard title="Live Data Quality and Role Integrity" subtitle="Read-only readiness review before UAT data review.">
            <div className="alert alert-warning" style={{ marginBottom: '14px' }}>
              <strong>Live data quality and role integrity. </strong>
              Data quality readiness does not approve production launch. Production launch requires separate executive authority.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '12px', marginBottom: '14px' }}>
              <MetricTile label="Data quality state" value={liveDataQualityRoleIntegrity.dataQualityState} tone={statusTone(liveDataQualityRoleIntegrity.dataQualityState)} />
              <MetricTile label="Role integrity state" value={liveDataQualityRoleIntegrity.roleIntegrityState} tone={statusTone(liveDataQualityRoleIntegrity.roleIntegrityState)} />
              <MetricTile label="Data findings" value={liveDataQualityRoleIntegrity.dataQualityFindings.length} tone={liveDataQualityRoleIntegrity.dataQualityState === 'Ready for UAT data review' ? 'good' : 'warning'} />
              <MetricTile label="Role findings" value={liveDataQualityRoleIntegrity.roleIntegrityFindings.length} tone={liveDataQualityRoleIntegrity.roleIntegrityState === 'Ready for UAT data review' ? 'good' : 'warning'} />
              <MetricTile label="Required actions before UAT" value={liveDataQualityRoleIntegrity.requiredActionsBeforeUat.length} tone="warning" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="alert alert-info" style={{ margin: 0 }}>
                <strong>Data blocked: </strong>{liveDataQualityRoleIntegrity.dataQualityState === 'Data blocked' ? 'Data blocked.' : noBlocker}<br />
                <strong>Data review required: </strong>{liveDataQualityRoleIntegrity.dataQualityState === 'Data review required' ? 'Data review required.' : noBlocker}<br />
                <strong>Evidence state summary: </strong>{liveDataQualityRoleIntegrity.evidenceStateSummary}<br />
                <strong>Required actions before UAT: </strong>{liveDataQualityRoleIntegrity.requiredActionsBeforeUat.join(' ')}
              </div>
              <div className="alert alert-warning" style={{ margin: 0 }}>
                <strong>Role review required: </strong>{liveDataQualityRoleIntegrity.roleIntegrityState === 'Role review required' ? 'Role review required.' : noBlocker}<br />
                <strong>Accountability review required: </strong>{liveDataQualityRoleIntegrity.roleIntegrityState === 'Accountability review required' ? 'Accountability review required.' : noBlocker}<br />
                <strong>Inactive or archived users require reassignment: </strong>{liveDataQualityRoleIntegrity.inactiveArchivedOwnerReviewerWarnings.join(' ')}<br />
                <strong>Missing owner or reviewer requires assignment: </strong>{liveDataQualityRoleIntegrity.missingOwnerReviewerSummary}
              </div>
            </div>
            <div className="alert alert-info" style={{ marginTop: '14px' }}>
              <strong>Department accountability gaps: </strong>{liveDataQualityRoleIntegrity.departmentAccountabilityGaps}<br />
              <strong>Role/access review required actions: </strong>{liveDataQualityRoleIntegrity.roleAccessReviewRequiredActions.join(' ')}<br />
              <strong>UAT readiness state: </strong>Ready for UAT data review means data and role signals are ready for review, not production launch.<br />
              <strong>Data quality caveat: </strong>{liveDataQualityRoleIntegrity.caveat}<br />
              <strong>Authority caveat: </strong>{liveDataQualityRoleIntegrity.productionLaunchAuthorityCaveat}
            </div>
          </ModernCard>

          <ModernCard title="UAT Pack and Hospital Pilot Acceptance" subtitle="Read-only UAT pack and hospital pilot acceptance readiness before any production launch decision.">
            <div className="alert alert-warning" style={{ marginBottom: '14px' }}>
              <strong>UAT pack and hospital pilot acceptance. </strong>
              UAT acceptance does not approve production launch. Production launch requires separate executive authority.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '12px', marginBottom: '14px' }}>
              <MetricTile label="UAT readiness state" value={uatPilotAcceptance.uatReadinessState} tone={statusTone(uatPilotAcceptance.uatReadinessState)} />
              <MetricTile label="Pilot acceptance state" value={uatPilotAcceptance.pilotAcceptanceState} tone={statusTone(uatPilotAcceptance.pilotAcceptanceState)} />
              <MetricTile label="Accepted limitations" value={data?.executivePack.acceptedLimitationsRequiringReview ?? 0} tone={(data?.executivePack.acceptedLimitationsRequiringReview ?? 0) ? 'warning' : 'good'} />
              <MetricTile label="Required actions before pilot acceptance" value={uatPilotAcceptance.requiredActionsBeforePilotAcceptance.length} tone="warning" />
              <MetricTile label="Review state" value={uatPilotAcceptance.pilotAcceptanceState === 'Ready for pilot acceptance review' ? 'Ready for pilot acceptance review' : 'Pilot acceptance review required'} tone={statusTone(uatPilotAcceptance.pilotAcceptanceState)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="alert alert-info" style={{ margin: 0 }}>
                <strong>UAT blocked: </strong>{uatPilotAcceptance.uatReadinessState === 'UAT blocked' ? 'UAT blocked.' : noBlocker}<br />
                <strong>UAT evidence required: </strong>{uatPilotAcceptance.uatReadinessState === 'UAT evidence required' ? 'UAT evidence required.' : noBlocker}<br />
                <strong>UAT blocker summary: </strong>{uatPilotAcceptance.uatBlockerSummary}<br />
                <strong>UAT checklist summary: </strong>{uatPilotAcceptance.uatChecklistSummary}<br />
                <strong>User testing evidence required: </strong>{uatPilotAcceptance.userTestingEvidenceSummary}
              </div>
              <div className="alert alert-warning" style={{ margin: 0 }}>
                <strong>Pilot acceptance review required: </strong>{uatPilotAcceptance.pilotAcceptanceState === 'Pilot acceptance review required' ? 'Pilot acceptance review required.' : noBlocker}<br />
                <strong>Limitation review required: </strong>{uatPilotAcceptance.pilotAcceptanceState === 'Limitation review required' ? 'Limitation review required.' : noBlocker}<br />
                <strong>Department pilot acceptance required: </strong>{uatPilotAcceptance.departmentPilotAcceptanceSummary}<br />
                <strong>Pilot issue register summary: </strong>{uatPilotAcceptance.pilotIssueRegisterSummary}<br />
                <strong>Accepted limitations requiring review: </strong>{uatPilotAcceptance.acceptedLimitationsSummary}
              </div>
            </div>
            <div className="alert alert-info" style={{ marginTop: '14px' }}>
              <strong>Required actions before pilot acceptance: </strong>{uatPilotAcceptance.requiredActionsBeforePilotAcceptance.join(' ')}<br />
              <strong>UAT evidence readiness summary: </strong>{uatPilotAcceptance.uatEvidenceReadinessSummary}<br />
              <strong>Acceptance caveat: </strong>{uatPilotAcceptance.caveat}<br />
              <strong>Authority caveat: </strong>{uatPilotAcceptance.productionLaunchAuthorityCaveat}
            </div>
          </ModernCard>

          <ModernCard title="Live Support and Incident Readiness" subtitle="Read-only support desk, escalation, issue register, and downtime fallback readiness before launch decision review.">
            <div className="alert alert-warning" style={{ marginBottom: '14px' }}>
              <strong>Live support and incident readiness. </strong>
              Support readiness does not approve production launch. Production launch requires separate executive authority.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '12px', marginBottom: '14px' }}>
              <MetricTile label="Support readiness state" value={liveSupportIncidentReadiness.supportReadinessState} tone={statusTone(liveSupportIncidentReadiness.supportReadinessState)} />
              <MetricTile label="Incident readiness state" value={liveSupportIncidentReadiness.incidentReadinessState} tone={statusTone(liveSupportIncidentReadiness.incidentReadinessState)} />
              <MetricTile label="Support actions" value={liveSupportIncidentReadiness.supportReadinessRequiredActions.length} tone="warning" />
              <MetricTile label="Incident actions" value={liveSupportIncidentReadiness.incidentReadinessRequiredActions.length} tone="warning" />
              <MetricTile label="Accepted limitations" value={data?.executivePack.acceptedLimitationsRequiringReview ?? 0} tone={(data?.executivePack.acceptedLimitationsRequiringReview ?? 0) ? 'warning' : 'good'} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="alert alert-info" style={{ margin: 0 }}>
                <strong>Support blocked: </strong>{liveSupportIncidentReadiness.supportReadinessState === 'Support blocked' ? 'Support blocked.' : noBlocker}<br />
                <strong>Support evidence required: </strong>{liveSupportIncidentReadiness.supportReadinessState === 'Support evidence required' ? 'Support evidence required.' : noBlocker}<br />
                <strong>Support desk readiness required: </strong>{liveSupportIncidentReadiness.supportDeskReadinessSummary}<br />
                <strong>Downtime fallback readiness required: </strong>{liveSupportIncidentReadiness.downtimeFallbackSummary}<br />
                <strong>Required actions before support readiness review: </strong>{liveSupportIncidentReadiness.requiredActionsBeforeSupportReadinessReview.join(' ')}
              </div>
              <div className="alert alert-warning" style={{ margin: 0 }}>
                <strong>Incident readiness blocked: </strong>{liveSupportIncidentReadiness.incidentReadinessState === 'Incident readiness blocked' ? 'Incident readiness blocked.' : noBlocker}<br />
                <strong>Escalation review required: </strong>{liveSupportIncidentReadiness.incidentReadinessState === 'Escalation review required' ? 'Escalation review required.' : noBlocker}<br />
                <strong>Escalation owner review required: </strong>{liveSupportIncidentReadiness.escalationOwnerSummary}<br />
                <strong>Known issue register review required: </strong>{liveSupportIncidentReadiness.knownIssueRegisterSummary}<br />
                <strong>Incident intake/follow-up readiness: </strong>{liveSupportIncidentReadiness.incidentIntakeFollowUpSummary}
              </div>
            </div>
            <div className="alert alert-info" style={{ marginTop: '14px' }}>
              <strong>Accepted limitations requiring review: </strong>{liveSupportIncidentReadiness.acceptedLimitationsSummary}<br />
              <strong>Ready state: </strong>Ready for support readiness review means support and incident records are ready for review, not production launch.<br />
              <strong>Support caveat: </strong>{liveSupportIncidentReadiness.caveat}<br />
              <strong>Authority caveat: </strong>{liveSupportIncidentReadiness.productionLaunchAuthorityCaveat}
            </div>
          </ModernCard>

          <ModernCard title="Executive Closure Pack" subtitle="Final evidence closure view for executive review and decision readiness.">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: '12px' }}>
              <MetricTile label="Unresolved blockers" value={data?.executivePack.unresolvedBlockers ?? 0} tone={(data?.executivePack.unresolvedBlockers ?? 0) ? 'danger' : 'good'} />
              <MetricTile label="Limitations for review" value={data?.executivePack.acceptedLimitationsRequiringReview ?? 0} tone={(data?.executivePack.acceptedLimitationsRequiringReview ?? 0) ? 'warning' : 'good'} />
              <MetricTile label="Missing signoffs" value={data?.executivePack.missingSignoffs ?? 0} tone={(data?.executivePack.missingSignoffs ?? 0) ? 'danger' : 'good'} />
              <MetricTile label="DR/recovery evidence" value={data?.executivePack.recoveryEvidenceState ?? evidenceMissing} tone={statusTone(data?.executivePack.recoveryEvidenceState)} />
              <MetricTile label="Department readiness gaps" value={data?.executivePack.departmentReadinessGaps ?? 0} tone={(data?.executivePack.departmentReadinessGaps ?? 0) ? 'warning' : 'good'} />
              <MetricTile label="Final recommendation" value={data?.executivePack.finalRecommendationState ?? reviewRequired} tone={statusTone(data?.executivePack.finalRecommendationState)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '12px', marginTop: '14px' }}>
              <MetricTile label="Executive recommendation" value={executiveRecommendation.recommendationState} tone={statusTone(executiveRecommendation.recommendationState)} />
              <MetricTile label="Blocking issues" value={executiveRecommendation.blockingIssuesCount} tone={executiveRecommendation.blockingIssuesCount ? 'danger' : 'good'} />
              <MetricTile label="Evidence required" value={executiveRecommendation.evidenceRequiredCount} tone={executiveRecommendation.evidenceRequiredCount ? 'warning' : 'good'} />
              <MetricTile label="Review required" value={executiveRecommendation.reviewRequiredCount} tone={executiveRecommendation.reviewRequiredCount ? 'warning' : 'good'} />
              <MetricTile label="Overdue evidence" value={executiveRecommendation.overdueEvidenceCount} tone={executiveRecommendation.overdueEvidenceCount ? 'danger' : 'good'} />
              <MetricTile label="DR evidence impact" value={executiveRecoveryImpact} tone={executiveRecoveryImpact.includes('Executive review required') ? 'warning' : 'good'} />
              <MetricTile label="Policy/SOP impact" value={executivePolicySopImpact} tone={executivePolicySopImpact.includes('Executive review required') ? 'warning' : 'good'} />
              <MetricTile label="Security impact" value={executiveSecurityImpact} tone={executiveSecurityImpact.includes('Executive review required') ? 'warning' : 'good'} />
              <MetricTile label="Adoption impact" value={executiveAdoptionImpact} tone={executiveAdoptionImpact.includes('Executive review required') ? 'warning' : 'good'} />
            </div>
            <div className="alert alert-info" style={{ marginTop: '14px' }}>
              <ShieldAlert size={16} />
              <strong>Executive recommendation state: </strong>{executiveRecommendation.recommendationState}<br />
              <strong>Reason for recommendation: </strong>{executiveRecommendation.recommendationReason}<br />
              <strong>Missing owner/reviewer warning: </strong>{executiveRecommendation.missingAssignmentCount ? `${executiveRecommendation.missingAssignmentCount} assignment warnings require follow-up.` : noBlocker}<br />
              <strong>Required executive actions: </strong>{executiveRecommendation.requiredExecutiveActions.join(' ')}<br />
              <strong>Backup and restore evidence: </strong>{executiveRecoveryImpact}<br />
              <strong>Policy/SOP attestation evidence: </strong>{executivePolicySopImpact}<br />
              <strong>Access review evidence: </strong>{executiveSecurityImpact}<br />
              <strong>Training evidence: </strong>{executiveAdoptionImpact}<br />
              <strong>Decision caveat: </strong>{executiveRecommendation.caveat}
            </div>
            <div className="alert alert-warning" style={{ marginTop: '14px' }}>
              <strong>Executive go/no-go decision pack. </strong>{executiveGoNoGoDecisionPack.decisionPackState}<br />
              <strong>Decision states: </strong>No-go: blockers unresolved. Conditional go review. Review required. Ready for executive decision review.<br />
              <strong>Recommendation reason: </strong>{executiveGoNoGoDecisionPack.recommendationReason}<br />
              <strong>Unresolved blocker summary: </strong>{executiveGoNoGoDecisionPack.unresolvedBlockerSummary}<br />
              <strong>Accepted limitation summary: </strong>{executiveGoNoGoDecisionPack.acceptedLimitationSummary}<br />
              <strong>Controlled evidence action history: </strong>{executiveGoNoGoDecisionPack.controlledClosureActionSummary}<br />
              <strong>Verified evidence count: </strong>{executiveGoNoGoDecisionPack.evidenceClosureSummary.verifiedEvidenceCount}<br />
              <strong>Ready for review count: </strong>{executiveGoNoGoDecisionPack.evidenceClosureSummary.readyForReviewCount}<br />
              <strong>Request more evidence count: </strong>{executiveGoNoGoDecisionPack.evidenceClosureSummary.requiringMoreEvidenceCount}<br />
              <strong>Reopened evidence count: </strong>{executiveGoNoGoDecisionPack.evidenceClosureSummary.reopenedEvidenceCount}<br />
              <strong>Required executive review items: </strong>{executiveGoNoGoDecisionPack.requiredExecutiveReviewItems.join(' ')}<br />
              <strong>Required actions before executive decision: </strong>{executiveGoNoGoDecisionPack.requiredOperationalActionsBeforeDecision.join(' ')}<br />
              <strong>Decision pack caveat: </strong>Evidence-level closure does not approve production launch.<br />
              <strong>Authority caveat: </strong>Production launch requires separate executive authority.
            </div>
            <div className="alert alert-warning" style={{ marginTop: '14px' }}>
              <strong>Executive review caveat: </strong>Evidence-level closure actions do not approve production launch. Executive review remains separate and must follow the source governance process.
            </div>
          </ModernCard>

          <ModernCard title="Links" subtitle="Continue closure work in the existing readiness workspaces.">
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {setPage ? (
                <>
                  <ActionButton onClick={() => setPage('productionOperatorConsole')}>
                    <FileCheck2 size={16} />
                    Production Operator Console
                  </ActionButton>
                  <ActionButton onClick={() => setPage('productionReadiness')}>
                    <ExternalLink size={16} />
                    Production Readiness Center
                  </ActionButton>
                </>
              ) : null}
              <span className="alert alert-info" style={{ margin: 0 }}>{noBlocker}</span>
            </div>
          </ModernCard>
        </div>
      </DataState>
    </section>
  );
}
