import type { PageKey } from '../components/Layout';
import type { AuthRole, AuthRoleAssignment } from './authTypes';

type PageGroup =
  | 'home'
  | 'personal'
  | 'executive'
  | 'work'
  | 'grc'
  | 'quality'
  | 'reports'
  | 'admin'
  | 'release'
  | 'security';

const ALL_ROLES: AuthRole[] = [
  'super_admin',
  'executive',
  'governance_admin',
  'division_head',
  'department_manager',
  'project_owner',
  'milestone_owner',
  'task_owner',
  'auditor',
  'compliance_officer',
  'viewer',
  'employee',
];

const ADMIN_ROLES: AuthRole[] = ['super_admin', 'governance_admin'];
const SECURITY_ROLES: AuthRole[] = ['super_admin', 'governance_admin', 'auditor'];
const EXECUTIVE_ROLES: AuthRole[] = ['super_admin', 'executive', 'governance_admin'];
const WORK_MANAGER_ROLES: AuthRole[] = [
  'super_admin',
  'executive',
  'governance_admin',
  'division_head',
  'department_manager',
  'project_owner',
  'milestone_owner',
];
const GRC_ROLES: AuthRole[] = [
  'super_admin',
  'executive',
  'governance_admin',
  'division_head',
  'department_manager',
  'auditor',
  'compliance_officer',
];
const QUALITY_ROLES: AuthRole[] = [
  'super_admin',
  'executive',
  'governance_admin',
  'division_head',
  'department_manager',
  'auditor',
  'compliance_officer',
];
const REPORT_ROLES: AuthRole[] = [
  'super_admin',
  'executive',
  'governance_admin',
  'division_head',
  'department_manager',
  'auditor',
  'compliance_officer',
  'viewer',
];

const EXTERNAL_PILOT_ORGANIZATION = 'V99 Synthetic External Organization';
const EXTERNAL_PILOT_PAGES: PageKey[] = ['home', 'myWork', 'ovr', 'approvals', 'userGuide', 'uatIssueCapture'];
const READ_ONLY_BLOCKED_PAGES: PageKey[] = ['importExport', 'reportBuilder', 'backupScheduler'];

export const pageGroups: Record<PageKey, PageGroup> = {
  home: 'home',
  executiveHub: 'executive',
  workHub: 'work',
  grcHub: 'grc',
  qualityHub: 'quality',
  reportsHub: 'reports',
  adminHub: 'admin',
  finishFast: 'release',
  productionFinish: 'release',
  releaseFactory: 'release',
  productionProof: 'release',
  dashboard: 'executive',
  analytics: 'executive',
  myWork: 'personal',
  projects: 'work',
  departments: 'work',
  risks: 'grc',
  compliance: 'grc',
  audit: 'grc',
  ovr: 'personal',
  ovrRisk: 'quality',
  governance: 'grc',
  escalations: 'work',
  approvals: 'personal',
  evidence: 'personal',
  importExport: 'reports',
  accessControl: 'admin',
  setupCenter: 'admin',
  userGuide: 'personal',
  operations: 'work',
  testing: 'security',
  performance: 'security',
  security: 'security',
  commandCenter: 'executive',
  globalSearch: 'personal',
  documents: 'reports',
  relationships: 'quality',
  releaseCandidate: 'release',
  productionRelease: 'release',
  migrationVerifier: 'release',
  restoreDryRun: 'release',
  adminSafety: 'security',
  bilingualDictionary: 'admin',
  boardPacks: 'reports',
  reportBuilder: 'reports',
  evidenceVault: 'quality',
  departmentScorecards: 'reports',
  backupScheduler: 'reports',
  scenarioPlanning: 'executive',
  mobileCommand: 'executive',
  automationIntelligence: 'grc',
  riskAppetiteKri: 'grc',
  smartReviews: 'grc',
  committeeAutomation: 'grc',
  stagingValidation: 'release',
  rlsPersonaLab: 'security',
  translationCoverage: 'admin',
  loadSeedCenter: 'release',
  productionBackupStrategy: 'release',
  migrationRunbook: 'release',
  scenarioTestConsole: 'admin',
  uatIssueCapture: 'personal',
  admin: 'admin',
};

const groupRoles: Record<PageGroup, AuthRole[]> = {
  home: ALL_ROLES,
  personal: ALL_ROLES,
  executive: EXECUTIVE_ROLES,
  work: WORK_MANAGER_ROLES,
  grc: GRC_ROLES,
  quality: QUALITY_ROLES,
  reports: REPORT_ROLES,
  admin: ADMIN_ROLES,
  release: ADMIN_ROLES,
  security: SECURITY_ROLES,
};

export function hasRole(roles: AuthRoleAssignment[], allowed: AuthRole[]): boolean {
  return roles.some(role => allowed.includes(role.role));
}

export function canAccessPage(page: PageKey, roles: AuthRoleAssignment[]): boolean {
  if (roles.length === 0) return false;
  const group = pageGroups[page] ?? 'personal';
  return hasRole(roles, groupRoles[group]);
}

export function isExternalPilotOrganization(organizationName?: string | null): boolean {
  return organizationName === EXTERNAL_PILOT_ORGANIZATION;
}

export function canAccessPageForUser(
  page: PageKey,
  roles: AuthRoleAssignment[],
  organizationName?: string | null
): boolean {
  if (isExternalPilotOrganization(organizationName) && !EXTERNAL_PILOT_PAGES.includes(page)) {
    return false;
  }
  const isReadOnlyRole = roles.some(role => role.role === 'viewer' || role.role === 'auditor');
  const hasElevatedRole = roles.some(role => [
    'super_admin',
    'executive',
    'governance_admin',
    'division_head',
    'department_manager',
    'compliance_officer',
  ].includes(role.role));
  if (isReadOnlyRole && !hasElevatedRole && READ_ONLY_BLOCKED_PAGES.includes(page)) {
    return false;
  }
  return canAccessPage(page, roles);
}

export function firstAllowedPage(roles: AuthRoleAssignment[], organizationName?: string | null): PageKey {
  if (canAccessPageForUser('executiveHub', roles, organizationName)) return 'executiveHub';
  if (canAccessPageForUser('workHub', roles, organizationName)) return 'workHub';
  if (canAccessPageForUser('grcHub', roles, organizationName)) return 'grcHub';
  if (canAccessPageForUser('qualityHub', roles, organizationName)) return 'qualityHub';
  return 'home';
}

export function getPageGroup(page: PageKey): PageGroup {
  return pageGroups[page] ?? 'personal';
}
