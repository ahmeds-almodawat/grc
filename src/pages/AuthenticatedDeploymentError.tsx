import { useEffect, useState } from 'react';
import { LogOut, RefreshCw, RotateCw, ShieldAlert } from 'lucide-react';
import {
  PATCH83U_COMPATIBILITY_RETRY_LIMIT,
  PATCH83U_DEPLOYMENT_ERROR_MESSAGE,
  useAuth,
} from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nContext';

export function AuthenticatedDeploymentError() {
  const auth = useAuth();
  const { direction } = useI18n();
  const [now, setNow] = useState(Date.now());
  const retryAt = auth.compatibilityRetryAvailableAt ?? 0;
  const retryCount = auth.compatibilityRetryCount ?? 0;
  const cooldownSeconds = Math.max(0, Math.ceil((retryAt - now) / 1_000));
  const retryExhausted = retryCount >= PATCH83U_COMPATIBILITY_RETRY_LIMIT;

  useEffect(() => {
    if (retryAt <= Date.now()) return undefined;
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [retryAt]);

  return (
    <main className={`auth-screen ${direction === 'rtl' ? 'rtl-shell' : ''}`} dir={direction}>
      <section className="auth-card">
        <div className="auth-brand">
          <div className="brand-mark"><ShieldAlert size={22} /></div>
          <div>
            <p>Credential governance</p>
            <h1>Deployment compatibility required</h1>
          </div>
        </div>

        <div className="auth-warning" role="alert">
          <ShieldAlert size={18} />
          <span>{PATCH83U_DEPLOYMENT_ERROR_MESSAGE}</span>
        </div>

        <p className="muted" aria-live="polite">
          {retryExhausted
            ? 'The bounded retry limit was reached. Use Hard refresh after the deployment is corrected.'
            : cooldownSeconds > 0
              ? `Retry is available in ${cooldownSeconds} second${cooldownSeconds === 1 ? '' : 's'}.`
              : `Compatibility retry ${retryCount + 1} of ${PATCH83U_COMPATIBILITY_RETRY_LIMIT} is available.`}
        </p>

        <button
          className="primary-action auth-submit"
          type="button"
          disabled={retryExhausted || cooldownSeconds > 0}
          onClick={() => void auth.retryCompatibility()}
        >
          <RotateCw size={17} />
          Retry compatibility check
        </button>
        <button className="language-toggle auth-language" type="button" onClick={() => window.location.reload()}>
          <RefreshCw size={17} />
          Hard refresh
        </button>
        <button
          className="language-toggle auth-language"
          type="button"
          onClick={() => void auth.signOut().catch(() => undefined)}
        >
          <LogOut size={17} />
          Sign out
        </button>
      </section>
    </main>
  );
}
