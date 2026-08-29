import type { PageKey } from "./pageLocation";

export type PageCategory =
  | "A_CORE_BUSINESS"
  | "B_ROLE_SPECIFIC_BUSINESS"
  | "C_ADMINISTRATION"
  | "D_INTERNAL_ENGINEERING"
  | "E_LEGACY_SUPERSEDED"
  | "F_UNCERTAIN";

export type BusinessTier =
  | "core"
  | "role_specific"
  | "secondary_business"
  | "secondary_help"
  | "administration"
  | "internal"
  | "legacy"
  | "uncertain";

export type SurfaceVisibility =
  | "VISIBLE"
  | "HIDDEN_FROM_NAVIGATION"
  | "INTERNAL_HIDDEN"
  | "LEGACY_HIDDEN";

export type DiscoverySurface =
  | "navigation"
  | "mobile"
  | "home"
  | "search"
  | "hub";

export interface PageSurfaceMetadata {
  title: string;
  category: PageCategory;
  businessTier: BusinessTier;
  navigationVisibility: SurfaceVisibility;
  mobileVisibility: SurfaceVisibility;
  homeVisibility: SurfaceVisibility;
  searchVisibility: SurfaceVisibility;
  hubVisibility: SurfaceVisibility;
  authorization: "existing-rbac";
  reason: string;
}

const CATEGORY_TIER: Record<PageCategory, BusinessTier> = {
  A_CORE_BUSINESS: "core",
  B_ROLE_SPECIFIC_BUSINESS: "role_specific",
  C_ADMINISTRATION: "administration",
  D_INTERNAL_ENGINEERING: "internal",
  E_LEGACY_SUPERSEDED: "legacy",
  F_UNCERTAIN: "uncertain",
};

function page(
  title: string,
  category: PageCategory,
  navigationVisibility: SurfaceVisibility,
  reason: string,
  overrides: Partial<Pick<PageSurfaceMetadata,
    "businessTier" | "mobileVisibility" | "homeVisibility" | "searchVisibility" | "hubVisibility"
  >> = {},
): PageSurfaceMetadata {
  return {
    title,
    category,
    businessTier: overrides.businessTier ?? CATEGORY_TIER[category],
    navigationVisibility,
    mobileVisibility: overrides.mobileVisibility ?? navigationVisibility,
    homeVisibility: overrides.homeVisibility ?? "HIDDEN_FROM_NAVIGATION",
    searchVisibility: overrides.searchVisibility ?? navigationVisibility,
    hubVisibility: overrides.hubVisibility ?? navigationVisibility,
    authorization: "existing-rbac",
    reason,
  };
}

const CORE = "A_CORE_BUSINESS" as const;
const ROLE = "B_ROLE_SPECIFIC_BUSINESS" as const;
const ADMIN = "C_ADMINISTRATION" as const;
const INTERNAL = "D_INTERNAL_ENGINEERING" as const;
const LEGACY = "E_LEGACY_SUPERSEDED" as const;
const VISIBLE = "VISIBLE" as const;
const DIRECT_ONLY = "HIDDEN_FROM_NAVIGATION" as const;
const INTERNAL_HIDDEN = "INTERNAL_HIDDEN" as const;
const LEGACY_HIDDEN = "LEGACY_HIDDEN" as const;

export const PAGE_SURFACE_REGISTRY = {
  home: page("Home", CORE, VISIBLE, "Primary business workspace."),
  executiveHub: page("Executive Workspace", LEGACY, LEGACY_HIDDEN, "Superseded by the current dashboard and reports workspace."),
  workHub: page("Work Center", LEGACY, LEGACY_HIDDEN, "Superseded by Daily Operations and My Work."),
  dailyOperationsHub: page("Workspace", CORE, VISIBLE, "Current daily work and operational queue."),
  grcHub: page("GRC", CORE, VISIBLE, "Current governance, risk, compliance, audit, and CAPA workspace.", { homeVisibility: VISIBLE }),
  qualityHub: page("Quality & Safety", CORE, VISIBLE, "Current quality, safety, and OVR workspace.", { homeVisibility: VISIBLE }),
  accreditationHub: page("Accreditation", CORE, VISIBLE, "Current accreditation and survey-readiness workspace.", { homeVisibility: VISIBLE }),
  evidenceHub: page("Evidence & Documents Hub", LEGACY, LEGACY_HIDDEN, "Superseded by the Policy, SOP, and Evidence destinations."),
  reportsHub: page("Reports & Analytics", CORE, VISIBLE, "Current governed reporting workspace.", { homeVisibility: VISIBLE }),
  adminHub: page("Administration", ADMIN, VISIBLE, "Current administration workspace.", { homeVisibility: VISIBLE }),
  productionOperatorConsole: page("Production Operator Console", INTERNAL, INTERNAL_HIDDEN, "Release-operation tooling, retained for authorized direct access."),
  productionEvidenceClosure: page("Production Evidence Closure", INTERNAL, INTERNAL_HIDDEN, "Release evidence tooling, retained for authorized direct access."),
  finishFast: page("Final Sprint Center", INTERNAL, INTERNAL_HIDDEN, "Historical release-control tooling."),
  productionFinish: page("Production Finish Center", INTERNAL, INTERNAL_HIDDEN, "Historical release-control tooling."),
  releaseFactory: page("Release Factory", INTERNAL, INTERNAL_HIDDEN, "Engineering release tooling."),
  productionProof: page("Production Proof", INTERNAL, INTERNAL_HIDDEN, "Engineering proof tooling."),
  dashboard: page("Dashboard", ROLE, VISIBLE, "Current role-entitled management dashboard."),
  analytics: page("Analytics", ROLE, VISIBLE, "Current role-entitled analytics surface."),
  myWork: page("My Work", CORE, VISIBLE, "Current personal work queue.", { homeVisibility: VISIBLE }),
  projects: page("Projects & Programs", CORE, VISIBLE, "Current project and program workspace.", { homeVisibility: VISIBLE }),
  departments: page("Departments", CORE, VISIBLE, "Current organization and department workspace."),
  risks: page("Risk Register", CORE, VISIBLE, "Current risk-management workspace."),
  compliance: page("Compliance", CORE, VISIBLE, "Current compliance workspace."),
  audit: page("Audit", CORE, VISIBLE, "Current audit workspace."),
  capa: page("CAPA", CORE, VISIBLE, "Current corrective and preventive action workspace."),
  ovr: page("OVR", CORE, VISIBLE, "Current occurrence and incident workspace."),
  ovrRisk: page("OVR Risk Indicators", ROLE, VISIBLE, "Current quality and safety indicator view."),
  governance: page("Governance", CORE, VISIBLE, "Current governance workspace."),
  escalations: page("Escalations", ROLE, VISIBLE, "Current role-entitled escalation queue."),
  approvals: page("Approvals", CORE, VISIBLE, "Current approval queue.", { homeVisibility: VISIBLE }),
  evidence: page("Evidence", CORE, VISIBLE, "Current governed evidence workspace.", { homeVisibility: VISIBLE }),
  importExport: page("Import & Export", ADMIN, DIRECT_ONLY, "Governed administration workflow available from its owning workspace.", { hubVisibility: VISIBLE }),
  accessControl: page("Access Control", ADMIN, VISIBLE, "Current role and access administration."),
  setupCenter: page("Organization Setup", ADMIN, VISIBLE, "Current organization configuration workspace."),
  userGuide: page("User Guide", CORE, DIRECT_ONLY, "Secondary help retained outside primary navigation.", { businessTier: "secondary_help", searchVisibility: VISIBLE, hubVisibility: VISIBLE }),
  operations: page("Operations", ROLE, VISIBLE, "Current operational notifications and activity surface."),
  testing: page("Testing Center", INTERNAL, INTERNAL_HIDDEN, "Engineering test tooling."),
  performance: page("Performance Center", INTERNAL, INTERNAL_HIDDEN, "Engineering performance proof tooling."),
  security: page("Security Audit Center", INTERNAL, INTERNAL_HIDDEN, "Engineering security proof tooling."),
  commandCenter: page("Executive Command Center", LEGACY, LEGACY_HIDDEN, "Superseded by the current dashboard and reports workspace."),
  globalSearch: page("Global Search", CORE, VISIBLE, "Current governed business-data search."),
  documents: page("Policy Register", CORE, VISIBLE, "Current governed policy register."),
  sops: page("SOP Register", CORE, VISIBLE, "Current governed procedure register."),
  relationships: page("Governance Relationships", ROLE, VISIBLE, "Current governed clause and control relationship map."),
  releaseCandidate: page("Release Candidate", INTERNAL, INTERNAL_HIDDEN, "Engineering release-control tooling."),
  productionRelease: page("Production Release", INTERNAL, INTERNAL_HIDDEN, "Engineering release-control tooling."),
  migrationVerifier: page("Migration Verifier", INTERNAL, INTERNAL_HIDDEN, "Database migration proof tooling."),
  restoreDryRun: page("Restore Dry-Run", INTERNAL, INTERNAL_HIDDEN, "Backup and restore proof tooling."),
  adminSafety: page("Admin Safety Console", INTERNAL, INTERNAL_HIDDEN, "Privileged operational safety tooling."),
  bilingualDictionary: page("Bilingual Dictionary", ADMIN, VISIBLE, "Current bilingual master-data administration."),
  boardPacks: page("Board Packs", ROLE, VISIBLE, "Current role-entitled management reporting."),
  reportBuilder: page("Report Builder", ROLE, VISIBLE, "Current role-entitled report authoring."),
  evidenceVault: page("Evidence Vault", LEGACY, LEGACY_HIDDEN, "Superseded in normal discovery by the current Evidence workspace."),
  departmentScorecards: page("Department Scorecards", ROLE, VISIBLE, "Current department performance view."),
  backupScheduler: page("Backup Scheduler", INTERNAL, INTERNAL_HIDDEN, "Infrastructure administration and proof tooling."),
  scenarioPlanning: page("Scenario Planning", ROLE, DIRECT_ONLY, "Secondary risk and analytics capability retained outside primary navigation.", { businessTier: "secondary_business", searchVisibility: VISIBLE, hubVisibility: VISIBLE }),
  mobileCommand: page("Executive Mobile Command", LEGACY, LEGACY_HIDDEN, "Superseded by responsive current management views."),
  automationIntelligence: page("Automation Intelligence", INTERNAL, INTERNAL_HIDDEN, "Specialized automation administration and technical rule details are retained for authorized direct access."),
  riskAppetiteKri: page("Risk Appetite & KRI", ROLE, DIRECT_ONLY, "Secondary risk capability retained through its owning GRC workspace.", { businessTier: "secondary_business", searchVisibility: VISIBLE, hubVisibility: VISIBLE }),
  smartReviews: page("Review Calendar", ROLE, VISIBLE, "Current governance review calendar."),
  committeeAutomation: page("Committees", ROLE, VISIBLE, "Current committee action workspace."),
  stagingValidation: page("Staging Validation", INTERNAL, INTERNAL_HIDDEN, "Staging and release proof tooling."),
  rlsPersonaLab: page("RLS Persona Lab", INTERNAL, INTERNAL_HIDDEN, "Security test tooling."),
  translationCoverage: page("Translation Coverage", INTERNAL, INTERNAL_HIDDEN, "Engineering localization proof tooling."),
  loadSeedCenter: page("Load & Seed Center", INTERNAL, INTERNAL_HIDDEN, "Synthetic-data and load-test tooling."),
  productionBackupStrategy: page("Production Backup Strategy", INTERNAL, INTERNAL_HIDDEN, "Infrastructure proof and release tooling."),
  migrationRunbook: page("Migration Runbook", INTERNAL, INTERNAL_HIDDEN, "Database migration operation tooling."),
  controlledUatWorkbench: page("Controlled UAT Workbench", INTERNAL, INTERNAL_HIDDEN, "UAT and test execution tooling."),
  scenarioTestConsole: page("Scenario Test Console", INTERNAL, INTERNAL_HIDDEN, "Synthetic scenario test tooling."),
  uatIssueCapture: page("UAT Issue Capture", INTERNAL, INTERNAL_HIDDEN, "UAT test tooling."),
  trainingGovernance: page("Training Governance", CORE, VISIBLE, "Current training and competency governance workspace."),
  executiveTruth: page("Executive Summary", ROLE, VISIBLE, "Current executive governed reporting view."),
  productionReadiness: page("Production Readiness", INTERNAL, INTERNAL_HIDDEN, "Release-readiness proof tooling."),
  admin: page("User Management", ADMIN, VISIBLE, "Current governed user lifecycle administration."),
  scaleBackupRestoreCenter: page("Backup & Restore Center", INTERNAL, INTERNAL_HIDDEN, "Infrastructure scale and restore proof tooling."),
} as const satisfies Record<PageKey, PageSurfaceMetadata>;

const VISIBILITY_FIELD: Record<DiscoverySurface, keyof PageSurfaceMetadata> = {
  navigation: "navigationVisibility",
  mobile: "mobileVisibility",
  home: "homeVisibility",
  search: "searchVisibility",
  hub: "hubVisibility",
};

export function pageVisibility(
  pageKey: PageKey,
  surface: DiscoverySurface,
): SurfaceVisibility {
  return PAGE_SURFACE_REGISTRY[pageKey][VISIBILITY_FIELD[surface]] as SurfaceVisibility;
}

export function isPageVisibleOnSurface(
  pageKey: PageKey,
  surface: DiscoverySurface,
): boolean {
  return pageVisibility(pageKey, surface) === "VISIBLE";
}

export function pagesInCategory(category: PageCategory): PageKey[] {
  return (Object.keys(PAGE_SURFACE_REGISTRY) as PageKey[]).filter(
    (pageKey) => PAGE_SURFACE_REGISTRY[pageKey].category === category,
  );
}
