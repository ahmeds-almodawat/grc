import { StatusPill } from './ModernCard';
import type { BackupHealthCheck, WorkflowBlocker } from '../lib/hardeningApi';

export type UiLanguage = 'en' | 'ar';

const severityTone = {
  critical: 'danger',
  high: 'warning',
  medium: 'warning',
  low: 'neutral',
} as const;

export function HealthSeverityTable({ rows, language }: { rows: BackupHealthCheck[]; language: UiLanguage }) {
  const activeRows = rows.filter((row) => row.record_count > 0);

  if (!activeRows.length) {
    return (
      <div className="empty-state">
        <div className="empty-state__icon">✓</div>
        <h3>{language === 'ar' ? 'لا توجد ملاحظات نشطة' : 'No active findings'}</h3>
        <p>{language === 'ar' ? 'كل فحوصات الصحة الحالية سليمة.' : 'All current health checks are clean.'}</p>
      </div>
    );
  }

  return (
    <div className="modern-table-wrap">
      <table className="modern-table">
        <thead>
          <tr>
            <th>{language === 'ar' ? 'المستوى' : 'Severity'}</th>
            <th>{language === 'ar' ? 'المجال' : 'Area'}</th>
            <th>{language === 'ar' ? 'الفحص' : 'Check'}</th>
            <th>{language === 'ar' ? 'العدد' : 'Count'}</th>
            <th>{language === 'ar' ? 'التفاصيل' : 'Details'}</th>
          </tr>
        </thead>
        <tbody>
          {activeRows.map((row) => (
            <tr key={row.check_key}>
              <td>
                <StatusPill tone={severityTone[row.severity]}>{row.severity}</StatusPill>
              </td>
              <td>{row.area}</td>
              <td>{language === 'ar' ? row.title_ar : row.title_en}</td>
              <td className="table-number">{row.record_count}</td>
              <td>{language === 'ar' ? row.details_ar : row.details_en}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function WorkflowBlockerTable({ rows, language }: { rows: WorkflowBlocker[]; language: UiLanguage }) {
  if (!rows.length) {
    return (
      <div className="empty-state">
        <div className="empty-state__icon">✓</div>
        <h3>{language === 'ar' ? 'لا توجد عوائق سير عمل' : 'No workflow blockers'}</h3>
        <p>{language === 'ar' ? 'لا توجد بنود تحتاج تدخلاً فورياً.' : 'There are no items requiring immediate intervention.'}</p>
      </div>
    );
  }

  return (
    <div className="modern-table-wrap">
      <table className="modern-table">
        <thead>
          <tr>
            <th>{language === 'ar' ? 'النوع' : 'Type'}</th>
            <th>{language === 'ar' ? 'العنوان' : 'Title'}</th>
            <th>{language === 'ar' ? 'الحالة' : 'Status'}</th>
            <th>{language === 'ar' ? 'تاريخ الاستحقاق' : 'Due date'}</th>
            <th>{language === 'ar' ? 'العائق' : 'Blocker'}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.item_type}-${row.item_id}`}>
              <td><StatusPill>{row.item_type}</StatusPill></td>
              <td>{row.title}</td>
              <td>{row.status}</td>
              <td>{row.due_date ?? '—'}</td>
              <td>{language === 'ar' ? row.blocker_ar : row.blocker_en}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
