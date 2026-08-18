import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { 
  getGovernedSopDetail, 
  createGovernedSopDraft, 
  saveGovernedSopDraft, 
  startGovernedDocumentRevision, 
  submitGovernedDocumentForReview, 
  requestPolicySopException,
  listEligibleGoverningPolicies,
  listDepartments,
  listProfiles,
  listControls,
  type DetailedSopRecord,
  type SopProcedureStep,
  type SopDefinition,
  type SopRoleResponsibility,
  type SopMonitoringKpi,
  type SopRiskLink,
  type SopAccreditationLink,
  type SopDerivedControl,
  type SopInheritedAccreditation,
  type RoleScope,
  type EligibleGoverningPolicy
} from '../../lib/policySopApi';
import { DocumentStatusBadge } from './DocumentStatusBadge';
import { DocumentVersionBadge } from './DocumentVersionBadge';
import { SopProcedureBuilder } from './SopProcedureBuilder';
import { SopDefinitionsBuilder } from './SopDefinitionsBuilder';
import { SopResponsibilitiesBuilder } from './SopResponsibilitiesBuilder';
import { SopMonitoringKpisBuilder } from './SopMonitoringKpisBuilder';
import { SopRiskTraceabilityBuilder } from './SopRiskTraceabilityBuilder';
import { SopAccreditationTraceabilityBuilder } from './SopAccreditationTraceabilityBuilder';
import { ApplicabilitySelector } from './ApplicabilitySelector';
import { VersionHistoryTimeline } from './VersionHistoryTimeline';
import { StartRevisionModal } from './StartRevisionModal';
import { SubmitReviewModal } from './SubmitReviewModal';
import { PolicyExceptionModal } from './PolicyExceptionModal';
import { SopPreviewModal } from './SopPreviewModal';
import { 
  ArrowLeft, 
  Save, 
  Send, 
  Eye, 
  RotateCw, 
  ShieldAlert, 
  BookOpen, 
  FileText, 
  Settings, 
  Layers, 
  Clock, 
  History, 
  CheckCircle2, 
  AlertCircle,
  GraduationCap,
  ShieldCheck,
  Search,
  BookA,
  Users,
  Activity,
  Shield,
  Award
} from 'lucide-react';

interface SopEditorProps {
  initialSopId: string | null;
  onBack: () => void;
  onSopSaved?: (sop: DetailedSopRecord) => void;
}

export function SopEditor({
  initialSopId,
  onBack,
  onSopSaved,
}: SopEditorProps) {
  const { t } = useI18n();

  // Master Data
  const [departments, setDepartments] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [profiles, setProfiles] = useState<Array<{ id: string; full_name: string; email: string; job_title: string | null }>>([]);
  const [controls, setControls] = useState<Array<{ id: string; code: string; title: string }>>([]);
  const [eligiblePolicies, setEligiblePolicies] = useState<EligibleGoverningPolicy[]>([]);
  const [masterDataLoaded, setMasterDataLoaded] = useState(false);
  const [hasInitializedNewDefaults, setHasInitializedNewDefaults] = useState(false);

  // State
  const [sop, setSop] = useState<DetailedSopRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'control' | 'linkage' | 'purpose' | 'definitions' | 'responsibilities' | 'procedure' | 'risks_controls' | 'accreditation' | 'applicability' | 'training' | 'acknowledgment' | 'monitoring' | 'exceptions' | 'history'>('control');
  const [isDirty, setIsDirty] = useState(false);

  // Form Fields
  const [titleEn, setTitleEn] = useState('');
  const [titleAr, setTitleAr] = useState('');
  const [processNameEn, setProcessNameEn] = useState('');
  const [processNameAr, setProcessNameAr] = useState('');
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [documentOwnerId, setDocumentOwnerId] = useState<string | null>(null);
  const [processOwnerId, setProcessOwnerId] = useState<string | null>(null);
  const [criticalityLevel, setCriticalityLevel] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [confidentialityLevel, setConfidentialityLevel] = useState<'public' | 'internal' | 'confidential' | 'restricted'>('internal');
  const [effectiveDate, setEffectiveDate] = useState<string | null>(null);
  const [nextReviewDate, setNextReviewDate] = useState<string | null>(null);
  
  // Linkage Fields
  const [governanceLinkState, setGovernanceLinkState] = useState<'linked' | 'legacy_pending' | 'not_applicable'>('linked');
  const [primaryPolicyVersionId, setPrimaryPolicyVersionId] = useState<string | null>(null);
  const [policySearchQuery, setPolicySearchQuery] = useState('');

  // Content Fields
  const [purposeEn, setPurposeEn] = useState('');
  const [purposeAr, setPurposeAr] = useState('');
  const [scopeEn, setScopeEn] = useState('');
  const [scopeAr, setScopeAr] = useState('');

  // Procedure Steps
  const [procedureSteps, setProcedureSteps] = useState<SopProcedureStep[]>([]);

  // Definitions, Role Responsibilities & Monitoring KPIs
  const [definitions, setDefinitions] = useState<SopDefinition[]>([]);
  const [roleResponsibilities, setRoleResponsibilities] = useState<SopRoleResponsibility[]>([]);
  const [monitoringKpis, setMonitoringKpis] = useState<SopMonitoringKpi[]>([]);

  // Traceability: Risks & Accreditation Links (v1.4-E2A)
  const [riskLinks, setRiskLinks] = useState<SopRiskLink[]>([]);
  const [accreditationLinks, setAccreditationLinks] = useState<SopAccreditationLink[]>([]);
  const [derivedControls, setDerivedControls] = useState<SopDerivedControl[]>([]);
  const [inheritedAccreditations, setInheritedAccreditations] = useState<SopInheritedAccreditation[]>([]);

  // Applicability Scopes
  const [departmentScopes, setDepartmentScopes] = useState<string[]>([]);
  const [roleScopes, setRoleScopes] = useState<RoleScope[]>([]);

  // Training & Acknowledgment Settings
  const [trainingRequired, setTrainingRequired] = useState(false);
  const [acknowledgmentRequired, setAcknowledgmentRequired] = useState(false);
  const [competencyAssessmentRequired, setCompetencyAssessmentRequired] = useState(false);
  const [acknowledgmentSlaDays, setAcknowledgmentSlaDays] = useState<number>(30);
  const [trainingRenewalMonths, setTrainingRenewalMonths] = useState<number>(12);

  // Modals
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showExceptionModal, setShowExceptionModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Load Master Data
  useEffect(() => {
    async function loadMasterData() {
      const [deptList, profList, ctrlList, polList] = await Promise.all([
        listDepartments(),
        listProfiles(),
        listControls(),
        listEligibleGoverningPolicies(),
      ]);
      setDepartments(deptList);
      setProfiles(profList);
      setControls(ctrlList);
      setEligiblePolicies(polList);
      setMasterDataLoaded(true);
    }
    loadMasterData();
  }, []);

  // Populate Form from Record
  const populateForm = useCallback((record: DetailedSopRecord) => {
    setSop(record);
    setTitleEn(record.title_en || record.document_title);
    setTitleAr(record.title_ar || '');
    setProcessNameEn(record.process_name_en || '');
    setProcessNameAr(record.process_name_ar || '');
    setDepartmentId(record.department_id);
    setDocumentOwnerId(record.document_owner_id);
    setProcessOwnerId(record.process_owner_id);
    setCriticalityLevel(record.criticality_level);
    setConfidentialityLevel(record.confidentiality_level);
    setEffectiveDate(record.effective_date);
    setNextReviewDate(record.next_review_date);
    
    setGovernanceLinkState(record.governance_link_state);
    setPrimaryPolicyVersionId(record.primary_policy_version_id);

    setPurposeEn(record.purpose_en || '');
    setPurposeAr(record.purpose_ar || '');
    setScopeEn(record.scope_en || '');
    setScopeAr(record.scope_ar || '');

    setProcedureSteps(record.procedure_steps || []);
    setDefinitions(record.definitions || []);
    setRoleResponsibilities(record.role_responsibilities || []);
    setMonitoringKpis(record.monitoring_kpis || []);
    setRiskLinks(record.risk_links || []);
    setAccreditationLinks(record.accreditation_links || []);
    setDerivedControls(record.derived_controls || []);
    setInheritedAccreditations(record.inherited_accreditations || []);
    setDepartmentScopes(record.department_scopes || []);
    setRoleScopes(record.role_scopes || []);

    setTrainingRequired(record.training_required);
    setAcknowledgmentRequired(record.acknowledgment_required);
    setCompetencyAssessmentRequired(record.competency_assessment_required);
    setAcknowledgmentSlaDays(record.acknowledgment_sla_days || 30);
    setTrainingRenewalMonths(record.training_renewal_months || 12);

    setIsDirty(false);
  }, []);

  // Initialize New Draft Defaults (only once, after master data loaded)
  useEffect(() => {
    if (initialSopId === 'new' && masterDataLoaded && !hasInitializedNewDefaults) {
      setDepartmentId(departments[0]?.id || null);
      setDocumentOwnerId(profiles[0]?.id || null);
      setProcessOwnerId(profiles[0]?.id || null);
      setHasInitializedNewDefaults(true);
    }
  }, [initialSopId, masterDataLoaded, departments, profiles, hasInitializedNewDefaults]);

  // Fetch SOP on Mount
  useEffect(() => {
    async function fetchSop() {
      if (!initialSopId || initialSopId === 'new') {
        // Initializing New Draft
        setSop(null);
        setTitleEn('');
        setTitleAr('');
        setProcessNameEn('');
        setProcessNameAr('');
        // Department and Owner defaults are handled by the effect above
        setPurposeEn('');
        setPurposeAr('');
        setScopeEn('');
        setScopeAr('');
        setGovernanceLinkState('linked');
        setPrimaryPolicyVersionId(null);
        setProcedureSteps([]);
        setDefinitions([]);
        setRoleResponsibilities([]);
        setMonitoringKpis([]);
        setDepartmentScopes([]);
        setRoleScopes([]);
        setTrainingRequired(false);
        setAcknowledgmentRequired(false);
        setCompetencyAssessmentRequired(false);
        setIsDirty(false);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const record = await getGovernedSopDetail(initialSopId);
        if (record) {
          populateForm(record);
        } else {
          setError(t('sop.error.notFound'));
        }
      } catch (err: any) {
        setError(err.message || t('sop.error.loadFailed'));
      } finally {
        setLoading(false);
      }
    }
    fetchSop();
  }, [initialSopId, populateForm, t]);

  const isLocked = Boolean(
    sop &&
    sop.document_status !== 'draft' &&
    sop.document_status !== 'under_revision'
  );

  // Filtered Policies for selector
  const filteredPolicies = eligiblePolicies.filter(p => {
    if (!policySearchQuery.trim()) return true;
    const q = policySearchQuery.toLowerCase();
    return (
      p.document_code.toLowerCase().includes(q) ||
      p.title_en.toLowerCase().includes(q) ||
      (p.title_ar && p.title_ar.toLowerCase().includes(q))
    );
  });

  const selectedPolicy = eligiblePolicies.find(p => p.version_id === primaryPolicyVersionId);

  // Save / Create Draft Handler
  const handleSaveDraft = async () => {
    if (!titleEn.trim()) {
      setError(t('sop.validation.titleRequired'));
      return;
    }
    if (!processNameEn.trim()) {
      setError(t('sop.validation.processRequired'));
      return;
    }
    if (governanceLinkState === 'linked' && !primaryPolicyVersionId) {
      setError(t('sop.validation.policyLinkRequired'));
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (!sop) {
        // Create new draft
        const res = await createGovernedSopDraft({
          title_en: titleEn,
          title_ar: titleAr || undefined,
          process_name_en: processNameEn,
          process_name_ar: processNameAr || undefined,
          purpose_en: purposeEn,
          purpose_ar: purposeAr || undefined,
          process_owner_id: processOwnerId,
          primary_policy_version_id: primaryPolicyVersionId,
          governance_link_state: governanceLinkState,
          scope_en: scopeEn || undefined,
          scope_ar: scopeAr || undefined,
          department_id: departmentId,
          criticality_level: criticalityLevel,
          confidentiality_level: confidentialityLevel,
          training_required: trainingRequired,
          acknowledgment_required: acknowledgmentRequired,
          competency_assessment_required: competencyAssessmentRequired,
          acknowledgment_sla_days: acknowledgmentSlaDays,
          training_renewal_months: trainingRenewalMonths,
          procedure_steps: procedureSteps,
          definitions: definitions,
          role_responsibilities: roleResponsibilities,
          monitoring_kpis: monitoringKpis,
          department_scopes: departmentScopes,
          role_scopes: roleScopes,
        });

        setSuccessMessage(t('sop.save.createdSuccess'));
        const refreshed = await getGovernedSopDetail(res.document_id, res.version_id);
        if (refreshed) {
          populateForm(refreshed);
          onSopSaved?.(refreshed);
        }
      } else {
        // Save existing draft
        await saveGovernedSopDraft({
          version_id: sop.version_id,
          title_en: titleEn,
          title_ar: titleAr || undefined,
          process_name_en: processNameEn,
          process_name_ar: processNameAr || undefined,
          purpose_en: purposeEn,
          purpose_ar: purposeAr || undefined,
          process_owner_id: processOwnerId,
          primary_policy_version_id: primaryPolicyVersionId,
          governance_link_state: governanceLinkState,
          scope_en: scopeEn || undefined,
          scope_ar: scopeAr || undefined,
          training_required: trainingRequired,
          acknowledgment_required: acknowledgmentRequired,
          competency_assessment_required: competencyAssessmentRequired,
          acknowledgment_sla_days: acknowledgmentSlaDays,
          training_renewal_months: trainingRenewalMonths,
          procedure_steps: procedureSteps,
          definitions: definitions,
          role_responsibilities: roleResponsibilities,
          monitoring_kpis: monitoringKpis,
          risk_links: riskLinks,
          accreditation_links: accreditationLinks,
          department_scopes: departmentScopes,
          role_scopes: roleScopes,
        });

        setSuccessMessage(t('sop.save.savedSuccess'));
        const refreshed = await getGovernedSopDetail(sop.document_id, sop.version_id);
        if (refreshed) {
          populateForm(refreshed);
          onSopSaved?.(refreshed);
        }
      }
    } catch (err: any) {
      setError(err.message || t('sop.error.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  // Submit Review Handler
  const handleConfirmSubmitReview = async (reviewerNote: string) => {
    if (!sop) return;
    setSaving(true);
    setError(null);
    try {
      await submitGovernedDocumentForReview(sop.version_id, reviewerNote);
      setShowSubmitModal(false);
      setSuccessMessage(t('sop.submitReview.success'));
      const refreshed = await getGovernedSopDetail(sop.document_id, sop.version_id);
      if (refreshed) populateForm(refreshed);
    } catch (err: any) {
      setError(err.message || t('sop.error.submitReviewFailed'));
    } finally {
      setSaving(false);
    }
  };

  // Start Revision Handler
  const handleConfirmStartRevision = async (revisionType: 'minor' | 'major', reason: string) => {
    if (!sop) return;
    setSaving(true);
    setError(null);
    try {
      const res = await startGovernedDocumentRevision(sop.version_id, revisionType, reason);
      setShowRevisionModal(false);
      setSuccessMessage(t('sop.revision.startedSuccess'));
      const refreshed = await getGovernedSopDetail(res.document_id, res.version_id);
      if (refreshed) populateForm(refreshed);
    } catch (err: any) {
      setError(err.message || t('sop.error.startRevisionFailed'));
    } finally {
      setSaving(false);
    }
  };

  // Request Exception Handler
  const handleConfirmException = async (payload: { reason: string; scope_description: string; start_date: string; end_date: string; risk_summary?: string; compensating_controls?: string }) => {
    if (!sop) return;
    setSaving(true);
    setError(null);
    try {
      await requestPolicySopException({
        version_id: sop.version_id,
        reason: payload.reason,
        scope_description: payload.scope_description,
        start_date: payload.start_date,
        end_date: payload.end_date,
        risk_summary: payload.risk_summary,
        compensating_controls: payload.compensating_controls,
      });
      setShowExceptionModal(false);
      setSuccessMessage(t('sop.exception.requestedSuccess'));
      const refreshed = await getGovernedSopDetail(sop.document_id, sop.version_id);
      if (refreshed) populateForm(refreshed);
    } catch (err: any) {
      setError(err.message || t('sop.error.exceptionFailed'));
    } finally {
      setSaving(false);
    }
  };

  // Back Button Guard
  const handleBackClick = () => {
    if (isDirty) {
      if (window.confirm(t('common.unsavedChangesWarning'))) {
        onBack();
      }
    } else {
      onBack();
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-400">
        <div className="inline-block w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium">{t('sop.loadingWorkspace')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Action & Metadata Header */}
      <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Back & Title */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleBackClick}
              className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-xl transition-colors shrink-0"
              title={t('common.back')}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="font-mono text-xs font-bold text-indigo-400 bg-indigo-950/80 px-2.5 py-1 rounded-md border border-indigo-800/60">
                  {sop?.document_code || 'NEW-SOP-DRAFT'}
                </span>
                <DocumentVersionBadge
                  versionLabel={sop?.version_label || '1.0'}
                  isCurrent={sop?.is_current_version ?? false}
                />
                <DocumentStatusBadge
                  status={sop?.document_status || 'draft'}
                  effectiveDate={sop?.effective_date}
                />
                {isDirty && (
                  <span className="px-2 py-0.5 text-[11px] font-semibold bg-amber-950/80 text-amber-300 border border-amber-800/50 rounded-full">
                    {t('common.unsavedChanges')}
                  </span>
                )}
              </div>
              <h1 className="text-lg font-bold text-slate-100 mt-1">
                {titleEn || t('sop.newDraftTitle')}
              </h1>
            </div>
          </div>

          {/* Lifecycle Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Preview Action */}
            {sop && (
              <button
                type="button"
                onClick={() => setShowPreviewModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{t('common.preview')}</span>
              </button>
            )}

            {/* Save Draft Action */}
            {!isLocked && (
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-sm shadow-indigo-500/20 transition-all active:scale-95 disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? t('common.saving') : t('common.saveDraft')}</span>
              </button>
            )}

            {/* Submit for Review Action */}
            {sop && sop.document_status === 'draft' && (
              <button
                type="button"
                onClick={() => setShowSubmitModal(true)}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-sm shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{t('policy.submitReview.action')}</span>
              </button>
            )}

            {/* Start Revision Action */}
            {isLocked && (
              <button
                type="button"
                onClick={() => setShowRevisionModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-lg shadow-sm shadow-purple-500/20 transition-all active:scale-95"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>{t('policy.revision.startAction')}</span>
              </button>
            )}

            {/* Request Exception Action */}
            {isLocked && (
              <button
                type="button"
                onClick={() => setShowExceptionModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-600/80 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg border border-amber-500/30 transition-colors"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>{t('policy.exception.requestAction')}</span>
              </button>
            )}
          </div>
        </div>

        {/* Notifications */}
        {error && (
          <div className="p-3.5 bg-rose-950/60 border border-rose-800/80 rounded-xl text-xs text-rose-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3.5 bg-emerald-950/60 border border-emerald-800/80 rounded-xl text-xs text-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}
      </div>

      {/* Editor Main Content & Tabbed Workspace */}
      <div className="bg-slate-900/40 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 overflow-x-auto text-xs font-medium">
          <button
            onClick={() => setActiveTab('control')}
            className={`px-4 py-3 border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'control'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-950/20 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>1. {t('sop.tab.documentControl')}</span>
          </button>

          <button
            onClick={() => setActiveTab('linkage')}
            className={`px-4 py-3 border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'linkage'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-950/20 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>2. {t('sop.tab.governingPolicy')}</span>
          </button>

          <button
            onClick={() => setActiveTab('purpose')}
            className={`px-4 py-3 border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'purpose'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-950/20 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>3. {t('sop.tab.purposeAndScope')}</span>
          </button>

          <button
            onClick={() => setActiveTab('definitions')}
            className={`px-4 py-3 border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'definitions'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-950/20 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <BookA className="w-3.5 h-3.5" />
            <span>4. {t('sop.tab.definitions')}</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-900/60 text-indigo-300">
              {definitions.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('responsibilities')}
            className={`px-4 py-3 border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'responsibilities'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-950/20 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>5. {t('sop.tab.responsibilities')}</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-900/60 text-indigo-300">
              {roleResponsibilities.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('procedure')}
            className={`px-4 py-3 border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'procedure'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-950/20 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>6. {t('sop.tab.procedureBuilder')}</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-900/60 text-indigo-300">
              {procedureSteps.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('risks_controls')}
            className={`px-4 py-3 border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'risks_controls'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-950/20 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>7. {t('sop.tab.risksAndControls')}</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-900/60 text-indigo-300">
              {riskLinks.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('accreditation')}
            className={`px-4 py-3 border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'accreditation'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-950/20 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>8. {t('sop.tab.accreditation')}</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-900/60 text-indigo-300">
              {accreditationLinks.length + inheritedAccreditations.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('applicability')}
            className={`px-4 py-3 border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'applicability'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-950/20 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <span>9. {t('policy.tab.applicability')}</span>
          </button>

          <button
            onClick={() => setActiveTab('training')}
            className={`px-4 py-3 border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'training'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-950/20 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>10. {t('sop.tab.training')}</span>
          </button>

          <button
            onClick={() => setActiveTab('acknowledgment')}
            className={`px-4 py-3 border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'acknowledgment'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-950/20 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>11. {t('sop.tab.acknowledgment')}</span>
          </button>

          <button
            onClick={() => setActiveTab('monitoring')}
            className={`px-4 py-3 border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'monitoring'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-950/20 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>12. {t('sop.tab.monitoring')}</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-900/60 text-indigo-300">
              {monitoringKpis.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('exceptions')}
            className={`px-4 py-3 border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'exceptions'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-950/20 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>13. {t('policy.tab.exceptions')}</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-3 border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'history'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-950/20 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>14. {t('policy.tab.history')}</span>
          </button>
        </div>

        {/* Tab Content Panels */}
        <div className="p-6">
          {/* TAB 1: Document Control */}
          {activeTab === 'control' && (
            <div className="space-y-6 max-w-4xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {t('sop.titleEn')} <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={titleEn}
                    onChange={(e) => { setTitleEn(e.target.value); setIsDirty(true); }}
                    disabled={isLocked}
                    placeholder="e.g. Standard Procedure for Safe Medication Administration"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {t('sop.titleAr')}
                  </label>
                  <input
                    type="text"
                    value={titleAr}
                    onChange={(e) => { setTitleAr(e.target.value); setIsDirty(true); }}
                    disabled={isLocked}
                    dir="rtl"
                    placeholder="إجراء التشغيل القياسي لإعطاء الأدوية بأمان"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 disabled:opacity-60 text-right"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {t('sop.processNameEn')} <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={processNameEn}
                    onChange={(e) => { setProcessNameEn(e.target.value); setIsDirty(true); }}
                    disabled={isLocked}
                    placeholder="e.g. Inpatient Medication Dispensing"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {t('sop.processNameAr')}
                  </label>
                  <input
                    type="text"
                    value={processNameAr}
                    onChange={(e) => { setProcessNameAr(e.target.value); setIsDirty(true); }}
                    disabled={isLocked}
                    dir="rtl"
                    placeholder="صرف وإعطاء الدواء للمرضى الداخليين"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 disabled:opacity-60 text-right"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {t('policy.department')}
                  </label>
                  <select
                    value={departmentId || ''}
                    onChange={(e) => { setDepartmentId(e.target.value || null); setIsDirty(true); }}
                    disabled={isLocked}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                  >
                    <option value="">{t('policy.unassignedDepartment')}</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name} ({dept.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {t('sop.processOwner')}
                  </label>
                  <select
                    value={processOwnerId || ''}
                    onChange={(e) => { setProcessOwnerId(e.target.value || null); setIsDirty(true); }}
                    disabled={isLocked}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                  >
                    <option value="">{t('policy.unassignedOwner')}</option>
                    {profiles.map((prof) => (
                      <option key={prof.id} value={prof.id}>
                        {prof.full_name} {prof.job_title ? `(${prof.job_title})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {t('policy.documentOwner')}
                  </label>
                  <select
                    value={documentOwnerId || ''}
                    onChange={(e) => { setDocumentOwnerId(e.target.value || null); setIsDirty(true); }}
                    disabled={isLocked}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                  >
                    <option value="">{t('policy.unassignedOwner')}</option>
                    {profiles.map((prof) => (
                      <option key={prof.id} value={prof.id}>
                        {prof.full_name} {prof.job_title ? `(${prof.job_title})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {t('policy.criticality')}
                  </label>
                  <select
                    value={criticalityLevel}
                    onChange={(e) => { setCriticalityLevel(e.target.value as any); setIsDirty(true); }}
                    disabled={isLocked}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                  >
                    <option value="low">{t('criticality.low')}</option>
                    <option value="medium">{t('criticality.medium')}</option>
                    <option value="high">{t('criticality.high')}</option>
                    <option value="critical">{t('criticality.critical')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {t('policy.confidentiality')}
                  </label>
                  <select
                    value={confidentialityLevel}
                    onChange={(e) => { setConfidentialityLevel(e.target.value as any); setIsDirty(true); }}
                    disabled={isLocked}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                  >
                    <option value="public">{t('confidentiality.public')}</option>
                    <option value="internal">{t('confidentiality.internal')}</option>
                    <option value="confidential">{t('confidentiality.confidential')}</option>
                    <option value="restricted">{t('confidentiality.restricted')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {t('policy.effectiveDate')}
                  </label>
                  <input
                    type="date"
                    value={effectiveDate || ''}
                    onChange={(e) => { setEffectiveDate(e.target.value || null); setIsDirty(true); }}
                    disabled={isLocked}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {t('policy.reviewDueDate')}
                  </label>
                  <input
                    type="date"
                    value={nextReviewDate || ''}
                    onChange={(e) => { setNextReviewDate(e.target.value || null); setIsDirty(true); }}
                    disabled={isLocked}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Governing Policy Linkage */}
          {activeTab === 'linkage' && (
            <div className="space-y-6 max-w-4xl">
              <div>
                <h3 className="text-sm font-semibold text-slate-100">
                  {t('sop.linkage.header')}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {t('sop.linkage.subtitle')}
                </p>
              </div>

              {/* Linkage State Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className={`p-4 rounded-xl border cursor-pointer transition-colors ${
                  governanceLinkState === 'linked'
                    ? 'bg-indigo-950/40 border-indigo-600/80 text-indigo-200'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-900'
                }`}>
                  <input
                    type="radio"
                    name="linkState"
                    value="linked"
                    checked={governanceLinkState === 'linked'}
                    onChange={() => { setGovernanceLinkState('linked'); setIsDirty(true); }}
                    disabled={isLocked}
                    className="sr-only"
                  />
                  <div className="font-semibold text-xs text-slate-200 mb-1">{t('sop.linkState.linked')}</div>
                  <div className="text-[11px] text-slate-400">{t('sop.linkState.linkedDesc')}</div>
                </label>

                <label className={`p-4 rounded-xl border cursor-pointer transition-colors ${
                  governanceLinkState === 'legacy_pending'
                    ? 'bg-amber-950/40 border-amber-600/80 text-amber-200'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-900'
                }`}>
                  <input
                    type="radio"
                    name="linkState"
                    value="legacy_pending"
                    checked={governanceLinkState === 'legacy_pending'}
                    onChange={() => { setGovernanceLinkState('legacy_pending'); setIsDirty(true); }}
                    disabled={isLocked}
                    className="sr-only"
                  />
                  <div className="font-semibold text-xs text-slate-200 mb-1">{t('sop.linkState.legacy_pending')}</div>
                  <div className="text-[11px] text-slate-400">{t('sop.linkState.legacyPendingDesc')}</div>
                </label>

                <label className={`p-4 rounded-xl border cursor-pointer transition-colors ${
                  governanceLinkState === 'not_applicable'
                    ? 'bg-slate-900 border-slate-600 text-slate-200'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-900'
                }`}>
                  <input
                    type="radio"
                    name="linkState"
                    value="not_applicable"
                    checked={governanceLinkState === 'not_applicable'}
                    onChange={() => { setGovernanceLinkState('not_applicable'); setPrimaryPolicyVersionId(null); setIsDirty(true); }}
                    disabled={isLocked}
                    className="sr-only"
                  />
                  <div className="font-semibold text-xs text-slate-200 mb-1">{t('sop.linkState.not_applicable')}</div>
                  <div className="text-[11px] text-slate-400">{t('sop.linkState.notApplicableDesc')}</div>
                </label>
              </div>

              {/* Policy Selection Box */}
              {governanceLinkState === 'linked' && (
                <div className="p-5 bg-slate-950 rounded-xl border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-slate-200">
                      {t('sop.linkage.selectGoverningPolicy')} <span className="text-rose-400">*</span>
                    </label>
                    {selectedPolicy && (
                      <span className="text-xs text-indigo-400 font-medium">
                        {t('common.selected')}: {selectedPolicy.document_code} (v{selectedPolicy.version_label})
                      </span>
                    )}
                  </div>

                  {/* Search Policy Input */}
                  {!isLocked && (
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        value={policySearchQuery}
                        onChange={(e) => setPolicySearchQuery(e.target.value)}
                        placeholder={t('sop.linkage.searchPolicyPlaceholder')}
                        className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  )}

                  {/* Policy List Selector */}
                  <div className="max-h-60 overflow-y-auto divide-y divide-slate-800/60 border border-slate-800 rounded-lg">
                    {filteredPolicies.map((pol) => {
                      const isSelected = pol.version_id === primaryPolicyVersionId;
                      return (
                        <div
                          key={pol.version_id}
                          onClick={() => {
                            if (!isLocked) {
                              setPrimaryPolicyVersionId(pol.version_id);
                              setIsDirty(true);
                            }
                          }}
                          className={`p-3 text-xs flex items-center justify-between transition-colors ${
                            isSelected
                              ? 'bg-indigo-950/60 text-indigo-100 font-medium'
                              : isLocked
                              ? 'opacity-60 cursor-default'
                              : 'hover:bg-slate-900 cursor-pointer text-slate-300'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-indigo-400">{pol.document_code}</span>
                              <span className="text-slate-200">{pol.title_en}</span>
                              <span className="text-[10px] text-slate-400 px-1.5 py-0.2 bg-slate-800 rounded">
                                v{pol.version_label}
                              </span>
                            </div>
                            {pol.title_ar && (
                              <div className="text-[11px] text-slate-400 mt-0.5" dir="rtl">
                                {pol.title_ar}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <DocumentStatusBadge status={pol.document_status} effectiveDate={pol.effective_date} />
                            {isSelected && <CheckCircle2 className="w-4 h-4 text-indigo-400" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Purpose & Scope */}
          {activeTab === 'purpose' && (
            <div className="space-y-6 max-w-4xl">
              {/* Purpose */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-1 mb-3">
                  {t('policy.purpose')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      {t('sop.purposeEn')} <span className="text-rose-400">*</span>
                    </label>
                    <textarea
                      rows={5}
                      value={purposeEn}
                      onChange={(e) => { setPurposeEn(e.target.value); setIsDirty(true); }}
                      disabled={isLocked}
                      dir="ltr"
                      placeholder={t('sop.purposeEnPlaceholder')}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      {t('sop.purposeAr')}
                    </label>
                    <textarea
                      rows={5}
                      value={purposeAr}
                      onChange={(e) => { setPurposeAr(e.target.value); setIsDirty(true); }}
                      disabled={isLocked}
                      dir="rtl"
                      placeholder={t('sop.purposeArPlaceholder')}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 disabled:opacity-60 text-right"
                    />
                  </div>
                </div>
              </div>

              {/* Scope */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-1 mb-3">
                  {t('policy.scope')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      {t('sop.scopeEn')}
                    </label>
                    <textarea
                      rows={5}
                      value={scopeEn}
                      onChange={(e) => { setScopeEn(e.target.value); setIsDirty(true); }}
                      disabled={isLocked}
                      dir="ltr"
                      placeholder={t('sop.scopeEnPlaceholder')}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      {t('sop.scopeAr')}
                    </label>
                    <textarea
                      rows={5}
                      value={scopeAr}
                      onChange={(e) => { setScopeAr(e.target.value); setIsDirty(true); }}
                      disabled={isLocked}
                      dir="rtl"
                      placeholder={t('sop.scopeArPlaceholder')}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 disabled:opacity-60 text-right"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Definitions & Abbreviations */}
          {activeTab === 'definitions' && (
            <div className="max-w-5xl">
              <SopDefinitionsBuilder
                definitions={definitions}
                onChange={(newDefs) => {
                  setDefinitions(newDefs);
                  setIsDirty(true);
                }}
                readOnly={isLocked}
              />
            </div>
          )}

          {/* TAB 5: Roles & Responsibilities Matrix */}
          {activeTab === 'responsibilities' && (
            <div className="max-w-5xl">
              <SopResponsibilitiesBuilder
                responsibilities={roleResponsibilities}
                onChange={(newResps) => {
                  setRoleResponsibilities(newResps);
                  setIsDirty(true);
                }}
                readOnly={isLocked}
              />
            </div>
          )}

          {/* TAB 6: Procedure Builder */}
          {activeTab === 'procedure' && (
            <div className="max-w-5xl">
              <SopProcedureBuilder
                steps={procedureSteps}
                onChange={(newSteps) => {
                  setProcedureSteps(newSteps);
                  setIsDirty(true);
                }}
                controls={controls}
                readOnly={isLocked}
              />
            </div>
          )}

          {/* TAB 7: Risks & Controls Traceability */}
          {activeTab === 'risks_controls' && (
            <div className="max-w-5xl">
              <SopRiskTraceabilityBuilder
                riskLinks={riskLinks}
                onChangeRiskLinks={(newLinks) => {
                  setRiskLinks(newLinks);
                  setIsDirty(true);
                }}
                derivedControls={derivedControls}
                organizationId={sop?.organization_id || ''}
                isReadOnly={isLocked}
              />
            </div>
          )}

          {/* TAB 8: Accreditation & Regulatory Alignment */}
          {activeTab === 'accreditation' && (
            <div className="max-w-5xl">
              <SopAccreditationTraceabilityBuilder
                accreditationLinks={accreditationLinks}
                onChangeAccreditationLinks={(newLinks) => {
                  setAccreditationLinks(newLinks);
                  setIsDirty(true);
                }}
                inheritedAccreditations={inheritedAccreditations}
                primaryPolicyDocumentCode={sop?.primary_policy_document_code}
                primaryPolicyDocumentTitle={sop?.primary_policy_document_title}
                primaryPolicyVersionLabel={sop?.primary_policy_version_label}
                isReadOnly={isLocked}
              />
            </div>
          )}

          {/* TAB 9: Applicability */}
          {activeTab === 'applicability' && (
            <div className="max-w-4xl">
              <ApplicabilitySelector
                selectedDepartments={departmentScopes}
                onChangeDepartments={(depts: string[]) => {
                  setDepartmentScopes(depts);
                  setIsDirty(true);
                }}
                selectedRoles={roleScopes}
                onChangeRoles={(roles: RoleScope[]) => {
                  setRoleScopes(roles);
                  setIsDirty(true);
                }}
                departments={departments}
                readOnly={isLocked}
              />
            </div>
          )}

          {/* TAB 8: Training & Competency */}
          {activeTab === 'training' && (
            <div className="space-y-6 max-w-4xl">
              <div>
                <h3 className="text-sm font-semibold text-slate-100">
                  {t('sop.training.configTitle')}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {t('sop.training.configSubtitle')}
                </p>
              </div>

              <div className="p-5 bg-slate-950 rounded-xl border border-slate-800 space-y-4">
                <label className="flex items-center gap-3 text-xs font-semibold text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={trainingRequired}
                    onChange={(e) => { setTrainingRequired(e.target.checked); setIsDirty(true); }}
                    disabled={isLocked}
                    className="rounded border-slate-700 text-indigo-600 focus:ring-0 w-4 h-4"
                  />
                  <span>{t('sop.training.trainingRequiredCheckbox')}</span>
                </label>

                {trainingRequired && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-800/80">
                    <label className="flex items-center gap-3 text-xs font-semibold text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={competencyAssessmentRequired}
                        onChange={(e) => { setCompetencyAssessmentRequired(e.target.checked); setIsDirty(true); }}
                        disabled={isLocked}
                        className="rounded border-slate-700 text-indigo-600 focus:ring-0 w-4 h-4"
                      />
                      <span>{t('sop.training.competencyAssessmentCheckbox')}</span>
                    </label>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        {t('sop.training.renewalMonths')}
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={60}
                        value={trainingRenewalMonths}
                        onChange={(e) => { setTrainingRenewalMonths(parseInt(e.target.value) || 12); setIsDirty(true); }}
                        disabled={isLocked}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 9: Acknowledgment */}
          {activeTab === 'acknowledgment' && (
            <div className="space-y-6 max-w-4xl">
              <div>
                <h3 className="text-sm font-semibold text-slate-100">
                  {t('sop.ack.configTitle')}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {t('sop.ack.configSubtitle')}
                </p>
              </div>

              <div className="p-5 bg-slate-950 rounded-xl border border-slate-800 space-y-4">
                <label className="flex items-center gap-3 text-xs font-semibold text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acknowledgmentRequired}
                    onChange={(e) => { setAcknowledgmentRequired(e.target.checked); setIsDirty(true); }}
                    disabled={isLocked}
                    className="rounded border-slate-700 text-indigo-600 focus:ring-0 w-4 h-4"
                  />
                  <span>{t('sop.ack.acknowledgmentRequiredCheckbox')}</span>
                </label>

                {acknowledgmentRequired && (
                  <div className="pt-4 border-t border-slate-800/80 max-w-xs">
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      {t('sop.ack.slaDays')}
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={180}
                      value={acknowledgmentSlaDays}
                      onChange={(e) => { setAcknowledgmentSlaDays(parseInt(e.target.value) || 30); setIsDirty(true); }}
                      disabled={isLocked}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 10: Monitoring / KPIs */}
          {activeTab === 'monitoring' && (
            <div className="max-w-5xl">
              <SopMonitoringKpisBuilder
                kpis={monitoringKpis}
                profiles={profiles}
                onChange={(newKpis) => {
                  setMonitoringKpis(newKpis);
                  setIsDirty(true);
                }}
                readOnly={isLocked}
              />
            </div>
          )}

          {/* TAB 11: Exceptions */}
          {activeTab === 'exceptions' && (
            <div className="space-y-6 max-w-4xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">
                    {t('policy.tab.exceptions')}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    {t('sop.exceptions.subtitle')}
                  </p>
                </div>

                {isLocked && (
                  <button
                    type="button"
                    onClick={() => setShowExceptionModal(true)}
                    className="px-3.5 py-1.5 bg-amber-600/80 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    {t('policy.exception.requestAction')}
                  </button>
                )}
              </div>

              {sop?.exceptions && sop.exceptions.length > 0 ? (
                <div className="space-y-3">
                  {sop.exceptions.map((ex) => (
                    <div key={ex.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-amber-400">{ex.exception_code}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-950 text-amber-300 border border-amber-800/40 uppercase">
                          {ex.status}
                        </span>
                      </div>
                      <p className="text-slate-200">{ex.exception_reason}</p>
                      <div className="flex items-center gap-4 text-[11px] text-slate-400 pt-1">
                        <span>Scope: {ex.scope_description}</span>
                        <span>Valid: {ex.effective_start_date} to {ex.effective_end_date}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center bg-slate-950/60 rounded-xl border border-dashed border-slate-800 text-slate-500 text-xs">
                  {t('sop.exceptions.noActiveExceptions')}
                </div>
              )}
            </div>
          )}

          {/* TAB 12: Version History */}
          {activeTab === 'history' && sop && (
            <div className="max-w-4xl">
              <VersionHistoryTimeline
                versions={sop.all_versions}
                selectedVersionId={sop.version_id}
                onSelectVersion={(verId) => {
                  if (verId !== sop.version_id) {
                    getGovernedSopDetail(sop.document_id, verId).then((r) => r && populateForm(r));
                  }
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Governed Action Modals */}
      {showSubmitModal && (
        <SubmitReviewModal
          isOpen={showSubmitModal}
          onClose={() => setShowSubmitModal(false)}
          onConfirm={handleConfirmSubmitReview}
          policyCode={sop?.document_code || 'SOP-DRAFT'}
          policyTitle={titleEn}
          versionLabel={sop?.version_label || '1.0'}
          ownerName={profiles.find(p => p.id === processOwnerId)?.full_name || 'Process Owner'}
        />
      )}

      {showRevisionModal && (
        <StartRevisionModal
          isOpen={showRevisionModal}
          onClose={() => setShowRevisionModal(false)}
          onConfirm={handleConfirmStartRevision}
          currentVersionLabel={sop?.version_label || '1.0'}
        />
      )}

      {showExceptionModal && sop && (
        <PolicyExceptionModal
          isOpen={showExceptionModal}
          onClose={() => setShowExceptionModal(false)}
          onSubmit={handleConfirmException}
          versionId={sop.version_id}
          policyCode={sop.document_code}
          policyTitle={sop.title_en}
        />
      )}

      {showPreviewModal && sop && (
        <SopPreviewModal
          sop={sop}
          onClose={() => setShowPreviewModal(false)}
        />
      )}
    </div>
  );
}
