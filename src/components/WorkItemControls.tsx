import { type FormEvent, useState } from 'react';
import type { PriorityLevel, ProfileOption, ProjectStatus, WorkStatus } from '../types/domain';
import { requestApproval, updateMilestoneStatus, updateProjectStatus, updateTaskStatus, uploadEvidenceForItem } from '../lib/grcApi';
import { ScenarioFillButton } from './ScenarioFillButton';
import {
  createScenarioLabScenario,
  V99_SCENARIO_TAG,
} from '../lib/scenarioLab';
import { useI18n } from '../i18n/I18nContext';

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
  profiles: ProfileOption[];
  onCancel: () => void;
  onRequested: () => void;
}

export function ApprovalRequestForm({ organizationId, itemType, itemId, profiles, onCancel, onRequested }: ApprovalRequestFormProps) {
  const { t, language } = useI18n();
  const [approverId, setApproverId] = useState('');
  const [note, setNote] = useState(() => t('workControl.defaultRequestNote'));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!approverId) {
      setError(t('workControl.selectApproverError'));
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
          {profiles.map(person => <option key={person.id} value={person.id}>{language === 'ar' && person.full_name_ar ? person.full_name_ar : person.full_name_en}</option>)}
        </select>
      </label>
      <label className="field full-width">
        <span>{t('workControl.requestNote')}</span>
        <textarea value={note} onChange={event => setNote(event.target.value)} />
      </label>
      <div className="form-actions full-width">
        <button className="ghost-button" type="button" onClick={onCancel}>{t('common.cancel')}</button>
        <button className="primary-button" disabled={saving || !approverId}>{saving ? t('common.sending') : t('workControl.requestApproval')}</button>
      </div>
    </form>
  );
}

interface WorkControlButtonsProps {
  onStatus: () => void;
  onEvidence: () => void;
  onApproval: () => void;
}

export function WorkControlButtons({ onStatus, onEvidence, onApproval }: WorkControlButtonsProps) {
  const { t } = useI18n();
  return (
    <div className="inline-actions">
      <button className="ghost-button compact-button" type="button" onClick={onStatus}>{t('common.status')}</button>
      <button className="ghost-button compact-button" type="button" onClick={onEvidence}>{t('common.evidence')}</button>
      <button className="ghost-button compact-button" type="button" onClick={onApproval}>{t('common.approval')}</button>
    </div>
  );
}
