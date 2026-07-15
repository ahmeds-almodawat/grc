import { type FormEvent, useState } from 'react';
import { KeyRound, LogOut, ShieldCheck } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nContext';
import { changeRequiredPassword } from '../lib/userCredentialApi';

export function ForcedPasswordChange() {
  const auth = useAuth();
  const { language, direction } = useI18n();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isArabic = language === 'ar';

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError(isArabic ? 'جميع حقول كلمة المرور مطلوبة.' : 'All password fields are required.');
      return;
    }
    if (
      currentPassword !== currentPassword.trim()
      || newPassword !== newPassword.trim()
      || confirmPassword !== confirmPassword.trim()
    ) {
      setError(isArabic
        ? 'لا يمكن أن تبدأ حقول كلمة المرور أو تنتهي بمسافات.'
        : 'Password fields cannot begin or end with whitespace.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(isArabic ? 'تأكيد كلمة المرور الجديدة غير مطابق.' : 'New password confirmation does not match.');
      return;
    }
    if (newPassword === currentPassword) {
      setError(isArabic ? 'يجب أن تختلف كلمة المرور الجديدة عن الحالية.' : 'The new password must differ from the current password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await changeRequiredPassword({
        currentPassword,
        newPassword,
        confirmNewPassword: confirmPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setIsSubmitting(false);
      // The Edge workflow already requests global revocation. Clear the local
      // client even when Supabase reports that the server session is gone.
      await auth.signOut().catch(() => undefined);
    } catch (changeError) {
      setError(changeError instanceof Error
        ? changeError.message
        : (isArabic ? 'تعذر تغيير كلمة المرور.' : 'The password could not be changed.'));
      setIsSubmitting(false);
    }
  };

  return (
    <main className={`auth-screen ${direction === 'rtl' ? 'rtl-shell' : ''}`} dir={direction}>
      <section className="auth-card">
        <div className="auth-brand">
          <div className="brand-mark"><KeyRound size={22} /></div>
          <div>
            <p>{isArabic ? 'حماية بيانات الدخول' : 'Credential protection'}</p>
            <h1>{isArabic ? 'تغيير كلمة المرور مطلوب' : 'Password change required'}</h1>
          </div>
        </div>

        <div className="auth-warning">
          <ShieldCheck size={18} />
          <span>
            {auth.message ?? (isArabic
              ? 'غيّر كلمة المرور المؤقتة قبل الوصول إلى المنصة.'
              : 'Change the temporary password before accessing the application.')}
          </span>
        </div>

        {auth.session?.user.email ? <p className="muted">{auth.session.user.email}</p> : null}

        <form className="auth-form" onSubmit={submit}>
          <label>
            <span>{isArabic ? 'كلمة المرور الحالية' : 'Current password'}</span>
            <input
              autoComplete="current-password"
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
            />
          </label>
          <label>
            <span>{isArabic ? 'كلمة المرور الجديدة' : 'New password'}</span>
            <input
              autoComplete="new-password"
              type="password"
              maxLength={256}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
            />
          </label>
          <label>
            <span>{isArabic ? 'تأكيد كلمة المرور الجديدة' : 'Confirm new password'}</span>
            <input
              autoComplete="new-password"
              type="password"
              maxLength={256}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
          </label>

          {error ? <div className="auth-error" role="alert">{error}</div> : null}

          <button className="primary-action auth-submit" type="submit" disabled={isSubmitting}>
            <KeyRound size={17} />
            {isSubmitting
              ? (isArabic ? 'جاري التغيير...' : 'Changing password...')
              : (isArabic ? 'تغيير كلمة المرور' : 'Change password')}
          </button>
        </form>

        <button className="language-toggle auth-language" type="button" onClick={() => void auth.signOut()} disabled={isSubmitting}>
          <LogOut size={17} />
          {isArabic ? 'تسجيل الخروج' : 'Sign out'}
        </button>
      </section>
    </main>
  );
}
