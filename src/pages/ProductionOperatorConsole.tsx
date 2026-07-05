import type { ReactNode } from 'react';
import { Activity, AlertTriangle, ArchiveRestore, Building2, ClipboardCheck, ExternalLink, FileCheck2, KeyRound, ShieldCheck, UserCheck } from 'lucide-react';
import { DataState } from '../components/DataState';
import { ModernCard, StatusPill } from '../components/ModernCard';
import { useAsyncData } from '../hooks/useAsyncData';
import type { PageKey } from '../components/Layout';
import { getProductionOperatorConsoleData, type OperatorStatus } from '../lib/productionOperatorConsoleApi';

const evidenceMissing = 'Evidence has not been recorded.';
const reviewRequired = 'Review required.';
const ownerAction = 'Awaiting owner action.';
const noBlocker = 'No blocker currently recorded.';

function statusTone(status: OperatorStatus) {
  if (status === 'Safe to operate') return 'good';
  if (status === 'Operate with limitations' || status === 'Action required' || status === 'Evidence required') return 'warning';
  return 'danger';
}

function itemTone(status?: string) {
  const normalized = String(status ?? '').toLowerCase();
  if (['ready', 'safe_to_operate', 'complete', 'completed', 'approved', 'accepted', 'attested', 'on_track', 'closed'].includes(normalized)) return 'good';
  if (['blocked', 'failed', 'critical', 'high', 'rejected', 'overdue'].includes(normalized)) return 'danger';
  return 'warning';
}

function numberValue(value: unknown) {
  return Number(value ?? 0) || 0;
}

function MetricTile({ label, value, tone = 'neutral' }: { label: string; value: string | number; tone?: 'good' | 'warning' | 'danger' | 'neutral' }) {
  return (
    <div className={`stat-card ${tone === 'good' ? 'success' : tone === 'danger' ? 'danger' : tone === 'warning' ? 'warning' : ''}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function EmptyState({ message = noBlocker }: { message?: string }) {
  return <div className="alert alert-info">{message}</div>;
}

function CompactList({ rows, render }: { rows: any[]; render: (row: any, index: number) => ReactNode }) {
  if (!rows.length) return <EmptyState />;
  return <div style={{ display: 'grid', gap: '10px' }}>{rows.slice(0, 8).map(render)}</div>;
}

export function ProductionOperatorConsole({ setPage }: { setPage?: (page: PageKey) => void }) {
  const consoleData = useAsyncData(getProductionOperatorConsoleData, []);
  const data = consoleData.data;
  const topStatus = data?.status ?? 'Evidence required';
  const hospital = data?.hospital ?? {};
  const hypercare = data?.hypercare ?? {};
  const access = data?.access ?? {};
  const closure = data?.closure ?? {};
  const realPilot = data?.realPilot ?? {};
  const livePilot = data?.livePilot ?? {};

  const criticalRows = [
    ...(data?.departmentBlockers ?? []),
    ...(data?.hypercareBlockers ?? []),
    ...(data?.closureBlockers ?? []),
    ...(data?.accessBlockers ?? []),
    ...(data?.realPilotBlockers ?? []),
    ...(data?.liveWorkflowBlockers ?? []),
  ];

  return (
    <section className="page-section production-readiness-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Production operations</p>
          <h1>Production Operator Console</h1>
          <p className="subtitle">Daily operating view for production readiness, hospital rollout, hypercare, access, recovery, and executive action.</p>
        </div>
        {setPage ? (
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button className="secondary-action" type="button" aria-label="Route evidence closure and reviewer readiness with ownership and due date readiness in Production Evidence Closure" onClick={() => setPage('productionEvidenceClosure')}>
              <FileCheck2 size={16} />
              Production Evidence Closure review readiness
            </button>
            <button className="secondary-action" type="button" onClick={() => setPage('productionReadiness')}>
              <ExternalLink size={16} />
              Open detailed readiness
            </button>
          </div>
        ) : null}
      </div>

      <DataState loading={consoleData.loading} error={consoleData.error} empty={!data}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <ModernCard title="Today’s Operating Status" subtitle="Single daily operating signal for safe production use.">
            <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 2fr', gap: '18px', alignItems: 'stretch' }}>
              <div className="stat-card">
                <div className="stat-value">
                  <StatusPill tone={statusTone(topStatus)}>{topStatus}</StatusPill>
                </div>
                <div className="stat-label">Current operating status</div>
              </div>
              <div className="alert alert-info" style={{ margin: 0 }}>
                <strong>Reason: </strong>{data?.reason ?? evidenceMissing}<br />
                <strong>Next required action: </strong>{data?.nextRequiredAction ?? reviewRequired}<br />
                <strong>Owner: </strong>{data?.owner ?? ownerAction}<br />
                <strong>Evidence state: </strong>{data?.evidenceState ?? evidenceMissing}
              </div>
            </div>
          </ModernCard>

          <ModernCard title="Critical Blockers" subtitle="Items that can block production use or continued safe operation.">
            <CompactList
              rows={criticalRows}
              render={(row, index) => (
                <div className="alert alert-warning" key={`${row.blocker_type ?? row.blocker_area ?? 'blocker'}-${index}`} style={{ margin: 0 }}>
                  <strong>{row.department_name || row.blocker_area || row.blocker_type || 'Operational blocker'}: </strong>
                  {row.blocker_reason || row.blocker_summary || row.action_required || reviewRequired}
                </div>
              )}
            />
          </ModernCard>

          <ModernCard title="Department Rollout Readiness" subtitle="Department launch packs, owners, checklists, adoption, training, and attestation gaps.">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: '12px' }}>
              <MetricTile label="Launch packs" value={numberValue(hospital.total_department_launch_packs)} />
              <MetricTile label="Ready" value={numberValue(hospital.ready_departments)} tone="good" />
              <MetricTile label="Limited" value={numberValue(hospital.ready_with_limitations_departments)} tone="warning" />
              <MetricTile label="Blocked" value={numberValue(hospital.blocked_departments)} tone="danger" />
              <MetricTile label="Evidence required" value={numberValue(hospital.evidence_required_departments)} tone="warning" />
              <MetricTile label="Missing owners" value={numberValue(hospital.missing_owner_count)} tone="danger" />
              <MetricTile label="Checklist gaps" value={numberValue(hospital.incomplete_launch_checklist_items)} tone="warning" />
              <MetricTile label="Low adoption" value={numberValue(hospital.low_adoption_departments)} tone="warning" />
              <MetricTile label="Training incomplete" value={numberValue(hospital.training_incomplete_count)} tone="warning" />
              <MetricTile label="Policy gaps" value={numberValue(hospital.policy_attestation_gaps)} tone="warning" />
              <MetricTile label="Workflow attempts" value={numberValue(hospital.failed_workflow_attempt_count)} tone="danger" />
              <MetricTile label="Support blockers" value={numberValue(hospital.support_readiness_blockers)} tone="danger" />
            </div>
          </ModernCard>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <ModernCard title="Hypercare and Support" subtitle="Production stability, cadence, high-risk issues, and support readiness.">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
                <MetricTile label="High/Critical issues" value={numberValue(hypercare.high_critical_hypercare_issues)} tone="danger" />
                <MetricTile label="Overdue issues" value={numberValue(hypercare.overdue_hypercare_issues)} tone="danger" />
                <MetricTile label="Missed cadence" value={numberValue(hypercare.missed_cadence_events)} tone="warning" />
                <MetricTile label="Critical support" value={numberValue(hospital.critical_support_issues)} tone="danger" />
              </div>
              {(data?.supportReadiness ?? []).length ? (
                <CompactList
                  rows={data?.supportReadiness ?? []}
                  render={(row, index) => (
                    <div className="alert alert-info" key={`${row.department_name ?? 'support'}-${index}`} style={{ margin: 0 }}>
                      <strong>{row.department_name || 'Department'}: </strong>{row.support_status || reviewRequired}
                    </div>
                  )}
                />
              ) : <EmptyState message={evidenceMissing} />}
            </ModernCard>

            <ModernCard title="Access, Security, and Governance" subtitle="Access review closure, limitations, signoffs, and governance action.">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
                <MetricTile label="Access status" value={access.access_review_readiness_status || access.final_access_review_readiness_status || reviewRequired} tone={itemTone(access.access_review_readiness_status || access.final_access_review_readiness_status)} />
                <MetricTile label="Access blockers" value={data?.accessBlockers.length ?? 0} tone={(data?.accessBlockers.length ?? 0) ? 'danger' : 'good'} />
                <MetricTile label="Known limitations" value={data?.limitations.length ?? 0} tone={(data?.limitations.length ?? 0) ? 'warning' : 'good'} />
                <MetricTile label="Pending signoffs" value={(data?.signoffs ?? []).filter(row => ['pending', 'blocked', 'ready_with_limitations'].includes(String(row.signoff_status ?? '').toLowerCase())).length} tone="warning" />
              </div>
            </ModernCard>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <ModernCard title="Backup, Restore, and DR Readiness" subtitle="Recovery checks and operational evidence needed before expansion.">
              {(data?.backup ?? []).length ? (
                <div className="table-wrap">
                  <table className="entity-table">
                    <thead><tr><th>Check</th><th>Status</th><th>Evidence</th></tr></thead>
                    <tbody>
                      {(data?.backup ?? []).slice(0, 6).map((row, index) => (
                        <tr key={`${row.operation_type ?? 'recovery'}-${index}`}>
                          <td>{row.operation_type || row.backup_area || 'Recovery check'}</td>
                          <td><StatusPill tone={itemTone(row.operation_status || row.status)}>{row.operation_status || row.status || reviewRequired}</StatusPill></td>
                          <td>{row.evidence_reference || evidenceMissing}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <EmptyState message={evidenceMissing} />}
            </ModernCard>

            <ModernCard title="Adoption, Training, and Policy/SOP" subtitle="User adoption, training completion, policy attestation, and department feedback.">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
                <MetricTile label="Inactive users" value={numberValue(hospital.inactive_users)} tone="warning" />
                <MetricTile label="Training incomplete" value={numberValue(hospital.training_incomplete_count)} tone="warning" />
                <MetricTile label="Policy gaps" value={numberValue(hospital.policy_attestation_gaps)} tone="warning" />
                <MetricTile label="Feedback required" value={(data?.adoptionReadiness ?? []).filter(row => numberValue(row.feedback_required_count) > 0).length} tone="warning" />
              </div>
            </ModernCard>
          </div>

          <ModernCard title="Executive Action Queue" subtitle="Decisions, limitations, blockers, and next action for executive review.">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px', marginBottom: '14px' }}>
              <MetricTile label="Go-live status" value={closure.production_go_live_readiness_status || realPilot.real_pilot_setup_readiness_status || reviewRequired} tone={itemTone(closure.production_go_live_readiness_status || realPilot.real_pilot_setup_readiness_status)} />
              <MetricTile label="Live workflow status" value={livePilot.live_execution_readiness_status || reviewRequired} tone={itemTone(livePilot.live_execution_readiness_status)} />
              <MetricTile label="Accepted limitations" value={data?.acceptedLimitations.length ?? 0} tone={(data?.acceptedLimitations.length ?? 0) ? 'warning' : 'good'} />
              <MetricTile label="Decisions" value={data?.goLiveDecisions.length ?? 0} />
            </div>
            <div className="alert alert-info" style={{ margin: 0 }}>
              <strong>Review before executive decision: </strong>{data?.nextRequiredAction ?? reviewRequired}
            </div>
          </ModernCard>

          <ModernCard title="Department-Level Register" subtitle="Concise department status for daily follow-up.">
            {(data?.departmentLaunchPacks ?? []).length ? (
              <div className="table-wrap">
                <table className="entity-table">
                  <thead>
                    <tr>
                      <th>Department / launch label</th>
                      <th>Readiness</th>
                      <th>Owner</th>
                      <th>Blocker</th>
                      <th>Adoption</th>
                      <th>Support</th>
                      <th>Next action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.departmentLaunchPacks ?? []).slice(0, 30).map((row, index) => {
                      const adoption = (data?.adoptionReadiness ?? []).find(item => item.launch_pack_id === row.id || item.department_name === row.department_name);
                      const support = (data?.supportReadiness ?? []).find(item => item.launch_pack_id === row.id || item.department_name === row.department_name);
                      const blocker = (data?.departmentBlockers ?? []).find(item => item.launch_pack_id === row.id || item.department_name === row.department_name);
                      return (
                        <tr key={`${row.id ?? row.launch_label}-${index}`}>
                          <td><strong>{row.department_name || row.launch_label || 'Department'}</strong></td>
                          <td><StatusPill tone={itemTone(row.launch_status)}>{row.launch_status || reviewRequired}</StatusPill></td>
                          <td>{row.department_owner_user_id ? 'Assigned' : ownerAction}</td>
                          <td>{blocker?.blocker_reason || blocker?.blocker_summary || noBlocker}</td>
                          <td>{adoption?.adoption_status || reviewRequired}</td>
                          <td>{support?.support_status || reviewRequired}</td>
                          <td>{row.readiness_summary || blocker?.blocker_reason || reviewRequired}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : <EmptyState message={evidenceMissing} />}
          </ModernCard>
        </div>
      </DataState>
    </section>
  );
}
