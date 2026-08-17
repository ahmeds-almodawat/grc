import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import type { DepartmentOption, PriorityLevel, ProfileOption, RiskLevel, SourceType } from '../types/domain';
import { createProject, searchEligibleWorkParticipants } from '../lib/grcApi';
import { ScenarioFillButton } from './ScenarioFillButton';
import { useAuth } from '../auth/AuthProvider';
import {
  createScenarioLabScenario,
  V99_SCENARIO_TAG,
} from '../lib/scenarioLab';

interface ActionPlanFormProps {
  organizationId: string;
  departments: DepartmentOption[];
  onCreated: () => void;
  onCancel: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
  onSubmittingChange?: (isSubmitting: boolean) => void;
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

export function ActionPlanForm({
  organizationId,
  departments,
  onCreated,
  onCancel,
  onDirtyChange,
  onSubmittingChange,
}: ActionPlanFormProps) {
  const auth = useAuth();
  const titleId = useId();
  const descriptionId = useId();
  const categoryId = useId();
  const sourceId = useId();
  const departmentIdInput = useId();
  const ownerSearchId = useId();
  const ownerSelectId = useId();
  const sponsorSearchId = useId();
  const sponsorSelectId = useId();
  const startDateId = useId();
  const targetEndDateId = useId();
  const priorityId = useId();
  const riskLevelId = useId();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Governance');
  const [sourceType, setSourceType] = useState<SourceType>('manual');
  const [departmentId, setDepartmentId] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [sponsorId, setSponsorId] = useState('');
  const [ownerQuery, setOwnerQuery] = useState('');
  const [sponsorQuery, setSponsorQuery] = useState('');
  const [owners, setOwners] = useState<ProfileOption[]>([]);
  const [sponsors, setSponsors] = useState<ProfileOption[]>([]);
  const [searchingParticipants, setSearchingParticipants] = useState(false);
  const [participantSearchError, setParticipantSearchError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [targetEndDate, setTargetEndDate] = useState('');
  const [priority, setPriority] = useState<PriorityLevel>('medium');
  const [riskLevel, setRiskLevel] = useState<RiskLevel>('medium');
  const [evidenceRequired, setEvidenceRequired] = useState(true);
  const [closureApprovalRequired, setClosureApprovalRequired] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSubmittingRef = useRef(false);

  const canSubmit = useMemo(() => title.trim().length > 2 && organizationId, [title, organizationId]);
  const canSearchCompanyWide = auth.roles.some(role => (
    ['super_admin', 'executive', 'governance_admin'].includes(role.role)
    && role.scope === 'global'
  ));

  const isDirty = useMemo(() => {
    return Boolean(
      title.trim() ||
      description.trim() ||
      category !== 'Governance' ||
      sourceType !== 'manual' ||
      departmentId ||
      ownerId ||
      sponsorId ||
      ownerQuery ||
      sponsorQuery ||
      startDate ||
      targetEndDate ||
      priority !== 'medium' ||
      riskLevel !== 'medium' ||
      !evidenceRequired ||
      !closureApprovalRequired
    );
  }, [
    title,
    description,
    category,
    sourceType,
    departmentId,
    ownerId,
    sponsorId,
    ownerQuery,
    sponsorQuery,
    startDate,
    targetEndDate,
    priority,
    riskLevel,
    evidenceRequired,
    closureApprovalRequired,
  ]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    onSubmittingChange?.(saving);
  }, [saving, onSubmittingChange]);

  useEffect(() => {
    let cancelled = false;
    if (!departmentId && !canSearchCompanyWide) {
      setOwners([]);
      setSponsors([]);
      setOwnerId('');
      setSponsorId('');
      setParticipantSearchError(null);
      setSearchingParticipants(false);
      return () => { cancelled = true; };
    }
    setSearchingParticipants(true);
    const timer = window.setTimeout(() => {
      void Promise.all([
        searchEligibleWorkParticipants('project_create', departmentId || null, 'project_owner', ownerQuery, 100),
        searchEligibleWorkParticipants('project_create', departmentId || null, 'sponsor', sponsorQuery, 100),
      ]).then(([nextOwners, nextSponsors]) => {
        if (cancelled) return;
        setOwners(nextOwners);
        setSponsors(nextSponsors);
        setParticipantSearchError(null);
      }).catch(err => {
        if (!cancelled) setParticipantSearchError(err instanceof Error ? err.message : 'Eligible participants could not be loaded.');
      }).finally(() => {
        if (!cancelled) setSearchingParticipants(false);
      });
    }, 250);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [canSearchCompanyWide, departmentId, ownerQuery, sponsorQuery]);

  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    if (targetEndDate && targetEndDate < val) {
      setTargetEndDate('');
    }
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (isSubmittingRef.current) return;

    if (!canSubmit) {
      setError('Title and organization are required.');
      return;
    }
    if (startDate && targetEndDate && targetEndDate < startDate) {
      setError('Target end date cannot precede the project start date.');
      return;
    }

    isSubmittingRef.current = true;
    setSaving(true);
    try {
      if (
        title.includes(V99_SCENARIO_TAG)
        || description.includes(V99_SCENARIO_TAG)
      ) {
        await createScenarioLabScenario('project');
        onCreated();
        return;
      }
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
      isSubmittingRef.current = false;
      setSaving(false);
    }
  }

  function fillSyntheticProject() {
    setTitle(`[${V99_SCENARIO_TAG}] Synthetic corrective action`);
    setDescription(
      `[${V99_SCENARIO_TAG}] Synthetic controlled-pilot project. `
      + 'No confidential or patient-related content.',
    );
    setCategory('Controlled Pilot Test');
    setSourceType('manual');
    setDepartmentId(departments[0]?.id || '');
    setOwnerId(owners[0]?.id || '');
    setSponsorId(sponsors[0]?.id || '');
    setStartDate(new Date().toISOString().slice(0, 10));
    setTargetEndDate(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
    setPriority('high');
    setRiskLevel('medium');
    setEvidenceRequired(true);
    setClosureApprovalRequired(true);
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      {error ? <div className="form-error">{error}</div> : null}
      {participantSearchError ? <div className="form-error">{participantSearchError}</div> : null}
      <div className="full-width">
        <ScenarioFillButton onClick={fillSyntheticProject} />
      </div>

      <label className="field full-width" htmlFor={titleId}>
        <span>Action plan title *</span>
        <input
          id={titleId}
          value={title}
          onChange={event => setTitle(event.target.value)}
          placeholder="Example: Authority matrix implementation"
          required
        />
      </label>

      <label className="field full-width" htmlFor={descriptionId}>
        <span>Description</span>
        <textarea
          id={descriptionId}
          value={description}
          onChange={event => setDescription(event.target.value)}
          placeholder="Objective, scope, expected result and governance reason."
        />
      </label>

      <label className="field" htmlFor={categoryId}>
        <span>Category</span>
        <input
          id={categoryId}
          value={category}
          onChange={event => setCategory(event.target.value)}
        />
      </label>

      <label className="field" htmlFor={sourceId}>
        <span>Source</span>
        <select
          id={sourceId}
          value={sourceType}
          onChange={event => setSourceType(event.target.value as SourceType)}
        >
          {sourceTypes.map(source => (
            <option key={source} value={source}>
              {source.replaceAll('_', ' ')}
            </option>
          ))}
        </select>
      </label>

      <label className="field" htmlFor={departmentIdInput}>
        <span>Department</span>
        <select
          id={departmentIdInput}
          value={departmentId}
          onChange={event => setDepartmentId(event.target.value)}
        >
          <option value="">Company-wide</option>
          {departments.map(department => (
            <option key={department.id} value={department.id}>
              {department.name_en}
            </option>
          ))}
        </select>
      </label>

      <label className="field" htmlFor={ownerSearchId}>
        <span>Search eligible owner</span>
        <input
          id={ownerSearchId}
          value={ownerQuery}
          onChange={event => setOwnerQuery(event.target.value)}
          placeholder="Search eligible owners"
        />
      </label>

      <label className="field" htmlFor={ownerSelectId}>
        <span>Owner</span>
        <select
          id={ownerSelectId}
          value={ownerId}
          onChange={event => setOwnerId(event.target.value)}
          disabled={searchingParticipants}
        >
          <option value="">{searchingParticipants ? 'Searching…' : 'Unassigned'}</option>
          {owners.map(profile => (
            <option key={profile.id} value={profile.id}>
              {profile.full_name_en}
            </option>
          ))}
        </select>
      </label>

      <label className="field" htmlFor={sponsorSearchId}>
        <span>Search eligible sponsor</span>
        <input
          id={sponsorSearchId}
          value={sponsorQuery}
          onChange={event => setSponsorQuery(event.target.value)}
          placeholder="Search eligible sponsors"
        />
      </label>

      <label className="field" htmlFor={sponsorSelectId}>
        <span>Sponsor</span>
        <select
          id={sponsorSelectId}
          value={sponsorId}
          onChange={event => setSponsorId(event.target.value)}
          disabled={searchingParticipants}
        >
          <option value="">{searchingParticipants ? 'Searching…' : 'None'}</option>
          {sponsors.map(profile => (
            <option key={profile.id} value={profile.id}>
              {profile.full_name_en}
            </option>
          ))}
        </select>
      </label>

      <label className="field" htmlFor={startDateId}>
        <span>Start date</span>
        <input
          id={startDateId}
          type="date"
          value={startDate}
          max={targetEndDate || undefined}
          onChange={event => handleStartDateChange(event.target.value)}
        />
      </label>

      <label className="field" htmlFor={targetEndDateId}>
        <span>Target end date</span>
        <input
          id={targetEndDateId}
          type="date"
          value={targetEndDate}
          min={startDate || undefined}
          onChange={event => setTargetEndDate(event.target.value)}
        />
      </label>

      <label className="field" htmlFor={priorityId}>
        <span>Priority</span>
        <select
          id={priorityId}
          value={priority}
          onChange={event => setPriority(event.target.value as PriorityLevel)}
        >
          {priorities.map(level => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
      </label>

      <label className="field" htmlFor={riskLevelId}>
        <span>Risk level</span>
        <select
          id={riskLevelId}
          value={riskLevel}
          onChange={event => setRiskLevel(event.target.value as RiskLevel)}
        >
          {riskLevels.map(level => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
      </label>

      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={evidenceRequired}
          onChange={event => setEvidenceRequired(event.target.checked)}
        />
        Evidence required before closure
      </label>

      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={closureApprovalRequired}
          onChange={event => setClosureApprovalRequired(event.target.checked)}
        />
        Closure approval required
      </label>

      <div className="form-actions full-width">
        <button type="button" className="ghost-button" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="submit"
          className="primary-button"
          disabled={!canSubmit || saving}
        >
          {saving ? 'Saving…' : 'Create Draft Action Plan'}
        </button>
      </div>
    </form>
  );
}
