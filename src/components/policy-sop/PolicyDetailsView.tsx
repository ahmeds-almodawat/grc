import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CalendarClock,
  Eye,
  FileText,
  GitBranch,
  Lock,
  Pencil,
  ShieldCheck,
  User,
} from 'lucide-react';
import type { DetailedPolicyRecord } from '../../lib/policySopApi';
import { useI18n } from '../../i18n/I18nContext';
import { StatusBadge } from '../StatusBadge';
import { DocumentStatusBadge } from './DocumentStatusBadge';
import { DocumentVersionBadge } from './DocumentVersionBadge';

interface PolicyDetailsViewProps {
  policy: DetailedPolicyRecord;
  onBack: () => void;
  onEdit: () => void;
  onPreview: () => void;
  onStartRevision: () => void;
  onRequestException: () => void;
}

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
}

export function PolicyDetailsView({
  policy,
  onBack,
  onEdit,
  onPreview,
  onStartRevision,
  onRequestException,
}: PolicyDetailsViewProps) {
  const { t, language } = useI18n();
  const isEditable = policy.document_status === 'draft' && !policy.locked_at;
  const displayTitle = language === 'ar' ? policy.title_ar || policy.title_en : policy.title_en;
  const statement = language === 'ar' ? policy.policy_statement_ar || policy.policy_statement_en : policy.policy_statement_en;
  const purpose = language === 'ar' ? policy.purpose_ar || policy.purpose_en : policy.purpose_en;
  const scope = language === 'ar' ? policy.scope_ar || policy.scope_en : policy.scope_en;
  const principles = language === 'ar' ? policy.principles_ar || policy.principles_en : policy.principles_en;

  return (
    <div className="ui2-document-detail" data-testid="policy-details">
      <header className="ui2-detail-header">
        <button type="button" className="platform-icon-button directional-icon" onClick={onBack} aria-label={t('common.back', 'Back to policy register')}><ArrowLeft size={18} /></button>
        <div className="ui2-detail-header__identity">
          <div className="ui2-detail-badges">
            <span className="ui2-document-code">{policy.document_code}</span>
            <DocumentVersionBadge versionLabel={policy.version_label} versionNumber={policy.version_number} isCurrent={policy.is_current_version} />
            <DocumentStatusBadge status={policy.document_status} effectiveDate={policy.effective_date} />
            {policy.locked_at ? <span className="ui2-lock-badge"><Lock size={12} />{t('policy.immutable', 'Immutable version')}</span> : null}
          </div>
          <h2>{displayTitle}</h2>
          {policy.title_ar && language !== 'ar' ? <p dir="rtl">{policy.title_ar}</p> : null}
        </div>
        <div className="ui2-detail-actions">
          <button type="button" className="platform-secondary-button" onClick={onPreview}><Eye size={15} />{t('common.preview', 'Preview')}</button>
          {isEditable ? <button type="button" className="platform-primary-button" onClick={onEdit}><Pencil size={15} />{t('common.editDraft', 'Edit draft')}</button> : null}
          {!isEditable && policy.document_status !== 'retired' ? <button type="button" className="platform-primary-button" onClick={onStartRevision}><GitBranch size={15} />{t('policy.revision.startAction', 'Start revision')}</button> : null}
          {policy.approved_at ? <button type="button" className="platform-secondary-button" onClick={onRequestException}><AlertTriangle size={15} />{t('policy.exception.requestAction', 'Request exception')}</button> : null}
        </div>
      </header>

      <div className="ui2-detail-summary-grid">
        <div><Building2 size={15} /><span>{t('common.department', 'Department')}</span><strong>{policy.department_name || t('common.unassigned', 'Unassigned')}</strong></div>
        <div><User size={15} /><span>{t('common.owner', 'Owner')}</span><strong>{policy.document_owner_name || t('common.unassigned', 'Unassigned')}</strong></div>
        <div><CalendarClock size={15} /><span>{t('policy.effectiveDate', 'Effective date')}</span><strong>{formatDate(policy.effective_date)}</strong></div>
        <div><CalendarClock size={15} /><span>{t('common.nextReview', 'Next review')}</span><strong>{formatDate(policy.next_review_date)}</strong></div>
        <div><ShieldCheck size={15} /><span>{t('common.criticality', 'Criticality')}</span><strong>{policy.criticality_level}</strong></div>
        <div><Lock size={15} /><span>{t('common.confidentiality', 'Confidentiality')}</span><strong>{policy.confidentiality_level}</strong></div>
      </div>

      <div className="ui2-detail-layout">
        <main className="ui2-detail-main">
          <section className="ui2-content-section"><div className="ui2-section-heading"><div><p>{t('policy.whatWhy', 'What and why')}</p><h3>{t('policy.statement', 'Policy statement')}</h3></div><FileText size={17} /></div><p>{statement || t('common.notConfigured', 'Not configured')}</p></section>
          <section className="ui2-content-section"><div className="ui2-section-heading"><div><p>{t('policy.intent', 'Institutional intent')}</p><h3>{t('policy.purposeScope', 'Purpose and scope')}</h3></div></div><div className="ui2-content-columns"><div><h4>{t('policy.purpose', 'Purpose')}</h4><p>{purpose || '—'}</p></div><div><h4>{t('policy.scope', 'Scope')}</h4><p>{scope || '—'}</p></div></div></section>
          {principles ? <section className="ui2-content-section"><div className="ui2-section-heading"><div><p>{t('policy.direction', 'Direction')}</p><h3>{t('policy.principles', 'Governing principles')}</h3></div></div><p>{principles}</p></section> : null}
          <section className="ui2-content-section"><div className="ui2-section-heading"><div><p>{t('policy.controlMap', 'Control map')}</p><h3>{t('policy.requirements', 'Governed requirements')}</h3></div><span>{policy.requirements.length}</span></div>{policy.requirements.length ? <ol className="ui2-requirement-list">{policy.requirements.map((requirement) => <li key={requirement.id || requirement.sequence_number}><span>{requirement.sequence_number}</span><div><strong>{language === 'ar' ? requirement.requirement_statement_ar || requirement.requirement_statement_en : requirement.requirement_statement_en}</strong><small>{requirement.responsible_role || t('common.unassigned', 'Unassigned')}{requirement.mapped_control_code ? ` · ${requirement.mapped_control_code}` : ''}{requirement.expected_evidence_en ? ` · ${requirement.expected_evidence_en}` : ''}</small></div>{requirement.is_mandatory ? <StatusBadge status={t('common.mandatory', 'Mandatory')} tone="warning" /> : null}</li>)}</ol> : <p className="ui2-empty-copy">{t('policy.noRequirements', 'No governed requirements are recorded for this version.')}</p>}</section>
        </main>

        <aside className="ui2-detail-rail">
          <section className="ui2-rail-section"><h3>{t('policy.lifecycle', 'Lifecycle')}</h3><dl><div><dt>{t('common.workflowStage', 'Workflow stage')}</dt><dd>{policy.workflow_stage || policy.document_status}</dd></div><div><dt>{t('common.approved', 'Approved')}</dt><dd>{formatDate(policy.approved_at)}</dd></div><div><dt>{t('common.expiryDate', 'Expiry date')}</dt><dd>{formatDate(policy.expiry_date)}</dd></div><div><dt>{t('common.version', 'Version')}</dt><dd>{policy.version_label}</dd></div></dl></section>
          <section className="ui2-rail-section"><h3>{t('policy.applicability', 'Applicability')}</h3><div className="ui2-chip-list">{policy.department_scopes.length ? policy.department_scopes.map((scopeId) => <span key={scopeId}>{scopeId}</span>) : <span>{t('policy.organizationWide', 'Organization-wide')}</span>}{policy.role_scopes.map((scope) => <span key={scope.id || scope.role_name}>{scope.role_name}</span>)}</div></section>
          <section className="ui2-rail-section"><h3>{t('policy.versionHistory', 'Version history')}</h3><ol className="ui2-version-list">{policy.all_versions.map((version) => <li key={version.id}><span>v{version.version_label}</span><div><strong>{version.is_current_version ? t('common.current', 'Current') : t('common.historical', 'Historical')}</strong><small>{formatDate(version.effective_date)}</small></div></li>)}</ol></section>
        </aside>
      </div>
    </div>
  );
}
