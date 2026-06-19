import { Download, RefreshCw, ServerCog } from 'lucide-react';
import { DataState } from '../components/DataState';
import { StatusBadge } from '../components/StatusBadge';
import { useAsyncData } from '../hooks/useAsyncData';
import { useI18n } from '../i18n/I18nContext';
import { getMigrationVerification } from '../lib/releaseOpsApi';

function exportCsv(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return;
  const columns = Object.keys(rows[0]);
  const csv = [columns.join(','), ...rows.map(row => columns.map(column => JSON.stringify(row[column] ?? '')).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'migration-verification-matrix.csv';
  link.click();
  URL.revokeObjectURL(url);
}

export function MigrationVerifierCenter() {
  const { language } = useI18n();
  const text = language === 'ar' ? ar : en;
  const migrations = useAsyncData(getMigrationVerification, []);
  const rows = migrations.data ?? [];
  const verified = rows.filter(row => row.verified).length;
  const missing = rows.filter(row => row.status === 'missing').length;
  const pending = rows.filter(row => row.status === 'pending').length;

  return (
    <section className="page-section">
      <div className="section-heading command-hero">
        <div><p className="eyebrow">{text.eyebrow}</p><h3>{text.title}</h3><p className="section-subtitle">{text.subtitle}</p></div>
        <div className="button-row"><button className="ghost-button" onClick={() => exportCsv(rows as any[])}><Download size={16} /> {text.export}</button><button className="primary-button" onClick={migrations.refresh}><RefreshCw size={16} /> {text.refresh}</button></div>
      </div>
      <div className="stats-grid">
        <div className="stat-card success"><ServerCog size={20} /><div className="stat-value">{verified}</div><div className="stat-label">{text.verified}</div></div>
        <div className="stat-card warning"><ServerCog size={20} /><div className="stat-value">{pending}</div><div className="stat-label">{text.pending}</div></div>
        <div className="stat-card danger"><ServerCog size={20} /><div className="stat-value">{missing}</div><div className="stat-label">{text.missing}</div></div>
      </div>
      <div className="panel">
        <div className="panel-header"><h4>{text.matrix}</h4><p>{text.matrixHint}</p></div>
        <DataState loading={migrations.loading} error={migrations.error} empty={!rows.length}>
          <div className="migration-list ultra-migration-list">
            {rows.map(row => (
              <div className={`migration-step ${row.status}`} key={row.migrationFile}>
                <span>{row.sequenceNo}</span>
                <div><strong>{row.migrationFile}</strong><p className="muted">{row.purpose}</p><p>{row.verificationNote}</p></div>
                <StatusBadge status={row.status} />
              </div>
            ))}
          </div>
        </DataState>
      </div>
    </section>
  );
}
const en = { eyebrow: 'Migration assurance', title: 'Migration Verifier', subtitle: 'Checks migration order and verification status before production cutover.', export: 'Export matrix', refresh: 'Refresh', verified: 'Verified', pending: 'Pending', missing: 'Missing', matrix: 'Migration verification matrix', matrixHint: 'Apply migrations in sequence. Treat missing required migrations as blockers.' };
const ar = { eyebrow: 'ضمان الترحيلات', title: 'مدقق الترحيلات', subtitle: 'يتحقق من ترتيب الترحيلات وحالة التأكيد قبل التشغيل الفعلي.', export: 'تصدير المصفوفة', refresh: 'تحديث', verified: 'مؤكد', pending: 'معلق', missing: 'مفقود', matrix: 'مصفوفة تحقق الترحيلات', matrixHint: 'نفذ الترحيلات بالترتيب. اعتبر أي ترحيل مطلوب مفقود معوقاً.' };
