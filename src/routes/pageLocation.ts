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
  | "sops"
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
  | "admin"
  | "scaleBackupRestoreCenter";

export const PAGE_QUERY_PARAMETER = "page";

/**
 * This is the single bidirectional registry for application pages and their
 * public, non-sensitive URL values. Values are intentionally stable and do
 * not contain record identifiers or transient page state.
 */
export const PAGE_LOCATION_REGISTRY = {
  home: "home",
  executiveHub: "executive",
  workHub: "work",
  dailyOperationsHub: "daily-operations",
  grcHub: "grc",
  qualityHub: "quality",
  accreditationHub: "accreditation",
  evidenceHub: "evidence-hub",
  reportsHub: "reports",
  adminHub: "admin-hub",
  productionOperatorConsole: "production-operator-console",
  productionEvidenceClosure: "production-evidence-closure",
  finishFast: "finish-fast",
  productionFinish: "production-finish",
  releaseFactory: "release-factory",
  productionProof: "production-proof",
  dashboard: "dashboard",
  analytics: "analytics",
  myWork: "my-work",
  projects: "projects",
  departments: "departments",
  risks: "risks",
  compliance: "compliance",
  audit: "audit",
  ovr: "ovr",
  ovrRisk: "ovr-risk",
  governance: "governance",
  escalations: "escalations",
  approvals: "approvals",
  evidence: "evidence",
  importExport: "import-export",
  accessControl: "access-control",
  setupCenter: "setup",
  userGuide: "user-guide",
  operations: "operations",
  testing: "testing",
  performance: "performance",
  security: "security",
  commandCenter: "command-center",
  globalSearch: "global-search",
  documents: "documents",
  sops: "sops",
  relationships: "relationships",
  releaseCandidate: "release-candidate",
  productionRelease: "production-release",
  migrationVerifier: "migration-verifier",
  restoreDryRun: "restore-dry-run",
  adminSafety: "admin-safety",
  bilingualDictionary: "bilingual-dictionary",
  boardPacks: "board-packs",
  reportBuilder: "report-builder",
  evidenceVault: "evidence-vault",
  departmentScorecards: "department-scorecards",
  backupScheduler: "backup-scheduler",
  scenarioPlanning: "scenario-planning",
  mobileCommand: "mobile-command",
  automationIntelligence: "automation-intelligence",
  riskAppetiteKri: "risk-appetite-kri",
  smartReviews: "smart-reviews",
  committeeAutomation: "committee-automation",
  stagingValidation: "staging-validation",
  rlsPersonaLab: "rls-persona-lab",
  translationCoverage: "translation-coverage",
  loadSeedCenter: "load-seed",
  productionBackupStrategy: "production-backup-strategy",
  migrationRunbook: "migration-runbook",
  controlledUatWorkbench: "controlled-uat",
  scenarioTestConsole: "scenario-test-console",
  uatIssueCapture: "uat-issue-capture",
  trainingGovernance: "training-governance",
  executiveTruth: "executive-truth",
  productionReadiness: "production-readiness",
  admin: "admin",
  scaleBackupRestoreCenter: "scale-backup-restore",
} as const satisfies Record<PageKey, string>;

export const PAGE_PATHNAME_ALIASES = {
  "/production-operator-console": "productionOperatorConsole",
  "/production-evidence-closure": "productionEvidenceClosure",
} as const satisfies Record<string, PageKey>;

const pageByLocationValue = new Map<string, PageKey>(
  Object.entries(PAGE_LOCATION_REGISTRY).map(([page, value]) => [
    value,
    page as PageKey,
  ]),
);

export type PageNavigationMode = "push" | "replace";

export interface PageNavigationOptions {
  mode?: PageNavigationMode;
}

export type PageNavigator = (
  page: PageKey,
  options?: PageNavigationOptions,
) => void;

export interface PageLocationLike {
  pathname: string;
  search: string;
  hash?: string;
}

export interface PageHistoryLike {
  pushState(data: unknown, unused: string, url?: string | URL | null): void;
  replaceState(data: unknown, unused: string, url?: string | URL | null): void;
}

export interface PageLocationWriteEnvironment {
  location: PageLocationLike;
  history: PageHistoryLike;
}

export interface AuthorizedPageResolution {
  page: PageKey;
  shouldReplace: boolean;
  reason: "allowed" | "invalid" | "unauthorized";
}

const SENSITIVE_QUERY_KEY =
  /(?:token|password|secret|credential|authorization|confirmation|session|(?:user|employee|organization|workbook|file|row|record)id)|(?:^|[_-])(?:code|otp|state|redirect|return|employee|user|organization|workbook|file|row|record|id)(?:$|[_-])/i;

function normalizedPathname(pathname: string): string {
  const normalized = pathname.trim().toLowerCase();
  if (normalized === "/") return normalized;
  return normalized.replace(/\/+$/, "") || "/";
}

export function isPageKey(value: unknown): value is PageKey {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(PAGE_LOCATION_REGISTRY, value)
  );
}

export function pageKeyFromLocationValue(value: unknown): PageKey | null {
  if (typeof value !== "string") return null;
  return pageByLocationValue.get(value) ?? null;
}

/**
 * Query navigation takes precedence over historical pathname aliases. An
 * explicitly invalid or duplicated page value is rejected rather than being
 * silently interpreted as another page.
 */
export function pageKeyFromLocation(
  location: PageLocationLike,
): PageKey | null {
  const parameters = new URLSearchParams(location.search);
  if (parameters.has(PAGE_QUERY_PARAMETER)) {
    const values = parameters.getAll(PAGE_QUERY_PARAMETER);
    if (values.length !== 1) return null;
    return pageKeyFromLocationValue(values[0]);
  }

  const alias = PAGE_PATHNAME_ALIASES[
    normalizedPathname(location.pathname) as keyof typeof PAGE_PATHNAME_ALIASES
  ];
  return alias ?? "home";
}

export function isSafeNavigationQueryParameter(key: string): boolean {
  const normalized = key.trim().toLowerCase();
  return (
    normalized !== PAGE_QUERY_PARAMETER &&
    normalized.length > 0 &&
    !SENSITIVE_QUERY_KEY.test(normalized)
  );
}

export function pageUrlForLocation(
  page: PageKey,
  location: PageLocationLike,
): string {
  const nextParameters = new URLSearchParams();
  const currentParameters = new URLSearchParams(location.search);

  currentParameters.forEach((value, key) => {
    if (isSafeNavigationQueryParameter(key)) {
      nextParameters.append(key, value);
    }
  });
  nextParameters.set(PAGE_QUERY_PARAMETER, PAGE_LOCATION_REGISTRY[page]);

  const pathname = location.pathname || "/";
  const search = nextParameters.toString();
  return `${pathname}${search ? `?${search}` : ""}`;
}

export function isCanonicalPageLocation(
  location: PageLocationLike,
  page: PageKey,
): boolean {
  const currentUrl = `${location.pathname || "/"}${location.search}${location.hash ?? ""}`;
  return currentUrl === pageUrlForLocation(page, location);
}

export function writePageLocation(
  candidate: unknown,
  options: PageNavigationOptions = {},
  environment?: PageLocationWriteEnvironment,
): string | null {
  if (!isPageKey(candidate)) return null;

  const activeEnvironment =
    environment ??
    (typeof window === "undefined"
      ? null
      : { location: window.location, history: window.history });
  if (!activeEnvironment) return null;

  const nextUrl = pageUrlForLocation(candidate, activeEnvironment.location);
  const currentUrl = `${activeEnvironment.location.pathname}${activeEnvironment.location.search}${activeEnvironment.location.hash ?? ""}`;
  if (nextUrl === currentUrl) return nextUrl;

  if (options.mode === "replace") {
    activeEnvironment.history.replaceState(null, "", nextUrl);
  } else {
    activeEnvironment.history.pushState(null, "", nextUrl);
  }
  return nextUrl;
}

export function resolveAuthorizedPage(
  requestedPage: PageKey | null,
  canAccess: (page: PageKey) => boolean,
  firstAllowed: PageKey,
): AuthorizedPageResolution {
  const fallback =
    isPageKey(firstAllowed) && canAccess(firstAllowed) ? firstAllowed : "home";

  if (!requestedPage || !isPageKey(requestedPage)) {
    return { page: fallback, shouldReplace: true, reason: "invalid" };
  }
  if (!canAccess(requestedPage)) {
    return { page: fallback, shouldReplace: true, reason: "unauthorized" };
  }
  return { page: requestedPage, shouldReplace: false, reason: "allowed" };
}
