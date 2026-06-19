import { useEffect, useMemo, useState } from 'react';
import { ModernShell } from '../components/ModernShell';
import { KpiTile, ModernCard, StatusPill } from '../components/ModernCard';
import { RiskHeatmap, RadarMiniChart } from '../components/ModernCharts';
import {
  buildHardeningKpis,
  fetchBackupHealthChecks,
  fetchWorkflowBlockers,
  supabase,
  type BackupHealthCheck,
  type DepartmentHeatmapRow,
  type RadarProfileRow,
  type WorkflowBlocker,
} from '../lib/hardeningApi';

const languageFromStorage = (): 'en' | 'ar' => (localStorage.getItem('grc-language') === 'ar' ? 'ar' : 'en');

export default function ModernExecutiveDashboard() {
  const [language, setLanguage] = useState<'en' | 'ar'>(languageFromStorage);
  const [health, setHealth] = useState<BackupHealthCheck[]>([]);
  const [blockers, setBlockers] = useState<WorkflowBlocker[]>([]);
  const [heatmap, setHeatmap] = useState<DepartmentHeatmapRow[]>([]);
  const [radar, setRadar] = useState<RadarProfileRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
    localStorage.setItem('grc-language', language);
  }, [language]);

  useEffect(() => {
    let active = true;
    async function load() {
      setIsLoading(true);
      const [healthRows, blockerRows] = await Promise.all([fetchBackupHealthChecks(), fetchWorkflowBlockers()]);

      let heatmapRows: DepartmentHeatmapRow[] = [];
      let radarRows: RadarProfileRow[] = [];
      if (supabase) {
        const [{ data: heatmapData }, { data: radarData }] = await Promise.all([
          supabase.from('v_department_risk_heatmap').select('*').limit(50),
          supabase.from('v_radar_control_profile').select('*').limit(12),
        ]);
        heatmapRows = heatmapData ?? [];
        radarRows = radarData ?? [];
      }

      if (!active) return;
      setHealth(healthRows);
      setBlockers(blockerRows);
      setHeatmap(heatmapRows);
      setRadar(radarRows);
      setIsLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const kpis = useMemo(() => buildHardeningKpis(health, blockers), [health, blockers]);
  const activeHealth = health.filter((row) => row.record_count > 0);
  const criticalHealth = activeHealth.filter((row) => row.severity === 'critical');

  return (
    <ModernShell
      eyebrow={language === 'ar' ? 'لوحة تنفيذية حديثة' : 'Modern executive cockpit'}
      title={language === 'ar' ? 'مركز التحكم التنفيذي' : 'Executive Control Center'}
      subtitle={
        language === 'ar'
          ? 'عرض موحد للمخاطر، عوائق التنفيذ، صحة النظام، والجاهزية التشغيلية.'
          : 'A unified view of risks, execution blockers, system health, and operational readiness.'
      }
      actions={
        <button className="btn btn--ghost" onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}>
          {language === 'ar' ? 'English' : 'العربية'}
        </button>
      }
    >
      <div className="kpi-grid kpi-grid--hero">
        {kpis.map((kpi) => (
          <KpiTile
            key={kpi.label_en}
            label={language === 'ar' ? kpi.label_ar : kpi.label_en}
            value={kpi.value}
            hint={language === 'ar' ? kpi.hint_ar : kpi.hint_en}
            tone={kpi.tone}
          />
        ))}
      </div>

      <div className="dashboard-grid">
        <ModernCard
          title={language === 'ar' ? 'الخريطة الحرارية لمخاطر الأقسام' : 'Department risk heatmap'}
          subtitle={language === 'ar' ? 'تجميع المخاطر والـ OVR والتأخير على مستوى الأقسام.' : 'Aggregates risk, OVR, and delay pressure by department.'}
        >
          {isLoading ? <div className="skeleton-block" /> : <RiskHeatmap rows={heatmap} language={language} />}
        </ModernCard>

        <ModernCard
          title={language === 'ar' ? 'رادار نضج الرقابة' : 'Control maturity radar'}
          subtitle={language === 'ar' ? 'عرض سريع لنضج الأدلة، الاعتمادات، المخاطر، OVR، الامتثال، والتدقيق.' : 'Quick view of maturity across evidence, approvals, risk, OVR, compliance, and audit.'}
        >
          {isLoading ? <div className="skeleton-block" /> : <RadarMiniChart rows={radar} language={language} />}
        </ModernCard>
      </div>

      <ModernCard
        title={language === 'ar' ? 'أهم التحذيرات الحرجة' : 'Top critical warnings'}
        subtitle={language === 'ar' ? 'هذه البنود يجب ألا تنتظر الاجتماع الشهري.' : 'These items should not wait for the monthly meeting.'}
        action={<StatusPill tone={criticalHealth.length ? 'danger' : 'good'}>{criticalHealth.length}</StatusPill>}
      >
        {criticalHealth.length ? (
          <div className="attention-list">
            {criticalHealth.map((row) => (
              <div className="attention-item" key={row.check_key}>
                <div>
                  <strong>{language === 'ar' ? row.title_ar : row.title_en}</strong>
                  <p>{language === 'ar' ? row.details_ar : row.details_en}</p>
                </div>
                <StatusPill tone="danger">{row.record_count}</StatusPill>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state empty-state--compact">
            <div className="empty-state__icon">✓</div>
            <h3>{language === 'ar' ? 'لا توجد تحذيرات حرجة' : 'No critical warnings'}</h3>
          </div>
        )}
      </ModernCard>
    </ModernShell>
  );
}
