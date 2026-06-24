import { isDemoDataEnabled } from '../lib/productionDataPolicy';

type Props = {
  title?: string;
  message?: string;
  arTitle?: string;
  arMessage?: string;
  language?: 'en' | 'ar';
  context?: string;
};

export default function LiveDataState({ title, message, arTitle, arMessage, language = 'en', context = 'this section' }: Props) {
  const isArabic = language === 'ar';
  const resolvedTitle = isArabic ? (arTitle || 'لا توجد بيانات فعلية') : (title || 'No live data available');
  const resolvedMessage = isArabic
    ? (arMessage || `لا توجد بيانات فعلية متاحة لـ ${context}. تحقق من اتصال Supabase أو الصلاحيات أو استيراد البيانات.`)
    : (message || `No live data is available for ${context}. Check Supabase, RLS policies, or imported records.`);

  return (
    <div className="live-data-state" role="status">
      <div className="live-data-state__icon">◎</div>
      <div>
        <h3>{resolvedTitle}</h3>
        <p>{resolvedMessage}</p>
        {isDemoDataEnabled && (
          <strong>{isArabic ? 'وضع بيانات الاختبار الاصطناعية مفعّل لبيئة غير إنتاجية.' : 'Synthetic test-data mode is enabled for a non-production environment.'}</strong>
        )}
      </div>
    </div>
  );
}
