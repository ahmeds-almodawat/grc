import { useMemo, useState, type FormEvent } from 'react';
import type { DepartmentOption, MilestoneRow, PriorityLevel, ProfileOption, RiskLevel, SourceType } from '../types/domain';
import {
  createAuditFinding,
  createComplianceItem,
  createGovernanceDecision,
  createMilestone,
  createRisk,
  createTask
} from '../lib/grcApi';
import { ScenarioFillButton } from './ScenarioFillButton';
import {
  createScenarioLabScenario,
  V99_SCENARIO_TAG,
} from '../lib/scenarioLab';

const riskLevels: RiskLevel[] = ['critical', 'high', 'medium', 'low'];
const priorities: PriorityLevel[] = ['critical', 'high', 'medium', 'low'];
const decisionSources: SourceType[] = ['ceo_decision', 'committee_decision', 'manual'];
const riskCategories = ['financial', 'clinical', 'operational', 'compliance', 'hr', 'it_cybersecurity', 'procurement', 'patient_safety', 'strategic', 'reputation', 'revenue_cycle', 'legal', 'facility_engineering', 'supply_chain', 'other'];
const responseTypes = ['avoid', 'reduce', 'transfer', 'accept', 'monitor'];

interface SharedFormProps {
  organizationId: string;
  departments: DepartmentOption[];
  profiles: ProfileOption[];
  onCreated: () => void;
  onCancel: () => void;
}

function ErrorBlock({ error }: { error: string | null }) {
  return error ? <div className="form-error">{error}</div> : null;
}

function DepartmentSelect({ value, onChange, departments }: { value: string; onChange: (value: string) => void; departments: DepartmentOption[] }) {
  return (
    <label className="field">
      <span>Department</span>
      <select value={value} onChange={event => onChange(event.target.value)}>
        <option value="">Company-wide</option>
        {departments.map(department => <option key={department.id} value={department.id}>{department.name_en}</option>)}
      </select>
    </label>
  );
}

function PersonSelect({ label, value, onChange, profiles }: { label: string; value: string; onChange: (value: string) => void; profiles: ProfileOption[] }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={event => onChange(event.target.value)}>
        <option value="">Unassigned</option>
        {profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.full_name_en}</option>)}
      </select>
    </label>
  );
}

export function RiskForm({ organizationId, departments, profiles, onCreated, onCancel }: SharedFormProps) {
  const [riskCode, setRiskCode] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('financial');
  const [departmentId, setDepartmentId] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [likelihood, setLikelihood] = useState(3);
  const [impact, setImpact] = useState(3);
  const [residualLikelihood, setResidualLikelihood] = useState(3);
  const [residualImpact, setResidualImpact] = useState(3);
  const [riskLevel, setRiskLevel] = useState<RiskLevel>('medium');
  const [responseType, setResponseType] = useState('reduce');
  const [nextReviewDate, setNextReviewDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => title.trim().length > 2 && organizationId, [title, organizationId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!canSubmit) return setError('Risk title and organization are required.');
    setSaving(true);
    try {
      if (
        title.includes(V99_SCENARIO_TAG)
        || description.includes(V99_SCENARIO_TAG)
      ) {
        await createScenarioLabScenario('risk');
        onCreated();
        return;
      }
      await createRisk({
        organization_id: organizationId,
        risk_code: riskCode.trim() || undefined,
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        department_id: departmentId || undefined,
        owner_id: ownerId || undefined,
        likelihood,
        impact,
        residual_likelihood: residualLikelihood,
        residual_impact: residualImpact,
        risk_level: riskLevel,
        response_type: responseType,
        next_review_date: nextReviewDate || undefined
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create risk.');
    } finally {
      setSaving(false);
    }
  }

  function fillSyntheticRisk() {
    const sequence = Date.now().toString().slice(-6);
    setRiskCode(`V99-${sequence}`);
    setTitle(`[${V99_SCENARIO_TAG}] Synthetic pilot risk`);
    setDescription(
      `[${V99_SCENARIO_TAG}] Synthetic non-confidential operational risk. `
      + 'No patient identifiers or confidential narrative.',
    );
    setCategory('operational');
    setDepartmentId(departments[0]?.id || '');
    setOwnerId(profiles[0]?.id || '');
    setLikelihood(4);
    setImpact(4);
    setResidualLikelihood(2);
    setResidualImpact(2);
    setRiskLevel('high');
    setResponseType('reduce');
    setNextReviewDate(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <ErrorBlock error={error} />
      <div className="full-width">
        <ScenarioFillButton onClick={fillSyntheticRisk} />
      </div>
      <label className="field"><span>Risk code</span><input value={riskCode} onChange={event => setRiskCode(event.target.value)} placeholder="FIN-001" /></label>
      <label className="field"><span>Category</span><select value={category} onChange={event => setCategory(event.target.value)}>{riskCategories.map(item => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}</select></label>
      <label className="field full-width"><span>Risk title *</span><input value={title} onChange={event => setTitle(event.target.value)} placeholder="Example: Government collection delay affecting cash flow" /></label>
      <label className="field full-width"><span>Description</span><textarea value={description} onChange={event => setDescription(event.target.value)} /></label>
      <DepartmentSelect value={departmentId} onChange={setDepartmentId} departments={departments} />
      <PersonSelect label="Risk owner" value={ownerId} onChange={setOwnerId} profiles={profiles} />
      <label className="field"><span>Likelihood 1-5</span><input type="number" min="1" max="5" value={likelihood} onChange={event => setLikelihood(Number(event.target.value))} /></label>
      <label className="field"><span>Impact 1-5</span><input type="number" min="1" max="5" value={impact} onChange={event => setImpact(Number(event.target.value))} /></label>
      <label className="field"><span>Residual likelihood 1-5</span><input type="number" min="1" max="5" value={residualLikelihood} onChange={event => setResidualLikelihood(Number(event.target.value))} /></label>
      <label className="field"><span>Residual impact 1-5</span><input type="number" min="1" max="5" value={residualImpact} onChange={event => setResidualImpact(Number(event.target.value))} /></label>
      <label className="field"><span>Risk level</span><select value={riskLevel} onChange={event => setRiskLevel(event.target.value as RiskLevel)}>{riskLevels.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
      <label className="field"><span>Response</span><select value={responseType} onChange={event => setResponseType(event.target.value)}>{responseTypes.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
      <label className="field"><span>Next review</span><input type="date" value={nextReviewDate} onChange={event => setNextReviewDate(event.target.value)} /></label>
      <div className="form-actions full-width"><button className="ghost-button" type="button" onClick={onCancel}>Cancel</button><button className="primary-button" disabled={saving || !canSubmit}>{saving ? 'Saving…' : 'Create Risk'}</button></div>
    </form>
  );
}

export function ComplianceForm({ organizationId, departments, profiles, onCreated, onCancel }: SharedFormProps) {
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [regulator, setRegulator] = useState('');
  const [requirementType, setRequirementType] = useState('License');
  const [departmentId, setDepartmentId] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [riskLevel, setRiskLevel] = useState<RiskLevel>('medium');
  const [reminderDays, setReminderDays] = useState(30);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!title.trim() || !organizationId) return setError('Compliance title and organization are required.');
    setSaving(true);
    try {
      await createComplianceItem({
        organization_id: organizationId,
        compliance_code: code.trim() || undefined,
        title: title.trim(),
        description: description.trim() || undefined,
        regulatory_body: regulator.trim() || undefined,
        requirement_type: requirementType.trim() || undefined,
        department_id: departmentId || undefined,
        owner_id: ownerId || undefined,
        due_date: dueDate || undefined,
        expiry_date: expiryDate || undefined,
        risk_level: riskLevel,
        reminder_days_before: reminderDays
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create compliance item.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <ErrorBlock error={error} />
      <label className="field"><span>Code</span><input value={code} onChange={event => setCode(event.target.value)} placeholder="COMP-001" /></label>
      <label className="field"><span>Regulatory body</span><input value={regulator} onChange={event => setRegulator(event.target.value)} placeholder="MOH / Civil Defense / ZATCA" /></label>
      <label className="field full-width"><span>Requirement title *</span><input value={title} onChange={event => setTitle(event.target.value)} /></label>
      <label className="field full-width"><span>Description</span><textarea value={description} onChange={event => setDescription(event.target.value)} /></label>
      <label className="field"><span>Requirement type</span><input value={requirementType} onChange={event => setRequirementType(event.target.value)} /></label>
      <DepartmentSelect value={departmentId} onChange={setDepartmentId} departments={departments} />
      <PersonSelect label="Owner" value={ownerId} onChange={setOwnerId} profiles={profiles} />
      <label className="field"><span>Due date</span><input type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} /></label>
      <label className="field"><span>Expiry date</span><input type="date" value={expiryDate} onChange={event => setExpiryDate(event.target.value)} /></label>
      <label className="field"><span>Reminder days before</span><input type="number" min="0" value={reminderDays} onChange={event => setReminderDays(Number(event.target.value))} /></label>
      <label className="field"><span>Risk level</span><select value={riskLevel} onChange={event => setRiskLevel(event.target.value as RiskLevel)}>{riskLevels.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
      <div className="form-actions full-width"><button className="ghost-button" type="button" onClick={onCancel}>Cancel</button><button className="primary-button" disabled={saving || !title.trim()}>{saving ? 'Saving…' : 'Create Obligation'}</button></div>
    </form>
  );
}

export function AuditFindingForm({ organizationId, departments, profiles, onCreated, onCancel }: SharedFormProps) {
  const [code, setCode] = useState('');
  const [auditTitle, setAuditTitle] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [rootCause, setRootCause] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [auditorId, setAuditorId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [riskLevel, setRiskLevel] = useState<RiskLevel>('medium');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!title.trim() || !description.trim() || !organizationId) return setError('Finding title, description and organization are required.');
    setSaving(true);
    try {
      await createAuditFinding({ organization_id: organizationId, finding_code: code.trim() || undefined, audit_title: auditTitle.trim() || undefined, title: title.trim(), description: description.trim(), department_id: departmentId || undefined, owner_id: ownerId || undefined, auditor_id: auditorId || undefined, risk_level: riskLevel, root_cause: rootCause.trim() || undefined, recommendation: recommendation.trim() || undefined, due_date: dueDate || undefined });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create audit finding.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <ErrorBlock error={error} />
      <label className="field"><span>Finding code</span><input value={code} onChange={event => setCode(event.target.value)} placeholder="IA-2026-001" /></label>
      <label className="field"><span>Audit title</span><input value={auditTitle} onChange={event => setAuditTitle(event.target.value)} /></label>
      <label className="field full-width"><span>Finding title *</span><input value={title} onChange={event => setTitle(event.target.value)} /></label>
      <label className="field full-width"><span>Description *</span><textarea value={description} onChange={event => setDescription(event.target.value)} /></label>
      <label className="field full-width"><span>Root cause</span><textarea value={rootCause} onChange={event => setRootCause(event.target.value)} /></label>
      <label className="field full-width"><span>Recommendation</span><textarea value={recommendation} onChange={event => setRecommendation(event.target.value)} /></label>
      <DepartmentSelect value={departmentId} onChange={setDepartmentId} departments={departments} />
      <PersonSelect label="Finding owner" value={ownerId} onChange={setOwnerId} profiles={profiles} />
      <PersonSelect label="Auditor" value={auditorId} onChange={setAuditorId} profiles={profiles} />
      <label className="field"><span>Due date</span><input type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} /></label>
      <label className="field"><span>Risk level</span><select value={riskLevel} onChange={event => setRiskLevel(event.target.value as RiskLevel)}>{riskLevels.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
      <div className="form-actions full-width"><button className="ghost-button" type="button" onClick={onCancel}>Cancel</button><button className="primary-button" disabled={saving || !title.trim() || !description.trim()}>{saving ? 'Saving…' : 'Create Finding'}</button></div>
    </form>
  );
}

export function DecisionForm({ organizationId, departments, profiles, onCreated, onCancel }: SharedFormProps) {
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [sourceType, setSourceType] = useState<SourceType>('committee_decision');
  const [departmentId, setDepartmentId] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [sponsorId, setSponsorId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<PriorityLevel>('medium');
  const [riskLevel, setRiskLevel] = useState<RiskLevel>('medium');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!title.trim() || !text.trim() || !organizationId) return setError('Decision title, text and organization are required.');
    setSaving(true);
    try {
      await createGovernanceDecision({ organization_id: organizationId, decision_code: code.trim() || undefined, title: title.trim(), decision_text: text.trim(), source_type: sourceType, department_id: departmentId || undefined, owner_id: ownerId || undefined, sponsor_id: sponsorId || undefined, due_date: dueDate || undefined, priority, risk_level: riskLevel });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create governance decision.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <ErrorBlock error={error} />
      <label className="field"><span>Decision code</span><input value={code} onChange={event => setCode(event.target.value)} placeholder="CEO-2026-001" /></label>
      <label className="field"><span>Source</span><select value={sourceType} onChange={event => setSourceType(event.target.value as SourceType)}>{decisionSources.map(item => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}</select></label>
      <label className="field full-width"><span>Decision title *</span><input value={title} onChange={event => setTitle(event.target.value)} /></label>
      <label className="field full-width"><span>Decision text *</span><textarea value={text} onChange={event => setText(event.target.value)} /></label>
      <DepartmentSelect value={departmentId} onChange={setDepartmentId} departments={departments} />
      <PersonSelect label="Owner" value={ownerId} onChange={setOwnerId} profiles={profiles} />
      <PersonSelect label="Sponsor" value={sponsorId} onChange={setSponsorId} profiles={profiles} />
      <label className="field"><span>Due date</span><input type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} /></label>
      <label className="field"><span>Priority</span><select value={priority} onChange={event => setPriority(event.target.value as PriorityLevel)}>{priorities.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
      <label className="field"><span>Risk level</span><select value={riskLevel} onChange={event => setRiskLevel(event.target.value as RiskLevel)}>{riskLevels.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
      <div className="form-actions full-width"><button className="ghost-button" type="button" onClick={onCancel}>Cancel</button><button className="primary-button" disabled={saving || !title.trim() || !text.trim()}>{saving ? 'Saving…' : 'Create Decision'}</button></div>
    </form>
  );
}

interface WorkFormProps {
  organizationId: string;
  projectId: string;
  milestones?: MilestoneRow[];
  profiles: ProfileOption[];
  onCreated: () => void;
  onCancel: () => void;
}

export function MilestoneForm({ organizationId, projectId, profiles, onCreated, onCancel }: WorkFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [evidenceRequired, setEvidenceRequired] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!title.trim()) return setError('Milestone title is required.');
    setSaving(true);
    try {
      await createMilestone({ organization_id: organizationId, project_id: projectId, title: title.trim(), description: description.trim() || undefined, owner_id: ownerId || undefined, start_date: startDate || undefined, due_date: dueDate || undefined, evidence_required: evidenceRequired });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create milestone.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <ErrorBlock error={error} />
      <label className="field full-width"><span>Milestone title *</span><input value={title} onChange={event => setTitle(event.target.value)} /></label>
      <label className="field full-width"><span>Description</span><textarea value={description} onChange={event => setDescription(event.target.value)} /></label>
      <PersonSelect label="Owner" value={ownerId} onChange={setOwnerId} profiles={profiles} />
      <label className="field"><span>Start date</span><input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} /></label>
      <label className="field"><span>Due date</span><input type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} /></label>
      <label className="checkbox-field"><input type="checkbox" checked={evidenceRequired} onChange={event => setEvidenceRequired(event.target.checked)} /> Evidence required</label>
      <div className="form-actions full-width"><button className="ghost-button" type="button" onClick={onCancel}>Cancel</button><button className="primary-button" disabled={saving || !title.trim()}>{saving ? 'Saving…' : 'Add Milestone'}</button></div>
    </form>
  );
}

export function TaskForm({ organizationId, projectId, milestones = [], profiles, onCreated, onCancel }: WorkFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [milestoneId, setMilestoneId] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [evidenceRequired, setEvidenceRequired] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!title.trim()) return setError('Task title is required.');
    setSaving(true);
    try {
      await createTask({ organization_id: organizationId, project_id: projectId, milestone_id: milestoneId || undefined, title: title.trim(), description: description.trim() || undefined, owner_id: ownerId || undefined, assigned_to: assignedTo || undefined, start_date: startDate || undefined, due_date: dueDate || undefined, evidence_required: evidenceRequired });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <ErrorBlock error={error} />
      <label className="field full-width"><span>Task title *</span><input value={title} onChange={event => setTitle(event.target.value)} /></label>
      <label className="field full-width"><span>Description</span><textarea value={description} onChange={event => setDescription(event.target.value)} /></label>
      <label className="field"><span>Milestone</span><select value={milestoneId} onChange={event => setMilestoneId(event.target.value)}><option value="">No milestone</option>{milestones.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
      <PersonSelect label="Owner" value={ownerId} onChange={setOwnerId} profiles={profiles} />
      <PersonSelect label="Assigned to" value={assignedTo} onChange={setAssignedTo} profiles={profiles} />
      <label className="field"><span>Start date</span><input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} /></label>
      <label className="field"><span>Due date</span><input type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} /></label>
      <label className="checkbox-field"><input type="checkbox" checked={evidenceRequired} onChange={event => setEvidenceRequired(event.target.checked)} /> Evidence required</label>
      <div className="form-actions full-width"><button className="ghost-button" type="button" onClick={onCancel}>Cancel</button><button className="primary-button" disabled={saving || !title.trim()}>{saving ? 'Saving…' : 'Add Task'}</button></div>
    </form>
  );
}
