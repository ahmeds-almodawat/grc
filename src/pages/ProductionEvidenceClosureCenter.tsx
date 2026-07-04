import type { ReactNode } from 'react';
import { ArrowLeft, ClipboardCheck, ExternalLink, FileCheck2, ShieldAlert } from 'lucide-react';
import { DataState } from '../components/DataState';
import { ModernCard, StatusPill } from '../components/ModernCard';
import { useAsyncData } from '../hooks/useAsyncData';
import type { PageKey } from '../components/Layout';
import {
  getProductionEvidenceClosureData,
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
  if (['closed', 'ready', 'recorded', 'ready for executive review'].includes(normalized)) return 'good';
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
              <strong>Owner: </strong>{data?.overview.owner ?? ownerAction}
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
                      <th>Evidence state</th>
                      <th>Reviewer state</th>
                      <th>Blocker state</th>
                      <th>Next action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.slice(0, 40).map(item => (
                      <tr key={`${item.category}-${item.id}-${item.title}`}>
                        <td>{item.category}</td>
                        <td><strong>{item.title}</strong></td>
                        <td>{item.departmentOrScope}</td>
                        <td>{item.owner}</td>
                        <td>{item.dueDate}</td>
                        <td><StatusPill tone={statusTone(item.evidenceState)}>{evidenceStateLabel(item.evidenceState)}</StatusPill></td>
                        <td>{item.reviewerState}</td>
                        <td>{item.blockerState}</td>
                        <td>{item.nextAction}</td>
                      </tr>
                    ))}
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
            <div style={{ display: 'flex', gap: '10px', marginTop: '14px', flexWrap: 'wrap' }}>
              {setPage ? (
                <ActionButton onClick={() => setPage('productionReadiness')}>
                  <ClipboardCheck size={16} />
                  Manage this evidence in Production Readiness Center
                </ActionButton>
              ) : null}
              <span className="alert alert-info" style={{ margin: 0 }}>{noAction}</span>
            </div>
          </ModernCard>

          <ModernCard title="Department Evidence Register" subtitle="Department launch evidence, adoption, support, and policy readiness.">
            {(data?.departmentRegister ?? []).length ? (
              <div className="table-wrap">
                <table className="entity-table">
                  <thead>
                    <tr>
                      <th>Department</th>
                      <th>Launch readiness</th>
                      <th>Missing evidence count</th>
                      <th>Training evidence</th>
                      <th>Policy/SOP evidence</th>
                      <th>Support evidence</th>
                      <th>Adoption evidence</th>
                      <th>Owner</th>
                      <th>Next action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.departmentRegister ?? []).slice(0, 40).map(row => (
                      <tr key={row.department}>
                        <td><strong>{row.department}</strong></td>
                        <td><StatusPill tone={statusTone(row.launchReadiness)}>{row.launchReadiness}</StatusPill></td>
                        <td>{row.missingEvidenceCount}</td>
                        <td>{row.trainingEvidence}</td>
                        <td>{row.policyEvidence}</td>
                        <td>{row.supportEvidence}</td>
                        <td>{row.adoptionEvidence}</td>
                        <td>{row.owner}</td>
                        <td>{row.nextAction}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
            <div className="alert alert-info" style={{ marginTop: '14px' }}>
              <ShieldAlert size={16} />
              {data?.executivePack.finalRecommendationState === 'Ready for executive review'
                ? 'Ready for executive review'
                : data?.executivePack.finalRecommendationState ?? reviewRequired}
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
