import type { ReactNode } from 'react';
import {
  ArrowRight,
  ClipboardList,
  FileCheck2,
  FolderKanban,
  Hospital,
  KeyRound,
  Landmark,
  Search,
  ShieldAlert,
  UserCheck,
} from 'lucide-react';
import type { PageKey } from '../components/Layout';
import { ControlledPilotBanner } from '../components/ControlledPilotBanner';
import { useI18n } from '../i18n/I18nContext';
import { useAuth } from '../auth/AuthProvider';
import {
  canAccessPageForUser,
  isExternalPilotOrganization,
} from '../auth/authAccess';
import { useAsyncData } from '../hooks/useAsyncData';
import { getPilotUiCounts } from '../lib/grcApi';
import { isPageVisibleOnSurface } from '../routes/pageSurfaceRegistry';

interface WorkspaceHomeProps {
  setPage: (page: PageKey) => void;
}

interface ModuleCard {
  key: string;
  page: PageKey;
  icon: ReactNode;
  title: string;
  description: string;
  metric?: number | null;
  metricLabel?: string;
  tone: 'navy' | 'red' | 'blue' | 'green' | 'amber' | 'purple';
}

export function WorkspaceHome({ setPage }: WorkspaceHomeProps) {
  const { t } = useI18n();
  const auth = useAuth();
  const counts = useAsyncData(getPilotUiCounts, []);
  const organizationName = auth.profile?.organizationName;
  const isExternalPilot = isExternalPilotOrganization(organizationName);
  const canOpen = (page: PageKey) => canAccessPageForUser(page, auth.roles, organizationName);
  const countLabel = (value: number | null | undefined) => (
    typeof value === 'number' ? String(value) : t('common.notConfigured')
  );

  const cards: ModuleCard[] = [
    {
      key: 'my-work',
      page: 'myWork',
      icon: <UserCheck size={22} />,
      title: t('home.module.myWork'),
      description: t('home.module.myWork.desc'),
      tone: 'blue',
    },
    {
      key: 'approvals',
      page: 'approvals',
      icon: <ClipboardList size={22} />,
      title: t('nav.approvals', 'Approvals'),
      description: t('hub.tab.approvals.desc', 'Pending decisions and approval trail'),
      tone: 'green',
    },
    {
      key: 'governance',
      page: 'grcHub',
      icon: <Landmark size={22} />,
      title: t('home.module.governance', 'Governance Hub'),
      description: t('home.module.governance.desc', 'Review governed documents, lifecycle health, decisions, and ownership.'),
      metric: counts.data?.risks,
      metricLabel: t('home.metric.records'),
      tone: 'navy',
    },
    {
      key: 'quality',
      page: 'qualityHub',
      icon: <Hospital size={22} />,
      title: t('nav.qualitySafety', 'Quality & Safety'),
      description: t('nav.qualitySafety.hint', 'OVR, quality, safety and risk'),
      metric: counts.data?.openOvrReports,
      metricLabel: t('home.metric.openOvr'),
      tone: 'red',
    },
    {
      key: 'accreditation',
      page: 'accreditationHub',
      icon: <ShieldAlert size={22} />,
      title: t('nav.accreditation', 'Accreditation'),
      description: t('nav.accreditation.hint', 'Survey readiness and standards'),
      tone: 'purple',
    },
    {
      key: 'projects',
      page: 'projects',
      icon: <FolderKanban size={22} />,
      title: t('home.module.projects'),
      description: t('home.module.projects.desc'),
      metric: counts.data?.projects,
      metricLabel: t('home.metric.records'),
      tone: 'blue',
    },
    {
      key: 'evidence',
      page: 'evidence',
      icon: <FileCheck2 size={22} />,
      title: t('home.module.evidence'),
      description: t('home.module.evidence.desc'),
      metric: counts.data?.evidenceItems,
      metricLabel: t('home.metric.items'),
      tone: 'green',
    },
    {
      key: 'reports',
      page: 'reportsHub',
      icon: <ClipboardList size={22} />,
      title: t('home.module.reports'),
      description: t('home.module.reports.desc'),
      tone: 'green',
    },
    {
      key: 'administration',
      page: 'adminHub',
      icon: <KeyRound size={22} />,
      title: t('nav.admin', 'Administration'),
      description: t('nav.admin.hint', 'Users, access, and organization setup'),
      metric: counts.data?.activeProfiles,
      metricLabel: t('home.metric.activeProfiles'),
      tone: 'amber',
    },
  ];

  const visibleCards = cards.filter(
    card => isPageVisibleOnSurface(card.page, 'home') && canOpen(card.page),
  );
  const primaryPage: PageKey = canOpen('myWork')
    ? 'myWork'
    : canOpen('reportsHub')
      ? 'reportsHub'
      : 'ovr';

  return (
    <section className="workspace-home">
      <ControlledPilotBanner />

      <div className="workspace-hero panel">
        <div className="workspace-hero__content">
          <div className="workspace-kicker"><ShieldAlert size={16} /> {t('home.kicker')}</div>
          <h3>{t('home.title')}</h3>
          <p>{isExternalPilot ? t('home.external.subtitle') : t('home.subtitle')}</p>
          <div className="workspace-hero__actions">
            <button className="primary-action" type="button" onClick={() => setPage(primaryPage)}>
              <ArrowRight size={17} /> {t('home.openRelevant')}
            </button>
            {canOpen('globalSearch') ? (
              <button className="secondary-action" type="button" onClick={() => setPage('globalSearch')}>
                <Search size={17} /> {t('home.openSearch')}
              </button>
            ) : null}
          </div>
        </div>
        <div className="workspace-hero__metrics" aria-label={t('home.liveScope')}>
          <div>
            <strong>{countLabel(counts.data?.activeProfiles)}</strong>
            <span>{t('home.metric.activeProfiles')}</span>
          </div>
          <div>
            <strong>{countLabel(counts.data?.activeDepartments)}</strong>
            <span>{t('home.metric.activeDepartments')}</span>
          </div>
          <div>
            <strong>{countLabel(counts.data?.openOvrReports)}</strong>
            <span>{t('home.metric.openOvr')}</span>
          </div>
        </div>
      </div>

      {isExternalPilot ? (
        <div className="notice-banner">
          <strong>{t('home.external.title')}</strong> {t('home.external.notice')}
        </div>
      ) : null}

      <div className="home-section-heading">
        <div>
          <p className="eyebrow">{t('home.modules.eyebrow')}</p>
          <h3>{t('home.modules.title')}</h3>
        </div>
        <span>{t('home.modules.hint')}</span>
      </div>

      <div className="workspace-grid">
        {visibleCards.map(card => (
          <button
            key={card.key}
            type="button"
            className={`workspace-card workspace-card--${card.tone}`}
            onClick={() => setPage(card.page)}
          >
            {card.metric !== undefined ? (
              <span className="workspace-card__metric">
                <strong>{countLabel(card.metric)}</strong>
                <small>{card.metricLabel}</small>
              </span>
            ) : null}
            <span className="workspace-card__icon">{card.icon}</span>
            <strong>{card.title}</strong>
            <small>{card.description}</small>
            <span className="workspace-card__footer">{t('home.openModule')} <ArrowRight size={15} /></span>
          </button>
        ))}
      </div>

    </section>
  );
}
