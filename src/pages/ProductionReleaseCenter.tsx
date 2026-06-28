import { useState } from 'react';
import { Download, PlayCircle, Rocket, ShieldCheck } from 'lucide-react';
import { DataState } from '../components/DataState';
import { StatusBadge } from '../components/StatusBadge';
import { useAsyncData } from '../hooks/useAsyncData';
import { useI18n } from '../i18n/I18nContext';
import { getProductionChecklist, getUltraReleaseSummary, runReleasePreflight } from '../lib/releaseOpsApi';
import { actionErrorMessage } from '../lib/privilegedAction';
import { ProductionReadinessGatePanel } from '../components/v200/ProductionReadinessGatePanel';

function copyCsv(filename: string, rows: Array<Record<string, unknown>>) {
  if (!rows.length) return;
  const columns = Array.from(rows.reduce((set, row) => {
    Object.keys(row).forEach(key => set.add(key));
    return set;
  }, new Set<string>()));
  const csv = [columns.join(','), ...rows.map(row => columns.map(column => JSON.stringify(row[column] ?? '')).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function ringStyle(score: number) {
  return { ['--score' as string]: `${Math.max(0, Math.min(100, score))}%` };
}

export function ProductionReleaseCenter() {
  const { language } = useI18n();
  const text = language === 'ar' ? ar : en;
  const summary = useAsyncData(getUltraReleaseSummary, []);
  const checklist = useAsyncData(getProductionChecklist, []);
  const [actionError, setActionError] = useState('');
  const score = summary.data?.releaseScore ?? 0;

  const runPreflight = async () => {
    setActionError('');
    try {
      await runReleasePreflight();
      await Promise.all([summary.refresh(), checklist.refresh()]);
    } catch (actionFailure) {
      setActionError(actionErrorMessage(actionFailure));
    }
  };

  return (
    <section className="page-section ultra-release-page">
      <ProductionReadinessGatePanel context="release" />
      <div className="section-heading command-hero ultra-hero">
        <div>
          <p className="eyebrow">{text.eyebrow}</p>
          <h3>{text.title}</h3>
          <p className="section-subtitle">{text.subtitle}</p>
        </div>
        <div className="button-row">
          <button className="ghost-button" onClick={() => copyCsv('production-cutover-checklist.csv', checklist.data as any[] ?? [])}><Download size={16} /> {text.export}</button>
          <button className="primary-button" onClick={runPreflight}><PlayCircle size={16} /> {text.runPreflight}</button>
        </div>
      </div>

      {actionError && <div className="notice-banner danger">{actionError}</div>}

      <DataState loading={summary.loading} error={summary.error} empty={!summary.data}>
        <div className="ultra-release-grid">
          <div className="release-score-card">
            <div className="security-score-ring release-ring" style={ringStyle(score)}>
              <div><strong>{score}%</strong><span>{text.ready}</span></div>
            </div>
            <div>
              <h4>{text.releaseScore}</h4>
              <p>{text.releaseScoreHint}</p>
            </div>
          </div>
          <div className="stat-card danger"><Rocket size={20} /><div className="stat-value">{summary.data?.blockerCount ?? 0}</div><div className="stat-label">{text.blockers}</div></div>
          <div className="stat-card warning"><ShieldCheck size={20} /><div className="stat-value">{summary.data?.warningCount ?? 0}</div><div className="stat-label">{text.warnings}</div></div>
          <div className="stat-card success"><ShieldCheck size={20} /><div className="stat-value">{summary.data?.translationCoverage ?? 0}%</div><div className="stat-label">{text.translation}</div></div>
          <div className="stat-card"><ShieldCheck size={20} /><div className="stat-value">{summary.data?.migrationsVerified ?? 0}/{summary.data?.migrationsExpected ?? 0}</div><div className="stat-label">{text.migrations}</div></div>
          <div className="stat-card warning"><ShieldCheck size={20} /><div className="stat-value">{summary.data?.adminLocksActive ?? 0}</div><div className="stat-label">{text.adminLocks}</div></div>
        </div>
      </DataState>

      <div className="panel">
        <div className="panel-header"><h4>{text.checklist}</h4><p>{text.checklistHint}</p></div>
        <DataState loading={checklist.loading} error={checklist.error} empty={!checklist.data?.length}>
          <div className="table-wrap">
            <table className="entity-table">
              <thead><tr><th>{text.phase}</th><th>{text.item}</th><th>{text.status}</th><th>{text.owner}</th><th>{text.evidence}</th><th>{text.notes}</th></tr></thead>
              <tbody>{(checklist.data ?? []).map(row => (
                <tr key={row.id}>
                  <td>{row.phase}</td>
                  <td><strong>{row.item}</strong></td>
                  <td><StatusBadge status={row.status} /></td>
                  <td>{row.owner}</td>
                  <td>{row.evidence}</td>
                  <td>{row.notes}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </DataState>
      </div>
    </section>
  );
}

const en = {
  eyebrow: 'Production release control',
  title: 'Ultra Release Control Center',
  subtitle: 'Final pre-go-live cockpit for release score, blockers, migration verification, backup readiness, restore drills and bilingual completion.',
  export: 'Export checklist',
  runPreflight: 'Run preflight',
  ready: 'Ready',
  releaseScore: 'Release score',
  releaseScoreHint: 'Calculated from blockers, warnings, migrations, backups, restore drills, translations and safety locks.',
  blockers: 'Blockers',
  warnings: 'Warnings',
  translation: 'Translation coverage',
  migrations: 'Migrations verified',
  adminLocks: 'Admin safety locks',
  checklist: 'Production cutover checklist',
  checklistHint: 'Do not go live until blockers are cleared and evidence is attached for critical gates.',
  phase: 'Phase',
  item: 'Item',
  status: 'Status',
  owner: 'Owner',
  evidence: 'Evidence',
  notes: 'Notes'
};

const ar = {
  eyebrow: 'تحكم إطلاق الإنتاج',
  title: 'مركز تحكم الإصدار النهائي',
  subtitle: 'لوحة ما قبل التشغيل الفعلي لمتابعة جاهزية الإصدار والمعوقات والترحيلات والنسخ والاستعادة والترجمة والأقفال الآمنة.',
  export: 'تصدير القائمة',
  runPreflight: 'فحص ما قبل الإطلاق',
  ready: 'جاهز',
  releaseScore: 'درجة الجاهزية',
  releaseScoreHint: 'محسوبة من المعوقات والتحذيرات والترحيلات والنسخ وتجارب الاستعادة والترجمة وأقفال السلامة.',
  blockers: 'معوقات',
  warnings: 'تحذيرات',
  translation: 'اكتمال الترجمة',
  migrations: 'الترحيلات المؤكدة',
  adminLocks: 'أقفال سلامة الإدارة',
  checklist: 'قائمة التشغيل الفعلي',
  checklistHint: 'لا تبدأ التشغيل الفعلي قبل إغلاق المعوقات وإرفاق الأدلة للبوابات الحرجة.',
  phase: 'المرحلة',
  item: 'البند',
  status: 'الحالة',
  owner: 'المسؤول',
  evidence: 'الدليل',
  notes: 'ملاحظات'
};
