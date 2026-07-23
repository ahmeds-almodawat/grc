import { LogOut, RotateCw, ShieldAlert } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nContext';

export function CredentialReconciliationRequired() {
  const auth = useAuth();
  const { direction } = useI18n();
  return (
    <main className={`auth-screen ${direction === 'rtl' ? 'rtl-shell' : ''}`} dir={direction}>
      <section className="auth-card">
        <div className="auth-brand">
          <div className="brand-mark"><ShieldAlert size={22} /></div>
          <div>
            <p>Credential protection</p>
            <h1>Reconciliation required</h1>
          </div>
        </div>
        <div className="auth-warning" role="alert">
          <ShieldAlert size={18} />
          <span>{auth.message ?? 'Credential reconciliation is required before application access. Contact a Super Admin.'}</span>
        </div>
        <p className="muted">No profile, role, navigation, dashboard, search, or application data has been opened.</p>
        <button className="primary-action auth-submit" type="button" onClick={() => void auth.reload()}>
          <RotateCw size={17} />
          Recheck credential state
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
