import { useEffect, useState } from 'react';
import {
  Activity,
  ArchiveRestore,
  BarChart3,
  BellRing,
  BookCopy,
  BrainCircuit,
  Building2,
  Bug,
  CalendarClock,
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
import { Layout, type PageKey } from './components/Layout';
import { useAuth } from './auth/AuthProvider';
import { canAccessPageForUser, firstAllowedPage } from './auth/authAccess';
import { LoginPage } from './pages/LoginPage';
import { UnauthorizedPage } from './pages/UnauthorizedPage';
import { TabbedHub } from './components/TabbedHub';
import { useI18n } from './i18n/I18nContext';
import { WorkspaceHome } from './pages/WorkspaceHome';
import { FinalSprintCenter } from './pages/FinalSprintCenter';
import { ProductionFinishCenter } from './pages/ProductionFinishCenter';
import { ReleaseFactoryCenter } from './pages/ReleaseFactoryCenter';
import { ProductionProofCenter } from './pages/ProductionProofCenter';
import { Dashboard } from './pages/Dashboard';
import { Analytics } from './pages/Analytics';
import { Projects } from './pages/Projects';
import { Departments } from './pages/Departments';
import { Risks } from './pages/Risks';
import { Compliance } from './pages/Compliance';
import { Audit } from './pages/Audit';
import { OVR } from './pages/OVR';
import { OvrRiskIndicators } from './pages/OvrRiskIndicators';
import { Governance } from './pages/Governance';
import { Admin } from './pages/Admin';
import { MyWork } from './pages/MyWork';
import { Approvals } from './pages/Approvals';
import { Evidence } from './pages/Evidence';
import { Escalations } from './pages/Escalations';
import { ImportExport } from './pages/ImportExport';
import { AccessControl } from './pages/AccessControl';
import { SetupCenter } from './pages/SetupCenter';
import { UserGuide } from './pages/UserGuide';
import { OperationsCenter } from './pages/OperationsCenter';
import { TestingCenter } from './pages/TestingCenter';
import { PerformanceCenter } from './pages/PerformanceCenter';
import { SecurityAuditCenter } from './pages/SecurityAuditCenter';
import { ExecutiveCommandCenter } from './pages/ExecutiveCommandCenter';
import { GlobalSearch } from './pages/GlobalSearch';
import { PolicyDocumentCenter } from './pages/PolicyDocumentCenter';
import { RelationshipMap } from './pages/RelationshipMap';
import { ReleaseCandidateCenter } from './pages/ReleaseCandidateCenter';
import { ProductionReleaseCenter } from './pages/ProductionReleaseCenter';
import { MigrationVerifierCenter } from './pages/MigrationVerifierCenter';
import { RestoreDryRunCenter } from './pages/RestoreDryRunCenter';
import { AdminSafetyConsole } from './pages/AdminSafetyConsole';
import { BilingualDictionaryCenter } from './pages/BilingualDictionaryCenter';
import { BoardPackCenter } from './pages/BoardPackCenter';
import { AdvancedReportBuilder } from './pages/AdvancedReportBuilder';
import { EvidenceVault } from './pages/EvidenceVault';
import { DepartmentScorecards } from './pages/DepartmentScorecards';
import { BackupSchedulerCenter } from './pages/BackupSchedulerCenter';
import { ScenarioPlanningCenter } from './pages/ScenarioPlanningCenter';
import { ExecutiveMobileCommand } from './pages/ExecutiveMobileCommand';
import { AutomationIntelligenceCenter } from './pages/AutomationIntelligenceCenter';
import { RiskAppetiteKriCenter } from './pages/RiskAppetiteKriCenter';
import { SmartReviewCalendar } from './pages/SmartReviewCalendar';
import { CommitteeActionAutomationCenter } from './pages/CommitteeActionAutomationCenter';
import { StagingValidationCenter } from './pages/StagingValidationCenter';
import { RlsPersonaLab } from './pages/RlsPersonaLab';
import { TranslationCoverageCenter } from './pages/TranslationCoverageCenter';
import { LoadSeedCenter } from './pages/LoadSeedCenter';
import { ProductionBackupStrategyCenter } from './pages/ProductionBackupStrategyCenter';
import { MigrationRunbookCenter } from './pages/MigrationRunbookCenter';
import BackupHealthCheck from './pages/BackupHealthCheck';
import CustomReports from './pages/CustomReports';
import { ScenarioTestConsole } from './pages/ScenarioTestConsole';
import { UatIssueCapture } from './pages/UatIssueCapture';
import { ControlledUatWorkbench } from './pages/ControlledUatWorkbench';
import { isScenarioLabEnabled } from './lib/scenarioLab';

function ExecutiveHub() {
  const { t } = useI18n();
  return (
    <TabbedHub
      eyebrow={t('hub.executive.eyebrow')}
      title={t('hub.executive.title')}
      subtitle={t('hub.executive.subtitle')}
      tabs={[
        { id: 'command', label: t('hub.tab.command'), description: t('hub.tab.command.desc'), icon: <Command size={17} />, content: <ExecutiveCommandCenter /> },
        { id: 'dashboard', label: t('hub.tab.dashboard'), description: t('hub.tab.dashboard.desc'), icon: <BarChart3 size={17} />, content: <Dashboard /> },
        { id: 'analytics', label: t('hub.tab.analytics'), description: t('hub.tab.analytics.desc'), icon: <Activity size={17} />, content: <Analytics /> },
        { id: 'board', label: t('hub.tab.board'), description: t('hub.tab.board.desc'), icon: <BookCopy size={17} />, content: <BoardPackCenter /> },
        { id: 'mobile', label: t('hub.tab.mobile'), description: t('hub.tab.mobile.desc'), icon: <Smartphone size={17} />, content: <ExecutiveMobileCommand /> },
        { id: 'scenario', label: t('hub.tab.scenario'), description: t('hub.tab.scenario.desc'), icon: <Radar size={17} />, content: <ScenarioPlanningCenter /> },
      ]}
    />
  );
}

function WorkExecutionHub() {
  const { t } = useI18n();
  return (
    <TabbedHub
      eyebrow={t('hub.work.eyebrow')}
      title={t('hub.work.title')}
      subtitle={t('hub.work.subtitle')}
      tabs={[
        { id: 'my', label: t('hub.tab.myWork'), description: t('hub.tab.myWork.desc'), icon: <UserCheck size={17} />, content: <MyWork /> },
        { id: 'projects', label: t('hub.tab.projects'), description: t('hub.tab.projects.desc'), icon: <GanttChartSquare size={17} />, content: <Projects /> },
        { id: 'departments', label: t('hub.tab.departments'), description: t('hub.tab.departments.desc'), icon: <Building2 size={17} />, content: <Departments /> },
        { id: 'operations', label: t('hub.tab.operations'), description: t('hub.tab.operations.desc'), icon: <BellRing size={17} />, content: <OperationsCenter /> },
        { id: 'escalations', label: t('hub.tab.escalations'), description: t('hub.tab.escalations.desc'), icon: <Siren size={17} />, content: <Escalations /> },
        { id: 'approvals', label: t('hub.tab.approvals'), description: t('hub.tab.approvals.desc'), icon: <ClipboardCheck size={17} />, content: <Approvals /> },
        { id: 'evidence', label: t('hub.tab.evidence'), description: t('hub.tab.evidence.desc'), icon: <FileCheck2 size={17} />, content: <Evidence /> },
      ]}
    />
  );
}

function GrcHub() {
  const { t } = useI18n();
  const auth = useAuth();
  const auditorReadOnly = auth.roles.some(role => role.role === 'auditor')
    && !auth.roles.some(role => role.role === 'super_admin' || role.role === 'governance_admin');
  const tabs = [
    { id: 'risks', label: t('hub.tab.risks'), description: t('hub.tab.risks.desc'), icon: <ShieldAlert size={17} />, content: <Risks /> },
    { id: 'kri', label: t('hub.tab.kri'), description: t('hub.tab.kri.desc'), icon: <Gauge size={17} />, content: <RiskAppetiteKriCenter /> },
    { id: 'compliance', label: t('hub.tab.compliance'), description: t('hub.tab.compliance.desc'), icon: <ClipboardCheck size={17} />, content: <Compliance /> },
    { id: 'audit', label: t('hub.tab.audit'), description: t('hub.tab.audit.desc'), icon: <FileSearch size={17} />, content: <Audit /> },
    { id: 'governance', label: t('hub.tab.governance'), description: t('hub.tab.governance.desc'), icon: <Landmark size={17} />, content: <Governance /> },
    { id: 'committee', label: t('hub.tab.committee'), description: t('hub.tab.committee.desc'), icon: <Users size={17} />, content: <CommitteeActionAutomationCenter /> },
    { id: 'automation', label: t('hub.tab.automation'), description: t('hub.tab.automation.desc'), icon: <BrainCircuit size={17} />, content: <AutomationIntelligenceCenter /> },
    { id: 'reviews', label: t('hub.tab.reviews'), description: t('hub.tab.reviews.desc'), icon: <CalendarClock size={17} />, content: <SmartReviewCalendar /> },
  ];
  return (
    <TabbedHub
      eyebrow={t('hub.grc.eyebrow')}
      title={t('hub.grc.title')}
      subtitle={t('hub.grc.subtitle')}
      tabs={auditorReadOnly ? tabs.filter(tab => ['risks', 'audit'].includes(tab.id)) : tabs}
    />
  );
}

function QualitySafetyHub() {
  const { t } = useI18n();
  return (
    <TabbedHub
      eyebrow={t('hub.quality.eyebrow')}
      title={t('hub.quality.title')}
      subtitle={t('hub.quality.subtitle')}
      tabs={[
        { id: 'ovr', label: t('hub.tab.ovr'), description: t('hub.tab.ovr.desc'), icon: <Hospital size={17} />, content: <OVR /> },
        { id: 'ovrRisk', label: t('hub.tab.ovrRisk'), description: t('hub.tab.ovrRisk.desc'), icon: <Activity size={17} />, content: <OvrRiskIndicators /> },
        { id: 'evidenceVault', label: t('hub.tab.evidenceVault'), description: t('hub.tab.evidenceVault.desc'), icon: <FileStack size={17} />, content: <EvidenceVault /> },
        { id: 'relationships', label: t('hub.tab.relationships'), description: t('hub.tab.relationships.desc'), icon: <Network size={17} />, content: <RelationshipMap /> },
      ]}
    />
  );
}

function ReportsDocumentsHub() {
  const { t } = useI18n();
  const auth = useAuth();
  const readOnlyReporting = auth.roles.some(role => role.role === 'viewer' || role.role === 'auditor')
    && !auth.roles.some(role => ['super_admin', 'executive', 'governance_admin', 'division_head', 'department_manager', 'compliance_officer'].includes(role.role));
  const tabs = [
    { id: 'documents', label: t('hub.tab.documents'), description: t('hub.tab.documents.desc'), icon: <FolderKanban size={17} />, content: <PolicyDocumentCenter /> },
    { id: 'importExport', label: t('hub.tab.importExport'), description: t('hub.tab.importExport.desc'), icon: <UploadCloud size={17} />, content: <ImportExport /> },
    { id: 'reportBuilder', label: t('hub.tab.reportBuilder'), description: t('hub.tab.reportBuilder.desc'), icon: <BookCopy size={17} />, content: <AdvancedReportBuilder /> },
    { id: 'customReports', label: t('hub.tab.customReports'), description: t('hub.tab.customReports.desc'), icon: <ClipboardList size={17} />, content: <CustomReports /> },
    { id: 'backupScheduler', label: t('hub.tab.backupScheduler'), description: t('hub.tab.backupScheduler.desc'), icon: <DatabaseBackup size={17} />, content: <BackupSchedulerCenter /> },
    { id: 'backupHealth', label: t('hub.tab.backupHealth'), description: t('hub.tab.backupHealth.desc'), icon: <ArchiveRestore size={17} />, content: <BackupHealthCheck /> },
  ];
  return (
    <TabbedHub
      eyebrow={t('hub.reports.eyebrow')}
      title={t('hub.reports.title')}
      subtitle={t('hub.reports.subtitle')}
      tabs={readOnlyReporting ? tabs.filter(tab => ['documents', 'customReports', 'backupHealth'].includes(tab.id)) : tabs}
    />
  );
}

function AdminReleaseHub({ setPage }: { setPage: (page: PageKey) => void }) {
  const { t } = useI18n();
  return (
    <TabbedHub
      eyebrow={t('hub.admin.eyebrow')}
      title={t('hub.admin.title')}
      subtitle={t('hub.admin.subtitle')}
      tabs={[
        ...(isScenarioLabEnabled ? [{
          id: 'controlledUat',
          label: t('hub.tab.controlledUat'),
          description: t('hub.tab.controlledUat.desc'),
          icon: <ClipboardCheck size={17} />,
          content: <ControlledUatWorkbench setPage={setPage} />,
        }] : []),
        ...(isScenarioLabEnabled ? [{
          id: 'scenarioLab',
          label: t('hub.tab.scenarioLab'),
          description: t('hub.tab.scenarioLab.desc'),
          icon: <WandSparkles size={17} />,
          content: <ScenarioTestConsole setPage={setPage} />,
        }] : []),
        ...(isScenarioLabEnabled ? [{
          id: 'uatIssues',
          label: t('hub.tab.uatIssues'),
          description: t('hub.tab.uatIssues.desc'),
          icon: <Bug size={17} />,
          content: <UatIssueCapture />,
        }] : []),
        { id: 'releaseFactory', label: t('hub.tab.releaseFactory'), description: t('hub.tab.releaseFactory.desc'), icon: <PackageCheck size={17} />, content: <ReleaseFactoryCenter /> },
        { id: 'productionProof', label: t('hub.tab.productionProof', 'Production Proof'), description: t('hub.tab.productionProof.desc', 'Final evidence-based go-live proof gates.'), icon: <PackageCheck size={17} />, content: <ProductionProofCenter /> },
        { id: 'productionFinish', label: t('hub.tab.productionFinish'), description: t('hub.tab.productionFinish.desc'), icon: <Rocket size={17} />, content: <ProductionFinishCenter /> },
        { id: 'finishFast', label: t('hub.tab.finishFast'), description: t('hub.tab.finishFast.desc'), icon: <Rocket size={17} />, content: <FinalSprintCenter /> },
        { id: 'admin', label: t('hub.tab.admin'), description: t('hub.tab.admin.desc'), icon: <Users size={17} />, content: <Admin /> },
        { id: 'access', label: t('hub.tab.access'), description: t('hub.tab.access.desc'), icon: <KeyRound size={17} />, content: <AccessControl /> },
        { id: 'setup', label: t('hub.tab.setup'), description: t('hub.tab.setup.desc'), icon: <Rocket size={17} />, content: <SetupCenter /> },
        { id: 'guide', label: t('hub.tab.guide'), description: t('hub.tab.guide.desc'), icon: <BookCopy size={17} />, content: <UserGuide /> },
        { id: 'security', label: t('hub.tab.security'), description: t('hub.tab.security.desc'), icon: <LockKeyhole size={17} />, content: <SecurityAuditCenter /> },
        { id: 'performance', label: t('hub.tab.performance'), description: t('hub.tab.performance.desc'), icon: <Gauge size={17} />, content: <PerformanceCenter /> },
        { id: 'testing', label: t('hub.tab.testing'), description: t('hub.tab.testing.desc'), icon: <TestTubeDiagonal size={17} />, content: <TestingCenter /> },
        { id: 'staging', label: t('hub.tab.staging'), description: t('hub.tab.staging.desc'), icon: <PackageCheck size={17} />, content: <StagingValidationCenter /> },
        { id: 'rls', label: t('hub.tab.rls'), description: t('hub.tab.rls.desc'), icon: <ShieldAlert size={17} />, content: <RlsPersonaLab /> },
        { id: 'translation', label: t('hub.tab.translation'), description: t('hub.tab.translation.desc'), icon: <Languages size={17} />, content: <TranslationCoverageCenter /> },
        { id: 'seed', label: t('hub.tab.seed'), description: t('hub.tab.seed.desc'), icon: <FileSearch size={17} />, content: <LoadSeedCenter /> },
        { id: 'backupStrategy', label: t('hub.tab.backupStrategy'), description: t('hub.tab.backupStrategy.desc'), icon: <DatabaseBackup size={17} />, content: <ProductionBackupStrategyCenter /> },
        { id: 'runbook', label: t('hub.tab.runbook'), description: t('hub.tab.runbook.desc'), icon: <ClipboardList size={17} />, content: <MigrationRunbookCenter /> },
        { id: 'releaseCandidate', label: t('hub.tab.releaseCandidate'), description: t('hub.tab.releaseCandidate.desc'), icon: <PackageCheck size={17} />, content: <ReleaseCandidateCenter /> },
        { id: 'productionRelease', label: t('hub.tab.productionRelease'), description: t('hub.tab.productionRelease.desc'), icon: <Rocket size={17} />, content: <ProductionReleaseCenter /> },
        { id: 'migrationVerifier', label: t('hub.tab.migrationVerifier'), description: t('hub.tab.migrationVerifier.desc'), icon: <ClipboardList size={17} />, content: <MigrationVerifierCenter /> },
        { id: 'restore', label: t('hub.tab.restore'), description: t('hub.tab.restore.desc'), icon: <ArchiveRestore size={17} />, content: <RestoreDryRunCenter /> },
        { id: 'adminSafety', label: t('hub.tab.adminSafety'), description: t('hub.tab.adminSafety.desc'), icon: <LockKeyhole size={17} />, content: <AdminSafetyConsole /> },
        { id: 'dictionary', label: t('hub.tab.dictionary'), description: t('hub.tab.dictionary.desc'), icon: <Languages size={17} />, content: <BilingualDictionaryCenter /> },
      ]}
    />
  );
}

export default function App() {
  const [page, setPage] = useState<PageKey>('home');
  const auth = useAuth();

  useEffect(() => {
    if (
      auth.status === 'authenticated'
      && !canAccessPageForUser(page, auth.roles, auth.profile?.organizationName)
    ) {
      setPage(firstAllowedPage(auth.roles, auth.profile?.organizationName));
    }
  }, [auth.status, auth.roles, auth.profile?.organizationName, page]);

  if (auth.status === 'loading') {
    return (
      <main className="auth-screen">
        <section className="auth-card auth-card--compact">
          <div className="brand-mark">GRC</div>
          <h1>Loading secure session...</h1>
          <p>جاري تحميل الجلسة الآمنة...</p>
        </section>
      </main>
    );
  }

  if (auth.status !== 'authenticated') {
    return <LoginPage />;
  }

  const renderPage = () => {
    switch (page) {
      case 'home':
        return <WorkspaceHome setPage={setPage} />;
      case 'executiveHub':
        return <ExecutiveHub />;
      case 'workHub':
        return <WorkExecutionHub />;
      case 'grcHub':
        return <GrcHub />;
      case 'qualityHub':
        return <QualitySafetyHub />;
      case 'reportsHub':
        return <ReportsDocumentsHub />;
      case 'adminHub':
        return <AdminReleaseHub setPage={setPage} />;
      case 'finishFast':
        return <FinalSprintCenter />;
      case 'productionFinish':
        return <ProductionFinishCenter />;
      case 'releaseFactory':
        return <ReleaseFactoryCenter />;
      case 'productionProof':
        return <ProductionProofCenter />;
      case 'dashboard':
        return <Dashboard />;
      case 'analytics':
        return <Analytics />;
      case 'myWork':
        return <MyWork />;
      case 'projects':
        return <Projects />;
      case 'departments':
        return <Departments />;
      case 'risks':
        return <Risks />;
      case 'compliance':
        return <Compliance />;
      case 'audit':
        return <Audit />;
      case 'ovr':
        return <OVR />;
      case 'ovrRisk':
        return <OvrRiskIndicators />;
      case 'governance':
        return <Governance />;
      case 'escalations':
        return <Escalations />;
      case 'approvals':
        return <Approvals />;
      case 'evidence':
        return <Evidence />;
      case 'importExport':
        return <ImportExport />;
      case 'accessControl':
        return <AccessControl />;
      case 'setupCenter':
        return <SetupCenter />;
      case 'userGuide':
        return <UserGuide />;
      case 'operations':
        return <OperationsCenter />;
      case 'testing':
        return <TestingCenter />;
      case 'performance':
        return <PerformanceCenter />;
      case 'security':
        return <SecurityAuditCenter />;
      case 'commandCenter':
        return <ExecutiveCommandCenter />;
      case 'globalSearch':
        return <GlobalSearch />;
      case 'documents':
        return <PolicyDocumentCenter />;
      case 'relationships':
        return <RelationshipMap />;
      case 'releaseCandidate':
        return <ReleaseCandidateCenter />;
      case 'productionRelease':
        return <ProductionReleaseCenter />;
      case 'migrationVerifier':
        return <MigrationVerifierCenter />;
      case 'restoreDryRun':
        return <RestoreDryRunCenter />;
      case 'adminSafety':
        return <AdminSafetyConsole />;
      case 'bilingualDictionary':
        return <BilingualDictionaryCenter />;
      case 'boardPacks':
        return <BoardPackCenter />;
      case 'reportBuilder':
        return <AdvancedReportBuilder />;
      case 'evidenceVault':
        return <EvidenceVault />;
      case 'departmentScorecards':
        return <DepartmentScorecards />;
      case 'backupScheduler':
        return <BackupSchedulerCenter />;
      case 'scenarioPlanning':
        return <ScenarioPlanningCenter />;
      case 'mobileCommand':
        return <ExecutiveMobileCommand />;
      case 'automationIntelligence':
        return <AutomationIntelligenceCenter />;
      case 'riskAppetiteKri':
        return <RiskAppetiteKriCenter />;
      case 'smartReviews':
        return <SmartReviewCalendar />;
      case 'committeeAutomation':
        return <CommitteeActionAutomationCenter />;
      case 'stagingValidation':
        return <StagingValidationCenter />;
      case 'rlsPersonaLab':
        return <RlsPersonaLab />;
      case 'translationCoverage':
        return <TranslationCoverageCenter />;
      case 'loadSeedCenter':
        return <LoadSeedCenter />;
      case 'productionBackupStrategy':
        return <ProductionBackupStrategyCenter />;
      case 'migrationRunbook':
        return <MigrationRunbookCenter />;
      case 'scenarioTestConsole':
        return <ScenarioTestConsole setPage={setPage} />;
      case 'controlledUatWorkbench':
        return <ControlledUatWorkbench setPage={setPage} />;
      case 'uatIssueCapture':
        return <UatIssueCapture />;
      case 'admin':
        return <Admin />;
      default:
        return <ExecutiveHub />;
    }
  };

  const content = canAccessPageForUser(page, auth.roles, auth.profile?.organizationName)
    ? renderPage()
    : <UnauthorizedPage page={page} setPage={setPage} />;

  return <Layout page={page} setPage={setPage}>{content}</Layout>;
}
