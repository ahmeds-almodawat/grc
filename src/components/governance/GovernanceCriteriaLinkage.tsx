import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  FileCheck2,
  FileText,
  GitBranch,
  History,
  Link2,
  ListChecks,
  LockKeyhole,
  Plus,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import {
  appendGovernanceCriterionDecision,
  completeGovernanceLinkageReview,
  getCurrentGovernanceCriteriaLinks,
  getGovernanceCriteriaDecisionHistory,
  getGovernanceCriteriaEvidence,
  getGovernanceCriteriaLineage,
  getGovernanceLinkageReviews,
  resolveGovernanceDocumentVersionCandidates,
  startGovernanceLinkageReview,
  suggestGovernanceCriterionLink,
  type GovernanceAdequacyStatus,
  type GovernanceAdherenceStatus,
  type GovernanceCriteriaDecision,
  type GovernanceCriteriaLink,
  type GovernanceDecisionType,
  type GovernanceLinkageReview,
  type GovernanceReviewOutcome,
  type GovernanceSignificance,
  type GovernanceSourceType,
} from '../../lib/governanceCriteriaLinkageApi';
import {
  getGovernedPolicyDetail,
  getGovernedSopDetail,
  listGovernedPolicies,
  listGovernedSops,
  type GovernedPolicyCatalogRow,
  type GovernedSopCatalogRow,
  type PolicyRequirement,
  type SopProcedureStep,
} from '../../lib/policySopApi';
import {
  getUi3AccreditationClauseOptions,
  getUi3ComplianceObligationOptions,
  getUi3ControlOptions,
  getUi3EvidenceOptions,
  type Ui3EvidenceOption,
  type Ui3GovernanceCriterionOption,
} from '../../lib/ui3RiskComplianceApi';
import { isRestrictedGovernanceLink, versionResolutionLabel } from '../../lib/ui3RiskComplianceModel';
import { formatDate, humanize } from '../../lib/format';

export interface GovernanceCriteriaSource {
  type: Extract<GovernanceSourceType, 'risk' | 'compliance_assessment' | 'audit_finding' | 'capa'>;
  id: string;
  revisionId?: string | null;
  organizationId: string;
  sourceDate: string | null;
  departmentId?: string | null;
}

interface GovernanceCriteriaLinkageProps {
  source: GovernanceCriteriaSource;
  mode: 'risk' | 'compliance' | 'audit' | 'capa';
  title: string;
  canManage?: boolean;
  canSuggest?: boolean;
  canReview?: boolean;
  requiredObligationId?: string | null;
  onReviewChange?: (review: GovernanceLinkageReview | null) => void;
  onLinksChange?: (links: GovernanceCriteriaLink[]) => void;
}

type DocumentChoice = GovernedPolicyCatalogRow | GovernedSopCatalogRow;

const significanceOptions: GovernanceSignificance[] = ['primary', 'contributing', 'context_only'];
const adherenceOptions: GovernanceAdherenceStatus[] = [
  'complied', 'partial_adherence', 'noncompliance', 'procedure_not_followed', 'authorized_exception',
  'emergency_justified_deviation', 'insufficient_evidence', 'not_applicable', 'unknown',
];
const adequacyOptions: GovernanceAdequacyStatus[] = [
  'adequate', 'unclear', 'incomplete', 'conflicting', 'obsolete_version_used', 'missing_policy',
  'missing_sop', 'implementation_gap', 'training_competency_gap', 'control_failed_despite_compliance',
  'related_context_only', 'not_applicable', 'not_assessed',
];
const reviewOutcomes: GovernanceReviewOutcome[] = [
  'confirmed_relationship', 'related_not_violated', 'no_applicable_document', 'document_gap', 'insufficient_evidence',
];

function snapshotValue(link: GovernanceCriteriaLink, key: string) {
  const value = link.resolution_snapshot?.[key];
  return value === null || value === undefined || value === '' ? null : String(value);
}

function criterionLabel(link: GovernanceCriteriaLink) {
  if (isRestrictedGovernanceLink(link)) return 'Restricted governance document';
  return link.target_display_label || humanize(link.target_criterion_type);
}

function toggleSet(current: Set<string>, id: string) {
  const next = new Set(current);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export function GovernanceCriteriaLinkage({
  source,
  mode,
  title,
  canManage = false,
  canSuggest,
  canReview,
  requiredObligationId,
  onReviewChange,
  onLinksChange,
}: GovernanceCriteriaLinkageProps) {
  const { language } = useI18n();
  const text = useCallback((en: string, ar: string) => language === 'ar' ? ar : en, [language]);
  const maySuggest = canSuggest ?? canManage;
  const mayReview = canReview ?? canManage;
  const exactVersionRequired = source.type === 'compliance_assessment'
    || source.type === 'audit_finding'
    || source.type === 'capa'
    || Boolean(source.revisionId);
  const [links, setLinks] = useState<GovernanceCriteriaLink[]>([]);
  const [reviews, setReviews] = useState<GovernanceLinkageReview[]>([]);
  const [decisions, setDecisions] = useState<GovernanceCriteriaDecision[]>([]);
  const [evidence, setEvidence] = useState<Awaited<ReturnType<typeof getGovernanceCriteriaEvidence>>>([]);
  const [lineage, setLineage] = useState<Awaited<ReturnType<typeof getGovernanceCriteriaLineage>>>([]);
  const [policies, setPolicies] = useState<GovernedPolicyCatalogRow[]>([]);
  const [sops, setSops] = useState<GovernedSopCatalogRow[]>([]);
  const [obligations, setObligations] = useState<Ui3GovernanceCriterionOption[]>([]);
  const [controls, setControls] = useState<Ui3GovernanceCriterionOption[]>([]);
  const [clauses, setClauses] = useState<Ui3GovernanceCriterionOption[]>([]);
  const [evidenceOptions, setEvidenceOptions] = useState<Ui3EvidenceOption[]>([]);
  const [selectedPolicies, setSelectedPolicies] = useState<Set<string>>(new Set());
  const [selectedSops, setSelectedSops] = useState<Set<string>>(new Set());
  const [policySearch, setPolicySearch] = useState('');
  const [sopSearch, setSopSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resolverWarnings, setResolverWarnings] = useState<string[]>([]);
  const [overrideRationale, setOverrideRationale] = useState('');
  const [supplementalRationale, setSupplementalRationale] = useState('');
  const [decisionLinkId, setDecisionLinkId] = useState<string | null>(null);
  const [decisionType, setDecisionType] = useState<Exclude<GovernanceDecisionType, 'suggested'>>('confirmed');
  const [significance, setSignificance] = useState<GovernanceSignificance>('primary');
  const [adherence, setAdherence] = useState<GovernanceAdherenceStatus>('unknown');
  const [adequacy, setAdequacy] = useState<GovernanceAdequacyStatus>('not_assessed');
  const [decisionRationale, setDecisionRationale] = useState('');
  const [selectedEvidence, setSelectedEvidence] = useState<Set<string>>(new Set());
  const [reviewOutcome, setReviewOutcome] = useState<GovernanceReviewOutcome>('confirmed_relationship');
  const [reviewRationale, setReviewRationale] = useState('');
  const [showCompletion, setShowCompletion] = useState(false);
  const [drilldown, setDrilldown] = useState<{ kind: 'policy' | 'sop'; document: DocumentChoice } | null>(null);
  const [requirements, setRequirements] = useState<PolicyRequirement[]>([]);
  const [steps, setSteps] = useState<SopProcedureStep[]>([]);
  const [otherCriterion, setOtherCriterion] = useState<'compliance_obligation' | 'accreditation_clause' | 'control'>('compliance_obligation');
  const [otherCriterionId, setOtherCriterionId] = useState('');

  const currentReview = useMemo(
    () => reviews.find((review) => review.review_status === 'under_review' || review.review_status === 'draft') ?? reviews[0] ?? null,
    [reviews],
  );

  const filteredPolicies = useMemo(() => {
    const query = policySearch.trim().toLowerCase();
    return policies.filter((policy) => !query || `${policy.document_code} ${policy.document_title}`.toLowerCase().includes(query));
  }, [policies, policySearch]);
  const filteredSops = useMemo(() => {
    const query = sopSearch.trim().toLowerCase();
    return sops.filter((sop) => !query || `${sop.document_code} ${sop.document_title}`.toLowerCase().includes(query));
  }, [sops, sopSearch]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [allLinks, reviewRows, policyRows, sopRows, obligationRows, controlRows, clauseRows, evidenceRows] = await Promise.all([
        getCurrentGovernanceCriteriaLinks({ type: source.type, id: source.id }),
        getGovernanceLinkageReviews({ type: source.type, id: source.id, revisionId: source.revisionId }),
        listGovernedPolicies(),
        listGovernedSops(),
        getUi3ComplianceObligationOptions(),
        getUi3ControlOptions(),
        getUi3AccreditationClauseOptions(),
        getUi3EvidenceOptions(),
      ]);
      const scopedLinks = allLinks.filter((link) => (link.source_revision_id ?? null) === (source.revisionId ?? null));
      const decisionRows = await getGovernanceCriteriaDecisionHistory(scopedLinks.map((link) => link.link_id));
      const [lineageRows, evidenceLinks] = await Promise.all([
        getGovernanceCriteriaLineage(scopedLinks.map((link) => link.link_id)),
        getGovernanceCriteriaEvidence(decisionRows.map((decision) => decision.id)),
      ]);
      setLinks(scopedLinks);
      setReviews(reviewRows);
      setDecisions(decisionRows);
      setLineage(lineageRows);
      setEvidence(evidenceLinks);
      setPolicies(policyRows);
      setSops(sopRows);
      setObligations(obligationRows);
      setControls(controlRows);
      setClauses(clauseRows);
      setEvidenceOptions(evidenceRows);
      onReviewChange?.(reviewRows[0] ?? null);
      onLinksChange?.(scopedLinks);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : text('Governance Context could not be loaded.', 'تعذر تحميل سياق الحوكمة.'));
    } finally {
      setLoading(false);
    }
  }, [onLinksChange, onReviewChange, source.id, source.revisionId, source.type, text]);

  useEffect(() => { void load(); }, [load]);

  async function ensureReview() {
    const active = reviews.find((review) => review.review_status === 'under_review' || review.review_status === 'draft');
    if (active) return active.id;
    const created = await startGovernanceLinkageReview({
      sourceEntityType: source.type,
      sourceEntityId: source.id,
      sourceRevisionId: source.revisionId,
      sourceDate: source.sourceDate,
      reviewRationale: mode === 'risk'
        ? 'Risk Governance Context review.'
        : mode === 'compliance'
          ? 'Compliance obligation and internal governance basis review.'
          : mode === 'audit'
            ? 'Independent auditor determination of the exact governed criterion.'
            : 'CAPA source inheritance and supplemental governance linkage review.',
    });
    return created.review_id;
  }

  async function resolveChoice(document: DocumentChoice) {
    if (!exactVersionRequired) return { versionId: null, method: 'persistent_context' as const, warning: null };
    const candidates = await resolveGovernanceDocumentVersionCandidates({
      organizationId: source.organizationId,
      documentId: document.document_id,
      sourceDate: source.sourceDate,
      departmentId: source.departmentId,
    });
    const exact = candidates.find((candidate) => ['exactly_one', 'exactly_one_with_approved_exception'].includes(candidate.resolution_status));
    if (exact?.candidate_version_id) return { versionId: exact.candidate_version_id, method: 'resolver_exact' as const, warning: null };
    const warning = candidates[0]
      ? `${document.document_code}: ${versionResolutionLabel(candidates[0].resolution_status)}. ${candidates[0].diagnostic_detail}`
      : `${document.document_code}: ${text('No version resolution result.', 'لا توجد نتيجة لحل الإصدار.')}`;
    if (overrideRationale.trim().length >= 3 && document.version_id) {
      return { versionId: document.version_id, method: 'reviewer_override' as const, warning };
    }
    return { versionId: null, method: 'resolver_exact' as const, warning };
  }

  async function addDocuments(kind: 'policy' | 'sop') {
    const choices = kind === 'policy'
      ? policies.filter((item) => selectedPolicies.has(item.document_id))
      : sops.filter((item) => selectedSops.has(item.document_id));
    if (!choices.length || !maySuggest || (mode === 'capa' && supplementalRationale.trim().length < 3)) return;
    setBusy(true);
    setError(null);
    setResolverWarnings([]);
    try {
      const reviewId = await ensureReview();
      const warnings: string[] = [];
      for (const choice of choices) {
        const resolution = await resolveChoice(choice);
        if (resolution.warning) warnings.push(resolution.warning);
        if (exactVersionRequired && !resolution.versionId) continue;
        await suggestGovernanceCriterionLink({
          reviewId,
          targetCriterionType: kind,
          targetDocumentId: choice.document_id,
          targetVersionId: resolution.versionId,
          relationshipOrigin: 'direct',
          resolutionMethod: resolution.method,
          resolutionDate: source.sourceDate,
          overrideRationale: resolution.method === 'reviewer_override' ? overrideRationale : null,
          rationale: mode === 'risk'
            ? 'Governance Context relationship.'
            : mode === 'compliance'
              ? 'Internal implementation basis for the assessed obligation.'
              : mode === 'audit'
                ? 'Auditor-determined criterion applicable at the audit resolution date.'
                : supplementalRationale,
        });
      }
      setResolverWarnings(warnings);
      setSelectedPolicies(new Set());
      setSelectedSops(new Set());
      if (mode === 'capa') setSupplementalRationale('');
      setNotice(warnings.length
        ? text('Some selections require version review before they can be added.', 'تتطلب بعض الاختيارات مراجعة الإصدار قبل إضافتها.')
        : text('Governance criteria added for review.', 'تمت إضافة معايير الحوكمة للمراجعة.'));
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : text('Criteria could not be added.', 'تعذرت إضافة المعايير.'));
    } finally {
      setBusy(false);
    }
  }

  async function openDrilldown(kind: 'policy' | 'sop', document: DocumentChoice) {
    setDrilldown({ kind, document });
    setRequirements([]);
    setSteps([]);
    if (!document.version_id) return;
    if (kind === 'policy') {
      const detail = await getGovernedPolicyDetail(document.document_id, document.version_id);
      setRequirements(detail?.requirements ?? []);
    } else {
      const detail = await getGovernedSopDetail(document.document_id, document.version_id);
      setSteps(detail?.procedure_steps ?? []);
    }
  }

  async function addDetailCriterion(item: PolicyRequirement | SopProcedureStep) {
    if (!drilldown?.document.version_id || !('id' in item) || !item.id || !maySuggest || (mode === 'capa' && supplementalRationale.trim().length < 3)) return;
    setBusy(true);
    try {
      const reviewId = await ensureReview();
      await suggestGovernanceCriterionLink({
        reviewId,
        targetCriterionType: drilldown.kind === 'policy' ? 'policy_requirement' : 'sop_step',
        targetDocumentId: drilldown.document.document_id,
        targetVersionId: drilldown.document.version_id,
        targetPolicyRequirementId: drilldown.kind === 'policy' ? item.id : null,
        targetSopStepId: drilldown.kind === 'sop' ? item.id : null,
        resolutionMethod: 'direct_selection',
        resolutionDate: source.sourceDate,
        rationale: mode === 'capa'
          ? supplementalRationale
          : drilldown.kind === 'policy' ? 'Specific governed policy requirement.' : 'Specific governed SOP procedure step.',
      });
      setNotice(text('Detailed criterion added for review.', 'تمت إضافة المعيار التفصيلي للمراجعة.'));
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : text('Detailed criterion could not be added.', 'تعذرت إضافة المعيار التفصيلي.'));
    } finally {
      setBusy(false);
    }
  }

  async function addOtherCriterion() {
    if (!otherCriterionId || !maySuggest || (mode === 'capa' && supplementalRationale.trim().length < 3)) return;
    setBusy(true);
    try {
      const reviewId = await ensureReview();
      await suggestGovernanceCriterionLink({
        reviewId,
        targetCriterionType: otherCriterion,
        targetComplianceObligationId: otherCriterion === 'compliance_obligation' ? otherCriterionId : null,
        targetAccreditationClauseId: otherCriterion === 'accreditation_clause' ? otherCriterionId : null,
        targetControlId: otherCriterion === 'control' ? otherCriterionId : null,
        resolutionMethod: 'direct_selection',
        resolutionDate: source.sourceDate,
        rationale: mode === 'capa'
          ? supplementalRationale
          : otherCriterion === 'compliance_obligation' && otherCriterionId === requiredObligationId
          ? 'External obligation assessed by this Compliance assessment.'
          : 'Additional governed criterion relationship.',
      });
      setOtherCriterionId('');
      setNotice(text('Additional criterion added for review.', 'تمت إضافة معيار إضافي للمراجعة.'));
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : text('Criterion could not be added.', 'تعذرت إضافة المعيار.'));
    } finally {
      setBusy(false);
    }
  }

  async function submitDecision() {
    if (!decisionLinkId || decisionRationale.trim().length < 3) return;
    setBusy(true);
    try {
      const current = links.find((link) => link.link_id === decisionLinkId);
      await appendGovernanceCriterionDecision({
        linkId: decisionLinkId,
        decisionType,
        significance: decisionType === 'confirmed' ? significance : null,
        adherenceStatus: decisionType === 'confirmed' ? adherence : null,
        adequacyStatus: decisionType === 'confirmed' ? adequacy : null,
        rationale: decisionRationale,
        correctionReason: current?.current_decision_id ? decisionRationale : null,
        supersedesDecisionId: current?.current_decision_id ?? null,
        evidenceFileIds: [...selectedEvidence],
      });
      setDecisionLinkId(null);
      setDecisionRationale('');
      setSelectedEvidence(new Set());
      setNotice(text('Append-only governance decision recorded.', 'تم تسجيل قرار الحوكمة كسجل غير قابل للاستبدال.'));
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : text('Decision could not be recorded.', 'تعذر تسجيل القرار.'));
    } finally {
      setBusy(false);
    }
  }

  async function completeReview() {
    if (!currentReview || currentReview.review_status === 'completed' || reviewRationale.trim().length < 3) return;
    setBusy(true);
    try {
      await completeGovernanceLinkageReview({
        reviewId: currentReview.id,
        reviewOutcome,
        reviewRationale,
        uncertaintyRecorded: reviewOutcome === 'insufficient_evidence',
      });
      setShowCompletion(false);
      setReviewRationale('');
      setNotice(text('Governance review completed and retained.', 'اكتملت مراجعة الحوكمة وتم الاحتفاظ بها.'));
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : text('Review could not be completed.', 'تعذر إكمال المراجعة.'));
    } finally {
      setBusy(false);
    }
  }

  const otherOptions = otherCriterion === 'compliance_obligation' ? obligations : otherCriterion === 'control' ? controls : clauses;
  const contextLabel = mode === 'risk'
    ? text('Governance Context', 'سياق الحوكمة')
    : mode === 'compliance'
      ? text('Governance basis', 'أساس الحوكمة')
      : mode === 'audit'
        ? text('Audit criteria', 'معايير المراجعة')
        : text('CAPA governance linkage', 'ربط حوكمة الإجراءات التصحيحية');

  return (
    <section className="ui3-governance-workspace" data-testid="governance-criteria-linkage" aria-labelledby="ui3-governance-title">
      <header className="ui3-section-header">
        <div>
          <span><ShieldCheck size={15} /> {contextLabel}</span>
          <h2 id="ui3-governance-title">{title}</h2>
          <p>{mode === 'capa'
            ? text('Inherited source determinations are read-only. Supplemental links require a separate rationale and exact version.', 'تكون تحديدات المصدر الموروثة للقراءة فقط. تتطلب الروابط الإضافية مبرراً مستقلاً وإصداراً دقيقاً.')
            : exactVersionRequired
            ? text('This review preserves exact approved document versions for the governing resolution date.', 'تحتفظ هذه المراجعة بإصدارات الوثائق المعتمدة الدقيقة لتاريخ الحل الحاكم.')
            : text('Persistent context follows the Risk without rewriting historical assessment snapshots.', 'يتبع السياق المستمر الخطر دون إعادة كتابة لقطات التقييم التاريخية.')}</p>
        </div>
        <div className="ui3-governance-status">
          <span className={`ui3-status ui3-status--${currentReview?.review_status === 'completed' ? 'success' : currentReview ? 'warning' : 'neutral'}`}>
            {currentReview ? humanize(currentReview.review_status, language) : text('Not started', 'لم تبدأ')}
          </span>
          {currentReview?.review_outcome ? <small>{humanize(currentReview.review_outcome, language)}</small> : null}
        </div>
      </header>

      {error ? <div className="ui3-alert ui3-alert--danger" role="alert"><AlertTriangle size={16} /><span>{error}</span></div> : null}
      {notice ? <div className="ui3-alert ui3-alert--success" role="status"><CheckCircle2 size={16} /><span>{notice}</span></div> : null}
      {loading ? <div className="ui3-linkage-loading">{text('Loading governed relationships…', 'جار تحميل العلاقات المحكومة…')}</div> : null}

      {mode === 'capa' ? (
        <label className="ui3-full-field ui4-supplemental-rationale">
          <span>{text('Supplemental-link rationale', 'مبرر الرابط الإضافي')}</span>
          <textarea value={supplementalRationale} onChange={(event) => setSupplementalRationale(event.target.value)} placeholder={text('Required before adding a direct CAPA criterion.', 'مطلوب قبل إضافة معيار مباشر للإجراء التصحيحي.')} />
        </label>
      ) : null}

      <div className="ui3-selector-grid" aria-label={text('Governance document selectors', 'محددات وثائق الحوكمة')}>
        <fieldset className="ui3-document-selector">
          <legend><FileText size={16} /> {text('Related Policies', 'السياسات ذات الصلة')}</legend>
          <label className="ui3-search-input">
            <span className="sr-only">{text('Search Policies', 'بحث السياسات')}</span>
            <Search size={15} />
            <input value={policySearch} onChange={(event) => setPolicySearch(event.target.value)} placeholder={text('Search code or title', 'البحث بالرمز أو العنوان')} />
          </label>
          <div className="ui3-selector-options">
            {filteredPolicies.slice(0, 8).map((policy) => (
              <div className="ui3-selector-option" key={policy.document_id}>
                <label>
                  <input type="checkbox" disabled={!maySuggest} checked={selectedPolicies.has(policy.document_id)} onChange={() => setSelectedPolicies((current) => toggleSet(current, policy.document_id))} />
                  <span><strong>{policy.document_code || 'POL'}</strong><small>{policy.document_title}</small></span>
                  <em>v{policy.version_label || policy.version_number || '—'}</em>
                </label>
                <button type="button" className="ui3-icon-button" title={text('View requirements', 'عرض المتطلبات')} onClick={() => void openDrilldown('policy', policy)} disabled={!policy.version_id}>
                  <ListChecks size={15} /><span className="sr-only">{text('View requirements', 'عرض المتطلبات')}</span>
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="ui3-secondary-button" disabled={!maySuggest || busy || !selectedPolicies.size || (mode === 'capa' && supplementalRationale.trim().length < 3)} title={!maySuggest ? text('Your role cannot suggest governance links.', 'لا يمكن لدورك اقتراح روابط الحوكمة.') : undefined} onClick={() => void addDocuments('policy')}>
            <Plus size={15} /> {text('Add selected Policies', 'إضافة السياسات المحددة')}
          </button>
        </fieldset>

        <fieldset className="ui3-document-selector">
          <legend><FileCheck2 size={16} /> {text('Related SOPs', 'إجراءات التشغيل ذات الصلة')}</legend>
          <label className="ui3-search-input">
            <span className="sr-only">{text('Search SOPs', 'بحث إجراءات التشغيل')}</span>
            <Search size={15} />
            <input value={sopSearch} onChange={(event) => setSopSearch(event.target.value)} placeholder={text('Search code or title', 'البحث بالرمز أو العنوان')} />
          </label>
          <div className="ui3-selector-options">
            {filteredSops.slice(0, 8).map((sop) => (
              <div className="ui3-selector-option" key={sop.document_id}>
                <label>
                  <input type="checkbox" disabled={!maySuggest} checked={selectedSops.has(sop.document_id)} onChange={() => setSelectedSops((current) => toggleSet(current, sop.document_id))} />
                  <span><strong>{sop.document_code || 'SOP'}</strong><small>{sop.document_title}</small></span>
                  <em>v{sop.version_label || sop.version_number || '—'}</em>
                </label>
                <button type="button" className="ui3-icon-button" title={text('View procedure steps', 'عرض خطوات الإجراء')} onClick={() => void openDrilldown('sop', sop)} disabled={!sop.version_id}>
                  <ListChecks size={15} /><span className="sr-only">{text('View procedure steps', 'عرض خطوات الإجراء')}</span>
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="ui3-secondary-button" disabled={!maySuggest || busy || !selectedSops.size || (mode === 'capa' && supplementalRationale.trim().length < 3)} title={!maySuggest ? text('Your role cannot suggest governance links.', 'لا يمكن لدورك اقتراح روابط الحوكمة.') : undefined} onClick={() => void addDocuments('sop')}>
            <Plus size={15} /> {text('Add selected SOPs', 'إضافة الإجراءات المحددة')}
          </button>
        </fieldset>
      </div>

      {resolverWarnings.length ? (
        <div className="ui3-resolution-warning" role="status">
          <AlertTriangle size={17} />
          <div><strong>{text('Version resolution requires attention', 'يتطلب حل الإصدار الانتباه')}</strong>{resolverWarnings.map((warning) => <p key={warning}>{warning}</p>)}</div>
          <label><span>{text('Authorized override rationale', 'مبرر التجاوز المعتمد')}</span><textarea value={overrideRationale} onChange={(event) => setOverrideRationale(event.target.value)} /></label>
        </div>
      ) : null}

      <details className="ui3-other-criteria">
        <summary><ChevronDown size={16} /> {text('Additional governed criteria', 'معايير حوكمة إضافية')}</summary>
        <div>
          <label><span>{text('Criterion type', 'نوع المعيار')}</span><select value={otherCriterion} onChange={(event) => { setOtherCriterion(event.target.value as typeof otherCriterion); setOtherCriterionId(''); }}><option value="compliance_obligation">{text('Compliance Obligation', 'التزام الامتثال')}</option><option value="accreditation_clause">{text('Accreditation Clause', 'بند الاعتماد')}</option><option value="control">{text('Control', 'الضابط')}</option></select></label>
          <label><span>{text('Governed record', 'السجل المحكوم')}</span><select value={otherCriterionId} onChange={(event) => setOtherCriterionId(event.target.value)}><option value="">{text('Select a record', 'اختر سجلاً')}</option>{otherOptions.map((item) => <option value={item.id} key={item.id}>{item.code} — {item.title}{item.id === requiredObligationId ? ` (${text('assessed obligation', 'الالتزام المقيم')})` : ''}</option>)}</select></label>
          <button type="button" className="ui3-secondary-button" disabled={!maySuggest || busy || !otherCriterionId || (mode === 'capa' && supplementalRationale.trim().length < 3)} onClick={() => void addOtherCriterion()}><Plus size={15} /> {text('Add criterion', 'إضافة معيار')}</button>
        </div>
      </details>

      {drilldown ? (
        <section className="ui3-criterion-drilldown" aria-label={text('Criterion drill-down', 'تفاصيل المعيار')}>
          <header><div><strong>{drilldown.document.document_code}</strong><span>{drilldown.document.document_title}</span></div><button type="button" className="ui3-icon-button" onClick={() => setDrilldown(null)} aria-label={text('Close drill-down', 'إغلاق التفاصيل')}>×</button></header>
          <div>
            {drilldown.kind === 'policy' ? requirements.map((requirement) => <article key={requirement.id}><span>{String(requirement.sequence_number).padStart(2, '0')}</span><p>{language === 'ar' ? requirement.requirement_statement_ar || requirement.requirement_statement_en : requirement.requirement_statement_en}</p><button type="button" disabled={!maySuggest || busy || (mode === 'capa' && supplementalRationale.trim().length < 3)} onClick={() => void addDetailCriterion(requirement)}>{text('Add requirement', 'إضافة المتطلب')}</button></article>) : null}
            {drilldown.kind === 'sop' ? steps.map((step) => <article key={step.id}><span>{String(step.sequence_number).padStart(2, '0')}</span><p>{language === 'ar' ? step.action_instruction_ar || step.action_instruction_en : step.action_instruction_en}</p><button type="button" disabled={!maySuggest || busy || (mode === 'capa' && supplementalRationale.trim().length < 3)} onClick={() => void addDetailCriterion(step)}>{text('Add step', 'إضافة الخطوة')}</button></article>) : null}
            {drilldown.kind === 'policy' && !requirements.length ? <p>{text('No requirements are visible for this version.', 'لا توجد متطلبات ظاهرة لهذا الإصدار.')}</p> : null}
            {drilldown.kind === 'sop' && !steps.length ? <p>{text('No procedure steps are visible for this version.', 'لا توجد خطوات إجراء ظاهرة لهذا الإصدار.')}</p> : null}
          </div>
        </section>
      ) : null}

      <section className="ui3-link-register">
        <div className="ui3-subsection-title"><div><Link2 size={17} /><span><strong>{text('Governed relationships', 'العلاقات المحكومة')}</strong><small>{links.length} {text('relationship records', 'سجلات علاقة')}</small></span></div>{mayReview ? <button type="button" className="ui3-secondary-button" onClick={() => setShowCompletion((value) => !value)} disabled={!currentReview || currentReview.review_status === 'completed'}><ShieldCheck size={15} /> {text('Complete review', 'إكمال المراجعة')}</button> : null}</div>
        {!links.length && !loading ? <div className="ui3-empty-state"><Link2 size={22} /><strong>{text('No governance relationships recorded', 'لا توجد علاقات حوكمة مسجلة')}</strong><p>{text('A valid completed review may still conclude that no document applies, with rationale.', 'يمكن أن تخلص المراجعة المكتملة بشكل صحيح إلى عدم انطباق أي وثيقة مع ذكر المبرر.')}</p></div> : null}
        <div className="ui3-link-list">
          {links.map((link) => {
            const linkDecisions = decisions.filter((decision) => decision.link_id === link.link_id);
            const linkEvidence = evidence.filter((row) => linkDecisions.some((decision) => decision.id === row.decision_id));
            const version = snapshotValue(link, 'version_label') || snapshotValue(link, 'version_number');
            return (
              <article className="ui3-link-row" key={link.link_id}>
                <div className="ui3-link-row__identity">
                  <span className={`ui3-criterion-icon ${isRestrictedGovernanceLink(link) ? 'is-restricted' : ''}`}>{isRestrictedGovernanceLink(link) ? <LockKeyhole size={16} /> : <FileCheck2 size={16} />}</span>
                  <div><small>{humanize(link.target_criterion_type, language)}</small><strong>{criterionLabel(link)}</strong><p>{version ? `v${version} · ${formatDate(snapshotValue(link, 'version_effective_date'))}` : text('Persistent context / non-versioned criterion', 'سياق مستمر / معيار بلا إصدار')}</p></div>
                </div>
                <div className="ui3-link-row__status"><span className={`ui3-status ui3-status--${link.decision_type === 'confirmed' ? 'success' : link.decision_type === 'rejected' ? 'danger' : 'warning'}`}>{humanize(link.decision_type || 'suggested', language)}</span><small>{humanize(link.significance || 'not_assessed', language)}</small></div>
                <dl><div><dt>{text('Adherence', 'الالتزام')}</dt><dd>{humanize(link.adherence_status || 'not_assessed', language)}</dd></div><div><dt>{text('Adequacy', 'الكفاية')}</dt><dd>{humanize(link.adequacy_status || 'not_assessed', language)}</dd></div><div><dt>{text('Resolution', 'الحل')}</dt><dd>{humanize(link.resolution_method, language)}</dd></div><div><dt>{text('Evidence', 'الأدلة')}</dt><dd>{linkEvidence.length}</dd></div></dl>
                <div className="ui3-link-row__lineage">{link.inherited ? <span><GitBranch size={14} /> {text('Inherited', 'موروث')}</span> : <span><Link2 size={14} /> {text('Direct', 'مباشر')}</span>}<small>{link.root_event_key}</small></div>
                <button type="button" className="ui3-secondary-button" disabled={!mayReview || link.inherited || busy} title={link.inherited ? text('Inherited source determinations are read-only.', 'تحديدات المصدر الموروثة للقراءة فقط.') : !mayReview ? text('Independent reviewer permission is required.', 'يلزم إذن مراجع مستقل.') : undefined} onClick={() => { setDecisionLinkId(link.link_id); setDecisionRationale(''); }}>{link.inherited ? text('Source-owned', 'مملوك للمصدر') : link.current_decision_id ? text('Correct decision', 'تصحيح القرار') : text('Review link', 'مراجعة الرابط')}</button>
                <details className="ui3-link-history"><summary><History size={14} /> {text('Decision history', 'سجل القرارات')} ({linkDecisions.length})</summary><ol>{linkDecisions.map((decision) => <li key={decision.id}><span className={`ui3-history-dot ui3-history-dot--${decision.decision_type}`} /><div><strong>{humanize(decision.decision_type, language)} · {formatDate(decision.decided_at)}</strong><p>{decision.rationale || text('No rationale recorded.', 'لا يوجد مبرر مسجل.')}</p><small>{decision.correction_reason ? `${text('Correction', 'تصحيح')}: ${decision.correction_reason}` : text('Original decision', 'القرار الأصلي')}</small></div></li>)}</ol></details>
              </article>
            );
          })}
        </div>
      </section>

      {decisionLinkId ? (
        <section className="ui3-governance-decision" aria-label={text('Governance decision', 'قرار الحوكمة')}>
          <header><div><strong>{text('Record governed decision', 'تسجيل قرار محكوم')}</strong><p>{text('The previous decision remains in history. This action appends a new decision.', 'يبقى القرار السابق في السجل. يضيف هذا الإجراء قراراً جديداً.')}</p></div><button type="button" className="ui3-icon-button" onClick={() => setDecisionLinkId(null)} aria-label={text('Close decision form', 'إغلاق نموذج القرار')}>×</button></header>
          <div className="ui3-decision-grid">
            <label><span>{text('Confirmation', 'التأكيد')}</span><select value={decisionType} onChange={(event) => setDecisionType(event.target.value as typeof decisionType)}><option value="confirmed">{text('Confirmed', 'مؤكد')}</option><option value="rejected">{text('Rejected', 'مرفوض')}</option><option value="under_review">{text('Under review', 'قيد المراجعة')}</option><option value="superseded">{text('Superseded', 'مستبدل')}</option></select></label>
            {decisionType === 'confirmed' ? <><label><span>{text('Significance', 'الأهمية')}</span><select value={significance} onChange={(event) => setSignificance(event.target.value as GovernanceSignificance)}>{significanceOptions.map((value) => <option key={value} value={value}>{humanize(value, language)}</option>)}</select></label><label><span>{text('Adherence', 'الالتزام')}</span><select value={adherence} onChange={(event) => setAdherence(event.target.value as GovernanceAdherenceStatus)}>{adherenceOptions.map((value) => <option key={value} value={value}>{humanize(value, language)}</option>)}</select></label><label><span>{text('Adequacy', 'الكفاية')}</span><select value={adequacy} onChange={(event) => setAdequacy(event.target.value as GovernanceAdequacyStatus)}>{adequacyOptions.map((value) => <option key={value} value={value}>{humanize(value, language)}</option>)}</select></label></> : null}
          </div>
          <label className="ui3-full-field"><span>{text('Rationale', 'المبرر')}</span><textarea value={decisionRationale} onChange={(event) => setDecisionRationale(event.target.value)} required /></label>
          <details className="ui3-evidence-picker"><summary>{text('Link permitted evidence', 'ربط الأدلة المسموح بها')} ({selectedEvidence.size})</summary><div>{evidenceOptions.map((item) => <label key={item.id}><input type="checkbox" checked={selectedEvidence.has(item.id)} onChange={() => setSelectedEvidence((current) => toggleSet(current, item.id))} /><span>{item.file_name}</span></label>)}</div></details>
          <div className="ui3-form-actions"><button type="button" className="ui3-secondary-button" onClick={() => setDecisionLinkId(null)}>{text('Cancel', 'إلغاء')}</button><button type="button" className="ui3-primary-button" disabled={busy || decisionRationale.trim().length < 3} onClick={() => void submitDecision()}>{text('Append decision', 'إضافة القرار')}</button></div>
        </section>
      ) : null}

      {showCompletion ? (
        <section className="ui3-review-completion">
          <div><strong>{text('Complete governance review', 'إكمال مراجعة الحوكمة')}</strong><p>{text('Zero-link outcomes are valid when the conclusion and rationale are explicit.', 'تكون نتائج عدم وجود روابط صالحة عندما تكون الخلاصة والمبرر واضحين.')}</p></div>
          <label><span>{text('Review outcome', 'نتيجة المراجعة')}</span><select value={reviewOutcome} onChange={(event) => setReviewOutcome(event.target.value as GovernanceReviewOutcome)}>{reviewOutcomes.map((value) => <option key={value} value={value}>{humanize(value, language)}</option>)}</select></label>
          <label><span>{text('Review rationale', 'مبرر المراجعة')}</span><textarea value={reviewRationale} onChange={(event) => setReviewRationale(event.target.value)} /></label>
          <div className="ui3-form-actions"><button type="button" className="ui3-secondary-button" onClick={() => setShowCompletion(false)}>{text('Cancel', 'إلغاء')}</button><button type="button" className="ui3-primary-button" disabled={busy || reviewRationale.trim().length < 3} onClick={() => void completeReview()}>{text('Complete review', 'إكمال المراجعة')}</button></div>
        </section>
      ) : null}

      <footer className="ui3-governance-footer"><span><GitBranch size={14} /> {lineage.length} {text('lineage records', 'سجلات تسلسل')}</span><span><History size={14} /> {decisions.length} {text('immutable decisions', 'قرارات غير قابلة للتعديل')}</span>{exactVersionRequired ? <span><LockKeyhole size={14} /> {text('Exact-version snapshot', 'لقطة إصدار دقيقة')}</span> : null}</footer>
    </section>
  );
}
