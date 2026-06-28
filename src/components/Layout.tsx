import type { ReactNode } from 'react';
import {
  Activity,
  Home,
  BellRing,
  BookCopy,
  Building2,
  Bug,
  ClipboardCheck,
  ClipboardList,
  Command,
  DatabaseBackup,
  FileCheck2,
  FileSearch,
  FileStack,
  FolderKanban,
  GanttChartSquare,
  Gauge,
  Hospital,
  KeyRound,
  Landmark,
  Languages,
  LogOut,
  LockKeyhole,
  Network,
  PackageCheck,
  Radar,
  Rocket,
  Search,
  ShieldAlert,
  Siren,
  Smartphone,
  TestTubeDiagonal,
  UploadCloud,
  UserCheck,
  Users,
  WandSparkles,
} from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import { useAuth } from '../auth/AuthProvider';
import { canAccessPageForUser, isExternalPilotOrganization } from '../auth/authAccess';
import { isScenarioLabEnabled } from '../lib/scenarioLab';
import { ControlledPilotBanner } from './ControlledPilotBanner';

export type PageKey =
  | 'home'
  | 'executiveHub'
  | 'workHub'
  | 'grcHub'
  | 'qualityHub'
  | 'reportsHub'
  | 'adminHub'
  | 'finishFast'
  | 'productionFinish'
  | 'releaseFactory'
  | 'productionProof'
  | 'dashboard'
  | 'analytics'
  | 'myWork'
  | 'projects'
  | 'departments'
  | 'risks'
  | 'compliance'
  | 'audit'
  | 'ovr'
  | 'ovrRisk'
  | 'governance'
  | 'escalations'
  | 'approvals'
  | 'evidence'
  | 'importExport'
  | 'accessControl'
  | 'setupCenter'
  | 'userGuide'
  | 'operations'
  | 'testing'
  | 'performance'
  | 'security'
  | 'commandCenter'
  | 'globalSearch'
  | 'documents'
  | 'relationships'
  | 'releaseCandidate'
  | 'productionRelease'
  | 'migrationVerifier'
  | 'restoreDryRun'
  | 'adminSafety'
  | 'bilingualDictionary'
  | 'boardPacks'
  | 'reportBuilder'
  | 'evidenceVault'
  | 'departmentScorecards'
  | 'backupScheduler'
  | 'scenarioPlanning'
  | 'mobileCommand'
  | 'automationIntelligence'
  | 'riskAppetiteKri'
  | 'smartReviews'
  | 'committeeAutomation'
  | 'stagingValidation'
  | 'rlsPersonaLab'
  | 'translationCoverage'
  | 'loadSeedCenter'
  | 'productionBackupStrategy'
  | 'migrationRunbook'
  | 'controlledUatWorkbench'
  | 'scenarioTestConsole'
  | 'uatIssueCapture'
  | 'admin';

interface LayoutProps {
  page: PageKey;
  setPage: (page: PageKey) => void;
  children: ReactNode;
}

interface NavItem {
  key: PageKey;
  labelKey: string;
  hintKey?: string;
  icon: ReactNode;
}

const primaryNav: NavItem[] = [
  { key: 'home', labelKey: 'nav.home', hintKey: 'nav.home.hint', icon: <Home size={18} /> },
  { key: 'executiveHub', labelKey: 'nav.executiveHub', hintKey: 'nav.executiveHub.hint', icon: <Command size={18} /> },
  { key: 'workHub', labelKey: 'nav.workHub', hintKey: 'nav.workHub.hint', icon: <GanttChartSquare size={18} /> },
  { key: 'grcHub', labelKey: 'nav.grcHub', hintKey: 'nav.grcHub.hint', icon: <ShieldAlert size={18} /> },
  { key: 'qualityHub', labelKey: 'nav.qualityHub', hintKey: 'nav.qualityHub.hint', icon: <Hospital size={18} /> },
  { key: 'reportsHub', labelKey: 'nav.reportsHub', hintKey: 'nav.reportsHub.hint', icon: <FolderKanban size={18} /> },
  { key: 'adminHub', labelKey: 'nav.adminHub', hintKey: 'nav.adminHub.hint', icon: <LockKeyhole size={18} /> },
];

const quickLinks: NavItem[] = [
  { key: 'myWork', labelKey: 'nav.myWork', icon: <UserCheck size={18} /> },
  { key: 'ovr', labelKey: 'nav.ovr', icon: <Hospital size={18} /> },
  { key: 'approvals', labelKey: 'nav.approvals', icon: <ClipboardCheck size={18} /> },
  { key: 'globalSearch', labelKey: 'nav.globalSearch', icon: <Search size={18} /> },
];

const uatLinks: NavItem[] = isScenarioLabEnabled
  ? [
      { key: 'controlledUatWorkbench', labelKey: 'nav.controlledUatWorkbench', icon: <ClipboardCheck size={18} /> },
      { key: 'uatIssueCapture', labelKey: 'nav.uatIssueCapture', icon: <Bug size={18} /> },
      { key: 'scenarioTestConsole', labelKey: 'nav.scenarioLab', icon: <WandSparkles size={18} /> },
    ]
  : [];

export const legacyNavItems: NavItem[] = [
  ...(isScenarioLabEnabled
    ? [
        { key: 'controlledUatWorkbench' as const, labelKey: 'nav.controlledUatWorkbench', icon: <ClipboardCheck size={18} /> },
        { key: 'uatIssueCapture' as const, labelKey: 'nav.uatIssueCapture', icon: <Bug size={18} /> },
        { key: 'scenarioTestConsole' as const, labelKey: 'nav.scenarioLab', icon: <WandSparkles size={18} /> },
      ]
    : []),
  { key: 'productionFinish', labelKey: 'nav.productionFinish', icon: <Rocket size={18} /> },
  { key: 'finishFast', labelKey: 'nav.finishFast', icon: <Rocket size={18} /> },
  { key: 'dashboard', labelKey: 'nav.dashboard', icon: <Activity size={18} /> },
  { key: 'analytics', labelKey: 'nav.analytics', icon: <Activity size={18} /> },
  { key: 'projects', labelKey: 'nav.projects', icon: <GanttChartSquare size={18} /> },
  { key: 'departments', labelKey: 'nav.departments', icon: <Building2 size={18} /> },
  { key: 'risks', labelKey: 'nav.risks', icon: <ShieldAlert size={18} /> },
  { key: 'compliance', labelKey: 'nav.compliance', icon: <ClipboardCheck size={18} /> },
  { key: 'audit', labelKey: 'nav.audit', icon: <FileSearch size={18} /> },
  { key: 'ovrRisk', labelKey: 'nav.ovrRisk', icon: <Radar size={18} /> },
  { key: 'governance', labelKey: 'nav.governance', icon: <Landmark size={18} /> },
  { key: 'escalations', labelKey: 'nav.escalations', icon: <Siren size={18} /> },
  { key: 'evidence', labelKey: 'nav.evidence', icon: <FileCheck2 size={18} /> },
  { key: 'importExport', labelKey: 'nav.importExport', icon: <UploadCloud size={18} /> },
  { key: 'accessControl', labelKey: 'nav.accessControl', icon: <KeyRound size={18} /> },
  { key: 'setupCenter', labelKey: 'nav.setupCenter', icon: <Rocket size={18} /> },
  { key: 'userGuide', labelKey: 'nav.userGuide', icon: <BookCopy size={18} /> },
  { key: 'operations', labelKey: 'nav.operations', icon: <BellRing size={18} /> },
  { key: 'testing', labelKey: 'nav.testing', icon: <ClipboardList size={18} /> },
  { key: 'performance', labelKey: 'nav.performance', icon: <Gauge size={18} /> },
  { key: 'security', labelKey: 'nav.security', icon: <LockKeyhole size={18} /> },
  { key: 'commandCenter', labelKey: 'nav.commandCenter', icon: <Command size={18} /> },
  { key: 'documents', labelKey: 'nav.documents', icon: <FolderKanban size={18} /> },
  { key: 'relationships', labelKey: 'nav.relationships', icon: <Network size={18} /> },
  { key: 'boardPacks', labelKey: 'nav.boardPacks', icon: <BookCopy size={18} /> },
  { key: 'mobileCommand', labelKey: 'nav.mobileCommand', icon: <Smartphone size={18} /> },
  { key: 'departmentScorecards', labelKey: 'nav.departmentScorecards', icon: <Radar size={18} /> },
  { key: 'reportBuilder', labelKey: 'nav.reportBuilder', icon: <BookCopy size={18} /> },
  { key: 'evidenceVault', labelKey: 'nav.evidenceVault', icon: <FileStack size={18} /> },
  { key: 'backupScheduler', labelKey: 'nav.backupScheduler', icon: <DatabaseBackup size={18} /> },
  { key: 'scenarioPlanning', labelKey: 'nav.scenarioPlanning', icon: <ShieldAlert size={18} /> },
  { key: 'automationIntelligence', labelKey: 'nav.automationIntelligence', icon: <Activity size={18} /> },
  { key: 'riskAppetiteKri', labelKey: 'nav.riskAppetiteKri', icon: <Gauge size={18} /> },
  { key: 'smartReviews', labelKey: 'nav.smartReviews', icon: <ClipboardList size={18} /> },
  { key: 'committeeAutomation', labelKey: 'nav.committeeAutomation', icon: <Landmark size={18} /> },
  { key: 'stagingValidation', labelKey: 'nav.stagingValidation', icon: <TestTubeDiagonal size={18} /> },
  { key: 'rlsPersonaLab', labelKey: 'nav.rlsPersonaLab', icon: <ClipboardCheck size={18} /> },
  { key: 'translationCoverage', labelKey: 'nav.translationCoverage', icon: <Languages size={18} /> },
  { key: 'loadSeedCenter', labelKey: 'nav.loadSeedCenter', icon: <FileSearch size={18} /> },
  { key: 'productionBackupStrategy', labelKey: 'nav.productionBackupStrategy', icon: <DatabaseBackup size={18} /> },
  { key: 'migrationRunbook', labelKey: 'nav.migrationRunbook', icon: <ClipboardList size={18} /> },
  { key: 'releaseCandidate', labelKey: 'nav.releaseCandidate', icon: <PackageCheck size={18} /> },
  { key: 'productionRelease', labelKey: 'nav.productionRelease', icon: <Rocket size={18} /> },
  { key: 'migrationVerifier', labelKey: 'nav.migrationVerifier', icon: <ClipboardList size={18} /> },
  { key: 'restoreDryRun', labelKey: 'nav.restoreDryRun', icon: <UploadCloud size={18} /> },
  { key: 'adminSafety', labelKey: 'nav.adminSafety', icon: <LockKeyhole size={18} /> },
  { key: 'bilingualDictionary', labelKey: 'nav.bilingualDictionary', icon: <Languages size={18} /> },
  { key: 'admin', labelKey: 'nav.admin', icon: <Users size={18} /> },
];

function NavButton({ item, page, setPage, showHint = false }: { item: NavItem; page: PageKey; setPage: (page: PageKey) => void; showHint?: boolean }) {
  const { t } = useI18n();
  return (
    <button
      key={item.key}
      className={`nav-item ${page === item.key ? 'active' : ''}`}
      onClick={() => setPage(item.key)}
      type="button"
    >
      {item.icon}
      <span>
        <strong>{t(item.labelKey)}</strong>
        {showHint && item.hintKey ? <small>{t(item.hintKey)}</small> : null}
      </span>
    </button>
  );
}

export function Layout({ page, setPage, children }: LayoutProps) {
  const { language, direction, toggleLanguage, t } = useI18n();
  const auth = useAuth();
  const organizationName = auth.profile?.organizationName;
  const canOpen = (targetPage: PageKey) => canAccessPageForUser(targetPage, auth.roles, organizationName);
  const allowedPrimaryNav = primaryNav.filter(item => canOpen(item.key));
  const allowedQuickLinks = quickLinks.filter(item => canOpen(item.key));
  const allowedUatLinks = uatLinks.filter(item => canOpen(item.key));
  const isLegacyPage = !allowedPrimaryNav.some(item => item.key === page)
    && !allowedQuickLinks.some(item => item.key === page)
    && !allowedUatLinks.some(item => item.key === page);
  const displayName = language === 'ar' && auth.profile?.fullNameAr ? auth.profile.fullNameAr : auth.profile?.fullNameEn;
  const externalPilot = isExternalPilotOrganization(organizationName);

  return (
    <div className={`app-shell modern-app-shell ${direction === 'rtl' ? 'rtl-shell' : ''}`} dir={direction}>
      <aside className="sidebar modern-sidebar">
        <div className="brand-block brand-block-modern">
          <div className="brand-mark">GRC</div>
          <div>
            <h1>{t('app.shortTitle')}</h1>
            <p>{t('app.tagline')}</p>
          </div>
        </div>

        <button className="language-toggle" onClick={toggleLanguage} title={t('language.current')} type="button">
          <Languages size={17} />
          <span>{language === 'en' ? t('language.switchToArabic') : t('language.switchToEnglish')}</span>
        </button>

        <nav className="nav-list nav-list-modern" aria-label={t('nav.primary')}>
          <div className="nav-section-label">{t('nav.primary')}</div>
          {allowedPrimaryNav.map(item => <NavButton key={item.key} item={item} page={page} setPage={setPage} showHint />)}

          <div className="nav-section-label">{t('nav.quickLinks')}</div>
          {allowedQuickLinks.map(item => <NavButton key={item.key} item={item} page={page} setPage={setPage} />)}

          {allowedUatLinks.length ? (
            <>
              <div className="nav-section-label">{t('nav.uatTools')}</div>
              {allowedUatLinks.map(item => <NavButton key={item.key} item={item} page={page} setPage={setPage} />)}
            </>
          ) : null}

          {externalPilot ? <div className="sidebar-footnote">{t('nav.externalPilotScope')}</div> : null}
          <div className="sidebar-footnote">{t('nav.sidebarHint')}</div>

          {isLegacyPage ? (
            <div className="legacy-active-banner">
              <span>{t('nav.legacyMode')}</span>
              <button type="button" onClick={() => setPage('executiveHub')}>{t('nav.backToHubs')}</button>
            </div>
          ) : null}
        </nav>
      </aside>

      <main className="main-content modern-main-content">
        <header className="topbar modern-topbar">
          <div>
            <p className="eyebrow">{t('app.company')}</p>
            <h2>{t('app.title')}</h2>
          </div>
          <div className="topbar-actions">
            <ControlledPilotBanner compact />
            {canOpen('globalSearch') ? (
              <button className="ghost-button" onClick={() => setPage('globalSearch')} type="button">
                <Search size={16} />
                {t('nav.globalSearch')}
              </button>
            ) : null}
            <button className="ghost-button" onClick={toggleLanguage} type="button">
              <Languages size={16} />
              {language === 'en' ? 'AR' : 'EN'}
            </button>
            <div className="auth-user-pill" title={auth.profile?.email}>
              <span>{displayName}</span>
              <small>{auth.primaryRole}</small>
            </div>
            {auth.isLocalBypass ? <div className="topbar-pill topbar-pill--warning">DEV AUTH</div> : null}
            <button className="ghost-button" onClick={() => void auth.signOut()} type="button">
              <LogOut size={16} />
              {language === 'ar' ? 'خروج' : 'Sign out'}
            </button>
            <div className="topbar-pill">{t('app.version')}</div>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
