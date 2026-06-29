import { useEffect, useMemo, useState } from 'react';
import { DataState } from '../components/DataState';
import { KpiTile, ModernCard, StatusPill } from '../components/ModernCard';
import {
  getProfessionalAuditQueue,
  getProfessionalIssueCapaQueue,
  getProfessionalRiskComplianceQueue,
  getProfessionalWorkbenchSummary,
  type ProfessionalAuditQueueRow,
  type ProfessionalIssueCapaQueueRow,
  type ProfessionalRiskComplianceQueueRow,
  type ProfessionalWorkbenchSummary,
} from '../lib/professionalWorkbenchesApi';
import { getLiveResultMessage, isLive, type LiveResult } from '../lib/liveResult';

const emptySummary: LiveResult<ProfessionalWorkbenchSummary> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No professional workbench summary loaded yet.',
};

const emptyAuditQueue: LiveResult<ProfessionalAuditQueueRow[]> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No audit queue loaded yet.',
};

const emptyRiskComplianceQueue: LiveResult<ProfessionalRiskComplianceQueueRow[]> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No risk/compliance queue loaded yet.',
};

const emptyIssueCapaQueue: LiveResult<ProfessionalIssueCapaQueueRow[]> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No issue/CAPA queue loaded yet.',
};

function rows<T>(result: LiveResult<T[]>): T[] {
  return isLive(result) ? result.data : [];
}

function signalTone(signal?: string | null): 'neutral' | 'good' | 'warning' | 'danger' {
  if (!signal || signal === 'normal') return 'neutral';
  if (signal === 'ready') return 'good';
  if (signal.includes('critical') || signal === 'danger' || signal.includes('failed') || signal.includes('breach')) return 'danger';
  if (signal.includes('overdue') || signal.includes('open') || signal.includes('high')) return 'warning';
  return 'neutral';
}

function statusTone(status?: string | null): 'neutral' | 'good' | 'warning' | 'danger' {
  if (!status) return 'neutral';
  if (['closed', 'approved', 'passed', 'implemented', 'completed'].includes(status)) return 'good';
  if (['failed', 'breached', 'rejected', 'critical'].includes(status)) return 'danger';
  if (['overdue', 'changes_requested', 'management_response', 'in_progress', 'submitted'].includes(status)) return 'warning';
  return 'neutral';
}

export function ProfessionalWorkbenchesCenter() {
  const [summary, setSummary] = useState<LiveResult<ProfessionalWorkbenchSummary>>(emptySummary);
  const [auditQueue, setAuditQueue] = useState<LiveResult<ProfessionalAuditQueueRow[]>>(emptyAuditQueue);
  const [riskComplianceQueue, setRiskComplianceQueue] = useState<LiveResult<ProfessionalRiskComplianceQueueRow[]>>(emptyRiskComplianceQueue);
  const [issueCapaQueue, setIssueCapaQueue] = useState<LiveResult<ProfessionalIssueCapaQueueRow[]>>(emptyIssueCapaQueue);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      const [summaryResult, auditResult, riskComplianceResult, issueCapaResult] = await Promise.all([
        getProfessionalWorkbenchSummary(),
        getProfessionalAuditQueue(),
        getProfessionalRiskComplianceQueue(),
        getProfessionalIssueCapaQueue(),
      ]);

      if (!mounted) return;
      setSummary(summaryResult);
      setAuditQueue(auditResult);
      setRiskComplianceQueue(riskComplianceResult);
      setIssueCapaQueue(issueCapaResult);
      setLoading(false);
    }

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  const summaryData = isLive(summary) ? summary.data : null;
  const auditRows = rows(auditQueue);
  const riskComplianceRows = rows(riskComplianceQueue);
  const issueCapaRows = rows(issueCapaQueue);

  const nonLiveMessages = useMemo(() => ([summary, auditQueue, riskComplianceQueue, issueCapaQueue] as LiveResult<unknown>[])
    .filter(result => !isLive(result))
    .map(result => getLiveResultMessage(result))
    .filter((message, index, all) => all.indexOf(message) === index), [auditQueue, issueCapaQueue, riskComplianceQueue, summary]);

  const hasAnyData = Boolean(summaryData) || auditRows.length > 0 || riskComplianceRows.length > 0 || issueCapaRows.length > 0;
  const openIssueCount = summaryData?.open_issue_count ?? issueCapaRows.filter(row => !['closed', 'cancelled'].includes(row.issue_status)).length;
  const highRiskSignals = riskComplianceRows.filter(row => ['danger', 'overdue'].includes(row.queue_signal)).length;

  return (
    <div className="page-stack professional-workbenches-center">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Professional audit, risk, and compliance workbenches</p>
          <h1>Daily operating queues for GRC execution</h1>
          <p className="section-subtitle">
            Converts audit programs, risk assessments, compliance obligations, control tests, issues, management responses, and CAPA retesting into reviewable operating work.
          </p>
        </div>
      </section>

      <DataState
        loading={loading}
        empty={!loading && !hasAnyData}
        emptyTitle="Patch 7 workbenches are installed, but no live records are loaded yet"
        emptyMessage={nonLiveMessages[0] ?? 'Create audit, risk, compliance, issue, and CAPA records to activate these queues.'}
      >
        <div className="kpi-grid">
          <KpiTile label="Audit engagements" value={summaryData?.audit_engagement_count ?? auditRows.length} hint="Professional audit work" />
          <KpiTile label="Open review notes" value={summaryData?.open_review_note_count ?? 0} hint="Audit review comments" tone={(summaryData?.open_review_note_count ?? 0) > 0 ? 'warning' : 'good'} />
          <KpiTile label="Risk assessments" value={summaryData?.risk_assessment_count ?? riskComplianceRows.filter(row => row.queue_type === 'risk').length} hint="Inherent/residual scoring" />
          <KpiTile label="Appetite breaches" value={summaryData?.appetite_breach_count ?? highRiskSignals} hint="Outside appetite" tone={(summaryData?.appetite_breach_count ?? 0) > 0 ? 'danger' : 'good'} />
          <KpiTile label="Control tests" value={summaryData?.control_test_count ?? riskComplianceRows.filter(row => row.queue_type === 'control_test').length} hint="Testing cycles" />
          <KpiTile label="Open issues" value={openIssueCount} hint="Issue/CAPA queue" tone={openIssueCount > 0 ? 'warning' : 'good'} />
        </div>

        <ModernCard title="Audit workbench queue" subtitle="Engagements, audit programs, sampling, workpapers, review notes, and management response readiness.">
          <div className="table-scroll">
            <table className="entity-table">
              <thead>
                <tr>
                  <th>Engagement</th>
                  <th>Domain</th>
                  <th>Risk</th>
                  <th>Stage</th>
                  <th>Lead</th>
                  <th>Target report</th>
                  <th>Programs</th>
                  <th>Review notes</th>
                  <th>Signal</th>
                </tr>
              </thead>
              <tbody>
                {auditRows.slice(0, 100).map(row => (
                  <tr key={row.engagement_code}>
                    <td><strong>{row.engagement_code}</strong><br /><small>{row.engagement_title}</small></td>
                    <td>{row.audit_domain}</td>
                    <td><StatusPill tone={statusTone(row.risk_rating)}>{row.risk_rating}</StatusPill></td>
                    <td>{row.engagement_stage}</td>
                    <td>{row.lead_auditor_name ?? 'Unassigned'}</td>
                    <td>{row.target_report_date ?? '-'}</td>
                    <td>{row.program_count}</td>
                    <td>{row.open_review_note_count}</td>
                    <td><StatusPill tone={signalTone(row.queue_signal)}>{row.queue_signal}</StatusPill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ModernCard>

        <ModernCard title="Risk, control, and compliance queue" subtitle="Risk appetite breaches, treatments, control tests, obligations, regulatory changes, and policy attestations.">
          <div className="table-scroll">
            <table className="entity-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Item</th>
                  <th>Status</th>
                  <th>Owner</th>
                  <th>Due / review</th>
                  <th>Signal</th>
                </tr>
              </thead>
              <tbody>
                {riskComplianceRows.slice(0, 120).map(row => (
                  <tr key={`${row.queue_type}-${row.item_code}`}>
                    <td>{row.queue_type}</td>
                    <td><strong>{row.item_code}</strong><br /><small>{row.item_title}</small></td>
                    <td><StatusPill tone={statusTone(row.item_status)}>{row.item_status}</StatusPill></td>
                    <td>{row.owner_name ?? 'Unassigned'}</td>
                    <td>{row.due_date ?? '-'}</td>
                    <td><StatusPill tone={signalTone(row.queue_signal)}>{row.queue_signal}</StatusPill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ModernCard>

        <ModernCard title="Issue, management response, and CAPA closure" subtitle="Cross-module issues, owner responses, commitments, retesting, failed retests, and closure approval.">
          <div className="table-scroll">
            <table className="entity-table">
              <thead>
                <tr>
                  <th>Issue</th>
                  <th>Source</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Owner</th>
                  <th>Due</th>
                  <th>CAPA</th>
                  <th>Failed retest</th>
                  <th>Signal</th>
                </tr>
              </thead>
              <tbody>
                {issueCapaRows.slice(0, 120).map(row => (
                  <tr key={row.issue_code}>
                    <td><strong>{row.issue_code}</strong><br /><small>{row.issue_title}</small></td>
                    <td>{row.issue_source}</td>
                    <td><StatusPill tone={statusTone(row.severity)}>{row.severity}</StatusPill></td>
                    <td>{row.issue_status}</td>
                    <td>{row.owner_name ?? 'Unassigned'}</td>
                    <td>{row.due_date ?? '-'}</td>
                    <td>{row.capa_count}</td>
                    <td>{row.failed_retest_count}</td>
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
