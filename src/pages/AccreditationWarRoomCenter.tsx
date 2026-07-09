import { useEffect, useMemo, useState } from 'react';
import { DataState } from '../components/DataState';
import { KpiTile, ModernCard, StatusPill } from '../components/ModernCard';
import {
  accreditationAssuranceApi,
  type AccreditationWarRoomRow,
  type ClauseReadinessRow,
  type DepartmentReadinessRow,
  type EvidenceChainRow,
  type EvidenceGapRow,
  type EvidenceGateFailureRow,
  type EvidenceWaiverRow,
  type QueueEvidenceGateOverlayRow,
  type SurveyBlockerRow,
} from '../lib/accreditationAssuranceApi';
import { getLiveResultMessage, isLive, type LiveResult } from '../lib/liveResult';

type Tone = 'neutral' | 'good' | 'warning' | 'danger';

function emptyRows<T>(message: string): LiveResult<T[]> {
  return { status: 'empty', data: null, source: 'system', isLive: false, generatedAt: new Date(0).toISOString(), message };
}

function rows<T>(result: LiveResult<T[]>): T[] {
  return isLive(result) ? result.data : [];
}

function first<T>(result: LiveResult<T[]>): T | null {
  return isLive(result) ? result.data[0] ?? null : null;
}

function value(v: unknown): string {
  if (v === null || v === undefined || v === '') return '-';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(1);
  return String(v).replaceAll('_', ' ');
}

function statusTone(status?: string | null): Tone {
  if (['pass', 'ready_for_reviewer_signoff', 'on_track', 'approved', 'waived', 'signed_off', 'resolved'].includes(status ?? '')) return 'good';
  if (['watch', 'pending', 'requires_review', 'pending_review', 'in_progress', 'submitted', 'under_review'].includes(status ?? '')) return 'warning';
  if ((status ?? '').startsWith('fail') || ['blocked', 'attention_required', 'rejected', 'expired', 'overdue', 'escalated'].includes(status ?? '')) return 'danger';
  return 'neutral';
}

function priorityTone(priority?: string | null): Tone {
  if (['critical', 'high'].includes(priority ?? '')) return 'danger';
  if (priority === 'medium') return 'warning';
  if (priority === 'low') return 'good';
  return 'neutral';
}

function ReadinessTable({ data }: { data: ClauseReadinessRow[] }) {
  return (
    <div className="table-scroll">
      <table className="entity-table">
        <thead><tr><th>Clause</th><th>Evidence</th><th>Workflow</th><th>Gate</th><th>Last evaluated</th></tr></thead>
        <tbody>
          {data.length === 0 ? (
            <tr><td colSpan={5}><strong>No clause readiness rows returned.</strong></td></tr>
          ) : data.slice(0, 80).map(row => (
            <tr key={row.clause_id ?? `${row.clause_code}-${row.standard_code}`}>
              <td><strong>{value(row.clause_code)}</strong><br /><small>{value(row.clause_title)}</small><br /><small>{value(row.framework)} / {value(row.standard_code)}</small></td>
              <td>{value(row.accepted_current_count)} accepted<br /><small>{value(row.evidence_gap_count)} gaps / {value(row.bridge_link_count)} links</small></td>
              <td>{value(row.workflow_blocker_count)} workflow<br /><small>{value(row.open_escalation_count)} escalations</small></td>
              <td><StatusPill tone={statusTone(row.gate_status ?? row.readiness_status)}>{value(row.gate_status ?? row.readiness_status)}</StatusPill></td>
              <td>{value(row.evaluated_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DepartmentTable({ data }: { data: DepartmentReadinessRow[] }) {
  return (
    <div className="table-scroll">
      <table className="entity-table">
        <thead><tr><th>Department</th><th>Evidence score</th><th>Tasks</th><th>Signal</th></tr></thead>
        <tbody>
          {data.length === 0 ? (
            <tr><td colSpan={4}><strong>No department readiness rows returned.</strong></td></tr>
          ) : data.slice(0, 80).map(row => (
            <tr key={row.department_id ?? row.department_name ?? 'department'}>
              <td><strong>{value(row.department_name)}</strong></td>
              <td>{value(row.evidence_readiness_score)}<br /><small>{value(row.ready_evidence_count)} ready / {value(row.evidence_gap_count)} gaps</small></td>
              <td>{value(row.open_task_count)} open<br /><small>{value(row.overdue_task_count)} overdue / {value(row.pending_review_count)} review</small></td>
              <td><StatusPill tone={statusTone(row.readiness_signal)}>{value(row.readiness_signal)}</StatusPill></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GapTable({ data }: { data: EvidenceGapRow[] }) {
  return (
    <div className="table-scroll">
      <table className="entity-table">
        <thead><tr><th>Item</th><th>Entity</th><th>Status</th><th>Owner</th><th>Updated</th></tr></thead>
        <tbody>
          {data.length === 0 ? (
            <tr><td colSpan={5}><strong>No evidence gaps returned.</strong></td></tr>
          ) : data.slice(0, 80).map(row => (
            <tr key={row.bridge_link_id ?? `${row.linked_entity_type}-${row.linked_entity_id}`}>
              <td><strong>{value(row.clause_code)}</strong><br /><small>{value(row.clause_title)}</small></td>
              <td>{value(row.linked_entity_type)}<br /><small>{value(row.linked_entity_id)}</small></td>
              <td><StatusPill tone={statusTone(row.evidence_status)}>{value(row.evidence_status)}</StatusPill><br /><small>{value(row.freshness_status)}</small></td>
              <td>{value(row.owner_name)}<br /><small>{value(row.department_name)}</small></td>
              <td>{value(row.updated_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GateFailureTable({ data }: { data: EvidenceGateFailureRow[] }) {
  return (
    <div className="table-scroll">
      <table className="entity-table">
        <thead><tr><th>Gate</th><th>Entity</th><th>Status</th><th>Evidence counts</th><th>Evaluated</th></tr></thead>
        <tbody>
          {data.length === 0 ? (
            <tr><td colSpan={5}><strong>No evidence gate failures returned.</strong></td></tr>
          ) : data.slice(0, 80).map(row => (
            <tr key={row.id ?? `${row.entity_type}-${row.entity_id}-${row.evaluated_at}`}>
              <td><strong>{value(row.gate_name)}</strong><br /><small>{value(row.required_evidence_type)}</small></td>
              <td>{value(row.entity_type)}<br /><small>{value(row.entity_id)}</small></td>
              <td><StatusPill tone={statusTone(row.gate_status)}>{value(row.gate_status)}</StatusPill><br /><StatusPill tone={priorityTone(row.severity)}>{value(row.severity)}</StatusPill></td>
              <td>{value(row.accepted_evidence_count)} accepted<br /><small>{value(row.missing_evidence_count)} missing / {value(row.rejected_evidence_count)} rejected / {value(row.expired_evidence_count)} expired</small></td>
              <td>{value(row.evaluated_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WaiverTable({ data }: { data: EvidenceWaiverRow[] }) {
  return (
    <div className="table-scroll">
      <table className="entity-table">
        <thead><tr><th>Entity</th><th>Status</th><th>Reason</th><th>Requested / Approved</th><th>Expiry</th></tr></thead>
        <tbody>
          {data.length === 0 ? (
            <tr><td colSpan={5}><strong>No evidence waiver rows returned.</strong></td></tr>
          ) : data.slice(0, 80).map(row => (
            <tr key={row.waiver_id ?? `${row.entity_type}-${row.entity_id}`}>
              <td>{value(row.entity_type)}<br /><small>{value(row.entity_id)}</small></td>
              <td><StatusPill tone={statusTone(row.waiver_status)}>{value(row.waiver_status)}</StatusPill></td>
              <td><strong>{value(row.waiver_reason)}</strong><br /><small>{value(row.audit_note)}</small></td>
              <td>{value(row.requested_by_name)}<br /><small>{value(row.approved_by_name)}</small></td>
              <td>{value(row.expires_on)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BlockerTable({ data }: { data: SurveyBlockerRow[] }) {
  return (
    <div className="table-scroll">
      <table className="entity-table">
        <thead><tr><th>Blocker</th><th>Entity</th><th>Status</th><th>Created</th></tr></thead>
        <tbody>
          {data.length === 0 ? (
            <tr><td colSpan={4}><strong>No survey blockers returned.</strong></td></tr>
          ) : data.slice(0, 80).map(row => (
            <tr key={`${row.blocker_type}-${row.entity_type}-${row.entity_id}-${row.created_at}`}>
              <td><strong>{value(row.blocker_type)}</strong><br /><small>{value(row.blocker_summary)}</small></td>
              <td>{value(row.entity_type)}<br /><small>{value(row.entity_id)}</small></td>
              <td><StatusPill tone={statusTone(row.blocker_status)}>{value(row.blocker_status)}</StatusPill></td>
              <td>{value(row.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChainTable({ data, label }: { data: EvidenceChainRow[]; label: string }) {
  return (
    <div className="table-scroll">
      <table className="entity-table">
        <thead><tr><th>{label}</th><th>Evidence</th><th>Status</th><th>Owner</th><th>Valid until</th></tr></thead>
        <tbody>
          {data.length === 0 ? (
            <tr><td colSpan={5}><strong>No {label.toLowerCase()} chain rows returned.</strong></td></tr>
          ) : data.slice(0, 60).map(row => (
            <tr key={row.bridge_link_id ?? `${row.linked_entity_type}-${row.linked_entity_id}-${row.evidence_id}`}>
              <td>{value(row.linked_entity_type)}<br /><small>{value(row.linked_entity_id)}</small></td>
              <td>{value(row.evidence_id)}</td>
              <td><StatusPill tone={statusTone(row.evidence_status)}>{value(row.evidence_status)}</StatusPill><br /><small>{value(row.freshness_status)}</small></td>
              <td>{value(row.owner_name)}<br /><small>{value(row.department_name)}</small></td>
              <td>{value(row.valid_until)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function QueueOverlayTable({ data }: { data: QueueEvidenceGateOverlayRow[] }) {
  return (
    <div className="table-scroll">
      <table className="entity-table">
        <thead><tr><th>Work</th><th>Module</th><th>Gate</th><th>Evidence</th><th>Next action</th></tr></thead>
        <tbody>
          {data.length === 0 ? (
            <tr><td colSpan={5}><strong>No queue evidence gate overlay rows returned.</strong></td></tr>
          ) : data.slice(0, 80).map(row => (
            <tr key={row.queue_item_id ?? `${row.source_module}-${row.source_entity_id}`}>
              <td><strong>{value(row.title)}</strong><br /><small>{value(row.due_date)}</small></td>
              <td>{value(row.source_module)}<br /><small>{value(row.source_entity_type)}</small></td>
              <td><StatusPill tone={statusTone(row.gate_status)}>{value(row.gate_status)}</StatusPill></td>
              <td>{value(row.accepted_evidence_count)} accepted<br /><small>{value(row.missing_evidence_count)} missing</small></td>
              <td>{value(row.evidence_gate_next_action)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AccreditationWarRoomCenter() {
  const [warRoom, setWarRoom] = useState<LiveResult<AccreditationWarRoomRow[]>>(emptyRows('No accreditation war room summary loaded yet.'));
  const [clauses, setClauses] = useState<LiveResult<ClauseReadinessRow[]>>(emptyRows('No clause readiness loaded yet.'));
  const [departments, setDepartments] = useState<LiveResult<DepartmentReadinessRow[]>>(emptyRows('No department readiness loaded yet.'));
  const [gaps, setGaps] = useState<LiveResult<EvidenceGapRow[]>>(emptyRows('No evidence gaps loaded yet.'));
  const [gateFailures, setGateFailures] = useState<LiveResult<EvidenceGateFailureRow[]>>(emptyRows('No evidence gate failures loaded yet.'));
  const [waivers, setWaivers] = useState<LiveResult<EvidenceWaiverRow[]>>(emptyRows('No evidence waivers loaded yet.'));
  const [surveyFindings, setSurveyFindings] = useState<LiveResult<SurveyBlockerRow[]>>(emptyRows('No survey findings loaded yet.'));
  const [blockers, setBlockers] = useState<LiveResult<SurveyBlockerRow[]>>(emptyRows('No survey blockers loaded yet.'));
  const [incidents, setIncidents] = useState<LiveResult<EvidenceChainRow[]>>(emptyRows('No incident evidence chain loaded yet.'));
  const [audits, setAudits] = useState<LiveResult<EvidenceChainRow[]>>(emptyRows('No audit evidence chain loaded yet.'));
  const [capas, setCapas] = useState<LiveResult<EvidenceChainRow[]>>(emptyRows('No CAPA evidence chain loaded yet.'));
  const [trainingDocuments, setTrainingDocuments] = useState<LiveResult<EvidenceChainRow[]>>(emptyRows('No training and document evidence chain loaded yet.'));
  const [queueOverlay, setQueueOverlay] = useState<LiveResult<QueueEvidenceGateOverlayRow[]>>(emptyRows('No queue evidence gate overlay loaded yet.'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      const [
        warRoomResult,
        clauseResult,
        departmentResult,
        gapResult,
        gateFailureResult,
        waiverResult,
        surveyFindingResult,
        blockerResult,
        incidentResult,
        auditResult,
        capaResult,
        trainingDocumentResult,
        queueOverlayResult,
      ] = await Promise.all([
        accreditationAssuranceApi.getAccreditationWarRoom(),
        accreditationAssuranceApi.getClauseReadinessRegister(),
        accreditationAssuranceApi.getDepartmentReadinessRegister(),
        accreditationAssuranceApi.getEvidenceGapRegister(),
        accreditationAssuranceApi.getEvidenceGateFailureRegister(),
        accreditationAssuranceApi.getEvidenceWaiverRegister(),
        accreditationAssuranceApi.getMockSurveyFindingRegister(),
        accreditationAssuranceApi.getSurveyBlockerSummary(),
        accreditationAssuranceApi.getIncidentEvidenceChain(),
        accreditationAssuranceApi.getAuditEvidenceChain(),
        accreditationAssuranceApi.getCapaEvidenceChain(),
        accreditationAssuranceApi.getTrainingDocumentEvidenceChain(),
        accreditationAssuranceApi.getQueueEvidenceGateOverlay(),
      ]);
      if (!mounted) return;
      setWarRoom(warRoomResult);
      setClauses(clauseResult);
      setDepartments(departmentResult);
      setGaps(gapResult);
      setGateFailures(gateFailureResult);
      setWaivers(waiverResult);
      setSurveyFindings(surveyFindingResult);
      setBlockers(blockerResult);
      setIncidents(incidentResult);
      setAudits(auditResult);
      setCapas(capaResult);
      setTrainingDocuments(trainingDocumentResult);
      setQueueOverlay(queueOverlayResult);
      setLoading(false);
    }
    void load();
    return () => { mounted = false; };
  }, []);

  const summary = first(warRoom);
  const clauseRows = rows(clauses);
  const departmentRows = rows(departments);
  const gapRows = rows(gaps);
  const gateFailureRows = rows(gateFailures);
  const waiverRows = rows(waivers);
  const surveyFindingRows = rows(surveyFindings);
  const blockerRows = rows(blockers);
  const incidentRows = rows(incidents);
  const auditRows = rows(audits);
  const capaRows = rows(capas);
  const trainingDocumentRows = rows(trainingDocuments);
  const queueOverlayRows = rows(queueOverlay);

  const hasAnyData = Boolean(summary)
    || clauseRows.length + departmentRows.length + gapRows.length + gateFailureRows.length + waiverRows.length
    + surveyFindingRows.length + blockerRows.length + incidentRows.length + auditRows.length + capaRows.length
    + trainingDocumentRows.length + queueOverlayRows.length > 0;

  const messages = useMemo(() => ([
    warRoom, clauses, departments, gaps, gateFailures, waivers, surveyFindings, blockers,
    incidents, audits, capas, trainingDocuments, queueOverlay,
  ] as LiveResult<unknown>[])
    .filter(result => !isLive(result))
    .map(result => getLiveResultMessage(result))
    .filter((message, index, all) => all.indexOf(message) === index), [
    warRoom, clauses, departments, gaps, gateFailures, waivers, surveyFindings, blockers,
    incidents, audits, capas, trainingDocuments, queueOverlay,
  ]);

  return (
    <section className="page-section accreditation-war-room-center">
      <div className="section-heading command-hero">
        <div>
          <p className="eyebrow">Accreditation Assurance</p>
          <h3>Accreditation War Room</h3>
          <p className="section-subtitle">Live survey readiness, evidence gates, waivers, blockers, queue overlays, and traceability chains across accreditation, OVR/RCA, audit, CAPA, training, and documents.</p>
        </div>
      </div>

      <DataState loading={loading} empty={!loading && !hasAnyData} emptyTitle="No accreditation assurance data is visible yet" emptyMessage={messages[0] ?? 'Live readiness appears when evidence bridge, accreditation workflow, and unified queue records are available.'}>
        <div className="kpi-grid">
          <KpiTile label="Readiness signal" value={value(summary?.readiness_signal)} hint="Executive survey posture" tone={statusTone(summary?.readiness_signal)} />
          <KpiTile label="Readiness score" value={value(summary?.overall_readiness_score)} hint="Ready clauses / total clauses" tone={(summary?.overall_readiness_score ?? 0) >= 90 ? 'good' : 'warning'} />
          <KpiTile label="Evidence gaps" value={summary?.evidence_gap_count ?? gapRows.length} hint="Open evidence gaps" tone={(summary?.evidence_gap_count ?? gapRows.length) > 0 ? 'danger' : 'good'} />
          <KpiTile label="Gate failures" value={summary?.gate_failure_count ?? gateFailureRows.length} hint="Evidence gates not passing" tone={(summary?.gate_failure_count ?? gateFailureRows.length) > 0 ? 'danger' : 'good'} />
          <KpiTile label="Active waivers" value={summary?.active_waiver_count ?? waiverRows.filter(row => row.waiver_status === 'approved').length} hint="Approved non-expired waivers" tone={(summary?.active_waiver_count ?? 0) > 0 ? 'warning' : 'neutral'} />
          <KpiTile label="Survey blockers" value={summary?.total_blocker_count ?? blockerRows.length} hint="Combined blocker register" tone={(summary?.total_blocker_count ?? blockerRows.length) > 0 ? 'danger' : 'good'} />
        </div>

        <ModernCard title="Clause Readiness Register"><ReadinessTable data={clauseRows} /></ModernCard>
        <ModernCard title="Department Readiness Register"><DepartmentTable data={departmentRows} /></ModernCard>
        <ModernCard title="Evidence Gate Failure Register"><GateFailureTable data={gateFailureRows} /></ModernCard>
        <ModernCard title="Evidence Gap Register"><GapTable data={gapRows} /></ModernCard>
        <ModernCard title="Evidence Waiver Register"><WaiverTable data={waiverRows} /></ModernCard>
        <ModernCard title="Survey Blocker Summary"><BlockerTable data={blockerRows} /></ModernCard>
        <ModernCard title="Survey Finding Register"><BlockerTable data={surveyFindingRows} /></ModernCard>
        <ModernCard title="Queue Evidence Gate Overlay"><QueueOverlayTable data={queueOverlayRows} /></ModernCard>
        <ModernCard title="Incident / OVR Evidence Chain"><ChainTable data={incidentRows} label="Incident / OVR" /></ModernCard>
        <ModernCard title="Audit Evidence Chain"><ChainTable data={auditRows} label="Audit" /></ModernCard>
        <ModernCard title="CAPA Evidence Chain"><ChainTable data={capaRows} label="CAPA" /></ModernCard>
        <ModernCard title="Training and Document Evidence Chain"><ChainTable data={trainingDocumentRows} label="Training / Document" /></ModernCard>
      </DataState>
    </section>
  );
}
