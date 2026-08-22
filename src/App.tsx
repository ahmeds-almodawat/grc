import { lazy, Suspense, useCallback, useEffect, useState } from "react";
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
} from "lucide-react";
import { Layout } from "./components/Layout";
import { BrandLogo } from "./components/BrandLogo";
import { useAuth } from "./auth/AuthProvider";
import {
  canAccessPageForUser,
  firstAllowedPage,
  SUPER_ADMIN_ONLY_PAGES,
} from "./auth/authAccess";
import { LoginPage } from "./pages/LoginPage";
import { ForcedPasswordChange } from "./pages/ForcedPasswordChange";
import { AuthenticatedDeploymentError } from "./pages/AuthenticatedDeploymentError";
import { CredentialReconciliationRequired } from "./pages/CredentialReconciliationRequired";
import { AuthenticatedAccessDenied } from "./pages/AuthenticatedAccessDenied";
import { UnauthorizedPage } from "./pages/UnauthorizedPage";
import { TabbedHub } from "./components/TabbedHub";
import { useI18n } from "./i18n/I18nContext";
import { WorkspaceHome } from "./pages/WorkspaceHome";
import { FinalSprintCenter } from "./pages/FinalSprintCenter";
import { ProductionFinishCenter } from "./pages/ProductionFinishCenter";
import { ReleaseFactoryCenter } from "./pages/ReleaseFactoryCenter";
import { ProductionProofCenter } from "./pages/ProductionProofCenter";
import { FinalRuntimeSecurityClosureCenter } from "./pages/FinalRuntimeSecurityClosureCenter";
import { AuditEvidenceGovernanceCenter } from "./pages/AuditEvidenceGovernanceCenter";
import { AssuranceGoLiveCenter } from "./pages/AssuranceGoLiveCenter";
import { RealDataUatReadinessCenter } from "./pages/RealDataUatReadinessCenter";
import { RealDataActivationCenter } from "./pages/RealDataActivationCenter";
import { RealDataImportCenter } from "./pages/RealDataImportCenter";
const ProductionHardeningLaunchCenter = lazy(() => import("./pages/ProductionHardeningLaunchCenter").then(module => ({ default: module.ProductionHardeningLaunchCenter })));
import { ProductionGoNoGoCenter } from "./pages/ProductionGoNoGoCenter";
import { Dashboard } from "./pages/Dashboard";
import { Analytics } from "./pages/Analytics";
const Projects = lazy(() => import("./pages/Projects").then(module => ({ default: module.Projects })));
import { Departments } from "./pages/Departments";
import { Risks } from "./pages/Risks";
import { Compliance } from "./pages/Compliance";
import { Audit } from "./pages/Audit";
import { Capa } from "./pages/Capa";
const OVR = lazy(() => import("./pages/OVR").then(module => ({ default: module.OVR })));
import { OvrRiskIndicators } from "./pages/OvrRiskIndicators";
const AccreditationCenter = lazy(() => import("./pages/AccreditationCenter").then(module => ({ default: module.AccreditationCenter })));
const QualityAccreditationOperatingCenter = lazy(() => import("./pages/QualityAccreditationOperatingCenter").then(module => ({ default: module.QualityAccreditationOperatingCenter })));
import { EvidenceBridgeCenter } from "./pages/EvidenceBridgeCenter";
const AccreditationWorkflowCenter = lazy(() => import("./pages/AccreditationWorkflowCenter").then(module => ({ default: module.AccreditationWorkflowCenter })));
const AccreditationWarRoomCenter = lazy(() => import("./pages/AccreditationWarRoomCenter").then(module => ({ default: module.AccreditationWarRoomCenter })));
import { ClinicalGovernanceCenter } from "./pages/ClinicalGovernanceCenter";
import { HospitalGovernanceCenter } from "./pages/HospitalGovernanceCenter";
import { MyWorkCenter } from "./pages/MyWorkCenter";
import { HospitalMasterDataCenter } from "./pages/HospitalMasterDataCenter";
import { RealStandardsMasterDataCenter } from "./pages/RealStandardsMasterDataCenter";
const UatAccreditationEvidenceCenter = lazy(() => import("./pages/UatAccreditationEvidenceCenter").then(module => ({ default: module.UatAccreditationEvidenceCenter })));
const RealUatExecutionCenter = lazy(() => import("./pages/RealUatExecutionCenter").then(module => ({ default: module.RealUatExecutionCenter })));
import { LiveGrcOperatingCore } from "./pages/LiveGrcOperatingCore";
import { WorkflowKernelCenter } from "./pages/WorkflowKernelCenter";
import { ProfessionalWorkbenchesCenter } from "./pages/ProfessionalWorkbenchesCenter";
import { RealWorkflowExecutionCenter } from "./pages/RealWorkflowExecutionCenter";
import { RuntimeWorkflowActionsCenter } from "./pages/RuntimeWorkflowActionsCenter";
import { Governance } from "./pages/Governance";
import { Admin } from "./pages/Admin";
const UserManagementCenter = lazy(() => import("./pages/UserManagementCenter").then(module => ({ default: module.UserManagementCenter })));
import { MyWork } from "./pages/MyWork";
import { Approvals } from "./pages/Approvals";
const Evidence = lazy(() => import("./pages/Evidence").then(module => ({ default: module.Evidence })));
import { Escalations } from "./pages/Escalations";
import { ImportExport } from "./pages/ImportExport";
import { AccessControl } from "./pages/AccessControl";
import { SetupCenter } from "./pages/SetupCenter";
import { UserGuide } from "./pages/UserGuide";
import { OperationsCenter } from "./pages/OperationsCenter";
const TestingCenter = lazy(() => import("./pages/TestingCenter").then(module => ({ default: module.TestingCenter })));
import { PerformanceCenter } from "./pages/PerformanceCenter";
const SecurityAuditCenter = lazy(() => import("./pages/SecurityAuditCenter").then(module => ({ default: module.SecurityAuditCenter })));
import { ExecutiveCommandCenter } from "./pages/ExecutiveCommandCenter";
import { GlobalSearch } from "./pages/GlobalSearch";
import { PolicyDocumentCenter } from "./pages/PolicyDocumentCenter";
import { RelationshipMap } from "./pages/RelationshipMap";
import { ReleaseCandidateCenter } from "./pages/ReleaseCandidateCenter";
import { ProductionReleaseCenter } from "./pages/ProductionReleaseCenter";
const MigrationVerifierCenter = lazy(() => import("./pages/MigrationVerifierCenter").then(module => ({ default: module.MigrationVerifierCenter })));
const RestoreDryRunCenter = lazy(() => import("./pages/RestoreDryRunCenter").then(module => ({ default: module.RestoreDryRunCenter })));
import { AdminSafetyConsole } from "./pages/AdminSafetyConsole";
import { BilingualDictionaryCenter } from "./pages/BilingualDictionaryCenter";
import { BoardPackCenter } from "./pages/BoardPackCenter";
import { AdvancedReportBuilder } from "./pages/AdvancedReportBuilder";
const EvidenceVault = lazy(() => import("./pages/EvidenceVault").then(module => ({ default: module.EvidenceVault })));
import { DepartmentScorecards } from "./pages/DepartmentScorecards";
const BackupSchedulerCenter = lazy(() => import("./pages/BackupSchedulerCenter").then(module => ({ default: module.BackupSchedulerCenter })));
import { TrainingGovernanceCenter } from "./pages/TrainingGovernanceCenter";
import { ExecutiveTruthCenter } from "./pages/ExecutiveTruthCenter";
const ProductionReadinessCenter = lazy(() => import("./pages/ProductionReadinessCenter").then(module => ({ default: module.ProductionReadinessCenter })));
import { ProductionOperatorConsole } from "./pages/ProductionOperatorConsole";
import { ProductionEvidenceClosureCenter } from "./pages/ProductionEvidenceClosureCenter";
import { ScenarioPlanningCenter } from "./pages/ScenarioPlanningCenter";
import { ExecutiveMobileCommand } from "./pages/ExecutiveMobileCommand";
import { AutomationIntelligenceCenter } from "./pages/AutomationIntelligenceCenter";
import { RiskAppetiteKriCenter } from "./pages/RiskAppetiteKriCenter";
import { SmartReviewCalendar } from "./pages/SmartReviewCalendar";
import { CommitteeActionAutomationCenter } from "./pages/CommitteeActionAutomationCenter";
const StagingValidationCenter = lazy(() => import("./pages/StagingValidationCenter").then(module => ({ default: module.StagingValidationCenter })));
import { RlsPersonaLab } from "./pages/RlsPersonaLab";
import { TranslationCoverageCenter } from "./pages/TranslationCoverageCenter";
import { LoadSeedCenter } from "./pages/LoadSeedCenter";
const ProductionBackupStrategyCenter = lazy(() => import("./pages/ProductionBackupStrategyCenter").then(module => ({ default: module.ProductionBackupStrategyCenter })));
const MigrationRunbookCenter = lazy(() => import("./pages/MigrationRunbookCenter").then(module => ({ default: module.MigrationRunbookCenter })));
const BackupHealthCheck = lazy(() => import("./pages/BackupHealthCheck"));
const ScaleBackupRestoreCenter = lazy(() => import("./pages/ScaleBackupRestoreCenter"));
import CustomReports from "./pages/CustomReports";
const ScenarioTestConsole = lazy(() => import("./pages/ScenarioTestConsole").then(module => ({ default: module.ScenarioTestConsole })));
const UatIssueCapture = lazy(() => import("./pages/UatIssueCapture").then(module => ({ default: module.UatIssueCapture })));
const ControlledUatWorkbench = lazy(() => import("./pages/ControlledUatWorkbench").then(module => ({ default: module.ControlledUatWorkbench })));
import { isScenarioLabEnabled } from "./lib/scenarioLab";
import {
  isCanonicalPageLocation,
  isPageKey,
  pageKeyFromLocation,
  resolveAuthorizedPage,
  writePageLocation,
  type PageKey,
  type PageNavigator,
} from "./routes/pageLocation";

function initialPageFromLocation(): PageKey {
  if (typeof window === "undefined") return "home";
  return pageKeyFromLocation(window.location) ?? "home";
}

function ExecutiveHub({ setPage }: { setPage: (page: PageKey) => void }) {
  const { t } = useI18n();
  return (
    <TabbedHub hideTabRail
      eyebrow={t("hub.executive.eyebrow")}
      title={t("hub.executive.title")}
      subtitle={t("hub.executive.subtitle")}
      tabs={[
        {
          id: "command",
          label: t("hub.tab.command", "Executive Actions"),
          description: t("hub.tab.command.desc"),
          icon: <Command size={17} />,
          content: <ExecutiveCommandCenter />,
        },
        {
          id: "dashboard",
          label: t("hub.tab.dashboard"),
          description: t("hub.tab.dashboard.desc"),
          icon: <BarChart3 size={17} />,
          content: <Dashboard setPage={setPage} />,
        },
        {
          id: "analytics",
          label: t("hub.tab.analytics"),
          description: t("hub.tab.analytics.desc"),
          icon: <Activity size={17} />,
          content: <Analytics />,
        },
        {
          id: "board",
          label: t("hub.tab.board"),
          description: t("hub.tab.board.desc"),
          icon: <BookCopy size={17} />,
          content: <BoardPackCenter />,
        },
        {
          id: "mobile",
          label: t("hub.tab.mobile"),
          description: t("hub.tab.mobile.desc"),
          icon: <Smartphone size={17} />,
          content: <ExecutiveMobileCommand />,
        },
        {
          id: "scenario",
          label: t("hub.tab.scenario"),
          description: t("hub.tab.scenario.desc"),
          icon: <Radar size={17} />,
          content: <ScenarioPlanningCenter />,
        },
      ]}
    />
  );
}
function DailyOperationsHub({ setPage }: { setPage: (page: PageKey) => void }) {
  const { t } = useI18n();
  return (
    <TabbedHub hideTabRail
      eyebrow={t("hub.dailyOperations.eyebrow", "Daily operations")}
      title={t("hub.dailyOperations.title", "Daily Operations")}
      subtitle={t(
        "hub.dailyOperations.subtitle",
        "Unified queue across all active tasks.",
      )}
      tabs={[
        {
          id: "unifiedMyWork",
          label: t("hub.tab.unifiedMyWork", "Team Work Queue"),
          description: t(
            "hub.tab.unifiedMyWork.desc",
            "One daily queue across accreditation, evidence, audit, OVR/RCA, CAPA, training, documents, approvals, and escalations.",
          ),
          icon: <ClipboardList size={17} />,
          content: <MyWorkCenter />,
        },
        {
          id: "my",
          label: t("hub.tab.myWork"),
          description: t("hub.tab.myWork.desc"),
          icon: <UserCheck size={17} />,
          content: <MyWork />,
        },
        {
          id: "ovr",
          label: t("hub.tab.ovr"),
          description: t("hub.tab.ovr.desc"),
          icon: <Hospital size={17} />,
          content: <OVR />,
        },
        {
          id: "evidence",
          label: t("hub.tab.evidence"),
          description: t("hub.tab.evidence.desc"),
          icon: <FileCheck2 size={17} />,
          content: <Evidence />,
        },
        {
          id: "projects",
          label: t("hub.tab.projects"),
          description: t("hub.tab.projects.desc"),
          icon: <GanttChartSquare size={17} />,
          content: <Projects setPage={setPage} />,
        },
        {
          id: "departments",
          label: t("hub.tab.departments"),
          description: t("hub.tab.departments.desc"),
          icon: <Building2 size={17} />,
          content: <Departments setPage={(page) => setPage(page as PageKey)} />,
        },
        {
          id: "operations",
          label: t("hub.tab.operations"),
          description: t("hub.tab.operations.desc"),
          icon: <BellRing size={17} />,
          content: <OperationsCenter />,
        },
        {
          id: "escalations",
          label: t("hub.tab.escalations"),
          description: t("hub.tab.escalations.desc"),
          icon: <Siren size={17} />,
          content: <Escalations />,
        },
        {
          id: "approvals",
          label: t("hub.tab.approvals"),
          description: t("hub.tab.approvals.desc"),
          icon: <ClipboardCheck size={17} />,
          content: <Approvals />,
        },
      ]}
    />
  );
}

function GrcHub({ setPage }: { setPage: PageNavigator }) {
  const { t } = useI18n();
  const auth = useAuth();
  const auditorReadOnly =
    auth.roles.some((role) => role.role === "auditor") &&
    !auth.roles.some(
      (role) => role.role === "super_admin" || role.role === "governance_admin",
    );
  const tabs = [
    {
      id: "risks",
      label: t("hub.tab.risks"),
      description: t("hub.tab.risks.desc"),
      icon: <ShieldAlert size={17} />,
      content: <Risks />,
    },
    {
      id: "kri",
      label: t("hub.tab.kri"),
      description: t("hub.tab.kri.desc"),
      icon: <Gauge size={17} />,
      content: <RiskAppetiteKriCenter />,
    },
    {
      id: "compliance",
      label: t("hub.tab.compliance"),
      description: t("hub.tab.compliance.desc"),
      icon: <ClipboardCheck size={17} />,
      content: <Compliance />,
    },
    {
      id: "audit",
      label: t("hub.tab.audit"),
      description: t("hub.tab.audit.desc"),
      icon: <FileSearch size={17} />,
      content: <Audit />,
    },
    {
      id: "capa",
      label: t("hub.tab.capa", "CAPA"),
      description: t("hub.tab.capa.desc", "Corrective and preventive action lifecycle"),
      icon: <ClipboardList size={17} />,
      content: <Capa />,
    },
    {
      id: "governance",
      label: t("hub.tab.governance"),
      description: t("hub.tab.governance.desc"),
      icon: <Landmark size={17} />,
      content: <Governance setPage={setPage} />,
    },
    {
      id: "committee",
      label: t("hub.tab.committee", "Committees"),
      description: t("hub.tab.committee.desc"),
      icon: <Users size={17} />,
      content: <CommitteeActionAutomationCenter />,
    },
    {
      id: "reviews",
      label: t("hub.tab.reviews"),
      description: t("hub.tab.reviews.desc"),
      icon: <CalendarClock size={17} />,
      content: <SmartReviewCalendar />,
    },
  ];
  return (
    <TabbedHub hideTabRail
      eyebrow={t("hub.grc.eyebrow")}
      title={t("hub.grc.title")}
      subtitle={t("hub.grc.subtitle")}
      tabs={
        auditorReadOnly
          ? tabs.filter((tab) => ["risks", "audit", "capa"].includes(tab.id))
          : tabs
      }
    />
  );
}

function QualitySafetyHub() {
  const { t } = useI18n();
  return (
    <TabbedHub hideTabRail
      eyebrow={t("hub.quality.eyebrow", "Quality & safety")}
      title={t("hub.quality.title", "Quality & Safety")}
      subtitle={t(
        "hub.quality.subtitle",
        "Clinical governance, indicators, and risk management.",
      )}
      tabs={[
        {
          id: "clinicalGovernance",
          label: t("hub.tab.clinicalGovernance", "Clinical Quality"),
          description: t(
            "hub.tab.clinicalGovernance.desc",
            "Audit execution, OVR RCA, CAPA, evidence, accreditation links, and clinical escalations.",
          ),
          icon: <FileSearch size={17} />,
          content: <ClinicalGovernanceCenter />,
        },
        {
          id: "hospitalGovernancePack",
          label: t("hub.tab.hospitalGovernancePack", "Hospital Safety"),
          description: t(
            "hub.tab.hospitalGovernancePack.desc",
            "Infection control, clinical quality indicators, committees, credentialing, facility safety, evidence gaps, and accreditation blockers.",
          ),
          icon: <Hospital size={17} />,
          content: <HospitalGovernanceCenter />,
        },
        {
          id: "ovrRisk",
          label: t("hub.tab.ovrRisk"),
          description: t("hub.tab.ovrRisk.desc"),
          icon: <Activity size={17} />,
          content: <OvrRiskIndicators />,
        },
        {
          id: "relationships",
          label: t("hub.tab.relationships"),
          description: t("hub.tab.relationships.desc"),
          icon: <Network size={17} />,
          content: <RelationshipMap />,
        },
      ]}
    />
  );
}

function AccreditationHub() {
  const { t } = useI18n();
  return (
    <TabbedHub hideTabRail
      eyebrow={t("hub.accreditation.eyebrow", "Accreditation operations")}
      title={t("hub.accreditation.title", "Accreditation & Readiness")}
      subtitle={t(
        "hub.accreditation.subtitle",
        "Standards, workflows, war room, and evidence.",
      )}
      tabs={[
        {
          id: "accreditationWarRoom",
          label: t("hub.tab.accreditationWarRoom", "Survey Readiness"),
          description: t(
            "hub.tab.accreditationWarRoom.desc",
            "Survey readiness, evidence gates, waivers, blockers, queue overlays, and traceability chains.",
          ),
          icon: <Radar size={17} />,
          content: <AccreditationWarRoomCenter />,
        },
        {
          id: "accreditation",
          label: t("hub.tab.accreditation", "Accreditation"),
          description: t(
            "hub.tab.accreditation.desc",
            "CBAHI and international accreditation readiness engine.",
          ),
          icon: <ClipboardCheck size={17} />,
          content: <AccreditationCenter />,
        },
      ]}
    />
  );
}

function EvidenceDocumentsHub() {
  const { t } = useI18n();
  return (
    <TabbedHub hideTabRail
      eyebrow={t("hub.evidenceDocuments.eyebrow", "Evidence & files")}
      title={t("hub.evidenceDocuments.title", "Evidence & Documents")}
      subtitle={t(
        "hub.evidenceDocuments.subtitle",
        "Manage policies, documents, and vault.",
      )}
      tabs={[
        {
          id: "documents",
          label: t("hub.tab.documents", "Policies"),
          description: t("hub.tab.documents.desc"),
          icon: <FolderKanban size={17} />,
          content: <PolicyDocumentCenter />,
        },
        {
          id: "evidenceVault",
          label: t("hub.tab.evidenceVault"),
          description: t("hub.tab.evidenceVault.desc"),
          icon: <FileStack size={17} />,
          content: <EvidenceVault />,
        },
        {
          id: "importExport",
          label: t("hub.tab.importExport"),
          description: t("hub.tab.importExport.desc"),
          icon: <UploadCloud size={17} />,
          content: <ImportExport />,
        },
      ]}
    />
  );
}

function ReportsHub() {
  const { t } = useI18n();
  const auth = useAuth();
  const readOnlyReporting =
    auth.roles.some(
      (role) => role.role === "viewer" || role.role === "auditor",
    ) &&
    !auth.roles.some((role) =>
      [
        "super_admin",
        "executive",
        "governance_admin",
        "division_head",
        "department_manager",
        "compliance_officer",
      ].includes(role.role),
    );
  const tabs = [
    {
      id: "executiveTruth",
      label: t("hub.tab.executiveTruth", "Executive Summary"),
      description: t("hub.tab.executiveTruth.desc", "Executive Truth Center."),
      icon: <BarChart3 size={17} />,
      content: <ExecutiveTruthCenter />,
    },
    {
      id: "reportBuilder",
      label: t("hub.tab.reportBuilder"),
      description: t("hub.tab.reportBuilder.desc"),
      icon: <BookCopy size={17} />,
      content: <AdvancedReportBuilder />,
    },
    {
      id: "customReports",
      label: t("hub.tab.customReports"),
      description: t("hub.tab.customReports.desc"),
      icon: <ClipboardList size={17} />,
      content: <CustomReports />,
    },
  ];
  return (
    <TabbedHub hideTabRail
      eyebrow={t("hub.reports.eyebrow")}
      title={t("hub.reports.title")}
      subtitle={t("hub.reports.subtitle")}
      tabs={
        readOnlyReporting
          ? tabs.filter((tab) => ["customReports"].includes(tab.id))
          : tabs
      }
    />
  );
}

function AdminSystemControls() {
  const { t } = useI18n();
  const auth = useAuth();
  return (
    <TabbedHub
      compact
      eyebrow={t("hub.admin.system.eyebrow", "Control pages")}
      title={t("hub.admin.system.title", "System Control Pages")}
      subtitle={t(
        "hub.admin.system.subtitle",
        "User lifecycle, access, setup, safety, and operating guidance.",
      )}
      tabs={[
        {
          id: "admin",
          label: t("hub.tab.admin"),
          description: t("hub.tab.admin.desc"),
          icon: <Users size={17} />,
          content: <Admin />,
        },
        {
          id: "userManagement",
          label: t("hub.tab.userManagement", "User Management"),
          description: t(
            "hub.tab.userManagement.desc",
            "Professional user lifecycle, status, department, role, controlled Excel import/export, and audit controls.",
          ),
          icon: <Users size={17} />,
          content: <UserManagementCenter />,
        },
        {
          id: "hospitalMasterData",
          label: t("hub.tab.hospitalMasterData", "Organization Setup"),
          description: t(
            "hub.tab.hospitalMasterData.desc",
            "Governed locations, services, clinical areas, committees, job titles, indicators, and ownership mappings.",
          ),
          icon: <Building2 size={17} />,
          content: <HospitalMasterDataCenter />,
        },
        {
          id: "access",
          label: t("hub.tab.access"),
          description: t("hub.tab.access.desc"),
          icon: <KeyRound size={17} />,
          content: <AccessControl />,
        },
        {
          id: "setup",
          label: t("hub.tab.setup"),
          description: t("hub.tab.setup.desc"),
          icon: <Rocket size={17} />,
          content: <SetupCenter />,
        },
        ...(auth.roles?.some((r: any) => r.role === "super_admin")
          ? [
              {
                id: "adminSafety",
                label: t("hub.tab.adminSafety"),
                description: t("hub.tab.adminSafety.desc"),
                icon: <LockKeyhole size={17} />,
                content: <AdminSafetyConsole />,
              },
            ]
          : []),
        {
          id: "guide",
          label: t("hub.tab.guide"),
          description: t("hub.tab.guide.desc"),
          icon: <BookCopy size={17} />,
          content: <UserGuide />,
        },
        {
          id: "scaleBackupRestore",
          label: t("hub.tab.scaleBackupRestore", "Backup & Restore Center"),
          description: t(
            "hub.tab.scaleBackupRestore.desc",
            "Monitor health, scale, schedule, and test backup and restore processes.",
          ),
          icon: <DatabaseBackup size={17} />,
          content: <ScaleBackupRestoreCenter />,
        },
      ]}
    />
  );
}

function RealDataControlPages() {
  const { t } = useI18n();
  const auth = useAuth();
  return (
    <TabbedHub
      compact
      eyebrow={t("hub.admin.realData.eyebrow", "Real data controls")}
      title={t("hub.admin.realData.title", "Real Data Import & Activation")}
      subtitle={t(
        "hub.admin.realData.subtitle",
        "Import orchestration, activation queues, source validation, UAT readiness, and real-data handoff.",
      )}
      tabs={[
        ...(auth.roles?.some((r: any) => r.role === "super_admin") ? [{
          id: "realDataImportCenter",
          label: t("hub.tab.realDataImportCenter", "System Import Center"),
          description: t(
            "hub.tab.realDataImportCenter.desc",
            "Control center for the reviewed GRC import-ready pack, reports, snapshots, and readiness.",
          ),
          icon: <UploadCloud size={17} />,
          content: <RealDataImportCenter />,
        },] : []),
        ...(auth.roles?.some((r: any) => r.role === "super_admin") ? [{
          id: "realDataActivation",
          label: t("hub.tab.realDataActivation", "Real Data Activation"),
          description: t(
            "hub.tab.realDataActivation.desc",
            "Controlled activation of licensed metadata, master data, mappings, validations, load approvals, reconciliation, and cutover readiness.",
          ),
          icon: <UploadCloud size={17} />,
          content: <RealDataActivationCenter />,
        },] : []),
        ...(auth.roles?.some((r: any) => r.role === "super_admin") ? [{
          id: "realDataUatReadiness",
          label: t("hub.tab.realDataUatReadiness", "Real Data & UAT"),
          description: t(
            "hub.tab.realDataUatReadiness.desc",
            "Licensed content loading, import validation, mappings, UAT cycles, training, signoffs, and go/no-go readiness.",
          ),
          icon: <ClipboardCheck size={17} />,
          content: <RealDataUatReadinessCenter />,
        },] : []),
      ]}
    />
  );
}

function ProductionGovernancePages() {
  const { t } = useI18n();
  const auth = useAuth();
  return (
    <TabbedHub
      compact
      eyebrow={t("hub.admin.production.eyebrow", "Production control")}
      title={t("hub.admin.production.title", "Production Governance Pages")}
      subtitle={t(
        "hub.admin.production.subtitle",
        "Go-live assurance, release governance, runtime closure, rollback, and executive signoff.",
      )}
      tabs={[
        ...(auth.roles?.some((r: any) => r.role === "super_admin") ? [{
          id: "auditEvidenceGovernance",
          label: t(
            "hub.tab.auditEvidenceGovernance",
            "Audit & Evidence Integrity",
          ),
          description: t(
            "hub.tab.auditEvidenceGovernance.desc",
            "Audit workbench, evidence integrity, and production governance gates.",
          ),
          icon: <FileCheck2 size={17} />,
          content: <AuditEvidenceGovernanceCenter />,
        },] : []),
        ...(auth.roles?.some((r: any) => r.role === "super_admin") ? [{
          id: "assuranceGoLive",
          label: t("hub.tab.assuranceGoLive", "Assurance Go-Live Pack"),
          description: t(
            "hub.tab.assuranceGoLive.desc",
            "External auditor portal, signoffs, rollback, monitoring, training, and production decisions.",
          ),
          icon: <PackageCheck size={17} />,
          content: <AssuranceGoLiveCenter />,
        },] : []),
        ...(auth.roles?.some((r: any) => r.role === "super_admin")
          ? [
              {
                id: "finalRuntimeSecurityClosure",
                label: t(
                  "hub.tab.finalRuntimeSecurityClosure",
                  "Security Closure",
                ),
                description: t(
                  "hub.tab.finalRuntimeSecurityClosure.desc",
                  "Close security warnings, action classifications, access exceptions, and final evidence.",
                ),
                icon: <LockKeyhole size={17} />,
                content: <FinalRuntimeSecurityClosureCenter />,
              },
            ]
          : []),
        ...(auth.roles?.some((r: any) => r.role === "super_admin")
          ? [
              {
                id: "productionHardeningLaunch",
                label: t(
                  "hub.tab.productionHardeningLaunch",
                  "Production Hardening",
                ),
                description: t(
                  "hub.tab.productionHardeningLaunch.desc",
                  "Warning cleanup, role testing, restore evidence, change freeze, board go/no-go, launch signoffs, and monitoring.",
                ),
                icon: <PackageCheck size={17} />,
                content: <ProductionHardeningLaunchCenter />,
              },
            ]
          : []),
        ...(auth.roles?.some((r: any) => r.role === "super_admin") ? [{
          id: "realProductionGoNoGo",
          label: t("hub.tab.realProductionGoNoGo", "Production Go/No-Go"),
          description: t(
            "hub.tab.realProductionGoNoGo.desc",
            "Restore and rollback verification, change freeze, access and confidentiality review, board pack, executive decision, and launch monitoring.",
          ),
          icon: <PackageCheck size={17} />,
          content: <ProductionGoNoGoCenter />,
        },] : []),
        ...(auth.roles?.some((r: any) => r.role === "super_admin")
          ? [
              {
                id: "releaseFactory",
                label: t("hub.tab.releaseFactory"),
                description: t("hub.tab.releaseFactory.desc"),
                icon: <PackageCheck size={17} />,
                content: <ReleaseFactoryCenter />,
              },
            ]
          : []),
        ...(auth.roles?.some((r: any) => r.role === "super_admin")
          ? [
              {
                id: "productionProof",
                label: t("hub.tab.productionProof", "Production Readiness"),
                description: t(
                  "hub.tab.productionProof.desc",
                  "Final evidence-based go-live gates.",
                ),
                icon: <PackageCheck size={17} />,
                content: <ProductionProofCenter />,
              },
            ]
          : []),
        ...(auth.roles?.some((r: any) => r.role === "super_admin")
          ? [
              {
                id: "productionRelease",
                label: t("hub.tab.productionRelease"),
                description: t("hub.tab.productionRelease.desc"),
                icon: <Rocket size={17} />,
                content: <ProductionReleaseCenter />,
              },
            ]
          : []),
        ...(auth.roles?.some((r: any) => r.role === "super_admin")
          ? [
              {
                id: "releaseCandidate",
                label: t("hub.tab.releaseCandidate"),
                description: t("hub.tab.releaseCandidate.desc"),
                icon: <PackageCheck size={17} />,
                content: <ReleaseCandidateCenter />,
              },
            ]
          : []),
        ...(auth.roles?.some((r: any) => r.role === "super_admin")
          ? [
              {
                id: "productionFinish",
                label: t("hub.tab.productionFinish"),
                description: t("hub.tab.productionFinish.desc"),
                icon: <Rocket size={17} />,
                content: <ProductionFinishCenter />,
              },
            ]
          : []),
        ...(auth.roles?.some((r: any) => r.role === "super_admin")
          ? [
              {
                id: "finishFast",
                label: t("hub.tab.finishFast"),
                description: t("hub.tab.finishFast.desc"),
                icon: <Rocket size={17} />,
                content: <FinalSprintCenter />,
              },
            ]
          : []),
      ]}
    />
  );
}

function MaintenanceIndicatorPages() {
  const { t } = useI18n();
  const auth = useAuth();
  return (
    <TabbedHub
      compact
      eyebrow={t("hub.admin.maintenance.eyebrow", "Maintenance pages")}
      title={t("hub.admin.maintenance.title", "Maintenance & Indicators")}
      subtitle={t(
        "hub.admin.maintenance.subtitle",
        "Security, testing, performance, indicators, backup, release readiness, translation, and health-maintenance controls.",
      )}
      tabs={[
        ...(auth.roles?.some((r: any) => r.role === "super_admin")
          ? [
              {
                id: "security",
                label: t("hub.tab.security"),
                description: t("hub.tab.security.desc"),
                icon: <LockKeyhole size={17} />,
                content: <SecurityAuditCenter />,
              },
            ]
          : []),
        ...(auth.roles?.some((r: any) => r.role === "super_admin")
          ? [
              {
                id: "performance",
                label: t("hub.tab.performance"),
                description: t("hub.tab.performance.desc"),
                icon: <Gauge size={17} />,
                content: <PerformanceCenter />,
              },
            ]
          : []),
        ...(auth.roles?.some((r: any) => r.role === "super_admin")
          ? [
              {
                id: "testing",
                label: t("hub.tab.testing"),
                description: t("hub.tab.testing.desc"),
                icon: <TestTubeDiagonal size={17} />,
                content: <TestingCenter />,
              },
            ]
          : []),
        ...(auth.roles?.some((r: any) => r.role === "super_admin")
          ? [
              {
                id: "staging",
                label: t("hub.tab.staging"),
                description: t("hub.tab.staging.desc"),
                icon: <PackageCheck size={17} />,
                content: <StagingValidationCenter />,
              },
            ]
          : []),
        ...(auth.roles?.some((r: any) => r.role === "super_admin")
          ? [
              {
                id: "rls",
                label: t("hub.tab.rls"),
                description: t("hub.tab.rls.desc"),
                icon: <ShieldAlert size={17} />,
                content: <RlsPersonaLab />,
              },
            ]
          : []),
        {
          id: "kriIndicators",
          label: t("hub.tab.kriIndicators", "KRI Indicators"),
          description: t(
            "hub.tab.kriIndicators.desc",
            "Risk appetite, KRI thresholds, breach pressure, and indicator maintenance.",
          ),
          icon: <Gauge size={17} />,
          content: <RiskAppetiteKriCenter />,
        },
        {
          id: "departmentIndicators",
          label: t("hub.tab.departmentIndicators", "Department Indicators"),
          description: t(
            "hub.tab.departmentIndicators.desc",
            "Department scorecards and operating indicator maintenance.",
          ),
          icon: <Radar size={17} />,
          content: <DepartmentScorecards />,
        },
        ...(auth.roles?.some((r: any) => r.role === "super_admin")
          ? [
              {
                id: "backupStrategy",
                label: t("hub.tab.backupStrategy"),
                description: t("hub.tab.backupStrategy.desc"),
                icon: <DatabaseBackup size={17} />,
                content: <ProductionBackupStrategyCenter />,
              },
            ]
          : []),
        ...(auth.roles?.some((r: any) => r.role === "super_admin")
          ? [
              {
                id: "backupHealth",
                label: t("hub.tab.backupHealth"),
                description: t("hub.tab.backupHealth.desc"),
                icon: <ArchiveRestore size={17} />,
                content: <BackupHealthCheck />,
              },
            ]
          : []),
        ...(auth.roles?.some((r: any) => r.role === "super_admin")
          ? [
              {
                id: "migrationVerifier",
                label: t("hub.tab.migrationVerifier"),
                description: t("hub.tab.migrationVerifier.desc"),
                icon: <ClipboardList size={17} />,
                content: <MigrationVerifierCenter />,
              },
            ]
          : []),
        ...(auth.roles?.some((r: any) => r.role === "super_admin")
          ? [
              {
                id: "runbook",
                label: t("hub.tab.runbook"),
                description: t("hub.tab.runbook.desc"),
                icon: <ClipboardList size={17} />,
                content: <MigrationRunbookCenter />,
              },
            ]
          : []),
        ...(auth.roles?.some((r: any) => r.role === "super_admin")
          ? [
              {
                id: "restore",
                label: t("hub.tab.restore"),
                description: t("hub.tab.restore.desc"),
                icon: <ArchiveRestore size={17} />,
                content: <RestoreDryRunCenter />,
              },
            ]
          : []),
        ...(auth.roles?.some((r: any) => r.role === "super_admin")
          ? [
              {
                id: "translation",
                label: t("hub.tab.translation"),
                description: t("hub.tab.translation.desc"),
                icon: <Languages size={17} />,
                content: <TranslationCoverageCenter />,
              },
            ]
          : []),
        ...(auth.roles?.some((r: any) => r.role === "super_admin")
          ? [
              {
                id: "seed",
                label: t("hub.tab.seed"),
                description: t("hub.tab.seed.desc"),
                icon: <FileSearch size={17} />,
                content: <LoadSeedCenter />,
              },
            ]
          : []),
        {
          id: "dictionary",
          label: t("hub.tab.dictionary"),
          description: t("hub.tab.dictionary.desc"),
          icon: <Languages size={17} />,
          content: <BilingualDictionaryCenter />,
        },
      ]}
    />
  );
}

function UatScenarioControlPages({
  setPage,
}: {
  setPage: (page: PageKey) => void;
}) {
  const { t } = useI18n();
  const auth = useAuth();
  return (
    <TabbedHub
      compact
      eyebrow={t("hub.admin.uat.eyebrow", "UAT control")}
      title={t("hub.admin.uat.title", "UAT & Scenario Controls")}
      subtitle={t(
        "hub.admin.uat.subtitle",
        "Controlled UAT workbench, scenario lab, and issue capture for pilot execution.",
      )}
      tabs={[
        ...(auth.roles?.some((r: any) => r.role === "super_admin")
          ? [
              {
                id: "controlledUat",
                label: t("hub.tab.controlledUat"),
                description: t("hub.tab.controlledUat.desc"),
                icon: <ClipboardCheck size={17} />,
                content: <ControlledUatWorkbench setPage={setPage} />,
              },
            ]
          : []),
        ...(auth.roles?.some((r: any) => r.role === "super_admin")
          ? [
              {
                id: "scenarioLab",
                label: t("hub.tab.scenarioLab"),
                description: t("hub.tab.scenarioLab.desc"),
                icon: <WandSparkles size={17} />,
                content: <ScenarioTestConsole setPage={setPage} />,
              },
            ]
          : []),
        ...(auth.roles?.some((r: any) => r.role === "super_admin")
          ? [
              {
                id: "uatIssues",
                label: t("hub.tab.uatIssues"),
                description: t("hub.tab.uatIssues.desc"),
                icon: <Bug size={17} />,
                content: <UatIssueCapture />,
              },
            ]
          : []),
      ]}
    />
  );
}

function AdminMaintenanceHub({
  setPage,
}: {
  setPage: (page: PageKey) => void;
}) {
  const { t } = useI18n();
  return (
    <TabbedHub hideTabRail
      eyebrow={t("hub.admin.eyebrow")}
      title={t("hub.admin.title", "Admin Maintenance")}
      subtitle={t("hub.admin.subtitle")}
      tabs={[
        {
          id: "productionReadiness",
          label: t("hub.tab.productionReadiness", "Production Readiness"),
          description: t(
            "hub.tab.productionReadiness.desc",
            "Go/No-Go controls and validations.",
          ),
          icon: <ShieldAlert size={17} />,
          content: <ProductionReadinessCenter />,
        },
        {
          id: "systemControls",
          label: t("hub.tab.systemControls", "System Controls"),
          description: t(
            "hub.tab.systemControls.desc",
            "Admin, users, roles, access, setup, safety, and guidance.",
          ),
          icon: <Users size={17} />,
          content: <AdminSystemControls />,
        },
        {
          id: "realDataControls",
          label: t("hub.tab.realDataControls", "Real Data Import"),
          description: t(
            "hub.tab.realDataControls.desc",
            "Import center, activation, real-data readiness, and UAT source handoff.",
          ),
          icon: <UploadCloud size={17} />,
          content: <RealDataControlPages />,
        },
        {
          id: "productionControls",
          label: t("hub.tab.productionControls", "Production Governance"),
          description: t(
            "hub.tab.productionControls.desc",
            "Release, assurance, go/no-go, access security, and launch controls.",
          ),
          icon: <PackageCheck size={17} />,
          content: <ProductionGovernancePages />,
        },
        {
          id: "maintenanceControls",
          label: t("hub.tab.maintenanceControls", "Maintenance & Indicators"),
          description: t(
            "hub.tab.maintenanceControls.desc",
            "Security, testing, performance, indicators, backups, release readiness, and health controls.",
          ),
          icon: <Gauge size={17} />,
          content: <MaintenanceIndicatorPages />,
        },
        ...(isScenarioLabEnabled
          ? [
              {
                id: "uatScenarioControls",
                label: t("hub.tab.uatScenarioControls", "UAT Controls"),
                description: t(
                  "hub.tab.uatScenarioControls.desc",
                  "Controlled UAT workbench, scenario lab, and issue capture.",
                ),
                icon: <ClipboardCheck size={17} />,
                content: <UatScenarioControlPages setPage={setPage} />,
              },
            ]
          : []),
      ]}
    />
  );
}

export default function App() {
  const [page, setPageState] = useState<PageKey>(initialPageFromLocation);
  const auth = useAuth();
  const { t } = useI18n();
  const organizationName = auth.profile?.organizationName;

  const canOpenPage = useCallback(
    (targetPage: PageKey) =>
      canAccessPageForUser(targetPage, auth.roles, organizationName),
    [auth.roles, organizationName],
  );

  const navigateToPage = useCallback<PageNavigator>(
    (candidate, options = {}) => {
      if (!isPageKey(candidate)) return;

      let targetPage = candidate;
      let historyMode = options.mode ?? "push";
      if (
        auth.status === "authenticated_active" &&
        !canOpenPage(candidate)
      ) {
        targetPage = firstAllowedPage(auth.roles, organizationName);
        historyMode = "replace";
      }

      setPageState((currentPage) =>
        currentPage === targetPage ? currentPage : targetPage,
      );
      writePageLocation(targetPage, { mode: historyMode });
    },
    [auth.status, auth.roles, organizationName, canOpenPage],
  );

  // Existing child pages accept a one-argument setPage-style callback. This
  // wrapper preserves that API while routing every navigation through history.
  const setPage = useCallback(
    (targetPage: PageKey) => navigateToPage(targetPage),
    [navigateToPage],
  );

  const restorePageFromLocation = useCallback(() => {
    if (typeof window === "undefined") return;

    const requestedPage = pageKeyFromLocation(window.location);
    if (auth.status !== "authenticated_active") {
      setPageState(requestedPage ?? "home");
      return;
    }

    const resolution = resolveAuthorizedPage(
      requestedPage,
      canOpenPage,
      firstAllowedPage(auth.roles, organizationName),
    );
    setPageState((currentPage) =>
      currentPage === resolution.page ? currentPage : resolution.page,
    );

    if (
      resolution.shouldReplace ||
      !isCanonicalPageLocation(window.location, resolution.page)
    ) {
      writePageLocation(resolution.page, { mode: "replace" });
    }
  }, [
    auth.status,
    auth.roles,
    organizationName,
    canOpenPage,
  ]);

  useEffect(() => {
    if (auth.status === "authenticated_active") restorePageFromLocation();
  }, [auth.status, restorePageFromLocation]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handlePopState = () => restorePageFromLocation();
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [restorePageFromLocation]);

  if (auth.status.startsWith("authenticated_") && !auth.session?.user) {
    return <LoginPage />;
  }

  if (
    auth.status === "initializing"
    || auth.status === "authenticated_checking_capabilities"
    || auth.status === "authenticated_checking_credential_state"
    || auth.status === "authenticated_loading_authorization"
    || auth.status === "signing_out"
  ) {
    return (
      <main className="auth-screen">
        <section className="auth-card auth-card--compact">
          <BrandLogo variant="loading" />
          <h1>{t("auth.loadingSecureSession")}</h1>
          <p>{t("auth.loadingSecureSessionHint")}</p>
        </section>
      </main>
    );
  }

  if (auth.status === "authenticated_password_change_required") {
    return <ForcedPasswordChange />;
  }

  if (auth.status === "authenticated_deployment_incompatible") {
    return <AuthenticatedDeploymentError />;
  }

  if (auth.status === "authenticated_reconciliation_required") {
    return <CredentialReconciliationRequired />;
  }

  if (auth.status === "authenticated_access_denied") {
    return <AuthenticatedAccessDenied />;
  }

  if (auth.status !== "authenticated_active") {
    return <LoginPage />;
  }

  const renderPage = () => {
    switch (page) {
      case "home":
        return <WorkspaceHome setPage={setPage} />;
      case "executiveHub":
        return <ExecutiveHub setPage={setPage} />;
      case "workHub":
      case "dailyOperationsHub" as any:
        return <DailyOperationsHub setPage={setPage} />;
      case "grcHub":
        return <GrcHub setPage={setPage} />;
      case "qualityHub":
        return <QualitySafetyHub />;
      case "accreditationHub" as any:
        return <AccreditationHub />;
      case "evidenceHub" as any:
        return <EvidenceDocumentsHub />;
      case "reportsHub":
        return <ReportsHub />;
      case "adminHub":
        return <AdminMaintenanceHub setPage={setPage} />;
      case "productionOperatorConsole":
        return <ProductionOperatorConsole setPage={setPage} />;
      case "productionEvidenceClosure":
        return <ProductionEvidenceClosureCenter setPage={setPage} />;
      case "finishFast":
        return <FinalSprintCenter />;
      case "productionFinish":
        return <ProductionFinishCenter />;
      case "releaseFactory":
        return <ReleaseFactoryCenter />;
      case "productionProof":
        return <ProductionProofCenter />;
      case "dashboard":
        return <Dashboard setPage={setPage} />;
      case "analytics":
        return <Analytics />;
      case "myWork":
        return <MyWork />;
      case "projects":
        return <Projects setPage={setPage} />;
      case "departments":
        return <Departments setPage={(page) => setPage(page as PageKey)} />;
      case "risks":
        return <Risks />;
      case "compliance":
        return <Compliance />;
      case "audit":
        return <Audit />;
      case "capa":
        return <Capa />;
      case "ovr":
        return <OVR />;
      case "ovrRisk":
        return <OvrRiskIndicators />;
      case "governance":
        return <Governance setPage={setPage} />;
      case "escalations":
        return <Escalations />;
      case "approvals":
        return <Approvals />;
      case "evidence":
        return <Evidence />;
      case "importExport":
        return <ImportExport />;
      case "accessControl":
        return <AccessControl />;
      case "setupCenter":
        return <SetupCenter />;
      case "userGuide":
        return <UserGuide />;
      case "operations":
        return <OperationsCenter />;
      case "testing":
        return <TestingCenter />;
      case "performance":
        return <PerformanceCenter />;
      case "security":
        return <SecurityAuditCenter />;
      case "commandCenter":
        return <ExecutiveCommandCenter />;
      case "globalSearch":
        return <GlobalSearch />;
      case "documents":
        return <PolicyDocumentCenter initialTab="policies" setPage={setPage} />;
      case "sops":
        return <PolicyDocumentCenter initialTab="sops" setPage={setPage} />;
      case "relationships":
        return <RelationshipMap />;
      case "releaseCandidate":
        return <ReleaseCandidateCenter />;
      case "productionRelease":
        return <ProductionReleaseCenter />;
      case "migrationVerifier":
        return <MigrationVerifierCenter />;
      case "restoreDryRun":
        return <RestoreDryRunCenter />;
      case "adminSafety":
        return <AdminSafetyConsole />;
      case "bilingualDictionary":
        return <BilingualDictionaryCenter />;
      case "boardPacks":
        return <BoardPackCenter />;
      case "reportBuilder":
        return <AdvancedReportBuilder />;
      case "evidenceVault":
        return <EvidenceVault />;
      case "departmentScorecards":
        return <DepartmentScorecards />;
      case "backupScheduler":
        return <BackupSchedulerCenter />;
      case "scenarioPlanning":
        return <ScenarioPlanningCenter />;
      case "mobileCommand":
        return <ExecutiveMobileCommand />;
      case "automationIntelligence":
        return <AutomationIntelligenceCenter />;
      case "riskAppetiteKri":
        return <RiskAppetiteKriCenter />;
      case "smartReviews":
        return <SmartReviewCalendar />;
      case "committeeAutomation":
        return <CommitteeActionAutomationCenter />;
      case "stagingValidation":
        return <StagingValidationCenter />;
      case "rlsPersonaLab":
        return <RlsPersonaLab />;
      case "translationCoverage":
        return <TranslationCoverageCenter />;
      case "loadSeedCenter":
        return <LoadSeedCenter />;
      case "productionBackupStrategy":
        return <ProductionBackupStrategyCenter />;
      case "migrationRunbook":
        return <MigrationRunbookCenter />;
      case "scenarioTestConsole":
        return <ScenarioTestConsole setPage={setPage} />;
      case "controlledUatWorkbench":
        return <ControlledUatWorkbench setPage={setPage} />;
      case "uatIssueCapture":
        return <UatIssueCapture />;
      case "trainingGovernance":
        return <TrainingGovernanceCenter />;
      case "executiveTruth":
        return <ExecutiveTruthCenter />;
      case "productionReadiness":
        return <ProductionReadinessCenter />;
      case "admin":
        return <UserManagementCenter />;
      case "scaleBackupRestoreCenter":
        return <ScaleBackupRestoreCenter />;
      default:
        return <ExecutiveHub setPage={setPage} />;
    }
  };

  const content = canAccessPageForUser(
    page,
    auth.roles,
    auth.profile?.organizationName,
  ) ? (
    renderPage()
  ) : (
    <UnauthorizedPage page={page} setPage={setPage} />
  );

  return (
    <Layout page={page} navigateToPage={navigateToPage}>
      <Suspense fallback={<section className="page-section"><div className="panel route-loading-shell"><strong>{t("common.loading", "Loading workspace…")}</strong></div></section>}>
        {content}
      </Suspense>
    </Layout>
  );
}
