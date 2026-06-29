import { useEffect, useMemo, useState } from 'react';
import { DataState } from '../components/DataState';
import { KpiTile, ModernCard, StatusPill } from '../components/ModernCard';
import {
  getAssuranceExternalAuditorPortal,
  getAssuranceGateDashboard,
  getAssuranceGoLiveSummary,
  getAssuranceSignoffReadiness,
  type AssuranceExternalAuditorPortalRow,
  type AssuranceGateDashboardRow,
  type AssuranceGoLiveSummary,
  type AssuranceSignoffReadinessRow,
} from '../lib/assuranceGoLiveApi';
import { getLiveResultMessage, isLive, type LiveResult } from '../lib/liveResult';

const emptySummary: LiveResult<AssuranceGoLiveSummary> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No assurance go-live summary loaded yet.',
};

const emptyGates: LiveResult<AssuranceGateDashboardRow[]> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No go-live gates loaded yet.',
};

const emptyAuditorPortal: LiveResult<AssuranceExternalAuditorPortalRow[]> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No external auditor portal sessions loaded yet.',
};

const emptyReadiness: LiveResult<AssuranceSignoffReadinessRow[]> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No signoff readiness records loaded yet.',
};

function rows<T>(result: LiveResult<T[]>): T[] {
  return isLive(result) ? result.data : [];
}

function signalTone(signal?: string | null): 'neutral' | 'good' | 'warning' | 'danger' {
  if (!signal || signal === 'normal') return 'neutral';
  if (['ready', 'approved'].includes(signal)) return 'good';
  if (['blocked', 'critical_not_approved', 'failed', 'evidence_gap'].includes(signal)) return 'danger';
  if (['pending', 'overdue'].includes(signal)) return 'warning';
  return 'neutral';
}

function statusTone(status?: string | null, critical = false): 'neutral' | 'good' | 'warning' | 'danger' {
  if (!status) return 'neutral';
  if (['approved', 'signed', 'passed', 'tested', 'completed', 'go'].includes(status)) return 'good';
  if (['rejected', 'failed', 'revoked', 'no_go'].includes(status)) return 'danger';
  if (critical && status !== 'approved') return 'danger';
  if (['requested', 'in_progress', 'evidence_submitted', 'active', 'prepared', 'conditional_go'].includes(status)) return 'warning';
  return 'neutral';
}

export function AssuranceGoLiveCenter() {
  const [summary, setSummary] = useState<LiveResult<AssuranceGoLiveSummary>>(emptySummary);
  const [gates, setGates] = useState<LiveResult<AssuranceGateDashboardRow[]>>(emptyGates);
  const [auditorPortal, setAuditorPortal] = useState<LiveResult<AssuranceExternalAuditorPortalRow[]>>(emptyAuditorPortal);
  const [readiness, setReadiness] = useState<LiveResult<AssuranceSignoffReadinessRow[]>>(emptyReadiness);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      const [summaryResult, gateResult, portalResult, readinessResult] = await Promise.all([
        getAssuranceGoLiveSummary(),
        getAssuranceGateDashboard(),
        getAssuranceExternalAuditorPortal(),
        getAssuranceSignoffReadiness(),
      ]);

      if (!mounted) return;
      setSummary(summaryResult);
      setGates(gateResult);
      setAuditorPortal(portalResult);
      setReadiness(readinessResult);
      setLoading(false);
    }

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  const summaryData = isLive(summary) ? summary.data : null;
  const gateRows = rows(gates);
  const portalRows = rows(auditorPortal);
  const readinessRows = rows(readiness);

  const nonLiveMessages = useMemo(() => ([summary, gates, auditorPortal, readiness] as LiveResult<unknown>[])
    .filter(result => !isLive(result))
    .map(result => getLiveResultMessage(result))
    .filter((message, index, all) => all.indexOf(message) === index), [auditorPortal, gates, readiness, summary]);

  const hasAnyData = Boolean(summaryData) || gateRows.length > 0 || portalRows.length > 0 || readinessRows.length > 0;
  const criticalGateGap = summaryData?.critical_gate_not_approved_count ?? gateRows.filter(row => row.is_critical && row.gate_status !== 'approved').length;
  const signedRatio = `${summaryData?.signoff_signed_count ?? readinessRows.filter(row => row.item_status === 'signed').length}/${summaryData?.signoff_required_count ?? readinessRows.filter(row => row.readiness_type === 'signoff').length}`;

  return (
    <div className="page-stack assurance-go-live-center">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Assurance, security, and go-live pack</p>
          <h1>Production decision evidence, not proof-only confidence</h1>
          <p className="section-subtitle">
            Governs external auditor access, go-live gates, retention/confidentiality, training, SOPs, board packs, signoffs, rollback/restore, monitoring, pilot approval, and final production decisions.
          </p>
        </div>
      </section>

      <DataState
        loading={loading}
        empty={!loading && !hasAnyData}
        emptyTitle="Patch 8 assurance pack is installed, but no live records are loaded yet"
        emptyMessage={nonLiveMessages[0] ?? 'Create go-live gates, signoffs, training, monitoring, and auditor packages to activate this assurance center.'}
      >
        <div className="kpi-grid">
          <KpiTile label="Critical gates" value={summaryData?.critical_gate_count ?? gateRows.filter(row => row.is_critical).length} hint="Go-live gate register" />
          <KpiTile label="Critical gaps" value={criticalGateGap} hint="Critical gates not approved" tone={criticalGateGap > 0 ? 'danger' : 'good'} />
          <KpiTile label="Signoffs" value={signedRatio} hint="Signed / required" />
          <KpiTile label="Restore exercises" value={summaryData?.restore_exercise_count ?? readinessRows.filter(row => row.readiness_type === 'restore').length} hint="Rollback/restore proof" />
          <KpiTile label="Training overdue" value={summaryData?.training_overdue_count ?? 0} hint="Training blockers" tone={(summaryData?.training_overdue_count ?? 0) > 0 ? 'warning' : 'good'} />
          <KpiTile label="Auditor sessions" value={summaryData?.open_auditor_session_count ?? portalRows.filter(row => ['approved', 'active'].includes(row.session_status)).length} hint="External read-only access" />
        </div>

        <ModernCard title="Go-live gate dashboard" subtitle="Critical and non-critical gates, evidence requirements, ownership, approval status, and blocker signals.">
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
                  <th>Signal</th>
                </tr>
              </thead>
              <tbody>
                {gateRows.slice(0, 120).map(row => (
                  <tr key={row.gate_code}>
                    <td><strong>{row.gate_code}</strong><br /><small>{row.gate_name}</small></td>
                    <td>{row.gate_area}</td>
                    <td>{row.is_critical ? 'Yes' : 'No'}</td>
                    <td><StatusPill tone={statusTone(row.gate_status, row.is_critical)}>{row.gate_status}</StatusPill></td>
                    <td>{row.gate_owner_name ?? 'Unassigned'}</td>
                    <td>{row.due_date ?? '-'}</td>
                    <td>{row.evidence_accepted_count}/{row.evidence_required_count}</td>
                    <td><StatusPill tone={signalTone(row.gate_signal)}>{row.gate_signal}</StatusPill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ModernCard>

        <ModernCard title="Readiness and signoff queue" subtitle="Management, IT, Quality, restore, training, monitoring, and pilot readiness records.">
          <div className="table-scroll">
            <table className="entity-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Item</th>
                  <th>Area</th>
                  <th>Owner</th>
                  <th>Status</th>
                  <th>Signal</th>
                </tr>
              </thead>
              <tbody>
                {readinessRows.slice(0, 150).map(row => (
                  <tr key={`${row.readiness_type}-${row.item_code}`}>
                    <td>{row.readiness_type}</td>
                    <td><strong>{row.item_code}</strong></td>
                    <td>{row.item_area ?? '-'}</td>
                    <td>{row.owner_name ?? 'Unassigned'}</td>
                    <td><StatusPill tone={statusTone(row.item_status)}>{row.item_status}</StatusPill></td>
                    <td><StatusPill tone={signalTone(row.readiness_signal)}>{row.readiness_signal}</StatusPill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ModernCard>

        <ModernCard title="External auditor read-only portal" subtitle="Approved evidence packages, external read-only sessions, access windows, and revocation status.">
          <div className="table-scroll">
            <table className="entity-table">
              <thead>
                <tr>
                  <th>Package</th>
                  <th>Auditor</th>
                  <th>Email</th>
                  <th>Access</th>
                  <th>Session</th>
                  <th>Starts</th>
                  <th>Expires</th>
                  <th>Last access</th>
                </tr>
              </thead>
              <tbody>
                {portalRows.slice(0, 100).map((row, index) => (
                  <tr key={`${row.package_code ?? 'package'}-${row.auditor_email ?? row.auditor_name}-${index}`}>
                    <td><strong>{row.package_code ?? '-'}</strong><br /><small>{row.package_title ?? '-'}</small></td>
                    <td>{row.auditor_name}</td>
                    <td>{row.auditor_email ?? '-'}</td>
                    <td>{row.access_scope}</td>
                    <td><StatusPill tone={statusTone(row.session_status)}>{row.session_status}</StatusPill></td>
                    <td>{row.starts_at ?? '-'}</td>
                    <td>{row.expires_at ?? '-'}</td>
                    <td>{row.last_accessed_at ?? '-'}</td>
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
