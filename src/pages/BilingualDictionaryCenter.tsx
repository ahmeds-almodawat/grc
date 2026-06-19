import { Download, Languages } from 'lucide-react';
import { DataState } from '../components/DataState';
import { StatusBadge } from '../components/StatusBadge';
import { useAsyncData } from '../hooks/useAsyncData';
import { useI18n } from '../i18n/I18nContext';
import { getTranslationDictionary } from '../lib/releaseOpsApi';

function exportCsv(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return;
  const columns = Object.keys(rows[0]);
  const csv = [columns.join(','), ...rows.map(row => columns.map(column => JSON.stringify(row[column] ?? '')).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'bilingual-dictionary.csv';
  link.click();
  URL.revokeObjectURL(url);
}

export function BilingualDictionaryCenter() {
  const { language } = useI18n();
  const text = language === 'ar' ? ar : en;
  const dictionary = useAsyncData(getTranslationDictionary, []);
  const rows = dictionary.data ?? [];
  const complete = rows.filter(row => row.status === 'complete').length;
  const coverage = rows.length ? Math.round((complete / rows.length) * 100) : 0;
  const needsReview = rows.filter(row => row.status !== 'complete').length;

  return (
    <section className="page-section">
      <div className="section-heading command-hero">
        <div><p className="eyebrow">{text.eyebrow}</p><h3>{text.title}</h3><p className="section-subtitle">{text.subtitle}</p></div>
        <button className="primary-button" onClick={() => exportCsv(rows as any[])}><Download size={16} /> {text.export}</button>
      </div>
      <div className="stats-grid">
        <div className="stat-card success"><Languages size={20} /><div className="stat-value">{coverage}%</div><div className="stat-label">{text.coverage}</div></div>
        <div className="stat-card warning"><Languages size={20} /><div className="stat-value">{needsReview}</div><div className="stat-label">{text.review}</div></div>
        <div className="stat-card"><Languages size={20} /><div className="stat-value">{rows.length}</div><div className="stat-label">{text.keys}</div></div>
      </div>
      <div className="panel">
        <div className="panel-header"><h4>{text.dictionary}</h4><p>{text.dictionaryHint}</p></div>
        <DataState loading={dictionary.loading} error={dictionary.error} empty={!rows.length}>
          <div className="table-wrap">
            <table className="entity-table">
              <thead><tr><th>{text.key}</th><th>{text.category}</th><th>English</th><th>العربية</th><th>{text.status}</th></tr></thead>
              <tbody>{rows.map(row => (
                <tr key={row.key}><td><code>{row.key}</code></td><td>{row.category}</td><td>{row.englishLabel}</td><td>{row.arabicLabel}</td><td><StatusBadge status={row.status} /></td></tr>
              ))}</tbody>
            </table>
          </div>
        </DataState>
      </div>
    </section>
  );
}
const en = { eyebrow: 'Bilingual governance', title: 'Bilingual Dictionary Center', subtitle: 'Central review of role, status, source, workflow and governance terms in Arabic and English.', export: 'Export dictionary', coverage: 'Coverage', review: 'Needs review', keys: 'Dictionary keys', dictionary: 'Core dictionary', dictionaryHint: 'Use this list to standardize language before rollout to all employees.', key: 'Key', category: 'Category', status: 'Status' };
const ar = { eyebrow: 'حوكمة ثنائية اللغة', title: 'مركز القاموس العربي/الإنجليزي', subtitle: 'مراجعة مركزية للمسميات والأدوار والحالات والمصادر وسير العمل بالعربية والإنجليزية.', export: 'تصدير القاموس', coverage: 'نسبة الاكتمال', review: 'تحتاج مراجعة', keys: 'مفاتيح القاموس', dictionary: 'القاموس الأساسي', dictionaryHint: 'استخدم هذه القائمة لتوحيد اللغة قبل تعميم النظام على الموظفين.', key: 'المفتاح', category: 'التصنيف', status: 'الحالة' };
