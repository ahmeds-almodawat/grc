import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import type { DepartmentOption, MilestoneRow, PriorityLevel, ProfileOption, RiskLevel, SourceType } from '../types/domain';
import {
  createAuditFinding,
  createComplianceItem,
  createGovernanceDecision,
  createMilestone,
  createRisk,
  createTask,
  searchEligibleWorkParticipants,
} from '../lib/grcApi';
import { ScenarioFillButton } from './ScenarioFillButton';
import {
  createScenarioLabScenario,
  V99_SCENARIO_TAG,
} from '../lib/scenarioLab';
import { useI18n } from '../i18n/I18nContext';
import { humanize } from '../lib/format';

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
  onDirtyChange?: (isDirty: boolean) => void;
  onSubmittingChange?: (isSubmitting: boolean) => void;
}

function ErrorBlock({ error }: { error: string | null }) {
  return error ? <div className="form-error">{error}</div> : null;
}

function DepartmentSelect({
  id,
  value,
  onChange,
  departments,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  departments: DepartmentOption[];
}) {
  const { language, t } = useI18n();
  const autoId = useId();
  const selectId = id ?? autoId;
  return (
    <label className="field" htmlFor={selectId}>
      <span>{t('common.department', 'Department')}</span>
      <select id={selectId} value={value} onChange={event => onChange(event.target.value)}>
        <option value="">{t('common.companyWide', 'Company-wide')}</option>
        {departments.map(department => (
          <option key={department.id} value={department.id}>
            {language === 'ar' ? department.name_ar || department.name_en : department.name_en || department.name_ar}
          </option>
        ))}
      </select>
    </label>
  );
}

function PersonSelect({
  id,
  label,
  value,
  onChange,
  profiles,
  disabled = false,
}: {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  profiles: ProfileOption[];
  disabled?: boolean;
}) {
  const { language, t } = useI18n();
  const autoId = useId();
  const selectId = id ?? autoId;
  return (
    <label className="field" htmlFor={selectId}>
      <span>{label}</span>
      <select id={selectId} value={value} onChange={event => onChange(event.target.value)} disabled={disabled}>
        <option value="">{t('common.unassigned', 'Unassigned')}</option>
        {profiles.map(profile => (
          <option key={profile.id} value={profile.id}>
            {language === 'ar' ? profile.full_name_ar || profile.full_name_en : profile.full_name_en || profile.full_name_ar}
          </option>
        ))}
      </select>
    </label>
  );
}

export function RiskForm({
  organizationId,
  departments,
  profiles,
  onCreated,
  onCancel,
  onDirtyChange,
  onSubmittingChange,
}: SharedFormProps) {
  const { language, t } = useI18n();
  const codeId = useId();
  const categoryId = useId();
  const titleId = useId();
  const descId = useId();
  const likelihoodId = useId();
  const impactId = useId();
  const resLikelihoodId = useId();
  const resImpactId = useId();
  const riskLevelId = useId();
  const responseTypeId = useId();
  const nextReviewDateId = useId();

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
  const isSubmittingRef = useRef(false);

  const canSubmit = useMemo(() => title.trim().length > 2 && organizationId, [title, organizationId]);

  const isDirty = useMemo(() => {
    return Boolean(
      riskCode.trim() ||
      title.trim() ||
      description.trim() ||
      category !== 'financial' ||
      departmentId ||
      ownerId ||
      likelihood !== 3 ||
      impact !== 3 ||
      residualLikelihood !== 3 ||
      residualImpact !== 3 ||
      riskLevel !== 'medium' ||
      responseType !== 'reduce' ||
      nextReviewDate
    );
  }, [
    riskCode,
    title,
    description,
    category,
    departmentId,
    ownerId,
    likelihood,
    impact,
    residualLikelihood,
    residualImpact,
    riskLevel,
    responseType,
    nextReviewDate,
  ]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    onSubmittingChange?.(saving);
  }, [saving, onSubmittingChange]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (isSubmittingRef.current) return;
    if (!canSubmit) return setError(t('form.risk.required', 'Risk title and organization are required.'));

    isSubmittingRef.current = true;
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
      setError(err instanceof Error ? err.message : t('form.risk.failed', 'Failed to create risk.'));
    } finally {
      isSubmittingRef.current = false;
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
      <label className="field" htmlFor={codeId}>
        <span>{t('form.risk.code', 'Risk code')}</span>
        <input id={codeId} value={riskCode} onChange={event => setRiskCode(event.target.value)} placeholder="FIN-001" />
      </label>
      <label className="field" htmlFor={categoryId}>
        <span>{t('risks.category', 'Category')}</span>
        <select id={categoryId} value={category} onChange={event => setCategory(event.target.value)}>
          {riskCategories.map(item => <option key={item} value={item}>{humanize(item, language)}</option>)}
        </select>
      </label>
      <label className="field full-width" htmlFor={titleId}>
        <span>{t('form.risk.title', 'Risk title')} *</span>
        <input id={titleId} value={title} onChange={event => setTitle(event.target.value)} placeholder={t('form.risk.titlePlaceholder', 'Example: Government collection delay affecting cash flow')} required />
      </label>
      <label className="field full-width" htmlFor={descId}>
        <span>{t('common.description', 'Description')}</span>
        <textarea id={descId} value={description} onChange={event => setDescription(event.target.value)} />
      </label>
      <DepartmentSelect value={departmentId} onChange={setDepartmentId} departments={departments} />
      <PersonSelect label={t('form.risk.owner', 'Risk owner')} value={ownerId} onChange={setOwnerId} profiles={profiles} />
      <label className="field" htmlFor={likelihoodId}>
        <span>{t('form.risk.likelihood', 'Likelihood 1-5')}</span>
        <input id={likelihoodId} type="number" min="1" max="5" value={likelihood} onChange={event => setLikelihood(Number(event.target.value))} />
      </label>
      <label className="field" htmlFor={impactId}>
        <span>{t('form.risk.impact', 'Impact 1-5')}</span>
        <input id={impactId} type="number" min="1" max="5" value={impact} onChange={event => setImpact(Number(event.target.value))} />
      </label>
      <label className="field" htmlFor={resLikelihoodId}>
        <span>{t('form.risk.residualLikelihood', 'Residual likelihood 1-5')}</span>
        <input id={resLikelihoodId} type="number" min="1" max="5" value={residualLikelihood} onChange={event => setResidualLikelihood(Number(event.target.value))} />
      </label>
      <label className="field" htmlFor={resImpactId}>
        <span>{t('form.risk.residualImpact', 'Residual impact 1-5')}</span>
        <input id={resImpactId} type="number" min="1" max="5" value={residualImpact} onChange={event => setResidualImpact(Number(event.target.value))} />
      </label>
      <label className="field" htmlFor={riskLevelId}>
        <span>{t('form.risk.level', 'Risk level')}</span>
        <select id={riskLevelId} value={riskLevel} onChange={event => setRiskLevel(event.target.value as RiskLevel)}>
          {riskLevels.map(item => <option key={item} value={item}>{humanize(item, language)}</option>)}
        </select>
      </label>
      <label className="field" htmlFor={responseTypeId}>
        <span>{t('form.risk.response', 'Response')}</span>
        <select id={responseTypeId} value={responseType} onChange={event => setResponseType(event.target.value)}>
          {responseTypes.map(item => <option key={item} value={item}>{humanize(item, language)}</option>)}
        </select>
      </label>
      <label className="field" htmlFor={nextReviewDateId}>
        <span>{t('risks.nextReview', 'Next review')}</span>
        <input id={nextReviewDateId} type="date" value={nextReviewDate} onChange={event => setNextReviewDate(event.target.value)} />
      </label>
      <div className="form-actions full-width">
        <button className="ghost-button" type="button" onClick={onCancel}>{t('common.cancel', 'Cancel')}</button>
        <button className="primary-button" disabled={saving || !canSubmit}>{saving ? t('common.saving', 'Saving…') : t('form.risk.create', 'Create Risk')}</button>
      </div>
    </form>
  );
}

export function ComplianceForm({
  organizationId,
  departments,
  profiles,
  onCreated,
  onCancel,
  onDirtyChange,
  onSubmittingChange,
}: SharedFormProps) {
  const { language, t } = useI18n();
  const codeId = useId();
  const regulatorId = useId();
  const titleId = useId();
  const descId = useId();
  const reqTypeId = useId();
  const dueDateId = useId();
  const expiryDateId = useId();
  const reminderDaysId = useId();
  const riskLevelId = useId();

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
  const isSubmittingRef = useRef(false);

  const isDirty = useMemo(() => {
    return Boolean(
      code.trim() ||
      title.trim() ||
      description.trim() ||
      regulator.trim() ||
      requirementType !== 'License' ||
      departmentId ||
      ownerId ||
      dueDate ||
      expiryDate ||
      riskLevel !== 'medium' ||
      reminderDays !== 30
    );
  }, [code, title, description, regulator, requirementType, departmentId, ownerId, dueDate, expiryDate, riskLevel, reminderDays]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    onSubmittingChange?.(saving);
  }, [saving, onSubmittingChange]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (isSubmittingRef.current) return;
    if (!title.trim() || !organizationId) return setError(t('form.compliance.required'));
    if (dueDate && expiryDate && expiryDate < dueDate) {
      return setError(t('form.compliance.invalidExpiry'));
    }

    isSubmittingRef.current = true;
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
      setError(err instanceof Error ? err.message : t('form.compliance.failed'));
    } finally {
      isSubmittingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <ErrorBlock error={error} />
      <label className="field" htmlFor={codeId}>
        <span>{t('common.code')}</span>
        <input id={codeId} value={code} onChange={event => setCode(event.target.value)} placeholder="COMP-001" />
      </label>
      <label className="field" htmlFor={regulatorId}>
        <span>{t('form.compliance.regulator')}</span>
        <input id={regulatorId} value={regulator} onChange={event => setRegulator(event.target.value)} placeholder="MOH / Civil Defense / ZATCA" />
      </label>
      <label className="field full-width" htmlFor={titleId}>
        <span>{t('form.compliance.title')} *</span>
        <input id={titleId} value={title} onChange={event => setTitle(event.target.value)} required />
      </label>
      <label className="field full-width" htmlFor={descId}>
        <span>{t('common.description')}</span>
        <textarea id={descId} value={description} onChange={event => setDescription(event.target.value)} />
      </label>
      <label className="field" htmlFor={reqTypeId}>
        <span>{t('form.compliance.type')}</span>
        <input id={reqTypeId} value={requirementType} onChange={event => setRequirementType(event.target.value)} />
      </label>
      <DepartmentSelect value={departmentId} onChange={setDepartmentId} departments={departments} />
      <PersonSelect label={t('common.owner')} value={ownerId} onChange={setOwnerId} profiles={profiles} />
      <label className="field" htmlFor={dueDateId}>
        <span>{t('common.dueDate')}</span>
        <input
          id={dueDateId}
          type="date"
          value={dueDate}
          max={expiryDate || undefined}
          onChange={event => setDueDate(event.target.value)}
        />
      </label>
      <label className="field" htmlFor={expiryDateId}>
        <span>{t('form.compliance.expiry')}</span>
        <input
          id={expiryDateId}
          type="date"
          value={expiryDate}
          min={dueDate || undefined}
          onChange={event => setExpiryDate(event.target.value)}
        />
      </label>
      <label className="field" htmlFor={reminderDaysId}>
        <span>{t('form.compliance.reminderDays')}</span>
        <input id={reminderDaysId} type="number" min="0" value={reminderDays} onChange={event => setReminderDays(Number(event.target.value))} />
      </label>
      <label className="field" htmlFor={riskLevelId}>
        <span>{t('risks.level')}</span>
        <select id={riskLevelId} value={riskLevel} onChange={event => setRiskLevel(event.target.value as RiskLevel)}>
          {riskLevels.map(item => <option key={item} value={item}>{humanize(item, language)}</option>)}
        </select>
      </label>
      <div className="form-actions full-width">
        <button className="ghost-button" type="button" onClick={onCancel}>{t('common.cancel')}</button>
        <button className="primary-button" disabled={saving || !title.trim()}>{saving ? t('common.saving') : t('form.compliance.create')}</button>
      </div>
    </form>
  );
}

export function AuditFindingForm({
  organizationId,
  departments,
  profiles,
  onCreated,
  onCancel,
  onDirtyChange,
  onSubmittingChange,
}: SharedFormProps) {
  const { language, t } = useI18n();
  const codeId = useId();
  const auditTitleId = useId();
  const titleId = useId();
  const descId = useId();
  const rootCauseId = useId();
  const recId = useId();
  const dueDateId = useId();
  const riskLevelId = useId();

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
  const isSubmittingRef = useRef(false);

  const isDirty = useMemo(() => {
    return Boolean(
      code.trim() ||
      auditTitle.trim() ||
      title.trim() ||
      description.trim() ||
      rootCause.trim() ||
      recommendation.trim() ||
      departmentId ||
      ownerId ||
      auditorId ||
      dueDate ||
      riskLevel !== 'medium'
    );
  }, [code, auditTitle, title, description, rootCause, recommendation, departmentId, ownerId, auditorId, dueDate, riskLevel]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    onSubmittingChange?.(saving);
  }, [saving, onSubmittingChange]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (isSubmittingRef.current) return;
    if (!title.trim() || !description.trim() || !organizationId) return setError(t('form.audit.required', 'Finding title, description and organization are required.'));

    isSubmittingRef.current = true;
    setSaving(true);
    try {
      await createAuditFinding({
        organization_id: organizationId,
        finding_code: code.trim() || undefined,
        audit_title: auditTitle.trim() || undefined,
        title: title.trim(),
        description: description.trim(),
        department_id: departmentId || undefined,
        owner_id: ownerId || undefined,
        auditor_id: auditorId || undefined,
        risk_level: riskLevel,
        root_cause: rootCause.trim() || undefined,
        recommendation: recommendation.trim() || undefined,
        due_date: dueDate || undefined
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('form.audit.failed', 'Failed to create audit finding.'));
    } finally {
      isSubmittingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <ErrorBlock error={error} />
      <label className="field" htmlFor={codeId}>
        <span>{t('form.audit.code', 'Finding code')}</span>
        <input id={codeId} value={code} onChange={event => setCode(event.target.value)} placeholder="IA-2026-001" />
      </label>
      <label className="field" htmlFor={auditTitleId}>
        <span>{t('form.audit.auditTitle', 'Audit title')}</span>
        <input id={auditTitleId} value={auditTitle} onChange={event => setAuditTitle(event.target.value)} />
      </label>
      <label className="field full-width" htmlFor={titleId}>
        <span>{t('form.audit.findingTitle', 'Finding title')} *</span>
        <input id={titleId} value={title} onChange={event => setTitle(event.target.value)} required />
      </label>
      <label className="field full-width" htmlFor={descId}>
        <span>{t('common.description', 'Description')} *</span>
        <textarea id={descId} value={description} onChange={event => setDescription(event.target.value)} required />
      </label>
      <label className="field full-width" htmlFor={rootCauseId}>
        <span>{t('form.audit.rootCause', 'Root cause')}</span>
        <textarea id={rootCauseId} value={rootCause} onChange={event => setRootCause(event.target.value)} />
      </label>
      <label className="field full-width" htmlFor={recId}>
        <span>{t('form.audit.recommendation', 'Recommendation')}</span>
        <textarea id={recId} value={recommendation} onChange={event => setRecommendation(event.target.value)} />
      </label>
      <DepartmentSelect value={departmentId} onChange={setDepartmentId} departments={departments} />
      <PersonSelect label={t('form.audit.owner', 'Finding owner')} value={ownerId} onChange={setOwnerId} profiles={profiles} />
      <PersonSelect label={t('form.audit.auditor', 'Auditor')} value={auditorId} onChange={setAuditorId} profiles={profiles} />
      <label className="field" htmlFor={dueDateId}>
        <span>{t('common.dueDate', 'Due date')}</span>
        <input id={dueDateId} type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} />
      </label>
      <label className="field" htmlFor={riskLevelId}>
        <span>{t('form.risk.level', 'Risk level')}</span>
        <select id={riskLevelId} value={riskLevel} onChange={event => setRiskLevel(event.target.value as RiskLevel)}>
          {riskLevels.map(item => <option key={item} value={item}>{humanize(item, language)}</option>)}
        </select>
      </label>
      <div className="form-actions full-width">
        <button className="ghost-button" type="button" onClick={onCancel}>{t('common.cancel', 'Cancel')}</button>
        <button className="primary-button" disabled={saving || !title.trim() || !description.trim()}>{saving ? t('common.saving', 'Saving…') : t('form.audit.create', 'Create Finding')}</button>
      </div>
    </form>
  );
}

export function DecisionForm({
  organizationId,
  departments,
  profiles,
  onCreated,
  onCancel,
  onDirtyChange,
  onSubmittingChange,
}: SharedFormProps) {
  const { language, t } = useI18n();
  const codeId = useId();
  const sourceId = useId();
  const titleId = useId();
  const textId = useId();
  const dueDateId = useId();
  const priorityId = useId();
  const riskLevelId = useId();

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
  const isSubmittingRef = useRef(false);

  const isDirty = useMemo(() => {
    return Boolean(
      code.trim() ||
      title.trim() ||
      text.trim() ||
      sourceType !== 'committee_decision' ||
      departmentId ||
      ownerId ||
      sponsorId ||
      dueDate ||
      priority !== 'medium' ||
      riskLevel !== 'medium'
    );
  }, [code, title, text, sourceType, departmentId, ownerId, sponsorId, dueDate, priority, riskLevel]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    onSubmittingChange?.(saving);
  }, [saving, onSubmittingChange]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (isSubmittingRef.current) return;
    if (!title.trim() || !text.trim() || !organizationId) return setError(t('form.governance.required', 'Decision title, text and organization are required.'));

    isSubmittingRef.current = true;
    setSaving(true);
    try {
      await createGovernanceDecision({
        organization_id: organizationId,
        decision_code: code.trim() || undefined,
        title: title.trim(),
        decision_text: text.trim(),
        source_type: sourceType,
        department_id: departmentId || undefined,
        owner_id: ownerId || undefined,
        sponsor_id: sponsorId || undefined,
        due_date: dueDate || undefined,
        priority,
        risk_level: riskLevel
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('form.governance.failed', 'Failed to create governance decision.'));
    } finally {
      isSubmittingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <ErrorBlock error={error} />
      <label className="field" htmlFor={codeId}>
        <span>{t('form.governance.code', 'Decision code')}</span>
        <input id={codeId} value={code} onChange={event => setCode(event.target.value)} placeholder="CEO-2026-001" />
      </label>
      <label className="field" htmlFor={sourceId}>
        <span>{t('common.source', 'Source')}</span>
        <select id={sourceId} value={sourceType} onChange={event => setSourceType(event.target.value as SourceType)}>
          {decisionSources.map(item => <option key={item} value={item}>{humanize(item, language)}</option>)}
        </select>
      </label>
      <label className="field full-width" htmlFor={titleId}>
        <span>{t('form.governance.title', 'Decision title')} *</span>
        <input id={titleId} value={title} onChange={event => setTitle(event.target.value)} required />
      </label>
      <label className="field full-width" htmlFor={textId}>
        <span>{t('form.governance.text', 'Decision text')} *</span>
        <textarea id={textId} value={text} onChange={event => setText(event.target.value)} required />
      </label>
      <DepartmentSelect value={departmentId} onChange={setDepartmentId} departments={departments} />
      <PersonSelect label={t('common.owner', 'Owner')} value={ownerId} onChange={setOwnerId} profiles={profiles} />
      <PersonSelect label={t('form.governance.sponsor', 'Sponsor')} value={sponsorId} onChange={setSponsorId} profiles={profiles} />
      <label className="field" htmlFor={dueDateId}>
        <span>{t('common.dueDate', 'Due date')}</span>
        <input id={dueDateId} type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} />
      </label>
      <label className="field" htmlFor={priorityId}>
        <span>{t('common.priority', 'Priority')}</span>
        <select id={priorityId} value={priority} onChange={event => setPriority(event.target.value as PriorityLevel)}>
          {priorities.map(item => <option key={item} value={item}>{humanize(item, language)}</option>)}
        </select>
      </label>
      <label className="field" htmlFor={riskLevelId}>
        <span>{t('form.risk.level', 'Risk level')}</span>
        <select id={riskLevelId} value={riskLevel} onChange={event => setRiskLevel(event.target.value as RiskLevel)}>
          {riskLevels.map(item => <option key={item} value={item}>{humanize(item, language)}</option>)}
        </select>
      </label>
      <div className="form-actions full-width">
        <button className="ghost-button" type="button" onClick={onCancel}>{t('common.cancel', 'Cancel')}</button>
        <button className="primary-button" disabled={saving || !title.trim() || !text.trim()}>{saving ? t('common.saving', 'Saving…') : t('form.governance.create', 'Create Decision')}</button>
      </div>
    </form>
  );
}

interface WorkFormProps {
  organizationId: string;
  projectId: string;
  milestones?: MilestoneRow[];
  onCreated: () => void;
  onCancel: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
  onSubmittingChange?: (isSubmitting: boolean) => void;
}

function useContextualWorkParticipants(
  itemType: 'project' | 'milestone',
  itemId: string,
  purpose: 'milestone_owner' | 'task_owner',
) {
  const [query, setQuery] = useState('');
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      void searchEligibleWorkParticipants(itemType, itemId, purpose, query, 100)
        .then(rows => { if (!cancelled) { setProfiles(rows); setError(null); } })
        .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'Eligible participants could not be loaded.'); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 250);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [itemId, itemType, purpose, query]);

  return { error, loading, profiles, query, setQuery };
}

export function MilestoneForm({
  organizationId,
  projectId,
  onCreated,
  onCancel,
  onDirtyChange,
  onSubmittingChange,
}: WorkFormProps) {
  const titleId = useId();
  const descId = useId();
  const ownerSearchId = useId();
  const ownerSelectId = useId();
  const startDateId = useId();
  const dueDateId = useId();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [evidenceRequired, setEvidenceRequired] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSubmittingRef = useRef(false);
  const participants = useContextualWorkParticipants('project', projectId, 'milestone_owner');

  const isDirty = useMemo(() => {
    return Boolean(
      title.trim() ||
      description.trim() ||
      ownerId ||
      participants.query ||
      startDate ||
      dueDate ||
      !evidenceRequired
    );
  }, [title, description, ownerId, participants.query, startDate, dueDate, evidenceRequired]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    onSubmittingChange?.(saving);
  }, [saving, onSubmittingChange]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (isSubmittingRef.current) return;
    const formEl = event.currentTarget;
    const formData = new FormData(formEl);
    const submittedStartDate = String(formData.get('start_date') ?? (formEl.elements.namedItem('start_date') as HTMLInputElement)?.value ?? startDate).trim();
    const submittedDueDate = String(formData.get('due_date') ?? (formEl.elements.namedItem('due_date') as HTMLInputElement)?.value ?? dueDate).trim();

    if (!title.trim()) return setError('Milestone title is required.');
    if (!submittedStartDate || !submittedDueDate) return setError('Milestone start and due dates are required.');
    if (submittedDueDate < submittedStartDate) return setError('Milestone due date cannot precede its start date.');

    isSubmittingRef.current = true;
    setSaving(true);
    try {
      await createMilestone({
        organization_id: organizationId,
        project_id: projectId,
        title: title.trim(),
        description: description.trim() || undefined,
        owner_id: ownerId || undefined,
        start_date: submittedStartDate,
        due_date: submittedDueDate,
        evidence_required: evidenceRequired
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create milestone.');
    } finally {
      isSubmittingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <ErrorBlock error={error} />
      <ErrorBlock error={participants.error} />
      <label className="field full-width" htmlFor={titleId}>
        <span>Milestone title *</span>
        <input id={titleId} value={title} onChange={event => setTitle(event.target.value)} required />
      </label>
      <label className="field full-width" htmlFor={descId}>
        <span>Description</span>
        <textarea id={descId} value={description} onChange={event => setDescription(event.target.value)} />
      </label>
      <label className="field" htmlFor={ownerSearchId}>
        <span>Search eligible owner</span>
        <input id={ownerSearchId} value={participants.query} onChange={event => participants.setQuery(event.target.value)} placeholder="Name or Employee ID" />
      </label>
      <label className="field" htmlFor={ownerSelectId}>
        <span>Owner</span>
        <select id={ownerSelectId} value={ownerId} onChange={event => setOwnerId(event.target.value)} disabled={participants.loading}>
          <option value="">{participants.loading ? 'Loading…' : 'Unassigned'}</option>
          {participants.profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.full_name_en}</option>)}
        </select>
      </label>
      <label className="field" htmlFor={startDateId}>
        <span>Start date *</span>
        <input
          id={startDateId}
          name="start_date"
          type="date"
          onChange={event => setStartDate(event.target.value)}
          required
        />
      </label>
      <label className="field" htmlFor={dueDateId}>
        <span>Due date *</span>
        <input
          id={dueDateId}
          name="due_date"
          type="date"
          onChange={event => setDueDate(event.target.value)}
          required
        />
      </label>
      <label className="checkbox-field">
        <input type="checkbox" checked={evidenceRequired} onChange={event => setEvidenceRequired(event.target.checked)} />
        Evidence required
      </label>
      <div className="form-actions full-width">
        <button className="ghost-button" type="button" onClick={onCancel}>Cancel</button>
        <button className="primary-button" disabled={saving || !title.trim()}>{saving ? 'Saving…' : 'Add Milestone'}</button>
      </div>
    </form>
  );
}

export function TaskForm({
  organizationId,
  projectId,
  milestones = [],
  onCreated,
  onCancel,
  onDirtyChange,
  onSubmittingChange,
}: WorkFormProps) {
  const titleId = useId();
  const descId = useId();
  const milestoneSelectId = useId();
  const participantSearchId = useId();
  const ownerSelectId = useId();
  const assignedSelectId = useId();
  const startDateId = useId();
  const dueDateId = useId();

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
  const isSubmittingRef = useRef(false);

  const participantContext = milestoneId ? { itemType: 'milestone' as const, itemId: milestoneId } : { itemType: 'project' as const, itemId: projectId };
  const participants = useContextualWorkParticipants(participantContext.itemType, participantContext.itemId, 'task_owner');

  const isDirty = useMemo(() => {
    return Boolean(
      title.trim() ||
      description.trim() ||
      milestoneId ||
      ownerId ||
      assignedTo ||
      participants.query ||
      startDate ||
      dueDate ||
      !evidenceRequired
    );
  }, [title, description, milestoneId, ownerId, assignedTo, participants.query, startDate, dueDate, evidenceRequired]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    onSubmittingChange?.(saving);
  }, [saving, onSubmittingChange]);

  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    if (dueDate && dueDate < val) {
      setDueDate('');
    }
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (isSubmittingRef.current) return;
    if (!title.trim()) return setError('Task title is required.');
    if (startDate && dueDate && dueDate < startDate) return setError('Task due date cannot precede its start date.');

    isSubmittingRef.current = true;
    setSaving(true);
    try {
      await createTask({
        organization_id: organizationId,
        project_id: projectId,
        milestone_id: milestoneId || undefined,
        title: title.trim(),
        description: description.trim() || undefined,
        owner_id: ownerId || undefined,
        assigned_to: assignedTo || undefined,
        start_date: startDate || undefined,
        due_date: dueDate || undefined,
        evidence_required: evidenceRequired
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task.');
    } finally {
      isSubmittingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <ErrorBlock error={error} />
      <ErrorBlock error={participants.error} />
      <label className="field full-width" htmlFor={titleId}>
        <span>Task title *</span>
        <input id={titleId} value={title} onChange={event => setTitle(event.target.value)} required />
      </label>
      <label className="field full-width" htmlFor={descId}>
        <span>Description</span>
        <textarea id={descId} value={description} onChange={event => setDescription(event.target.value)} />
      </label>
      <label className="field" htmlFor={milestoneSelectId}>
        <span>Milestone</span>
        <select id={milestoneSelectId} value={milestoneId} onChange={event => setMilestoneId(event.target.value)}>
          <option value="">No milestone</option>
          {milestones.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select>
      </label>
      <label className="field" htmlFor={participantSearchId}>
        <span>Search eligible participant</span>
        <input id={participantSearchId} value={participants.query} onChange={event => participants.setQuery(event.target.value)} placeholder="Name or Employee ID" />
      </label>
      <label className="field" htmlFor={ownerSelectId}>
        <span>Owner</span>
        <select id={ownerSelectId} value={ownerId} onChange={event => setOwnerId(event.target.value)} disabled={participants.loading}>
          <option value="">{participants.loading ? 'Loading…' : 'Unassigned'}</option>
          {participants.profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.full_name_en}</option>)}
        </select>
      </label>
      <label className="field" htmlFor={assignedSelectId}>
        <span>Assigned to</span>
        <select id={assignedSelectId} value={assignedTo} onChange={event => setAssignedTo(event.target.value)} disabled={participants.loading}>
          <option value="">{participants.loading ? 'Loading…' : 'Unassigned'}</option>
          {participants.profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.full_name_en}</option>)}
        </select>
      </label>
      <label className="field" htmlFor={startDateId}>
        <span>Start date</span>
        <input
          id={startDateId}
          type="date"
          value={startDate}
          max={dueDate || undefined}
          onChange={event => handleStartDateChange(event.target.value)}
        />
      </label>
      <label className="field" htmlFor={dueDateId}>
        <span>Due date</span>
        <input
          id={dueDateId}
          type="date"
          value={dueDate}
          min={startDate || undefined}
          onChange={event => setDueDate(event.target.value)}
        />
      </label>
      <label className="checkbox-field">
        <input type="checkbox" checked={evidenceRequired} onChange={event => setEvidenceRequired(event.target.checked)} />
        Evidence required
      </label>
      <div className="form-actions full-width">
        <button className="ghost-button" type="button" onClick={onCancel}>Cancel</button>
        <button className="primary-button" disabled={saving || !title.trim()}>{saving ? 'Saving…' : 'Add Task'}</button>
      </div>
    </form>
  );
}
