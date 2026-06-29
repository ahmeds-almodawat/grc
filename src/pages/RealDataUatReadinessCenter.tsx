import { useEffect, useMemo, useState } from 'react';
import { DataState } from '../components/DataState';
import { KpiTile, ModernCard, StatusPill } from '../components/ModernCard';
import {
  getRealDataActivationSummary,
  getRealDataImportQualityQueue,
  getUatFindingsQueue,
  getUatReadinessDashboard,
  type RealDataActivationSummary,
  type RealDataImportQualityQueueRow,
  type UatFindingQueueRow,
  type UatReadinessDashboardRow,
} from '../lib/realDataUatReadinessApi';
import { getLiveResultMessage, isLive, type LiveResult } from '../lib/liveResult';

const emptySummary: LiveResult<RealDataActivationSummary> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No real-data activation summary loaded yet.',
};

const emptyImportQueue: LiveResult<RealDataImportQualityQueueRow[]> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No real-data import queue loaded yet.',
};

const emptyUatDashboard: LiveResult<UatReadinessDashboardRow[]> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No UAT readiness dashboard loaded yet.',
};

const emptyFindings: LiveResult<UatFindingQueueRow[]> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No UAT findings loaded yet.',
};

function rows<T>(result: LiveResult<T[]>): T[] {
  return isLive(result) ? result.data : [];
}

function signalTone(signal?: string | null): 'neutral' | 'good' | 'warning' | 'danger' {
  if (!signal || signal === 'normal') return 'neutral';
  if (['ready', 'complete', 'ready_to_close'].includes(signal)) return 'good';
  if (signal.includes('blocked') || signal.includes('failed') || signal.includes('overdue')) return 'danger';
  if (signal.includes('review') || signal.includes('warning') || signal.includes('high')) return 'warning';
  return 'neutral';
}

function statusTone(status?: string | null): 'neutral' | 'good' | 'warning' | 'danger' {
  if (!status) return 'neutral';
  if (['approved', 'loaded', 'passed', 'completed', 'ready', 'retest_passed'].includes(status)) return 'good';
  if (['rejected', 'validation_failed', 'failed', 'blocked'].includes(status)) return 'danger';
  if (['uploaded', 'validating', 'ready_for_review', 'active', 'open', 'assigned'].includes(status)) return 'warning';
  return 'neutral';
}

export function RealDataUatReadinessCenter() {
  const [summary, setSummary] = useState<LiveResult<RealDataActivationSummary>>(emptySummary);
  const [importQueue, setImportQueue] = useState<LiveResult<RealDataImportQualityQueueRow[]>>(emptyImportQueue);
  const [uatDashboard, setUatDashboard] = useState<LiveResult<UatReadinessDashboardRow[]>>(emptyUatDashboard);
  const [findings, setFindings] = useState<LiveResult<UatFindingQueueRow[]>>(emptyFindings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      const [summaryResult, importResult, uatResult, findingResult] = await Promise.all([
        getRealDataActivationSummary(),
        getRealDataImportQualityQueue(),
        getUatReadinessDashboard(),
        getUatFindingsQueue(),
      ]);

      if (!mounted) return;
      setSummary(summaryResult);
      setImportQueue(importResult);
      setUatDashboard(uatResult);
      setFindings(findingResult);
      setLoading(false);
    }

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  const summaryData = isLive(summary) ? summary.data : null;
  const importRows = rows(importQueue);
  const uatRows = rows(uatDashboard);
  const findingRows = rows(findings);

  const nonLiveMessages = useMemo(() => ([summary, importQueue, uatDashboard, findings] as LiveResult<unknown>[])
    .filter(result => !isLive(result))
    .map(result => getLiveResultMessage(result))
    .filter((message, index, all) => all.indexOf(message) === index), [findings, importQueue, summary, uatDashboard]);

  const hasAnyData = Boolean(summaryData) || importRows.length > 0 || uatRows.length > 0 || findingRows.length > 0;
  const failedValidation = summaryData?.failed_validation_count ?? importRows.filter(row => row.queue_signal === 'validation_failed').length;
  const openFindings = findingRows.filter(row => ['open', 'assigned'].includes(row.finding_status)).length;

  return (
    <div className="page-stack real-data-uat-readiness-center">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Real-data activation and UAT readiness</p>
          <h1>Controlled path from empty platform to live hospital operation</h1>
          <p className="section-subtitle">
            Governs licensed content confirmation, import validation, mapping approvals, real user testing, training records, department signoffs, and final go/no-go readiness.
          </p>
        </div>
      </section>

      <DataState
        loading={loading}
        empty={!loading && !hasAnyData}
        emptyTitle="Patch 10 activation controls are installed, but no live records are loaded yet"
        emptyMessage={nonLiveMessages[0] ?? 'Upload real data batches, approve mappings, and run UAT cycles to activate this workspace.'}
      >
        <div className="kpi-grid">
          <KpiTile label="Import batches" value={summaryData?.import_batch_count ?? importRows.length} hint="Real-data loads" />
          <KpiTile label="Active imports" value={summaryData?.active_import_count ?? importRows.filter(row => ['uploaded', 'validating', 'ready_for_review'].includes(row.batch_status)).length} hint="In progress" />
          <KpiTile label="Validation issues" value={failedValidation} hint="Failed rules or errors" tone={failedValidation > 0 ? 'danger' : 'good'} />
          <KpiTile label="License confirmations" value={summaryData?.pending_license_confirmation_count ?? importRows.filter(row => row.content_license_status === 'pending_owner_confirmation').length} hint="Owner approval required" tone={(summaryData?.pending_license_confirmation_count ?? 0) > 0 ? 'warning' : 'good'} />
          <KpiTile label="Mapping sets" value={summaryData?.mapping_set_count ?? 0} hint="Source-to-target mappings" />
          <KpiTile label="Open UAT findings" value={openFindings} hint="Pilot blockers" tone={openFindings > 0 ? 'warning' : 'good'} />
        </div>

        <ModernCard title="Real-data import quality queue" subtitle="Licensed content confirmation, validation status, record count, and owner review signal.">
          <div className="table-scroll">
            <table className="entity-table">
              <thead>
                <tr>
                  <th>Batch</th>
                  <th>Domain</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th>License</th>
                  <th>Records</th>
                  <th>Errors</th>
                  <th>Signal</th>
                </tr>
              </thead>
              <tbody>
                {importRows.map(row => (
                  <tr key={row.batch_code}>
                    <td>{row.batch_code}</td>
                    <td>{row.source_domain}</td>
                    <td>{row.source_name}</td>
                    <td><StatusPill tone={statusTone(row.batch_status)}>{row.batch_status}</StatusPill></td>
                    <td>{row.content_license_status}</td>
                    <td>{row.record_count}</td>
                    <td>{row.error_count + row.failed_rule_count}</td>
                    <td><StatusPill tone={signalTone(row.queue_signal)}>{row.queue_signal}</StatusPill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ModernCard>

        <ModernCard title="UAT readiness dashboard" subtitle="Cycle status, scenarios, passed runs, failed/blocked runs, and open findings.">
          <div className="table-scroll">
            <table className="entity-table">
              <thead>
                <tr>
                  <th>Cycle</th>
                  <th>Status</th>
                  <th>Planned end</th>
                  <th>Scenarios</th>
                  <th>Passed</th>
                  <th>Failed / blocked</th>
                  <th>Open findings</th>
                  <th>Signal</th>
                </tr>
              </thead>
              <tbody>
                {uatRows.map(row => (
                  <tr key={row.cycle_code}>
                    <td>{row.cycle_name}</td>
                    <td><StatusPill tone={statusTone(row.cycle_status)}>{row.cycle_status}</StatusPill></td>
                    <td>{row.planned_end_date ?? '—'}</td>
                    <td>{row.scenario_count}</td>
                    <td>{row.passed_run_count}</td>
                    <td>{row.failed_or_blocked_run_count}</td>
                    <td>{row.open_finding_count}</td>
                    <td><StatusPill tone={signalTone(row.readiness_signal)}>{row.readiness_signal}</StatusPill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ModernCard>

        <ModernCard title="UAT findings queue" subtitle="Open pilot findings, owners, due dates, and retest readiness.">
          <div className="table-scroll">
            <table className="entity-table">
              <thead>
                <tr>
                  <th>Finding</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Owner</th>
                  <th>Due</th>
                  <th>Signal</th>
                </tr>
              </thead>
              <tbody>
                {findingRows.map(row => (
                  <tr key={row.finding_code}>
                    <td>{row.finding_title}</td>
                    <td>{row.severity}</td>
                    <td><StatusPill tone={statusTone(row.finding_status)}>{row.finding_status}</StatusPill></td>
                    <td>{row.owner_name ?? '—'}</td>
                    <td>{row.due_date ?? '—'}</td>
                    <td><StatusPill tone={signalTone(row.queue_signal)}>{row.queue_signal}</StatusPill></td>
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
