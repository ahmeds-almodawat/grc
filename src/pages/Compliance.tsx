import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { DataState } from '../components/DataState';
import { EntityTable } from '../components/EntityTable';
import { ComplianceForm } from '../components/GrcForms';
import { Modal } from '../components/Modal';
import { ModuleHeader } from '../components/ModuleHeader';
import { StatusBadge } from '../components/StatusBadge';
import { departmentName, formatDate, humanize, ownerName } from '../lib/format';
import { getComplianceItems, getDepartments, getOrganizations, getProfiles } from '../lib/grcApi';
import { useAsyncData } from '../hooks/useAsyncData';
import { useI18n } from '../i18n/I18nContext';
import type { ComplianceRow } from '../types/domain';

export function Compliance() {
  const auth = useAuth();
  const { t } = useI18n();
  const [formOpen, setFormOpen] = useState(false);
  const compliance = useAsyncData(getComplianceItems, []);
  const departments = useAsyncData(getDepartments, []);
  const profiles = useAsyncData(getProfiles, []);
  const organizations = useAsyncData(getOrganizations, []);
  const organizationId = organizations.data?.[0]?.id || '';
  const canManageCompliance = auth.roles.some(role =>
    ['super_admin', 'governance_admin', 'compliance_officer', 'department_manager'].includes(role.role),
  );
  const complianceRows = compliance.data || [];
  const metrics = {
    register: complianceRows.length,
    expiring: complianceRows.filter(r => r.expiry_date && new Date(r.expiry_date).getTime() < Date.now() + 90 * 24 * 60 * 60 * 1000).length,
    highRisk: complianceRows.filter(r => r.risk_level === 'critical' || r.risk_level === 'high').length,
    evidenceNeeded: complianceRows.filter(r => r.status === 'evidence_needed' || r.status === 'review_needed').length,
    overdue: complianceRows.filter(r => r.due_date && new Date(r.due_date).getTime() < Date.now() && r.status !== 'closed' && r.status !== 'compliant').length,
  };

  return (
    <section className="page-section">
      <ModuleHeader
        eyebrow={t('compliance.eyebrow')}
        title={t('compliance.title')}
        subtitle={t('compliance.subtitle')}
        action={canManageCompliance ? <button className="primary-button" onClick={() => setFormOpen(true)}>{t('compliance.new')}</button> : null}
      />

      <div className="module-grid">
        <div className="module-card"><strong>{t('compliance.total')}</strong><span>{metrics.register} {t('compliance.active')}</span></div>
        <div className="module-card warning"><strong>{t('compliance.expiringSoon')}</strong><span>{metrics.expiring} {t('compliance.within90Days')}</span></div>
        <div className="module-card danger"><strong>{t('compliance.highRisk')}</strong><span>{metrics.highRisk} {t('compliance.criticalHigh')}</span></div>
        <div className="module-card warning"><strong>{t('compliance.evidenceNeeded')}</strong><span>{metrics.evidenceNeeded} {t('compliance.pending')}</span></div>
        <div className="module-card danger"><strong>{t('compliance.overdue')}</strong><span>{metrics.overdue} {t('compliance.overdue')}</span></div>
      </div>



      <div className="panel">
        <div className="panel-header">
          <div>
            <h4>{t('compliance.register')}</h4>
            <p className="muted">{t('compliance.registerHint')}</p>
          </div>
          <span className="status-chip neutral">{t('compliance.recordSource')}</span>
        </div>
        <DataState loading={compliance.loading} error={compliance.error} empty={!compliance.data?.length}>
          <EntityTable<ComplianceRow>
            rows={compliance.data || []}
            getRowKey={row => row.id}
            columns={[
              { key: 'code', header: t('common.code'), render: row => row.compliance_code || '—' },
              { key: 'title', header: t('compliance.requirement'), render: row => <strong>{row.title}</strong> },
              { key: 'body', header: t('compliance.regulator'), render: row => row.regulatory_body || '—' },
              { key: 'department', header: t('common.department'), render: row => departmentName(row.departments) },
              { key: 'owner', header: t('common.owner'), render: row => ownerName(row.owner) },
              { key: 'due', header: t('common.due'), render: row => formatDate(row.due_date) },
              { key: 'expiry', header: t('compliance.expiry'), render: row => formatDate(row.expiry_date) },
              { key: 'status', header: t('common.status'), render: row => <StatusBadge status={t(`status.${row.status}`, humanize(row.status))} /> },
              { key: 'risk', header: t('common.risk'), render: row => <span className={`risk-pill ${row.risk_level}`}>{t(`risk.${row.risk_level}`, row.risk_level)}</span> }
            ]}
          />
        </DataState>
      </div>

      <Modal open={formOpen} title={t('compliance.create')} onClose={() => setFormOpen(false)}>
        <ComplianceForm organizationId={organizationId} departments={departments.data || []} profiles={profiles.data || []} onCancel={() => setFormOpen(false)} onCreated={() => { setFormOpen(false); void compliance.refresh(); }} />
      </Modal></section>
  );
}
