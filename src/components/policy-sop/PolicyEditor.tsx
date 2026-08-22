import { useState, useEffect } from 'react';
import {
  ArrowLeft, Save, Send, GitBranch, Eye, AlertTriangle, CheckCircle2,
  FileText, Shield, Layers, Users, Link2, AlertCircle, Award, History,
  Building2, Calendar, Clock, Lock
} from 'lucide-react';
import {
  DetailedPolicyRecord, PolicyRequirement, RoleScope, CreatePolicyDraftInput,
  SavePolicyDraftInput, RequestPolicyExceptionInput, saveGovernedPolicyDraft,
  createGovernedPolicyDraft, submitGovernedDocumentForReview, startGovernedDocumentRevision,
  requestPolicySopException
} from '../../lib/policySopApi';
import { DocumentStatusBadge } from './DocumentStatusBadge';
import { DocumentVersionBadge } from './DocumentVersionBadge';
import { PolicyRequirementBuilder } from './PolicyRequirementBuilder';
import { ApplicabilitySelector } from './ApplicabilitySelector';
import { VersionHistoryTimeline } from './VersionHistoryTimeline';
import { PolicyExceptionModal } from './PolicyExceptionModal';
import { StartRevisionModal } from './StartRevisionModal';
import { SubmitReviewModal } from './SubmitReviewModal';
import { PolicyPreviewModal } from './PolicyPreviewModal';
import { useI18n } from '../../i18n/I18nContext';
import { PolicyDetailsView } from './PolicyDetailsView';

interface PolicyEditorProps {
  initialPolicy?: DetailedPolicyRecord | null;
  departments: Array<{ id: string; name: string; code: string }>;
  profiles: Array<{ id: string; full_name: string; email: string; job_title: string | null }>;
  controls: Array<{ id: string; code: string; title: string }>;
  clauses: Array<{ id: string; clause_number: string; title: string }>;
  onBack: () => void;
  onRefresh: (documentId: string, versionId?: string) => Promise<void>;
}

type EditorTab =
  | 'control'
  | 'content'
  | 'requirements'
  | 'applicability'
  | 'governance'
  | 'exceptions'
  | 'training'
  | 'approval'
  | 'history'
  | 'preview';

export function PolicyEditor({
  initialPolicy,
  departments,
  profiles,
  controls,
  clauses,
  onBack,
  onRefresh
}: PolicyEditorProps) {
  const { t } = useI18n();
  const isNew = !initialPolicy;
  const isDraft = isNew || initialPolicy?.document_status === 'draft';
  const isEditable = isDraft && !initialPolicy?.locked_at;

  const [activeTab, setActiveTab] = useState<EditorTab>('control');
  const [workspaceMode, setWorkspaceMode] = useState<'details' | 'builder'>(initialPolicy ? 'details' : 'builder');
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modals
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [showExceptionModal, setShowExceptionModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Form State
  const [titleEn, setTitleEn] = useState(initialPolicy?.title_en || '');
  const [titleAr, setTitleAr] = useState(initialPolicy?.title_ar || '');
  const [departmentId, setDepartmentId] = useState<string>(initialPolicy?.department_id || '');
  const [ownerId, setOwnerId] = useState<string>(initialPolicy?.document_owner_id || '');
  const [criticality, setCriticality] = useState<'low' | 'medium' | 'high' | 'critical'>(
    initialPolicy?.criticality_level || 'medium'
  );
  const [confidentiality, setConfidentiality] = useState<'public' | 'internal' | 'confidential' | 'restricted'>(
    initialPolicy?.confidentiality_level || 'internal'
  );
  const [purposeEn, setPurposeEn] = useState(initialPolicy?.purpose_en || '');
  const [purposeAr, setPurposeAr] = useState(initialPolicy?.purpose_ar || '');
  const [statementEn, setStatementEn] = useState(initialPolicy?.policy_statement_en || '');
  const [statementAr, setStatementAr] = useState(initialPolicy?.policy_statement_ar || '');
  const [scopeEn, setScopeEn] = useState(initialPolicy?.scope_en || '');
  const [scopeAr, setScopeAr] = useState(initialPolicy?.scope_ar || '');
  const [principlesEn, setPrinciplesEn] = useState(initialPolicy?.principles_en || '');
  const [principlesAr, setPrinciplesAr] = useState(initialPolicy?.principles_ar || '');
  const [exceptionsSummaryEn, setExceptionsSummaryEn] = useState(initialPolicy?.exceptions_summary_en || '');
  const [exceptionsSummaryAr, setExceptionsSummaryAr] = useState(initialPolicy?.exceptions_summary_ar || '');
  const [escalationEn, setEscalationEn] = useState(initialPolicy?.non_compliance_escalation_en || '');
  const [escalationAr, setEscalationAr] = useState(initialPolicy?.non_compliance_escalation_ar || '');
  const [requirements, setRequirements] = useState<PolicyRequirement[]>(initialPolicy?.requirements || []);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>(initialPolicy?.department_scopes || []);
  const [selectedRoles, setSelectedRoles] = useState<RoleScope[]>(initialPolicy?.role_scopes || []);

  const markDirty = () => {
    if (!isDirty) setIsDirty(true);
  };

  const handleSaveDraft = async () => {
    if (!titleEn.trim()) {
      setErrorMsg(t('policy.error.titleRequired', 'English Policy Title is required.'));
      setActiveTab('control');
      return;
    }
    if (!statementEn.trim()) {
      setErrorMsg(t('policy.error.statementRequired', 'Policy Statement (English) is required before saving.'));
      setActiveTab('content');
      return;
    }

    try {
      setSaving(true);
      setErrorMsg(null);
      setSuccessMsg(null);

      if (isNew) {
        // Create new policy draft
        const input: CreatePolicyDraftInput = {
          title_en: titleEn.trim(),
          title_ar: titleAr.trim() || undefined,
          purpose_en: purposeEn.trim(),
          purpose_ar: purposeAr.trim() || undefined,
          policy_statement_en: statementEn.trim(),
          policy_statement_ar: statementAr.trim() || undefined,
          scope_en: scopeEn.trim() || undefined,
          scope_ar: scopeAr.trim() || undefined,
          principles_en: principlesEn.trim() || undefined,
          principles_ar: principlesAr.trim() || undefined,
          exceptions_summary_en: exceptionsSummaryEn.trim() || undefined,
          exceptions_summary_ar: exceptionsSummaryAr.trim() || undefined,
          non_compliance_escalation_en: escalationEn.trim() || undefined,
          non_compliance_escalation_ar: escalationAr.trim() || undefined,
          department_id: departmentId || null,
          criticality_level: criticality,
          confidentiality_level: confidentiality,
          requirements,
          department_scopes: selectedDepartments,
          role_scopes: selectedRoles
        };
        const res = await createGovernedPolicyDraft(input);
        setIsDirty(false);
        setSuccessMsg(t('policy.success.created', 'Policy draft created successfully!'));
        await onRefresh(res.document_id, res.version_id);
      } else {
        // Save existing policy draft
        const input: SavePolicyDraftInput = {
          version_id: initialPolicy.version_id,
          title_en: titleEn.trim(),
          title_ar: titleAr.trim() || undefined,
          purpose_en: purposeEn.trim(),
          purpose_ar: purposeAr.trim() || undefined,
          policy_statement_en: statementEn.trim(),
          policy_statement_ar: statementAr.trim() || undefined,
          scope_en: scopeEn.trim() || undefined,
          scope_ar: scopeAr.trim() || undefined,
          principles_en: principlesEn.trim() || undefined,
          principles_ar: principlesAr.trim() || undefined,
          exceptions_summary_en: exceptionsSummaryEn.trim() || undefined,
          exceptions_summary_ar: exceptionsSummaryAr.trim() || undefined,
          non_compliance_escalation_en: escalationEn.trim() || undefined,
          non_compliance_escalation_ar: escalationAr.trim() || undefined,
          requirements,
          department_scopes: selectedDepartments,
          role_scopes: selectedRoles
        };
        await saveGovernedPolicyDraft(input);
        setIsDirty(false);
        setSuccessMsg(t('policy.success.saved', 'Policy draft changes saved successfully!'));
        await onRefresh(initialPolicy.document_id, initialPolicy.version_id);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save policy draft.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitForReview = async (note: string) => {
    if (!initialPolicy?.version_id) return;
    try {
      setErrorMsg(null);
      await submitGovernedDocumentForReview(initialPolicy.version_id, note);
      setSuccessMsg(t('policy.success.submitted', 'Policy successfully submitted for review and approval!'));
      await onRefresh(initialPolicy.document_id, initialPolicy.version_id);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit policy for review.');
    }
  };

  const handleStartRevision = async (type: 'minor' | 'major', reason: string) => {
    if (!initialPolicy?.version_id) return;
    try {
      setErrorMsg(null);
      const res = await startGovernedDocumentRevision(initialPolicy.version_id, type, reason);
      setSuccessMsg(t('policy.success.revisionStarted', `Revision draft ${res.version_label} started.`));
      await onRefresh(initialPolicy.document_id, res.version_id);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to start revision.');
    }
  };

  const handleRequestException = async (input: RequestPolicyExceptionInput) => {
    try {
      setErrorMsg(null);
      await requestPolicySopException(input);
      setSuccessMsg(t('policy.success.exceptionRequested', 'Exception request submitted for governance approval.'));
      if (initialPolicy) {
        await onRefresh(initialPolicy.document_id, initialPolicy.version_id);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit exception request.');
    }
  };

  if (initialPolicy && workspaceMode === 'details') {
    return (
      <>
        <PolicyDetailsView
          policy={initialPolicy}
          onBack={onBack}
          onEdit={() => setWorkspaceMode('builder')}
          onPreview={() => setShowPreviewModal(true)}
          onStartRevision={() => setShowRevisionModal(true)}
          onRequestException={() => setShowExceptionModal(true)}
        />
        {showRevisionModal ? (
          <StartRevisionModal
            isOpen={showRevisionModal}
            onClose={() => setShowRevisionModal(false)}
            onConfirm={handleStartRevision}
            currentVersionLabel={initialPolicy.version_label}
          />
        ) : null}
        {showExceptionModal ? (
          <PolicyExceptionModal
            isOpen={showExceptionModal}
            onClose={() => setShowExceptionModal(false)}
            onSubmit={handleRequestException}
            versionId={initialPolicy.version_id}
            policyCode={initialPolicy.document_code}
            policyTitle={initialPolicy.title_en}
          />
        ) : null}
        {showPreviewModal ? <PolicyPreviewModal isOpen={showPreviewModal} onClose={() => setShowPreviewModal(false)} policy={initialPolicy} /> : null}
      </>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Action & Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={t('common.back', 'Back to Policies')}
          >
            <ArrowLeft size={18} className="directional-icon" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-indigo-700 dark:text-indigo-400">
                {initialPolicy?.document_code || t('policy.newCode', 'NEW DRAFT')}
              </span>
              <DocumentVersionBadge
                versionLabel={initialPolicy?.version_label}
                versionNumber={initialPolicy?.version_number}
                isCurrent={initialPolicy?.is_current_version}
              />
              <DocumentStatusBadge
                status={initialPolicy?.document_status || 'draft'}
                effectiveDate={initialPolicy?.effective_date}
              />
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-1 truncate max-w-xl">
              {titleEn || t('policy.newPolicyTitle', 'New Governed Policy')}
            </h2>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {initialPolicy && (
            <button
              type="button"
              onClick={() => setShowPreviewModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors"
            >
              <Eye size={14} />
              {t('common.preview', 'Preview')}
            </button>
          )}

          {isEditable ? (
            <>
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl shadow-sm transition-colors disabled:opacity-50"
              >
                <Save size={14} />
                {saving ? t('common.saving', 'Saving...') : t('common.saveDraft', 'Save Draft')}
                {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Unsaved changes" />}
              </button>

              {!isNew && (
                <button
                  type="button"
                  onClick={() => setShowSubmitModal(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800 transition-colors"
                >
                  <Send size={14} />
                  {t('policy.submitReview.action', 'Submit for Review')}
                </button>
              )}
            </>
          ) : (
            <>
              {initialPolicy && initialPolicy.document_status !== 'retired' && (
                <button
                  type="button"
                  onClick={() => setShowRevisionModal(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800 transition-colors"
                >
                  <GitBranch size={14} />
                  {t('policy.revision.startAction', 'Start Revision')}
                </button>
              )}
              {initialPolicy && initialPolicy.approved_at && (
                <button
                  type="button"
                  onClick={() => setShowExceptionModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800 transition-colors"
                >
                  <AlertTriangle size={14} />
                  {t('policy.exception.requestAction', 'Request Exception')}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-3.5 bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200 rounded-xl border border-rose-200 dark:border-rose-900 text-xs flex items-center gap-2">
          <AlertCircle size={16} className="shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-3.5 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200 rounded-xl border border-emerald-200 dark:border-emerald-900 text-xs flex items-center gap-2">
          <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main Workspace Tabs */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* Navigation Tabs Header */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 overflow-x-auto bg-slate-50/50 dark:bg-slate-900/60 scrollbar-none">
          {[
            { id: 'control', label: t('policy.tab.control', '1. Document Control'), icon: FileText },
            { id: 'content', label: t('policy.tab.content', '2. Policy Content'), icon: Layers },
            { id: 'requirements', label: t('policy.tab.requirements', '3. Requirements & Controls'), icon: Shield, count: requirements.length },
            { id: 'applicability', label: t('policy.tab.applicability', '4. Applicability'), icon: Users },
            { id: 'governance', label: t('policy.tab.governance', '5. Governance Links'), icon: Link2 },
            { id: 'exceptions', label: t('policy.tab.exceptions', '6. Exceptions'), icon: AlertTriangle, count: initialPolicy?.exceptions.length },
            { id: 'training', label: t('policy.tab.training', '7. Training & Acknowledgment'), icon: Award },
            { id: 'approval', label: t('policy.tab.approval', '8. Review & Approval'), icon: CheckCircle2 },
            { id: 'history', label: t('policy.tab.history', '9. Version History'), icon: History, count: initialPolicy?.all_versions.length }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as EditorTab)}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
                  isActive
                    ? 'border-indigo-600 text-indigo-600 bg-white dark:bg-slate-900 dark:text-indigo-400'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/50'
                }`}
              >
                <Icon size={14} />
                {tab.label}
                {typeof tab.count === 'number' && tab.count > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Content Panels */}
        <div className="p-6">
          {/* TAB 1: DOCUMENT CONTROL */}
          {activeTab === 'control' && (
            <div className="space-y-5 max-w-3xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('policy.titleEn', 'Policy Title (English)')} *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!isEditable}
                    value={titleEn}
                    onChange={e => { setTitleEn(e.target.value); markDirty(); }}
                    dir="ltr"
                    placeholder="e.g. Clinical Data Privacy & Security Policy"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('policy.titleAr', 'Policy Title (Arabic)')}
                  </label>
                  <input
                    type="text"
                    disabled={!isEditable}
                    value={titleAr}
                    onChange={e => { setTitleAr(e.target.value); markDirty(); }}
                    dir="rtl"
                    placeholder="مثال: سياسة خصوصية وأمن البيانات السريرية"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('common.department', 'Responsible Department')}
                  </label>
                  <select
                    disabled={!isEditable}
                    value={departmentId}
                    onChange={e => { setDepartmentId(e.target.value); markDirty(); }}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="">{t('common.unassigned', '-- Select Department --')}</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.name} {d.code ? `(${d.code})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('policy.owner', 'Policy Owner / Custodian')}
                  </label>
                  <select
                    disabled={!isEditable}
                    value={ownerId}
                    onChange={e => { setOwnerId(e.target.value); markDirty(); }}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="">{t('common.unassigned', '-- Select Custodian --')}</option>
                    {profiles.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.full_name} {p.job_title ? `(${p.job_title})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('policy.criticality', 'Criticality Level')}
                  </label>
                  <select
                    disabled={!isEditable}
                    value={criticality}
                    onChange={e => { setCriticality(e.target.value as any); markDirty(); }}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="low">{t('common.low', 'Low')}</option>
                    <option value="medium">{t('common.medium', 'Medium')}</option>
                    <option value="high">{t('common.high', 'High')}</option>
                    <option value="critical">{t('common.critical', 'Critical (Patient Safety / Regulatory)')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('policy.confidentiality', 'Confidentiality Classification')}
                  </label>
                  <select
                    disabled={!isEditable}
                    value={confidentiality}
                    onChange={e => { setConfidentiality(e.target.value as any); markDirty(); }}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="public">{t('policy.conf.public', 'Public')}</option>
                    <option value="internal">{t('policy.conf.internal', 'Internal Hospital Use')}</option>
                    <option value="confidential">{t('policy.conf.confidential', 'Confidential')}</option>
                    <option value="restricted">{t('policy.conf.restricted', 'Restricted Governance')}</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: POLICY CONTENT (SIDE-BY-SIDE / STACKED BILINGUAL) */}
          {activeTab === 'content' && (
            <div className="space-y-6">
              {/* Purpose */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  {t('policy.section.purpose', '1. Purpose & Objectives')}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">English Purpose</label>
                    <textarea
                      rows={3}
                      disabled={!isEditable}
                      value={purposeEn}
                      onChange={e => { setPurposeEn(e.target.value); markDirty(); }}
                      dir="ltr"
                      placeholder="Specify the objective and institutional rationale for this policy..."
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">الغرض والأهداف (العربية)</label>
                    <textarea
                      rows={3}
                      disabled={!isEditable}
                      value={purposeAr}
                      onChange={e => { setPurposeAr(e.target.value); markDirty(); }}
                      dir="rtl"
                      placeholder="تحديد الهدف والمبرر المؤسسي لاعتماد هذه السياسة..."
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Policy Statement */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  {t('policy.section.statement', '2. Policy Statement')} *
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">English Statement *</label>
                    <textarea
                      rows={4}
                      required
                      disabled={!isEditable}
                      value={statementEn}
                      onChange={e => { setStatementEn(e.target.value); markDirty(); }}
                      dir="ltr"
                      placeholder="The authoritative, definitive policy statement..."
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">نص السياسة الإلزامي (العربية)</label>
                    <textarea
                      rows={4}
                      disabled={!isEditable}
                      value={statementAr}
                      onChange={e => { setStatementAr(e.target.value); markDirty(); }}
                      dir="rtl"
                      placeholder="نص السياسة الحاكم والملزم..."
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Scope & Principles */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    {t('policy.section.scope', '3. Scope Description')}
                  </h4>
                  <textarea
                    rows={3}
                    disabled={!isEditable}
                    value={scopeEn}
                    onChange={e => { setScopeEn(e.target.value); markDirty(); }}
                    dir="ltr"
                    placeholder="English Scope..."
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <textarea
                    rows={3}
                    disabled={!isEditable}
                    value={scopeAr}
                    onChange={e => { setScopeAr(e.target.value); markDirty(); }}
                    dir="rtl"
                    placeholder="نطاق التطبيق بالعربية..."
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    {t('policy.section.principles', '4. Governing Principles')}
                  </h4>
                  <textarea
                    rows={3}
                    disabled={!isEditable}
                    value={principlesEn}
                    onChange={e => { setPrinciplesEn(e.target.value); markDirty(); }}
                    dir="ltr"
                    placeholder="Core governing principles..."
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <textarea
                    rows={3}
                    disabled={!isEditable}
                    value={principlesAr}
                    onChange={e => { setPrinciplesAr(e.target.value); markDirty(); }}
                    dir="rtl"
                    placeholder="المبادئ الحاكمة..."
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              {/* Exceptions & Escalation */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    {t('policy.section.exceptionsSummary', '5. Exceptions Policy Summary')}
                  </h4>
                  <textarea
                    rows={2}
                    disabled={!isEditable}
                    value={exceptionsSummaryEn}
                    onChange={e => { setExceptionsSummaryEn(e.target.value); markDirty(); }}
                    dir="ltr"
                    placeholder="Summary of permissible exceptions..."
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    {t('policy.section.escalation', '6. Non-Compliance Escalation')}
                  </h4>
                  <textarea
                    rows={2}
                    disabled={!isEditable}
                    value={escalationEn}
                    onChange={e => { setEscalationEn(e.target.value); markDirty(); }}
                    dir="ltr"
                    placeholder="Consequences and escalation paths for violations..."
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: REQUIREMENTS BUILDER */}
          {activeTab === 'requirements' && (
            <PolicyRequirementBuilder
              requirements={requirements}
              onChange={reqs => { setRequirements(reqs); markDirty(); }}
              controls={controls}
              clauses={clauses}
              readOnly={!isEditable}
            />
          )}

          {/* TAB 4: APPLICABILITY */}
          {activeTab === 'applicability' && (
            <ApplicabilitySelector
              selectedDepartments={selectedDepartments}
              onChangeDepartments={depts => { setSelectedDepartments(depts); markDirty(); }}
              selectedRoles={selectedRoles}
              onChangeRoles={roles => { setSelectedRoles(roles); markDirty(); }}
              departments={departments}
              readOnly={!isEditable}
            />
          )}

          {/* TAB 5: GOVERNANCE LINKS */}
          {activeTab === 'governance' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Link2 size={16} className="text-indigo-600 dark:text-indigo-400" />
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {t('policy.governanceLinks.title', 'Governed Relations & Linked SOPs')}
                </h4>
              </div>
              <p className="text-xs text-slate-500">
                {t(
                  'policy.governanceLinks.desc',
                  'Procedures and Standard Operating Procedures (SOPs) implementing this policy will be registered and linked during v1.4-E1.'
                )}
              </p>

              <div className="p-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-center bg-slate-50/50 dark:bg-slate-900/40">
                <Layers className="mx-auto text-slate-400 mb-2" size={24} />
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {t('policy.governanceLinks.sopLinksHeader', 'Linked Standard Operating Procedures (SOPs)')}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {t('policy.governanceLinks.sopLinksNotice', '0 linked SOPs currently active. New SOP creation is reserved for Gate v1.4-E1.')}
                </p>
              </div>
            </div>
          )}

          {/* TAB 6: EXCEPTIONS */}
          {activeTab === 'exceptions' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={16} className="text-amber-500" />
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {t('policy.exceptions.title', 'Policy Exceptions & Waivers')}
                  </h4>
                </div>
                {initialPolicy?.approved_at && (
                  <button
                    type="button"
                    onClick={() => setShowExceptionModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800 transition-colors"
                  >
                    <AlertTriangle size={14} />
                    {t('policy.exception.requestAction', 'Request Exception')}
                  </button>
                )}
              </div>

              {!initialPolicy?.exceptions || initialPolicy.exceptions.length === 0 ? (
                <div className="p-6 border border-slate-200 dark:border-slate-800 rounded-xl text-center text-xs text-slate-500">
                  {t('policy.exceptions.empty', 'No exceptions or waivers recorded for this policy.')}
                </div>
              ) : (
                <div className="space-y-3">
                  {initialPolicy.exceptions.map(ex => (
                    <div key={ex.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">{ex.exception_code}</span>
                        <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${
                          ex.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : ex.status === 'rejected' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {ex.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-300">{ex.exception_reason}</p>
                      <div className="text-[11px] text-slate-500 flex gap-4 pt-1">
                        <span>{t('policy.exception.window', 'Valid')}: {ex.effective_start_date} → {ex.effective_end_date}</span>
                        <span>{t('policy.exception.requester', 'Requested by')}: {ex.requested_by_name || 'Staff Member'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 7: TRAINING & ACKNOWLEDGMENT */}
          {activeTab === 'training' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Award size={16} className="text-indigo-600 dark:text-indigo-400" />
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {t('policy.training.title', 'Training & Acknowledgment Configuration')}
                </h4>
              </div>
              <p className="text-xs text-slate-500">
                {t(
                  'policy.training.desc',
                  'Configure institutional acknowledgment requirements. Automatic assignment delivery is orchestrated via Training Governance in v1.4-E2.'
                )}
              </p>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-3">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-800 dark:text-slate-200 cursor-pointer">
                  <input type="checkbox" defaultChecked disabled className="rounded text-indigo-600 h-4 w-4" />
                  {t('policy.training.annualAck', 'Annual Institutional Policy Acknowledgment Required')}
                </label>
                <div className="text-[11px] text-slate-500 pl-6">
                  {t('policy.training.slaNotice', 'Standard hospital acknowledgment SLA: 30 days following publication.')}
                </div>
              </div>
            </div>
          )}

          {/* TAB 8: REVIEW & APPROVAL */}
          {activeTab === 'approval' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-indigo-600 dark:text-indigo-400" />
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {t('policy.approval.title', 'Patch 27 Approval Authority Status')}
                </h4>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">{t('policy.approval.status', 'Governance Stage')}</span>
                  <span className="font-semibold text-xs text-slate-900 dark:text-slate-100">
                    {initialPolicy?.workflow_stage || initialPolicy?.document_status || 'Draft'}
                  </span>
                </div>
                {initialPolicy?.approved_at && (
                  <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-2">
                    <span className="text-xs text-slate-500">{t('policy.approval.finalApproval', 'Final Approval')}</span>
                    <span className="font-semibold text-xs text-emerald-600 dark:text-emerald-400">
                      {new Date(initialPolicy.approved_at).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 9: VERSION HISTORY */}
          {activeTab === 'history' && (
            <VersionHistoryTimeline
              versions={initialPolicy?.all_versions || []}
              selectedVersionId={initialPolicy?.version_id || ''}
              onSelectVersion={verId => onRefresh(initialPolicy!.document_id, verId)}
            />
          )}
        </div>
      </div>

      {/* Modals */}
      {showSubmitModal && initialPolicy && (
        <SubmitReviewModal
          isOpen={showSubmitModal}
          onClose={() => setShowSubmitModal(false)}
          onConfirm={handleSubmitForReview}
          policyCode={initialPolicy.document_code}
          policyTitle={initialPolicy.title_en}
          versionLabel={initialPolicy.version_label}
          ownerName={initialPolicy.document_owner_name}
        />
      )}

      {showRevisionModal && initialPolicy && (
        <StartRevisionModal
          isOpen={showRevisionModal}
          onClose={() => setShowRevisionModal(false)}
          onConfirm={handleStartRevision}
          currentVersionLabel={initialPolicy.version_label}
        />
      )}

      {showExceptionModal && initialPolicy && (
        <PolicyExceptionModal
          isOpen={showExceptionModal}
          onClose={() => setShowExceptionModal(false)}
          onSubmit={handleRequestException}
          versionId={initialPolicy.version_id}
          policyCode={initialPolicy.document_code}
          policyTitle={initialPolicy.title_en}
        />
      )}

      {showPreviewModal && initialPolicy && (
        <PolicyPreviewModal
          isOpen={showPreviewModal}
          onClose={() => setShowPreviewModal(false)}
          policy={initialPolicy}
        />
      )}
    </div>
  );
}
