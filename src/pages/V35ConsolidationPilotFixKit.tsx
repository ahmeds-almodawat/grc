import { useEffect, useMemo, useState } from 'react';
import {
  createV35Defect,
  exportV35ConsolidationPack,
  getV35OperatorConsole,
  getV35Scorecard,
  listV35Blockers,
  listV35DataQualityRadar,
  listV35Defects,
  listV35PatchManifest,
  listV35SopSteps,
  type V35Blocker,
  type V35DataQualityRadarRow,
  type V35Defect,
  type V35OperatorConsole,
  type V35PatchManifestRow,
  type V35Scorecard,
  type V35SopStep,
} from '../lib/v35ConsolidationApi';

const copy = {
  en: {
    title: 'v3.5 Consolidation & Pilot Fix Kit',
    subtitle: 'One control room to squash patches, defects, real-data repairs, SOP steps, and pilot blockers before go-live.',
    refresh: 'Refresh',
    export: 'Export pack',
    score: 'Readiness score',
    blockers: 'Active blockers',
    verified: 'Verified patches',
    defects: 'Open defects',
    repairs: 'Open data repairs',
    sop: 'SOP remaining',
    operator: 'Operator console',
    manifest: 'Patch manifest',
    defectsTab: 'Defect board',
    sopTab: 'Go-live SOP',
    dataQuality: 'Data quality radar',
    addDefect: 'Add defect',
    titleField: 'Title',
    descField: 'Description',
    severity: 'Severity',
    domain: 'Domain',
    save: 'Save',
    noRows: 'No rows found yet.',
    hardRule: 'Hard rule: do not pilot with critical blockers, failed RLS proof, failed OVR proof, or no backup/restore evidence.',
  },
  ar: {
    title: 'حزمة الدمج وإصلاح المرحلة التجريبية v3.5',
    subtitle: 'غرفة تحكم واحدة لدمج التصحيحات ومتابعة العيوب وإصلاح بيانات التشغيل وخطوات التشغيل التجريبي قبل الإطلاق.',
    refresh: 'تحديث',
    export: 'تصدير الحزمة',
    score: 'درجة الجاهزية',
    blockers: 'العوائق النشطة',
    verified: 'التصحيحات المتحققة',
    defects: 'العيوب المفتوحة',
    repairs: 'إصلاحات البيانات',
    sop: 'خطوات التشغيل المتبقية',
    operator: 'لوحة المشغل',
    manifest: 'سجل التصحيحات',
    defectsTab: 'لوحة العيوب',
    sopTab: 'إجراءات الإطلاق',
    dataQuality: 'رادار جودة البيانات',
    addDefect: 'إضافة عيب',
    titleField: 'العنوان',
    descField: 'الوصف',
    severity: 'الخطورة',
    domain: 'النطاق',
    save: 'حفظ',
    noRows: 'لا توجد بيانات بعد.',
    hardRule: 'قاعدة صارمة: لا تبدأ التشغيل التجريبي مع عوائق حرجة أو فشل اختبار الصلاحيات أو فشل مسار OVR أو غياب إثبات النسخ الاحتياطي والاستعادة.',
  },
};

function getLang() {
  if (typeof document !== 'undefined' && document.documentElement.dir === 'rtl') return 'ar';
  return 'en';
}

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function Gauge({ value }: { value: number }) {
  const score = Math.max(0, Math.min(100, Number(value || 0)));
  return (
    <div className="v35-gauge" style={{ background: `conic-gradient(var(--accent) ${score * 3.6}deg, rgba(148,163,184,.18) 0deg)` }}>
      <div className="v35-gauge-inner">
        <strong>{score}</strong>
        <span>/100</span>
      </div>
    </div>
  );
}

function StatCard({ label, value, tone = 'neutral' }: { label: string; value: string | number; tone?: 'neutral' | 'good' | 'warn' | 'bad' }) {
  return (
    <div className={`v35-stat v35-stat-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function V35ConsolidationPilotFixKit() {
  const lang = getLang();
  const t = copy[lang];
  const [activeTab, setActiveTab] = useState<'blockers' | 'manifest' | 'defects' | 'sop' | 'data'>('blockers');
  const [scorecard, setScorecard] = useState<V35Scorecard | null>(null);
  const [operator, setOperator] = useState<V35OperatorConsole | null>(null);
  const [blockers, setBlockers] = useState<V35Blocker[]>([]);
  const [manifest, setManifest] = useState<V35PatchManifestRow[]>([]);
  const [sop, setSop] = useState<V35SopStep[]>([]);
  const [defects, setDefects] = useState<V35Defect[]>([]);
  const [radar, setRadar] = useState<V35DataQualityRadarRow[]>([]);
  const [defectTitle, setDefectTitle] = useState('');
  const [defectDescription, setDefectDescription] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    const [nextScorecard, nextOperator, nextBlockers, nextManifest, nextSop, nextDefects, nextRadar] = await Promise.all([
      getV35Scorecard(),
      getV35OperatorConsole(),
      listV35Blockers(),
      listV35PatchManifest(),
      listV35SopSteps(),
      listV35Defects(),
      listV35DataQualityRadar(),
    ]);
    setScorecard(nextScorecard);
    setOperator(nextOperator);
    setBlockers(nextBlockers);
    setManifest(nextManifest);
    setSop(nextSop);
    setDefects(nextDefects);
    setRadar(nextRadar);
  }

  useEffect(() => {
    void load();
  }, []);

  const statusTone = useMemo(() => {
    const score = scorecard?.consolidation_readiness_score ?? 0;
    if (score >= 85) return 'good';
    if (score >= 65) return 'warn';
    return 'bad';
  }, [scorecard]);

  async function onExport() {
    const payload = await exportV35ConsolidationPack();
    downloadJson(`grc-v35-consolidation-pack-${new Date().toISOString().slice(0, 10)}.json`, payload);
  }

  async function onSaveDefect() {
    if (!defectTitle.trim()) return;
    setSaving(true);
    try {
      await createV35Defect({ title: defectTitle.trim(), description: defectDescription.trim() || undefined, severity: 'medium', domain: 'other' });
      setDefectTitle('');
      setDefectDescription('');
      await load();
      setActiveTab('defects');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="v35-page">
      <section className="v35-hero">
        <div>
          <p className="eyebrow">GRC Control Center · v3.5</p>
          <h1>{t.title}</h1>
          <p>{t.subtitle}</p>
          <div className="v35-actions">
            <button className="btn-secondary" onClick={() => void load()}>{t.refresh}</button>
            <button className="btn-primary" onClick={() => void onExport()}>{t.export}</button>
          </div>
        </div>
        <Gauge value={scorecard?.consolidation_readiness_score ?? 0} />
      </section>

      <section className="v35-warning">
        <strong>⚠</strong>
        <span>{t.hardRule}</span>
      </section>

      <section className="v35-stats-grid">
        <StatCard label={t.score} value={scorecard?.consolidation_readiness_score ?? '-'} tone={statusTone} />
        <StatCard label={t.blockers} value={operator?.active_blockers ?? blockers.length} tone={(operator?.active_blockers ?? blockers.length) > 0 ? 'bad' : 'good'} />
        <StatCard label={t.verified} value={`${scorecard?.patches_verified ?? 0}/${scorecard?.patches_registered ?? 0}`} tone="neutral" />
        <StatCard label={t.defects} value={scorecard?.open_defects ?? 0} tone={(scorecard?.critical_open_defects ?? 0) > 0 ? 'bad' : 'warn'} />
        <StatCard label={t.repairs} value={scorecard?.open_data_repairs ?? 0} tone="warn" />
        <StatCard label={t.sop} value={scorecard?.sop_steps_remaining ?? 0} tone={(scorecard?.sop_steps_remaining ?? 0) > 0 ? 'warn' : 'good'} />
      </section>

      <section className="v35-panel">
        <div className="v35-panel-head">
          <div>
            <p className="eyebrow">{t.operator}</p>
            <h2>{operator?.business_date ?? new Date().toISOString().slice(0, 10)}</h2>
          </div>
          <span className="v35-pill">Freeze windows: {operator?.active_freeze_windows ?? 0}</span>
          <span className="v35-pill">Operator logs: {operator?.today_operator_logs ?? 0}</span>
          <span className="v35-pill">Fix sprints: {operator?.active_fix_sprints ?? 0}</span>
        </div>
      </section>

      <section className="v35-tabs">
        {[
          ['blockers', t.blockers],
          ['manifest', t.manifest],
          ['defects', t.defectsTab],
          ['sop', t.sopTab],
          ['data', t.dataQuality],
        ].map(([key, label]) => (
          <button key={key} className={activeTab === key ? 'active' : ''} onClick={() => setActiveTab(key as typeof activeTab)}>{label}</button>
        ))}
      </section>

      {activeTab === 'blockers' && (
        <section className="v35-table-card">
          <table>
            <thead><tr><th>Area</th><th>Reference</th><th>Title</th><th>Status</th><th>Severity</th><th>Note</th></tr></thead>
            <tbody>{blockers.length ? blockers.map((row, index) => <tr key={`${row.reference}-${index}`}><td>{row.blocker_area}</td><td>{row.reference}</td><td>{row.title}</td><td>{row.status}</td><td><span className={`v35-sev ${row.severity}`}>{row.severity}</span></td><td>{row.note}</td></tr>) : <tr><td colSpan={6}>{t.noRows}</td></tr>}</tbody>
          </table>
        </section>
      )}

      {activeTab === 'manifest' && (
        <section className="v35-table-card">
          <table>
            <thead><tr><th>#</th><th>Version</th><th>Name</th><th>Migration</th><th>Required</th><th>Status</th></tr></thead>
            <tbody>{manifest.length ? manifest.map(row => <tr key={row.id}><td>{row.patch_order}</td><td>{row.patch_version}</td><td>{row.patch_name}</td><td>{row.expected_migration}</td><td>{row.required ? 'Yes' : 'No'}</td><td>{row.applied_status}</td></tr>) : <tr><td colSpan={6}>{t.noRows}</td></tr>}</tbody>
          </table>
        </section>
      )}

      {activeTab === 'defects' && (
        <section className="v35-split">
          <div className="v35-table-card">
            <table>
              <thead><tr><th>Code</th><th>Title</th><th>Domain</th><th>Severity</th><th>Status</th><th>Path</th></tr></thead>
              <tbody>{defects.length ? defects.map(row => <tr key={row.id}><td>{row.defect_code}</td><td>{row.title}</td><td>{row.domain}</td><td><span className={`v35-sev ${row.severity}`}>{row.severity}</span></td><td>{row.status}</td><td>{row.affected_path}</td></tr>) : <tr><td colSpan={6}>{t.noRows}</td></tr>}</tbody>
            </table>
          </div>
          <aside className="v35-form-card">
            <h3>{t.addDefect}</h3>
            <label>{t.titleField}<input value={defectTitle} onChange={event => setDefectTitle(event.target.value)} /></label>
            <label>{t.descField}<textarea value={defectDescription} onChange={event => setDefectDescription(event.target.value)} /></label>
            <button className="btn-primary" disabled={saving || !defectTitle.trim()} onClick={() => void onSaveDefect()}>{t.save}</button>
          </aside>
        </section>
      )}

      {activeTab === 'sop' && (
        <section className="v35-table-card">
          <table>
            <thead><tr><th>#</th><th>Group</th><th>Step</th><th>Owner</th><th>Evidence</th><th>Status</th></tr></thead>
            <tbody>{sop.length ? sop.map(row => <tr key={row.id}><td>{row.step_order}</td><td>{row.step_group}</td><td><strong>{row.step_title}</strong><br /><small>{row.step_description}</small></td><td>{row.owner_role}</td><td>{row.evidence_required ? 'Required' : 'No'}</td><td>{row.status}</td></tr>) : <tr><td colSpan={6}>{t.noRows}</td></tr>}</tbody>
          </table>
        </section>
      )}

      {activeTab === 'data' && (
        <section className="v35-radar-grid">
          {radar.length ? radar.map(row => (
            <article className="v35-radar-card" key={row.source_area}>
              <div>
                <p>{row.source_area}</p>
                <strong>{row.closure_percent}%</strong>
              </div>
              <div className="v35-progress"><span style={{ width: `${Math.max(0, Math.min(100, row.closure_percent))}%` }} /></div>
              <small>{row.open_issues} open · {row.high_issues} high · {row.total_issues} total</small>
            </article>
          )) : <div className="v35-empty">{t.noRows}</div>}
        </section>
      )}
    </main>
  );
}
