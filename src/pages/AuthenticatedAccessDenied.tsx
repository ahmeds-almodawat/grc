import { LogOut, RotateCw, ShieldAlert } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nContext';

export function AuthenticatedAccessDenied() {
  const auth = useAuth();
  const { direction } = useI18n();
  return (
    <main className={`auth-screen ${direction === 'rtl' ? 'rtl-shell' : ''}`} dir={direction}>
      <section className="auth-card">
        <div className="auth-brand">
          <div className="brand-mark"><ShieldAlert size={22} /></div>
          <div>
            <p>Authenticated session</p>
            <h1>Application access unavailable</h1>
          </div>
        </div>
        <div className="auth-warning" role="alert">
          <ShieldAlert size={18} />
          <span>{auth.message ?? 'This authenticated account is not permitted to open application data.'}</span>
        </div>
        <button className="primary-action auth-submit" type="button" onClick={() => void auth.reload()}>
          <RotateCw size={17} />
          Recheck access
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
