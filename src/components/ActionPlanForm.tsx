import { useMemo, useState, type FormEvent } from 'react';
import type { DepartmentOption, PriorityLevel, ProfileOption, RiskLevel, SourceType } from '../types/domain';
import { createProject } from '../lib/grcApi';

interface ActionPlanFormProps {
  organizationId: string;
  departments: DepartmentOption[];
  profiles: ProfileOption[];
  onCreated: () => void;
  onCancel: () => void;
}

const sourceTypes: SourceType[] = [
  'manual',
  'ceo_decision',
  'committee_decision',
  'risk',
  'audit_finding',
  'compliance_requirement',
  'policy_gap',
  'department_kpi',
  'incident_ovr',
  'strategic_goal'
];

const priorities: PriorityLevel[] = ['critical', 'high', 'medium', 'low'];
const riskLevels: RiskLevel[] = ['critical', 'high', 'medium', 'low'];

export function ActionPlanForm({ organizationId, departments, profiles, onCreated, onCancel }: ActionPlanFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Governance');
  const [sourceType, setSourceType] = useState<SourceType>('manual');
  const [departmentId, setDepartmentId] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [sponsorId, setSponsorId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [targetEndDate, setTargetEndDate] = useState('');
  const [priority, setPriority] = useState<PriorityLevel>('medium');
  const [riskLevel, setRiskLevel] = useState<RiskLevel>('medium');
  const [evidenceRequired, setEvidenceRequired] = useState(true);
  const [closureApprovalRequired, setClosureApprovalRequired] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => title.trim().length > 2 && organizationId, [title, organizationId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!canSubmit) {
      setError('Title and organization are required.');
      return;
    }

    setSaving(true);
    try {
      await createProject({
        organization_id: organizationId,
        title: title.trim(),
        description: description.trim() || undefined,
        category: category.trim() || 'General',
        source_type: sourceType,
        department_id: departmentId || undefined,
        owner_id: ownerId || undefined,
        sponsor_id: sponsorId || undefined,
        start_date: startDate || undefined,
        target_end_date: targetEndDate || undefined,
        priority,
        risk_level: riskLevel,
        evidence_required: evidenceRequired,
        closure_approval_required: closureApprovalRequired
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      {error ? <div className="form-error">{error}</div> : null}

      <label className="field full-width">
        <span>Action plan title *</span>
        <input value={title} onChange={event => setTitle(event.target.value)} placeholder="Example: Authority matrix implementation" />
      </label>

      <label className="field full-width">
        <span>Description</span>
        <textarea value={description} onChange={event => setDescription(event.target.value)} placeholder="Objective, scope, expected result and governance reason." />
      </label>

      <label className="field">
        <span>Category</span>
        <input value={category} onChange={event => setCategory(event.target.value)} />
      </label>

      <label className="field">
        <span>Source</span>
        <select value={sourceType} onChange={event => setSourceType(event.target.value as SourceType)}>
          {sourceTypes.map(source => <option key={source} value={source}>{source.replaceAll('_', ' ')}</option>)}
        </select>
      </label>

      <label className="field">
        <span>Department</span>
        <select value={departmentId} onChange={event => setDepartmentId(event.target.value)}>
          <option value="">Company-wide</option>
          {departments.map(department => <option key={department.id} value={department.id}>{department.name_en}</option>)}
        </select>
      </label>

      <label className="field">
        <span>Owner</span>
        <select value={ownerId} onChange={event => setOwnerId(event.target.value)}>
          <option value="">Unassigned</option>
          {profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.full_name_en}</option>)}
        </select>
      </label>

      <label className="field">
        <span>Sponsor</span>
        <select value={sponsorId} onChange={event => setSponsorId(event.target.value)}>
          <option value="">None</option>
          {profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.full_name_en}</option>)}
        </select>
      </label>

      <label className="field">
        <span>Start date</span>
        <input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} />
      </label>

      <label className="field">
        <span>Target end date</span>
        <input type="date" value={targetEndDate} onChange={event => setTargetEndDate(event.target.value)} />
      </label>

      <label className="field">
        <span>Priority</span>
        <select value={priority} onChange={event => setPriority(event.target.value as PriorityLevel)}>
          {priorities.map(level => <option key={level} value={level}>{level}</option>)}
        </select>
      </label>

      <label className="field">
        <span>Risk level</span>
        <select value={riskLevel} onChange={event => setRiskLevel(event.target.value as RiskLevel)}>
          {riskLevels.map(level => <option key={level} value={level}>{level}</option>)}
        </select>
      </label>

      <label className="checkbox-field">
        <input type="checkbox" checked={evidenceRequired} onChange={event => setEvidenceRequired(event.target.checked)} />
        Evidence required before closure
      </label>

      <label className="checkbox-field">
        <input type="checkbox" checked={closureApprovalRequired} onChange={event => setClosureApprovalRequired(event.target.checked)} />
        Closure approval required
      </label>

      <div className="form-actions full-width">
        <button type="button" className="ghost-button" onClick={onCancel}>Cancel</button>
        <button type="submit" className="primary-button" disabled={!canSubmit || saving}>{saving ? 'Saving…' : 'Create Draft Action Plan'}</button>
      </div>
    </form>
  );
}
