import { FileText, ShieldCheck, UploadCloud } from 'lucide-react';
import { DataState } from '../components/DataState';
import { StatusBadge } from '../components/StatusBadge';
import { useAsyncData } from '../hooks/useAsyncData';
import { getDocumentSummary, getDocuments } from '../lib/commandCenterApi';
import { useI18n } from '../i18n/I18nContext';

export function PolicyDocumentCenter() {
  const { t } = useI18n();
  const summary = useAsyncData(getDocumentSummary, []);
  const docs = useAsyncData(getDocuments, []);
  const s = summary.data;

  return (
    <section className="page-section document-page">
      <div className="section-heading command-hero">
        <div>
          <p className="eyebrow">{t('documents.eyebrow')}</p>
          <h3>{t('documents.title')}</h3>
          <p className="section-subtitle">{t('documents.subtitle')}</p>
        </div>
        <button className="primary-button"><UploadCloud size={16} /> {t('documents.registerDocument')}</button>
      </div>

      <DataState loading={summary.loading} error={summary.error} empty={!s}>
        {s && (
          <div className="stats-grid">
            <div className="stat-card"><FileText size={20} /><div className="stat-value">{s.totalDocuments}</div><div className="stat-label">{t('documents.total')}</div></div>
            <div className="stat-card success"><ShieldCheck size={20} /><div className="stat-value">{s.activeDocuments}</div><div className="stat-label">{t('documents.active')}</div></div>
            <div className="stat-card warning"><FileText size={20} /><div className="stat-value">{s.reviewDue30Days}</div><div className="stat-label">{t('documents.reviewDue')}</div></div>
            <div className="stat-card danger"><FileText size={20} /><div className="stat-value">{s.expiredDocuments}</div><div className="stat-label">{t('documents.expired')}</div></div>
            <div className="stat-card warning"><FileText size={20} /><div className="stat-value">{s.missingOwner}</div><div className="stat-label">{t('documents.missingOwner')}</div></div>
            <div className="stat-card warning"><UploadCloud size={20} /><div className="stat-value">{s.missingFile}</div><div className="stat-label">{t('documents.missingFile')}</div></div>
          </div>
        )}
      </DataState>

      <div className="panel">
        <div className="panel-header"><h4>{t('documents.register')}</h4><p>{t('documents.registerHint')}</p></div>
        <DataState loading={docs.loading} error={docs.error} empty={!docs.data?.length}>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>{t('documents.code')}</th><th>{t('documents.document')}</th><th>{t('documents.type')}</th><th>{t('common.department')}</th><th>{t('common.owner')}</th><th>{t('common.status')}</th><th>{t('documents.reviewDue')}</th><th>{t('documents.file')}</th></tr></thead>
              <tbody>
                {(docs.data ?? []).map(row => (
                  <tr key={row.id}>
                    <td>{row.documentCode}</td>
                    <td><strong>{row.title}</strong><p className="muted">v{row.version} · <span className={`risk-pill ${row.riskLevel}`}>{row.riskLevel}</span></p></td>
                    <td>{row.documentType}</td>
                    <td>{row.department}</td>
                    <td>{row.owner}</td>
                    <td><StatusBadge status={row.status} /></td>
                    <td>{row.reviewDueDate ?? '—'}</td>
                    <td>{row.fileName ? <span className="status-badge status-approved">{row.fileName}</span> : <span className="status-badge status-pending-evidence">{t('documents.noFile')}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DataState>
      </div>
    </section>
  );
}
