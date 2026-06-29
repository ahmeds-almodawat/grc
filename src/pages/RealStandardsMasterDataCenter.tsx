import { useEffect, useMemo, useState } from 'react';
import { DataState } from '../components/DataState';
import { KpiTile, ModernCard, StatusPill } from '../components/ModernCard';
import {
  getRealControlEvidenceMap,
  getRealMasterDataCoverage,
  getRealStandardsMasterSummary,
  getRealStandardsReadinessQueue,
  type RealControlEvidenceMapRow,
  type RealMasterDataCoverageRow,
  type RealStandardsMasterSummary,
  type RealStandardsReadinessRow,
} from '../lib/realStandardsMasterDataApi';
import { getLiveResultMessage, isLive, type LiveResult } from '../lib/liveResult';

const emptySummary: LiveResult<RealStandardsMasterSummary> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No real standards and master data summary loaded yet.',
};

const emptyReadiness: LiveResult<RealStandardsReadinessRow[]> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No real standards readiness queue loaded yet.',
};

const emptyCoverage: LiveResult<RealMasterDataCoverageRow[]> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No master data coverage rows loaded yet.',
};

const emptyControlMap: LiveResult<RealControlEvidenceMapRow[]> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No control/evidence mappings loaded yet.',
};

function rows<T>(result: LiveResult<T[]>): T[] {
  return isLive(result) ? result.data : [];
}

function signalTone(signal?: string | null): 'neutral' | 'good' | 'warning' | 'danger' {
  if (!signal || ['ready', 'mapped', 'active', 'approved', 'in_scope'].includes(signal)) return 'good';
  if (signal.includes('missing') || signal.includes('not_met')) return 'danger';
  if (signal.includes('pending') || signal.includes('partial') || signal.includes('needed')) return 'warning';
  return 'neutral';
}

function statusTone(status?: string | null): 'neutral' | 'good' | 'warning' | 'danger' {
  if (!status) return 'neutral';
  if (['applicable', 'approved', 'active', 'mapped', 'in_scope', 'ready'].includes(status)) return 'good';
  if (['not_applicable', 'retired', 'inactive', 'expired'].includes(status)) return 'neutral';
  if (['pending', 'draft', 'under_review', 'partial_scope', 'partially_applicable'].includes(status)) return 'warning';
  return 'neutral';
}

export function RealStandardsMasterDataCenter() {
  const [summary, setSummary] = useState<LiveResult<RealStandardsMasterSummary>>(emptySummary);
  const [readiness, setReadiness] = useState<LiveResult<RealStandardsReadinessRow[]>>(emptyReadiness);
  const [coverage, setCoverage] = useState<LiveResult<RealMasterDataCoverageRow[]>>(emptyCoverage);
  const [controlMap, setControlMap] = useState<LiveResult<RealControlEvidenceMapRow[]>>(emptyControlMap);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      const [summaryResult, readinessResult, coverageResult, controlMapResult] = await Promise.all([
        getRealStandardsMasterSummary(),
        getRealStandardsReadinessQueue(),
        getRealMasterDataCoverage(),
        getRealControlEvidenceMap(),
      ]);

      if (!mounted) return;
      setSummary(summaryResult);
      setReadiness(readinessResult);
      setCoverage(coverageResult);
      setControlMap(controlMapResult);
      setLoading(false);
    }

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  const summaryData = isLive(summary) ? summary.data : null;
  const readinessRows = rows(readiness);
  const coverageRows = rows(coverage);
  const controlRows = rows(controlMap);

  const nonLiveMessages = useMemo(() => ([summary, readiness, coverage, controlMap] as LiveResult<unknown>[])
    .filter(result => !isLive(result))
    .map(result => getLiveResultMessage(result))
    .filter((message, index, all) => all.indexOf(message) === index), [controlMap, coverage, readiness, summary]);

  const hasAnyData = Boolean(summaryData) || readinessRows.length > 0 || coverageRows.length > 0 || controlRows.length > 0;
  const pendingItems = summaryData?.pending_applicability_count ?? readinessRows.filter(row => ['pending_applicability', 'mapping_needed'].includes(row.readiness_signal)).length;
  const missingMappings = controlRows.filter(row => row.mapping_signal !== 'mapped').length;

  return (
    <div className="page-stack real-standards-master-data-center">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Real standards and hospital master data</p>
          <h1>Licensed standards, ownership, evidence taxonomy, and control library activation</h1>
          <p className="section-subtitle">
            Loads owner-provided standards metadata and hospital master data without embedding copyrighted CBAHI, JCI, or ISO standard text.
          </p>
        </div>
      </section>

      <DataState
        loading={loading}
        empty={!loading && !hasAnyData}
        emptyTitle="Patch 11 master data structures are installed, but no real records are loaded yet"
        emptyMessage={nonLiveMessages[0] ?? 'Load licensed standards metadata, departments, committees, evidence taxonomy, controls, indicators, tracers, and document owners.'}
      >
        <div className="kpi-grid">
          <KpiTile label="Standards libraries" value={summaryData?.standards_library_count ?? 0} hint="Licensed owner metadata" />
          <KpiTile label="License verified" value={summaryData?.license_verified_count ?? 0} hint="Legal/content governance" tone={(summaryData?.license_verified_count ?? 0) > 0 ? 'good' : 'warning'} />
          <KpiTile label="Requirements" value={summaryData?.requirement_count ?? readinessRows.length} hint="Owner-loaded mapping" />
          <KpiTile label="Departments" value={summaryData?.department_count ?? coverageRows.filter(row => row.master_data_type === 'department').length} hint="Real hospital scope" />
          <KpiTile label="Pending applicability" value={pendingItems} hint="Needs owner review" tone={pendingItems > 0 ? 'warning' : 'good'} />
          <KpiTile label="Mapping issues" value={missingMappings} hint="Control/evidence gaps" tone={missingMappings > 0 ? 'danger' : 'good'} />
        </div>

        <ModernCard title="Standards readiness queue" subtitle="Requirement applicability, measurable elements, department ownership, priority, and readiness signal.">
          <div className="table-scroll">
            <table className="entity-table">
              <thead>
                <tr>
                  <th>Framework</th>
                  <th>Requirement</th>
                  <th>Title</th>
                  <th>Department</th>
                  <th>Applicability</th>
                  <th>Elements</th>
                  <th>Open</th>
                  <th>Signal</th>
                </tr>
              </thead>
              <tbody>
                {readinessRows.map(row => (
                  <tr key={`${row.framework_code ?? 'framework'}-${row.requirement_code}`}>
                    <td>{row.framework_code ?? '—'}</td>
                    <td>{row.requirement_code}</td>
                    <td>{row.requirement_title ?? 'Owner-loaded requirement'}</td>
                    <td>{row.responsible_department_name ?? 'Unassigned'}</td>
                    <td><StatusPill tone={statusTone(row.applicability_status)}>{row.applicability_status}</StatusPill></td>
                    <td>{row.measurable_element_count}</td>
                    <td>{row.open_element_count}</td>
                    <td><StatusPill tone={signalTone(row.readiness_signal)}>{row.readiness_signal}</StatusPill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ModernCard>

        <ModernCard title="Master data coverage" subtitle="Departments, committees, evidence taxonomy, document register, and controls loaded by the organization.">
          <div className="table-scroll">
            <table className="entity-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {coverageRows.map(row => (
                  <tr key={`${row.master_data_type}-${row.item_code}`}>
                    <td>{row.master_data_type}</td>
                    <td>{row.item_code}</td>
                    <td>{row.item_name}</td>
                    <td><StatusPill tone={statusTone(row.item_status)}>{row.item_status}</StatusPill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ModernCard>

        <ModernCard title="Control and evidence map" subtitle="Key controls connected to evidence taxonomy, owners, departments, and requirement references.">
          <div className="table-scroll">
            <table className="entity-table">
              <thead>
                <tr>
                  <th>Control</th>
                  <th>Domain</th>
                  <th>Owner</th>
                  <th>Evidence</th>
                  <th>Requirement</th>
                  <th>Key</th>
                  <th>Signal</th>
                </tr>
              </thead>
              <tbody>
                {controlRows.map(row => (
                  <tr key={row.control_code}>
                    <td>{row.control_code} — {row.control_name}</td>
                    <td>{row.control_domain}</td>
                    <td>{row.control_owner_name ?? 'Unassigned'}</td>
                    <td>{row.evidence_taxonomy_name ?? row.evidence_taxonomy_code ?? 'Missing'}</td>
                    <td>{row.linked_requirement_code ?? 'Missing'}</td>
                    <td>{row.is_key_control ? 'Yes' : 'No'}</td>
                    <td><StatusPill tone={signalTone(row.mapping_signal)}>{row.mapping_signal}</StatusPill></td>
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
