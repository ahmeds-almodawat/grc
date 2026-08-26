import { FormEvent, useState } from 'react';
import { Languages, LockKeyhole, ShieldAlert } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nContext';
import { isSupabaseConfigured } from '../lib/supabase';
import { BrandLogo } from '../components/BrandLogo';

const EMPLOYEE_ID_LOGIN_DOMAIN = 'almodawat.sa';

export function normalizeLoginIdentifier(identifier: string): string {
  const trimmed = identifier.trim();
  if (!trimmed) return '';
  return (trimmed.includes('@') ? trimmed : `${trimmed}@${EMPLOYEE_ID_LOGIN_DOMAIN}`).toLowerCase();
}

export function LoginPage() {
  const { language, direction, toggleLanguage } = useI18n();
  const auth = useAuth();
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isArabic = language === 'ar';
  const title = isArabic ? 'تسجيل الدخول' : 'Sign in';
  const subtitle = isArabic
    ? 'يجب تسجيل الدخول قبل الوصول إلى منصة الحوكمة والمخاطر والامتثال.'
    : 'Sign in before accessing the Governance, Risk and Compliance platform.';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await auth.signIn(normalizeLoginIdentifier(loginIdentifier), password);
      if (!result.ok) setError(result.message ?? 'Sign-in failed. Try again.');
    } catch {
      setError('Sign-in failed. Try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className={`auth-screen ${direction === 'rtl' ? 'rtl-shell' : ''}`} dir={direction}>
      <section className="auth-card">
        <div className="auth-brand auth-brand--acc">
          <BrandLogo variant="auth" />
          <h1>{title}</h1>
        </div>

        <p className="auth-subtitle">{subtitle}</p>

        {auth.notice ? <div className="auth-warning" role="status">{auth.notice}</div> : null}

        {!isSupabaseConfigured ? (
          <div className="auth-warning">
            <ShieldAlert size={18} />
            <span>
              {isArabic
                ? 'Supabase غير مهيأ. أضف VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY.'
                : 'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'}
            </span>
          </div>
        ) : null}

        {auth.status === 'configuration_error' || auth.status === 'error' ? (
          <div className="auth-warning">
            <ShieldAlert size={18} />
            <span>{auth.message}</span>
          </div>
        ) : null}

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            <span>{isArabic ? 'البريد الإلكتروني أو رقم الموظف' : 'Email or Employee ID'}</span>
            <input
              autoComplete="username"
              type="text"
              value={loginIdentifier}
              onChange={event => setLoginIdentifier(event.target.value)}
              placeholder={isArabic ? '12345 أو name@almodawat.sa' : '12345 or name@almodawat.sa'}
              required
            />
            <small className="muted">
              {isArabic ? 'استخدم رقم الموظف أو البريد الإلكتروني الكامل.' : 'Use your employee ID or full email address.'}
            </small>
          </label>
          <label>
            <span>{isArabic ? 'كلمة المرور' : 'Password'}</span>
            <input
              autoComplete="current-password"
              type="password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              required
            />
          </label>

          {error ? <div className="auth-error">{error}</div> : null}

          <button
            className="primary-action auth-submit"
            type="submit"
            disabled={
              isSubmitting
              || auth.status === 'authenticating'
              || !isSupabaseConfigured
            }
          >
            <LockKeyhole size={17} />
            {isSubmitting ? (isArabic ? 'جاري الدخول...' : 'Signing in...') : title}
          </button>
        </form>

        {auth.session ? (
          <button className="language-toggle auth-language" type="button" onClick={() => void auth.signOut()}>
            {isArabic ? 'تسجيل الخروج من هذه الجلسة' : 'Sign out of this session'}
          </button>
        ) : null}

        <button className="language-toggle auth-language" type="button" onClick={toggleLanguage}>
          <Languages size={17} />
          {language === 'en' ? 'العربية' : 'English'}
        </button>
      </section>
    </main>
  );
}
