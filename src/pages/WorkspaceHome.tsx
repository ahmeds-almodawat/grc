import type { ReactNode } from 'react';
import {
  ArrowRight,
  Bug,
  ClipboardList,
  FileCheck2,
  FolderKanban,
  Hospital,
  KeyRound,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  UserCheck,
  WandSparkles,
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
import { isScenarioLabEnabled } from '../lib/scenarioLab';

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
  const hasRole = (...roles: string[]) => auth.roles.some(assignment => roles.includes(assignment.role));
  const countLabel = (value: number | null | undefined) => (
    typeof value === 'number' ? String(value) : t('common.notConfigured')
  );

  const cards: ModuleCard[] = [
    {
      key: 'ovr',
      page: 'ovr',
      icon: <Hospital size={22} />,
      title: t('home.module.ovr'),
      description: t('home.module.ovr.desc'),
      metric: counts.data?.ovrReports,
      metricLabel: typeof counts.data?.openOvrReports === 'number'
        ? `${counts.data.openOvrReports} ${t('home.metric.open')}`
        : t('common.notConfigured'),
      tone: 'red',
    },
    ...(hasRole('employee', 'task_owner', 'milestone_owner', 'project_owner', 'department_manager', 'division_head') || isExternalPilot
      ? [{
          key: 'my-work',
          page: 'myWork' as PageKey,
          icon: <UserCheck size={22} />,
          title: t('home.module.myWork'),
          description: t('home.module.myWork.desc'),
          tone: 'blue' as const,
        }]
      : []),
    {
      key: 'risks',
      page: 'risks',
      icon: <ShieldAlert size={22} />,
      title: t('home.module.risks'),
      description: t('home.module.risks.desc'),
      metric: counts.data?.risks,
      metricLabel: t('home.metric.records'),
      tone: 'purple',
    },
    {
      key: 'controls',
      page: 'risks',
      icon: <SlidersHorizontal size={22} />,
      title: t('home.module.controls'),
      description: t('home.module.controls.desc'),
      metric: counts.data?.activeControls,
      metricLabel: t('home.metric.active'),
      tone: 'navy',
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
      key: 'reports',
      page: 'reportsHub',
      icon: <ClipboardList size={22} />,
      title: t('home.module.reports'),
      description: t('home.module.reports.desc'),
      tone: 'green',
    },
    ...(hasRole('auditor')
      ? [{
          key: 'audit',
          page: 'audit' as PageKey,
          icon: <ClipboardList size={22} />,
          title: t('home.module.audit'),
          description: t('home.module.audit.desc'),
          tone: 'amber' as const,
        }]
      : []),
    {
      key: 'control-pages',
      page: 'adminHub',
      icon: <KeyRound size={22} />,
      title: t('home.module.controlPages'),
      description: t('home.module.controlPages.desc'),
      metric: counts.data?.activeProfiles,
      metricLabel: t('home.metric.activeProfiles'),
      tone: 'amber',
    },
  ];

  const visibleCards = cards.filter(card => canOpen(card.page));
  const showScenarioLab = isScenarioLabEnabled
    && hasRole('super_admin', 'governance_admin')
    && canOpen('scenarioTestConsole');
  const showUatTools = isScenarioLabEnabled && canOpen('uatIssueCapture');
  const primaryPage: PageKey = canOpen('executiveHub') ? 'executiveHub' : canOpen('myWork') ? 'myWork' : 'ovr';

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

      {showUatTools ? (
        <div className="panel uat-tools-panel">
          <div>
            <p className="eyebrow">{t('nav.uatTools')}</p>
            <h3>{t('home.uat.title')}</h3>
            <p>{t('home.uat.desc')}</p>
          </div>
          <div className="uat-tools-panel__actions">
            <button className="secondary-action" type="button" onClick={() => setPage('uatIssueCapture')}>
              <Bug size={17} /> {t('nav.uatIssueCapture')}
            </button>
            {showScenarioLab ? (
              <button className="secondary-action" type="button" onClick={() => setPage('scenarioTestConsole')}>
                <WandSparkles size={17} /> {t('nav.scenarioLab')}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
