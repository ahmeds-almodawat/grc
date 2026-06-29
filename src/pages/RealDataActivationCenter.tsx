import { useEffect, useMemo, useState } from 'react';
import { DataState } from '../components/DataState';
import { KpiTile, ModernCard, StatusPill } from '../components/ModernCard';
import { getLiveResultMessage, isLive, type LiveResult } from '../lib/liveResult';
import {
  getRealDataActivationQueue,
  getRealDataActivationSummary,
  getRealDataApprovalQueue,
  getRealDataCutoverReadiness,
  getRealDataValidationQueue,
  type RealDataActivationQueueRow,
  type RealDataActivationSummary,
  type RealDataApprovalQueueRow,
  type RealDataCutoverReadinessRow,
  type RealDataValidationQueueRow,
} from '../lib/realDataActivationApi';

const emptySummary: LiveResult<RealDataActivationSummary> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No real data activation summary loaded yet.',
};

const emptyActivationQueue: LiveResult<RealDataActivationQueueRow[]> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No real data activation queue loaded yet.',
};

const emptyValidationQueue: LiveResult<RealDataValidationQueueRow[]> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No real data validation queue loaded yet.',
};

const emptyApprovalQueue: LiveResult<RealDataApprovalQueueRow[]> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No real data approval queue loaded yet.',
};

const emptyCutoverQueue: LiveResult<RealDataCutoverReadinessRow[]> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No cutover readiness records loaded yet.',
};

function rows<T>(result: LiveResult<T[]>): T[] {
  return isLive(result) ? result.data : [];
}

function signalTone(signal?: string | null): 'neutral' | 'good' | 'warning' | 'danger' {
  if (!signal || signal === 'normal') return 'neutral';
  if (['ready', 'approved', 'resolved', 'matched'].includes(signal)) return 'good';
  if (['danger', 'blocked', 'overdue', 'failed'].includes(signal)) return 'danger';
  if (['warning', 'required', 'pending', 'approval_pending', 'in_progress'].includes(signal)) return 'warning';
  return 'neutral';
}

function statusTone(status?: string | null): 'neutral' | 'good' | 'warning' | 'danger' {
  if (!status) return 'neutral';
  if (['approved', 'loaded', 'reconciled', 'signed_off', 'resolved', 'ready'].includes(status)) return 'good';
  if (['failed', 'rejected', 'blocked', 'mismatch'].includes(status)) return 'danger';
  if (['pending', 'source_received', 'mapped', 'validated', 'approval', 'conditional_approval'].includes(status)) return 'warning';
  return 'neutral';
}

export function RealDataActivationCenter() {
  const [summary, setSummary] = useState<LiveResult<RealDataActivationSummary>>(emptySummary);
  const [activationQueue, setActivationQueue] = useState<LiveResult<RealDataActivationQueueRow[]>>(emptyActivationQueue);
  const [validationQueue, setValidationQueue] = useState<LiveResult<RealDataValidationQueueRow[]>>(emptyValidationQueue);
  const [approvalQueue, setApprovalQueue] = useState<LiveResult<RealDataApprovalQueueRow[]>>(emptyApprovalQueue);
  const [cutoverQueue, setCutoverQueue] = useState<LiveResult<RealDataCutoverReadinessRow[]>>(emptyCutoverQueue);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      const [summaryResult, activationResult, validationResult, approvalResult, cutoverResult] = await Promise.all([
        getRealDataActivationSummary(),
        getRealDataActivationQueue(),
        getRealDataValidationQueue(),
        getRealDataApprovalQueue(),
        getRealDataCutoverReadiness(),
      ]);

      if (!mounted) return;
      setSummary(summaryResult);
      setActivationQueue(activationResult);
      setValidationQueue(validationResult);
      setApprovalQueue(approvalResult);
      setCutoverQueue(cutoverResult);
      setLoading(false);
    }

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  const summaryData = isLive(summary) ? summary.data : null;
  const activationRows = rows(activationQueue);
  const validationRows = rows(validationQueue);
  const approvalRows = rows(approvalQueue);
  const cutoverRows = rows(cutoverQueue);

  const nonLiveMessages = useMemo(() => ([summary, activationQueue, validationQueue, approvalQueue, cutoverQueue] as LiveResult<unknown>[])
    .filter(result => !isLive(result))
    .map(result => getLiveResultMessage(result))
    .filter((message, index, all) => all.indexOf(message) === index), [activationQueue, approvalQueue, cutoverQueue, summary, validationQueue]);

  const hasAnyData = Boolean(summaryData) || activationRows.length > 0 || validationRows.length > 0 || approvalRows.length > 0 || cutoverRows.length > 0;
  const blockingValidationCount = summaryData?.high_open_validation_count ?? validationRows.filter(row => row.queue_signal === 'danger').length;
  const pendingApprovalCount = summaryData?.pending_approval_count ?? approvalRows.filter(row => row.approval_status === 'pending').length;
  const readyDatasetCount = summaryData?.ready_dataset_count ?? activationRows.filter(row => ['ready', 'approved'].includes(row.queue_signal)).length;

  return (
    <div className="page-stack real-data-activation-center">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Patch 16 · Real data activation</p>
          <h1>Controlled activation of hospital master data and licensed standards metadata</h1>
          <p className="section-subtitle">
            Tracks real source files, license/privacy status, dataset mappings, validations, load approvals,
            reconciliations, cutover rehearsal, and final readiness signoffs without seeding fake data.
          </p>
        </div>
      </section>

      <DataState
        loading={loading}
        empty={!loading && !hasAnyData}
        emptyTitle="Real data activation is installed, but no hospital source records are loaded yet"
        emptyMessage={nonLiveMessages[0] ?? 'Load approved real master data and licensed metadata through controlled import batches to activate this center.'}
      >
        <div className="kpi-grid">
          <KpiTile label="Activation programs" value={summaryData?.program_count ?? 0} hint="Real data loading waves" />
          <KpiTile label="Datasets" value={summaryData?.dataset_count ?? activationRows.length} hint="Master-data domains" />
          <KpiTile label="Ready datasets" value={readyDatasetCount} hint="Approved / loaded / reconciled" tone={readyDatasetCount > 0 ? 'good' : 'neutral'} />
          <KpiTile label="Blocked sources" value={summaryData?.blocked_source_count ?? 0} hint="License or validation blocked" tone={(summaryData?.blocked_source_count ?? 0) > 0 ? 'danger' : 'good'} />
          <KpiTile label="Blocking validations" value={blockingValidationCount} hint="Critical / high open findings" tone={blockingValidationCount > 0 ? 'danger' : 'good'} />
          <KpiTile label="Pending approvals" value={pendingApprovalCount} hint="Load approval workflow" tone={pendingApprovalCount > 0 ? 'warning' : 'good'} />
        </div>

        <ModernCard title="Dataset activation queue" subtitle="Standards metadata, departments, committees, roles, evidence taxonomy, controls, KPIs, tracers, audit universe, obligations, and document owners.">
          <div className="table-scroll">
            <table className="entity-table">
              <thead>
                <tr>
                  <th>Program</th>
                  <th>Dataset</th>
                  <th>Domain</th>
                  <th>Target</th>
                  <th>Status</th>
                  <th>Owner</th>
                  <th>Due</th>
                  <th>Records</th>
                  <th>Signal</th>
                </tr>
              </thead>
              <tbody>
                {activationRows.map(row => (
                  <tr key={`${row.program_code}-${row.dataset_code}`}>
                    <td>{row.program_name}</td>
                    <td>{row.dataset_name}</td>
                    <td>{row.dataset_domain}</td>
                    <td>{row.target_module}</td>
                    <td><StatusPill tone={statusTone(row.dataset_status)}>{row.dataset_status}</StatusPill></td>
                    <td>{row.owner_name ?? 'Unassigned'}</td>
                    <td>{row.due_date ?? 'Not set'}</td>
                    <td>{row.loaded_record_count ?? 0}/{row.expected_record_count ?? '—'}</td>
                    <td><StatusPill tone={signalTone(row.queue_signal)}>{row.queue_signal}</StatusPill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ModernCard>

        <ModernCard title="Validation findings" subtitle="Blocking checks for completeness, uniqueness, references, license, privacy, workflow, and business rules.">
          <div className="table-scroll">
            <table className="entity-table">
              <thead>
                <tr>
                  <th>Dataset</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Finding</th>
                  <th>Owner</th>
                  <th>Due</th>
                  <th>Signal</th>
                </tr>
              </thead>
              <tbody>
                {validationRows.map((row, index) => (
                  <tr key={`${row.dataset_code ?? 'dataset'}-${row.finding_title}-${index}`}>
                    <td>{row.dataset_name ?? row.dataset_code ?? 'Unknown'}</td>
                    <td><StatusPill tone={statusTone(row.severity)}>{row.severity}</StatusPill></td>
                    <td><StatusPill tone={statusTone(row.result_status)}>{row.result_status}</StatusPill></td>
                    <td>{row.finding_title}</td>
                    <td>{row.remediation_owner_name ?? 'Unassigned'}</td>
                    <td>{row.remediation_due_date ?? 'Not set'}</td>
                    <td><StatusPill tone={signalTone(row.queue_signal)}>{row.queue_signal}</StatusPill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ModernCard>

        <ModernCard title="Load approvals" subtitle="Data owner, Quality, IT security, management, and load authorization decisions before data moves live.">
          <div className="table-scroll">
            <table className="entity-table">
              <thead>
                <tr>
                  <th>Program</th>
                  <th>Dataset</th>
                  <th>Stage</th>
                  <th>Status</th>
                  <th>Approver role</th>
                  <th>Approver</th>
                  <th>Signal</th>
                </tr>
              </thead>
              <tbody>
                {approvalRows.map((row, index) => (
                  <tr key={`${row.program_code ?? 'program'}-${row.approval_stage}-${index}`}>
                    <td>{row.program_code ?? 'Unknown'}</td>
                    <td>{row.dataset_name ?? row.dataset_code ?? 'All datasets'}</td>
                    <td>{row.approval_stage}</td>
                    <td><StatusPill tone={statusTone(row.approval_status)}>{row.approval_status}</StatusPill></td>
                    <td>{row.approver_role ?? 'Not set'}</td>
                    <td>{row.approver_name ?? 'Pending'}</td>
                    <td><StatusPill tone={signalTone(row.queue_signal)}>{row.queue_signal}</StatusPill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ModernCard>

        <ModernCard title="Cutover readiness" subtitle="Dataset readiness, blocking validations, approval queue, signoff completion, and production cutover signal.">
          <div className="table-scroll">
            <table className="entity-table">
              <thead>
                <tr>
                  <th>Program</th>
                  <th>Stage</th>
                  <th>Datasets ready</th>
                  <th>Blocking validations</th>
                  <th>Pending approvals</th>
                  <th>Signoffs</th>
                  <th>Readiness</th>
                </tr>
              </thead>
              <tbody>
                {cutoverRows.map(row => (
                  <tr key={row.program_code}>
                    <td>{row.program_name}</td>
                    <td>{row.activation_stage}</td>
                    <td>{row.ready_dataset_count}/{row.dataset_count}</td>
                    <td>{row.blocking_validation_count}</td>
                    <td>{row.pending_approval_count}</td>
                    <td>{row.approved_signoff_count}/{row.signoff_count}</td>
                    <td><StatusPill tone={signalTone(row.readiness_signal)}>{row.readiness_signal}</StatusPill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ModernCard>
      </DataState>
    </div>
  );
}
