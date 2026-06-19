import { FormEvent, useState } from 'react';
import { Languages, LockKeyhole, ShieldAlert } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nContext';
import { isSupabaseConfigured } from '../lib/supabase';

export function LoginPage() {
  const { language, direction, toggleLanguage } = useI18n();
  const auth = useAuth();
  const [email, setEmail] = useState('');
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
    const result = await auth.signIn(email.trim(), password);
    setIsSubmitting(false);
    if (!result.ok) setError(result.message ?? 'Login failed.');
  };

  return (
    <main className={`auth-screen ${direction === 'rtl' ? 'rtl-shell' : ''}`} dir={direction}>
      <section className="auth-card">
        <div className="auth-brand">
          <div className="brand-mark">GRC</div>
          <div>
            <p>{isArabic ? 'مركز التحكم المؤسسي' : 'Governance Control Center'}</p>
            <h1>{title}</h1>
          </div>
        </div>

        <p className="auth-subtitle">{subtitle}</p>

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

        {auth.status === 'inactive' || auth.status === 'profile_missing' || auth.status === 'error' ? (
          <div className="auth-warning">
            <ShieldAlert size={18} />
            <span>{auth.message}</span>
          </div>
        ) : null}

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            <span>{isArabic ? 'البريد الإلكتروني' : 'Email'}</span>
            <input
              autoComplete="email"
              type="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              placeholder="name@company.com"
              required
            />
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

          <button className="primary-action auth-submit" type="submit" disabled={isSubmitting || !isSupabaseConfigured}>
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
