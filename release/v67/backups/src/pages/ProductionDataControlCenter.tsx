import { isDemoDataEnabled, isProductionBuild } from '../lib/productionDataPolicy';
import { useI18n } from '../i18n/I18nContext';

export default function ProductionDataControlCenter() {
  const ctx = useI18n();
  const language = (ctx as any).language || (ctx as any).lang || 'en';
  const isArabic = language === 'ar';
  const cards = [
    {
      title: isArabic ? 'إزالة البيانات الوهمية' : 'No-mock remediation',
      body: isArabic ? 'تشغيل v60:remediate يمنع استخدام البيانات البديلة بشكل صامت في الإنتاج.' : 'Run v60:remediate to stop silent runtime fallback/demo data in production.'
    },
    {
      title: isArabic ? 'تدقيق الإنتاج' : 'Production audit',
      body: isArabic ? 'تشغيل v60:strict يجب أن يعطي صفر ملاحظات حرجة قبل التشغيل الفعلي.' : 'Run v60:strict and target zero critical/high runtime fake-data findings before go-live.'
    },
    {
      title: isArabic ? 'حالة البيئة' : 'Environment mode',
      body: isArabic
        ? `الإنتاج: ${isProductionBuild ? 'نعم' : 'لا'} — البيانات التجريبية: ${isDemoDataEnabled ? 'مفعّلة' : 'معطلة'}`
        : `Production build: ${isProductionBuild ? 'yes' : 'no'} — Demo data: ${isDemoDataEnabled ? 'enabled' : 'disabled'}`
    }
  ];
  return (
    <main className="page-shell">
      <section className="page-hero compact">
        <div>
          <span className="eyebrow">v6.0</span>
          <h1>{isArabic ? 'مركز التحكم في البيانات الفعلية' : 'Production Data Control Center'}</h1>
          <p>{isArabic ? 'منع ظهور بيانات تجريبية أو بديلة بشكل صامت في بيئة الإنتاج.' : 'Prevent silent mock, demo, sample, or fallback data from appearing in production.'}</p>
        </div>
      </section>
      <section className="grid three">
        {cards.map((card) => (
          <article className="card" key={card.title}>
            <h3>{card.title}</h3>
            <p>{card.body}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
