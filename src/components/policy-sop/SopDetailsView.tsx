import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Building2,
  CalendarClock,
  Eye,
  GitBranch,
  GraduationCap,
  Layers,
  Lock,
  Pencil,
  Shield,
  User,
} from 'lucide-react';
import type { DetailedSopRecord } from '../../lib/policySopApi';
import { useI18n } from '../../i18n/I18nContext';
import { StatusBadge } from '../StatusBadge';
import { DocumentStatusBadge } from './DocumentStatusBadge';
import { DocumentVersionBadge } from './DocumentVersionBadge';

interface SopDetailsViewProps {
  sop: DetailedSopRecord;
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

export function SopDetailsView({ sop, onBack, onEdit, onPreview, onStartRevision, onRequestException }: SopDetailsViewProps) {
  const { t, language } = useI18n();
  const isEditable = sop.document_status === 'draft' && !sop.locked_at;
  const displayTitle = language === 'ar' ? sop.title_ar || sop.title_en : sop.title_en;
  const purpose = language === 'ar' ? sop.purpose_ar || sop.purpose_en : sop.purpose_en;
  const scope = language === 'ar' ? sop.scope_ar || sop.scope_en : sop.scope_en;
  const procedureSteps = sop.procedure_steps || [];
  const roleResponsibilities = sop.role_responsibilities || [];
  const riskLinks = sop.risk_links || [];
  const derivedControls = sop.derived_controls || [];
  const accreditationLinks = sop.accreditation_links || [];
  const inheritedAccreditations = sop.inherited_accreditations || [];
  const allVersions = sop.all_versions || [];

  return (
    <div className="ui2-document-detail" data-testid="sop-details">
      <header className="ui2-detail-header">
        <button type="button" className="platform-icon-button directional-icon" onClick={onBack} aria-label={t('common.back', 'Back to SOP register')}><ArrowLeft size={18} /></button>
        <div className="ui2-detail-header__identity">
          <div className="ui2-detail-badges"><span className="ui2-document-code">{sop.document_code}</span><DocumentVersionBadge versionLabel={sop.version_label} isCurrent={sop.is_current_version} /><DocumentStatusBadge status={sop.document_status} effectiveDate={sop.effective_date} />{sop.locked_at ? <span className="ui2-lock-badge"><Lock size={12} />{t('policy.immutable', 'Immutable version')}</span> : null}</div>
          <h2>{displayTitle}</h2>
          <p>{sop.process_name_en}</p>
        </div>
        <div className="ui2-detail-actions">
          <button type="button" className="platform-secondary-button" onClick={onPreview}><Eye size={15} />{t('common.preview', 'Preview')}</button>
          {isEditable ? <button type="button" className="platform-primary-button" onClick={onEdit}><Pencil size={15} />{t('common.editDraft', 'Edit draft')}</button> : null}
          {!isEditable && sop.document_status !== 'retired' ? <button type="button" className="platform-primary-button" onClick={onStartRevision}><GitBranch size={15} />{t('policy.revision.startAction', 'Start revision')}</button> : null}
          {sop.approved_at ? <button type="button" className="platform-secondary-button" onClick={onRequestException}><AlertTriangle size={15} />{t('policy.exception.requestAction', 'Request exception')}</button> : null}
        </div>
      </header>

      <div className="ui2-detail-summary-grid">
        <div><Building2 size={15} /><span>{t('common.department', 'Department')}</span><strong>{sop.department_name || t('common.unassigned', 'Unassigned')}</strong></div>
        <div><User size={15} /><span>{t('sop.processOwner', 'Process owner')}</span><strong>{sop.process_owner_name || sop.document_owner_name || t('common.unassigned', 'Unassigned')}</strong></div>
        <div><CalendarClock size={15} /><span>{t('policy.effectiveDate', 'Effective date')}</span><strong>{formatDate(sop.effective_date)}</strong></div>
        <div><CalendarClock size={15} /><span>{t('common.nextReview', 'Next review')}</span><strong>{formatDate(sop.next_review_date)}</strong></div>
        <div><Layers size={15} /><span>{t('sop.procedure.steps', 'Procedure steps')}</span><strong>{procedureSteps.length}</strong></div>
        <div><Shield size={15} /><span>{t('sop.traceability', 'Risk / control links')}</span><strong>{riskLinks.length + derivedControls.length}</strong></div>
      </div>

      <div className="ui2-policy-chain"><BookOpen size={18} /><div><span>{t('sop.governingPolicy', 'Governing Policy')}</span><strong>{sop.primary_policy_document_code || t('sop.linkState.not_applicable', 'Not applicable')} {sop.primary_policy_document_title ? `· ${sop.primary_policy_document_title}` : ''}</strong><small>{sop.primary_policy_version_label ? `v${sop.primary_policy_version_label}` : sop.governance_link_state}</small></div><StatusBadge status={sop.governance_link_state === 'linked' ? t('sop.linkState.linked', 'Linked') : sop.governance_link_state} tone={sop.governance_link_state === 'linked' ? 'success' : 'warning'} /></div>

      <div className="ui2-detail-layout">
        <main className="ui2-detail-main">
          <section className="ui2-content-section"><div className="ui2-section-heading"><div><p>{t('sop.exactHow', 'Exact how')}</p><h3>{t('sop.purposeScope', 'Purpose and scope')}</h3></div></div><div className="ui2-content-columns"><div><h4>{t('policy.purpose', 'Purpose')}</h4><p>{purpose || '—'}</p></div><div><h4>{t('policy.scope', 'Scope')}</h4><p>{scope || '—'}</p></div></div></section>
          <section className="ui2-content-section"><div className="ui2-section-heading"><div><p>{t('sop.execution', 'Execution')}</p><h3>{t('sop.procedure.title', 'Governed procedure')}</h3></div><span>{procedureSteps.length}</span></div>{procedureSteps.length ? <ol className="ui2-procedure-list">{procedureSteps.map((step) => <li key={step.id || step.sequence_number}><span>{step.sequence_number}</span><div><strong>{language === 'ar' ? step.action_instruction_ar || step.action_instruction_en : step.action_instruction_en}</strong><small>{step.responsible_role}{step.timing_sla_en ? ` · ${step.timing_sla_en}` : ''}</small><div className="ui2-chip-list">{step.required_control_code ? <span>{step.required_control_code}</span> : null}{step.expected_evidence_record_en ? <span>{language === 'ar' ? step.expected_evidence_record_ar || step.expected_evidence_record_en : step.expected_evidence_record_en}</span> : null}</div></div><StatusBadge status={step.criticality} tone={step.criticality === 'critical' || step.criticality === 'high' ? 'danger' : 'neutral'} /></li>)}</ol> : <p className="ui2-empty-copy">{t('sop.procedure.noSteps', 'No procedure steps are configured.')}</p>}</section>
          <section className="ui2-content-section"><div className="ui2-section-heading"><div><p>{t('sop.accountability', 'Accountability')}</p><h3>{t('sop.tab.responsibilities', 'Roles and responsibilities')}</h3></div><span>{roleResponsibilities.length}</span></div><div className="ui2-responsibility-grid">{roleResponsibilities.map((item) => <article key={item.id || item.sequence_number}><strong>{item.role_name || item.job_title || t('common.unassigned', 'Unassigned')}</strong><p>{language === 'ar' ? item.responsibility_ar || item.responsibility_en : item.responsibility_en}</p><small>{item.accountable_for_en || ''}</small></article>)}</div></section>
        </main>

        <aside className="ui2-detail-rail">
          <section className="ui2-rail-section"><h3>{t('sop.training.title', 'Training & acknowledgment')}</h3><dl><div><dt><GraduationCap size={13} />{t('sop.training.badge', 'Training')}</dt><dd>{sop.training_required ? t('common.required', 'Required') : t('common.notRequired', 'Not required')}</dd></div><div><dt>{t('sop.acknowledgment', 'Acknowledgment')}</dt><dd>{sop.acknowledgment_required ? t('common.required', 'Required') : t('common.notRequired', 'Not required')}</dd></div><div><dt>{t('sop.competency', 'Competency')}</dt><dd>{sop.competency_assessment_required ? t('common.required', 'Required') : t('common.notRequired', 'Not required')}</dd></div></dl></section>
          <section className="ui2-rail-section"><h3>{t('sop.traceability', 'Traceability')}</h3><dl><div><dt>{t('common.risks', 'Risks')}</dt><dd>{riskLinks.length}</dd></div><div><dt>{t('common.controls', 'Derived controls')}</dt><dd>{derivedControls.length}</dd></div><div><dt>{t('common.accreditation', 'Accreditation links')}</dt><dd>{accreditationLinks.length + inheritedAccreditations.length}</dd></div><div><dt>{t('sop.records.title', 'Forms & Records')}</dt><dd>{procedureSteps.filter((step) => step.expected_evidence_record_en || step.expected_evidence_record_ar).length}</dd></div></dl></section>
          <section className="ui2-rail-section"><h3>{t('policy.versionHistory', 'Version history')}</h3><ol className="ui2-version-list">{allVersions.map((version) => <li key={version.id}><span>v{version.version_label}</span><div><strong>{version.is_current_version ? t('common.current', 'Current') : t('common.historical', 'Historical')}</strong><small>{formatDate(version.effective_date)}</small></div></li>)}</ol></section>
        </aside>
      </div>
    </div>
  );
}
