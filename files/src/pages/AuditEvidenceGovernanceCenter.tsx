import { useEffect, useMemo, useState } from 'react';
import { DataState } from '../components/DataState';
import { KpiTile, ModernCard, StatusPill } from '../components/ModernCard';
import {
  getAuditEngagementDashboard,
  getAuditEvidenceGovernanceSummary,
  getEvidenceIntegrityIndex,
  getProductionGovernanceGateDashboard,
  type AuditEngagementDashboardRow,
  type AuditEvidenceGovernanceSummary,
  type EvidenceIntegrityIndexRow,
  type ProductionGovernanceGateRow,
} from '../lib/auditEvidenceGovernanceApi';
import { getLiveResultMessage, isLive, type LiveResult } from '../lib/liveResult';

const emptySummary: LiveResult<AuditEvidenceGovernanceSummary> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No audit/evidence governance summary loaded yet.',
};

const emptyEngagements: LiveResult<AuditEngagementDashboardRow[]> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No audit engagements loaded yet.',
};

const emptyIntegrity: LiveResult<EvidenceIntegrityIndexRow[]> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No evidence integrity records loaded yet.',
};

const emptyGates: LiveResult<ProductionGovernanceGateRow[]> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No production governance gates loaded yet.',
};

function rows<T>(result: LiveResult<T[]>): T[] {
  return isLive(result) ? result.data : [];
}

function gateTone(status: string, isCritical = false): 'neutral' | 'good' | 'warning' | 'danger' {
  if (status === 'approved') return 'good';
  if (status === 'rejected') return 'danger';
  if (isCritical) return 'danger';
  if (status === 'evidence_submitted' || status === 'in_progress') return 'warning';
  return 'neutral';
}

function engagementTone(status: string): 'neutral' | 'good' | 'warning' | 'danger' {
  if (status === 'closed') return 'good';
  if (status === 'cancelled') return 'neutral';
  if (status === 'management_response' || status === 'follow_up') return 'warning';
  return 'neutral';
}

function integrityTone(status?: string | null): 'neutral' | 'good' | 'warning' | 'danger' {
  if (status === 'verified') return 'good';
  if (status === 'failed') return 'danger';
  if (status === 'pending') return 'warning';
  return 'neutral';
}

export function AuditEvidenceGovernanceCenter() {
  const [summary, setSummary] = useState<LiveResult<AuditEvidenceGovernanceSummary>>(emptySummary);
  const [engagements, setEngagements] = useState<LiveResult<AuditEngagementDashboardRow[]>>(emptyEngagements);
  const [integrity, setIntegrity] = useState<LiveResult<EvidenceIntegrityIndexRow[]>>(emptyIntegrity);
  const [gates, setGates] = useState<LiveResult<ProductionGovernanceGateRow[]>>(emptyGates);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      const [summaryResult, engagementResult, integrityResult, gateResult] = await Promise.all([
        getAuditEvidenceGovernanceSummary(),
        getAuditEngagementDashboard(),
        getEvidenceIntegrityIndex(),
        getProductionGovernanceGateDashboard(),
      ]);

      if (!mounted) return;
      setSummary(summaryResult);
      setEngagements(engagementResult);
      setIntegrity(integrityResult);
      setGates(gateResult);
      setLoading(false);
    }

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  const summaryData = isLive(summary) ? summary.data : null;
  const engagementRows = rows(engagements);
  const integrityRows = rows(integrity);
  const gateRows = rows(gates);

  const nonLiveMessages = useMemo(() => ([summary, engagements, integrity, gates] as LiveResult<unknown>[])
    .filter(result => !isLive(result))
    .map(result => getLiveResultMessage(result))
    .filter((message, index, all) => all.indexOf(message) === index), [engagements, gates, integrity, summary]);

  const hasAnyData = Boolean(summaryData)
    || engagementRows.length > 0
    || integrityRows.length > 0
    || gateRows.length > 0;

  const criticalGatesNotApproved = summaryData?.critical_gate_not_approved_count ?? gateRows.filter(row => row.is_critical && row.gate_status !== 'approved').length;

  return (
    <div className="page-stack audit-evidence-governance-center">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Audit, evidence integrity, and production governance</p>
          <h1>Final assurance workspace before go-live</h1>
          <p className="section-subtitle">
            Audit workbench, evidence version integrity, immutable audit events, external auditor access, and go-live gate evidence. Passing proof packs does not equal production approval.
          </p>
        </div>
      </section>

      <DataState
        loading={loading}
        empty={!loading && !hasAnyData}
        emptyTitle="Patch 4 governance engine is installed, but no live records are loaded yet"
        emptyMessage={nonLiveMessages[0] ?? 'Create audit engagements, evidence versions, immutable events, and go-live gates to activate this workspace.'}
      >
        <div className="kpi-grid">
          <KpiTile label="Audit engagements" value={summaryData?.engagement_count ?? engagementRows.length} hint="Audit workbench records" />
          <KpiTile label="Open findings" value={summaryData?.open_finding_count ?? 0} hint="Not closed / accepted risk" tone={(summaryData?.open_finding_count ?? 0) > 0 ? 'warning' : 'good'} />
          <KpiTile label="Evidence versions" value={summaryData?.evidence_version_count ?? integrityRows.length} hint="Versioned evidence records" />
          <KpiTile label="Verified hashes" value={summaryData?.verified_hash_count ?? integrityRows.filter(row => row.integrity_status === 'verified').length} hint="Evidence integrity confirmations" tone={(summaryData?.verified_hash_count ?? 0) > 0 ? 'good' : 'neutral'} />
          <KpiTile label="Immutable events" value={summaryData?.immutable_event_count ?? 0} hint="Hash-chain audit events" />
          <KpiTile label="Critical gates" value={criticalGatesNotApproved} hint="Critical gates not approved" tone={criticalGatesNotApproved > 0 ? 'danger' : 'good'} />
        </div>

        <ModernCard
          title="Audit engagement dashboard"
          subtitle="Audit universe, risk-based plan, engagement status, workpapers, evidence requests, findings, and follow-up workload."
        >
          <div className="table-scroll">
            <table className="entity-table">
              <thead>
                <tr>
                  <th>Engagement</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Lead auditor</th>
                  <th>Target report</th>
                  <th>Findings</th>
                  <th>Open</th>
                  <th>Workpapers</th>
                  <th>Evidence</th>
                </tr>
              </thead>
              <tbody>
                {engagementRows.slice(0, 100).map(row => (
                  <tr key={row.engagement_code}>
                    <td><strong>{row.engagement_code}</strong><br /><small>{row.title}</small></td>
                    <td>{row.engagement_type}</td>
                    <td><StatusPill tone={engagementTone(row.engagement_status)}>{row.engagement_status}</StatusPill></td>
                    <td>{row.lead_auditor_name ?? 'Unassigned'}</td>
                    <td>{row.target_report_date ?? '-'}</td>
                    <td>{row.finding_count}</td>
                    <td>{row.open_finding_count}</td>
                    <td>{row.workpaper_count}</td>
                    <td>{row.evidence_request_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ModernCard>

        <ModernCard
          title="Evidence integrity index"
          subtitle="Evidence versions, review status, SHA-256 chain hashes, and immutable event coverage."
        >
          <div className="table-scroll">
            <table className="entity-table">
              <thead>
                <tr>
                  <th>Evidence</th>
                  <th>Source</th>
                  <th>Version</th>
                  <th>Status</th>
                  <th>Integrity</th>
                  <th>Verified at</th>
                  <th>Events</th>
                  <th>Chain hash</th>
                </tr>
              </thead>
              <tbody>
                {integrityRows.slice(0, 100).map(row => (
                  <tr key={`${row.evidence_code}-${row.version_no}-${row.chain_hash ?? 'no-hash'}`}>
                    <td><strong>{row.evidence_code}</strong><br /><small>{row.evidence_title}</small></td>
                    <td>{row.source_type}</td>
                    <td>{row.version_no}</td>
                    <td>{row.version_status}</td>
                    <td><StatusPill tone={integrityTone(row.integrity_status)}>{row.integrity_status ?? 'not_hashed'}</StatusPill></td>
                    <td>{row.verified_at ?? '-'}</td>
                    <td>{row.related_event_count}</td>
                    <td><small>{row.chain_hash ? `${row.chain_hash.slice(0, 12)}…` : '-'}</small></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ModernCard>

        <ModernCard
          title="Production governance gates"
          subtitle="Go-live gates must be approved with accepted evidence. Do not treat technical proof as production approval."
        >
          <div className="table-scroll">
            <table className="entity-table">
              <thead>
                <tr>
                  <th>Gate</th>
                  <th>Area</th>
                  <th>Critical</th>
                  <th>Status</th>
                  <th>Owner</th>
                  <th>Due</th>
                  <th>Evidence</th>
                  <th>Accepted</th>
                </tr>
              </thead>
              <tbody>
                {gateRows.map(row => (
                  <tr key={row.gate_code}>
                    <td><strong>{row.gate_code}</strong><br /><small>{row.gate_name}</small></td>
                    <td>{row.gate_area}</td>
                    <td>{row.is_critical ? 'Yes' : 'No'}</td>
                    <td><StatusPill tone={gateTone(row.gate_status, row.is_critical)}>{row.gate_status}</StatusPill></td>
                    <td>{row.owner_name ?? 'Unassigned'}</td>
                    <td>{row.due_date ?? '-'}</td>
                    <td>{row.evidence_item_count}</td>
                    <td>{row.accepted_evidence_count}</td>
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
