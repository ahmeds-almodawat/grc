import { LockKeyhole, Home } from 'lucide-react';
import type { PageKey } from '../components/Layout';
import { useAuth } from '../auth/AuthProvider';
import { getPageGroup } from '../auth/authAccess';
import { useI18n } from '../i18n/I18nContext';

export function UnauthorizedPage({ page, setPage }: { page: PageKey; setPage: (page: PageKey) => void }) {
  const { t, language } = useI18n();
  const auth = useAuth();
  const isArabic = language === 'ar';

  return (
    <main className="modern-page">
      <section className="modern-hero unauthorized-hero">
        <div>
          <div className="modern-hero__eyebrow">
            <LockKeyhole size={16} /> {isArabic ? 'وصول غير مصرح' : 'Unauthorized access'}
          </div>
          <h1>{isArabic ? 'هذه الصفحة غير متاحة لدورك الحالي' : 'This page is not available for your current role'}</h1>
          <p>
            {isArabic
              ? `المجموعة المطلوبة: ${getPageGroup(page)}. الدور الحالي: ${auth.primaryRole ?? 'غير محدد'}.`
              : `Required group: ${getPageGroup(page)}. Current role: ${auth.primaryRole ?? 'none'}.`}
          </p>
        </div>
        <button className="primary-action" type="button" onClick={() => setPage('home')}>
          <Home size={17} /> {t('nav.home', 'Home')}
        </button>
      </section>
    </main>
  );
}
