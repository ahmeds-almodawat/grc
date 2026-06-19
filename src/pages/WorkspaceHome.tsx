import type { ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  BookOpenCheck,
  Building2,
  ClipboardCheck,
  Command,
  DatabaseBackup,
  FileText,
  FolderKanban,
  Gauge,
  Hospital,
  LockKeyhole,
  Network,
  Rocket,
  Search,
  ShieldAlert,
  Sparkles,
  Users,
} from 'lucide-react';
import type { PageKey } from '../components/Layout';
import { useI18n } from '../i18n/I18nContext';
import { useAuth } from '../auth/AuthProvider';
import { canAccessPage } from '../auth/authAccess';

interface WorkspaceHomeProps {
  setPage: (page: PageKey) => void;
}

interface WorkspaceCard {
  page: PageKey;
  icon: ReactNode;
  titleKey: string;
  descKey: string;
  badgeKey: string;
  tone: 'navy' | 'red' | 'blue' | 'green' | 'amber' | 'purple';
}

const workspaces: WorkspaceCard[] = [
  {
    page: 'executiveHub',
    icon: <Command size={22} />,
    titleKey: 'home.card.executive.title',
    descKey: 'home.card.executive.desc',
    badgeKey: 'home.badge.daily',
    tone: 'navy',
  },
  {
    page: 'workHub',
    icon: <FolderKanban size={22} />,
    titleKey: 'home.card.work.title',
    descKey: 'home.card.work.desc',
    badgeKey: 'home.badge.execution',
    tone: 'blue',
  },
  {
    page: 'grcHub',
    icon: <ShieldAlert size={22} />,
    titleKey: 'home.card.grc.title',
    descKey: 'home.card.grc.desc',
    badgeKey: 'home.badge.assurance',
    tone: 'purple',
  },
  {
    page: 'qualityHub',
    icon: <Hospital size={22} />,
    titleKey: 'home.card.quality.title',
    descKey: 'home.card.quality.desc',
    badgeKey: 'home.badge.safety',
    tone: 'red',
  },
  {
    page: 'reportsHub',
    icon: <FileText size={22} />,
    titleKey: 'home.card.reports.title',
    descKey: 'home.card.reports.desc',
    badgeKey: 'home.badge.reporting',
    tone: 'green',
  },
  {
    page: 'adminHub',
    icon: <LockKeyhole size={22} />,
    titleKey: 'home.card.admin.title',
    descKey: 'home.card.admin.desc',
    badgeKey: 'home.badge.control',
    tone: 'amber',
  },
];

const dailyControls = [
  { icon: <Rocket size={18} />, titleKey: 'home.control.production.title', descKey: 'home.control.production.desc', page: 'productionFinish' as PageKey },
  { icon: <AlertTriangle size={18} />, titleKey: 'home.control.critical.title', descKey: 'home.control.critical.desc', page: 'executiveHub' as PageKey },
  { icon: <ClipboardCheck size={18} />, titleKey: 'home.control.approvals.title', descKey: 'home.control.approvals.desc', page: 'approvals' as PageKey },
  { icon: <Hospital size={18} />, titleKey: 'home.control.ovr.title', descKey: 'home.control.ovr.desc', page: 'ovr' as PageKey },
  { icon: <DatabaseBackup size={18} />, titleKey: 'home.control.backup.title', descKey: 'home.control.backup.desc', page: 'reportsHub' as PageKey },
];

const quickActions = [
  { icon: <Rocket size={16} />, labelKey: 'home.quick.production', page: 'productionFinish' as PageKey },
  { icon: <Search size={16} />, labelKey: 'home.quick.search', page: 'globalSearch' as PageKey },
  { icon: <BellRing size={16} />, labelKey: 'home.quick.followup', page: 'operations' as PageKey },
  { icon: <Gauge size={16} />, labelKey: 'home.quick.analytics', page: 'analytics' as PageKey },
  { icon: <Rocket size={16} />, labelKey: 'home.quick.release', page: 'adminHub' as PageKey },
];

export function WorkspaceHome({ setPage }: WorkspaceHomeProps) {
  const { t } = useI18n();
  const auth = useAuth();
  const visibleWorkspaces = workspaces.filter(card => canAccessPage(card.page, auth.roles));
  const visibleDailyControls = dailyControls.filter(item => canAccessPage(item.page, auth.roles));
  const visibleQuickActions = quickActions.filter(action => canAccessPage(action.page, auth.roles));

  return (
    <section className="workspace-home">
      <div className="workspace-hero panel">
        <div className="workspace-hero__content">
          <div className="workspace-kicker"><Sparkles size={16} /> {t('home.kicker')}</div>
          <h3>{t('home.title')}</h3>
          <p>{t('home.subtitle')}</p>
          <div className="workspace-hero__actions">
            <button className="primary-action" type="button" onClick={() => setPage(canAccessPage('executiveHub', auth.roles) ? 'executiveHub' : 'myWork')}>
              <Command size={17} /> {t('home.openCommand')}
            </button>
            <button className="secondary-action" type="button" onClick={() => setPage('globalSearch')}>
              <Search size={17} /> {t('home.openSearch')}
            </button>
          </div>
        </div>
        <div className="workspace-hero__metrics" aria-label={t('home.controlStrip')}>
          <div><strong>6</strong><span>{t('home.metric.workspaces')}</span></div>
          <div><strong>50</strong><span>{t('home.metric.departments')}</span></div>
          <div><strong>1K</strong><span>{t('home.metric.employees')}</span></div>
        </div>
      </div>

      <div className="home-section-heading">
        <div>
          <p className="eyebrow">{t('home.workspaces.eyebrow')}</p>
          <h3>{t('home.workspaces.title')}</h3>
        </div>
        <span>{t('home.workspaces.hint')}</span>
      </div>

      <div className="workspace-grid">
        {visibleWorkspaces.map(card => (
          <button key={card.page} type="button" className={`workspace-card workspace-card--${card.tone}`} onClick={() => setPage(card.page)}>
            <span className="workspace-card__badge">{t(card.badgeKey)}</span>
            <span className="workspace-card__icon">{card.icon}</span>
            <strong>{t(card.titleKey)}</strong>
            <small>{t(card.descKey)}</small>
            <span className="workspace-card__footer">{t('home.openWorkspace')} <ArrowRight size={15} /></span>
          </button>
        ))}
      </div>

      <div className="control-grid">
        <div className="panel control-panel-wide">
          <div className="home-section-heading home-section-heading--compact">
            <div>
              <p className="eyebrow">{t('home.daily.eyebrow')}</p>
              <h3>{t('home.daily.title')}</h3>
            </div>
          </div>
          <div className="daily-control-list">
            {visibleDailyControls.map(item => (
              <button key={item.titleKey} type="button" onClick={() => setPage(item.page)} className="daily-control-row">
                <span>{item.icon}</span>
                <span><strong>{t(item.titleKey)}</strong><small>{t(item.descKey)}</small></span>
                <ArrowRight size={16} />
              </button>
            ))}
          </div>
        </div>

        <div className="panel quick-action-panel">
          <p className="eyebrow">{t('home.quick.eyebrow')}</p>
          <h3>{t('home.quick.title')}</h3>
          <div className="quick-action-stack">
            {visibleQuickActions.map(action => (
              <button key={action.labelKey} type="button" onClick={() => setPage(action.page)}>
                {action.icon}<span>{t(action.labelKey)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="panel home-principles">
        <div>
          <p className="eyebrow">{t('home.rules.eyebrow')}</p>
          <h3>{t('home.rules.title')}</h3>
        </div>
        <div className="principle-grid">
          <span><BookOpenCheck size={16} /> {t('home.rule.evidence')}</span>
          <span><Network size={16} /> {t('home.rule.traceability')}</span>
          <span><Users size={16} /> {t('home.rule.ownership')}</span>
          <span><Building2 size={16} /> {t('home.rule.scope')}</span>
        </div>
      </div>
    </section>
  );
}
