import { useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nContext';
import { useAsyncData } from '../hooks/useAsyncData';
import { DataState } from '../components/DataState';
import { ModernCard, StatusPill } from '../components/ModernCard';
import {
  cancelTrainingAssignment,
  completeTrainingAssignment,
  decideSopRolloutRequirements,
  getCompetencyGaps,
  getSopAcknowledgmentGaps,
  getSopTrainingComplianceMatrix,
  getTrainingAssignmentQueue,
  publishSopTrainingObligations,
  recordCompetencyAssessment,
  recordDocumentAcknowledgment,
  reopenTrainingAssignment,
  startOwnTrainingAssignment,
  waiveTrainingAssignment,
  type CompetencyGapRow,
  type SopAcknowledgmentGapRow,
  type SopTrainingComplianceMatrixRow,
  type TrainingAssignmentQueueRow,
} from '../lib/trainingGovernanceApi';
import {
  canShowCompletionCertification,
  canShowEmployeeStart,
  canShowReopen,
  canShowWaiveOrCancel,
  formatCompetencyScore,
  getTrainingCompliancePersona,
  isReasonLengthValid,
  isRolloutRationaleValid,
  type CompetencyAssessmentResult,
} from '../lib/trainingComplianceModel';
import {
  Award,
  BookOpenCheck,
  CheckCircle2,
  FileCheck2,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  UserCheck,
  XCircle,
} from 'lucide-react';

type TabKey = 'my' | 'team' | 'governance';
type AdminAction = 'certify' | 'competency' | 'waive' | 'cancel' | 'reopen';

interface AdminActionState {
  type: AdminAction;
  row: TrainingAssignmentQueueRow;
}

interface RolloutState {
  row: SopTrainingComplianceMatrixRow;
  retraining_required: boolean;
  reacknowledgment_required: boolean;
  competency_reassessment_required: boolean;
  rationale: string;
}

const emptySummary: SopTrainingComplianceMatrixRow = {
  sop_version_id: 'summary',
  document_id: 'summary',
  organization_id: 'summary',
  document_code: null,
  document_title: '',
  version_number: 0,
  version_label: '',
  document_status: '',
  training_required: false,
  acknowledgment_required: false,
  competency_assessment_required: false,
  target_population_count: 0,
  training_target_count: 0,
  acknowledgment_target_count: 0,
  competency_target_count: 0,
  assigned_count: 0,
  in_progress_count: 0,
  completed_count: 0,
  overdue_count: 0,
  waived_count: 0,
  cancelled_count: 0,
  acknowledged_count: 0,
  acknowledgment_gap_count: 0,
  competency_passed_count: 0,
  competency_failed_count: 0,
  competency_pending_count: 0,
  renewal_due_count: 0,
};

function localizedName(language: 'en' | 'ar', en?: string | null, ar?: string | null): string {
  return language === 'ar' ? ar || en || '-' : en || ar || '-';
}

function statusTone(status: string): 'neutral' | 'good' | 'warning' | 'danger' {
  if (status === 'completed' || status === 'passed') return 'good';
  if (status === 'overdue' || status === 'failed' || status === 'needs_retraining') return 'danger';
  if (status === 'in_progress' || status === 'pending') return 'warning';
  return 'neutral';
}

function actionErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || '');
  if (/AUTHORIZATION_DENIED|UNAUTHORIZED|FORBIDDEN|permission/i.test(message)) {
    return 'The backend rejected this operation for the current authenticated user.';
  }
  if (/INVALID_LIFECYCLE_STATE|INVALID_ASSIGNMENT_STATUS|CANNOT_|TRAINING_NOT_REQUIRED|COMPETENCY_NOT_REQUIRED/i.test(message)) {
    return 'The operation is not valid for the current lifecycle state.';
  }
  if (/NOT_FOUND|DOCUMENT_VERSION_NOT_FOUND|ASSIGNMENT_NOT_FOUND|OBJECT_NOT_FOUND/i.test(message)) {
    return 'The selected governed record could not be found.';
  }
  if (/E2B2_MIGRATION_208_REQUIRED|SCHEMA|PGRST|42703/i.test(message)) {
    return 'The deployed database contract does not match the E2B2 frontend contract.';
  }
  return 'The action could not be completed.';
}

function sumMatrix(rows: SopTrainingComplianceMatrixRow[]): SopTrainingComplianceMatrixRow {
  return rows.reduce((acc, row) => ({
    ...acc,
    target_population_count: acc.target_population_count + row.target_population_count,
    training_target_count: acc.training_target_count + row.training_target_count,
    acknowledgment_target_count: acc.acknowledgment_target_count + row.acknowledgment_target_count,
    competency_target_count: acc.competency_target_count + row.competency_target_count,
    assigned_count: acc.assigned_count + row.assigned_count,
    in_progress_count: acc.in_progress_count + row.in_progress_count,
    completed_count: acc.completed_count + row.completed_count,
    overdue_count: acc.overdue_count + row.overdue_count,
    waived_count: acc.waived_count + row.waived_count,
    cancelled_count: acc.cancelled_count + row.cancelled_count,
    acknowledged_count: acc.acknowledged_count + row.acknowledged_count,
    acknowledgment_gap_count: acc.acknowledgment_gap_count + row.acknowledgment_gap_count,
    competency_passed_count: acc.competency_passed_count + row.competency_passed_count,
    competency_failed_count: acc.competency_failed_count + row.competency_failed_count,
    competency_pending_count: acc.competency_pending_count + row.competency_pending_count,
    renewal_due_count: acc.renewal_due_count + row.renewal_due_count,
  }), emptySummary);
}

export function TrainingGovernanceCenter() {
  const auth = useAuth();
  const { language, t } = useI18n();
  const text = language === 'ar' ? ar : en;
  const persona = useMemo(() => getTrainingCompliancePersona(auth.roles), [auth.roles]);
  const defaultTab: TabKey = persona.canViewMyObligations
    ? 'my'
    : persona.canViewTeamCompliance
      ? 'team'
      : 'governance';
  const [activeTab, setActiveTab] = useState<TabKey>(defaultTab);
  const [ackNotes, setAckNotes] = useState<Record<string, string>>({});
  const [adminAction, setAdminAction] = useState<AdminActionState | null>(null);
  const [reason, setReason] = useState('');
  const [evidenceId, setEvidenceId] = useState('');
  const [competencyArea, setCompetencyArea] = useState('');
  const [competencyResult, setCompetencyResult] = useState<CompetencyAssessmentResult>('passed');
  const [competencyScore, setCompetencyScore] = useState('');
  const [competencyNotes, setCompetencyNotes] = useState('');
  const [rollout, setRollout] = useState<RolloutState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const assignments = useAsyncData(getTrainingAssignmentQueue, []);
  const ackGaps = useAsyncData(getSopAcknowledgmentGaps, []);
  const competencyGaps = useAsyncData(getCompetencyGaps, []);
  const matrix = useAsyncData(getSopTrainingComplianceMatrix, []);

  const profileId = auth.profile?.id ?? null;
  const assignmentRows = assignments.data ?? [];
  const ackRows = ackGaps.data ?? [];
  const competencyRows = competencyGaps.data ?? [];
  const matrixRows = matrix.data ?? [];
  const matrixSummary = useMemo(() => sumMatrix(matrixRows), [matrixRows]);

  const myAssignments = profileId
    ? assignmentRows.filter((row) => row.assigned_to_user_id === profileId)
    : assignmentRows;
  const myAckRows = profileId
    ? ackRows.filter((row) => row.user_id === profileId)
    : ackRows;
  const myCompetencyRows = profileId
    ? competencyRows.filter((row) => row.user_id === profileId)
    : competencyRows;

  const refreshLiveData = async () => {
    await Promise.all([
      assignments.refresh(),
      ackGaps.refresh(),
      competencyGaps.refresh(),
      matrix.refresh(),
    ]);
  };

  const runAction = async (key: string, action: () => Promise<unknown>) => {
    setBusy(key);
    setFeedback(null);
    try {
      await action();
      setFeedback(text.actionCompleted);
      setAdminAction(null);
      setRollout(null);
      setReason('');
      setEvidenceId('');
      setCompetencyArea('');
      setCompetencyScore('');
      setCompetencyNotes('');
      await refreshLiveData();
    } catch (error) {
      setFeedback(actionErrorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const submitAdminAction = async () => {
    if (!adminAction) return;
    const row = adminAction.row;
    if (adminAction.type === 'certify') {
      await runAction(`certify:${row.id}`, () => completeTrainingAssignment({
        assignment_id: row.id,
        evidence_id: evidenceId.trim() || null,
      }));
      return;
    }
    if (adminAction.type === 'competency') {
      await runAction(`competency:${row.id}`, () => recordCompetencyAssessment({
        assignment_id: row.id,
        user_id: row.assigned_to_user_id || '',
        competency_area: competencyArea.trim(),
        result: competencyResult,
        score: competencyScore.trim() ? Number(competencyScore) : null,
        notes: competencyNotes.trim() || null,
      }));
      return;
    }
    if (!isReasonLengthValid(reason)) {
      setFeedback(text.reasonInvalid);
      return;
    }
    if (adminAction.type === 'waive') {
      await runAction(`waive:${row.id}`, () => waiveTrainingAssignment({ assignment_id: row.id, reason }));
    } else if (adminAction.type === 'cancel') {
      await runAction(`cancel:${row.id}`, () => cancelTrainingAssignment({ assignment_id: row.id, reason }));
    } else {
      await runAction(`reopen:${row.id}`, () => reopenTrainingAssignment({ assignment_id: row.id, reason }));
    }
  };

  const submitRollout = async () => {
    if (!rollout) return;
    if (!isRolloutRationaleValid(rollout.rationale)) {
      setFeedback(text.rationaleInvalid);
      return;
    }
    await runAction(`rollout:${rollout.row.sop_version_id}`, () => decideSopRolloutRequirements({
      version_id: rollout.row.sop_version_id,
      retraining_required: rollout.retraining_required,
      reacknowledgment_required: rollout.reacknowledgment_required,
      competency_reassessment_required: rollout.competency_reassessment_required,
      rationale: rollout.rationale,
    }));
  };

  const tabs: Array<{ id: TabKey; label: string; enabled: boolean; icon: typeof UserCheck }> = [
    { id: 'my', label: t('training.e2b2.myObligations', text.myObligations), enabled: persona.canViewMyObligations, icon: UserCheck },
    { id: 'team', label: t('training.e2b2.teamCompliance', text.teamCompliance), enabled: persona.canViewTeamCompliance, icon: ShieldCheck },
    { id: 'governance', label: t('training.e2b2.trainingCompliance', text.trainingCompliance), enabled: persona.canViewGovernanceCompliance, icon: Award },
  ];

  return (
    <section className="page-section training-page">
      <div className="section-heading command-hero">
        <div>
          <p className="eyebrow">{text.eyebrow}</p>
          <h3>{text.title}</h3>
          <p className="section-subtitle">{text.subtitle}</p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <BookOpenCheck size={20} />
          <div className="stat-value">{matrixSummary.training_target_count}</div>
          <div className="stat-label">{text.trainingRequired}</div>
        </div>
        <div className="stat-card warning">
          <FileCheck2 size={20} />
          <div className="stat-value">{matrixSummary.acknowledgment_gap_count}</div>
          <div className="stat-label">{text.acknowledgmentGaps}</div>
        </div>
        <div className="stat-card danger">
          <XCircle size={20} />
          <div className="stat-value">{matrixSummary.competency_failed_count}</div>
          <div className="stat-label">{text.competencyGaps}</div>
        </div>
        <div className="stat-card success">
          <CheckCircle2 size={20} />
          <div className="stat-value">{matrixSummary.completed_count}</div>
          <div className="stat-label">{text.completed}</div>
        </div>
      </div>

      <div className="hub-tab-layout">
        <div className="hub-tab-rail panel">
          {tabs.filter((tab) => tab.enabled).map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className={`hub-tab-button ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="hub-tab-content">
          {feedback && <div className="panel muted-panel">{feedback}</div>}

          {activeTab === 'my' && persona.canViewMyObligations && (
            <div className="tab-pane" data-e2b2-persona="employee">
              <ModernCard title={text.myObligations} subtitle={text.myObligationsSubtitle}>
                <DataState
                  loading={assignments.loading && ackGaps.loading && competencyGaps.loading}
                  error={assignments.error || ackGaps.error || competencyGaps.error}
                  empty={myAssignments.length === 0 && myAckRows.length === 0 && myCompetencyRows.length === 0}
                  emptyTitle={text.noMyObligations}
                  emptyMessage={text.noMyObligations}
                >
                  <div className="table-wrap">
                    <table className="entity-table">
                      <thead>
                        <tr>
                          <th>{text.obligation}</th>
                          <th>{text.sopVersion}</th>
                          <th>{text.dueDate}</th>
                          <th>{text.status}</th>
                          <th>{text.actions}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {myAssignments.map((row) => (
                          <tr key={`assignment-${row.id}`}>
                            <td>{localizedName(language, row.program_title, row.program_title_ar)}</td>
                            <td>{[row.document_code, row.version_label].filter(Boolean).join(' / ') || '-'}</td>
                            <td>{row.due_date || '-'}</td>
                            <td><StatusPill tone={statusTone(row.status)}>{row.status}</StatusPill></td>
                            <td>
                              {persona.canStartOwnTraining && canShowEmployeeStart(row.status) && (
                                <button
                                  className="btn-secondary"
                                  disabled={busy === `start:${row.id}`}
                                  onClick={() => runAction(`start:${row.id}`, () => startOwnTrainingAssignment(row.id))}
                                >
                                  {text.startTraining}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                        {myAckRows.map((row) => (
                          <tr key={`ack-${row.linked_sop_id}-${row.version_id}`}>
                            <td>
                              <strong>{row.document_code || '-'}</strong>
                              <div>{localizedName(language, row.sop_title, row.sop_title_ar)}</div>
                              <small>{language === 'ar' ? ar.attestation : en.attestation}</small>
                            </td>
                            <td>{row.version_label || '-'}</td>
                            <td>{row.due_date || '-'}</td>
                            <td><StatusPill tone="warning">{text.assigned}</StatusPill></td>
                            <td>
                              <textarea
                                aria-label={text.acknowledgmentNote}
                                value={ackNotes[row.version_id] ?? ''}
                                onChange={(event) => setAckNotes({ ...ackNotes, [row.version_id]: event.target.value })}
                                placeholder={text.acknowledgmentNote}
                                rows={2}
                              />
                              {persona.canAcknowledgeOwnVersion && row.linked_sop_id && (
                                <button
                                  className="btn-primary"
                                  disabled={busy === `ack:${row.version_id}`}
                                  onClick={() => runAction(`ack:${row.version_id}`, () => recordDocumentAcknowledgment({
                                    document_id: row.linked_sop_id as string,
                                    version_id: row.version_id,
                                    acknowledgment_note: ackNotes[row.version_id] ?? null,
                                  }))}
                                >
                                  {text.acknowledge}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                        {myCompetencyRows.map((row) => (
                          <tr key={`competency-${row.assignment_id ?? row.user_id}-${row.competency_area ?? 'pending'}`}>
                            <td>{row.competency_area || text.competencyRequired}</td>
                            <td>{[row.document_code, row.version_label].filter(Boolean).join(' / ') || '-'}</td>
                            <td>{row.due_date || '-'}</td>
                            <td><StatusPill tone={statusTone(row.result || 'pending')}>{row.result || 'pending'}</StatusPill></td>
                            <td>{formatCompetencyScore(row.score)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </DataState>
              </ModernCard>
            </div>
          )}

          {activeTab === 'team' && persona.canViewTeamCompliance && (
            <div className="tab-pane" data-e2b2-persona="manager">
              <ModernCard title={text.teamCompliance} subtitle={text.teamComplianceSubtitle}>
                <DataState
                  loading={assignments.loading}
                  error={assignments.error}
                  empty={assignmentRows.length === 0}
                  emptyTitle={text.noTeamObligations}
                  emptyMessage={text.noTeamObligations}
                >
                  <div className="table-wrap">
                    <table className="entity-table">
                      <thead>
                        <tr>
                          <th>{text.employee}</th>
                          <th>{text.department}</th>
                          <th>{text.trainingStatus}</th>
                          <th>{text.sopVersion}</th>
                          <th>{text.dueDate}</th>
                          <th>{text.actions}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {assignmentRows.map((row) => (
                          <tr key={row.id}>
                            <td>{localizedName(language, row.assigned_user_name_en, row.assigned_user_name_ar)}</td>
                            <td>{localizedName(language, row.department_name_en, row.department_name_ar)}</td>
                            <td><StatusPill tone={statusTone(row.status)}>{row.status}</StatusPill></td>
                            <td>{[row.document_code, row.version_label].filter(Boolean).join(' / ') || localizedName(language, row.program_title, row.program_title_ar)}</td>
                            <td>{row.due_date || '-'}</td>
                            <td>
                              {persona.canCertifyCompletionCandidate && canShowCompletionCertification(row.status) && (
                                <button className="btn-secondary" onClick={() => setAdminAction({ type: 'certify', row })}>{text.certifyCompletion}</button>
                              )}
                              {persona.canRecordCompetencyCandidate && (
                                <button className="btn-secondary" onClick={() => setAdminAction({ type: 'competency', row })}>{text.recordCompetency}</button>
                              )}
                              {persona.canAdministerAssignmentCandidate && canShowWaiveOrCancel(row.status) && (
                                <>
                                  <button className="btn-secondary" onClick={() => setAdminAction({ type: 'waive', row })}>{text.waive}</button>
                                  <button className="btn-secondary" onClick={() => setAdminAction({ type: 'cancel', row })}>{text.cancel}</button>
                                </>
                              )}
                              {persona.canAdministerAssignmentCandidate && canShowReopen(row.status) && (
                                <button className="btn-secondary" onClick={() => setAdminAction({ type: 'reopen', row })}>{text.reopen}</button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </DataState>
              </ModernCard>
              {adminAction && (
                <ModernCard title={text.actionDetails}>
                  <div className="form-grid">
                    {adminAction.type === 'certify' && (
                      <label>
                        {text.evidenceId}
                        <input value={evidenceId} onChange={(event) => setEvidenceId(event.target.value)} />
                      </label>
                    )}
                    {adminAction.type === 'competency' && (
                      <>
                        <label>
                          {text.competencyArea}
                          <input value={competencyArea} onChange={(event) => setCompetencyArea(event.target.value)} />
                        </label>
                        <label>
                          {text.result}
                          <select value={competencyResult} onChange={(event) => setCompetencyResult(event.target.value as CompetencyAssessmentResult)}>
                            <option value="passed">passed</option>
                            <option value="failed">failed</option>
                            <option value="needs_retraining">needs_retraining</option>
                            <option value="pending">pending</option>
                          </select>
                        </label>
                        <label>
                          {text.score}
                          <input type="number" value={competencyScore} onChange={(event) => setCompetencyScore(event.target.value)} />
                        </label>
                        <label>
                          {text.notes}
                          <textarea value={competencyNotes} onChange={(event) => setCompetencyNotes(event.target.value)} />
                        </label>
                      </>
                    )}
                    {['waive', 'cancel', 'reopen'].includes(adminAction.type) && (
                      <label>
                        {text.reason}
                        <textarea value={reason} onChange={(event) => setReason(event.target.value)} />
                      </label>
                    )}
                  </div>
                  <button className="btn-primary" disabled={Boolean(busy)} onClick={submitAdminAction}>
                    {adminAction.type === 'certify' ? text.certifyCompletion
                      : adminAction.type === 'competency' ? text.recordCompetency
                        : adminAction.type === 'waive' ? text.waive
                          : adminAction.type === 'cancel' ? text.cancel
                            : text.reopen}
                  </button>
                </ModernCard>
              )}
            </div>
          )}

          {activeTab === 'governance' && persona.canViewGovernanceCompliance && (
            <div className="tab-pane" data-e2b2-persona={persona.isReadOnlyGlobal ? 'read-only-global' : 'governance'}>
              <ModernCard title={text.trainingCompliance} subtitle={persona.isReadOnlyGlobal ? text.readOnly : text.governanceSubtitle}>
                <DataState
                  loading={matrix.loading}
                  error={matrix.error}
                  empty={matrixRows.length === 0}
                  emptyTitle={text.noGovernedObligations}
                  emptyMessage={text.noGovernedObligations}
                >
                  <div className="table-wrap">
                    <table className="entity-table">
                      <thead>
                        <tr>
                          <th>{text.sopVersion}</th>
                          <th>{text.requirements}</th>
                          <th>{text.population}</th>
                          <th>{text.statusCounts}</th>
                          <th>{text.acknowledgment}</th>
                          <th>{text.competency}</th>
                          <th>{text.actions}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {matrixRows.map((row) => (
                          <tr key={row.sop_version_id}>
                            <td>
                              <strong>{row.document_code || '-'}</strong>
                              <div>{row.document_title}</div>
                              <small>{row.version_label} / {row.document_status}</small>
                            </td>
                            <td>
                              <StatusPill tone={row.training_required ? 'warning' : 'neutral'}>{text.trainingRequired}: {row.training_required ? text.yes : text.no}</StatusPill>
                              <StatusPill tone={row.acknowledgment_required ? 'warning' : 'neutral'}>{text.acknowledgmentRequired}: {row.acknowledgment_required ? text.yes : text.no}</StatusPill>
                              <StatusPill tone={row.competency_assessment_required ? 'warning' : 'neutral'}>{text.competencyRequired}: {row.competency_assessment_required ? text.yes : text.no}</StatusPill>
                            </td>
                            <td>
                              {text.targetPopulation}: {row.target_population_count}<br />
                              {text.trainingRequired}: {row.training_target_count}<br />
                              {text.acknowledgmentRequired}: {row.acknowledgment_target_count}<br />
                              {text.competencyRequired}: {row.competency_target_count}
                            </td>
                            <td>
                              {text.assigned}: {row.assigned_count}<br />
                              {text.inProgress}: {row.in_progress_count}<br />
                              {text.completed}: {row.completed_count}<br />
                              {text.overdue}: {row.overdue_count}<br />
                              {text.waived}: {row.waived_count}<br />
                              {text.cancelled}: {row.cancelled_count}
                            </td>
                            <td>
                              {text.acknowledged}: {row.acknowledged_count}<br />
                              {text.gap}: {row.acknowledgment_gap_count}
                            </td>
                            <td>
                              {text.passed}: {row.competency_passed_count}<br />
                              {text.failed}: {row.competency_failed_count}<br />
                              {text.pending}: {row.competency_pending_count}<br />
                              {text.renewalDue}: {row.renewal_due_count}
                            </td>
                            <td>
                              {persona.canDecideRollout && (
                                <button className="btn-secondary" onClick={() => setRollout({
                                  row,
                                  retraining_required: row.training_required,
                                  reacknowledgment_required: row.acknowledgment_required,
                                  competency_reassessment_required: row.competency_assessment_required,
                                  rationale: '',
                                })}>
                                  <SlidersHorizontal size={14} />
                                  {text.rolloutDecision}
                                </button>
                              )}
                              {persona.canPublishObligations && (
                                <button
                                  className="btn-primary"
                                  disabled={busy === `publish:${row.sop_version_id}`}
                                  onClick={() => runAction(`publish:${row.sop_version_id}`, () => publishSopTrainingObligations(row.sop_version_id))}
                                >
                                  <RotateCcw size={14} />
                                  {text.publishTrainingObligations}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </DataState>
              </ModernCard>
              {rollout && (
                <ModernCard title={text.rolloutDecision}>
                  <div className="form-grid">
                    <label>
                      <input
                        type="checkbox"
                        checked={rollout.retraining_required}
                        onChange={(event) => setRollout({ ...rollout, retraining_required: event.target.checked })}
                      />
                      {text.trainingRequired}
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={rollout.reacknowledgment_required}
                        onChange={(event) => setRollout({ ...rollout, reacknowledgment_required: event.target.checked })}
                      />
                      {text.acknowledgmentRequired}
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={rollout.competency_reassessment_required}
                        onChange={(event) => setRollout({ ...rollout, competency_reassessment_required: event.target.checked })}
                      />
                      {text.competencyRequired}
                    </label>
                    <label>
                      {text.rationale}
                      <textarea value={rollout.rationale} onChange={(event) => setRollout({ ...rollout, rationale: event.target.value })} />
                    </label>
                  </div>
                  <button className="btn-primary" disabled={Boolean(busy)} onClick={submitRollout}>
                    {text.rolloutDecision}
                  </button>
                </ModernCard>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

const en = {
  eyebrow: 'Governed Training',
  title: 'Training Governance Center',
  subtitle: 'Formal training, SOP acknowledgments, and competency assessment governance.',
  myObligations: 'My Obligations',
  myObligationsSubtitle: 'Assigned formal training, exact SOP version acknowledgments, and competency status visible to you.',
  teamCompliance: 'Team Compliance',
  teamComplianceSubtitle: 'Scoped team training obligations visible through RLS and security-invoker views.',
  trainingCompliance: 'Training & Compliance',
  governanceSubtitle: 'Published SOP version requirements, target populations, and compliance status.',
  readOnly: 'Read-only governance view.',
  noMyObligations: 'No training or acknowledgment obligations are currently assigned.',
  noTeamObligations: 'No scoped team training obligations are currently visible.',
  noGovernedObligations: 'No governed SOP training obligations have been published yet.',
  obligation: 'Obligation',
  sopVersion: 'SOP / Version',
  dueDate: 'Due Date',
  status: 'State',
  actions: 'Actions',
  assigned: 'Assigned',
  inProgress: 'In Progress',
  completed: 'Completed',
  overdue: 'Overdue',
  waived: 'Waived',
  cancelled: 'Cancelled',
  startTraining: 'Start Training',
  acknowledge: 'Acknowledge',
  attestation: 'I confirm that I have read and understood this governed SOP version.',
  acknowledgmentNote: 'Optional acknowledgment note',
  employee: 'Employee',
  department: 'Department',
  trainingStatus: 'Training Status',
  certifyCompletion: 'Certify Completion',
  recordCompetency: 'Record Competency',
  waive: 'Waive',
  cancel: 'Cancel',
  reopen: 'Reopen',
  actionDetails: 'Action Details',
  evidenceId: 'Evidence ID',
  competencyArea: 'Competency Area',
  result: 'Result',
  score: 'Score',
  notes: 'Notes',
  reason: 'Reason',
  reasonInvalid: 'Reason must be 3 to 1000 characters.',
  rationale: 'Rationale',
  rationaleInvalid: 'Rationale must be 5 to 4000 characters.',
  actionCompleted: 'Action completed. Live obligations refreshed.',
  trainingRequired: 'Training Required',
  acknowledgmentRequired: 'Acknowledgment Required',
  competencyRequired: 'Competency Required',
  acknowledgmentGaps: 'Acknowledgment Gaps',
  competencyGaps: 'Competency Gaps',
  requirements: 'Requirements',
  population: 'Population',
  statusCounts: 'Status Counts',
  acknowledgment: 'Acknowledgment',
  competency: 'Competency',
  targetPopulation: 'Target Population',
  acknowledged: 'Acknowledged',
  gap: 'Gap',
  passed: 'Passed',
  failed: 'Failed',
  pending: 'Pending',
  renewalDue: 'Renewal Due',
  rolloutDecision: 'Rollout Decision',
  publishTrainingObligations: 'Publish Training Obligations',
  yes: 'Yes',
  no: 'No',
};

const ar: typeof en = {
  eyebrow: 'التدريب المحكوم',
  title: 'مركز حوكمة التدريب',
  subtitle: 'حوكمة التدريب الرسمي وإقرارات نسخ إجراءات التشغيل وتقييم الكفاءة.',
  myObligations: 'التزاماتي',
  myObligationsSubtitle: 'التدريب الرسمي وإقرارات النسخ وحالة الكفاءة الظاهرة لك.',
  teamCompliance: 'امتثال الفريق',
  teamComplianceSubtitle: 'التزامات تدريب الفريق ضمن النطاق الظاهر عبر سياسات RLS والعروض الآمنة.',
  trainingCompliance: 'التدريب والامتثال',
  governanceSubtitle: 'متطلبات نسخ إجراءات التشغيل المنشورة والفئات المستهدفة وحالة الامتثال.',
  readOnly: 'عرض حوكمي للقراءة فقط.',
  noMyObligations: 'لا توجد التزامات تدريب أو إقرار معينة حالياً.',
  noTeamObligations: 'لا توجد التزامات تدريب فريق ظاهرة ضمن نطاقك حالياً.',
  noGovernedObligations: 'لم يتم نشر التزامات تدريب لإجراءات تشغيل محكومة بعد.',
  obligation: 'الالتزام',
  sopVersion: 'الإجراء / النسخة',
  dueDate: 'تاريخ الاستحقاق',
  status: 'الحالة',
  actions: 'الإجراءات',
  assigned: 'معين',
  inProgress: 'قيد التنفيذ',
  completed: 'مكتمل',
  overdue: 'متأخر',
  waived: 'معفى',
  cancelled: 'ملغى',
  startTraining: 'بدء التدريب',
  acknowledge: 'إقرار',
  attestation: 'أؤكد أنني قرأت وفهمت هذه النسخة المحكومة من إجراء التشغيل.',
  acknowledgmentNote: 'ملاحظة إقرار اختيارية',
  employee: 'الموظف',
  department: 'القسم',
  trainingStatus: 'حالة التدريب',
  certifyCompletion: 'اعتماد الإكمال',
  recordCompetency: 'تسجيل الكفاءة',
  waive: 'إعفاء',
  cancel: 'إلغاء',
  reopen: 'إعادة فتح',
  actionDetails: 'تفاصيل الإجراء',
  evidenceId: 'معرف الدليل',
  competencyArea: 'مجال الكفاءة',
  result: 'النتيجة',
  score: 'الدرجة',
  notes: 'ملاحظات',
  reason: 'السبب',
  reasonInvalid: 'يجب أن يكون السبب بين 3 و1000 حرف.',
  rationale: 'المبرر',
  rationaleInvalid: 'يجب أن يكون المبرر بين 5 و4000 حرف.',
  actionCompleted: 'اكتمل الإجراء وتم تحديث الالتزامات الحية.',
  trainingRequired: 'التدريب مطلوب',
  acknowledgmentRequired: 'الإقرار مطلوب',
  competencyRequired: 'الكفاءة مطلوبة',
  acknowledgmentGaps: 'فجوات الإقرار',
  competencyGaps: 'فجوات الكفاءة',
  requirements: 'المتطلبات',
  population: 'الفئة المستهدفة',
  statusCounts: 'أعداد الحالات',
  acknowledgment: 'الإقرار',
  competency: 'الكفاءة',
  targetPopulation: 'الفئة المستهدفة',
  acknowledged: 'تم الإقرار',
  gap: 'الفجوة',
  passed: 'ناجح',
  failed: 'راسب',
  pending: 'معلق',
  renewalDue: 'مستحق التجديد',
  rolloutDecision: 'قرار النشر',
  publishTrainingObligations: 'نشر التزامات التدريب',
  yes: 'نعم',
  no: 'لا',
};
