import { type FormEvent, useCallback, useRef, useState } from 'react';
import { KeyRound, LogOut, ShieldCheck } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { TurnstileCaptcha } from '../auth/TurnstileLoginCaptcha';
import {
  authCaptchaConfig,
  getAuthCaptchaSubmissionError,
} from '../auth/loginCaptcha';
import { useI18n } from '../i18n/I18nContext';
import {
  changeRequiredPassword,
  passwordChangeFailureDisposition,
} from '../lib/userCredentialApi';

function createPasswordChangeRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `patch83u-password-change-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function ForcedPasswordChange() {
  const auth = useAuth();
  const { language, direction } = useI18n();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaError, setCaptchaError] = useState<string | null>(authCaptchaConfig.configurationError);
  const [captchaResetVersion, setCaptchaResetVersion] = useState(0);
  const requestIdRef = useRef<string | null>(null);
  const submittingRef = useRef(false);
  const isArabic = language === 'ar';

  const invalidateRequestId = () => {
    requestIdRef.current = null;
  };
  const updateCurrentPassword = (value: string) => {
    invalidateRequestId();
    setCurrentPassword(value);
  };
  const updateNewPassword = (value: string) => {
    invalidateRequestId();
    setNewPassword(value);
  };
  const updateConfirmPassword = (value: string) => {
    invalidateRequestId();
    setConfirmPassword(value);
  };
  const handleCaptchaToken = useCallback((token: string | null) => {
    setCaptchaToken(token);
    if (token) setCaptchaError(null);
  }, []);
  const handleCaptchaUnavailable = useCallback((message: string) => {
    setCaptchaToken(null);
    setCaptchaError(message);
  }, []);

  const resetCaptcha = () => {
    if (!authCaptchaConfig.required) return;
    setCaptchaToken(null);
    setCaptchaResetVersion((current) => current + 1);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) return;
    setError(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError(isArabic ? 'جميع حقول كلمة المرور مطلوبة.' : 'All password fields are required.');
      resetCaptcha();
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
      resetCaptcha();
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(isArabic ? 'تأكيد كلمة المرور الجديدة غير مطابق.' : 'New password confirmation does not match.');
      resetCaptcha();
      return;
    }
    if (newPassword === currentPassword) {
      setError(isArabic ? 'يجب أن تختلف كلمة المرور الجديدة عن الحالية.' : 'The new password must differ from the current password.');
      resetCaptcha();
      return;
    }
    const captchaSubmissionError = getAuthCaptchaSubmissionError(authCaptchaConfig, captchaToken);
    if (captchaSubmissionError) {
      setCaptchaError(captchaSubmissionError);
      resetCaptcha();
      return;
    }

    const requestId = requestIdRef.current ?? createPasswordChangeRequestId();
    requestIdRef.current = requestId;
    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      const result = await changeRequiredPassword({
        currentPassword,
        newPassword,
        confirmNewPassword: confirmPassword,
        captchaToken,
        requestId,
      }, {
        accessToken: auth.session?.access_token,
      });
      requestIdRef.current = null;
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      await auth.completeRequiredPasswordChange(result.status);
    } catch (changeError) {
      const failureDisposition = passwordChangeFailureDisposition(changeError);
      if (failureDisposition !== 'retry_in_current_session') {
        // The Edge request has reached the protected transition far enough that
        // global revocation was attempted; an unconfirmed response may also
        // include a committed password/version update. Never retain a stale
        // browser session or create a replacement grant from this screen.
        requestIdRef.current = null;
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        await auth.completeRequiredPasswordChange(
          failureDisposition === 'close_after_password_policy_rejection'
            ? 'password_policy_rejected_after_revocation'
            : 'unconfirmed',
        );
        return;
      }
      requestIdRef.current = null;
      setError(changeError instanceof Error
        ? changeError.message
        : (isArabic ? 'تعذر تغيير كلمة المرور.' : 'The password could not be changed.'));
      const code = typeof changeError === 'object' && changeError && 'code' in changeError
        ? String(changeError.code ?? '')
        : '';
      if (/RECONCILIATION|RECOVERY_REQUIRED/.test(code)) await auth.reload();
    } finally {
      resetCaptcha();
      submittingRef.current = false;
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
              maxLength={256}
              value={currentPassword}
              onChange={(event) => updateCurrentPassword(event.target.value)}
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
              onChange={(event) => updateNewPassword(event.target.value)}
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
              onChange={(event) => updateConfirmPassword(event.target.value)}
              required
            />
          </label>

          {authCaptchaConfig.required && authCaptchaConfig.siteKey && !authCaptchaConfig.configurationError ? (
            <TurnstileCaptcha
              siteKey={authCaptchaConfig.siteKey}
              language={language}
              resetVersion={captchaResetVersion}
              onToken={handleCaptchaToken}
              onUnavailable={handleCaptchaUnavailable}
              ariaLabel="Password change CAPTCHA challenge"
            />
          ) : null}

          {captchaError ? <div className="auth-error" role="alert">{captchaError}</div> : null}
          {error ? <div className="auth-error" role="alert">{error}</div> : null}

          <button
            className="primary-action auth-submit"
            type="submit"
            disabled={
              isSubmitting
              || Boolean(authCaptchaConfig.configurationError)
              || (authCaptchaConfig.required && !captchaToken)
            }
          >
            <KeyRound size={17} />
            {isSubmitting
              ? (isArabic ? 'جاري التغيير...' : 'Changing password...')
              : (isArabic ? 'تغيير كلمة المرور' : 'Change password')}
          </button>
        </form>

        <button
          className="language-toggle auth-language"
          type="button"
          onClick={() => void auth.signOut().catch(() => undefined)}
          disabled={isSubmitting}
        >
          <LogOut size={17} />
          {isArabic ? 'تسجيل الخروج' : 'Sign out'}
        </button>
      </section>
    </main>
  );
}
