import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import {
  Activity,
  ChevronDown,
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
  GraduationCap,
  FileSpreadsheet,
} from "lucide-react";
import { useI18n } from "../i18n/I18nContext";
import { useAuth } from "../auth/AuthProvider";
import {
  canAccessPageForUser,
  isExternalPilotOrganization,
} from "../auth/authAccess";
import { isScenarioLabEnabled } from "../lib/scenarioLab";
import { ControlledPilotBanner } from "./ControlledPilotBanner";

export type PageKey =
  | "home"
  | "executiveHub"
  | "workHub"
  | "dailyOperationsHub"
  | "grcHub"
  | "qualityHub"
  | "accreditationHub"
  | "evidenceHub"
  | "reportsHub"
  | "adminHub"
  | "productionOperatorConsole"
  | "productionEvidenceClosure"
  | "finishFast"
  | "productionFinish"
  | "releaseFactory"
  | "productionProof"
  | "dashboard"
  | "analytics"
  | "myWork"
  | "projects"
  | "departments"
  | "risks"
  | "compliance"
  | "audit"
  | "ovr"
  | "ovrRisk"
  | "governance"
  | "escalations"
  | "approvals"
  | "evidence"
  | "importExport"
  | "accessControl"
  | "setupCenter"
  | "userGuide"
  | "operations"
  | "testing"
  | "performance"
  | "security"
  | "commandCenter"
  | "globalSearch"
  | "documents"
  | "relationships"
  | "releaseCandidate"
  | "productionRelease"
  | "migrationVerifier"
  | "restoreDryRun"
  | "adminSafety"
  | "bilingualDictionary"
  | "boardPacks"
  | "reportBuilder"
  | "evidenceVault"
  | "departmentScorecards"
  | "backupScheduler"
  | "scenarioPlanning"
  | "mobileCommand"
  | "automationIntelligence"
  | "riskAppetiteKri"
  | "smartReviews"
  | "committeeAutomation"
  | "stagingValidation"
  | "rlsPersonaLab"
  | "translationCoverage"
  | "loadSeedCenter"
  | "productionBackupStrategy"
  | "migrationRunbook"
  | "controlledUatWorkbench"
  | "scenarioTestConsole"
  | "uatIssueCapture"
  | "trainingGovernance"
  | "executiveTruth"
  | "productionReadiness"
  | "admin";

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

interface NavTreeItem {
  key: PageKey;
  label: string;
  icon: ReactNode;
  hint?: string;
}

interface NavTreeGroup {
  id: string;
  label: string;
  hint?: string;
  icon: ReactNode;
  page?: PageKey;
  children?: NavTreeItem[];
}

const primaryNav: NavItem[] = [
  {
    key: "home",
    labelKey: "nav.home",
    hintKey: "nav.home.hint",
    icon: <Home size={18} />,
  },
  {
    key: "dailyOperationsHub",
    labelKey: "nav.workspace",
    hintKey: "nav.workspace.hint",
    icon: <GanttChartSquare size={18} />,
  },
  {
    key: "qualityHub",
    labelKey: "nav.qualitySafety",
    hintKey: "nav.qualitySafety.hint",
    icon: <Hospital size={18} />,
  },
  {
    key: "accreditationHub",
    labelKey: "nav.accreditation",
    hintKey: "nav.accreditation.hint",
    icon: <ClipboardCheck size={18} />,
  },
  {
    key: "evidenceHub",
    labelKey: "nav.policies",
    hintKey: "nav.policies.hint",
    icon: <FolderKanban size={18} />,
  },
  {
    key: "reportsHub",
    labelKey: "nav.dashboards",
    hintKey: "nav.dashboards.hint",
    icon: <Activity size={18} />,
  },
  {
    key: "adminHub",
    labelKey: "nav.admin",
    hintKey: "nav.admin.hint",
    icon: <LockKeyhole size={18} />,
  },
];

const quickLinks: NavItem[] = [
  { key: "myWork", labelKey: "nav.myWork", icon: <UserCheck size={18} /> },
  { key: "ovr", labelKey: "nav.ovr", icon: <Hospital size={18} /> },
  {
    key: "approvals",
    labelKey: "nav.approvals",
    icon: <ClipboardCheck size={18} />,
  },
  {
    key: "globalSearch",
    labelKey: "nav.globalSearch",
    icon: <Search size={18} />,
  },
];

const uatLinks: NavItem[] = isScenarioLabEnabled
  ? [
      {
        key: "controlledUatWorkbench",
        labelKey: "nav.controlledUatWorkbench",
        icon: <ClipboardCheck size={18} />,
      },
      {
        key: "uatIssueCapture",
        labelKey: "nav.uatIssueCapture",
        icon: <Bug size={18} />,
      },
      {
        key: "scenarioTestConsole",
        labelKey: "nav.scenarioLab",
        icon: <WandSparkles size={18} />,
      },
    ]
  : [];

const navTree: NavTreeGroup[] = [
  {
    id: "home",
    label: "Home",
    hint: "Start here",
    page: "home",
    icon: <Home size={18} />,
  },
  {
    id: "workspace",
    label: "Workspace",
    hint: "Daily work queues",
    page: "dailyOperationsHub",
    icon: <GanttChartSquare size={18} />,
    children: [
      { key: "myWork", label: "My Work", icon: <UserCheck size={16} /> },
      { key: "operations", label: "Operations", icon: <BellRing size={16} /> },
      {
        key: "departments",
        label: "Departments",
        icon: <Building2 size={16} />,
      },
      {
        key: "projects",
        label: "Projects",
        icon: <GanttChartSquare size={16} />,
      },
      { key: "escalations", label: "Escalations", icon: <Siren size={16} /> },
      {
        key: "approvals",
        label: "Approvals",
        icon: <ClipboardCheck size={16} />,
      },
    ],
  },
  {
    id: "quality",
    label: "Quality & Safety",
    hint: "Incidents, risks, audits",
    page: "qualityHub",
    icon: <Hospital size={18} />,
    children: [
      { key: "ovr", label: "OVR / Incidents", icon: <Hospital size={16} /> },
      {
        key: "ovrRisk",
        label: "OVR Risk Indicators",
        icon: <Radar size={16} />,
      },
      { key: "risks", label: "Risk Register", icon: <ShieldAlert size={16} /> },
      { key: "audit", label: "Audit", icon: <FileSearch size={16} /> },
      {
        key: "compliance",
        label: "Compliance",
        icon: <ClipboardCheck size={16} />,
      },
      { key: "governance", label: "Governance", icon: <Landmark size={16} /> },
    ],
  },
  {
    id: "accreditation",
    label: "Accreditation",
    hint: "Standards and evidence",
    page: "accreditationHub",
    icon: <ClipboardCheck size={18} />,
    children: [
      {
        key: "evidence",
        label: "Evidence Library",
        icon: <FileCheck2 size={16} />,
      },
      {
        key: "documents",
        label: "Document Control",
        icon: <FolderKanban size={16} />,
      },
      {
        key: "relationships",
        label: "Clause / Control Map",
        icon: <Network size={16} />,
      },
      {
        key: "evidenceVault",
        label: "Evidence Vault",
        icon: <FileStack size={16} />,
      },
      {
        key: "departmentScorecards",
        label: "Department Scorecards",
        icon: <Radar size={16} />,
      },
    ],
  },
  {
    id: "policies",
    label: "Policies & SOPs",
    hint: "Policies and attestations",
    page: "evidenceHub",
    icon: <FolderKanban size={18} />,
    children: [
      { key: "documents", label: "Policies", icon: <FolderKanban size={16} /> },
      {
        key: "evidenceVault",
        label: "SOP Attestations",
        icon: <FileStack size={16} />,
      },
      {
        key: "bilingualDictionary",
        label: "Bilingual Dictionary",
        icon: <Languages size={16} />,
      },
      {
        key: "trainingGovernance",
        label: "Training Governance",
        icon: <GraduationCap size={16} />,
      },
    ],
  },
  {
    id: "dashboards",
    label: "Dashboards",
    hint: "Executive and operational views",
    page: "reportsHub",
    icon: <Activity size={18} />,
    children: [
      {
        key: "executiveTruth",
        label: "Executive Truth",
        icon: <FileSpreadsheet size={16} />,
      },
      {
        key: "productionReadiness",
        label: "Production Readiness",
        icon: <ClipboardList size={16} />,
      },
      {
        key: "productionOperatorConsole",
        label: "Production Operator Console",
        icon: <Command size={16} />,
      },
      {
        key: "productionEvidenceClosure",
        label: "Production Evidence Closure",
        icon: <FileCheck2 size={16} />,
      },
      { key: "dashboard", label: "Dashboard", icon: <Activity size={16} /> },
      { key: "analytics", label: "Analytics", icon: <Gauge size={16} /> },
      {
        key: "reportBuilder",
        label: "Report Builder",
        icon: <BookCopy size={16} />,
      },
      { key: "boardPacks", label: "Board Packs", icon: <BookCopy size={16} /> },
    ],
  },
  {
    id: "admin",
    label: "Admin & Organization",
    hint: "Users, access, setup",
    page: "admin",
    icon: <LockKeyhole size={18} />,
    children: [
      { key: "admin", label: "User Management", icon: <Users size={16} /> },
      {
        key: "accessControl",
        label: "Access Control",
        icon: <KeyRound size={16} />,
      },
      {
        key: "setupCenter",
        label: "Organization Setup",
        icon: <Rocket size={16} />,
      },
      {
        key: "importExport",
        label: "Real Data Import",
        icon: <UploadCloud size={16} />,
      },
      {
        key: "adminSafety",
        label: "Admin Safety",
        icon: <LockKeyhole size={16} />,
      },
      {
        key: "backupScheduler",
        label: "Backup Scheduler",
        icon: <DatabaseBackup size={16} />,
      },
      {
        key: "migrationRunbook",
        label: "Migration Runbook",
        icon: <ClipboardList size={16} />,
      },
      {
        key: "restoreDryRun",
        label: "Restore Dry-Run",
        icon: <UploadCloud size={16} />,
      },
      {
        key: "controlledUatWorkbench",
        label: "UAT Controls",
        icon: <ClipboardCheck size={16} />,
      },
      { key: "uatIssueCapture", label: "UAT Issues", icon: <Bug size={16} /> },
      {
        key: "scenarioTestConsole",
        label: "Scenario Lab",
        icon: <WandSparkles size={16} />,
      },
      {
        key: "loadSeedCenter",
        label: "Load / Seed Center",
        icon: <FileSearch size={16} />,
      },
    ],
  },
  {
    id: "internal",
    label: "Internal / System Tools",
    hint: "Super admin only",
    page: "adminHub",
    icon: <LockKeyhole size={18} />,
    children: [
      {
        key: "finishFast",
        label: "Final Sprint Center",
        icon: <Rocket size={16} />,
      },
      {
        key: "productionFinish",
        label: "Production Finish Center",
        icon: <Rocket size={16} />,
      },
      {
        key: "releaseFactory",
        label: "Release Factory Center",
        icon: <Rocket size={16} />,
      },
      {
        key: "productionProof",
        label: "Production Proof Center",
        icon: <Rocket size={16} />,
      },
      {
        key: "releaseCandidate",
        label: "Release Candidate Center",
        icon: <Rocket size={16} />,
      },
      {
        key: "productionRelease",
        label: "Production Release Center",
        icon: <Rocket size={16} />,
      },
      {
        key: "migrationVerifier",
        label: "Migration Verifier",
        icon: <ClipboardList size={16} />,
      },
      {
        key: "migrationRunbook",
        label: "Migration Runbook",
        icon: <ClipboardList size={16} />,
      },
      {
        key: "restoreDryRun",
        label: "Restore Dry-Run",
        icon: <UploadCloud size={16} />,
      },
      {
        key: "rlsPersonaLab",
        label: "RLS Persona Lab",
        icon: <LockKeyhole size={16} />,
      },
      {
        key: "stagingValidation",
        label: "Staging Validation",
        icon: <TestTubeDiagonal size={16} />,
      },
      {
        key: "loadSeedCenter",
        label: "Load / Seed Center",
        icon: <DatabaseBackup size={16} />,
      },
      {
        key: "scenarioTestConsole",
        label: "Scenario Test Console",
        icon: <WandSparkles size={16} />,
      },
      {
        key: "controlledUatWorkbench",
        label: "Controlled UAT Workbench",
        icon: <ClipboardCheck size={16} />,
      },
      {
        key: "uatIssueCapture",
        label: "UAT Issue Capture",
        icon: <Bug size={16} />,
      },
      {
        key: "testing",
        label: "Testing Center",
        icon: <ClipboardList size={16} />,
      },
      {
        key: "performance",
        label: "Performance Center",
        icon: <Gauge size={16} />,
      },
      {
        key: "security",
        label: "Security Audit Center",
        icon: <LockKeyhole size={16} />,
      },
      {
        key: "translationCoverage",
        label: "Translation Coverage",
        icon: <Languages size={16} />,
      },
      {
        key: "productionBackupStrategy",
        label: "Production Backup Strategy",
        icon: <DatabaseBackup size={16} />,
      },
      {
        key: "backupScheduler",
        label: "Backup Scheduler",
        icon: <DatabaseBackup size={16} />,
      },
      {
        key: "productionEvidenceClosure",
        label: "Final Runtime Security Closure",
        icon: <LockKeyhole size={16} />,
      },
      {
        key: "productionReadiness",
        label: "Production Hardening Launch",
        icon: <ShieldAlert size={16} />,
      },
      {
        key: "adminSafety",
        label: "Admin Safety Console",
        icon: <LockKeyhole size={16} />,
      },
    ],
  },
];

export const legacyNavItems: NavItem[] = [
  {
    key: "executiveTruth" as const,
    labelKey: "nav.executiveTruth",
    icon: <FileSpreadsheet size={18} />,
  },
  {
    key: "trainingGovernance" as const,
    labelKey: "nav.trainingGovernance",
    icon: <GraduationCap size={18} />,
  },
  { key: "dashboard", labelKey: "nav.dashboard", icon: <Activity size={18} /> },
  { key: "analytics", labelKey: "nav.analytics", icon: <Activity size={18} /> },
  {
    key: "projects",
    labelKey: "nav.projects",
    icon: <GanttChartSquare size={18} />,
  },
  {
    key: "departments",
    labelKey: "nav.departments",
    icon: <Building2 size={18} />,
  },
  { key: "risks", labelKey: "nav.risks", icon: <ShieldAlert size={18} /> },
  {
    key: "compliance",
    labelKey: "nav.compliance",
    icon: <ClipboardCheck size={18} />,
  },
  { key: "audit", labelKey: "nav.audit", icon: <FileSearch size={18} /> },
  { key: "ovrRisk", labelKey: "nav.ovrRisk", icon: <Radar size={18} /> },
  {
    key: "governance",
    labelKey: "nav.governance",
    icon: <Landmark size={18} />,
  },
  {
    key: "escalations",
    labelKey: "nav.escalations",
    icon: <Siren size={18} />,
  },
  { key: "evidence", labelKey: "nav.evidence", icon: <FileCheck2 size={18} /> },
  {
    key: "importExport",
    labelKey: "nav.importExport",
    icon: <UploadCloud size={18} />,
  },
  {
    key: "accessControl",
    labelKey: "nav.accessControl",
    icon: <KeyRound size={18} />,
  },
  {
    key: "setupCenter",
    labelKey: "nav.setupCenter",
    icon: <Rocket size={18} />,
  },
  { key: "userGuide", labelKey: "nav.userGuide", icon: <BookCopy size={18} /> },
  {
    key: "operations",
    labelKey: "nav.operations",
    icon: <BellRing size={18} />,
  },
  {
    key: "commandCenter",
    labelKey: "nav.commandCenter",
    icon: <Command size={18} />,
  },
  {
    key: "documents",
    labelKey: "nav.documents",
    icon: <FolderKanban size={18} />,
  },
  {
    key: "relationships",
    labelKey: "nav.relationships",
    icon: <Network size={18} />,
  },
  {
    key: "boardPacks",
    labelKey: "nav.boardPacks",
    icon: <BookCopy size={18} />,
  },
  {
    key: "mobileCommand",
    labelKey: "nav.mobileCommand",
    icon: <Smartphone size={18} />,
  },
  {
    key: "departmentScorecards",
    labelKey: "nav.departmentScorecards",
    icon: <Radar size={18} />,
  },
  {
    key: "reportBuilder",
    labelKey: "nav.reportBuilder",
    icon: <BookCopy size={18} />,
  },
  {
    key: "evidenceVault",
    labelKey: "nav.evidenceVault",
    icon: <FileStack size={18} />,
  },
  {
    key: "scenarioPlanning",
    labelKey: "nav.scenarioPlanning",
    icon: <ShieldAlert size={18} />,
  },
  {
    key: "automationIntelligence",
    labelKey: "nav.automationIntelligence",
    icon: <Activity size={18} />,
  },
  {
    key: "riskAppetiteKri",
    labelKey: "nav.riskAppetiteKri",
    icon: <Gauge size={18} />,
  },
  {
    key: "smartReviews",
    labelKey: "nav.smartReviews",
    icon: <ClipboardList size={18} />,
  },
  {
    key: "committeeAutomation",
    labelKey: "nav.committeeAutomation",
    icon: <Landmark size={18} />,
  },
  {
    key: "bilingualDictionary",
    labelKey: "nav.bilingualDictionary",
    icon: <Languages size={18} />,
  },
  { key: "admin", labelKey: "nav.admin", icon: <Users size={18} /> },
];

function NavButton({
  item,
  page,
  setPage,
  showHint = false,
}: {
  item: NavItem;
  page: PageKey;
  setPage: (page: PageKey) => void;
  showHint?: boolean;
}) {
  const { t } = useI18n();
  return (
    <button
      key={item.key}
      className={`nav-item ${page === item.key ? "active" : ""}`}
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

function NavTreeButton({
  item,
  page,
  setPage,
}: {
  item: NavTreeItem;
  page: PageKey;
  setPage: (page: PageKey) => void;
}) {
  return (
    <button
      className={`nav-child-item ${page === item.key ? "active" : ""}`}
      onClick={() => setPage(item.key)}
      type="button"
    >
      {item.icon}
      <span>{item.label}</span>
    </button>
  );
}

export function Layout({ page, setPage, children }: LayoutProps) {
  const { language, direction, toggleLanguage, t } = useI18n();
  const auth = useAuth();
  const organizationName = auth.profile?.organizationName;
  const canOpen = (targetPage: PageKey) =>
    canAccessPageForUser(targetPage, auth.roles, organizationName);
  const [openGroups, setOpenGroups] = useState<Set<string>>(
    () => new Set(["workspace", "admin"]),
  );
  const allowedNavTree = useMemo(
    () =>
      navTree
        .map((group) => {
          const allowedChildren = (group.children ?? []).filter((item) =>
            canOpen(item.key),
          );
          const groupAllowed = group.page ? canOpen(group.page) : false;
          return { ...group, children: allowedChildren, groupAllowed };
        })
        .filter((group) => group.groupAllowed || group.children.length > 0),
    [auth.roles, organizationName],
  );
  const activeGroupId = allowedNavTree.find(
    (group) =>
      group.page === page || group.children.some((item) => item.key === page),
  )?.id;
  const isLegacyPage = !allowedNavTree.some(
    (group) =>
      group.page === page || group.children.some((item) => item.key === page),
  );
  const displayName =
    language === "ar" && auth.profile?.fullNameAr
      ? auth.profile.fullNameAr
      : auth.profile?.fullNameEn;
  const externalPilot = isExternalPilotOrganization(organizationName);
  const toggleGroup = (groupId: string) => {
    setOpenGroups((previous) => {
      const next = new Set(previous);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  return (
    <div
      className={`app-shell modern-app-shell ${direction === "rtl" ? "rtl-shell" : ""}`}
      dir={direction}
    >
      <aside className="sidebar modern-sidebar">
        <div className="brand-block brand-block-modern">
          <div className="brand-mark">GRC</div>
          <div>
            <h1>{t("app.shortTitle")}</h1>
            <p>{t("app.tagline")}</p>
          </div>
        </div>

        <button
          className="language-toggle"
          onClick={toggleLanguage}
          title={t("language.current")}
          type="button"
        >
          <Languages size={17} />
          <span>
            {language === "en"
              ? t("language.switchToArabic")
              : t("language.switchToEnglish")}
          </span>
        </button>

        <nav
          className="nav-list nav-list-modern sidebar-nav-tree"
          aria-label="Primary navigation"
        >
          <div className="nav-section-label">Navigation</div>
          {allowedNavTree.map((group) => {
            const groupActive =
              group.page === page ||
              group.children.some((item) => item.key === page);
            const expanded =
              openGroups.has(group.id) || activeGroupId === group.id;
            const hasChildren = group.children.length > 0;

            if (!hasChildren && group.page) {
              return (
                <button
                  key={group.id}
                  className={`nav-group-trigger nav-group-trigger--single ${groupActive ? "active" : ""}`}
                  onClick={() => setPage(group.page as PageKey)}
                  type="button"
                >
                  {group.icon}
                  <span>
                    <strong>{group.label}</strong>
                    {group.hint ? <small>{group.hint}</small> : null}
                  </span>
                </button>
              );
            }

            return (
              <div
                className={`nav-tree-group ${groupActive ? "active" : ""}`}
                key={group.id}
              >
                <button
                  className={`nav-group-trigger ${groupActive ? "active" : ""}`}
                  onClick={() => {
                    if (group.page && !expanded) setPage(group.page);
                    toggleGroup(group.id);
                  }}
                  type="button"
                  aria-expanded={expanded}
                >
                  {group.icon}
                  <span>
                    <strong>{group.label}</strong>
                    {group.hint ? <small>{group.hint}</small> : null}
                  </span>
                  <ChevronDown
                    className={`nav-group-chevron ${expanded ? "expanded" : ""}`}
                    size={15}
                  />
                </button>
                {expanded ? (
                  <div className="nav-child-list">
                    {group.children.map((item) => (
                      <NavTreeButton
                        key={item.key}
                        item={item}
                        page={page}
                        setPage={setPage}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}

          {externalPilot ? (
            <div className="sidebar-footnote">
              {t("nav.externalPilotScope")}
            </div>
          ) : null}
          <div className="sidebar-footnote">
            Use the expandable groups above to open subsidiary control pages.
          </div>

          {isLegacyPage ? (
            <div className="legacy-active-banner">
              <span>{t("nav.legacyMode")}</span>
              <button type="button" onClick={() => setPage("executiveHub")}>
                {t("nav.backToHubs")}
              </button>
            </div>
          ) : null}
        </nav>
      </aside>

      <main className="main-content modern-main-content">
        <header className="topbar modern-topbar">
          <div>
            <p className="eyebrow">{t("app.company")}</p>
            <h2>{t("app.title")}</h2>
          </div>
          <div className="topbar-actions">
            <ControlledPilotBanner compact />
            {canOpen("globalSearch") ? (
              <button
                className="ghost-button"
                onClick={() => setPage("globalSearch")}
                type="button"
              >
                <Search size={16} />
                {t("nav.globalSearch")}
              </button>
            ) : null}
            <button
              className="ghost-button"
              onClick={toggleLanguage}
              type="button"
            >
              <Languages size={16} />
              {language === "en" ? "AR" : "EN"}
            </button>
            <div className="auth-user-pill" title={auth.profile?.email}>
              <span>{displayName}</span>
              <small>{auth.primaryRole}</small>
            </div>
            {auth.isLocalBypass ? (
              <div className="topbar-pill topbar-pill--warning">DEV AUTH</div>
            ) : null}
            <button
              className="ghost-button"
              onClick={() => void auth.signOut()}
              type="button"
            >
              <LogOut size={16} />
              {language === "ar" ? "خروج" : "Sign out"}
            </button>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
