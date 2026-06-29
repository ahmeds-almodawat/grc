import { useEffect, useMemo, useState } from 'react';
import { ModernShell } from '../components/ModernShell';
import { KpiTile, ModernCard, StatusPill } from '../components/ModernCard';
import { HealthSeverityTable, WorkflowBlockerTable } from '../components/HealthSeverityTable';
import {
  buildHardeningKpis,
  createHealthSnapshot,
  fetchBackupHealthChecks,
  fetchWorkflowBlockers,
  isLiveMode,
  type BackupHealthCheck,
  type WorkflowBlocker,
} from '../lib/hardeningApi';
import { exportRows, printRows } from '../lib/exportUtils';

const languageFromStorage = (): 'en' | 'ar' => {
  const saved = localStorage.getItem('grc-language');
  return saved === 'ar' ? 'ar' : 'en';
};

export default function BackupHealthCheck() {
  const [language, setLanguage] = useState<'en' | 'ar'>(languageFromStorage);
  const [health, setHealth] = useState<BackupHealthCheck[]>([]);
  const [blockers, setBlockers] = useState<WorkflowBlocker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
    localStorage.setItem('grc-language', language);
  }, [language]);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setIsLoading(true);
      const [healthRows, blockerRows] = await Promise.all([fetchBackupHealthChecks(), fetchWorkflowBlockers()]);
      if (!isMounted) return;
      setHealth(healthRows);
      setBlockers(blockerRows);
      setIsLoading(false);
    }
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const kpis = useMemo(() => buildHardeningKpis(health, blockers), [health, blockers]);
  const activeFindings = health.filter((row) => row.record_count > 0);
  const organizationId = health[0]?.organization_id ?? null;

  async function handleSnapshot() {
    try {
      if (!organizationId) {
        setMessage(
          language === 'ar'
            ? 'لا يمكن إنشاء لقطة صحة النظام بدون ربطها بمنظمة حقيقية.'
            : 'Cannot create a system health snapshot without a real organization context.'
        );
        return;
      }

      const id = await createHealthSnapshot(organizationId);
      setMessage(
        language === 'ar'
          ? id
            ? `تم إنشاء لقطة صحة النظام: ${id}`
            : 'لم يتم إنشاء لقطة صحة النظام.'
          : id
            ? `System health snapshot created: ${id}`
            : 'System health snapshot was not created.'
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  function handleExport() {
    exportRows('backup_health_check', health as unknown as Record<string, unknown>[], 'csv');
  }

  function handlePrint() {
    printRows(
      language === 'ar' ? 'فحص سلامة النسخ الاحتياطي' : 'Backup Health Check',
      health as unknown as Record<string, unknown>[],
      language === 'ar' ? 'rtl' : 'ltr'
    );
  }

  return (
    <ModernShell
      eyebrow={language === 'ar' ? 'جاهزية الإنتاج' : 'Production readiness'}
      title={language === 'ar' ? 'فحص سلامة النسخ الاحتياطي والنظام' : 'Backup Health Check & System Readiness'}
      subtitle={
        language === 'ar'
          ? 'تحقق من جودة البيانات قبل النسخ الاحتياطي أو الإطلاق الفعلي.'
          : 'Validate data quality before backups, external exports, or production rollout.'
      }
      actions={
        <div className="button-row">
          <button className="btn btn--ghost" onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}>
            {language === 'ar' ? 'English' : 'العربية'}
          </button>
          <button className="btn btn--secondary" onClick={handlePrint}>{language === 'ar' ? 'طباعة' : 'Print'}</button>
          <button className="btn btn--secondary" onClick={handleExport}>{language === 'ar' ? 'تصدير CSV' : 'Export CSV'}</button>
          <button className="btn btn--primary" onClick={handleSnapshot}>{language === 'ar' ? 'إنشاء لقطة' : 'Create snapshot'}</button>
        </div>
      }
    >
      {message && <div className="notice-banner">{message}</div>}

      <div className="kpi-grid">
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

      <div className="split-grid">
        <ModernCard
          title={language === 'ar' ? 'ملاحظات صحة النظام' : 'System health findings'}
          subtitle={language === 'ar' ? 'ملاحظات يجب إصلاحها قبل الاعتماد على النسخ الخارجية.' : 'Findings to fix before relying on external backups.'}
          action={<StatusPill tone={activeFindings.length ? 'warning' : 'good'}>{activeFindings.length}</StatusPill>}
        >
          {isLoading ? <div className="skeleton-block" /> : <HealthSeverityTable rows={health} language={language} />}
        </ModernCard>

        <ModernCard
          title={language === 'ar' ? 'عوائق سير العمل' : 'Workflow blockers'}
          subtitle={language === 'ar' ? 'بنود تمنع الإغلاق أو الاعتماد أو التنفيذ السليم.' : 'Items blocking closure, approval, or controlled execution.'}
          action={<StatusPill tone={blockers.length ? 'danger' : 'good'}>{blockers.length}</StatusPill>}
        >
          {isLoading ? <div className="skeleton-block" /> : <WorkflowBlockerTable rows={blockers} language={language} />}
        </ModernCard>
      </div>

      <ModernCard
        title={language === 'ar' ? 'ملاحظات مهمة' : 'Important notes'}
        subtitle={language === 'ar' ? 'هذه الصفحة لا تستبدل النسخ الاحتياطي الكامل من Supabase.' : 'This page does not replace full Supabase backup.'}
      >
        <div className="insight-list">
          <div>
            <strong>{language === 'ar' ? 'نسخ المتصفح' : 'Browser exports'}</strong>
            <p>{language === 'ar' ? 'مفيدة للتقارير والتحليل الخارجي، لكنها لا تشمل ملفات التخزين أو أسرار المصادقة.' : 'Useful for reporting and external analysis, but they do not include Storage binaries or auth secrets.'}</p>
          </div>
          <div>
            <strong>{language === 'ar' ? 'سلامة البيانات' : 'Data health'}</strong>
            <p>{language === 'ar' ? 'أصلح التحذيرات الحرجة قبل رفع المستخدمين أو الاعتماد على التقارير.' : 'Fix critical warnings before mass user import or depending on reports.'}</p>
          </div>
          <div>
            <strong>{language === 'ar' ? 'الوضع الحالي' : 'Current mode'}</strong>
            <p>{isLiveMode() ? (language === 'ar' ? 'متصل بـ Supabase.' : 'Connected to Supabase.') : (language === 'ar' ? 'بيانات تجريبية لأن Supabase غير مفعّل.' : 'Demo emptyRows because Supabase is not configured.')}</p>
          </div>
        </div>
      </ModernCard>
    </ModernShell>
  );
}
