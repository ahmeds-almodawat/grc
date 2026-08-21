import { useState, useEffect, useCallback } from 'react';
import {
  FileText, ShieldCheck, Clock, AlertTriangle, Layers, Award,
  History
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
import { PageHeader } from '../components/ui/PageHeader';
import { MetricCard } from '../components/ui/MetricCard';
import { Tabs } from '../components/ui/Tabs';

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

  const hubTabs = [
    { id: 'policies', label: t('policy.hub.policies', 'Policies'), icon: <FileText size={14} />, badge: totalPolicies },
    { id: 'sops', label: t('policy.hub.sops', 'SOPs (Procedures)'), icon: <Layers size={14} />, badge: totalSops },
    { id: 'reviews', label: t('policy.hub.reviewsDue', 'Reviews Due'), icon: <Clock size={14} />, badge: reviewsDueCount },
    { id: 'exceptions', label: t('policy.hub.exceptions', 'Exceptions / Waivers'), icon: <AlertTriangle size={14} /> },
    { id: 'training', label: t('policy.hub.training', 'Training & Acknowledgments'), icon: <Award size={14} /> },
    { id: 'legacy', label: t('policy.hub.legacy', 'Legacy Documents'), icon: <History size={14} /> },
  ];

  return (
    <section className="page-section document-page platform-document-center">
      <PageHeader
        eyebrow={t('documents.eyebrow', 'Institutional Governance & Document Control')}
        title={t('nav.policies', 'Policies & SOPs')}
        subtitle={t(
          'documents.subtitle',
          'Governed hospital policies, standard operating procedures, approval matrix, and compliance attestations.'
        )}
        breadcrumbs={[
          { label: t('nav.governance', 'Governance') },
          { label: t('nav.policies', 'Policies & SOPs') },
        ]}
        icon={<FileText size={20} />}
      />

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
        <div className="platform-document-center__workspace">
          <div className="platform-metric-grid">
            <MetricCard label={t('policy.totalPolicies', 'Governed Policies')} value={totalPolicies} icon={<FileText size={18} />} loading={loading} />
            <MetricCard label={t('policy.activeEffective', 'Active / Effective')} value={activePolicies} icon={<ShieldCheck size={18} />} tone="success" loading={loading} />
            <MetricCard label={t('policy.reviewsDue30d', 'Reviews Due (< 30d)')} value={reviewsDueCount} icon={<Clock size={18} />} tone="warning" loading={loading} />
            <MetricCard label={t('sop.totalSops', 'Standard Operating Procedures')} value={totalSops} icon={<Layers size={18} />} tone="purple" loading={loading} />
          </div>

          <div className="platform-register-shell">
            <Tabs
              tabs={hubTabs}
              activeId={activeTab}
              onChange={(id) => setActiveTab(id as HubTab)}
              label={t('policy.hub.navigation', 'Policy and SOP views')}
            />

            <div className="platform-register-shell__body" id={`${activeTab}-panel`} role="tabpanel">
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
