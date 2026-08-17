import { useState, useEffect, useCallback } from 'react';
import {
  FileText, ShieldCheck, Clock, AlertTriangle, Layers, Award,
  UploadCloud, Plus, History, Filter
} from 'lucide-react';
import { DataState } from '../components/DataState';
import { useI18n } from '../i18n/I18nContext';
import {
  GovernedPolicyCatalogRow, GovernedSopCatalogRow, DetailedPolicyRecord,
  listGovernedPolicies, listGovernedSops, getGovernedPolicyDetail,
  listDepartments, listProfiles, listControls, listAccreditationClauses
} from '../lib/policySopApi';
import { PolicyRegister } from '../components/policy-sop/PolicyRegister';
import { PolicyEditor } from '../components/policy-sop/PolicyEditor';
import { SopRegister } from '../components/policy-sop/SopRegister';
import { SopEditor } from '../components/policy-sop/SopEditor';
import { ReviewsDueTab } from '../components/policy-sop/ReviewsDueTab';
import { ExceptionsTab } from '../components/policy-sop/ExceptionsTab';
import { TrainingAckTab } from '../components/policy-sop/TrainingAckTab';
import { LegacyDocsTab } from '../components/policy-sop/LegacyDocsTab';

type HubTab = 'policies' | 'sops' | 'reviews' | 'exceptions' | 'training' | 'legacy';

export function PolicyDocumentCenter() {
  const { t } = useI18n();

  // Hub Navigation State
  const [activeTab, setActiveTab] = useState<HubTab>('policies');

  // Policy Editor State
  const [editingPolicyId, setEditingPolicyId] = useState<string | null>(null);
  const [editingVersionId, setEditingVersionId] = useState<string | null>(null);
  const [isCreatingNewPolicy, setIsCreatingNewPolicy] = useState<boolean>(false);
  const [currentPolicyDetail, setCurrentPolicyDetail] = useState<DetailedPolicyRecord | null>(null);

  // SOP Editor State
  const [editingSopId, setEditingSopId] = useState<string | null>(null);
  const [isCreatingNewSop, setIsCreatingNewSop] = useState<boolean>(false);

  // Data State
  const [policies, setPolicies] = useState<GovernedPolicyCatalogRow[]>([]);
  const [sops, setSops] = useState<GovernedSopCatalogRow[]>([]);
  const [departments, setDepartments] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [profiles, setProfiles] = useState<Array<{ id: string; full_name: string; email: string; job_title: string | null }>>([]);
  const [controls, setControls] = useState<Array<{ id: string; code: string; title: string }>>([]);
  const [clauses, setClauses] = useState<Array<{ id: string; clause_number: string; title: string }>>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch Master Data & Lists
  const refreshHubData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [pols, sopsList, depts, profs, ctrls, cls] = await Promise.all([
        listGovernedPolicies(),
        listGovernedSops(),
        listDepartments(),
        listProfiles(),
        listControls(),
        listAccreditationClauses()
      ]);
      setPolicies(pols);
      setSops(sopsList);
      setDepartments(depts);
      setProfiles(profs);
      setControls(ctrls);
      setClauses(cls);
    } catch (err: any) {
      console.error('[PolicyDocumentCenter] Load error:', err);
      setError(err instanceof Error ? err : new Error('Failed to load Policy & SOP catalog.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshHubData();
  }, [refreshHubData]);

  // Load specific policy for editor
  const handleSelectPolicy = async (documentId: string, versionId?: string) => {
    try {
      setLoading(true);
      const detail = await getGovernedPolicyDetail(documentId, versionId);
      if (detail) {
        setCurrentPolicyDetail(detail);
        setEditingPolicyId(documentId);
        setEditingVersionId(versionId || detail.version_id);
        setIsCreatingNewPolicy(false);
      }
    } catch (err: any) {
      console.error('[PolicyDocumentCenter] getGovernedPolicyDetail error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartCreatePolicy = () => {
    setCurrentPolicyDetail(null);
    setEditingPolicyId(null);
    setEditingVersionId(null);
    setIsCreatingNewPolicy(true);
  };

  const handleBackToRegister = () => {
    setCurrentPolicyDetail(null);
    setEditingPolicyId(null);
    setEditingVersionId(null);
    setIsCreatingNewPolicy(false);
    setEditingSopId(null);
    setIsCreatingNewSop(false);
    refreshHubData();
  };

  // Metrics Calculations
  const totalPolicies = policies.length;
  const activePolicies = policies.filter(p => p.document_status === 'active' || p.document_status === 'approved').length;
  const reviewsDueCount = policies.filter(p => {
    if (!p.next_review_date) return false;
    const diff = (new Date(p.next_review_date).getTime() - Date.now()) / (1000 * 3600 * 24);
    return diff <= 30;
  }).length;
  const totalSops = sops.length;

  return (
    <section className="page-section document-page space-y-6">
      {/* Hero Header */}
      <div className="section-heading command-hero">
        <div>
          <p className="eyebrow">{t('documents.eyebrow', 'Institutional Governance & Document Control')}</p>
          <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {t('nav.policies', 'POLICIES & SOPs')}
          </h3>
          <p className="section-subtitle">
            {t(
              'documents.subtitle',
              'Governed hospital policies, standard operating procedures, approval matrix, and compliance attestations.'
            )}
          </p>
        </div>
      </div>

      {/* View Switcher: Policy Editor vs SOP Editor vs Hub Register View */}
      {isCreatingNewPolicy || (editingPolicyId && currentPolicyDetail) ? (
        <PolicyEditor
          initialPolicy={currentPolicyDetail}
          departments={departments}
          profiles={profiles}
          controls={controls}
          clauses={clauses}
          onBack={handleBackToRegister}
          onRefresh={async (docId, verId) => {
            await handleSelectPolicy(docId, verId);
            await refreshHubData();
          }}
        />
      ) : isCreatingNewSop || editingSopId ? (
        <SopEditor
          initialSopId={editingSopId || 'new'}
          onBack={handleBackToRegister}
          onSopSaved={() => {
            refreshHubData();
          }}
        />
      ) : (
        <div className="space-y-6">
          {/* Summary Metric Cards */}
          <div className="stats-grid">
            <div className="stat-card">
              <FileText size={20} className="text-indigo-600 dark:text-indigo-400" />
              <div className="stat-value">{totalPolicies}</div>
              <div className="stat-label">{t('policy.totalPolicies', 'Governed Policies')}</div>
            </div>
            <div className="stat-card success">
              <ShieldCheck size={20} className="text-emerald-600 dark:text-emerald-400" />
              <div className="stat-value">{activePolicies}</div>
              <div className="stat-label">{t('policy.activeEffective', 'Active / Effective')}</div>
            </div>
            <div className="stat-card warning">
              <Clock size={20} className="text-amber-600 dark:text-amber-400" />
              <div className="stat-value">{reviewsDueCount}</div>
              <div className="stat-label">{t('policy.reviewsDue30d', 'Reviews Due (< 30d)')}</div>
            </div>
            <div className="stat-card">
              <Layers size={20} className="text-purple-600 dark:text-purple-400" />
              <div className="stat-value">{totalSops}</div>
              <div className="stat-label">{t('sop.totalSops', 'Standard Operating Procedures')}</div>
            </div>
          </div>

          {/* Hub Main Tabs Panel */}
          <div className="panel bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            {/* Hub Navigation Tab Bar */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 overflow-x-auto bg-slate-50/50 dark:bg-slate-900/60 scrollbar-none px-4 pt-2">
              {[
                { id: 'policies', label: t('policy.hub.policies', 'Policies'), icon: FileText, count: totalPolicies },
                { id: 'sops', label: t('policy.hub.sops', 'SOPs (Procedures)'), icon: Layers, count: totalSops },
                { id: 'reviews', label: t('policy.hub.reviewsDue', 'Reviews Due'), icon: Clock, count: reviewsDueCount },
                { id: 'exceptions', label: t('policy.hub.exceptions', 'Exceptions / Waivers'), icon: AlertTriangle },
                { id: 'training', label: t('policy.hub.training', 'Training & Acknowledgments'), icon: Award },
                { id: 'legacy', label: t('policy.hub.legacy', 'Legacy Documents'), icon: History }
              ].map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as HubTab)}
                    className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
                      isActive
                        ? 'border-indigo-600 text-indigo-600 bg-white dark:bg-slate-900 dark:text-indigo-400'
                        : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <Icon size={14} />
                    {tab.label}
                    {typeof tab.count === 'number' && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Hub Content Area */}
            <div className="p-6">
              <DataState loading={loading} error={error ? error.message : null} empty={false}>
                {activeTab === 'policies' && (
                  <PolicyRegister
                    policies={policies}
                    departments={departments}
                    onSelectPolicy={handleSelectPolicy}
                    onCreatePolicy={handleStartCreatePolicy}
                    loading={loading}
                  />
                )}

                {activeTab === 'sops' && (
                  <SopRegister
                    sops={sops}
                    departments={departments}
                    onSelectSop={(sop) => {
                      setEditingSopId(sop.document_id);
                      setIsCreatingNewSop(false);
                    }}
                    onCreateSop={() => {
                      setEditingSopId(null);
                      setIsCreatingNewSop(true);
                    }}
                    loading={loading}
                  />
                )}

                {activeTab === 'reviews' && (
                  <ReviewsDueTab
                    triggers={[]}
                    onRefresh={refreshHubData}
                    loading={loading}
                  />
                )}

                {activeTab === 'exceptions' && (
                  <ExceptionsTab exceptions={[]} loading={loading} />
                )}

                {activeTab === 'training' && (
                  <TrainingAckTab />
                )}

                {activeTab === 'legacy' && (
                  <LegacyDocsTab
                    policies={policies}
                    onSelectPolicy={handleSelectPolicy}
                  />
                )}
              </DataState>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
