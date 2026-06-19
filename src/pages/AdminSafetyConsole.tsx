import { Download, LockKeyhole, ShieldAlert } from 'lucide-react';
import { DataState } from '../components/DataState';
import { StatusBadge } from '../components/StatusBadge';
import { useAsyncData } from '../hooks/useAsyncData';
import { useI18n } from '../i18n/I18nContext';
import { getAdminSafetyFindings } from '../lib/releaseOpsApi';

function exportCsv(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return;
  const columns = Object.keys(rows[0]);
  const csv = [columns.join(','), ...rows.map(row => columns.map(column => JSON.stringify(row[column] ?? '')).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'admin-safety-console.csv';
  link.click();
  URL.revokeObjectURL(url);
}

export function AdminSafetyConsole() {
  const { language } = useI18n();
  const text = language === 'ar' ? ar : en;
  const findings = useAsyncData(getAdminSafetyFindings, []);
  const rows = findings.data ?? [];
  const critical = rows.filter(row => row.severity === 'critical').length;
  const high = rows.filter(row => row.severity === 'high').length;
  const open = rows.filter(row => row.status === 'open').length;

  return (
    <section className="page-section admin-safety-page">
      <div className="section-heading command-hero">
        <div><p className="eyebrow">{text.eyebrow}</p><h3>{text.title}</h3><p className="section-subtitle">{text.subtitle}</p></div>
        <button className="primary-button" onClick={() => exportCsv(rows as any[])}><Download size={16} /> {text.export}</button>
      </div>
      <div className="stats-grid">
        <div className="stat-card danger"><ShieldAlert size={20} /><div className="stat-value">{critical}</div><div className="stat-label">{text.critical}</div></div>
        <div className="stat-card warning"><ShieldAlert size={20} /><div className="stat-value">{high}</div><div className="stat-label">{text.high}</div></div>
        <div className="stat-card"><LockKeyhole size={20} /><div className="stat-value">{open}</div><div className="stat-label">{text.open}</div></div>
      </div>
      <div className="panel">
        <div className="panel-header"><h4>{text.findings}</h4><p>{text.findingsHint}</p></div>
        <DataState loading={findings.loading} error={findings.error} empty={!rows.length}>
          <div className="warning-stack">
            {rows.map(row => (
              <div className={`warning-card admin-safety-card ${row.severity}`} key={row.id}>
                <div className="split-header"><strong>{row.finding}</strong><StatusBadge status={row.severity} /></div>
                <p>{row.recommendation}</p>
                <div className="command-meta"><span>{row.area}</span><span>{row.owner}</span><span>{row.status}</span></div>
              </div>
            ))}
          </div>
        </DataState>
      </div>
    </section>
  );
}
const en = { eyebrow: 'Admin safety', title: 'Admin Safety Console', subtitle: 'Controls for dangerous admin actions, large imports, production resets, access changes and data-retention operations.', export: 'Export findings', critical: 'Critical', high: 'High', open: 'Open', findings: 'Safety findings', findingsHint: 'Use this before production cutover and before any high-impact admin change.' };
const ar = { eyebrow: 'سلامة الإدارة', title: 'لوحة سلامة الإدارة', subtitle: 'ضوابط إجراءات الإدارة الخطرة والاستيرادات الكبيرة وإعادة الضبط وتغييرات الصلاحيات والاحتفاظ بالبيانات.', export: 'تصدير الملاحظات', critical: 'حرجة', high: 'عالية', open: 'مفتوحة', findings: 'ملاحظات السلامة', findingsHint: 'استخدمها قبل التشغيل الفعلي وقبل أي تغيير إداري عالي الأثر.' };
