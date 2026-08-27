import { type FormEvent, useRef, useState } from 'react';
import { KeyRound, LogOut, ShieldCheck } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { PasswordRequirements } from '../auth/PasswordRequirements';
import { passwordPolicyError, passwordRequirementState } from '../auth/passwordPolicy';
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
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) return;
    setError(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError(isArabic ? 'جميع حقول كلمة المرور مطلوبة.' : 'All password fields are required.');
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
    const policyError = passwordPolicyError(newPassword);
    if (policyError) {
      setError(policyError);
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

          <PasswordRequirements password={newPassword} language={language} />

          {error ? <div className="auth-error" role="alert">{error}</div> : null}

          <button
            className="primary-action auth-submit"
            type="submit"
            disabled={isSubmitting || !passwordRequirementState(newPassword).valid}
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
