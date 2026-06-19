import { useMemo, useState } from 'react';
import { Download, Eye, FileJson, Printer, RefreshCcw } from 'lucide-react';
import { DataState } from '../components/DataState';
import { ModernCard, StatusPill } from '../components/ModernCard';
import { useAsyncData } from '../hooks/useAsyncData';
import { fetchTemplateRows, getReportTemplates, recordReportRun, type ReportTemplate } from '../lib/enterpriseApi';
import { exportRows, printRows } from '../lib/exportUtils';
import { useI18n } from '../i18n/I18nContext';

export function AdvancedReportBuilder() {
  const { t, language, direction } = useI18n();
  const templates = useAsyncData(getReportTemplates, []);
  const [selected, setSelected] = useState<ReportTemplate | null>(null);
  const [previewRows, setPreviewRows] = useState<Record<string, unknown>[]>([]);
  const [status, setStatus] = useState('');

  const activeTemplate = selected ?? templates.data?.[0] ?? null;
  const columns = useMemo(() => activeTemplate?.defaultColumns ?? [], [activeTemplate]);

  async function loadPreview(template = activeTemplate) {
    if (!template) return;
    setStatus('');
    const rows = await fetchTemplateRows(template);
    setPreviewRows(rows.slice(0, 50));
    await recordReportRun(template, rows.length, 'print');
    setStatus(`${t('reports.previewLoaded')}: ${rows.length}`);
  }

  async function exportTemplate(format: 'csv' | 'json') {
    if (!activeTemplate) return;
    const rows = await fetchTemplateRows(activeTemplate);
    exportRows(activeTemplate.templateCode, rows, format);
    await recordReportRun(activeTemplate, rows.length, format);
  }

  async function printTemplate() {
    if (!activeTemplate) return;
    const rows = await fetchTemplateRows(activeTemplate);
    printRows(language === 'ar' ? activeTemplate.titleAr : activeTemplate.titleEn, rows, direction);
    await recordReportRun(activeTemplate, rows.length, 'print');
  }

  return (
    <section className="page-section enterprise-page">
      <div className="section-heading command-hero">
        <div>
          <p className="eyebrow">{t('reports.eyebrow')}</p>
          <h3>{t('reports.title')}</h3>
          <p className="section-subtitle">{t('reports.subtitle')}</p>
        </div>
        <div className="command-hero-actions">
          <button className="ghost-button" onClick={() => templates.refresh()}><RefreshCcw size={16} /> {t('common.refresh', 'Refresh')}</button>
        </div>
      </div>

      {status && <div className="success-banner">{status}</div>}

      <div className="report-builder-layout">
        <ModernCard title={t('reports.templates')} subtitle={t('reports.templatesHint')}>
          <DataState loading={templates.loading} error={templates.error} empty={!templates.data?.length}>
            <div className="template-list">
              {(templates.data ?? []).map(template => (
                <button className={`template-card ${activeTemplate?.id === template.id ? 'active' : ''}`} key={template.id} onClick={() => { setSelected(template); setPreviewRows([]); }}>
                  <div><strong>{language === 'ar' ? template.titleAr : template.titleEn}</strong><p>{language === 'ar' ? template.descriptionAr : template.descriptionEn}</p></div>
                  <StatusPill tone={template.isSystem ? 'good' : 'neutral'}>{template.sourceView}</StatusPill>
                </button>
              ))}
            </div>
          </DataState>
        </ModernCard>

        <ModernCard title={activeTemplate ? (language === 'ar' ? activeTemplate.titleAr : activeTemplate.titleEn) : t('reports.selectTemplate')} subtitle={activeTemplate?.sourceView}>
          {activeTemplate && (
            <>
              <div className="report-toolbar">
                <button className="primary-button" onClick={() => loadPreview()}><Eye size={16} /> {t('reports.preview')}</button>
                <button className="ghost-button" onClick={() => exportTemplate('csv')}><Download size={16} /> CSV</button>
                <button className="ghost-button" onClick={() => exportTemplate('json')}><FileJson size={16} /> JSON</button>
                <button className="ghost-button" onClick={printTemplate}><Printer size={16} /> {t('reports.print')}</button>
              </div>
              <div className="column-chip-row">{columns.map(column => <span key={column}>{column}</span>)}</div>
              <div className="table-scroll enterprise-preview-table">
                <table>
                  <thead><tr>{(previewRows.length ? Object.keys(previewRows[0]) : columns).slice(0, 8).map(col => <th key={col}>{col}</th>)}</tr></thead>
                  <tbody>
                    {previewRows.slice(0, 10).map((row, index) => (
                      <tr key={index}>{Object.keys(previewRows[0] ?? {}).slice(0, 8).map(col => <td key={col}>{String(row[col] ?? '')}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </ModernCard>
      </div>
    </section>
  );
}
