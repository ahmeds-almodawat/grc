import type { ReactNode } from 'react';
import { ArrowLeft, ClipboardCheck, ExternalLink, FileCheck2, ShieldAlert } from 'lucide-react';
import { DataState } from '../components/DataState';
import { ModernCard, StatusPill } from '../components/ModernCard';
import { useAsyncData } from '../hooks/useAsyncData';
import type { PageKey } from '../components/Layout';
import {
  getEvidenceClosureHandoff,
  getEvidenceOwnershipDueDateReadiness,
  getDepartmentEvidenceCoverage,
  getExecutiveClosureRecommendation,
  getProductionEvidenceClosureData,
  getReviewerDecisionReadiness,
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
  if (['closed', 'ready', 'recorded', 'ready for executive review', 'coverage complete in source data', 'monitor'].includes(normalized)) return 'good';
  if (['blocked', 'overdue', 'rejected'].includes(normalized)) return 'danger';
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
  const closure = useAsyncData(getProductionEvidenceClosureData, []);
  const data = closure.data;
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
                      return (
                        <tr key={`${item.category}-${item.id}-${item.title}`}>
                          <td>{item.category}</td>
                          <td><strong>{item.title}</strong></td>
                          <td>{item.departmentOrScope}</td>
                          <td>{ownership.ownerDisplay}</td>
                          <td>{item.dueDate}</td>
                          <td>{ownership.dueDateState}</td>
                          <td><StatusPill tone={statusTone(item.evidenceState)}>{evidenceStateLabel(item.evidenceState)}</StatusPill></td>
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
                  <strong>Available action: </strong>{noAction}
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
              <strong>Owner state: </strong>{ownershipReadiness.ownerState}<br />
              <strong>Reviewer state: </strong>{ownershipReadiness.reviewerState}<br />
              <strong>Due date state: </strong>{ownershipReadiness.dueDateState}<br />
              <strong>Overdue status: </strong>{ownershipReadiness.overdueStatus}<br />
              <strong>Blocked status: </strong>{ownershipReadiness.blockedStatus}<br />
              <strong>Escalation readiness: </strong>{ownershipReadiness.escalationReadinessState}<br />
              <strong>Next accountable party: </strong>{ownershipReadiness.nextAccountableParty}<br />
              <strong>Missing assignment warnings: </strong>{ownershipReadiness.missingWarnings.length ? ownershipReadiness.missingWarnings.join(' ') : noBlocker}
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
                      <th>Policy/SOP evidence</th>
                      <th>Support evidence</th>
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
                      return (
                        <tr key={row.department}>
                          <td><strong>{row.department}</strong></td>
                          <td><StatusPill tone={statusTone(coverage.coverageState)}>{coverage.coverageState}</StatusPill></td>
                          <td>{coverage.missingEvidenceCategories.join(', ')}</td>
                          <td><StatusPill tone={statusTone(row.launchReadiness)}>{row.launchReadiness}</StatusPill></td>
                          <td>{row.trainingEvidence}</td>
                          <td>{row.policyEvidence}</td>
                          <td>{row.supportEvidence}</td>
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
                </div>
              </div>
            ) : <EmptyState />}
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
            </div>
            <div className="alert alert-info" style={{ marginTop: '14px' }}>
              <ShieldAlert size={16} />
              <strong>Executive recommendation state: </strong>{executiveRecommendation.recommendationState}<br />
              <strong>Reason for recommendation: </strong>{executiveRecommendation.recommendationReason}<br />
              <strong>Missing owner/reviewer warning: </strong>{executiveRecommendation.missingAssignmentCount ? `${executiveRecommendation.missingAssignmentCount} assignment warnings require follow-up.` : noBlocker}<br />
              <strong>Required executive actions: </strong>{executiveRecommendation.requiredExecutiveActions.join(' ')}<br />
              <strong>Decision caveat: </strong>{executiveRecommendation.caveat}
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
