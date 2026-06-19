import { useEffect, useMemo, useState } from 'react';
import { exportPilotPack, getImportReadiness, getPilotIssueBoard, getPilotWaveSummary, getRolloutReadiness, ImportReadiness, PilotIssue, PilotSummary, RolloutReadiness } from '../lib/pilotOpsApi';
import { v34PilotDictionary } from '../data/v34PilotDictionary';

type Lang = 'en' | 'ar';

function downloadJson(name: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function signalClass(signal?: string) {
  if (!signal) return 'status-neutral';
  if (['blocked', 'critical', 'failed'].includes(signal)) return 'status-danger';
  if (['warning', 'overdue', 'high'].includes(signal)) return 'status-warning';
  if (['ready', 'pilot_ready', 'closed', 'completed'].includes(signal)) return 'status-success';
  return 'status-neutral';
}

export default function PilotOperationsCenter() {
  const [lang, setLang] = useState<Lang>(() => (document.documentElement.dir === 'rtl' ? 'ar' : 'en'));
  const t = v34PilotDictionary[lang];
  const [waves, setWaves] = useState<PilotSummary[]>([]);
  const [imports, setImports] = useState<ImportReadiness[]>([]);
  const [issues, setIssues] = useState<PilotIssue[]>([]);
  const [rollout, setRollout] = useState<RolloutReadiness | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'waves' | 'imports' | 'issues' | 'path'>('overview');

  useEffect(() => {
    Promise.all([getPilotWaveSummary(), getImportReadiness(), getPilotIssueBoard(), getRolloutReadiness()]).then(([w, i, iss, r]) => {
      setWaves(w);
      setImports(i);
      setIssues(iss);
      setRollout(r);
    });
  }, []);

  const computedScore = useMemo(() => {
    if (!rollout) return 0;
    const importScore = rollout.total_import_areas ? (rollout.ready_import_areas / rollout.total_import_areas) * 35 : 0;
    const pilotScore = rollout.pilot_waves ? (rollout.completed_waves / rollout.pilot_waves) * 25 : 0;
    const rehearsalScore = rollout.total_rehearsals ? (rollout.passed_rehearsals / rollout.total_rehearsals) * 25 : 0;
    const issuePenalty = rollout.critical_pilot_issues > 0 ? 30 : Math.min(15, rollout.open_pilot_issues * 2);
    return Math.max(0, Math.min(100, Math.round(importScore + pilotScore + rehearsalScore + 15 - issuePenalty)));
  }, [rollout]);

  const tabs = [
    { id: 'overview', label: lang === 'ar' ? 'النظرة العامة' : 'Overview' },
    { id: 'waves', label: t.pilotWaves },
    { id: 'imports', label: t.realDataImport },
    { id: 'issues', label: t.issueBoard },
    { id: 'path', label: t.shortestSafePath }
  ] as const;

  return (
    <main className="page-shell pilot-ops-page" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <section className="hero-panel executive-hero">
        <div>
          <p className="eyebrow">v3.4</p>
          <h1>{t.pilotOperations}</h1>
          <p className="muted max-w-3xl">{t.pilotSubtitle}</p>
        </div>
        <div className="hero-actions">
          <button className="btn-secondary" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}>{lang === 'ar' ? 'English' : 'العربية'}</button>
          <button className="btn-primary" onClick={async () => downloadJson('v34-pilot-pack.json', await exportPilotPack())}>{t.exportPilotPack}</button>
        </div>
      </section>

      <section className="kpi-grid compact-grid">
        <article className="kpi-card xl">
          <span>{t.readinessScore}</span>
          <strong>{computedScore}%</strong>
          <p>{rollout?.rollout_signal || 'loading'}</p>
        </article>
        <article className="kpi-card">
          <span>{t.pilotWaves}</span>
          <strong>{rollout?.completed_waves ?? 0}/{rollout?.pilot_waves ?? 0}</strong>
          <p>{lang === 'ar' ? 'مكتملة' : 'completed'}</p>
        </article>
        <article className="kpi-card">
          <span>{t.importAreas}</span>
          <strong>{rollout?.ready_import_areas ?? 0}/{rollout?.total_import_areas ?? 0}</strong>
          <p>{lang === 'ar' ? 'جاهزة أو مستوردة' : 'ready/imported'}</p>
        </article>
        <article className="kpi-card danger-soft">
          <span>{t.criticalIssues}</span>
          <strong>{rollout?.critical_pilot_issues ?? 0}</strong>
          <p>{t.openIssues}: {rollout?.open_pilot_issues ?? 0}</p>
        </article>
      </section>

      <nav className="hub-tabs polished-tabs" aria-label="Pilot operations sections">
        {tabs.map(tab => (
          <button key={tab.id} className={activeTab === tab.id ? 'active' : ''} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>
        ))}
      </nav>

      {activeTab === 'overview' && (
        <section className="two-column-layout">
          <div className="panel-card">
            <h2>{t.companyRollout}</h2>
            <div className={`status-pill ${signalClass(rollout?.rollout_signal)}`}>{rollout?.rollout_signal || 'loading'}</div>
            <p className="muted">{lang === 'ar' ? 'لا يتم الانتقال للتعميم قبل اكتمال موجة تجريبية واحدة على الأقل، واختبار RLS، والتحقق من النسخ الاحتياطي، وقبول مسار OVR.' : 'Do not move to company rollout until at least one pilot wave, RLS testing, backup verification, and OVR acceptance are completed.'}</p>
          </div>
          <div className="panel-card">
            <h2>{t.goLiveRehearsal}</h2>
            <ul className="check-list">
              <li>{lang === 'ar' ? 'نسخة احتياطية قبل الترحيل' : 'Backup before migration'}</li>
              <li>{lang === 'ar' ? 'تجربة استعادة موثقة' : 'Documented restore dry-run'}</li>
              <li>{lang === 'ar' ? 'اختبار صلاحيات الموظف والمدير والتنفيذي' : 'Employee, manager, and executive access test'}</li>
              <li>{lang === 'ar' ? 'اختبار بلاغ OVR من الإنشاء حتى الإغلاق' : 'OVR creation-to-closure test'}</li>
            </ul>
          </div>
        </section>
      )}

      {activeTab === 'waves' && (
        <section className="data-grid cards-grid">
          {waves.map(w => (
            <article className="panel-card" key={w.pilot_wave_id || w.wave_name}>
              <div className="row-between"><h3>{w.wave_name}</h3><span className={`status-pill ${signalClass(w.status)}`}>{w.status}</span></div>
              <div className="progress-line"><span style={{ width: `${w.readiness_score}%` }} /></div>
              <p className="muted">{t.readinessScore}: {w.readiness_score}%</p>
              <div className="mini-metrics">
                <span>{lang === 'ar' ? 'الأقسام' : 'Departments'}: {w.included_departments}/{w.target_departments}</span>
                <span>{lang === 'ar' ? 'المستخدمون' : 'Users'}: {w.participants}/{w.target_users}</span>
                <span>RLS: {w.rls_verified_users}</span>
                <span>{t.openIssues}: {w.open_issues}</span>
              </div>
            </article>
          ))}
        </section>
      )}

      {activeTab === 'imports' && (
        <section className="table-card">
          <table>
            <thead><tr><th>{lang === 'ar' ? 'المجال' : 'Area'}</th><th>{lang === 'ar' ? 'الحالة' : 'Status'}</th><th>{lang === 'ar' ? 'النسبة' : 'Percent'}</th><th>{lang === 'ar' ? 'مرفوض' : 'Rejected'}</th><th>{lang === 'ar' ? 'تحذيرات' : 'Warnings'}</th></tr></thead>
            <tbody>{imports.map(i => <tr key={i.import_area}><td>{i.import_area}</td><td><span className={`status-pill ${signalClass(i.readiness_signal)}`}>{i.status}</span></td><td>{i.validation_percent}%</td><td>{i.rejected_rows}</td><td>{i.duplicate_warnings + i.missing_required_warnings}</td></tr>)}</tbody>
          </table>
        </section>
      )}

      {activeTab === 'issues' && (
        <section className="data-grid cards-grid">
          {issues.map((issue, index) => (
            <article className="panel-card" key={issue.id || index}>
              <div className="row-between"><h3>{issue.title}</h3><span className={`status-pill ${signalClass(issue.board_signal || issue.severity)}`}>{issue.severity}</span></div>
              <p className="muted">{issue.module_area || 'General'} · {issue.status}</p>
              <p>{issue.department_name_en || issue.wave_name || ''}</p>
            </article>
          ))}
        </section>
      )}

      {activeTab === 'path' && (
        <section className="panel-card">
          <h2>{t.shortestSafePath}</h2>
          <ol className="timeline-list">
            <li>{lang === 'ar' ? 'تطبيق جميع التصحيحات على نسخة موحدة واحدة.' : 'Apply all patches into one consolidated codebase.'}</li>
            <li>{lang === 'ar' ? 'تشغيل جميع الهجرات من 001 إلى 030 في مشروع Supabase جديد.' : 'Run migrations 001 to 030 in a fresh Supabase project.'}</li>
            <li>{lang === 'ar' ? 'استيراد الأقسام والوحدات والموظفين بعد فحص التكرارات.' : 'Import departments, units, and employees after duplicate checks.'}</li>
            <li>{lang === 'ar' ? 'تشغيل موجة تجريبية صغيرة مع 60 مستخدم تقريبا.' : 'Run a small pilot wave with about 60 users.'}</li>
            <li>{lang === 'ar' ? 'إغلاق جميع الملاحظات الحرجة قبل التعميم.' : 'Close all critical issues before rollout.'}</li>
          </ol>
        </section>
      )}
    </main>
  );
}
