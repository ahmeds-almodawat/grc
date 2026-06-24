import { type FormEvent, useState } from 'react';
import type { PriorityLevel, ProfileOption, ProjectStatus, WorkStatus } from '../types/domain';
import { requestApproval, updateMilestoneStatus, updateProjectStatus, updateTaskStatus, uploadEvidenceForItem } from '../lib/grcApi';
import { ScenarioFillButton } from './ScenarioFillButton';
import {
  createScenarioLabScenario,
  V99_SCENARIO_TAG,
} from '../lib/scenarioLab';

export type ControllableItemType = 'project' | 'milestone' | 'task';

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

function label(value: string) {
  return value.replaceAll('_', ' ');
}

interface StatusUpdateFormProps {
  itemType: ControllableItemType;
  itemId: string;
  currentStatus: ProjectStatus | WorkStatus;
  currentProgress?: number | null;
  onCancel: () => void;
  onUpdated: () => void;
}

export function StatusUpdateForm({ itemType, itemId, currentStatus, currentProgress, onCancel, onUpdated }: StatusUpdateFormProps) {
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
      setError('Delay reason is required when status is delayed.');
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
      setError(err instanceof Error ? err.message : 'Failed to update status.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      {error ? <div className="form-error">{error}</div> : null}
      <label className="field">
        <span>Status</span>
        <select value={status} onChange={event => setStatus(event.target.value as typeof status)}>
          {options.map(item => <option key={item} value={item}>{label(item)}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Progress %</span>
        <input type="number" min="0" max="100" value={progress} onChange={event => setProgress(Number(event.target.value))} />
      </label>
      <label className="field full-width">
        <span>Delay reason {status === 'delayed' ? '*' : ''}</span>
        <textarea value={delayReason} onChange={event => setDelayReason(event.target.value)} placeholder="Required only when status is delayed." />
      </label>
      <div className="form-actions full-width">
        <button className="ghost-button" type="button" onClick={onCancel}>Cancel</button>
        <button className="primary-button" disabled={saving}>{saving ? 'Saving…' : 'Update Status'}</button>
      </div>
    </form>
  );
}

interface EvidenceUploadFormProps {
  organizationId: string;
  itemType: ControllableItemType;
  itemId: string;
  onCancel: () => void;
  onUploaded: () => void;
}

export function EvidenceUploadForm({ organizationId, itemType, itemId, onCancel, onUploaded }: EvidenceUploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!file) {
      setError('Please select a file to upload.');
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
      setError(err instanceof Error ? err.message : 'Failed to upload evidence.');
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
          ? <p className="muted">Prepared file: {file.name}</p>
          : null}
      </div>
      <label className="field full-width">
        <span>Evidence file *</span>
        <input type="file" onChange={event => setFile(event.target.files?.[0] ?? null)} />
      </label>
      <label className="field full-width">
        <span>Description</span>
        <textarea value={description} onChange={event => setDescription(event.target.value)} placeholder="Explain what this evidence proves." />
      </label>
      <div className="notice-banner full-width">
        Evidence is uploaded to the private <strong>grc-evidence</strong> bucket and registered for review. It does not automatically close the item.
      </div>
      <div className="form-actions full-width">
        <button className="ghost-button" type="button" onClick={onCancel}>Cancel</button>
        <button className="primary-button" disabled={saving || !file}>{saving ? 'Uploading…' : 'Upload Evidence'}</button>
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
  const [approverId, setApproverId] = useState('');
  const [note, setNote] = useState('Please review and approve this controlled item.');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!approverId) {
      setError('Select an approver.');
      return;
    }
    setSaving(true);
    try {
      await requestApproval({ organization_id: organizationId, item_type: itemType, item_id: itemId, approver_id: approverId, request_note: note.trim() || undefined });
      onRequested();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request approval.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      {error ? <div className="form-error">{error}</div> : null}
      <label className="field full-width">
        <span>Approver *</span>
        <select value={approverId} onChange={event => setApproverId(event.target.value)}>
          <option value="">Select approver</option>
          {profiles.map(person => <option key={person.id} value={person.id}>{person.full_name_en}</option>)}
        </select>
      </label>
      <label className="field full-width">
        <span>Request note</span>
        <textarea value={note} onChange={event => setNote(event.target.value)} />
      </label>
      <div className="form-actions full-width">
        <button className="ghost-button" type="button" onClick={onCancel}>Cancel</button>
        <button className="primary-button" disabled={saving || !approverId}>{saving ? 'Sending…' : 'Request Approval'}</button>
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
  return (
    <div className="inline-actions">
      <button className="ghost-button compact-button" type="button" onClick={onStatus}>Status</button>
      <button className="ghost-button compact-button" type="button" onClick={onEvidence}>Evidence</button>
      <button className="ghost-button compact-button" type="button" onClick={onApproval}>Approval</button>
    </div>
  );
}
