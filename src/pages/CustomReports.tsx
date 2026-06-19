import { useEffect, useState } from 'react';
import { ModernShell } from '../components/ModernShell';
import { ModernCard, StatusPill } from '../components/ModernCard';
import { fetchPrintReportIndex, fetchReportRows, logExport, type PrintReportDefinition } from '../lib/hardeningApi';
import { exportRows, printRows } from '../lib/exportUtils';

const languageFromStorage = (): 'en' | 'ar' => (localStorage.getItem('grc-language') === 'ar' ? 'ar' : 'en');

export default function CustomReports() {
  const [language, setLanguage] = useState<'en' | 'ar'>(languageFromStorage);
  const [reports, setReports] = useState<PrintReportDefinition[]>([]);
  const [selected, setSelected] = useState<PrintReportDefinition | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
    localStorage.setItem('grc-language', language);
  }, [language]);

  useEffect(() => {
    let active = true;
    async function load() {
      setIsLoading(true);
      const index = await fetchPrintReportIndex();
      if (!active) return;
      setReports(index);
      setSelected(index[0] ?? null);
      setIsLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  async function runReport(report = selected) {
    if (!report) return;
    setIsRunning(true);
    setError(null);
    try {
      const reportRows = await fetchReportRows(report.source_view, 1000);
      setRows(reportRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setRows([]);
    } finally {
      setIsRunning(false);
    }
  }

  async function handleExport(format: 'csv' | 'json') {
    if (!selected) return;
    const fileName = exportRows(selected.report_key, rows, format);
    await logExport({
      organizationId: selected.organization_id,
      exportType: 'custom_report',
      exportScope: selected.report_key,
      fileName,
      format,
      rowCount: rows.length,
      filters: { source_view: selected.source_view },
    });
  }

  function handlePrint() {
    if (!selected) return;
    printRows(language === 'ar' ? selected.name_ar : selected.name_en, rows, language === 'ar' ? 'rtl' : 'ltr');
  }

  const columns = rows.length ? Object.keys(rows[0]) : [];

  return (
    <ModernShell
      eyebrow={language === 'ar' ? 'التقارير والطباعة' : 'Reports & print'}
      title={language === 'ar' ? 'مركز التقارير المخصصة' : 'Custom Report Center'}
      subtitle={
        language === 'ar'
          ? 'شغل تقارير جاهزة، اطبعها، أو صدّرها إلى CSV/JSON للتحليل الخارجي.'
          : 'Run controlled report packs, print them, or export CSV/JSON for external analysis.'
      }
      actions={
        <div className="button-row">
          <button className="btn btn--ghost" onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}>
            {language === 'ar' ? 'English' : 'العربية'}
          </button>
          <button className="btn btn--primary" onClick={() => runReport()} disabled={!selected || isRunning}>
            {language === 'ar' ? 'تشغيل التقرير' : 'Run report'}
          </button>
        </div>
      }
    >
      {error && <div className="notice-banner notice-banner--danger">{error}</div>}

      <div className="report-layout">
        <ModernCard title={language === 'ar' ? 'حزم التقارير' : 'Report packs'}>
          {isLoading ? (
            <div className="skeleton-block" />
          ) : (
            <div className="report-list">
              {reports.map((report) => (
                <button
                  key={report.report_key}
                  className={`report-item ${selected?.report_key === report.report_key ? 'is-active' : ''}`}
                  onClick={() => {
                    setSelected(report);
                    setRows([]);
                  }}
                >
                  <span>{language === 'ar' ? report.name_ar : report.name_en}</span>
                  <small>{language === 'ar' ? report.category_ar : report.category_en}</small>
                </button>
              ))}
            </div>
          )}
        </ModernCard>

        <ModernCard
          title={selected ? (language === 'ar' ? selected.name_ar : selected.name_en) : language === 'ar' ? 'لا يوجد تقرير' : 'No report selected'}
          subtitle={selected?.source_view}
          action={<StatusPill tone={rows.length ? 'good' : 'neutral'}>{rows.length} {language === 'ar' ? 'صف' : 'rows'}</StatusPill>}
        >
          <div className="button-row button-row--end">
            <button className="btn btn--secondary" onClick={handlePrint} disabled={!rows.length}>{language === 'ar' ? 'طباعة' : 'Print'}</button>
            <button className="btn btn--secondary" onClick={() => handleExport('csv')} disabled={!rows.length}>{language === 'ar' ? 'CSV' : 'CSV'}</button>
            <button className="btn btn--secondary" onClick={() => handleExport('json')} disabled={!rows.length}>{language === 'ar' ? 'JSON' : 'JSON'}</button>
          </div>

          {isRunning ? (
            <div className="skeleton-block" />
          ) : rows.length ? (
            <div className="modern-table-wrap modern-table-wrap--tall">
              <table className="modern-table">
                <thead>
                  <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.slice(0, 100).map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {columns.map((column) => (
                        <td key={column}>{formatCell(row[column])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state__icon">↧</div>
              <h3>{language === 'ar' ? 'شغّل التقرير لعرض البيانات' : 'Run the report to preview data'}</h3>
              <p>{language === 'ar' ? 'بعد التشغيل يمكنك الطباعة أو التصدير.' : 'After running it, you can print or export the results.'}</p>
            </div>
          )}
        </ModernCard>
      </div>
    </ModernShell>
  );
}

function formatCell(value: unknown) {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
