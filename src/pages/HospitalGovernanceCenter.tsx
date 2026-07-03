import { useEffect, useMemo, useState } from 'react';
import { DataState } from '../components/DataState';
import { KpiTile, ModernCard, StatusPill } from '../components/ModernCard';
import {
  getAccreditationBlockerSummary,
  getCommitteeActionQueue,
  getCommitteeMeetingRegister,
  getCredentialingExpiryRegister,
  getDepartmentHospitalGovernanceScorecard,
  getExecutiveHospitalQualitySummary,
  getFacilityBiomedicalSafetyRegister,
  getFacilitySafetyEvidenceGapRegister,
  getHospitalGovernanceWorkQueue,
  getInfectionControlOpenActions,
  getInfectionControlRegister,
  getOverdueCommitteeActions,
  getPrivilegingCompetencyGapRegister,
  getQualityIndicatorOffTargetRegister,
  getQualityIndicatorPerformance,
  type HospitalGovernanceRow,
  type HospitalQualitySummaryRow,
} from '../lib/hospitalGovernanceApi';
import { getLiveResultMessage, isLive, type LiveResult } from '../lib/liveResult';

function emptyRows<T>(message: string): LiveResult<T[]> {
  return { status: 'empty', data: null, source: 'system', isLive: false, generatedAt: new Date(0).toISOString(), message };
}

function rows<T>(result: LiveResult<T[]>): T[] {
  return isLive(result) ? result.data : [];
}

function value(v: unknown): string {
  if (v === null || v === undefined || v === '') return '-';
  return String(v).replaceAll('_', ' ');
}

function tone(status: unknown): 'good' | 'warning' | 'danger' | 'neutral' {
  const normalized = String(status ?? '').toLowerCase();
  if (['closed', 'completed', 'compliant', 'on_target', 'minutes_approved', 'active'].includes(normalized)) return 'good';
  if (['critical', 'expired', 'revoked', 'suspended', 'non_compliant', 'overdue', 'escalated', 'action_required'].includes(normalized)) return 'danger';
  if (['watch', 'off_target', 'pending_review', 'under_review', 'evidence_required', 'minutes_pending', 'in_progress'].includes(normalized)) return 'warning';
  return 'neutral';
}

function titleFor(row: HospitalGovernanceRow): string {
  return value(row.work_title ?? row.event_title ?? row.indicator_name ?? row.meeting_title ?? row.action_title ?? row.credential_title ?? row.safety_item_title);
}

function statusFor(row: HospitalGovernanceRow): string {
  return value(row.work_status ?? row.status ?? row.performance_status ?? row.credential_status ?? row.meeting_status);
}

function GovernanceTable({ data, titleColumn = 'Item' }: { data: HospitalGovernanceRow[]; titleColumn?: string }) {
  return (
    <div className="table-scroll">
      <table className="entity-table">
        <thead>
          <tr>
            <th>{titleColumn}</th>
            <th>Status</th>
            <th>Priority</th>
            <th>Department</th>
            <th>Owner</th>
            <th>Due</th>
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr><td colSpan={6}><strong>No records returned for this register.</strong></td></tr>
          ) : data.slice(0, 100).map((row, index) => (
            <tr key={row.id ?? row.work_id ?? `${titleFor(row)}-${index}`}>
              <td><strong>{titleFor(row)}</strong><br /><small>{value(row.event_type ?? row.indicator_code ?? row.credential_type ?? row.safety_domain ?? row.work_type)}</small></td>
              <td><StatusPill tone={tone(statusFor(row))}>{statusFor(row)}</StatusPill></td>
              <td>{value(row.priority ?? row.severity)}</td>
              <td>{value(row.department_name_en ?? row.department_name ?? row.assigned_department_name)}</td>
              <td>{value(row.owner_name_en ?? row.assigned_to_name ?? row.chair_name_en ?? row.reviewer_name_en)}</td>
              <td>{value(row.due_date ?? row.expires_on ?? row.next_check_due ?? row.meeting_date ?? row.period_end)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function HospitalGovernanceCenter() {
  const [infection, setInfection] = useState<LiveResult<HospitalGovernanceRow[]>>(emptyRows('No infection control register loaded yet.'));
  const [infectionOpen, setInfectionOpen] = useState<LiveResult<HospitalGovernanceRow[]>>(emptyRows('No infection control open actions loaded yet.'));
  const [quality, setQuality] = useState<LiveResult<HospitalGovernanceRow[]>>(emptyRows('No quality indicator results loaded yet.'));
  const [offTarget, setOffTarget] = useState<LiveResult<HospitalGovernanceRow[]>>(emptyRows('No off-target indicators loaded yet.'));
  const [meetings, setMeetings] = useState<LiveResult<HospitalGovernanceRow[]>>(emptyRows('No committee meetings loaded yet.'));
  const [actions, setActions] = useState<LiveResult<HospitalGovernanceRow[]>>(emptyRows('No committee actions loaded yet.'));
  const [overdueActions, setOverdueActions] = useState<LiveResult<HospitalGovernanceRow[]>>(emptyRows('No overdue committee actions loaded yet.'));
  const [credentials, setCredentials] = useState<LiveResult<HospitalGovernanceRow[]>>(emptyRows('No credentialing records loaded yet.'));
  const [competencyGaps, setCompetencyGaps] = useState<LiveResult<HospitalGovernanceRow[]>>(emptyRows('No privileging or competency gaps loaded yet.'));
  const [facility, setFacility] = useState<LiveResult<HospitalGovernanceRow[]>>(emptyRows('No facility safety records loaded yet.'));
  const [facilityGaps, setFacilityGaps] = useState<LiveResult<HospitalGovernanceRow[]>>(emptyRows('No facility evidence gaps loaded yet.'));
  const [queue, setQueue] = useState<LiveResult<HospitalGovernanceRow[]>>(emptyRows('No hospital governance work queue loaded yet.'));
  const [blockers, setBlockers] = useState<LiveResult<HospitalGovernanceRow[]>>(emptyRows('No accreditation blockers loaded yet.'));
  const [scorecard, setScorecard] = useState<LiveResult<HospitalGovernanceRow[]>>(emptyRows('No department scorecard loaded yet.'));
  const [summary, setSummary] = useState<LiveResult<HospitalQualitySummaryRow[]>>(emptyRows('No executive hospital quality summary loaded yet.'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      const results = await Promise.all([
        getInfectionControlRegister(),
        getInfectionControlOpenActions(),
        getQualityIndicatorPerformance(),
        getQualityIndicatorOffTargetRegister(),
        getCommitteeMeetingRegister(),
        getCommitteeActionQueue(),
        getOverdueCommitteeActions(),
        getCredentialingExpiryRegister(),
        getPrivilegingCompetencyGapRegister(),
        getFacilityBiomedicalSafetyRegister(),
        getFacilitySafetyEvidenceGapRegister(),
        getHospitalGovernanceWorkQueue(),
        getAccreditationBlockerSummary(),
        getDepartmentHospitalGovernanceScorecard(),
        getExecutiveHospitalQualitySummary(),
      ]);
      if (!mounted) return;
      setInfection(results[0]);
      setInfectionOpen(results[1]);
      setQuality(results[2]);
      setOffTarget(results[3]);
      setMeetings(results[4]);
      setActions(results[5]);
      setOverdueActions(results[6]);
      setCredentials(results[7]);
      setCompetencyGaps(results[8]);
      setFacility(results[9]);
      setFacilityGaps(results[10]);
      setQueue(results[11]);
      setBlockers(results[12]);
      setScorecard(results[13]);
      setSummary(results[14]);
      setLoading(false);
    }
    void load();
    return () => { mounted = false; };
  }, []);

  const infectionRows = rows(infection);
  const infectionOpenRows = rows(infectionOpen);
  const qualityRows = rows(quality);
  const offTargetRows = rows(offTarget);
  const meetingRows = rows(meetings);
  const actionRows = rows(actions);
  const overdueActionRows = rows(overdueActions);
  const credentialRows = rows(credentials);
  const competencyGapRows = rows(competencyGaps);
  const facilityRows = rows(facility);
  const facilityGapRows = rows(facilityGaps);
  const queueRows = rows(queue);
  const blockerRows = rows(blockers);
  const scorecardRows = rows(scorecard);
  const summaryRow = rows(summary)[0] ?? {};
  const hasAnyData = infectionRows.length + qualityRows.length + meetingRows.length + actionRows.length + credentialRows.length + facilityRows.length + queueRows.length + blockerRows.length + scorecardRows.length > 0;
  const messages = useMemo(() => ([infection, infectionOpen, quality, offTarget, meetings, actions, overdueActions, credentials, competencyGaps, facility, facilityGaps, queue, blockers, scorecard, summary] as LiveResult<unknown>[])
    .filter(result => !isLive(result))
    .map(result => getLiveResultMessage(result))
    .filter((message, index, all) => all.indexOf(message) === index), [infection, infectionOpen, quality, offTarget, meetings, actions, overdueActions, credentials, competencyGaps, facility, facilityGaps, queue, blockers, scorecard, summary]);

  return (
    <div className="page-stack hospital-governance-center">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Hospital Governance Pack</p>
          <h1>Quality, infection control, credentialing, committees, and safety readiness</h1>
          <p className="section-subtitle">A hospital-specific operating view for surveillance, off-target indicators, committee actions, credentialing expiry, facility evidence gaps, accreditation blockers, and My Work compatible queues.</p>
        </div>
      </section>

      <DataState loading={loading} empty={!loading && !hasAnyData} emptyTitle="No hospital governance records are visible yet" emptyMessage={messages[0] ?? 'Create hospital governance records or apply the Patch 39 migration to load live registers.'}>
        <div className="kpi-grid">
          <KpiTile label="Open infection control" value={summaryRow.open_infection_control_count ?? infectionOpenRows.length} tone={infectionOpenRows.length > 0 ? 'warning' : 'good'} />
          <KpiTile label="Off-target indicators" value={summaryRow.off_target_indicator_count ?? offTargetRows.length} tone={offTargetRows.length > 0 ? 'warning' : 'good'} />
          <KpiTile label="Overdue committee actions" value={summaryRow.overdue_committee_action_count ?? overdueActionRows.length} tone={overdueActionRows.length > 0 ? 'danger' : 'good'} />
          <KpiTile label="Credentials due/expired" value={summaryRow.credentialing_due_or_expired_count ?? credentialRows.length} tone={credentialRows.length > 0 ? 'warning' : 'good'} />
          <KpiTile label="Facility evidence gaps" value={summaryRow.facility_safety_gap_count ?? facilityGapRows.length} tone={facilityGapRows.length > 0 ? 'warning' : 'good'} />
          <KpiTile label="Blocked clauses" value={summaryRow.accreditation_blocked_clause_count ?? blockerRows.length} tone={blockerRows.length > 0 ? 'danger' : 'good'} />
        </div>

        <ModernCard title="Hospital governance work queue"><GovernanceTable data={queueRows} /></ModernCard>
        <ModernCard title="Infection control register"><GovernanceTable data={infectionRows} titleColumn="Surveillance event" /></ModernCard>
        <ModernCard title="Infection control open actions"><GovernanceTable data={infectionOpenRows} titleColumn="Open action" /></ModernCard>
        <ModernCard title="Clinical quality indicator performance"><GovernanceTable data={qualityRows} titleColumn="Indicator" /></ModernCard>
        <ModernCard title="Off-target indicator register"><GovernanceTable data={offTargetRows} titleColumn="Off-target indicator" /></ModernCard>
        <ModernCard title="Committee meetings"><GovernanceTable data={meetingRows} titleColumn="Meeting" /></ModernCard>
        <ModernCard title="Committee actions"><GovernanceTable data={actionRows} titleColumn="Action" /></ModernCard>
        <ModernCard title="Overdue committee actions"><GovernanceTable data={overdueActionRows} titleColumn="Overdue action" /></ModernCard>
        <ModernCard title="Credentialing expiry register"><GovernanceTable data={credentialRows} titleColumn="Credential" /></ModernCard>
        <ModernCard title="Privileging and competency gaps"><GovernanceTable data={competencyGapRows} titleColumn="Gap" /></ModernCard>
        <ModernCard title="Facility and biomedical safety register"><GovernanceTable data={facilityRows} titleColumn="Safety item" /></ModernCard>
        <ModernCard title="Facility safety evidence gaps"><GovernanceTable data={facilityGapRows} titleColumn="Evidence gap" /></ModernCard>
        <ModernCard title="Accreditation blocker summary"><GovernanceTable data={blockerRows} titleColumn="Blocked clause" /></ModernCard>
        <ModernCard title="Department hospital governance scorecard"><GovernanceTable data={scorecardRows} titleColumn="Department" /></ModernCard>
      </DataState>
    </div>
  );
}
