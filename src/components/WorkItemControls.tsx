import { type FormEvent, useEffect, useState } from 'react';
import type { PriorityLevel, ProfileOption, ProjectStatus, WorkStatus } from '../types/domain';
import { assignWorkItem, cancelWorkItemAssignment, getEligibleApprovers, requestApproval, respondToWorkItemAssignment, updateMilestoneStatus, updateProjectStatus, updateTaskStatus, uploadEvidenceForItem, type WorkItemAssignmentSummary } from '../lib/grcApi';
import { ScenarioFillButton } from './ScenarioFillButton';
import {
  createScenarioLabScenario,
  V99_SCENARIO_TAG,
} from '../lib/scenarioLab';
import { useI18n } from '../i18n/I18nContext';
import { useAuth } from '../auth/AuthProvider';
import { humanize } from '../lib/format';

export type ControllableItemType = 'project' | 'milestone' | 'task';
export type EvidenceUploadItemType =
  | 'project'
  | 'milestone'
  | 'task'
  | 'ovr_report';

const workStatusOptions: WorkStatus[] = [
  'not_started',
  'in_progress',
  'at_risk',
  'delayed',
  'evidence_submitted',
  'approved',
  'rejected',
  'closed',
  'cancelled'
];

const projectStatusOptions: ProjectStatus[] = [
  'draft',
  'pending_approval',
  'active',
  'at_risk',
  'delayed',
  'completed_pending_evidence',
  'completed_pending_approval',
  'closed',
  'cancelled'
];

interface StatusUpdateFormProps {
  itemType: ControllableItemType;
  itemId: string;
  currentStatus: ProjectStatus | WorkStatus;
  currentProgress?: number | null;
  onCancel: () => void;
  onUpdated: () => void;
}

export function StatusUpdateForm({ itemType, itemId, currentStatus, currentProgress, onCancel, onUpdated }: StatusUpdateFormProps) {
  const { t } = useI18n();
  const [status, setStatus] = useState(currentStatus);
  const [progress, setProgress] = useState(currentProgress ?? 0);
  const [delayReason, setDelayReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const options = itemType === 'project' ? projectStatusOptions : workStatusOptions;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (status === 'delayed' && !delayReason.trim()) {
      setError(t('workControl.delayReasonRequired'));
      return;
    }

    setSaving(true);
    try {
      if (itemType === 'project') {
        await updateProjectStatus(itemId, status as ProjectStatus, progress, delayReason.trim() || undefined);
      } else if (itemType === 'milestone') {
        await updateMilestoneStatus(itemId, status as WorkStatus, progress, delayReason.trim() || undefined);
      } else {
        await updateTaskStatus(itemId, status as WorkStatus, progress, delayReason.trim() || undefined);
      }
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('workControl.statusUpdateFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      {error ? <div className="form-error">{error}</div> : null}
      <label className="field">
        <span>{t('common.status')}</span>
        <select value={status} onChange={event => setStatus(event.target.value as typeof status)}>
          {options.map(item => <option key={item} value={item}>{t(`status.${item}`, item.replaceAll('_', ' '))}</option>)}
        </select>
      </label>
      <label className="field">
        <span>{t('workControl.progressPercent')}</span>
        <input type="number" min="0" max="100" value={progress} onChange={event => setProgress(Number(event.target.value))} />
      </label>
      <label className="field full-width">
        <span>{t('workControl.delayReason')} {status === 'delayed' ? '*' : ''}</span>
        <textarea value={delayReason} onChange={event => setDelayReason(event.target.value)} placeholder={t('workControl.delayReasonHint')} />
      </label>
      <div className="form-actions full-width">
        <button className="ghost-button" type="button" onClick={onCancel}>{t('common.cancel')}</button>
        <button className="primary-button" disabled={saving}>{saving ? t('common.saving') : t('workControl.updateStatus')}</button>
      </div>
    </form>
  );
}

interface EvidenceUploadFormProps {
  organizationId: string;
  itemType: EvidenceUploadItemType;
  itemId: string;
  onCancel: () => void;
  onUploaded: () => void;
}

export function EvidenceUploadForm({ organizationId, itemType, itemId, onCancel, onUploaded }: EvidenceUploadFormProps) {
  const { t } = useI18n();
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!file) {
      setError(t('workControl.selectFile'));
      return;
    }
    setSaving(true);
    try {
      if (description.includes(V99_SCENARIO_TAG)) {
        await createScenarioLabScenario('evidence');
        onUploaded();
        return;
      }
      await uploadEvidenceForItem({ organization_id: organizationId, item_type: itemType, item_id: itemId, file, description: description.trim() || undefined });
      onUploaded();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('workControl.uploadFailed'));
    } finally {
      setSaving(false);
    }
  }

  function fillSyntheticEvidence() {
    setFile(new File(
      [
        `${V99_SCENARIO_TAG}\n`,
        'Synthetic controlled-pilot evidence only.\n',
        'No patient identifiers or confidential content.\n',
      ],
      `${V99_SCENARIO_TAG}-synthetic-evidence.txt`,
      { type: 'text/plain' },
    ));
    setDescription(
      `[${V99_SCENARIO_TAG}] Synthetic evidence metadata. `
      + 'Submitting this test fill creates a cleanup-registered Scenario Lab record.',
    );
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      {error ? <div className="form-error">{error}</div> : null}
      <div className="full-width">
        <ScenarioFillButton onClick={fillSyntheticEvidence} />
        {file?.name.includes(V99_SCENARIO_TAG)
          ? <p className="muted">{t('workControl.preparedFile')}: {file.name}</p>
          : null}
      </div>
      <label className="field full-width">
        <span>{t('workControl.evidenceFile')} *</span>
        <input type="file" onChange={event => setFile(event.target.files?.[0] ?? null)} />
      </label>
      <label className="field full-width">
        <span>{t('common.description')}</span>
        <textarea value={description} onChange={event => setDescription(event.target.value)} placeholder={t('workControl.evidenceDescriptionHint')} />
      </label>
      <div className="notice-banner full-width">
        {t('workControl.privateEvidencePrefix')} <strong>grc-evidence</strong> {t('workControl.privateEvidenceSuffix')}
      </div>
      <div className="form-actions full-width">
        <button className="ghost-button" type="button" onClick={onCancel}>{t('common.cancel')}</button>
        <button className="primary-button" disabled={saving || !file}>{saving ? t('workControl.uploading') : t('workControl.uploadEvidence')}</button>
      </div>
    </form>
  );
}

interface ApprovalRequestFormProps {
  organizationId: string;
  itemType: ControllableItemType;
  itemId: string;
  onCancel: () => void;
  onRequested: () => void;
}

export function ApprovalRequestForm({ organizationId, itemType, itemId, onCancel, onRequested }: ApprovalRequestFormProps) {
  const { t, language } = useI18n();
  const auth = useAuth();
  const [approverId, setApproverId] = useState('');
  const [eligibleApprovers, setEligibleApprovers] = useState<ProfileOption[]>([]);
  const [approversLoading, setApproversLoading] = useState(true);
  const [note, setNote] = useState(() => t('workControl.defaultRequestNote'));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setApproversLoading(true);
    void getEligibleApprovers({ itemType, itemId })
      .then(rows => {
        if (!active) return;
        setEligibleApprovers(rows.filter(person => person.id !== auth.session?.user.id));
      })
      .catch(() => {
        if (active) setError(t('workControl.approverListUnavailable'));
      })
      .finally(() => {
        if (active) setApproversLoading(false);
      });
    return () => { active = false; };
  }, [auth.session?.user.id, itemId, itemType, t]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!approverId) {
      setError(t('workControl.selectApproverError'));
      return;
    }
    if (approverId === auth.session?.user.id) {
      setError(t('workControl.selfApprovalBlocked', 'You cannot approve your own request. Select another authorized approver.'));
      return;
    }
    setSaving(true);
    try {
      await requestApproval({ organization_id: organizationId, item_type: itemType, item_id: itemId, approver_id: approverId, request_note: note.trim() || undefined });
      onRequested();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('workControl.requestFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      {error ? <div className="form-error">{error}</div> : null}
      <label className="field full-width">
        <span>{t('approvals.approver')} *</span>
        <select value={approverId} onChange={event => setApproverId(event.target.value)}>
          <option value="">{t('workControl.selectApprover')}</option>
          {eligibleApprovers.map(person => <option key={person.id} value={person.id}>{language === 'ar' && person.full_name_ar ? person.full_name_ar : person.full_name_en}</option>)}
        </select>
        {approversLoading ? <span className="muted">{t('workControl.loadingApprovers')}</span> : null}
      </label>
      <label className="field full-width">
        <span>{t('workControl.requestNote')}</span>
        <textarea value={note} onChange={event => setNote(event.target.value)} />
      </label>
      <div className="form-actions full-width">
        <button className="ghost-button" type="button" onClick={onCancel}>{t('common.cancel')}</button>
        <button className="primary-button" disabled={saving || approversLoading || !approverId}>{saving ? t('common.sending') : t('workControl.requestApproval')}</button>
      </div>
    </form>
  );
}

interface AssignmentResponseFormProps {
  assignmentId: string;
  onCancel: () => void;
  onResponded: () => void;
}

export function AssignmentResponseForm({ assignmentId, onCancel, onResponded }: AssignmentResponseFormProps) {
  const { t } = useI18n();
  const [decision, setDecision] = useState<'accepted' | 'declined'>('accepted');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (decision === 'declined' && !reason.trim()) {
      setError(t('workControl.declineReasonRequired', 'A decline reason is required.'));
      return;
    }
    setSaving(true);
    try {
      await respondToWorkItemAssignment({ assignment_id: assignmentId, decision, decline_reason: reason.trim() || undefined });
      onResponded();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('workControl.assignmentResponseFailed', 'The assignment response was not recorded.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      {error ? <div className="form-error full-width">{error}</div> : null}
      <label className="field full-width">
        <span>{t('workControl.assignmentDecision', 'Assignment decision')}</span>
        <select value={decision} onChange={event => setDecision(event.target.value as 'accepted' | 'declined')}>
          <option value="accepted">{t('assignment.accept', 'Accept assignment')}</option>
          <option value="declined">{t('assignment.decline', 'Decline assignment')}</option>
        </select>
      </label>
      {decision === 'declined' ? (
        <label className="field full-width">
          <span>{t('workControl.declineReason', 'Decline reason')} *</span>
          <textarea value={reason} onChange={event => setReason(event.target.value)} />
        </label>
      ) : null}
      <div className="form-actions full-width">
        <button className="ghost-button" type="button" onClick={onCancel}>{t('common.cancel')}</button>
        <button className="primary-button" disabled={saving}>{saving ? t('common.saving') : t('common.confirm', 'Confirm')}</button>
      </div>
    </form>
  );
}

interface AssignmentManagementFormProps {
  itemType: ControllableItemType;
  itemId: string;
  profiles: ProfileOption[];
  currentAssignment?: WorkItemAssignmentSummary;
  onCancel: () => void;
  onCompleted: () => void;
}

export function AssignmentManagementForm({ itemType, itemId, profiles, currentAssignment, onCancel, onCompleted }: AssignmentManagementFormProps) {
  const { t, language } = useI18n();
  const [assigneeId, setAssigneeId] = useState(currentAssignment?.assignee_id || '');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function assign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!assigneeId) return setError(t('assignment.assigneeRequired', 'Select an assignee.'));
    setSaving(true); setError(null);
    try {
      await assignWorkItem({ item_type: itemType, item_id: itemId, assignee_id: assigneeId, reason: reason.trim() || undefined });
      onCompleted();
    } catch (err) { setError(err instanceof Error ? err.message : t('assignment.updateFailed', 'The assignment was not updated.')); }
    finally { setSaving(false); }
  }

  async function cancelPending() {
    if (!currentAssignment || !reason.trim()) return setError(t('assignment.cancelReasonRequired', 'A cancellation reason is required.'));
    setSaving(true); setError(null);
    try {
      await cancelWorkItemAssignment({ assignment_id: currentAssignment.assignment_id, reason: reason.trim() });
      onCompleted();
    } catch (err) { setError(err instanceof Error ? err.message : t('assignment.cancelFailed', 'The pending assignment was not cancelled.')); }
    finally { setSaving(false); }
  }

  return <form className="form-grid" onSubmit={assign}>
    {error ? <div className="form-error full-width">{error}</div> : null}
    {currentAssignment ? <div className="notice-banner full-width">{currentAssignment.assignee_name} · {t(`assignment.${currentAssignment.assignment_status}`, humanize(currentAssignment.assignment_status))}</div> : null}
    <label className="field full-width"><span>{t('common.assignee', 'Assignee')}</span><select value={assigneeId} onChange={event => setAssigneeId(event.target.value)}><option value="">—</option>{profiles.map(profile => <option key={profile.id} value={profile.id}>{language === 'ar' && profile.full_name_ar ? profile.full_name_ar : profile.full_name_en}</option>)}</select></label>
    <label className="field full-width"><span>{t('common.reason', 'Reason')}</span><textarea value={reason} onChange={event => setReason(event.target.value)} /></label>
    <div className="form-actions full-width"><button className="ghost-button" type="button" onClick={onCancel}>{t('common.cancel')}</button>{currentAssignment?.assignment_status === 'pending' ? <button className="ghost-button" type="button" disabled={saving} onClick={cancelPending}>{t('assignment.cancelPending', 'Cancel pending')}</button> : null}<button className="primary-button" disabled={saving || !assigneeId}>{saving ? t('common.saving') : t(currentAssignment ? 'assignment.reassign' : 'assignment.assign', currentAssignment ? 'Reassign' : 'Assign')}</button></div>
  </form>;
}

interface WorkControlButtonsProps {
  onStatus: () => void;
  onEvidence: () => void;
  onApproval: () => void;
  canUpdateStatus?: boolean;
}

export function WorkControlButtons({ onStatus, onEvidence, onApproval, canUpdateStatus = true }: WorkControlButtonsProps) {
  const { t } = useI18n();
  return (
    <div className="inline-actions">
      {canUpdateStatus ? <button className="ghost-button compact-button" type="button" onClick={onStatus}>{t('common.status')}</button> : null}
      <button className="ghost-button compact-button" type="button" onClick={onEvidence}>{t('common.evidence')}</button>
      <button className="ghost-button compact-button" type="button" onClick={onApproval}>{t('common.approval')}</button>
    </div>
  );
}
